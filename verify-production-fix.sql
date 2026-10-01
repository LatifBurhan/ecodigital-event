-- ============================================================
-- VERIFICATION SCRIPT - Run after applying the fix
-- ============================================================
-- This script verifies that both issues are fixed:
-- 1. All users have profiles
-- 2. Storage policies are correct for payment proofs
-- ============================================================

-- ============================================================
-- PART 1: VERIFY PROFILES
-- ============================================================

-- Check 1: Count users with and without profiles
SELECT 
  '1. Profile Coverage' as check_name,
  COUNT(*) as total_users,
  COUNT(p.id) as users_with_profiles,
  COUNT(*) - COUNT(p.id) as users_without_profiles,
  CASE 
    WHEN COUNT(*) - COUNT(p.id) = 0 THEN '✅ PASS'
    ELSE '❌ FAIL - ' || (COUNT(*) - COUNT(p.id))::text || ' users missing profiles'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id;

-- Check 2: List users without profiles (if any)
SELECT 
  '2. Users Without Profiles' as check_name,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASS - All users have profiles'
    ELSE '❌ FAIL - Found ' || COUNT(*)::text || ' users without profiles'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Show details of users without profiles (if any exist)
SELECT 
  'Details of Missing Profiles' as info,
  u.id,
  u.email,
  u.created_at,
  u.raw_user_meta_data->>'full_name' as metadata_name,
  u.raw_user_meta_data->>'whatsapp' as metadata_whatsapp
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC
LIMIT 10;

-- Check 3: Verify profiles table structure
SELECT 
  '3. Profiles Table Structure' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'whatsapp' 
        AND is_nullable = 'YES'
    ) THEN '✅ PASS - whatsapp is nullable'
    ELSE '❌ FAIL - whatsapp should be nullable'
  END as status;

-- Check 4: Verify unique index on whatsapp
SELECT 
  '4. WhatsApp Unique Index' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND indexname = 'profiles_whatsapp_unique_idx'
    ) THEN '✅ PASS - Partial unique index exists'
    ELSE '⚠️ WARNING - Index might not exist'
  END as status;

-- Check 5: Verify trigger exists
SELECT 
  '5. Profile Creation Trigger' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'on_auth_user_created'
    ) THEN '✅ PASS - Trigger exists'
    ELSE '❌ FAIL - Trigger missing'
  END as status;

-- ============================================================
-- PART 2: VERIFY STORAGE POLICIES
-- ============================================================

-- Check 6: Verify payment-proofs upload policy
SELECT 
  '6. Payment Proofs Upload Policy' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND policyname LIKE '%upload payment proof%'
        AND cmd = 'INSERT'
    ) THEN '✅ PASS - Upload policy exists'
    ELSE '❌ FAIL - Upload policy missing or incorrect'
  END as status;

-- Check 7: List all storage policies for payment-proofs
SELECT 
  '7. All Payment Proofs Policies' as info,
  policyname,
  cmd as operation,
  roles,
  permissive
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%payment%'
ORDER BY policyname;

-- Check 8: Verify payment-proofs bucket exists
SELECT 
  '8. Payment Proofs Bucket' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM storage.buckets 
      WHERE id = 'payment-proofs'
    ) THEN '✅ PASS - Bucket exists'
    ELSE '❌ FAIL - Bucket missing'
  END as status;

-- Show bucket configuration
SELECT 
  'Bucket Configuration' as info,
  id,
  name,
  public as is_public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id = 'payment-proofs';

-- ============================================================
-- PART 3: RECENT ACTIVITY CHECKS
-- ============================================================

-- Check 9: Recent registrations (last 7 days)
SELECT 
  '9. Recent Registrations' as info,
  COUNT(*) as total_registrations,
  COUNT(CASE WHEN e.is_paid THEN 1 END) as paid_events,
  COUNT(CASE WHEN e.is_paid AND er.payment_proof_path IS NOT NULL THEN 1 END) as with_proof,
  COUNT(CASE WHEN e.is_paid AND er.payment_proof_path IS NULL THEN 1 END) as missing_proof
FROM event_registrations er
JOIN events e ON e.id = er.event_id
WHERE er.created_at > NOW() - INTERVAL '7 days';

-- Check 10: Recent failed registrations (if tracking errors)
SELECT 
  '10. Registration Issues (Last 24h)' as info,
  COUNT(*) as total_issues,
  COUNT(CASE WHEN payment_proof_path IS NULL THEN 1 END) as missing_proof_issues
FROM event_registrations er
JOIN events e ON e.id = er.event_id
WHERE er.created_at > NOW() - INTERVAL '1 day'
  AND e.is_paid = true
  AND er.payment_proof_path IS NULL;

-- ============================================================
-- SUMMARY
-- ============================================================

-- Overall Health Check Summary
SELECT 
  'OVERALL STATUS' as summary,
  CASE 
    WHEN (
      -- All users have profiles
      (SELECT COUNT(*) FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE p.id IS NULL) = 0
      AND
      -- Upload policy exists
      EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects'
          AND policyname LIKE '%upload payment proof%'
      )
      AND
      -- Trigger exists
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created')
    ) THEN '✅ ALL CHECKS PASSED - System is healthy'
    ELSE '⚠️ SOME CHECKS FAILED - Review details above'
  END as status;

-- ============================================================
-- QUICK FIX QUERIES (if needed)
-- ============================================================

-- If any user is missing profile, run this:
-- (Uncomment and modify as needed)

/*
-- Create missing profiles for all users
INSERT INTO public.profiles (id, full_name, email, whatsapp)
SELECT 
  u.id,
  COALESCE(
    NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
    split_part(u.email, '@', 1),
    'User'
  ),
  u.email,
  NULL
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
*/

-- ============================================================
-- END OF VERIFICATION
-- ============================================================

-- Export results for documentation
-- Copy all results above and save for reference
