# UZStar 2.6 — sahifa kontenti va eski kesh muammosi

- `app.js` va `style.css` uchun `?v=2.6.0` cache-busting qo‘shildi.
- Eski cache-first Service Worker ro‘yxatdan chiqariladi va UZStar shell keshlari tozalanadi; bu eski JavaScript sabab URL o‘zgarib, kontent yangilanmasligi muammosini bartaraf etishga qaratilgan.
- Sahifa yo‘li `document.body.dataset.page` da aks ettiriladi.
- Navigatsiya testlari Chromium’da HTML/CSS/JS ichki joylashtirilgan holatda bajarildi, chunki test muhitida localhost navigatsiyasi bloklangan.

- `run_uzstar.bat` har ishga tushishda bo‘sh, yangi port tanlaydi; shu yo‘l bilan eski portda qolgan Service Worker keshidan ajraladi.
- Backend statik javoblariga `no-store` kesh sarlavhalari qo‘shildi.
