-- Script untuk menghapus semua user KECUALI admin
-- ⚠️ WARNING: Ini akan menghapus data user dan registrasi mereka!
-- Run this in Supabase SQL Editor

-- 1. CEK: Lihat siapa saja admin (JANGAN DIHAPUS)
SELECT 
  u.id,
  u.email,
  ur.role,
  u.created_at
FROM auth.users u
INNER JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.role = 'admin'
ORDER BY u.created_at;

-- 2. CEK: Berapa user yang BUKAN admin (AKAN DIHAPUS)
SELECT 
  COUNT(*) as non_admin_users
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = u.id AND ur.role = 'admin'
);

-- 3. CEK: List user yang AKAN DIHAPUS (pastikan admin TIDAK ada di list ini)
SELECT 
  u.id,
  u.email,
  u.created_at,
  u.raw_user_meta_data->>'full_name' as full_name
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = u.id AND ur.role = 'admin'
)
ORDER BY u.created_at DESC
LIMIT 20;

-- ============================================================
-- ⚠️ PERHATIAN: SCRIPT DI BAWAH AKAN MENGHAPUS DATA!
-- Pastikan Anda sudah cek query #1 dan admin Anda ADA di list
-- ============================================================

-- 4. HAPUS: Event registrations dari non-admin users
DELETE FROM public.event_registrations
WHERE user_id IN (
  SELECT u.id
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = u.id AND ur.role = 'admin'
  )
);

-- 5. HAPUS: Profiles dari non-admin users
DELETE FROM public.profiles
WHERE id IN (
  SELECT u.id
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = u.id AND ur.role = 'admin'
  )
);

-- 6. HAPUS: User roles dari non-admin users (jika ada)
DELETE FROM public.user_roles
WHERE role != 'admin'
  AND user_id NOT IN (
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  );

-- 7. HAPUS: Auth users (NON-ADMIN)
-- IMPORTANT: Ini HARUS terakhir karena CASCADE akan hapus semua relasi
DELETE FROM auth.users
WHERE id NOT IN (
  SELECT user_id FROM public.user_roles WHERE role = 'admin'
);

-- 8. VERIFY: Cek hasil akhir
SELECT 
  'auth.users' as table_name,
  COUNT(*) as remaining_count
FROM auth.users
UNION ALL
SELECT 
  'public.profiles',
  COUNT(*)
FROM public.profiles
UNION ALL
SELECT 
  'public.event_registrations',
  COUNT(*)
FROM public.event_registrations
UNION ALL
SELECT 
  'public.user_roles (admin)',
  COUNT(*)
FROM public.user_roles
WHERE role = 'admin';

-- 9. VERIFY: List user yang masih ada (seharusnya hanya admin)
SELECT 
  u.id,
  u.email,
  u.created_at,
  ur.role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
ORDER BY u.created_at;
