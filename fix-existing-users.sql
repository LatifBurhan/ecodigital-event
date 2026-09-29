-- Script untuk membuat profil untuk user yang sudah ada tapi belum punya profil
-- Run this in Supabase SQL Editor

-- 1. Cek berapa user yang tidak punya profil
SELECT 
  COUNT(*) as users_without_profile
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 2. Lihat detail user yang tidak punya profil
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

-- 3. BACKFILL: Buat profil otomatis untuk user yang punya metadata lengkap
-- HATI-HATI: Jalankan setelah verify data di query #2
INSERT INTO public.profiles (id, full_name, email, whatsapp)
SELECT 
  u.id,
  COALESCE(LEFT(TRIM(u.raw_user_meta_data->>'full_name'), 120), 'User'),
  LOWER(u.email),
  public.normalize_wa(u.raw_user_meta_data->>'whatsapp')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
  AND u.raw_user_meta_data ? 'whatsapp'  -- Hanya jika ada WhatsApp
  AND u.raw_user_meta_data->>'whatsapp' IS NOT NULL
  AND LENGTH(TRIM(u.raw_user_meta_data->>'whatsapp')) > 0
ON CONFLICT (id) DO NOTHING;

-- 4. Verify: Cek lagi setelah backfill
SELECT 
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM public.profiles) as total_profiles,
  (SELECT COUNT(*) FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE p.id IS NULL) as users_without_profile;
