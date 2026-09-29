-- Script untuk handle duplicate WhatsApp numbers
-- Run this in Supabase SQL Editor

-- 1. CEK: Lihat user mana saja yang punya duplikat WhatsApp
WITH normalized_wa AS (
  SELECT 
    u.id,
    u.email,
    u.created_at,
    u.raw_user_meta_data->>'full_name' as full_name,
    public.normalize_wa(u.raw_user_meta_data->>'whatsapp') as whatsapp,
    u.raw_user_meta_data->>'whatsapp' as raw_whatsapp
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL
    AND u.raw_user_meta_data ? 'whatsapp'
    AND u.raw_user_meta_data->>'whatsapp' IS NOT NULL
)
SELECT 
  whatsapp,
  COUNT(*) as user_count,
  STRING_AGG(email, ', ' ORDER BY created_at) as emails,
  MIN(created_at) as oldest_user_date
FROM normalized_wa
WHERE LENGTH(TRIM(COALESCE(whatsapp, ''))) > 0
GROUP BY whatsapp
HAVING COUNT(*) > 1
ORDER BY user_count DESC;

-- 2. CEK: Lihat user yang tidak punya profil tapi WA-nya sudah ada di profiles
SELECT 
  u.id as user_id,
  u.email as user_email,
  u.created_at as user_created,
  public.normalize_wa(u.raw_user_meta_data->>'whatsapp') as user_whatsapp,
  p.id as existing_profile_id,
  p.email as profile_email,
  p.whatsapp as profile_whatsapp
FROM auth.users u
LEFT JOIN public.profiles p_own ON p_own.id = u.id
LEFT JOIN public.profiles p ON p.whatsapp = public.normalize_wa(u.raw_user_meta_data->>'whatsapp')
WHERE p_own.id IS NULL  -- User tidak punya profil
  AND u.raw_user_meta_data ? 'whatsapp'
  AND p.id IS NOT NULL  -- Tapi WA-nya sudah dipakai user lain
ORDER BY u.created_at DESC;

-- 3. SOLUSI A: Backfill HANYA untuk user pertama (oldest) dengan setiap nomor WA
-- Ini akan skip user yang nomor WA-nya duplikat
WITH normalized_wa AS (
  SELECT 
    u.id,
    u.email,
    u.created_at,
    LEFT(TRIM(COALESCE(u.raw_user_meta_data->>'full_name', 'User')), 120) as full_name,
    public.normalize_wa(u.raw_user_meta_data->>'whatsapp') as whatsapp,
    ROW_NUMBER() OVER (
      PARTITION BY public.normalize_wa(u.raw_user_meta_data->>'whatsapp') 
      ORDER BY u.created_at ASC
    ) as rn
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL
    AND u.raw_user_meta_data ? 'whatsapp'
    AND u.raw_user_meta_data->>'whatsapp' IS NOT NULL
    AND LENGTH(TRIM(u.raw_user_meta_data->>'whatsapp')) > 0
)
INSERT INTO public.profiles (id, full_name, email, whatsapp)
SELECT 
  id,
  full_name,
  LOWER(email),
  whatsapp
FROM normalized_wa
WHERE rn = 1  -- Hanya user PERTAMA dengan nomor WA tersebut
ON CONFLICT (id) DO NOTHING;

-- 4. VERIFY: Cek hasilnya
SELECT 
  COUNT(*) as users_without_profile
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 5. LIST: User yang masih belum punya profil (karena WA duplikat)
SELECT 
  u.id,
  u.email,
  u.created_at,
  u.raw_user_meta_data->>'full_name' as full_name,
  u.raw_user_meta_data->>'whatsapp' as whatsapp,
  'Duplicate WhatsApp - needs manual fix' as reason
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;
