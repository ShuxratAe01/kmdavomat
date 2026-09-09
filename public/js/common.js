/* ===== Umumiy yordamchi funksiyalar ===== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const HAFTA = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const OYLAR = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

/** "YYYY-MM-DD" -> "29 avgust 2026" */
function formatDay(iso, withYear = true) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${OYLAR[m - 1]}${withYear ? ' ' + y : ''}`;
}

/** "YYYY-MM-DD" -> hafta kuni nomi */
function weekdayName(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return HAFTA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** ISO vaqt -> "29.08.2026 14:35" */
function formatTime(iso) {
  if (!iso) return '—';
  const dt = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

/** Baytlarni o'qiladigan ko'rinishga keltiradi */
function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Oyni siljitish: "2026-08" + 1 -> "2026-09" */
function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** XSS'dan himoya */
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function csrfHeaders() {
  const row = document.cookie.split('; ').find((c) => c.startsWith('kmd_csrf='));
  if (!row) return {};
  return { 'X-CSRF-Token': decodeURIComponent(row.slice('kmd_csrf='.length)) };
}

function askAdminPassword(actionText) {
  const pw = window.prompt(`${actionText}\n\nDavom etish uchun o‘z parolingizni kiriting:`);
  if (!pw) return null;
  return pw;
}

/**
 * JSON API so'rovi.
 * 401 kelganda odatda /login ga o'tkazamiz (sessiya tugagan degani), lekin
 * kirish talab qilmaydigan sahifalarda (masalan ro'yxatdan o'tish) 401 —
 * shunchaki "kod noto'g'ri" degani, shuning uchun redirectOn401: false beriladi.
 */
async function api(url, options = {}) {
  const { redirectOn401 = true, headers: extraHeaders = {}, ...fetchOptions } = options;
  const headers = { ...csrfHeaders(), ...extraHeaders };
  const body = fetchOptions.body;
  if (body && typeof body === 'string' && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...fetchOptions,
    headers,
  });
  if (res.status === 401 && redirectOn401) {
    location.href = '/login';
    throw new Error('Kirilmagan');
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  // Parolni almashtirmaguncha boshqa hech narsa ishlamaydi
  if (res.status === 403 && data.code === 'MUST_CHANGE_PASSWORD') {
    location.href = '/parol';
    throw new Error(data.error);
  }
  if (!res.ok) throw new Error(data.error || `Xatolik (${res.status})`);
  return data;
}

/** Xabar ko'rsatish */
function showAlert(el, message, type = 'error') {
  if (!el) return;
  el.className = `alert ${type}`;
  el.textContent = message;
  el.hidden = false;
}
function hideAlert(el) {
  if (el) el.hidden = true;
}

/** Modal oynalarni ochish/yopish */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = false;
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  // Oyna yopilganda video ovozi orqada qolib ketmasin
  el.querySelectorAll('video').forEach((v) => v.pause());
  el.hidden = true;
}

document.addEventListener('click', (e) => {
  const closer = e.target.closest('[data-close]');
  if (closer) closeModal(closer.dataset.close);
  if (e.target.classList?.contains('modal-bg')) closeModal(e.target.id);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') $$('.modal-bg').forEach((m) => closeModal(m.id));
});

/* Logo fayli hali qo'yilmagan bo'lsa, buzilgan rasm ko'rinmasin */
document.addEventListener(
  'error',
  (e) => {
    if (e.target?.classList?.contains('login-logo-img')) e.target.hidden = true;
  },
  true
);

/* ===== Doira (Telegram uslubidagi) video ===== */

const RING_LENGTH = 301.6; // 2·π·48 — SVG viewBox 0..100 dagi aylana uzunligi

/**
 * Doira ko'rinishidagi video HTML'ini qaytaradi.
 * Bosilganda o'ynaydi/to'xtaydi, atrofida vaqt halqasi aylanadi.
 */
function roundVideoHtml(src, { autoplay = false } = {}) {
  return `<div class="round-video-wrap">
    <div class="round-video">
      <div class="round-video-frame">
        <video src="${esc(src)}" playsinline preload="metadata" ${autoplay ? 'autoplay' : ''}></video>
      </div>
      <svg class="round-video-ring" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="track" cx="50" cy="50" r="48"></circle>
        <circle class="bar" cx="50" cy="50" r="48"></circle>
      </svg>
      <button type="button" class="round-video-play" aria-label="O‘ynatish">▶</button>
      <span class="round-video-time">00:00</span>
    </div>
  </div>`;
}

function mmssShort(sec) {
  if (!Number.isFinite(sec)) return '00:00';
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// Doirani bosish — o'ynatish/to'xtatish
document.addEventListener('click', (e) => {
  const box = e.target.closest('.round-video');
  if (!box || box.classList.contains('full')) return;
  const video = box.querySelector('video');
  if (!video) return;
  if (video.paused) {
    // Boshqa o'ynayotgan videolarni to'xtatamiz
    $$('.round-video video').forEach((v) => v !== video && v.pause());
    video.play().catch(() => {});
  } else {
    video.pause();
  }
});

// Holat va halqani yangilash
document.addEventListener(
  'play',
  (e) => e.target.closest?.('.round-video')?.classList.add('playing'),
  true
);
document.addEventListener(
  'pause',
  (e) => e.target.closest?.('.round-video')?.classList.remove('playing'),
  true
);
document.addEventListener(
  'ended',
  (e) => {
    const box = e.target.closest?.('.round-video');
    if (!box) return;
    box.classList.remove('playing');
    box.querySelector('.bar').style.strokeDashoffset = RING_LENGTH;
    box.querySelector('.round-video-time').textContent = mmssShort(e.target.duration);
  },
  true
);
document.addEventListener(
  'timeupdate',
  (e) => {
    const box = e.target.closest?.('.round-video');
    if (!box) return;
    const v = e.target;
    const done = v.duration ? v.currentTime / v.duration : 0;
    box.querySelector('.bar').style.strokeDashoffset = RING_LENGTH * (1 - done);
    box.querySelector('.round-video-time').textContent =
      `${mmssShort(v.currentTime)} / ${mmssShort(v.duration)}`;
  },
  true
);
document.addEventListener(
  'loadedmetadata',
  (e) => {
    const box = e.target.closest?.('.round-video');
    if (box) box.querySelector('.round-video-time').textContent = mmssShort(e.target.duration);
  },
  true
);

/** iOS 16 uslubidagi kalendar raqami (gradient + qalin lentasimon raqam) */
const IOS16_PATHS = {
  0: 'M 28 16 C 13 16 11 29 11 42 C 11 55 13 68 28 68 C 43 68 45 55 45 42 C 45 29 43 16 28 16 Z',
  1: 'M 16 30 L 34 12 L 34 72',
  2: 'M 12 30 C 13 15 27 11 37 12 C 48 13 50 26 42 36 C 33 46 15 52 13 64 C 12 70 16 72 44 72',
  3: 'M 13 24 C 15 12 46 11 46 27 C 46 38 30 41 26 42 C 32 43 48 47 47 61 C 46 75 14 75 13 63',
  4: 'M 40 74 L 40 14 L 11 54 L 47 54',
  5: 'M 43 14 L 16 14 L 14 40 C 20 32 48 35 48 55 C 48 73 18 75 13 63',
  6: 'M 41 24 C 35 11 16 13 13 34 C 10 56 18 73 33 73 C 50 73 52 54 41 47 C 33 42 21 46 19 57',
  7: 'M 12 14 L 45 14 L 20 74',
  8: 'M 28 14 C 15 14 13 25 13 30 C 13 39 20 42 28 42 C 36 42 43 39 43 30 C 43 25 41 14 28 14 Z M 28 42 C 14 42 10 54 10 61 C 10 73 18 74 28 74 C 38 74 46 73 46 61 C 46 54 42 42 28 42 Z',
  9: 'M 15 62 C 20 75 43 73 45 52 C 47 31 41 13 28 13 C 13 13 11 31 21 41 C 29 48 42 43 44 31',
};

function ensureIos16Defs() {
  if (document.getElementById('ios16g')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.innerHTML = `
    <defs>
      <linearGradient id="ios16g" x1="8%" y1="0%" x2="72%" y2="100%">
        <stop offset="0%" stop-color="#5EF5C4"/>
        <stop offset="16%" stop-color="#3EE8D8"/>
        <stop offset="40%" stop-color="#3BB0FF"/>
        <stop offset="68%" stop-color="#4A68FF"/>
        <stop offset="100%" stop-color="#7A35F0"/>
      </linearGradient>
      <linearGradient id="ios16h" x1="0%" y1="0%" x2="80%" y2="80%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.7"/>
        <stop offset="45%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
    </defs>`;
  document.body.prepend(svg);
}

function iosDigitSvg(ch) {
  const d = IOS16_PATHS[ch];
  if (!d) return esc(ch);
  return `<svg class="day-digit" viewBox="0 0 56 84" focusable="false" aria-hidden="true">
    <path class="ios16-shade" d="${d}"/>
    <path class="ios16-body" d="${d}"/>
    <path class="ios16-shine" d="${d}"/>
  </svg>`;
}

function iosDayNum(n) {
  ensureIos16Defs();
  return `<span class="day-num">${String(n).split('').map(iosDigitSvg).join('')}</span>`;
}

/** Status uchun badge HTML */
function statusBadge(status) {
  const map = {
    new: ['amber', 'Yangi'],
    accepted: ['green', 'Qabul qilindi'],
    rejected: ['red', 'Rad etildi'],
  };
  const [cls, text] = map[status] || ['gray', '—'];
  return `<span class="badge ${cls}">${text}</span>`;
}

const TICKER_FALLBACK = 'Ertaga 9-sentyabr metodik kun';

function renderTicker(texts) {
  const ticker = document.querySelector('.ticker');
  const track = document.querySelector('.ticker-track');
  if (!ticker || !track) return;
  const items = texts.length ? texts : [TICKER_FALLBACK];
  const html = items
    .map(
      (t) =>
        `<span class="ticker-item"><img class="ticker-elon" src="/img/elon.png" alt="" />${esc(t)}</span>`
    )
    .join('');
  track.innerHTML = html + html;
  ticker.setAttribute('aria-label', items.join('. '));
  const len = items.join(' ').length;
  track.style.animationDuration = `${Math.min(48, Math.max(16, 12 + len * 0.18))}s`;
}

async function loadTicker() {
  try {
    let items = [];
    try {
      const data = await api('/api/announcements');
      items = data.items || [];
    } catch {
      const cfg = await api('/api/config');
      items = cfg.announcements || [];
    }
    renderTicker(items.map((i) => i.body));
  } catch {
    /* fallback HTML qoladi */
  }
}
