import { createServerFn } from '@tanstack/react-start';

/**
 * Server function to generate certificates
 * Calls Supabase Edge Function which supports canvas operations
 */
export const generateCertificates = createServerFn({ method: 'POST' })
  .validator((data: { eventId?: string }) => data)
  .handler(async ({ data }) => {
    try {
      console.log('[GenerateCertificates] Calling Edge Function with eventId:', data.eventId);
      
      // Get Supabase URL and anon key from environment
      const supabaseUrl = process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration missing');
      }
      
      // Call Edge Function
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-certificates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ eventId: data.eventId }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GenerateCertificates] Edge Function error:', errorText);
        throw new Error(`Edge Function failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
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
