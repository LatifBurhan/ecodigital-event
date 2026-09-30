// Edge Function for Certificate Generation
// Uses Deno Canvas API which supports image manipulation

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Canvas, loadImage } from 'https://deno.land/x/canvas@v1.4.1/mod.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CertificateConfig {
  templateUrl: string;
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
): Promise<Uint8Array> {
  // Load template image
  const templateImage = await loadImage(config.templateUrl);
  
  const width = templateImage.width();
  const height = templateImage.height();

  // Create canvas
  const canvas = new Canvas({
    width,
    height,
  });
  
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

  // Convert to PNG
  return canvas.toBuffer();
}

async function uploadCertificate(
  eventId: string,
  registrationId: string,
  certificateBuffer: Uint8Array
): Promise<string> {
  const fileName = `${eventId}/${registrationId}.png`;

  const { error } = await supabase.storage
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
  } = supabase.storage.from('certificates').getPublicUrl(fileName);

  return publicUrl;
}

Deno.serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { eventId } = await req.json();

    console.log('[EdgeFunction] Starting certificate generation for event:', eventId);

    // Get pending jobs
    let query = supabase
      .from('certificate_queue')
      .select('id, registration_id, event_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    const { data: pendingJobs, error: queueError } = await query;

    if (queueError) {
      throw new Error(`Failed to fetch pending jobs: ${queueError.message}`);
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          failed: 0,
          message: 'No pending certificates',
        }),
        {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    console.log(`[EdgeFunction] Found ${pendingJobs.length} pending job(s)`);

    let processed = 0;
    let failed = 0;

    for (const job of pendingJobs) {
      const jobId = job.id;
      const registrationId = job.registration_id;

      try {
        // Mark as processing
        await supabase
          .from('certificate_queue')
          .update({ status: 'processing' })
          .eq('id', jobId);

        // Get registration
        const { data: registration, error: regError } = await supabase
          .from('event_registrations')
          .select('*')
          .eq('id', registrationId)
          .single();

        if (regError || !registration) {
          throw new Error(`Registration not found`);
        }

        // Get template
        const { data: template, error: templateError } = await supabase
          .from('certificate_templates')
          .select('*')
          .eq('event_id', registration.event_id)
          .single();

        if (templateError || !template) {
          throw new Error(`Template not found`);
        }

        // Get certificate record
        const { data: certificate, error: certError } = await supabase
          .from('certificates')
          .select('*')
          .eq('registration_id', registrationId)
          .single();

        if (certError || !certificate) {
          throw new Error(`Certificate record not found`);
        }

        // Prepare config
        const config: CertificateConfig = {
          templateUrl: template.template_url,
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

        // Update certificate status
        await supabase
          .from('certificates')
          .update({ status: 'processing' })
          .eq('id', certificate.id);

        // Generate certificate
        const certificateBuffer = await generateCertificateImage(config, data);

        // Upload to storage
        const certificateUrl = await uploadCertificate(
          registration.event_id,
          registrationId,
          certificateBuffer
        );

        // Update certificate record
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
          .eq('id', jobId);

        processed++;
        console.log(`[EdgeFunction] ✓ Generated for ${registration.name}`);
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[EdgeFunction] ✗ Failed for job ${jobId}:`, errorMessage);

        // Mark job as failed
        await supabase
          .from('certificate_queue')
          .update({
            status: 'failed',
            error_message: errorMessage,
            processed_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        failed,
        total: pendingJobs.length,
        message: `Generated ${processed} certificate(s)${failed > 0 ? `, ${failed} failed` : ''}`,
      }),
      {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[EdgeFunction] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        status: 500,
      }
    );
  }
});
