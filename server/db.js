import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
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

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT ''
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
CREATE INDEX IF NOT EXISTS idx_sessions_user   ON sessions(user_id);
`);

// --- Birinchi ishga tushirishda admin yaratish ---
const adminCount = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
if (adminCount === 0) {
  db.prepare(
    `INSERT INTO users (username, password_hash, full_name, position, role, is_active, created_at)
     VALUES (?, ?, ?, ?, 'admin', 1, ?)`
  ).run(config.adminUser, bcrypt.hashSync(config.adminPass, 10), 'Administrator', 'Admin', nowIso());
  console.log('');
  console.log('  ┌───────────────────────────────────────────────┐');
  console.log('  │  Admin akkaunt yaratildi                      │');
  console.log(`  │  Login:  ${config.adminUser.padEnd(36)}│`);
  console.log(`  │  Parol:  ${config.adminPass.padEnd(36)}│`);
  console.log('  │  ⚠  Kirgach parolni albatta o‘zgartiring!     │');
  console.log('  └───────────────────────────────────────────────┘');
  console.log('');
}

/** Muddati o'tgan sessiyalarni tozalash */
export function cleanupSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso());
}
cleanupSessions();
