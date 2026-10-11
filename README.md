# SIABSENS-EKSKUL — Frontend (Statis)

Frontend ini hasil migrasi dari Google Apps Script (HtmlService + iframe) ke
arsitektur frontend statis + backend GAS sebagai REST API murni.

## Sebelum deploy

1. Deploy backend `Kode.gs` dulu sebagai Web App di Google Apps Script
   (lihat PANDUAN-INSTALASI.md), lalu salin URL `/exec`-nya.
2. Buka `js/config.js`, isi `window.GAS_URL` dengan URL tersebut.
3. Baru push folder ini ke GitHub Pages.

## Struktur

```
index.html
css/style.css
js/config.js   ← isi GAS_URL di sini
js/app.js
```

Jangan ubah struktur folder ini — `index.html` harus tetap ada di root
repository GitHub agar GitHub Pages tidak 404.
