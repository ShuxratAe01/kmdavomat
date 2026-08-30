import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { config } from './config.js';
import { nowIso } from './util/date.js';

export const COOKIE_NAME = 'kmd_session';

const USER_COLUMNS = 'id, username, full_name, position, role, is_active, created_at';

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

export function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').trim());
}

export function getUser(id) {
  return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id);
}

export function createSession(userId, userAgent = '') {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000);
  db.prepare(
    'INSERT INTO sessions (token, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)'
  ).run(token, userId, nowIso(), expires.toISOString(), String(userAgent).slice(0, 250));
  return { token, expires };
}

export function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function destroyAllSessions(userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function setSessionCookie(res, token, expires) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires,
    path: '/',
  });
}

/** Har bir so'rovda cookie'dan foydalanuvchini aniqlaydi (req.user) */
export function attachUser(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    const row = db
      .prepare(
        `SELECT u.id, u.username, u.full_name, u.position, u.role, u.is_active, s.expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ?`
      )
      .get(token);
    if (row && row.expires_at > nowIso() && row.is_active === 1) {
      req.user = {
        id: row.id,
        username: row.username,
        full_name: row.full_name,
        position: row.position,
        role: row.role,
      };
      req.sessionToken = token;
    } else if (row) {
      destroySession(token);
    }
  }
  next();
}

/** API uchun: kirmagan bo'lsa 401 */
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Avval tizimga kiring' });
  next();
}

/** API uchun: admin emas bo'lsa 403 */
export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Avval tizimga kiring' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Ruxsat yo‘q' });
  next();
}

/** HTML sahifalar uchun: kirmagan bo'lsa /login ga yo'naltiradi */
export function requirePage(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}

export function requireAdminPage(req, res, next) {
  if (!req.user) return res.redirect('/login');
  if (req.user.role !== 'admin') return res.redirect('/');
  next();
}

export function verifyPassword(plain, hash) {
  try {
    return bcrypt.compareSync(String(plain), String(hash));
  } catch {
    return false;
  }
}
