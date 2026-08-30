import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

const EXT_BY_MIME = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-matroska': '.mkv',
  'video/3gpp': '.3gp',
  'video/x-msvideo': '.avi',
};

export function extensionFor(mime, originalName = '') {
  const fromName = path.extname(originalName).toLowerCase();
  if (fromName && fromName.length <= 6) return fromName;
  return EXT_BY_MIME[mime] || '.mp4';
}

/**
 * Videoni saqlaydi.
 * STORAGE=db  -> SQLite ichiga BLOB sifatida
 * STORAGE=disk -> uploads/YYYY-MM/ papkaga fayl sifatida
 */
export function saveVideo({ buffer, mime, originalName, userId, day }) {
  if (config.storage === 'db') {
    return { storage: 'db', data: buffer, path: null };
  }
  const dir = path.join(config.uploadDir, day.slice(0, 7));
  fs.mkdirSync(dir, { recursive: true });
  const name = `${day}_u${userId}_${crypto.randomBytes(6).toString('hex')}${extensionFor(mime, originalName)}`;
  const full = path.join(dir, name);
  fs.writeFileSync(full, buffer);
  const rel = path.relative(config.uploadDir, full).split(path.sep).join('/');
  return { storage: 'disk', data: null, path: rel };
}

/** Video baytlarini o'qiydi (Buffer) */
export function readVideo(row) {
  if (row.storage === 'db') {
    const blob = row.data;
    if (!blob) return null;
    return Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  }
  const full = path.join(config.uploadDir, row.path || '');
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full);
}

/** Diskdagi faylni o'chiradi (db rejimida hech narsa qilmaydi) */
export function deleteVideoFile(row) {
  if (row.storage !== 'disk' || !row.path) return;
  const full = path.join(config.uploadDir, row.path);
  try {
    fs.unlinkSync(full);
  } catch {
    /* fayl allaqachon yo'q */
  }
}
