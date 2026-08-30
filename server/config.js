import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, '..');

export const config = {
  port: Number(process.env.PORT || 5175),
  // Sessiya cookie'sini imzolash uchun maxfiy kalit. Ishlab chiqarishda .env da o'zgartiring!
  secret: process.env.SESSION_SECRET || 'kmdavomat-dev-secret-almashtiring',
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
  dbFile: process.env.DB_FILE || path.join(ROOT, 'data', 'app.db'),
  uploadDir: process.env.UPLOAD_DIR || path.join(ROOT, 'uploads'),
  publicDir: path.join(ROOT, 'public'),
  // Birinchi ishga tushganda yaratiladigan admin
  adminUser: process.env.ADMIN_USERNAME || 'admin',
  adminPass: process.env.ADMIN_PASSWORD || 'admin123',
  // Kuniga bir nechta video yuborishga ruxsat berilsinmi
  allowMultiplePerDay: String(process.env.ALLOW_MULTIPLE_PER_DAY || 'false') === 'true',
};

export const maxVideoBytes = config.maxVideoMb * 1024 * 1024;
