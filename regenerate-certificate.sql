-- Regenerate certificate untuk Rudi budiman
-- Run this in Supabase SQL Editor

-- 1. Backup info (optional, just to see)
SELECT 
  r.id as registration_id,
  r.name,
  r.ticket_code,
  c.certificate_number,
  c.certificate_url as old_url
FROM event_registrations r
LEFT JOIN certificates c ON c.registration_id = r.id
WHERE r.name = 'Rudi budiman';

-- 2. Delete old certificate and queue
DELETE FROM certificate_queue 
WHERE registration_id IN (
  SELECT id FROM event_registrations WHERE name = 'Rudi budiman'
);

DELETE FROM certificates 
WHERE registration_id IN (
  SELECT id FROM event_registrations WHERE name = 'Rudi budiman'
);

-- 3. Re-trigger certificate creation (simulate check-in update)
DO $$
DECLARE
  reg_record RECORD;
BEGIN
  -- Get the registration
  FOR reg_record IN 
    SELECT id, event_id, name
    FROM event_registrations
    WHERE name = 'Rudi budiman' 
    AND checked_in_at IS NOT NULL
  LOOP
    -- Create certificate record
    INSERT INTO certificates (registration_id, event_id, certificate_number, status)
    VALUES (
      reg_record.id,
      reg_record.event_id,
      (SELECT UPPER(slug) || '-' || LPAD((SELECT COUNT(*) + 1 FROM certificates WHERE event_id = reg_record.event_id)::text, 3, '0') FROM events WHERE id = reg_record.event_id),
      'pending'
    );
    
    -- Create queue
    INSERT INTO certificate_queue (registration_id, event_id, status, priority)
    VALUES (reg_record.id, reg_record.event_id, 'pending', 0);
    
    RAISE NOTICE 'Certificate recreated for: %', reg_record.name;
  END LOOP;
END $$;

-- 4. Verify
SELECT 
  r.name,
  c.certificate_number,
  c.status as cert_status,
  q.status as queue_status
FROM event_registrations r
LEFT JOIN certificates c ON c.registration_id = r.id
LEFT JOIN certificate_queue q ON q.registration_id = r.id
WHERE r.name = 'Rudi budiman';
