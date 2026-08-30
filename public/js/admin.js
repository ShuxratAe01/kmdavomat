/* ===== Admin panel ===== */

const S = {
  users: [],
  page: 1,
  calUserId: null,
  calMonth: null,
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
  bindUsers();

  await loadUsers();
  await loadOverview();
}

function bindTabs() {
  $$('.tab').forEach((t) =>
    t.addEventListener('click', () => {
      $$('.tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      ['overview', 'videos', 'users'].forEach((name) => {
        $(`#tab-${name}`).hidden = name !== t.dataset.tab;
      });
      if (t.dataset.tab === 'videos') loadVideos(1);
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
    $('#ovDayLabel').textContent = formatDay(data.day);
    $('#ovTotal').textContent = data.stats.total;
    $('#ovSent').textContent = data.stats.sent;
    $('#ovMissed').textContent = data.stats.missed;
    $('#ovVideosTotal').textContent = data.stats.videosTotal;
    $('#ovStorage').textContent = formatSize(data.stats.storageBytes);

    const rows = data.users.filter((u) => u.is_active);
    if (!rows.length) {
      $('#ovList').innerHTML =
        '<div class="empty-state"><span class="ico">👥</span>Hali xodim qo‘shilmagan.<br><span class="small">“Xodimlar” bo‘limidan qo‘shing.</span></div>';
      return;
    }

    $('#ovList').innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Xodim</th><th>Lavozim</th><th>Holat</th><th>Vaqt</th><th>Oyda</th><th></th></tr></thead>
      <tbody>${rows
        .map(
          (u) => `<tr>
            <td class="cell-main"><b>${esc(u.full_name || u.username)}</b><div class="small muted">@${esc(u.username)}</div></td>
            <td data-label="Lavozim" class="small muted">${esc(u.position || '—')}</td>
            <td data-label="Holat">${u.sent ? '<span class="badge green">✓ Yuborgan</span>' : '<span class="badge red">✕ Yubormagan</span>'}</td>
            <td data-label="Vaqt" class="small nowrap">${u.sent_at ? formatTime(u.sent_at).slice(11) : '—'}</td>
            <td data-label="Oyda" class="small nowrap">${u.month_days} kun</td>
            <td class="cell-actions nowrap">
              ${u.video_id ? `<button class="btn sm" data-video="${u.video_id}" data-name="${esc(u.full_name || u.username)}" data-day="${data.day}">▶ Ko‘rish</button>` : ''}
              <button class="btn sm ghost" data-cal="${u.id}" data-name="${esc(u.full_name || u.username)}">📅 Kalendar</button>
            </td>
          </tr>`
        )
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
      <thead><tr><th>Xodim</th><th>Sana</th><th>Vaqt</th><th>Hajm</th><th>Holat</th><th>Izoh</th><th></th></tr></thead>
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
  $('#vmBody').innerHTML = `
    <video controls autoplay playsinline preload="metadata" src="/api/videos/${id}/stream"></video>
    <div class="modal-foot">
      <a class="btn ghost" href="/api/videos/${id}/download">⬇ Yuklab olish</a>
      <button class="btn danger" data-status="rejected" data-id="${id}">✕ Rad etish</button>
      <button class="btn success" data-status="accepted" data-id="${id}">✓ Qabul qilish</button>
    </div>`;
  openModal('videoModal');
}

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

// ---------- Xodimlar ----------

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
  $('#fUser').innerHTML =
    '<option value="">Barchasi</option>' +
    users
      .filter((u) => u.role === 'user')
      .map((u) => `<option value="${u.id}">${esc(u.full_name || u.username)}</option>`)
      .join('');
  renderUsers();
}

function renderUsers() {
  if (!S.users.length) {
    $('#userList').innerHTML = '<div class="empty-state"><span class="ico">👥</span>Xodim yo‘q</div>';
    return;
  }
  $('#userList').innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>F.I.Sh.</th><th>Login</th><th>Lavozim</th><th>Rol</th><th>Videolar</th><th>Oxirgi</th><th>Holat</th><th></th></tr></thead>
    <tbody>${S.users
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
