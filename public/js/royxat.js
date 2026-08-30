/* ===== Maktabni ro'yxatdan o'tkazish ===== */

const form = $('#regForm');
const err = $('#err');
const info = $('#info');
const btn = $('#submitBtn');
let minLen = 8;

// --- Maktablar ro'yxatini yuklaymiz ---
(async () => {
  try {
    const d = await api('/api/auth/schools', { redirectOn401: false });
    minLen = d.minPasswordLength || 8;
    $('#minLen').textContent = minLen;

    if (!d.enabled) {
      $('#school').innerHTML = '<option value="">—</option>';
      showAlert(err, 'Ro‘yxatdan o‘tish yopilgan. Administrator bilan bog‘laning.');
      btn.disabled = true;
      return;
    }
    if (!d.schools.length) {
      $('#school').innerHTML = '<option value="">—</option>';
      showAlert(err, 'Barcha maktablar allaqachon ro‘yxatdan o‘tgan.');
      btn.disabled = true;
      return;
    }

    $('#school').innerHTML =
      '<option value="">— Maktabni tanlang —</option>' +
      d.schools.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');

    if (d.registered) {
      showAlert(info, `${d.total} ta maktabdan ${d.registered} tasi ro‘yxatdan o‘tgan.`, 'info');
    }
  } catch (e) {
    showAlert(err, e.message);
  }
})();

// --- Kodni chiroyli formatlash: xxxxxxxx -> XXXX-XXXX ---
$('#code').addEventListener('input', (e) => {
  const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  e.target.value = raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
});

// --- Parol kuchi ---
function strength(pw) {
  let s = 0;
  if (pw.length >= minLen) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}
const LABELS = ['juda zaif', 'zaif', 'o‘rtacha', 'yaxshi', 'kuchli'];
const COLORS = ['#dc2626', '#dc2626', '#d97706', '#16a34a', '#16a34a'];

$('#password').addEventListener('input', (e) => {
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
  $('#password').type = type;
  $('#repeat').type = type;
});

// --- Yuborish ---
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert(err);

  const password = $('#password').value;
  if (password !== $('#repeat').value) {
    return showAlert(err, 'Parollar bir-biriga mos kelmadi');
  }

  btn.disabled = true;
  btn.textContent = 'Yuborilmoqda…';
  try {
    const res = await api('/api/auth/register', {
      method: 'POST',
      redirectOn401: false,
      body: JSON.stringify({
        school_id: Number($('#school').value),
        code: $('#code').value,
        password,
      }),
    });
    location.href = res.redirect || '/';
  } catch (e2) {
    showAlert(err, e2.message);
    btn.disabled = false;
    btn.textContent = 'Ro‘yxatdan o‘tish';
  }
});
