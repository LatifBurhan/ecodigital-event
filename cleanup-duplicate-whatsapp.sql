-- ============================================================
-- CLEANUP DUPLICATE WHATSAPP - Run BEFORE migration
-- ============================================================
-- This script cleans up duplicate WhatsApp numbers
-- Run this FIRST if you get error about duplicate key constraint
-- ============================================================

BEGIN;

-- Step 1: Show current duplicate situation
SELECT 
  'Current Duplicates' as info,
  whatsapp,
  COUNT(*) as count,
  array_agg(id ORDER BY created_at) as user_ids,
  array_agg(email ORDER BY created_at) as emails
FROM public.profiles
WHERE whatsapp IS NOT NULL AND whatsapp != ''
GROUP BY whatsapp
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- Step 2: Drop all unique constraints and indexes on whatsapp
DO $$
BEGIN
  -- Drop constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_whatsapp_key' 
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_whatsapp_key;
    RAISE NOTICE 'Dropped constraint: profiles_whatsapp_key';
  END IF;
  
  -- Drop old index if exists
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND indexname = 'profiles_whatsapp_unique_idx'
  ) THEN
    DROP INDEX public.profiles_whatsapp_unique_idx;
    RAISE NOTICE 'Dropped index: profiles_whatsapp_unique_idx';
  END IF;
  
  -- Drop any other whatsapp key
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND indexname = 'profiles_whatsapp_key'
  ) THEN
    DROP INDEX public.profiles_whatsapp_key;
    RAISE NOTICE 'Dropped index: profiles_whatsapp_key';
  END IF;
END $$;

-- Step 3: Make whatsapp nullable
ALTER TABLE public.profiles ALTER COLUMN whatsapp DROP NOT NULL;

-- Step 4: Clean up empty values
UPDATE public.profiles SET whatsapp = NULL 
WHERE whatsapp = '' OR whatsapp = '0' OR trim(whatsapp) = '';

-- Step 5: Handle duplicates - keep oldest, set rest to NULL
DO $$
DECLARE
  duplicate_count INTEGER;
  cleaned_count INTEGER := 0;
BEGIN
  -- Count duplicates
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT whatsapp
    FROM public.profiles
    WHERE whatsapp IS NOT NULL AND whatsapp != ''
    GROUP BY whatsapp
    HAVING COUNT(*) > 1
  ) dups;
  
  IF duplicate_count = 0 THEN
    RAISE NOTICE 'No duplicate whatsapp numbers found';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found % duplicate whatsapp numbers, cleaning...', duplicate_count;
  
  -- Keep only the first occurrence (oldest created_at), set rest to NULL
  WITH duplicates AS (
    SELECT whatsapp, array_agg(id ORDER BY created_at) as user_ids
    FROM public.profiles
    WHERE whatsapp IS NOT NULL AND whatsapp != ''
    GROUP BY whatsapp
    HAVING COUNT(*) > 1
  )
  UPDATE public.profiles
  SET whatsapp = NULL
  WHERE id IN (
    SELECT unnest(user_ids[2:]) -- Keep first (oldest), nullify rest
    FROM duplicates
  );
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RAISE NOTICE 'Set % duplicate whatsapp values to NULL', cleaned_count;
END $$;

-- Step 6: Verify cleanup
SELECT 
  'After Cleanup - Should be 0 duplicates' as info,
  COUNT(*) as remaining_duplicates
FROM (
  SELECT whatsapp
  FROM public.profiles
  WHERE whatsapp IS NOT NULL AND whatsapp != ''
  GROUP BY whatsapp
  HAVING COUNT(*) > 1
) dups;

-- Step 7: Show users who lost their whatsapp number
SELECT 
  'Users who lost whatsapp (can be updated later)' as info,
  p.id,
  p.email,
  p.full_name,
  u.raw_user_meta_data->>'whatsapp' as original_whatsapp
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.whatsapp IS NULL
  AND u.raw_user_meta_data->>'whatsapp' IS NOT NULL
  AND u.raw_user_meta_data->>'whatsapp' != ''
ORDER BY p.created_at DESC
LIMIT 20;

COMMIT;

-- ============================================================
-- SUMMARY
-- ============================================================

SELECT 
  'Cleanup Summary' as report,
  (SELECT COUNT(*) FROM public.profiles) as total_profiles,
  (SELECT COUNT(*) FROM public.profiles WHERE whatsapp IS NOT NULL) as profiles_with_whatsapp,
  (SELECT COUNT(*) FROM public.profiles WHERE whatsapp IS NULL) as profiles_without_whatsapp,
  (SELECT COUNT(*) FROM (
    SELECT whatsapp FROM public.profiles 
    WHERE whatsapp IS NOT NULL AND whatsapp != '' 
    GROUP BY whatsapp 
    HAVING COUNT(*) > 1
  ) dups) as remaining_duplicates;

-- ============================================================
-- NOW YOU CAN RUN THE MAIN MIGRATION
-- ============================================================
-- After running this cleanup script, you can safely run:
-- supabase/migrations/20250201000000_fix_profile_and_storage.sql
-- ============================================================
