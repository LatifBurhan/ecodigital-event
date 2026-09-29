import { createServerFn } from '@tanstack/react-start';
import { processPendingCertificates } from './certificate-processor.server';

/**
 * Server function to generate certificates
 * Called from admin UI button
 */
export const generateCertificates = createServerFn({ method: 'POST' })
  .validator((data: { eventId?: string }) => data)
  .handler(async ({ data }) => {
    try {
      console.log('[GenerateCertificates] Called with eventId:', data.eventId);
      
      const result = await processPendingCertificates(data.eventId);
      
      console.log('[GenerateCertificates] Result:', result);
      
      return result;
    } catch (error) {
      console.error('[GenerateCertificates] Error:', error);
      
      return {
        success: false,
        processed: 0,
        failed: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
