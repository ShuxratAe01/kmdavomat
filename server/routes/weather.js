import express from 'express';
import { config } from '../config.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

/**
 * Ob-havo open-meteo.com dan olinadi (bepul, kalit kerak emas).
 * Brauzer to'g'ridan-to'g'ri so'ray olmaydi — xavfsizlik qoidasi (CSP)
 * tashqi manzillarni bloklaydi. Shuning uchun server olib beradi va
 * javobni saqlab turadi: 71 ta maktab bir vaqtda ochsa ham bitta so'rov ketadi.
 */

let cache = { at: 0, data: null };

/** WMO ob-havo kodini belgi va o'zbekcha izohga o'giradi */
function describe(code, isDay) {
  const night = !isDay;
  if (code === 0) return { icon: night ? 'moon' : 'sun', text: 'Ochiq' };
  if (code === 1) return { icon: night ? 'moon' : 'sun', text: 'Asosan ochiq' };
  if (code === 2) return { icon: night ? 'moon-cloud' : 'sun-cloud', text: 'Bulutli ochiq' };
  if (code === 3) return { icon: 'cloud', text: 'Bulutli' };
  if (code === 45 || code === 48) return { icon: 'fog', text: 'Tuman' };
  if (code >= 51 && code <= 57) return { icon: 'rain', text: 'Mayda yomg‘ir' };
  if (code >= 61 && code <= 65) return { icon: 'rain', text: 'Yomg‘ir' };
  if (code === 66 || code === 67) return { icon: 'sleet', text: 'Muzli yomg‘ir' };
  if (code >= 71 && code <= 75) return { icon: 'snow', text: 'Qor' };
  if (code === 77) return { icon: 'snow', text: 'Qor donalari' };
  if (code >= 80 && code <= 82) return { icon: 'rain', text: 'Jala' };
  if (code === 85 || code === 86) return { icon: 'snow', text: 'Qor yog‘moqda' };
  if (code === 95) return { icon: 'thunder', text: 'Momaqaldiroq' };
  if (code === 96 || code === 99) return { icon: 'thunder', text: 'Momaqaldiroq, do‘l' };
  return { icon: 'cloud', text: '—' };
}

router.get('/weather', requireAuth, async (_req, res) => {
  if (!config.weatherEnabled) return res.json({ enabled: false });

  const maxAge = config.weatherCacheMinutes * 60 * 1000;
  if (cache.data && Date.now() - cache.at < maxAge) {
    return res.json(cache.data);
  }

  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${config.weatherLat}&longitude=${config.weatherLon}` +
    '&current=temperature_2m,weather_code,is_day' +
    `&timezone=${encodeURIComponent(config.tz)}`;

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!r.ok) throw new Error(`open-meteo javobi: ${r.status}`);
    const j = await r.json();
    const cur = j.current || {};

    const { icon, text } = describe(Number(cur.weather_code), cur.is_day === 1);
    cache = {
      at: Date.now(),
      data: {
        enabled: true,
        ok: true,
        city: config.weatherCity,
        temp: Math.round(Number(cur.temperature_2m)),
        code: Number(cur.weather_code),
        isDay: cur.is_day === 1,
        icon,
        text,
        updatedAt: new Date().toISOString(),
      },
    };
    res.json(cache.data);
  } catch (err) {
    // Internet yo'q yoki xizmat javob bermadi — eskisi bo'lsa o'shani beramiz
    if (cache.data) return res.json({ ...cache.data, stale: true });
    res.json({ enabled: true, ok: false, error: 'Ob-havoni olib bo‘lmadi' });
  }
});

export default router;
