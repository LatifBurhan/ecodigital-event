-- Fix storage policies for certificate template upload

-- Drop existing broken policy
DROP POLICY IF EXISTS "Admins insert certificate templates storage" ON storage.objects;

-- Recreate with proper WITH CHECK clause
CREATE POLICY "Admins insert certificate templates storage" 
  ON storage.objects FOR INSERT 
  TO authenticated 
  WITH CHECK (
    bucket_id = 'certificate-templates' 
    AND public.has_role(auth.uid(), 'admin')
  );

-- Verify the fix
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname = 'Admins insert certificate templates storage';
