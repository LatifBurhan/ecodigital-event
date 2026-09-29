# 🎓 Quick Start: Certificate System

## ✅ Step-by-Step Setup (5 Menit)

### 1. Database Migration

Buka **Supabase Dashboard** > **SQL Editor** > **New Query**

Copy-paste isi file berikut dan klik **Run**:
```
drizzle/migrations/0004_certificate_system.sql
```

### 2. Storage Buckets

Masih di **SQL Editor**, jalankan:
```
create-certificate-storage-buckets.sql
```

Atau bisa manual via UI:
- Buka **Storage** > **Create new bucket**
- Bucket 1: `certificate-templates` (public, max 5MB)
- Bucket 2: `certificates` (public, max 10MB)

### 3. Service Role Key

1. Buka **Supabase Dashboard** > **Settings** > **API**
2. Copy **service_role** key (bukan anon key!)
3. Edit `.env`:
   ```
   SUPABASE_SERVICE_ROLE_KEY="eyJhb...your-key-here"
   ```

### 4. Test Upload Template

1. Jalankan dev server: `bun run dev`
2. Login sebagai admin
3. Buka **Events** > pilih event > **Edit** > tab **Sertifikat**
4. Upload template PNG/JPG
5. Atur posisi nama dan nomor
6. Klik **Simpan**

### 5. Test Generate Certificate

1. Scan QR peserta (atau manual update checked_in_at di database)
2. Jalankan processor:
   ```bash
   bun run process-certificates
   ```
3. Cek sertifikat di `/sertifikat/TICKET_CODE`

---

## 🚀 Production Setup

### Option A: Cron Job
```bash
crontab -e
# Add:
*/5 * * * * cd /path/to/project && bun run process-certificates
```

### Option B: API Webhook (Recommended)
Setup cron trigger di hosting Anda yang hit endpoint:
```
POST https://your-domain.com/api/process-certificates
```

### Option C: Manual Trigger
Admin bisa jalankan manual kapan saja:
```bash
bun run process-certificates
```

---

## ❓ Troubleshooting

**Sertifikat tidak generate?**
- Check template sudah diupload
- Check storage buckets public
- Check service role key di .env
- Run `bun run process-certificates` manual dan lihat error

**Error: Failed to download template?**
- Pastikan bucket `certificate-templates` is **public**

**Text position salah?**
- Re-upload template dan drag posisi lagi
- Pastikan click tepat di canvas

---

## 📖 Full Documentation

Lihat `CERTIFICATE_SYSTEM.md` untuk dokumentasi lengkap.

---

**Selamat! Certificate system sudah ready! 🎉**
