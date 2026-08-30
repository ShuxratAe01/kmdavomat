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

/** JSON API so'rovi */
async function api(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    ...options,
  });
  if (res.status === 401) {
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
  if (el) el.hidden = true;
}

document.addEventListener('click', (e) => {
  const closer = e.target.closest('[data-close]');
  if (closer) closeModal(closer.dataset.close);
  if (e.target.classList?.contains('modal-bg')) e.target.hidden = true;
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') $$('.modal-bg').forEach((m) => (m.hidden = true));
});

/* Logo fayli hali qo'yilmagan bo'lsa, buzilgan rasm ko'rinmasin */
document.addEventListener(
  'error',
  (e) => {
    if (e.target?.classList?.contains('login-logo-img')) e.target.hidden = true;
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
