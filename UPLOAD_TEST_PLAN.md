# 🧪 Test Plan: Universal Mobile Upload

## 📋 Pre-Testing Checklist

- [ ] Deploy ke staging/production
- [ ] Clear browser cache
- [ ] Test dengan browser normal mode
- [ ] Test dengan browser private/incognito mode
- [ ] Siapkan berbagai file format untuk testing

---

## 📱 Test Devices & Browsers

### Priority 1: Most Common (MUST TEST)
- [ ] **iPhone (iOS Safari)** - iOS 15+
- [ ] **Android (Chrome)** - Latest version
- [ ] **Android (Samsung Internet)** - For Samsung users

### Priority 2: Common Alternatives
- [ ] **iPhone (Chrome iOS)**
- [ ] **Android (Firefox)**
- [ ] **Android (Opera)**

### Priority 3: Edge Cases
- [ ] **Older iOS** (iOS 13-14)
- [ ] **Older Android** (Android 9-10)
- [ ] **UC Browser**
- [ ] **Mi Browser** (Xiaomi devices)
- [ ] **In-app browsers** (WhatsApp, Instagram, Facebook, LINE)

---

## 🎯 Test Scenarios

### Test Case 1: Layer 1 (Styled Label) - Happy Path
**Expected:** File picker opens, user dapat select file

**Steps:**
1. Buka halaman event registration
2. Scroll ke bagian "Bukti pembayaran"
3. **TAP pada box besar dengan icon Upload** (styled area)
4. File picker harus terbuka
5. Select file dari gallery/camera
6. File harus muncul selected dengan checkmark ✓

**Success Criteria:**
- [ ] File picker opens on first tap
- [ ] Selected file shows dengan preview (kalau image)
- [ ] Toast notification: "File [name] berhasil dipilih"
- [ ] Checkmark icon appears
- [ ] File name dan size ditampilkan
- [ ] Console shows: `[RegisterForm] File selected:`

---

### Test Case 2: Layer 2 (Native Input) - Fallback
**Expected:** Native browser input works sebagai backup

**Steps:**
1. Buka halaman event registration
2. Scroll ke bagian "Bukti pembayaran"
3. **JANGAN tap styled box**, langsung ke bawah
4. See text: "Atau gunakan tombol native browser:"
5. **CLICK/TAP pada native input** `[Choose File]`
6. File picker harus terbuka
7. Select file
8. File harus muncul selected

**Success Criteria:**
- [ ] Native input visible
- [ ] File picker opens on native input tap
- [ ] File selected successfully
- [ ] Same feedback as Layer 1 (toast, preview, etc)

**Note:** Test ini untuk verify bahwa Layer 2 work independently

---

### Test Case 3: Layer 3 (Button Fallback) - Ultimate Backup
**Expected:** Button trigger works sebagai last resort

**Steps:**
1. Buka halaman event registration
2. Scroll ke "Bukti pembayaran"
3. **CLICK button "Pilih File (Fallback)"**
4. File picker harus terbuka
5. Select file
6. File harus muncul selected

**Success Criteria:**
- [ ] Button visible dan clickable
- [ ] Button triggers file picker
- [ ] File selected successfully
- [ ] Same feedback as other layers

---

### Test Case 4: File Format Compatibility
**Expected:** Semua format yang di-support bisa di-upload

**Test Files:**
- [ ] **JPEG** dari camera (standard)
- [ ] **PNG** screenshot
- [ ] **HEIC** dari iPhone camera (iPhone only)
- [ ] **GIF** image
- [ ] **WebP** image
- [ ] **PDF** document
- [ ] **Large file** (8MB) - should work
- [ ] **Too large file** (12MB) - should reject dengan toast error

**Success Criteria:**
- [ ] All supported formats accepted
- [ ] Preview shows untuk images
- [ ] PDF shows file info (no preview expected)
- [ ] HEIC handled correctly (no errors)
- [ ] Large file warning works
- [ ] Upload succeeds di submit

---

### Test Case 5: Camera Capture (Mobile Only)
**Expected:** Direct camera capture works

**Steps:**
1. Tap upload area atau native input
2. Select "Camera" / "Take Photo" option (if appears)
3. Take photo dengan camera
4. Confirm photo
5. Photo should be selected

**Success Criteria:**
- [ ] Camera opens (device dependent)
- [ ] Can take photo
- [ ] Photo selected successfully
- [ ] Preview shows

**Note:** Not all browsers show camera option by default

---

### Test Case 6: Cancel Behavior
**Expected:** Cancel tidak clear existing file

**Steps:**
1. Select a file (any method)
2. File is selected ✓
3. Tap upload area lagi (untuk change file)
4. File picker opens
5. **CANCEL** (don't select new file)
6. Original file should still be selected

**Success Criteria:**
- [ ] Cancel doesn't clear the file
- [ ] Original file still shown
- [ ] Can submit dengan original file

---

### Test Case 7: Replace File
**Expected:** Can replace file after selection

**Steps:**
1. Select file A
2. File A selected ✓
3. Tap upload area again
4. Select file B
5. File B should replace A

**Success Criteria:**
- [ ] Can open picker again
- [ ] New file replaces old file
- [ ] Preview updates
- [ ] Old preview URL cleaned up (memory)

---

### Test Case 8: Form Validation
**Expected:** Cannot submit without file (paid events)

**Steps:**
1. Fill other fields (payment method)
2. **DON'T** select file
3. Click "Daftar sekarang"
4. Should show error

**Success Criteria:**
- [ ] Error: "Unggah bukti pembayaran"
- [ ] Form doesn't submit
- [ ] Error shown in red
- [ ] Can still select file and retry

---

### Test Case 9: End-to-End Registration
**Expected:** Complete registration with uploaded file

**Steps:**
1. Login/register
2. Go to event page
3. Click "Daftar"
4. Select payment method
5. Upload bukti pembayaran (test any layer)
6. Click "Daftar sekarang"
7. Wait for upload + registration
8. Should redirect to ticket page

**Success Criteria:**
- [ ] File uploads successfully
- [ ] Registration completes
- [ ] Redirects to ticket page
- [ ] Ticket shows pending verification
- [ ] No errors in console

---

### Test Case 10: Private/Incognito Mode
**Expected:** Works in private browsing mode

**Steps:**
1. Open browser in private/incognito mode
2. Navigate to event registration
3. Login
4. Try upload dengan semua 3 layers
5. Complete registration

**Success Criteria:**
- [ ] All layers work
- [ ] No permission errors
- [ ] Upload succeeds
- [ ] Registration completes

---

### Test Case 11: In-App Browser
**Expected:** Works in WhatsApp/Instagram/etc browsers

**Test In:**
- [ ] WhatsApp browser (share link via WA, open there)
- [ ] Instagram browser (bio link)
- [ ] Facebook browser
- [ ] LINE browser
- [ ] Twitter browser

**Success Criteria:**
- [ ] At least Layer 2 (native input) works
- [ ] Can complete registration
- [ ] No CORS or security errors

---

### Test Case 12: Slow Network
**Expected:** Graceful handling of slow upload

**Steps:**
1. Enable slow 3G in DevTools (or actual slow network)
2. Select large file (5-8MB)
3. Submit form
4. Observe upload progress

**Success Criteria:**
- [ ] Loading state shown
- [ ] Button disabled during upload
- [ ] No timeout errors (wait reasonable time)
- [ ] Eventually completes or shows error

---

### Test Case 13: Console Logging
**Expected:** Helpful logs for debugging

**Steps:**
1. Open browser console (if possible on mobile)
2. Perform any upload action
3. Check console logs

**Expected Logs:**
```
[RegisterForm] Label clicked
[RegisterForm] File input clicked  
[RegisterForm] onChange triggered
[RegisterForm] Files object: FileList {...}
[RegisterForm] File selected: File {...}
[RegisterForm] File details: {name, type, size, ...}
[RegisterForm] File state set
[RegisterForm] Preview created with ...
[RegisterForm] Uploading proof: {...}
[RegisterForm] Upload success: ...
```

**Success Criteria:**
- [ ] Logs appear di console
- [ ] Logs show correct information
- [ ] No error logs (red)
- [ ] Helps understand flow

---

## 🐛 Known Issues & Solutions

### Issue: Layer 1 tidak trigger di [specific browser]
**Solution:** User dapat gunakan Layer 2 (native input)
**Status:** Expected behavior, that's why we have fallbacks

### Issue: HEIC tidak show preview
**Solution:** File still selected, preview just not shown
**Status:** Some browsers can't render HEIC, tapi file tetap ter-upload

### Issue: Camera tidak appear as option
**Solution:** Browser/device dependent, user pilih dari gallery
**Status:** Expected behavior

---

## 📊 Test Results Template

### Device: [iPhone 13, iOS 16.2, Safari]
### Date: [DD/MM/YYYY]

| Test Case | Layer 1 | Layer 2 | Layer 3 | Notes |
|-----------|---------|---------|---------|-------|
| TC1: Styled Label | ✅ | - | - | Works perfectly |
| TC2: Native Input | - | ✅ | - | Also works |
| TC3: Button Fallback | - | - | ✅ | Triggers correctly |
| TC4: JPEG | ✅ | ✅ | - | Both work |
| TC4: HEIC | ✅ | ✅ | - | No preview but uploads |
| TC4: PDF | ✅ | ✅ | - | File info shown |
| TC5: Camera | ⚠️ | - | - | No camera option shown |
| TC6: Cancel | ✅ | - | - | Keeps existing file |
| TC7: Replace | ✅ | - | - | Replaces correctly |
| TC8: Validation | ✅ | - | - | Error shown |
| TC9: E2E | ✅ | - | - | Complete success |
| TC10: Incognito | ✅ | ✅ | - | Both work |
| TC11: WhatsApp | ❌ | ✅ | ✅ | Layer 1 fails, others work |
| TC12: Slow Network | ✅ | - | - | Takes time but works |
| TC13: Logging | ✅ | - | - | All logs present |

**Overall Result:** ✅ PASS (all critical paths work)

---

## ✅ Success Criteria (Overall)

### Must Have:
- [ ] **At least ONE layer works di setiap browser tested**
- [ ] **Layer 2 (native input) works di 100% browsers** ⭐
- [ ] All supported file formats upload successfully
- [ ] End-to-end registration completes
- [ ] No critical errors in console

### Nice to Have:
- [ ] Layer 1 works di 90%+ browsers
- [ ] Camera capture works where supported
- [ ] Fast upload speed
- [ ] Preview works untuk semua images

### Deal Breaker:
- ❌ Tidak ada cara untuk upload di specific browser
- ❌ Upload succeeds tapi file corrupt
- ❌ Critical errors yang block registration

---

## 🎯 Sign-Off Checklist

Before declaring success:

- [ ] Tested di minimal 5 different devices
- [ ] Tested di minimal 8 different browsers
- [ ] At least Layer 2 works di SEMUA browsers tested
- [ ] HEIC dari iPhone works
- [ ] In-app browsers tested (minimal WhatsApp)
- [ ] End-to-end registration succeeds
- [ ] No critical bugs found
- [ ] Documentation updated
- [ ] Team aware of known limitations

**Tester Name:** _________________

**Sign-Off Date:** _________________

**Status:** ⬜ PASS  ⬜ FAIL (with issues list)

---

## 📝 Bug Report Template

Jika menemukan issue:

```
**Browser:** [e.g., Samsung Internet 18.0]
**Device:** [e.g., Samsung Galaxy S21, Android 12]
**Layer Tested:** [1/2/3]
**File Type:** [JPEG/HEIC/PDF]
**File Size:** [e.g., 2.5MB]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**


**Actual Behavior:**


**Console Errors:**


**Screenshots:**
(attach if possible)

**Workaround:**
(did other layers work?)

**Priority:** 🔴 High / 🟡 Medium / 🟢 Low
```

---

## 🚀 Next Steps After Testing

### If All Tests Pass:
1. Remove excessive console.logs (keep critical ones)
2. Monitor analytics for upload success rate
3. Gather user feedback
4. Document which browsers users actually use

### If Some Tests Fail:
1. Document which layers work
2. Check if Layer 2 always works (should be 100%)
3. Consider browser-specific hacks only if necessary
4. Update documentation dengan known limitations

### Future Enhancements:
1. Add drag & drop support
2. Add image compression before upload
3. Add upload progress bar
4. Add analytics tracking
5. Consider professional upload library if needed
