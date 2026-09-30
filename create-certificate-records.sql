-- Create certificate records untuk peserta yang sudah check-in
-- Event ID: 6f4d2f11-325e-4dc5-a61d-cb154393e715

-- Insert certificates untuk yang belum punya record
INSERT INTO certificates (registration_id, event_id, certificate_number, status)
SELECT 
  r.id,
  r.event_id,
  UPPER((SELECT slug FROM events WHERE id = r.event_id)) || '-' || 
    LPAD((ROW_NUMBER() OVER (ORDER BY r.checked_in_at))::text, 3, '0'),
  'pending'
FROM event_registrations r
WHERE r.event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
  AND r.checked_in_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM certificates c WHERE c.registration_id = r.id
  );

-- Check hasil
SELECT 
  c.certificate_number,
  r.name,
  c.status,
  c.created_at
FROM certificates c
JOIN event_registrations r ON r.id = c.registration_id
WHERE c.event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
ORDER BY c.created_at;
