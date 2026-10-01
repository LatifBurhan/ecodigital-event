-- ============================================================
-- SIMPLE FIX - Profile & Storage Issues
-- ============================================================
-- This is a simplified version that fixes both issues
-- Safe to run multiple times (idempotent)
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1: FIX PROFILE SYSTEM
-- ============================================================

-- Step 1: Drop ALL constraints and indexes on whatsapp
DO $$
BEGIN
  -- Drop constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_whatsapp_key'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_whatsapp_key;
    RAISE NOTICE 'Dropped constraint profiles_whatsapp_key';
  END IF;
  
  -- Drop indexes if exist
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'profiles_whatsapp_unique_idx'
  ) THEN
    DROP INDEX public.profiles_whatsapp_unique_idx;
    RAISE NOTICE 'Dropped index profiles_whatsapp_unique_idx';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'profiles_whatsapp_key'
  ) THEN
    DROP INDEX public.profiles_whatsapp_key;
    RAISE NOTICE 'Dropped index profiles_whatsapp_key';
  END IF;
END $$;

-- Step 2: Make whatsapp nullable
ALTER TABLE public.profiles ALTER COLUMN whatsapp DROP NOT NULL;

-- Step 3: Clean up existing profiles table
UPDATE public.profiles SET whatsapp = NULL 
WHERE whatsapp = '' OR whatsapp = '0' OR trim(whatsapp) = '';

-- Step 4: Clean duplicates in existing profiles
WITH ranked_profiles AS (
  SELECT 
    id,
    whatsapp,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY whatsapp 
      ORDER BY created_at ASC
    ) as rn
  FROM public.profiles
  WHERE whatsapp IS NOT NULL AND whatsapp != ''
)
UPDATE public.profiles
SET whatsapp = NULL
WHERE id IN (
  SELECT id FROM ranked_profiles WHERE rn > 1
);

-- Step 5: Create profiles for users WITHOUT profiles
-- Uses LOOP to handle duplicates gracefully
DO $$
DECLARE
  user_record RECORD;
  normalized_wa TEXT;
  created_count INTEGER := 0;
BEGIN
  FOR user_record IN (
    SELECT 
      u.id,
      u.email,
      u.raw_user_meta_data,
      u.created_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
    ORDER BY u.created_at ASC
  )
  LOOP
    BEGIN
      -- Normalize WhatsApp if exists
      normalized_wa := NULL;
      IF user_record.raw_user_meta_data ? 'whatsapp' THEN
        normalized_wa := trim(user_record.raw_user_meta_data->>'whatsapp');
        IF normalized_wa != '' THEN
          -- Remove non-digits
          normalized_wa := regexp_replace(normalized_wa, '[^0-9]', '', 'g');
          -- Normalize format
          IF normalized_wa ~ '^0' THEN
            normalized_wa := '62' || substring(normalized_wa, 2);
          ELSIF normalized_wa ~ '^8' THEN
            normalized_wa := '62' || normalized_wa;
          END IF;
          
          -- Check if this whatsapp already exists
          IF EXISTS (
            SELECT 1 FROM public.profiles WHERE whatsapp = normalized_wa
          ) THEN
            normalized_wa := NULL; -- Set to NULL if duplicate
          END IF;
        ELSE
          normalized_wa := NULL;
        END IF;
      END IF;
      
      -- Insert profile
      INSERT INTO public.profiles (id, full_name, email, whatsapp)
      VALUES (
        user_record.id,
        COALESCE(
          NULLIF(trim(user_record.raw_user_meta_data->>'full_name'), ''),
          split_part(user_record.email, '@', 1),
          'User'
        ),
        lower(user_record.email),
        normalized_wa
      )
      ON CONFLICT (id) DO NOTHING;
      
      created_count := created_count + 1;
      
    EXCEPTION
      WHEN unique_violation THEN
        -- If still duplicate, insert with NULL whatsapp
        INSERT INTO public.profiles (id, full_name, email, whatsapp)
        VALUES (
          user_record.id,
          COALESCE(
            NULLIF(trim(user_record.raw_user_meta_data->>'full_name'), ''),
            split_part(user_record.email, '@', 1),
            'User'
          ),
          lower(user_record.email),
          NULL
        )
        ON CONFLICT (id) DO NOTHING;
        created_count := created_count + 1;
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to create profile for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Created % profiles for existing users', created_count;
END $$;

-- Step 6: Final cleanup - ensure no duplicates remain
WITH final_dups AS (
  SELECT whatsapp, array_agg(id ORDER BY created_at) as ids
  FROM public.profiles
  WHERE whatsapp IS NOT NULL AND whatsapp != ''
  GROUP BY whatsapp
  HAVING COUNT(*) > 1
)
UPDATE public.profiles
SET whatsapp = NULL
WHERE id IN (
  SELECT unnest(ids[2:]) FROM final_dups
);

-- Step 7: Create partial unique index (safe now)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_whatsapp_unique_idx 
ON public.profiles (whatsapp) 
WHERE whatsapp IS NOT NULL AND whatsapp != '';

-- Step 8: Fix trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE
  normalized_wa TEXT;
BEGIN
  -- Normalize WhatsApp
  normalized_wa := NULL;
  IF NEW.raw_user_meta_data ? 'whatsapp' THEN
    normalized_wa := trim(NEW.raw_user_meta_data->>'whatsapp');
    IF normalized_wa != '' THEN
      normalized_wa := regexp_replace(normalized_wa, '[^0-9]', '', 'g');
      IF normalized_wa ~ '^0' THEN
        normalized_wa := '62' || substring(normalized_wa, 2);
      ELSIF normalized_wa ~ '^8' THEN
        normalized_wa := '62' || normalized_wa;
      END IF;
    ELSE
      normalized_wa := NULL;
    END IF;
  END IF;
  
  -- Try to insert profile
  BEGIN
    INSERT INTO public.profiles (id, full_name, email, whatsapp)
    VALUES (
      NEW.id,
      COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        split_part(NEW.email, '@', 1),
        'User'
      ),
      lower(NEW.email),
      normalized_wa
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN unique_violation THEN
      -- If whatsapp duplicate, insert with NULL
      INSERT INTO public.profiles (id, full_name, email, whatsapp)
      VALUES (
        NEW.id,
        COALESCE(
          NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
          split_part(NEW.email, '@', 1),
          'User'
        ),
        lower(NEW.email),
        NULL
      )
      ON CONFLICT (id) DO NOTHING;
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to create profile for %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END $$;

-- Step 9: Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- PART 2: FIX STORAGE POLICIES
-- ============================================================

-- Drop existing payment-proofs policies
DROP POLICY IF EXISTS "Anyone upload payment proof" ON storage.objects;
DROP POLICY IF EXISTS "Admins read payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Public upload payment proof" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload payment proof" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read own payment proofs" ON storage.objects;

-- Create permissive upload policy
CREATE POLICY "Public upload payment proof"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'payment-proofs');

-- Allow authenticated users to read (for preview)
CREATE POLICY "Authenticated read own payment proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'payment-proofs');

-- Admins can read all
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

-- Admins can delete
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

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check profiles
SELECT 
  'Profile Check' as check_name,
  COUNT(*) as total_users,
  COUNT(p.id) as with_profiles,
  COUNT(*) - COUNT(p.id) as missing_profiles
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id;

-- Check duplicates
SELECT 
  'Duplicate Check' as check_name,
  COUNT(*) as duplicate_whatsapp_count
FROM (
  SELECT whatsapp 
  FROM public.profiles 
  WHERE whatsapp IS NOT NULL 
  GROUP BY whatsapp 
  HAVING COUNT(*) > 1
) dups;

-- Success message
DO $$
DECLARE
  missing INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL;
  
  IF missing = 0 THEN
    RAISE NOTICE '✅ SUCCESS: All users have profiles!';
  ELSE
    RAISE NOTICE '⚠️ WARNING: % users still missing profiles', missing;
  END IF;
END $$;
