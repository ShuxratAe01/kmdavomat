import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import os from 'node:os';
import { config } from './config.js';
import './db.js';
import { attachUser, requirePage, requireAdminPage } from './auth.js';
import authRoutes from './routes/auth.js';
import videoRoutes from './routes/videos.js';
import adminRoutes from './routes/admin.js';
import { cleanupSessions } from './db.js';

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(config.secret));
app.use(attachUser);

// --- Statik fayllar (css/js/rasm) ---
app.use('/css', express.static(path.join(config.publicDir, 'css')));
app.use('/js', express.static(path.join(config.publicDir, 'js')));

// --- API ---
app.get('/api/config', (_req, res) => {
  res.json({
    maxVideoMb: config.maxVideoMb,
    maxVideoSeconds: config.maxVideoSeconds,
    cameraFacing: config.cameraFacing,
    allowMultiplePerDay: config.allowMultiplePerDay,
    tz: config.tz,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', videoRoutes);
app.use('/api/admin', adminRoutes);

// --- Sahifalar ---
app.get('/login', (req, res) => {
  if (req.user) return res.redirect(req.user.role === 'admin' ? '/admin' : '/');
  res.sendFile(path.join(config.publicDir, 'login.html'));
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

app.listen(config.port, () => {
  console.log(`  kmdavomat ishga tushdi`);
  console.log(`  Lokal:    http://localhost:${config.port}`);
  for (const ip of localIps()) console.log(`  Tarmoqda: http://${ip}:${config.port}`);
  console.log(`  Vaqt mintaqasi: ${config.tz} | Saqlash: ${config.storage} | Limit: ${config.maxVideoMb} MB`);
  console.log('');
});
