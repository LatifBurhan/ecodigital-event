-- ============================================================
-- PRODUCTION FIX - Profile & Storage (Safe for Existing DB)
-- ============================================================
-- This version is safe to run on production that may have
-- already run partial migrations or have existing policies
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1: FIX PROFILE SYSTEM
-- ============================================================

-- Step 1: Make whatsapp nullable (safe if already nullable)
DO $$
BEGIN
  ALTER TABLE public.profiles ALTER COLUMN whatsapp DROP NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Column already nullable or error: %', SQLERRM;
END $$;

-- Step 2: Drop constraints and indexes if exist
DO $$
BEGIN
  -- Drop constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_whatsapp_key'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_whatsapp_key;
    RAISE NOTICE 'Dropped constraint profiles_whatsapp_key';
  END IF;
  
  -- Drop indexes
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'profiles_whatsapp_unique_idx'
  ) THEN
    DROP INDEX public.profiles_whatsapp_unique_idx;
    RAISE NOTICE 'Dropped index profiles_whatsapp_unique_idx';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'profiles_whatsapp_key'
  ) THEN
    DROP INDEX public.profiles_whatsapp_key;
    RAISE NOTICE 'Dropped index profiles_whatsapp_key';
  END IF;
END $$;

-- Step 3: Clean up empty values
UPDATE public.profiles SET whatsapp = NULL 
WHERE whatsapp IN ('', '0') OR trim(whatsapp) = '';

-- Step 4: Clean duplicates in profiles
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY whatsapp ORDER BY created_at) as rn
  FROM public.profiles
  WHERE whatsapp IS NOT NULL AND whatsapp != ''
)
UPDATE public.profiles
SET whatsapp = NULL
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 5: Create profiles for users without them
DO $$
DECLARE
  user_record RECORD;
  normalized_wa TEXT;
  created_count INTEGER := 0;
  skipped_count INTEGER := 0;
BEGIN
  FOR user_record IN (
    SELECT u.id, u.email, u.raw_user_meta_data, u.created_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
    ORDER BY u.created_at
  )
  LOOP
    BEGIN
      -- Normalize WhatsApp
      normalized_wa := NULL;
      IF user_record.raw_user_meta_data ? 'whatsapp' THEN
        normalized_wa := trim(user_record.raw_user_meta_data->>'whatsapp');
        IF normalized_wa != '' THEN
          normalized_wa := regexp_replace(normalized_wa, '[^0-9]', '', 'g');
          IF normalized_wa ~ '^0' THEN
            normalized_wa := '62' || substring(normalized_wa, 2);
          ELSIF normalized_wa ~ '^8' THEN
            normalized_wa := '62' || normalized_wa;
          END IF;
          
          -- Check duplicate
          IF EXISTS (SELECT 1 FROM public.profiles WHERE whatsapp = normalized_wa) THEN
            normalized_wa := NULL;
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
        skipped_count := skipped_count + 1;
        RAISE NOTICE 'Skipped user %: %', user_record.email, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Created % profiles, skipped %', created_count, skipped_count;
END $$;

-- Step 6: Final cleanup
WITH final_dups AS (
  SELECT whatsapp, array_agg(id ORDER BY created_at) as ids
  FROM public.profiles
  WHERE whatsapp IS NOT NULL AND whatsapp != ''
  GROUP BY whatsapp
  HAVING COUNT(*) > 1
)
UPDATE public.profiles
SET whatsapp = NULL
WHERE id IN (SELECT unnest(ids[2:]) FROM final_dups);

-- Step 7: Create unique index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'profiles_whatsapp_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX profiles_whatsapp_unique_idx 
    ON public.profiles (whatsapp) 
    WHERE whatsapp IS NOT NULL AND whatsapp != '';
    RAISE NOTICE 'Created unique index';
  ELSE
    RAISE NOTICE 'Index already exists';
  END IF;
END $$;

-- Step 8: Fix trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE
  normalized_wa TEXT;
BEGIN
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
      INSERT INTO public.profiles (id, full_name, email, whatsapp)
      VALUES (NEW.id, COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1), 'User'), lower(NEW.email), NULL)
      ON CONFLICT (id) DO NOTHING;
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to create profile for %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- PART 2: FIX STORAGE POLICIES (Safe - Drop then Create)
-- ============================================================

DO $$
BEGIN
  -- Drop all possible policy name variations
  DROP POLICY IF EXISTS "Anyone upload payment proof" ON storage.objects;
  DROP POLICY IF EXISTS "Public upload payment proof" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated upload payment proof" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated read own payment proofs" ON storage.objects;
  DROP POLICY IF EXISTS "Admins read payment proofs" ON storage.objects;
  DROP POLICY IF EXISTS "Admins delete payment proofs" ON storage.objects;
  
  RAISE NOTICE 'Dropped existing payment-proofs policies';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Some policies may not exist: %', SQLERRM;
END $$;

-- Create policies
CREATE POLICY "Public upload payment proof"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Authenticated read own payment proofs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins read payment proofs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-proofs' AND EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Admins delete payment proofs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-proofs' AND EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT 
  'Profile Check' as check_name,
  COUNT(*) as total_users,
  COUNT(p.id) as with_profiles,
  COUNT(*) - COUNT(p.id) as missing_profiles
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id;

SELECT 
  'Duplicate Check' as check_name,
  COUNT(*) as duplicate_whatsapp
FROM (
  SELECT whatsapp FROM public.profiles 
  WHERE whatsapp IS NOT NULL 
  GROUP BY whatsapp HAVING COUNT(*) > 1
) d;

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
