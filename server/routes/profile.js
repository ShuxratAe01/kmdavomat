import express from 'express';
import multer from 'multer';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { nowIso } from '../util/date.js';

const router = express.Router();

// Profil rasmi kichik bo'ladi — brauzerda kesilib, kichraytirilib yuboriladi
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error('Faqat rasm yuborish mumkin (JPG, PNG yoki WEBP)'));
    }
    cb(null, true);
  },
});

/** F.I.SH. ni tekshiradi — ro'yxatdan o'tishdagi qoidalar bilan bir xil */
function checkContactName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (name.length < 5 || name.length > 100) {
    return { error: 'F.I.SH. ni to‘liq kiriting (kamida 5 ta belgi)' };
  }
  if (!/[a-zA-Zа-яА-ЯёЁʻʼ’'-]{2,}/.test(name)) {
    return { error: 'F.I.SH. da harflar bo‘lsin' };
  }
  return { value: name };
}

/** Telefon raqamini bir xil ko'rinishga keltiradi: +998XXXXXXXXX */
function checkPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) {
    return { error: 'Telefon raqamini to‘liq kiriting, masalan +998 90 123 45 67' };
  }
  return { value: digits.length === 9 ? `+998${digits}` : `+${digits}` };
}

/** Profil ma'lumotlari */
router.get('/profile', requireAuth, (req, res) => {
  const row = db
    .prepare(
      `SELECT u.username, u.full_name, u.contact_name, u.phone, u.created_at,
              s.number AS school_number, s.name AS school_name,
              (SELECT updated_at FROM user_photos p WHERE p.user_id = u.id) AS photo_updated_at
       FROM users u LEFT JOIN schools s ON s.id = u.school_id
       WHERE u.id = ?`
    )
    .get(req.user.id);

  res.json({
    username: row.username,
    school_number: row.school_number,
    school_name: row.school_name || row.full_name,
    contact_name: row.contact_name,
    phone: row.phone,
    photo_updated_at: row.photo_updated_at || null,
    joined_at: row.created_at,
  });
});

/** F.I.SH. va telefonni o'zgartirish */
router.patch('/profile', requireAuth, (req, res) => {
  const fields = [];
  const values = [];

  if (req.body?.contact_name !== undefined) {
    const r = checkContactName(req.body.contact_name);
    if (r.error) return res.status(400).json({ error: r.error });
    fields.push('contact_name = ?');
    values.push(r.value);
  }
  if (req.body?.phone !== undefined) {
    const r = checkPhone(req.body.phone);
    if (r.error) return res.status(400).json({ error: r.error });
    fields.push('phone = ?');
    values.push(r.value);
  }

  if (!fields.length) return res.status(400).json({ error: 'O‘zgartirish uchun maydon yo‘q' });

  values.push(req.user.id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

/** Profil rasmini yuklash */
router.post('/profile/photo', requireAuth, (req, res) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Rasm hajmi 5 MB dan oshmasin'
          : err.message || 'Yuklashda xatolik';
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: 'Rasm tanlanmadi' });

    const updatedAt = nowIso();
    db.prepare(
      `INSERT INTO user_photos (user_id, mime, size, data, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET mime = ?, size = ?, data = ?, updated_at = ?`
    ).run(
      req.user.id, req.file.mimetype, req.file.size, req.file.buffer, updatedAt,
      req.file.mimetype, req.file.size, req.file.buffer, updatedAt
    );

    res.status(201).json({ ok: true, photo_updated_at: updatedAt });
  });
});

/** Profil rasmini o'chirish */
router.delete('/profile/photo', requireAuth, (req, res) => {
  db.prepare('DELETE FROM user_photos WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

/** Rasmni ko'rsatish — egasi yoki admin ko'ra oladi */
router.get('/users/:id/photo', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (req.user.role !== 'admin' && id !== req.user.id) {
    return res.status(403).json({ error: 'Ruxsat yo‘q' });
  }
  const row = db.prepare('SELECT mime, data, updated_at FROM user_photos WHERE user_id = ?').get(id);
  if (!row) return res.status(404).end();

  const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
  res.setHeader('Content-Type', row.mime);
  res.setHeader('Content-Length', buf.length);
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  res.setHeader('ETag', `"${row.updated_at}"`);
  if (req.headers['if-none-match'] === `"${row.updated_at}"`) return res.status(304).end();
  res.end(buf);
});

export default router;
