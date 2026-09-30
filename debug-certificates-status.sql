-- Debug certificate status for an event
-- Replace 'YOUR_EVENT_ID' with actual event ID

-- Check registrations and their certificates
SELECT 
  er.id as registration_id,
  er.name,
  er.email,
  er.checked_in_at,
  c.id as certificate_id,
  c.certificate_number,
  c.certificate_url,
  c.status as cert_status,
  c.generated_at,
  CASE 
    WHEN c.certificate_url IS NOT NULL AND c.status = 'generated' THEN '✓ Sudah ada sertifikat'
    WHEN c.status = 'processing' THEN '⏳ Sedang diproses'
    WHEN c.status = 'failed' THEN '✗ Gagal generate'
    WHEN c.status = 'pending' THEN '⏸ Pending'
    ELSE '- Belum tersedia'
  END as status_display
FROM event_registrations er
LEFT JOIN certificates c ON c.registration_id = er.id
WHERE er.event_id = 'YOUR_EVENT_ID'
  AND er.status = 'approved'
  AND er.checked_in_at IS NOT NULL
ORDER BY er.checked_in_at DESC;

-- Count summary
SELECT 
  COUNT(*) FILTER (WHERE checked_in_at IS NOT NULL) as total_checkedin,
  COUNT(*) FILTER (WHERE c.status = 'generated' AND c.certificate_url IS NOT NULL) as has_certificate,
  COUNT(*) FILTER (WHERE c.status = 'processing') as processing,
  COUNT(*) FILTER (WHERE c.status = 'failed') as failed,
  COUNT(*) FILTER (WHERE c.status = 'pending' OR c.status IS NULL) as pending
FROM event_registrations er
LEFT JOIN certificates c ON c.registration_id = er.id
WHERE er.event_id = 'YOUR_EVENT_ID'
  AND er.status = 'approved'
  AND er.checked_in_at IS NOT NULL;

-- Check if there are certificates without matching registrations (data integrity)
SELECT 
  c.id,
  c.registration_id,
  c.certificate_number,
  c.status,
  'Orphan certificate - no matching registration' as issue
FROM certificates c
WHERE NOT EXISTS (
  SELECT 1 FROM event_registrations er 
  WHERE er.id = c.registration_id
);
