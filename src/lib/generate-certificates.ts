import { createServerFn } from '@tanstack/react-start';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

/**
 * Server function to fetch pending certificates data
 * Generation happens on client-side using browser Canvas API
 */
export const generateCertificates = createServerFn({ method: 'POST' })
  .validator((data: { eventId?: string }) => data)
  .handler(async ({ data }) => {
    try {
      console.log('[GenerateCertificates] Fetching pending certificates for eventId:', data.eventId);
      
      // Get pending certificate jobs
      let query = supabaseAdmin
        .from('certificate_queue')
        .select(`
          id,
          registration_id,
          event_id,
          event_registrations!inner(
            id,
            name,
            email,
            event_id
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (data.eventId) {
        query = query.eq('event_id', data.eventId);
      }

      const { data: pendingJobs, error: queueError } = await query;

      if (queueError) {
        throw new Error(`Failed to fetch pending jobs: ${queueError.message}`);
      }

      if (!pendingJobs || pendingJobs.length === 0) {
        return {
          success: true,
          pending: [],
          message: 'No pending certificates',
        };
      }

      // Get template and certificate data for each job
      const jobsWithData = await Promise.all(
        pendingJobs.map(async (job) => {
          const { data: template } = await supabaseAdmin
            .from('certificate_templates')
            .select('*')
            .eq('event_id', job.event_id)
            .single();

          const { data: certificate } = await supabaseAdmin
            .from('certificates')
            .select('*')
            .eq('registration_id', job.registration_id)
            .single();

          return {
            jobId: job.id,
            registrationId: job.registration_id,
            eventId: job.event_id,
            participantName: (job.event_registrations as any).name,
            certificateNumber: certificate?.certificate_number,
            template: template ? {
              url: template.template_url,
              nameX: template.name_position_x,
              nameY: template.name_position_y,
              nameFontSize: template.name_font_size,
              nameColor: template.name_font_color,
              nameAlign: template.name_text_align,
              certX: template.cert_number_position_x,
              certY: template.cert_number_position_y,
              certFontSize: template.cert_number_font_size,
              certColor: template.cert_number_font_color,
              certAlign: template.cert_number_text_align,
            } : null,
          };
        })
      );

      return {
        success: true,
        pending: jobsWithData.filter(j => j.template && j.certificateNumber),
        message: `Found ${jobsWithData.length} pending certificate(s)`,
      };
    } catch (error) {
      console.error('[GenerateCertificates] Error:', error);
      
      return {
        success: false,
        pending: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
