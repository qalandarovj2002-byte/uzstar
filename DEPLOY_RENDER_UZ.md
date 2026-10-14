# UZStar — Render orqali internetga chiqarish

## 1. Render'ga ulash
1. https://render.com saytiga kiring va GitHub orqali ro'yxatdan o'ting.
2. **New + → Blueprint** ni tanlang.
3. `qalandarovj2002-byte/uzstar` repozitoriyasini ulang.
4. Render `render.yaml` faylini o'qib xizmat rejasini ko'rsatadi. Tasdiqlashdan oldin narxini tekshiring.
5. Deploy tugaguncha **Events/Logs** bo'limini kuzating.
6. Render bergan `https://...onrender.com` manzilini ochib bosh sahifa, kirish/ro'yxatdan o'tish, video player va video yuklashni sinang.

## 2. Nima sozlandi
- Server endi hosting bergan `PORT` muhit o'zgaruvchisini o'qiydi.
- Hostingda `0.0.0.0` manziliga bog'lanadi.
- `UZSTAR_DATA_DIR=/var/data` orqali SQLite baza va yuklangan videolar doimiy diskka yoziladi.
- `render.yaml` Render Blueprint sozlamasini beradi.

## 3. Muhim
- Blueprint'dagi `starter` reja va 10 GB disk pullik bo'lishi mumkin. Deployni tasdiqlashdan oldin Render ko'rsatgan narxni tekshiring.
- Bepul hostingda doimiy disk mavjud bo'lmasligi mumkin; ma'lumotlar va yuklangan videolar yo'qolishi ehtimoli bor.
- Bu birinchi ommaviy sinov deployi. Katta auditoriyaga ochishdan oldin video fayllar uchun object storage/CDN, muntazam zaxira nusxa, kontent moderatsiyasi, trafik va upload limitlarini qo'shish kerak.
