# UZStar Complete 2.9 Pro — tayyor mahalliy loyiha

UZStar — o‘zbek tilidagi video platforma uchun **front-end + mahalliy backend** prototipi. Python serveri va SQLite ma’lumotlar bazasi yordamida foydalanuvchi video yuklashi, videoni saqlashi, ko‘rishlar sonini hisoblash va izohlarni serverda saqlash mumkin. Bu hali ommaviy internet platformasi emas: akkauntlar, ruxsatlar va bir nechta foydalanuvchi uchun xavfsiz moderatsiya hali yo‘q.

## Tavsiya etiladigan ishga tushirish — to‘liq mahalliy backend bilan

1. ZIP faylni yuklab oling va **Extract All / Hammasini chiqarish** qiling.
2. Yangi papkani oching.
3. `run_uzstar.bat` faylini ikki marta bosing. U bo‘sh port tanlab, serverni ishga tushiradi va brauzerda manzilni ochadi.
4. Faqat shu yangi ochilgan manzildan foydalaning; server oynasini yopmang.
5. Serverni to‘xtatish uchun server oynasida `Ctrl + C` bosing.

**Qo‘shimcha paket o‘rnatish shart emas** — server Python standart kutubxonalaridan foydalanadi. Python 3.10 yoki undan yangiroq versiya tavsiya qilinadi.

Server birinchi ishga tushganda avtomatik ravishda `data` papkasi, SQLite bazasi va video saqlash papkasini yaratadi. `data` ichidagi fayllarni o‘chirmasangiz, server yuklagan videolar va izohlar saqlanib qoladi.

## Faqat interfeysni sinash

`index.html` faylini Chrome yoki Edge’da to‘g‘ridan-to‘g‘ri ochish ham mumkin. Bunda server API mavjud bo‘lmaydi: yuklangan videolar mahalliy brauzer xotirasidan foydalanadi, serverda saqlanmaydi. Eng to‘liq tajriba uchun yuqoridagi `python server.py` usulidan foydalaning.

## Ishlaydigan funksiyalar

- Bosh sahifa, Shorts, Obunalar, Profil, Ko‘rilganlar, Yoqtirganlar va Keyin ko‘rish menyulari.
- Mobil ekranda ochilib-yopiladigan yon menyu, yorug‘ va qorong‘i mavzu.
- Qidiruv, kategoriya filtri, tavsiya/nom/mashhurlik bo‘yicha saralash.
- Kengaytirilgan player: 10 soniya oldinga/orqaga, tezlik, ovoz boshqaruvi, takrorlash, kino rejimi, mini-pleyer, to‘liq ekran, klaviatura yorliqlari va Media Session boshqaruvlari (brauzer qo‘llasa).
- Tomosha holatini avtomatik saqlash va `Davom ettirish` bo‘limida to‘xtagan joyidan davom etish.
- Player ichida mos videolar navbati, oldingi/keyingi video va ixtiyoriy avtomatik keyingi video.
- Layk, Keyin ko‘rish, ulashish, izoh va demo shikoyat amallari.
- Shorts’da oldingi/keyingi video, layk, saqlash, izoh va ulashish.
- Profil ismi va bio ma’lumotlarini tahrirlash; akkauntning foydalanuvchi nomi o‘zgarmas identifikator sifatida qoladi.
- Profil rasmi va muqova rasmini yuklash, oldindan ko‘rish va olib tashlash.
- Hudud, veb-sayt havolasi va profil statistikasi. Qo‘shimcha profil maydonlari hozircha shu brauzerda saqlanadi.
- Video faylini tanlash, sarlavha/kategoriya/tavsif berish va video o‘chirish.
- `python server.py` bilan: videolarni diskka saqlash, SQLite metadata/izohlar, ko‘rishlar, foydalanuvchi akkauntlari, serverda saqlanadigan layklar va kanal obunalari API.
- Ro‘yxatdan o‘tish/kirish: PBKDF2-HMAC-SHA256 parol xeshi, tasodifiy HttpOnly session cookie, 14 kunlik sessiya va login urinishlariga cheklov.
- Video egasi nazorati: hisobga kirgan foydalanuvchi boshqa akkaunt videosini o‘chira olmaydi. Mehmon yuklagan kontent esa lokal prototip sifatida boshqariladi.
- Video oqimi HTTP Range so‘rovlarini qo‘llaydi, shuning uchun pleyer video ichida oldinga-orqaga o‘tishi mumkin.
- API: qidiruv, kategoriya, saralash, sahifalash (`page`, `limit`), health va user profile endpointlari.
- UI’da yumshoq animatsiyalar va `prefers-reduced-motion` sozlamasi bor; harakatni kamaytirishni tanlagan foydalanuvchiga animatsiyalar o‘chadi.
- Server ishlamasa ham, brauzerga tegishli layklar, profil, tarix va mahalliy videolar IndexedDB/localStorage orqali ishlashi mumkin.
- `Ctrl + K` — qidiruvga o‘tish; Shorts’da `↑` / `↓` — video almashtirish; playerda `Space` — ijro/to‘xtatish, `←`/`→` — 10 soniya, `M` — ovoz, `F` — to‘liq ekran, `0–9` — vaqt foiziga o‘tish.
- PWA manifest va service worker — `localhost`da interfeys fayllarini offline keshlashga yordam beradi.

## Fayllar

- `index.html` — sahifa tuzilishi
- `style.css` — zamonaviy dizayn, responsiv ko‘rinish va mavzular
- `app.js` — menyular, pleyer, qidiruv va API bilan aloqa
- `server.py` — Python backend, video yuklash, SQLite va izohlar API’si
- `run_uzstar.bat` — Windows’da serverni va brauzerni qulay ishga tushirish
- `manifest.webmanifest` — PWA sozlamalari
- `sw.js` — statik fayllar uchun offline-kesh
- `icon.svg` — UZStar belgisi
- `data/` — server ishlaganda avtomatik yaratiladi; videolar va baza shu yerda saqlanadi

## Muhim xavfsizlik va ishlab chiqarishga tayyorlash eslatmasi

- Server sukut bo‘yicha faqat `127.0.0.1` manziliga ulanadi — ya’ni shu kompyuterdan foydalanish uchun. Uni hozircha internetga ochmang.
- Bu hali ommaviy ishlab chiqarish uchun tayyor emas. Akkauntlar va video egasi nazorati lokal MVP darajasida; internetga ochishdan oldin HTTPS, reverse proxy, CSRF himoyasi, xavfsiz konfiguratsiya, virus tekshiruvi, moderatsiya, backup va yuklama testlari talab qilinadi.
- Yuklash hajmi 150 MB bilan cheklangan. Server faylni diskda saqlaydi; internetdagi CDN, video transkodlash, moslashuvchan sifatlar va katta trafik boshqaruvi hali yo‘q.
- Namuna videolari demo kontent bo‘lib, mahalliy `assets/uzstar-demo.mp4` faylidan foydalanadi; tashqi video manbasiga qaram emas.
- Ommaviy ishga tushirishdan oldin autentifikatsiya, avtorizatsiya, CSRF/so‘rov cheklovlari, virus tekshiruvi, moderatsiya, HTTPS, zaxira nusxa, loglar va yuklama sinovlari qo‘shilishi shart.
- Faqat o‘zingiz yaratgan yoki tarqatish huquqiga ega bo‘lgan videolarni joylang.

## Tekshiruv

`app.js` JavaScript sintaksis tekshiruvidan, `server.py` esa Python kompilyatsiya tekshiruvidan o‘tkazildi. Mahalliy HTTP integratsion sinovlarida ro‘yxatdan o‘tish, sessiya, profil ismini yangilash, akkaunt bilan video yuklash, izoh, layk, video ro‘yxati, byte-range oqimi va boshqa foydalanuvchi videosini o‘chirishga ruxsat berilmasligi tekshirildi. Chromium orqali sahifa navigatsiyasi, qidiruv, modallar, pleyer tugmalari, mobil menyu, viewportlar (320–1920 px) va brauzer back/forward navigatsiyasi tekshirildi. Bu ommaviy ishlab chiqarish yuklamasi va barcha qurilmalardagi sinovlarni almashtirmaydi.


## 2.0 dagi yangi sahifalar

- **Kashf et** — kategoriya va qidiruv bo‘yicha video topish.
- **Mashhur** — ko‘rishlar soni bo‘yicha saralash.
- **Ijodkorlar** — kanallarni ko‘rish; serverdagi haqiqiy akkauntlarga obuna bo‘lish.
- **Bildirishnomalar** — mahalliy faoliyat xabarlari.
- **Sozlamalar** — mavzuni o‘zgartirish, animatsiyani kamaytirish, tarixni tozalash, ma’lumotni JSON qilib eksport qilish.
- Pleyerda Space bilan pauza/ijro, chap/o‘ng strelka bilan 10 soniyalik qadamlar.

Yangi versiya mavjud eski `data/uzstar.sqlite3` bazasini saqlab qolishga mo‘ljallangan. Yangilashdan oldin `data` papkasini zaxiralang.


### 2.1 interfeys yangilanishi
- Kompyuterda chap menyu doimiy, telefonlarda menyu ☰ tugmasi orqali ochiladi.
- Har bir bo‘lim alohida `#home`, `#shorts`, `#settings` kabi manzilga ega; brauzerning orqaga/oldinga tugmalari bilan yurish mumkin.
- Ekran toraysa yuqori panel va video kartalari moslashadi. Animatsiyalar tizim sozlamasi yoki ilova ichidagi sozlama orqali kamaytiriladi.


## 2.2 yangilanishi
- Server holati interfeysda ko‘rsatiladi.
- Video yuklashda real foizli progress indikator bor.
- Akkaunt bilan kirgan foydalanuvchi profil ismini serverga saqlay oladi. Server rejimida video yuklash uchun tizimga kirish talab qilinadi.
- Video yuklagan akkaunt uchun egalik holati to‘g‘ri qaytariladi.
- Namuna video mahalliy fayldan ijro qilinadi.
- Asosiy kontentga o‘tish uchun accessibility havolasi qo‘shildi.


### 2.3 — navigatsiya barqarorligi
- Menyu tugmalari endi server va IndexedDB yuklanishidan oldin ishga tushadi.
- Agar server sekin javob bersa ham sahifalar o‘rtasida o‘tish to‘xtab qolmaydi.
- Offline kesh versiyasi yangilandi.
- Tekshiruv: `python test_uzstar.py` va `node --check app.js`.
- Ishga tushirish fayli 8000-port band bo‘lsa keyingi bo‘sh portni avtomatik tanlaydi. Brauzerda ochilgan manzilni aynan server oynasidagi manzil bilan solishtiring.


## UZStar 2.5 — navigatsiya tuzatishi

Menyu bosishlari endi bitta delegatsiyalangan router orqali boshqariladi; havolaning standart hash navigatsiyasi oldindan to‘xtatiladi, so‘ng sahifa va brauzer tarixi yangilanadi. Mobil menyu qatlamlari bosiladigan qilib aniq ajratildi. Brauzer kesh versiyasi `uzstar-shell-v25` ga yangilandi.


## 2.6 navigatsiya tuzatishi

Bu versiya eski brauzer Service Worker keshini olib tashlaydi va `app.js`/`style.css` fayllarini versiya parametri bilan yuklaydi. Saytni yangi papkaga oching va `run_uzstar.bat` orqali ishga tushiring. Agar eski sahifa ochiq qolgan bo‘lsa, o‘sha oynani yoping va bat fayl ochgan yangi manzilga kiring.


## 2.7 — player va tomosha oqimi

- Tomosha davomiyligi brauzerda saqlanadi; `Davom ettirish` bo‘limi to‘xtagan videolarni ko‘rsatadi.
- Player ichida tavsiya navbati, oldingi/keyingi video, avtomatik keyingi video, takrorlash, ovoz darajasi va 10 soniyalik qadamlar mavjud.
- Klaviatura yorliqlari, brauzer Media Session boshqaruvi va progress belgisi qo‘shildi.
- `node --check app.js`, Python kompilyatsiyasi, 13 ta backend smoke testi va Chromium UI smoke testi bajarildi.

Ochiq video platformalaridagi navbat, avtomatik ijro va klaviatura boshqaruvi kabi tanish UX tamoyillari o‘rganildi. UZStar kodi va ko‘rinishi loyihaning o‘ziga moslashtirilgan; tashqi platformaning kodini to‘liq nusxalash amalga oshirilmagan.


## 2.8 — navigatsiya va versiya yakuniy tekshiruvi

- UI versiya yorliqlari va statik fayl versiyalari 2.8.0 ga yangilandi; brauzerning eski CSS/JS keshi bilan bog‘liq chalkashlik kamayadi.
- Menyu bo‘limlari hash URL orqali ochiladi; sahifa nomi, faol menyu holati va tegishli kontent `setPage()` orqali yangilanadi.
- Backend smoke-testlar qayta bajarildi: autentifikatsiya, profil, video yuklash, izohlar, layklar, seek/range va video egaligi tekshirildi.
- Eslatma: internetdagi tashqi videolar, brauzer va hosting konfiguratsiyasi sababli har bir qurilmada “100% kafolat” berib bo‘lmaydi. Mahalliy namunaviy video va backend testlari ishlashi tasdiqlandi.

## Ochiq standartlar va foydalanish

UZStar mustaqil loyiha bo‘lib, YouTube interfeysi va logotipini aynan ko‘chirmaydi. YouTube videolarini ko‘rsatish kerak bo‘lsa, faqat ruxsat etilgan embed/API usullaridan foydalaning va YouTube talablariga rioya qiling.


## 2.9 — Profil Pro

- Profil rasmini va muqova rasmini fayldan tanlash, avtomatik kichraytirish.
- Bio, hudud va veb-sayt maydonlari.
- Profil sahifasida videolar, yoqtirilganlar va ko‘rilganlar statistikasi.
- Profilning qo‘shimcha maydonlari localStorage’da saqlanadi; boshqa qurilmalar bilan sinxronlash uchun server API kengaytirilishi kerak.
