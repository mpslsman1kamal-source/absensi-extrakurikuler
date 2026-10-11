/**
 * ============================================================================
 * SIABSENS-EKSKUL — Frontend (JavaScript.html)
 * SPA murni: seluruh halaman dirender di sisi klien dari data hasil getBootstrap().
 * Navigasi = 0 ms (tanpa google.script.run). Penulisan memakai optimistic UI +
 * sinkronisasi latar belakang. Tidak ada window.location / window.open.
 * ============================================================================
 */
'use strict';

// ---------------- BAGIAN 1: STATE & UTIL ----------------
const ROLE = { SUPER: 'Super Admin', ADMIN: 'Admin', PEMBINA: 'Pembina' };
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const STATUS = ['Hadir', 'Sakit', 'Izin', 'Alpa'];
const SKEY = { Hadir: 'H', Sakit: 'S', Izin: 'I', Alpa: 'A' };

const S = {
  token: null, user: null, cfg: {}, today: '', kelas: [], pembina: [], peserta: [], mon: null, dash: null, pending: [], home: null,
  page: null, params: {}, ui: {}, charts: {}, monCache: {}, kmap: {}, pmap: {}, lastSync: null, draft: null, booting: true
};
const ACT = {};   // handler klik (data-act)
const ON = {};    // handler input/change (data-on)
const PAGES = {}; // renderer halaman

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
function h(v) { return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function nf(n) { return Number(n || 0).toLocaleString('id-ID'); }
function pct(n) { return (Math.round(Number(n || 0) * 10) / 10).toString().replace('.', ',') + '%'; }
function ini(name) { const p = String(name || '?').replace(/[^A-Za-z\u00C0-\u024F ]/g, ' ').trim().split(/\s+/).filter(Boolean); return ((p[0] || '?').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase(); }
function debounce(fn, ms) { let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }
function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { } }
function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) { } }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function ymdParse(s) { const p = String(s).slice(0, 10).split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12); }
function ymdFmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function ymdAdd(s, n) { const d = ymdParse(s); d.setDate(d.getDate() + n); return ymdFmt(d); }
function hariOf(s) { return HARI[ymdParse(s).getDay()]; }
function tglIndo(s) { const d = ymdParse(s); return d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear(); }
function tglLong(s) { return hariOf(s) + ', ' + tglIndo(s); }
function tglShort(s) { const d = ymdParse(s); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }
function bulanLabel(ym) { const p = ym.split('-'); return BULAN[Number(p[1]) - 1] + ' ' + p[0]; }
function clockHM(str) { return String(str || '').slice(11, 16); }
function greeting() { const hr = new Date().getHours(); return hr < 11 ? 'Selamat Pagi' : hr < 15 ? 'Selamat Siang' : hr < 18 ? 'Selamat Sore' : 'Selamat Malam'; }
function isAdmin() { return S.user && S.user.role === ROLE.ADMIN; }
function isSuper() { return S.user && S.user.role === ROLE.SUPER; }
function isPembina() { return S.user && S.user.role === ROLE.PEMBINA; }
function roleLabel(r) { return r === ROLE.ADMIN ? 'Waka Kesiswaan / Admin' : r === ROLE.SUPER ? 'Super Admin' : 'Pembina Ekstrakurikuler'; }
function roleShort(r) { return r === ROLE.ADMIN ? 'Waka Kesiswaan' : r === ROLE.SUPER ? 'Super Admin' : 'Pembina'; }
function parseHariList(s) { const t = String(s || '').toLowerCase(); return HARI.filter(function (x) { return t.indexOf(x.toLowerCase()) >= 0; }); }
function parseJam(s) { const m = String(s || '').match(/(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/); return m ? { a: pad(+m[1]) + ':' + m[2], b: pad(+m[3]) + ':' + m[4] } : { a: '', b: '' }; }
function jamLabel(k) { const j = parseJam(k.jadwal); return j.a ? (j.a + ' - ' + j.b + ' WIB') : (k.jadwal || '-'); }
function expectedInMonth(k) {
  const t = S.today, ym = t.slice(0, 7), hari = parseHariList(k.hari); let n = 0;
  for (let d = 1; d <= Number(t.slice(8, 10)); d++) if (hari.indexOf(hariOf(ym + '-' + pad(d))) >= 0) n++;
  return n;
}
const EKS_COLORS = [['#fee2e2', '#b91c1c'], ['#ffedd5', '#c2410c'], ['#e0e7ff', '#3730a3'], ['#fee2e2', '#991b1b'], ['#dcfce7', '#166534'], ['#e0f2fe', '#075985'], ['#fae8ff', '#86198f'], ['#fef9c3', '#854d0e']];
function ekBadge(k) { const i = Math.abs(String(k.kode || k.id).split('').reduce(function (a, c) { return a + c.charCodeAt(0); }, 0)) % EKS_COLORS.length; const c = EKS_COLORS[i]; return '<span class="eks-badge" style="background:' + c[0] + ';color:' + c[1] + '">' + h(String(k.kode || '').slice(0, 3)) + '</span>'; }

function logoHtml(cls) {
  const u = S.cfg && S.cfg.logoUrl ? String(S.cfg.logoUrl) : '';
  if (u) {
    const m = u.match(/\/d\/([\w-]+)/) || u.match(/[?&]id=([\w-]+)/);
    const src = m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w256' : u;
    return '<img src="' + h(src) + '" alt="Logo SMAN 1 Kamal" class="' + (cls || '') + '">';
  }
  return '<svg viewBox="0 0 100 112" class="' + (cls || '') + '" role="img" aria-label="Logo SMAN 1 Kamal"><use href="#logo"/></svg>';
}

// -- Pemanggil server (REST API via fetch, bukan lagi google.script.run) --
function api(fn) {
  const args = Array.prototype.slice.call(arguments, 1);
  if (!window.GAS_URL) return Promise.reject(new Error('GAS_URL belum diisi di js/config.js.'));
  return fetch(window.GAS_URL, {
    method: 'POST',
    // WAJIB text/plain agar browser tidak mengirim preflight OPTIONS (GAS tidak bisa membalasnya)
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: fn, args: args })
  })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (res && res.success === false) {
        const e = new Error(res.message || 'Terjadi kesalahan.'); e.code = res.code;
        if (res.code === 'AUTH') authLost();
        throw e;
      }
      return res ? res.data : null;
    });
}
function call(fn) { const a = Array.prototype.slice.call(arguments, 1); return api.apply(null, [fn, S.token].concat(a)); }
function authLost() {
  if (!S.token) return;
  S.token = null; lsDel('siabsens_token');
  toast('Sesi Anda telah berakhir. Silakan masuk kembali.', 'warn', 'Sesi berakhir');
  showLogin();
}

// -- Toast --
function toast(msg, type, title) {
  type = type || 'info';
  const ic = { ok: 'bi-check-circle-fill', danger: 'bi-x-octagon-fill', warn: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' }[type] || 'bi-info-circle-fill';
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.setAttribute('role', 'status');
  el.innerHTML = '<i class="bi ' + ic + '"></i><div>' + (title ? '<b>' + h(title) + '</b>' : '') + '<span>' + h(msg) + '</span></div>';
  $('#toasts').appendChild(el);
  setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(function () { el.remove(); }, 320); }, type === 'danger' ? 6500 : 3800);
}

// -- Modal (pop-up) --
const modalStack = [];
function openModal(o) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = '<div class="modal ' + (o.size || '') + '" role="dialog" aria-modal="true"><div class="modal-h"><h3>' + (o.title || '') + '</h3>' +
    (o.noClose ? '' : '<button type="button" class="icon-btn sm" data-mclose aria-label="Tutup"><i class="bi bi-x-lg"></i></button>') + '</div><div class="modal-b">' + (o.body || '') + '</div>' +
    (o.footer ? '<div class="modal-f">' + o.footer + '</div>' : '') + '</div>';
  const m = {
    el: ov, body: $('.modal-b', ov), foot: $('.modal-f', ov),
    q: function (s) { return $(s, ov); }, qa: function (s) { return $$(s, ov); },
    close: function () { const i = modalStack.indexOf(m); if (i >= 0) modalStack.splice(i, 1); ov.remove(); if (o.onClose) o.onClose(); }
  };
  if (!o.noClose) { const c = $('[data-mclose]', ov); if (c) c.onclick = m.close; }
  ov.addEventListener('mousedown', function (e) { if (e.target === ov && !o.static) m.close(); });
  $('#modalRoot').appendChild(ov);
  modalStack.push(m);
  const f = $('input:not([type=hidden]), select, textarea', ov); if (f && !o.noFocus && window.innerWidth > 767) setTimeout(function () { try { f.focus(); } catch (e) { } }, 60);
  return m;
}
function closeAllModals() { while (modalStack.length) modalStack[modalStack.length - 1].close(); }
function confirmBox(o) {
  return new Promise(function (resolve) {
    let done = false;
    const m = openModal({
      size: 'sm', title: h(o.title || 'Konfirmasi'), static: true,
      body: '<p class="t2" style="line-height:21px">' + (o.html || h(o.message || '')) + '</p>',
      footer: '<button class="btn btn-secondary" data-c>' + h(o.cancel || 'Batal') + '</button><button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + h(o.ok || 'Ya, Lanjutkan') + '</button>',
      onClose: function () { if (!done) { done = true; resolve(false); } }
    });
    m.q('[data-c]').onclick = function () { m.close(); };
    m.q('[data-ok]').onclick = function () { done = true; m.close(); resolve(true); };
  });
}
async function withBusy(btn, fn, label) {
  if (!btn) return fn();
  if (btn.dataset.busy) return;
  const old = btn.innerHTML; btn.dataset.busy = '1'; btn.disabled = true;
  btn.innerHTML = '<span class="spin-sm"></span> ' + h(label || 'Memproses…');
  try { return await fn(); } finally { btn.disabled = false; delete btn.dataset.busy; btn.innerHTML = old; }
}
function errMsg(e) { return (e && e.message) ? e.message : String(e); }
function copyText(txt) {
  return new Promise(function (resolve) {
    function fallback() {
      try { const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); resolve(ok); } catch (e) { resolve(false); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { resolve(true); }, fallback); else fallback();
  });
}
function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
}
function b64ToBlob(b64, mime) {
  const bin = atob(b64), len = bin.length, arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
function normalizeHp(hp) { let d = String(hp || '').replace(/\D/g, ''); if (d.indexOf('0') === 0) d = '62' + d.slice(1); return d; }

// -- Badge helper --
function valBadge(st) {
  if (st === 'Divalidasi') return '<span class="badge b-info" style="background:var(--primary-soft);color:var(--primary-deep);border-color:transparent"><i class="bi bi-check-circle"></i> Divalidasi</span>';
  if (st === 'Dikembalikan') return '<span class="badge b-danger"><i class="bi bi-arrow-return-left"></i> Dikembalikan</span>';
  return '<span class="badge b-tert"><span class="dot tert"></span> Menunggu Validasi</span>';
}
function stBadge(s) { return '<span class="badge b-' + h(String(s).toLowerCase()) + '">' + h(s) + '</span>'; }
function pctClass(p) { const kkm = Number(S.cfg.targetKKM) || 85; return p >= kkm ? 'ok' : p >= 70 ? 'warn' : 'danger'; }
function pageHead(o) {
  return '<div class="page-head"><div>' + (o.eyebrow ? '<div class="row g8 mb8">' + o.eyebrow + '</div>' : '') + '<h1>' + o.title + '</h1>' + (o.sub ? '<p class="sub">' + o.sub + '</p>' : '') + '</div>' +
    (o.actions ? '<div class="row g8 wrap">' + o.actions + '</div>' : '') + '</div>';
}
function emptyState(icon, title, sub) { return '<div class="empty"><i class="bi ' + icon + '"></i><div class="b t2">' + h(title) + '</div>' + (sub ? '<div class="fs13 mt4">' + h(sub) + '</div>' : '') + '</div>'; }

// -- Tema gelap --
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'dark' ? '#060d22' : '#00164e');
  Object.keys(S.charts).forEach(function (k) { try { S.charts[k].destroy(); } catch (e) { } delete S.charts[k]; });
  if (S.user && S.page) renderPage(true);
}
function toggleTheme() { const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; lsSet('siabsens_theme', t); applyTheme(t); }
function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

// ---------------- BAGIAN 2: DELEGASI EVENT ----------------
document.addEventListener('click', function (e) {
  const t = e.target.closest('[data-act]');
  if (!t) {
    closeFloating(e);
    return;
  }
  const fn = ACT[t.dataset.act];
  if (fn) {
    if (t.tagName === 'A' && !t.getAttribute('target')) e.preventDefault();
    const inDrop = t.closest && t.closest('.dropdown');
    fn(t, e);
    if (inDrop && floatEl) closeFloating();
  }
});
document.addEventListener('input', function (e) { const t = e.target.closest('[data-on]'); if (t && ON[t.dataset.on]) ON[t.dataset.on](t, e); });
document.addEventListener('change', function (e) { const t = e.target.closest('[data-onchange]'); if (t && ON[t.dataset.onchange]) ON[t.dataset.onchange](t, e); });
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { if (modalStack.length) { modalStack[modalStack.length - 1].close(); } else { closeFloating(); closeSidebar(); } }
  if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k' && S.user && !isPembina()) { e.preventDefault(); const i = $('#gSearch'); if (i) { i.focus(); i.select(); } }
});

// ---------------- BAGIAN 3: LOGIN & SESI ----------------
let loginRole = 'pembina';
const ROLE_HINT = { pembina: 'Pembina Ekskul', admin: 'Waka Kesiswaan / Admin', super: 'Super Administrator' };

function showLogin() {
  $('#splash').classList.add('hide');
  $('#viewApp').classList.add('hide');
  $('#viewLogin').classList.remove('hide');
  document.body.classList.remove('has-bnav', 'role-pembina');
  closeAllModals(); destroyCharts();
  S.user = null; S.page = null;
  const f = $('#loginForm'); if (f) { $('#lgPass').value = ''; }
  loadLoginHints();
}
let hintsLoaded = false;
function loadLoginHints() {
  if (hintsLoaded) return; hintsLoaded = true;
  api('getLoginHints').then(function (d) {
    if (d && d.hints && d.hints.length) {
      $('#demoBox').classList.remove('hide');
      $('#demoBtns').innerHTML = d.hints.map(function (x, i) { return '<button type="button" class="btn btn-secondary btn-sm" data-act="demoFill" data-i="' + i + '">' + h(x.label) + '</button>'; }).join('');
      window.__hints = d.hints;
    }
  }).catch(function () { hintsLoaded = false; });
}
ACT.demoFill = function (el) {
  const x = (window.__hints || [])[Number(el.dataset.i)]; if (!x) return;
  setLoginRole(x.role); $('#lgUser').value = x.username; $('#lgPass').value = x.password;
  $('#lgPass').focus();
};
function setLoginRole(r) {
  loginRole = r;
  $$('#loginTabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.role === r); b.setAttribute('aria-selected', b.dataset.role === r); });
  $('#lgRoleHint').textContent = ROLE_HINT[r];
}
function bindLogin() {
  $('#loginTabs').addEventListener('click', function (e) { const b = e.target.closest('button[data-role]'); if (b) setLoginRole(b.dataset.role); });
  $('#lgEye').addEventListener('click', function () {
    const p = $('#lgPass'); const show = p.type === 'password'; p.type = show ? 'text' : 'password';
    this.innerHTML = '<i class="bi ' + (show ? 'bi-eye-slash' : 'bi-eye') + '"></i>';
  });
  $('#lgForgot').addEventListener('click', function () {
    openModal({ title: 'Lupa Kata Sandi', body: '<p class="t2" style="line-height:22px">Demi keamanan, kata sandi hanya dapat direset oleh <b>Super Admin</b> sekolah melalui menu <i>Akun Pengguna</i>. Silakan hubungi Super Admin (operator sekolah) untuk memperoleh kata sandi sementara, lalu ganti kata sandi Anda setelah masuk.</p>', footer: '<button class="btn btn-primary" data-mclose>Mengerti</button>' })
      .q('[data-mclose]').onclick = function () { closeAllModals(); };
  });
  $('#loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const u = $('#lgUser').value.trim(), p = $('#lgPass').value, btn = $('#lgSubmit'), er = $('#lgError');
    er.classList.add('hide');
    if (!u || !p) { er.textContent = 'Isi NIP/Username dan kata sandi.'; er.classList.remove('hide'); return; }
    await withBusy(btn, async function () {
      try {
        const d = await api('doLogin', u, p, loginRole);
        if ($('#lgRemember').checked) lsSet('siabsens_token', d.token); else lsDel('siabsens_token');
        await startApp(d.token);
      } catch (err) { er.textContent = errMsg(err); er.classList.remove('hide'); }
    }, 'Memverifikasi…');
  });
}

async function startApp(token) {
  S.token = token;
  $('#splash').classList.remove('hide'); $('#splash').style.opacity = '1';
  try {
    const d = await call('getBootstrap');
    setData(d);
    S.user = d.user;
    buildShell();
    $('#viewLogin').classList.add('hide');
    $('#viewApp').classList.remove('hide');
    navigate(defaultPage(), {}, true);
    startPolling();
  } catch (err) {
    if (err.code !== 'AUTH') toast(errMsg(err), 'danger', 'Gagal memuat data');
    showLogin();
  } finally {
    $('#splash').classList.add('hide');
  }
}
function setData(d) {
  S.cfg = d.cfg || {}; S.today = d.today; S.kelas = d.kelas || []; S.pembina = d.pembina || []; S.peserta = d.peserta || [];
  S.mon = d.mon || null; S.dash = d.dash || null; S.pending = d.pending || []; S.home = d.home || null; S.lastSync = new Date();
  S.kmap = {}; S.kelas.forEach(function (k) { S.kmap[k.id] = k; });
  S.pmap = {}; S.pembina.forEach(function (p) { S.pmap[p.id] = p; });
  S.monCache = {}; if (S.mon) S.monCache[S.mon.date] = S.mon;
}
let pollTimer = null;
function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(function () { if (!document.hidden && S.token && !modalStack.length && S.page !== 'input') refreshData(true); }, 120000);
}
/** Muat ulang data di latar belakang; render ulang halaman aktif bila aman */
async function refreshData(silent) {
  if (!S.token) return;
  try {
    const d = await call('getBootstrap');
    const busy = S.page === 'input' || modalStack.length > 0;
    setData(d); S.user = d.user;
    updateShellMeta();
    if (!busy) renderPage(true);
    if (!silent) toast('Data diperbarui', 'ok');
  } catch (e) { if (!silent) toast(errMsg(e), 'danger'); }
}
ACT.refresh = function (el) { withBusy(el, function () { return refreshData(false); }, 'Memuat…'); };

async function doLogoutNow() {
  const t = S.token; S.token = null; lsDel('siabsens_token'); clearInterval(pollTimer);
  try { await api('doLogout', t); } catch (e) { }
  S.ui = {}; S.monCache = {};
  showLogin();
}
ACT.logout = async function () { if (await confirmBox({ title: 'Keluar dari aplikasi?', message: 'Sesi Anda akan diakhiri di perangkat ini.', ok: 'Keluar' })) doLogoutNow(); };

// ---------------- BAGIAN 4: SHELL & NAVIGASI SPA ----------------
function navGroups() {
  const r = S.user.role;
  if (r === ROLE.PEMBINA) {
    return [{ items: [
      { id: 'home', icon: 'bi-grid-1x2', label: 'Beranda' }, { id: 'input', icon: 'bi-person-check', label: 'Presensi' },
      { id: 'peserta', icon: 'bi-people', label: 'Peserta' }, { id: 'riwayat', icon: 'bi-journal-check', label: 'Riwayat' }] },
    { g: 'Bantuan', items: [{ id: 'panduan', icon: 'bi-question-circle', label: 'Panduan' }] }];
  }
  const g = [
    { g: 'Utama', items: [{ id: 'dashboard', icon: 'bi-grid-1x2', label: 'Dashboard' }, { id: 'monitoring', icon: 'bi-eye', label: 'Monitoring Presensi' }] },
    { g: 'Manajemen Master', items: [{ id: 'pembina', icon: 'bi-person-vcard', label: 'Data Pembina' }, { id: 'peserta', icon: 'bi-people-fill', label: 'Data Peserta' }, { id: 'kelas', icon: 'bi-trophy', label: 'Kelas Ekstrakurikuler' }] },
    { g: 'Validasi & Laporan', items: [] },
    { g: 'Pengaturan', items: [] }
  ];
  if (r === ROLE.SUPER) g[1].items.push({ id: 'kartu', icon: 'bi-credit-card-2-front', label: 'Cetak Kartu Peserta' });
  if (r === ROLE.ADMIN) g[2].items.push({ id: 'validasi', icon: 'bi-patch-check', label: 'Validasi Presensi', badge: true });
  g[2].items.push({ id: 'rekap', icon: 'bi-bar-chart-line', label: 'Rekapitulasi & Laporan' }, { id: 'cetak', icon: 'bi-printer', label: 'Cetak Dokumen Resmi' });
  if (r === ROLE.SUPER) g[3].items.push({ id: 'akun', icon: 'bi-person-gear', label: 'Akun Pengguna' }, { id: 'pengaturan', icon: 'bi-sliders', label: 'Pengaturan Aplikasi' }, { id: 'backup', icon: 'bi-cloud-arrow-up', label: 'Backup Data Sheets' });
  g[3].items.push({ id: 'panduan', icon: 'bi-question-circle', label: 'Panduan Penggunaan' });
  return g;
}
function defaultPage() { return isPembina() ? 'home' : 'dashboard'; }
function pageAllowed(p) { return navGroups().some(function (g) { return g.items.some(function (i) { return i.id === p; }); }) || (isPembina() && p === 'cetak'); }

function buildShell() {
  document.body.classList.toggle('role-pembina', isPembina());
  document.body.classList.toggle('has-bnav', isPembina());
  const tb = $('.topbar-in');
  if (!$('#mobBrand')) {
    const mb = document.createElement('div'); mb.id = 'mobBrand'; mb.className = 'mob-brand';
    tb.insertBefore(mb, tb.children[1]);
  }
  $('#mobBrand').innerHTML = '<div style="width:32px;height:36px">' + logoHtml('') + '</div><div><div class="b" style="font-family:var(--f-head);color:var(--primary-deep);font-size:15px;line-height:18px">SIABSENS-EKSKUL</div><div class="fs11 muted" id="mobSub"></div></div>';
  $('#sbRole').textContent = roleLabel(S.user.role);
  $('.sb-brand', $('#sidebar')).firstElementChild.outerHTML = logoHtml('');
  $('#gSearchBox').classList.toggle('hide', isPembina());
  renderNav(); updateShellMeta();
  const bn = $('#bnav');
  if (isPembina()) {
    bn.classList.add('show');
    bn.innerHTML = navGroups()[0].items.map(function (i) { return '<button type="button" data-act="nav" data-p="' + i.id + '" aria-label="' + h(i.label) + '"><i class="bi ' + i.icon + '"></i>' + h(i.label) + '</button>'; }).join('');
  } else { bn.classList.remove('show'); bn.innerHTML = ''; }
}
function updateShellMeta() {
  $('#taChip').innerHTML = '<span class="dot pulse"></span> TA ' + h(S.cfg.tahunAjaran || '') + ' • Semester ' + h(S.cfg.semester || '');
  $('#tbAvatar').textContent = ini(S.user.nama);
  $('#tbName').textContent = S.user.nama; $('#tbRole').textContent = roleShort(S.user.role);
  const cnt = notifCount();
  $('#bellDot').classList.toggle('hide', !cnt);
  const bc = $('.sb-item[data-p="validasi"] .cnt'); if (bc) { bc.textContent = S.pending.length; bc.classList.toggle('hide', !S.pending.length); }
  if (isPembina()) { const k = curKelas(); $('#mobSub').textContent = 'Beranda' + (k ? ' • ' + k.nama : ''); }
}
function renderNav() {
  $('#sbNav').innerHTML = navGroups().map(function (g) {
    return (g.g ? '<div class="sb-group lbl-t">' + h(g.g) + '</div>' : '<div style="height:8px"></div>') + '<nav class="sb-nav">' + g.items.map(function (i) {
      const c = i.badge ? '<span class="cnt' + (S.pending.length ? '' : ' hide') + '">' + S.pending.length + '</span>' : '';
      return '<button type="button" class="sb-item" data-act="nav" data-p="' + i.id + '" title="' + h(i.label) + '"><i class="bi ' + i.icon + '"></i><span class="lbl-t">' + h(i.label) + '</span>' + c + '</button>';
    }).join('') + '</nav>';
  }).join('');
  markNav();
}
function markNav() {
  const p = S.page;
  const alias = { sesi: 'validasi' };
  const act = alias[p] || p;
  $$('.sb-item, .bnav button').forEach(function (b) { b.classList.toggle('on', b.dataset.p === act); });
}
ACT.nav = function (el) { navigate(el.dataset.p, {}); closeSidebar(); };
ACT.toggleSidebar = function () { $('#sidebar').classList.toggle('open'); $('#sbScrim').classList.toggle('show'); };
function closeSidebar() { $('#sidebar').classList.remove('open'); $('#sbScrim').classList.remove('show'); }
$('#sbScrim').addEventListener('click', closeSidebar);

function destroyCharts() { Object.keys(S.charts).forEach(function (k) { try { S.charts[k].destroy(); } catch (e) { } delete S.charts[k]; }); }
function navigate(page, params, force) {
  if (!S.user) return;
  if (!pageAllowed(page)) page = defaultPage();
  if (S.page === 'input' && page !== 'input' && S.draft && S.draft.dirty && !force) { saveDraftLocal(true); }
  stopGps();
  closeAllModals(); closeFloating();
  if (page !== 'validasi') S.ui.vd = null;
  S.page = page; S.params = params || {};
  markNav(); renderPage(false);
  const c = $('#app-container'); window.scrollTo(0, 0); if (c) c.focus({ preventScroll: true });
}
function renderPage(keepScroll) {
  const el = $('#app-container'); if (!el || !S.user) return;
  const y = keepScroll ? window.scrollY : 0;
  destroyCharts();
  const fn = PAGES[S.page];
  try {
    if (!fn) { el.innerHTML = emptyState('bi-question-circle', 'Halaman tidak ditemukan'); return; }
    fn(el);
  } catch (e) {
    console.error(e);
    el.innerHTML = '<div class="card">' + emptyState('bi-exclamation-triangle', 'Terjadi kesalahan saat menampilkan halaman', errMsg(e)) + '</div>';
  }
  if (keepScroll) window.scrollTo(0, y);
  markNav(); updateShellMeta();
}

// ---------------- BAGIAN 5: PENCARIAN GLOBAL, NOTIFIKASI, PROFIL ----------------
let floatEl = null;
function closeFloating(e) {
  if (e && e.target && e.target.closest && e.target.closest('#gSearchBox')) return;
  if (floatEl) { floatEl.remove(); floatEl = null; }
  const r = $('#gSearchRes'); if (r && !(e && e.target && e.target.closest && e.target.closest('#gSearchBox'))) r.classList.add('hide');
}
function openDropdown(anchor, html, align) {
  closeFloating();
  const d = document.createElement('div'); d.className = 'dropdown'; d.innerHTML = html;
  document.body.appendChild(d);
  const r = anchor.getBoundingClientRect();
  d.style.top = (r.bottom + 6) + 'px';
  const w = d.offsetWidth; let left = align === 'left' ? r.left : r.right - w;
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8)); d.style.left = left + 'px';
  d.style.position = 'fixed'; floatEl = d; return d;
}
function notifItems() {
  if (isPembina()) return ((S.home && S.home.riwayat) || []).filter(function (x) { return x.status === 'Dikembalikan'; });
  return isAdmin() ? S.pending : [];
}
function notifCount() { return notifItems().length; }
ACT.bell = function (el, e) {
  e.stopPropagation();
  const items = notifItems();
  let html = '<div class="hd"><div class="b">Notifikasi</div><div class="fs12 muted">' + (isPembina() ? 'Presensi dikembalikan untuk revisi' : 'Presensi menunggu validasi') + '</div></div>';
  if (!items.length) html += '<div class="empty" style="padding:24px 12px"><i class="bi bi-bell-slash"></i>Tidak ada notifikasi baru</div>';
  else html += items.slice(0, 8).map(function (x) {
    return '<button class="it" data-act="openNotif" data-id="' + h(x.id) + '"><span class="dot ' + (isPembina() ? 'danger' : 'tert') + '"></span><span class="grow"><b style="display:block">' + h(x.kelasNama) + '</b><span class="fs12 muted">' + h(tglIndo(x.tanggal)) + (isPembina() && x.catatanValidator ? ' • ' + h(x.catatanValidator) : '') + '</span></span></button>';
  }).join('');
  if (isSuper()) html = '<div class="hd"><div class="b">Notifikasi</div></div><div class="empty" style="padding:24px 12px"><i class="bi bi-bell-slash"></i>Tidak ada notifikasi baru</div>';
  openDropdown(el, html);
};
ACT.openNotif = function (el) {
  const id = el.dataset.id; closeFloating();
  if (isPembina()) openSesiModal(id); else navigate('validasi', { id: id });
};
ACT.profileMenu = function (el, e) {
  e.stopPropagation();
  const u = S.user;
  const html = '<div class="hd"><div class="b">' + h(u.nama) + '</div><div class="fs12 muted">' + h(roleLabel(u.role)) + '<br>' + h(u.username) + '</div></div>' +
    '<button class="it" data-act="toggleTheme"><i class="bi ' + (isDark() ? 'bi-sun' : 'bi-moon-stars') + '"></i> ' + (isDark() ? 'Mode Terang' : 'Mode Gelap') + '</button>' +
    '<button class="it" data-act="changePw"><i class="bi bi-key"></i> Ganti Kata Sandi</button>' +
    '<button class="it" data-act="refresh"><i class="bi bi-arrow-repeat"></i> Muat Ulang Data</button>' +
    '<button class="it" data-act="nav" data-p="panduan"><i class="bi bi-question-circle"></i> Panduan Penggunaan</button>' +
    '<button class="it" data-act="logout" style="color:var(--danger)"><i class="bi bi-box-arrow-right"></i> Keluar</button>';
  openDropdown(el, html);
};
ACT.toggleTheme = function () { closeFloating(); toggleTheme(); };
ACT.changePw = function () {
  closeFloating();
  const m = openModal({
    size: 'sm', title: 'Ganti Kata Sandi',
    body: '<div class="field"><label>Kata sandi lama</label><input class="inp" type="password" id="pwOld" autocomplete="current-password"></div>' +
      '<div class="field"><label>Kata sandi baru</label><input class="inp" type="password" id="pwNew" autocomplete="new-password"><div class="hint">Minimal 6 karakter.</div></div>' +
      '<div class="field" style="margin-bottom:0"><label>Ulangi kata sandi baru</label><input class="inp" type="password" id="pwNew2" autocomplete="new-password"></div><div class="ferr hide" id="pwErr"></div>',
    footer: '<button class="btn btn-secondary" data-mclose2>Batal</button><button class="btn btn-primary" id="pwSave">Simpan</button>'
  });
  m.q('[data-mclose2]').onclick = m.close;
  m.q('#pwSave').onclick = function () {
    const o = m.q('#pwOld').value, n = m.q('#pwNew').value, n2 = m.q('#pwNew2').value, er = m.q('#pwErr');
    er.classList.add('hide');
    if (n.length < 6) { er.textContent = 'Kata sandi baru minimal 6 karakter.'; er.classList.remove('hide'); return; }
    if (n !== n2) { er.textContent = 'Konfirmasi kata sandi tidak sama.'; er.classList.remove('hide'); return; }
    withBusy(m.q('#pwSave'), async function () {
      try { await call('changePassword', o, n); m.close(); toast('Kata sandi berhasil diganti.', 'ok'); } catch (e) { er.textContent = errMsg(e); er.classList.remove('hide'); }
    }, 'Menyimpan…');
  };
};

// Pencarian global (filter lokal pada data yang sudah dimuat — instan)
const runGlobalSearch = debounce(function () {
  const q = $('#gSearch').value.trim().toLowerCase(), box = $('#gSearchRes');
  if (q.length < 2) { box.classList.add('hide'); return; }
  const pes = S.peserta.filter(function (p) { return (p.nama + ' ' + p.nisn + ' ' + p.noInduk).toLowerCase().indexOf(q) >= 0; }).slice(0, 6);
  const pem = S.pembina.filter(function (p) { return (p.nama + ' ' + (p.nip || '')).toLowerCase().indexOf(q) >= 0; }).slice(0, 4);
  const kel = S.kelas.filter(function (k) { return (k.nama + ' ' + k.kode).toLowerCase().indexOf(q) >= 0; }).slice(0, 4);
  let html = '';
  if (pes.length) html += '<div class="grp">Peserta</div>' + pes.map(function (p) { const k = S.kmap[p.idKelas]; return '<div class="it" data-act="gsGo" data-t="peserta" data-q="' + h(p.nisn) + '"><span class="avatar sm">' + h(ini(p.nama)) + '</span><span class="grow"><b style="display:block">' + h(p.nama) + '</b><span class="fs12 muted">NISN ' + h(p.nisn) + ' • ' + h(p.kelasJur) + ' • ' + h(k ? k.nama : '-') + '</span></span></div>'; }).join('');
  if (pem.length) html += '<div class="grp">Pembina</div>' + pem.map(function (p) { return '<div class="it" data-act="gsGo" data-t="pembina" data-q="' + h(p.nama) + '"><span class="avatar sm">' + h(ini(p.nama)) + '</span><span class="grow"><b style="display:block">' + h(p.nama) + '</b><span class="fs12 muted">' + h((p.ekstra || []).join(', ') || 'Belum mengampu ekstra') + '</span></span></div>'; }).join('');
  if (kel.length) html += '<div class="grp">Ekstrakurikuler</div>' + kel.map(function (k) { return '<div class="it" data-act="gsGo" data-t="kelas" data-q="' + h(k.nama) + '">' + ekBadge(k) + '<span class="grow"><b style="display:block">' + h(k.nama) + '</b><span class="fs12 muted">' + h(k.pembina) + ' • ' + k.jumlah + ' siswa</span></span></div>'; }).join('');
  if (!html) html = '<div class="empty" style="padding:20px"><i class="bi bi-search"></i>Tidak ada hasil untuk “' + h(q) + '”</div>';
  box.innerHTML = html; box.classList.remove('hide');
}, 150);
ACT.gsGo = function (el) {
  const t = el.dataset.t, q = el.dataset.q; $('#gSearchRes').classList.add('hide'); $('#gSearch').value = '';
  S.ui[t] = S.ui[t] || {}; S.ui[t].q = q; if (t === 'peserta') { S.ui.pes = S.ui.pes || {}; S.ui.pes.q = q; S.ui.pes.page = 1; S.ui.pes.status = ''; S.ui.pes.kelas = ''; }
  navigate(t, {});
};

// ---------------- BAGIAN 6: INISIALISASI ----------------
function init() {
  applyThemeInit();
  bindLogin();
  $('#gSearch').addEventListener('input', runGlobalSearch);
  $('#gSearch').addEventListener('focus', runGlobalSearch);
  window.addEventListener('beforeprint', function () { });
  const saved = lsGet('siabsens_token');
  if (saved && window.GAS_URL) {
    api('resumeSession', saved).then(function () { return startApp(saved); }).catch(function () { lsDel('siabsens_token'); showLogin(); });
  } else {
    if (saved) lsDel('siabsens_token');
    showLogin();
  }
}
function applyThemeInit() {
  const t = lsGet('siabsens_theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', t);
}

// ---------------- BAGIAN 7: UTIL FOTO, GPS, DETAIL SESI (dipakai lintas peran) ----------------
S.photoCache = {};
async function fetchPhoto(idSesi, jenis) {
  const key = idSesi + '|' + jenis;
  if (S.photoCache[key]) return S.photoCache[key];
  const d = await call('getPhotoData', idSesi, jenis);
  const out = { src: 'data:' + d.mime + ';base64,' + d.data, name: d.name, url: d.url };
  const keys = Object.keys(S.photoCache); if (keys.length >= 6) delete S.photoCache[keys[0]];
  S.photoCache[key] = out; return out;
}
function viewPhotoFull(src, name) {
  const m = openModal({ size: 'xl', title: h(name || 'Foto'), body: '<img src="' + src + '" alt="' + h(name || 'Foto bukti') + '" style="width:100%;border-radius:12px;display:block">', footer: '<a class="btn btn-secondary" download="' + h(name || 'foto.jpg') + '" href="' + src + '"><i class="bi bi-download"></i> Unduh</a><button class="btn btn-primary" data-x>Tutup</button>' });
  m.q('[data-x]').onclick = m.close;
}
ACT.zoomPhoto = function (el) { const img = el.closest('[data-photo]') && $('img', el.closest('[data-photo]')); if (img) viewPhotoFull(img.src, img.dataset.name); };
/** Isi kontainer foto: memuat dari server bila tautan tersedia */
async function loadPhotoInto(box, idSesi, jenis, hasLink, overlayHtml) {
  if (!hasLink) { box.innerHTML = '<div class="col center g8" style="align-items:center"><i class="bi bi-image" style="font-size:30px"></i><span class="fs12">Belum ada foto diunggah</span></div>'; return; }
  box.innerHTML = '<div class="skel" style="position:absolute;inset:0"></div>';
  try {
    const p = await fetchPhoto(idSesi, jenis);
    box.setAttribute('data-photo', '1');
    box.innerHTML = '<img src="' + p.src + '" data-name="' + h(p.name) + '" alt="Foto bukti ' + h(jenis) + '">' + (overlayHtml || '');
  } catch (e) { box.innerHTML = '<div class="col center g8" style="align-items:center;padding:12px"><i class="bi bi-exclamation-triangle"></i><span class="fs12">' + h(errMsg(e)) + '</span></div>'; }
}

// -- GPS --
let gpsWatch = null;
function distM(lat1, lng1, lat2, lng2) {
  const R = 6371000, r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function stopGps() { if (gpsWatch !== null && navigator.geolocation) { try { navigator.geolocation.clearWatch(gpsWatch); } catch (e) { } } gpsWatch = null; }
function startGps() {
  stopGps();
  const D = S.draft; if (!D) return;
  D.gps = { state: 'wait' }; renderGps();
  if (!navigator.geolocation) { D.gps = { state: 'na' }; renderGps(); return; }
  gpsWatch = navigator.geolocation.watchPosition(function (pos) {
    const c = pos.coords, jarak = distM(c.latitude, c.longitude, Number(S.cfg.geoLat), Number(S.cfg.geoLng)), rad = Number(S.cfg.geoRadius) || 150;
    D.gps = { state: jarak <= rad ? 'ok' : 'out', lat: c.latitude, lng: c.longitude, acc: c.accuracy, jarak: jarak, radius: rad };
    renderGps();
  }, function (err) { D.gps = { state: err && err.code === 1 ? 'denied' : 'na' }; renderGps(); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
}
function renderGps() {
  const el = $('#gpsCard'), D = S.draft; if (!el || !D) return;
  const g = D.gps || { state: 'wait' }, k = S.kmap[D.idKelas] || {};
  let cls = '', ic = 'bi-geo-alt', t = '', sub = '';
  if (g.state === 'ok') { ic = 'bi-check2-circle'; t = 'GPS Terkunci Valid <span class="tag ok" style="margin-left:6px">' + g.jarak.toFixed(1).replace('.', ',') + ' m</span>'; sub = h(k.lokasi || 'Lokasi sekolah') + ' (Dalam Radius Aman Sekolah)'; }
  else if (g.state === 'out') { cls = 'bad'; ic = 'bi-exclamation-triangle'; t = 'Di Luar Radius Sekolah <span class="tag danger" style="margin-left:6px">' + Math.round(g.jarak) + ' m</span>'; sub = 'Batas aman ' + g.radius + ' m dari titik sekolah.' + (S.cfg.wajibGPS === 'TRUE' ? ' Presensi tidak dapat dikirim dari luar radius.' : ' Lokasi tetap dicatat untuk validasi Waka.'); }
  else if (g.state === 'denied') { cls = 'bad'; ic = 'bi-geo-alt-fill'; t = 'Izin Lokasi Ditolak'; sub = 'Aktifkan izin lokasi pada browser agar posisi terverifikasi.'; }
  else if (g.state === 'na') { cls = 'wait'; ic = 'bi-geo'; t = 'GPS Tidak Tersedia'; sub = S.cfg.wajibGPS === 'TRUE' ? 'GPS wajib aktif untuk mengirim presensi.' : 'Presensi tetap dapat dikirim tanpa GPS.'; }
  else { cls = 'wait'; t = 'Mencari Sinyal GPS…'; sub = 'Pastikan lokasi perangkat aktif.'; }
  el.className = 'gps ' + cls;
  el.innerHTML = '<span class="ic"><i class="bi ' + ic + '"></i></span><div class="grow"><div class="b" style="font-size:14px">' + t + '</div><div class="fs12 muted mt4">' + sub + '</div></div><button class="icon-btn sm" data-act="gpsRetry" aria-label="Perbarui lokasi"><i class="bi bi-crosshair"></i></button>';
}
ACT.gpsRetry = function () { startGps(); };

// -- Foto: kompres + watermark --
function compressImage(file, lines, maxW) {
  maxW = maxW || 1280;
  return new Promise(function (resolve, reject) {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      const sc = Math.min(1, maxW / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * sc), hh = Math.round(img.naturalHeight * sc);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
      const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, w, hh);
      if (lines && lines.length) {
        const fs = Math.max(12, Math.round(Math.min(w, hh) / 32)), pad = Math.round(fs * .7), bh = lines.length * (fs + 4) + pad * 2;
        cx.fillStyle = 'rgba(15,23,42,.62)'; cx.fillRect(0, hh - bh, w, bh);
        cx.fillStyle = '#fff'; cx.font = '600 ' + fs + 'px Inter, Arial, sans-serif'; cx.textBaseline = 'top';
        lines.forEach(function (ln, i) { cx.fillText(ln, pad, hh - bh + pad + i * (fs + 4), w - pad * 2); });
      }
      const dataUrl = cv.toDataURL('image/jpeg', 0.78);
      resolve({ dataUrl: dataUrl, b64: dataUrl.split(',')[1], mime: 'image/jpeg' });
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Foto tidak dapat dibaca. Coba ambil ulang.')); };
    img.src = url;
  });
}
function stampLines(kind) {
  const D = S.draft, k = S.kmap[D.idKelas] || {}, d = new Date();
  const ts = pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' WIB';
  const lines = [ts];
  if (kind === 'selfie') lines.push((S.user.nama || '') + ' • ' + (k.nama || ''));
  if (D.gps && D.gps.lat) lines.push(D.gps.lat.toFixed(5) + '°, ' + D.gps.lng.toFixed(5) + '°'); else if (kind === 'selfie') lines.push(k.lokasi || '');
  return lines;
}
async function handleFotoFile(kind, file) {
  if (!file || !S.draft) return;
  if (!/^image\//.test(file.type)) { toast('Pilih file gambar (JPG/PNG).', 'warn'); return; }
  try {
    const r = await compressImage(file, stampLines(kind));
    if (r.b64.length > 5.5 * 1024 * 1024) throw new Error('Ukuran foto terlalu besar.');
    r.ts = Date.now();
    if (kind === 'kegiatan') S.draft.fotoKegiatan = r; else S.draft.fotoSelfie = r;
    S.draft.dirty = true; renderPhotos(); toast('Foto berhasil diambil.', 'ok');
  } catch (e) { toast(errMsg(e), 'danger'); }
}

// -- Detail sesi (modal) — dipakai Pembina, Admin, Super Admin --
async function openSesiModal(id) {
  const m = openModal({ size: 'lg', title: 'Detail Sesi Presensi', body: '<div class="skel" style="height:260px"></div>', footer: '<button class="btn btn-secondary" data-x>Tutup</button>' });
  m.q('[data-x]').onclick = m.close;
  try {
    const d = await call('getSesiDetail', id), s = d.sesi;
    const canRevise = isPembina() && s.status !== 'Divalidasi' && s.tanggal >= ymdAdd(S.today, -3);
    m.el.querySelector('.modal-h h3').innerHTML = h(s.kelasNama) + ' <span class="muted" style="font-weight:500;font-size:14px">• ' + h(tglIndo(s.tanggal)) + '</span>';
    m.body.innerHTML =
      '<div class="row g8 wrap mb16">' + valBadge(s.status) + '<span class="chip"><i class="bi bi-hash"></i> Pertemuan ke-' + s.pertemuan + '</span><span class="chip"><i class="bi bi-person"></i> ' + h(d.pembina.nama) + '</span>' +
      (s.kode ? '<span class="chip mono">' + h(s.kode) + '</span>' : '') + '</div>' +
      '<div class="grid g-4 g-mob1" style="grid-template-columns:repeat(4,1fr)"><div class="tile h"><div class="k">Hadir</div><div class="n">' + s.h + '</div></div><div class="tile s"><div class="k">Sakit</div><div class="n">' + s.s + '</div></div><div class="tile i"><div class="k">Izin</div><div class="n">' + s.i + '</div></div><div class="tile a"><div class="k">Alpa</div><div class="n">' + s.a + '</div></div></div>' +
      (s.status === 'Dikembalikan' ? '<div class="note-box danger mt16"><div class="t"><i class="bi bi-arrow-return-left"></i> Dikembalikan untuk revisi</div>' + h(s.catatanValidator || '-') + '</div>' : '') +
      (s.status === 'Divalidasi' ? '<div class="note-box mt16"><div class="t"><i class="bi bi-patch-check"></i> Terverifikasi Digital</div>Divalidasi oleh ' + h(s.validator) + ' pada ' + h(tglIndo(String(s.tglValidasi).slice(0, 10))) + ' pukul ' + h(clockHM(s.tglValidasi)) + ' WIB.' + (s.catatanValidator ? '<br>Catatan: ' + h(s.catatanValidator) : '') + '</div>' : '') +
      (s.catatan ? '<div class="mt16"><div class="lbl">Catatan Pembina</div><div class="t2 fs13">' + h(s.catatan) + '</div></div>' : '') +
      '<div class="grid g-2 g-mob1 mt16"><div><div class="lbl">Foto Kegiatan</div><div class="photo-frame" id="mPhK"></div></div><div><div class="lbl">Foto Selfie Pembina</div><div class="photo-frame" id="mPhS"></div></div></div>' +
      '<div class="lbl mt16">Daftar Kehadiran (' + d.rows.length + ' peserta)</div><div class="tbl-wrap card p0 flat"><table class="tbl"><thead><tr><th>No</th><th>Siswa</th><th>Kelas</th><th>Status</th><th>Keterangan</th></tr></thead><tbody>' +
      d.rows.map(function (r, i) { return '<tr><td class="num">' + (i + 1) + '</td><td><b>' + h(r.nama) + '</b><div class="fs12 muted num">' + h(r.nisn) + '</div></td><td>' + h(r.kelasJur) + '</td><td>' + stBadge(r.status) + '</td><td class="fs13 t2">' + h(r.ket || '-') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    loadPhotoInto(m.q('#mPhK'), id, 'kegiatan', s.fotoKegiatan, '<div class="ov"><span><i class="bi bi-geo-alt"></i> ' + (s.jarak !== null ? 'Radius GPS: ' + String(s.jarak).replace('.', ',') + ' m' : 'GPS tidak tercatat') + '</span><button data-act="zoomPhoto">Resolusi Penuh</button></div>');
    loadPhotoInto(m.q('#mPhS'), id, 'selfie', s.fotoSelfie, '<div class="ov"><span>' + h(d.pembina.nama) + '</span><button data-act="zoomPhoto">Resolusi Penuh</button></div>');
    let f = '<button class="btn btn-secondary" data-x>Tutup</button>';
    if (canRevise) f += '<button class="btn btn-accent" id="mRevise"><i class="bi bi-pencil-square"></i> ' + (s.status === 'Dikembalikan' ? 'Perbaiki & Kirim Ulang' : 'Ubah & Kirim Ulang') + '</button>';
    if (isAdmin()) f += '<button class="btn btn-primary" id="mVal"><i class="bi bi-patch-check"></i> ' + (s.status === 'Divalidasi' ? 'Buka Halaman Validasi' : 'Tinjau & Validasi') + '</button>';
    m.foot.innerHTML = f; m.q('[data-x]').onclick = m.close;
    const rv = m.q('#mRevise'); if (rv) rv.onclick = function () { m.close(); navigate('input', { idKelas: s.idKelas, tanggal: s.tanggal }); };
    const vv = m.q('#mVal'); if (vv) vv.onclick = function () { m.close(); navigate('validasi', { id: id }); };
  } catch (e) { m.body.innerHTML = '<div class="empty"><i class="bi bi-exclamation-triangle"></i>' + h(errMsg(e)) + '</div>'; }
}
ACT.openSesi = function (el) { openSesiModal(el.dataset.id); };

// ---------------- BAGIAN 8: PEMBINA — BERANDA ----------------
function curKelas() {
  if (!isPembina()) return null;
  return S.kmap[S.ui.kelasId] || S.kelas[0] || null;
}
function kelasPicker() {
  if (S.kelas.length < 2) return '';
  return '<select class="sel" data-onchange="pickKelas" style="max-width:280px;margin-bottom:12px" aria-label="Pilih ekstrakurikuler">' + S.kelas.map(function (k) { return '<option value="' + h(k.id) + '"' + (curKelas().id === k.id ? ' selected' : '') + '>' + h(k.nama) + '</option>'; }).join('') + '</select>';
}
ON.pickKelas = function (el) { S.ui.kelasId = el.value; S.draft = null; renderPage(true); };
function noKelasState() { return '<div class="pm-wrap"><div class="card">' + emptyState('bi-emoji-neutral', 'Belum ada ekstrakurikuler', 'Akun Anda belum ditautkan ke ekstrakurikuler. Hubungi Super Admin sekolah.') + '</div></div>'; }

function histCard(x) {
  const alpa = x.a > 0 ? 'style="color:var(--danger-tx);font-weight:600"' : '';
  return '<button type="button" class="hist" data-act="openSesi" data-id="' + h(x.id) + '"><div class="row between g8 top"><div><div class="fs12 muted">' + h(tglLong(x.tanggal)) + '</div><div class="b mt4" style="font-family:var(--f-head);font-size:16px">Pertemuan ke-' + x.pertemuan + ' • ' + h(x.kelasNama) + '</div></div>' + valBadge(x.status) + '</div>' +
    '<div class="cnts"><span class="dot"></span><span class="b">' + x.h + ' Hadir</span><span class="sp">•</span><span>' + x.s + ' Sakit</span><span class="sp">•</span><span>' + x.i + ' Izin</span><span class="sp">•</span><span ' + alpa + '>' + x.a + ' Alpa</span><i class="bi bi-chevron-right" style="margin-left:auto"></i></div></button>';
}

PAGES.home = function (el) {
  const k = curKelas(); if (!k) { el.innerHTML = noKelasState(); return; }
  const pm = S.pembina[0] || {}, home = S.home || {}, hi = (home.hariIni || []).find(function (x) { return x.idKelas === k.id; }) || {};
  const riw = (home.riwayat || []).filter(function (x) { return x.idKelas === k.id; });
  const jam = parseJam(k.jadwal), sesi = hi.sesi;
  let chip;
  if (sesi) chip = valBadge(sesi.status);
  else if (hi.scheduled && hi.berlangsung) chip = '<span class="chip blue"><span class="dot pulse"></span> Sesi Aktif</span>';
  else if (hi.scheduled) chip = '<span class="chip"><span class="dot warn"></span> ' + h(hi.label || 'Terjadwal') + '</span>';
  else chip = '<span class="chip"><span class="dot gray"></span> Tidak Ada Jadwal Hari Ini</span>';

  let hero;
  const total = k.jumlah;
  if (sesi && sesi.status === 'Divalidasi') {
    hero = '<div class="hero-amber" style="background:#0f766e"><span class="chip"><i class="bi bi-patch-check"></i> Presensi Hari Ini</span><h2>Presensi Tervalidasi ?</h2><p style="opacity:.9;margin-top:6px;font-size:14px">Sesi ' + h(k.nama) + ' hari ini sudah divalidasi oleh Waka Kesiswaan. Terima kasih!</p><button class="btn btn-cream btn-block mt16" data-act="openSesi" data-id="' + h(sesi.id) + '">Lihat Detail Presensi <i class="bi bi-arrow-right"></i></button></div>';
  } else if (sesi) {
    const ret = sesi.status === 'Dikembalikan';
    hero = '<div class="hero-amber"><div class="row between"><span class="chip"><i class="bi bi-' + (ret ? 'arrow-return-left' : 'hourglass-split') + '"></i> ' + (ret ? 'Perlu Revisi' : 'Menunggu Validasi') + '</span><span class="chip">' + total + ' Anggota</span></div><h2>' + (ret ? 'Presensi Dikembalikan' : 'Presensi Terkirim') + '</h2><p style="opacity:.92;margin-top:6px;font-size:14px">' + (ret ? h(sesi.catatanValidator || 'Periksa kembali data presensi Anda.') : 'Data & foto bukti sudah diterima. Anda masih bisa mengirim ulang sebelum divalidasi.') + '</p><button class="btn btn-cream btn-block mt16" data-act="goInput" data-tgl="' + h(sesi.tanggal) + '">' + (ret ? 'Perbaiki & Kirim Ulang' : 'Ubah / Kirim Ulang') + ' <i class="bi bi-arrow-right"></i></button></div>';
  } else {
    hero = '<div class="hero-amber"><div class="row between"><span class="chip"><i class="bi bi-hand-index-thumb"></i> Presensi Langsung Lapangan</span><span class="chip">' + total + ' Anggota</span></div><h2>+ Input Presensi Hari Ini</h2><p style="opacity:.92;margin-top:6px;font-size:14px">Sesi Latihan Rutin ' + h(k.nama) + ' SMAN 1 Kamal' + (hi.scheduled ? '' : ' (di luar jadwal rutin)') + '</p>' +
      '<div class="row g8 mt12 fs13" style="align-items:flex-start;opacity:.95"><i class="bi bi-camera"></i><span>Wajib 2 Foto Bukti (Kegiatan Lapangan &amp; Selfie Geotagging)</span></div><button class="btn btn-cream btn-block mt16" data-act="goInput" data-tgl="' + h(S.today) + '">Buka Formulir Lapangan <i class="bi bi-arrow-right"></i></button></div>';
  }
  const exp = Math.max(expectedInMonth(k), home.sesiBulan || 0), done = home.sesiBulan || 0;
  const prev = home.delta !== null && home.delta !== undefined ? Math.round((home.pctBulan - home.delta) * 10) / 10 : null;
  const fb = !!home.fallback;
  el.innerHTML = '<div class="pm-wrap page col g16">' + kelasPicker() +
    '<div class="card"><div class="row between top g8"><div class="pm-hello"><span class="avatar lg">' + h(ini(S.user.nama)) + '</span><div style="min-width:0"><div class="fs12 muted">' + greeting() + ',</div><div class="who trunc">' + h(S.user.nama) + '</div><div class="fs12 muted trunc">Pembina ' + h(k.nama) + ' • NIP: ' + h(pm.nip || '-') + '</div></div></div><span class="noshrink">' + chip + '</span></div>' +
    '<div class="info-box mt16 col" style="align-items:stretch;gap:8px"><div class="row g8"><i class="bi bi-calendar3"></i><span>' + h(tglLong(S.today)) + ' <span class="muted">•</span> ' + h(jam.a ? jam.a + ' - ' + jam.b + ' WIB' : k.jadwal) + '</span></div><div class="row g8"><i class="bi bi-geo-alt"></i><span>' + h(k.lokasi || '-') + '</span></div></div></div>' +
    hero +
    '<div class="grid g-2"><div class="card"><div class="row g12"><span class="ico"><i class="bi bi-pie-chart"></i></span><span class="tag ' + (fb ? 'gray' : (home.delta !== null && home.delta !== undefined && home.delta < 0 ? 'danger' : 'ok')) + '" style="margin-left:auto">' + (fb ? 'Bulan lalu' : (home.delta !== null && home.delta !== undefined ? (home.delta >= 0 ? '+' : '') + String(home.delta).replace('.', ',') + '%' : 'Baru')) + '</span></div><div class="fs13 t2 mt12">Kehadiran Bulan Ini</div><div class="b num" style="font-family:var(--f-head);font-size:32px;line-height:40px">' + pct(home.pctBulan) + '</div><div class="bar mt8"><i style="width:' + Math.min(100, home.pctBulan || 0) + '%"></i></div><div class="fs12 muted mt8">' + (fb ? 'Belum ada sesi bulan ini — menampilkan data bulan lalu' : (prev !== null ? 'vs bulan lalu (' + pct(prev) + ')' : 'Belum ada pembanding bulan lalu')) + '</div></div>' +
    '<div class="card"><div class="row g12"><span style="width:40px;height:40px;border-radius:10px;background:var(--primary-soft);color:var(--primary-deep);display:flex;align-items:center;justify-content:center"><i class="bi bi-calendar2-check"></i></span><span class="tag" style="margin-left:auto"><i class="bi bi-check2-all"></i> ' + (exp ? Math.round(done / exp * 100) : 0) + '%</span></div><div class="fs13 t2 mt12">Total Sesi Selesai</div><div class="b num" style="font-family:var(--f-head);font-size:32px;line-height:40px">' + done + ' <span style="font-size:18px;font-weight:500">Sesi</span></div><div class="bar mt8"><i style="width:' + (exp ? Math.min(100, done / exp * 100) : 0) + '%"></i></div><div class="fs12 muted mt8">Dari ' + exp + ' jadwal terencana</div></div></div>' +
    '<div><div class="row between mb8"><h3 style="font-size:18px">Aksi Cepat</h3><span class="fs12 muted">Operasional Lapangan</span></div><div class="qa"><button data-act="scanCard"><span class="ic p"><i class="bi bi-qr-code-scan"></i></span>Scan Kartu Siswa</button><button data-act="nav" data-p="peserta"><span class="ic"><i class="bi bi-people"></i></span>Daftar Anggota</button><button data-act="goCetak"><span class="ic"><i class="bi bi-file-earmark-text"></i></span>Unduh Rekap</button></div></div>' +
    '<div><div class="row between mb8"><div class="row g8"><h3 style="font-size:18px">Riwayat Sesi Terakhir</h3><span class="chip fs12">' + Math.min(3, riw.length) + ' Sesi</span></div><button class="btn btn-ghost btn-sm" data-act="nav" data-p="riwayat" style="color:var(--primary)">Semua <i class="bi bi-chevron-right"></i></button></div><div class="col g12">' +
    (riw.length ? riw.slice(0, 3).map(histCard).join('') : '<div class="card">' + emptyState('bi-journal', 'Belum ada riwayat presensi', 'Riwayat akan tampil setelah Anda mengirim presensi pertama.') + '</div>') + '</div></div></div>';
};
ACT.goInput = function (el) { navigate('input', { idKelas: (curKelas() || {}).id, tanggal: el.dataset.tgl || S.today }); };
ACT.goCetak = function () { navigate('cetak', { idKelas: (curKelas() || {}).id }); };
ACT.scanCard = function () {
  const k = curKelas(); if (!k) return;
  if (S.page !== 'input') navigate('input', { idKelas: k.id, tanggal: S.today });
  setTimeout(openScanner, 120);
};

// ---------------- BAGIAN 9: PEMBINA — INPUT PRESENSI ----------------
function draftKey(D) { return 'siabsens_draft_' + S.user.id + '_' + D.idKelas + '_' + D.tanggal; }
function membersOf(idKelas) { return S.peserta.filter(function (p) { return p.idKelas === idKelas && p.aktif; }).sort(function (a, b) { return a.nama < b.nama ? -1 : 1; }); }
function saveDraftLocal(silent) {
  const D = S.draft; if (!D) return;
  lsSet(draftKey(D), JSON.stringify({ entries: D.entries, catatan: D.catatan, ts: Date.now() }));
  D.dirty = false;
  const b = $('#draftInfo'); if (b) b.textContent = 'Draft tersimpan ' + pad(new Date().getHours()) + ':' + pad(new Date().getMinutes());
  if (!silent) toast('Draft tersimpan di perangkat ini.', 'ok');
}
const autosaveDraft = debounce(function () { saveDraftLocal(true); }, 800);
function initDraft(k, tanggal) {
  const D = S.draft = { idKelas: k.id, tanggal: tanggal, entries: {}, catatan: '', fotoKegiatan: null, fotoSelfie: null, gps: { state: 'wait' }, expanded: false, q: '', dirty: false, existing: null, loading: false, blocked: false };
  try { const raw = lsGet(draftKey(D)); if (raw) { const o = JSON.parse(raw); D.entries = o.entries || {}; D.catatan = o.catatan || ''; D.restored = true; } } catch (e) { }
  const ex = ((S.home && S.home.riwayat) || []).find(function (x) { return x.idKelas === k.id && x.tanggal === tanggal; });
  if (ex) {
    if (ex.status === 'Divalidasi') { D.blocked = true; D.existing = ex; }
    else {
      D.existing = ex; D.loading = true;
      call('getSesiDetail', ex.id).then(function (d) {
        if (S.draft !== D) return;
        if (!D.restored) {
          d.rows.forEach(function (r) { D.entries[r.idPeserta] = { s: r.status, k: r.ket || '' }; });
          D.catatan = d.sesi.catatan || '';
        }
        D.revisiNote = ex.status === 'Dikembalikan' ? ex.catatanValidator : '';
        D.loading = false; if (S.page === 'input') renderPage(true);
      }).catch(function (e) { D.loading = false; toast(errMsg(e), 'danger'); if (S.page === 'input') renderPage(true); });
    }
  }
}
function counts() {
  const D = S.draft, c = { Hadir: 0, Sakit: 0, Izin: 0, Alpa: 0, belum: 0 }, list = membersOf(D.idKelas);
  list.forEach(function (p) { const e = D.entries[p.id]; if (e && c[e.s] !== undefined) c[e.s]++; else c.belum++; });
  c.total = list.length; return c;
}
function noteChip(p) {
  const e = S.draft.entries[p.id] || {};
  if (!e.s || e.s === 'Hadir') return '';
  if (e.s === 'Alpa') return '<button type="button" class="note-chip red" data-act="noteEdit" data-id="' + h(p.id) + '"><i class="bi bi-exclamation-circle"></i> ' + h(e.k || 'Tanpa Keterangan') + '</button>';
  return '<button type="button" class="note-chip" data-act="noteEdit" data-id="' + h(p.id) + '"><i class="bi bi-paperclip"></i> ' + h(e.k || '+ Keterangan') + '</button>';
}
function memRow(p) {
  const e = S.draft.entries[p.id] || {}, s = e.s || '';
  return '<div class="mem" data-row="' + h(p.id) + '"><div class="top"><span class="avatar">' + h(ini(p.nama)) + '</span><div class="grow"><div class="nm trunc">' + h(p.nama) + '</div><div class="fs12 muted">NISN: ' + h(p.nisn) + ' • ' + h(p.kelasJur) + '</div></div><span data-notechip>' + noteChip(p) + '</span></div>' +
    '<div class="seg-st" role="group" aria-label="Status kehadiran ' + h(p.nama) + '">' + STATUS.map(function (st) { return '<button type="button" data-act="setSt" data-id="' + h(p.id) + '" data-s="' + st + '" class="' + (s === st ? 'on' : '') + '" aria-pressed="' + (s === st) + '" aria-label="' + st + '" title="' + st + '">' + (s === st ? '<i class="bi bi-check2"></i> ' : '') + st.charAt(0) + '</button>'; }).join('') + '</div></div>';
}
function renderMemberList() {
  const D = S.draft, box = $('#memList'); if (!box) return;
  let list = membersOf(D.idKelas); const q = D.q.trim().toLowerCase();
  if (q) list = list.filter(function (p) { return (p.nama + ' ' + p.nisn + ' ' + p.kelasJur).toLowerCase().indexOf(q) >= 0; });
  const show = (D.expanded || q) ? list : list.slice(0, 5), rest = list.length - show.length;
  box.innerHTML = (show.length ? show.map(memRow).join('') : '<div class="card">' + emptyState('bi-search', 'Peserta tidak ditemukan') + '</div>') +
    (rest > 0 ? '<button type="button" class="btn btn-soft btn-block mt12" data-act="expandList"><i class="bi bi-chevron-down"></i> Tampilkan ' + rest + ' Siswa Lainnya…</button>' : '');
}
function renderSummary() {
  const c = counts(), el = $('#sumTiles'); if (!el) return;
  $('#sumTotal').textContent = 'Total Siswa: ' + c.total;
  el.innerHTML = '<div class="tile h"><div class="k">Hadir</div><div class="n">' + c.Hadir + '</div></div><div class="tile s"><div class="k">Sakit</div><div class="n">' + c.Sakit + '</div></div><div class="tile i"><div class="k">Izin</div><div class="n">' + c.Izin + '</div></div><div class="tile a"><div class="k">Alpa</div><div class="n">' + c.Alpa + '</div></div>';
  const b = $('#sumBelum'); if (b) { b.textContent = c.belum ? c.belum + ' peserta belum ditandai' : 'Semua peserta sudah ditandai ?'; b.style.color = c.belum ? 'var(--warn-tx)' : 'var(--ok-tx)'; }
}
function applyStatus(id, st) {
  const D = S.draft, old = D.entries[id] || {};
  D.entries[id] = { s: st, k: st === 'Hadir' ? '' : (old.k || '') };
  D.dirty = true; autosaveDraft();
  const row = $('[data-row="' + id + '"]');
  if (row) { $$('.seg-st button', row).forEach(function (b) { const on = b.dataset.s === st; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.innerHTML = (on ? '<i class="bi bi-check2"></i> ' : '') + b.dataset.s.charAt(0); }); const nc = $('[data-notechip]', row); if (nc) nc.innerHTML = noteChip(S.peserta.find(function (p) { return p.id === id; })); }
  renderSummary();
}
ACT.setSt = function (el) { applyStatus(el.dataset.id, el.dataset.s); };
ACT.expandList = function () { S.draft.expanded = true; renderMemberList(); };
ACT.markAll = function () {
  const D = S.draft; membersOf(D.idKelas).forEach(function (p) { const e = D.entries[p.id]; if (!e || !e.s) D.entries[p.id] = { s: 'Hadir', k: '' }; });
  D.dirty = true; autosaveDraft(); renderMemberList(); renderSummary(); toast('Peserta yang belum ditandai diset Hadir. Ubah yang tidak hadir secara manual.', 'ok');
};
ON.memSearch = debounce(function (el) { S.draft.q = el.value; renderMemberList(); }, 120);
ON.catatan = function (el) { S.draft.catatan = el.value.slice(0, 250); $('#catCount').textContent = S.draft.catatan.length + '/250 karakter'; S.draft.dirty = true; autosaveDraft(); };
ACT.mic = function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Pencarian suara tidak didukung di browser ini.', 'warn'); return; }
  const r = new SR(); r.lang = 'id-ID'; r.onresult = function (e) { const t = e.results[0][0].transcript; const i = $('#memQ'); i.value = t; S.draft.q = t; renderMemberList(); };
  r.onerror = function () { toast('Suara tidak terdeteksi.', 'warn'); }; try { r.start(); toast('Silakan sebutkan nama siswa…', 'info'); } catch (e) { }
};
ACT.noteEdit = function (el) {
  const id = el.dataset.id, D = S.draft, p = S.peserta.find(function (x) { return x.id === id; }), e = D.entries[id] || {};
  const opts = e.s === 'Sakit' ? ['Surat dokter', 'Surat dokter via WA', 'Sakit (info orang tua)'] : e.s === 'Izin' ? ['Surat orang tua', 'Dispensasi OSIS', 'Mewakili sekolah', 'Keperluan keluarga'] : ['Tanpa keterangan', 'Tidak ada kabar'];
  const m = openModal({ size: 'sm', title: 'Keterangan: ' + h(p.nama), body: '<div class="row g8 wrap mb16">' + opts.map(function (o) { return '<button type="button" class="chip" data-q="' + h(o) + '" style="cursor:pointer">' + h(o) + '</button>'; }).join('') + '</div><div class="field" style="margin:0"><label>Keterangan (opsional)</label><input class="inp" id="noteInp" maxlength="120" value="' + h(e.k || '') + '" placeholder="mis. Surat dokter terlampir"></div>', footer: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="noteOk">Simpan</button>' });
  m.qa('[data-q]').forEach(function (b) { b.onclick = function () { m.q('#noteInp').value = b.dataset.q; }; });
  m.q('[data-x]').onclick = m.close;
  m.q('#noteOk').onclick = function () { D.entries[id] = { s: e.s, k: m.q('#noteInp').value.trim() }; D.dirty = true; autosaveDraft(); const row = $('[data-row="' + id + '"] [data-notechip]'); if (row) row.innerHTML = noteChip(p); m.close(); };
};
ACT.pickFoto = function (el) { $(el.dataset.j === 'selfie' ? '#fileSelfie' : '#fileKegiatan').click(); };
function photoCard(idx, kind, title, desc, val) {
  const need = S.cfg.wajibFoto === 'TRUE';
  return '<div class="photo-card"><div class="row between top g8"><div><div class="b" style="font-family:var(--f-head);font-size:15px">' + idx + '. ' + h(title) + '</div><div class="fs12 muted mt4">' + h(desc) + '</div></div>' +
    (val ? '<span class="badge b-ok"><i class="bi bi-check-circle-fill"></i> Sudah Terunggah</span>' : (need ? '<span class="badge b-danger">Wajib Diunggah</span>' : '<span class="badge b-gray">Opsional</span>')) + '</div><div class="mt12">' +
    (val ? '<div class="photo-frame" style="aspect-ratio:16/10"><img src="' + val.dataUrl + '" alt="' + h(title) + '"><div class="ov"><span></span><button type="button" data-act="pickFoto" data-j="' + kind + '"><i class="bi bi-camera"></i> Retake</button></div></div>' :
      '<button type="button" class="upload-zone" data-act="pickFoto" data-j="' + kind + '"><i class="bi bi-camera"></i><b>Ambil Foto</b><span class="fs12">Kamera langsung / pilih dari galeri</span></button>') + '</div></div>';
}
function renderPhotos() {
  const box = $('#photoBox'), D = S.draft; if (!box) return;
  box.innerHTML = photoCard(1, 'kegiatan', 'Foto Kegiatan di Lapangan', 'Menampilkan formasi barisan & anggota yang hadir', D.fotoKegiatan) +
    photoCard(2, 'selfie', 'Foto Selfie Pembina di Lokasi', 'Otentikasi kehadiran instruktur pembina', D.fotoSelfie);
}

PAGES.input = function (el) {
  const k = S.kmap[S.params.idKelas] || curKelas(); if (!k) { el.innerHTML = noKelasState(); return; }
  if (S.ui.kelasId !== k.id) S.ui.kelasId = k.id;
  const tanggal = S.params.tanggal || S.today;
  if (!S.draft || S.draft.idKelas !== k.id || S.draft.tanggal !== tanggal) { initDraft(k, tanggal); }
  const D = S.draft;
  const pertemuan = D.existing && D.existing.pertemuan ? D.existing.pertemuan : 1 + ((S.home && S.home.riwayat) || []).filter(function (x) { return x.idKelas === k.id && x.tanggal.slice(0, 7) === tanggal.slice(0, 7) && x.tanggal < tanggal; }).length;
  if (D.blocked) {
    el.innerHTML = '<div class="pm-wrap page">' + kelasPicker() + '<div class="card">' + emptyState('bi-patch-check', 'Presensi tanggal ini sudah divalidasi', 'Data presensi ' + k.nama + ' pada ' + tglIndo(tanggal) + ' telah divalidasi Waka Kesiswaan dan tidak dapat diubah. Hubungi Waka Kesiswaan jika ada koreksi.') + '<div class="center"><button class="btn btn-primary" data-act="openSesi" data-id="' + h(D.existing.id) + '">Lihat Detail Presensi</button></div></div></div>';
    return;
  }
  const members = membersOf(k.id);
  if (!members.length) { el.innerHTML = '<div class="pm-wrap page"><div class="card">' + emptyState('bi-people', 'Belum ada peserta aktif', 'Hubungi Super Admin untuk menambahkan peserta ke ekstrakurikuler ini.') + '</div></div>'; return; }
  el.innerHTML = '<div class="pm-wrap page col g16">' + kelasPicker() +
    '<div><div class="pi-head"><h1>Input Presensi: ' + h(k.nama) + '</h1></div><div class="row g8 wrap mt12"><span class="chip"><i class="bi bi-calendar3"></i> ' + h(tglLong(tanggal).replace(/^(\w+), (\d+) (\w+) (\d+)$/, function (m0, a, b, c, d) { return a.slice(0, 5) + ', ' + b + ' ' + c.slice(0, 3) + ' ' + d; })) + '</span><span class="chip blue">Pertemuan Ke-' + pertemuan + '</span><span class="chip">Sesi Lapangan</span>' + (D.existing ? '<span class="chip" style="background:var(--tert-soft);color:var(--tert)"><i class="bi bi-pencil"></i> Kirim ulang</span>' : '') + '</div></div>' +
    (D.revisiNote ? '<div class="note-box danger"><div class="t"><i class="bi bi-arrow-return-left"></i> Catatan revisi dari Waka Kesiswaan</div>' + h(D.revisiNote) + '</div>' : '') +
    (D.loading ? '<div class="skel" style="height:60px"></div>' : '') +
    '<div class="gps wait" id="gpsCard"></div>' +
    '<div class="card"><div class="row between mb8"><h3 class="row g8" style="font-size:15px"><i class="bi bi-bar-chart-fill" style="color:var(--primary)"></i> Ringkasan Kehadiran</h3><span class="fs12 muted" id="sumTotal"></span></div><div class="grid g-4" style="grid-template-columns:repeat(4,1fr);gap:8px" id="sumTiles"></div><div class="fs12 mt8 center" id="sumBelum"></div><button type="button" class="btn btn-soft btn-block mt12" data-act="markAll"><i class="bi bi-check2-all"></i> Tandai Semua Hadir</button></div>' +
    '<div><div class="row between mb8"><h3 style="font-size:16px">Daftar Presensi Anggota</h3><span class="fs12 muted">Tap status untuk mengubah</span></div><div class="mem-search mb8"><div class="inp-wrap"><i class="bi bi-search lead"></i><input class="inp pl" id="memQ" type="search" placeholder="Cari nama atau NISN siswa..." value="' + h(D.q) + '" data-on="memSearch" style="padding-right:44px" autocomplete="off"></div><button type="button" class="mic" data-act="mic" aria-label="Cari dengan suara"><i class="bi bi-mic"></i></button></div><div id="memList"></div></div>' +
    '<div><div class="row between mb8"><h3 class="row g8" style="font-size:16px"><i class="bi bi-camera" style="color:var(--primary)"></i> Bukti Foto Lapangan</h3>' + (S.cfg.wajibFoto === 'TRUE' ? '<span class="badge b-danger">Wajib Diunggah</span>' : '<span class="badge b-gray">Opsional</span>') + '</div><div id="photoBox"></div></div>' +
    '<div class="card"><div class="row between mb8"><h3 class="row g8" style="font-size:15px"><i class="bi bi-pencil-square" style="color:var(--primary)"></i> Catatan Pembina</h3><span class="fs12 muted">Opsional</span></div><textarea class="txt" maxlength="250" data-on="catatan" placeholder="Tulis ringkasan kegiatan, kendala, atau catatan penting…">' + h(D.catatan) + '</textarea><div class="right fs12 muted mt4" id="catCount">' + D.catatan.length + '/250 karakter</div></div>' +
    '<div class="sticky-act"><div class="row g8"><button type="button" class="btn btn-secondary btn-lg" data-act="saveDraft" style="flex:0 0 auto"><i class="bi bi-floppy"></i> Simpan Draft</button><button type="button" class="btn btn-accent btn-lg grow" id="btnSubmit" data-act="submitAbsensi">Kirim ke Waka <i class="bi bi-send"></i></button></div><div class="sync"><i class="bi bi-arrow-repeat"></i> Data langsung tersinkron ke Google Sheets &amp; Drive SMAN 1 Kamal <span id="draftInfo" style="margin-left:6px"></span></div></div></div>';
  renderMemberList(); renderSummary(); renderPhotos(); renderGps(); startGps();
  if (D.restored) { D.restored = false; toast('Draft presensi sebelumnya dipulihkan.', 'info'); }
};
ACT.saveDraft = function () { saveDraftLocal(false); };
ACT.submitAbsensi = async function (btn) {
  const D = S.draft, k = S.kmap[D.idKelas], c = counts();
  if (c.belum > 0) {
    const first = membersOf(D.idKelas).find(function (p) { return !(D.entries[p.id] && D.entries[p.id].s); });
    D.expanded = true; D.q = ''; renderMemberList(); const qi = $('#memQ'); if (qi) qi.value = '';
    toast(c.belum + ' peserta belum ditandai (mis. ' + first.nama + '). Lengkapi atau gunakan “Tandai Semua Hadir”.', 'warn', 'Presensi belum lengkap');
    const row = $('[data-row="' + first.id + '"]'); if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  if (S.cfg.wajibFoto === 'TRUE' && (!D.fotoKegiatan || !D.fotoSelfie)) { toast('Foto kegiatan dan foto selfie pembina wajib diunggah.', 'warn', 'Bukti foto belum lengkap'); const b = $('#photoBox'); if (b) b.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
  if (S.cfg.wajibGPS === 'TRUE' && (!D.gps || D.gps.state !== 'ok')) { toast('Lokasi GPS harus aktif dan berada dalam radius sekolah.', 'warn', 'GPS belum valid'); return; }
  const payload = {
    idKelas: D.idKelas, tanggal: D.tanggal, catatan: D.catatan,
    entries: membersOf(D.idKelas).map(function (p) { return { id: p.id, s: D.entries[p.id].s, k: D.entries[p.id].k || '' }; }),
    gps: D.gps && D.gps.lat ? { lat: D.gps.lat, lng: D.gps.lng } : null,
    fotoKegiatan: D.fotoKegiatan ? { data: D.fotoKegiatan.b64, mime: D.fotoKegiatan.mime } : null,
    fotoSelfie: D.fotoSelfie ? { data: D.fotoSelfie.b64, mime: D.fotoSelfie.mime } : null
  };
  await withBusy(btn, async function () {
    try {
      const r = await call('submitAbsensi', payload);
      lsDel(draftKey(D)); S.draft = null; stopGps();
      showSubmitSuccess(r);
      refreshData(true);
    } catch (e) { saveDraftLocal(true); toast(errMsg(e) + ' (draft tetap aman di perangkat)', 'danger', 'Gagal mengirim'); }
  }, 'Mengirim ke Waka…');
};
function showSubmitSuccess(r) {
  const waktu = tglIndo(String(r.waktu).slice(0, 10)).replace(/ (\w{3})\w* /, ' $1 ') + ' • ' + clockHM(r.waktu) + ' WIB';
  const m = openModal({
    size: 'sm', title: '&nbsp;', static: true, noClose: true,
    body: '<div class="center"><div class="success-ic"><i class="bi bi-check-lg"></i></div><h3 style="font-size:20px">Presensi Berhasil Dikirim!</h3><p class="t2 fs13 mt8" style="line-height:19px">Data kehadiran &amp; ' + r.foto + ' bukti foto telah tersinkronisasi dan diteruskan ke Waka Kesiswaan untuk divalidasi.</p></div>' +
      '<div class="recap"><div class="r"><span class="fs11 b" style="letter-spacing:.06em">ID PENGIRIMAN</span><b class="mono" style="color:var(--primary-deep)">#' + h(r.kode) + '</b></div><div class="r" style="border-top:1px solid var(--border);margin-top:4px;padding-top:10px"><span>Ekstrakurikuler</span><b>' + h(r.kelasNama) + '</b></div><div class="r"><span>Waktu Kirim</span><b>' + h(waktu) + '</b></div><div class="r"><span>Total Presensi</span><b>' + r.total + ' Siswa</b></div>' +
      '<div class="row g8 mt8"><span class="badge b-hadir">' + r.counts.H + ' H</span><span class="badge b-sakit">' + r.counts.S + ' S</span><span class="badge b-izin">' + r.counts.I + ' I</span><span class="badge b-alfa">' + r.counts.A + ' A</span></div>' +
      '<div class="row g8 mt12 fs12 t2" style="border-top:1px solid var(--border);padding-top:10px"><i class="bi bi-cloud-check" style="color:var(--primary)"></i> ' + r.foto + ' Foto tersimpan di Drive &amp; terdata di Sheets</div><div class="r mt8"><span class="fs12">Status Verifikasi:</span><span class="badge b-tert"><i class="bi bi-hourglass-split"></i> Menunggu Validasi Waka</span></div></div>' +
      '<button class="btn btn-primary btn-lg btn-block" id="okHome">Kembali ke Beranda <i class="bi bi-arrow-right"></i></button><button class="btn btn-secondary btn-block mt8" id="okShare"><i class="bi bi-share"></i> Bagikan Bukti ke Grup WhatsApp</button>'
  });
  m.q('#okHome').onclick = function () { m.close(); navigate('home', {}, true); };
  m.q('#okShare').onclick = async function () {
    const txt = 'Presensi ' + r.kelasNama + ' — ' + tglIndo(r.tanggal) + '\nID: ' + r.kode + '\nHadir ' + r.counts.H + ' • Sakit ' + r.counts.S + ' • Izin ' + r.counts.I + ' • Alpa ' + r.counts.A + ' (total ' + r.total + ' siswa)\nStatus: menunggu validasi Waka Kesiswaan.';
    if (navigator.share) { try { await navigator.share({ text: txt }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    toast((await copyText(txt)) ? 'Ringkasan disalin. Tempel di grup WhatsApp.' : 'Tidak dapat menyalin ringkasan.', 'ok');
  };
}

// -- Scanner kartu siswa --
let scanStream = null, scanTimer = null;
function stopScan() { clearInterval(scanTimer); scanTimer = null; if (scanStream) { scanStream.getTracks().forEach(function (t) { t.stop(); }); scanStream = null; } }
// Bunyi "ting" saat absen via barcode/QR diterima sistem (Web Audio API, tanpa file suara eksternal)
let _beepCtx = null;
function beepOk() {
  try {
    if (!_beepCtx) _beepCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_beepCtx.state === 'suspended') _beepCtx.resume();
    const ctx = _beepCtx, t0 = ctx.currentTime;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(1046.5, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + 0.18);
  } catch (e) { /* perangkat/izin audio tidak mendukung, diamkan */ }
}
function markByCode(code, log) {
  const D = S.draft; if (!D) return false;
  // GS1 QR: isi terbaca "91<NISN>" (kadang diawali ]Q3 / dengan tanda kurung / karakter pemisah GS)
  const raw = String(code || '').replace(/^\]Q[0-3]/, '').replace(/[\u0000-\u001f()\s]/g, '').trim();
  if (!raw) return false;
  const members = membersOf(D.idKelas), cands = /^91./.test(raw) ? [raw.slice(2), raw] : [raw];
  let p = null;
  for (let i = 0; i < cands.length && !p; i++) p = members.find(function (x) { return x.nisn === cands[i] || x.noInduk === cands[i]; });
  if (!p) p = members.find(function (x) { return x.nisn.length >= 5 && raw.indexOf(x.nisn) >= 0; });
  if (!p) { log('? Kode “' + raw.slice(0, 24) + '” tidak dikenali pada ekstrakurikuler ini.', true); return false; }
  applyStatus(p.id, 'Hadir'); renderMemberList(); beepOk();
  log('? ' + p.nama + ' ditandai Hadir', false); return true;
}
function openScanner() {
  const D = S.draft; if (!D) { toast('Buka halaman presensi terlebih dahulu.', 'warn'); return; }
  const m = openModal({ title: 'Scan Kartu Siswa', onClose: stopScan, noFocus: true,
    body: '<div class="scan-view"><video id="scanVid" playsinline muted></video><div class="box"><i></i><i></i><i></i><i></i></div></div><p class="hint center" id="scanHint">Memulai kamera…</p><div class="field mt12"><label>Atau ketik NISN / No. Induk</label><div class="row g8"><input class="inp" id="scanNisn" inputmode="numeric" placeholder="mis. 0081234501"><button class="btn btn-primary" id="scanAdd">Tandai Hadir</button></div></div><div id="scanLog" class="fs13 col g4" style="max-height:120px;overflow:auto"></div>',
    footer: '<button class="btn btn-primary" data-x>Selesai</button>' });
  m.q('[data-x]').onclick = m.close;
  const logEl = m.q('#scanLog');
  const log = function (t, bad) { const d = document.createElement('div'); d.style.color = bad ? 'var(--danger-tx)' : 'var(--ok-tx)'; d.textContent = t; logEl.prepend(d); };
  const manual = function () { const v = m.q('#scanNisn'); if (markByCode(v.value, log)) { v.value = ''; } };
  m.q('#scanAdd').onclick = manual;
  m.q('#scanNisn').addEventListener('keydown', function (e) { if (e.key === 'Enter') manual(); });
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { m.q('#scanHint').textContent = 'Pemindai kamera tidak didukung browser ini. Gunakan input NISN manual di bawah.'; return; }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (stream) {
    scanStream = stream; const v = m.q('#scanVid'); if (!v) { stopScan(); return; }
    v.srcObject = stream; v.play(); m.q('#scanHint').textContent = 'Arahkan kamera ke QR/barcode kartu siswa.';
    const det = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'code_39'] }); let last = '', lastT = 0;
    scanTimer = setInterval(function () {
      if (v.readyState < 2) return;
      det.detect(v).then(function (res) { if (res && res[0]) { const val = res[0].rawValue, now = Date.now(); if (val !== last || now - lastT > 3000) { last = val; lastT = now; markByCode(val, log); } } }).catch(function () { });
    }, 350);
  }).catch(function () { const hn = m.q('#scanHint'); if (hn) hn.textContent = 'Kamera tidak dapat diakses (izin ditolak). Gunakan input NISN manual di bawah.'; });
}

// ---------------- BAGIAN 10: PEMBINA — PESERTA & RIWAYAT ----------------
function pgPesertaPembina(el) {
  const k = curKelas(); if (!k) { el.innerHTML = noKelasState(); return; }
  S.ui.pp = S.ui.pp || { q: '' };
  el.innerHTML = '<div class="pm-wrap page col g16">' + kelasPicker() + '<div><h1 style="font-size:26px;line-height:32px;font-weight:800">Anggota ' + h(k.nama) + '</h1><p class="t2 fs13 mt4">' + membersOf(k.id).length + ' peserta aktif • data khusus ekstrakurikuler Anda</p></div>' +
    '<div class="inp-wrap"><i class="bi bi-search lead"></i><input class="inp pl" type="search" id="ppQ" placeholder="Cari nama, NISN, atau No. Induk…" value="' + h(S.ui.pp.q) + '" data-on="ppSearch" autocomplete="off"></div><div id="ppList" class="col g8"></div></div>';
  renderPP();
}
function renderPP() {
  const k = curKelas(), q = S.ui.pp.q.trim().toLowerCase(); let list = membersOf(k.id);
  if (q) list = list.filter(function (p) { return (p.nama + ' ' + p.nisn + ' ' + p.noInduk + ' ' + p.kelasJur).toLowerCase().indexOf(q) >= 0; });
  $('#ppList').innerHTML = list.length ? list.map(function (p) {
    return '<div class="mem"><div class="row g12"><span class="avatar">' + h(ini(p.nama)) + '</span><div class="grow"><div class="nm trunc">' + h(p.nama) + '</div><div class="fs12 muted num">NISN ' + h(p.nisn) + ' • ' + h(p.kelasJur) + '</div></div>' + (p.pct !== null ? '<span class="tag ' + (pctClass(p.pct) === 'ok' ? 'ok' : pctClass(p.pct) === 'warn' ? 'warn' : 'danger') + '">' + pct(p.pct) + '</span>' : '<span class="tag gray">—</span>') + '</div></div>';
  }).join('') : '<div class="card">' + emptyState('bi-search', 'Peserta tidak ditemukan', 'Coba kata kunci lain.') + '</div>';
}
ON.ppSearch = debounce(function (el) { S.ui.pp.q = el.value; renderPP(); }, 120);

PAGES.riwayat = function (el) {
  const k = curKelas(); if (!k) { el.innerHTML = noKelasState(); return; }
  const all = ((S.home && S.home.riwayat) || []).filter(function (x) { return x.idKelas === k.id; });
  const months = Array.from(new Set(all.map(function (x) { return x.tanggal.slice(0, 7); })));
  S.ui.rw = S.ui.rw || { bulan: '' };
  const list = S.ui.rw.bulan ? all.filter(function (x) { return x.tanggal.slice(0, 7) === S.ui.rw.bulan; }) : all;
  el.innerHTML = '<div class="pm-wrap page col g16">' + kelasPicker() + '<div class="row between g8 wrap"><div><h1 style="font-size:26px;line-height:32px;font-weight:800">Riwayat Presensi</h1><p class="t2 fs13 mt4">' + h(k.nama) + ' • ' + list.length + ' sesi</p></div><button class="btn btn-soft" data-act="goCetak"><i class="bi bi-file-earmark-text"></i> Unduh Rekap</button></div>' +
    '<select class="sel" data-onchange="rwBulan" aria-label="Filter bulan"><option value="">Semua bulan</option>' + months.map(function (m) { return '<option value="' + m + '"' + (S.ui.rw.bulan === m ? ' selected' : '') + '>' + h(bulanLabel(m)) + '</option>'; }).join('') + '</select>' +
    '<div class="col g12">' + (list.length ? list.map(histCard).join('') : '<div class="card">' + emptyState('bi-journal', 'Belum ada riwayat') + '</div>') + '</div></div>';
};
ON.rwBulan = function (el) { S.ui.rw.bulan = el.value; renderPage(true); };

// ---------------- BAGIAN 11: ADMIN/SUPER — UTIL BERSAMA ----------------
function chartColors() {
  const d = isDark();
  return { text: d ? '#b6c1d9' : '#64748b', grid: d ? '#26344f' : '#e2e8f0', line: d ? '#e6ebf5' : '#0f172a', bar: d ? '#4f83f5' : '#2563eb', barSoft: d ? '#2d4a8f' : '#8fa7fe', amber: '#f59e0b' };
}
function donutSvg(segs, total, size) {
  size = size || 150; const r = 54, c = 2 * Math.PI * r; let off = 0;
  const sum = segs.reduce(function (a, s) { return a + s.v; }, 0) || 1;
  let arcs = '<circle cx="75" cy="75" r="' + r + '" fill="none" stroke="var(--surface-3)" stroke-width="16"/>';
  segs.forEach(function (s) {
    if (!s.v) return;
    const len = s.v / sum * c;
    arcs += '<circle cx="75" cy="75" r="' + r + '" fill="none" stroke="' + s.color + '" stroke-width="16" stroke-dasharray="' + len + ' ' + (c - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 75 75)"/>';
    off += len;
  });
  return '<div class="donut" style="width:' + size + 'px;height:' + size + 'px"><svg viewBox="0 0 150 150" width="100%" height="100%" role="img" aria-label="Diagram status presensi">' + arcs + '</svg><div class="mid"><b>' + total + '</b><span>TOTAL SESI</span></div></div>';
}
const barLabelPlugin = {
  id: 'barLabels',
  afterDatasetsDraw: function (chart) {
    const ds = chart.data.datasets[0], meta = chart.getDatasetMeta(0), ctx = chart.ctx, col = chartColors();
    ctx.save(); ctx.font = '600 11px Inter, sans-serif'; ctx.fillStyle = col.text; ctx.textAlign = 'center';
    meta.data.forEach(function (bar, i) { const v = ds.data[i]; if (v !== null && v !== undefined) ctx.fillText(String(v).replace('.', ',') + '%', bar.x, bar.y - 22); });
    ctx.restore();
  }
};
function makeChart(key, id, cfg) {
  const cv = document.getElementById(id);
  if (!cv) return;
  if (!window.Chart) { cv.parentNode.innerHTML = '<div class="empty"><i class="bi bi-bar-chart"></i>Pustaka grafik gagal dimuat. Periksa koneksi internet.</div>'; return; }
  try { S.charts[key] = new Chart(cv, cfg); } catch (e) { console.error(e); }
}
function monStatusPill(r) {
  switch (r.code) {
    case 'menunggu': return '<span class="badge b-tert"><span class="dot tert"></span> Menunggu Validasi</span>';
    case 'divalidasi': return '<span class="badge b-blue"><i class="bi bi-check-circle"></i> Sudah Divalidasi</span>';
    case 'dikembalikan': return '<span class="badge b-danger"><i class="bi bi-arrow-return-left"></i> Dikembalikan</span>';
    case 'belum-input': return '<span class="badge b-danger"><span class="dot danger"></span> Belum Input Presensi</span>';
    case 'belum-mulai': return '<span class="badge b-gray"><i class="bi bi-calendar-event"></i> ' + (r.dayOffsetLabel || 'Belum Mulai') + '</span>';
    default: return '<span class="badge b-gray"><i class="bi bi-calendar-x"></i> Tidak Ada Jadwal</span>';
  }
}
function statusFilterOptions(sel) {
  return [['', 'Semua Status'], ['menunggu', 'Menunggu Validasi'], ['divalidasi', 'Sudah Divalidasi'], ['dikembalikan', 'Dikembalikan'], ['belum-input', 'Belum Input'], ['lainnya', 'Belum Mulai / Tidak Terjadwal']]
    .map(function (o) { return '<option value="' + o[0] + '"' + (sel === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
}
function matchStatus(r, st) {
  if (!st) return true;
  if (st === 'lainnya') return r.code === 'belum-mulai' || r.code === 'tidak-terjadwal';
  return r.code === st;
}
function openDetailFor(sesiId) { if (isAdmin()) navigate('validasi', { id: sesiId }); else openSesiModal(sesiId); }
ACT.openDetailFor = function (el) { openDetailFor(el.dataset.id); };
ACT.viewPhotoSesi = async function (el) {
  try { toast('Memuat foto…', 'info'); const p = await fetchPhoto(el.dataset.id, el.dataset.j); viewPhotoFull(p.src, p.name); }
  catch (e) { toast(errMsg(e), 'danger'); }
};
ACT.kelasDetail = function (el) {
  const k = S.kmap[el.dataset.id]; if (!k) return;
  const m = openModal({ title: h(k.nama), body:
    '<div class="row g12 mb16">' + ekBadge(k) + '<div><div class="b">' + h(k.kategori) + '</div><div class="fs12 muted">Kode ' + h(k.kode) + '</div></div></div>' +
    '<div class="recap" style="margin:0"><div class="r"><span>Pembina</span><b>' + h(k.pembina) + '</b></div><div class="r"><span>Jadwal</span><b>' + h(k.hari.split(',').join(' & ')) + ' • ' + h(jamLabel(k)) + '</b></div><div class="r"><span>Lokasi</span><b>' + h(k.lokasi || '-') + '</b></div><div class="r"><span>Peserta aktif</span><b>' + k.jumlah + ' siswa</b></div><div class="r"><span>Status</span><b>' + h(k.status) + '</b></div></div>',
    footer: '<button class="btn btn-secondary" data-x>Tutup</button><button class="btn btn-primary" id="kdRekap"><i class="bi bi-file-earmark-text"></i> Lihat Rekap</button>' });
  m.q('[data-x]').onclick = m.close; m.q('#kdRekap').onclick = function () { m.close(); navigate('cetak', { idKelas: k.id }); };
};

// ---------------- BAGIAN 12: DASHBOARD EKSEKUTIF ----------------
PAGES.dashboard = function (el) {
  const d = S.dash, k = d.kpi, mon = S.mon, dn = d.donut;
  const ui = S.ui.dash = S.ui.dash || { st: '', page: 1 };
  const pend = S.pending, names = pend.slice(0, 4).map(function (x) { return x.kelasNama; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
  const banner = pend.length ? '<div class="alert-tert"><div class="ic"><i class="bi bi-hammer"></i></div><div class="grow"><div class="row g8 wrap"><h3>' + pend.length + ' Sesi Presensi Menunggu Validasi Waka Kesiswaan</h3><span class="badge" style="background:var(--danger-bg);color:var(--danger-tx);font-size:11px">Tindakan Diperlukan</span></div><p class="t2 fs13 mt4">Sesi latihan ini membutuhkan verifikasi berkas dan tanda tangan digital: <b>' + h(names.join(', ')) + (pend.length > names.length ? ', dll.' : '') + '</b>.</p></div>' +
    (isAdmin() ? '<button class="btn btn-accent" data-act="nav" data-p="validasi" style="flex-direction:column;gap:0;min-height:64px;padding:8px 22px;line-height:18px"><span><i class="bi bi-gear-wide-connected"></i></span><span>Tinjau &amp; Validasi Sekarang <span class="badge" style="background:#fff;color:var(--tert);margin-left:4px">' + pend.length + '</span></span></button>' : '<button class="btn btn-accent" data-act="nav" data-p="monitoring">Lihat di Monitoring</button>') + '</div>' : '';
  const delta = k.fallback ? '<span class="tag gray">Data bulan lalu</span>' : k.delta === null || k.delta === undefined ? '<span class="tag gray">Baru</span>' : '<span class="tag ' + (k.delta >= 0 ? 'ok' : 'danger') + '"><i class="bi bi-arrow-' + (k.delta >= 0 ? 'up' : 'down') + '"></i> ' + (k.delta >= 0 ? '+' : '') + String(k.delta).replace('.', ',') + '%</span>';
  const kpis = '<div class="grid g-4">' +
    '<div class="card kpi"><div class="row between top"><div class="l">Total Kelas Ekstra<br>Aktif</div><span class="ico"><i class="bi bi-trophy"></i></span></div><div class="v">' + k.kelasAktif + ' <small>Ekstra</small></div><div class="foot"><span class="tag">' + k.kelasTotal + ' terdaftar</span><span>semester ini</span></div></div>' +
    '<div class="card kpi"><div class="row between top"><div class="l">Total Peserta<br>Terdaftar</div><span class="ico"><i class="bi bi-people-fill"></i></span></div><div class="v">' + nf(k.pesertaAktif) + ' <small>Siswa</small></div><div class="foot"><span class="tag"><i class="bi bi-check-circle"></i> ' + pct(k.pctAktif) + ' Aktif</span><span>dari ' + nf(k.pesertaTotal) + ' total</span></div></div>' +
    '<div class="card kpi"><div class="row between top"><div class="l">Tingkat Kehadiran<br>Rata-rata</div><span class="ico amber"><i class="bi bi-graph-up-arrow"></i></span></div><div class="v">' + pct(k.pctHadir) + '</div><div class="foot">' + delta + '<span>' + (k.fallback ? 'belum ada sesi bulan ini' : 'vs bulan lalu') + '</span></div></div>' +
    '<div class="card kpi"><div class="row between top"><div class="l">Sesi Terlaksana<br>Minggu Ini</div><span class="ico"><i class="bi bi-calendar2-check"></i></span></div><div class="v">' + k.sesiSelesai + ' <small>/ ' + k.sesiTarget + ' Sesi</small></div><div class="foot"><span class="tag"><i class="bi bi-check2"></i> ' + pct(k.pctSesi) + ' Selesai</span><span>' + Math.max(0, k.sesiTarget - k.sesiSelesai) + ' sesi tersisa</span></div></div></div>';
  const dist = d.dist;
  const legend = '<div class="legend"><span><i class="dot" style="background:var(--primary)"></i> Hadir (' + pct(dist.H) + ')</span><span><i class="dot" style="background:var(--amber)"></i> Sakit (' + pct(dist.S) + ')</span><span><i class="dot" style="background:#93c5fd"></i> Izin (' + pct(dist.I) + ')</span><span><i class="dot" style="background:#fca5a5"></i> Alpa (' + pct(dist.A) + ')</span></div>';
  const sched = mon.rows.filter(function (r) { return r.scheduled && !r.sesi && r.code !== 'selesai'; });
  const sore = sched.map(function (r) { return r.nama; });
  const donutBox = '<div class="donut-wrap">' + donutSvg([{ v: dn.selesai, color: '#2563eb' }, { v: dn.berlangsung, color: '#996100' }, { v: dn.belumMulai, color: '#cbd5e1' }, { v: dn.belumMengisi, color: '#dc2626' }], dn.total) +
    '<div class="stat-list"><div class="r"><span class="dot"></span>' + dn.selesai + ' Selesai<span class="pc">' + pct(dn.total ? dn.selesai / dn.total * 100 : 0) + '</span></div><div class="r"><span class="dot tert"></span>' + dn.berlangsung + ' Sedang Berlangsung<span class="pc">' + pct(dn.total ? dn.berlangsung / dn.total * 100 : 0) + '</span></div><div class="r"><span class="dot gray"></span>' + dn.belumMulai + ' Belum Mulai<span class="pc">' + pct(dn.total ? dn.belumMulai / dn.total * 100 : 0) + '</span></div>' + (dn.belumMengisi ? '<div class="r"><span class="dot danger"></span>' + dn.belumMengisi + ' Belum Mengisi<span class="pc">' + pct(dn.belumMengisi / dn.total * 100) + '</span></div>' : '') + '</div></div>' +
    '<div class="info-box mt16 fs12"><span class="grow trunc">' + (sore.length ? 'Belum tuntas: ' + h(sore.slice(0, 2).join(' & ')) + (sore.length > 2 ? '…' : '') : 'Semua sesi terjadwal telah masuk.') + '</span><button class="btn btn-ghost btn-sm" style="color:var(--primary)" data-act="nav" data-p="monitoring">Monitor Lapangan <i class="bi bi-arrow-right"></i></button></div>';
  const ai = '<div class="ai-card"><h3><i class="bi bi-stars"></i> Analisis Otomatis Kehadiran</h3><ul>' + d.insights.map(function (t) { return '<li><i class="bi bi-lightbulb-fill"></i><span>' + h(t) + '</span></li>'; }).join('') + '</ul></div>';
  el.innerHTML = '<div class="page col g24">' +
    '<div class="card"><div class="page-head"><div><div class="eyebrow"><span class="dot pulse"></span> Sinkronisasi Aktif • SMAN 1 Kamal</div><h1 class="mt8">Dashboard Eksekutif Presensi</h1><p class="sub">Ringkasan aktivitas ekstrakurikuler real-time SMAN 1 Kamal Bangkalan</p></div><div class="row g8 wrap"><span class="chip"><i class="bi bi-calendar3"></i> ' + h(tglLong(S.today)) + ' <span class="dot"></span></span><button class="btn btn-secondary" data-act="nav" data-p="cetak"><i class="bi bi-download"></i> Unduh Rekap Cepat</button><button class="btn btn-primary" data-act="nav" data-p="monitoring"><i class="bi bi-eye"></i> Monitoring Lapangan</button></div></div></div>' +
    banner + kpis +
    '<div class="grid g-side"><div class="card"><div class="card-h"><div><h3>Grafik Tren Kehadiran per Pekan</h3><div class="sub">Monitoring kepatuhan absensi siswa — 4 pekan terakhir (s.d. ' + h(tglIndo(S.today)) + ')</div></div><span class="chip fs12" style="background:var(--surface-3)">Target KKM: <b style="color:var(--tert)">' + d.target + '%</b></span></div><div class="chart-box"><canvas id="cTrend" aria-label="Grafik tren kehadiran per pekan"></canvas></div><div class="mt12">' + legend + '</div></div>' +
    '<div class="card"><div class="card-h"><div><h3>Status Presensi Ekstra Hari Ini</h3><div class="sub">Jadwal Sesi ' + h(hariOf(S.today)) + ' (' + dn.total + ' Ekstrakurikuler)</div></div><span class="chip blue fs12">Live Field</span></div>' + donutBox + '</div></div>' +
    ai + '<div class="card p0" id="dashTbl"></div></div>';
  drawTrend(d);
  renderDashTable();
};
function drawTrend(d) {
  const col = chartColors(), labels = d.trend.map(function (t, i) { return t.label + (i === d.trend.length - 1 ? ' (Kini)' : ''); }), data = d.trend.map(function (t) { return t.pct; });
  makeChart('trend', 'cTrend', {
    type: 'bar', plugins: [barLabelPlugin],
    data: { labels: labels, datasets: [
      { type: 'bar', data: data, backgroundColor: data.map(function (v, i) { return i === data.length - 1 ? col.bar : col.barSoft; }), borderRadius: 6, barPercentage: .5, order: 2 },
      { type: 'line', data: data, borderColor: col.line, backgroundColor: col.line, borderWidth: 2, pointRadius: 3, tension: .3, spanGaps: true, order: 1 },
      { type: 'line', label: 'Target KKM', data: labels.map(function () { return d.target; }), borderColor: col.amber, borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, order: 0 }
    ] },
    options: { maintainAspectRatio: false, layout: { padding: { top: 26 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.dataset.label === 'Target KKM' ? 'Target KKM ' + c.parsed.y + '%' : 'Kehadiran ' + c.parsed.y + '%'; } } } },
      scales: { y: { min: 50, max: 100, ticks: { color: col.text, callback: function (v) { return v + '%'; }, stepSize: 15 }, grid: { color: col.grid } }, x: { ticks: { color: col.text }, grid: { display: false } } } }
  });
}
function renderDashTable() {
  const ui = S.ui.dash, box = $('#dashTbl'); if (!box) return;
  const rows = S.mon.rows.filter(function (r) { return r.scheduled && matchStatus(r, ui.st); }), per = 5, pages = Math.max(1, Math.ceil(rows.length / per));
  ui.page = Math.min(ui.page, pages); const slice = rows.slice((ui.page - 1) * per, ui.page * per);
  const body = slice.map(function (r) {
    const s = r.sesi, p = s ? s.pct : 0;
    const foto = s ? ((s.fotoKegiatan ? 1 : 0) + (s.fotoSelfie ? 1 : 0)) : 0;
    return '<tr><td><div class="row g12">' + ekBadge({ kode: r.kode, id: r.idKelas }) + '<div><b>' + h(r.nama) + '</b><div class="fs12 muted">' + h(r.kategori) + '</div></div></div></td>' +
      '<td><span class="row g8"><i class="bi bi-person" style="color:var(--primary)"></i>' + h(r.pembina) + '</span></td>' +
      '<td class="num"><b>' + h(r.jamMulai) + ' - ' + h(r.jamSelesai) + ' WIB</b><div class="fs12 muted">' + h(r.lokasi) + '</div></td>' +
      '<td style="min-width:150px">' + (s ? '<b class="num" style="color:var(--primary-deep)">' + (s.h) + ' / ' + s.total + '</b> <span class="fs12 muted">(' + pct(p) + ')</span><div class="bar mt4"><i style="width:' + Math.min(100, p) + '%"></i></div>' : '<span class="muted">—</span>') + '</td>' +
      '<td>' + (foto ? '<span class="chip"><i class="bi bi-images"></i> ' + foto + ' foto</span>' : '<span class="muted">—</span>') + '</td>' +
      '<td>' + monStatusPill(r) + '</td>' +
      '<td class="right">' + (s ? '<button class="btn ' + (r.code === 'menunggu' && isAdmin() ? 'btn-primary' : 'btn-secondary') + ' btn-sm" data-act="openDetailFor" data-id="' + h(s.id) + '">Detail <i class="bi bi-chevron-right"></i></button>' : '<button class="btn btn-secondary btn-sm" disabled>Detail</button>') + '</td></tr>';
  }).join('');
  box.innerHTML = '<div class="card-h" style="padding:20px 24px 0;margin:0 0 12px"><div><h3 style="font-size:20px">Monitoring Sesi Lapangan &amp; Riwayat Validasi</h3><div class="sub">Data real-time presensi pelatih &amp; pembina ekstrakurikuler hari ini</div></div><div class="row g8"><select class="sel" data-onchange="dashSt" style="width:190px" aria-label="Filter status">' + statusFilterOptions(ui.st) + '</select><button class="icon-btn" data-act="refresh" aria-label="Muat ulang" style="border:1px solid var(--border)"><i class="bi bi-arrow-clockwise"></i></button></div></div>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ekstrakurikuler</th><th>Pembina Pengampu</th><th>Waktu &amp; Lokasi</th><th>Kehadiran Siswa</th><th>Bukti Foto</th><th>Status Validasi</th><th class="right">Aksi</th></tr></thead><tbody>' + (body || '<tr><td colspan="7">' + emptyState('bi-inbox', 'Tidak ada sesi', 'Tidak ada sesi yang cocok dengan filter.') + '</td></tr>') + '</tbody></table></div>' +
    '<div class="pager"><span>Menampilkan <b>' + slice.length + '</b> dari <b>' + rows.length + '</b> sesi ekstra hari ini</span><div class="pg"><button data-act="dashPg" data-d="-1"' + (ui.page <= 1 ? ' disabled' : '') + '>Sebelumnya</button><button class="on">' + ui.page + '</button><button data-act="dashPg" data-d="1"' + (ui.page >= pages ? ' disabled' : '') + '>Berikutnya</button></div></div>';
}
ON.dashSt = function (el) { S.ui.dash.st = el.value; S.ui.dash.page = 1; renderDashTable(); };
ACT.dashPg = function (el) { S.ui.dash.page += Number(el.dataset.d); renderDashTable(); };

// ---------------- BAGIAN 13: MONITORING PRESENSI ----------------
function dateOptions(sel) {
  let o = '';
  for (let off = 1; off >= -6; off--) {
    const d = ymdAdd(S.today, off), lb = off === 0 ? 'Hari Ini (' + hariOf(d) + ')' : off === 1 ? 'Besok (' + hariOf(d) + ')' : off === -1 ? 'Kemarin (' + hariOf(d) + ')' : hariOf(d) + ', ' + tglIndo(d).slice(0, -5);
    o += '<option value="' + off + '"' + (sel === off ? ' selected' : '') + '>' + h(lb) + '</option>';
  }
  return o;
}
PAGES.monitoring = function (el) {
  const ui = S.ui.mon2 = S.ui.mon2 || { q: '', kat: '', dOff: 0, st: '', view: 'grid' };
  const date = ymdAdd(S.today, ui.dOff), mon = S.monCache[date];
  if (!mon) {
    el.innerHTML = '<div class="page col g16"><div class="skel" style="height:110px"></div><div class="grid g-4"><div class="skel" style="height:110px"></div><div class="skel" style="height:110px"></div><div class="skel" style="height:110px"></div><div class="skel" style="height:110px"></div></div><div class="skel" style="height:300px"></div></div>';
    call('getMonitoring', date).then(function (m) { S.monCache[date] = m; if (S.page === 'monitoring') renderPage(true); }).catch(function (e) { toast(errMsg(e), 'danger'); });
    return;
  }
  const kats = Array.from(new Set(S.kelas.map(function (k) { return k.kategori; }))).sort(), kp = mon.kpi;
  const isToday = date === S.today;
  el.innerHTML = '<div class="page col g24"><div class="card"><div class="page-head"><div><div class="row g8 mb8"><span class="eyebrow">Real-Time Sesi</span><span class="fs13 muted">' + h(tglLong(date)) + '</span></div><h1>Monitoring Presensi Ekstrakurikuler</h1><p class="sub">Pantau kedisiplinan dan status pengisian absensi ' + kp.total + ' ekstrakurikuler SMAN 1 Kamal ' + (isToday ? 'hari ini' : 'pada tanggal ini') + ' secara langsung.</p></div>' +
    '<div class="row g8 wrap"><button class="btn btn-secondary" data-act="dlMonCsv"><i class="bi bi-download"></i> Unduh Rekap Harian</button><button class="btn btn-primary" data-act="broadcast"><i class="bi bi-megaphone"></i> Broadcast Notifikasi Pembina</button></div></div></div>' +
    '<div class="grid g-4">' +
    '<div class="card kpi"><div class="row between top"><div><div class="l fs11" style="letter-spacing:.05em;text-transform:uppercase">Total Ekstrakurikuler</div><div class="v" style="margin-top:14px">' + kp.total + ' <small style="color:var(--primary)">Aktif</small></div></div><span class="ico"><i class="bi bi-collection"></i></span></div></div>' +
    '<div class="card kpi"><div class="row between top"><div><div class="l fs11" style="letter-spacing:.05em;text-transform:uppercase">Sudah Mengisi</div><div class="v" style="margin-top:14px">' + kp.sudah + ' <small style="color:var(--primary)">' + kp.pctSelesai + '% Selesai</small></div></div><span class="ico gray"><i class="bi bi-check2-circle"></i></span></div></div>' +
    '<div class="card kpi"><div class="row between top"><div><div class="l fs11" style="letter-spacing:.05em;text-transform:uppercase">Menunggu Validasi</div><div class="v" style="margin-top:14px">' + kp.menunggu + ' <small style="color:var(--tert-c)">Perlu Cek Waka</small></div></div><span class="ico amber"><i class="bi bi-hourglass-split"></i></span></div></div>' +
    '<div class="card kpi"><div class="row between top"><div><div class="l fs11" style="letter-spacing:.05em;text-transform:uppercase">Belum Mengisi</div><div class="v" style="margin-top:14px;color:var(--danger)">' + kp.belum + ' <small style="color:var(--danger)">Deadline ' + h(kp.deadline) + '</small></div></div><span class="ico red"><i class="bi bi-exclamation-triangle"></i></span></div></div></div>' +
    '<div class="card"><div class="filters"><div class="search-lg inp-wrap"><i class="bi bi-search lead"></i><input class="inp pl" type="search" placeholder="Cari nama ekstrakurikuler atau pembina…" value="' + h(ui.q) + '" data-on="monQ" autocomplete="off"></div>' +
    '<select class="sel" data-onchange="monKat" aria-label="Kategori"><option value="">Semua Kategori</option>' + kats.map(function (k) { return '<option' + (ui.kat === k ? ' selected' : '') + '>' + h(k) + '</option>'; }).join('') + '</select>' +
    '<select class="sel" data-onchange="monDate" aria-label="Tanggal">' + dateOptions(ui.dOff) + '</select>' +
    '<select class="sel" data-onchange="monSt" aria-label="Status">' + statusFilterOptions(ui.st) + '</select>' +
    '<div class="view-toggle"><button data-act="monView" data-v="grid" class="' + (ui.view === 'grid' ? 'on' : '') + '" aria-label="Tampilan kartu"><i class="bi bi-grid"></i></button><button data-act="monView" data-v="list" class="' + (ui.view === 'list' ? 'on' : '') + '" aria-label="Tampilan daftar"><i class="bi bi-list-ul"></i></button></div></div></div>' +
    '<div id="monBody"></div></div>';
  renderMonBody();
};
ON.monQ = debounce(function (el) { S.ui.mon2.q = el.value; renderMonBody(); }, 150);
ON.monKat = function (el) { S.ui.mon2.kat = el.value; renderMonBody(); };
ON.monSt = function (el) { S.ui.mon2.st = el.value; renderMonBody(); };
ON.monDate = function (el) { S.ui.mon2.dOff = Number(el.value); renderPage(true); };
ACT.monView = function (el) { S.ui.mon2.view = el.dataset.v; renderPage(true); };
function monRows() {
  const ui = S.ui.mon2, mon = S.monCache[ymdAdd(S.today, ui.dOff)], q = ui.q.trim().toLowerCase();
  return mon.rows.filter(function (r) {
    if (ui.kat && r.kategori !== ui.kat) return false;
    if (!matchStatus(r, ui.st)) return false;
    if (q && (r.nama + ' ' + r.pembina + ' ' + r.kode).toLowerCase().indexOf(q) < 0) return false;
    return true;
  }).sort(function (a, b) { const o = { 'belum-input': 0, menunggu: 1, dikembalikan: 2, divalidasi: 3, 'belum-mulai': 4, 'tidak-terjadwal': 5 }; return (o[a.code] - o[b.code]) || (a.nama < b.nama ? -1 : 1); });
}
function waLink(r, date) {
  const hp = normalizeHp(r.hpPembina); if (!hp) return '';
  const msg = 'Yth. ' + r.pembina + ', mohon segera mengisi presensi ekstrakurikuler ' + r.nama + ' tanggal ' + tglIndo(date) + ' melalui SIABSENS-EKSKUL (batas pengisian ' + S.cfg.batasPengisian + ' WIB). Terima kasih. — Waka Kesiswaan SMAN 1 Kamal';
  return 'https://wa.me/' + hp + '?text=' + encodeURIComponent(msg);
}
function monCard(r, date) {
  const s = r.sesi, hariTxt = r.hari.split(',').join(' & ');
  const sched = '<div class="info-box"><i class="bi bi-clock"></i><span class="grow">' + h(hariTxt) + '<br><b class="num">' + h(r.jamMulai) + ' WIB</b></span><span class="dot gray"></span><span class="trunc" style="max-width:45%">' + h(r.lokasi) + '</span></div>';
  let mid = '', act = '';
  if (s) {
    const p = s.pct, foto = (s.fotoKegiatan ? 1 : 0) + (s.fotoSelfie ? 1 : 0);
    mid = '<div><div class="row between fs13"><span>Tingkat Kehadiran</span><b style="color:var(--primary-deep)" class="num">' + pct(p) + '</b></div><div class="bar mt4 ' + pctClass(p) + '"><i style="width:' + Math.min(100, p) + '%"></i></div></div>' +
      '<div class="mini-counts"><div><b>' + s.h + '</b><span>Hadir</span></div><div><b style="color:var(--tert)">' + s.s + '</b><span>Sakit</span></div><div><b>' + s.i + '</b><span>Izin</span></div><div><b style="color:var(--danger)">' + s.a + '</b><span>Alpa</span></div></div>';
    if (r.code === 'divalidasi') mid += '<div class="note-box"><div class="t"><i class="bi bi-shield-check"></i> Terverifikasi Digital</div>Divalidasi oleh ' + h(s.validator) + ' pada pukul ' + h(clockHM(s.tglValidasi)) + ' WIB via Portal Waka.</div>';
    else if (r.code === 'dikembalikan') mid += '<div class="note-box danger"><div class="t"><i class="bi bi-arrow-return-left"></i> Dikembalikan untuk revisi</div>' + h(s.catatanValidator || '-') + '</div>';
    else if (foto) mid += '<div><div class="row between fs12 mb8"><span class="row g8"><i class="bi bi-camera"></i> ' + foto + ' Foto Kegiatan Terlampir</span><span style="color:var(--primary);font-weight:600">Perbesar</span></div><div class="thumbs">' +
      (s.fotoKegiatan ? '<button class="thumb" data-act="viewPhotoSesi" data-id="' + h(s.id) + '" data-j="kegiatan" aria-label="Lihat foto kegiatan"><div class="col center" style="height:100%;align-items:center;justify-content:center;color:#fff"><i class="bi bi-image" style="font-size:24px"></i></div><span>Kegiatan</span></button>' : '') +
      (s.fotoSelfie ? '<button class="thumb" data-act="viewPhotoSesi" data-id="' + h(s.id) + '" data-j="selfie" aria-label="Lihat foto selfie"><div class="col center" style="height:100%;align-items:center;justify-content:center;color:#fff"><i class="bi bi-person-bounding-box" style="font-size:24px"></i></div><span>Geotag OK</span></button>' : '') + '</div></div>';
    act = r.code === 'menunggu' && isAdmin() ? '<button class="btn btn-primary btn-block" data-act="openDetailFor" data-id="' + h(s.id) + '"><i class="bi bi-patch-check"></i> Tinjau &amp; Validasi</button>' : '<button class="btn btn-secondary btn-block" data-act="openSesi" data-id="' + h(s.id) + '"><i class="bi bi-journal-text"></i> Lihat Rekap Sesi</button>';
  } else if (r.code === 'belum-input') {
    mid = '<div class="note-box danger"><div class="row between"><b style="color:var(--danger-tx)"><i class="bi bi-stopwatch"></i> Batas Pengisian</b><b class="num">' + h(S.cfg.batasPengisian) + ' WIB</b></div><div class="mt4">' + (r.berlangsung ? 'Sesi sedang berlangsung. Belum ada catatan absensi dari pembina.' : 'Sesi telah lewat/dimulai. Belum ada catatan absensi atau unggahan log aktivitas dari pembina.') + '</div></div><div class="row g8 fs12 muted"><i class="bi bi-hourglass"></i> Menunggu sinkronisasi perangkat pembina…</div>';
    const wl = waLink(r, date);
    act = wl ? '<a class="btn btn-secondary btn-block" href="' + h(wl) + '" target="_blank" rel="noopener"><i class="bi bi-whatsapp" style="color:#16a34a"></i> Kirim Pengingat WhatsApp</a>' : '<button class="btn btn-secondary btn-block" disabled>No. HP pembina belum terisi</button>';
  } else {
    mid = '<div class="note-box"><div class="t">Roster Terkonfirmasi <span style="margin-left:auto;font-weight:600;color:var(--primary)">' + r.jumlahSiswa + '/' + r.jumlahSiswa + ' Siap</span></div>' + (r.code === 'belum-mulai' ? 'Form presensi digital dibuka otomatis pada jam kegiatan.' : (r.next ? 'Jadwal berikutnya: ' + h(r.next) : 'Tidak ada jadwal pada tanggal ini.')) + '</div>';
    act = '<button class="btn btn-secondary btn-block" data-act="kelasDetail" data-id="' + h(r.idKelas) + '"><i class="bi bi-info-circle"></i> Detail Ekstrakurikuler</button>';
  }
  const pill = r.code === 'tidak-terjadwal' && r.next ? '<span class="badge b-gray"><i class="bi bi-calendar-event"></i> ' + h(r.next.split(' ')[0] === 'Besok' ? 'Jadwal Besok' : 'Jadwal ' + r.next.split(' ')[0]) + '</span>' : monStatusPill(r);
  return '<div class="card hover mon-card"><div class="row between g8">' + pill + '<span class="fs12 muted">' + h(r.kategori) + '</span></div><div><h3>' + h(r.nama) + '</h3><div class="fs13 t2 mt4 row g8 wrap"><i class="bi bi-person"></i>' + h(r.pembina) + '<span class="muted">•</span>' + r.jumlahSiswa + ' Siswa</div></div>' + sched + mid + '<div class="spacer"></div>' + act + '</div>';
}
function renderMonBody() {
  const ui = S.ui.mon2, date = ymdAdd(S.today, ui.dOff), rows = monRows(), box = $('#monBody'); if (!box) return;
  if (!rows.length) { box.innerHTML = '<div class="card">' + emptyState('bi-search', 'Tidak ada ekstrakurikuler yang cocok', 'Ubah kata kunci atau filter.') + '</div>'; return; }
  if (ui.view === 'grid') { box.innerHTML = '<div class="mon-grid">' + rows.map(function (r) { return monCard(r, date); }).join('') + '</div>'; return; }
  box.innerHTML = '<div class="card p0"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ekstrakurikuler</th><th>Pembina</th><th>Jadwal</th><th>Kehadiran</th><th>Status</th><th class="right">Aksi</th></tr></thead><tbody>' + rows.map(function (r) {
    const s = r.sesi; return '<tr><td><div class="row g12">' + ekBadge({ kode: r.kode, id: r.idKelas }) + '<div><b>' + h(r.nama) + '</b><div class="fs12 muted">' + h(r.kategori) + ' • ' + r.jumlahSiswa + ' siswa</div></div></div></td><td>' + h(r.pembina) + '</td><td class="num fs13">' + h(r.hari.split(',').join(' & ')) + '<br>' + h(r.jamMulai) + ' - ' + h(r.jamSelesai) + '</td><td style="min-width:130px">' + (s ? '<b class="num">' + s.h + '/' + s.total + '</b> <span class="fs12 muted">(' + pct(s.pct) + ')</span><div class="bar mt4 ' + pctClass(s.pct) + '"><i style="width:' + Math.min(100, s.pct) + '%"></i></div>' : '<span class="muted">—</span>') + '</td><td>' + monStatusPill(r) + '</td><td class="right">' + (s ? '<button class="btn ' + (r.code === 'menunggu' && isAdmin() ? 'btn-primary' : 'btn-secondary') + ' btn-sm" data-act="openDetailFor" data-id="' + h(s.id) + '">' + (r.code === 'menunggu' && isAdmin() ? 'Tinjau' : 'Detail') + '</button>' : '<button class="btn btn-secondary btn-sm" data-act="kelasDetail" data-id="' + h(r.idKelas) + '">Info</button>') + '</td></tr>';
  }).join('') + '</tbody></table></div></div>';
}
ACT.dlMonCsv = function () {
  const date = ymdAdd(S.today, S.ui.mon2.dOff), mon = S.monCache[date]; if (!mon) return;
  const esc = function (v) { return '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"'; };
  const head = ['Ekstrakurikuler', 'Kategori', 'Pembina', 'Jadwal', 'Lokasi', 'Status', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Total', 'Persen Hadir'];
  const lines = [head.map(esc).join(',')].concat(mon.rows.map(function (r) {
    const s = r.sesi; return [r.nama, r.kategori, r.pembina, r.hari.split(',').join(' & ') + ' ' + r.jamMulai + '-' + r.jamSelesai, r.lokasi, r.label, s ? s.h : '', s ? s.s : '', s ? s.i : '', s ? s.a : '', s ? s.total : '', s ? s.pct : ''].map(esc).join(',');
  }));
  downloadBlob('Rekap_Harian_Ekskul_' + date + '.csv', new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  toast('Rekap harian diunduh.', 'ok');
};
ACT.broadcast = function () {
  const date = ymdAdd(S.today, S.ui.mon2.dOff), mon = S.monCache[date]; if (!mon) return;
  const todo = mon.rows.filter(function (r) { return r.code === 'belum-input' || r.code === 'dikembalikan'; });
  const pesan = 'Pengingat SIABSENS-EKSKUL: mohon Bapak/Ibu pembina segera mengisi presensi ekstrakurikuler tanggal ' + tglIndo(date) + ' (batas pengisian ' + S.cfg.batasPengisian + ' WIB). Terima kasih. — Waka Kesiswaan SMAN 1 Kamal';
  const m = openModal({ size: 'lg', title: 'Broadcast Notifikasi Pembina', body:
    '<div class="field"><label>Pesan pengingat</label><textarea class="txt" id="bcMsg" rows="4">' + h(pesan) + '</textarea></div>' +
    '<div class="lbl">Pembina yang belum menyelesaikan presensi (' + todo.length + ')</div>' +
    (todo.length ? '<div class="col g8">' + todo.map(function (r) { return '<div class="row g12 between card flat" style="padding:12px 14px"><div class="grow"><b>' + h(r.pembina) + '</b><div class="fs12 muted">' + h(r.nama) + ' • ' + h(r.label) + '</div></div>' + (normalizeHp(r.hpPembina) ? '<a class="btn btn-secondary btn-sm" data-wa="' + h(normalizeHp(r.hpPembina)) + '" target="_blank" rel="noopener" href="#"><i class="bi bi-whatsapp" style="color:#16a34a"></i> WhatsApp</a>' : '<span class="fs12 muted">No. HP kosong</span>') + '</div>'; }).join('') + '</div>' : '<div class="note-box"><div class="t"><i class="bi bi-check2-circle"></i> Semua pembina sudah mengisi</div>Tidak ada pengingat yang perlu dikirim untuk tanggal ini.</div>'),
    footer: '<button class="btn btn-secondary" data-x>Tutup</button><button class="btn btn-primary" id="bcCopy"><i class="bi bi-clipboard"></i> Salin Pesan</button>' });
  m.q('[data-x]').onclick = m.close;
  m.q('#bcCopy').onclick = async function () { toast((await copyText(m.q('#bcMsg').value)) ? 'Pesan disalin.' : 'Gagal menyalin.', 'ok'); };
  m.qa('a[data-wa]').forEach(function (a) { a.addEventListener('click', function () { a.href = 'https://wa.me/' + a.dataset.wa + '?text=' + encodeURIComponent(m.q('#bcMsg').value); }); });
};

// ---------------- BAGIAN 14: VALIDASI PRESENSI ----------------
PAGES.validasi = function (el) { if (S.params.id) return pgValDetail(el); return pgValList(el); };
ACT.valBack = function () { S.ui.vd = null; navigate('validasi', {}); };

function sesiRowTbl(x, withCk) {
  return '<tr>' + (withCk ? '<td class="ck"><input type="checkbox" data-onchange="valCk" data-id="' + h(x.id) + '" aria-label="Pilih sesi"></td>' : '') +
    '<td><div class="row g12">' + ekBadge({ kode: x.kelasKode, id: x.idKelas }) + '<div><b>' + h(x.kelasNama) + '</b><div class="fs12 muted">Pertemuan ke-' + x.pertemuan + '</div></div></div></td>' +
    '<td class="num">' + h(tglShort(x.tanggal)) + '<div class="fs12 muted">' + h(clockHM(x.waktuKirim)) + ' WIB</div></td><td>' + h(x.pembina) + '</td>' +
    '<td style="min-width:150px"><b class="num" style="color:var(--primary-deep)">' + x.h + '/' + x.total + '</b> <span class="fs12 muted">(' + pct(x.pct) + ')</span><div class="mini-counts mt4" style="grid-template-columns:repeat(3,auto);justify-content:start;gap:4px"><span class="tag warn">S ' + x.s + '</span><span class="tag">I ' + x.i + '</span><span class="tag danger">A ' + x.a + '</span></div></td>' +
    '<td>' + (x.fotoKegiatan && x.fotoSelfie ? '<span class="badge b-ok"><i class="bi bi-camera"></i> 2 foto</span>' : '<span class="badge b-warn"><i class="bi bi-camera"></i> ' + ((x.fotoKegiatan ? 1 : 0) + (x.fotoSelfie ? 1 : 0)) + ' foto</span>') + (x.jarak !== null ? '<div class="fs12 muted mt4"><i class="bi bi-geo-alt"></i> ' + String(x.jarak).replace('.', ',') + ' m</div>' : '') + '</td>' +
    '<td>' + valBadge(x.status) + '</td><td class="right"><button class="btn ' + (x.status === 'Belum' && isAdmin() ? 'btn-primary' : 'btn-secondary') + ' btn-sm" data-act="valOpen" data-id="' + h(x.id) + '">' + (x.status === 'Belum' && isAdmin() ? 'Tinjau' : 'Detail') + ' <i class="bi bi-chevron-right"></i></button></td></tr>';
}
ACT.valOpen = function (el) { S.ui.vd = null; navigate('validasi', { id: el.dataset.id }); };
function pgValList(el) {
  const ui = S.ui.vl = S.ui.vl || { tab: 'Belum', data: {}, sel: {} };
  const tabs = [['Belum', 'Menunggu'], ['Dikembalikan', 'Dikembalikan'], ['Divalidasi', 'Riwayat Divalidasi']];
  el.innerHTML = '<div class="page col g24">' + pageHead({ title: 'Validasi Presensi', sub: 'Tinjau kesesuaian data kehadiran, foto bukti lapangan, dan lokasi GPS sebelum sesi disahkan.', actions: '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button data-act="valTab" data-t="' + t[0] + '" class="' + (ui.tab === t[0] ? 'on' : '') + '">' + t[1] + (t[0] === 'Belum' ? ' (' + S.pending.length + ')' : '') + '</button>'; }).join('') + '</div>' }) +
    '<div id="vlBody"></div></div>';
  renderValList();
}
ACT.valTab = function (el) { S.ui.vl.tab = el.dataset.t; S.ui.vl.sel = {}; renderPage(true); };
function renderValList() {
  const ui = S.ui.vl, box = $('#vlBody'); if (!box) return;
  const draw = function (list) {
    const pendTab = ui.tab === 'Belum' && isAdmin();
    const bulk = pendTab && list.length > 1 ? '<div class="row between g8 wrap" style="padding:14px 16px;border-bottom:1px solid var(--border)"><label class="chk"><input type="checkbox" data-onchange="valCkAll"> Pilih semua</label><button class="btn btn-primary btn-sm" data-act="valBulk" id="btnBulk" disabled><i class="bi bi-check2-all"></i> Validasi Terpilih (<span id="bulkN">0</span>)</button></div>' : '';
    box.innerHTML = '<div class="card p0">' + bulk + (list.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + (pendTab && list.length > 1 ? '<th class="ck"></th>' : '') + '<th>Ekstrakurikuler</th><th>Tanggal</th><th>Pembina</th><th>Kehadiran</th><th>Bukti</th><th>Status</th><th class="right">Aksi</th></tr></thead><tbody>' + list.map(function (x) { return sesiRowTbl(x, pendTab && list.length > 1); }).join('') + '</tbody></table></div>' : emptyState(ui.tab === 'Belum' ? 'bi-check2-all' : 'bi-inbox', ui.tab === 'Belum' ? 'Tidak ada presensi yang menunggu validasi' : 'Belum ada data', ui.tab === 'Belum' ? 'Semua sesi yang dikirim pembina sudah Anda proses. ??' : '')) + '</div>';
  };
  if (ui.tab === 'Belum') { draw(S.pending); return; }
  if (ui.data[ui.tab]) { draw(ui.data[ui.tab]); return; }
  box.innerHTML = '<div class="skel" style="height:240px"></div>';
  call('getSesiList', { status: ui.tab }).then(function (l) { ui.data[ui.tab] = l; if (S.page === 'validasi' && !S.params.id && S.ui.vl.tab === ui.tab) renderValList(); }).catch(function (e) { box.innerHTML = '<div class="card">' + emptyState('bi-exclamation-triangle', errMsg(e)) + '</div>'; });
}
ON.valCk = function (el) { const ui = S.ui.vl; if (el.checked) ui.sel[el.dataset.id] = true; else delete ui.sel[el.dataset.id]; syncBulk(); };
ON.valCkAll = function (el) { const ui = S.ui.vl; ui.sel = {}; $$('input[data-onchange="valCk"]').forEach(function (c) { c.checked = el.checked; if (el.checked) ui.sel[c.dataset.id] = true; }); syncBulk(); };
function syncBulk() { const n = Object.keys(S.ui.vl.sel).length; const b = $('#btnBulk'); if (b) { b.disabled = !n; $('#bulkN').textContent = n; } }
ACT.valBulk = async function (btn) {
  const ids = Object.keys(S.ui.vl.sel); if (!ids.length) return;
  if (!(await confirmBox({ title: 'Validasi ' + ids.length + ' sesi sekaligus?', message: 'Pastikan Anda sudah memeriksa data. Sesi yang disetujui akan masuk ke rekap resmi.', ok: 'Ya, Validasi' }))) return;
  await withBusy(btn, async function () {
    let ok = 0, fail = 0;
    for (const id of ids) { try { await call('validateSesi', id, ''); ok++; S.pending = S.pending.filter(function (x) { return x.id !== id; }); } catch (e) { fail++; } }
    S.ui.vl.sel = {}; S.ui.vl.data = {};
    toast(ok + ' sesi divalidasi' + (fail ? ', ' + fail + ' gagal' : '') + '.', fail ? 'warn' : 'ok'); await refreshData(true); renderPage(true);
  }, 'Memproses…');
};

// -- Detail & edit --
function valCounts(V) {
  const c = { Hadir: 0, Sakit: 0, Izin: 0, Alpa: 0 };
  V.data.rows.forEach(function (r) { const e = V.edits[r.idAbs]; c[e ? e.status : r.status]++; });
  return c;
}
function pgValDetail(el) {
  const id = S.params.id;
  if (!S.ui.vd || S.ui.vd.id !== id) {
    S.ui.vd = { id: id, data: null, edits: {}, q: '', tab: 'all', kelas: '', shown: 10 };
    el.innerHTML = '<div class="page col g16"><div class="skel" style="height:140px"></div><div class="grid g-side"><div class="skel" style="height:420px"></div><div class="skel" style="height:420px"></div></div></div>';
    call('getSesiDetail', id).then(function (d) { if (S.ui.vd && S.ui.vd.id === id) { S.ui.vd.data = d; if (S.page === 'validasi' && S.params.id === id) renderPage(true); } })
      .catch(function (e) { toast(errMsg(e), 'danger'); navigate('validasi', {}); });
    return;
  }
  const V = S.ui.vd; if (!V.data) return;
  const d = V.data, s = d.sesi, canEdit = isAdmin(), kelasOpts = Array.from(new Set(d.rows.map(function (r) { return r.kelasJur; }))).sort();
  const dirty = Object.keys(V.edits).length;
  const geoOk = d.geo.jarak !== null && d.geo.jarak <= d.geo.radius;
  el.innerHTML = '<div class="page col g24" style="padding-bottom:8px">' +
    '<div class="card"><div class="row g8 fs13 mb16" style="flex-wrap:wrap"><a href="#" data-act="valBack" style="font-weight:600"><i class="bi bi-arrow-left"></i> Kembali ke ' + (S.ui.vl && S.ui.vl.tab ? 'Validasi Presensi' : 'Monitoring Presensi') + '</a><span class="muted">/</span><span class="t2">Sesi ' + h(s.kelasNama) + ' - ' + h(tglIndo(s.tanggal)) + '</span></div>' +
    '<div class="row between top g16 wrap"><div><h1 style="font-size:28px;line-height:36px;font-weight:800">Validasi Presensi: ' + h(s.kelasNama) + '</h1><div class="row g8 wrap mt12">' + valBadge(s.status) + '</div>' +
    '<div class="row g8 wrap mt12"><span class="chip"><i class="bi bi-calendar3"></i> ' + h(hariOf(s.tanggal)) + ', ' + h(tglIndo(s.tanggal)) + ' • ' + h(clockHM(s.waktuKirim)) + ' WIB</span><span class="chip"><i class="bi bi-activity"></i> ID: ' + h(s.id) + '</span></div>' +
    '<div class="row g8 wrap mt8"><span class="chip blue"><i class="bi bi-person"></i> Pembina: ' + h(d.pembina.nama) + '</span><span class="chip" style="background:none;border:0;padding-left:4px"><i class="bi bi-geo-alt"></i> ' + h(d.kelas.lokasi) + '</span></div></div>' +
    '<div class="card flat row g12" style="padding:12px 16px;background:var(--surface-2)"><i class="bi bi-shield-check" style="font-size:26px;color:var(--primary)"></i><div><div class="fs11 muted" style="letter-spacing:.06em">VALIDASI ID</div><div class="b mono" style="font-size:13px">' + h(s.kode) + '</div></div></div></div></div>' +
    '<div class="grid val-grid" style="grid-template-columns:minmax(0,1.9fr) minmax(0,1fr);align-items:start">' +
    // kiri
    '<div class="card p0"><div style="padding:20px 24px 0"><div class="card-h"><div><h3 style="font-size:18px">Daftar Presensi Peserta &amp; Edit Status</h3><div class="sub">' + (canEdit ? 'Periksa kesesuaian fisik lapangan atau ubah status jika terdapat bukti susulan.' : 'Mode lihat saja (Super Admin tidak dapat mengubah/memvalidasi presensi).') + '</div></div><div class="tabs"><button data-act="vdTab" data-t="all" class="' + (V.tab === 'all' ? 'on' : '') + '">Semua (' + d.rows.length + ')</button><button data-act="vdTab" data-t="exc" class="' + (V.tab === 'exc' ? 'on' : '') + '" id="vdExcBtn">Pengecualian</button></div></div>' +
    '<div class="grid g-mob1" style="grid-template-columns:repeat(5,1fr);gap:8px;background:var(--surface-2);padding:10px;border-radius:12px" id="vdTiles"></div>' +
    '<div class="row g8 wrap mt16"><div class="inp-wrap grow" style="min-width:200px"><i class="bi bi-search lead"></i><input class="inp pl" type="search" placeholder="Cari nama siswa atau NISN…" value="' + h(V.q) + '" data-on="vdQ" autocomplete="off"></div><select class="sel" data-onchange="vdKelas" style="width:170px" aria-label="Filter kelas"><option value="">Filter Kelas</option>' + kelasOpts.map(function (k) { return '<option' + (V.kelas === k ? ' selected' : '') + '>' + h(k) + '</option>'; }).join('') + '</select></div></div>' +
    '<div class="mt16" id="vdTable"></div></div>' +
    // kanan
    '<div class="col g16"><div class="card"><div class="card-h"><div class="row g8"><i class="bi bi-camera" style="color:var(--primary)"></i><h3 style="font-size:16px">Foto Kegiatan di Lapangan</h3></div><span class="badge b-blue">Wajib Valid</span></div><div class="photo-frame" id="vdPhK"></div><div class="info-box mt12 fs12"><span class="grow trunc">Google Drive: ' + h(d.namaFileKegiatan) + '</span><span class="row g4" style="color:var(--primary);font-weight:600"><i class="bi bi-shield-lock"></i> Terenkripsi</span></div></div>' +
    '<div class="card"><div class="card-h"><div class="row g8"><i class="bi bi-person-badge" style="color:var(--primary)"></i><h3 style="font-size:16px">Foto Kehadiran Pembina di Lokasi</h3></div><span class="badge b-ok"><i class="bi bi-check-circle"></i> Terverifikasi</span></div>' +
    '<div class="pembina-card"><div style="width:84px;flex-shrink:0"><div class="photo-frame" id="vdPhS" style="aspect-ratio:1/1;border-radius:10px"></div></div><div class="grow" style="min-width:0"><b>' + h(d.pembina.nama) + '</b><div class="fs12 muted mono">NIP. ' + h(d.pembina.nip || '-') + '</div><div class="fs12 t2 mt4"><i class="bi bi-clock"></i> Diambil: ' + h(tglIndo(s.waktuKirim.slice(0, 10)).replace(/ (\w{3})\w* /, ' $1 ')) + ', ' + h(clockHM(s.waktuKirim)) + ' WIB</div>' + (d.geo.sLat ? '<div class="fs12 mt4" style="color:var(--primary)"><i class="bi bi-cursor"></i> ' + d.geo.sLat.toFixed(5) + '°, ' + d.geo.sLng.toFixed(5) + '° (Presensi Lapangan)</div>' : '<div class="fs12 muted mt4">Koordinat GPS tidak tercatat</div>') + '</div></div>' +
    '<div class="geo-map mt12">' + geoMapSvg(d.geo, geoOk) + '</div></div>' +
    '<div class="card"><div class="row g8 mb8"><i class="bi bi-journal-check" style="color:var(--primary)"></i><h3 style="font-size:16px">Catatan &amp; Integritas Data</h3></div>' +
    (s.catatan ? '<div class="note-box mb8"><div class="t">Catatan Pembina</div>' + h(s.catatan) + '</div>' : '') +
    (s.status === 'Dikembalikan' ? '<div class="note-box danger mb8"><div class="t">Catatan revisi sebelumnya</div>' + h(s.catatanValidator) + '</div>' : '') +
    (canEdit && s.status !== 'Divalidasi' ? '<div class="field"><label>Catatan Tambahan untuk Pembina (Opsional/Wajib jika revisi):</label><textarea class="txt" id="valNote" placeholder="Contoh: Lampiran surat dokter siswa Bagas sudah terverifikasi dan presensi disetujui penuh…" maxlength="300"></textarea></div><label class="chk" style="align-items:flex-start;background:var(--surface-2);border-radius:10px;padding:12px"><input type="checkbox" id="valConfirm" style="margin-top:2px"><span style="line-height:18px;color:var(--text-2)">Saya mengonfirmasi telah memeriksa kesesuaian fisik dokumentasi visual, keabsahan GPS pembina, dan rekapitulasi data presensi siswa ini.</span></label>' : (s.status === 'Divalidasi' ? '<div class="note-box"><div class="t"><i class="bi bi-patch-check"></i> Sudah divalidasi</div>Oleh ' + h(s.validator) + ' pada ' + h(tglIndo(String(s.tglValidasi).slice(0, 10))) + ' ' + h(clockHM(s.tglValidasi)) + ' WIB.</div>' : '')) + '</div></div></div>' +
    // bar bawah
    '<div class="val-bar"><div class="row g12"><span style="width:44px;height:44px;border-radius:12px;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;color:var(--primary-deep);font-size:20px"><i class="bi bi-card-checklist"></i></span><div><div class="row g8 wrap"><b>' + (s.status === 'Divalidasi' ? 'Sesi Telah Divalidasi' : 'Sesi Siap Divalidasi') + '</b><span class="tag" id="vdPct"></span></div><div class="fs13 t2" id="vdSum"></div></div></div>' +
    '<div class="row g8 wrap">' + (canEdit ? (dirty ? '<button class="btn btn-soft" data-act="valSave" id="btnSaveEdit"><i class="bi bi-floppy"></i> Simpan Perubahan (' + dirty + ')</button>' : '') + (s.status !== 'Divalidasi' ? '<button class="btn btn-danger-o" data-act="valReturn"><i class="bi bi-arrow-counterclockwise"></i> Kembalikan untuk Revisi</button><button class="btn btn-primary" data-act="valApprove" id="btnApprove"><i class="bi bi-patch-check"></i> Setujui &amp; Validasi Presensi</button>' : '') : '<span class="badge b-gray">Mode lihat saja</span>') + '</div></div></div>';
  renderValTable();
  loadPhotoInto($('#vdPhK'), id0(), 'kegiatan', s.fotoKegiatan, '<div class="ov"><span class="row g8"><i class="bi bi-geo-alt"></i>' + (d.geo.jarak !== null ? 'Radius GPS: ' + String(d.geo.jarak).replace('.', ',') + ' m (' + (geoOk ? 'Di dalam sekolah' : 'Di luar radius') + ')' : 'GPS tidak tercatat') + '</span><button data-act="zoomPhoto"><i class="bi bi-zoom-in"></i> Resolusi Penuh</button></div>');
  loadPhotoInto($('#vdPhS'), id0(), 'selfie', s.fotoSelfie, '');
}
function id0() { return S.ui.vd.id; }
function geoMapSvg(g, ok) {
  const R = 46; let px = 150, py = 75, label = 'Lokasi GPS tidak tercatat';
  if (g.sLat && g.sLng) {
    const dx = (g.sLng - g.lng) * 111320 * Math.cos(g.lat * Math.PI / 180), dy = (g.lat - g.sLat) * 110540, sc = R / g.radius;
    px = Math.max(12, Math.min(288, 150 + dx * sc)); py = Math.max(12, Math.min(138, 75 + dy * sc)); label = ok ? 'Geofence Match: SMAN 1 KAMAL' : 'Di luar geofence sekolah';
  }
  return '<svg viewBox="0 0 300 150" width="100%" role="img" aria-label="' + h(label) + '"><rect width="300" height="150" fill="#dbeafe"/><g stroke="#bfdbfe" stroke-width="1"><path d="M0 30H300M0 75H300M0 120H300M50 0V150M150 0V150M250 0V150"/></g><path d="M0 100 C80 90 120 130 300 110" stroke="#fff" stroke-width="7" fill="none" opacity=".9"/><path d="M200 0 C190 60 230 90 220 150" stroke="#fff" stroke-width="5" fill="none" opacity=".9"/>' +
    '<circle cx="150" cy="75" r="' + R + '" fill="rgba(37,99,235,.14)" stroke="#2563eb" stroke-width="1.5" stroke-dasharray="4 3"/><circle cx="150" cy="75" r="4" fill="#1e3a8a"/>' +
    (g.sLat ? '<circle cx="' + px + '" cy="' + py + '" r="9" fill="' + (ok ? '#16a34a' : '#dc2626') + '" opacity=".25"/><circle cx="' + px + '" cy="' + py + '" r="5" fill="' + (ok ? '#16a34a' : '#dc2626') + '" stroke="#fff" stroke-width="2"/>' : '') +
    '<g transform="translate(8,126)"><rect width="' + (label.length * 6.4 + 22) + '" height="18" rx="9" fill="#fff" opacity=".95"/><circle cx="10" cy="9" r="3.5" fill="' + (ok ? '#2563eb' : '#dc2626') + '"/><text x="19" y="12.5" font-family="Inter,Arial" font-size="9.5" font-weight="700" fill="#1e293b">' + h(label) + '</text></g></svg>';
}
function renderValTable() {
  const V = S.ui.vd, box = $('#vdTable'); if (!box) return;
  const canEdit = isAdmin(), c = valCounts(V), tot = V.data.rows.length;
  const tiles = $('#vdTiles');
  if (tiles) tiles.innerHTML = '<div class="tile plain"><div class="k">Terdaftar</div><div class="n">' + tot + '</div></div><div class="tile h"><div class="k">Hadir</div><div class="n">' + c.Hadir + '</div></div><div class="tile s"><div class="k">Sakit</div><div class="n">' + c.Sakit + '</div></div><div class="tile i"><div class="k">Izin</div><div class="n">' + c.Izin + '</div></div><div class="tile a"><div class="k">Alpa</div><div class="n">' + c.Alpa + '</div></div>';
  const exc = c.Sakit + c.Izin + c.Alpa, eb = $('#vdExcBtn'); if (eb) eb.textContent = 'Pengecualian (' + exc + ')';
  const pc = tot ? (S.cfg.persenTermasukSakitIzin === 'TRUE' ? (c.Hadir + c.Sakit + c.Izin) : c.Hadir) / tot * 100 : 0;
  const pe = $('#vdPct'); if (pe) { pe.textContent = 'Tingkat Kehadiran: ' + pct(pc); pe.style.background = 'var(--primary)'; pe.style.color = '#fff'; }
  const se = $('#vdSum'); if (se) se.textContent = c.Hadir + ' Hadir • ' + c.Sakit + ' Sakit • ' + c.Izin + ' Izin • ' + c.Alpa + ' Alpa • Total ' + tot + ' Peserta';
  const q = V.q.trim().toLowerCase();
  let rows = V.data.rows.filter(function (r) {
    const st = V.edits[r.idAbs] ? V.edits[r.idAbs].status : r.status;
    if (V.tab === 'exc' && st === 'Hadir') return false;
    if (V.kelas && r.kelasJur !== V.kelas) return false;
    if (q && (r.nama + ' ' + r.nisn).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
  const total = rows.length, shown = (V.q || V.tab === 'exc') ? rows : rows.slice(0, V.shown);
  box.innerHTML = '<div class="tbl-wrap"><table class="tbl tight"><thead><tr><th>No</th><th>Siswa &amp; NISN</th><th>Kelas</th><th>Status Kehadiran</th><th>Keterangan / Catatan</th></tr></thead><tbody>' +
    (shown.length ? shown.map(function (r) {
      const e = V.edits[r.idAbs], st = e ? e.status : r.status, ket = e ? e.ket : r.ket, no = V.data.rows.indexOf(r) + 1;
      return '<tr class="' + (st === 'Alpa' ? 'exc-danger' : st !== 'Hadir' ? 'exc-warn' : '') + '"><td class="num muted">' + no + '</td><td><div class="row g12"><span class="avatar sm">' + h(ini(r.nama)) + '</span><div><b>' + h(r.nama) + '</b><div class="fs12 muted num">' + h(r.nisn) + '</div></div></div></td><td class="fs13 t2">' + h(r.kelasJur) + '</td>' +
        '<td style="min-width:228px"><div class="seg-st sm' + (canEdit ? '' : ' lock') + '">' + STATUS.map(function (x) { return '<button type="button" data-act="vdSet" data-id="' + h(r.idAbs) + '" data-s="' + x + '" class="' + (st === x ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div></td>' +
        '<td style="min-width:150px">' + (st === 'Hadir' ? '<span class="fs12 muted" style="font-style:italic">Diinput pembina</span>' : (canEdit ? '<input class="inp" style="height:34px;font-size:13px" maxlength="120" value="' + h(ket) + '" placeholder="Keterangan…" data-on="vdKet" data-id="' + h(r.idAbs) + '">' : '<span class="fs13 t2">' + h(ket || '-') + '</span>')) + '</td></tr>';
    }).join('') : '<tr><td colspan="5">' + emptyState('bi-search', 'Tidak ada data') + '</td></tr>') + '</tbody></table></div>' +
    '<div class="pager"><span>Menampilkan <b>' + shown.length + '</b> dari <b>' + total + '</b> siswa terdaftar</span>' + (shown.length < total ? '<button class="btn btn-secondary btn-sm" data-act="vdMore">Muat ' + (total - shown.length) + ' Siswa Lainnya</button>' : '') + '</div>';
}
ACT.vdTab = function (el) { S.ui.vd.tab = el.dataset.t; $$('.tabs button[data-act="vdTab"]').forEach(function (b) { b.classList.toggle('on', b === el); }); renderValTable(); };
ACT.vdMore = function () { S.ui.vd.shown = 9999; renderValTable(); };
ON.vdQ = debounce(function (el) { S.ui.vd.q = el.value; renderValTable(); }, 120);
ON.vdKelas = function (el) { S.ui.vd.kelas = el.value; renderValTable(); };
ON.vdKet = function (el) { const V = S.ui.vd, id = el.dataset.id, r = V.data.rows.find(function (x) { return x.idAbs === id; }), e = V.edits[id] || { status: r.status, ket: r.ket }; e.ket = el.value; V.edits[id] = e; markDirtyBar(); };
ACT.vdSet = function (el) {
  const V = S.ui.vd; if (!isAdmin()) return;
  const id = el.dataset.id, st = el.dataset.s, r = V.data.rows.find(function (x) { return x.idAbs === id; }), cur = V.edits[id] || { status: r.status, ket: r.ket };
  if (cur.status === st) return;
  const e = { status: st, ket: st === 'Hadir' ? '' : cur.ket };
  if (e.status === r.status && e.ket === r.ket) delete V.edits[id]; else V.edits[id] = e;
  renderValTable(); markDirtyBar();
};
function markDirtyBar() {
  const V = S.ui.vd, n = Object.keys(V.edits).length; let b = $('#btnSaveEdit');
  if (n && !b) { const row = $('.val-bar .row.g8.wrap:last-child'); if (row) { row.insertAdjacentHTML('afterbegin', '<button class="btn btn-soft" data-act="valSave" id="btnSaveEdit"><i class="bi bi-floppy"></i> Simpan Perubahan (' + n + ')</button>'); } }
  else if (b) { if (n) b.innerHTML = '<i class="bi bi-floppy"></i> Simpan Perubahan (' + n + ')'; else b.remove(); }
}
function collectChanges() { const V = S.ui.vd; return Object.keys(V.edits).map(function (id) { return { idAbs: id, status: V.edits[id].status, ket: V.edits[id].ket }; }); }
function commitEditsLocal() {
  const V = S.ui.vd; V.data.rows.forEach(function (r) { const e = V.edits[r.idAbs]; if (e) { r.status = e.status; r.ket = e.ket; } });
  const c = valCounts({ data: V.data, edits: {} }), s = V.data.sesi; s.h = c.Hadir; s.s = c.Sakit; s.i = c.Izin; s.a = c.Alpa; V.edits = {};
}
ACT.valSave = async function (btn) {
  const ch = collectChanges(); if (!ch.length) return;
  await withBusy(btn, async function () {
    try { await call('saveEditAbsensi', S.ui.vd.id, ch); commitEditsLocal(); toast('Perubahan status disimpan & tercatat di log audit.', 'ok'); renderPage(true); refreshData(true); }
    catch (e) { toast(errMsg(e), 'danger'); }
  }, 'Menyimpan…');
};
ACT.valApprove = async function (btn) {
  const V = S.ui.vd, id = V.id;
  const cf = $('#valConfirm'); if (cf && !cf.checked) { toast('Centang pernyataan konfirmasi terlebih dahulu.', 'warn'); cf.focus(); return; }
  const note = ($('#valNote') || {}).value || '';
  await withBusy(btn, async function () {
    try {
      const ch = collectChanges(); if (ch.length) { await call('saveEditAbsensi', id, ch); commitEditsLocal(); }
      const r = await call('validateSesi', id, note);
      S.pending = S.pending.filter(function (x) { return x.id !== id; }); if (S.ui.vl) S.ui.vl.data = {};
      toast('Presensi ' + V.data.sesi.kelasNama + ' berhasil divalidasi.', 'ok', 'Tervalidasi ?');
      S.ui.vd = null; navigate('validasi', {}, true); refreshData(true);
    } catch (e) { toast(errMsg(e), 'danger', 'Gagal memvalidasi'); }
  }, 'Memvalidasi…');
};
ACT.valReturn = function () {
  const V = S.ui.vd, id = V.id;
  const m = openModal({ size: 'sm', title: 'Kembalikan untuk Revisi', body: '<p class="t2 fs13 mb16">Pembina akan menerima notifikasi dan dapat memperbaiki lalu mengirim ulang presensi.</p><div class="field" style="margin:0"><label>Catatan revisi <span style="color:var(--danger)">*</span></label><textarea class="txt" id="retNote" maxlength="300" placeholder="Jelaskan bagian yang harus diperbaiki, mis. foto kegiatan kurang jelas…"></textarea></div><div class="ferr hide" id="retErr"></div>', footer: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-danger" id="retOk">Kembalikan</button>' });
  m.q('[data-x]').onclick = m.close;
  m.q('#retOk').onclick = function () {
    const note = m.q('#retNote').value.trim(); if (!note) { const e = m.q('#retErr'); e.textContent = 'Catatan revisi wajib diisi.'; e.classList.remove('hide'); return; }
    withBusy(m.q('#retOk'), async function () {
      try { await call('returnSesi', id, note); S.pending = S.pending.filter(function (x) { return x.id !== id; }); if (S.ui.vl) S.ui.vl.data = {}; m.close(); toast('Presensi dikembalikan ke pembina.', 'ok'); S.ui.vd = null; navigate('validasi', {}, true); refreshData(true); }
      catch (e) { toast(errMsg(e), 'danger'); }
    }, 'Mengirim…');
  };
};

// ---------------- BAGIAN 15: MASTER DATA — UTIL ----------------
function canEditMaster() { return isSuper(); }
function roNotice() { return canEditMaster() ? '' : '<span class="chip"><i class="bi bi-eye"></i> Mode lihat saja</span>'; }
function showCred(title, username, password) {
  const m = openModal({ size: 'sm', title: h(title), static: true, body: '<div class="note-box warn mb16"><div class="t"><i class="bi bi-exclamation-triangle"></i> Simpan sekarang</div>Kata sandi ini hanya ditampilkan sekali. Minta pengguna menggantinya setelah masuk.</div><div class="recap" style="margin:0"><div class="r"><span>Username</span><b class="mono" id="crU">' + h(username) + '</b></div><div class="r"><span>Kata sandi</span><b class="mono" id="crP">' + h(password) + '</b></div></div>', footer: '<button class="btn btn-secondary" id="crCopy"><i class="bi bi-clipboard"></i> Salin</button><button class="btn btn-primary" data-x>Selesai</button>' });
  m.q('[data-x]').onclick = m.close;
  m.q('#crCopy').onclick = async function () { toast((await copyText('Username: ' + username + '\nKata sandi: ' + password)) ? 'Kredensial disalin.' : 'Gagal menyalin.', 'ok'); };
}
async function doMutate(btn, modal, okMsg, fn) {
  await withBusy(btn, async function () {
    try { const r = await fn(); if (modal) modal.close(); await refreshData(true); if (okMsg) toast(okMsg, 'ok'); return r; }
    catch (e) { toast(errMsg(e), 'danger', 'Gagal menyimpan'); }
  }, 'Menyimpan…');
}
function field(label, inner, hint) { return '<div class="field"><label>' + label + '</label>' + inner + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>'; }
function pager(ui, total, act) {
  const pages = Math.max(1, Math.ceil(total / ui.per)); ui.page = Math.min(ui.page, pages);
  const from = total ? (ui.page - 1) * ui.per + 1 : 0, to = Math.min(total, ui.page * ui.per);
  let nums = []; for (let i = 1; i <= pages; i++) { if (i === 1 || i === pages || Math.abs(i - ui.page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…'); }
  return '<div class="pager"><div class="row g12 wrap"><span>Menampilkan <b>' + from + ' - ' + to + '</b> dari <b>' + nf(total) + '</b> data</span><span class="row g8">Tampilkan: <select class="sel" style="width:76px;height:32px" data-onchange="' + act + 'Per">' + [10, 25, 50, 100].map(function (n) { return '<option' + (ui.per === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select> baris</span></div><div class="pg"><button data-act="' + act + 'Pg" data-p="' + (ui.page - 1) + '"' + (ui.page <= 1 ? ' disabled' : '') + '><i class="bi bi-chevron-left"></i> Prev</button>' + nums.map(function (n) { return n === '…' ? '<button disabled>…</button>' : '<button data-act="' + act + 'Pg" data-p="' + n + '" class="' + (n === ui.page ? 'on' : '') + '">' + n + '</button>'; }).join('') + '<button data-act="' + act + 'Pg" data-p="' + (ui.page + 1) + '"' + (ui.page >= pages ? ' disabled' : '') + '>Next <i class="bi bi-chevron-right"></i></button></div></div>';
}

// ---------------- BAGIAN 16: DATA PEMBINA ----------------
PAGES.pembina = function (el) {
  const ui = S.ui.pembina = S.ui.pembina || { q: '' }, ed = canEditMaster();
  el.innerHTML = '<div class="page col g24">' + pageHead({ title: 'Manajemen Data Pembina', sub: 'Kelola data ' + S.pembina.length + ' pembina ekstrakurikuler beserta akun login masing-masing.', actions: roNotice() + (ed ? '<button class="btn btn-accent" data-act="pmbForm"><i class="bi bi-person-plus"></i> Tambah Pembina</button>' : '') }) +
    '<div class="card"><div class="inp-wrap" style="max-width:420px"><i class="bi bi-search lead"></i><input class="inp pl" type="search" placeholder="Cari nama atau NIP pembina…" value="' + h(ui.q) + '" data-on="pmbQ" autocomplete="off"></div></div><div class="card p0" id="pmbBody"></div></div>';
  renderPembina();
};
ON.pmbQ = debounce(function (el) { S.ui.pembina.q = el.value; renderPembina(); }, 120);
function renderPembina() {
  const q = S.ui.pembina.q.trim().toLowerCase(), ed = canEditMaster(), box = $('#pmbBody'); if (!box) return;
  const list = S.pembina.filter(function (p) { return !q || (p.nama + ' ' + (p.nip || '') + ' ' + (p.ekstra || []).join(' ')).toLowerCase().indexOf(q) >= 0; });
  box.innerHTML = list.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pembina</th><th>No. HP</th>' + (isSuper() ? '<th>Username Akun</th>' : '') + '<th>Ekstrakurikuler Diampu</th><th>Status</th>' + (ed ? '<th class="right">Aksi</th>' : '') + '</tr></thead><tbody>' + list.map(function (p) {
    return '<tr><td><div class="row g12"><span class="avatar">' + h(ini(p.nama)) + '</span><div><b>' + h(p.nama) + '</b><div class="fs12 muted mono">NIP/NUPTK ' + h(p.nip || '-') + '</div></div></div></td><td class="num">' + h(p.hp || '-') + '</td>' + (isSuper() ? '<td class="mono fs13">' + h(p.username || '-') + '</td>' : '') +
      '<td>' + ((p.ekstra || []).length ? (p.ekstra || []).map(function (e) { return '<span class="chip blue" style="margin:2px">' + h(e) + '</span>'; }).join('') : '<span class="muted fs13">Belum mengampu</span>') + '</td><td>' + (p.status === 'Aktif' ? '<span class="badge b-ok">Aktif</span>' : '<span class="badge b-gray">Nonaktif</span>') + '</td>' +
      (ed ? '<td class="right" style="white-space:nowrap"><button class="icon-btn sm edit" data-act="pmbForm" data-id="' + h(p.id) + '" aria-label="Ubah" title="Ubah"><i class="bi bi-pencil"></i></button><button class="icon-btn sm view" data-act="pmbReset" data-id="' + h(p.idUser) + '" aria-label="Reset sandi" title="Reset kata sandi"><i class="bi bi-key"></i></button><button class="icon-btn sm del" data-act="pmbDel" data-id="' + h(p.id) + '" aria-label="Hapus" title="Hapus"><i class="bi bi-trash"></i></button></td>' : '') + '</tr>';
  }).join('') + '</tbody></table></div>' : emptyState('bi-person-x', 'Pembina tidak ditemukan');
}
ACT.pmbForm = function (el) {
  const p = el.dataset.id ? S.pmap[el.dataset.id] : null;
  const m = openModal({ title: p ? 'Ubah Data Pembina' : 'Tambah Pembina', body:
    field('Nama lengkap &amp; gelar <span style="color:var(--danger)">*</span>', '<input class="inp" id="fNama" maxlength="80" value="' + h(p ? p.nama : '') + '" placeholder="mis. Bambang Wijaya, S.Pd">') +
    field('NIP / NUPTK', '<input class="inp mono" id="fNip" maxlength="30" inputmode="numeric" value="' + h(p ? p.nip : '') + '" placeholder="18 digit NIP">', p ? '' : 'NIP akan menjadi username login pembina. Kata sandi sementara dibuat otomatis.') +
    field('No. HP / WhatsApp', '<input class="inp" id="fHp" maxlength="20" inputmode="tel" value="' + h(p ? p.hp : '') + '" placeholder="08xxxxxxxxxx">') +
    (p ? field('Status', '<select class="sel" id="fStatus"><option' + (p.status === 'Aktif' ? ' selected' : '') + '>Aktif</option><option' + (p.status !== 'Aktif' ? ' selected' : '') + '>Nonaktif</option></select>') : ''),
    footer: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="fSave">Simpan</button>' });
  m.q('[data-x]').onclick = m.close;
  m.q('#fSave').onclick = function () {
    const rec = { id: p ? p.id : '', nama: m.q('#fNama').value, nip: m.q('#fNip').value, hp: m.q('#fHp').value, status: p ? m.q('#fStatus').value : 'Aktif' };
    doMutate(m.q('#fSave'), m, p ? 'Data pembina diperbarui.' : 'Pembina ditambahkan.', async function () {
      const r = await call('saveMaster', 'pembina', rec);
      if (r && r.tempPassword) setTimeout(function () { showCred('Akun Pembina Dibuat', r.username, r.tempPassword); }, 250);
    });
  };
};
ACT.pmbDel = async function (el) {
  const p = S.pmap[el.dataset.id];
  if (!(await confirmBox({ title: 'Hapus pembina?', html: 'Pembina <b>' + h(p.nama) + '</b> dan akun loginnya akan dihapus permanen. Pembina yang masih mengampu ekstrakurikuler tidak dapat dihapus.', ok: 'Hapus', danger: true }))) return;
  try { await call('deleteMaster', 'pembina', [p.id]); await refreshData(true); toast('Pembina dihapus.', 'ok'); } catch (e) { toast(errMsg(e), 'danger'); }
};
ACT.pmbReset = function (el) { resetPwFlow(el.dataset.id); };
function resetPwFlow(idUser, nama) {
  const m = openModal({ size: 'sm', title: 'Reset Kata Sandi', body: '<p class="t2 fs13 mb16">Buat kata sandi baru untuk pengguna ini. Kosongkan kolom di bawah untuk membuat kata sandi acak otomatis.</p>' + field('Kata sandi baru (opsional)', '<input class="inp" id="fPw" maxlength="64" placeholder="Acak otomatis jika kosong">'), footer: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="fSave">Reset</button>' });
  m.q('[data-x]').onclick = m.close;
  m.q('#fSave').onclick = function () {
    const pw = m.q('#fPw').value;
    withBusy(m.q('#fSave'), async function () { try { const r = await call('resetPassword', idUser, pw); m.close(); showCred('Kata Sandi Direset', r.username, r.password); } catch (e) { toast(errMsg(e), 'danger'); } }, 'Memproses…');
  };
}

// ---------------- BAGIAN 17: KELAS EKSTRAKURIKULER ----------------
const KATEGORI = ['Bela Negara', 'Kepanduan', 'Olahraga', 'Kemanusiaan', 'Keagamaan', 'Sains & IT', 'Seni & Budaya', 'Bahasa', 'Jurnalistik', 'Lainnya'];
PAGES.kelas = function (el) {
  const ui = S.ui.kelas = S.ui.kelas || { q: '' }, ed = canEditMaster();
  el.innerHTML = '<div class="page col g24">' + pageHead({ title: 'Kelas Ekstrakurikuler', sub: 'Kelola ' + S.kelas.length + ' ekstrakurikuler: pembina pengampu, jadwal rutin, dan lokasi kegiatan.', actions: roNotice() + (ed ? '<button class="btn btn-accent" data-act="kelForm"><i class="bi bi-plus-lg"></i> Tambah Ekstrakurikuler</button>' : '') }) +
    '<div class="card"><div class="inp-wrap" style="max-width:420px"><i class="bi bi-search lead"></i><input class="inp pl" type="search" placeholder="Cari nama, kode, atau pembina…" value="' + h(ui.q) + '" data-on="kelQ" autocomplete="off"></div></div><div class="card p0" id="kelBody"></div></div>';
  renderKelas();
};
ON.kelQ = debounce(function (el) { S.ui.kelas.q = el.value; renderKelas(); }, 120);
function renderKelas() {
  const q = S.ui.kelas.q.trim().toLowerCase(), ed = canEditMaster(), box = $('#kelBody'); if (!box) return;
  const list = S.kelas.filter(function (k) { return !q || (k.nama + ' ' + k.kode + ' ' + k.pembina + ' ' + k.kategori).toLowerCase().indexOf(q) >= 0; });
  box.innerHTML = list.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ekstrakurikuler</th><th>Pembina</th><th>Jadwal</th><th>Lokasi</th><th>Peserta</th><th>Status</th>' + (ed ? '<th class="right">Aksi</th>' : '') + '</tr></thead><tbody>' + list.map(function (k) {
    return '<tr><td><div class="row g12">' + ekBadge(k) + '<div><b>' + h(k.nama) + '</b><div class="fs12 muted">' + h(k.kategori) + ' • ' + h(k.kode) + '</div></div></div></td><td>' + h(k.pembina) + '</td><td class="num fs13">' + h(k.hari.split(',').join(' & ')) + '<br>' + h(jamLabel(k)) + '</td><td class="fs13">' + h(k.lokasi || '-') + '</td><td class="num"><b>' + k.jumlah + '</b> siswa</td><td>' + (k.status === 'Aktif' ? '<span class="badge b-ok">Aktif</span>' : '<span class="badge b-gray">Nonaktif</span>') + '</td>' +
      (ed ? '<td class="right" style="white-space:nowrap"><button class="icon-btn sm edit" data-act="kelForm" data-id="' + h(k.id) + '" aria-label="Ubah"><i class="bi bi-pencil"></i></button><button class="icon-btn sm del" data-act="kelDel" data-id="' + h(k.id) + '" aria-label="Hapus"><i class="bi bi-trash"></i></button></td>' : '') + '</tr>';
  }).join('') + '</tbody></table></div>' : emptyState('bi-trophy', 'Ekstrakurikuler tidak ditemukan');
}
ACT.kelForm = function (el) {
  const k = el.dataset.id ? S.kmap[el.dataset.id] : null, jam = k ? parseJam(k.jadwal) : { a: '15:30', b: '17:00' }, hari = k ? parseHariList(k.hari) : [];
  const m = openModal({ size: 'lg', title: k ? 'Ubah Ekstrakurikuler' : 'Tambah Ekstrakurikuler', body:
    '<div class="grid g-2 g-mob1"><div>' + field('Nama ekstrakurikuler <span style="color:var(--danger)">*</span>', '<input class="inp" id="fNama" maxlength="80" value="' + h(k ? k.nama : '') + '">') + '</div><div>' + field('Kode singkat <span style="color:var(--danger)">*</span>', '<input class="inp mono" id="fKode" maxlength="6" value="' + h(k ? k.kode : '') + '" placeholder="mis. PSK" style="text-transform:uppercase">', '2–6 huruf/angka, unik.') + '</div>' +
    '<div>' + field('Kategori', '<input class="inp" id="fKat" list="dlKat" maxlength="40" value="' + h(k ? k.kategori : '') + '"><datalist id="dlKat">' + KATEGORI.map(function (x) { return '<option value="' + h(x) + '">'; }).join('') + '</datalist>') + '</div><div>' + field('Pembina pengampu', '<select class="sel" id="fPemb"><option value="">— Belum ditentukan —</option>' + S.pembina.filter(function (p) { return p.status === 'Aktif'; }).map(function (p) { return '<option value="' + h(p.id) + '"' + (k && k.idPembina === p.id ? ' selected' : '') + '>' + h(p.nama) + '</option>'; }).join('') + '</select>') + '</div>' +
    '<div>' + field('Jam mulai', '<input class="inp" type="time" id="fJa" value="' + h(jam.a) + '">') + '</div><div>' + field('Jam selesai', '<input class="inp" type="time" id="fJb" value="' + h(jam.b) + '">') + '</div></div>' +
    '<div class="field"><label>Hari pertemuan <span style="color:var(--danger)">*</span></label><div class="row g8 wrap" id="fHari">' + ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map(function (d) { return '<label class="chip" style="cursor:pointer"><input type="checkbox" value="' + d + '"' + (hari.indexOf(d) >= 0 ? ' checked' : '') + ' style="accent-color:var(--primary)"> ' + d + '</label>'; }).join('') + '</div></div>' +
    '<div class="grid g-2 g-mob1"><div>' + field('Lokasi kegiatan', '<input class="inp" id="fLok" maxlength="100" value="' + h(k ? k.lokasi : '') + '">') + '</div><div>' + field('Status', '<select class="sel" id="fStatus"><option' + (!k || k.status === 'Aktif' ? ' selected' : '') + '>Aktif</option><option' + (k && k.status !== 'Aktif' ? ' selected' : '') + '>Nonaktif</option></select>') + '</div></div>',
    footer: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="fSave">Simpan</button>' });
  m.q('[data-x]').onclick = m.close;
  m.q('#fSave').onclick = function () {
    const rec = { id: k ? k.id : '', nama: m.q('#fNama').value, kode: m.q('#fKode').value, kategori: m.q('#fKat').value, idPembina: m.q('#fPemb').value, jam: m.q('#fJa').value + ' - ' + m.q('#fJb').value, hari: m.qa('#fHari input:checked').map(function (c) { return c.value; }), lokasi: m.q('#fLok').value, status: m.q('#fStatus').value };
    doMutate(m.q('#fSave'), m, k ? 'Ekstrakurikuler diperbarui.' : 'Ekstrakurikuler ditambahkan.', function () { return call('saveMaster', 'kelas', rec); });
  };
};
ACT.kelDel = async function (el) {
  const k = S.kmap[el.dataset.id];
  if (!(await confirmBox({ title: 'Hapus ekstrakurikuler?', html: '<b>' + h(k.nama) + '</b> akan dihapus. Ekstrakurikuler yang sudah punya riwayat presensi atau peserta tidak dapat dihapus (nonaktifkan saja).', ok: 'Hapus', danger: true }))) return;
  try { await call('deleteMaster', 'kelas', [k.id]); await refreshData(true); toast('Ekstrakurikuler dihapus.', 'ok'); } catch (e) { toast(errMsg(e), 'danger'); }
};

// ---------------- BAGIAN 18: DATA PESERTA (Admin/Super) ----------------
function pgPesertaAdmin(el) {
  const ui = S.ui.pes = S.ui.pes || { q: '', kelas: '', kj: '', status: 'Aktif', sort: 'az', page: 1, per: 10, sel: {} }, ed = canEditMaster();
  const aktif = S.peserta.filter(function (p) { return p.aktif; }).length, avg = S.dash ? S.dash.kpi.pctHadir : 0;
  const sync = S.lastSync ? pad(S.lastSync.getHours()) + ':' + pad(S.lastSync.getMinutes()) + ' WIB' : '-';
  const kj = Array.from(new Set(S.peserta.map(function (p) { return p.kelasJur; }).filter(Boolean))).sort();
  el.innerHTML = '<div class="page col g24"><div class="card"><div class="page-head"><div><h1>Manajemen Data Peserta<br>Ekstrakurikuler</h1><p class="sub">Kelola data ' + nf(aktif) + ' siswa peserta ekstrakurikuler terintegrasi Google Sheets</p></div><div class="row g8 wrap" style="justify-content:flex-end;max-width:560px"><span class="chip"><span class="dot"></span> Sync Active</span><button class="btn btn-secondary" data-act="pesTpl"><i class="bi bi-file-earmark-text"></i> Download Template</button>' + (ed ? '<button class="btn btn-soft" data-act="pesImport"><i class="bi bi-file-earmark-arrow-up"></i> Import Excel / CSV</button><button class="btn btn-accent" data-act="pesForm"><i class="bi bi-person-plus"></i> + Tambah Siswa</button>' : '<button class="btn btn-soft" data-act="pesCsv"><i class="bi bi-download"></i> Unduh CSV</button>') + '</div></div></div>' +
    '<div class="grid g-4">' + [['bi-people-fill', 'Total Roster Aktif', nf(aktif) + ' Siswa', ''], ['bi-collection', 'Total Cabang Ekskul', S.kelas.filter(function (k) { return k.status === 'Aktif'; }).length + ' Bidang', 'gray'], ['bi-graph-up-arrow', 'Tingkat Kehadiran Avg', pct(avg), ''], ['bi-arrow-repeat', 'Sinkronisasi Terakhir', sync, 'gray']].map(function (x) { return '<div class="card row g12" style="padding:16px 20px"><span class="ico ' + x[3] + '"><i class="bi ' + x[0] + '"></i></span><div><div class="fs12 t2">' + x[1] + '</div><div class="b" style="font-family:var(--f-head);font-size:20px">' + x[2] + '</div></div></div>'; }).join('') + '</div>' +
    '<div class="card"><div class="filters"><div class="search-lg inp-wrap"><i class="bi bi-search lead"></i><input class="inp pl" type="search" id="pesQ" placeholder="Cari berdasarkan NISN / nama…" value="' + h(ui.q) + '" data-on="pesQ" autocomplete="off"></div>' +
    '<select class="sel" data-onchange="pesKelas" aria-label="Ekstrakurikuler"><option value="">Semua Ekskul</option>' + S.kelas.map(function (k) { return '<option value="' + h(k.id) + '"' + (ui.kelas === k.id ? ' selected' : '') + '>' + h(k.nama) + '</option>'; }).join('') + '</select>' +
    '<select class="sel" data-onchange="pesKj" aria-label="Kelas"><option value="">Semua Kelas</option>' + kj.map(function (x) { return '<option' + (ui.kj === x ? ' selected' : '') + '>' + h(x) + '</option>'; }).join('') + '</select>' +
    '<select class="sel" data-onchange="pesSt" aria-label="Status"><option value="">Semua Status</option><option value="Aktif"' + (ui.status === 'Aktif' ? ' selected' : '') + '>Aktif</option><option value="Nonaktif"' + (ui.status === 'Nonaktif' ? ' selected' : '') + '>Nonaktif</option></select>' +
    '<select class="sel" data-onchange="pesSort" aria-label="Urutkan"><option value="az"' + (ui.sort === 'az' ? ' selected' : '') + '>Abjad (A - Z)</option><option value="za"' + (ui.sort === 'za' ? ' selected' : '') + '>Abjad (Z - A)</option><option value="pct"' + (ui.sort === 'pct' ? ' selected' : '') + '>Kehadiran tertinggi</option><option value="pctl"' + (ui.sort === 'pctl' ? ' selected' : '') + '>Kehadiran terendah</option></select></div><div class="row g8 wrap mt12" id="pesChips"></div></div>' +
    '<div id="pesBulk"></div><div class="card p0" id="pesBody"></div></div>';
  renderPesAll();
}
PAGES.peserta = function (el) { return isPembina() ? pgPesertaPembina(el) : pgPesertaAdmin(el); };
function pesFiltered() {
  const ui = S.ui.pes, q = ui.q.trim().toLowerCase();
  let l = S.peserta.filter(function (p) {
    if (ui.kelas && p.idKelas !== ui.kelas) return false; if (ui.kj && p.kelasJur !== ui.kj) return false;
    if (ui.status === 'Aktif' && !p.aktif) return false; if (ui.status === 'Nonaktif' && p.aktif) return false;
    if (q && (p.nama + ' ' + p.nisn + ' ' + p.noInduk).toLowerCase().indexOf(q) < 0) return false; return true;
  });
  l.sort(function (a, b) { if (ui.sort === 'za') return a.nama < b.nama ? 1 : -1; if (ui.sort === 'pct') return (b.pct || 0) - (a.pct || 0); if (ui.sort === 'pctl') return (a.pct === null ? 999 : a.pct) - (b.pct === null ? 999 : b.pct); return a.nama < b.nama ? -1 : 1; });
  return l;
}
function renderPesAll() { renderPesChips(); renderPesBody(); renderPesBulk(); }
function renderPesChips() {
  const ui = S.ui.pes, box = $('#pesChips'); if (!box) return; let c = '';
  if (ui.kelas) c += '<span class="chip blue">Ekskul: ' + h((S.kmap[ui.kelas] || {}).nama) + ' <button data-act="pesClr" data-f="kelas" aria-label="Hapus filter"><i class="bi bi-x"></i></button></span>';
  if (ui.kj) c += '<span class="chip blue">Kelas: ' + h(ui.kj) + ' <button data-act="pesClr" data-f="kj" aria-label="Hapus filter"><i class="bi bi-x"></i></button></span>';
  if (ui.status) c += '<span class="chip">Status: ' + h(ui.status) + ' <button data-act="pesClr" data-f="status" aria-label="Hapus filter"><i class="bi bi-x"></i></button></span>';
  box.innerHTML = '<span class="fs11 b muted" style="letter-spacing:.06em">FILTER AKTIF:</span>' + (c || '<span class="fs12 muted">Tidak ada</span>') + '<button class="btn btn-ghost btn-sm" style="color:var(--primary)" data-act="pesReset">Reset Filter</button>';
}
ACT.pesClr = function (el) { S.ui.pes[el.dataset.f] = ''; S.ui.pes.page = 1; renderPage(true); };
ACT.pesReset = function () { Object.assign(S.ui.pes, { q: '', kelas: '', kj: '', status: 'Aktif', sort: 'az', page: 1 }); renderPage(true); };
function renderPesBody() {
  const ui = S.ui.pes, ed = canEditMaster(), box = $('#pesBody'); if (!box) return;
  const all = pesFiltered(), total = all.length, rows = all.slice((ui.page - 1) * ui.per, ui.page * ui.per);
  const allOn = rows.length && rows.every(function (p) { return ui.sel[p.id]; });
  box.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + (ed ? '<th class="ck"><input type="checkbox" data-onchange="pesCkAll"' + (allOn ? ' checked' : '') + ' aria-label="Pilih semua"></th>' : '') + '<th>NISN</th><th>No. Induk</th><th>Nama Lengkap Siswa</th><th>L/P</th><th>Kelas &amp; Jurusan</th><th>Ekstrakurikuler</th><th style="min-width:130px">Total Kehadiran</th><th>Status</th><th class="right">Aksi</th></tr></thead><tbody>' +
    (rows.length ? rows.map(function (p) {
      const k = S.kmap[p.idKelas] || {}, sel = ui.sel[p.id];
      return '<tr class="' + (sel ? 'sel' : '') + '">' + (ed ? '<td class="ck"><input type="checkbox" data-onchange="pesCk" data-id="' + h(p.id) + '"' + (sel ? ' checked' : '') + ' aria-label="Pilih ' + h(p.nama) + '"></td>' : '') + '<td class="num">' + h(p.nisn) + '</td><td class="num muted">' + h(p.noInduk) + '</td><td><div class="row g8"><span class="avatar sm">' + h(ini(p.nama)) + '</span><b>' + h(p.nama) + '</b></div></td><td><span class="tag gray" style="border-radius:6px;padding:1px 8px">' + h(p.jk) + '</span></td><td>' + h(p.kelasJur) + '</td><td><span class="row g8"><span class="dot"></span>' + h(k.nama || '-') + '</span></td>' +
        '<td>' + (p.pct === null ? '<span class="muted">—</span>' : '<div class="row g8"><div class="bar grow ' + pctClass(p.pct) + '"><i style="width:' + Math.min(100, p.pct) + '%"></i></div><b class="num fs13">' + Math.round(p.pct) + '%</b></div>') + '</td><td>' + (p.aktif ? '<span class="badge b-ok">Aktif</span>' : '<span class="badge b-gray">Nonaktif</span>') + '</td>' +
        '<td class="right" style="white-space:nowrap"><button class="icon-btn sm view" data-act="pesView" data-id="' + h(p.id) + '" aria-label="Lihat"><i class="bi bi-eye"></i></button>' + (ed ? '<button class="icon-btn sm view" data-act="kartuOne" data-id="' + h(p.id) + '" aria-label="Cetak kartu" title="Cetak kartu (PDF)"><i class="bi bi-credit-card-2-front"></i></button><button class="icon-btn sm edit" data-act="pesForm" data-id="' + h(p.id) + '" aria-label="Ubah"><i class="bi bi-pencil"></i></button><button class="icon-btn sm del" data-act="pesDel" data-id="' + h(p.id) + '" aria-label="Hapus"><i class="bi bi-trash"></i></button>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="10">' + emptyState('bi-search', 'Peserta tidak ditemukan', 'Coba ubah kata kunci atau reset filter.') + '</td></tr>') + '</tbody></table></div>' + pager(ui, total, 'pes');
}
function renderPesBulk() {
  const ui = S.ui.pes, n = Object.keys(ui.sel).length, box = $('#pesBulk'); if (!box) return;
  box.innerHTML = n && canEditMaster() ? '<div class="bulk-bar"><span class="n">' + n + '</span><b>' + n + ' Siswa Dipilih</b><span style="opacity:.7">| Pilih tindakan massal untuk siswa terpilih</span><span class="spacer"></span><button class="btn btn-secondary btn-sm" data-act="pesMove"><i class="bi bi-arrow-left-right"></i> Pindahkan ke Ekstra Lain</button><button class="btn btn-secondary btn-sm" data-act="kartuFromPes"><i class="bi bi-credit-card-2-front"></i> Cetak Kartu</button><button class="btn btn-secondary btn-sm" data-act="pesNotify"><i class="bi bi-envelope"></i> Kirim Pemberitahuan</button><button class="btn btn-danger btn-sm" data-act="pesBulkDel"><i class="bi bi-trash"></i> Hapus Terpilih</button><button class="icon-btn sm" data-act="pesSelClr" style="color:#fff" aria-label="Batal"><i class="bi bi-x-lg"></i></button></div>' : '';
}
ON.pesQ = debounce(function (el) { S.ui.pes.q = el.value; S.ui.pes.page = 1; renderPesBody(); }, 120);
ON.pesKelas = function (el) { S.ui.pes.kelas = el.value; S.ui.pes.page = 1; renderPage(true); };
ON.pesKj = function (el) { S.ui.pes.kj = el.value; S.ui.pes.page = 1; renderPage(true); };
ON.pesSt = function (el) { S.ui.pes.status = el.value; S.ui.pes.page = 1; renderPage(true); };
ON.pesSort = function (el) { S.ui.pes.sort = el.value; S.ui.pes.page = 1; renderPesBody(); };
ON.pesPer = function (el) { S.ui.pes.per = Number(el.value); S.ui.pes.page = 1; renderPesBody(); };
ACT.pesPg = function (el) { S.ui.pes.page = Math.max(1, Number(el.dataset.p)); renderPesBody(); };
ON.pesCk = function (el) { const ui = S.ui.pes; if (el.checked) ui.sel[el.dataset.id] = true; else delete ui.sel[el.dataset.id]; const tr = el.closest('tr'); if (tr) tr.classList.toggle('sel', el.checked); renderPesBulk(); };
ON.pesCkAll = function (el) { const ui = S.ui.pes; pesFiltered().slice((ui.page - 1) * ui.per, ui.page * ui.per).forEach(function (p) { if (el.checked) ui.sel[p.id] = true; else delete ui.sel[p.id]; }); renderPesBody(); renderPesBulk(); };
ACT.pesSelClr = function () { S.ui.pes.sel = {}; renderPesBody(); renderPesBulk(); };
ACT.pesView = function (el) {
  const p = S.peserta.find(function (x) { return x.id === el.dataset.id; }), k = S.kmap[p.idKelas] || {};
  const m = openModal({ size: 'sm', title: 'Detail Peserta', body: '<div class="row g12 mb16"><span class="avatar lg">' + h(ini(p.nama)) + '</span><div><div class="b" style="font-size:17px">' + h(p.nama) + '</div><div class="fs12 muted">' + (p.aktif ? 'Peserta aktif' : 'Nonaktif') + '</div></div></div><div class="recap" style="margin:0"><div class="r"><span>NISN</span><b class="num">' + h(p.nisn) + '</b></div><div class="r"><span>No. Induk</span><b class="num">' + h(p.noInduk || '-') + '</b></div><div class="r"><span>Jenis kelamin</span><b>' + (p.jk === 'P' ? 'Perempuan' : 'Laki-laki') + '</b></div><div class="r"><span>Kelas</span><b>' + h(p.kelasJur || '-') + '</b></div><div class="r"><span>Ekstrakurikuler</span><b>' + h(k.nama || '-') + '</b></div><div class="r"><span>Kehadiran (tervalidasi)</span><b>' + (p.pct === null ? '—' : pct(p.pct)) + '</b></div></div>', footer: '<button class="btn btn-primary" data-x>Tutup</button>' });
  m.q('[data-x]').onclick = m.close;
};
ACT.pesForm = function (el) {
  const p = el.dataset.id ? S.peserta.find(function (x) { return x.id === el.dataset.id; }) : null;
  const m = openModal({ title: p ? 'Ubah Data Peserta' : 'Tambah Peserta', body:
    '<div class="grid g-2 g-mob1"><div>' + field('NISN <span style="color:var(--danger)">*</span>', '<input class="inp mono" id="fNisn" inputmode="numeric" maxlength="12" value="' + h(p ? p.nisn : '') + '" placeholder="mis. 0081234501">', 'Angka 5–12 digit, dapat diawali 0.') + '</div><div>' + field('No. Induk', '<input class="inp mono" id="fInduk" inputmode="numeric" maxlength="15" value="' + h(p ? p.noInduk : '') + '">') + '</div></div>' +
    field('Nama lengkap <span style="color:var(--danger)">*</span>', '<input class="inp" id="fNama" maxlength="80" value="' + h(p ? p.nama : '') + '">') +
    '<div class="grid g-3 g-mob1" style="grid-template-columns:1fr 1fr 1fr"><div>' + field('Jenis kelamin', '<select class="sel" id="fJk"><option value="L"' + (p && p.jk === 'L' ? ' selected' : '') + '>Laki-laki (L)</option><option value="P"' + (p && p.jk === 'P' ? ' selected' : '') + '>Perempuan (P)</option></select>') + '</div><div>' + field('Kelas &amp; jurusan', '<input class="inp" id="fKj" maxlength="30" value="' + h(p ? p.kelasJur : '') + '" placeholder="XI MIPA 1">') + '</div><div>' + field('Status', '<select class="sel" id="fStatus"><option' + (!p || p.aktif ? ' selected' : '') + '>Aktif</option><option' + (p && !p.aktif ? ' selected' : '') + '>Nonaktif</option></select>') + '</div></div>' +
    field('Ekstrakurikuler <span style="color:var(--danger)">*</span>', '<select class="sel" id="fEks"><option value="">— Pilih —</option>' + S.kelas.map(function (k) { return '<option value="' + h(k.id) + '"' + (p && p.idKelas === k.id ? ' selected' : (!p && S.ui.pes.kelas === k.id ? ' selected' : '')) + '>' + h(k.nama) + '</option>'; }).join('') + '</select>'),
    footer: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="fSave">Simpan</button>' });
  m.q('[data-x]').onclick = m.close;
  m.q('#fSave').onclick = function () {
    const rec = { id: p ? p.id : '', nisn: m.q('#fNisn').value.trim(), noInduk: m.q('#fInduk').value, nama: m.q('#fNama').value, jk: m.q('#fJk').value, kelasJur: m.q('#fKj').value, idKelas: m.q('#fEks').value, aktif: m.q('#fStatus').value === 'Aktif' };
    doMutate(m.q('#fSave'), m, p ? 'Data peserta diperbarui.' : 'Peserta ditambahkan.', function () { return call('saveMaster', 'peserta', rec); });
  };
};
ACT.pesDel = async function (el) {
  const p = S.peserta.find(function (x) { return x.id === el.dataset.id; });
  if (!(await confirmBox({ title: 'Hapus peserta?', html: '<b>' + h(p.nama) + '</b> akan dihapus dari daftar. Riwayat presensinya tetap tersimpan di log.', ok: 'Hapus', danger: true }))) return;
  try { await call('deleteMaster', 'peserta', [p.id]); delete S.ui.pes.sel[p.id]; await refreshData(true); toast('Peserta dihapus.', 'ok'); } catch (e) { toast(errMsg(e), 'danger'); }
};
ACT.pesBulkDel = async function () {
  const ids = Object.keys(S.ui.pes.sel);
  if (!(await confirmBox({ title: 'Hapus ' + ids.length + ' peserta?', message: 'Tindakan ini tidak dapat dibatalkan.', ok: 'Hapus ' + ids.length + ' Siswa', danger: true }))) return;
  try { await call('deleteMaster', 'peserta', ids); S.ui.pes.sel = {}; await refreshData(true); toast(ids.length + ' peserta dihapus.', 'ok'); } catch (e) { toast(errMsg(e), 'danger'); }
};
ACT.pesMove = function () {
  const ids = Object.keys(S.ui.pes.sel);
  const m = openModal({ size: 'sm', title: 'Pindahkan ' + ids.length + ' Peserta', body: field('Ekstrakurikuler tujuan', '<select class="sel" id="fEks">' + S.kelas.map(function (k) { return '<option value="' + h(k.id) + '">' + h(k.nama) + '</option>'; }).join('') + '</select>'), footer: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="fSave">Pindahkan</button>' });
  m.q('[data-x]').onclick = m.close;
  m.q('#fSave').onclick = function () { doMutate(m.q('#fSave'), m, ids.length + ' peserta dipindahkan.', async function () { await call('moveParticipants', ids, m.q('#fEks').value); S.ui.pes.sel = {}; }); };
};
ACT.pesNotify = function () {
  const ids = Object.keys(S.ui.pes.sel), names = S.peserta.filter(function (p) { return S.ui.pes.sel[p.id]; }).map(function (p) { return p.nama; });
  const m = openModal({ title: 'Pemberitahuan untuk ' + ids.length + ' Siswa', body: '<p class="t2 fs13 mb16">Susun pengumuman lalu salin untuk dibagikan melalui grup WhatsApp/kelas.</p>' + field('Isi pemberitahuan', '<textarea class="txt" id="nTxt" rows="5">Kepada siswa peserta ekstrakurikuler SMAN 1 Kamal:\n\n\n\nTerima kasih. — Waka Kesiswaan</textarea>') + '<div class="fs12 muted">Penerima: ' + h(names.slice(0, 6).join(', ')) + (names.length > 6 ? ' dan ' + (names.length - 6) + ' lainnya' : '') + '</div>', footer: '<button class="btn btn-secondary" data-x>Tutup</button><button class="btn btn-primary" id="nCopy"><i class="bi bi-clipboard"></i> Salin Teks</button>' });
  m.q('[data-x]').onclick = m.close;
  m.q('#nCopy').onclick = async function () { toast((await copyText(m.q('#nTxt').value + '\n\nPenerima: ' + names.join(', '))) ? 'Teks disalin.' : 'Gagal menyalin.', 'ok'); };
};
ACT.pesCsv = function () {
  const esc = function (v) { return '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"'; };
  const rows = pesFiltered().map(function (p) { return [p.nisn, p.noInduk, p.nama, p.jk, p.kelasJur, (S.kmap[p.idKelas] || {}).nama, p.aktif ? 'Aktif' : 'Nonaktif', p.pct === null ? '' : p.pct].map(esc).join(','); });
  downloadBlob('Data_Peserta_Ekskul.csv', new Blob(['\ufeff' + ['NISN', 'No Induk', 'Nama', 'JK', 'Kelas', 'Ekstrakurikuler', 'Status', 'Persen Hadir'].map(esc).join(',') + '\r\n' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  toast('Data diunduh.', 'ok');
};
ACT.pesTpl = function () {
  if (!window.XLSX) { toast('Pustaka Excel belum termuat. Periksa koneksi internet.', 'warn'); return; }
  const ws = XLSX.utils.aoa_to_sheet([['NISN', 'No Induk', 'Nama Lengkap', 'JK', 'Kelas', 'Ekstrakurikuler (kode atau nama)'], ['0081234599', '14599', 'Contoh Nama Siswa', 'L', 'XI MIPA 1', (S.kelas[0] || {}).kode || 'PSK'], ['0081234598', '14598', 'Contoh Siswi', 'P', 'X-2', (S.kelas[1] || {}).kode || 'PRA']]);
  ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 28 }, { wch: 5 }, { wch: 12 }, { wch: 30 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Peserta');
  downloadBlob('Template_Import_Peserta.xlsx', new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }));
  toast('Template diunduh. Format kolom NISN sebagai Teks agar angka 0 di depan tidak hilang.', 'info');
};
ACT.pesImport = function () { if (!window.XLSX) { toast('Pustaka Excel belum termuat. Periksa koneksi internet.', 'warn'); return; } const f = $('#fileImport'); f.value = ''; f.click(); };
const HDR = { nisn: 'nisn', noinduk: 'noInduk', nomorinduk: 'noInduk', induk: 'noInduk', nama: 'nama', namalengkap: 'nama', namasiswa: 'nama', jk: 'jk', lp: 'jk', jeniskelamin: 'jk', kelas: 'kelas', kelasjurusan: 'kelas', ekstra: 'ekstra', ekstrakurikuler: 'ekstra', ekskul: 'ekstra', kodeekstra: 'ekstra', namaekstra: 'ekstra' };
function readImportFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' }), ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      const rows = json.map(function (r) {
        const o = {}; Object.keys(r).forEach(function (k) { const key = HDR[String(k).toLowerCase().replace(/[^a-z]/g, '').replace(/ekstrakurikuler.*/, 'ekstrakurikuler')]; if (key) o[key] = String(r[k]).trim(); }); return o;
      }).filter(function (o) { return o.nisn || o.nama; });
      if (!rows.length) { toast('File kosong atau header kolom tidak dikenali. Gunakan template resmi.', 'danger'); return; }
      previewImport(rows);
    } catch (err) { toast('File tidak dapat dibaca: ' + errMsg(err), 'danger'); }
  };
  reader.readAsArrayBuffer(file);
}
function previewImport(rows) {
  const known = function (v) { const t = String(v || '').toLowerCase(); return S.kelas.some(function (k) { return k.id.toLowerCase() === t || k.kode.toLowerCase() === t || k.nama.toLowerCase() === t; }); };
  const bad = rows.filter(function (r) { return !known(r.ekstra); }), badNames = Array.from(new Set(bad.map(function (r) { return r.ekstra || '(kosong)'; })));
  const m = openModal({ size: 'lg', title: 'Pratinjau Impor Peserta', body: '<div class="row g8 wrap mb16"><span class="chip blue"><i class="bi bi-file-earmark-spreadsheet"></i> ' + rows.length + ' baris terbaca</span>' + (bad.length ? '<span class="chip" style="background:var(--danger-bg);color:var(--danger-tx)"><i class="bi bi-exclamation-triangle"></i> ' + bad.length + ' baris ekstra tidak dikenal</span>' : '<span class="chip" style="background:var(--ok-bg);color:var(--ok-tx)"><i class="bi bi-check2-circle"></i> Semua ekstrakurikuler dikenali</span>') + '</div>' + (badNames.length ? '<div class="note-box danger mb16"><div class="t">Ekstrakurikuler tidak ditemukan</div>' + h(badNames.slice(0, 6).join(', ')) + ' — baris ini akan dilewati (gunakan kode/nama sesuai Master Kelas Ekstrakurikuler).</div>' : '') +
    '<div class="tbl-wrap card p0 flat"><table class="tbl"><thead><tr><th>NISN</th><th>No. Induk</th><th>Nama</th><th>JK</th><th>Kelas</th><th>Ekstra</th></tr></thead><tbody>' + rows.slice(0, 6).map(function (r) { return '<tr><td class="num">' + h(r.nisn) + '</td><td>' + h(r.noInduk || '') + '</td><td>' + h(r.nama) + '</td><td>' + h(r.jk || 'L') + '</td><td>' + h(r.kelas || '') + '</td><td>' + h(r.ekstra || '') + '</td></tr>'; }).join('') + '</tbody></table></div><div class="hint">Menampilkan 6 baris pertama. NISN yang sudah ada pada ekstrakurikuler yang sama akan diperbarui.</div>', footer: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="impGo"><i class="bi bi-cloud-upload"></i> Impor ' + (rows.length - bad.length) + ' Data</button>' });
  m.q('[data-x]').onclick = m.close;
  m.q('#impGo').onclick = function () {
    const good = rows.filter(function (r) { return known(r.ekstra); });
    withBusy(m.q('#impGo'), async function () {
      try {
        let added = 0, updated = 0, errs = []; const CH = 300;
        for (let i = 0; i < good.length; i += CH) { const r = await call('importPeserta', good.slice(i, i + CH)); added += r.added; updated += r.updated; errs = errs.concat(r.errors.map(function (x) { return x.replace(/Baris (\d+)/, function (mm, n) { return 'Baris ' + (Number(n) + i); }); })); }
        m.close(); await refreshData(true);
        if (errs.length) openModal({ title: 'Hasil Impor', body: '<div class="note-box mb16"><div class="t"><i class="bi bi-check2-circle"></i> Selesai</div>' + added + ' ditambahkan, ' + updated + ' diperbarui, ' + errs.length + ' gagal.</div><div class="fs13 col g4" style="max-height:220px;overflow:auto">' + errs.slice(0, 25).map(function (x) { return '<div style="color:var(--danger-tx)">• ' + h(x) + '</div>'; }).join('') + '</div>', footer: '<button class="btn btn-primary" data-mclose>Tutup</button>' }).q('[data-mclose]').onclick = closeAllModals;
        else toast(added + ' peserta ditambahkan, ' + updated + ' diperbarui.', 'ok', 'Impor berhasil');
      } catch (e) { toast(errMsg(e), 'danger', 'Impor gagal'); }
    }, 'Mengimpor…');
  };
}

// ---------------- BAGIAN 19: AKUN PENGGUNA ----------------
PAGES.akun = function (el) {
  const ui = S.ui.akun2 = S.ui.akun2 || { list: null, q: '' };
  el.innerHTML = '<div class="page col g24">' + pageHead({ title: 'Akun Pengguna', sub: 'Kelola akun Super Admin, Admin/Waka, dan Pembina. Kata sandi disimpan dalam bentuk hash.', actions: '<button class="btn btn-accent" data-act="akForm"><i class="bi bi-person-plus"></i> Tambah Akun</button>' }) + '<div class="card"><div class="inp-wrap" style="max-width:420px"><i class="bi bi-search lead"></i><input class="inp pl" type="search" placeholder="Cari nama atau username…" value="' + h(ui.q) + '" data-on="akQ" autocomplete="off"></div></div><div class="card p0" id="akBody"><div class="skel" style="height:220px"></div></div></div>';
  call('getAkun').then(function (l) { ui.list = l; if (S.page === 'akun') renderAkun(); }).catch(function (e) { toast(errMsg(e), 'danger'); });
  if (ui.list) renderAkun();
};
ON.akQ = debounce(function (el) { S.ui.akun2.q = el.value; renderAkun(); }, 120);
function renderAkun() {
  const ui = S.ui.akun2, q = ui.q.trim().toLowerCase(), box = $('#akBody'); if (!box || !ui.list) return;
  const l = ui.list.filter(function (a) { return !q || (a.nama + ' ' + a.username).toLowerCase().indexOf(q) >= 0; });
  box.innerHTML = l.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pengguna</th><th>Username</th><th>Peran</th><th>Status</th><th>Dibuat</th><th class="right">Aksi</th></tr></thead><tbody>' + l.map(function (a) {
    const me = a.id === S.user.id;
    return '<tr><td><div class="row g12"><span class="avatar sm">' + h(ini(a.nama)) + '</span><b>' + h(a.nama) + '</b>' + (me ? '<span class="tag">Anda</span>' : '') + '</div></td><td class="mono fs13">' + h(a.username) + '</td><td><span class="badge ' + (a.role === ROLE.SUPER ? 'b-tert' : a.role === ROLE.ADMIN ? 'b-blue' : 'b-gray') + '">' + h(a.role) + '</span></td><td>' + (a.status === 'Aktif' ? '<span class="badge b-ok">Aktif</span>' : '<span class="badge b-gray">Nonaktif</span>') + '</td><td class="num fs13 muted">' + h(String(a.dibuat).slice(0, 10)) + '</td>' +
      '<td class="right" style="white-space:nowrap">' + (a.role !== ROLE.PEMBINA ? '<button class="icon-btn sm edit" data-act="akForm" data-id="' + h(a.id) + '" aria-label="Ubah"><i class="bi bi-pencil"></i></button>' : '') + '<button class="icon-btn sm view" data-act="akReset" data-id="' + h(a.id) + '" aria-label="Reset kata sandi" title="Reset kata sandi"><i class="bi bi-key"></i></button>' + (a.role !== ROLE.PEMBINA && !me ? '<button class="icon-btn sm del" data-act="akDel" data-id="' + h(a.id) + '" aria-label="Hapus"><i class="bi bi-trash"></i></button>' : '') + '</td></tr>';
  }).join('') + '</tbody></table></div>' : emptyState('bi-person-x', 'Akun tidak ditemukan');
}
ACT.akReset = function (el) { resetPwFlow(el.dataset.id); };
ACT.akForm = function (el) {
  const a = el.dataset.id ? S.ui.akun2.list.find(function (x) { return x.id === el.dataset.id; }) : null;
  const m = openModal({ title: a ? 'Ubah Akun' : 'Tambah Akun', body: field('Nama lengkap <span style="color:var(--danger)">*</span>', '<input class="inp" id="fNama" maxlength="80" value="' + h(a ? a.nama : '') + '">') + field('Username <span style="color:var(--danger)">*</span>', '<input class="inp mono" id="fUser" maxlength="60" autocapitalize="none" value="' + h(a ? a.username : '') + '">', 'Huruf, angka, titik, garis bawah, strip, atau @.') +
    '<div class="grid g-2 g-mob1"><div>' + field('Peran', '<select class="sel" id="fRole"' + (a ? ' disabled' : '') + '><option' + (a && a.role === ROLE.ADMIN ? ' selected' : '') + '>' + ROLE.ADMIN + '</option><option' + (a && a.role === ROLE.SUPER ? ' selected' : '') + '>' + ROLE.SUPER + '</option></select>', a ? 'Peran tidak dapat diubah.' : 'Akun Pembina dibuat lewat menu Data Pembina.') + '</div><div>' + field('Status', '<select class="sel" id="fStatus"><option' + (!a || a.status === 'Aktif' ? ' selected' : '') + '>Aktif</option><option' + (a && a.status !== 'Aktif' ? ' selected' : '') + '>Nonaktif</option></select>') + '</div></div>' +
    (a ? '' : field('Kata sandi awal (opsional)', '<input class="inp" id="fPw" maxlength="64" placeholder="Acak otomatis jika kosong">')), footer: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="fSave">Simpan</button>' });
  m.q('[data-x]').onclick = m.close;
  m.q('#fSave').onclick = function () {
    const rec = { id: a ? a.id : '', nama: m.q('#fNama').value, username: m.q('#fUser').value, role: a ? a.role : m.q('#fRole').value, status: m.q('#fStatus').value, password: a ? '' : m.q('#fPw').value };
    withBusy(m.q('#fSave'), async function () {
      try { const r = await call('saveMaster', 'akun', rec); m.close(); S.ui.akun2.list = await call('getAkun'); renderAkun(); toast('Akun disimpan.', 'ok'); if (r && r.tempPassword) setTimeout(function () { showCred('Akun Dibuat', r.username, r.tempPassword); }, 250); }
      catch (e) { toast(errMsg(e), 'danger'); }
    }, 'Menyimpan…');
  };
};
ACT.akDel = async function (el) {
  const a = S.ui.akun2.list.find(function (x) { return x.id === el.dataset.id; });
  if (!(await confirmBox({ title: 'Hapus akun?', html: 'Akun <b>' + h(a.username) + '</b> akan dihapus permanen.', ok: 'Hapus', danger: true }))) return;
  try { await call('deleteMaster', 'akun', [a.id]); S.ui.akun2.list = await call('getAkun'); renderAkun(); toast('Akun dihapus.', 'ok'); } catch (e) { toast(errMsg(e), 'danger'); }
};

// ---------------- BAGIAN 20: REKAPITULASI & LAPORAN ----------------
function deliverFile(name, mime, b64) {
  try { downloadBlob(name, b64ToBlob(b64, mime)); toast(name + ' siap diunduh.', 'ok', 'File dibuat'); }
  catch (e) { toast('Gagal mengunduh: ' + errMsg(e), 'danger'); }
}
function prevYm(ym) { const p = ym.split('-'), d = new Date(Number(p[0]), Number(p[1]) - 2, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
function monthOptions(sel, n) {
  let o = '', ym = S.today.slice(0, 7);
  for (let i = 0; i < (n || 12); i++) {
    o += '<option value="' + ym + '"' + (sel === ym ? ' selected' : '') + '>' + h(bulanLabel(ym)) + '</option>';
    const p = ym.split('-'), d = new Date(Number(p[0]), Number(p[1]) - 2, 1); ym = d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  return o;
}
PAGES.rekap = function (el) {
  const ui = S.ui.rk = S.ui.rk || { bulan: S.today.slice(0, 7), idKelas: '', st: '', q: '', sum: null, sumKey: '', cache: {} };
  if (!ui.idKelas && S.kelas.length) ui.idKelas = S.kelas[0].id;
  if (!ui.sum || ui.sumKey !== ui.bulan) {
    el.innerHTML = '<div class="page col g16"><div class="skel" style="height:100px"></div><div class="grid g-4"><div class="skel" style="height:100px"></div><div class="skel" style="height:100px"></div><div class="skel" style="height:100px"></div><div class="skel" style="height:100px"></div></div><div class="skel" style="height:300px"></div></div>';
    const key = ui.bulan;
    call('getRekapSummary', key).then(function (r) { ui.sum = r; ui.sumKey = key; if (S.page === 'rekap') renderPage(true); }).catch(function (e) { toast(errMsg(e), 'danger'); });
    return;
  }
  if (!ui.kelasPicked && ui.sum) { const f = ui.sum.perKelas.find(function (x) { return x.sesi > 0; }); if (f) ui.idKelas = f.id; }
  const sm = ui.sum, tot = sm.dist.h + sm.dist.s + sm.dist.i + sm.dist.a, sesiN = sm.perKelas.reduce(function (a, x) { return a + x.sesi; }, 0);
  if (!sesiN && !ui.picked && !ui.autoTried) { ui.autoTried = true; ui.bulan = prevYm(ui.bulan); ui.cache = {}; ui.sum = null; toast('Belum ada sesi tervalidasi bulan ini; menampilkan bulan sebelumnya.', 'info'); renderPage(true); return; }
  el.innerHTML = '<div class="page col g24">' + pageHead({ title: 'Rekapitulasi &amp; Laporan', sub: 'Analisis kehadiran dari sesi yang sudah <b>divalidasi</b> Waka Kesiswaan. Periode ' + h(sm.bulanLabel) + '.', actions: '<select class="sel" style="width:190px" data-onchange="rkBulan" aria-label="Bulan">' + monthOptions(ui.bulan) + '</select><button class="btn btn-primary" data-act="rkToDoc"><i class="bi bi-printer"></i> Cetak Dokumen Resmi</button>' }) +
    '<div class="grid g-4"><div class="card kpi"><div class="row between top"><div class="l">Rata-rata Kehadiran</div><span class="ico amber"><i class="bi bi-graph-up-arrow"></i></span></div><div class="v">' + (tot ? pct(sm.pct) : '—') + '</div><div class="foot"><span class="tag ' + (sm.pct >= sm.target ? 'ok' : 'warn') + '">Target KKM ' + sm.target + '%</span></div></div>' +
    '<div class="card kpi"><div class="row between top"><div class="l">Sesi Tervalidasi</div><span class="ico"><i class="bi bi-patch-check"></i></span></div><div class="v">' + sesiN + ' <small>Sesi</small></div><div class="foot"><span>' + tot + ' catatan kehadiran</span></div></div>' +
    '<div class="card kpi"><div class="row between top"><div class="l">Hadir</div><span class="ico"><i class="bi bi-check2-circle"></i></span></div><div class="v">' + nf(sm.dist.h) + '</div><div class="foot"><span class="tag ok">' + (tot ? pct(sm.dist.h / tot * 100) : '—') + '</span></div></div>' +
    '<div class="card kpi"><div class="row between top"><div class="l">Sakit / Izin / Alpa</div><span class="ico red"><i class="bi bi-person-x"></i></span></div><div class="v" style="font-size:26px">' + sm.dist.s + ' / ' + sm.dist.i + ' / ' + sm.dist.a + '</div><div class="foot"><span>Total tidak hadir ' + (sm.dist.s + sm.dist.i + sm.dist.a) + '</span></div></div></div>' +
    '<div class="grid g-side"><div class="card"><div class="card-h"><div><h3>Kehadiran per Ekstrakurikuler</h3><div class="sub">Persentase kehadiran bulan ' + h(sm.bulanLabel) + ' (garis putus = target KKM)</div></div></div><div class="chart-box" style="height:' + Math.max(240, sm.perKelas.length * 34 + 40) + 'px"><canvas id="cPer"></canvas></div></div>' +
    '<div class="col g16"><div class="card"><div class="card-h"><h3>Tren 6 Bulan</h3></div><div class="chart-box" style="height:170px"><canvas id="cTrend6"></canvas></div></div><div class="card"><div class="card-h"><h3>Distribusi Status</h3></div><div class="donut-wrap">' + donutSvg([{ v: sm.dist.h, color: '#2563eb' }, { v: sm.dist.s, color: '#f59e0b' }, { v: sm.dist.i, color: '#93c5fd' }, { v: sm.dist.a, color: '#dc2626' }], sesiN, 120) + '<div class="stat-list"><div class="r"><span class="dot"></span>Hadir<span class="pc">' + sm.dist.h + '</span></div><div class="r"><span class="dot warn"></span>Sakit<span class="pc">' + sm.dist.s + '</span></div><div class="r"><span class="dot" style="background:#93c5fd"></span>Izin<span class="pc">' + sm.dist.i + '</span></div><div class="r"><span class="dot danger"></span>Alpa<span class="pc">' + sm.dist.a + '</span></div></div></div></div></div></div>' +
    '<div class="card p0"><div style="padding:20px 24px 0"><div class="card-h"><div><h3 style="font-size:18px">Rekap per Peserta</h3><div class="sub">Pilih ekstrakurikuler untuk melihat rincian kehadiran siswa.</div></div></div><div class="filters"><select class="sel" data-onchange="rkKelas" aria-label="Ekstrakurikuler">' + S.kelas.map(function (k) { return '<option value="' + h(k.id) + '"' + (ui.idKelas === k.id ? ' selected' : '') + '>' + h(k.nama) + '</option>'; }).join('') + '</select><select class="sel" data-onchange="rkSt" aria-label="Filter status"><option value="">Semua Siswa</option><option value="low"' + (ui.st === 'low' ? ' selected' : '') + '>Di bawah target KKM</option><option value="alpa"' + (ui.st === 'alpa' ? ' selected' : '') + '>Pernah Alpa</option><option value="sakit"' + (ui.st === 'sakit' ? ' selected' : '') + '>Pernah Sakit</option><option value="izin"' + (ui.st === 'izin' ? ' selected' : '') + '>Pernah Izin</option></select><div class="search-lg inp-wrap"><i class="bi bi-search lead"></i><input class="inp pl" type="search" placeholder="Cari nama/NISN…" value="' + h(ui.q) + '" data-on="rkQ" autocomplete="off"></div></div></div><div class="mt16" id="rkTable"></div></div></div>';
  drawRekapCharts(sm);
  loadRekapTable();
};
function drawRekapCharts(sm) {
  const col = chartColors(), sorted = sm.perKelas.slice().sort(function (a, b) { return b.pct - a.pct; });
  makeChart('per', 'cPer', { type: 'bar', data: { labels: sorted.map(function (x) { return x.nama; }), datasets: [{ data: sorted.map(function (x) { return x.sesi ? x.pct : null; }), backgroundColor: sorted.map(function (x) { return x.pct >= sm.target ? col.bar : (x.pct >= 70 ? '#f59e0b' : '#dc2626'); }), borderRadius: 5, barThickness: 18 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.parsed.x + '% (' + sorted[c.dataIndex].sesi + ' sesi)'; } } } }, scales: { x: { min: 0, max: 100, ticks: { color: col.text, callback: function (v) { return v + '%'; } }, grid: { color: col.grid } }, y: { ticks: { color: col.text, font: { size: 11 } }, grid: { display: false } } } } });
  makeChart('t6', 'cTrend6', { type: 'line', data: { labels: sm.trend.map(function (t) { return t.label; }), datasets: [{ data: sm.trend.map(function (t) { return t.pct; }), borderColor: col.bar, backgroundColor: 'rgba(37,99,235,.12)', fill: true, tension: .35, pointRadius: 3, spanGaps: true }, { data: sm.trend.map(function () { return sm.target; }), borderColor: col.amber, borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 50, max: 100, ticks: { color: col.text, callback: function (v) { return v + '%'; }, stepSize: 25 }, grid: { color: col.grid } }, x: { ticks: { color: col.text }, grid: { display: false } } } } });
}
ON.rkBulan = function (el) { S.ui.rk.bulan = el.value; S.ui.rk.picked = true; S.ui.rk.cache = {}; renderPage(true); };
ON.rkKelas = function (el) { S.ui.rk.idKelas = el.value; S.ui.rk.kelasPicked = true; loadRekapTable(); };
ON.rkSt = function (el) { S.ui.rk.st = el.value; drawRekapTable(); };
ON.rkQ = debounce(function (el) { S.ui.rk.q = el.value; drawRekapTable(); }, 120);
ACT.rkToDoc = function () { navigate('cetak', { idKelas: S.ui.rk.idKelas, bulan: S.ui.rk.bulan }); };
function loadRekapTable() {
  const ui = S.ui.rk, key = ui.idKelas + '|' + ui.bulan, box = $('#rkTable'); if (!box) return;
  if (ui.cache[key]) { drawRekapTable(); return; }
  box.innerHTML = '<div class="skel" style="height:200px;margin:0 24px 24px"></div>';
  call('getRekap', { idKelas: ui.idKelas, bulan: ui.bulan }).then(function (d) { ui.cache[key] = d; if (S.page === 'rekap' && ui.idKelas + '|' + ui.bulan === key) drawRekapTable(); })
    .catch(function (e) { box.innerHTML = emptyState('bi-exclamation-triangle', errMsg(e)); });
}
function drawRekapTable() {
  const ui = S.ui.rk, d = ui.cache[ui.idKelas + '|' + ui.bulan], box = $('#rkTable'); if (!d || !box) return;
  const q = ui.q.trim().toLowerCase(), kkm = d.kkm;
  const rows = d.rows.filter(function (r) {
    if (q && (r.nama + ' ' + r.nisn).toLowerCase().indexOf(q) < 0) return false;
    if (ui.st === 'low') return (r.h + r.s + r.i + r.a) > 0 && r.pct < kkm; if (ui.st === 'alpa') return r.a > 0; if (ui.st === 'sakit') return r.s > 0; if (ui.st === 'izin') return r.i > 0; return true;
  });
  box.innerHTML = (d.sesiValid ? '' : '<div style="padding:0 24px 16px"><div class="note-box warn"><div class="t"><i class="bi bi-info-circle"></i> Belum ada sesi tervalidasi</div>Rekap resmi hanya menghitung sesi berstatus Divalidasi' + (d.sesiBelumValid ? ' (' + d.sesiBelumValid + ' sesi masih menunggu).' : '.') + '</div></div>') +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>No</th><th>Siswa</th><th>Kelas</th><th>H</th><th>S</th><th>I</th><th>A</th><th style="min-width:130px">% Hadir</th><th>Keterangan</th></tr></thead><tbody>' +
    (rows.length ? rows.map(function (r) { return '<tr><td class="num muted">' + r.no + '</td><td><b>' + h(r.nama) + '</b><div class="fs12 muted num">' + h(r.nisn) + '</div></td><td class="fs13">' + h(r.kelasJur) + '</td><td class="num"><b style="color:var(--ok-tx)">' + r.h + '</b></td><td class="num">' + r.s + '</td><td class="num">' + r.i + '</td><td class="num"><b style="color:' + (r.a ? 'var(--danger-tx)' : 'inherit') + '">' + r.a + '</b></td><td>' + ((r.h + r.s + r.i + r.a) ? '<div class="row g8"><div class="bar grow ' + pctClass(r.pct) + '"><i style="width:' + Math.min(100, r.pct) + '%"></i></div><b class="num fs13">' + Math.round(r.pct) + '%</b></div>' : '<span class="muted">—</span>') + '</td><td class="fs13 t2">' + h(r.ket) + '</td></tr>'; }).join('') : '<tr><td colspan="9">' + emptyState('bi-inbox', 'Tidak ada data') + '</td></tr>') + '</tbody></table></div>' +
    '<div class="pager"><span>' + rows.length + ' siswa • rata-rata <b>' + pct(d.avg) + '</b> • ' + d.sesiValid + ' pertemuan tervalidasi</span><button class="btn btn-secondary btn-sm" data-act="rkToDoc"><i class="bi bi-printer"></i> Buka Dokumen Resmi</button></div>';
}

// ---------------- BAGIAN 21: CETAK DOKUMEN RESMI ----------------
function qrSvg(text) {
  try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }); } catch (e) { return ''; }
}
function stampSvg(ok) {
  if (!ok) return '';
  return '<svg viewBox="0 0 100 100" width="92" height="92" style="position:absolute;left:10px;top:-6px;opacity:.88"><defs><path id="stA" d="M50 50 m-36 0 a36 36 0 1 1 72 0"/><path id="stB" d="M50 50 m-36 0 a36 36 0 0 0 72 0"/></defs><circle cx="50" cy="50" r="46" fill="none" stroke="#1d4ed8" stroke-width="1.6" stroke-dasharray="4 3"/><circle cx="50" cy="50" r="30" fill="none" stroke="#1d4ed8" stroke-width=".8"/><text font-family="Arial" font-size="8" font-weight="700" fill="#1d4ed8" letter-spacing="1"><textPath href="#stA" startOffset="50%" text-anchor="middle">PEMERINTAH JAWA TIMUR</textPath></text><text font-family="Arial" font-size="8" font-weight="700" fill="#1d4ed8" letter-spacing="1"><textPath href="#stB" startOffset="50%" text-anchor="middle">SMAN 1 KAMAL</textPath></text><text x="50" y="47" text-anchor="middle" font-family="Arial" font-size="7" font-weight="800" fill="#1d4ed8">? RESMI ?</text><text x="50" y="57" text-anchor="middle" font-family="Arial" font-size="7.5" font-weight="800" fill="#1d4ed8">TERVALIDASI</text></svg>';
}
function docHtml(d) {
  const m = d.meta, nd = d.dates.length, MK = { Hadir: '<span class="mk-H">?</span>', Sakit: '<span class="mk-S">S</span>', Izin: '<span class="mk-I">I</span>', Alpa: '<span class="mk-A">A</span>' };
  const allValid = d.sesiValid > 0 && d.sesiBelumValid === 0;
  const qr = qrSvg('SIABSENS-EKSKUL|' + m.nomor + '|VER:' + m.kodeVerifikasi + '|' + m.waktuServer);
  const body = d.rows.map(function (r) {
    const ketCls = r.ket === 'Sangat Baik' || r.ket === 'Baik' ? 'mk-H' : (r.ket === 'Perlu Pembinaan' ? 'mk-A' : '');
    return '<tr><td>' + r.no + '</td><td style="font-family:ui-monospace,Menlo,monospace">' + h(r.nisn) + '</td><td style="font-family:ui-monospace,Menlo,monospace">' + h(r.noInduk) + '</td><td class="nm">' + h(r.nama) + '</td><td>' + h(r.kelasJur) + '</td>' +
      r.marks.map(function (x) { return '<td>' + (MK[x] || '-') + '</td>'; }).join('') + '<td class="hh">' + r.h + '</td><td class="ss">' + r.s + '</td><td class="ii">' + r.i + '</td><td class="aa">' + r.a + '</td><td><b>' + Math.round(r.pct) + '%</b></td><td class="' + ketCls + '" style="font-size:10px">' + h(r.ket) + '</td></tr>';
  }).join('');
  return '<div class="paper">' + (d.sesiValid ? '<div class="wm">' + (allValid ? 'DOKUMEN RESMI' : 'BELUM SELURUHNYA TERVALIDASI') + '</div>' : '') +
    '<div class="kop"><div style="width:70px;height:70px;flex-shrink:0">' + logoHtml('') + '</div><div class="mid"><div class="l1">' + h(m.kop.l1) + '</div><div class="l1">' + h(m.kop.l2) + '</div><div class="l1" style="font-size:12.5px">' + h(m.kop.l3) + '</div><div class="sch">' + h(m.kop.sekolah) + '</div><div class="adr">' + h(m.kop.alamat) + '<br>' + h(m.kop.kontak) + '</div></div><div style="width:70px;flex-shrink:0"></div></div>' +
    '<div class="ttl"><h2>REKAPITULASI KEHADIRAN KEGIATAN EKSTRAKURIKULER</h2><div class="p">BULAN: ' + h(d.bulanLabel.toUpperCase()) + ' • TAHUN AJARAN ' + h(m.tahunAjaran) + '</div><div class="no">NOMOR DOKUMEN: ' + h(m.nomor) + '</div></div>' +
    '<div class="meta"><div><span class="k">Nama Ekstrakurikuler</span><span><b>' + h(d.kelas.nama.toUpperCase()) + '</b></span></div><div><span class="k">Jadwal Latihan</span><span>' + h(m.jadwal) + '</span></div><div><span class="k">Nama Pembina</span><span>' + h(d.pembina.nama) + '</span></div><div><span class="k">Lokasi Kegiatan</span><span>' + h(m.lokasi || '-') + '</span></div><div><span class="k">NIP Pembina</span><span style="font-family:ui-monospace,Menlo,monospace">' + h(d.pembina.nip || '-') + '</span></div><div><span class="k">Jumlah Pertemuan</span><span>' + d.sesiValid + ' Sesi Terverifikasi</span></div></div>' +
    (nd ? '<table><thead><tr><th rowspan="2" style="width:28px">NO</th><th rowspan="2" style="width:78px">NISN</th><th rowspan="2" style="width:50px">NO.<br>INDUK</th><th rowspan="2" style="min-width:150px">NAMA LENGKAP<br>SISWA</th><th rowspan="2" style="width:62px">KELAS</th><th colspan="' + nd + '">PERTEMUAN (' + h(d.bulanLabel.split(' ')[0].toUpperCase()) + ')</th><th colspan="4">TOTAL</th><th rowspan="2" style="width:42px">%<br>HADIR</th><th rowspan="2" style="min-width:84px">KETERANGAN</th></tr><tr>' + d.dates.map(function (x) { return '<th style="width:34px;font-weight:600">' + h(x.label) + '</th>'; }).join('') + '<th style="width:26px;background:#dcfce7">H</th><th style="width:26px;background:#fef3c7">S</th><th style="width:26px;background:#e0f2fe">I</th><th style="width:26px;background:#fee2e2">A</th></tr></thead><tbody>' + body +
      '<tr class="sum"><td colspan="5" style="text-align:right">RATA-RATA KEHADIRAN KELAS EKSTRAKURIKULER:</td><td colspan="' + nd + '">' + nd + ' Pertemuan Efektif</td><td>' + d.tot.h + '</td><td>' + d.tot.s + '</td><td>' + d.tot.i + '</td><td>' + d.tot.a + '</td><td>' + String(d.avg).replace('.', ',') + '%</td><td>' + (d.tuntas ? 'TUNTAS KKM' : 'BELUM TUNTAS') + '</td></tr></tbody></table>' : '<div style="padding:40px;text-align:center;font-family:Arial;border:1px dashed #999">Belum ada sesi berstatus <b>Divalidasi</b> pada periode ini.</div>') +
    '<div class="sign"><div><div>Mengetahui,<br><b>Wakil Kepala Sekolah Bidang Kesiswaan<br>SMAN 1 Kamal Bangkalan</b></div><div class="sp">' + stampSvg(allValid) + '</div><div class="nm2">' + h(m.waka.nama) + '</div><div class="nip">NIP. ' + h(m.waka.nip) + '</div></div>' +
    '<div><div>' + h(m.tanggalCetak) + '<br><b>Pembina Ekstrakurikuler ' + h(d.kelas.nama) + '<br>SMAN 1 Kamal</b></div><div class="sp"></div><div class="nm2">' + h(d.pembina.nama) + '</div><div class="nip">NIP. ' + h(d.pembina.nip || '-') + '</div></div></div>' +
    '<div class="foot"><div class="row g12" style="display:flex;gap:12px;align-items:center"><div class="qr">' + qr + '</div><div><b>Verifikasi Keaslian Dokumen SIABSENS-EKSKUL</b><br>Pindai kode QR untuk memvalidasi integritas log presensi.<br><span style="font-family:ui-monospace,Menlo,monospace;color:#777">KODE: ' + h(m.kodeVerifikasi) + '</span></div></div><div style="text-align:right;font-family:ui-monospace,Menlo,monospace;color:#777;line-height:14px">Dicetak otomatis melalui SIABSENS-EKSKUL<br>Waktu Server: ' + h(m.waktuServer) + ' WIB<br>Hanya memuat sesi berstatus Divalidasi</div></div></div>';
}
PAGES.cetak = function (el) {
  const ui = S.ui.ct = S.ui.ct || { idKelas: '', bulan: S.today.slice(0, 7), zoom: 'fit', cache: {} };
  if (S.params.idKelas) ui.idKelas = S.params.idKelas; if (S.params.bulan) { ui.bulan = S.params.bulan; ui.picked = true; } S.params = {};
  if (!ui.idKelas || !S.kmap[ui.idKelas]) ui.idKelas = (isPembina() ? (curKelas() || {}).id : (S.kelas[0] || {}).id) || '';
  if (!ui.idKelas) { el.innerHTML = '<div class="card">' + emptyState('bi-printer', 'Belum ada ekstrakurikuler') + '</div>'; return; }
  const key = ui.idKelas + '|' + ui.bulan, d = ui.cache[key];
  const head = '<div class="card"><div class="row between g16 wrap"><div><div class="row g8"><span class="dot ok"></span><b style="font-family:var(--f-head);font-size:16px">Dokumen Rekapitulasi Resmi Siap Tanda Tangan</b></div><div class="fs13 muted mt4">Periode ' + h(bulanLabel(ui.bulan)) + ' • ' + h((S.kmap[ui.idKelas] || {}).nama) + '</div></div><div class="row g8 wrap"><select class="sel" style="width:240px" data-onchange="ctKelas" aria-label="Ekstrakurikuler">' + S.kelas.map(function (k) { return '<option value="' + h(k.id) + '"' + (ui.idKelas === k.id ? ' selected' : '') + '>' + h(k.nama) + '</option>'; }).join('') + '</select><select class="sel" style="width:170px" data-onchange="ctBulan" aria-label="Bulan">' + monthOptions(ui.bulan) + '</select></div></div>' +
    '<div class="doc-tools mt16"><div class="zoom-box"><button class="icon-btn sm" data-act="ctZoom" data-d="-10" aria-label="Perkecil"><i class="bi bi-zoom-out"></i></button><b class="num fs13" id="zoomLbl" style="min-width:40px;text-align:center">100%</b><button class="icon-btn sm" data-act="ctZoom" data-d="10" aria-label="Perbesar"><i class="bi bi-zoom-in"></i></button><span style="width:1px;height:18px;background:var(--border-strong)"></span><button class="btn btn-ghost btn-sm" data-act="ctFit">Fit to Width</button></div><span class="spacer"></span>' +
    '<button class="btn btn-secondary" data-act="ctPrint"' + (d && d.sesiValid ? '' : ' disabled') + '><i class="bi bi-printer"></i> Cetak Langsung</button><button class="btn btn-soft" data-act="ctExport" data-f="xlsx"' + (d && d.sesiValid ? '' : ' disabled') + '><i class="bi bi-file-earmark-excel"></i> Export Excel (.xlsx)</button><button class="btn btn-primary" data-act="ctExport" data-f="pdf"' + (d && d.sesiValid ? '' : ' disabled') + '><i class="bi bi-file-earmark-pdf"></i> Download PDF Resmi</button></div></div>';
  if (!d) {
    el.innerHTML = '<div class="page col g16">' + head + '<div class="skel" style="height:420px"></div></div>';
    call('getRekap', { idKelas: ui.idKelas, bulan: ui.bulan }).then(function (r) { ui.cache[key] = r; if (S.page === 'cetak') renderPage(true); }).catch(function (e) { toast(errMsg(e), 'danger'); });
    return;
  }
  if (!d.sesiValid && !ui.picked && !ui.autoTried) { ui.autoTried = true; ui.bulan = prevYm(ui.bulan); toast('Belum ada sesi tervalidasi bulan ini; menampilkan bulan sebelumnya.', 'info'); renderPage(true); return; }
  el.innerHTML = '<div class="page col g16">' + head + (d.sesiBelumValid ? '<div class="note-box warn"><div class="t"><i class="bi bi-exclamation-triangle"></i> ' + d.sesiBelumValid + ' sesi belum divalidasi</div>Sesi yang belum divalidasi Waka Kesiswaan tidak dihitung dalam dokumen resmi ini.</div>' : '') + '<div class="doc-stage" id="docStage"><div id="docWrap" style="margin:0 auto"><div id="docScale" class="doc-scale" style="width:1040px">' + docHtml(d) + '</div></div></div></div>';
  setTimeout(applyZoom, 0);
};
ON.ctKelas = function (el) { S.ui.ct.idKelas = el.value; renderPage(true); };
ON.ctBulan = function (el) { S.ui.ct.bulan = el.value; S.ui.ct.picked = true; renderPage(true); };
function applyZoom() {
  const ui = S.ui.ct, st = $('#docStage'), sc = $('#docScale'), wrap = $('#docWrap'); if (!st || !sc) return;
  const paper = $('.paper', sc); if (!paper) return;
  let z = ui.zoom === 'fit' ? Math.min(1.4, (st.clientWidth - (window.innerWidth < 768 ? 16 : 48)) / 1040) : ui.zoom / 100;
  z = Math.max(0.25, Math.min(2, z));
  sc.style.transform = 'scale(' + z + ')'; wrap.style.width = Math.round(1040 * z) + 'px'; wrap.style.height = Math.round(paper.offsetHeight * z) + 'px';
  const lb = $('#zoomLbl'); if (lb) lb.textContent = Math.round(z * 100) + '%';
  ui._z = z;
}
ACT.ctZoom = function (el) { const ui = S.ui.ct, cur = Math.round((ui._z || 1) * 100); ui.zoom = Math.max(30, Math.min(200, cur + Number(el.dataset.d))); applyZoom(); };
ACT.ctFit = function () { S.ui.ct.zoom = 'fit'; applyZoom(); };
window.addEventListener('resize', debounce(function () { if (S.page === 'cetak' && S.ui.ct && S.ui.ct.zoom === 'fit') applyZoom(); }, 150));
ACT.ctPrint = function () {
  const ui = S.ui.ct, d = ui.cache[ui.idKelas + '|' + ui.bulan], p = $('#docScale .paper'); if (!p || !d) return;
  const root = $('#printRoot'); root.innerHTML = ''; root.appendChild(p.cloneNode(true));
  let st = $('#pgStyle'); if (!st) { st = document.createElement('style'); st.id = 'pgStyle'; document.head.appendChild(st); }
  st.textContent = '@page{size:A4 ' + (d.dates.length > 4 ? 'landscape' : 'portrait') + ';margin:10mm}';
  const clean = function () { root.innerHTML = ''; window.removeEventListener('afterprint', clean); };
  window.addEventListener('afterprint', clean);
  setTimeout(function () { try { window.print(); } catch (e) { toast('Cetak langsung tidak tersedia pada jendela ini. Gunakan Download PDF Resmi.', 'warn'); clean(); } }, 60);
};
ACT.ctExport = async function (btn) {
  const ui = S.ui.ct, f = btn.dataset.f;
  await withBusy(btn, async function () {
    try { const r = await call('exportRekap', { idKelas: ui.idKelas, bulan: ui.bulan, format: f }); deliverFile(r.filename, r.mime, r.data); }
    catch (e) { toast(errMsg(e), 'danger', 'Gagal membuat file'); }
  }, f === 'pdf' ? 'Membuat PDF…' : 'Membuat Excel…');
};

// ---------------- BAGIAN 26: CETAK KARTU PESERTA (Super Admin) ----------------
// Kartu CR80 potret (54 × 85,6 mm). Identitas: nama, NISN, ekstrakurikuler.
// Kode batang: GS1 QR Code, AI (91) berisi NISN ? posisinya di BAWAH identitas.
// PDF dibuat di peramban (vektor) memakai jsPDF + bwip-js (matriks GS1 QR).
const CARD = { W: 54, H: 85.6, QR: 25, QRBOX: 29 };
const LOGO_SVG_ = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 112" width="200" height="224"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b62d6"/><stop offset="1" stop-color="#1f3f9e"/></linearGradient></defs><path d="M50 4 L92 18 V54 C92 82 74 100 50 108 C26 100 8 82 8 54 V18 Z" fill="url(#g)"/><path d="M50 11 L85 23 V54 C85 78 70 93 50 100 C30 93 15 78 15 54 V23 Z" fill="none" stroke="#f59e0b" stroke-width="2.4" stroke-dasharray="4.5 3.5" stroke-linecap="round"/><path d="M50 28 C58 36 58 50 54 58 H46 C42 50 42 36 50 28 Z" fill="#f59e0b"/><circle cx="50" cy="42" r="3.4" fill="#fff"/><path d="M46 58 L42 66 L48 62 Z M54 58 L58 66 L52 62 Z" fill="#d97706"/><circle cx="32" cy="40" r="2" fill="#f59e0b"/><circle cx="28" cy="50" r="1.6" fill="#f59e0b"/><path d="M22 66 C34 62 44 64 50 69 C56 64 66 62 78 66 V80 C66 76 56 78 50 83 C44 78 34 76 22 80 Z" fill="#fff"/><path d="M50 69 V83" stroke="#cbd5e1" stroke-width="1.2"/><circle cx="68" cy="42" r="10" fill="#fff"/><circle cx="68" cy="42" r="8" fill="#16a34a"/><path d="M63.6 42.2 L67 45.6 L72.6 39.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function libsReady_() {
  if (!(window.jspdf && window.jspdf.jsPDF) || !(window.bwipjs && typeof window.bwipjs.raw === 'function')) throw new Error('Pustaka PDF / GS1 QR belum termuat. Periksa koneksi internet lalu muat ulang halaman.');
}
/** Teks GS1 (Application Identifier 91 = informasi internal organisasi) berisi NISN */
function gs1Text_(nisn) { const v = String(nisn || '').replace(/[^A-Za-z0-9]/g, ''); return '(91)' + v; }
/** Matriks modul GS1 QR Code (FNC1 posisi pertama) */
function gs1Matrix_(nisn) {
  const r = window.bwipjs.raw({ bcid: 'gs1qrcode', text: gs1Text_(nisn), eclevel: 'M' })[0];
  return { n: r.pixx, get: function (x, y) { return r.pixs[y * r.pixx + x] === 1; } };
}
function latin_(t) {
  return String(t === null || t === undefined ? '' : t).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/[^\x20-\x7e]/g, '?');
}
function slug_(t) { return latin_(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'kartu'; }

// -- Logo ? PNG (agar bisa ditanam di PDF) --
function loadImg_(src, cors) { return new Promise(function (res) { const i = new Image(); if (cors) i.crossOrigin = 'anonymous'; i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; }); }
function raster_(img) { try { const cv = document.createElement('canvas'); cv.width = 200; cv.height = 224; cv.getContext('2d').drawImage(img, 0, 0, 200, 224); return cv.toDataURL('image/png'); } catch (e) { return null; } }
async function logoPng_() {
  const key = String(S.cfg.logoUrl || '');
  if (S._logoKey === key && S._logoPng !== undefined) return S._logoPng;
  let out = null;
  if (key) {
    const m = key.match(/\/d\/([\w-]+)/) || key.match(/[?&]id=([\w-]+)/);
    const img = await loadImg_(m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w256' : key, true);
    if (img) out = raster_(img);
  }
  if (!out) { const img = await loadImg_('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(LOGO_SVG_), false); if (img) out = raster_(img); }
  S._logoKey = key; S._logoPng = out; return out;
}

// -- Menggambar satu kartu ke PDF (satuan mm) --
function fitLines_(doc, text, maxW, size, minSize, maxLines) {
  let s = size; doc.setFontSize(s);
  let lines = doc.splitTextToSize(text, maxW);
  while (lines.length > maxLines && s > minSize) { s -= 0.5; doc.setFontSize(s); lines = doc.splitTextToSize(text, maxW); }
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,3}$/, '') + '...'; }
  return { lines: lines, size: s, step: s * 0.3528 * 1.16 };
}
function drawQr_(doc, m, x, y, size) {
  const cell = size / m.n; doc.setFillColor(0, 0, 0);
  for (let r = 0; r < m.n; r++) {
    let c = 0;
    while (c < m.n) { if (m.get(c, r)) { let e = c; while (e < m.n && m.get(e, r)) e++; doc.rect(x + c * cell, y + r * cell, (e - c) * cell + 0.02, cell + 0.02, 'F'); c = e; } else c++; }
  }
}
function drawCard_(doc, x, y, p, ekstra, logo) {
  const W = CARD.W, H = CARD.H, cx = x + W / 2;
  // bingkai & latar
  doc.setFillColor(255, 255, 255); doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.2); doc.roundedRect(x, y, W, H, 3, 3, 'FD');
  // kepala biru tua + garis amber
  doc.setFillColor(30, 58, 138); doc.roundedRect(x, y, W, 17, 3, 3, 'F'); doc.rect(x, y + 3, W, 14, 'F');
  doc.setFillColor(245, 158, 11); doc.rect(x, y + 17, W, 0.9, 'F');
  if (logo) { doc.setFillColor(255, 255, 255); doc.roundedRect(x + 3, y + 2.6, 11.2, 11.8, 2, 2, 'F'); doc.addImage(logo, 'PNG', x + 3.7, y + 3.1, 9.8, 10.9); }
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('KARTU PESERTA', x + 16.5, y + 7.2);
  doc.setFontSize(6.2); doc.text('EKSTRAKURIKULER', x + 16.5, y + 10.6);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.6); doc.setTextColor(245, 158, 11); doc.text('SMAN 1 KAMAL', x + 16.5, y + 14);
  // identitas
  const px = x + 5, pw = W - 10; let yy = y + 22.6;
  const label = function (t) { doc.setFont('helvetica', 'bold'); doc.setFontSize(4.6); doc.setTextColor(100, 116, 139); doc.text(t, px, yy); };
  label('NAMA PESERTA');
  doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
  const nm = fitLines_(doc, latin_(p.nama).toUpperCase(), pw, 10, 7, 2); yy += 3.6; doc.setFontSize(nm.size);
  nm.lines.forEach(function (ln, i) { doc.text(ln, px, yy + i * nm.step); }); yy += (nm.lines.length - 1) * nm.step + 4.4;
  label('NISN'); yy += 3.5; doc.setFont('courier', 'bold'); doc.setFontSize(10); doc.setTextColor(15, 23, 42); doc.text(latin_(p.nisn), px, yy); yy += 4.6;
  label('EKSTRAKURIKULER'); yy += 3.3; doc.setFont('helvetica', 'bold'); doc.setTextColor(29, 78, 216);
  const ek = fitLines_(doc, latin_(ekstra), pw, 8, 6, 2); doc.setFontSize(ek.size); ek.lines.forEach(function (ln, i) { doc.text(ln, px, yy + i * ek.step); });
  // GS1 QR Code — di BAWAH identitas
  const bx = cx - CARD.QRBOX / 2, by = y + 51;
  doc.setFillColor(255, 255, 255); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2); doc.roundedRect(bx, by, CARD.QRBOX, CARD.QRBOX, 1.5, 1.5, 'FD');
  drawQr_(doc, gs1Matrix_(p.nisn), cx - CARD.QR / 2, by + (CARD.QRBOX - CARD.QR) / 2, CARD.QR);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(4.6); doc.setTextColor(100, 116, 139);
  doc.text('Pindai pada fitur "Scan Kartu Siswa"', cx, y + H - 2.7, { align: 'center' });
}

/** Membuat PDF. mode 'card' = 1 kartu/halaman ukuran kartu; 'a4' = 9 kartu/halaman A4 (siap potong). */
async function makeCardsPdf_(list, mode, label, onProgress) {
  libsReady_();
  const logo = await logoPng_(), J = window.jspdf.jsPDF, W = CARD.W, H = CARD.H;
  const doc = mode === 'card' ? new J({ unit: 'mm', format: [W, H], orientation: 'portrait', compress: true }) : new J({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  doc.setProperties({ title: 'Kartu Peserta Ekstrakurikuler - ' + latin_(label), author: 'SIABSENS-EKSKUL SMAN 1 Kamal', subject: 'GS1 QR Code (AI 91 = NISN)' });
  const cols = 3, rows = 3, gap = 4, ox = (210 - cols * W - (cols - 1) * gap) / 2, oy = (297 - rows * H - (rows - 1) * gap) / 2, per = cols * rows;
  const pages = mode === 'card' ? list.length : Math.ceil(list.length / per);
  for (let i = 0; i < list.length; i++) {
    const p = list[i], k = S.kmap[p.idKelas] || {};
    if (mode === 'card') { if (i > 0) doc.addPage([W, H], 'portrait'); drawCard_(doc, 0, 0, p, k.nama || '-', logo); }
    else {
      const idx = i % per; if (i > 0 && idx === 0) doc.addPage('a4', 'portrait');
      const c = idx % cols, r = Math.floor(idx / cols);
      drawCard_(doc, ox + c * (W + gap), oy + r * (H + gap), p, k.nama || '-', logo);
      if (idx === per - 1 || i === list.length - 1) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(120, 130, 145);
        doc.text('Kartu Peserta Ekstrakurikuler - ' + latin_(label) + '  |  Halaman ' + (Math.floor(i / per) + 1) + ' dari ' + pages + '  |  Potong mengikuti garis tepi kartu', 105, 291.5, { align: 'center' });
      }
    }
    if (i % 8 === 7) { if (onProgress) onProgress(i + 1, list.length); await new Promise(function (r) { setTimeout(r, 0); }); }
  }
  return doc;
}
function stampDate_() { const d = new Date(); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); }
async function exportCards_(btn, list, mode, label, fname, kelasNama) {
  if (!list.length) { toast('Tidak ada peserta aktif untuk dicetak.', 'warn'); return; }
  const run = async function () {
    try {
      const doc = await makeCardsPdf_(list, mode, label, function (i, n) { if (btn && btn.dataset.busy) btn.innerHTML = '<span class="spin-sm"></span> Membuat PDF… ' + i + '/' + n; });
      downloadBlob(fname, doc.output('blob'));
      toast(list.length + ' kartu ? ' + fname, 'ok', 'PDF kartu siap diunduh');
      call('catatCetakKartu', { ekstra: kelasNama || label, mode: mode === 'card' ? 'ukuran kartu' : 'A4 9/halaman', jumlah: list.length }).catch(function () { });
    } catch (e) { toast(errMsg(e), 'danger', 'Gagal membuat PDF kartu'); }
  };
  if (btn && btn.tagName === 'BUTTON' && !btn.classList.contains('icon-btn')) await withBusy(btn, run, 'Membuat PDF…'); else { toast('Membuat kartu…', 'info'); await run(); }
}

// -- Pratinjau kartu (HTML) --
function drawQrCanvas_(cv, m) {
  const sc = 5; cv.width = cv.height = m.n * sc; const cx = cv.getContext('2d'); if (!cx) return;
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.fillStyle = '#000';
  for (let y = 0; y < m.n; y++) for (let x = 0; x < m.n; x++) if (m.get(x, y)) cx.fillRect(x * sc, y * sc, sc, sc);
}
function cardPreviewHtml_(p, k) {
  return '<div class="idcard"><div class="ic-head"><div class="ic-logo">' + logoHtml('') + '</div><div class="ic-t"><b>KARTU PESERTA</b><b>EKSTRAKURIKULER</b><span>SMAN 1 KAMAL</span></div></div><div class="ic-line"></div>' +
    '<div class="ic-body"><div class="lb">NAMA PESERTA</div><div class="nm">' + h(String(p.nama).toUpperCase()) + '</div><div class="lb">NISN</div><div class="ns">' + h(p.nisn) + '</div><div class="lb">EKSTRAKURIKULER</div><div class="ek">' + h(k.nama || '-') + '</div></div>' +
    '<div class="ic-qr"><canvas id="pvQr" aria-label="GS1 QR Code NISN ' + h(p.nisn) + '"></canvas></div><div class="ic-ft">Pindai pada fitur "Scan Kartu Siswa"</div></div>';
}

// -- Halaman --
function kartuMembers_() { const ui = S.ui.kt; return S.peserta.filter(function (p) { return p.idKelas === ui.idKelas && p.aktif; }).sort(function (a, b) { return a.nama < b.nama ? -1 : 1; }); }
PAGES.kartu = function (el) {
  const ui = S.ui.kt = S.ui.kt || { idKelas: '', q: '', sel: {}, fmt: 'a4', prev: null };
  const withMembers = S.kelas.filter(function (k) { return S.peserta.some(function (p) { return p.idKelas === k.id && p.aktif; }); });
  if (!ui.idKelas || !S.kmap[ui.idKelas]) ui.idKelas = (withMembers[0] || S.kelas[0] || {}).id || '';
  const mem = kartuMembers_(), k = S.kmap[ui.idKelas] || {};
  if (!ui.prev || !mem.some(function (p) { return p.id === ui.prev; })) ui.prev = mem[0] ? mem[0].id : null;
  el.innerHTML = '<div class="page col g24">' + pageHead({ title: 'Cetak Kartu Peserta', sub: 'Kartu berisi nama, NISN, dan ekstrakurikuler dengan <b>GS1 QR Code</b> (di bawah identitas) untuk absen cepat lewat <i>Scan Kartu Siswa</i> oleh Pembina. Hasil berupa PDF.' }) +
    '<div class="kt-grid"><div class="card p0"><div style="padding:20px 24px 0"><div class="filters"><select class="sel" data-onchange="ktKelas" aria-label="Ekstrakurikuler">' + S.kelas.map(function (x) { const n = S.peserta.filter(function (p) { return p.idKelas === x.id && p.aktif; }).length; return '<option value="' + h(x.id) + '"' + (ui.idKelas === x.id ? ' selected' : '') + '>' + h(x.nama) + ' (' + n + ' siswa)</option>'; }).join('') + '</select>' +
    '<div class="search-lg inp-wrap"><i class="bi bi-search lead"></i><input class="inp pl" type="search" placeholder="Cari nama / NISN…" value="' + h(ui.q) + '" data-on="ktQ" autocomplete="off"></div></div>' +
    '<div class="row g8 wrap mt12"><select class="sel" data-onchange="ktFmt" style="flex:1 1 260px" aria-label="Format cetak massal"><option value="a4"' + (ui.fmt === 'a4' ? ' selected' : '') + '>Massal: A4 • 9 kartu per halaman (siap potong)</option><option value="card"' + (ui.fmt === 'card' ? ' selected' : '') + '>Massal: ukuran kartu 54×85,6 mm • 1 kartu per halaman</option></select></div>' +
    '<div class="row g8 wrap mt12" style="padding-bottom:16px"><button class="btn btn-primary" data-act="ktBulk" id="ktBulkBtn"><i class="bi bi-file-earmark-pdf"></i><span>Cetak Massal Ekstra (<b id="ktCnt">' + mem.length + '</b> kartu)</span></button><button class="btn btn-secondary" data-act="ktSel" id="ktSelBtn" disabled><i class="bi bi-check2-square"></i><span>Cetak Terpilih (<b id="ktSelN">0</b>)</span></button></div></div>' +
    '<div class="tbl-wrap" style="max-height:560px;overflow:auto" id="ktBody"></div></div>' +
    '<div class="kt-prev card"><div class="card-h"><div><h3>Pratinjau Kartu</h3><div class="sub">GS1 QR Code • AI (91) = NISN</div></div></div><div id="ktPrev"></div><button class="btn btn-accent btn-block mt16" data-act="ktOnePrev"><i class="bi bi-person-badge"></i> Cetak Kartu Ini (PDF perorangan)</button><div class="hint center mt8">Perorangan: PDF ukuran kartu 54×85,6 mm.</div></div></div></div>';
  renderKartuList_(); renderKartuPrev_();
};
function renderKartuList_() {
  const ui = S.ui.kt, box = $('#ktBody'); if (!box) return; const q = ui.q.trim().toLowerCase();
  const all = kartuMembers_(), list = all.filter(function (p) { return !q || (p.nama + ' ' + p.nisn).toLowerCase().indexOf(q) >= 0; });
  const allOn = list.length && list.every(function (p) { return ui.sel[p.id]; });
  box.innerHTML = '<table class="tbl"><thead><tr><th class="ck"><input type="checkbox" data-onchange="ktCkAll"' + (allOn ? ' checked' : '') + ' aria-label="Pilih semua"></th><th>Peserta</th><th>NISN</th><th>Kelas</th><th class="right">Aksi</th></tr></thead><tbody>' +
    (list.length ? list.map(function (p) {
      return '<tr class="' + (ui.prev === p.id ? 'sel' : '') + '"><td class="ck"><input type="checkbox" data-onchange="ktCk" data-id="' + h(p.id) + '"' + (ui.sel[p.id] ? ' checked' : '') + ' aria-label="Pilih ' + h(p.nama) + '"></td><td><button class="btn btn-ghost" data-act="ktPreview" data-id="' + h(p.id) + '" style="padding:0;min-height:0;height:auto;justify-content:flex-start;gap:10px;font-weight:600;color:var(--text)"><span class="avatar sm">' + h(ini(p.nama)) + '</span>' + h(p.nama) + '</button></td><td class="num">' + h(p.nisn) + '</td><td class="fs13 t2">' + h(p.kelasJur || '-') + '</td><td class="right"><button class="icon-btn sm edit" data-act="kartuOne" data-id="' + h(p.id) + '" aria-label="Cetak kartu ' + h(p.nama) + '" title="Cetak kartu (PDF perorangan)"><i class="bi bi-credit-card-2-front"></i></button></td></tr>';
    }).join('') : '<tr><td colspan="5">' + emptyState('bi-people', 'Tidak ada peserta aktif', 'Pilih ekstrakurikuler lain atau tambahkan peserta di menu Data Peserta.') + '</td></tr>') + '</tbody></table>';
  const n = Object.keys(ui.sel).filter(function (id) { return all.some(function (p) { return p.id === id; }); }).length;
  const sn = $('#ktSelN'); if (sn) { sn.textContent = n; $('#ktSelBtn').disabled = !n; }
}
function renderKartuPrev_() {
  const ui = S.ui.kt, box = $('#ktPrev'); if (!box) return;
  const p = S.peserta.find(function (x) { return x.id === ui.prev; });
  if (!p) { box.innerHTML = emptyState('bi-credit-card-2-front', 'Belum ada peserta'); return; }
  box.innerHTML = cardPreviewHtml_(p, S.kmap[p.idKelas] || {});
  try { libsReady_(); drawQrCanvas_($('#pvQr'), gs1Matrix_(p.nisn)); } catch (e) { const q = $('.ic-qr', box); if (q) q.innerHTML = '<span class="fs11 muted center" style="padding:8px">Pustaka QR belum termuat</span>'; }
}
ON.ktKelas = function (el) { const ui = S.ui.kt; ui.idKelas = el.value; ui.sel = {}; ui.prev = null; ui.q = ''; renderPage(true); };
ON.ktFmt = function (el) { S.ui.kt.fmt = el.value; };
ON.ktQ = debounce(function (el) { S.ui.kt.q = el.value; renderKartuList_(); }, 120);
ON.ktCk = function (el) { const ui = S.ui.kt; if (el.checked) ui.sel[el.dataset.id] = true; else delete ui.sel[el.dataset.id]; renderKartuList_(); };
ON.ktCkAll = function (el) { const ui = S.ui.kt, q = ui.q.trim().toLowerCase(); kartuMembers_().filter(function (p) { return !q || (p.nama + ' ' + p.nisn).toLowerCase().indexOf(q) >= 0; }).forEach(function (p) { if (el.checked) ui.sel[p.id] = true; else delete ui.sel[p.id]; }); renderKartuList_(); };
ACT.ktPreview = function (el) { S.ui.kt.prev = el.dataset.id; renderKartuList_(); renderKartuPrev_(); };
ACT.ktBulk = function (btn) {
  const k = S.kmap[S.ui.kt.idKelas] || {}, list = kartuMembers_(), mode = S.ui.kt.fmt;
  exportCards_(btn, list, mode, k.nama || 'Ekstrakurikuler', 'Kartu_Peserta_' + (k.kode || 'EKS') + '_' + (mode === 'card' ? 'ukuran-kartu_' : 'A4_') + stampDate_() + '.pdf', k.nama);
};
ACT.ktSel = function (btn) {
  const ui = S.ui.kt, k = S.kmap[ui.idKelas] || {}, list = kartuMembers_().filter(function (p) { return ui.sel[p.id]; });
  exportCards_(btn, list, ui.fmt, k.nama || 'Ekstrakurikuler', 'Kartu_Peserta_' + (k.kode || 'EKS') + '_terpilih-' + list.length + '_' + stampDate_() + '.pdf', k.nama);
};
function cardOne_(id, btn) {
  const p = S.peserta.find(function (x) { return x.id === id; }); if (!p) return;
  exportCards_(btn, [p], 'card', (S.kmap[p.idKelas] || {}).nama || '', 'Kartu_' + p.nisn + '_' + slug_(p.nama) + '.pdf', (S.kmap[p.idKelas] || {}).nama);
}
ACT.kartuOne = function (el) { cardOne_(el.dataset.id, el); };
ACT.ktOnePrev = function (el) { if (S.ui.kt.prev) cardOne_(S.ui.kt.prev, el); };
/** Pintasan dari halaman Data Peserta: cetak kartu untuk peserta yang dicentang */
ACT.kartuFromPes = function (btn) {
  const sel = S.ui.pes ? Object.keys(S.ui.pes.sel) : [], list = S.peserta.filter(function (p) { return sel.indexOf(p.id) >= 0 && p.aktif; }).sort(function (a, b) { return a.nama < b.nama ? -1 : 1; });
  if (!list.length) { toast('Pilih peserta aktif terlebih dahulu.', 'warn'); return; }
  exportCards_(btn, list, 'a4', 'Peserta terpilih', 'Kartu_Peserta_terpilih-' + list.length + '_' + stampDate_() + '.pdf', 'Peserta terpilih (Data Peserta)');
};

// ---------------- BAGIAN 22: BACKUP DATA SHEETS & LOG AUDIT (Super Admin) ----------------
PAGES.backup = function (el) {
  const ui = S.ui.bk = S.ui.bk || { info: null, log: null };
  el.innerHTML = '<div class="page col g24">' + pageHead({ title: 'Backup Data Sheets', sub: 'Cadangkan basis data Google Sheets dan tinjau log aktivitas pengguna (audit trail).', actions: '<button class="btn btn-primary" data-act="bkNow"><i class="bi bi-cloud-arrow-up"></i> Buat Backup Sekarang</button>' }) + '<div class="grid g-2 g-mob1" id="bkTop"><div class="skel" style="height:200px"></div><div class="skel" style="height:200px"></div></div><div class="card p0" id="bkLog"><div class="skel" style="height:240px"></div></div></div>';
  if (ui.info && ui.log) { drawBackup(); }
  Promise.all([call('listBackups'), call('getAuditLog')]).then(function (r) { ui.info = r[0]; ui.log = r[1]; if (S.page === 'backup') drawBackup(); }).catch(function (e) { toast(errMsg(e), 'danger'); });
};
function drawBackup() {
  const ui = S.ui.bk, top = $('#bkTop'), lg = $('#bkLog'); if (!top) return;
  top.innerHTML = '<div class="card"><div class="card-h"><h3>Sumber Data</h3></div><div class="col g12"><a class="btn btn-secondary btn-block" href="' + h(ui.info.ssUrl) + '" target="_blank" rel="noopener"><i class="bi bi-table"></i> Buka Spreadsheet Basis Data</a><a class="btn btn-secondary btn-block" href="' + h(ui.info.folderUrl) + '" target="_blank" rel="noopener"><i class="bi bi-folder2-open"></i> Buka Folder Drive (Foto &amp; Backup)</a></div><div class="note-box mt16"><div class="t"><i class="bi bi-info-circle"></i> Backup otomatis</div>Jalankan fungsi <span class="mono">installDailyBackup()</span> sekali dari editor Apps Script untuk membuat backup harian pukul 01.00 WIB. Sistem menyimpan 30 backup terakhir.</div></div>' +
    '<div class="card"><div class="card-h"><h3>Riwayat Backup (' + ui.info.backups.length + ')</h3></div>' + (ui.info.backups.length ? '<div class="col g8" style="max-height:230px;overflow:auto">' + ui.info.backups.map(function (b) { return '<a class="row between g12 card flat" style="padding:10px 14px;color:inherit" href="' + h(b.url) + '" target="_blank" rel="noopener"><span class="trunc"><i class="bi bi-file-earmark-spreadsheet" style="color:var(--ok)"></i> ' + h(b.name) + '</span><span class="fs12 muted num noshrink">' + h(b.tanggal) + '</span></a>'; }).join('') + '</div>' : emptyState('bi-cloud', 'Belum ada backup', 'Klik “Buat Backup Sekarang”.')) + '</div>';
  lg.innerHTML = '<div style="padding:20px 24px 0"><div class="card-h"><div><h3 style="font-size:18px">Log Audit Aktivitas</h3><div class="sub">150 aktivitas terakhir: login, pengiriman, validasi, perubahan data.</div></div></div></div><div class="tbl-wrap" style="max-height:420px;overflow:auto"><table class="tbl"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Objek</th><th>Detail</th></tr></thead><tbody>' + (ui.log.length ? ui.log.map(function (l) { return '<tr><td class="num fs13" style="white-space:nowrap">' + h(l.waktu) + '</td><td class="fs13">' + h(l.nama) + '</td><td><span class="badge b-gray" style="font-size:11px">' + h(l.aksi) + '</span></td><td class="fs13">' + h(l.objek) + '</td><td class="fs12 t2">' + h(l.detail) + '</td></tr>'; }).join('') : '<tr><td colspan="5">' + emptyState('bi-journal', 'Belum ada aktivitas') + '</td></tr>') + '</tbody></table></div>';
}
ACT.bkNow = async function (btn) {
  await withBusy(btn, async function () {
    try { const r = await call('createBackup'); toast('Backup dibuat: ' + r.name, 'ok', 'Backup berhasil'); S.ui.bk = null; renderPage(true); } catch (e) { toast(errMsg(e), 'danger'); }
  }, 'Membuat backup…');
};

// ---------------- BAGIAN 23: PENGATURAN APLIKASI (Super Admin) ----------------
PAGES.pengaturan = function (el) {
  const c = S.cfg, tg = function (k, l, hint) { return '<label class="chk" style="padding:12px;background:var(--surface-2);border-radius:10px;align-items:flex-start"><input type="checkbox" data-cfg="' + k + '"' + (c[k] === 'TRUE' ? ' checked' : '') + ' style="margin-top:2px"><span><b style="display:block;color:var(--text);font-size:13px">' + l + '</b><span class="fs12 muted">' + hint + '</span></span></label>'; };
  const inp = function (k, l, o) { o = o || {}; return field(l, '<input class="inp' + (o.mono ? ' mono' : '') + '" data-cfg="' + k + '" value="' + h(c[k] || '') + '"' + (o.type ? ' type="' + o.type + '"' : '') + (o.ph ? ' placeholder="' + h(o.ph) + '"' : '') + '>', o.hint); };
  el.innerHTML = '<div class="page col g24">' + pageHead({ title: 'Pengaturan Aplikasi', sub: 'Identitas sekolah, kop surat dokumen resmi, aturan presensi, dan geofence.', actions: '<button class="btn btn-primary" data-act="cfgSave"><i class="bi bi-floppy"></i> Simpan Pengaturan</button>' }) +
    '<div class="grid g-2 g-mob1" style="align-items:start"><div class="card"><div class="card-h"><h3>Identitas &amp; Kop Surat</h3></div>' + inp('namaSekolah', 'Nama sekolah') + inp('kopLine1', 'Kop baris 1') + inp('kopLine2', 'Kop baris 2') + inp('kopLine3', 'Kop baris 3') + inp('alamat', 'Alamat') + inp('kontak', 'Kontak / NSS / NPSN') + inp('kota', 'Kota (untuk tanggal tanda tangan)') + inp('logoUrl', 'URL / tautan Drive logo sekolah (opsional)', { hint: 'Kosongkan untuk memakai logo bawaan. Tautan Google Drive harus dibagikan “siapa saja yang memiliki tautan”.' }) + '</div>' +
    '<div class="col g16"><div class="card"><div class="card-h"><h3>Akademik &amp; Penandatangan</h3></div><div class="grid g-2 g-mob1"><div>' + inp('tahunAjaran', 'Tahun ajaran', { ph: '2026/2027' }) + '</div><div>' + field('Semester', '<select class="sel" data-cfg="semester"><option' + (c.semester === 'Ganjil' ? ' selected' : '') + '>Ganjil</option><option' + (c.semester === 'Genap' ? ' selected' : '') + '>Genap</option></select>') + '</div></div>' + inp('wakaNama', 'Nama Wakasek Kesiswaan') + inp('wakaNIP', 'NIP Wakasek Kesiswaan', { mono: true }) + '<div class="grid g-2 g-mob1"><div>' + inp('nomorPrefix', 'Prefiks nomor dokumen', { mono: true }) + '</div><div>' + inp('targetKKM', 'Target KKM kehadiran (%)', { type: 'number' }) + '</div></div></div>' +
    '<div class="card"><div class="card-h"><h3>Aturan Presensi &amp; Geofence</h3></div><div class="col g8">' + tg('wajibFoto', 'Foto bukti wajib', 'Pembina harus mengunggah foto kegiatan & selfie.') + tg('wajibGPS', 'GPS wajib & dalam radius', 'Presensi ditolak bila di luar radius sekolah.') + tg('persenTermasukSakitIzin', 'Hitung Sakit & Izin sebagai hadir', 'Mengubah rumus persentase kehadiran.') + tg('emailNotif', 'Notifikasi email ke Admin', 'Hanya untuk akun Admin dengan username berupa email.') + '</div>' +
    '<div class="grid g-3 g-mob1 mt16" style="grid-template-columns:1fr 1fr 1fr"><div>' + inp('geoLat', 'Latitude sekolah', { mono: true }) + '</div><div>' + inp('geoLng', 'Longitude sekolah', { mono: true }) + '</div><div>' + inp('geoRadius', 'Radius (m)', { type: 'number' }) + '</div></div><div class="grid g-2 g-mob1"><div>' + inp('batasPengisian', 'Batas pengisian harian', { type: 'time' }) + '</div><div style="display:flex;align-items:flex-end;padding-bottom:14px"><button class="btn btn-secondary btn-block" data-act="cfgGeo"><i class="bi bi-crosshair"></i> Gunakan lokasi saya</button></div></div>' +
    tg('demoMode', 'Mode uji coba (login cepat)', 'Tampilkan tombol login cepat di halaman masuk. Matikan saat dipakai produksi.') + '</div></div></div></div>';
};
ACT.cfgGeo = function () {
  if (!navigator.geolocation) { toast('GPS tidak tersedia di perangkat ini.', 'warn'); return; }
  navigator.geolocation.getCurrentPosition(function (p) { $('[data-cfg="geoLat"]').value = p.coords.latitude.toFixed(6); $('[data-cfg="geoLng"]').value = p.coords.longitude.toFixed(6); toast('Koordinat diisi dari lokasi Anda.', 'ok'); }, function () { toast('Izin lokasi ditolak.', 'warn'); }, { enableHighAccuracy: true, timeout: 15000 });
};
ACT.cfgSave = async function (btn) {
  const obj = {};
  $$('[data-cfg]').forEach(function (e) { obj[e.dataset.cfg] = e.type === 'checkbox' ? (e.checked ? 'TRUE' : 'FALSE') : e.value; });
  await withBusy(btn, async function () {
    try { const r = await call('saveConfig', obj); S.cfg = r.cfg; S.ui.ct = null; S.ui.rk = null; updateShellMeta(); toast('Pengaturan disimpan.', 'ok'); } catch (e) { toast(errMsg(e), 'danger'); }
  }, 'Menyimpan…');
};

// ---------------- BAGIAN 24: PANDUAN PENGGUNAAN ----------------
PAGES.panduan = function (el) {
  const it = function (icon, t, body) { return '<details class="acc"><summary><i class="bi ' + icon + '" style="color:var(--primary)"></i> ' + h(t) + '</summary><div class="body">' + body + '</div></details>'; };
  const pem = it('bi-person-check', 'Mengisi presensi hari ini (Pembina)', '<ol><li>Buka <b>Beranda</b> lalu tekan <b>Buka Formulir Lapangan</b>.</li><li>Pastikan indikator <b>GPS</b> hijau (dalam radius sekolah).</li><li>Tap <b>H / S / I / A</b> pada setiap siswa, atau gunakan <b>Tandai Semua Hadir</b> lalu ubah yang tidak hadir. Untuk Sakit/Izin/Alpa, tap label keterangan.</li><li>Ambil <b>2 foto bukti</b>: kegiatan lapangan dan selfie pembina.</li><li>Tekan <b>Kirim ke Waka</b>. Simpan <i>ID Pengiriman</i> sebagai bukti.</li></ol>') +
    it('bi-save', 'Simpan Draft & koneksi lemah', '<ul><li>Status yang Anda tandai tersimpan otomatis di perangkat (draft).</li><li>Jika pengiriman gagal karena sinyal, data tidak hilang — kirim ulang saat koneksi membaik.</li><li>Foto belum ikut draft; ambil ulang bila halaman dimuat ulang.</li></ul>') +
    it('bi-qr-code-scan', 'Scan Kartu Siswa', '<p>Di Beranda tekan <b>Scan Kartu Siswa</b>, arahkan kamera ke <b>GS1 QR Code</b> pada kartu peserta (berisi NISN). Siswa ditandai Hadir otomatis. Jika kamera tidak didukung, ketik NISN yang tercetak di kartu.</p>') +
    it('bi-arrow-return-left', 'Presensi dikembalikan Waka', '<p>Buka notifikasi (ikon lonceng) atau Riwayat ? pilih sesi ? <b>Perbaiki &amp; Kirim Ulang</b>. Catatan revisi ditampilkan di bagian atas formulir.</p>');
  const adm = it('bi-patch-check', 'Memvalidasi presensi (Waka/Admin)', '<ol><li>Buka <b>Validasi Presensi</b> atau tombol merah di Dashboard.</li><li>Periksa status siswa, foto kegiatan, selfie pembina, dan peta geofence.</li><li>Ubah status bila ada bukti susulan (perubahan tercatat di Log Audit).</li><li>Centang pernyataan konfirmasi lalu <b>Setujui &amp; Validasi</b>, atau <b>Kembalikan untuk Revisi</b> dengan catatan.</li></ol>') +
    it('bi-eye', 'Monitoring harian', '<p>Halaman <b>Monitoring Presensi</b> menampilkan status setiap ekstrakurikuler. Untuk yang belum mengisi, tekan <b>Kirim Pengingat WhatsApp</b> atau <b>Broadcast Notifikasi Pembina</b>.</p>') +
    it('bi-printer', 'Mencetak rekap resmi', '<p>Buka <b>Cetak Dokumen Resmi</b>, pilih ekstrakurikuler &amp; bulan. Dokumen hanya memuat sesi yang sudah divalidasi. Gunakan <b>Cetak Langsung</b>, <b>Export Excel</b>, atau <b>Download PDF Resmi</b>. Ruang tanda tangan dikosongkan untuk ditandatangani basah.</p>');
  const sup = it('bi-people', 'Mengelola master data (Super Admin)', '<ul><li><b>Data Pembina</b>: tambah pembina ? akun login dibuat otomatis (username = NIP) beserta kata sandi sementara.</li><li><b>Kelas Ekstrakurikuler</b>: atur pembina pengampu, jadwal, dan lokasi. Penautan pembina ? ekstra menentukan data yang boleh dilihat pembina.</li><li><b>Data Peserta</b>: tambah manual atau <b>Import Excel/CSV</b> (unduh template dahulu).</li></ul>') +
    it('bi-credit-card-2-front', 'Mencetak kartu peserta (Super Admin)', '<ol><li>Buka menu <b>Cetak Kartu Peserta</b>, pilih ekstrakurikuler.</li><li><b>Perorangan:</b> klik ikon kartu pada baris siswa ? PDF ukuran kartu (54×85,6 mm).</li><li><b>Massal per ekstra:</b> pilih format (A4 9 kartu/halaman atau ukuran kartu) lalu <b>Cetak Massal Ekstra</b>. Centang beberapa siswa untuk <b>Cetak Terpilih</b>.</li><li>Kartu memuat nama, NISN, ekstrakurikuler, dan <b>GS1 QR Code</b> di bawah identitas. Pembina memindainya lewat <i>Scan Kartu Siswa</i> untuk absen cepat.</li></ol>') +
    it('bi-key', 'Reset kata sandi & akun', '<p>Menu <b>Akun Pengguna</b> ? ikon kunci untuk membuat kata sandi baru. Kata sandi hanya tampil sekali.</p>') +
    it('bi-cloud-arrow-up', 'Backup & pengaturan', '<p><b>Backup Data Sheets</b> membuat salinan spreadsheet ke folder Drive. <b>Pengaturan Aplikasi</b> mengatur kop surat, target KKM, geofence, dan aturan wajib foto/GPS.</p>');
  const faq = it('bi-question-circle', 'Pertanyaan umum', '<ul><li><b>Lupa kata sandi?</b> Hubungi Super Admin untuk reset.</li><li><b>Mode gelap?</b> Menu profil (kanan atas) ? Mode Gelap.</li><li><b>Data tidak muncul?</b> Menu profil ? Muat Ulang Data.</li><li><b>Keamanan:</b> pembina hanya dapat melihat dan mengisi ekstrakurikuler yang diampunya — dibatasi di server.</li></ul>');
  const r = S.user.role;
  el.innerHTML = '<div class="page col g24"><div class="pm-wrap" style="margin:0;max-width:860px">' + pageHead({ title: 'Panduan Penggunaan', sub: 'Langkah singkat sesuai peran Anda: ' + roleLabel(r) + '.' }) + '<div class="mt16">' + (r === ROLE.PEMBINA ? pem : r === ROLE.ADMIN ? adm : adm + sup) + faq + '</div></div></div>';
};

// ---------------- BAGIAN 25: BOOT ----------------
$('#fileKegiatan').addEventListener('change', function (e) { const f = e.target.files && e.target.files[0]; e.target.value = ''; handleFotoFile('kegiatan', f); });
$('#fileSelfie').addEventListener('change', function (e) { const f = e.target.files && e.target.files[0]; e.target.value = ''; handleFotoFile('selfie', f); });
$('#fileImport').addEventListener('change', function (e) { const f = e.target.files && e.target.files[0]; if (f) readImportFile(f); });
init();
