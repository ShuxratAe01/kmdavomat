# kmdavomat — video orqali kunlik davomat tizimi

Har bir maktab o'zining ro'yxat kodi bilan ro'yxatdan o'tib, o'ziga parol qo'yadi.
Kirgach o'z sahifasida bugungi sanani va oylik kalendarni ko'radi.
Kalendarda **video yuborilgan kunlar yashil**, **yuborilmagan kunlar qizil** bo'lib turadi.
Pastdagi tugma orqali video yuboriladi — video to'g'ridan-to'g'ri **admin panelga** tushadi.

## Tez ishga tushirish

```bash
npm install
npm start
```

Brauzerda oching: **http://localhost:5175**

Birinchi ishga tushganda admin akkaunt **tasodifiy kuchli parol** bilan yaratiladi
va parol terminalga **bir marta** chiqadi:

```
  ┌────────────────────────────────────────────────────┐
  │  ADMIN AKKAUNT YARATILDI                           │
  │                                                    │
  │  Login:  admin                                     │
  │  Parol:  fWM5xmkc5m7XDL                            │
  │                                                    │
  │  Bu parol faqat SHU YERDA ko'rsatiladi —           │
  │  hozir nusxalab oling.                             │
  │  Birinchi kirishda yangi parol so'raladi.          │
  └────────────────────────────────────────────────────┘
```

Shu parol bilan kirasiz, tizim darhol **o'z parolingizni qo'yishni** so'raydi.
Parolni yo'qotib qo'ysangiz: serverni to'xtatib `data/app.db` ni o'chiring va qayta
ishga tushiring (barcha ma'lumotlar ham o'chadi), yoki `.env` da `ADMIN_PASSWORD` bering.

## Ishlash tartibi

1. **Admin** admin panelning "🏫 Maktablar" bo‘limidan har bir maktabning **ro‘yxat kodini**
   oladi (yoki hammasini CSV qilib yuklab oladi) va maktablarga tarqatadi.
2. **Maktab xodimi** saytga kiradi → "Ro‘yxatdan o‘tish" → maktabini ro‘yxatdan tanlaydi,
   **F.I.SH. va telefon raqamini** yozadi, kodini kiritadi va **o‘ziga parol qo‘yadi**.
   Shu zahoti ichkariga kiradi. Mas‘ul shaxs ma‘lumoti admin panelda ko‘rinadi.
3. Keyingi safar **kirish sahifasida ham maktabini ro‘yxatdan tanlaydi** va parolini kiritadi —
   login yozib o‘tirmaydi. Brauzer oxirgi tanlangan maktabni eslab qoladi.
   Sessiya 90 kun saqlanadi, ya'ni har kuni qayta kirish shart emas.
4. Maktab sahifasida: bugungi sana → oylik kalendar (yashil/qizil) → **🎬 Video yuborish**.
5. Video yuborilgach o‘sha kun kalendarda darhol yashil bo‘ladi va admin panelda ko‘rinadi.
6. Admin videoni ko‘radi, yuklab oladi, **Qabul qilish / Rad etish** qiladi.

### Ro‘yxat kodi haqida

Har bir maktabga **o‘zining alohida kodi** beriladi (`K7F2-M9QX` ko‘rinishida).
Bitta umumiy kod emas — shuning uchun:

- kod tarqalib ketsa faqat **o‘sha maktabniki** almashtiriladi, qolganlari tegilmaydi;
- kim ro‘yxatdan o‘tgani, kim hali o‘tmagani aniq ko‘rinadi;
- boshqa maktabning kodi bilan ro‘yxatdan o‘tib bo‘lmaydi.

Kodda chalkashadigan belgilar (0, 1, O, I, L) ishlatilmaydi — qog‘ozdan ko‘chirish
va telefonda aytish oson bo‘lsin uchun. Kodni 5 marta xato kiritganda blok tushadi.

### Maktablar ro‘yxati

Birinchi ishga tushganda **71 ta maktab** shu ko‘rinishda yaratiladi:

```
1-sonli umumiy oʻrta taʼlim maktabi
2-sonli umumiy oʻrta taʼlim maktabi
...
71-sonli umumiy oʻrta taʼlim maktabi
```

Har birining logini raqamidan yasaladi (`1-maktab`, `2-maktab` …), lekin foydalanuvchi
uni yozmaydi — ro‘yxatdan tanlaydi. Nomni admin panelda o‘zgartirish mumkin,
maktablar sonini `.env` dagi `SCHOOL_COUNT` belgilaydi.

## Sahifalar

| Manzil | Kim uchun | Nima bor |
|---|---|---|
| `/login` | hamma | Maktabni ro‘yxatdan tanlab kirish (admin uchun login/parol) |
| `/royxat` | maktablar | Maktabni tanlab, kod bilan ro‘yxatdan o‘tish |
| `/parol` | hamma | Vaqtinchalik parolni almashtirish |
| `/` | maktab | Profil, bugungi sana, oylik kalendar, video yuborish, o'z videolari |
| `/admin` | admin | Bugungi davomat, videolar, maktablarni boshqarish |

### Maktab sahifasi
- **Profil kartochkasi**: rasm (o'zi yuklaydi), F.I.SH., maktab raqami, telefon.
  Rasm ostidagi tugma bilan almashtiriladi, ma'lumotlarni keyin tahrirlash mumkin
- Yuqorida bugungi sana + hafta kuni + bugungi holat
- Oylik kalendar: **yashil** = yuborilgan, **qizil** = yuborilmagan, **kulrang** = kelgusi kun
- Oylar orasida `‹ ›` bilan yurish, oylik statistika (bajarilish foizi)
- Video yuborish: **kamerada yozish** yoki **galereyadan tanlash** — maksimal **30 soniya**
- Videolar Telegram uslubida **yumaloq** ko’rinadi: bosilganda o’ynaydi, atrofida vaqt halqasi aylanadi
- Yuborishdan oldin ko'rib chiqish, izoh qo'shish, yuklanish foizi
- O'z videolarini qayta ko'rish va yuklab olish
- Parolni o'zgartirish

### Admin panel
- **📊 Bugungi davomat** — barcha maktablar bir ro'yxatda: kim yuborgan, kim yubormagan,
  kim hali ro'yxatdan o'tmagan; istalgan sana bo'yicha, oylik hisob bilan
- **🎬 Videolar** — maktab / sana oralig'i / holat bo'yicha filtr, ko'rish, yuklab olish, o'chirish, qabul/rad
- **🏫 Maktablar** — 71 ta maktab, mas'ul shaxs (F.I.SH. + telefon),
  ro'yxat kodlari (ko'rish, yangilash, CSV qilib yuklab olish),
  qidiruv va filtr, parolni tiklash, hisobni o'chirish, har birining kalendari, yangi maktab qo'shish
- **👥 Adminlar** — tizim administratorlarini boshqarish

## Sozlash (`.env`)

`.env.example` dan nusxa oling:

```bash
cp .env.example .env
```

| O'zgaruvchi | Standart | Izoh |
|---|---|---|
| `PORT` | `5175` | Server porti |
| `SESSION_SECRET` | — | Bo'sh qoldiring — avtomatik yaratiladi (`data/secret.key`) |
| `SESSION_DAYS` | `90` | Sessiya necha kun saqlanadi |
| `TZ_NAME` | `Asia/Tashkent` | Sanalar shu mintaqa bo'yicha hisoblanadi |
| `STORAGE` | `db` | `db` = SQLite ichida, `disk` = `uploads/` papkada |
| `MAX_VIDEO_SECONDS` | `30` | Bitta video uchun maksimal davomiylik |
| `VIDEO_SIZE` | `640` | Yumaloq videoning kvadrat tomoni (piksel) |
| `VIDEO_BITRATE_KBPS` | `1200` | Video oqim tezligi — sifat/hajm muvozanati |
| `AUDIO_BITRATE_KBPS` | `64` | Ovoz oqim tezligi (nutq uchun yetarli) |
| `VIDEO_FPS` | `30` | Sekundiga kadrlar |
| `CAMERA_FACING` | `user` | `user` = oldingi (selfi) kamera, `environment` = orqadagi |
| `MAX_VIDEO_MB` | `60` | Bitta video uchun maksimal hajm |
| `ALLOW_MULTIPLE_PER_DAY` | `false` | Kuniga bir nechta video yuborishga ruxsat |
| `SCHOOL_COUNT` | `71` | Nechta maktab yaratilsin (faqat birinchi ishga tushganda) |
| `ALLOW_REGISTRATION` | `true` | Maktablar o'zlari ro'yxatdan o'ta olsinmi |
| `MIN_PASSWORD_LENGTH` | `8` | Parolning eng qisqa uzunligi |
| `BCRYPT_ROUNDS` | `12` | Parol hashlash murakkabligi |
| `MAX_LOGIN_ATTEMPTS` | `5` | Nechta xato urinishdan keyin bloklansin |
| `LOCK_MINUTES` | `15` | Blok necha daqiqa davom etsin |
| `ADMIN_USERNAME` | `admin` | Birinchi adminning logini |
| `ADMIN_PASSWORD` | — | Bo'sh qoldiring — tasodifiy parol yaratiladi |
| `NODE_ENV` | — | `production` bo'lsa cookie faqat HTTPS orqali yuriladi + HSTS |

## Xavfsizlik

| Nima | Qanday himoyalangan |
|---|---|
| **Parollar** | bcrypt (12 rounds) bilan hashlanadi — bazadan parolni o'qib bo'lmaydi |
| **Standart parol** | Yo'q. Birinchi admin uchun tasodifiy parol yaratiladi, kirgach almashtiriladi |
| **Zaif parollar** | Kamida 8 belgi, harf + raqam. Mashhur parollar, ketma-ketliklar, login ichida bo'lishi rad etiladi |
| **Ro'yxat kodi** | Har maktabga alohida kod. Boshqa maktabniki ishlamaydi; 5 xato urinishdan keyin blok |
| **Vaqtinchalik parol** | Admin tiklagan parol bilan kirgan maktab o'z parolini qo'ymaguncha hech nima ishlamaydi |
| **Parol terish (brute force)** | 5 xato urinishdan keyin 15 daqiqa blok; keyingi bloklar uzayadi (2 soatgacha). Login bo'yicha ham, IP bo'yicha ham hisoblanadi |
| **Login oshkor bo'lishi** | "Login yoki parol noto'g'ri" — qaysi biri xato ekani aytilmaydi; javob vaqti ham bir xil |
| **Sessiyalar** | Bazada token emas, uning SHA-256 hashi saqlanadi — baza sizib chiqsa ham kirib bo'lmaydi |
| **Cookie** | `HttpOnly` (JS o'qiy olmaydi), `SameSite=Lax` (CSRF), production'da `Secure` (faqat HTTPS) |
| **Parol o'zgarganda** | Barcha qurilmalardagi eski sessiyalar uziladi |
| **Hisob bloklanganda** | Sessiyalari darhol uziladi |
| **XSS / clickjacking** | CSP (tashqi skript ishlamaydi), `X-Frame-Options: DENY`, `nosniff` |
| **Sessiya kaliti** | Kodda yo'q — birinchi ishga tushganda `data/secret.key` ga tasodifiy yaratiladi |

Parolni **admin ham ko'ra olmaydi**: maktab o'zi qo'yadi. Maktab parolini unutsa —
admin vaqtinchalik parol beradi, maktab kirib darhol yangisini qo'yadi (videolari saqlanadi).

### Videolarni qayerda saqlash

Standart holatda videolar **SQLite bazasi ichida** (`data/app.db`) saqlanadi — hammasi bitta faylda,
zaxira nusxa olish oson. Videolar ko'payib baza fayli kattalashib ketsa (masalan 5–10 GB dan oshsa),
`.env` da `STORAGE=disk` qilib qo'ying — yangi videolar `uploads/YYYY-MM/` papkasiga tushadi,
bazada faqat ma'lumotlari qoladi. Eski videolar baribir ishlayveradi (har bir yozuvda qayerda
turgani belgilab qo'yiladi).

## Telefonda ishlatish

Server va telefon bitta Wi-Fi tarmoqda bo'lsa, ishga tushirishda chiqadigan
`http://192.168.x.x:5175` manzilini telefonda oching.

### Yumaloq video (Telegram uslubida)

Brauzer ichida yozilgan video **kvadrat** (640×640) qilib saqlanadi — xuddi Telegram’dagi
yumaloq videolar kabi. Kameradan kelayotgan tasvirning o’rtasidan kvadrat qirqib olinadi,
ekranda esa doira qilib ko’rsatiladi.

- Yozayotganda jonli ko’rinish ham doira, selfi kamerada ko’zguga qaragandek aks etadi
- Tayyor video bosilganda o’ynaydi, atrofida ko’k halqa vaqtni ko’rsatib aylanadi
- Admin panelda **⤢ To’liq kadr** tugmasi bor — chetlari qirqilmagan holda ko’rish uchun

**Hajmi va sifati.** Kamera 960×960 da olinib 640×640 ga kichraytiriladi — shunda tasvir
tiniqroq chiqadi. Oqim tezligi 1200 kbit/s (video) va 64 kbit/s (ovoz) qilib belgilangan;
brauzerning standarti (2500 + 128) bunday kichik kvadrat uchun ortiqcha edi. Natijada
30 soniyalik video **~9,4 MB o’rniga ~4,5 MB** bo’ladi, aniqligi esa 480×480 dan 640×640 ga oshdi.
Ovozda aks-sado va shovqin tozalanadi, mono yoziladi. Qiymatlarni `.env` dan o’zgartirasiz:
`VIDEO_SIZE`, `VIDEO_BITRATE_KBPS`, `AUDIO_BITRATE_KBPS`, `VIDEO_FPS`.

Galereyadan tanlangan yoki telefon kamerasida olingan video to’rtburchak bo’ladi —
u ham doira ichida ko’rsatiladi, chetlari qirqiladi. To’liq kadrni admin ko’ra oladi.

### “📹 Kamerada yozish” ikki xil ishlaydi

| Qachon | Nima bo'ladi | Natija |
|---|---|---|
| **HTTPS yoki `localhost`** | Brauzer ichida doira yozuvchi ochiladi: jonli ko'rinish, ⏺/⏹, taymer `00:12 / 00:30` | **Kvadrat** 480×480 video |
| **Oddiy HTTP** (telefondan IP orqali) | Qurilmaning o'z kamera ilovasi ochiladi | To'rtburchak video (doira ichida ko'rsatiladi) |

Sabab: brauzer ichidagi yozuvchi (`getUserMedia`) xavfsizlik talabi bo'yicha faqat
`localhost` yoki **HTTPS** da ishlaydi. Telefondan `http://192.168.x.x:5175` orqali
kirilganda brauzer kameraga ruxsat bermaydi, shuning uchun tizim kamerasiga o'tiladi —
u HTTP da ham muammosiz ishlaydi.

**Ya'ni: HTTPS o'rnatsangiz, telefonda ham haqiqiy yumaloq video yoziladi.**
Buning uchun kodni o'zgartirish shart emas — o'zi shunday ishlaydi.

Ikkala holatda ham yozib bo'lgach video ko'rib chiqish oynasiga tushadi —
ko'rasiz, izoh yozasiz, keyin **Yuborish**.

Kamera bilan bog'liq xatolar o'zbekcha va nima qilish kerakligi aytiladi:
ruxsat berilmadi / kamera topilmadi / kamera band.

## Ma'lumotlar bazasi

Node.js ning ichki `node:sqlite` moduli ishlatilgan — hech qanday native kompilyatsiya kerak emas
(Node.js **22.5+** talab qilinadi, tavsiya: 24+).

**Jadvallar:** `schools` (maktablar) · `users` (hisoblar) · `user_photos` (profil rasmlari) ·
`sessions` (kirish sessiyalari) · `videos` (yuborilgan videolar) · `login_attempts`

**Zaxira nusxa:** `data/` papkasini nusxalash kifoya (server to'xtagan holatda).

## Loyiha tuzilishi

```
server/
  index.js          — Express server, sahifalar marshruti
  config.js         — .env sozlamalari
  db.js             — SQLite sxemasi, migratsiyalar, tasodifiy admin paroli
  auth.js           — parol hash, parol qoidalari, sessiya, brute force himoyasi
  storage.js        — video saqlash (db / disk)
  util/date.js      — Toshkent vaqti bo'yicha sana hisoblari
  routes/
    auth.js         — kirish, chiqish, parol
    videos.js       — kalendar, video yuborish, oqim
    admin.js        — davomat, maktablar, videolar boshqaruvi
    profile.js      — profil ma'lumotlari va rasmi
public/
  login.html · index.html · admin.html · parol.html · royxat.html
  css/styles.css
  js/common.js · login.js · app.js · admin.js · parol.js · royxat.js
  img/logo.png · img/mark.png · img/apple-touch-icon.png
```

## Ishlab chiqarishga chiqarish (production)

1. `.env` da `NODE_ENV=production` qo'ying (sessiya kaliti avtomatik yaratiladi).
2. Oldiga **HTTPS** bilan nginx/Caddy qo'ying (kamerada yozish uchun ham shart).
3. Serverni `pm2` yoki `systemd` bilan doimiy ishlatib turing:
   ```bash
   npx pm2 start server/index.js --name kmdavomat
   ```
4. `data/` papkasini muntazam zaxiralang.
