-- Cek apakah user bisa read registrasi mereka sendiri
-- Run this in Supabase SQL Editor

-- 1. CEK: Policy untuk user read own registrations
SELECT 
  policyname,
  cmd,
  roles,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'event_registrations'
  AND policyname = 'Users read own registrations';

-- Expected: 
-- policyname: "Users read own registrations"
-- cmd: SELECT
-- using: (auth.uid() = user_id)

-- 2. CEK: Registrasi dengan user_id
SELECT 
  r.ticket_code,
  r.name,
  r.email,
  r.user_id,
  r.event_id,
  r.status,
  u.email as user_email
FROM public.event_registrations r
LEFT JOIN auth.users u ON u.id = r.user_id
ORDER BY r.created_at DESC
LIMIT 5;

-- IMPORTANT: Cek apakah user_id terisi!
-- Jika user_id = NULL, user tidak bisa query registrasi mereka

-- 3. SOLUSI: Jika user_id NULL, update:
-- UPDATE public.event_registrations
-- SET user_id = (SELECT id FROM auth.users WHERE email = event_registrations.email)
-- WHERE user_id IS NULL;
