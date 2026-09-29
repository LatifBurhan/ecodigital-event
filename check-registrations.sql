-- Cek pendaftaran event
-- Run this in Supabase SQL Editor

-- 1. CEK: Apakah ada registrasi di database?
SELECT 
  r.id,
  r.ticket_code,
  r.name,
  r.email,
  r.whatsapp,
  r.status,
  r.created_at,
  e.title as event_title,
  e.slug as event_slug,
  u.email as user_email
FROM public.event_registrations r
LEFT JOIN public.events e ON e.id = r.event_id
LEFT JOIN auth.users u ON u.id = r.user_id
ORDER BY r.created_at DESC
LIMIT 20;

-- Expected: Harus ada registrasi dengan nama "Latif Burhanuddin"

-- 2. CEK: Berapa total registrasi per event
SELECT 
  e.title,
  e.slug,
  COUNT(r.id) as total_registrations
FROM public.events e
LEFT JOIN public.event_registrations r ON r.event_id = e.id
WHERE e.is_published = true
GROUP BY e.id, e.title, e.slug
ORDER BY COUNT(r.id) DESC;

-- 3. CEK: RLS policies untuk event_registrations
SELECT 
  policyname,
  cmd as command,
  roles,
  qual as using_clause
FROM pg_policies
WHERE tablename = 'event_registrations'
ORDER BY cmd, policyname;

-- Expected policies:
-- "Users read own registrations" - SELECT - (user_id = auth.uid())
-- "Admins read registrations" - SELECT - (has_role(auth.uid(), 'admin'))
-- "Admins update registrations" - UPDATE
-- "Admins delete registrations" - DELETE

-- 4. TEST: Query sebagai admin
-- Ganti ADMIN_USER_ID dengan id user admin Anda
SET ROLE authenticated;
SET request.jwt.claims.sub = 'ADMIN_USER_ID';

SELECT 
  r.ticket_code,
  r.name,
  r.email,
  r.status,
  e.title
FROM public.event_registrations r
LEFT JOIN public.events e ON e.id = r.event_id
ORDER BY r.created_at DESC
LIMIT 10;

RESET ROLE;

-- Jika EMPTY: RLS policy block admin
-- Jika ADA DATA: Problem di frontend admin

-- 5. CEK: Apakah user admin punya role admin?
SELECT 
  u.email,
  ur.role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.role = 'admin' OR u.email LIKE '%admin%'
ORDER BY u.created_at;
