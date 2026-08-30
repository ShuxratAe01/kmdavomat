# kmdavomat — video orqali kunlik davomat tizimi

Xodimlar bir marta login qilib kiradi, o'z sahifasida bugungi sanani va oylik kalendarni ko'radi.
Kalendarda **video yuborilgan kunlar yashil**, **yuborilmagan kunlar qizil** bo'lib turadi.
Pastdagi tugma orqali video yuboriladi — video to'g'ridan-to'g'ri **admin panelga** tushadi.

## Tez ishga tushirish

```bash
npm install
npm start
```

Brauzerda oching: **http://localhost:5175**

Birinchi ishga tushganda admin akkaunt avtomatik yaratiladi va terminalga chiqadi:

| Login | Parol |
|---|---|
| `admin` | `admin123` |

> ⚠️ Kirgach parolni albatta o'zgartiring (Sozlamalar → Parolni o'zgartirish),
> yoki `.env` faylida `ADMIN_PASSWORD` ni belgilab, `data/app.db` ni o'chirib qayta ishga tushiring.

## Ishlash tartibi

1. **Admin** admin panelga kiradi → “Xodimlar” → **+ Yangi xodim** → F.I.Sh., login va parol beradi.
2. **Xodim** o'sha login/parol bilan kiradi. Sessiya 90 kun saqlanadi — har safar qayta kirish shart emas.
3. Xodim sahifasida: bugungi sana → oylik kalendar (yashil/qizil) → **🎬 Video yuborish** tugmasi.
4. Video yuborilgach o'sha kun kalendarda darhol yashil bo'ladi va admin panelda ko'rinadi.
5. Admin videoni ko'radi, yuklab oladi, **Qabul qilish / Rad etish** qiladi.

## Sahifalar

| Manzil | Kim uchun | Nima bor |
|---|---|---|
| `/login` | hamma | Login va parol |
| `/` | xodim | Bugungi sana, oylik kalendar, video yuborish, o'z videolari |
| `/admin` | admin | Bugungi davomat, videolar, xodimlarni boshqarish |

### Xodim sahifasi
- Yuqorida bugungi sana + hafta kuni + bugungi holat
- Oylik kalendar: **yashil** = yuborilgan, **qizil** = yuborilmagan, **kulrang** = kelgusi kun
- Oylar orasida `‹ ›` bilan yurish, oylik statistika (bajarilish foizi)
- Video yuborish: **fayl/kamera tanlash** yoki **brauzerda yozib olish** — maksimal **30 soniya**
- Yuborishdan oldin ko'rib chiqish, izoh qo'shish, yuklanish foizi
- O'z videolarini qayta ko'rish va yuklab olish
- Parolni o'zgartirish

### Admin panel
- **📊 Bugungi davomat** — kim yuborgan / kim yubormagan, sana bo'yicha, oylik hisob
- **🎬 Videolar** — xodim / sana oralig'i / holat bo'yicha filtr, ko'rish, yuklab olish, o'chirish, qabul/rad
- **👥 Xodimlar** — qo'shish, tahrirlash, parolni tiklash, bloklash, o'chirish, har birining kalendari

## Sozlash (`.env`)

`.env.example` dan nusxa oling:

```bash
cp .env.example .env
```

| O'zgaruvchi | Standart | Izoh |
|---|---|---|
| `PORT` | `3000` | Server porti |
| `SESSION_SECRET` | — | **Ishlab chiqarishda albatta o'zgartiring** |
| `SESSION_DAYS` | `90` | Sessiya necha kun saqlanadi |
| `TZ_NAME` | `Asia/Tashkent` | Sanalar shu mintaqa bo'yicha hisoblanadi |
| `STORAGE` | `db` | `db` = SQLite ichida, `disk` = `uploads/` papkada |
| `MAX_VIDEO_SECONDS` | `30` | Bitta video uchun maksimal davomiylik |
| `CAMERA_FACING` | `user` | `user` = oldingi (selfi) kamera, `environment` = orqadagi |
| `MAX_VIDEO_MB` | `60` | Bitta video uchun maksimal hajm |
| `ALLOW_MULTIPLE_PER_DAY` | `false` | Kuniga bir nechta video yuborishga ruxsat |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `admin123` | Birinchi admin |
| `NODE_ENV` | — | `production` bo'lsa cookie faqat HTTPS orqali yuriladi |

### Videolarni qayerda saqlash

Standart holatda videolar **SQLite bazasi ichida** (`data/app.db`) saqlanadi — hammasi bitta faylda,
zaxira nusxa olish oson. Videolar ko'payib baza fayli kattalashib ketsa (masalan 5–10 GB dan oshsa),
`.env` da `STORAGE=disk` qilib qo'ying — yangi videolar `uploads/YYYY-MM/` papkasiga tushadi,
bazada faqat ma'lumotlari qoladi. Eski videolar baribir ishlayveradi (har bir yozuvda qayerda
turgani belgilab qo'yiladi).

## Telefonda ishlatish

Server va telefon bitta Wi-Fi tarmoqda bo'lsa, ishga tushirishda chiqadigan
`http://192.168.x.x:5175` manzilini telefonda oching.

### “📹 Kamerada yozish” qurilmaga qarab ishlaydi

| Qurilma | Nima bo'ladi |
|---|---|
| **Telefon / planshet** | Qurilmaning **o'z kamera ilovasi** ochiladi — darhol yozishga tayyor |
| **Kompyuter** | **Brauzer ichida** yozuvchi oyna: jonli ko'rinish, ⏺ boshlash / ⏹ to'xtatish, qizil chiroqli taymer `00:12 / 00:30` |

Ikkala holatda ham yozib bo'lgach video darhol ko'rib chiqish oynasiga tushadi —
ko'rasiz, izoh yozasiz, keyin **Yuborish**.

**Nega ikki xil yo'l:** brauzer ichidagi yozuvchi (`getUserMedia`) faqat `localhost` yoki
**HTTPS** da ishlaydi. Telefondan `http://192.168.x.x:5175` orqali kirilganda brauzer
kameraga ruxsat bermaydi — shuning uchun telefonda ataylab tizim kamerasi ishlatiladi.
U oddiy HTTP da ham muammosiz ishlaydi va sifati ham yaxshiroq.

Keyinchalik loyihani HTTPS bilan internetga chiqarsangiz, [public/js/app.js](public/js/app.js)
dagi `IS_MOBILE` tekshiruvini olib tashlash bilan telefonda ham brauzer ichida yozishni yoqasiz.

Kamera bilan bog'liq xatolar o'zbekcha va nima qilish kerakligi aytiladi:
ruxsat berilmadi / kamera topilmadi / kamera band.

## Ma'lumotlar bazasi

Node.js ning ichki `node:sqlite` moduli ishlatilgan — hech qanday native kompilyatsiya kerak emas
(Node.js **22.5+** talab qilinadi, tavsiya: 24+).

**Jadvallar:** `users` (xodimlar) · `sessions` (kirish sessiyalari) · `videos` (yuborilgan videolar)

**Zaxira nusxa:** `data/` papkasini nusxalash kifoya (server to'xtagan holatda).

## Loyiha tuzilishi

```
server/
  index.js          — Express server, sahifalar marshruti
  config.js         — .env sozlamalari
  db.js             — SQLite sxemasi, admin seed
  auth.js           — parol hash, sessiya, ruxsat tekshiruvlari
  storage.js        — video saqlash (db / disk)
  util/date.js      — Toshkent vaqti bo'yicha sana hisoblari
  routes/
    auth.js         — kirish, chiqish, parol
    videos.js       — kalendar, video yuborish, oqim
    admin.js        — davomat, xodimlar, videolar boshqaruvi
public/
  login.html · index.html · admin.html
  css/styles.css
  js/common.js · login.js · app.js · admin.js
```

## Ishlab chiqarishga chiqarish (production)

1. `.env` da `SESSION_SECRET` ni uzun tasodifiy satrga almashtiring, `NODE_ENV=production` qo'ying.
2. Oldiga **HTTPS** bilan nginx/Caddy qo'ying (kamerada yozish uchun ham shart).
3. Serverni `pm2` yoki `systemd` bilan doimiy ishlatib turing:
   ```bash
   npx pm2 start server/index.js --name kmdavomat
   ```
4. `data/` papkasini muntazam zaxiralang.
