// Supabase Edge Function untuk monitoring certificate health
// Deploy: supabase functions deploy monitor-certificate-health
// Cron: Setup di Supabase Dashboard → Edge Functions → Cron

import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Check stuck processing jobs (>10 minutes)
    const { data: stuckJobs, error: stuckError } = await supabase
      .from('certificate_queue')
      .select('id, registration_id, created_at')
      .eq('status', 'processing')
      .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (stuckError) throw stuckError;

    // Check queue-certificate mismatch
    const { data: mismatches, error: mismatchError } = await supabase.rpc(
      'check_certificate_queue_health'
    );

    if (mismatchError) throw mismatchError;

    const issues = {
      stuck_jobs: stuckJobs?.length || 0,
      mismatches: mismatches || 0,
    };

    // Send alert if issues found
    if (issues.stuck_jobs > 0 || issues.mismatches > 0) {
      // TODO: Send email/Slack notification
      console.error('⚠️ Certificate system issues detected:', issues);
      
      // Auto cleanup if issues found
      await supabase.rpc('cleanup_certificate_queue');
      
      return new Response(
        JSON.stringify({ 
          status: 'warning', 
          issues,
          action: 'auto-cleanup triggered'
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        status: 'healthy', 
        timestamp: new Date().toISOString() 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
