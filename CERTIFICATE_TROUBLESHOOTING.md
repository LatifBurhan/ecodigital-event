# 🔧 Certificate Generation Troubleshooting Guide

## ⚠️ Masalah yang Sudah Diperbaiki

### 1. **Import supabaseAdmin yang Salah** ✅ FIXED
**Problem:** API endpoint menggunakan import yang salah
```typescript
// ❌ SEBELUM (SALAH)
import { supabaseAdmin } from "@/lib/supabase";

// ✅ SESUDAH (BENAR)
import { supabaseAdmin } from "@/integrations/supabase/client.server";
```

### 2. **Query Template dengan Event ID yang Salah** ✅ FIXED
**Problem:** Ketika query template, menggunakan `eventId` dari parameter, tapi seharusnya dari `registration.event_id`

**Sekarang sudah diperbaiki:**
- Fetch registration dulu
- Ambil `event_id` dari registration
- Baru query template dengan `event_id` yang benar

### 3. **Error Handling yang Lebih Baik** ✅ IMPROVED
**Ditambahkan:**
- Logging lengkap di setiap step
- Error message yang lebih deskriptif
- Frontend error handling yang lebih detail

---

## 🧪 Cara Testing

### Step 1: Check Browser Console

1. Buka DevTools (F12)
2. Pergi ke tab **Console**
3. Klik tombol "Generate Sertifikat"
4. Perhatikan log messages:

```
[Attendance] Calling generate certificates API for event: xxx
[Attendance] Response status: 200
[Attendance] Response data: { success: true, ... }
```

### Step 2: Check Server Logs

Jika menggunakan local dev server:

```bash
cd /Users/latif/eco-digital-event
bun run dev
```

Perhatikan terminal untuk log messages seperti:
```
[API] Generate certificates endpoint called
[API] Event ID filter: xxx
[API] Processing 3 certificate(s)...
[API] Processing job xxx for registration yyy
[API] Found registration for John Doe, event: zzz
[API] Found template: { url: ..., width: 1920, height: 1080 }
[API] ✓ Certificate generated for John Doe
```

### Step 3: Check Database

Gunakan Supabase Dashboard > SQL Editor:

```sql
-- 1. Check if certificate template exists
SELECT * FROM certificate_templates WHERE event_id = 'YOUR_EVENT_ID';

-- 2. Check certificate queue
SELECT * FROM certificate_queue 
WHERE event_id = 'YOUR_EVENT_ID' 
ORDER BY created_at DESC;

-- 3. Check certificates
SELECT 
  c.id,
  c.certificate_number,
  c.status,
  c.error_message,
  r.name,
  r.email
FROM certificates c
JOIN event_registrations r ON r.id = c.registration_id
WHERE c.event_id = 'YOUR_EVENT_ID'
ORDER BY c.created_at DESC;

-- 4. Check registrations yang sudah check-in
SELECT 
  id,
  name,
  email,
  checked_in_at
FROM event_registrations
WHERE event_id = 'YOUR_EVENT_ID' 
  AND checked_in_at IS NOT NULL
ORDER BY checked_in_at DESC;
```

---

## 🐛 Common Errors & Solutions

### Error 1: "Certificate template not found"

**Penyebab:**
- Template belum diupload untuk event ini
- Event ID tidak match

**Solusi:**
1. Pergi ke Admin > Events > Edit Event > Tab Sertifikat
2. Upload template PNG/JPG
3. Atur posisi nama dan nomor
4. Klik **Simpan Konfigurasi**

Verify dengan SQL:
```sql
SELECT * FROM certificate_templates WHERE event_id = 'YOUR_EVENT_ID';
```

### Error 2: "Registration not found"

**Penyebab:**
- Registration sudah dihapus
- Queue item menggunakan registration_id yang tidak valid

**Solusi:**
```sql
-- Hapus queue items yang invalid
DELETE FROM certificate_queue
WHERE registration_id NOT IN (SELECT id FROM event_registrations);
```

### Error 3: "Failed to download template image"

**Penyebab:**
- Bucket `certificate-templates` tidak public
- Template URL tidak valid
- Network issue

**Solusi:**
1. Buka Supabase Dashboard > Storage > certificate-templates
2. Pastikan bucket is **Public**
3. Check RLS policies:

```sql
-- Verify storage policies
SELECT * FROM storage.objects 
WHERE bucket_id = 'certificate-templates';
```

### Error 4: "Failed to upload certificate"

**Penyebab:**
- Bucket `certificates` belum dibuat
- Service role key tidak valid
- Storage quota exceeded

**Solusi:**

1. **Check buckets exist:**
```sql
SELECT * FROM storage.buckets WHERE id IN ('certificate-templates', 'certificates');
```

2. **Create buckets if missing:**
```sql
-- Run create-certificate-storage-buckets.sql
-- Atau buat manual via dashboard
```

3. **Check service role key:**
```bash
grep SUPABASE_SERVICE_ROLE_KEY .env
```

Pastikan key dimulai dengan `eyJhbG...` dan valid.

### Error 5: "No pending certificates"

**Kemungkinan:**
1. **Belum ada yang check-in** → Scan QR peserta dulu
2. **Trigger tidak jalan** → Check trigger function
3. **Queue sudah diproses** → Check status certificates

**Debug:**
```sql
-- 1. Check if anyone checked in
SELECT COUNT(*) as checked_in_count
FROM event_registrations
WHERE event_id = 'YOUR_EVENT_ID' AND checked_in_at IS NOT NULL;

-- 2. Check queue status
SELECT status, COUNT(*) as count
FROM certificate_queue
WHERE event_id = 'YOUR_EVENT_ID'
GROUP BY status;

-- 3. Check if trigger function exists
SELECT proname FROM pg_proc WHERE proname = 'queue_certificate_generation';

-- 4. Check if trigger is active
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'event_registrations_queue_certificate';
```

---

## 🔑 Environment Variables Check

Pastikan `.env` file memiliki semua keys yang diperlukan:

```bash
# Check required env vars
cd /Users/latif/eco-digital-event
cat .env | grep -E "(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)"
```

Expected output:
```
VITE_SUPABASE_URL="https://xxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJI..."
```

⚠️ **PENTING:**
- `VITE_SUPABASE_URL` untuk client
- `SUPABASE_SERVICE_ROLE_KEY` untuk server (TANPA prefix VITE_)

---

## 🧹 Reset Certificate Generation

Jika perlu reset semua certificates untuk re-generate:

```sql
-- HATI-HATI: Ini akan menghapus semua data certificate!
BEGIN;

-- Delete generated certificates
DELETE FROM certificates WHERE event_id = 'YOUR_EVENT_ID';

-- Delete queue
DELETE FROM certificate_queue WHERE event_id = 'YOUR_EVENT_ID';

-- Trigger ulang untuk semua yang sudah check-in
-- (akan otomatis create queue & certificate records)
UPDATE event_registrations 
SET updated_at = NOW()
WHERE event_id = 'YOUR_EVENT_ID' 
  AND checked_in_at IS NOT NULL;

COMMIT;
```

---

## 📊 Monitor Certificate Generation

### Real-time monitoring:

```sql
-- Dashboard query
SELECT 
  e.title as event_name,
  COUNT(DISTINCT r.id) as total_registrations,
  COUNT(DISTINCT CASE WHEN r.checked_in_at IS NOT NULL THEN r.id END) as checked_in,
  COUNT(DISTINCT c.id) as certificates_created,
  COUNT(DISTINCT CASE WHEN c.status = 'generated' THEN c.id END) as certificates_generated,
  COUNT(DISTINCT CASE WHEN c.status = 'pending' THEN c.id END) as certificates_pending,
  COUNT(DISTINCT CASE WHEN c.status = 'processing' THEN c.id END) as certificates_processing,
  COUNT(DISTINCT CASE WHEN c.status = 'failed' THEN c.id END) as certificates_failed
FROM events e
LEFT JOIN event_registrations r ON r.event_id = e.id AND r.status = 'approved'
LEFT JOIN certificates c ON c.registration_id = r.id
WHERE e.id = 'YOUR_EVENT_ID'
GROUP BY e.id, e.title;
```

---

## 🚀 Quick Fix Commands

### Restart semua pending certificates:

```sql
UPDATE certificate_queue 
SET status = 'pending', retry_count = 0, last_error = NULL
WHERE status IN ('processing', 'failed');

UPDATE certificates 
SET status = 'pending', retry_count = 0, error_message = NULL
WHERE status IN ('processing', 'failed');
```

### Force process via API:

```bash
curl -X POST http://localhost:3000/api/admin/generate-certificates \
  -H "Content-Type: application/json" \
  -d '{"event_id": "YOUR_EVENT_ID"}'
```

---

## 📝 Next Steps

Setelah fix ini di-deploy:

1. **Test dengan 1 peserta dulu:**
   - Check-in 1 peserta
   - Klik "Generate Sertifikat"
   - Monitor console & server logs
   - Verify sertifikat ter-generate

2. **Jika berhasil, test bulk:**
   - Check-in multiple peserta
   - Generate semua sekaligus
   - Monitor performance

3. **Setup automation:**
   - Setup cron job atau webhook
   - Monitor dengan query dashboard

---

## 💬 Still Having Issues?

**Collect these information:**

1. **Browser Console Log** (full output)
2. **Server Terminal Log** (saat klik generate)
3. **Database Query Results:**
   ```sql
   SELECT * FROM certificate_templates WHERE event_id = 'YOUR_EVENT_ID';
   SELECT * FROM certificate_queue WHERE event_id = 'YOUR_EVENT_ID' LIMIT 5;
   SELECT * FROM certificates WHERE event_id = 'YOUR_EVENT_ID' LIMIT 5;
   ```
4. **Environment Variables** (sensitive parts dapat di-redact)
5. **Screenshot error message**

With these logs, kita bisa pinpoint exactly dimana masalahnya! 🎯
