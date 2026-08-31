/* ===== Admin panel ===== */

const S = {
  users: [],
  schools: [],
  page: 1,
  calUserId: null,
  calMonth: null,
  showCodes: false,
};

// ---------- Boshlash ----------

async function init() {
  let me;
  try {
    me = await api('/api/auth/me');
  } catch {
    return;
  }
  if (me.user.role !== 'admin') return (location.href = '/');
  $('#whoName').textContent = me.user.full_name || me.user.username;

  bindTabs();
  bindOverview();
  bindVideos();
  bindSchools();
  bindUsers();

  await loadSchools();
  await loadUsers();
  await loadOverview();
}

function bindTabs() {
  $$('.tab').forEach((t) =>
    t.addEventListener('click', () => {
      $$('.tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      ['overview', 'videos', 'schools', 'users'].forEach((name) => {
        $(`#tab-${name}`).hidden = name !== t.dataset.tab;
      });
      if (t.dataset.tab === 'videos') loadVideos(1);
      if (t.dataset.tab === 'schools') loadSchools();
      if (t.dataset.tab === 'users') renderUsers();
    })
  );

  $('#logoutBtn').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/login';
  });
}

function flash(msg, type = 'ok') {
  const el = type === 'ok' ? $('#ok') : $('#err');
  showAlert(el, msg, type);
  setTimeout(() => hideAlert(el), 5000);
}

// ---------- Bugungi davomat ----------

function bindOverview() {
  $('#ovDay').addEventListener('change', () => loadOverview($('#ovDay').value));
  $('#ovToday').addEventListener('click', () => {
    $('#ovDay').value = '';
    loadOverview();
  });
  $('#ovList').addEventListener('click', onListClick);
}

async function loadOverview(day) {
  try {
    const data = await api('/api/admin/overview' + (day ? `?day=${day}` : ''));
    $('#ovDay').value = data.day;
    $('#ovDayLabel').textContent =
      formatDay(data.day) + (data.isRestDay ? ' — dam olish kuni' : '');
    $('#ovTotal').textContent = data.stats.registered;
    $('#ovSent').textContent = data.stats.sent;
    $('#ovMissed').textContent = data.stats.missed;
    $('#ovVideosTotal').textContent = data.stats.videosTotal;
    $('#ovStorage').textContent = formatSize(data.stats.storageBytes);
    $('#ovWaiting').textContent = data.stats.notRegistered;

    if (!data.schools.length) {
      $('#ovList').innerHTML =
        '<div class="empty-state"><span class="ico">🏫</span>Maktablar ro‘yxati bo‘sh.<br><span class="small">“Maktablar” bo‘limidan qo‘shing.</span></div>';
      return;
    }

    $('#ovList').innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Maktab</th><th>Holat</th><th>Vaqt</th><th>Oyda</th><th></th></tr></thead>
      <tbody>${data.schools
        .map((s) => {
          const holat = !s.registered
            ? '<span class="badge gray">Ro‘yxatdan o‘tmagan</span>'
            : !s.is_active
              ? '<span class="badge red">Bloklangan</span>'
              : s.sent
                ? '<span class="badge green">✓ Yuborgan</span>'
                : data.isRestDay
                  ? '<span class="badge gray">Dam olish kuni</span>'
                  : '<span class="badge red">✕ Yubormagan</span>';
          return `<tr>
            <td class="cell-main"><b>${esc(s.name)}</b>${
              s.registered ? `<div class="small muted">@${esc(s.username)}</div>` : ''
            }</td>
            <td data-label="Holat">${holat}</td>
            <td data-label="Vaqt" class="small nowrap">${s.sent_at ? formatTime(s.sent_at).slice(11) : '—'}</td>
            <td data-label="Oyda" class="small nowrap">${s.registered ? s.month_days + ' kun' : '—'}</td>
            <td class="cell-actions nowrap${s.video_id || s.registered ? '' : ' no-actions'}">
              ${s.video_id ? `<button class="btn sm" data-video="${s.video_id}" data-name="${esc(s.name)}" data-day="${data.day}">▶ Ko‘rish</button>` : ''}
              ${s.registered ? `<button class="btn sm ghost" data-cal="${s.id}" data-name="${esc(s.name)}">📅 Kalendar</button>` : ''}
            </td>
          </tr>`;
        })
        .join('')}</tbody></table></div>`;
  } catch (e) {
    flash(e.message, 'error');
  }
}

// ---------- Videolar ----------

function bindVideos() {
  $('#fApply').addEventListener('click', () => loadVideos(1));
  $('#fReset').addEventListener('click', () => {
    $('#fUser').value = '';
    $('#fFrom').value = '';
    $('#fTo').value = '';
    $('#fStatus').value = '';
    loadVideos(1);
  });
  $('#vidList').addEventListener('click', onListClick);
  $('#pager').addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (b) loadVideos(Number(b.dataset.page));
  });
}

async function loadVideos(page = 1) {
  S.page = page;
  const q = new URLSearchParams({ page: String(page), limit: '30' });
  if ($('#fUser').value) q.set('user_id', $('#fUser').value);
  if ($('#fFrom').value) q.set('from', $('#fFrom').value);
  if ($('#fTo').value) q.set('to', $('#fTo').value);
  if ($('#fStatus').value) q.set('status', $('#fStatus').value);

  $('#vidList').innerHTML = '<p class="muted small">Yuklanmoqda…</p>';
  try {
    const data = await api(`/api/admin/videos?${q}`);
    $('#vidTotal').textContent = data.total;

    if (!data.videos.length) {
      $('#vidList').innerHTML = '<div class="empty-state"><span class="ico">🎬</span>Video topilmadi</div>';
      $('#pager').innerHTML = '';
      return;
    }

    $('#vidList').innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Maktab</th><th>Sana</th><th>Vaqt</th><th>Hajm</th><th>Holat</th><th>Izoh</th><th></th></tr></thead>
      <tbody>${data.videos
        .map(
          (v) => `<tr>
            <td class="cell-main">
              <b>${esc(v.full_name || v.username)}</b>
              <div class="small muted hide-sm">@${esc(v.username)}</div>
              <div class="small muted only-sm">${formatDay(v.day)} · ${formatTime(v.created_at).slice(11)}</div>
            </td>
            <td data-label="Sana" class="nowrap hide-sm">${formatDay(v.day)}</td>
            <td data-label="Vaqt" class="small nowrap muted hide-sm">${formatTime(v.created_at).slice(11)}</td>
            <td data-label="Hajm" class="small nowrap">${formatSize(v.size)}</td>
            <td data-label="Holat">${statusBadge(v.status)}</td>
            <td data-label="Izoh" class="small muted">${esc(v.note || '—')}</td>
            <td class="cell-actions nowrap">
              <button class="btn sm" data-video="${v.id}" data-name="${esc(v.full_name || v.username)}" data-day="${v.day}">▶ Ko‘rish</button>
              <a class="btn sm ghost" href="/api/videos/${v.id}/download">⬇ Yuklab olish</a>
              <button class="btn sm danger" data-delvideo="${v.id}">🗑</button>
            </td>
          </tr>`
        )
        .join('')}</tbody></table></div>`;

    $('#pager').innerHTML =
      data.pages > 1
        ? `<button class="btn sm ghost fixed" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹ Oldingi</button>
           <span class="fixed small muted" style="align-self:center">${page} / ${data.pages}</span>
           <button class="btn sm ghost fixed" data-page="${page + 1}" ${page >= data.pages ? 'disabled' : ''}>Keyingi ›</button>`
        : '';
  } catch (e) {
    $('#vidList').innerHTML = `<p class="alert error">${esc(e.message)}</p>`;
  }
}

/** Jadvaldagi tugmalar uchun umumiy ishlov beruvchi */
async function onListClick(e) {
  const play = e.target.closest('[data-video]');
  if (play) return openVideo(play.dataset.video, play.dataset.name, play.dataset.day);

  const cal = e.target.closest('[data-cal]');
  if (cal) return openUserCalendar(Number(cal.dataset.cal), cal.dataset.name);

  const del = e.target.closest('[data-delvideo]');
  if (del) {
    if (!confirm('Videoni butunlay o‘chirasizmi?')) return;
    try {
      await api(`/api/admin/videos/${del.dataset.delvideo}`, { method: 'DELETE' });
      flash('Video o‘chirildi');
      loadVideos(S.page);
      loadOverview($('#ovDay').value);
    } catch (err) {
      flash(err.message, 'error');
    }
  }
}

function openVideo(id, name, day) {
  $('#vmTitle').textContent = `${name} — ${formatDay(day)}`;
  $('#vmBody').innerHTML =
    roundVideoHtml(`/api/videos/${id}/stream`, { autoplay: true }) +
    `<div class="modal-foot">
       <button class="btn ghost sm" id="vmToggleFull">⤢ To‘liq kadr</button>
       <div class="spacer" style="flex:1"></div>
       <a class="btn ghost" href="/api/videos/${id}/download">⬇ Yuklab olish</a>
       <button class="btn danger" data-status="rejected" data-id="${id}">✕ Rad etish</button>
       <button class="btn success" data-status="accepted" data-id="${id}">✓ Qabul qilish</button>
     </div>`;
  openModal('videoModal');
}

/** Doira ko'rinishidan to'liq kadrga o'tish — chetlari qirqilmasin */
$('#vmBody')?.addEventListener('click', (e) => {
  if (!e.target.closest('#vmToggleFull')) return;
  const box = $('#vmBody .round-video');
  const video = box.querySelector('video');
  const full = box.classList.toggle('full');
  video.controls = full;
  $('#vmToggleFull').textContent = full ? '⭕ Doira ko‘rinish' : '⤢ To‘liq kadr';
});

$('#vmBody')?.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-status]');
  if (!b) return;
  try {
    await api(`/api/admin/videos/${b.dataset.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: b.dataset.status }),
    });
    closeModal('videoModal');
    flash(b.dataset.status === 'accepted' ? 'Video qabul qilindi' : 'Video rad etildi');
    loadVideos(S.page);
    loadOverview($('#ovDay').value);
  } catch (err) {
    flash(err.message, 'error');
  }
});

// ---------- Maktablar ----------

function bindSchools() {
  $('#scSearch').addEventListener('input', renderSchools);
  $('#scFilter').addEventListener('change', renderSchools);
  $('#schoolList').addEventListener('click', onSchoolListClick);
  $('#schoolForm').addEventListener('submit', saveSchool);
  $('#scAdd').addEventListener('click', () => openSchoolForm(null));

  $('#scCodes').addEventListener('click', () => {
    S.showCodes = !S.showCodes;
    $('#scCodes').textContent = S.showCodes ? '🙈 Kodlarni yashirish' : '🔑 Kodlarni ko‘rsatish';
    renderSchools();
  });

  $('#scExport').addEventListener('click', exportCodes);
}

async function loadSchools() {
  try {
    const data = await api('/api/admin/schools');
    S.schools = data.schools;
    $('#scTotal').textContent = data.stats.total;
    $('#scRegistered').textContent = data.stats.registered;
    $('#scWaiting').textContent = data.stats.waiting;
    renderSchools();
  } catch (e) {
    flash(e.message, 'error');
  }
}

function visibleSchools() {
  const q = $('#scSearch').value.trim().toLowerCase();
  const filter = $('#scFilter').value;
  return S.schools.filter((s) => {
    if (filter === 'waiting' && s.registered) return false;
    if (filter === 'registered' && !s.registered) return false;
    if (q && !s.name.toLowerCase().includes(q) && String(s.number) !== q) return false;
    return true;
  });
}

function renderSchools() {
  const rows = visibleSchools();
  if (!rows.length) {
    $('#schoolList').innerHTML = '<div class="empty-state"><span class="ico">🏫</span>Maktab topilmadi</div>';
    return;
  }

  $('#schoolList').innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Maktab</th><th>Mas‘ul shaxs</th><th>Ro‘yxat kodi</th><th>Holat</th><th>Videolar</th><th>Oxirgi</th><th></th></tr></thead>
    <tbody>${rows
      .map((s) => {
        const holat = !s.registered
          ? '<span class="badge amber">Kutilmoqda</span>'
          : !s.is_active
            ? '<span class="badge red">Bloklangan</span>'
            : s.must_change_password
              ? '<span class="badge amber">Parol kutilmoqda</span>'
              : '<span class="badge green">Faol</span>';
        // Kod faqat ro'yxatdan o'tmagan maktab uchun kerak
        const kod = s.registered
          ? '<span class="muted small">—</span>'
          : S.showCodes
            ? `<code class="code-chip" data-copy="${esc(s.invite_code)}" title="Nusxalash">${esc(s.invite_code)}</code>`
            : '<span class="muted small">••••-••••</span>';
        return `<tr>
          <td class="cell-main"><b>${esc(s.name)}</b>${
            s.registered ? `<div class="small muted">@${esc(s.username)}</div>` : ''
          }</td>
          <td data-label="Mas‘ul shaxs" class="small">${
            s.contact_name
              ? `${esc(s.contact_name)}${
                  s.phone ? `<div class="muted"><a href="tel:${esc(s.phone)}">${esc(s.phone)}</a></div>` : ''
                }`
              : '<span class="muted">—</span>'
          }</td>
          <td data-label="Kod">${kod}</td>
          <td data-label="Holat">${holat}</td>
          <td data-label="Videolar" class="small nowrap">${s.registered ? s.video_count : '—'}</td>
          <td data-label="Oxirgi" class="small nowrap muted">${s.last_day ? formatDay(s.last_day, false) : '—'}</td>
          <td class="cell-actions nowrap">
            <button class="btn sm ghost" data-sedit="${s.id}" title="Nomini o‘zgartirish">✎</button>
            ${
              s.registered
                ? `<button class="btn sm ghost" data-scal="${s.id}" data-uid="${s.id}" data-name="${esc(s.name)}" title="Kalendar">📅</button>
                   <button class="btn sm ghost" data-sreset="${s.id}" title="Parolni tiklash">🔑</button>
                   <button class="btn sm danger" data-sdelacc="${s.id}" title="Hisobni o‘chirish">🗑</button>`
                : `<button class="btn sm ghost" data-snewcode="${s.id}" title="Yangi kod">♻</button>
                   <button class="btn sm danger" data-sdel="${s.id}" title="Maktabni o‘chirish">🗑</button>`
            }
          </td>
        </tr>`;
      })
      .join('')}</tbody></table></div>`;
}

async function onSchoolListClick(e) {
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    try {
      await navigator.clipboard.writeText(copy.dataset.copy);
      flash('Kod nusxalandi: ' + copy.dataset.copy);
    } catch {
      flash('Nusxalab bo‘lmadi — kodni qo‘lda ko‘chiring', 'error');
    }
    return;
  }

  const edit = e.target.closest('[data-sedit]');
  if (edit) return openSchoolForm(S.schools.find((s) => s.id === Number(edit.dataset.sedit)));

  const cal = e.target.closest('[data-scal]');
  if (cal) {
    const s = S.schools.find((x) => x.id === Number(cal.dataset.scal));
    return openUserCalendar(s.user_id, s.name);
  }

  const newCode = e.target.closest('[data-snewcode]');
  if (newCode) {
    const s = S.schools.find((x) => x.id === Number(newCode.dataset.snewcode));
    if (!confirm(`"${s.name}" uchun yangi kod yaratilsinmi? Eski kod ishlamay qoladi.`)) return;
    try {
      const r = await api(`/api/admin/schools/${s.id}/new-code`, { method: 'POST' });
      showSecret('Yangi ro‘yxat kodi', s.name, [['Ro‘yxat kodi', r.invite_code]],
        'Bu kodni maktabga bering. Eski kod endi ishlamaydi.');
      await loadSchools();
    } catch (err) {
      flash(err.message, 'error');
    }
    return;
  }

  const reset = e.target.closest('[data-sreset]');
  if (reset) {
    const s = S.schools.find((x) => x.id === Number(reset.dataset.sreset));
    if (!confirm(`"${s.name}" uchun vaqtinchalik parol berilsinmi? Hozirgi paroli ishlamay qoladi.`)) return;
    try {
      const r = await api(`/api/admin/schools/${s.id}/reset-password`, { method: 'POST' });
      showSecret('Vaqtinchalik parol', s.name,
        [['Login', r.username], ['Vaqtinchalik parol', r.password]],
        'Maktab shu parol bilan kirib, darhol o‘z parolini qo‘yadi. Videolari saqlanib qoladi.');
      await loadSchools();
    } catch (err) {
      flash(err.message, 'error');
    }
    return;
  }

  const delAcc = e.target.closest('[data-sdelacc]');
  if (delAcc) {
    const s = S.schools.find((x) => x.id === Number(delAcc.dataset.sdelacc));
    if (!confirm(`"${s.name}" hisobi va uning BARCHA videolari o‘chiriladi.\nMaktab qaytadan ro‘yxatdan o‘ta oladi.\n\nDavom etasizmi?`)) return;
    try {
      await api(`/api/admin/schools/${s.id}/account`, { method: 'DELETE' });
      flash('Hisob o‘chirildi, maktab qaytadan ro‘yxatdan o‘ta oladi');
      await loadSchools();
      loadOverview($('#ovDay').value);
    } catch (err) {
      flash(err.message, 'error');
    }
    return;
  }

  const del = e.target.closest('[data-sdel]');
  if (del) {
    const s = S.schools.find((x) => x.id === Number(del.dataset.sdel));
    if (!confirm(`"${s.name}" ro‘yxatdan olib tashlansinmi?`)) return;
    try {
      await api(`/api/admin/schools/${s.id}`, { method: 'DELETE' });
      flash('Maktab o‘chirildi');
      await loadSchools();
      loadOverview($('#ovDay').value);
    } catch (err) {
      flash(err.message, 'error');
    }
  }
}

/** Kod yoki vaqtinchalik parolni bir marta ko'rsatuvchi oyna */
function showSecret(title, subtitle, pairs, note) {
  $('#secTitle').textContent = title;
  $('#secBody').innerHTML = `
    <p class="muted" style="margin:0 0 14px">${esc(subtitle)}</p>
    ${pairs
      .map(
        ([label, value]) => `<div class="secret-row">
          <span class="small muted">${esc(label)}</span>
          <code class="code-chip big" data-copy="${esc(value)}" title="Nusxalash">${esc(value)}</code>
        </div>`
      )
      .join('')}
    <div class="alert info" style="margin:14px 0 0">${esc(note)}</div>`;
  openModal('secretModal');
}

$('#secBody')?.addEventListener('click', async (e) => {
  const c = e.target.closest('[data-copy]');
  if (!c) return;
  try {
    await navigator.clipboard.writeText(c.dataset.copy);
    c.classList.add('copied');
    setTimeout(() => c.classList.remove('copied'), 1200);
  } catch {
    /* nusxalash ishlamadi — qo'lda ko'chiriladi */
  }
});

function openSchoolForm(school) {
  hideAlert($('#smErr'));
  $('#schoolForm').reset();
  $('#smId').value = school ? school.id : '';
  $('#smTitle').textContent = school ? 'Maktab nomini o‘zgartirish' : 'Yangi maktab';
  $('#smNumberField').hidden = Boolean(school);
  if (school) $('#smName').value = school.name;
  openModal('schoolModal');
}

async function saveSchool(e) {
  e.preventDefault();
  hideAlert($('#smErr'));
  const id = $('#smId').value;
  try {
    if (id) {
      await api(`/api/admin/schools/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: $('#smName').value.trim() }),
      });
    } else {
      await api('/api/admin/schools', {
        method: 'POST',
        body: JSON.stringify({
          number: Number($('#smNumber').value),
          name: $('#smName').value.trim(),
        }),
      });
    }
    closeModal('schoolModal');
    flash(id ? 'Saqlandi' : 'Maktab qo‘shildi');
    await loadSchools();
    loadOverview($('#ovDay').value);
  } catch (err) {
    showAlert($('#smErr'), err.message);
  }
}

/** Ro'yxatdan o'tmagan maktablarning kodlarini CSV qilib yuklab olish */
function exportCodes() {
  const rows = S.schools.filter((s) => !s.registered);
  if (!rows.length) return flash('Barcha maktablar ro‘yxatdan o‘tgan', 'error');

  const csv = ['Maktab,Login,Royxat kodi']
    .concat(rows.map((s) => `"${s.name}",${s.number}-maktab,${s.invite_code}`))
    .join('\r\n');
  // Excel UTF-8 ni to'g'ri o'qishi uchun BOM
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `maktab-kodlari-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  flash(`${rows.length} ta maktab kodi yuklab olindi`);
}

// ---------- Adminlar ----------

function bindUsers() {
  $('#addUserBtn').addEventListener('click', () => openUserForm(null));
  $('#userList').addEventListener('click', onUserListClick);
  $('#userForm').addEventListener('submit', saveUser);
  $('#cmPrev').addEventListener('click', () => loadUserCalendar(shiftMonth(S.calMonth, -1)));
  $('#cmNext').addEventListener('click', () => loadUserCalendar(shiftMonth(S.calMonth, 1)));
}

async function loadUsers() {
  const { users } = await api('/api/admin/users');
  S.users = users;
  // Videolar filtri ro'yxatdan o'tgan maktablar bo'yicha
  $('#fUser').innerHTML =
    '<option value="">Barchasi</option>' +
    S.schools
      .filter((s) => s.registered)
      .map((s) => `<option value="${s.user_id}">${esc(s.name)}</option>`)
      .join('');
  renderUsers();
}

function renderUsers() {
  // Maktab hisoblari "Maktablar" bo'limida boshqariladi — bu yerda faqat adminlar
  const admins = S.users.filter((u) => u.role === 'admin');
  if (!admins.length) {
    $('#userList').innerHTML = '<div class="empty-state"><span class="ico">👥</span>Admin yo‘q</div>';
    return;
  }
  $('#userList').innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>F.I.Sh.</th><th>Login</th><th>Lavozim</th><th>Rol</th><th>Videolar</th><th>Oxirgi</th><th>Holat</th><th></th></tr></thead>
    <tbody>${admins
      .map(
        (u) => `<tr>
          <td class="cell-main">
            <b>${esc(u.full_name || u.username)}</b>
            <div class="small muted only-sm">@${esc(u.username)}${u.position ? ' · ' + esc(u.position) : ''}</div>
          </td>
          <td data-label="Login" class="small muted hide-sm">@${esc(u.username)}</td>
          <td data-label="Lavozim" class="small hide-sm">${esc(u.position || '—')}</td>
          <td data-label="Rol">${u.role === 'admin' ? '<span class="badge amber">Admin</span>' : '<span class="badge gray">Xodim</span>'}</td>
          <td data-label="Videolar" class="small nowrap">${u.video_count}</td>
          <td data-label="Oxirgi" class="small nowrap muted">${u.last_day ? formatDay(u.last_day, false) : '—'}</td>
          <td data-label="Holat">${u.is_active ? '<span class="badge green">Faol</span>' : '<span class="badge red">Bloklangan</span>'}</td>
          <td class="cell-actions nowrap">
            <button class="btn sm ghost" data-cal="${u.id}" data-name="${esc(u.full_name || u.username)}">📅</button>
            <button class="btn sm ghost" data-edit="${u.id}">✎</button>
            <button class="btn sm ghost" data-toggle="${u.id}" data-active="${u.is_active}">${u.is_active ? '🔒' : '🔓'}</button>
            <button class="btn sm danger" data-deluser="${u.id}">🗑</button>
          </td>
        </tr>`
      )
      .join('')}</tbody></table></div>`;
}

async function onUserListClick(e) {
  const cal = e.target.closest('[data-cal]');
  if (cal) return openUserCalendar(Number(cal.dataset.cal), cal.dataset.name);

  const edit = e.target.closest('[data-edit]');
  if (edit) return openUserForm(S.users.find((u) => u.id === Number(edit.dataset.edit)));

  const toggle = e.target.closest('[data-toggle]');
  if (toggle) {
    const active = toggle.dataset.active === '1' || toggle.dataset.active === 'true';
    try {
      await api(`/api/admin/users/${toggle.dataset.toggle}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !active }),
      });
      flash(active ? 'Xodim bloklandi' : 'Blokdan chiqarildi');
      await loadUsers();
    } catch (err) {
      flash(err.message, 'error');
    }
    return;
  }

  const del = e.target.closest('[data-deluser]');
  if (del) {
    const u = S.users.find((x) => x.id === Number(del.dataset.deluser));
    if (!confirm(`"${u.full_name || u.username}" va uning BARCHA videolari o‘chiriladi. Davom etasizmi?`)) return;
    try {
      await api(`/api/admin/users/${del.dataset.deluser}`, { method: 'DELETE' });
      flash('Xodim o‘chirildi');
      await loadUsers();
      loadOverview($('#ovDay').value);
    } catch (err) {
      flash(err.message, 'error');
    }
  }
}

function openUserForm(user) {
  hideAlert($('#umErr'));
  $('#userForm').reset();
  $('#umId').value = user ? user.id : '';
  $('#umTitle').textContent = user ? 'Xodimni tahrirlash' : 'Yangi xodim';
  $('#umUsernameField').hidden = Boolean(user);
  $('#umUsername').required = !user;
  $('#umPassword').required = !user;
  $('#umPwLabel').textContent = user ? 'Yangi parol (bo‘sh qoldirsangiz o‘zgarmaydi)' : 'Parol';

  if (user) {
    $('#umFullName').value = user.full_name || '';
    $('#umPosition').value = user.position || '';
    $('#umRole').value = user.role;
  }
  openModal('userModal');
}

async function saveUser(e) {
  e.preventDefault();
  hideAlert($('#umErr'));

  const id = $('#umId').value;
  const payload = {
    full_name: $('#umFullName').value.trim(),
    position: $('#umPosition').value.trim(),
    role: $('#umRole').value,
  };
  if ($('#umPassword').value) payload.password = $('#umPassword').value;
  if (!id) payload.username = $('#umUsername').value.trim().toLowerCase();

  try {
    if (id) {
      await api(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    } else {
      await api('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeModal('userModal');
    flash(id ? 'Saqlandi' : 'Yangi xodim qo‘shildi');
    await loadUsers();
    loadOverview($('#ovDay').value);
  } catch (err) {
    showAlert($('#umErr'), err.message);
  }
}

// ---------- Xodim kalendari ----------

function openUserCalendar(userId, name) {
  S.calUserId = userId;
  $('#cmTitle').textContent = name;
  openModal('calModal');
  loadUserCalendar();
}

async function loadUserCalendar(month) {
  const data = await api(`/api/admin/users/${S.calUserId}/calendar` + (month ? `?month=${month}` : ''));
  S.calMonth = data.month;
  $('#cmMonth').textContent = data.monthLabel;
  $('#cmNext').disabled = data.month >= data.today.slice(0, 7);
  $('#cmSent').textContent = data.stats.sent;
  $('#cmMissed').textContent = data.stats.missed;

  const cells = [];
  for (let i = 0; i < data.firstWeekday; i++) cells.push('<div class="day empty"></div>');
  for (const d of data.days) {
    const cls = ['day', d.state];
    if (d.isToday) cls.push('today');
    cells.push(`<div class="${cls.join(' ')}" title="${formatDay(d.date)}">${d.dayNum}${d.hasVideo ? '<span class="dot"></span>' : ''}</div>`);
  }
  $('#cmCalendar').innerHTML = cells.join('');
}

init();
