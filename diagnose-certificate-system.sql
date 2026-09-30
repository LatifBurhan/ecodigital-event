-- ========================================
-- CERTIFICATE SYSTEM DIAGNOSTIC
-- ========================================
-- Jalankan ini untuk mendapatkan full picture
-- dari certificate system untuk event ini
-- Supabase Dashboard compatible version
-- ========================================

-- 1. EVENT INFO
SELECT '=== EVENT INFO ===' as section;
SELECT 
  id,
  title,
  slug,
  start_date,
  end_date,
  location
FROM events 
WHERE id = '6f4d2f11-325e-4dc5-a61d-cb154393e715';

-- 2. CERTIFICATE TEMPLATE
SELECT '=== CERTIFICATE TEMPLATE ===' as section;
SELECT 
  id,
  event_id,
  template_url,
  template_width,
  template_height,
  name_position_x,
  name_position_y,
  name_font_size,
  name_font_color,
  cert_number_position_x,
  cert_number_position_y,
  cert_number_font_size,
  created_at
FROM certificate_templates 
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715';

-- 3. REGISTRATIONS SUMMARY
SELECT '=== REGISTRATIONS SUMMARY ===' as section;
SELECT 
  COUNT(*) as total_registrations,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
  COUNT(CASE WHEN checked_in_at IS NOT NULL THEN 1 END) as checked_in,
  COUNT(CASE WHEN status = 'approved' AND checked_in_at IS NOT NULL THEN 1 END) as approved_and_checked_in
FROM event_registrations
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715';

-- 4. CHECKED-IN PARTICIPANTS
SELECT '=== CHECKED-IN PARTICIPANTS ===' as section;
SELECT 
  id,
  name,
  email,
  checked_in_at,
  status
FROM event_registrations
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
  AND checked_in_at IS NOT NULL
ORDER BY checked_in_at DESC;

-- 5. CERTIFICATE QUEUE STATUS
SELECT '=== CERTIFICATE QUEUE STATUS ===' as section;
SELECT 
  status,
  COUNT(*) as count,
  MAX(last_error) as latest_error
FROM certificate_queue
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
GROUP BY status;

-- 6. CERTIFICATE QUEUE DETAILS
SELECT '=== CERTIFICATE QUEUE DETAILS ===' as section;
SELECT 
  cq.id,
  cq.registration_id,
  r.name,
  r.email,
  cq.status,
  cq.retry_count,
  cq.last_error,
  cq.created_at
FROM certificate_queue cq
JOIN event_registrations r ON r.id = cq.registration_id
WHERE cq.event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
ORDER BY cq.created_at DESC;

-- 7. CERTIFICATES STATUS
SELECT '=== CERTIFICATES STATUS ===' as section;
SELECT 
  status,
  COUNT(*) as count
FROM certificates
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
GROUP BY status;

-- 8. CERTIFICATES DETAILS
SELECT '=== CERTIFICATES DETAILS ===' as section;
SELECT 
  c.id,
  c.certificate_number,
  r.name,
  r.email,
  c.status,
  c.certificate_url,
  c.error_message,
  c.generated_at,
  c.created_at
FROM certificates c
JOIN event_registrations r ON r.id = c.registration_id
WHERE c.event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
ORDER BY c.created_at DESC;

-- 9. STORAGE BUCKETS
SELECT '=== STORAGE BUCKETS ===' as section;
SELECT 
  id as bucket_name,
  name,
  public,
  created_at
FROM storage.buckets
WHERE id IN ('certificate-templates', 'certificates');

-- 10. RECENT TEMPLATE FILES
SELECT '=== RECENT TEMPLATE FILES ===' as section;
SELECT 
  name,
  bucket_id,
  created_at,
  updated_at
FROM storage.objects
WHERE bucket_id = 'certificate-templates'
ORDER BY created_at DESC
LIMIT 5;

-- 11. RECENT CERTIFICATE FILES
SELECT '=== RECENT CERTIFICATE FILES ===' as section;
SELECT 
  name,
  bucket_id,
  created_at
FROM storage.objects
WHERE bucket_id = 'certificates'
ORDER BY created_at DESC
LIMIT 5;

-- 12. TRIGGER CHECK
SELECT '=== TRIGGER CHECK ===' as section;
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgname IN ('event_registrations_queue_certificate');

-- 13. FUNCTION CHECK
SELECT '=== FUNCTION CHECK ===' as section;
SELECT 
  proname as function_name,
  pronargs as num_args
FROM pg_proc
WHERE proname IN ('queue_certificate_generation', 'generate_certificate_number');

-- DIAGNOSIS COMPLETE
SELECT '=== DIAGNOSIS COMPLETE ===' as section;
