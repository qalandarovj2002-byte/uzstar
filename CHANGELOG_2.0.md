# UZStar 2.0 — yangiliklar

- Kashf et, Mashhur, Ijodkorlar, Bildirishnomalar va Sozlamalar uchun alohida sahifalar.
- Ijodkorlar kartalari, serverdagi real akkauntlar ro‘yxati va obuna/obunadan chiqish amallari.
- Mahalliy bildirishnomalar, ma’lumotlarni JSON formatda eksport qilish, tarixni tozalash va brauzer ma’lumotlarini boshqarish.
- Qidiruv natijalarini Kashf et sahifasida ko‘rsatish, kanal videolariga o‘tish.
- Pleyer ochiq paytda Space bilan ijro/pauza, chap/o‘ng strelka bilan 10 soniya orqaga/oldinga.
- `prefers-reduced-motion` va sozlamadan animatsiyani kamaytirish.
- Backend `/api/creators` endpointi; versiya 2.0.

Bu versiya ham mahalliy MVP. Ommaviy deploydan oldin professional ASGI/WSGI server, HTTPS, CSRF himoyasi, virus skaneri, rate limiting, monitoring, backup va yuklama testlari kerak.


## 2.1 — Layout va navigatsiya
- Yuqori panel qayta joylashtirildi: qidiruv va amallar tor ekranlarda bir-birini bosmaydi.
- Desktop, planshet va telefon uchun alohida layout qoidalari; telefonda yon menyu overlay sifatida ochiladi.
- Menyu tugmalariga accessible label, title va faol sahifa holati qo‘shildi.
- Har bir sahifa uchun URL hash navigatsiyasi, refresh hamda brauzer back/forward qo‘llovi.
- Sahifalar orasida yengil animatsiya, reduced-motion sozlamasiga hurmat.
- Video kartalari, kategoriya chips, bo‘sh holat va kontent oralig‘i qayta muvozanatlandi.
