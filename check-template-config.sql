-- Check if certificate template config exists in database
-- Event ID: 6f4d2f11-325e-4dc5-a61d-cb154393e715

SELECT 
  id,
  event_id,
  template_url,
  template_width,
  template_height,
  name_position_x,
  name_position_y,
  name_font_size,
  cert_number_position_x,
  cert_number_position_y,
  cert_number_font_size,
  created_at,
  updated_at
FROM certificate_templates 
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715';

-- Expected: Should return 1 row with template_url pointing to storage
-- If no rows: Template uploaded to storage but config not saved to DB
