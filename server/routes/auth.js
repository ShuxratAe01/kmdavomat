import express from 'express';
import crypto from 'node:crypto';
import { db, schoolUsername } from '../db.js';
import { config } from '../config.js';
import {
  COOKIE_NAME,
  checkPasswordStrength,
  clearFailedAttempts,
  clearSessionCookie,
  clientIp,
  createSession,
  destroyAllSessions,
  destroySession,
  findUserByUsername,
  hashPassword,
  lockedSeconds,
  registerFailedAttempt,
  setSessionCookie,
  verifyPassword,
  wastePasswordTime,
} from '../auth.js';
import { nowIso } from '../util/date.js';

const router = express.Router();

/** "3 daqiqa 20 soniya" ko'rinishida */
function humanTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m && s) return `${m} daqiqa ${s} soniya`;
  if (m) return `${m} daqiqa`;
  return `${s} soniya`;
}

router.post('/login', (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const ip = clientIp(req);

  if (!username || !password) {
    return res.status(400).json({ error: 'Login va parolni kiriting' });
  }

  // Ikki xil hisoblagich: shu login uchun va shu IP uchun.
  // Birinchisi bitta akkauntni terishdan, ikkinchisi ko'p akkauntni sinashdan saqlaydi.
  const userKey = `u:${username}`;
  const ipKey = `ip:${ip}`;

  const lockedUser = lockedSeconds(userKey);
  const lockedIp = lockedSeconds(ipKey);
  const locked = Math.max(lockedUser, lockedIp);
  if (locked > 0) {
    return res.status(429).json({
      error: `Juda ko‘p xato urinish. ${humanTime(locked)} dan keyin qayta urinib ko‘ring.`,
      retryAfter: locked,
    });
  }

  const user = findUserByUsername(username);

  // Login yoki parol xato — qaysi biri ekanini AYTMAYMIZ.
  // Aks holda mavjud loginlarni bittalab topib olish mumkin bo'ladi.
  const wrongCredentials = () => {
    registerFailedAttempt(ipKey);
    const wait = registerFailedAttempt(userKey);
    if (wait > 0) {
      return res.status(429).json({
        error: `Juda ko‘p xato urinish. ${humanTime(wait)} dan keyin qayta urinib ko‘ring.`,
        retryAfter: wait,
      });
    }
    return res.status(401).json({ error: 'Login yoki parol noto‘g‘ri' });
  };

  if (!user) {
    wastePasswordTime(password); // javob vaqti bir xil bo'lishi uchun
    return wrongCredentials();
  }
  if (!verifyPassword(password, user.password_hash)) {
    return wrongCredentials();
  }
  if (user.is_active !== 1) {
    return res.status(403).json({ error: 'Akkauntingiz bloklangan. Admin bilan bog‘laning.' });
  }

  // Muvaffaqiyatli kirish — hisoblagichlar tozalanadi
  clearFailedAttempts(userKey);
  clearFailedAttempts(ipKey);

  const { token, expires } = createSession(user.id, { ip, userAgent: req.get('user-agent') || '' });
  setSessionCookie(res, token, expires);
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso(), user.id);

  const mustChange = user.must_change_password === 1;
  res.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      position: user.position,
      role: user.role,
      must_change_password: mustChange,
    },
    redirect: mustChange ? '/parol' : user.role === 'admin' ? '/admin' : '/',
  });
});

/**
 * Maktablar ro'yxati — kirish va ro'yxatdan o'tish sahifalari uchun.
 * Ro'yxat kodlari bu yerda YUBORILMAYDI, faqat nomlar.
 */
router.get('/schools', (_req, res) => {
  const rows = db
    .prepare('SELECT id, number, name, user_id FROM schools ORDER BY number')
    .all();

  const schools = rows.map((s) => ({
    id: s.id,
    number: s.number,
    name: s.name,
    login: schoolUsername(s.number),
    registered: Boolean(s.user_id),
  }));

  res.json({
    registrationOpen: config.allowRegistration,
    schools,
    total: schools.length,
    registered: schools.filter((s) => s.registered).length,
    minPasswordLength: config.minPasswordLength,
  });
});

/** Maktab o'zi ro'yxatdan o'tadi: kodni kiritadi va parolini qo'yadi */
router.post('/register', (req, res) => {
  if (!config.allowRegistration) {
    return res.status(403).json({ error: 'Ro‘yxatdan o‘tish yopilgan. Admin bilan bog‘laning.' });
  }

  const schoolId = Number(req.body?.school_id);
  const code = String(req.body?.code || '').trim().toUpperCase().replace(/\s/g, '');
  const password = String(req.body?.password || '');
  const ip = clientIp(req);
  const key = `reg:${ip}`;

  // Kodni terib topishga urinishdan himoya
  const locked = lockedSeconds(key);
  if (locked > 0) {
    return res.status(429).json({
      error: `Juda ko‘p xato urinish. ${humanTime(locked)} dan keyin qayta urinib ko‘ring.`,
    });
  }

  const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(schoolId);
  if (!school) return res.status(400).json({ error: 'Maktab tanlanmadi' });

  if (school.user_id) {
    return res.status(409).json({
      error: 'Bu maktab allaqachon ro‘yxatdan o‘tgan. Parolni unutgan bo‘lsangiz admin bilan bog‘laning.',
    });
  }

  // Kodni bir xil vaqtda solishtiramiz (timing attack'ga qarshi)
  const given = Buffer.from(code.padEnd(64).slice(0, 64));
  const real = Buffer.from(school.invite_code.padEnd(64).slice(0, 64));
  if (!crypto.timingSafeEqual(given, real)) {
    const wait = registerFailedAttempt(key);
    return res.status(401).json({
      error: wait > 0
        ? `Juda ko‘p xato urinish. ${humanTime(wait)} dan keyin qayta urinib ko‘ring.`
        : 'Ro‘yxat kodi noto‘g‘ri. Kodni admindan oling.',
    });
  }

  const username = schoolUsername(school.number);
  const weak = checkPasswordStrength(password, username);
  if (weak) return res.status(400).json({ error: weak });

  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'Bu maktab uchun hisob allaqachon mavjud' });
  }

  clearFailedAttempts(key);

  // Hisob yaratamiz va darhol kirgizamiz — parolni o'zi qo'ygani uchun
  // majburiy almashtirish kerak emas.
  const info = db
    .prepare(
      `INSERT INTO users (username, password_hash, full_name, position, role, is_active,
                          must_change_password, password_changed_at, school_id, created_at)
       VALUES (?, ?, ?, '', 'user', 1, 0, ?, ?, ?)`
    )
    .run(username, hashPassword(password), school.name, nowIso(), school.id, nowIso());

  const userId = Number(info.lastInsertRowid);
  db.prepare('UPDATE schools SET user_id = ?, registered_at = ? WHERE id = ?')
    .run(userId, nowIso(), school.id);

  const { token, expires } = createSession(userId, { ip, userAgent: req.get('user-agent') || '' });
  setSessionCookie(res, token, expires);
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso(), userId);

  res.status(201).json({ ok: true, username, redirect: '/' });
});

router.post('/logout', (req, res) => {
  destroySession(req.cookies?.[COOKIE_NAME]);
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Kirilmagan' });
  res.json({ user: req.user, minPasswordLength: config.minPasswordLength });
});

/**
 * Parolni o'zgartirish. Majburiy almashtirish holatida ham ishlaydi —
 * shuning uchun requireAuth emas, o'z tekshiruvi ishlatiladi.
 */
router.post('/change-password', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Avval tizimga kiring' });

  const current = String(req.body?.current || '');
  const next = String(req.body?.next || '');
  const ip = clientIp(req);
  const key = `pw:${req.user.id}:${ip}`;

  // Joriy parolni terib topishga urinishdan himoya
  const locked = lockedSeconds(key);
  if (locked > 0) {
    return res.status(429).json({
      error: `Juda ko‘p xato urinish. ${humanTime(locked)} dan keyin qayta urinib ko‘ring.`,
    });
  }

  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(current, row.password_hash)) {
    const wait = registerFailedAttempt(key);
    return res.status(400).json({
      error: wait > 0
        ? `Juda ko‘p xato urinish. ${humanTime(wait)} dan keyin qayta urinib ko‘ring.`
        : 'Joriy parol noto‘g‘ri',
    });
  }
  clearFailedAttempts(key);

  const problem = checkPasswordStrength(next, req.user.username);
  if (problem) return res.status(400).json({ error: problem });

  if (verifyPassword(next, row.password_hash)) {
    return res.status(400).json({ error: 'Yangi parol eskisidan farq qilsin' });
  }

  db.prepare(
    `UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = ?
     WHERE id = ?`
  ).run(hashPassword(next), nowIso(), req.user.id);

  // Parol o'zgardi — barcha eski qurilmalardagi sessiyalar uziladi,
  // so'ng shu qurilma uchun yangisi ochiladi.
  destroyAllSessions(req.user.id);
  const { token, expires } = createSession(req.user.id, { ip, userAgent: req.get('user-agent') || '' });
  setSessionCookie(res, token, expires);

  res.json({ ok: true, redirect: req.user.role === 'admin' ? '/admin' : '/' });
});

export default router;
