import 'dotenv/config';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, '..');

const dataDir = path.join(ROOT, 'data');
fs.mkdirSync(dataDir, { recursive: true });

/**
 * Sessiya kaliti. .env da berilmagan bo'lsa — birinchi ishga tushganda
 * tasodifiy kalit yaratiladi va data/secret.key ga saqlanadi.
 * Kodda "standart parol" qolmasligi uchun shunday qilingan.
 */
function loadSecret() {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;

  const keyFile = path.join(dataDir, 'secret.key');
  try {
    const existing = fs.readFileSync(keyFile, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch {
    /* fayl hali yo'q */
  }
  const generated = crypto.randomBytes(48).toString('base64url');
  fs.writeFileSync(keyFile, generated, { mode: 0o600 });
  return generated;
}

export const config = {
  port: Number(process.env.PORT || 5175),
  secret: loadSecret(),
  // Sessiya necha kun amal qiladi (bir marta kirgach shuncha kun eslab qoladi)
  sessionDays: Number(process.env.SESSION_DAYS || 90),
  // Vaqt mintaqasi — sanalar shu bo'yicha hisoblanadi
  tz: process.env.TZ_NAME || 'Asia/Tashkent',
  // Video qayerda saqlansin: 'db' (SQLite ichida BLOB) yoki 'disk' (uploads/ papka)
  storage: (process.env.STORAGE || 'db').toLowerCase() === 'disk' ? 'disk' : 'db',
  // Bitta video uchun maksimal hajm (MB)
  maxVideoMb: Number(process.env.MAX_VIDEO_MB || 60),
  // Bitta video uchun maksimal davomiylik (soniya)
  maxVideoSeconds: Number(process.env.MAX_VIDEO_SECONDS || 30),
  // Qaysi kamera ochilsin: 'user' = oldingi (selfi), 'environment' = orqadagi
  cameraFacing: process.env.CAMERA_FACING === 'environment' ? 'environment' : 'user',

  // --- Yumaloq videoning sifati ---
  // Kvadrat tomoni (piksel). 640 — yuz aniq ko'rinadi, fayl ham katta emas
  videoSize: Number(process.env.VIDEO_SIZE || 640),
  // Video oqim tezligi (kbit/s). Kattalashsa sifat yaxshi, fayl katta
  videoBitrateKbps: Number(process.env.VIDEO_BITRATE_KBPS || 1200),
  // Ovoz oqim tezligi (kbit/s). Nutq uchun 64 yetarli
  audioBitrateKbps: Number(process.env.AUDIO_BITRATE_KBPS || 64),
  // Sekundiga kadrlar
  videoFps: Number(process.env.VIDEO_FPS || 30),
  dbFile: process.env.DB_FILE || path.join(dataDir, 'app.db'),
  uploadDir: process.env.UPLOAD_DIR || path.join(ROOT, 'uploads'),
  publicDir: path.join(ROOT, 'public'),

  // --- Xavfsizlik ---
  // Parol hashlash murakkabligi (kattaroq = xavfsizroq, lekin sekinroq)
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  // Parolning eng qisqa uzunligi
  minPasswordLength: Number(process.env.MIN_PASSWORD_LENGTH || 8),
  // Nechta xato urinishdan keyin akkaunt vaqtincha bloklanadi
  maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS || 5),
  // Blok necha daqiqa davom etadi
  lockMinutes: Number(process.env.LOCK_MINUTES || 15),

  // Birinchi ishga tushganda yaratiladigan admin.
  // Parol berilmasa — tasodifiy parol yaratilib, terminalga bir marta chiqariladi.
  adminUser: process.env.ADMIN_USERNAME || 'admin',
  adminPass: process.env.ADMIN_PASSWORD || null,

  // Nechta maktab bo'lsin (faqat birinchi ishga tushganda ro'yxat yaratiladi)
  schoolCount: Number(process.env.SCHOOL_COUNT || 71),
  // Maktablar o'zlari ro'yxatdan o'tishi mumkinmi
  allowRegistration: String(process.env.ALLOW_REGISTRATION || 'true') === 'true',

  // Kuniga bir nechta video yuborishga ruxsat berilsinmi
  allowMultiplePerDay: String(process.env.ALLOW_MULTIPLE_PER_DAY || 'false') === 'true',
  isProduction: process.env.NODE_ENV === 'production',
};

export const maxVideoBytes = config.maxVideoMb * 1024 * 1024;
