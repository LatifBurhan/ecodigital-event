# ✅ Fixed: "Body is disturbed or locked" Error

## 🔴 Problem
Error saat klik "Generate Sertifikat":
```
Body is disturbed or locked
```

## 🔍 Root Cause
SolidStart API routes menggunakan `request.json()` yang bisa ter-consume sebelum kita akses, menyebabkan "body locked" error.

## ✅ Solution Applied

### **1. API Endpoint Updated**
File: `src/routes/api/admin/generate-certificates.ts`

**Changes:**
- ✅ Added support for **query parameters** (primary method)
- ✅ Added **request.clone()** untuk avoid body lock
- ✅ Added fallback logic jika body parsing fail
- ✅ More robust error handling

**Now supports 2 methods:**
```typescript
// Method 1: Query parameter (RECOMMENDED)
POST /api/admin/generate-certificates?event_id=xxx

// Method 2: Body (fallback)
POST /api/admin/generate-certificates
Body: { "event_id": "xxx" }
```

### **2. Frontend Updated**
File: `src/routes/admin._auth.attendance.$id.tsx`

**Changes:**
- ✅ Changed to use **query parameter** instead of body
- ✅ Simpler fetch call (no body parsing needed)

**Old:**
```typescript
fetch("/api/admin/generate-certificates", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ event_id: id }),  // ❌ Can cause body lock
});
```

**New:**
```typescript
fetch(`/api/admin/generate-certificates?event_id=${id}`, {
  method: "POST",  // ✅ event_id in URL, no body issues
  headers: { "Content-Type": "application/json" },
});
```

---

## 🚀 How to Test

### **Step 1: Restart Dev Server**

Jika dev server sedang jalan, restart untuk load changes:

```bash
# Stop existing server (Ctrl+C)
# Then start fresh
cd /Users/latif/eco-digital-event
bun run dev
```

### **Step 2: Clear Browser Cache**

Di browser (saat di page Admin):
1. Open DevTools (F12)
2. Right-click Refresh button
3. Select **"Empty Cache and Hard Reload"**

Atau:
- **Mac:** Cmd + Shift + R
- **Windows:** Ctrl + Shift + R

### **Step 3: Test Generate**

1. Login sebagai admin
2. Pergi ke **Admin > Daftar Hadir** > Select event
3. **Open Console** (F12)
4. Klik **"Generate Sertifikat (2)"**
5. **Watch logs:**

Expected:
```
[Attendance] Calling generate certificates API for event: 6f4d2f11-...
[Attendance] Response status: 200
[Attendance] Response data: { success: true, processed: 2, ... }
✅ Toast: "2 sertifikat berhasil di-generate!"
```

### **Step 4: Test via Curl (Alternative)**

```bash
# New method (query param)
curl -X POST "http://localhost:3000/api/admin/generate-certificates?event_id=6f4d2f11-325e-4dc5-a61d-cb154393e715"

# Old method (body) - should also work now with clone()
curl -X POST http://localhost:3000/api/admin/generate-certificates \
  -H "Content-Type: application/json" \
  -d '{"event_id": "6f4d2f11-325e-4dc5-a61d-cb154393e715"}'
```

---

## 📊 Verify Success

After generate, check database:

```sql
SELECT 
  r.name,
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
- ✅ `certificate_url` = valid URL
- ✅ `generated_at` = timestamp

---

## 🐛 If Still Getting Error

### Error: "Body is disturbed or locked" (still)

**Possible causes:**
1. Browser cache not cleared
2. Old code still running
3. Dev server not restarted

**Solutions:**
1. **Hard refresh:** Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. **Restart dev server completely**
3. **Check browser console** for actual error message

### Error: Different message

Share the **exact error** from:
1. Browser console
2. Server terminal logs
3. Network tab (F12 > Network > click failed request > Preview)

---

## 📝 Technical Details

### Why Query Params Instead of Body?

**Body issues in SolidStart:**
- Request body can only be read once
- Some middleware might consume body early
- Body parsing errors are hard to debug

**Query params advantages:**
- ✅ No body lock issues
- ✅ Easier to debug (visible in URL)
- ✅ Can be cached by CDN if needed
- ✅ Works with GET or POST

**Our implementation:**
```typescript
// Try query param first
let eventId = url.searchParams.get('event_id');

// Fallback to body if needed
if (!eventId) {
  const clonedRequest = request.clone(); // ← KEY: clone to avoid lock
  const body = await clonedRequest.json();
  eventId = body?.event_id;
}
```

---

## ✅ Summary

**What was fixed:**
- ✅ API endpoint now uses query params (primary)
- ✅ Added request.clone() for body parsing (fallback)
- ✅ Frontend updated to use query params
- ✅ Better error handling throughout

**What to do:**
1. Restart dev server
2. Clear browser cache
3. Try generate again
4. Should work now! 🎉

**If still issues:**
Share console logs and we'll debug further!

---

**The fix is deployed. Try now!** 🚀
