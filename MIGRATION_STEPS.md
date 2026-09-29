# Migration Steps - Fix "Profil Tidak Ditemukan" Bug

## Masalah
User yang sudah register mengalami error "Profil Tidak Ditemukan" saat mencoba daftar event karena:
1. RLS Policy tidak mengizinkan user untuk INSERT profil sendiri
2. Database trigger `handle_new_user()` kadang gagal
3. Tidak ada fallback mechanism yang robust

## Solusi yang Diimplementasikan

### 1. Database Migration (WAJIB DIJALANKAN)
File: `drizzle/migrations/0003_fix_profiles_rls_policy.sql`

**Cara Apply Migration:**

#### Opsi A: Via Supabase Dashboard (Recommended)
1. Buka [Supabase Dashboard](https://supabase.com/dashboard/project/mtaqyjyezfadfewbdlrf)
2. Klik **SQL Editor** di menu kiri
3. Klik **New Query**
4. Copy-paste isi file `apply-migration.sql`
5. Klik **Run** atau tekan `Ctrl/Cmd + Enter`
6. Verifikasi dengan query di bagian bawah file

#### Opsi B: Via Supabase CLI (jika sudah setup)
```bash
# Push migration ke database
npx supabase db push

# Atau apply manual
psql $DATABASE_URL < drizzle/migrations/0003_fix_profiles_rls_policy.sql
```

### 2. Code Changes (SUDAH SELESAI)

#### a. New Hook: `src/hooks/use-ensure-profile.ts`
- Automatically check dan create profil saat user login
- Retry mechanism dengan proper error handling
- Menggunakan user metadata untuk create profil

#### b. Updated: `src/components/events/RegisterForm.tsx`
- Menggunakan `useEnsureProfile` hook
- Menghapus duplicate logic
- Better loading states dan error messages
- Tombol "Daftar Ulang" jika profil gagal dibuat

#### c. Updated: `src/routes/register.tsx`
- Retry mechanism (3x attempts) untuk create profil
- Delay 500ms untuk memberi waktu database trigger
- Better error logging dan user feedback

## Testing Checklist

### Test 1: User Baru (Fresh Registration)
- [ ] Buka `/register`
- [ ] Isi form dengan:
  - Nama: Test User 1
  - Email: test1@example.com
  - WhatsApp: 081234567890
  - Password: test123
- [ ] Klik "Daftar Akun"
- [ ] Verifikasi redirect ke homepage
- [ ] Buka halaman event dan klik "Daftar"
- [ ] **Seharusnya TIDAK** muncul error "Profil Tidak Ditemukan"

### Test 2: User Lama (Existing User Without Profile)
- [ ] Login dengan akun lama yang tidak punya profil
- [ ] Buka halaman event
- [ ] `useEnsureProfile` akan otomatis create profil jika ada metadata
- [ ] Jika tidak ada metadata, tampilkan pesan error dengan tombol "Daftar Ulang"

### Test 3: Pendaftaran Event
- [ ] Login sebagai user dengan profil
- [ ] Buka halaman event (misal: `/events/workshop-react`)
- [ ] Klik tombol "Daftar"
- [ ] Isi form pendaftaran (jika event berbayar)
- [ ] Submit form
- [ ] **Seharusnya BERHASIL** dan redirect ke halaman tiket

### Test 4: Database Verification
Cek di Supabase SQL Editor:

```sql
-- Cek RLS policies untuk tabel profiles
SELECT policyname, permissive, roles, cmd, with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- Expected: ada policy "Users can insert own profile" untuk INSERT

-- Cek jumlah users vs profiles
SELECT 
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM public.profiles) as total_profiles;

-- Seharusnya jumlahnya sama atau profiles >= users
```

## Rollback (Jika Ada Masalah)

Jika perlu rollback migration:

```sql
-- Remove the INSERT policy
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Revoke INSERT permission
REVOKE INSERT ON public.profiles FROM authenticated;
```

## Monitoring

Setelah deploy, monitor:
1. Error logs di browser console (search: `[useEnsureProfile]` atau `[RegisterForm]`)
2. Supabase logs untuk error dari function `register_for_event`
3. Toast notifications untuk user feedback

## Next Steps

1. **APPLY MIGRATION** ke database Supabase (CRITICAL!)
2. Build dan deploy aplikasi: `npm run build`
3. Test dengan akun baru
4. Monitor untuk 24-48 jam
5. Jika sukses, buat backfill script untuk user lama yang belum punya profil

## Files Modified

- ✅ `drizzle/migrations/0003_fix_profiles_rls_policy.sql` - New migration
- ✅ `src/hooks/use-ensure-profile.ts` - New hook
- ✅ `src/components/events/RegisterForm.tsx` - Updated
- ✅ `src/routes/register.tsx` - Updated
- ✅ `apply-migration.sql` - Helper script
- ✅ `MIGRATION_STEPS.md` - This file
