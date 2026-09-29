-- Verify RLS policy untuk INSERT profiles
-- Run this in Supabase SQL Editor

-- 1. CEK: Policy yang ada untuk table profiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- Expected policies:
-- "Users can SELECT own profile" - SELECT
-- "Users can UPDATE own profile" - UPDATE  
-- "Users can INSERT own profile" - INSERT (NEW!)
-- "Admins read profiles" - SELECT

-- 2. TEST: Coba INSERT sebagai authenticated user
-- (Ganti USER_ID, EMAIL, dan PHONE dengan data real)
SET ROLE authenticated;
SET request.jwt.claims.sub = 'USER_ID_HERE';

INSERT INTO public.profiles (id, full_name, email, whatsapp)
VALUES (
  current_setting('request.jwt.claims.sub')::uuid,
  'Test User',
  'test@example.com',
  '628123456789'
);

RESET ROLE;

-- Jika ERROR: Policy masih bermasalah
-- Jika SUCCESS: Policy OK, masalah ada di client

-- 3. VERIFY: Grant INSERT untuk authenticated
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'profiles'
  AND grantee = 'authenticated';

-- Should include: INSERT, SELECT, UPDATE

-- 4. FIX: Jika policy tidak ada, create lagi
-- DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- CREATE POLICY "Users can insert own profile" 
-- ON public.profiles 
-- FOR INSERT 
-- TO authenticated 
-- WITH CHECK (auth.uid() = id);

-- GRANT INSERT ON public.profiles TO authenticated;
