/* Logotip animatsiyasi rasm yuklangach boshlanadi.
   Aks holda animatsiyaning boshlanishi bo‘sh joyda o‘tib ketadi:
   maska harakatlanadi, lekin ostidagi rasm hali kelmagan bo‘ladi. */
(function () {
  const box = document.querySelector('.login-logo');
  if (!box) return;
  const start = () => box.classList.add('ready');
  const im = new Image();
  im.onload = start;
  im.onerror = start;
  im.src = '/img/logo.png';
  // Rasm juda sekin kelsa ham cheksiz kutib turmaymiz
  setTimeout(start, 2500);
})();
/* ===== Kirish sahifasi ===== */

const form = document.getElementById('loginForm');
const err = document.getElementById('err');
const btn = document.getElementById('submitBtn');
const pickerRoot = document.getElementById('schoolPicker');

let schools = [];
let adminMode = false;
let schoolPicker = null;

function showSchoolHint(school) {
  err.hidden = true;
  if (school && school.registered === false) {
    err.className = 'alert info';
    err.innerHTML =
      'Bu maktab hali ro‘yxatdan o‘tmagan. <a href="/royxat">Ro‘yxatdan o‘ting</a> — bu bir daqiqalik ish.';
    err.hidden = false;
  }
}

// --- Maktablar ro'yxatini yuklaymiz ---
(async () => {
  try {
    const res = await fetch('/api/auth/schools', { credentials: 'same-origin' });
    const d = await res.json();
    schools = d.schools || [];

    const last = localStorage.getItem('kmd_last_school');
    schoolPicker = mountSchoolPicker(pickerRoot, {
      schools,
      valueKey: 'login',
      placeholder: 'Raqam yoki nom yozing… masalan: 12',
      initialValue: last && schools.some((s) => s.login === last) ? last : '',
      onChange: showSchoolHint,
    });
  } catch {
    pickerRoot.innerHTML =
      '<div class="alert error">Ro‘yxatni yuklab bo‘lmadi. Sahifani yangilang.</div>';
  }
})();

// --- Admin rejimi: login qo'lda ---
document.getElementById('toggleMode').addEventListener('click', (e) => {
  e.preventDefault();
  adminMode = !adminMode;
  document.getElementById('schoolField').hidden = adminMode;
  document.getElementById('usernameField').hidden = !adminMode;
  document.getElementById('regHint').hidden = adminMode;
  e.target.textContent = adminMode ? 'Maktab sifatida kirish' : 'Administrator sifatida kirish';
  err.hidden = true;
  (adminMode ? document.getElementById('username') : schoolPicker)?.focus?.();
  if (!adminMode && schoolPicker) schoolPicker.focus();
});

// --- Parolni ko‘rsatish / yashirish ---
(function () {
  const input = document.getElementById('password');
  const btn = document.getElementById('pwToggle');
  if (!input || !btn) return;
  function isVisible() {
    return input.type === 'text';
  }

  function syncIcon() {
    const visible = isVisible();
    btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
    btn.setAttribute('aria-label', visible ? 'Parolni yashirish' : 'Parolni ko‘rsatish');
  }

  function setVisible(visible) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.type = visible ? 'text' : 'password';
    input.style.removeProperty('-webkit-text-security');
    input.classList.toggle('is-revealed', visible);
    syncIcon();
    try {
      input.setSelectionRange(start, end);
    } catch {
      /* type=password ba'zan selectionni qo'llab-quvvatlamaydi */
    }
  }

  btn.addEventListener('click', () => {
    setVisible(!isVisible());
    input.focus({ preventScroll: true });
  });

  input.addEventListener('input', syncIcon);
  syncIcon();
})();

// --- Yuborish ---
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  err.hidden = true;

  const username = adminMode
    ? document.getElementById('username').value.trim()
    : schoolPicker?.getValue() || '';

  if (!username) {
    err.className = 'alert error';
    err.textContent = adminMode ? 'Loginni kiriting' : 'Maktabingizni tanlang (raqam yozib toping)';
    err.hidden = false;
    if (!adminMode) schoolPicker?.focus();
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
    const school = schoolPicker?.getSchool();
    if (!adminMode && school && school.registered === false) {
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
