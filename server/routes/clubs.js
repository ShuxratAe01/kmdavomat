import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { nowIso } from '../util/date.js';

const router = express.Router();

const COLS = 'id, name, teacher, students, schedule, created_at, updated_at';

/** Kiritilgan ma'lumotni tekshiradi va tozalaydi */
function checkClub(body) {
  const name = String(body?.name || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 100) {
    return { error: 'To‘garak nomi 2–100 ta belgidan iborat bo‘lsin' };
  }

  const teacher = String(body?.teacher || '').trim().replace(/\s+/g, ' ');
  if (teacher.length > 100) return { error: 'Rahbar ismi juda uzun' };

  const schedule = String(body?.schedule || '').trim().replace(/\s+/g, ' ');
  if (schedule.length > 120) return { error: 'Mashg‘ulot vaqti juda uzun' };

  const students = Number(body?.students ?? 0);
  if (!Number.isInteger(students) || students < 0 || students > 10000) {
    return { error: 'O‘quvchilar soni 0–10000 oralig‘ida bo‘lsin' };
  }

  return { value: { name, teacher, students, schedule } };
}

/** Maktabning o'z to'garaklari */
router.get('/clubs', requireAuth, (req, res) => {
  const clubs = db
    .prepare(`SELECT ${COLS} FROM clubs WHERE user_id = ? ORDER BY name COLLATE NOCASE`)
    .all(req.user.id);
  res.json({
    clubs,
    stats: {
      count: clubs.length,
      students: clubs.reduce((s, c) => s + c.students, 0),
    },
  });
});

/** Yangi to'garak */
router.post('/clubs', requireAuth, (req, res) => {
  const r = checkClub(req.body);
  if (r.error) return res.status(400).json({ error: r.error });

  const exists = db
    .prepare('SELECT id FROM clubs WHERE user_id = ? AND name = ? COLLATE NOCASE')
    .get(req.user.id, r.value.name);
  if (exists) return res.status(409).json({ error: 'Bunday nomli to‘garak allaqachon bor' });

  const info = db
    .prepare(
      `INSERT INTO clubs (user_id, name, teacher, students, schedule, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, r.value.name, r.value.teacher, r.value.students, r.value.schedule, nowIso(), nowIso());

  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

/** Tahrirlash */
router.patch('/clubs/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const club = db.prepare('SELECT id FROM clubs WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!club) return res.status(404).json({ error: 'To‘garak topilmadi' });

  const r = checkClub(req.body);
  if (r.error) return res.status(400).json({ error: r.error });

  const clash = db
    .prepare('SELECT id FROM clubs WHERE user_id = ? AND name = ? COLLATE NOCASE AND id <> ?')
    .get(req.user.id, r.value.name, id);
  if (clash) return res.status(409).json({ error: 'Bunday nomli to‘garak allaqachon bor' });

  db.prepare(
    'UPDATE clubs SET name = ?, teacher = ?, students = ?, schedule = ?, updated_at = ? WHERE id = ?'
  ).run(r.value.name, r.value.teacher, r.value.students, r.value.schedule, nowIso(), id);

  res.json({ ok: true });
});

/** O'chirish */
router.delete('/clubs/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const club = db.prepare('SELECT id FROM clubs WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!club) return res.status(404).json({ error: 'To‘garak topilmadi' });

  db.prepare('DELETE FROM clubs WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
