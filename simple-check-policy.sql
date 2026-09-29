-- Simple check: Verifikasi RLS policy untuk profiles
-- Run this in Supabase SQL Editor

-- 1. CEK: Policy apa saja yang ada untuk table profiles
SELECT 
  policyname,
  cmd as command,
  roles,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- Expected result harus ada policy untuk INSERT:
-- policyname: "Users can insert own profile"
-- command: INSERT
-- roles: {authenticated}

-- 2. CEK: Permissions untuk authenticated role
SELECT 
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'profiles'
  AND grantee = 'authenticated'
ORDER BY privilege_type;

-- Expected: INSERT, SELECT, UPDATE

-- ===== JIKA TIDAK ADA POLICY UNTUK INSERT =====

-- 3. CREATE policy (jika belum ada)
-- Uncomment dan jalankan jika query #1 tidak menunjukkan policy INSERT:

-- CREATE POLICY "Users can insert own profile" 
-- ON public.profiles 
-- FOR INSERT 
-- TO authenticated 
-- WITH CHECK (auth.uid() = id);

-- 4. GRANT permission (jika belum ada)
-- Uncomment dan jalankan jika query #2 tidak menunjukkan INSERT:

-- GRANT INSERT ON public.profiles TO authenticated;

-- 5. VERIFY lagi setelah create
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';
