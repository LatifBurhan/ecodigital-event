# 🎯 Manual Certificate Generation Guide

## ✅ **How It Works:**

Certificate generation terintegrasi langsung di **Admin Panel** dengan **TanStack Start server functions**.

### **Architecture:**

```
Admin UI (Button Click)
    ↓
generateCertificates() [client]
    ↓
generateCertificatesServerFn() [server function]
    ↓
processPendingCertificates() [server processor]
    ↓
- Download template from storage
- Generate image with canvas
- Upload to storage
- Update database
    ↓
Success! ✅
```

---

## 🚀 **Usage:**

### **1. Admin Login**
Login dengan admin credentials: `admin@ecodigitaleventkit.id`

### **2. Go to Daftar Hadir**
```
Admin → Daftar Hadir → Select Event
```

### **3. Click Generate Button**
Klik **"Generate Sertifikat (X)"** button

Button akan muncul jika ada peserta yang:
- ✅ Sudah check-in
- ✅ Belum punya certificate

### **4. Wait for Success**
- Loading indicator muncul
- Process certificate generation (5-10 detik per certificate)
- Toast notification: "X sertifikat berhasil di-generate!"
- Certificate count updates automatically

---

## 📊 **What Happens Behind the Scenes:**

### **Step 1: Check Pending Certificates**
```sql
SELECT * FROM certificate_queue 
WHERE event_id = ? AND status = 'pending'
```

### **Step 2: For Each Pending:**
1. Fetch registration data (name, email)
2. Fetch template configuration
3. Fetch certificate record (number)

### **Step 3: Generate Image**
1. Download template from storage
2. Create canvas with template
3. Draw participant name at configured position
4. Draw certificate number at configured position
5. Export as PNG buffer

### **Step 4: Upload & Update**
1. Upload to `certificates` bucket
2. Update certificate record with URL
3. Mark status as 'generated'
4. Update queue status to 'completed'

---

## 🎨 **Prerequisites:**

Before generating certificates, ensure:

### **1. Template Uploaded ✅**
```sql
SELECT * FROM certificate_templates WHERE event_id = ?;
-- Should return 1 row with valid template_url
```

### **2. Participants Checked-In ✅**
```sql
SELECT * FROM event_registrations 
WHERE event_id = ? AND checked_in_at IS NOT NULL;
-- Should return checked-in participants
```

### **3. Certificate Records Created ✅**
```sql
SELECT * FROM certificates WHERE event_id = ?;
-- Auto-created by trigger when check-in happens
```

### **4. Queue Items Exist ✅**
```sql
SELECT * FROM certificate_queue 
WHERE event_id = ? AND status = 'pending';
-- Auto-created by trigger when check-in happens
```

---

## 🔧 **Troubleshooting:**

### **Button Not Showing?**

**Possible causes:**
- No participants checked-in yet
- All certificates already generated

**Check:**
```sql
-- Count pending certificates
SELECT COUNT(*) as pending_count
FROM event_registrations r
JOIN certificates c ON c.registration_id = r.id
WHERE r.event_id = ? 
  AND r.checked_in_at IS NOT NULL
  AND c.status = 'pending';
```

### **Generation Fails?**

**Check logs in browser console:**
```
[Attendance] Generating certificates for event: xxx
[GenerateCertificates] Called with eventId: xxx
[CertProcessor] Starting certificate processing...
[CertProcessor] Found X pending job(s)
[CertProcessor] Processing job xxx
[CertProcessor] ✓ Certificate generated for Name
```

**Common errors:**

1. **"Template not found"**
   - Upload template terlebih dahulu
   - Go to: Events → Edit → Tab Sertifikat

2. **"Failed to download template"**
   - Check template URL accessible
   - Verify storage bucket public

3. **"Failed to upload certificate"**
   - Check storage policies
   - Verify service role key in .env

### **Verify Generated Certificates:**

```sql
SELECT 
  r.name,
  c.certificate_number,
  c.status,
  c.certificate_url,
  c.generated_at
FROM certificates c
JOIN event_registrations r ON r.id = c.registration_id
WHERE c.event_id = ?
ORDER BY c.generated_at DESC;
```

Expected:
- ✅ `status` = `'generated'`
- ✅ `certificate_url` starts with `https://`
- ✅ `generated_at` has timestamp

---

## 📁 **File Structure:**

```
src/
├── lib/
│   ├── certificate-processor.server.ts  ← Server-side processing logic
│   └── generate-certificates.ts          ← Server function wrapper
└── routes/
    └── admin._auth.attendance.$id.tsx    ← UI with generate button
```

### **Key Files:**

**1. `certificate-processor.server.ts`**
- Server-only code (uses service role)
- Handles image generation
- Uploads to storage
- Updates database

**2. `generate-certificates.ts`**
- TanStack Start server function
- Type-safe API between client/server
- Called from UI button

**3. `admin._auth.attendance.$id.tsx`**
- Admin UI
- Generate button
- Status display
- Toast notifications

---

## ✅ **Production Deployment:**

### **What to Deploy:**

1. **Frontend + Backend** (as single app)
   ```bash
   # Build
   bun run build
   
   # Deploy to Cloudflare Pages
   # Or deploy to Vercel
   ```

2. **Environment Variables**
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
   ```

### **After Deploy:**

1. ✅ Admin can login
2. ✅ Go to Daftar Hadir
3. ✅ Click "Generate Sertifikat"
4. ✅ Works! Certificates generated

**No cron needed! Manual control when admin wants.**

---

## 💡 **Best Practices:**

### **When to Generate:**

1. **After Event:**
   - Wait for all participants to check-in
   - Generate all certificates at once
   - Efficient batch processing

2. **During Event:**
   - Generate in batches (every hour)
   - Or after each session
   - Immediate certificates for early leavers

3. **On-Demand:**
   - Participant requests certificate
   - Admin generates instantly
   - Personal service

### **Monitoring:**

Check generation status dashboard:
```sql
SELECT 
  e.title as event_name,
  COUNT(DISTINCT r.id) FILTER (WHERE r.checked_in_at IS NOT NULL) as checked_in,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'generated') as generated,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'pending') as pending,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'failed') as failed
FROM events e
LEFT JOIN event_registrations r ON r.event_id = e.id
LEFT JOIN certificates c ON c.registration_id = r.id
GROUP BY e.id, e.title
ORDER BY e.start_date DESC;
```

---

## 🎉 **Result:**

After clicking "Generate Sertifikat":

**Admin sees:**
- ✅ Loading indicator
- ✅ Progress in console
- ✅ Success toast notification
- ✅ Certificate count updates
- ✅ Participants can download

**Participants get:**
- ✅ Certificate accessible via ticket URL
- ✅ Download link on `/sertifikat/TICKET_CODE`
- ✅ Beautiful certificate with their name

**Database shows:**
- ✅ `certificates.status` = `'generated'`
- ✅ `certificate_url` populated
- ✅ `generated_at` timestamp
- ✅ `certificate_queue.status` = `'completed'`

---

## 📞 **Support:**

**If generation fails:**
1. Check browser console for errors
2. Verify template uploaded
3. Check database with SQL queries above
4. Verify storage permissions
5. Check service role key in .env

**Files to check:**
- `src/lib/certificate-processor.server.ts` - Processing logic
- `src/lib/generate-certificates.ts` - Server function
- `src/routes/admin._auth.attendance.$id.tsx` - UI

**Database to check:**
- `certificate_templates` - Template exists?
- `certificate_queue` - Pending jobs?
- `certificates` - Records created?
- `event_registrations` - Participants checked-in?

---

**Simple, manual, and works!** 🚀
