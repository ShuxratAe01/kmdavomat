import express from 'express';
import { db } from '../db.js';
import {
  COOKIE_NAME,
  createSession,
  destroySession,
  destroyAllSessions,
  findUserByUsername,
  hashPassword,
  requireAuth,
  setSessionCookie,
  verifyPassword,
} from '../auth.js';

const router = express.Router();

router.post('/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'Login va parolni kiriting' });
  }

  const user = findUserByUsername(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Login yoki parol noto‘g‘ri' });
  }
  if (user.is_active !== 1) {
    return res.status(403).json({ error: 'Akkauntingiz bloklangan. Admin bilan bog‘laning.' });
  }

  const { token, expires } = createSession(user.id, req.get('user-agent') || '');
  setSessionCookie(res, token, expires);

  res.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      position: user.position,
      role: user.role,
    },
    redirect: user.role === 'admin' ? '/admin' : '/',
  });
});

router.post('/logout', (req, res) => {
  destroySession(req.cookies?.[COOKIE_NAME]);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Kirilmagan' });
  res.json({ user: req.user });
});

/** Foydalanuvchi o'z parolini o'zgartiradi */
router.post('/change-password', requireAuth, (req, res) => {
  const current = String(req.body?.current || '');
  const next = String(req.body?.next || '');

  if (next.length < 5) {
    return res.status(400).json({ error: 'Yangi parol kamida 5 ta belgidan iborat bo‘lsin' });
  }
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(current, row.password_hash)) {
    return res.status(400).json({ error: 'Joriy parol noto‘g‘ri' });
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), req.user.id);
  destroyAllSessions(req.user.id);

  const { token, expires } = createSession(req.user.id, req.get('user-agent') || '');
  setSessionCookie(res, token, expires);
  res.json({ ok: true });
});

export default router;
