#!/usr/bin/env node
/**
 * Standalone Certificate Generator
 * Run: node generate-certificates-standalone.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync } from 'fs';

// Load env manually
const envContent = readFileSync('.env', 'utf-8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const EVENT_ID = '6f4d2f11-325e-4dc5-a61d-cb154393e715';

async function generateCertificate(config, data) {
  console.log(`📄 Generating certificate for ${data.participantName}...`);
  
  // Download template
  const templateResponse = await fetch(config.templateUrl);
  if (!templateResponse.ok) {
    throw new Error('Failed to download template');
  }
  
  const templateBuffer = Buffer.from(await templateResponse.arrayBuffer());
  const templateImage = await loadImage(templateBuffer);
  
  const width = templateImage.width;
  const height = templateImage.height;
  
  // Create canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Draw template
  ctx.drawImage(templateImage, 0, 0, width, height);
  
  // Draw certificate number
  ctx.fillStyle = config.certNumberConfig.color;
  ctx.font = `bold ${config.certNumberConfig.fontSize}px Arial, sans-serif`;
  ctx.textAlign = config.certNumberConfig.textAlign;
  
  let certX = config.certNumberConfig.x;
  if (config.certNumberConfig.textAlign === 'center') {
    certX = width / 2;
  } else if (config.certNumberConfig.textAlign === 'right') {
    certX = width - config.certNumberConfig.x;
  }
  
  ctx.fillText(data.certificateNumber, certX, config.certNumberConfig.y);
  
  // Draw participant name
  ctx.fillStyle = config.nameConfig.color;
  ctx.font = `bold ${config.nameConfig.fontSize}px Arial, sans-serif`;
  ctx.textAlign = config.nameConfig.textAlign;
  
  let nameX = config.nameConfig.x;
  if (config.nameConfig.textAlign === 'center') {
    nameX = width / 2;
  } else if (config.nameConfig.textAlign === 'right') {
    nameX = width - config.nameConfig.x;
  }
  
  ctx.fillText(data.participantName, nameX, config.nameConfig.y);
  
  // Convert to buffer
  return canvas.toBuffer('image/png');
}

async function uploadCertificate(eventId, registrationId, certificateBuffer) {
  const fileName = `${eventId}/${registrationId}.png`;
  
  const { data, error } = await supabase.storage
    .from('certificates')
    .upload(fileName, certificateBuffer, {
      contentType: 'image/png',
      upsert: true,
    });
  
  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
  
  const { data: { publicUrl } } = supabase.storage
    .from('certificates')
    .getPublicUrl(fileName);
  
  return publicUrl;
}

async function main() {
  console.log('🚀 Starting certificate generation...\n');
  
  // Get pending jobs
  const { data: pendingJobs, error: queueError } = await supabase
    .from('certificate_queue')
    .select('id, registration_id')
    .eq('event_id', EVENT_ID)
    .eq('status', 'pending');
  
  if (queueError || !pendingJobs || pendingJobs.length === 0) {
    console.log('✅ No pending jobs');
    return;
  }
  
  console.log(`📋 Found ${pendingJobs.length} pending job(s)\n`);
  
  let processed = 0;
  let failed = 0;
  
  for (const job of pendingJobs) {
    try {
      // Mark as processing
      await supabase
        .from('certificate_queue')
        .update({ status: 'processing' })
        .eq('id', job.id);
      
      // Get registration
      const { data: registration } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('id', job.registration_id)
        .single();
      
      if (!registration) throw new Error('Registration not found');
      
      // Get template
      const { data: template } = await supabase
        .from('certificate_templates')
        .select('*')
        .eq('event_id', registration.event_id)
        .single();
      
      if (!template) throw new Error('Template not found');
      
      // Get certificate record
      const { data: certificate } = await supabase
        .from('certificates')
        .select('*')
        .eq('registration_id', job.registration_id)
        .single();
      
      if (!certificate) throw new Error('Certificate record not found');
      
      // Prepare config
      const config = {
        templateUrl: template.template_url,
        templateWidth: template.template_width,
        templateHeight: template.template_height,
        nameConfig: {
          x: template.name_position_x,
          y: template.name_position_y,
          fontSize: template.name_font_size,
          color: template.name_font_color,
          textAlign: template.name_text_align,
        },
        certNumberConfig: {
          x: template.cert_number_position_x,
          y: template.cert_number_position_y,
          fontSize: template.cert_number_font_size,
          color: template.cert_number_font_color,
          textAlign: template.cert_number_text_align,
        },
      };
      
      const data = {
        participantName: registration.name,
        certificateNumber: certificate.certificate_number,
      };
      
      // Generate
      await supabase
        .from('certificates')
        .update({ status: 'processing' })
        .eq('id', certificate.id);
      
      const certificateBuffer = await generateCertificate(config, data);
      
      // Upload
      const certificateUrl = await uploadCertificate(
        registration.event_id,
        job.registration_id,
        certificateBuffer
      );
      
      // Update certificate
      await supabase
        .from('certificates')
        .update({
          certificate_url: certificateUrl,
          status: 'generated',
          generated_at: new Date().toISOString(),
        })
        .eq('id', certificate.id);
      
      // Mark queue completed
      await supabase
        .from('certificate_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      
      processed++;
      console.log(`✅ Generated certificate for ${registration.name}`);
      
    } catch (error) {
      failed++;
      console.error(`❌ Failed for job ${job.id}:`, error.message);
      
      await supabase
        .from('certificate_queue')
        .update({
          status: 'failed',
          error_message: error.message,
          processed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }
  }
  
  console.log(`\n🎉 Done! Processed: ${processed}, Failed: ${failed}`);
}

main().catch(console.error);
