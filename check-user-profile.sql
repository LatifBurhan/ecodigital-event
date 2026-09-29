-- Cek profil untuk user yang login
-- Run this in Supabase SQL Editor

-- 1. CEK: User dengan email yang sedang login
SELECT 
  u.id,
  u.email,
  u.created_at,
  u.raw_user_meta_data->>'full_name' as metadata_name,
  u.raw_user_meta_data->>'whatsapp' as metadata_wa,
  p.id as profile_id,
  p.full_name as profile_name,
  p.whatsapp as profile_wa
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email LIKE '%burhanuddin%' 
   OR u.raw_user_meta_data->>'full_name' LIKE '%Latif%'
ORDER BY u.created_at DESC;

-- 2. CEK: Semua users yang tidak punya profil
SELECT 
  u.id,
  u.email,
  u.created_at,
  u.raw_user_meta_data->>'full_name' as full_name,
  u.raw_user_meta_data->>'whatsapp' as whatsapp
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;

-- 3. SOLUSI: Buat profil untuk user ini secara manual
-- Ganti USER_ID dengan id dari query #1 atau #2
-- INSERT INTO public.profiles (id, full_name, email, whatsapp)
-- VALUES (
--   'USER_ID_DARI_QUERY_1',
--   'Latif Burhanuddin',
--   'EMAIL_USER',
--   '6285786858184'
-- );

-- 4. ATAU: Trigger handle_new_user untuk create profil dari metadata
-- Jika metadata ada, bisa manual trigger:
-- SELECT public.handle_new_user() FROM auth.users WHERE id = 'USER_ID';
