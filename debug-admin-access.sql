-- Debug: Kenapa admin tidak bisa lihat pendaftar
-- Run this in Supabase SQL Editor

-- 1. VERIFY: User admin dan rolenya
SELECT 
  u.id,
  u.email,
  ur.role
FROM auth.users u
INNER JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'admin@ecodigitaleventkit.id';

-- Expected: Harus return 1 row dengan role = 'admin'

-- 2. CEK: Total registrasi yang ada
SELECT COUNT(*) as total_registrations
FROM public.event_registrations;

-- Expected: > 0

-- 3. CEK: Registrasi per event
SELECT 
  e.id,
  e.slug,
  e.title,
  COUNT(r.id) as total_registrations
FROM public.events e
LEFT JOIN public.event_registrations r ON r.event_id = e.id
GROUP BY e.id, e.slug, e.title
ORDER BY COUNT(r.id) DESC;

-- Expected: Event dengan registrasi > 0

-- 4. CEK: Detail registrasi dengan event
SELECT 
  r.ticket_code,
  r.name,
  r.email,
  r.status,
  r.event_id,
  e.title as event_title,
  e.slug as event_slug
FROM public.event_registrations r
LEFT JOIN public.events e ON e.id = r.event_id
ORDER BY r.created_at DESC;

-- 5. TEST: Query sebagai admin (simulasi frontend)
-- Test function has_role
SELECT public.has_role(
  (SELECT id FROM auth.users WHERE email = 'admin@ecodigitaleventkit.id'),
  'admin'::public.app_role
) as is_admin;

-- Expected: true

-- 6. CEK: RLS Policy untuk event_registrations
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check
FROM pg_policies
WHERE tablename = 'event_registrations'
ORDER BY cmd, policyname;

-- Expected policies:
-- "Admins read registrations" - SELECT - USING (has_role(...))

-- 7. CRITICAL: Cek apakah policy "Admins read registrations" ADA
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'event_registrations'
  AND policyname = 'Admins read registrations';

-- Expected: 1
-- Jika 0: Policy belum dibuat!

-- 8. FIX: Jika policy tidak ada, create:
-- DROP POLICY IF EXISTS "Admins read registrations" ON public.event_registrations;

-- CREATE POLICY "Admins read registrations" 
-- ON public.event_registrations 
-- FOR SELECT 
-- TO authenticated 
-- USING (public.has_role(auth.uid(), 'admin'));
