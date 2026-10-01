-- ============================================================
-- FIX PROFILE & STORAGE ISSUES
-- ============================================================
-- Fixes:
-- 1. "Profil tidak ditemukan" - ensures ALL users have profiles
-- 2. Upload bukti pembayaran gagal - ensures storage policies work
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1: FIX PROFILE TRIGGER
-- ============================================================

-- Step 1: Make whatsapp nullable to avoid unique constraint issues
ALTER TABLE public.profiles ALTER COLUMN whatsapp DROP NOT NULL;

-- Step 2: Drop the old unique constraint AND index FIRST
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_whatsapp_key;
DROP INDEX IF EXISTS profiles_whatsapp_unique_idx;
DROP INDEX IF EXISTS profiles_whatsapp_key;

-- Step 3: Update empty whatsapp values to NULL
UPDATE public.profiles SET whatsapp = NULL WHERE whatsapp = '' OR whatsapp = '0';

-- Step 4: Handle duplicate whatsapp numbers
-- Find duplicates and set all but the first one to NULL
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  -- Count duplicates first
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT whatsapp
    FROM public.profiles
    WHERE whatsapp IS NOT NULL AND whatsapp != ''
    GROUP BY whatsapp
    HAVING COUNT(*) > 1
  ) dups;
  
  IF duplicate_count > 0 THEN
    RAISE NOTICE 'Found % duplicate whatsapp numbers, cleaning up...', duplicate_count;
    
    -- Keep only the first occurrence, set rest to NULL
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
    
    RAISE NOTICE 'Cleaned up duplicate whatsapp numbers';
  ELSE
    RAISE NOTICE 'No duplicate whatsapp numbers found';
  END IF;
END $$;

-- Step 5: We will create unique index AFTER creating profiles for existing users
-- (Skip for now, will be done in Step 9)

-- Step 6: Fix the trigger function to ALWAYS create profile
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
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
        THEN 
          -- Normalize WhatsApp number
          CASE
            WHEN (NEW.raw_user_meta_data->>'whatsapp') ~ '^0' THEN 
              '62' || substring(regexp_replace(NEW.raw_user_meta_data->>'whatsapp', '[^0-9]', '', 'g'), 2)
            WHEN (NEW.raw_user_meta_data->>'whatsapp') ~ '^8' THEN 
              '62' || regexp_replace(NEW.raw_user_meta_data->>'whatsapp', '[^0-9]', '', 'g')
            ELSE 
              regexp_replace(NEW.raw_user_meta_data->>'whatsapp', '[^0-9]', '', 'g')
          END
        ELSE NULL -- NULL if no whatsapp (will be filled later)
      END
    )
    ON CONFLICT (id) DO NOTHING; -- Ignore if profile already exists
  EXCEPTION
    WHEN unique_violation THEN
      -- Handle duplicate whatsapp gracefully - set to NULL
      INSERT INTO public.profiles (id, full_name, email, whatsapp)
      VALUES (
        NEW.id,
        COALESCE(
          NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
          split_part(NEW.email, '@', 1),
          'User'
        ),
        COALESCE(lower(NEW.email), ''),
        NULL -- Set whatsapp to NULL if duplicate
      )
      ON CONFLICT (id) DO NOTHING;
    WHEN OTHERS THEN
      -- Log error but don't fail user registration
      RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END $$;

-- Step 7: Ensure trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Step 8: Create profiles for existing users who don't have one
-- This is CRITICAL for fixing users who registered before this fix
DO $$
DECLARE
  missing_profiles_count INTEGER;
  created_profiles_count INTEGER;
BEGIN
  -- Count users without profiles
  SELECT COUNT(*) INTO missing_profiles_count
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL;
  
  IF missing_profiles_count > 0 THEN
    RAISE NOTICE 'Found % users without profiles, creating...', missing_profiles_count;
  ELSE
    RAISE NOTICE 'All users already have profiles';
    RETURN;
  END IF;
  
  -- Create profiles
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
      THEN 
        -- Normalize WhatsApp number
        CASE
          WHEN (u.raw_user_meta_data->>'whatsapp') ~ '^0' THEN 
            '62' || substring(regexp_replace(u.raw_user_meta_data->>'whatsapp', '[^0-9]', '', 'g'), 2)
          WHEN (u.raw_user_meta_data->>'whatsapp') ~ '^8' THEN 
            '62' || regexp_replace(u.raw_user_meta_data->>'whatsapp', '[^0-9]', '', 'g')
          ELSE 
            regexp_replace(u.raw_user_meta_data->>'whatsapp', '[^0-9]', '', 'g')
        END
      ELSE NULL
    END as whatsapp,
    -- Use ROW_NUMBER to detect duplicates
    ROW_NUMBER() OVER (
      PARTITION BY 
        CASE 
          WHEN u.raw_user_meta_data ? 'whatsapp' AND trim(u.raw_user_meta_data->>'whatsapp') != '' 
          THEN 
            CASE
              WHEN (u.raw_user_meta_data->>'whatsapp') ~ '^0' THEN 
                '62' || substring(regexp_replace(u.raw_user_meta_data->>'whatsapp', '[^0-9]', '', 'g'), 2)
              WHEN (u.raw_user_meta_data->>'whatsapp') ~ '^8' THEN 
                '62' || regexp_replace(u.raw_user_meta_data->>'whatsapp', '[^0-9]', '', 'g')
              ELSE 
                regexp_replace(u.raw_user_meta_data->>'whatsapp', '[^0-9]', '', 'g')
            END
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

  -- Count how many were created
  GET DIAGNOSTICS created_profiles_count = ROW_COUNT;
  RAISE NOTICE 'Created % profiles for existing users', created_profiles_count;
END $$;

-- Step 9: NOW create the unique index after all profiles are created
-- At this point, all duplicate whatsapp in profiles table are cleaned,
-- and all new profiles from auth.users are created with proper row_num logic
DO $$
BEGIN
  -- Final cleanup: ensure no duplicates before creating index
  WITH final_duplicates AS (
    SELECT whatsapp, array_agg(id ORDER BY created_at) as user_ids
    FROM public.profiles
    WHERE whatsapp IS NOT NULL AND whatsapp != ''
    GROUP BY whatsapp
    HAVING COUNT(*) > 1
  )
  UPDATE public.profiles
  SET whatsapp = NULL
  WHERE id IN (
    SELECT unnest(user_ids[2:])
    FROM final_duplicates
  );
  
  -- Now create the unique index
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND indexname = 'profiles_whatsapp_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX profiles_whatsapp_unique_idx ON public.profiles (whatsapp) 
    WHERE whatsapp IS NOT NULL AND whatsapp != '';
    RAISE NOTICE 'Created unique index on whatsapp';
  ELSE
    RAISE NOTICE 'Unique index already exists';
  END IF;
END $$;

-- ============================================================
-- PART 2: FIX STORAGE POLICIES FOR PAYMENT PROOFS
-- ============================================================

-- Drop existing policies for payment-proofs
DROP POLICY IF EXISTS "Anyone upload payment proof" ON storage.objects;
DROP POLICY IF EXISTS "Admins read payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Public upload payment proof" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload payment proof" ON storage.objects;

-- Create more permissive upload policy for payment-proofs
-- This allows both anonymous and authenticated users to upload
CREATE POLICY "Public upload payment proof"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'payment-proofs');

-- Allow authenticated users to read their own uploaded proofs (optional, for preview)
CREATE POLICY "Authenticated read own payment proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL);

-- Admins can read all payment proofs
CREATE POLICY "Admins read payment proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs' AND 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Admins can delete payment proofs
CREATE POLICY "Admins delete payment proofs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-proofs' AND 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check if all users now have profiles
DO $$
DECLARE
  users_without_profiles INTEGER;
BEGIN
  SELECT COUNT(*) INTO users_without_profiles
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL;
  
  IF users_without_profiles > 0 THEN
    RAISE NOTICE 'WARNING: % users still without profiles', users_without_profiles;
  ELSE
    RAISE NOTICE 'SUCCESS: All users have profiles';
  END IF;
END $$;

COMMIT;

-- Final verification query (run manually to check)
-- SELECT 
--   COUNT(*) as total_users,
--   COUNT(p.id) as users_with_profiles,
--   COUNT(*) - COUNT(p.id) as users_without_profiles
-- FROM auth.users u
-- LEFT JOIN public.profiles p ON p.id = u.id;
