-- ============================================================
-- RUN THESE QUERIES ONE BY ONE (not all at once!)
-- ============================================================

-- STEP 1: Check current duplicates
SELECT whatsapp, COUNT(*) as count, array_agg(email ORDER BY created_at) as emails
FROM public.profiles
WHERE whatsapp IS NOT NULL AND whatsapp != ''
GROUP BY whatsapp
HAVING COUNT(*) > 1;

-- STEP 2: Make whatsapp nullable
ALTER TABLE public.profiles ALTER COLUMN whatsapp DROP NOT NULL;

-- STEP 3: Set empty whatsapp to NULL
UPDATE public.profiles SET whatsapp = NULL WHERE whatsapp = '';

-- STEP 4: Drop the old constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_whatsapp_key;

-- STEP 5: Fix duplicates - set all but first to NULL
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
  SELECT unnest(user_ids[2:])
  FROM duplicates
);

-- STEP 6: Verify no more duplicates (should return 0 rows)
SELECT whatsapp, COUNT(*) as count
FROM public.profiles
WHERE whatsapp IS NOT NULL AND whatsapp != ''
GROUP BY whatsapp
HAVING COUNT(*) > 1;

-- STEP 7: Now safe to create unique index
CREATE UNIQUE INDEX IF NOT EXISTS profiles_whatsapp_unique_idx ON public.profiles (whatsapp) 
WHERE whatsapp IS NOT NULL AND whatsapp != '';

-- STEP 8: Fix trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, full_name, email, whatsapp)
    VALUES (
      NEW.id,
      COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        split_part(NEW.email, '@', 1),
        'User'
      ),
      COALESCE(lower(NEW.email), ''),
      CASE 
        WHEN NEW.raw_user_meta_data ? 'whatsapp' AND trim(NEW.raw_user_meta_data->>'whatsapp') != '' 
        THEN public.normalize_wa(NEW.raw_user_meta_data->>'whatsapp')
        ELSE NULL
      END
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN unique_violation THEN
      UPDATE public.profiles 
      SET whatsapp = NULL
      WHERE id = NEW.id;
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- STEP 9: Create profiles for users without profile
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
  WHERE p.id IS NULL
)
INSERT INTO public.profiles (id, full_name, email, whatsapp)
SELECT 
  id,
  full_name,
  email,
  CASE WHEN row_num = 1 THEN whatsapp ELSE NULL END as whatsapp
FROM users_to_create
ON CONFLICT (id) DO NOTHING;

-- STEP 10: Final verification
SELECT 
  COUNT(*) as total_users,
  COUNT(p.id) as users_with_profiles,
  COUNT(*) - COUNT(p.id) as users_without_profiles
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id;
