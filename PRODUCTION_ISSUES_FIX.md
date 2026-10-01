# Fix Production Issues - Profil & Upload Bukti Pembayaran

## 🔴 MASALAH YANG DILAPORKAN

1. **"Profil tidak ditemukan"** saat pendaftaran di production
2. **Tidak bisa upload bukti pembayaran** dari HP

---

## 🔍 ROOT CAUSE ANALYSIS

### Masalah 1: Profil Tidak Ditemukan
**Penyebab:**
- Database trigger `handle_new_user()` tidak berjalan dengan sempurna untuk semua user
- Ada user yang berhasil signup di `auth.users` tapi tidak punya record di `profiles` table
- Constraint `unique` pada kolom `whatsapp` menyebabkan trigger gagal untuk user dengan nomor WA duplikat

**Dampak:**
- User tidak bisa register event karena sistem memerlukan data profile
- RegisterForm menampilkan error "Profil Tidak Ditemukan"

### Masalah 2: Upload Bukti Pembayaran Gagal di HP
**Penyebab:**
- File dari HP (terutama iPhone) menggunakan format HEIC/HEIF dengan MIME type yang tidak standar
- Storage policy untuk bucket `payment-proofs` mungkin terlalu ketat
- Beberapa HP memberikan MIME type `application/octet-stream` untuk gambar

**Dampak:**
- User tidak bisa menyelesaikan pendaftaran event berbayar
- File terpilih tapi gagal saat upload

---

## ✅ SOLUSI

### Migration File Baru
File: `supabase/migrations/20250201000000_fix_profile_and_storage.sql`

**Apa yang diperbaiki:**

#### 1. Profile System
- ✅ Membuat kolom `whatsapp` nullable (opsional)
- ✅ Menghapus constraint unique pada `whatsapp`, diganti dengan partial unique index
- ✅ Membersihkan data duplicate whatsapp
- ✅ Memperbaiki trigger `handle_new_user()` dengan error handling yang lebih baik
- ✅ **CRITICAL:** Membuat profile untuk SEMUA user existing yang belum punya profile

#### 2. Storage Policy
- ✅ Membuat policy upload yang lebih permisif (`TO public`)
- ✅ Membolehkan anonymous dan authenticated users untuk upload
- ✅ Support semua jenis file dari HP (HEIC, HEIF, berbagai MIME types)

---

## 📋 CARA APPLY FIX

### Option 1: Via Supabase Dashboard (RECOMMENDED)

1. **Buka Supabase Dashboard**
   - Login ke https://supabase.com/dashboard
   - Pilih project production Anda

2. **Jalankan Migration**
   ```bash
   # Di terminal local
   cd /Users/latif/eco-digital-event
   
   # Push migration ke production
   supabase db push
   ```

3. **Atau Manual via SQL Editor:**
   - Buka **SQL Editor** di Supabase Dashboard
   - Copy-paste isi file `supabase/migrations/20250201000000_fix_profile_and_storage.sql`
   - Klik **Run**

### Option 2: Via Supabase CLI

```bash
# Link ke production (kalau belum)
supabase link --project-ref <your-project-ref>

# Push migration ke production
supabase db push

# Verifikasi
supabase db diff
```

---

## 🧪 VERIFIKASI SETELAH FIX

### 1. Cek Semua User Punya Profile

Jalankan query ini di SQL Editor:

```sql
-- Harus return 0 users_without_profiles
SELECT 
  COUNT(*) as total_users,
  COUNT(p.id) as users_with_profiles,
  COUNT(*) - COUNT(p.id) as users_without_profiles
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id;
```

**Expected Result:**
- `users_without_profiles` = **0**

### 2. Cek Storage Policy

```sql
-- Harus ada policy "Public upload payment proof"
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%payment%';
```

**Expected Result:**
- Ada policy `"Public upload payment proof"` dengan `cmd = 'INSERT'` dan `roles = {public}`

### 3. Test Upload dari HP

1. Buka website di HP
2. Login/daftar akun baru
3. Pilih event berbayar
4. Coba upload foto dari gallery HP
5. **Harus berhasil** tanpa error

### 4. Test Registrasi User Baru

1. Daftar akun baru
2. Cek apakah langsung bisa register event (tidak ada error "Profil tidak ditemukan")

---

## 🚨 FALLBACK - Jika Masih Ada Masalah

### Jika User Tertentu Masih Tidak Punya Profile

Jalankan query manual untuk create profile:

```sql
-- Ganti <user_id> dengan ID user yang bermasalah
INSERT INTO public.profiles (id, full_name, email, whatsapp)
SELECT 
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    split_part(u.email, '@', 1),
    'User'
  ),
  u.email,
  NULL -- Akan diisi nanti saat user update profile
FROM auth.users u
WHERE u.id = '<user_id>'
ON CONFLICT (id) DO NOTHING;
```

### Jika Upload Masih Gagal di HP

1. **Cek Browser Console** di HP (gunakan remote debugging)
2. **Cek Supabase Logs** untuk melihat error detail
3. **Cek File Size** - mungkin terlalu besar (>10MB)

---

## 📱 TESTING CHECKLIST

Setelah apply fix, test scenario berikut:

- [ ] User baru signup → langsung punya profile
- [ ] User lama yang belum punya profile → sekarang punya profile
- [ ] Upload foto dari iPhone → berhasil
- [ ] Upload foto dari Android → berhasil
- [ ] Upload foto format HEIC → berhasil
- [ ] Upload foto format JPG/PNG → berhasil
- [ ] Upload PDF → berhasil
- [ ] Pendaftaran event gratis → berhasil
- [ ] Pendaftaran event berbayar → berhasil dengan bukti pembayaran

---

## 🔧 MONITORING

### Query untuk Monitor Profile Issues

```sql
-- User tanpa profile (should be 0)
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;
```

### Query untuk Monitor Upload Issues

```sql
-- Registrations without proof (untuk event berbayar)
SELECT 
  er.id,
  er.email,
  er.created_at,
  e.title as event_title,
  e.is_paid,
  er.payment_proof_path
FROM event_registrations er
JOIN events e ON e.id = er.event_id
WHERE e.is_paid = true 
  AND er.payment_proof_path IS NULL
  AND er.created_at > NOW() - INTERVAL '1 day'
ORDER BY er.created_at DESC;
```

---

## 📞 JIKA MASIH BERMASALAH

Jika setelah apply fix masih ada masalah:

1. **Screenshot error message** (dari browser console dan UI)
2. **Cek Supabase logs** di Dashboard → Logs → Database / Storage
3. **Kirim informasi:**
   - User email yang bermasalah
   - Event yang dicoba register
   - Device dan browser yang dipakai
   - Screenshot error

---

## 📝 NOTES PENTING

1. **Backup Database** sebelum apply migration (Supabase otomatis backup, tapi lebih baik double check)
2. **Test di Staging** dulu kalau ada (optional, tapi recommended)
3. **Monitor Supabase Dashboard** selama 30 menit setelah deploy untuk cek anomali
4. **Announce Downtime** ke users kalau perlu (migrasi ini harusnya instant, tapi lebih baik inform users)

---

## ✨ IMPROVEMENT LAINNYA

Migration ini juga include improvement:

- Normalisasi format WhatsApp (08xxx → 62xxx)
- Better error handling di trigger
- Partial unique index untuk performa
- Support NULL whatsapp (user bisa isi nanti)
- More permissive storage policy tanpa security risk

---

**Created:** 2026-02-01  
**Status:** Ready to Deploy  
**Priority:** 🔴 HIGH - Production Issue
