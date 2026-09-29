-- Debug: Why user's /tiket page shows empty
-- Run these queries in Supabase SQL Editor

-- Query 1: Check current user session
SELECT auth.uid() as current_user_id, auth.email() as current_email;

-- Query 2: Check registrations for this user directly (bypass RLS)
SELECT 
  id,
  user_id,
  event_id,
  ticket_code,
  name,
  status,
  checked_in_at,
  created_at
FROM event_registrations
WHERE user_id = auth.uid();

-- Query 3: Check if RLS policy exists for user read
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'event_registrations'
  AND policyname ILIKE '%user%read%';

-- Query 4: Test the exact query that frontend uses (with RLS)
SELECT 
  er.*,
  e.title,
  e.slug,
  e.start_date,
  e.end_date,
  e.location,
  e.poster_url
FROM event_registrations er
LEFT JOIN events e ON e.id = er.event_id
WHERE er.user_id = auth.uid()
  AND er.status = 'approved'
ORDER BY er.created_at DESC;

-- Query 5: Check user_id matches and status
SELECT 
  id,
  user_id,
  user_id = auth.uid() as id_matches,
  status,
  ticket_code,
  name
FROM event_registrations
WHERE ticket_code = '789406ff3204c49b13993273b28b904';

-- Query 6: Force create the policy if missing
DO $$
BEGIN
  -- Drop if exists
  DROP POLICY IF EXISTS "Users read own registrations" ON event_registrations;
  
  -- Create the policy
  CREATE POLICY "Users read own registrations"
  ON event_registrations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
  
  RAISE NOTICE 'Policy recreated successfully';
END $$;

-- Query 7: Verify policy was created
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'event_registrations'
  AND policyname = 'Users read own registrations';
