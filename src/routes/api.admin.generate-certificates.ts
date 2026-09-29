import type { APIEvent } from "@solidjs/start/server";
import { generateCertificate } from "@/lib/certificate-generator";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * API endpoint for bulk certificate generation (admin only)
 * POST /api/admin/generate-certificates
 * Body: { event_id?: string } - optional filter by event
 */
export async function POST({ request }: APIEvent) {
  try {
    const body = await request.json();
    const eventId = body?.event_id as string | undefined;

    // Get pending certificate jobs
    let query = supabaseAdmin
      .from("certificate_queue")
      .select(`
        id,
        registration_id,
        event_registrations!inner(
          id,
          ticket_code,
          name,
          event_id,
          events!inner(
            id,
            title,
            certificate_templates(
              id,
              template_url,
              name_position_x,
              name_position_y,
              name_font_size,
              cert_number_position_x,
              cert_number_position_y,
              cert_number_font_size
            )
          )
        )
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    // Filter by event if provided
    if (eventId) {
      query = query.eq("event_registrations.event_id", eventId);
    }

    const { data: pendingJobs, error: fetchError } = await query;

    if (fetchError) {
      console.error("[API] Error fetching pending jobs:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch pending jobs" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, failed: 0, message: "No pending certificates" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[API] Processing ${pendingJobs.length} certificate(s)...`);

    let processed = 0;
    let failed = 0;
    const results: Array<{ job_id: string; success: boolean; error?: string }> = [];

    // Process each job
    for (const job of pendingJobs) {
      const jobId = job.id;
      const registration = job.event_registrations as any;
      const event = registration?.events;
      const template = event?.certificate_templates?.[0];

      try {
        // Validate data
        if (!registration || !event || !template) {
          throw new Error("Missing registration, event, or template data");
        }

        // Mark as processing
        await supabaseAdmin
          .from("certificate_queue")
          .update({ status: "processing" })
          .eq("id", jobId);

        // Generate certificate
        console.log(`[API] Generating certificate for ${registration.name}...`);
        
        const certificateUrl = await generateCertificate({
          registration_id: registration.id,
          participant_name: registration.name,
          event_title: event.title,
          ticket_code: registration.ticket_code,
          template_url: template.template_url,
          name_position: { x: template.name_position_x, y: template.name_position_y },
          name_font_size: template.name_font_size,
          cert_number_position: { x: template.cert_number_position_x, y: template.cert_number_position_y },
          cert_number_font_size: template.cert_number_font_size,
        });

        // Save certificate record
        const { error: certError } = await supabaseAdmin
          .from("certificates")
          .insert({
            registration_id: registration.id,
            event_id: event.id,
            certificate_url: certificateUrl,
            issued_at: new Date().toISOString(),
          });

        if (certError) throw certError;

        // Mark job as completed
        await supabaseAdmin
          .from("certificate_queue")
          .update({ status: "completed", processed_at: new Date().toISOString() })
          .eq("id", jobId);

        processed++;
        results.push({ job_id: jobId, success: true });
        console.log(`[API] ✓ Certificate generated for ${registration.name}`);
      } catch (error) {
        console.error(`[API] ✗ Failed to generate certificate for job ${jobId}:`, error);
        
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        // Mark job as failed
        await supabaseAdmin
          .from("certificate_queue")
          .update({
            status: "failed",
            error_message: errorMessage,
            processed_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        failed++;
        results.push({ job_id: jobId, success: false, error: errorMessage });
      }
    }

    console.log(`[API] Certificate generation completed: ${processed} succeeded, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        failed,
        total: pendingJobs.length,
        message: `Generated ${processed} certificate(s)${failed > 0 ? `, ${failed} failed` : ""}`,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[API] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
