-- Migration: Fix Profiles RLS Policy
-- Issue: Users cannot create their own profile when registering
-- Solution: Add INSERT policy for authenticated users to create their own profile

-- Add policy to allow authenticated users to INSERT their own profile
CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- Grant INSERT permission to authenticated users (if not already granted)
GRANT INSERT ON public.profiles TO authenticated;

-- Comment explaining the policy
COMMENT ON POLICY "Users can insert own profile" ON public.profiles IS 
'Allows authenticated users to create their own profile record during registration or first login';
