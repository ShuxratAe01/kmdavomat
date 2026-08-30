import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { config } from './config.js';
import { nowIso } from './util/date.js';

export const COOKIE_NAME = 'kmd_session';

const USER_COLUMNS = 'id, username, full_name, position, role, is_active, created_at';

// Foydalanuvchi topilmaganda ham bcrypt ishlashi uchun soxta hash.
// Bo'lmasa "login bor / yo'q" javob tezligidan bilinib qoladi (timing attack).
const DUMMY_HASH = bcrypt.hashSync('mavjud-bo‘lmagan-parol', config.bcryptRounds);

// ============ Parollar ============

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, config.bcryptRounds);
}

export function verifyPassword(plain, hash) {
  try {
    return bcrypt.compareSync(String(plain), String(hash));
  } catch {
    return false;
  }
}

/** Foydalanuvchi topilmaganda ham bir xil vaqt ketishi uchun */
export function wastePasswordTime(plain) {
  try {
    bcrypt.compareSync(String(plain || ''), DUMMY_HASH);
  } catch {
    /* ahamiyatsiz */
  }
}

// Eng ko'p ishlatiladigan, darhol topiladigan parollar
const WEAK_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000',
  'password', 'password1', 'password123', 'parol123', 'parol1234', 'parolim1',
  'admin123', 'admin1234', 'adminadmin', 'administrator', 'qwerty123', 'qwertyui',
  'asdfghjk', 'zxcvbnm1', 'iloveyou', 'welcome1', 'abc12345', 'a1234567',
  'toshkent', 'uzbekiston', 'salom123', 'test1234', 'user1234', 'davomat1',
]);

/**
 * Parolni tekshiradi. Hammasi joyida bo'lsa null, aks holda xato matni qaytaradi.
 */
export function checkPasswordStrength(password, username = '') {
  const pw = String(password || '');
  const min = config.minPasswordLength;

  if (pw.length < min) return `Parol kamida ${min} ta belgidan iborat bo‘lsin`;
  if (pw.length > 128) return 'Parol juda uzun (128 belgidan oshmasin)';
  if (/^\s|\s$/.test(pw)) return 'Parol boshida yoki oxirida bo‘sh joy bo‘lmasin';
  if (!/[a-zA-Z]/.test(pw)) return 'Parolda kamida bitta harf bo‘lsin';
  if (!/[0-9]/.test(pw)) return 'Parolda kamida bitta raqam bo‘lsin';
  if (/^(.)\1+$/.test(pw)) return 'Parol bir xil belgilardan iborat bo‘lmasin';

  const lower = pw.toLowerCase();
  if (WEAK_PASSWORDS.has(lower)) return 'Bu parol juda oson topiladi. Boshqasini tanlang.';
  if (username && lower.includes(String(username).toLowerCase())) {
    return 'Parol ichida login bo‘lmasin';
  }
  // 12345, abcde kabi ketma-ketliklar
  if (/012345|123456|234567|345678|456789|abcdef|qwerty/.test(lower)) {
    return 'Parolda ketma-ket keladigan belgilar bo‘lmasin (123456, qwerty…)';
  }
  return null;
}

// ============ Foydalanuvchilar ============

export function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').trim());
}

export function getUser(id) {
  return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id);
}

// ============ Sessiyalar ============

/** Cookie'dagi tokenni bazada saqlanadigan ko'rinishga o'giradi */
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function createSession(userId, { ip = '', userAgent = '' } = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000);
  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    hashToken(token),
    userId,
    nowIso(),
    expires.toISOString(),
    nowIso(),
    String(ip).slice(0, 60),
    String(userAgent).slice(0, 250)
  );
  return { token, expires };
}

export function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

export function destroyAllSessions(userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function setSessionCookie(res, token, expires) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,       // JavaScript o'qiy olmaydi (XSS bo'lsa ham token o'g'irlanmaydi)
    sameSite: 'lax',      // boshqa saytdan yuborilgan so'rovlarga cookie ilashmaydi (CSRF)
    secure: config.isProduction, // production'da faqat HTTPS orqali
    expires,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/', httpOnly: true, sameSite: 'lax', secure: config.isProduction });
}

// ============ Brute force himoyasi ============

const attemptSelect = db.prepare('SELECT * FROM login_attempts WHERE key = ?');

/** Bloklangan bo'lsa necha soniya qolganini qaytaradi, aks holda 0 */
export function lockedSeconds(key) {
  const row = attemptSelect.get(key);
  if (!row || !row.locked_until) return 0;
  const left = Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 1000);
  return left > 0 ? left : 0;
}

/** Xato urinishni qayd qiladi va kerak bo'lsa bloklaydi */
export function registerFailedAttempt(key) {
  const row = attemptSelect.get(key);
  const fails = (row?.fails || 0) + 1;

  let lockedUntil = '';
  if (fails >= config.maxLoginAttempts) {
    // Har navbatdagi blok uzayib boradi: 15 daq, 30 daq, 45 daq… (2 soatgacha)
    const step = Math.floor(fails / config.maxLoginAttempts);
    const minutes = Math.min(config.lockMinutes * step, 120);
    lockedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  }

  db.prepare(
    `INSERT INTO login_attempts (key, fails, locked_until, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET fails = ?, locked_until = ?, updated_at = ?`
  ).run(key, fails, lockedUntil, nowIso(), fails, lockedUntil, nowIso());

  return lockedUntil ? Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000) : 0;
}

export function clearFailedAttempts(key) {
  db.prepare('DELETE FROM login_attempts WHERE key = ?').run(key);
}

/** So'rov kelgan IP manzil */
export function clientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
}

// ============ Middleware ============

/** Har bir so'rovda cookie'dan foydalanuvchini aniqlaydi (req.user) */
export function attachUser(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();

  const tokenHash = hashToken(token);
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.position, u.role, u.is_active,
              u.must_change_password, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(tokenHash);

  if (!row) return next();

  if (row.expires_at <= nowIso() || row.is_active !== 1) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return next();
  }

  req.user = {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    position: row.position,
    role: row.role,
    must_change_password: row.must_change_password === 1,
  };
  req.sessionToken = token;

  // Oxirgi faollik (kuniga bir marta yozamiz — bazani ortiqcha bezovta qilmaslik uchun)
  db.prepare("UPDATE sessions SET last_seen = ? WHERE token_hash = ? AND substr(last_seen,1,10) <> ?")
    .run(nowIso(), tokenHash, nowIso().slice(0, 10));

  next();
}

/** API uchun: kirmagan bo'lsa 401 */
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Avval tizimga kiring' });
  if (req.user.must_change_password) {
    return res.status(403).json({
      error: 'Davom etishdan oldin parolingizni o‘zgartiring',
      code: 'MUST_CHANGE_PASSWORD',
    });
  }
  next();
}

/** API uchun: admin emas bo'lsa 403 */
export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Avval tizimga kiring' });
  if (req.user.must_change_password) {
    return res.status(403).json({
      error: 'Davom etishdan oldin parolingizni o‘zgartiring',
      code: 'MUST_CHANGE_PASSWORD',
    });
  }
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Ruxsat yo‘q' });
  next();
}

/** HTML sahifalar uchun: kirmagan bo'lsa /login ga yo'naltiradi */
export function requirePage(req, res, next) {
  if (!req.user) return res.redirect('/login');
  if (req.user.must_change_password) return res.redirect('/parol');
  next();
}

export function requireAdminPage(req, res, next) {
  if (!req.user) return res.redirect('/login');
  if (req.user.must_change_password) return res.redirect('/parol');
  if (req.user.role !== 'admin') return res.redirect('/');
  next();
}
