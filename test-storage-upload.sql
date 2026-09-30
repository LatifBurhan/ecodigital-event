-- Test storage permissions untuk current user
-- Jalankan ini saat sudah login sebagai admin di browser

-- 1. Check current user
SELECT 
  auth.uid() as current_user_id,
  auth.role() as current_role;

-- 2. Check if current user is admin
SELECT 
  auth.uid() as user_id,
  has_role(auth.uid(), 'admin'::app_role) as is_admin,
  (SELECT email FROM profiles WHERE id = auth.uid()) as email;

-- 3. Check user_roles for current user  
SELECT * FROM user_roles WHERE user_id = auth.uid();

-- 4. Test policy evaluation for INSERT
SELECT 
  'certificate-templates' as bucket_id,
  auth.uid() as user_id,
  has_role(auth.uid(), 'admin'::app_role) as has_admin_role,
  (bucket_id = 'certificate-templates' AND has_role(auth.uid(), 'admin'::app_role)) as policy_result;

-- 5. Check storage.objects permissions
SELECT 
  schemaname,
  tablename,
  has_table_privilege(auth.uid(), 'storage.objects', 'INSERT') as can_insert,
  has_table_privilege(auth.uid(), 'storage.objects', 'UPDATE') as can_update,
  has_table_privilege(auth.uid(), 'storage.objects', 'DELETE') as can_delete;
