# Certificate Template Storage Policy Fix

## Problem
Upload template sertifikat gagal dengan error "new row violates row-level security policy" karena RLS policy pada storage bucket `certificate-templates` terlalu ketat.

## Solution
Sudah dibuat migration file untuk memperbaiki storage policies: 
`supabase/migrations/20250129000002_fix_certificate_templates_storage_policy.sql`

## How to Apply (Pilih salah satu)

### Option 1: Via Supabase Dashboard (Recommended)
1. Buka https://supabase.com/dashboard/project/mtaqyjyezfadfewbdlrf/sql/new
2. Copy isi file `supabase/migrations/20250129000002_fix_certificate_templates_storage_policy.sql`
3. Paste ke SQL Editor
4. Klik "Run"

### Option 2: Via Supabase CLI (jika sudah terkoneksi)
```bash
supabase db push
```

## What the Migration Does
Migration ini akan:
1. Drop semua existing policies yang mungkin conflict
2. Buat policies baru yang lebih simple:
   - **INSERT**: Authenticated users can upload
   - **UPDATE**: Authenticated users can update (untuk upsert)
   - **SELECT**: Public can read (untuk akses certificate)
   - **DELETE**: Authenticated users can delete

## After Applying Migration
Setelah migration diapply, Anda bisa:
1. Login sebagai admin di `/admin/login`
2. Create/Edit event di `/admin/events`
3. Upload template sertifikat langsung di form event
4. Template akan tersimpan dengan format: `certificate-templates/certificate-template-{eventId}.{ext}`

## Testing
1. Login sebagai `admin@ecodigitaleventkit.id`
2. Buat event baru atau edit event existing
3. Upload gambar template sertifikat (JPG, PNG, atau PDF)
4. Klik "Simpan event"
5. Cek di dashboard apakah template tersimpan di `certificate_templates` table

## Troubleshooting
Jika masih gagal upload setelah apply migration:
1. Check apakah migration sudah benar-benar dijalankan:
   ```sql
   SELECT * FROM storage.policies WHERE bucket_id = 'certificate-templates';
   ```
2. Check apakah bucket `certificate-templates` sudah ada dan public:
   ```sql
   SELECT * FROM storage.buckets WHERE name = 'certificate-templates';
   ```
3. Pastikan user sudah authenticated (ada JWT token valid)
4. Check browser console untuk error message detail
