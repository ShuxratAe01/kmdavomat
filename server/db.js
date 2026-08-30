import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { nowIso } from './util/date.js';

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

export const db = new DatabaseSync(config.dbFile);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL DEFAULT '',
  position      TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'user',
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day        TEXT NOT NULL,
  filename   TEXT NOT NULL,
  mime       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  storage    TEXT NOT NULL,
  data       BLOB,
  path       TEXT,
  note       TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_videos_user_day ON videos(user_id, day);
CREATE INDEX IF NOT EXISTS idx_videos_day      ON videos(day);

-- Sessiyalar: cookie'dagi token bazada ochiq saqlanmaydi, faqat uning SHA-256 hashi.
-- Baza sizib chiqsa ham tokenlar bilan kirib bo'lmaydi.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen  TEXT NOT NULL DEFAULT '',
  ip         TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Parolni ketma-ket terib topishga (brute force) qarshi hisoblagich
CREATE TABLE IF NOT EXISTS login_attempts (
  key          TEXT PRIMARY KEY,
  fails        INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT NOT NULL DEFAULT '',
  updated_at   TEXT NOT NULL
);
`);

// --- Migratsiyalar (eski bazani yangisiga moslash) ---

const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);

// Parolni majburiy almashtirish bayrog'i: admin yaratgan/tiklagan parol bilan
// birinchi marta kirganda foydalanuvchi o'z parolini qo'yishi shart.
if (!userCols.includes('must_change_password')) {
  db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0');
}
if (!userCols.includes('password_changed_at')) {
  db.exec("ALTER TABLE users ADD COLUMN password_changed_at TEXT NOT NULL DEFAULT ''");
}
if (!userCols.includes('last_login_at')) {
  db.exec("ALTER TABLE users ADD COLUMN last_login_at TEXT NOT NULL DEFAULT ''");
}

// Eski sessions jadvalida token ochiq saqlangan edi — uni tashlab yuboramiz
// (hamma qaytadan kiradi, bu ataylab shunday).
const sessionCols = db.prepare('PRAGMA table_info(sessions)').all().map((c) => c.name);
if (sessionCols.length && !sessionCols.includes('token_hash')) {
  db.exec('DROP TABLE sessions');
  db.exec(`
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen  TEXT NOT NULL DEFAULT '',
      ip         TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX idx_sessions_user ON sessions(user_id);
  `);
  console.log('  ℹ  Sessiyalar jadvali yangilandi — hamma qaytadan kirishi kerak.');
}

// --- Birinchi ishga tushirishda admin yaratish ---

/** O'qish oson, lekin taxmin qilib bo'lmaydigan parol yaratadi */
function generatePassword() {
  const abc = 'abcdefghijkmnpqrstuvwxyz'; // o, l — chalkashmasligi uchun yo'q
  const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const num = '23456789';
  const all = abc + ABC + num;
  const pick = (set) => set[crypto.randomInt(set.length)];
  const chars = [pick(ABC), pick(abc), pick(num), pick(num)];
  while (chars.length < 14) chars.push(pick(all));
  // Aralashtiramiz
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const adminCount = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
if (adminCount === 0) {
  const generated = !config.adminPass;
  const password = config.adminPass || generatePassword();

  db.prepare(
    `INSERT INTO users (username, password_hash, full_name, position, role, is_active,
                        must_change_password, password_changed_at, created_at)
     VALUES (?, ?, ?, ?, 'admin', 1, 1, ?, ?)`
  ).run(
    config.adminUser,
    bcrypt.hashSync(password, config.bcryptRounds),
    'Administrator',
    'Admin',
    nowIso(),
    nowIso()
  );

  const line = '─'.repeat(52);
  console.log('');
  console.log(`  ┌${line}┐`);
  console.log('  │  ADMIN AKKAUNT YARATILDI                           │');
  console.log(`  │${' '.repeat(52)}│`);
  console.log(`  │  Login:  ${config.adminUser.padEnd(42)}│`);
  console.log(`  │  Parol:  ${password.padEnd(42)}│`);
  console.log(`  │${' '.repeat(52)}│`);
  if (generated) {
    console.log('  │  Bu parol faqat SHU YERDA ko‘rsatiladi —           │');
    console.log('  │  hozir nusxalab oling.                             │');
  }
  console.log('  │  Birinchi kirishda yangi parol so‘raladi.           │');
  console.log(`  └${line}┘`);
  console.log('');
}

/** Muddati o'tgan sessiyalar va eski urinish hisoblagichlarini tozalash */
export function cleanupSessions() {
  const now = nowIso();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  // Bloklanmagan va bir kundan eski hisoblagichlarni o'chiramiz
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM login_attempts WHERE updated_at < ? AND locked_until < ?').run(dayAgo, now);
}
cleanupSessions();
