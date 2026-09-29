-- Check if certificate template exists for an event
-- Replace 'YOUR_EVENT_ID' with actual event ID

-- Check certificate template
SELECT 
  ct.id,
  ct.event_id,
  ct.template_url,
  ct.created_at,
  e.title as event_title
FROM certificate_templates ct
JOIN events e ON e.id = ct.event_id
WHERE ct.event_id = 'YOUR_EVENT_ID';

-- If empty result, check if event exists
SELECT id, title, slug FROM events WHERE id = 'YOUR_EVENT_ID';

-- Check all templates for all events
SELECT 
  e.title as event_title,
  e.id as event_id,
  ct.id as template_id,
  ct.template_url,
  ct.created_at
FROM events e
LEFT JOIN certificate_templates ct ON ct.event_id = e.id
ORDER BY e.created_at DESC
LIMIT 10;
