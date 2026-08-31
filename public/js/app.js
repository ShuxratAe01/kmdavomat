/* ===== Foydalanuvchi sahifasi ===== */

/**
 * Brauzer ichida yumaloq (kvadrat) video yozib olish mumkinmi?
 * getUserMedia xavfsizlik talabi bo'yicha faqat localhost yoki HTTPS da ishlaydi.
 * Iloji bo'lmasa qurilmaning o'z kamera ilovasiga o'tamiz — u HTTP da ham ishlaydi.
 */
const CAN_RECORD_ROUND =
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof MediaRecorder !== 'undefined' &&
  window.isSecureContext;

let state = {
  user: null,
  profile: null,
  month: null,
  today: null,
  calendar: null,
  config: {
    maxVideoMb: 60,
    maxVideoSeconds: 30,
    cameraFacing: 'user',
    videoSize: 640,
    videoBitrateKbps: 1200,
    audioBitrateKbps: 64,
    videoFps: 30,
    allowMultiplePerDay: false,
  },
  pickedBlob: null,
  pickedName: '',
};

// ---------- Yuklash ----------

async function init() {
  try {
    const [me, cfg] = await Promise.all([api('/api/auth/me'), api('/api/config')]);
    state.user = me.user;
    // Butunlay almashtirmaymiz: serverda yo'q sozlama standart qiymatida qolsin,
    // aks holda undefined qiymatlar kamera va yozuvchini buzadi.
    state.config = { ...state.config, ...cfg };
  } catch {
    return;
  }

  $('#whoName').textContent = state.user.full_name || state.user.username;
  $('#maxSize').textContent = state.config.maxVideoMb;
  $$('.max-secs').forEach((el) => (el.textContent = state.config.maxVideoSeconds));
  $('#recLimit').textContent = mmss(state.config.maxVideoSeconds);
  // Telefonda qaysi kamera ochilishini belgilaydi (user = selfi, environment = orqadagi)
  $('#cameraInput').setAttribute('capture', state.config.cameraFacing);
  $('#cameraHint').textContent = CAN_RECORD_ROUND ? 'Yumaloq video yozasiz' : 'Kamera ilovasi ochiladi';

  await loadProfile();
  await loadCalendar();
  bindEvents();
  bindProfile();
  startWeather();
}

// ---------- Ob-havo ----------

/** Har necha daqiqada yangilanib turadi */
async function loadWeather() {
  try {
    const w = await api('/api/weather');
    const box = $('#weather');
    if (!w.enabled || !w.ok) {
      box.hidden = true;
      return;
    }
    $('#weatherIco').innerHTML = weatherIconSvg(w.icon, 40);
    $('#weatherTemp').textContent = `${w.temp}°`;
    $('#weatherDesc').textContent = w.city ? `${w.text} · ${w.city}` : w.text;
    box.hidden = false;
  } catch {
    $('#weather').hidden = true;
  }
}

function startWeather() {
  loadWeather();
  // Har 10 daqiqada yangilaymiz
  setInterval(loadWeather, 10 * 60 * 1000);
  // Sahifaga qaytilganda ham — telefonni cho'ntakdan olganda eski raqam turmasin
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadWeather();
  });
}

// ---------- Profil ----------

const PHOTO_SIZE = 512; // saqlanadigan rasm tomoni (piksel)

/** Telefon raqamini o'qishga qulay ko'rinishga keltiradi */
function prettyPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('998')) {
    return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  }
  return phone || '—';
}

async function loadProfile() {
  try {
    const p = await api('/api/profile');
    state.profile = p;

    $('#profileName').textContent = p.contact_name || p.school_name || p.username;
    $('#profileSchool').textContent = p.school_name || '';

    const phoneLink = $('#profilePhone');
    phoneLink.textContent = prettyPhone(p.phone);
    phoneLink.href = p.phone ? `tel:${p.phone}` : '#';

    showPhoto(p.photo_updated_at);
  } catch (e) {
    showAlert($('#flash'), e.message, 'error');
  }
}

/** Rasmni ko'rsatadi; yangilanish vaqti keshni yangilash uchun ishlatiladi */
function showPhoto(updatedAt) {
  const img = $('#photoImg');
  const empty = $('#photoEmpty');
  if (!updatedAt) {
    img.hidden = true;
    empty.hidden = false;
    return;
  }
  img.src = `/api/users/${state.user.id}/photo?v=${encodeURIComponent(updatedAt)}`;
  img.hidden = false;
  empty.hidden = true;
}

/**
 * Tanlangan rasmni brauzerning o'zida kvadrat qilib qirqadi va kichraytiradi.
 * Shunda 5 MB lik surat ham ~60 KB bo'lib yuboriladi.
 */
function squarePhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Faylni o‘qib bo‘lmadi'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Bu fayl rasm emas'));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = PHOTO_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          img,
          (img.width - side) / 2, (img.height - side) / 2, side, side,
          0, 0, PHOTO_SIZE, PHOTO_SIZE
        );
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Rasmni tayyorlab bo‘lmadi'))),
          'image/jpeg',
          0.85
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function bindProfile() {
  // Ikkalasi ham Sozlamalar oynasida — bosilganda o'sha oyna yopiladi,
  // aks holda natija (rasm yoki tahrirlash oynasi) ortida qolib ketadi.
  $('#photoBtn').addEventListener('click', () => {
    closeModal('menuModal');
    $('#photoInput').click();
  });

  $('#photoInput').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const btn = $('#photoBtn');
    btn.disabled = true;
    try {
      const blob = await squarePhoto(file);
      const fd = new FormData();
      fd.append('photo', blob, 'photo.jpg');
      const res = await fetch('/api/profile/photo', {
        method: 'POST',
        credentials: 'same-origin',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Rasmni yuklab bo‘lmadi');

      showPhoto(data.photo_updated_at);
      showAlert($('#flash'), '✓ Rasm yangilandi', 'ok');
      setTimeout(() => hideAlert($('#flash')), 4000);
    } catch (err) {
      showAlert($('#flash'), err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  $('#profileEditBtn').addEventListener('click', () => {
    closeModal('menuModal');
    hideAlert($('#pfErr'));
    $('#pfName').value = state.profile?.contact_name || '';
    $('#pfPhone').value = prettyPhone(state.profile?.phone) === '—' ? '' : prettyPhone(state.profile?.phone);
    openModal('profileModal');
  });

  $('#pfPhone').addEventListener('focus', (e) => {
    if (!e.target.value) e.target.value = '+998 ';
  });
  $('#pfPhone').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^\d+ ]/g, '');
  });

  $('#profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert($('#pfErr'));
    try {
      await api('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          contact_name: $('#pfName').value,
          phone: $('#pfPhone').value,
        }),
      });
      closeModal('profileModal');
      await loadProfile();
      showAlert($('#flash'), '✓ Ma‘lumotlar saqlandi', 'ok');
      setTimeout(() => hideAlert($('#flash')), 4000);
    } catch (err) {
      showAlert($('#pfErr'), err.message);
    }
  });
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

/**
 * Bugungi holat belgisi — uch burchak.
 * yuborilmagan -> qizil (ichida undov), yuborilgan -> yashil (ichida belgi),
 * dam olish kuni -> kulrang.
 */
function statusTriangle(state) {
  const color = { sent: '#22c55e', missed: '#f43f5e', rest: '#cbd5e1' }[state] || '#f43f5e';
  const inner =
    state === 'sent'
      ? '<path d="M8.7 14.4l2.2 2.2 4.4-4.6" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>'
      : state === 'rest'
        ? '<circle cx="12" cy="15.6" r="1.35" fill="#fff"/>'
        : '<rect x="11" y="9.4" width="2" height="6" rx="1" fill="#fff"/>' +
          '<circle cx="12" cy="17.6" r="1.25" fill="#fff"/>';

  return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M12 3.4c.72 0 1.38.38 1.74 1l8.06 13.96c.73 1.27-.18 2.85-1.65 2.85H3.85c-1.47 0-2.38-1.58-1.65-2.85L10.26 4.4c.36-.62 1.02-1 1.74-1z"
          fill="${color}" />
    ${inner}
  </svg>`;
}

function render() {
  const c = state.calendar;

  // Bugungi sana bloki
  $('#todayDate').textContent = formatDay(c.today);
  $('#todayWeekday').textContent = weekdayName(c.today);

  const sentToday = Boolean(c.todayVideo);
  const st = $('#todayStatus');
  st.classList.toggle('done', sentToday);

  if (sentToday) {
    $('#statusIco').innerHTML = statusTriangle('sent');
    $('#statusText').textContent = `Bugungi video yuborilgan — ${formatTime(c.todayVideo.created_at)}`;
  } else if (c.todayIsRest) {
    $('#statusIco').innerHTML = statusTriangle('rest');
    $('#statusText').textContent = 'Bugun dam olish kuni — video yuborish shart emas';
  } else {
    $('#statusIco').innerHTML = statusTriangle('missed');
    $('#statusText').textContent = 'Bugun uchun video yuborilmagan';
  }

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
        {
          sent: 'video yuborilgan',
          rest: 'dam olish kuni, video shart emas',
          upcoming: 'kelgusi kun',
          missed: 'video yuborilmagan',
        }[d.state]
      }">${d.dayNum}${d.hasVideo ? '<span class="dot"></span>' : ''}</div>`
    );
  }
  $('#calendar').innerHTML = cells.join('');

  // Statistika
  // Dam olish kunlari hisobga kirmaydi — bajarilish faqat ish kunlari bo'yicha
  const done = c.stats.sent;
  const expected = c.stats.sent + c.stats.missed;
  $('#stSent').textContent = done;
  $('#stMissed').textContent = c.stats.missed;
  $('#stRest').textContent = c.stats.rest ?? 0;
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
  $('#dayBody').innerHTML =
    roundVideoHtml(`/api/videos/${id}/stream`) +
    `<div class="modal-foot" style="justify-content:center">
       <a class="btn ghost" href="/api/videos/${id}/download">⬇ Yuklab olish</a>
     </div>`;
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

  // Belgining o'zi ham, yonidagi "Sozlamalar" yozuvi ham ochadi
  $('#menuBtn').addEventListener('click', () => openModal('menuModal'));
  $('#whoRole').addEventListener('click', () => openModal('menuModal'));

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
  const prev = $('#preview');
  prev.pause();
  prev.closest('.round-video')?.classList.remove('playing');
  stopStream();
}

let mediaStream = null;   // kameradan kelayotgan oqim
let squareStream = null;  // kvadrat qilib qirqilgan oqim (shu yoziladi)
let drawFrame = null;     // kadr chizish siklini to'xtatish uchun
let recorder = null;
let chunks = [];
let timerId = null;

/**
 * Kameradan kelayotgan tasvirning o'rtasidan kvadrat qirqib,
 * doimiy ravishda canvasga chizadi. Telegram'dagi yumaloq video
 * aslida ana shunday kvadrat video — doira faqat ko'rinishda.
 */
function makeSquareStream(video, audioTrack) {
  if (typeof document.createElement('canvas').captureStream !== 'function') return null;

  const size = state.config.videoSize;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d', { alpha: false });
  // Kamera tasviri kattaroq bo'lgani uchun kichraytirganda sifat muhim
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const draw = () => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw && vh) {
      const side = Math.min(vw, vh);
      ctx.drawImage(
        video,
        (vw - side) / 2, (vh - side) / 2, side, side, // manbadan o'rtadagi kvadrat
        0, 0, size, size
      );
    }
    drawFrame = requestAnimationFrame(draw);
  };
  draw();

  const stream = canvas.captureStream(state.config.videoFps);
  if (audioTrack) stream.addTrack(audioTrack);
  return stream;
}

function stopStream() {
  if (recorder && recorder.state !== 'inactive') {
    try { recorder.stop(); } catch { /* allaqachon to'xtagan */ }
  }
  recorder = null;

  if (drawFrame) {
    cancelAnimationFrame(drawFrame);
    drawFrame = null;
  }
  if (squareStream) {
    squareStream.getVideoTracks().forEach((t) => t.stop());
    squareStream = null;
  }
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

  // Brauzer ichida yozib bo'lmasa (HTTPS yo'q, eski brauzer) — tizim kamerasiga o'tamiz
  if (!CAN_RECORD_ROUND) return $('#cameraInput').click();

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      // Kvadrat so'raymiz. Kerakligidan kattaroq olamiz — kichraytirilganda
      // tasvir tiniqroq chiqadi.
      video: {
        facingMode: state.config.cameraFacing,
        width: { ideal: state.config.videoSize * 1.5 },
        height: { ideal: state.config.videoSize * 1.5 },
        aspectRatio: { ideal: 1 },
        frameRate: { ideal: state.config.videoFps },
      },
      // Nutq uchun: aks-sado va shovqin tozalanadi, ovoz tenglashtiriladi
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1, // mono — nutqqa yetarli, fayl kichikroq
      },
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
  // Orqa kamerada ko'zgu aksi kerak emas
  v.classList.toggle('back-camera', state.config.cameraFacing === 'environment');
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

    // Kvadrat qilib qirqilgan oqimni yozamiz; imkoni bo'lmasa asl oqimni
    if (!squareStream) {
      squareStream = makeSquareStream($('#recPreview'), mediaStream.getAudioTracks()[0]);
    }
    const source = squareStream || mediaStream;

    // Kodek tanlash: mp4/H.264 hamma joyda ochiladi, VP9 esa yaxshi siqadi.
    // Ikkalasi ham bo'lmasa VP8 ga tushamiz.
    const types = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';

    // Oqim tezligini o'zimiz belgilaymiz — brauzerning standarti (~2.5 Mbit/s)
    // bunday kichik kvadrat uchun ortiqcha, fayl bekorga kattalashadi.
    recorder = new MediaRecorder(source, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: state.config.videoBitrateKbps * 1000,
      audioBitsPerSecond: state.config.audioBitrateKbps * 1000,
    });
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
