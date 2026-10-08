-- ============================================================
-- ADD QUEUE CONSTRAINT - Prevent Duplicate Active Jobs
-- ============================================================
-- Adds unique constraint to prevent duplicate pending/processing
-- jobs for same registration
-- ============================================================

BEGIN;

-- Drop existing index if any
DROP INDEX IF EXISTS certificate_queue_active_registration_idx;

-- Create partial unique index
-- Only one active (pending/processing) job per registration
CREATE UNIQUE INDEX certificate_queue_active_registration_idx 
ON certificate_queue (registration_id) 
WHERE status IN ('pending', 'processing');

-- Add comment
COMMENT ON INDEX certificate_queue_active_registration_idx IS 
'Prevents duplicate active certificate generation jobs for same registration';

COMMIT;

-- Verification
SELECT 
  'Constraint Added' as status,
  COUNT(*) as active_jobs_count
FROM certificate_queue
WHERE status IN ('pending', 'processing');
