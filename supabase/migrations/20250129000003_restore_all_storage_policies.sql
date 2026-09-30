-- Restore all storage policies for all buckets
-- This fixes the issue where payment proof upload stopped working

-- First, let's see what we have and clean up properly
-- Drop only certificate-templates specific policies
DROP POLICY IF EXISTS "Authenticated users can upload certificate templates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update certificate templates" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read certificate templates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete certificate templates" ON storage.objects;

-- Drop and recreate payment-proofs policies (in case they were affected)
DROP POLICY IF EXISTS "Anyone upload payment proof" ON storage.objects;
DROP POLICY IF EXISTS "Admins read payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete payment proofs" ON storage.objects;

-- Drop and recreate event-posters policies (in case they were affected)
DROP POLICY IF EXISTS "Anyone read posters" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload posters" ON storage.objects;
DROP POLICY IF EXISTS "Admins update posters" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete posters" ON storage.objects;

-- Drop and recreate certificates policies (in case they were affected)
DROP POLICY IF EXISTS "Anyone can read certificates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage certificates" ON storage.objects;

-- ============================================================================
-- PAYMENT PROOFS BUCKET - Critical for event registration!
-- ============================================================================
CREATE POLICY "Anyone upload payment proof"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Admins read payment proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete payment proofs"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- EVENT POSTERS BUCKET
-- ============================================================================
CREATE POLICY "Anyone read posters"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'event-posters');

CREATE POLICY "Admins upload posters"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-posters' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update posters"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'event-posters' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete posters"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'event-posters' AND public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- CERTIFICATE TEMPLATES BUCKET
-- ============================================================================
CREATE POLICY "Authenticated users can upload certificate templates"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'certificate-templates');

CREATE POLICY "Authenticated users can update certificate templates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'certificate-templates')
WITH CHECK (bucket_id = 'certificate-templates');

CREATE POLICY "Anyone can read certificate templates"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'certificate-templates');

CREATE POLICY "Authenticated users can delete certificate templates"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'certificate-templates');

-- ============================================================================
-- CERTIFICATES BUCKET (generated certificates)
-- ============================================================================
CREATE POLICY "Anyone can read certificates"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'certificates');

CREATE POLICY "Authenticated users can upload certificates"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'certificates');

CREATE POLICY "Service role can manage certificates"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'certificates')
WITH CHECK (bucket_id = 'certificates');
