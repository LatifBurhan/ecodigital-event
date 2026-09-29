-- Fix storage policies for certificate-templates bucket
-- Allow authenticated users to upload and read certificate templates

-- Drop ALL existing policies for certificate-templates bucket (various names that might exist)
DROP POLICY IF EXISTS "Allow authenticated users to upload templates" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to read templates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload to certificate-templates" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from certificate-templates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload certificate templates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update certificate templates" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read certificate templates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete certificate templates" ON storage.objects;

-- Create simple policies for certificate-templates bucket
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
