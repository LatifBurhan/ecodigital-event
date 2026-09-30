-- Quick Certificate System Check
-- Event ID: 6f4d2f11-325e-4dc5-a61d-cb154393e715

-- 1. Check if template exists (MOST IMPORTANT!)
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Template EXISTS'
    ELSE '❌ Template MISSING - UPLOAD TEMPLATE FIRST!'
  END as template_status,
  COUNT(*) as template_count
FROM certificate_templates 
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715';

-- 2. If template exists, show details
SELECT 
  template_url,
  template_width,
  template_height,
  name_position_x,
  name_position_y,
  cert_number_position_x,
  cert_number_position_y
FROM certificate_templates 
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715';

-- 3. Check participants status
SELECT 
  COUNT(*) as total_checked_in,
  COUNT(CASE WHEN EXISTS (
    SELECT 1 FROM certificates c WHERE c.registration_id = er.id
  ) THEN 1 END) as has_certificate_record,
  COUNT(CASE WHEN EXISTS (
    SELECT 1 FROM certificates c WHERE c.registration_id = er.id AND c.status = 'generated'
  ) THEN 1 END) as certificates_generated
FROM event_registrations er
WHERE er.event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
  AND er.checked_in_at IS NOT NULL;

-- 4. Queue status
SELECT 
  status,
  COUNT(*) as count,
  MAX(retry_count) as max_retries,
  MAX(last_error) as error_message
FROM certificate_queue
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
GROUP BY status
ORDER BY 
  CASE status
    WHEN 'pending' THEN 1
    WHEN 'processing' THEN 2
    WHEN 'completed' THEN 3
    WHEN 'failed' THEN 4
  END;

-- 5. Certificate status
SELECT 
  status,
  COUNT(*) as count
FROM certificates
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
GROUP BY status
ORDER BY 
  CASE status
    WHEN 'pending' THEN 1
    WHEN 'processing' THEN 2
    WHEN 'generated' THEN 3
    WHEN 'failed' THEN 4
  END;

-- 6. Participants needing certificates
SELECT 
  r.name,
  r.email,
  r.checked_in_at,
  COALESCE(c.status, 'NO RECORD') as cert_status,
  COALESCE(cq.status, 'NO QUEUE') as queue_status,
  cq.last_error
FROM event_registrations r
LEFT JOIN certificates c ON c.registration_id = r.id
LEFT JOIN certificate_queue cq ON cq.registration_id = r.id
WHERE r.event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
  AND r.checked_in_at IS NOT NULL
ORDER BY r.checked_in_at DESC;
