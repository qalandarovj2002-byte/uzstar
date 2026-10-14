# UZStar 1.5 — yangilanishlar

## Interfeys
- Kartochkalar, dialoglar, tugmalar va navigatsiya uchun yengil animatsiyalar.
- `prefers-reduced-motion` qo‘llovi: foydalanuvchi animatsiyani kamaytirishni tanlasa, harakat o‘chadi.
- Hisobga kirish/ro‘yxatdan o‘tish oynasi va mobilga mos tugma.
- Profil sahifasida faqat joriy foydalanuvchining serverdagi videolari ko‘rsatiladi.

## Backend
- SQLite migratsiyasi: avvalgi 1.0 bazasidagi video va izohlar saqlab qolinadi.
- PBKDF2-HMAC-SHA256 bilan parol xeshlash, random session token, HttpOnly/SameSite cookie va login urinishlarini cheklash.
- Foydalanuvchi sessiyasi, ro‘yxatdan o‘tish, kirish, chiqish, profil, layk va obuna API’lari.
- Video egasiga qarab o‘chirish ruxsati.
- Qidiruv, kategoriya filtri, saralash va sahifalash.
- HTTP byte-range video oqimi: pleyerda seek qilish mumkin.
- Asosiy xavfsizlik javob sarlavhalari, bir xil origin tekshiruvi va SQLite WAL.

## Tekshiruvlar
- `node --check app.js`
- `python -m py_compile server.py`
- HTTP integratsiya sinovlari: health, akkaunt, sessiya, upload, izoh, layk, qidiruv, range-streaming va video egasi nazorati.

## Cheklovlar
Bu lokal MVP. Ommaviy ishlab chiqarishga chiqarishdan oldin HTTPS, reverse proxy, zaxira nusxalar, virus tekshiruvi, moderatsiya, audit log, email/parolni tiklash, CSRF himoyasi, monitoring va katta fayllar uchun oqimli upload talab qilinadi.
