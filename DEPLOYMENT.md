# 🚀 Deployment Guide - ECO Digital Event Kit

## 📋 Pre-Deployment Checklist

### 1. Database Setup

Jalankan migrations di Supabase SQL Editor:

```sql
-- 1. Run main migrations (in order)
drizzle/migrations/0000_eco_digital_partner_inquiries.sql
drizzle/migrations/0001_events_and_registrations.sql
drizzle/migrations/0002_participant_profiles.sql
drizzle/migrations/0003_fix_profiles_rls_policy.sql
drizzle/migrations/0004_certificate_system.sql

-- 2. Create storage buckets
create-certificate-storage-buckets.sql
```

### 2. Environment Variables

Copy `.env.example` to `.env` dan isi dengan credentials Anda:

```bash
cp .env.example .env
```

Required variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (untuk certificate generation)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 3. Install Dependencies

```bash
bun install
```

### 4. Test Locally

```bash
bun run dev
```

---

## 🌐 Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. **Push to GitHub** (pastikan `.env` tidak ter-commit!)
   ```bash
   git add .
   git commit -m "feat: add certificate system"
   git push origin main
   ```

2. **Connect to Vercel**
   - Login di https://vercel.com
   - Click "Add New Project"
   - Import your GitHub repository
   - Framework Preset: Vite (auto-detected)

3. **Configure Environment Variables**
   
   Di Vercel Dashboard > Settings > Environment Variables, tambahkan:
   
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=eyJhbGci...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

4. **Deploy**
   - Click "Deploy"
   - Tunggu build selesai (~3-5 menit)

### Option B: Via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

---

## ⚙️ Certificate Auto-Generation

### Development (Local Cron)

Setup cron job untuk auto-generate certificates:

```bash
crontab -e
```

Tambahkan:
```bash
*/5 * * * * /Users/latif/eco-digital-event/run-certificate-processor.sh >> /Users/latif/eco-digital-event/cert-processor.log 2>&1
```

### Production (Vercel Cron)

Sudah dikonfigurasi di `vercel.json`:
- Endpoint: `/api/process-certificates`
- Schedule: Every 5 minutes
- Otomatis aktif setelah deploy

---

## 🔒 Security Notes

### PENTING - Credentials Management:

1. **JANGAN commit `.env` ke Git!**
   - Sudah ada di `.gitignore`
   - Gunakan `.env.example` untuk dokumentasi

2. **Rotate Service Role Key jika ter-expose:**
   - Supabase Dashboard > Settings > API
   - Generate new service_role key
   - Update di semua environment

3. **Vercel Environment Variables:**
   - Berbeda per environment (Development/Preview/Production)
   - Bisa di-encrypt

---

## 📊 Post-Deployment Checklist

### Test Certificate System:

1. ✅ Upload template sertifikat di admin panel
2. ✅ Register peserta di event
3. ✅ Scan QR code peserta
4. ✅ Tunggu 5-10 menit (cron run)
5. ✅ Cek `/sertifikat/TICKET_CODE`
6. ✅ Download sertifikat

### Monitor Cron:

Vercel Dashboard > Deployments > Functions > Logs

---

## 🐛 Troubleshooting

### Build Failed

```bash
# Clear cache dan rebuild
bun run build
```

### Certificate Not Generating

1. Cek Vercel cron logs
2. Cek database queue: `SELECT * FROM certificate_queue;`
3. Test manual: `curl -X POST https://your-domain.vercel.app/api/process-certificates`

### Environment Variables Not Working

- Redeploy setelah update env vars
- Cek typo di variable names
- Pastikan semua vars ada di Production environment

---

## 📚 Additional Documentation

- Certificate System: `CERTIFICATE_SYSTEM.md`
- Quick Start: `CERTIFICATE_QUICKSTART.md`
- Testing Guide: `CERTIFICATE_TESTING_GUIDE.md`
- Cron Setup: `CRON_SETUP.md`

---

**Happy Deploying! 🎉**
