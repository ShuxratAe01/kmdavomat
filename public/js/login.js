/* ===== Kirish sahifasi ===== */

const form = document.getElementById('loginForm');
const err = document.getElementById('err');
const btn = document.getElementById('submitBtn');
const schoolSelect = document.getElementById('school');

let schools = [];
let adminMode = false; // true bo'lsa login qo'lda yoziladi

// --- Maktablar ro'yxatini yuklaymiz ---
(async () => {
  try {
    const res = await fetch('/api/auth/schools', { credentials: 'same-origin' });
    const d = await res.json();
    schools = d.schools || [];

    schoolSelect.innerHTML =
      '<option value="">— Maktabingizni tanlang —</option>' +
      schools
        .map(
          (s) =>
            `<option value="${s.login}" data-registered="${s.registered ? 1 : 0}">${escapeHtml(s.name)}</option>`
        )
        .join('');

    // Oxirgi marta tanlangan maktabni eslab qolamiz
    const last = localStorage.getItem('kmd_last_school');
    if (last && schools.some((s) => s.login === last)) schoolSelect.value = last;
  } catch {
    schoolSelect.innerHTML = '<option value="">Ro‘yxatni yuklab bo‘lmadi</option>';
  }
})();

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

// --- Ro'yxatdan o'tmagan maktab tanlansa ogohlantiramiz ---
schoolSelect.addEventListener('change', () => {
  err.hidden = true;
  const opt = schoolSelect.selectedOptions[0];
  if (opt && opt.value && opt.dataset.registered === '0') {
    err.className = 'alert info';
    err.innerHTML =
      'Bu maktab hali ro‘yxatdan o‘tmagan. <a href="/royxat">Ro‘yxatdan o‘ting</a> — bu bir daqiqalik ish.';
    err.hidden = false;
  }
});

// --- Admin rejimi: login qo'lda ---
document.getElementById('toggleMode').addEventListener('click', (e) => {
  e.preventDefault();
  adminMode = !adminMode;
  document.getElementById('schoolField').hidden = adminMode;
  document.getElementById('usernameField').hidden = !adminMode;
  document.getElementById('regHint').hidden = adminMode;
  e.target.textContent = adminMode ? 'Maktab sifatida kirish' : 'Administrator sifatida kirish';
  err.hidden = true;
  (adminMode ? document.getElementById('username') : schoolSelect).focus();
});

// --- Yuborish ---
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  err.hidden = true;

  const username = adminMode
    ? document.getElementById('username').value.trim()
    : schoolSelect.value;

  if (!username) {
    err.className = 'alert error';
    err.textContent = adminMode ? 'Loginni kiriting' : 'Maktabingizni tanlang';
    err.hidden = false;
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Kirilmoqda…';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        username,
        password: document.getElementById('password').value,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Kirishda xatolik');

    if (!adminMode) localStorage.setItem('kmd_last_school', username);
    location.href = data.redirect || '/';
  } catch (e2) {
    err.className = 'alert error';
    // Ro'yxatdan o'tmagan maktab bo'lsa yo'l ko'rsatamiz
    const opt = schoolSelect.selectedOptions[0];
    if (!adminMode && opt && opt.dataset.registered === '0') {
      err.innerHTML =
        'Bu maktab hali ro‘yxatdan o‘tmagan. <a href="/royxat">Ro‘yxatdan o‘ting</a>.';
    } else {
      err.textContent = e2.message;
    }
    err.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Kirish';
    document.getElementById('password').select();
  }
});
