-- ============================================================
-- FIX PROFILE TRIGGER - Apply in Supabase SQL Editor
-- ============================================================
-- This fixes the "Profil tidak ditemukan" issue by:
-- 1. Making trigger ALWAYS create profile (even without whatsapp)
-- 2. Creating profiles for existing users who don't have one
-- 3. Allowing NULL whatsapp to avoid unique constraint issues
-- ============================================================

BEGIN;

-- Step 1: Fix the trigger function to ALWAYS create profile
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Always try to create profile, with better error handling
  BEGIN
    INSERT INTO public.profiles (id, full_name, email, whatsapp)
    VALUES (
      NEW.id,
      COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        split_part(NEW.email, '@', 1), -- Fallback to email username if no full_name
        'User' -- Final fallback
      ),
      COALESCE(lower(NEW.email), ''),
      CASE 
        WHEN NEW.raw_user_meta_data ? 'whatsapp' AND trim(NEW.raw_user_meta_data->>'whatsapp') != '' 
        THEN public.normalize_wa(NEW.raw_user_meta_data->>'whatsapp')
        ELSE NULL -- NULL if no whatsapp (will be filled later)
      END
    )
    ON CONFLICT (id) DO NOTHING; -- Ignore if profile already exists
  EXCEPTION
    WHEN unique_violation THEN
      -- Handle duplicate whatsapp gracefully
      UPDATE public.profiles 
      SET whatsapp = NULL
      WHERE id = NEW.id;
    WHEN OTHERS THEN
      -- Log error but don't fail user registration
      RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END $$;

-- Step 2: Ensure trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Make whatsapp nullable to avoid unique constraint issues
ALTER TABLE public.profiles ALTER COLUMN whatsapp DROP NOT NULL;

-- Step 4: Drop the old constraint FIRST (before cleaning duplicates)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_whatsapp_key;

-- Step 5: Update empty whatsapp values to NULL
UPDATE public.profiles SET whatsapp = NULL WHERE whatsapp = '';

-- Step 6: Handle duplicate whatsapp numbers
-- Find duplicates and set all but the first one to NULL
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
  SELECT unnest(user_ids[2:]) -- Keep first, nullify rest
  FROM duplicates
);

-- Step 7: NOW create unique index (after cleanup)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_whatsapp_unique_idx ON public.profiles (whatsapp) 
WHERE whatsapp IS NOT NULL AND whatsapp != '';

-- Step 6: Create profiles for existing users who don't have one
-- This is the CRITICAL step that fixes users who registered before this fix
-- Use ROW_NUMBER to handle duplicate whatsapp numbers
WITH users_to_create AS (
  SELECT 
    u.id,
    COALESCE(
      NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
      split_part(u.email, '@', 1),
      'User'
    ) as full_name,
    COALESCE(lower(u.email), '') as email,
    CASE 
      WHEN u.raw_user_meta_data ? 'whatsapp' AND trim(u.raw_user_meta_data->>'whatsapp') != '' 
      THEN public.normalize_wa(u.raw_user_meta_data->>'whatsapp')
      ELSE NULL
    END as whatsapp,
    -- Use ROW_NUMBER to detect duplicates
    ROW_NUMBER() OVER (
      PARTITION BY 
        CASE 
          WHEN u.raw_user_meta_data ? 'whatsapp' AND trim(u.raw_user_meta_data->>'whatsapp') != '' 
          THEN public.normalize_wa(u.raw_user_meta_data->>'whatsapp')
          ELSE NULL
        END
      ORDER BY u.created_at
    ) as row_num
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL -- Only users without profiles
)
INSERT INTO public.profiles (id, full_name, email, whatsapp)
SELECT 
  id,
  full_name,
  email,
  CASE 
    -- Keep whatsapp for first occurrence, NULL for duplicates
    WHEN row_num = 1 THEN whatsapp
    ELSE NULL
  END as whatsapp
FROM users_to_create
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verify the fix
SELECT 
  COUNT(*) as total_users,
  COUNT(p.id) as users_with_profiles,
  COUNT(*) - COUNT(p.id) as users_without_profiles
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id;

-- Show users without profiles (should be 0 after fix)
SELECT 
  u.id,
  u.email,
  u.created_at,
  u.raw_user_meta_data->>'full_name' as metadata_name,
  u.raw_user_meta_data->>'whatsapp' as metadata_whatsapp
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
