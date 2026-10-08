-- ============================================================
-- MONITORING QUERIES - Certificate Queue System
-- ============================================================
-- Queries untuk monitoring certificate system health
-- Jalankan manual di SQL Editor untuk check status
-- ============================================================

-- ============================================================
-- 1. QUEUE STATUS OVERVIEW
-- ============================================================
-- Melihat status queue secara keseluruhan
SELECT 
  'Queue Status Overview' as report,
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM certificate_queue
GROUP BY status
ORDER BY status;

-- ============================================================
-- 2. CERTIFICATE STATUS OVERVIEW
-- ============================================================
-- Melihat status certificates
SELECT 
  'Certificate Status Overview' as report,
  status,
  COUNT(*) as count
FROM certificates
GROUP BY status
ORDER BY status;

-- ============================================================
-- 3. STUCK PROCESSING JOBS (>10 minutes)
-- ============================================================
-- Jobs yang stuck di status processing terlalu lama
SELECT 
  'Stuck Processing Jobs' as report,
  cq.id as queue_id,
  er.name as participant_name,
  er.email,
  cq.status as queue_status,
  c.status as cert_status,
  cq.created_at,
  EXTRACT(EPOCH FROM (NOW() - cq.created_at))/60 as minutes_since_created
FROM certificate_queue cq
JOIN certificates c ON c.registration_id = cq.registration_id
JOIN event_registrations er ON er.id = cq.registration_id
WHERE cq.status = 'processing'
  AND EXTRACT(EPOCH FROM (NOW() - cq.created_at))/60 > 10
ORDER BY cq.created_at;

-- ============================================================
-- 4. QUEUE-CERTIFICATE MISMATCH
-- ============================================================
-- Queue pending tapi certificate sudah generated (harusnya completed)
SELECT 
  'Queue-Certificate Mismatch' as report,
  cq.id as queue_id,
  er.name as participant_name,
  cq.status as queue_status,
  c.status as cert_status,
  c.certificate_url IS NOT NULL as has_url
FROM certificate_queue cq
JOIN certificates c ON c.registration_id = cq.registration_id
JOIN event_registrations er ON er.id = cq.registration_id
WHERE cq.status = 'pending'
  AND c.status = 'generated'
  AND c.certificate_url IS NOT NULL;

-- ============================================================
-- 5. CHECKED-IN WITHOUT CERTIFICATES
-- ============================================================
-- Peserta yang sudah check-in tapi belum punya certificate generated
SELECT 
  'Checked-in Without Certificates' as report,
  er.id,
  er.name,
  er.email,
  e.title as event_title,
  er.checked_in_at,
  c.status as cert_status,
  cq.status as queue_status
FROM event_registrations er
JOIN events e ON e.id = er.event_id
LEFT JOIN certificates c ON c.registration_id = er.id
LEFT JOIN certificate_queue cq ON cq.registration_id = er.id
WHERE er.checked_in_at IS NOT NULL
  AND er.status = 'approved'
  AND (c.status IS NULL OR c.status != 'generated' OR c.certificate_url IS NULL)
ORDER BY er.checked_in_at DESC
LIMIT 20;

-- ============================================================
-- 6. RECENT FAILED JOBS (Last 24 hours)
-- ============================================================
-- Jobs yang gagal dalam 24 jam terakhir
SELECT 
  'Recent Failed Jobs' as report,
  cq.id as queue_id,
  er.name as participant_name,
  er.email,
  cq.error_message,
  cq.processed_at,
  EXTRACT(EPOCH FROM (NOW() - cq.processed_at))/60 as minutes_ago
FROM certificate_queue cq
JOIN event_registrations er ON er.id = cq.registration_id
WHERE cq.status = 'failed'
  AND cq.processed_at > NOW() - INTERVAL '24 hours'
ORDER BY cq.processed_at DESC;

-- ============================================================
-- 7. DUPLICATE QUEUE ENTRIES
-- ============================================================
-- Registration yang punya lebih dari 1 active queue entry
SELECT 
  'Duplicate Queue Entries' as report,
  registration_id,
  COUNT(*) as queue_count,
  array_agg(id) as queue_ids,
  array_agg(status) as statuses
FROM certificate_queue
WHERE status IN ('pending', 'processing')
GROUP BY registration_id
HAVING COUNT(*) > 1;

-- ============================================================
-- 8. ORPHANED QUEUE ENTRIES
-- ============================================================
-- Queue entries tanpa certificate record
SELECT 
  'Orphaned Queue Entries' as report,
  cq.id as queue_id,
  cq.registration_id,
  cq.status,
  er.name as participant_name
FROM certificate_queue cq
LEFT JOIN certificates c ON c.registration_id = cq.registration_id
JOIN event_registrations er ON er.id = cq.registration_id
WHERE c.id IS NULL
  AND cq.status != 'completed';

-- ============================================================
-- 9. RECENT SUCCESSFUL GENERATIONS (Last 7 days)
-- ============================================================
-- Sertifikat yang berhasil di-generate dalam 7 hari terakhir
SELECT 
  'Recent Successful Generations' as report,
  DATE(c.generated_at) as generation_date,
  COUNT(*) as count
FROM certificates c
WHERE c.status = 'generated'
  AND c.generated_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(c.generated_at)
ORDER BY generation_date DESC;

-- ============================================================
-- 10. OVERALL HEALTH CHECK
-- ============================================================
-- Summary health check
SELECT 
  'Overall Health Check' as report,
  (SELECT COUNT(*) FROM certificate_queue WHERE status = 'pending') as pending_queue,
  (SELECT COUNT(*) FROM certificate_queue WHERE status = 'processing') as processing_queue,
  (SELECT COUNT(*) FROM certificate_queue WHERE status = 'failed') as failed_queue,
  (SELECT COUNT(*) FROM certificates WHERE status = 'generated') as generated_certs,
  (SELECT COUNT(*) FROM certificates WHERE status = 'pending') as pending_certs,
  (SELECT COUNT(*) FROM event_registrations WHERE checked_in_at IS NOT NULL) as total_checked_in;

-- ============================================================
-- SUMMARY & RECOMMENDATIONS
-- ============================================================

DO $$
DECLARE
  stuck_count INTEGER;
  mismatch_count INTEGER;
  duplicate_count INTEGER;
BEGIN
  -- Count issues
  SELECT COUNT(*) INTO stuck_count
  FROM certificate_queue
  WHERE status = 'processing'
    AND EXTRACT(EPOCH FROM (NOW() - created_at))/60 > 10;
  
  SELECT COUNT(*) INTO mismatch_count
  FROM certificate_queue cq
  JOIN certificates c ON c.registration_id = cq.registration_id
  WHERE cq.status = 'pending'
    AND c.status = 'generated'
    AND c.certificate_url IS NOT NULL;
  
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT registration_id
    FROM certificate_queue
    WHERE status IN ('pending', 'processing')
    GROUP BY registration_id
    HAVING COUNT(*) > 1
  ) dups;
  
  -- Report
  RAISE NOTICE '=====================================';
  RAISE NOTICE 'CERTIFICATE SYSTEM HEALTH CHECK';
  RAISE NOTICE '=====================================';
  
  IF stuck_count = 0 AND mismatch_count = 0 AND duplicate_count = 0 THEN
    RAISE NOTICE '✅ HEALTHY: No issues detected';
  ELSE
    IF stuck_count > 0 THEN
      RAISE NOTICE '⚠️ % stuck processing jobs (>10 min)', stuck_count;
    END IF;
    
    IF mismatch_count > 0 THEN
      RAISE NOTICE '⚠️ % queue-certificate mismatches', mismatch_count;
    END IF;
    
    IF duplicate_count > 0 THEN
      RAISE NOTICE '⚠️ % registrations with duplicate queue entries', duplicate_count;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE 'RECOMMENDED ACTION: Run fix-certificate-queue.sql';
  END IF;
  
  RAISE NOTICE '=====================================';
END $$;
