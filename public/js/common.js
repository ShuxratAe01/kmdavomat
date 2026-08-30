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

/**
 * JSON API so'rovi.
 * 401 kelganda odatda /login ga o'tkazamiz (sessiya tugagan degani), lekin
 * kirish talab qilmaydigan sahifalarda (masalan ro'yxatdan o'tish) 401 —
 * shunchaki "kod noto'g'ri" degani, shuning uchun redirectOn401: false beriladi.
 */
async function api(url, options = {}) {
  const { redirectOn401 = true, ...fetchOptions } = options;
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: fetchOptions.body ? { 'Content-Type': 'application/json' } : {},
    ...fetchOptions,
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
