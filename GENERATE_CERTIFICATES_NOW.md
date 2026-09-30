# 🚀 Generate Certificates - Ready to Go!

## ✅ Status Check

- ✅ Template uploaded to storage
- ✅ Template config saved to database  
- ✅ 2 participants checked in (Reva Syavira, Rudi budiman)
- ✅ Storage buckets configured properly
- ✅ RLS policies in place

**Everything is ready! Just need to execute these steps:**

---

## 📋 Step-by-Step Execution

### **Step 1: Create Certificate Records**

Jalankan di **Supabase SQL Editor**:

```sql
-- File: create-certificate-records.sql

INSERT INTO certificates (registration_id, event_id, certificate_number, status)
SELECT 
  r.id,
  r.event_id,
  UPPER((SELECT slug FROM events WHERE id = r.event_id)) || '-' || 
    LPAD((ROW_NUMBER() OVER (ORDER BY r.checked_in_at))::text, 3, '0'),
  'pending'
FROM event_registrations r
WHERE r.event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
  AND r.checked_in_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM certificates c WHERE c.registration_id = r.id
  );
```

**Expected:** `INSERT 0 2` (jika belum ada) atau `INSERT 0 0` (jika sudah ada)

---

### **Step 2: Reset Queue to Pending**

Jalankan:

```sql
-- File: reset-certificate-queue.sql

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
```

**Expected:** `UPDATE 2` untuk kedua query

---

### **Step 3: Verify Ready to Generate**

Quick check:

```sql
SELECT 
  r.name,
  c.certificate_number,
  c.status as cert_status,
  cq.status as queue_status
FROM event_registrations r
JOIN certificates c ON c.registration_id = r.id
LEFT JOIN certificate_queue cq ON cq.registration_id = r.id
WHERE r.event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
  AND r.checked_in_at IS NOT NULL;
```

**Expected output:**
```
name             | certificate_number | cert_status | queue_status
-----------------+--------------------+-------------+-------------
Reva Syavira     | EVENT-SLUG-001     | pending     | pending
Rudi budiman     | EVENT-SLUG-002     | pending     | pending
```

**If cert_status and queue_status are both 'pending' → ✅ READY!**

---

### **Step 4: Generate Certificates** 🎨

#### **Option A: Via Admin UI (Recommended)**

1. Buka browser
2. Login sebagai admin
3. Pergi ke **Admin > Daftar Hadir** 
4. Pilih event Anda
5. **Buka DevTools Console** (F12) sebelum klik
6. Klik tombol **"Generate Sertifikat (2)"**
7. **Watch console logs:**

Expected logs:
```
[Attendance] Calling generate certificates API for event: 6f4d2f11-...
[Attendance] Response status: 200
[Attendance] Response data: { success: true, processed: 2, ... }
```

8. Tunggu toast notification: **"2 sertifikat berhasil di-generate!"**

---

#### **Option B: Via API (Alternative)**

Dari terminal:

```bash
curl -X POST http://localhost:3000/api/admin/generate-certificates \
  -H "Content-Type: application/json" \
  -d '{"event_id": "6f4d2f11-325e-4dc5-a61d-cb154393e715"}'
```

**Expected response:**
```json
{
  "success": true,
  "processed": 2,
  "failed": 0,
  "total": 2,
  "message": "Generated 2 certificate(s)"
}
```

---

#### **Option C: Via Dev Server Logs**

If you're running `bun run dev`, watch the terminal for:

```
[API] Generate certificates endpoint called
[API] Event ID filter: 6f4d2f11-325e-4dc5-a61d-cb154393e715
[API] Processing 2 certificate(s)...
[API] Processing job xxx for registration yyy
[API] Found registration for Reva Syavira
[API] Found template: { url: ..., width: 1448, height: 1086 }
[API] Generating certificate for Reva Syavira...
[API] ✓ Certificate generated for Reva Syavira
[API] Processing job xxx for registration yyy
[API] Found registration for Rudi budiman
[API] ✓ Certificate generated for Rudi budiman
[API] Certificate generation completed: 2 succeeded, 0 failed
```

---

### **Step 5: Verify Success** ✅

Jalankan SQL untuk confirm:

```sql
SELECT 
  r.name,
  r.email,
  c.certificate_number,
  c.status,
  c.certificate_url,
  c.generated_at
FROM certificates c
JOIN event_registrations r ON r.id = c.registration_id
WHERE c.event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
ORDER BY c.created_at;
```

**Expected:**
- ✅ `status` = `'generated'`
- ✅ `certificate_url` = valid URL (starts with `https://`)
- ✅ `generated_at` = timestamp

---

### **Step 6: Test Certificate Download** 🎉

1. Copy salah satu `certificate_url` dari Step 5
2. Paste di browser
3. Certificate image harus muncul dengan:
   - ✅ Template background
   - ✅ Nama peserta di posisi yang benar
   - ✅ Nomor sertifikat di posisi yang benar

**Or test via peserta:**
1. Ambil `ticket_code` dari registration
2. Buka: `http://localhost:3000/sertifikat/{ticket_code}`
3. Certificate harus bisa didownload

---

## 🐛 Troubleshooting

### Error: "Certificate template not found"
**Unlikely now** karena template sudah ada, tapi jika terjadi:
- Check `template_url` masih valid
- Check storage bucket accessible
- Re-run `check-template-config.sql`

### Error: "Failed to download template image"
- Template URL might be wrong
- Check CORS settings
- Try accessing URL directly in browser

### Error: "Failed to generate certificate"
Check server logs untuk detail error:
```bash
# If using bun dev
tail -f terminal-output

# Check specific error in certificates table
SELECT error_message FROM certificates 
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715' 
  AND status = 'failed';
```

### Certificates stuck in "processing"
Reset dan retry:
```sql
UPDATE certificates 
SET status = 'pending' 
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715' 
  AND status = 'processing';

UPDATE certificate_queue 
SET status = 'pending' 
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715' 
  AND status = 'processing';
```

Then re-run generate.

---

## 📊 Monitor Generation Progress

Real-time monitoring query:

```sql
-- Run this repeatedly to watch progress
SELECT 
  'Certificates' as type,
  status,
  COUNT(*) as count
FROM certificates
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
GROUP BY status

UNION ALL

SELECT 
  'Queue' as type,
  status,
  COUNT(*) as count
FROM certificate_queue
WHERE event_id = '6f4d2f11-325e-4dc5-a61d-cb154393e715'
GROUP BY status
ORDER BY type, status;
```

**Progress indicators:**
- `pending` → `processing` → `generated` ✅
- or `pending` → `processing` → `failed` ❌

---

## 🎯 Success Criteria

All checks must pass:

- [ ] Certificate records created (Step 1)
- [ ] Queue reset to pending (Step 2)
- [ ] Verification query shows 'pending' (Step 3)
- [ ] Generate API returns success (Step 4)
- [ ] Status changed to 'generated' (Step 5)
- [ ] Certificate URLs accessible (Step 6)
- [ ] Images show correct participant names
- [ ] Images show correct certificate numbers

---

## 🎉 When All Done

You should have:
- ✅ 2 generated certificates in storage
- ✅ Accessible URLs for each certificate
- ✅ Participants can view/download their certificates
- ✅ Admin can see generation status

**Next participants** that check-in will automatically:
1. Get added to queue (via trigger)
2. Get certificate record created
3. Wait for next generate run

**Setup automation** (optional):
- Cron job: `*/5 * * * *` (every 5 minutes)
- Or manual trigger when needed
- Or webhook after check-in

---

**You're all set! Execute Step 1-6 and certificates will be generated! 🚀**
