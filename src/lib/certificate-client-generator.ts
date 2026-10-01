/**
 * Client-side Certificate Generator
 * Uses browser Canvas API - works everywhere, no dependencies needed
 */

import { supabase } from '@/integrations/supabase/client';

interface CertificateJob {
  jobId: string;
  registrationId: string;
  eventId: string;
  participantName: string;
  certificateNumber: string;
  template: {
    url: string;
    nameX: number;
    nameY: number;
    nameFontSize: number;
    nameColor: string;
    nameAlign: string;
    certX: number;
    certY: number;
    certFontSize: number;
    certColor: string;
    certAlign: string;
  };
}

async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

async function generateCertificateBlob(job: CertificateJob): Promise<Blob> {
  // Load template image
  const templateImg = await loadImageFromUrl(job.template.url);
  
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = templateImg.width;
  canvas.height = templateImg.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // Draw template
  ctx.drawImage(templateImg, 0, 0);
  
  // Draw certificate number
  ctx.fillStyle = job.template.certColor;
  ctx.font = `bold ${job.template.certFontSize}px Arial, sans-serif`;
  ctx.textAlign = job.template.certAlign as CanvasTextAlign;
  
  let certX = job.template.certX;
  if (job.template.certAlign === 'center') {
    certX = canvas.width / 2;
  } else if (job.template.certAlign === 'right') {
    certX = canvas.width - job.template.certX;
  }
  
  ctx.fillText(job.certificateNumber, certX, job.template.certY);
  
  // Draw participant name
  ctx.fillStyle = job.template.nameColor;
  ctx.font = `bold ${job.template.nameFontSize}px Arial, sans-serif`;
  ctx.textAlign = job.template.nameAlign as CanvasTextAlign;
  
  let nameX = job.template.nameX;
  if (job.template.nameAlign === 'center') {
    nameX = canvas.width / 2;
  } else if (job.template.nameAlign === 'right') {
    nameX = canvas.width - job.template.nameX;
  }
  
  ctx.fillText(job.participantName, nameX, job.template.nameY);
  
  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create blob'));
      }
    }, 'image/png', 0.95);
  });
}

async function uploadCertificate(
  eventId: string,
  registrationId: string,
  blob: Blob
): Promise<string> {
  const fileName = `${eventId}/${registrationId}.png`;
  
  const { error: uploadError } = await supabase.storage
    .from('certificates')
    .upload(fileName, blob, {
      contentType: 'image/png',
      upsert: true,
    });
  
  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }
  
  const { data } = supabase.storage.from('certificates').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function processClientSideCertificates(
  jobs: CertificateJob[],
  onProgress?: (current: number, total: number, name: string) => void
): Promise<{ processed: number; failed: number; errors: string[] }> {
  let processed = 0;
  let failed = 0;
  const errors: string[] = [];
  
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    
    if (onProgress) {
      onProgress(i + 1, jobs.length, job.participantName);
    }
    
    try {
      console.log(`[ClientGen] Processing ${job.participantName}...`);
      
      // Check if certificate already exists and is generated
      const { data: existingCert } = await supabase
        .from('certificates')
        .select('status, certificate_url')
        .eq('registration_id', job.registrationId)
        .single();
      
      if (existingCert?.status === 'generated' && existingCert.certificate_url) {
        console.log(`[ClientGen] ⊘ Skipping ${job.participantName} - already has generated certificate`);
        
        // Mark queue as completed (no need to regenerate)
        await supabase
          .from('certificate_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
          })
          .eq('id', job.jobId);
        
        processed++;
        continue; // Skip to next job
      }
      
      // Mark as processing
      await supabase
        .from('certificate_queue')
        .update({ status: 'processing' })
        .eq('id', job.jobId);
      
      // Update certificate status
      await supabase
        .from('certificates')
        .update({ status: 'processing' })
        .eq('registration_id', job.registrationId);
      
      // Generate certificate image
      const blob = await generateCertificateBlob(job);
      
      // Upload to storage
      const certificateUrl = await uploadCertificate(job.eventId, job.registrationId, blob);
      
      // Update certificate record
      await supabase
        .from('certificates')
        .update({
          certificate_url: certificateUrl,
          status: 'generated',
          generated_at: new Date().toISOString(),
        })
        .eq('registration_id', job.registrationId);
      
      // Mark queue completed
      await supabase
        .from('certificate_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', job.jobId);
      
      processed++;
      console.log(`[ClientGen] ✓ Generated for ${job.participantName}`);
    } catch (error) {
      failed++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${job.participantName}: ${errorMessage}`);
      console.error(`[ClientGen] ✗ Failed for ${job.participantName}:`, errorMessage);
      
      // Mark job as failed
      await supabase
        .from('certificate_queue')
        .update({
          status: 'failed',
          error_message: errorMessage,
          processed_at: new Date().toISOString(),
        })
        .eq('id', job.jobId);
    }
  }
  
  return { processed, failed, errors };
}
