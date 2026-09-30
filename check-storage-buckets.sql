-- Check if storage buckets exist and are properly configured

-- 1. Check buckets exist
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id IN ('certificate-templates', 'certificates');

-- 2. Check storage policies for certificate-templates
SELECT 
  policyname,
  tablename,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%certificate%';

-- 3. Check if any files uploaded
SELECT 
  bucket_id,
  name,
  created_at
FROM storage.objects
WHERE bucket_id IN ('certificate-templates', 'certificates')
ORDER BY created_at DESC
LIMIT 10;
