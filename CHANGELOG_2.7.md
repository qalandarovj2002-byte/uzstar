# UZStar 2.7 Pro — player va kontent funksiyalari

- Playerga 10 soniya oldinga/orqaga, oldingi/keyingi video, takrorlash, ovoz slayderi, mute, boshidan boshlash va klaviatura yordami qo‘shildi.
- Tomosha progressi localStorage’da saqlanadi; `Davom ettirish` bo‘limi va kartalardagi progress chizig‘i qo‘shildi.
- Player ichida keyingi videolar navbati va ixtiyoriy avtomatik keyingi video mavjud.
- Media Session API qo‘llab-quvvatlansa, qurilma/media klaviatura boshqaruvlari yoqiladi.
- Player oynasi allaqachon ochiq bo‘lsa, navbatdan video tanlashda `showModal()` qayta chaqirilmaydi.
- Ochiq platformalardagi odatiy player/playlist tajribalaridan ilhomlanildi; UZStar’ga mos alohida implementatsiya.
- Tekshiruvlar: JS syntax, Python compile, 13 backend test, Chromium UI smoke test (12 sahifa, player queue, loop/autoplay, like/save/comment, mobil menyu).
