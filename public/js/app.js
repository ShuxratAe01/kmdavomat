/* ===== Foydalanuvchi sahifasi ===== */

/**
 * Telefon/planshetmi? Shunga qarab kamera boshqacha ochiladi:
 *   telefon    -> qurilmaning o'z kamera ilovasi (HTTP da ham ishlaydi, sifati yaxshiroq)
 *   kompyuter  -> brauzer ichidagi yozuvchi (jonli ko'rinish + taymer)
 */
const IS_MOBILE =
  /Android|iPhone|iPod|iPad|Windows Phone|Mobile/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)); // iPadOS

let state = {
  user: null,
  month: null,
  today: null,
  calendar: null,
  config: { maxVideoMb: 60, maxVideoSeconds: 30, cameraFacing: 'user', allowMultiplePerDay: false },
  pickedBlob: null,
  pickedName: '',
};

// ---------- Yuklash ----------

async function init() {
  try {
    const [me, cfg] = await Promise.all([api('/api/auth/me'), api('/api/config')]);
    state.user = me.user;
    state.config = cfg;
  } catch {
    return;
  }

  $('#whoName').textContent = state.user.full_name || state.user.username;
  $('#whoRole').textContent = state.user.position || '@' + state.user.username;
  $('#maxSize').textContent = state.config.maxVideoMb;
  $$('.max-secs').forEach((el) => (el.textContent = state.config.maxVideoSeconds));
  $('#recLimit').textContent = mmss(state.config.maxVideoSeconds);
  // Telefonda qaysi kamera ochilishini belgilaydi (user = selfi, environment = orqadagi)
  $('#cameraInput').setAttribute('capture', state.config.cameraFacing);
  $('#cameraHint').textContent = IS_MOBILE ? 'Kamera ilovasi ochiladi' : 'Shu yerda yozib olasiz';

  await loadCalendar();
  bindEvents();
}

async function loadCalendar(month) {
  const data = await api('/api/calendar' + (month ? `?month=${month}` : ''));
  state.calendar = data;
  state.month = data.month;
  state.today = data.today;
  render();
  loadVideoList();
}

// ---------- Chizish ----------

function render() {
  const c = state.calendar;

  // Bugungi sana bloki
  $('#todayDate').textContent = formatDay(c.today);
  $('#todayWeekday').textContent = weekdayName(c.today);

  const sentToday = Boolean(c.todayVideo);
  const st = $('#todayStatus');
  st.classList.toggle('done', sentToday);
  st.textContent = sentToday
    ? `✓ Bugungi video yuborilgan — ${formatTime(c.todayVideo.created_at)}`
    : '⚠ Bugun uchun video yuborilmagan';

  // Oy sarlavhasi
  $('#monthLabel').textContent = c.monthLabel;
  $('#nextMonth').disabled = c.month >= c.today.slice(0, 7);

  // Kalendar katakchalari
  const cells = [];
  for (let i = 0; i < c.firstWeekday; i++) cells.push('<div class="day empty"></div>');
  for (const d of c.days) {
    const cls = ['day', d.state];
    if (d.isToday) cls.push('today');
    if (d.hasVideo) cls.push('clickable');
    cells.push(
      `<div class="${cls.join(' ')}" data-date="${d.date}" title="${formatDay(d.date)} — ${
        d.hasVideo ? 'video yuborilgan' : d.isFuture ? 'kelgusi kun' : 'video yuborilmagan'
      }">${d.dayNum}${d.hasVideo ? '<span class="dot"></span>' : ''}</div>`
    );
  }
  $('#calendar').innerHTML = cells.join('');

  // Statistika
  const done = c.stats.sent;
  const expected = c.stats.sent + c.stats.missed;
  $('#stSent').textContent = done;
  $('#stMissed').textContent = c.stats.missed;
  $('#stPercent').textContent = expected ? Math.round((done / expected) * 100) + '%' : '—';

  // Bugungi video yuborilgan bo'lsa tugmani o'zgartirish
  const btn = $('#sendBtn');
  if (sentToday && !state.config.allowMultiplePerDay) {
    btn.disabled = true;
    btn.textContent = '✓ Bugungi video yuborilgan';
  } else {
    btn.disabled = false;
    btn.textContent = '🎬 Video yuborish';
  }
}

async function loadVideoList() {
  const el = $('#videoList');
  el.innerHTML = '<p class="muted small">Yuklanmoqda…</p>';
  try {
    const { videos } = await api(`/api/videos?month=${state.month}`);
    if (!videos.length) {
      el.innerHTML = '<div class="empty-state"><span class="ico">📭</span>Bu oyda video yuborilmagan</div>';
      return;
    }
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Sana</th><th>Vaqt</th><th>Hajm</th><th>Holat</th><th></th></tr></thead>
      <tbody>${videos
        .map(
          (v) => `<tr>
            <td class="cell-main nowrap"><b>${formatDay(v.day, false)}</b></td>
            <td data-label="Vaqt" class="nowrap small muted">${formatTime(v.created_at).slice(11)}</td>
            <td data-label="Hajm" class="nowrap small">${formatSize(v.size)}</td>
            <td data-label="Holat">${statusBadge(v.status)}</td>
            <td class="cell-actions nowrap"><button class="btn sm ghost" data-play="${v.id}" data-day="${v.day}">▶ Ko‘rish</button></td>
          </tr>`
        )
        .join('')}</tbody></table></div>`;
  } catch (e) {
    el.innerHTML = `<p class="alert error">${esc(e.message)}</p>`;
  }
}

function openDayVideo(id, day) {
  $('#dayTitle').textContent = formatDay(day);
  $('#dayBody').innerHTML = `<video controls playsinline preload="metadata" src="/api/videos/${id}/stream"></video>
    <div class="modal-foot"><a class="btn ghost" href="/api/videos/${id}/download">⬇ Yuklab olish</a></div>`;
  openModal('dayModal');
}

// ---------- Voqealar ----------

function bindEvents() {
  $('#prevMonth').addEventListener('click', () => loadCalendar(shiftMonth(state.month, -1)));
  $('#nextMonth').addEventListener('click', () => loadCalendar(shiftMonth(state.month, 1)));

  $('#calendar').addEventListener('click', (e) => {
    const cell = e.target.closest('.day.clickable');
    if (!cell) return;
    const date = cell.dataset.date;
    api(`/api/videos?month=${state.month}`).then(({ videos }) => {
      const v = videos.find((x) => x.day === date);
      if (v) openDayVideo(v.id, date);
    });
  });

  $('#videoList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-play]');
    if (b) openDayVideo(b.dataset.play, b.dataset.day);
  });

  $('#sendBtn').addEventListener('click', () => {
    resetSendModal();
    openModal('sendModal');
  });

  $('#menuBtn').addEventListener('click', () => openModal('menuModal'));

  $('#logoutBtn').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/login';
  });

  $('#pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert($('#pwErr'));
    hideAlert($('#pwOk'));
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current: $('#curPw').value, next: $('#newPw').value }),
      });
      showAlert($('#pwOk'), 'Parol muvaffaqiyatli o‘zgartirildi', 'ok');
      $('#pwForm').reset();
    } catch (err) {
      showAlert($('#pwErr'), err.message);
    }
  });

  bindUpload();
}

// ---------- Video tanlash / yozib olish ----------

function resetSendModal() {
  state.pickedBlob = null;
  state.pickedName = '';
  hideAlert($('#sendErr'));
  $('#pickStep').hidden = false;
  $('#recordStep').hidden = true;
  $('#previewStep').hidden = true;
  $('#note').value = '';
  $('#cameraInput').value = '';
  $('#galleryInput').value = '';
  stopStream();
}

let mediaStream = null;
let recorder = null;
let chunks = [];
let timerId = null;

function stopStream() {
  if (recorder && recorder.state !== 'inactive') {
    try { recorder.stop(); } catch { /* allaqachon to'xtagan */ }
  }
  recorder = null;
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  clearInterval(timerId);
  timerId = null;
  $('#recPreview').srcObject = null;
}

/** Kamera xatoliklarini tushunarli o'zbekcha matnga aylantiradi */
function cameraErrorText(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'Kameraga ruxsat berilmadi. Manzil satrining chap tomonidagi 🔒 belgisini bosib, Kamera va Mikrofonga ruxsat bering, so‘ng qayta urinib ko‘ring.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'Kamera topilmadi. Kamera ulanganini tekshiring yoki “Galereyadan tanlash” orqali tayyor video yuboring.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Kamera band — uni boshqa dastur (Zoom, Skype, Telegram, boshqa brauzer oynasi) ishlatayotgan bo‘lishi mumkin. O‘sha dasturni yopib qayta urinib ko‘ring.';
    default:
      return 'Kamerani ochib bo‘lmadi. “Galereyadan tanlash” orqali tayyor video yuborishingiz mumkin.';
  }
}

/**
 * Kamerani ochadi — qurilmaga qarab:
 *   Telefon/planshet -> qurilmaning o'z kamera ilovasi.
 *      Brauzer ichidagi yozuvchi (getUserMedia) faqat localhost yoki HTTPS da ishlaydi,
 *      telefondan http://192.168.x.x orqali kirilganda brauzer kameraga ruxsat bermaydi.
 *      Tizim kamerasi esa oddiy HTTP da ham muammosiz ishlaydi va sifati yaxshiroq.
 *   Kompyuter -> brauzer ichidagi yozuvchi: jonli ko'rinish, ⏺/⏹ va taymer.
 */
async function startCamera() {
  hideAlert($('#sendErr'));

  const canRecord =
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined' &&
    window.isSecureContext;

  // Telefonda har doim tizim kamerasi; kompyuterda imkon bo'lmasa ham shunga tushamiz
  if (IS_MOBILE || !canRecord) return $('#cameraInput').click();

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: state.config.cameraFacing, width: { ideal: 720 } },
      audio: true,
    });
  } catch (err) {
    // So'ralgan kamera yo'q bo'lsa — istalgan kamera bilan qayta urinamiz
    if (err?.name === 'OverconstrainedError' || err?.name === 'ConstraintNotSatisfiedError') {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err2) {
        return showAlert($('#sendErr'), cameraErrorText(err2));
      }
    } else {
      return showAlert($('#sendErr'), cameraErrorText(err));
    }
  }

  $('#pickStep').hidden = true;
  $('#recordStep').hidden = false;
  const v = $('#recPreview');
  v.srcObject = mediaStream;
  v.play().catch(() => {});
}

/** Soniyani "00:30" ko'rinishiga keltiradi */
function mmss(sec) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.round(sec) % 60).padStart(2, '0')}`;
}

function showPreview(blob, name) {
  state.pickedBlob = blob;
  state.pickedName = name;
  $('#pickStep').hidden = true;
  $('#recordStep').hidden = true;
  $('#previewStep').hidden = false;

  const url = URL.createObjectURL(blob);
  const v = $('#preview');
  v.src = url;
  v.onloadeddata = () => URL.revokeObjectURL(url);
  $('#fileMeta').textContent = `${name} · ${formatSize(blob.size)}`;

  // Hajm cheklovi
  const maxBytes = state.config.maxVideoMb * 1024 * 1024;
  if (blob.size > maxBytes) {
    showAlert($('#sendErr'), `Video hajmi ${state.config.maxVideoMb} MB dan oshmasligi kerak (hozir ${formatSize(blob.size)})`);
    $('#confirmSend').disabled = true;
    return;
  }

  hideAlert($('#sendErr'));
  $('#confirmSend').disabled = false;

  // Davomiylik cheklovi — metama'lumot yuklangach tekshiriladi.
  // Brauzerda yozilgan webm ba'zan Infinity qaytaradi, u holda tekshirilmaydi
  // (yozib olishning o'zi taymer bilan cheklangan).
  const limit = state.config.maxVideoSeconds;
  v.onloadedmetadata = () => {
    const d = v.duration;
    if (Number.isFinite(d) && d > 0) {
      $('#fileMeta').textContent = `${name} · ${formatSize(blob.size)} · ${mmss(d)}`;
      if (d > limit + 1.5) {
        showAlert(
          $('#sendErr'),
          `Video ${limit} soniyadan uzun bo‘lmasligi kerak (hozir ${mmss(d)}). Qisqaroq video oling.`
        );
        $('#confirmSend').disabled = true;
      }
    }
  };
}

function bindUpload() {
  // 📹 Kamerada yozish — imkoni bo'lsa shu yerda yozadi,
  // bo'lmasa telefonning kamera ilovasini ochadi.
  $('#cameraBtn').addEventListener('click', startCamera);

  // 🖼️ Galereyadan tanlash — tayyor videoni tanlaydi
  $('#galleryBtn').addEventListener('click', () => $('#galleryInput').click());

  for (const id of ['#cameraInput', '#galleryInput']) {
    $(id).addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) showPreview(f, f.name || 'video.mp4');
    });
  }

  $('#recStart').addEventListener('click', () => {
    chunks = [];
    const types = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    recorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const type = recorder?.mimeType || mimeType || 'video/webm';
      const blob = new Blob(chunks, { type: type.split(';')[0] });
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      stopStream();
      if (blob.size) showPreview(blob, `yozuv-${state.today}.${ext}`);
    };
    recorder.start(1000);

    $('#recStart').hidden = true;
    $('#recStop').hidden = false;
    $('#recDot').hidden = false;

    const limit = state.config.maxVideoSeconds;
    let sec = 0;
    $('#recTimer').textContent = '00:00';
    timerId = setInterval(() => {
      sec++;
      $('#recTimer').textContent = mmss(sec);
      // Cheklovga yetganda o'zi to'xtaydi
      if (sec >= limit) $('#recStop').click();
    }, 1000);
  });

  $('#recStop').addEventListener('click', () => {
    $('#recStop').hidden = true;
    $('#recStart').hidden = false;
    $('#recDot').hidden = true;
    clearInterval(timerId);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  });

  $('#recCancel').addEventListener('click', () => {
    stopStream();
    $('#recStop').hidden = true;
    $('#recStart').hidden = false;
    $('#recDot').hidden = true;
    $('#recordStep').hidden = true;
    $('#pickStep').hidden = false;
    hideAlert($('#sendErr'));
  });

  $('#againBtn').addEventListener('click', resetSendModal);

  $('#confirmSend').addEventListener('click', sendVideo);
}

// ---------- Yuborish ----------

function sendVideo() {
  if (!state.pickedBlob) return;

  const fd = new FormData();
  fd.append('video', state.pickedBlob, state.pickedName);
  fd.append('note', $('#note').value || '');

  closeModal('sendModal');
  $('#uploadArea').hidden = true;
  $('#uploadProgress').hidden = false;
  $('#progressBar').style.width = '0%';
  $('#progressText').textContent = 'Yuborilmoqda… 0%';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/videos');
  xhr.withCredentials = true;

  xhr.upload.onprogress = (e) => {
    if (!e.lengthComputable) return;
    const pct = Math.round((e.loaded / e.total) * 100);
    $('#progressBar').style.width = pct + '%';
    $('#progressText').textContent = `Yuborilmoqda… ${pct}%`;
  };

  xhr.onload = async () => {
    $('#uploadArea').hidden = false;
    $('#uploadProgress').hidden = true;
    let data = {};
    try { data = JSON.parse(xhr.responseText); } catch { /* bo'sh javob */ }

    if (xhr.status >= 200 && xhr.status < 300) {
      showAlert($('#flash'), '✓ Video muvaffaqiyatli yuborildi. Admin ko‘rib chiqadi.', 'ok');
      setTimeout(() => hideAlert($('#flash')), 6000);
      state.pickedBlob = null;
      await loadCalendar(state.month);
    } else {
      showAlert($('#flash'), data.error || 'Yuborishda xatolik yuz berdi', 'error');
    }
  };

  xhr.onerror = () => {
    $('#uploadArea').hidden = false;
    $('#uploadProgress').hidden = true;
    showAlert($('#flash'), 'Tarmoq xatosi. Internetni tekshirib qayta urinib ko‘ring.', 'error');
  };

  xhr.send(fd);
}

init();
