# Debug: Register Error 422

## Error yang Terjadi
```
POST https://mtaqyjyezfadfewbdlrf.supabase.co/auth/v1/signup 422 (Unprocessable Content)
```

## Kemungkinan Penyebab

### 1. Email Sudah Terdaftar
Coba dengan email yang berbeda, atau cek di Supabase Dashboard:
```
Authentication → Users → cari email yang digunakan
```

### 2. Email Confirmation Required
Cek setting di Supabase:
```
Authentication → Settings → Auth Providers → Email
- Confirm email: Enabled/Disabled?
- Jika enabled, user perlu confirm email dulu sebelum bisa login
```

### 3. Password Policy
Cek requirements:
```
Authentication → Settings → Auth Providers → Email
- Minimum password length?
- Special character requirements?
```

### 4. Rate Limiting
Terlalu banyak signup attempts dalam waktu singkat.

### 5. Email Provider Settings
Domain email mungkin di-block atau restricted.

## Quick Fix Options

### Option A: Disable Email Confirmation (untuk development)
1. Buka Supabase Dashboard
2. Authentication → Settings
3. Email Auth Provider
4. Set "Confirm email" = **Disabled**
5. Save

### Option B: Test dengan Email Berbeda
Coba test dengan:
- Gmail
- Temporary email service (untuk testing)
- Email domain yang berbeda

### Option C: Cek Error Detail
1. Buka browser DevTools (F12)
2. Tab Network
3. Cari request "signup"
4. Klik → Preview/Response
5. Lihat error message lengkap

## Testing Steps

1. **Clear browser cache dan cookies**
2. **Restart dev server** (`npm run dev`)
3. **Test dengan data:**
   - Email: test-[timestamp]@example.com (misal: test-1234567890@example.com)
   - Password: minimal 8 karakter
   - WhatsApp: 08123456789
   - Nama: Test User

4. **Lihat console log** untuk error detail

## Supabase Auth Settings to Check

```
Dashboard → Project Settings → Authentication

Rate Limits:
- How many signups per hour?

Email Settings:
- Is email confirmation required?
- Is double opt-in enabled?

Password Requirements:
- Minimum length?
- Complexity requirements?
```

## Alternative: Manual User Creation

Jika masih error, bisa create user manual via Supabase:

```sql
-- Di Supabase SQL Editor
-- (Ini bypass validation, HANYA untuk testing)

-- Tapi TIDAK RECOMMENDED karena akan skip auth.users
-- Lebih baik fix auth settings dulu
```

## Next Debug Steps

1. Coba test register dengan email baru
2. Copy error message LENGKAP dari Network tab
3. Share error detail untuk investigasi lebih lanjut
