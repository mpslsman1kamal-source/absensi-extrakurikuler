# Panduan Instalasi — SIABSENS-EKSKUL (REST API + Frontend Statis)

## === BACKEND (Google Apps Script) ===

1. Buka https://script.google.com → **Proyek Baru**.
2. Hapus isi `Code.gs` bawaan, ganti nama file jadi **Kode**, lalu paste
   seluruh isi `Kode.gs` yang diberikan terpisah di chat.
3. **Jangan jalankan `setupAppEnvironment()` lagi** kalau proyek lama Anda
   sudah pernah setup dan datanya sudah ada — itu akan membuat folder/sheet
   baru. Kode.gs ini masih memakai spreadsheet & folder Drive yang sama
   seperti sebelumnya (disimpan di Script Properties `spreadsheetId`).
   - Kalau ini instalasi **baru** (belum pernah ada data), jalankan
     `setupAppEnvironment()` sekali lewat dropdown fungsi → ▶ Run → izinkan
     akses Drive & Sheets.
4. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik **Deploy** → salin URL yang diakhiri `/exec`
5. Tes di browser: buka URL `/exec` tadi langsung. Harus muncul JSON
   `{"success":true,"message":"SIABSENS-EKSKUL SMAN 1 Kamal REST API aktif."...}`.
   Kalau ini sudah muncul, backend siap.

> Fungsi lama seperti `diagnosaLogin()`, `perbaikiLogin()`, `resetTotalDemo()`,
> `resetSandiSuperAdmin()`, `installDailyBackup()` tetap ada di kode dan tetap
> dijalankan manual dari editor Apps Script seperti sebelumnya — tidak diekspos
> lewat REST API (sengaja, demi keamanan).

## === FRONTEND (GitHub Pages) ===

1. Ekstrak ZIP frontend yang diberikan. Buka `js/config.js`, isi:
   ```js
   window.GAS_URL = 'https://script.google.com/macros/s/XXXXXXXX/exec';
   ```
   (ganti dengan URL `/exec` dari langkah Backend di atas).
2. Folder hasil ekstrak ZIP **adalah** folder yang nanti di-`git init` —
   jangan buat folder pembungkus tambahan. Pastikan `index.html` ada
   tepat di level teratas folder itu.
3. Ikuti langkah deploy ke GitHub Pages — saya akan pandu lewat chat ini
   langkah demi langkah begitu Anda siap (install Git → buat repo →
   push → aktifkan Pages).

## === TEST SETELAH DEPLOY ===

1. Buka URL GitHub Pages Anda (`https://username.github.io/nama-repo/`).
2. Coba login — kalau berhasil, berarti `fetch()` ke backend sudah nyambung.
3. Buka Chrome DevTools (F12) → tab **Network** → pastikan tidak ada error
   CORS saat login/submit presensi.
4. Kalau halaman tampil tapi tanpa styling / data tidak muncul:
   - Tanpa styling → cek folder `css/` benar-benar ikut ter-push.
   - Data tidak muncul → cek `js/config.js`, pastikan `GAS_URL` benar dan
     diakhiri `/exec`.
