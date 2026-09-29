# Certificate System Documentation

## 🎓 Fitur Sertifikat Otomatis

Sistem sertifikat otomatis memungkinkan panitia untuk:
- Upload template sertifikat (PNG/JPG)
- Konfigurasi posisi nama dan nomor sertifikat dengan visual drag-and-drop
- Generate sertifikat secara otomatis setelah peserta check-in
- Peserta dapat download sertifikat mereka sendiri

---

## 📋 Setup & Installation

### 1. Database Migration

Jalankan migration untuk membuat table yang diperlukan:

```bash
# Apply migration SQL ke Supabase
# Buka Supabase Dashboard > SQL Editor
# Paste isi file: drizzle/migrations/0004_certificate_system.sql
# Atau jalankan via CLI:
bun run supabase migration up
```

### 2. Storage Buckets

Buat 2 buckets di Supabase Storage:

**a. Bucket: `certificate-templates`**
- Public bucket: YES
- File size limit: 5MB
- Allowed MIME types: `image/png`, `image/jpeg`

**b. Bucket: `certificates`**
- Public bucket: YES
- File size limit: 10MB
- Allowed MIME types: `image/png`

**Cara membuat via Supabase Dashboard:**
1. Buka Storage > Create new bucket
2. Masukkan nama bucket
3. Centang "Public bucket"
4. Save

### 3. Environment Variables

Tidak perlu environment variable tambahan, semua sudah menggunakan kredensial Supabase yang ada.

---

## 🚀 Cara Pakai

### Admin - Upload Template

1. Login sebagai admin
2. Buka menu **Events**
3. Pilih event yang ingin ditambahkan sertifikat
4. Klik **Edit**
5. Pilih tab **Sertifikat**
6. Upload template sertifikat (PNG/JPG, max 5MB)
7. Klik tombol **Atur Posisi Nama** lalu klik di canvas untuk menentukan posisi nama
8. Klik tombol **Atur Posisi Nomor** lalu klik di canvas untuk menentukan posisi nomor sertifikat
9. Atur font size, warna, dan alignment sesuai kebutuhan
10. Klik **Simpan Konfigurasi**

### Admin - Scan Peserta

Ketika admin scan QR code peserta:
1. Check-in berhasil ✅
2. System otomatis queue certificate generation di background
3. Admin tidak perlu tunggu, bisa langsung scan peserta berikutnya

### Peserta - Download Sertifikat

**Cara 1: Via Halaman Tiket**
1. Buka halaman tiket: `/tiket/KODE_TIKET`
2. Klik tombol **Lihat Sertifikat Saya**
3. Download sertifikat jika sudah ready

**Cara 2: Via Halaman Sertifikat**
1. Buka `/sertifikat`
2. Masukkan kode tiket
3. Lihat status sertifikat
4. Download jika sudah ready

---

## ⚙️ Background Processing

Certificate generation berjalan di background agar tidak mengganggu proses scan.

### Opsi 1: Manual Trigger

```bash
bun run process-certificates
```

### Opsi 2: API Endpoint

```bash
curl -X POST http://localhost:3000/api/process-certificates
```

### Opsi 3: Cron Job (Production)

Tambahkan ke crontab untuk auto-process setiap 5 menit:

```bash
# Edit crontab
crontab -e

# Tambahkan baris ini:
*/5 * * * * cd /path/to/eco-digital-event && bun run process-certificates >> /tmp/cert-processor.log 2>&1
```

### Opsi 4: Cloudflare Cron (Recommended untuk Production)

Jika deploy di Cloudflare Pages, gunakan Cron Triggers:

```toml
# wrangler.toml
[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes
```

Atau setup via Cloudflare Dashboard:
1. Workers & Pages > Your site > Triggers
2. Add Cron Trigger: `*/5 * * * *`
3. Endpoint: `/api/process-certificates`

---

## 📊 Database Structure

### `certificate_templates`
Menyimpan template dan konfigurasi per event.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| event_id | uuid | Foreign key ke events (ON DELETE CASCADE) |
| template_url | text | URL template image di storage |
| name_position_x | int | X coordinate untuk nama |
| name_position_y | int | Y coordinate untuk nama |
| name_font_size | int | Font size nama (default: 48) |
| name_font_color | text | Hex color (default: #000000) |
| cert_number_position_x | int | X coordinate untuk nomor |
| cert_number_position_y | int | Y coordinate untuk nomor |
| cert_number_font_size | int | Font size nomor (default: 24) |

### `certificates`
Menyimpan data sertifikat yang sudah di-generate.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| registration_id | uuid | Foreign key ke event_registrations |
| event_id | uuid | Foreign key ke events |
| certificate_number | text | Nomor unik (contoh: EVENT-SLUG-001) |
| certificate_url | text | URL sertifikat di storage |
| status | enum | pending, processing, generated, failed |
| generated_at | timestamp | Waktu selesai generate |

### `certificate_queue`
Antrian job untuk background processing.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| registration_id | uuid | Foreign key ke event_registrations |
| event_id | uuid | Foreign key ke events |
| status | enum | pending, processing, completed, failed |
| retry_count | int | Jumlah retry (max 3) |
| last_error | text | Error message jika gagal |

---

## 🎨 Format Nomor Sertifikat

Format: `EVENT-SLUG-001`

Contoh:
- `WEBINAR-CLIMATE-001`
- `WORKSHOP-SUSTAINABILITY-042`
- `CONFERENCE-GREEN-TECH-999`

---

## 🔧 Troubleshooting

### Sertifikat tidak ter-generate

1. **Cek apakah template sudah diupload**
   ```sql
   SELECT * FROM certificate_templates WHERE event_id = 'EVENT_ID';
   ```

2. **Cek queue status**
   ```sql
   SELECT * FROM certificate_queue WHERE status = 'failed';
   ```

3. **Cek logs background processor**
   ```bash
   tail -f /tmp/cert-processor.log
   ```

### Error: Failed to download template image

- Pastikan bucket `certificate-templates` adalah **public**
- Cek RLS policies di Supabase Storage

### Posisi teks tidak sesuai

- Template width/height mungkin tidak match dengan gambar asli
- Re-upload template dan atur ulang posisi

---

## 🔐 Security

### RLS Policies

**certificate_templates:**
- Admin: Full CRUD access
- Public: No access

**certificates:**
- Admin: Full CRUD access  
- Users: Can only read their own certificates (matched by email)

**Storage:**
- `certificate-templates`: Public read, admin write
- `certificates`: Public read, service role write

### Data Privacy

- Sertifikat hanya bisa diakses dengan kode tiket yang valid
- No indexing by search engines (`noindex` meta tag)
- Link sertifikat tidak tersebar di public

---

## 📈 Performance

### Processing Time

- Template download: ~1-2 detik
- Image generation: ~2-5 detik
- Upload to storage: ~1-2 detik
- **Total per certificate: ~5-10 detik**

### Capacity

Dengan Supabase Free Tier (1GB storage):
- Template per event: ~5MB
- Generated certificate: ~2-5MB
- **Estimated capacity: 200-500 certificates**

### Optimization Tips

1. **Compress template images:**
   ```bash
   # Menggunakan imagemagick
   convert template.png -quality 85 -resize 1920x1080 template-optimized.png
   ```

2. **Cleanup old certificates:**
   Hapus sertifikat event yang sudah lama lewat untuk menghemat storage.

3. **Use CDN:**
   Supabase Storage sudah menggunakan CDN, jadi tidak perlu setup tambahan.

---

## 🚢 Production Deployment

### Checklist

- ✅ Migration sudah dijalankan
- ✅ Storage buckets sudah dibuat
- ✅ RLS policies sudah di-apply
- ✅ Template sudah diupload dan dikonfigurasi
- ✅ Background processor sudah di-setup (cron/webhook)
- ✅ Test generate sertifikat dengan data dummy

### Monitoring

Track certificate generation success rate:

```sql
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM certificates
GROUP BY status;
```

---

## 💡 Future Enhancements

Ideas untuk improvement:

1. **Email notification** ketika sertifikat ready
2. **Bulk regenerate** jika template diubah
3. **Custom fonts upload** (.ttf files)
4. **Multi-language support** untuk template
5. **Watermark** atau signature digital
6. **PDF format** selain PNG
7. **Certificate verification** via QR code di sertifikat

---

## 📞 Support

Jika ada pertanyaan atau issue:
1. Check logs: `bun run process-certificates`
2. Check Supabase Dashboard > Logs
3. Check storage permissions
4. Check database policies

---

**Happy Certificate Generating! 🎉**
