-- Fix handle_new_user trigger to ALWAYS create profile
-- Previous version only created profile if whatsapp metadata exists
-- This caused "Profil tidak ditemukan" errors

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
        ELSE '' -- Empty string if no whatsapp (will be filled later)
      END
    )
    ON CONFLICT (id) DO NOTHING; -- Ignore if profile already exists
  EXCEPTION
    WHEN unique_violation THEN
      -- Handle duplicate whatsapp gracefully
      -- This can happen if whatsapp number is already used
      UPDATE public.profiles 
      SET whatsapp = ''
      WHERE id = NEW.id AND whatsapp != '';
    WHEN OTHERS THEN
      -- Log error but don't fail user registration
      RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END $$;

-- Ensure trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Also update existing users who don't have profiles yet
-- This fixes any users created before this migration
INSERT INTO public.profiles (id, full_name, email, whatsapp)
SELECT 
  u.id,
  COALESCE(
    NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
    split_part(u.email, '@', 1),
    'User'
  ),
  COALESCE(lower(u.email), ''),
  CASE 
    WHEN u.raw_user_meta_data ? 'whatsapp' AND trim(u.raw_user_meta_data->>'whatsapp') != '' 
    THEN public.normalize_wa(u.raw_user_meta_data->>'whatsapp')
    ELSE ''
  END
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL -- Only users without profiles
ON CONFLICT (id) DO NOTHING;

-- Make whatsapp field nullable temporarily to allow empty values
-- This prevents unique constraint violations during profile creation
ALTER TABLE public.profiles ALTER COLUMN whatsapp DROP NOT NULL;

-- Update empty whatsapp values to NULL to avoid unique constraint issues
UPDATE public.profiles SET whatsapp = NULL WHERE whatsapp = '';

-- Add unique constraint that excludes NULL values
DROP INDEX IF EXISTS profiles_whatsapp_key;
CREATE UNIQUE INDEX profiles_whatsapp_unique_idx ON public.profiles (whatsapp) WHERE whatsapp IS NOT NULL AND whatsapp != '';
