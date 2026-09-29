-- Test: Apakah user bisa query registrasi sendiri
-- Run this in Supabase SQL Editor

-- 1. Ambil user_id dan email dari user yang login (ganti dengan email Anda)
SELECT 
  id as user_id,
  email
FROM auth.users
WHERE email = 'latifburhanuddin05@gmail.com';

-- Copy user_id dari hasil query #1, lalu:

-- 2. Test query yang sama dengan frontend
-- Ganti USER_ID_HERE dengan hasil dari query #1
SELECT 
  r.ticket_code,
  r.event_id,
  r.user_id,
  r.email,
  r.status
FROM public.event_registrations r
WHERE r.user_id = 'USER_ID_HERE'
   OR r.email = 'latifburhanuddin05@gmail.com'
ORDER BY r.created_at DESC;

-- Expected: Harus return registrasi

-- 3. Test dengan simulasi RLS (sebagai authenticated user)
SET ROLE authenticated;
-- Ganti dengan user_id dari query #1
SET request.jwt.claims.sub = 'USER_ID_HERE';

SELECT 
  ticket_code,
  event_id,
  status
FROM public.event_registrations
WHERE user_id = current_setting('request.jwt.claims.sub')::uuid;

RESET ROLE;

-- Jika query #3 return EMPTY: RLS policy block!
