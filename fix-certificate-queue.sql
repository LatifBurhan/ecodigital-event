-- ============================================================
-- FIX CERTIFICATE QUEUE - Clean up stuck jobs
-- ============================================================
-- Fixes certificate queue that's stuck or has duplicate entries
-- for registrations that already have generated certificates
-- ============================================================

BEGIN;

-- Step 1: Show current situation
SELECT 
  'Current Queue Status' as info,
  status,
  COUNT(*) as count
FROM certificate_queue
GROUP BY status
ORDER BY status;

-- Step 2: Find problematic queue entries
-- These are jobs marked as "pending" but certificates are already generated
SELECT 
  'Stuck Pending Jobs' as info,
  cq.id as queue_id,
  cq.registration_id,
  cq.status as queue_status,
  c.status as certificate_status,
  c.certificate_url,
  er.name as participant_name
FROM certificate_queue cq
JOIN certificates c ON c.registration_id = cq.registration_id
JOIN event_registrations er ON er.id = cq.registration_id
WHERE cq.status = 'pending'
  AND c.status = 'generated'
  AND c.certificate_url IS NOT NULL;

-- Step 3: Fix stuck jobs - mark as completed
UPDATE certificate_queue
SET 
  status = 'completed',
  processed_at = NOW()
WHERE id IN (
  SELECT cq.id
  FROM certificate_queue cq
  JOIN certificates c ON c.registration_id = cq.registration_id
  WHERE cq.status = 'pending'
    AND c.status = 'generated'
    AND c.certificate_url IS NOT NULL
);

-- Step 4: Fix certificates stuck in "processing" but queue is completed
UPDATE certificates
SET status = 'generated'
WHERE status = 'processing'
  AND certificate_url IS NOT NULL
  AND registration_id IN (
    SELECT registration_id 
    FROM certificate_queue 
    WHERE status = 'completed'
  );

-- Step 5: Fix certificates stuck in "processing" without URL
-- These failed but weren't marked as failed
UPDATE certificates c
SET status = 'pending'
FROM certificate_queue cq
WHERE c.registration_id = cq.registration_id
  AND c.status = 'processing'
  AND c.certificate_url IS NULL
  AND cq.status IN ('failed', 'pending');

-- Step 6: Remove duplicate queue entries for same registration
-- Keep only the latest one
WITH ranked_queue AS (
  SELECT 
    id,
    registration_id,
    ROW_NUMBER() OVER (
      PARTITION BY registration_id 
      ORDER BY created_at DESC
    ) as rn
  FROM certificate_queue
  WHERE status IN ('pending', 'processing')
)
DELETE FROM certificate_queue
WHERE id IN (
  SELECT id FROM ranked_queue WHERE rn > 1
);

-- Step 7: Summary after fix
SELECT 
  'After Fix - Queue Status' as info,
  status,
  COUNT(*) as count
FROM certificate_queue
GROUP BY status
ORDER BY status;

-- Step 8: Summary - Certificates Status
SELECT 
  'After Fix - Certificate Status' as info,
  status,
  COUNT(*) as count
FROM certificates
GROUP BY status
ORDER BY status;

-- Step 9: Check for any remaining issues
SELECT 
  'Remaining Issues' as info,
  COUNT(*) as count
FROM certificate_queue cq
JOIN certificates c ON c.registration_id = cq.registration_id
WHERE (
  -- Queue pending but cert already generated
  (cq.status = 'pending' AND c.status = 'generated' AND c.certificate_url IS NOT NULL)
  OR
  -- Cert processing but queue not processing
  (c.status = 'processing' AND cq.status NOT IN ('processing', 'pending'))
);

COMMIT;

-- ============================================================
-- VERIFICATION QUERIES (run separately if needed)
-- ============================================================

-- Check registrations with checked_in but no certificate
/*
SELECT 
  er.id,
  er.name,
  er.email,
  er.checked_in_at,
  c.status as cert_status,
  c.certificate_url,
  cq.status as queue_status
FROM event_registrations er
LEFT JOIN certificates c ON c.registration_id = er.id
LEFT JOIN certificate_queue cq ON cq.registration_id = er.id
WHERE er.checked_in_at IS NOT NULL
  AND er.status = 'approved'
  AND (c.id IS NULL OR c.status != 'generated' OR c.certificate_url IS NULL)
ORDER BY er.checked_in_at DESC;
*/

-- Check for orphaned queue entries (no matching certificate record)
/*
SELECT 
  cq.id,
  cq.registration_id,
  cq.status,
  er.name
FROM certificate_queue cq
LEFT JOIN certificates c ON c.registration_id = cq.registration_id
JOIN event_registrations er ON er.id = cq.registration_id
WHERE c.id IS NULL
  AND cq.status != 'completed';
*/

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

DO $$
DECLARE
  stuck_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO stuck_count
  FROM certificate_queue cq
  JOIN certificates c ON c.registration_id = cq.registration_id
  WHERE cq.status = 'pending'
    AND c.status = 'generated'
    AND c.certificate_url IS NOT NULL;
  
  IF stuck_count = 0 THEN
    RAISE NOTICE '✅ SUCCESS: Certificate queue is clean!';
  ELSE
    RAISE NOTICE '⚠️ WARNING: Still % stuck jobs remain', stuck_count;
  END IF;
END $$;
