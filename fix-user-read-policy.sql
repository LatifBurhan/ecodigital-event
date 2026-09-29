-- Fix: User tidak bisa read registrasi sendiri
-- Run this in Supabase SQL Editor

-- 1. CEK: Policy "Users read own registrations" ada?
SELECT 
  policyname,
  cmd,
  roles,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'event_registrations'
  AND policyname = 'Users read own registrations';

-- Expected: 1 row dengan USING (auth.uid() = user_id)
-- Jika KOSONG: Policy belum ada atau salah

-- 2. DROP dan RECREATE policy dengan benar
DROP POLICY IF EXISTS "Users read own registrations" ON public.event_registrations;

CREATE POLICY "Users read own registrations" 
ON public.event_registrations 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- 3. VERIFY policy sudah dibuat
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'event_registrations'
  AND policyname = 'Users read own registrations';

-- 4. TEST: Query sebagai user
-- Ganti dengan user_id dari registrasi
-- Ambil dari query sebelumnya: d4543bae-8558-4224-89eb-6d05df33b5d0
SET ROLE authenticated;
SET request.jwt.claims.sub = 'd4543bae-8558-4224-89eb-6d05df33b5d0';

SELECT 
  ticket_code,
  name,
  status,
  event_id
FROM public.event_registrations
WHERE user_id = current_setting('request.jwt.claims.sub')::uuid;

RESET ROLE;

-- Expected: Harus return registrasi
-- Jika EMPTY: Ada masalah lain

-- 5. CEK: Apakah user_id di registrasi match dengan auth.users?
SELECT 
  r.ticket_code,
  r.user_id as registration_user_id,
  u.id as auth_user_id,
  u.email,
  r.user_id = u.id as ids_match
FROM public.event_registrations r
LEFT JOIN auth.users u ON u.email = r.email
WHERE r.email = 'latifburhanuddin05@gmail.com';

-- Column ids_match harus TRUE
-- Jika FALSE: user_id tidak match!
