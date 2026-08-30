/* ===== Majburiy parol almashtirish ===== */

const form = $('#pwForm');
const err = $('#err');
const btn = $('#submitBtn');
let minLen = 8;

// Serverdagi eng qisqa parol uzunligini olamiz
api('/api/auth/me')
  .then((d) => {
    minLen = d.minPasswordLength || 8;
    $('#minLen').textContent = minLen;
  })
  .catch(() => {});

/** Parol qanchalik kuchli — 0..4 */
function strength(pw) {
  let score = 0;
  if (pw.length >= minLen) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const LABELS = ['juda zaif', 'zaif', 'o‘rtacha', 'yaxshi', 'kuchli'];
const COLORS = ['#dc2626', '#dc2626', '#d97706', '#16a34a', '#16a34a'];

$('#next').addEventListener('input', (e) => {
  const pw = e.target.value;
  const s = pw ? strength(pw) : 0;
  const bar = $('#pwBar');
  bar.style.width = pw ? `${(s + 1) * 20}%` : '0';
  bar.style.background = COLORS[s];
  $('#pwHint').textContent = pw
    ? `Parol kuchi: ${LABELS[s]}`
    : `Kamida ${minLen} ta belgi, harf va raqam bo‘lsin`;
});

$('#showPw').addEventListener('change', (e) => {
  const type = e.target.checked ? 'text' : 'password';
  for (const id of ['#current', '#next', '#repeat']) $(id).type = type;
});

$('#logoutBtn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  location.href = '/login';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert(err);

  const next = $('#next').value;
  if (next !== $('#repeat').value) {
    return showAlert(err, 'Parollar bir-biriga mos kelmadi');
  }

  btn.disabled = true;
  btn.textContent = 'Saqlanmoqda…';
  try {
    const res = await api('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current: $('#current').value, next }),
    });
    location.href = res.redirect || '/';
  } catch (e2) {
    showAlert(err, e2.message);
    btn.disabled = false;
    btn.textContent = 'Saqlash va davom etish';
  }
});
