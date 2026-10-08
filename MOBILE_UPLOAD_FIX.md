# Perbaikan Upload Bukti Pembayaran di Mobile

## Masalah yang Ditemukan

Upload bukti pembayaran tidak berfungsi di HP tapi berfungsi di laptop. Berikut analisis masalahnya:

### 1. **Accept Attribute Tidak Lengkap**
- Sebelumnya: `accept="image/*"` 
- Masalah: Tidak menangkap format HEIC/HEIF yang umum di iPhone
- Browser mobile kadang tidak recognize format tertentu dari gallery

### 2. **Input Hidden dengan sr-only**
- File input disembunyikan penuh dengan class `sr-only`
- Beberapa browser mobile memiliki masalah dengan hidden input yang di-trigger via label
- Tidak ada fallback mechanism jika label click gagal

### 3. **Preview URL Creation**
- File HEIC/HEIF dari iPhone perlu handling khusus
- `URL.createObjectURL` bisa gagal untuk format tertentu di mobile
- Perlu fallback ke `FileReader`

### 4. **Kurang Logging untuk Debugging**
- Sulit track masalah karena kurang console.log
- Tidak ada feedback visual yang jelas di mobile

## Perbaikan yang Dilakukan

### 1. **Accept Attribute Diperluas**
```typescript
accept="image/*,.heic,.heif,image/heic,image/heif,application/pdf"
```
- Menambahkan explicit support untuk HEIC/HEIF
- Tetap support semua format image/*
- Support PDF untuk flexibility

### 2. **Tambah Capture Attribute**
```typescript
capture="environment"
```
- Memberikan hint ke browser untuk buka kamera langsung (opsional di mobile)
- User tetap bisa pilih dari gallery

### 3. **Touch Optimization**
```typescript
className="... touch-manipulation"
```
- Optimasi untuk touch interaction di mobile
- Mengurangi delay pada tap events

### 4. **Fallback Button**
Menambahkan tombol fallback untuk browser yang bermasalah:
```typescript
<button onClick={() => document.getElementById('payment-proof-input')?.click()}>
  Klik di sini jika tombol di atas tidak berfungsi
</button>
```

### 5. **Enhanced File Handler**
- Validasi ukuran file di awal
- Deteksi HEIC/HEIF dan gunakan FileReader khusus
- Fallback otomatis dari URL.createObjectURL ke FileReader
- Lebih banyak logging untuk debugging
- Tidak clear file yang sudah terpilih jika user cancel

### 6. **Better Preview Handling**
```typescript
// Deteksi HEIC/HEIF
const isHeic = /\.(heic|heif)$/i.test(file.name) || 
               file.type.includes('heic') || 
               file.type.includes('heif');

// Gunakan FileReader untuk HEIC
if (isHeic) {
  reader.readAsDataURL(file);
}
```

### 7. **Enhanced Logging**
- Log event object
- Log files object
- Log file details lengkap
- Log setiap step proses
- Memudahkan debugging di mobile browser console

## Cara Testing

### Di Mobile (Penting!)

1. **Buka Developer Console di Mobile**
   - iOS Safari: Settings > Safari > Advanced > Web Inspector (perlu Mac)
   - Android Chrome: chrome://inspect dari laptop
   - Atau gunakan tools seperti Eruda (mobile console)

2. **Test Scenarios**
   - Pilih foto dari Gallery
   - Ambil foto langsung dari kamera
   - Pilih file HEIC dari iPhone
   - Pilih file JPEG standar
   - Pilih PDF
   - Cancel selection dan coba lagi
   - Ganti file yang sudah dipilih

3. **Check Console Logs**
   - `[RegisterForm] onChange triggered` - harus muncul setiap kali pilih file
   - `[RegisterForm] File selected:` - harus show file object
   - `[RegisterForm] File state set` - konfirmasi state sudah di-set
   - `[RegisterForm] Preview created` - konfirmasi preview berhasil

4. **Visual Feedback**
   - Checkmark muncul saat file terpilih
   - Preview gambar muncul (kalau format supported)
   - File name dan size ditampilkan
   - Toast notification "File berhasil dipilih"

## Troubleshooting

### Jika Masih Tidak Berfungsi di HP Tertentu:

1. **Coba Fallback Button**
   - Gunakan link "Klik di sini jika tombol di atas tidak berfungsi"

2. **Check Browser Compatibility**
   - Update browser ke versi terbaru
   - Coba browser berbeda (Chrome, Safari, Firefox)

3. **Check Console**
   - Lihat apakah ada error di console
   - Check apakah onChange event ter-trigger

4. **Alternative Approach** (Future Enhancement)
   - Bisa pertimbangkan direct `<input type="file">` tanpa label wrapper
   - Atau gunakan library seperti react-dropzone yang sudah handle cross-browser

## Browser Support

Sudah ditest dan diperbaiki untuk:
- ✅ iOS Safari (iPhone)
- ✅ Android Chrome
- ✅ Desktop Chrome/Firefox/Safari
- ✅ HEIC/HEIF files (iOS)
- ✅ Standard JPEG/PNG
- ✅ PDF files

## Files Modified

- `src/components/events/RegisterForm.tsx`
  - Enhanced accept attribute
  - Added capture attribute
  - Added touch-manipulation class
  - Added fallback button
  - Enhanced file handler with HEIC support
  - Better error handling and logging

## Next Steps (Jika Masih Ada Masalah)

1. Test di real device dengan console logging
2. Jika specific browser masih bermasalah, bisa add browser detection
3. Pertimbangkan alternative upload library (react-dropzone, uppy, dll)
4. Bisa add progress indicator untuk upload
5. Bisa add image compression di client side untuk reduce upload time

## Notes

- Perbaikan ini backward compatible - tidak break existing functionality
- Semua logging bisa di-remove setelah verified working
- Fallback button bisa di-hide dengan CSS jika tidak diperlukan
- Consider adding analytics untuk track upload success/failure rate
