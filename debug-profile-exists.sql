-- Debug: Cek apakah profil user ini benar-benar ada
-- Run this in Supabase SQL Editor

-- 1. Cari user dengan nama atau email Latif
SELECT 
  u.id as user_id,
  u.email,
  u.created_at,
  u.raw_user_meta_data->>'full_name' as metadata_name,
  u.raw_user_meta_data->>'whatsapp' as metadata_wa,
  p.id as profile_id,
  p.full_name as profile_name,
  p.email as profile_email,
  p.whatsapp as profile_wa,
  p.created_at as profile_created
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email LIKE '%latif%' 
   OR u.raw_user_meta_data->>'full_name' LIKE '%Latif%'
   OR LOWER(u.email) LIKE '%burhanuddin%'
ORDER BY u.created_at DESC
LIMIT 5;

-- 2. Cek semua profiles
SELECT 
  id,
  full_name,
  email,
  whatsapp,
  created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 10;

-- 3. SOLUSI: Jika profil ADA tapi hook tidak detect
-- Kemungkinan masalah:
-- a) RLS policy untuk SELECT tidak bekerja
-- b) User ID tidak match

-- Test RLS untuk SELECT
SET ROLE authenticated;
-- Ganti dengan user_id dari query #1
SET request.jwt.claims.sub = 'USER_ID_FROM_QUERY_1';

SELECT id, full_name, email, whatsapp
FROM public.profiles
WHERE id = current_setting('request.jwt.claims.sub')::uuid;

RESET ROLE;

-- Expected: Harus return 1 row (profil user tersebut)
-- Jika NULL: RLS policy block SELECT
