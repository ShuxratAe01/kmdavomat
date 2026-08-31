import express from 'express';
import multer from 'multer';
import { db } from '../db.js';
import { config, maxVideoBytes } from '../config.js';
import { requireAuth } from '../auth.js';
import { saveVideo, readVideo, deleteVideoFile, extensionFor } from '../storage.js';
import { dayStr, normalizeMonth, monthDays, firstWeekdayMondayBased, isRestDay, holidayName, nowIso } from '../util/date.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxVideoBytes, files: 1 },
  fileFilter(_req, file, cb) {
    if (!/^video\//i.test(file.mimetype)) {
      return cb(new Error('Faqat video fayl yuborish mumkin'));
    }
    cb(null, true);
  },
});

const OY_NOMLARI = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return `${OY_NOMLARI[m - 1]} ${y}`;
}

/** Bitta foydalanuvchining oylik kalendari */
export function buildCalendar(userId, month) {
  const today = dayStr();
  const rows = db
    .prepare(
      `SELECT day, COUNT(*) AS cnt, MAX(created_at) AS last_at
       FROM videos WHERE user_id = ? AND day LIKE ?
       GROUP BY day`
    )
    .all(userId, `${month}-%`);

  const byDay = new Map(rows.map((r) => [r.day, r]));

  const days = monthDays(month).map((date) => {
    const hit = byDay.get(date);
    const isFuture = date > today;
    const rest = isRestDay(date);
    return {
      date,
      dayNum: Number(date.slice(8)),
      hasVideo: Boolean(hit),
      count: hit ? hit.cnt : 0,
      lastAt: hit ? hit.last_at : null,
      isToday: date === today,
      isFuture,
      isRest: rest,
      holiday: holidayName(date),
      // 'sent' = yashil, 'rest' = dam olish kuni, 'missed' = qizil, 'upcoming' = kulrang.
      // Dam olish kunida video yuborish shart emas — "yuborilmagan" deb sanalmaydi.
      state: hit ? 'sent' : rest ? 'rest' : isFuture ? 'upcoming' : 'missed',
    };
  });

  return {
    month,
    monthLabel: monthLabel(month),
    firstWeekday: firstWeekdayMondayBased(month),
    today,
    todayIsRest: isRestDay(today),
    todayHoliday: holidayName(today),
    days,
    stats: {
      sent: days.filter((d) => d.state === 'sent').length,
      missed: days.filter((d) => d.state === 'missed').length,
      rest: days.filter((d) => d.state === 'rest').length,
      upcoming: days.filter((d) => d.state === 'upcoming').length,
      total: days.length,
    },
  };
}

/** GET /api/calendar?month=YYYY-MM */
router.get('/calendar', requireAuth, (req, res) => {
  const month = normalizeMonth(req.query.month);
  const calendar = buildCalendar(req.user.id, month);
  const todayRow = db
    .prepare(
      `SELECT id, created_at, status, size FROM videos
       WHERE user_id = ? AND day = ? ORDER BY id DESC LIMIT 1`
    )
    .get(req.user.id, calendar.today);
  res.json({ ...calendar, todayVideo: todayRow || null });
});

/** GET /api/videos?month=YYYY-MM — o'z videolari ro'yxati */
router.get('/videos', requireAuth, (req, res) => {
  const month = normalizeMonth(req.query.month);
  const rows = db
    .prepare(
      `SELECT id, day, filename, mime, size, note, status, created_at
       FROM videos WHERE user_id = ? AND day LIKE ?
       ORDER BY day DESC, id DESC`
    )
    .all(req.user.id, `${month}-%`);
  res.json({ month, videos: rows });
});

/** POST /api/videos — video yuborish */
router.post('/videos', requireAuth, (req, res) => {
  upload.single('video')(req, res, (err) => {
    if (err) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? `Video hajmi ${config.maxVideoMb} MB dan oshmasin`
          : err.message || 'Yuklashda xatolik';
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: 'Video tanlanmadi' });

    const day = dayStr();

    if (!config.allowMultiplePerDay) {
      const exists = db
        .prepare('SELECT id FROM videos WHERE user_id = ? AND day = ? LIMIT 1')
        .get(req.user.id, day);
      if (exists) {
        return res
          .status(409)
          .json({ error: 'Bugun uchun video allaqachon yuborilgan', videoId: exists.id });
      }
    }

    const mime = req.file.mimetype || 'video/mp4';
    const originalName = req.file.originalname || `video${extensionFor(mime)}`;
    const stored = saveVideo({
      buffer: req.file.buffer,
      mime,
      originalName,
      userId: req.user.id,
      day,
    });

    const info = db
      .prepare(
        `INSERT INTO videos (user_id, day, filename, mime, size, storage, data, path, note, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`
      )
      .run(
        req.user.id,
        day,
        originalName.slice(0, 200),
        mime,
        req.file.size,
        stored.storage,
        stored.data,
        stored.path,
        String(req.body?.note || '').slice(0, 500),
        nowIso()
      );

    res.status(201).json({ ok: true, id: Number(info.lastInsertRowid), day });
  });
});

/** Video oqimi — egasi yoki admin ko'ra oladi. Range (seek) qo'llab-quvvatlanadi. */
function serveVideo(req, res, { download = false } = {}) {
  const row = db.prepare('SELECT * FROM videos WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Video topilmadi' });
  if (req.user.role !== 'admin' && row.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Ruxsat yo‘q' });
  }

  const buf = readVideo(row);
  if (!buf) return res.status(410).json({ error: 'Video fayli mavjud emas' });

  const total = buf.length;
  res.setHeader('Content-Type', row.mime || 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  if (download) {
    res.setHeader('Content-Disposition', `attachment; filename="video-${row.id}${extensionFor(row.mime, row.filename)}"`);
  }

  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? Number(m[1]) : 0;
    let end = m && m[2] ? Number(m[2]) : total - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
      res.setHeader('Content-Range', `bytes */${total}`);
      return res.status(416).end();
    }
    end = Math.min(end, total - 1);
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', end - start + 1);
    return res.end(buf.subarray(start, end + 1));
  }

  res.setHeader('Content-Length', total);
  res.end(buf);
}

router.get('/videos/:id/stream', requireAuth, (req, res) => serveVideo(req, res));
router.get('/videos/:id/download', requireAuth, (req, res) => serveVideo(req, res, { download: true }));

/**
 * DELETE /api/videos/:id — o'z videosini o'chirish.
 * Xato video yuborilgan bo'lsa, uni o'chirib qaytadan yuborish uchun.
 * Faqat egasi o'chira oladi; o'sha kun kalendarda yana qizil bo'lib qoladi.
 */
router.delete('/videos/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM videos WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Video topilmadi' });
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Ruxsat yo‘q' });

  deleteVideoFile(row);
  db.prepare('DELETE FROM videos WHERE id = ?').run(row.id);
  res.json({ ok: true, day: row.day });
});

export default router;
