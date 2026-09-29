import sharp from 'sharp';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { createServerFn } from '@tanstack/react-start';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export interface CertificateConfig {
  templateUrl: string;
  templateWidth: number;
  templateHeight: number;
  nameConfig: {
    x: number;
    y: number;
    fontSize: number;
    color: string;
    fontFamily: string;
    textAlign: 'left' | 'center' | 'right';
  };
  certNumberConfig: {
    x: number;
    y: number;
    fontSize: number;
    color: string;
    fontFamily: string;
    textAlign: 'left' | 'center' | 'right';
  };
}

export interface CertificateData {
  participantName: string;
  certificateNumber: string;
}

/**
 * Generate SVG text element for overlay
 */
function generateTextSvg(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color: string,
  fontFamily: string,
  textAlign: 'left' | 'center' | 'right',
  width: number
): string {
  let anchor = 'start';
  let textX = x;

  if (textAlign === 'center') {
    anchor = 'middle';
    textX = width / 2;
  } else if (textAlign === 'right') {
    anchor = 'end';
    textX = width - x;
  }

  // Use web-safe fonts and ensure visibility
  const webSafeFont = fontFamily === 'Arial' ? 'Arial, Helvetica, sans-serif' : fontFamily;

  return `
    <svg width="${width}" height="${fontSize * 3}">
      <style>
        .cert-text {
          font-family: ${webSafeFont};
          font-size: ${fontSize}px;
          font-weight: bold;
          fill: ${color};
          text-anchor: ${anchor};
        }
      </style>
      <text class="cert-text" x="${textX}" y="${fontSize * 2}">${text}</text>
    </svg>
  `;
}

/**
 * Generate certificate image with participant data overlaid on template
 */
/**
 * Generate certificate image with participant data overlaid on template
 * Using Canvas API for reliable text rendering
 */
export async function generateCertificate(
  config: CertificateConfig,
  data: CertificateData
): Promise<Buffer> {
  try {
    console.log('Generating certificate with config:', {
      templateUrl: config.templateUrl,
      participantName: data.participantName,
      certificateNumber: data.certificateNumber,
      namePosition: { x: config.nameConfig.x, y: config.nameConfig.y },
      certNumberPosition: { x: config.certNumberConfig.x, y: config.certNumberConfig.y },
    });

    // Download and load template image
    const templateResponse = await fetch(config.templateUrl);
    if (!templateResponse.ok) {
      throw new Error('Failed to download template image');
    }
    const templateBuffer = Buffer.from(await templateResponse.arrayBuffer());
    const templateImage = await loadImage(templateBuffer);

    const width = templateImage.width;
    const height = templateImage.height;

    console.log('Template dimensions:', { width, height });

    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Draw template
    ctx.drawImage(templateImage, 0, 0, width, height);

    // Draw certificate number
    ctx.fillStyle = config.certNumberConfig.color;
    ctx.font = `bold ${config.certNumberConfig.fontSize}px Arial, sans-serif`;
    
    if (config.certNumberConfig.textAlign === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(data.certificateNumber, width / 2, config.certNumberConfig.y);
    } else if (config.certNumberConfig.textAlign === 'right') {
      ctx.textAlign = 'right';
      ctx.fillText(data.certificateNumber, width - config.certNumberConfig.x, config.certNumberConfig.y);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(data.certificateNumber, config.certNumberConfig.x, config.certNumberConfig.y);
    }

    // Draw participant name
    ctx.fillStyle = config.nameConfig.color;
    ctx.font = `bold ${config.nameConfig.fontSize}px Arial, sans-serif`;
    
    if (config.nameConfig.textAlign === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(data.participantName, width / 2, config.nameConfig.y);
    } else if (config.nameConfig.textAlign === 'right') {
      ctx.textAlign = 'right';
      ctx.fillText(data.participantName, width - config.nameConfig.x, config.nameConfig.y);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(data.participantName, config.nameConfig.x, config.nameConfig.y);
    }

    console.log('Text drawn on canvas');

    // Convert canvas to buffer
    const imageBuffer = canvas.toBuffer('image/png');

    console.log('Certificate composite complete');

    return imageBuffer;
  } catch (error) {
    console.error('Error generating certificate:', error);
    throw new Error(
      `Failed to generate certificate: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Upload generated certificate to Supabase Storage
 */
export async function uploadCertificate(
  eventId: string,
  registrationId: string,
  certificateBuffer: Buffer
): Promise<string> {
  const supabase = supabaseAdmin;

  const fileName = `${eventId}/${registrationId}.png`;

  const { data, error } = await supabase.storage
    .from('certificates')
    .upload(fileName, certificateBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload certificate: ${error.message}`);
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from('certificates').getPublicUrl(fileName);

  return publicUrl;
}

/**
 * Process certificate queue item
 */
export const processCertificateQueue = createServerFn({
  method: 'POST',
}).handler(async () => {
  const supabase = supabaseAdmin;

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
    return { processed: false, message: 'No pending jobs' };
  }

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

    // Generate certificate
    await supabase
      .from('certificates')
      .update({ status: 'processing' })
      .eq('id', certificate.id);

    const certificateBuffer = await generateCertificate(config, data);

    // Upload to storage
    const certificateUrl = await uploadCertificate(
      queueItem.event_id,
      queueItem.registration_id,
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

    // Mark queue item as completed
    await supabase
      .from('certificate_queue')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', queueItem.id);

    return {
      processed: true,
      certificateId: certificate.id,
      certificateUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update retry count
    const newRetryCount = (queueItem.retry_count || 0) + 1;
    const maxRetries = 3;

    if (newRetryCount >= maxRetries) {
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
});
