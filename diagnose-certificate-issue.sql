-- Diagnostic query untuk certificate generation issue
-- Cek situasi user yang sudah ada vs yang baru

-- 1. Cek certificate_queue status
SELECT 
  cq.id as queue_id,
  cq.event_id,
  cq.registration_id,  
  cq.status as queue_status,
  cq.created_at as queued_at,
  er.name as participant_name,
  er.email,
  -- Check if certificate record exists
  c.id as cert_id,
  c.status as cert_status,
  c.certificate_url,
  c.created_at as cert_created_at
FROM certificate_queue cq
JOIN event_registrations er ON cq.registration_id = er.id
LEFT JOIN certificates c ON c.registration_id = er.id
WHERE cq.event_id = (SELECT id FROM events WHERE slug LIKE '%ada%' LIMIT 1)
ORDER BY cq.created_at DESC;

-- 2. Cek attendance records
SELECT 
  ar.registration_id,
  er.name,
  er.email,
  ar.attended_at,
  -- Check certificate queue
  cq.id as queue_id,
  cq.status as queue_status,
  -- Check certificate  
  c.id as cert_id,
  c.status as cert_status,
  c.certificate_url IS NOT NULL as has_url
FROM attendance_records ar
JOIN event_registrations er ON ar.registration_id = er.id
LEFT JOIN certificate_queue cq ON cq.registration_id = er.id
LEFT JOIN certificates c ON c.registration_id = er.id
WHERE er.event_id = (SELECT id FROM events WHERE slug LIKE '%ada%' LIMIT 1)
ORDER BY ar.attended_at DESC;

-- 3. Find problematic cases
-- Users yang attend tapi tidak ada di certificate_queue atau tidak ada certificate record
SELECT 
  er.name,
  er.email,
  ar.attended_at,
  CASE 
    WHEN cq.id IS NULL THEN 'Missing from queue'
    WHEN c.id IS NULL THEN 'Missing certificate record'
    WHEN c.status != 'generated' THEN 'Certificate not generated'
    WHEN c.certificate_url IS NULL THEN 'Missing certificate URL'
    ELSE 'OK'
  END as issue
FROM attendance_records ar
JOIN event_registrations er ON ar.registration_id = er.id
LEFT JOIN certificate_queue cq ON cq.registration_id = er.id AND cq.status = 'pending'
LEFT JOIN certificates c ON c.registration_id = er.id
WHERE er.event_id = (SELECT id FROM events WHERE slug LIKE '%ada%' LIMIT 1)
  AND (cq.id IS NULL OR c.id IS NULL OR c.status != 'generated' OR c.certificate_url IS NULL)
ORDER BY ar.attended_at DESC;
