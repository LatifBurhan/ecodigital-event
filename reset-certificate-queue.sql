-- Reset certificate queue untuk event ini
-- Event ID: 6f4d2f11-325e-4dc5-a61d-cb154393e715

BEGIN;

-- Reset ALL queue items ke pending (not just failed/processing)
UPDATE certificate_queue 
SET 
  status = 'pending',
  retry_count = 0,
  last_error = NULL,
  processed_at = NULL,
  error_message = NULL
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715';

-- Reset ALL certificate records ke pending
UPDATE certificates 
SET 
  status = 'pending',
  retry_count = 0,
  error_message = NULL,
  certificate_url = NULL,
  generated_at = NULL
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715';

-- Check hasil queue
SELECT 
  'Queue Status' as table_name,
  status,
  COUNT(*) as count
FROM certificate_queue
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
GROUP BY status

UNION ALL

-- Check hasil certificates
SELECT 
  'Certificate Status' as table_name,
  status,
  COUNT(*) as count
FROM certificates
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
GROUP BY status
ORDER BY table_name, status;

COMMIT;
