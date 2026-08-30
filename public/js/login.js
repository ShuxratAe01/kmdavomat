const form = document.getElementById('loginForm');
const err = document.getElementById('err');
const btn = document.getElementById('submitBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  err.hidden = true;
  btn.disabled = true;
  btn.textContent = 'Kirilmoqda…';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Kirishda xatolik');
    location.href = data.redirect || '/';
  } catch (e2) {
    err.textContent = e2.message;
    err.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Kirish';
    document.getElementById('password').select();
  }
});
