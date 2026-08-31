import express from 'express';
import crypto from 'node:crypto';
import { db, generateInviteCode, schoolUsername, schoolName } from '../db.js';
import { requireAdmin, hashPassword, destroyAllSessions, checkPasswordStrength } from '../auth.js';
import { deleteVideoFile } from '../storage.js';
import { dayStr, isDay, isRestDay, normalizeMonth, nowIso } from '../util/date.js';
import { buildCalendar } from './videos.js';

const router = express.Router();
router.use(requireAdmin);

const USER_COLS = 'id, username, full_name, position, role, is_active, created_at';

/** Vaqtinchalik parol — o'qish oson, lekin taxmin qilib bo'lmaydi */
function generateTempPassword() {
  const abc = 'abcdefghijkmnpqrstuvwxyz';
  const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const num = '23456789';
  const all = abc + ABC + num;
  const pick = (s) => s[crypto.randomInt(s.length)];
  const chars = [pick(ABC), pick(abc), pick(num), pick(num)];
  while (chars.length < 12) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** GET /api/admin/overview?day=YYYY-MM-DD — kunlik davomat holati */
router.get('/overview', (req, res) => {
  const day = isDay(req.query.day) ? String(req.query.day) : dayStr();
  const month = day.slice(0, 7);

  // Barcha maktablar ko'rinadi — ro'yxatdan o'tmaganlari ham
  const rows = db
    .prepare(
      `SELECT s.id AS school_id, s.number, s.name, s.user_id,
              u.username, u.is_active,
              v.id AS video_id, v.created_at AS sent_at, v.status, v.size
       FROM schools s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN videos v ON v.user_id = s.user_id AND v.day = ?
                          AND v.id = (SELECT MAX(id) FROM videos WHERE user_id = s.user_id AND day = ?)
       ORDER BY s.number`
    )
    .all(day, day);

  const monthTotals = db
    .prepare(
      `SELECT user_id, COUNT(DISTINCT day) AS days FROM videos
       WHERE day LIKE ? GROUP BY user_id`
    )
    .all(`${month}-%`);
  const monthMap = new Map(monthTotals.map((r) => [r.user_id, r.days]));

  const schools = rows.map((r) => ({
    school_id: r.school_id,
    number: r.number,
    name: r.name,
    id: r.user_id,
    username: r.username,
    registered: Boolean(r.user_id),
    is_active: r.is_active === 1,
    sent: Boolean(r.video_id),
    video_id: r.video_id,
    sent_at: r.sent_at,
    status: r.status,
    size: r.size,
    month_days: monthMap.get(r.user_id) || 0,
  }));

  const active = schools.filter((s) => s.registered && s.is_active);
  // Dam olish kunida video yuborish shart emas — yubormaganlar "qarzdor" emas
  const rest = isRestDay(day);
  res.json({
    day,
    isRestDay: rest,
    schools,
    stats: {
      total: schools.length,
      registered: active.length,
      notRegistered: schools.filter((s) => !s.registered).length,
      sent: active.filter((s) => s.sent).length,
      missed: rest ? 0 : active.filter((s) => !s.sent).length,
      videosToday: db.prepare('SELECT COUNT(*) n FROM videos WHERE day = ?').get(day).n,
      videosTotal: db.prepare('SELECT COUNT(*) n FROM videos').get().n,
      storageBytes: db.prepare('SELECT COALESCE(SUM(size),0) s FROM videos').get().s,
    },
  });
});

// ---------------- To'garaklar ----------------

/** Barcha maktablarning to'garaklari */
router.get('/clubs', (req, res) => {
  const where = [];
  const params = [];

  if (req.query.school_id) {
    where.push('s.id = ?');
    params.push(Number(req.query.school_id));
  }
  if (req.query.q) {
    where.push('(c.name LIKE ? OR c.teacher LIKE ? OR s.name LIKE ?)');
    const like = `%${String(req.query.q).trim()}%`;
    params.push(like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const clubs = db
    .prepare(
      `SELECT c.id, c.name, c.teacher, c.students, c.schedule, c.created_at,
              s.number AS school_number, s.name AS school_name
       FROM clubs c
       JOIN users u ON u.id = c.user_id
       JOIN schools s ON s.id = u.school_id
       ${clause}
       ORDER BY s.number, c.name COLLATE NOCASE`
    )
    .all(...params);

  const all = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(c.students), 0) AS students,
              COUNT(DISTINCT u.school_id) AS schools
       FROM clubs c JOIN users u ON u.id = c.user_id`
    )
    .get();

  res.json({
    clubs,
    stats: {
      total: all.n,
      students: all.students,
      schools: all.schools,
      schoolsTotal: db.prepare('SELECT COUNT(*) n FROM schools').get().n,
    },
  });
});

// ---------------- Maktablar ----------------

/** Barcha maktablar: ro'yxat kodi, ro'yxatdan o'tgan-o'tmagani, video statistikasi */
router.get('/schools', (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || ''))
    ? String(req.query.month)
    : dayStr().slice(0, 7);

  const schools = db
    .prepare(
      `SELECT s.id, s.number, s.name, s.invite_code, s.registered_at, s.user_id,
              u.username, u.is_active, u.last_login_at, u.must_change_password,
              u.contact_name, u.phone,
              (SELECT COUNT(DISTINCT day) FROM videos v WHERE v.user_id = s.user_id AND v.day LIKE ?) AS month_days,
              (SELECT COUNT(*) FROM videos v WHERE v.user_id = s.user_id) AS video_count,
              (SELECT MAX(day) FROM videos v WHERE v.user_id = s.user_id) AS last_day
       FROM schools s LEFT JOIN users u ON u.id = s.user_id
       ORDER BY s.number`
    )
    .all(`${month}-%`);

  res.json({
    month,
    schools: schools.map((s) => ({
      ...s,
      registered: Boolean(s.user_id),
      is_active: s.is_active === null ? null : s.is_active === 1,
      must_change_password: s.must_change_password === 1,
    })),
    stats: {
      total: schools.length,
      registered: schools.filter((s) => s.user_id).length,
      waiting: schools.filter((s) => !s.user_id).length,
    },
  });
});

/** Maktab nomini o'zgartirish */
router.patch('/schools/:id', (req, res) => {
  const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(Number(req.params.id));
  if (!school) return res.status(404).json({ error: 'Maktab topilmadi' });

  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Maktab nomini kiriting' });

  db.prepare('UPDATE schools SET name = ? WHERE id = ?').run(name.slice(0, 120), school.id);
  // Hisob ochilgan bo'lsa uning ko'rinadigan nomini ham yangilaymiz
  if (school.user_id) {
    db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(name.slice(0, 120), school.user_id);
  }
  res.json({ ok: true });
});

/** Yangi maktab qo'shish */
router.post('/schools', (req, res) => {
  const number = Number(req.body?.number);
  if (!Number.isInteger(number) || number < 1 || number > 9999) {
    return res.status(400).json({ error: 'Maktab raqami 1–9999 oralig‘ida bo‘lsin' });
  }
  if (db.prepare('SELECT id FROM schools WHERE number = ?').get(number)) {
    return res.status(409).json({ error: `${number}-maktab allaqachon ro‘yxatda bor` });
  }
  const name = String(req.body?.name || '').trim() || schoolName(number);
  db.prepare('INSERT INTO schools (number, name, invite_code, created_at) VALUES (?, ?, ?, ?)')
    .run(number, name.slice(0, 120), generateInviteCode(), nowIso());
  res.status(201).json({ ok: true });
});

/** Ro'yxat kodini yangilash (eskisi tarqalib ketgan bo'lsa) */
router.post('/schools/:id/new-code', (req, res) => {
  const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(Number(req.params.id));
  if (!school) return res.status(404).json({ error: 'Maktab topilmadi' });

  const code = generateInviteCode();
  db.prepare('UPDATE schools SET invite_code = ? WHERE id = ?').run(code, school.id);
  res.json({ ok: true, invite_code: code });
});

/**
 * Maktab parolini unutgan bo'lsa — vaqtinchalik parol beriladi.
 * Maktab shu parol bilan kirib, darhol o'z parolini qo'yadi. Videolari saqlanib qoladi.
 */
router.post('/schools/:id/reset-password', (req, res) => {
  const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(Number(req.params.id));
  if (!school) return res.status(404).json({ error: 'Maktab topilmadi' });
  if (!school.user_id) return res.status(400).json({ error: 'Bu maktab hali ro‘yxatdan o‘tmagan' });

  const temp = generateTempPassword();
  db.prepare(
    `UPDATE users SET password_hash = ?, must_change_password = 1, password_changed_at = ?
     WHERE id = ?`
  ).run(hashPassword(temp), nowIso(), school.user_id);
  destroyAllSessions(school.user_id);

  res.json({ ok: true, username: schoolUsername(school.number), password: temp });
});

/**
 * Hisobni butunlay o'chirish — maktab qaytadan ro'yxatdan o'ta oladi.
 * DIQQAT: barcha videolari ham o'chadi.
 */
router.delete('/schools/:id/account', (req, res) => {
  const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(Number(req.params.id));
  if (!school) return res.status(404).json({ error: 'Maktab topilmadi' });
  if (!school.user_id) return res.status(400).json({ error: 'Bu maktab hali ro‘yxatdan o‘tmagan' });

  for (const v of db.prepare('SELECT id, storage, path FROM videos WHERE user_id = ?').all(school.user_id)) {
    deleteVideoFile(v);
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(school.user_id);
  db.prepare("UPDATE schools SET user_id = NULL, registered_at = '', invite_code = ? WHERE id = ?")
    .run(generateInviteCode(), school.id);

  res.json({ ok: true });
});

/** Maktabni ro'yxatdan butunlay olib tashlash */
router.delete('/schools/:id', (req, res) => {
  const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(Number(req.params.id));
  if (!school) return res.status(404).json({ error: 'Maktab topilmadi' });
  if (school.user_id) {
    return res.status(400).json({ error: 'Avval maktab hisobini o‘chiring' });
  }
  db.prepare('DELETE FROM schools WHERE id = ?').run(school.id);
  res.json({ ok: true });
});

// ---------------- Foydalanuvchilar ----------------

router.get('/users', (_req, res) => {
  const users = db
    .prepare(
      `SELECT ${USER_COLS},
              (SELECT COUNT(*) FROM videos v WHERE v.user_id = users.id) AS video_count,
              (SELECT MAX(day) FROM videos v WHERE v.user_id = users.id) AS last_day
       FROM users ORDER BY role DESC, full_name COLLATE NOCASE, username`
    )
    .all();
  res.json({ users });
});

router.post('/users', (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const fullName = String(req.body?.full_name || '').trim();
  const position = String(req.body?.position || '').trim();
  const role = req.body?.role === 'admin' ? 'admin' : 'user';

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return res
      .status(400)
      .json({ error: 'Login 3–32 ta lotin harf/raqamdan iborat bo‘lsin (. _ - belgilariga ruxsat)' });
  }
  const weak = checkPasswordStrength(password, username);
  if (weak) return res.status(400).json({ error: weak });

  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'Bunday login allaqachon mavjud' });
  }

  // must_change_password = 1: xodim birinchi kirganda o'z parolini qo'yadi,
  // shunda admin ham uning parolini bilmay qoladi.
  const info = db
    .prepare(
      `INSERT INTO users (username, password_hash, full_name, position, role, is_active,
                          must_change_password, password_changed_at, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)`
    )
    .run(username, hashPassword(password), fullName || username, position, role, nowIso(), nowIso());

  res.status(201).json({
    ok: true,
    user: db.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).get(info.lastInsertRowid),
  });
});

router.patch('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

  const fields = [];
  const values = [];

  if (typeof req.body?.full_name === 'string') {
    fields.push('full_name = ?');
    values.push(req.body.full_name.trim());
  }
  if (typeof req.body?.position === 'string') {
    fields.push('position = ?');
    values.push(req.body.position.trim());
  }
  if (typeof req.body?.is_active === 'boolean') {
    if (user.id === req.user.id && !req.body.is_active) {
      return res.status(400).json({ error: 'O‘zingizni bloklay olmaysiz' });
    }
    fields.push('is_active = ?');
    values.push(req.body.is_active ? 1 : 0);
  }
  if (req.body?.role === 'admin' || req.body?.role === 'user') {
    if (user.id === req.user.id && req.body.role !== 'admin') {
      return res.status(400).json({ error: 'O‘zingizdan admin huquqini olib tashlay olmaysiz' });
    }
    fields.push('role = ?');
    values.push(req.body.role);
  }
  if (typeof req.body?.password === 'string' && req.body.password) {
    const weak = checkPasswordStrength(req.body.password, user.username);
    if (weak) return res.status(400).json({ error: weak });
    fields.push('password_hash = ?');
    values.push(hashPassword(req.body.password));
    fields.push('password_changed_at = ?');
    values.push(nowIso());
    // Admin tiklagan parol vaqtinchalik — egasi kirganda o'zini qo'yadi
    fields.push('must_change_password = ?');
    values.push(1);
  }

  if (!fields.length) return res.status(400).json({ error: 'O‘zgartirish uchun maydon yo‘q' });

  values.push(id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  // Parol o'zgarsa yoki bloklansa — barcha sessiyalari uziladi
  if (req.body?.password || req.body?.is_active === false) destroyAllSessions(id);

  res.json({ ok: true, user: db.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).get(id) });
});

router.delete('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'O‘zingizni o‘chira olmaysiz' });
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

  for (const v of db.prepare('SELECT id, storage, path FROM videos WHERE user_id = ?').all(id)) {
    deleteVideoFile(v);
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

/** Bitta xodimning oylik kalendari */
router.get('/users/:id/calendar', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).get(id);
  if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  res.json({ user, ...buildCalendar(id, normalizeMonth(req.query.month)) });
});

// ---------------- Videolar ----------------

router.get('/videos', (req, res) => {
  const where = [];
  const params = [];

  if (req.query.user_id) {
    where.push('v.user_id = ?');
    params.push(Number(req.query.user_id));
  }
  if (isDay(req.query.from)) {
    where.push('v.day >= ?');
    params.push(String(req.query.from));
  }
  if (isDay(req.query.to)) {
    where.push('v.day <= ?');
    params.push(String(req.query.to));
  }
  if (['new', 'accepted', 'rejected'].includes(req.query.status)) {
    where.push('v.status = ?');
    params.push(String(req.query.status));
  }
  if (req.query.q) {
    where.push('(u.full_name LIKE ? OR u.username LIKE ?)');
    const like = `%${String(req.query.q).trim()}%`;
    params.push(like, like);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const total = db
    .prepare(`SELECT COUNT(*) n FROM videos v JOIN users u ON u.id = v.user_id ${clause}`)
    .get(...params).n;

  const videos = db
    .prepare(
      `SELECT v.id, v.user_id, v.day, v.filename, v.mime, v.size, v.note, v.status, v.created_at,
              u.username, u.full_name, u.position
       FROM videos v JOIN users u ON u.id = v.user_id
       ${clause}
       ORDER BY v.day DESC, v.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, (page - 1) * limit);

  res.json({ videos, total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) });
});

router.patch('/videos/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT id FROM videos WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Video topilmadi' });

  if (['new', 'accepted', 'rejected'].includes(req.body?.status)) {
    db.prepare('UPDATE videos SET status = ? WHERE id = ?').run(req.body.status, id);
  }
  if (typeof req.body?.note === 'string') {
    db.prepare('UPDATE videos SET note = ? WHERE id = ?').run(req.body.note.slice(0, 500), id);
  }
  res.json({ ok: true });
});

router.delete('/videos/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT id, storage, path FROM videos WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Video topilmadi' });
  deleteVideoFile(row);
  db.prepare('DELETE FROM videos WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
