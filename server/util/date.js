import { config } from '../config.js';

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.tz,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Berilgan vaqtning Toshkent bo'yicha sanasi: "YYYY-MM-DD" */
export function dayStr(date = new Date()) {
  return dayFmt.format(date);
}

/** Joriy oy: "YYYY-MM" */
export function monthStr(date = new Date()) {
  return dayStr(date).slice(0, 7);
}

/** "YYYY-MM" ni tekshiradi, noto'g'ri bo'lsa joriy oyni qaytaradi */
export function normalizeMonth(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || '')) ? String(value) : monthStr();
}

/** "YYYY-MM-DD" formatini tekshiradi */
export function isDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

/** Oydagi kunlar soni */
export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Oyning 1-kuni haftaning nechanchi kuni (0 = Dushanba ... 6 = Yakshanba) */
export function firstWeekdayMondayBased(month) {
  const [y, m] = month.split('-').map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0 = Yakshanba
  return (jsDay + 6) % 7;
}

/**
 * Shu sana dam olish kunimi?
 * Hozircha faqat yakshanba — bu kunlarda video yuborish shart emas.
 */
export function isRestDay(date) {
  const [y, m, d] = String(date).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0; // 0 = yakshanba
}

/** Oydagi barcha sanalar ro'yxati */
export function monthDays(month) {
  const n = daysInMonth(month);
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/** ISO vaqt (log/created_at uchun) */
export function nowIso() {
  return new Date().toISOString();
}
