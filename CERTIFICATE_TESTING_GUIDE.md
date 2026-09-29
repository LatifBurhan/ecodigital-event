# 🧪 Certificate System Testing Guide

## Manual Testing Checklist

### Phase 1: Template Upload & Configuration

**Test 1: Upload Template**
- [ ] Login sebagai admin
- [ ] Buka Events > pilih event > Edit > tab Sertifikat
- [ ] Upload gambar PNG (< 5MB)
- [ ] Pastikan preview muncul

**Test 2: Position Configuration**
- [ ] Klik "Atur Posisi Nama"
- [ ] Klik di canvas untuk set posisi
- [ ] Verify red crosshair muncul di posisi yang diklik
- [ ] Klik "Atur Posisi Nomor"
- [ ] Klik di canvas untuk set posisi
- [ ] Verify blue crosshair muncul

**Test 3: Font Configuration**
- [ ] Ubah font size untuk nama (coba 48, 60, 72)
- [ ] Ubah warna font (coba hitam, putih, biru)
- [ ] Ubah alignment (left, center, right)
- [ ] Preview update setiap perubahan

**Test 4: Save Configuration**
- [ ] Klik "Simpan Konfigurasi"
- [ ] Refresh page
- [ ] Verify konfigurasi tersimpan

---

### Phase 2: Certificate Generation Trigger

**Test 5: Check-in Triggers Queue**

Option A: Via QR Scan
```
1. Scan QR peserta yang sudah approved
2. Check database:
   SELECT * FROM certificate_queue WHERE status = 'pending';
3. Should see 1 row
```

Option B: Manual Database Update
```sql
-- Set checked_in_at for a registration
UPDATE event_registrations 
SET checked_in_at = NOW() 
WHERE id = 'REGISTRATION_ID';

-- Check queue
SELECT * FROM certificate_queue WHERE status = 'pending';
```

**Test 6: Verify Certificate Record Created**
```sql
SELECT * FROM certificates 
WHERE registration_id = 'REGISTRATION_ID';
```

Expected: 1 row with status = 'pending'

---

### Phase 3: Background Processing

**Test 7: Manual Process**
```bash
bun run process-certificates
```

Expected output:
```
[Certificate Processor] Checking for pending jobs...
[Certificate Processor] Processing job abc-123...
[Certificate Processor] Generating certificate for John Doe
[Certificate Processor] Certificate generated, uploading...
[Certificate Processor] Certificate uploaded: https://...
[Certificate Processor] ✅ Job completed successfully
```

**Test 8: Verify Generated Certificate**
```sql
SELECT 
  c.certificate_number,
  c.status,
  c.certificate_url,
  r.name
FROM certificates c
JOIN event_registrations r ON r.id = c.registration_id
WHERE c.status = 'generated';
```

Expected:
- status = 'generated'
- certificate_url is not null
- File exists at URL

**Test 9: Check Image Quality**
- [ ] Open certificate_url in browser
- [ ] Verify text readable
- [ ] Verify positions correct
- [ ] Verify colors correct

---

### Phase 4: Participant Access

**Test 10: Access via Ticket Page**
```
1. Go to /tiket/TICKET_CODE
2. Should see "Lihat Sertifikat Saya" button
3. Click button
4. Should redirect to /sertifikat/TICKET_CODE
```

**Test 11: Access via Certificate Search**
```
1. Go to /sertifikat
2. Enter ticket code
3. Click "Cari Sertifikat"
4. Should show certificate list
```

**Test 12: Certificate Display**
- [ ] Event title shown
- [ ] Participant name shown
- [ ] Certificate number shown
- [ ] Status badge correct
- [ ] Download button appears (if status = generated)

**Test 13: Download Certificate**
- [ ] Click "Download Sertifikat"
- [ ] File downloads successfully
- [ ] Open PNG file
- [ ] Verify all text correct

---

### Phase 5: Error Handling

**Test 14: Missing Template**
```sql
-- Delete template
DELETE FROM certificate_templates WHERE event_id = 'EVENT_ID';

-- Try to generate
-- Expected: No queue item created on check-in
```

**Test 15: Invalid Template URL**
```sql
UPDATE certificate_templates 
SET template_url = 'https://invalid-url.com/missing.png'
WHERE event_id = 'EVENT_ID';

-- Run processor
-- Expected: status = 'failed' after 3 retries
```

**Test 16: Participant Not Checked In**
```
1. Go to /sertifikat/TICKET_CODE (not checked in)
2. Expected: "Tidak ada sertifikat"
```

---

### Phase 6: Edge Cases

**Test 17: Multiple Events**
```
1. Create 2 events with different templates
2. Check-in peserta for both events
3. Run processor
4. Verify each gets correct template
```

**Test 18: Special Characters in Name**
```
Test with names:
- "José García"
- "北京"
- "Test & Co."
- "O'Brien"

Verify all render correctly
```

**Test 19: Long Names**
```
Test with:
- 3 words name: "Muhammad Abdullah Rahman"
- Very long: "Raden Roro Siti Aminah Binti Abdul Rahman Al-Farisi"

Verify text doesn't overflow
```

**Test 20: Concurrent Processing**
```bash
# Check-in 10 peserta
# Run processor multiple times simultaneously
bun run process-certificates & 
bun run process-certificates &

# Check no duplicates created
SELECT certificate_number, COUNT(*) 
FROM certificates 
GROUP BY certificate_number 
HAVING COUNT(*) > 1;
```

---

### Phase 7: Cascade Delete

**Test 21: Delete Event**
```sql
-- Count certificates before
SELECT COUNT(*) FROM certificates WHERE event_id = 'EVENT_ID';

-- Delete event
DELETE FROM events WHERE id = 'EVENT_ID';

-- Verify cascade
SELECT COUNT(*) FROM certificates WHERE event_id = 'EVENT_ID';
-- Should be 0

SELECT COUNT(*) FROM certificate_templates WHERE event_id = 'EVENT_ID';
-- Should be 0

SELECT COUNT(*) FROM certificate_queue WHERE event_id = 'EVENT_ID';
-- Should be 0
```

---

## Performance Testing

**Test 22: Generation Speed**
```bash
# Time single generation
time bun run process-certificates
```

Expected: 5-10 seconds per certificate

**Test 23: Bulk Processing**
```bash
# Check in 50 peserta
# Run processor
# Measure total time
```

Expected: ~5-10 minutes for 50 certificates

---

## Production Readiness Checklist

- [ ] All migrations applied
- [ ] Storage buckets created and public
- [ ] RLS policies verified
- [ ] Service role key in .env
- [ ] Template uploaded for all events
- [ ] Background processor scheduled (cron/webhook)
- [ ] Test generation successful
- [ ] Download links work
- [ ] Mobile responsive
- [ ] Error messages clear

---

## Rollback Plan

If something goes wrong in production:

```sql
-- 1. Stop background processor

-- 2. Check failed jobs
SELECT * FROM certificate_queue WHERE status = 'failed';
SELECT * FROM certificates WHERE status = 'failed';

-- 3. Reset to pending for retry
UPDATE certificate_queue SET status = 'pending' WHERE status = 'failed';
UPDATE certificates SET status = 'pending' WHERE status = 'failed';

-- 4. Or clean up completely
DELETE FROM certificate_queue WHERE event_id = 'EVENT_ID';
DELETE FROM certificates WHERE event_id = 'EVENT_ID';

-- 5. Re-configure template and try again
```

---

## Success Criteria

✅ Certificate system is ready when:
1. Template upload works smoothly
2. Position configuration is intuitive
3. Generation completes within 10 seconds
4. Downloaded certificates look professional
5. Participant can access without login
6. No duplicate certificates created
7. Cascade delete works correctly
8. Error messages are helpful

---

**Happy Testing! 🎉**
