#!/usr/bin/env bun

/**
 * Certificate Queue Processor
 * 
 * This script processes pending certificate generation jobs.
 * Can be run:
 * 1. Manually: bun run scripts/process-certificates.ts
 * 2. As a cron job (every 5 minutes): run this in crontab
 * 3. Via API endpoint: POST /api/process-certificates
 */

import { createClient } from '@supabase/supabase-js';
import { generateCertificate, uploadCertificate, type CertificateConfig, type CertificateData } from '../src/lib/certificate-generator';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function processNextJob() {
  console.log('[Certificate Processor] Checking for pending jobs...');

  // Get next pending job
  const { data: queueItem, error: queueError } = await supabase
    .from('certificate_queue')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (queueError || !queueItem) {
    console.log('[Certificate Processor] No pending jobs');
    return { processed: false, message: 'No pending jobs' };
  }

  console.log(`[Certificate Processor] Processing job ${queueItem.id}`);

  try {
    // Mark as processing
    await supabase
      .from('certificate_queue')
      .update({ status: 'processing' })
      .eq('id', queueItem.id);

    // Get template config
    const { data: template, error: templateError } = await supabase
      .from('certificate_templates')
      .select('*')
      .eq('event_id', queueItem.event_id)
      .single();

    if (templateError || !template) {
      throw new Error('Certificate template not found');
    }

    // Get registration data
    const { data: registration, error: regError } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('id', queueItem.registration_id)
      .single();

    if (regError || !registration) {
      throw new Error('Registration not found');
    }

    // Get certificate record
    const { data: certificate, error: certError } = await supabase
      .from('certificates')
      .select('*')
      .eq('registration_id', queueItem.registration_id)
      .single();

    if (certError || !certificate) {
      throw new Error('Certificate record not found');
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
        fontFamily: template.name_font_family,
        textAlign: template.name_text_align as 'left' | 'center' | 'right',
      },
      certNumberConfig: {
        x: template.cert_number_position_x,
        y: template.cert_number_position_y,
        fontSize: template.cert_number_font_size,
        color: template.cert_number_font_color,
        fontFamily: template.cert_number_font_family,
        textAlign: template.cert_number_text_align as 'left' | 'center' | 'right',
      },
    };

    const data: CertificateData = {
      participantName: registration.name,
      certificateNumber: certificate.certificate_number,
    };

    console.log(`[Certificate Processor] Generating certificate for ${registration.name}`);

    // Update certificate status
    await supabase
      .from('certificates')
      .update({ status: 'processing' })
      .eq('id', certificate.id);

    // Generate certificate
    const certificateBuffer = await generateCertificate(config, data);

    console.log('[Certificate Processor] Certificate generated, uploading...');

    // Upload to storage
    const certificateUrl = await uploadCertificate(
      queueItem.event_id,
      queueItem.registration_id,
      certificateBuffer
    );

    console.log('[Certificate Processor] Certificate uploaded:', certificateUrl);

    // Update certificate record
    await supabase
      .from('certificates')
      .update({
        certificate_url: certificateUrl,
        status: 'generated',
        generated_at: new Date().toISOString(),
      })
      .eq('id', certificate.id);

    // Mark queue item as completed
    await supabase
      .from('certificate_queue')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', queueItem.id);

    console.log('[Certificate Processor] ✅ Job completed successfully');

    return {
      processed: true,
      certificateId: certificate.id,
      certificateUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Certificate Processor] ❌ Error:', errorMessage);

    // Update retry count
    const newRetryCount = (queueItem.retry_count || 0) + 1;
    const maxRetries = 3;

    if (newRetryCount >= maxRetries) {
      console.log('[Certificate Processor] Max retries reached, marking as failed');
      
      // Mark as failed
      await supabase
        .from('certificate_queue')
        .update({
          status: 'failed',
          last_error: errorMessage,
          retry_count: newRetryCount,
        })
        .eq('id', queueItem.id);

      await supabase
        .from('certificates')
        .update({
          status: 'failed',
          error_message: errorMessage,
          retry_count: newRetryCount,
        })
        .eq('registration_id', queueItem.registration_id);
    } else {
      console.log(`[Certificate Processor] Retry ${newRetryCount}/${maxRetries}`);
      
      // Reset to pending for retry
      await supabase
        .from('certificate_queue')
        .update({
          status: 'pending',
          last_error: errorMessage,
          retry_count: newRetryCount,
        })
        .eq('id', queueItem.id);

      await supabase
        .from('certificates')
        .update({
          status: 'pending',
          error_message: errorMessage,
          retry_count: newRetryCount,
        })
        .eq('registration_id', queueItem.registration_id);
    }

    return {
      processed: false,
      error: errorMessage,
      willRetry: newRetryCount < maxRetries,
    };
  }
}

async function processAllPending() {
  let processed = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await processNextJob();
    if (result.processed) {
      processed++;
    } else {
      hasMore = false;
    }
  }

  console.log(`[Certificate Processor] Processed ${processed} certificates`);
  return processed;
}

// Run the processor
processAllPending()
  .then((count) => {
    console.log(`[Certificate Processor] Done. Processed ${count} jobs.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Certificate Processor] Fatal error:', error);
    process.exit(1);
  });
