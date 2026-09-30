# ✅ Fixed: Storage RLS Policy Error

## 🔴 Error Yang Terjadi:
```
StorageApiError: new row violates row-level security policy
```

## 🔍 Root Cause:
Storage policies untuk `certificate-templates` bucket:
1. ❌ **Missing UPDATE policy** - needed for `upsert: true`
2. ⚠️ **Policy menggunakan function `has_role()`** - bisa fail karena SECURITY DEFINER context

## ✅ Solution Applied:

### **Migration: `comprehensive_storage_policies_fix`**

**Changes:**
1. ✅ **Recreated INSERT policy** dengan EXISTS check langsung
2. ✅ **Added UPDATE policy** untuk support upsert
3. ✅ **Recreated DELETE policy** dengan EXISTS check langsung
4. ✅ **Kept READ policy** (public, no changes needed)

**New Policy Logic:**
```sql
-- Instead of using has_role() function:
has_role(auth.uid(), 'admin')

-- Now using direct EXISTS check:
EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() 
  AND role = 'admin'::public.app_role
)
```

**Benefits:**
- ✅ More reliable (no function call overhead)
- ✅ Works in all security contexts
- ✅ Supports INSERT, UPDATE, DELETE for admins
- ✅ Public READ still works for everyone

---

## 🧪 How to Test Upload:

### **Step 1: Login as Admin**
Email: `admin@ecodigitaleventkit.id`

### **Step 2: Go to Event Edit Page**
1. Admin → Events → Select any event
2. Click **Edit** (pencil icon)
3. Go to **Sertifikat** tab

### **Step 3: Upload Template**
1. Click **Choose File**
2. Select PNG/JPG (max 5MB)
3. Click **Upload**
4. ✅ Should succeed now!

### **Step 4: Configure Positions**
1. Click "Atur Posisi Nama"
2. Click on canvas where name should appear
3. Click "Atur Posisi Nomor"
4. Click on canvas where certificate number should appear
5. Adjust font size/color if needed
6. Click **Simpan Konfigurasi**

### **Step 5: Verify in Database**
```sql
SELECT 
  event_id,
  template_url,
  name_position_x,
  name_position_y,
  cert_number_position_x,
  cert_number_position_y,
  updated_at
FROM certificate_templates
ORDER BY updated_at DESC
LIMIT 3;
```

Should show your newly uploaded/updated template!

---

## 🐛 If Still Getting RLS Error:

### **Debug Step 1: Check Current User**
Run di Supabase SQL Editor (saat sudah login di browser):
```sql
SELECT 
  auth.uid() as current_user,
  auth.role() as current_role,
  (SELECT email FROM profiles WHERE id = auth.uid()) as email;
```

### **Debug Step 2: Check User Has Admin Role**
```sql
SELECT 
  user_id,
  role,
  (SELECT email FROM profiles WHERE id = user_id) as email
FROM user_roles
WHERE user_id = auth.uid();
```

**Expected:** Should return 1 row with `role = 'admin'`

### **Debug Step 3: Test Policy Evaluation**
```sql
SELECT 
  auth.uid() as user_id,
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  ) as has_admin_role,
  (
    'certificate-templates' = 'certificate-templates'
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
    )
  ) as policy_passes;
```

**Expected:** 
- `has_admin_role` = `true`
- `policy_passes` = `true`

### **Debug Step 4: Check Bucket**
```sql
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'certificate-templates';
```

**Expected:**
- `public` = `true`
- `file_size_limit` = `5242880` (5MB)

---

## 🔑 Important Notes:

### **Admin User Info:**
- Email: `admin@ecodigitaleventkit.id`
- Role: `admin`
- User ID: `508b89c8-f049-4af1-9cb7-0d3211d15604`

### **Login Requirements:**
1. ✅ Must be logged in
2. ✅ Must have `admin` role in `user_roles` table
3. ✅ Session must be valid (not expired)

### **Upload Specs:**
- **Allowed formats:** PNG, JPG, JPEG
- **Max file size:** 5MB
- **Recommended resolution:** 1920×1080 px or 1280×720 px
- **Bucket:** `certificate-templates`
- **Path pattern:** `{event_id}/template.{ext}`

---

## ✅ Verification Checklist:

After upload:
- [ ] No RLS error in console
- [ ] Toast shows "Template berhasil diupload"
- [ ] Preview image appears
- [ ] Can click to set positions
- [ ] Save config succeeds
- [ ] Database shows template_url
- [ ] URL is accessible (try opening in browser)

---

## 📊 Policy Summary:

| Operation | Who | Bucket | Rule |
|-----------|-----|--------|------|
| INSERT | authenticated + admin | certificate-templates | EXISTS check |
| UPDATE | authenticated + admin | certificate-templates | EXISTS check |
| DELETE | authenticated + admin | certificate-templates | EXISTS check |
| SELECT | anon + authenticated | certificate-templates | Public |
| ALL | service_role | certificates | Service role only |

---

**Fixed! Try upload lagi sekarang!** 🚀

Jika masih ada error, share:
1. Exact error message dari console
2. User email yang login
3. Result dari Debug Step 1-4
