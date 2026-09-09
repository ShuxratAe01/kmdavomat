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
  bindClubs();
  bindUsers();
  bindAnnouncements();

  await loadSchools();
  await loadUsers();
  await loadOverview();
  loadTicker();
  loadAnnouncements();
}

function bindTabs() {
  $$('.tab').forEach((t) =>
    t.addEventListener('click', () => {
      $$('.tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      ['overview', 'videos', 'schools', 'clubs', 'users'].forEach((name) => {
        $(`#tab-${name}`).hidden = name !== t.dataset.tab;
      });
      if (t.dataset.tab === 'videos') loadVideos(1);
      if (t.dataset.tab === 'schools') {
        loadSchools();
        requestAnimationFrame(() => window.ScrollRevealText?.refresh());
      }
      if (t.dataset.tab === 'clubs') loadClubs();
      if (t.dataset.tab === 'users') {
        renderUsers();
        loadAnnouncements();
      }
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
      formatDay(data.day) + (data.holiday ? ' — ' + data.holiday : data.isRestDay ? ' — dam olish kuni' : '');
    $('#ovTotal').textContent = data.stats.registered;
    $('#ovSent').textContent = data.stats.sent;
    $('#ovMissed').textContent = data.stats.missed;
    $('#ovVideosTotal').textContent = data.stats.videosTotal;
    $('#ovWaiting').textContent = data.stats.notRegistered;

    if (!data.schools.length) {
      $('#ovList').innerHTML =
        '<div class="empty-state"><span class="ico">🏫</span>Maktablar ro‘yxati bo‘sh.<br><span class="small">“Maktablar” bo‘limidan qo‘shing.</span></div>';
      return;
    }

    $('#ovList').innerHTML = `<div class="school-grid">${data.schools
      .map((s) => {
        // Holat kartochkaning rangini ham belgilaydi
        const holat = !s.registered
          ? { cls: 'new', badge: 'gray', text: 'Ro‘yxatdan o‘tmagan' }
          : !s.is_active
            ? { cls: 'blocked', badge: 'red', text: 'Bloklangan' }
            : s.sent
              ? { cls: 'sent', badge: 'green', text: '✓ Yuborgan' }
              : data.isRestDay
                ? { cls: 'rest', badge: 'gray', text: 'Dam olish kuni' }
                : { cls: 'missed', badge: 'red', text: '✕ Yubormagan' };

        const vaqt = s.sent_at ? formatTime(s.sent_at).slice(11) : null;
        const tugmalar = [
          s.video_id
            ? `<button class="btn sm" data-video="${s.video_id}" data-name="${esc(s.name)}" data-day="${data.day}">▶ Ko‘rish</button>`
            : '',
          s.registered
            ? `<button class="btn sm ghost" data-cal="${s.id}" data-name="${esc(s.name)}">📅 Kalendar</button>`
            : '',
        ].join('');

        return `<article class="school-card ${holat.cls}">
          <header class="school-head">
            <span class="school-num">${s.number}</span>
            <div class="school-id">
              <b title="${esc(s.name)}">${esc(s.name)}</b>
              ${s.registered ? `<span>@${esc(s.username)}</span>` : ''}
            </div>
          </header>
          <div class="school-row">
            <span class="badge ${holat.badge}">${holat.text}</span>
            <span class="school-facts">${
              [vaqt ? '🕒 ' + vaqt : '', s.registered ? '📆 ' + s.month_days + ' kun' : '']
                .filter(Boolean).join('<i></i>')
            }</span>
          </div>
          ${tugmalar ? `<div class="school-actions">${tugmalar}</div>` : ''}
        </article>`;
      })
      .join('')}</div>`;
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
      <thead><tr><th>Maktab</th><th>Sana</th><th>Vaqt</th><th>Holat</th><th>Izoh</th><th></th></tr></thead>
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
    $('#scCodes').textContent = S.showCodes ? 'Kodlarni yashirish' : 'Kodlarni ko‘rsatish';
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
    requestAnimationFrame(() => window.ScrollRevealText?.refresh());
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

function prettyPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('998')) {
    return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  }
  return phone || '—';
}

function profileNameHtml(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '—';
  return words
    .map((word, i) => {
      const dir = i % 2 === 0 ? 'from-top' : 'from-bottom';
      const delay = (0.08 + i * 0.22).toFixed(2);
      return `<span class="profile-name-clip"><span class="profile-name-word ${dir}" style="animation-delay:${delay}s">${esc(word)}</span></span>`;
    })
    .join(' ');
}

const SC_PHOTO_EMPTY =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c0-3.7 3.4-6.2 7.5-6.2s7.5 2.5 7.5 6.2"/></svg>';

const SC_CAP_ICO =
  '<svg class="cap-ico" viewBox="0 0 64 64" aria-hidden="true"><path d="M20 26h24v20.5c0 4.2-5.4 7.5-12 7.5s-12-3.3-12-7.5z" fill="#e2d8fd"/><path d="M32 33.5c6.6 0 12-3.3 12-7.5v20.5c0 4.2-5.4 7.5-12 7.5z" fill="#cdbdfa"/><path d="M34.3 6.6 60.4 21.2c1.9 1.1 1.9 3.8 0 4.9L34.3 40.7c-1.4.8-3.2.8-4.6 0L3.6 26.1c-1.9-1.1-1.9-3.8 0-4.9L29.7 6.6c1.4-.8 3.2-.8 4.6 0z" fill="#7c4dff"/><path d="M32 41.3c-.8 0-1.6-.2-2.3-.6L3.6 26.1C2.6 25.5 2.1 24.5 2.1 23.6v3.1c0 .9.5 1.9 1.5 2.5l26.1 14.6c1.4.8 3.2.8 4.6 0l26.1-14.6c1-.6 1.5-1.6 1.5-2.5v-3.1c0 .9-.5 1.9-1.5 2.5L34.3 40.7c-.7.4-1.5.6-2.3.6z" fill="#6636e0"/><path d="M29.7 6.6 3.6 21.2c-1.3.7-1.8 2.2-1.3 3.4.2-.5.6-.9 1.3-1.3L29.7 8.7c1.4-.8 3.2-.8 4.6 0l26.1 14.6c.7.4 1.1.8 1.3 1.3.5-1.2 0-2.7-1.3-3.4L34.3 6.6c-1.4-.8-3.2-.8-4.6 0z" fill="#9b78ff"/><circle cx="10.5" cy="28.5" r="3.3" fill="#7c4dff"/><rect x="9.2" y="30.5" width="2.6" height="10" rx="1.3" fill="#7c4dff"/><circle cx="10.5" cy="41.6" r="2.6" fill="#e2d8fd"/><path d="M10.5 43.6c3.3 0 5.4 4.3 4.9 7.4-.3 1.9-2.3 2.9-4.9 2.9s-4.6-1-4.9-2.9c-.5-3.1 1.6-7.4 4.9-7.4z" fill="#7c4dff"/><path d="M10.5 43.6c-3.3 0-5.4 4.3-4.9 7.4.14.9.77 1.65 1.75 2.15-.4-3.2.85-7.9 3.15-9.55z" fill="#9b78ff"/></svg>';

/* Kartochka belgilari — lucide uslubidagi ingichka chiziqli ikonkalar.
   Loyihada ikonka kutubxonasi yo‘q, shuning uchun SVG shu yerda. */
const SC_ICO = {
  school: '<path d="M3 21h18M5 21V9l7-4.5L19 9v12"/><path d="M9.5 21v-4.5h5V21"/>',
  person: '<circle cx="12" cy="8" r="3.4"/><path d="M4.8 20c0-3.5 3.2-5.6 7.2-5.6s7.2 2.1 7.2 5.6"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4-2 1.4a12 12 0 0 0 6.1 6.1l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2C11.4 19 5 12.6 4.5 5.7a2 2 0 0 1 2-2.2z"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2.4"/><path d="M10 9.5v5l4.5-2.5z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.4"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/>',
  key: '<circle cx="8" cy="12" r="3.6"/><path d="M11.6 12H21M18 12v3M15 12v2.2"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="m8.6 12.2 2.3 2.3 4.5-4.7"/>',
  dot: '<circle cx="12" cy="12" r="5"/>',
  arrow: '<path d="M5 12h13M13 6.5 18.5 12 13 17.5"/>',
  pencil: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m14.5 7.5 3 3"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-13.7-5.2L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 13.7 5.2L20 16"/><path d="M20 20v-4h-4"/>',
  trash: '<path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l1 13h9l1-13"/>',
};

function scIco(name, cls) {
  return `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SC_ICO[name]}</svg>`;
}

function renderSchools() {
  const rows = visibleSchools();
  const el = $('#schoolList');

  if (!rows.length) {
    el.innerHTML = `<div class="sc-empty">
      <span class="sc-empty-ico">${scIco('school')}</span>
      <b>Mos maktab topilmadi</b>
      <p>Qidiruv yoki filtr parametrlarini o‘zgartirib ko‘ring.</p>
      <button class="btn ghost" data-clear>Filtrlarni tozalash</button>
    </div>`;
    return;
  }

  el.innerHTML = rows
    .map((s) => {
      const personName = s.registered && s.contact_name;
      const displayName = personName || s.name;
      const nameHtml = personName ? profileNameHtml(displayName) : esc(displayName);
      const subtitle = s.registered ? s.name : 'Ro‘yxatdan o‘tmagan';
      const clubsCount = Number(s.clubs_count) || 0;
      const students = s.students_total ? String(s.students_total) : '—';
      const phone = s.phone
        ? `<a href="tel:${esc(s.phone)}">${esc(prettyPhone(s.phone))}</a>`
        : '<span>—</span>';
      const photo = s.user_id && s.photo_updated_at
        ? `<img src="/api/users/${s.user_id}/photo?v=${encodeURIComponent(s.photo_updated_at)}" alt=""
             onerror="this.hidden=true;this.nextElementSibling.hidden=false" />
           <span class="profile-photo-empty" hidden>${SC_PHOTO_EMPTY}</span>`
        : `<span class="profile-photo-empty">${SC_PHOTO_EMPTY}</span>`;
      const clubsChip = s.registered
        ? `<button type="button" class="clubs-chip" data-sclubs="${s.id}" title="To‘garaklar">
             ${SC_CAP_ICO} To‘garaklar
             <span class="clubs-count"${clubsCount ? '' : ' hidden'}>${clubsCount}</span>
           </button>`
        : `<span class="clubs-chip" aria-disabled="true">
             ${SC_CAP_ICO} To‘garaklar
           </span>`;

      const tools = s.registered
        ? [
            ['scal', 'calendar', 'Kalendar'],
            ['sedit', 'pencil', 'Nomini o‘zgartirish'],
            ['sreset', 'key', 'Parolni tiklash'],
            ['sdelacc', 'trash', 'Hisobni o‘chirish', 'danger'],
          ]
        : [
            ['sedit', 'pencil', 'Nomini o‘zgartirish'],
            ['snewcode', 'refresh', 'Yangi kod'],
            ['sdel', 'trash', 'Maktabni o‘chirish', 'danger'],
          ];

      const extra = !s.registered
        ? `<code class="sc-code" data-copy="${esc(s.invite_code)}" title="Nusxalash">${
            S.showCodes ? esc(s.invite_code) : '••••-••••'
          }</code>`
        : '';

      return `<article class="profile-card sc-card">
        <div class="profile-photo-col">
          <div class="profile-photo">${photo}</div>
        </div>
        <div class="profile-info">
          <h3 class="profile-name">${nameHtml}</h3>
          <p class="profile-position">${esc(subtitle)}</p>
          <div class="profile-rows">
            <div class="profile-col">
              <div class="profile-meta-item role-row">
                <span class="profile-ico">${scIco('school')}</span>
                <span>Maktab maslahatchisi</span>
              </div>
              <div class="profile-meta-item phone-row">
                <span class="profile-ico">${scIco('phone')}</span>
                ${phone}
              </div>
            </div>
            <div class="profile-col profile-col-side">
              <div class="profile-meta-item clubs-row">${clubsChip}</div>
              <div class="profile-meta-item students-row">
                <span class="profile-ico">${scIco('person')}</span>
                <span>O‘quvchilar soni</span>
                <span class="profile-count">${esc(students)}</span>
              </div>
            </div>
          </div>
          <div class="sc-act">
            ${extra}
            <div class="sc-icons">${tools
              .map(([attr, icon, label, kind]) =>
                `<button class="sc-ico-btn ${kind || ''}" data-${attr}="${s.id}"
                   title="${label}" aria-label="${esc(s.name)}: ${label}">${scIco(icon)}</button>`
              )
              .join('')}</div>
          </div>
        </div>
      </article>`;
    })
    .join('');
}
async function onSchoolListClick(e) {
  const clear = e.target.closest('[data-clear]');
  if (clear) {
    $('#scSearch').value = '';
    $('#scFilter').value = '';
    renderSchools();
    $('#scSearch').focus();
    return;
  }

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

  const clubs = e.target.closest('[data-sclubs]');
  if (clubs) {
    $$('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === 'clubs'));
    ['overview', 'videos', 'schools', 'clubs', 'users'].forEach((n) => {
      $(`#tab-${n}`).hidden = n !== 'clubs';
    });
    $('#acSchool').value = clubs.dataset.sclubs;
    loadClubs();
    return;
  }

  const cal = e.target.closest('[data-scal]');
  if (cal) {
    const s = S.schools.find((x) => x.id === Number(cal.dataset.scal));
    return openUserCalendar(s.user_id, s.name);
  }

  const newCode = e.target.closest('[data-snewcode]');
  if (newCode) {
    const s = S.schools.find((x) => x.id === Number(newCode.dataset.snewcode));
    if (!confirm(`"${s.name}" uchun yangi kod yaratilsinmi? Eski kod ishlamay qoladi.`)) return;
    const pw = askAdminPassword('Yangi ro‘yxat kodi yaratiladi. Eski kod ishlamay qoladi.');
    if (!pw) return;
    try {
      const r = await api(`/api/admin/schools/${s.id}/new-code`, {
        method: 'POST',
        headers: { 'X-Admin-Password': pw },
      });
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
    const pw = askAdminPassword('Maktab paroli tiklanadi. Hozirgi parol ishlamay qoladi.');
    if (!pw) return;
    try {
      const r = await api(`/api/admin/schools/${s.id}/reset-password`, {
        method: 'POST',
        headers: { 'X-Admin-Password': pw },
      });
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
    const pw = askAdminPassword('Hisob va barcha videolar o‘chiriladi. Bu amalni orqaga qaytarib bo‘lmaydi.');
    if (!pw) return;
    try {
      await api(`/api/admin/schools/${s.id}/account`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': pw },
      });
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
    const pw = askAdminPassword('Maktab ro‘yxatdan olib tashlanadi.');
    if (!pw) return;
    try {
      await api(`/api/admin/schools/${s.id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': pw },
      });
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

// ---------- To'garaklar ----------

function bindClubs() {
  $('#acApply').addEventListener('click', loadClubs);
  $('#acSearch').addEventListener('input', () => {
    clearTimeout(S.clubTimer);
    S.clubTimer = setTimeout(loadClubs, 300);
  });
  $('#acSchool').addEventListener('change', loadClubs);
  $('#acReset').addEventListener('click', () => {
    $('#acSearch').value = '';
    $('#acSchool').value = '';
    loadClubs();
  });
}

async function loadClubs() {
  const q = new URLSearchParams();
  if ($('#acSearch').value.trim()) q.set('q', $('#acSearch').value.trim());
  if ($('#acSchool').value) q.set('school_id', $('#acSchool').value);

  $('#clubList').innerHTML = '<p class="muted small">Yuklanmoqda…</p>';
  try {
    const d = await api(`/api/admin/clubs?${q}`);
    $('#acTotal').textContent = d.stats.total;
    $('#acStudents').textContent = d.stats.students;
    $('#acSchools').textContent = `${d.stats.schools} / ${d.stats.schoolsTotal}`;

    if (!d.clubs.length) {
      $('#clubList').innerHTML =
        '<div class="empty-state"><span class="ico">🎓</span>To‘garak topilmadi</div>';
      return;
    }

    $('#clubList').innerHTML = `<div class="ac-club-list">${d.clubs
      .map(
        (c) => `<article class="ac-club-card">
          <header class="ac-club-head">
            <h3>${esc(c.name)}</h3>
            <p>${esc(c.school_name)}</p>
          </header>
          <dl class="ac-club-meta">
            <div>
              <dt>Rahbari</dt>
              <dd>${esc(c.teacher || '—')}</dd>
            </div>
            <div>
              <dt>O‘quvchilar soni</dt>
              <dd>${c.students || '—'}</dd>
            </div>
            <div>
              <dt>O‘tish vaqti</dt>
              <dd>${esc(c.schedule || '—')}</dd>
            </div>
          </dl>
        </article>`
      )
      .join('')}</div>`;
  } catch (e) {
    $('#clubList').innerHTML = `<p class="alert error">${esc(e.message)}</p>`;
  }
}

// ---------- E'lon berish ----------

function bindAnnouncements() {
  const body = $('#announcementBody');
  const count = $('#announcementCount');
  const syncCount = () => {
    count.textContent = `${body.value.length} / 200`;
  };
  body.addEventListener('input', syncCount);
  syncCount();

  $('#announcementForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = body.value.replace(/\s+/g, ' ').trim();
    if (text.length < 3) return flash('E’lon matnini yozing', 'error');
    const btn = $('#announcementSend');
    btn.disabled = true;
    try {
      await api('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      });
      body.value = '';
      syncCount();
      flash('E’lon yuborildi — maktab sahifalarida ko‘rinadi');
      await loadAnnouncements();
      await loadTicker();
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  $('#announcementList').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-ann-del]');
    if (!del) return;
    if (!confirm('Bu e’lon o‘chirilsinmi?')) return;
    try {
      await api(`/api/admin/announcements/${del.dataset.annDel}`, { method: 'DELETE' });
      await loadAnnouncements();
      await loadTicker();
    } catch (err) {
      flash(err.message, 'error');
    }
  });
}

async function loadAnnouncements() {
  const box = $('#announcementList');
  if (!box) return;
  try {
    const { items } = await api('/api/admin/announcements');
    if (!items.length) {
      box.innerHTML = '<p class="small muted" style="margin:14px 0 0">Hozircha e’lon yo‘q.</p>';
      return;
    }
    box.innerHTML = `<ul class="announcement-items">${items
      .map(
        (a) => `<li>
          <span class="announcement-text">${esc(a.body)}</span>
          <span class="announcement-meta">${esc(formatTime(a.created_at))}</span>
          <button type="button" class="btn sm ghost" data-ann-del="${a.id}">O‘chirish</button>
        </li>`
      )
      .join('')}</ul>`;
  } catch (err) {
    box.innerHTML = `<p class="small muted" style="margin:14px 0 0">${esc(err.message)}</p>`;
  }
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
  const schoolOptions = S.schools
    .map((sc) => `<option value="${sc.id}">${esc(sc.name)}</option>`)
    .join('');
  $('#acSchool').innerHTML = '<option value="">Barchasi</option>' + schoolOptions;

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
      const pw = askAdminPassword(active ? 'Xodim bloklanadi.' : 'Xodim blokdan chiqariladi.');
      if (!pw) return;
      await api(`/api/admin/users/${toggle.dataset.toggle}`, {
        method: 'PATCH',
        headers: { 'X-Admin-Password': pw },
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
    const pw = askAdminPassword('Xodim va uning barcha videolari o‘chiriladi.');
    if (!pw) return;
    try {
      await api(`/api/admin/users/${del.dataset.deluser}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': pw },
      });
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
    const extra = {};
    if (!id) {
      const pw = askAdminPassword('Yangi xodim yaratiladi.');
      if (!pw) return;
      extra['X-Admin-Password'] = pw;
    } else {
      const prev = S.users.find((u) => u.id === Number(id));
      const roleChanged = prev && prev.role !== payload.role;
      if (payload.password || roleChanged) {
        const pw = askAdminPassword(
          payload.password ? 'Xodim paroli o‘zgartiriladi.' : 'Xodim roli o‘zgartiriladi.'
        );
        if (!pw) return;
        extra['X-Admin-Password'] = pw;
      }
    }
    if (id) {
      await api(`/api/admin/users/${id}`, { method: 'PATCH', headers: extra, body: JSON.stringify(payload) });
    } else {
      await api('/api/admin/users', { method: 'POST', headers: extra, body: JSON.stringify(payload) });
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
  try {
    const data = await api(`/api/admin/users/${S.calUserId}/calendar` + (month ? `?month=${month}` : ''));
    S.calMonth = data.month;
    $('#cmMonth').textContent = data.monthLabel;
    $('#cmNext').disabled = data.month >= data.today.slice(0, 7);
    const done = data.stats.sent;
    const expected = data.stats.sent + data.stats.missed;
    $('#cmSent').textContent = done;
    $('#cmMissed').textContent = data.stats.missed;
    $('#cmRest').textContent = data.stats.rest ?? 0;
    $('#cmPercent').textContent = expected ? Math.round((done / expected) * 100) + '%' : '—';

    const cells = [];
    for (let i = 0; i < data.firstWeekday; i++) cells.push('<div class="day empty"></div>');
    for (const d of data.days) {
      const cls = ['day', d.state];
      if (new Date(`${d.date}T00:00:00Z`).getUTCDay() === 0) cls.push('sunday');
      if (d.holiday) cls.push('holiday');
      if (d.isToday) cls.push('today');
      cells.push(
        `<div class="${cls.join(' ')}" title="${formatDay(d.date)} — ${
          {
            sent: 'video yuborilgan',
            rest: d.holiday ? d.holiday + ' — video shart emas' : 'dam olish kuni, video shart emas',
            upcoming: 'kelgusi kun',
            missed: 'video yuborilmagan',
          }[d.state]
        }"><span class="day-num">${d.dayNum}</span>${d.hasVideo ? '<span class="dot"></span>' : ''}</div>`
      );
    }
    $('#cmCalendar').innerHTML = cells.join('');
  } catch (err) {
    $('#cmCalendar').innerHTML = `<p class="alert error">${esc(err.message)}</p>`;
  }
}

init();
