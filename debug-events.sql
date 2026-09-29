-- Debug: Cek kenapa event tidak bisa dimuat
-- Run this in Supabase SQL Editor

-- 1. CEK: Apakah ada event di database?
SELECT COUNT(*) as total_events FROM public.events;

-- 2. CEK: Apakah ada event yang published?
SELECT 
  id,
  slug,
  title,
  is_published,
  registration_open,
  start_date,
  end_date
FROM public.events
ORDER BY created_at DESC;

-- 3. CEK: Detail semua kolom dari events
SELECT * FROM public.events LIMIT 1;

-- 4. CEK: RLS policies untuk events table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'events'
ORDER BY policyname;

-- 5. TEST: Query yang sama dengan aplikasi (sebagai anon)
SET ROLE anon;
SELECT 
  id, slug, title, start_date, end_date, location, maps_url, 
  organizer, poster_url, description, lineup, facilities, 
  socials, is_paid, price, payment_methods, registration_open
FROM public.events
WHERE is_published = true
ORDER BY start_date;
RESET ROLE;

-- 6. SOLUSI: Jika tidak ada event, buat sample event
-- INSERT INTO public.events (
--   slug, title, start_date, end_date, location, maps_url,
--   organizer, poster_url, description, is_published, 
--   registration_open, is_paid, price
-- ) VALUES (
--   'test-event',
--   'Test Event',
--   CURRENT_DATE + INTERVAL '7 days',
--   CURRENT_DATE + INTERVAL '7 days',
--   'Test Location',
--   'https://maps.google.com',
--   'Test Organizer',
--   'https://placehold.co/600x800/2d5f3e/ffffff?text=Test+Event',
--   'This is a test event',
--   true,
--   true,
--   false,
--   0
-- );
