-- Fix: Admin tidak bisa update/approve registrasi
-- Run this in Supabase SQL Editor

-- 1. CEK: Policy UPDATE untuk admin
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'event_registrations'
  AND cmd = 'UPDATE';

-- Expected: "Admins update registrations"
-- Jika kosong: Policy belum ada

-- 2. CEK: Policy DELETE untuk admin (untuk tombol hapus)
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'event_registrations'
  AND cmd = 'DELETE';

-- Expected: "Admins delete registrations"

-- 3. CREATE policy UPDATE jika belum ada
CREATE POLICY "Admins update registrations" 
ON public.event_registrations 
FOR UPDATE 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. CREATE policy DELETE jika belum ada
CREATE POLICY "Admins delete registrations" 
ON public.event_registrations 
FOR DELETE 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- 5. VERIFY semua policies sudah ada
SELECT 
  policyname,
  cmd as command,
  roles
FROM pg_policies
WHERE tablename = 'event_registrations'
ORDER BY cmd, policyname;

-- Expected results:
-- "Admins delete registrations" | DELETE | {authenticated}
-- "Admins read registrations"   | SELECT | {authenticated}
-- "Admins update registrations" | UPDATE | {authenticated}
-- "Users read own registrations"| SELECT | {authenticated}
