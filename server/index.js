import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import os from 'node:os';
import { config } from './config.js';
import { db, cleanupSessions } from './db.js';
import { attachUser, requireAuth, requireCsrf, requirePage, requireAdminPage, clientIp } from './auth.js';
import authRoutes from './routes/auth.js';
import videoRoutes from './routes/videos.js';
import adminRoutes from './routes/admin.js';
import profileRoutes from './routes/profile.js';
import weatherRoutes from './routes/weather.js';
import clubRoutes from './routes/clubs.js';
import { rateLimit } from './util/rate-limit.js';

const app = express();

if (config.trustProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');

// --- Xavfsizlik sarlavhalari ---
app.use((_req, res, next) => {
  // Brauzer fayl turini o'zi taxmin qilmasin
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Sahifani boshqa saytga iframe qilib joylab bo'lmasin (clickjacking)
  res.setHeader('X-Frame-Options', 'DENY');
  // Boshqa saytga o'tganda to'liq manzil uzatilmasin
  res.setHeader('Referrer-Policy', 'same-origin');
  // Kamera/mikrofon faqat shu saytning o'ziga
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  // Faqat o'z fayllarimiz ishlaydi — tashqi skript ulab bo'lmaydi (XSS)
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; media-src 'self' blob:; " +
      "script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; " +
      "frame-ancestors 'none'; base-uri 'self'; form-action 'self'" +
      (config.isProduction ? '; upgrade-insecure-requests' : '')
  );
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser(config.secret));

// Statik fayllar sessiyasiz — har bir JS/CSS so'rovi bazani urmasin
app.use('/css', express.static(path.join(config.publicDir, 'css')));
app.use('/js', express.static(path.join(config.publicDir, 'js')));
app.use('/img', express.static(path.join(config.publicDir, 'img'), { maxAge: '7d' }));
app.use('/fonts', express.static(path.join(config.publicDir, 'fonts'), { maxAge: '30d', immutable: true }));

app.use(attachUser);
app.use(requireCsrf);
app.use(
  '/api',
  rateLimit({
    max: 180,
    windowMs: 60 * 1000,
    keyFn: (req) => `api:${clientIp(req)}`,
  })
);

// --- API ---
app.get('/api/announcements', requireAuth, (_req, res) => {
  const items = db
    .prepare(
      `SELECT id, body, created_at
       FROM announcements
       WHERE is_active = 1
       ORDER BY id DESC
       LIMIT 10`
    )
    .all();
  res.json({ items });
});

app.get('/api/config', (_req, res) => {
  res.json({
    maxVideoMb: config.maxVideoMb,
    maxVideoSeconds: config.maxVideoSeconds,
    cameraFacing: config.cameraFacing,
    videoSize: config.videoSize,
    videoBitrateKbps: config.videoBitrateKbps,
    audioBitrateKbps: config.audioBitrateKbps,
    videoFps: config.videoFps,
    allowMultiplePerDay: config.allowMultiplePerDay,
    tz: config.tz,
    announcements: db
      .prepare(
        `SELECT id, body, created_at
         FROM announcements
         WHERE is_active = 1
         ORDER BY id DESC
         LIMIT 10`
      )
      .all(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', videoRoutes);
app.use('/api', profileRoutes);
app.use('/api', weatherRoutes);
app.use('/api', clubRoutes);
app.use('/api/admin', adminRoutes);

// --- Sahifalar ---
app.get('/login', (req, res) => {
  if (req.user?.must_change_password) return res.redirect('/parol');
  if (req.user) return res.redirect(req.user.role === 'admin' ? '/admin' : '/');
  res.sendFile(path.join(config.publicDir, 'login.html'));
});

// Maktabni ro'yxatdan o'tkazish sahifasi
app.get('/royxat', (req, res) => {
  if (req.user?.must_change_password) return res.redirect('/parol');
  if (req.user) return res.redirect(req.user.role === 'admin' ? '/admin' : '/');
  if (!config.allowRegistration) return res.redirect('/login');
  res.sendFile(path.join(config.publicDir, 'royxat.html'));
});

// Majburiy parol almashtirish sahifasi
app.get('/parol', (req, res) => {
  if (!req.user) return res.redirect('/login');
  if (!req.user.must_change_password) {
    return res.redirect(req.user.role === 'admin' ? '/admin' : '/');
  }
  res.sendFile(path.join(config.publicDir, 'parol.html'));
});

app.get('/', requirePage, (req, res) => {
  if (req.user.role === 'admin') return res.redirect('/admin');
  res.sendFile(path.join(config.publicDir, 'index.html'));
});

app.get('/admin', requireAdminPage, (_req, res) => {
  res.sendFile(path.join(config.publicDir, 'admin.html'));
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Topilmadi' });
  // Topilmagan fayl uchun 404 — sahifaga yo'naltirmaymiz,
  // aks holda brauzer HTML'ni rasm/skript deb qabul qilishga urinadi
  if (/^\/(img|css|js|fonts)\//.test(req.path)) return res.status(404).end();
  res.redirect('/');
});

// --- Xatoliklarni ushlash ---
app.use((err, _req, res, _next) => {
  console.error('[xatolik]', err);
  res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
});

// Har 6 soatda eskirgan sessiyalarni tozalash
setInterval(cleanupSessions, 6 * 60 * 60 * 1000).unref();

function localIps() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

app.listen(config.port, config.listenHost, () => {
  console.log(`  kmdavomat ishga tushdi`);
  console.log(`  Tinglash: ${config.listenHost}:${config.port}`);
  console.log(`  Lokal:    http://localhost:${config.port}`);
  if (config.listenHost === '0.0.0.0' || config.listenHost === '::') {
    for (const ip of localIps()) console.log(`  Tarmoqda: http://${ip}:${config.port}`);
    console.log('  Diqqat: tashqi tarmoqqa ochmang. Internet uchun HTTPS proxy va LISTEN_HOST=127.0.0.1');
  }
  if (config.trustProxy) console.log('  trust proxy: yoqilgan (faqat nginx/Caddy orqasida)');
  console.log(`  Vaqt mintaqasi: ${config.tz} | Saqlash: ${config.storage} | Limit: ${config.maxVideoMb} MB`);
  console.log('');
});
