# 🚨 URGENT FIX: Certificate Template Missing

## ❌ Problem Identified

Error: **"Certificate template not found"**

Event ID: `6f4d2f11-325e-4dc5-a61d-cb154393e715`

**Root Cause:** Template sertifikat belum diupload untuk event ini.

---

## ✅ Solution: Upload Template (5 Menit)

### Step 1: Identify Event Name

Jalankan SQL ini di **Supabase Dashboard > SQL Editor**:

```sql
SELECT id, title, slug FROM events 
WHERE id = '6f4d2f11-325e-4dc5-a61d-cb154393e715';
```

Catat nama eventnya.

---

### Step 2: Upload Template

1. **Login sebagai Admin** di aplikasi Anda
2. **Pergi ke menu Events**
3. **Cari event** yang sesuai dengan nama dari Step 1
4. **Klik Edit** (tombol pensil)
5. **Pilih tab "Sertifikat"** (atau Certificate)
6. **Upload template image:**
   - Format: PNG atau JPG
   - Recommended size: 1920x1080 px atau 1280x720 px
   - Max file size: 5MB
7. **Atur Posisi Nama:**
   - Klik tombol "Atur Posisi Nama"
   - Klik di canvas dimana nama peserta harus muncul
8. **Atur Posisi Nomor Sertifikat:**
   - Klik tombol "Atur Posisi Nomor"
   - Klik di canvas dimana nomor sertifikat harus muncul
9. **Sesuaikan styling** (font size, color, alignment)
10. **Klik "Simpan Konfigurasi"**

---

### Step 3: Verify Template Uploaded

Jalankan SQL ini untuk verify:

```sql
SELECT * FROM certificate_templates 
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715';
```

Harus return 1 row dengan `template_url` yang valid.

---

### Step 4: Reset Queue

Setelah template uploaded, jalankan SQL ini untuk reset queue:

```sql
-- File: reset-certificate-queue.sql
BEGIN;

UPDATE certificate_queue 
SET 
  status = 'pending',
  retry_count = 0,
  last_error = NULL,
  processed_at = NULL
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715';

UPDATE certificates 
SET 
  status = 'pending',
  retry_count = 0,
  error_message = NULL
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715';

COMMIT;
```

---

### Step 5: Generate Certificates

1. **Refresh halaman attendance**
2. **Klik tombol "Generate Sertifikat (2)"**
3. **Watch browser console** (F12) untuk logs
4. **Wait sampai muncul toast success**

Atau via API:

```bash
curl -X POST http://localhost:3000/api/admin/generate-certificates \
  -H "Content-Type: application/json" \
  -d '{"event_id": "6f4d2f11-325e-4dc5-a61d-cb154393e715"}'
```

---

### Step 6: Verify Success

Jalankan SQL ini:

```sql
-- Check certificate generation status
SELECT 
  c.id,
  c.certificate_number,
  c.status,
  c.certificate_url,
  r.name,
  r.email
FROM certificates c
JOIN event_registrations r ON r.id = c.registration_id
WHERE c.event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
ORDER BY c.created_at DESC;
```

Status harus berubah dari `pending` → `generated`

Certificate URL harus ter-fill.

---

## 🎨 Template Design Tips

### Recommended Template Specs:

- **Resolution:** 1920x1080 px (Full HD landscape)
- **Format:** PNG (transparan background support) atau JPG
- **File size:** < 2MB (compressed)
- **Color mode:** RGB
- **DPI:** 72-150 (untuk digital)

### Layout Recommendations:

```
┌─────────────────────────────────────────┐
│                                         │
│              [LOGO/HEADER]              │
│                                         │
│         Certificate of Achievement      │
│                                         │
│            This certifies that          │
│                                         │
│             [NAMA PESERTA]  ← position   │
│                                         │
│         has successfully attended       │
│                                         │
│              [EVENT TITLE]              │
│                                         │
│  [Nomor: EVENT-001] ← position          │
│                                         │
│  [Date]          [Signatures]           │
│                                         │
└─────────────────────────────────────────┘
```

### Font Positioning:

- **Nama Peserta:**
  - Position: Center horizontal, sekitar 40-50% dari atas
  - Font size: 48-60px
  - Color: Dark color untuk visibility
  - Alignment: Center

- **Nomor Sertifikat:**
  - Position: Bottom left atau bottom center
  - Font size: 20-28px
  - Color: Gray atau subtle color
  - Alignment: Left atau Center

---

## 📝 Quick Checklist

Sebelum generate, pastikan:

- [ ] Event sudah dibuat
- [ ] Template sudah diupload
- [ ] Posisi nama sudah diatur
- [ ] Posisi nomor sudah diatur
- [ ] Template preview terlihat OK
- [ ] Konfigurasi sudah disimpan
- [ ] Storage buckets sudah dibuat:
  - [ ] `certificate-templates` (public)
  - [ ] `certificates` (public)
- [ ] Service role key ada di `.env`
- [ ] Peserta sudah check-in

---

## 🔍 Debug if Still Fails

### Check Template URL Accessible:

```sql
-- Get template URL
SELECT template_url FROM certificate_templates 
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715';
```

Copy URL dan buka di browser. Harus bisa diakses (gambar muncul).

### Check Storage Buckets:

1. Buka **Supabase Dashboard > Storage**
2. Check buckets exist:
   - `certificate-templates`
   - `certificates`
3. Both must be **Public**
4. Click bucket → Settings → Make sure "Public bucket" is ON

### Check RLS Policies:

```sql
-- Storage policies untuk certificate-templates
SELECT * FROM storage.objects 
WHERE bucket_id = 'certificate-templates' 
LIMIT 5;

-- Check if public access enabled
-- Seharusnya bisa diakses tanpa auth
```

---

## ✨ Expected Result

Setelah semua langkah di atas:

1. ✅ Template ter-upload
2. ✅ Queue status = `pending`
3. ✅ Generate certificates berhasil
4. ✅ Status berubah ke `generated`
5. ✅ Certificate URL ter-fill
6. ✅ Peserta bisa download sertifikat

---

## 🆘 Still Having Issues?

Collect dan share:

1. **SQL result dari check-certificate-template.sql**
2. **Screenshot error dari browser console**
3. **Screenshot dari template upload form**
4. **Certificate template image** (sample)

---

**Good luck! 🚀**

Jika sudah upload template dan masih error, share error message yang baru.
