-- ============================================================
-- CLEANUP FUNCTION - Auto cleanup stuck certificate queue
-- ============================================================
-- Creates function that can be called periodically to cleanup
-- stuck queue entries
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_certificate_queue()
RETURNS TABLE(cleaned_count INTEGER, stuck_count INTEGER) 
LANGUAGE plpgsql
AS $$
DECLARE
  cleaned INTEGER := 0;
  stuck INTEGER := 0;
BEGIN
  -- Clean up completed certificates that are stuck in pending
  WITH cleaned_jobs AS (
    UPDATE certificate_queue cq
    SET 
      status = 'completed',
      processed_at = NOW()
    FROM certificates c
    WHERE cq.registration_id = c.registration_id
      AND cq.status = 'pending'
      AND c.status = 'generated'
      AND c.certificate_url IS NOT NULL
    RETURNING cq.id
  )
  SELECT COUNT(*) INTO cleaned FROM cleaned_jobs;
  
  -- Count stuck processing jobs (>10 minutes)
  SELECT COUNT(*) INTO stuck
  FROM certificate_queue
  WHERE status = 'processing'
    AND EXTRACT(EPOCH FROM (NOW() - updated_at))/60 > 10;
  
  -- Reset stuck processing jobs to pending
  IF stuck > 0 THEN
    UPDATE certificate_queue
    SET 
      status = 'pending',
      error_message = 'Reset from stuck processing state'
    WHERE status = 'processing'
      AND EXTRACT(EPOCH FROM (NOW() - updated_at))/60 > 10;
  END IF;
  
  RETURN QUERY SELECT cleaned, stuck;
END;
$$;

-- Grant execute to authenticated users (admins)
GRANT EXECUTE ON FUNCTION cleanup_certificate_queue() TO authenticated;

COMMENT ON FUNCTION cleanup_certificate_queue() IS 
'Cleans up stuck certificate queue entries. Returns (cleaned_count, stuck_count).
Should be called periodically (e.g., daily) via cron or manually by admins.';

-- Example usage:
-- SELECT * FROM cleanup_certificate_queue();
