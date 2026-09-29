-- Test: Check if attendance data exists for event bf7f772d-d08b-4637-abe4-d897438c7790
-- Run in Supabase SQL Editor

-- Query 1: Check if event exists
SELECT id, slug, title, is_published
FROM events
WHERE id = 'bf7f772d-d08b-4637-abe4-d897438c7790';

-- Query 2: Check registrations for this event
SELECT 
  id,
  event_id,
  user_id,
  name,
  email,
  status,
  checked_in_at,
  created_at
FROM event_registrations
WHERE event_id = 'bf7f772d-d08b-4637-abe4-d897438c7790';

-- Query 3: Check only approved registrations
SELECT 
  id,
  name,
  email,
  status,
  checked_in_at
FROM event_registrations
WHERE event_id = 'bf7f772d-d08b-4637-abe4-d897438c7790'
  AND status = 'approved';

-- Query 4: Check current user role
SELECT 
  auth.uid() as current_user_id,
  public.has_role(auth.uid(), 'admin') as is_admin;

-- Query 5: Check RLS policies on event_registrations for admin
SELECT 
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies
WHERE tablename = 'event_registrations'
  AND policyname ILIKE '%admin%';
