/**
 * Server-side Certificate Processing
 * This runs on the server using service role credentials
 */

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

interface CertificateConfig {
  templateUrl: string;
  templateWidth: number;
  templateHeight: number;
  nameConfig: {
    x: number;
    y: number;
    fontSize: number;
    color: string;
    textAlign: 'left' | 'center' | 'right';
  };
  certNumberConfig: {
    x: number;
    y: number;
    fontSize: number;
    color: string;
    textAlign: 'left' | 'center' | 'right';
  };
}

interface CertificateData {
  participantName: string;
  certificateNumber: string;
}

async function generateCertificateImage(
  config: CertificateConfig,
  data: CertificateData
): Promise<Buffer> {
  // Download template
  const templateResponse = await fetch(config.templateUrl);
  if (!templateResponse.ok) {
    throw new Error('Failed to download template image');
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

async function uploadCertificate(
  eventId: string,
  registrationId: string,
  certificateBuffer: Buffer
): Promise<string> {
  const fileName = `${eventId}/${registrationId}.png`;

  const { error } = await supabaseAdmin.storage
    .from('certificates')
    .upload(fileName, certificateBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload certificate: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from('certificates').getPublicUrl(fileName);

  return publicUrl;
}

export async function processPendingCertificates(eventId?: string) {
  console.log('[CertProcessor] Starting certificate processing...', { eventId });

  // Get pending jobs
  let query = supabaseAdmin
    .from('certificate_queue')
    .select('id, registration_id, event_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  const { data: pendingJobs, error: queueError } = await query;

  if (queueError) {
    console.error('[CertProcessor] Queue fetch error:', queueError);
    throw new Error(`Failed to fetch pending jobs: ${queueError.message}`);
  }

  if (!pendingJobs || pendingJobs.length === 0) {
    console.log('[CertProcessor] No pending jobs');
    return { success: true, processed: 0, failed: 0, message: 'No pending certificates' };
  }

  console.log(`[CertProcessor] Found ${pendingJobs.length} pending job(s)`);

  let processed = 0;
  let failed = 0;
  const results: Array<{ job_id: string; success: boolean; error?: string }> = [];

  for (const job of pendingJobs) {
    const jobId = job.id;
    const registrationId = job.registration_id;

    console.log(`[CertProcessor] Processing job ${jobId}`);

    try {
      // Mark as processing
      await supabaseAdmin
        .from('certificate_queue')
        .update({ status: 'processing' })
        .eq('id', jobId);

      // Get registration
      const { data: registration, error: regError } = await supabaseAdmin
        .from('event_registrations')
        .select('*')
        .eq('id', registrationId)
        .single();

      if (regError || !registration) {
        throw new Error(`Registration not found: ${regError?.message || 'null'}`);
      }

      console.log(`[CertProcessor] Found registration for ${registration.name}`);

      // Get template
      const { data: template, error: templateError } = await supabaseAdmin
        .from('certificate_templates')
        .select('*')
        .eq('event_id', registration.event_id)
        .single();

      if (templateError || !template) {
        throw new Error(`Template not found: ${templateError?.message || 'null'}`);
      }

      console.log(`[CertProcessor] Found template:`, template.template_url);

      // Get certificate record
      const { data: certificate, error: certError } = await supabaseAdmin
        .from('certificates')
        .select('*')
        .eq('registration_id', registrationId)
        .single();

      if (certError || !certificate) {
        throw new Error(`Certificate record not found: ${certError?.message || 'null'}`);
      }

      // Prepare config
      const config: CertificateConfig = {
        templateUrl: template.template_url,
        templateWidth: template.template_width,
        templateHeight: template.template_height,
        nameConfig: {
          x: template.name_position_x,
          y: template.name_position_y,
          fontSize: template.name_font_size,
          color: template.name_font_color,
          textAlign: template.name_text_align as 'left' | 'center' | 'right',
        },
        certNumberConfig: {
          x: template.cert_number_position_x,
          y: template.cert_number_position_y,
          fontSize: template.cert_number_font_size,
          color: template.cert_number_font_color,
          textAlign: template.cert_number_text_align as 'left' | 'center' | 'right',
        },
      };

      const data: CertificateData = {
        participantName: registration.name,
        certificateNumber: certificate.certificate_number,
      };

      console.log(`[CertProcessor] Generating certificate...`);

      // Update certificate status
      await supabaseAdmin
        .from('certificates')
        .update({ status: 'processing' })
        .eq('id', certificate.id);

      // Generate certificate
      const certificateBuffer = await generateCertificateImage(config, data);

      console.log(`[CertProcessor] Uploading certificate...`);

      // Upload to storage
      const certificateUrl = await uploadCertificate(
        registration.event_id,
        registrationId,
        certificateBuffer
      );

      // Update certificate record
      await supabaseAdmin
        .from('certificates')
        .update({
          certificate_url: certificateUrl,
          status: 'generated',
          generated_at: new Date().toISOString(),
        })
        .eq('id', certificate.id);

      // Mark queue completed
      await supabaseAdmin
        .from('certificate_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      processed++;
      results.push({ job_id: jobId, success: true });
      console.log(`[CertProcessor] ✓ Certificate generated for ${registration.name}`);
    } catch (error) {
      failed++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[CertProcessor] ✗ Failed for job ${jobId}:`, errorMessage);

      // Mark job as failed
      await supabaseAdmin
        .from('certificate_queue')
        .update({
          status: 'failed',
          error_message: errorMessage,
          processed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      results.push({ job_id: jobId, success: false, error: errorMessage });
    }
  }

  console.log(`[CertProcessor] Completed: ${processed} succeeded, ${failed} failed`);

  return {
    success: true,
    processed,
    failed,
    total: pendingJobs.length,
    message: `Generated ${processed} certificate(s)${failed > 0 ? `, ${failed} failed` : ''}`,
    results,
  };
}
