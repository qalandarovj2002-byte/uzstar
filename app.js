'use strict';

/* UZStar 2.7 — boyitilgan player, tomosha davomiyligi va tavsiya navbati. */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const STORAGE = {
  profile: 'uzstar_profile', liked: 'uzstar_liked', viewed: 'uzstar_viewed',
  later: 'uzstar_watchlater', comments: 'uzstar_comments', uploads: 'uzstar_upload_meta',
  theme: 'uzstar_theme', progress: 'uzstar_progress'
};
const palettes = {
  music: ['linear-gradient(135deg,#642f94,#e54f93)', '♫', 'MUSIQA'],
  learn: ['linear-gradient(135deg,#0c7887,#38d7b5)', '⌘', 'YANGI BILIM'],
  game: ['linear-gradient(135deg,#2e327e,#8c5cff)', '✦', 'GAMING'],
  cinema: ['linear-gradient(135deg,#6e263a,#ec7955)', '▶', 'KINODAN LAVHA'],
  life: ['linear-gradient(135deg,#28694f,#b2a64b)', '☼', 'HAYOT TARZI'],
  tech: ['linear-gradient(135deg,#1b4979,#37b9ce)', '⌁', 'TEXNOLOGIYA'],
  travel: ['linear-gradient(135deg,#225a88,#50d3d0)', '⌖', 'SAYOHAT']
};
const demoVideo = 'assets/uzstar-demo.mp4';
const seedVideos = [
  {id:'s1',title:'Samarqand: tarix va go‘zallik bir joyda',channel:'O‘zbekiston bo‘ylab',views:'24 ming',viewCount:24000,age:'2 kun oldin',duration:'08:42',category:'Hayot tarzi',palette:'travel',icon:'🏛️',description:'O‘zbekistonning betakror maskanlariga virtual sayohat.',short:false,videoUrl:demoVideo},
  {id:'s2',title:'Uy sharoitida musiqa yozishni boshlash',channel:'Studio UZ',views:'12 ming',viewCount:12000,age:'5 soat oldin',duration:'12:08',category:'Musiqa',palette:'music',icon:'🎙️',description:'Musiqa yaratishga qiziqqanlar uchun foydali maslahatlar.',short:false,videoUrl:demoVideo},
  {id:'s3',title:'Python dasturlash: birinchi qadam',channel:'Kodchi',views:'8,4 ming',viewCount:8400,age:'1 kun oldin',duration:'16:30',category:'Ta’lim',palette:'learn',icon:'💻',description:'Dasturlashni noldan o‘rganishni boshlaymiz.',short:false,videoUrl:demoVideo},
  {id:'s4',title:'Yangi o‘yinlar va qiziqarli lahzalar',channel:'Game Arena UZ',views:'36 ming',viewCount:36000,age:'3 kun oldin',duration:'09:17',category:'O‘yinlar',palette:'game',icon:'🎮',description:'O‘yinlar olamidagi eng qiziqarli lahzalar.',short:false,videoUrl:demoVideo},
  {id:'s5',title:'Katta maqsadlar kichik qadamlardan boshlanadi',channel:'Motivatsiya 24',views:'51 ming',viewCount:51000,age:'6 soat oldin',duration:'05:21',category:'Hayot tarzi',palette:'life',icon:'🚀',description:'Har kuni ozgina harakat — katta natija.',short:false,videoUrl:demoVideo},
  {id:'s6',title:'Telefon tanlashda 5 ta muhim maslahat',channel:'Tech UZ',views:'19 ming',viewCount:19000,age:'4 kun oldin',duration:'11:05',category:'Texnologiya',palette:'tech',icon:'📱',description:'Telefon sotib olishdan oldin nimalarga qarash kerak?',short:false,videoUrl:demoVideo},
  {id:'s7',title:'30 soniyada kayfiyatingni ko‘tar!',channel:'UZStar Shorts',views:'102 ming',viewCount:102000,age:'1 soat oldin',duration:'0:30',category:'Hayot tarzi',palette:'life',icon:'✨',description:'Yaxshi kun o‘zingdan boshlanadi.',short:true,videoUrl:demoVideo},
  {id:'s8',title:'Bir daqiqada foydali kod siri',channel:'Kodchi',views:'44 ming',viewCount:44000,age:'8 soat oldin',duration:'0:45',category:'Ta’lim',palette:'learn',icon:'⌨️',description:'Dasturlashni osonlashtiradigan kichik maslahat.',short:true,videoUrl:demoVideo}
];
const safeRead = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const saveJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { toast('Brauzer xotirasida joy yetarli emas.'); return false; } };
const liked = new Set(safeRead(STORAGE.liked, []));
const viewed = new Set(safeRead(STORAGE.viewed, []));
const watchLater = new Set(safeRead(STORAGE.later, []));
let comments = safeRead(STORAGE.comments, {});
let profile = safeRead(STORAGE.profile, {name:'UZStar foydalanuvchisi',handle:'uzstar_user'});
let videos = [...seedVideos];
let activePage = 'home', activeCategory = 'Barchasi', activeVideo = null, activeChannel = '', creators = [], subscribedIds = new Set(), notifications = safeRead('uzstar_notifications', []), reducedMotion = safeRead('uzstar_reduced_motion', false);
let shortIndex = 0, profileTab = 'videos', sortMode = 0, toastTimer = null;
let progressMap = safeRead(STORAGE.progress, {});
let lastProgressWriteAt = 0;
let ignoreNextPause = false;
let autoplayNext = safeRead('uzstar_autoplay_next', false);
let resumeTarget = 0;
const blobUrls = new Map();
let db = null;
let apiAvailable = false;
let currentUser = null;
let authMode = 'login';

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function toast(message) {
  const el = $('#toast'); if (!el) return;
  el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}
function persistSet(key, set) { saveJSON(key, [...set]); }
function palette(video) { return palettes[video.palette] || palettes.tech; }
function readableViews(n = 0) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('uz-UZ',{maximumFractionDigits:1})} mln`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('uz-UZ',{maximumFractionDigits:1})} ming`;
  return String(n);
}
function thumb(video) {
  const p = palette(video);
  return `<div class="thumb"><div class="thumb-art" style="background:${p[0]}"><span class="art-tag">${esc(p[2])}</span><span class="art-icon">${esc(video.icon || p[1])}</span><span class="art-word">${esc(video.category || 'UZSTAR')}</span></div><span class="duration">${esc(video.duration || '--:--')}</span><div class="play-overlay"><span>▶</span></div></div>`;
}
function card(video) {
  const isMine = video.uploaded && (!video.serverBacked || video.isOwner);
  const progress = Number(progressMap[video.id]?.time || 0), total = Number(progressMap[video.id]?.duration || 0);
  const progressBar = progress > 0 && total > 0 && total > progress + 5 ? `<div class="card-progress" aria-label="${Math.round(progress/total*100)} foiz ko‘rilgan"><span style="width:${Math.max(1,Math.min(100,progress/total*100))}%"></span></div>` : ''; 
  const local = isMine ? '<span class="local-badge">Mening videom</span>' : '';
  return `<article class="video-card" data-id="${esc(video.id)}" tabindex="0" role="button" aria-label="${esc(video.title)} videosini ochish">${thumb(video)}${progressBar}<div class="card-info"><div class="channel-avatar">${esc((video.channel || 'U')[0].toUpperCase())}</div><div class="card-text"><h3 class="card-title">${esc(video.title)}</h3><p class="card-channel">${esc(video.channel || profile.name)} ${local}</p><p class="card-stats">${esc(video.views || readableViews(video.viewCount))} marta ko‘rildi · ${esc(video.age || 'hozir')}</p></div><button class="card-more" data-more="${esc(video.id)}" aria-label="Video amallari" aria-haspopup="menu" type="button">⋮</button></div></article>`;
}
function currentSearch() { return ($('#searchInput')?.value || '').trim().toLocaleLowerCase('uz'); }
function filteredVideos({includeShorts = false, page = activePage} = {}) {
  const query = currentSearch();
  let list = videos.filter(v => {
    let belongs = true;
    if (page === 'subscriptions') { const localSubs = safeRead('uzstar_local_subscriptions', []); belongs = (v.ownerId != null && subscribedIds.has(Number(v.ownerId))) || localSubs.includes(v.channel) || ['Kodchi','Studio UZ'].includes(v.channel); }
    else if (page === 'history') belongs = viewed.has(v.id);
    else if (page === 'continue') belongs = Number(progressMap[v.id]?.time || 0) > 5 && (!Number.isFinite(Number(progressMap[v.id]?.duration)) || Number(progressMap[v.id]?.duration) - Number(progressMap[v.id]?.time) > 5);
    else if (page === 'liked') belongs = liked.has(v.id);
    else if (page === 'watchlater') belongs = watchLater.has(v.id);
    else if (page === 'channel') belongs = (v.channel || '') === activeChannel;
    else if (page === 'trending') belongs = true;
    else if (page === 'explore') belongs = true;
    else if (page === 'profile') belongs = profileTab === 'liked' ? liked.has(v.id) : !!v.uploaded;
    const categoryMatch = !['home','explore'].includes(page) || activeCategory === 'Barchasi' || v.category === activeCategory;
    const queryMatch = !query || `${v.title} ${v.channel} ${v.category} ${v.description || ''}`.toLocaleLowerCase('uz').includes(query);
    return belongs && categoryMatch && queryMatch && (includeShorts || !v.short);
  });
  if (page === 'continue') list.sort((a,b)=>(Number(progressMap[b.id]?.updatedAt)||0)-(Number(progressMap[a.id]?.updatedAt)||0));
  else if (page === 'trending' || sortMode === 2) list.sort((a,b) => (b.viewCount || 0) - (a.viewCount || 0));
  else if (sortMode === 1) list.sort((a,b) => a.title.localeCompare(b.title, 'uz'));
  else list.sort((a,b) => Number(!!b.uploaded) - Number(!!a.uploaded));
  return list;
}
function bindCards(root) {
  if (!root || root.dataset.cardsBound === '1') return;
  root.dataset.cardsBound = '1';
  root.addEventListener('click', event => {
    const more = event.target.closest('[data-more]');
    if (more) { event.preventDefault(); event.stopPropagation(); showMore(more.dataset.more, more); return; }
    const item = event.target.closest('.video-card'); if (item) openVideo(item.dataset.id);
  });
  root.addEventListener('keydown', event => {
    const item = event.target.closest('.video-card');
    if (event.target.closest('button')) return;
    if (item && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openVideo(item.dataset.id); }
  });
}
function renderVideos() {
  const grid = $('#videoGrid'); if (!grid) return;
  const list = filteredVideos(); grid.innerHTML = list.map(card).join('');
  grid.classList.toggle('hidden', list.length === 0);
  $('#emptyState').classList.toggle('hidden', list.length !== 0);
  const emptyCopy = {
    history: ['Tarixingiz hozircha bo‘sh', 'Ochgan videolaringiz shu yerda ko‘rinadi.'],
    continue: ['Davom ettiradigan video yo‘q', 'Videoni ochib tomosha qiling. Keyingi safar to‘xtagan joyingiz saqlanadi.'],
    liked: ['Hali yoqtirilgan video yo‘q', 'Videodagi ♡ tugmasi orqali yoqtirganlaringizni saqlang.'],
    watchlater: ['Keyin ko‘rish ro‘yxati bo‘sh', 'Videodagi “Keyin ko‘rish” tugmasi bilan saqlang.'],
    subscriptions: ['Obunalarda video yo‘q', 'Ijodkorlar sahifasidan kanallarga obuna bo‘ling.'],
    trending: ['Hali mashhur videolar yo‘q', 'Ko‘rishlar soni oshgan videolar shu yerda ko‘rinadi.'],
    explore: ['Video topilmadi', 'Boshqa kategoriya yoki qidiruv so‘zini sinab ko‘ring.'],
    channel: ['Bu kanalda hozircha video yo‘q', 'Ijodkor yangi video joylaganda shu yerda ko‘rinadi.']
  };
  const copy = emptyCopy[activePage] || ['Hozircha hech narsa topilmadi', 'Boshqa so‘z bilan qidiring yoki videoni o‘zingiz yuklang.'];
  $('#emptyState h2').textContent = copy[0]; $('#emptyState p').textContent = copy[1];
  $('#emptyUpload').classList.toggle('hidden', !['home','subscriptions'].includes(activePage));
  if (activePage === 'history' && list.length === 0) $('#emptyUpload').classList.add('hidden');
}
const pageInfo = {
  home: ['Siz uchun','Bugun nimalarni tomosha qilamiz?'],
  continue: ['Davom ettirish','Oldin to‘xtatgan joyingizdan davom eting'],
  explore: ['Kashf et','Yangi mavzular, foydali videolar va yangi ijodkorlar'],
  trending: ['Mashhur videolar','Ko‘p tomosha qilinayotgan videolar'],
  channel: [ 'Kanal', 'Ijodkor videolari' ],
  subscriptions: ['Obunalar','Siz kuzatadigan kanallardan videolar'],
  history: ['Ko‘rilganlar','Yaqinda tomosha qilgan videolaringiz'],
  liked: ['Yoqtirganlar','Sizga yoqqan videolar'],
  watchlater: ['Keyin ko‘rish','Saqlab qo‘ygan videolaringiz']
};
function setPage(page, options = {}) {
  const valid = ['home','explore','trending','shorts','subscriptions','channels','profile','history','continue','liked','watchlater','notificationsPage','settings','channel'];
  if (!valid.includes(page)) page = 'home';
  activePage = page;
  document.body.dataset.page = page;
  const utility = ['channels','notificationsPage','settings'].includes(page);
  const profilePage = page === 'profile';
  const shortsPage = page === 'shorts';
  $('#main').classList.toggle('hidden', shortsPage || profilePage);
  $('#shortsPage').classList.toggle('hidden', !shortsPage);
  $('#profilePage').classList.toggle('hidden', !profilePage);
  $('#utilityPage').classList.toggle('hidden', !utility);
  $('#videoGrid').classList.toggle('hidden', utility);
  $('#emptyState').classList.toggle('hidden', utility);
  $('#chips').classList.toggle('hidden', !['home','explore'].includes(page));
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.page === page));
  const info = pageInfo[page];
  if (info) { $('#pageTitle').textContent = info[0]; $('#pageSubtitle').textContent = info[1]; }
  else if (page === 'channels') { $('#pageTitle').textContent = 'Ijodkorlar'; $('#pageSubtitle').textContent = 'O‘zingizga yoqqan kanallarni toping va kuzating'; }
  else if (page === 'notificationsPage') { $('#pageTitle').textContent = 'Bildirishnomalar'; $('#pageSubtitle').textContent = 'UZStar’dagi so‘nggi faolliklar'; }
  else if (page === 'settings') { $('#pageTitle').textContent = 'Sozlamalar'; $('#pageSubtitle').textContent = 'Ilovani o‘zingizga moslang'; }
  else if (page === 'profile') { $('#pageTitle').textContent = 'Profil'; $('#pageSubtitle').textContent = 'Shaxsiy sahifangiz'; }
  if (page === 'channel') { $('#pageTitle').textContent = activeChannel || 'Kanal'; $('#pageSubtitle').textContent = 'Ushbu ijodkor joylagan videolar'; }
  $('#filterBtn').classList.toggle('hidden', !['home','explore','trending','history','channel'].includes(page));
  if (page === 'history') { $('#sortLabel').textContent = 'Tarixni tozalash'; $('#filterBtn').title = 'Ko‘rish tarixini tozalash'; }
  else if (page === 'trending') { $('#sortLabel').textContent = 'Eng mashhur'; $('#filterBtn').title = 'Mashhurlik bo‘yicha tartiblangan'; }
  else { const labels = ['Tartib: tavsiya','Tartib: nomi A–Z','Tartib: mashhur']; $('#sortLabel').textContent = labels[sortMode]; $('#filterBtn').title = 'Videolar tartibini o‘zgartirish'; }
  if (utility) renderUtilityPage();
  else if (page === 'shorts') renderShort();
  else if (page === 'profile') renderProfile();
  else renderVideos();
  // Har bir bo‘limga to‘g‘ridan-to‘g‘ri URL hash beriladi: refresh va back/forward ishlaydi.
  if (options.updateHistory !== false) {
    const nextHash = `#${page}`;
    if (location.hash !== nextHash) history.pushState({page}, '', nextHash);
  }
  $$('.nav-item').forEach(button => {
    if (button.dataset.page === page) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  const visibleSurface = shortsPage ? $('#shortsPage') : profilePage ? $('#profilePage') : $('#main');
  if (visibleSurface && !reducedMotion) {
    visibleSurface.classList.remove('page-enter');
    void visibleSurface.offsetWidth;
    visibleSurface.classList.add('page-enter');
  }
  $('#sidebar').classList.remove('mobile-open'); $('#sidebarBackdrop')?.classList.remove('visible');
  $('#mobileMenu')?.setAttribute('aria-expanded', 'false');
  window.scrollTo({top:0,behavior: reducedMotion ? 'auto' : 'smooth'});
}
function addNotification(title, detail, type='info') {
  notifications.unshift({id:Date.now()+'_'+Math.random().toString(36).slice(2,6), title, detail, type, at:new Date().toLocaleString('uz-UZ')});
  notifications = notifications.slice(0,50); saveJSON('uzstar_notifications', notifications);
}
function renderUtilityPage() {
  const box = $('#utilityPage'); if (!box) return;
  if (activePage === 'channels') {
    const unique = [...new Map(videos.map(v => [v.channel || 'UZStar', {name:v.channel || 'UZStar', videos:videos.filter(x => (x.channel||'UZStar') === (v.channel||'UZStar')).length, latest:v}])).values()];
    const real = creators.map(c => ({id:c.id, name:c.displayName, handle:'@'+c.username, videos:c.videoCount, followers:c.followers, subscribed:c.subscribed, isSelf:c.isSelf, real:true}));
    const realNames = new Set(real.map(c=>c.name.toLocaleLowerCase('uz')));
    const samples = unique.filter(c=>!realNames.has(c.name.toLocaleLowerCase('uz'))).map(c=>({name:c.name,handle:'UZStar ijodkori',videos:c.videos,followers:0,subscribed:false,real:false}));
    const list = [...real,...samples];
    box.innerHTML = `<div class="utility-intro"><div class="utility-icon">♙</div><div><h2>Ijodkorlarni kashf eting</h2><p>Obuna bo‘ling, ularning videolarini oson toping. Haqiqiy akkauntlar server orqali sinxronlanadi.</p></div></div><div class="creator-grid">${list.map((c,i)=>`<article class="creator-card"><div class="creator-avatar">${esc((c.name||'U').slice(0,1).toUpperCase())}</div><h3>${esc(c.name)}</h3><p>${esc(c.handle)}</p><div class="creator-stats"><span>${c.videos||0} video</span><span>${c.followers||0} obunachi</span></div><div class="creator-actions"><button class="secondary-btn" data-channel-view="${esc(c.name)}">Videolar</button>${c.real&&!c.isSelf?`<button class="primary-btn" data-subscribe="${c.id}" data-subscribed="${c.subscribed?'true':'false'}">${c.subscribed?'✓ Obuna':'＋ Obuna'}</button>`:`<button class="secondary-btn" data-channel-save="${esc(c.name)}">${safeRead('uzstar_local_subscriptions',[]).includes(c.name)?'✓ Kuzatilyapti':'＋ Kuzatish'}</button>`}</div></article>`).join('')}</div>`;
  } else if (activePage === 'notificationsPage') {
    box.innerHTML = `<div class="utility-intro"><div class="utility-icon">♧</div><div><h2>Bildirishnomalar</h2><p>Yangi faolliklar shu sahifada ko‘rinadi.</p></div><button class="secondary-btn" id="clearNotifications">Hammasini tozalash</button></div>${notifications.length?`<div class="notification-list">${notifications.map(n=>`<article class="notification-card"><span class="notification-symbol">${n.type==='upload'?'↑':n.type==='like'?'♥':n.type==='comment'?'☰':'✦'}</span><div><strong>${esc(n.title)}</strong><p>${esc(n.detail)}</p><small>${esc(n.at||'')}</small></div></article>`).join('')}</div>`:'<div class="empty-utility"><div>✦</div><h2>Hozircha bildirishnoma yo‘q</h2><p>Video yuklash yoki boshqa amallar bajarganingizda shu yerda xabarlar paydo bo‘ladi.</p></div>'}`;
  } else {
    box.innerHTML = `<div class="settings-grid"><section class="settings-card"><div class="settings-icon">☼</div><div><h2>Ko‘rinish</h2><p>Qorong‘i yoki yorug‘ mavzuni tanlang.</p></div><button class="secondary-btn" id="settingsTheme">${document.body.classList.contains('light-theme')?'Qorong‘i rejim':'Yorug‘ rejim'}</button></section><section class="settings-card"><div class="settings-icon">✧</div><div><h2>Animatsiyalar</h2><p>Harakatlarni kamaytirib, qulay ko‘rinishda foydalaning.</p></div><label class="switch-label"><input id="motionToggle" type="checkbox" ${reducedMotion?'checked':''}><span>Kamaytirish</span></label></section><section class="settings-card"><div class="settings-icon">◷</div><div><h2>Ko‘rish tarixi</h2><p>${viewed.size} ta video qurilmangizdagi tarixda saqlangan.</p></div><button class="secondary-btn" id="clearHistorySettings">Tarixni tozalash</button></section><section class="settings-card"><div class="settings-icon">⇩</div><div><h2>Ma’lumotlarni eksport qilish</h2><p>Profil, saqlangan videolar va sozlamalarni JSON faylga olish.</p></div><button class="primary-btn" id="exportData">Eksport</button></section><section class="settings-card"><div class="settings-icon">⌫</div><div><h2>Mahalliy ma’lumotlar</h2><p>Faqat brauzerda saqlangan ma’lumotlarni tozalaydi; serverdagi videolar o‘chmaydi.</p></div><button class="danger-btn" id="clearLocalData">Mahalliy ma’lumotni tozalash</button></section><section class="settings-card"><div class="settings-icon">ⓘ</div><div><h2>UZStar haqida</h2><p>UZStar — O‘zbekistonda video tomosha qilish va ijodkorlarni qo‘llab-quvvatlash uchun ishlab chiqilayotgan MVP.</p></div><span class="version-pill">Versiya 2.6</span></section></div>`;
  }
}
async function loadCreators() {
  if (!apiAvailable) return;
  try { const r=await fetch('/api/creators',{cache:'no-store'}); if(r.ok){const d=await r.json();creators=d.creators||[];} } catch(e){ console.warn('Ijodkorlarni yuklab bo‘lmadi',e); }
}

function updateWatchButton() {
  if (!activeVideo) return;
  const saved = watchLater.has(activeVideo.id);
  $('#watchLaterBtn').textContent = saved ? '✓ Saqlangan' : '＋ Keyin ko‘rish';
  $('#watchLaterBtn').classList.toggle('liked', saved);
}
async function loadServerComments(video) {
  if (!video?.serverBacked || !apiAvailable) return;
  try {
    const response = await fetch(`/api/videos/${video.serverId}/comments`);
    if (!response.ok) return;
    const data = await response.json();
    if (activeVideo?.id !== video.id) return;
    comments[video.id] = data.comments || [];
    renderComments();
  } catch (error) { console.warn('Izohlarni serverdan olib bo‘lmadi:', error); }
}
async function loadServerVideos() {
  const status = $('#serverStatus');
  if (status) { status.classList.remove('online'); status.innerHTML = '<i></i> Server tekshirilmoqda'; }
  try {
    const response = await fetch('/api/health', {cache:'no-store'});
    if (!response.ok) throw new Error('Server javobi noto‘g‘ri');
    const health = await response.json(); if (!health.ok) throw new Error('Server tayyor emas');
    apiAvailable = true;
    if (status) { status.classList.add('online'); status.innerHTML = '<i></i> Server ishlayapti'; status.title = 'Mahalliy serverga ulandi'; }
    const meResponse = await fetch('/api/me', {cache:'no-store'});
    if (meResponse.ok) {
      const me = await meResponse.json(); currentUser = me.user || null;
      // Server-backed likes are authoritative for the currently signed-in account.
      for (const id of [...liked]) if (String(id).startsWith('srv_')) liked.delete(id);
      (me.likedVideoIds || []).forEach(id => liked.add(`srv_${id}`));
      subscribedIds = new Set(me.subscriptions || []);
      persistSet(STORAGE.liked, liked);
      if (currentUser) profile = {...profile, name:currentUser.displayName, handle:currentUser.username};
      saveJSON(STORAGE.profile, profile); syncAuthUI();
    }
    const videosResponse = await fetch('/api/videos?limit=50&sort=new', {cache:'no-store'});
    if (!videosResponse.ok) return;
    const data = await videosResponse.json();
    videos = videos.filter(v => !String(v.id).startsWith('srv_'));
    videos.push(...(data.videos || []));
    await loadCreators();
  } catch { apiAvailable = false; if (status) { status.classList.remove('online'); status.innerHTML = '<i></i> Mahalliy rejim'; status.title = 'Server ishlamasa, ayrim funksiyalar faqat shu qurilmada saqlanadi'; } }
}
function formatTime(seconds) { if (!Number.isFinite(seconds) || seconds < 0) return '0:00'; const n=Math.floor(seconds); return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`; }
function saveProgress(force=false) {
  const player=$('#player'); if (!activeVideo || !player || !Number.isFinite(player.currentTime)) return;
  const now=Date.now(); if(!force && now-lastProgressWriteAt<4000) return; lastProgressWriteAt=now;
  const duration=Number.isFinite(player.duration)?player.duration:0;
  if (duration>0 && player.currentTime>=duration-3) delete progressMap[activeVideo.id];
  else if (player.currentTime>1) progressMap[activeVideo.id]={time:Math.floor(player.currentTime),duration:Math.floor(duration),updatedAt:Date.now()};
  else if (force) delete progressMap[activeVideo.id];
  saveJSON(STORAGE.progress,progressMap);
  if (activePage==='continue') renderVideos();
}
function renderUpNext() {
  const box=$('#upNextList'); if(!box) return;
  const list=videos.filter(v=>v.id!==activeVideo?.id && !v.short).sort((a,b)=>Number(b.category===activeVideo?.category)-Number(a.category===activeVideo?.category)).slice(0,5);
  $('#queueCount').textContent=`${list.length} ta`;
  box.innerHTML=list.length?list.map(v=>`<button class="queue-item" type="button" data-queue-video="${esc(v.id)}"><span class="queue-thumb" style="background:${palette(v)[0]}">${esc(v.icon||'▶')}</span><span class="queue-copy"><strong>${esc(v.title)}</strong><small>${esc(v.channel||'UZStar')} · ${esc(v.views||readableViews(v.viewCount))} ko‘rish</small></span><span class="queue-play">▶</span></button>`).join(''):'<p class="muted">Hozircha tavsiya yo‘q.</p>';
}
function playNeighbor(direction=1) {
  const list=videos.filter(v=>!v.short); if(!list.length) return;
  let index=list.findIndex(v=>v.id===activeVideo?.id); index=(index+direction+list.length)%list.length; openVideo(list[index].id);
}
function renderComments() {
  const target = $('#commentList'); if (!target) return;
  const list = activeVideo ? (comments[activeVideo.id] || []) : [];
  target.innerHTML = list.length ? list.map(c => `<div class="comment"><strong>${esc(c.name)}:</strong> ${esc(c.text)} <small>${esc(c.at || '')}</small></div>`).join('') : '<p class="muted">Hali izoh yo‘q. Birinchi bo‘lib fikr bildiring!</p>';
}
function openVideo(id) {
  const video = videos.find(v => v.id === id); if (!video) return;
  saveProgress(true);
  activeVideo = video; viewed.add(id); persistSet(STORAGE.viewed, viewed);
  $('#playerTitle').textContent = video.title;
  $('#playerChannel').textContent = video.channel || profile.name;
  $('#playerStats').textContent = `${video.views || readableViews(video.viewCount)} marta ko‘rildi · ${video.category || 'Video'}`;
  $('#playerDescription').textContent = video.description || 'Tavsif berilmagan.';
  $('#playerLike').classList.toggle('liked', liked.has(id));
  $('#playerLike').textContent = (liked.has(id) ? '♥' : '♡') + ' Yoqdi';
  $('#speedBtn').textContent = '1× Tezlik'; $('#player').playbackRate = 1;
  $('#theaterBtn').textContent = '▣ Kino rejimi'; $('#videoDialog').classList.remove('theater-mode');
  updateWatchButton(); $('#commentInput').value = ''; renderComments();
  const player = $('#player'); if (!player.paused) ignoreNextPause = true; player.pause(); player.removeAttribute('src'); player.load();
  const url = video.videoUrl || blobUrls.get(video.id);
  resumeTarget = Number(progressMap[video.id]?.time || 0);
  $('#resumeNote').classList.toggle('hidden', !(resumeTarget > 5));
  $('#restartFromStartBtn').onclick = () => { player.currentTime=0; delete progressMap[video.id]; saveJSON(STORAGE.progress,progressMap); $('#resumeNote').classList.add('hidden'); toast('Video boshidan boshlandi.'); };
  if (url) { player.src = url; player.load(); }
  else if (video.uploaded) toast('Bu mahalliy video fayli topilmadi. Uni qayta yuklash kerak.');
  renderUpNext();
  $('#autoplayNext').checked=autoplayNext;
  $('#loopBtn').textContent=player.loop?'↻ Takrorlash: ha':'↻ Takrorlash: yo‘q';
  $('#volumeSlider').value=String(player.volume); $('#muteBtn').textContent=player.muted?'🔇 Ovozni yoqish':'🔊 Ovozni o‘chirish';
  if (!$('#videoDialog').open) $('#videoDialog').showModal();
  renderVideos();
  try { if ('mediaSession' in navigator && 'MediaMetadata' in window) { navigator.mediaSession.metadata = new MediaMetadata({title:video.title,artist:video.channel||'UZStar',album:'UZStar'}); for (const [action,handler] of Object.entries({play:()=>player.play().catch(()=>{}),pause:()=>player.pause(),seekbackward:()=>player.currentTime=Math.max(0,player.currentTime-10),seekforward:()=>player.currentTime=Math.min(player.duration||Infinity,player.currentTime+10),previoustrack:()=>playNeighbor(-1),nexttrack:()=>playNeighbor(1)})) { try { navigator.mediaSession.setActionHandler(action,handler); } catch {} } } } catch {}
  if (video.serverBacked && apiAvailable) {
    fetch(`/api/videos/${video.serverId}/views`, {method:'POST'}).then(r => r.ok ? r.json() : null).then(data => {
      if (data?.video) { Object.assign(video, data.video); $('#playerStats').textContent = `${video.views} marta ko‘rildi · ${video.category || 'Video'}`; renderVideos(); }
    }).catch(() => {});
    loadServerComments(video);
  }
}
function renderShort() {
  const list = videos.filter(v => v.short);
  if (!list.length) { $('#shortCard').innerHTML = '<div class="short-visual" style="background:#242638"><div class="short-caption"><h3>Hozircha Shorts yo‘q</h3><p>Yuklash tugmasi orqali birinchi Shorts videoni qo‘shing.</p></div></div>'; return; }
  shortIndex = ((shortIndex % list.length) + list.length) % list.length;
  const video = list[shortIndex], p = palette(video), url = video.videoUrl || blobUrls.get(video.id);
  $('#shortCard').innerHTML = `<div class="short-visual" style="background:${p[0]}">${url ? `<video class="short-video" src="${esc(url)}" playsinline loop controls preload="metadata" aria-label="${esc(video.title)}"></video>` : `<span class="art-icon">${esc(video.icon || '✦')}</span>`}<div class="short-caption"><h3>${esc(video.title)}</h3><p>@${esc((video.channel || 'uzstar').replace(/\s+/g,'_'))} · ${esc(video.description || '')}</p></div><div class="short-actions"><button id="shortLike" type="button" aria-label="Layk">${liked.has(video.id)?'♥':'♡'}<small>Layk</small></button><button id="shortComment" type="button" aria-label="Izoh">☰<small>Izoh</small></button><button id="shortSave" type="button" aria-label="Saqlash">${watchLater.has(video.id)?'✓':'＋'}<small>Saqlash</small></button><button id="shortShare" type="button" aria-label="Ulashish">↗<small>Ulashish</small></button></div></div>`;
  $('#shortLike').onclick = () => { toggleLike(video.id); renderShort(); };
  $('#shortComment').onclick = () => openVideo(video.id);
  $('#shortSave').onclick = () => { toggleWatchLater(video.id); renderShort(); };
  $('#shortShare').onclick = () => shareVideo(video);
}
function toggleLike(id) {
  const adding = !liked.has(id);
  if (adding) liked.add(id); else liked.delete(id);
  persistSet(STORAGE.liked, liked);
  if (adding) addNotification('Video yoqdi', `“${videos.find(v=>v.id===id)?.title || 'Video'}” yoqtirilganlarga qo‘shildi.`, 'like');
  const serverVideo = videos.find(v => v.id === id);
  if (currentUser && apiAvailable && serverVideo?.serverBacked) {
    fetch(`/api/videos/${serverVideo.serverId}/like`, {method:adding ? 'POST' : 'DELETE'})
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Layk saqlanmadi.'); })
      .catch(error => toast(error.message || 'Layk serverga saqlanmadi.'));
  } else if (serverVideo?.serverBacked && !currentUser) {
    // Local like remains usable for guests; offer account sync without blocking the action.
    toast('Layk shu qurilmada saqlandi. Barcha qurilmalarda saqlash uchun tizimga kiring.');
  }
  if (activeVideo?.id === id) { $('#playerLike').classList.toggle('liked', liked.has(id)); $('#playerLike').textContent = (liked.has(id) ? '♥' : '♡') + ' Yoqdi'; }
  if (activePage === 'profile') renderProfile(); else renderVideos();
  toast(liked.has(id) ? 'Video yoqtirilganlarga qo‘shildi.' : 'Video yoqtirilganlardan olib tashlandi.');
}
function toggleWatchLater(id) {
  if (watchLater.has(id)) watchLater.delete(id); else watchLater.add(id);
  persistSet(STORAGE.later, watchLater); updateWatchButton();
  if (activePage === 'watchlater') renderVideos();
  toast(watchLater.has(id) ? 'Video “Keyin ko‘rish”ga saqlandi.' : 'Video saqlanganlar ro‘yxatidan olib tashlandi.');
}
function renderProfile() {
  profile.name = profile.name || 'UZStar foydalanuvchisi'; profile.handle = profile.handle || 'uzstar_user';
  $('#profileName').textContent = profile.name; $('#profileHandle').textContent = '@' + profile.handle;
  $('#profileBio').textContent = profile.bio || 'O‘zbek video olamidagi shaxsiy sahifangiz.';
  const avatarMarkup = profile.avatar ? `<img src="${profile.avatar}" alt="Profil rasmi">` : esc((profile.name || 'U')[0].toUpperCase());
  $('#profileAvatar').innerHTML = avatarMarkup; $('#topAvatar').innerHTML = avatarMarkup;
  const banner = $('#profileBanner');
  banner.style.backgroundImage = profile.cover ? `linear-gradient(90deg,#10111b55,#10111b22),url("${profile.cover}")` : '';
  banner.classList.toggle('has-cover', !!profile.cover);
  const location = $('#profileLocation'); location.textContent = profile.location ? `⌖ ${profile.location}` : ''; location.classList.toggle('hidden', !profile.location);
  const website = $('#profileWebsite');
  let safeWebsite = '';
  try { const parsed = new URL(profile.website || ''); if (['http:','https:'].includes(parsed.protocol)) safeWebsite = parsed.href; } catch {}
  website.href = safeWebsite; website.textContent = safeWebsite ? `↗ ${safeWebsite.replace(/^https?:\/\//,'').replace(/\/$/,'')}` : ''; website.classList.toggle('hidden', !safeWebsite);
  const myVideos = videos.filter(v => v.uploaded && (!v.serverBacked || v.isOwner));
  $('#profileVideoCount').textContent = String(myVideos.length);
  $('#profileLikedCount').textContent = String(liked.size);
  $('#profileWatchedCount').textContent = String(viewed.size);
  const box = $('#profileContent');
  if (profileTab === 'about') {
    box.innerHTML = `<div class="about-card profile-about-card"><h3>${esc(profile.name)} haqida</h3><p>${esc(profile.bio || 'Bu foydalanuvchi hali o‘zi haqida ma’lumot qo‘shmagan.')}</p>${profile.location ? `<p>⌖ ${esc(profile.location)}</p>` : ''}${safeWebsite ? `<p>Veb-sayt: <a href="${esc(safeWebsite)}" target="_blank" rel="noopener noreferrer">${esc(safeWebsite)}</a></p>` : ''}<p class="muted">UZStar ijodkor profili</p></div>`; return;
  }
  const list = videos.filter(v => profileTab === 'liked' ? liked.has(v.id) : (v.uploaded && (!v.serverBacked || v.isOwner)));
  box.innerHTML = list.length ? list.map(card).join('') : `<div class="about-card">${profileTab === 'liked' ? 'Hali yoqtirgan videolaringiz yo‘q.' : 'Bu yerda hozircha videolaringiz yo‘q. “Yuklash” tugmasi orqali birinchi videongizni qo‘shing.'}</div>`;
}
async function saveProfile() {
  const name = $('#editName').value.trim();
  const bio = $('#editBio').value.trim();
  const location = $('#editLocation').value.trim();
  let website = $('#editWebsite').value.trim();
  if (website && !/^https?:\/\//i.test(website)) website = 'https://' + website;
  if (website) { try { const u = new URL(website); if (!['http:','https:'].includes(u.protocol)) throw new Error(); website = u.href; } catch { toast('Veb-sayt havolasi to‘g‘ri emas.'); return false; } }
  let handle = $('#editHandle').value.trim().replace(/^@/,'').replace(/\s+/g,'_').replace(/[^\p{L}\p{N}_.]/gu,'');
  if (!name || !handle) { toast('Ism va foydalanuvchi nomini kiriting.'); return false; }
  if (currentUser && apiAvailable) {
    try {
      const response = await fetch('/api/me', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:name})});
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Profil saqlanmadi.');
      currentUser = data.user; profile = {...profile, name:currentUser.displayName,handle:currentUser.username};
    } catch (error) { toast(error.message || 'Profil serverga saqlanmadi.'); return false; }
  } else profile = {...profile, name, handle};
  profile = {...profile, bio, location, website};
  if (Object.prototype.hasOwnProperty.call(profile,'pendingAvatar')) { if(profile.pendingAvatar) profile.avatar=profile.pendingAvatar; else delete profile.avatar; delete profile.pendingAvatar; }
  if (Object.prototype.hasOwnProperty.call(profile,'pendingCover')) { if(profile.pendingCover) profile.cover=profile.pendingCover; else delete profile.cover; delete profile.pendingCover; }
  saveJSON(STORAGE.profile, profile); syncAuthUI(); renderProfile(); renderVideos(); toast('Profil saqlandi.'); return true;
}
function getDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { resolve(null); return; }
    const request = indexedDB.open('UZStarLocalDB', 1);
    request.onupgradeneeded = () => { const database = request.result; if (!database.objectStoreNames.contains('videos')) database.createObjectStore('videos', {keyPath:'id'}); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
function dbPut(record) {
  return new Promise((resolve, reject) => {
    if (!db) { resolve(false); return; }
    const tx = db.transaction('videos','readwrite'); tx.objectStore('videos').put(record);
    tx.oncomplete = () => resolve(true); tx.onerror = () => reject(tx.error);
  });
}
function dbGetAll() {
  return new Promise((resolve, reject) => {
    if (!db) { resolve([]); return; }
    const tx = db.transaction('videos','readonly'), request = tx.objectStore('videos').getAll();
    request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error);
  });
}
function dbDelete(id) {
  return new Promise((resolve, reject) => {
    if (!db) { resolve(); return; }
    const tx = db.transaction('videos','readwrite'); tx.objectStore('videos').delete(id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}
async function restoreUploads() {
  const metadata = safeRead(STORAGE.uploads, []);
  try {
    const records = await dbGetAll();
    const byId = new Map(records.map(record => [record.id, record]));
    for (const meta of metadata) {
      const record = byId.get(meta.id);
      const restored = {...meta, videoUrl:'', needsReselect:!record};
      if (record?.blob) { const url = URL.createObjectURL(record.blob); blobUrls.set(meta.id, url); restored.videoUrl = url; restored.needsReselect = false; }
      videos.push(restored);
    }
  } catch (error) {
    console.warn('Mahalliy videolarni tiklab bo‘lmadi:', error);
    videos.push(...metadata.map(meta => ({...meta,videoUrl:'',needsReselect:true})));
  }
}
function uploadWithProgress(form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/videos');
    xhr.upload.addEventListener('progress', event => { if (event.lengthComputable) onProgress(Math.min(99, Math.round(event.loaded / event.total * 100))); });
    xhr.addEventListener('load', () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || '{}'); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(100); resolve(data); }
      else reject(new Error(data.error || `Yuklash amalga oshmadi (HTTP ${xhr.status}).`));
    });
    xhr.addEventListener('error', () => reject(new Error('Server bilan aloqa uzildi. Server oynasini tekshiring.')));
    xhr.addEventListener('abort', () => reject(new Error('Video yuklash bekor qilindi.')));
    xhr.send(form);
  });
}
async function addVideo(event) {
  event.preventDefault();
  const file = $('#videoFile').files[0];
  if (apiAvailable && !currentUser) { toast('Videoni serverga yuklash uchun hisobga kiring. Kirganingizdan so‘ng shu forma ochiq qoladi.'); openAuth(); return; }
  if (!file) { toast('Video fayl tanlang.'); return; }
  if (!file.type.startsWith('video/')) { toast('Faqat video fayl tanlang.'); return; }
  if (file.size > 150 * 1024 * 1024) { toast('Video 150 MB dan kichik bo‘lishi kerak.'); return; }
  const title = $('#videoTitle').value.trim();
  if (!title) { toast('Video sarlavhasini kiriting.'); return; }
  const category = $('#videoCategory').value;
  const short = $('#isShort').checked;
  if (apiAvailable) {
    const form = new FormData();
    form.append('file', file); form.append('title', title); form.append('category', category);
    form.append('description', $('#videoDescription').value.trim()); form.append('short', String(short)); form.append('channel', profile.name);
    const submit = $('#uploadSubmit'), progress = $('#uploadProgress');
    submit.disabled = true; submit.innerHTML = 'Yuklanmoqda…'; progress.classList.remove('hidden');
    $('#uploadProgressBar').value = 0; $('#uploadProgressPercent').textContent = '0%'; $('#uploadProgressText').textContent = 'Serverga yuborilmoqda…';
    try {
      const result = await uploadWithProgress(form, (percent) => {
        $('#uploadProgressBar').value = percent; $('#uploadProgressPercent').textContent = `${percent}%`;
        $('#uploadProgressText').textContent = percent >= 100 ? 'Serverda saqlanmoqda…' : 'Video serverga yuklanmoqda…';
      });
      videos.unshift(result.video); addNotification('Video yuklandi', `“${result.video.title}” serverga saqlandi.`, 'upload');
      $('#uploadForm').reset(); $('#uploadDialog').close(); activeCategory = 'Barchasi';
      $$('.chip').forEach(chip => chip.classList.toggle('active', chip.dataset.category === 'Barchasi'));
      await loadServerVideos(); setPage(short ? 'shorts' : 'home'); if (short) { shortIndex = 0; renderShort(); }
      toast('Video server bazasiga saqlandi.'); return;
    } catch (error) { console.error(error); toast(error.message || 'Server bilan aloqa uzildi. Serverni qayta ishga tushiring.'); return; }
    finally { submit.disabled = false; submit.innerHTML = 'Videoni qo‘shish <span>→</span>'; progress.classList.add('hidden'); }
  }
  const id = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
  const paletteKey = category === 'Musiqa' ? 'music' : category === 'Ta’lim' ? 'learn' : category === 'O‘yinlar' ? 'game' : category === 'Kino' ? 'cinema' : category === 'Texnologiya' ? 'tech' : 'life';
  const video = {id,title,channel:profile.name,views:'0',viewCount:0,age:'hozir',duration:'YANGI',category,palette:paletteKey,icon:short?'📱':'▶',description:$('#videoDescription').value.trim(),short,videoUrl:'',uploaded:true};
  const url = URL.createObjectURL(file); blobUrls.set(id,url); video.videoUrl = url;
  try { if (db) await dbPut({id,blob:file,name:file.name,type:file.type,size:file.size,createdAt:Date.now()}); }
  catch (error) { console.warn(error); toast('Video hozircha faqat shu ochiq sahifada saqlanadi.'); }
  videos.unshift(video); addNotification('Video qo‘shildi', `“${video.title}” qurilmangizga qo‘shildi.`, 'upload');
  saveJSON(STORAGE.uploads, videos.filter(v => v.uploaded).map(({videoUrl,needsReselect,...v}) => v));
  $('#uploadForm').reset(); $('#uploadDialog').close(); activeCategory = 'Barchasi'; $$('.chip').forEach(c => c.classList.toggle('active', c.dataset.category === 'Barchasi'));
  setPage(short ? 'shorts' : 'home'); if (short) { shortIndex = 0; renderShort(); }
  toast(db ? 'Video qo‘shildi va ushbu qurilmada saqlandi.' : 'Video qo‘shildi. Sahifani yopmaguncha ishlaydi.');
}
async function addComment() {
  const text = $('#commentInput').value.trim(); if (!text || !activeVideo) return;
  if (text.length > 1000) { toast('Izoh 1000 belgidan oshmasin.'); return; }
  if (activeVideo.serverBacked && apiAvailable) {
    try {
      const response = await fetch(`/api/videos/${activeVideo.serverId}/comments`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({author:profile.name,body:text})});
      const result = await response.json();
      if (!response.ok) { toast(result.error || 'Izoh yuborilmadi.'); return; }
      comments[activeVideo.id] = comments[activeVideo.id] || []; comments[activeVideo.id].push(result.comment); addNotification('Izoh yuborildi', `“${activeVideo.title}” videosiga izoh qo‘shdingiz.`, 'comment');
      $('#commentInput').value = ''; renderComments(); toast('Izoh serverga saqlandi.'); return;
    } catch { toast('Izohni yuborib bo‘lmadi. Serverni tekshiring.'); return; }
  }
  comments[activeVideo.id] = comments[activeVideo.id] || [];
  comments[activeVideo.id].push({name:profile.name,text,at:new Date().toLocaleDateString('uz-UZ')});
  saveJSON(STORAGE.comments, comments); addNotification('Izoh qo‘shildi', `“${activeVideo.title}” videosiga izoh yozdingiz.`, 'comment'); $('#commentInput').value = ''; renderComments(); toast('Izoh qo‘shildi.');
}
function showMore(id, anchor) {
  const video = videos.find(v => v.id === id); if (!video) return;
  const menu = $('#moreMenu');
  menu.innerHTML = `<button data-action="save" role="menuitem">${watchLater.has(id)?'✓ Saqlanganlardan olib tashlash':'＋ Keyin ko‘rish'}</button><button data-action="like" role="menuitem">${liked.has(id)?'♥ Yoqtirishdan olib tashlash':'♡ Yoqtirish'}</button><button data-action="share" role="menuitem">↗ Havolani ulashish</button><button data-action="report" role="menuitem">⚑ Muammo haqida xabar</button>${(video.uploaded && (!video.serverBacked || video.isOwner || video.ownerId == null && !currentUser))?'<button data-action="delete" role="menuitem" class="danger-menu-item">🗑 Videoni o‘chirish</button>':''}`;
  menu.classList.remove('hidden'); menu.dataset.video = id;
  const rect = anchor.getBoundingClientRect(), menuWidth = 230, menuHeight = video.uploaded ? 245 : 205;
  menu.style.top = `${Math.max(8,Math.min(rect.bottom + 5,window.innerHeight - menuHeight - 8))}px`;
  menu.style.left = `${Math.max(8,Math.min(rect.left,window.innerWidth - menuWidth - 8))}px`;
}
function closeMenu() { $('#moreMenu').classList.add('hidden'); }
async function shareVideo(video) {
  const shareData = {title:video.title,text:`${video.title} — UZStar`,url:location.href};
  try {
    if (navigator.share) { await navigator.share(shareData); }
    else if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`); toast('Ulashish matni va havola nusxalandi.'); }
    else { window.prompt('Nusxalash uchun Ctrl+C bosing:', `${shareData.text}\n${shareData.url}`); }
  } catch (error) { if (error.name !== 'AbortError') toast('Ulashishning imkoni bo‘lmadi.'); }
}
async function deleteVideo(id) {
  const video = videos.find(v => v.id === id); if (!video?.uploaded) return;
  if (!confirm(`“${video.title}” videosini ushbu qurilmadan o‘chirasizmi?`)) return;
  if (video.serverBacked && apiAvailable) {
    try {
      const response = await fetch(`/api/videos/${video.serverId}`, {method:'DELETE'});
      const result = await response.json();
      if (!response.ok) { toast(result.error || 'Video o‘chirilmadi.'); return; }
    } catch { toast('Server bilan aloqa uzildi; video o‘chirilmadi.'); return; }
  }
  videos = videos.filter(v => v.id !== id); liked.delete(id); viewed.delete(id); watchLater.delete(id); delete comments[id];
  persistSet(STORAGE.liked,liked); persistSet(STORAGE.viewed,viewed); persistSet(STORAGE.later,watchLater); saveJSON(STORAGE.comments,comments);
  saveJSON(STORAGE.uploads,videos.filter(v=>v.uploaded).map(({videoUrl,needsReselect,...v})=>v));
  try { await dbDelete(id); } catch (error) { console.warn(error); }
  const url = blobUrls.get(id); if (url) URL.revokeObjectURL(url); blobUrls.delete(id);
  if (activeVideo?.id === id) $('#videoDialog').close();
  closeMenu(); renderVideos(); renderProfile(); toast('Video o‘chirildi.');
}
function applyTheme(theme) {
  const light = theme === 'light'; document.body.classList.toggle('light-theme', light);
  const button = $('#themeToggle'); if (button) { button.textContent = light ? '☾' : '☼'; button.title = light ? 'Qorong‘i rejim' : 'Yorug‘ rejim'; button.setAttribute('aria-label', button.title); }
  try { localStorage.setItem(STORAGE.theme, JSON.stringify(light ? 'light' : 'dark')); } catch {}
}
function syncAuthUI() {
  const button = $('#authButton');
  if (button) { button.textContent = currentUser ? `@${currentUser.username}` : 'Kirish'; button.title = currentUser ? 'Hisob sozlamalari' : 'Hisobga kirish'; }
  $('#logoutButton')?.classList.toggle('hidden', !currentUser);
  $('#authSubmit')?.classList.toggle('hidden', !!currentUser);
  $('#authSwitch')?.classList.toggle('hidden', !!currentUser);
  $('#authSwitchText')?.classList.toggle('hidden', !!currentUser);
  $('#authUsername')?.toggleAttribute('disabled', !!currentUser);
  $('#authPassword')?.classList.toggle('hidden', !!currentUser);
  $('#authPassword')?.toggleAttribute('required', !currentUser);
  $('#authPassword')?.setAttribute('autocomplete', authMode === 'register' ? 'new-password' : 'current-password');
  $('#displayNameWrap')?.classList.toggle('hidden', authMode !== 'register' || !!currentUser);
  $('#authDisplayName')?.toggleAttribute('required', authMode === 'register' && !currentUser);
  if (currentUser) {
    $('#authTitle').textContent = 'Hisobingiz';
    $('#authUsername').value = currentUser.username;
    $('#authUsername').setAttribute('readonly','readonly');
  } else {
    $('#authUsername').removeAttribute('readonly');
    $('#authTitle').textContent = authMode === 'register' ? 'Yangi hisob yaratish' : 'Hisobga kirish';
    $('#authSubmit').textContent = authMode === 'register' ? 'Ro‘yxatdan o‘tish' : 'Kirish';
    $('#authSwitchText').textContent = authMode === 'register' ? 'Hisobingiz bormi?' : 'Hisobingiz yo‘qmi?';
    $('#authSwitch').textContent = authMode === 'register' ? 'Kirish' : 'Ro‘yxatdan o‘tish';
  }
}
function openAuth() {
  authMode = currentUser ? 'account' : 'login';
  $('#authPassword').value = '';
  syncAuthUI();
  $('#authDialog').showModal();
}
async function submitAuth(event) {
  event.preventDefault();
  if (currentUser) return;
  if (!apiAvailable) { toast('Hisoblar uchun avval run_uzstar.bat orqali serverni ishga tushiring.'); return; }
  const username = $('#authUsername').value.trim().toLowerCase();
  const password = $('#authPassword').value;
  const displayName = $('#authDisplayName').value.trim();
  const path = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
  const submit = $('#authSubmit'); submit.disabled = true; submit.textContent = 'Kutilmoqda…';
  try {
    const response = await fetch(path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password,displayName})});
    const result = await response.json();
    if (!response.ok) { toast(result.error || 'Hisobga kirib bo‘lmadi.'); return; }
    currentUser = result.user;
    profile = {...profile,name:currentUser.displayName,handle:currentUser.username}; saveJSON(STORAGE.profile,profile);
    $('#authPassword').value = ''; $('#authDialog').close();
    await loadServerVideos(); syncAuthUI(); renderProfile(); renderVideos();
    toast(authMode === 'register' ? 'Hisob yaratildi. Xush kelibsiz!' : 'Tizimga muvaffaqiyatli kirdingiz.');
  } catch { toast('Server bilan aloqa yo‘q. run_uzstar.bat oynasini tekshiring.'); }
  finally { submit.disabled = false; syncAuthUI(); }
}
async function logout() {
  try { if (apiAvailable) await fetch('/api/auth/logout',{method:'POST'}); } catch {}
  currentUser = null;
  for (const id of [...liked]) if (String(id).startsWith('srv_')) liked.delete(id);
  persistSet(STORAGE.liked,liked); syncAuthUI(); $('#authDialog').close();
  await loadServerVideos(); renderProfile(); renderVideos();
  toast('Hisobdan chiqdingiz.');
}

function initEvents() {
  bindCards($('#videoGrid')); bindCards($('#profileContent'));
  // Bitta delegatsiyalangan router: dinamik DOM o'zgarsa ham menyu ishlaydi.
  // Anchor'ning standart sakrashini to'xtatib, avval UI'ni yangilaymiz.
  document.addEventListener('click', event => {
    const link = event.target.closest('a.nav-item[data-page]');
    if (!link) return;
    event.preventDefault();
    const page = link.dataset.page;
    try {
      setPage(page);
    } catch (error) {
      console.error('Sahifa ochilmadi:', page, error);
      // Navigatsiya xatosi qolgan menyu tugmalarini bloklamasligi kerak.
      activePage = page;
      const hash = `#${page}`;
      if (location.hash !== hash) history.pushState({page}, '', hash);
      $('#main')?.classList.remove('hidden');
      $('#shortsPage')?.classList.add('hidden');
      $('#profilePage')?.classList.add('hidden');
      $('#utilityPage')?.classList.add('hidden');
      toast('Bu bo‘limni ochishda xatolik yuz berdi. Boshqa bo‘limdan foydalanishingiz mumkin.');
    }
  });
  $$('.chip').forEach(button => button.addEventListener('click', () => {
    activeCategory = button.dataset.category; $$('.chip').forEach(chip => chip.classList.toggle('active', chip === button)); renderVideos();
  }));
  $('#searchInput').addEventListener('input', () => { if (currentSearch() && activePage !== 'explore') setPage('explore'); else renderVideos(); });
  $('#searchInput').addEventListener('change', () => { if (currentSearch()) { setPage('explore'); toast('Qidiruv natijalari yangilandi.'); } });
  $('#searchInput').addEventListener('keydown', event => { if (event.key === 'Escape') { $('#searchInput').value = ''; renderVideos(); $('#searchInput').blur(); } });
  // + Yuklash har doim avval video yuklash formasini ochadi. Hisob talab qilinsa, forma yopilmaydi.
  $('#openUpload').addEventListener('click', () => { $('#uploadDialog').showModal(); });
  $('#authButton').addEventListener('click', openAuth);
  $('#authForm').addEventListener('submit', submitAuth);
  $('#authSwitch').addEventListener('click', () => { authMode = authMode === 'register' ? 'login' : 'register'; $('#authPassword').value = ''; syncAuthUI(); });
  $('#logoutButton').addEventListener('click', logout);
  $('#emptyUpload').addEventListener('click', () => { $('#uploadDialog').showModal(); });
  $$('[data-close]').forEach(button => button.addEventListener('click', () => $('#' + button.dataset.close).close()));
  $$('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      if (dialog.id === 'videoDialog') { const player = $('#player'); if (!player.paused) ignoreNextPause = true; player.pause(); player.removeAttribute('src'); player.load(); $('#videoDialog').classList.remove('theater-mode'); }
    });
  });
  $('#uploadForm').addEventListener('submit', addVideo);
  $('#playerLike').addEventListener('click', () => { if (activeVideo) toggleLike(activeVideo.id); });
  $('#watchLaterBtn').addEventListener('click', () => { if (activeVideo) toggleWatchLater(activeVideo.id); });
  $('#shareVideoBtn').addEventListener('click', () => { if (activeVideo) shareVideo(activeVideo); });
  $('#speedBtn').addEventListener('click', () => {
    const player = $('#player'), speeds = [1,1.25,1.5,1.75,2,0.5,0.75];
    let index = speeds.indexOf(player.playbackRate); player.playbackRate = speeds[(index + 1) % speeds.length];
    $('#speedBtn').textContent = `${player.playbackRate}× Tezlik`; toast(`Ijro tezligi: ${player.playbackRate}×`);
  });
  $('#theaterBtn').addEventListener('click', () => {
    const dialog = $('#videoDialog'); dialog.classList.toggle('theater-mode');
    $('#theaterBtn').textContent = dialog.classList.contains('theater-mode') ? '▣ Oddiy rejim' : '▣ Kino rejimi';
  });
  $('#fullscreenBtn').addEventListener('click', async () => {
    const target = $('#player');
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (target.requestFullscreen) await target.requestFullscreen(); else toast('To‘liq ekran bu brauzerda qo‘llanmaydi.'); }
    catch { toast('To‘liq ekran ochilmadi. Brauzer ruxsatini tekshiring.'); }
  });
  $('#pipBtn').addEventListener('click', async () => {
    const player = $('#player');
    try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else if (document.pictureInPictureEnabled && player.requestPictureInPicture) await player.requestPictureInPicture(); else toast('Mini-pleyer bu brauzerda qo‘llanmaydi.'); }
    catch { toast('Mini-pleyer ochilmadi.'); }
  });
  $('#player').addEventListener('error', () => { if ($('#videoDialog').open && activeVideo) toast('Video ochilmadi. Internetni yoki mahalliy faylni tekshiring.'); });
  $('#player').addEventListener('loadedmetadata', () => { const p=$('#player'); const saved=Number(progressMap[activeVideo?.id]?.time||0); if(saved>5 && p.duration>saved+5){p.currentTime=saved;toast(`Tomosha ${formatTime(saved)} joyidan davom etadi.`);} });
  $('#player').addEventListener('timeupdate', () => { if($('#videoDialog').open) saveProgress(); });
  $('#player').addEventListener('pause', () => { if (ignoreNextPause) { ignoreNextPause=false; return; } saveProgress(true); });
  $('#player').addEventListener('ended', () => { saveProgress(true); if(autoplayNext && !$('#player').loop) playNeighbor(1); });
  $('#player').addEventListener('volumechange', () => { $('#muteBtn').textContent=$('#player').muted?'🔇 Ovozni yoqish':'🔊 Ovozni o‘chirish'; $('#volumeSlider').value=String($('#player').volume); });
  $('#back10Btn').addEventListener('click',()=>{const p=$('#player');p.currentTime=Math.max(0,p.currentTime-10);});
  $('#forward10Btn').addEventListener('click',()=>{const p=$('#player');p.currentTime=Math.min(Number.isFinite(p.duration)?p.duration:Infinity,p.currentTime+10);});
  $('#prevVideoBtn').addEventListener('click',()=>playNeighbor(-1));
  $('#nextVideoBtn').addEventListener('click',()=>playNeighbor(1));
  $('#loopBtn').addEventListener('click',()=>{const p=$('#player');p.loop=!p.loop;$('#loopBtn').textContent=p.loop?'↻ Takrorlash: ha':'↻ Takrorlash: yo‘q';toast(p.loop?'Takrorlash yoqildi.':'Takrorlash o‘chirildi.');});
  $('#muteBtn').addEventListener('click',()=>{const p=$('#player');p.muted=!p.muted;});
  $('#volumeSlider').addEventListener('input',e=>{const p=$('#player');p.volume=Number(e.target.value);p.muted=p.volume===0;});
  $('#autoplayNext').addEventListener('change',e=>{autoplayNext=e.target.checked;saveJSON('uzstar_autoplay_next',autoplayNext);toast(autoplayNext?'Keyingi video avtomatik yoqiladi.':'Avtomatik ijro o‘chirildi.');});
  $('#restartVideoBtn').addEventListener('click',()=>{const p=$('#player');p.currentTime=0;delete progressMap[activeVideo?.id];saveJSON(STORAGE.progress,progressMap);$('#resumeNote').classList.add('hidden');p.play().catch(()=>{});});
  $('#playerHelpBtn').addEventListener('click',()=>toast('Yorliqlar: Space — ijro/to‘xtatish · ←/→ — 10 soniya · M — ovoz · F — to‘liq ekran · 0–9 — video foizi.'));
  $('#upNextList').addEventListener('click',e=>{const item=e.target.closest('[data-queue-video]');if(item)openVideo(item.dataset.queueVideo);});
  $('#sendComment').addEventListener('click', addComment);
  $('#commentInput').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); addComment(); } });
  $('#editProfile').addEventListener('click', () => {
    delete profile.pendingAvatar; delete profile.pendingCover;
    $('#editName').value = profile.name || ''; $('#editHandle').value = profile.handle || '';
    $('#editHandle').disabled = !!currentUser; $('#editBio').value = profile.bio || '';
    $('#editLocation').value = profile.location || ''; $('#editWebsite').value = profile.website || '';
    $('#avatarPreview').innerHTML = profile.avatar ? `<img src="${profile.avatar}" alt="Profil rasmi">` : esc((profile.name || 'U')[0].toUpperCase());
    $('#coverPreview').style.backgroundImage = profile.cover ? `url("${profile.cover}")` : '';
    $('#coverPreview').textContent = profile.cover ? '' : '✦';
    $('#editAvatarFile').value = ''; $('#editCoverFile').value = ''; $('#editDialog').showModal();
  });
  const prepareProfileImage = (file, maxSide=1400) => new Promise((resolve,reject) => {
    if (!file) return resolve('');
    if (!file.type.startsWith('image/')) return reject(new Error('Faqat rasm faylini tanlang.'));
    if (file.size > 5*1024*1024) return reject(new Error('Rasm 5 MB dan kichik bo‘lishi kerak.'));
    const reader = new FileReader(); reader.onerror = () => reject(new Error('Rasmni o‘qib bo‘lmadi.'));
    reader.onload = () => { const img = new Image(); img.onerror = () => reject(new Error('Rasm formati ochilmadi.')); img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width,img.height)); const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(img.width*scale)); canvas.height = Math.max(1,Math.round(img.height*scale));
      const ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0,canvas.width,canvas.height); resolve(canvas.toDataURL('image/jpeg',0.82));
    }; img.src = reader.result; }; reader.readAsDataURL(file);
  });
  $('#editAvatarFile').addEventListener('change', async e => { try { const data = await prepareProfileImage(e.target.files[0],700); if(data){$('#avatarPreview').innerHTML=`<img src="${data}" alt="Yangi profil rasmi">`; profile.pendingAvatar=data;} } catch(err){toast(err.message);} });
  $('#editCoverFile').addEventListener('change', async e => { try { const data = await prepareProfileImage(e.target.files[0],1500); if(data){$('#coverPreview').style.backgroundImage=`url("${data}")`;$('#coverPreview').textContent='';profile.pendingCover=data;} } catch(err){toast(err.message);} });
  $('#removeAvatar').addEventListener('click',()=>{profile.pendingAvatar='';$('#avatarPreview').innerHTML=esc((profile.name||'U')[0].toUpperCase());$('#editAvatarFile').value='';});
  $('#removeCover').addEventListener('click',()=>{profile.pendingCover='';$('#coverPreview').style.backgroundImage='';$('#coverPreview').textContent='✦';$('#editCoverFile').value='';});
  $('#editForm').addEventListener('submit', async event => { event.preventDefault(); const button = $('#editForm button[type=submit]'); button.disabled = true; try { if (await saveProfile()) $('#editDialog').close(); } finally { button.disabled = false; } });
  $('#topAvatar').addEventListener('click', () => setPage('profile'));
  $('#notifications').addEventListener('click', () => setPage('notificationsPage'));
  $('#themeToggle')?.addEventListener('click', () => applyTheme(document.body.classList.contains('light-theme') ? 'dark' : 'light'));
  $('#filterBtn').addEventListener('click', () => {
    if (activePage === 'history') {
      if (!viewed.size) { toast('Ko‘rish tarixi allaqachon bo‘sh.'); return; }
      if (confirm('Ko‘rish tarixini tozalaysizmi?')) { viewed.clear(); persistSet(STORAGE.viewed,viewed); renderVideos(); toast('Ko‘rish tarixi tozalandi.'); }
      return;
    }
    sortMode = (sortMode + 1) % 3; const labels = ['Tartib: tavsiya','Tartib: nomi A–Z','Tartib: mashhur'];
    $('#sortLabel').textContent = labels[sortMode]; renderVideos(); toast(labels[sortMode]);
  });
  $('#closeShorts').addEventListener('click', () => setPage('home'));
  $('#prevShort').addEventListener('click', () => { shortIndex--; renderShort(); });
  $('#nextShort').addEventListener('click', () => { shortIndex++; renderShort(); });
  $$('.profile-tab').forEach(button => button.addEventListener('click', () => {
    profileTab = button.dataset.profiletab; $$('.profile-tab').forEach(tab => tab.classList.toggle('active',tab===button)); renderProfile();
  }));
  $('#mobileMenu').addEventListener('click', () => {
    const open = !$('#sidebar').classList.contains('mobile-open');
    $('#sidebar').classList.toggle('mobile-open',open);
    $('#sidebarBackdrop')?.classList.toggle('visible',open);
    $('#mobileMenu').setAttribute('aria-expanded', String(open));
  });
  $('#sidebarBackdrop')?.addEventListener('click', () => {
    $('#sidebar').classList.remove('mobile-open');
    $('#sidebarBackdrop').classList.remove('visible');
    $('#mobileMenu').setAttribute('aria-expanded', 'false');
  });
  $('.brand')?.addEventListener('click', event => { event.preventDefault(); setPage('home'); });
  window.addEventListener('popstate', () => {
    const requested = (location.hash || '#home').slice(1);
    setPage(requested, {updateHistory:false});
  });
  window.addEventListener('hashchange', () => {
    const requested = (location.hash || '#home').slice(1);
    if (requested !== activePage) setPage(requested, {updateHistory:false});
  });
  $('#moreMenu').addEventListener('click', event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const id = $('#moreMenu').dataset.video, action = button.dataset.action; closeMenu();
    if (action === 'save') toggleWatchLater(id);
    else if (action === 'like') toggleLike(id);
    else if (action === 'share') { const video = videos.find(v=>v.id===id); if (video) shareVideo(video); }
    else if (action === 'report') toast('Rahmat! Muammo haqida xabar demo rejimida qayd etildi.');
    else if (action === 'delete') deleteVideo(id);
  });
  $('#utilityPage').addEventListener('change', event => { if (event.target.id === 'motionToggle') { reducedMotion=event.target.checked; saveJSON('uzstar_reduced_motion',reducedMotion); document.documentElement.classList.toggle('reduce-motion',reducedMotion); toast(reducedMotion?'Animatsiyalar kamaytirildi.':'Animatsiyalar yoqildi.'); } });
  $('#utilityPage').addEventListener('click', async event => {
    const view=event.target.closest('[data-channel-view]');
    if(view){activeChannel=view.dataset.channelView;setPage('channel');return;}
    const localSub=event.target.closest('[data-channel-save]');
    if(localSub){const name=localSub.dataset.channelSave;let arr=safeRead('uzstar_local_subscriptions',[]);arr=arr.includes(name)?arr.filter(x=>x!==name):[...arr,name];saveJSON('uzstar_local_subscriptions',arr);renderUtilityPage();if(activePage==='subscriptions')renderVideos();toast(arr.includes(name)?'Kanal kuzatuvga qo‘shildi.':'Kanal kuzatuvdan olib tashlandi.');return;}
    const sub=event.target.closest('[data-subscribe]');
    if(sub){if(!currentUser){openAuth();toast('Obuna bo‘lish uchun tizimga kiring.');return;}const id=Number(sub.dataset.subscribe),isOn=sub.dataset.subscribed==='true';const endpoint=`/api/users/${id}/subscribe`;try{const r=await fetch(endpoint,{method:isOn?'DELETE':'POST'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Obuna amali bajarilmadi.');await loadServerVideos();renderUtilityPage();toast(isOn?'Obunadan chiqdingiz.':'Kanalga obuna bo‘ldingiz.');}catch(e){toast(e.message||'Server bilan aloqa yo‘q.');}return;}
    if(event.target.closest('#settingsTheme')){applyTheme(document.body.classList.contains('light-theme')?'dark':'light');renderUtilityPage();return;}
    if(event.target.closest('#clearHistorySettings')){if(confirm('Ko‘rish tarixini tozalaysizmi?')){viewed.clear();persistSet(STORAGE.viewed,viewed);renderUtilityPage();toast('Ko‘rish tarixi tozalandi.');}return;}
    if(event.target.closest('#clearNotifications')){notifications=[];saveJSON('uzstar_notifications',notifications);renderUtilityPage();toast('Bildirishnomalar tozalandi.');return;}
    if(event.target.closest('#exportData')){const payload={exportedAt:new Date().toISOString(),profile,liked:[...liked],viewed:[...viewed],watchLater:[...watchLater],progress:progressMap,autoplayNext,notifications,theme:safeRead(STORAGE.theme,'dark')};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='uzstar-ma-lumotlar.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Ma’lumotlar JSON faylga eksport qilindi.');return;}
    if(event.target.closest('#clearLocalData')){if(confirm('Brauzerdagi profil, layk, tarix va saqlanganlar tozalansinmi? Serverdagi akkaunt va videolar o‘chmaydi.')){[STORAGE.profile,STORAGE.liked,STORAGE.viewed,STORAGE.later,STORAGE.comments,STORAGE.uploads,'uzstar_notifications','uzstar_local_subscriptions',STORAGE.progress,'uzstar_autoplay_next'].forEach(k=>localStorage.removeItem(k));location.reload();}return;}
  });
  document.addEventListener('click', event => { if (!event.target.closest('#moreMenu') && !event.target.closest('[data-more]')) closeMenu(); });
  window.addEventListener('keydown', event => {
    if (event.key === '?' && !event.target.matches('input,textarea')) { toast('Player: Space ijro/to‘xtatish · ←/→ 10s · M ovoz · F fullscreen · 0–9 foizga o‘tish.'); }
    if (event.key === 'Escape') { closeMenu(); $('#sidebar').classList.remove('mobile-open'); $('#sidebarBackdrop')?.classList.remove('visible'); $('#mobileMenu')?.setAttribute('aria-expanded','false'); }
    if (activePage === 'shorts' && event.key === 'ArrowDown' && !event.target.matches('input,textarea,video')) { event.preventDefault(); shortIndex++; renderShort(); }
    if (activePage === 'shorts' && event.key === 'ArrowUp' && !event.target.matches('input,textarea,video')) { event.preventDefault(); shortIndex--; renderShort(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#searchInput').focus(); }
    if ($('#videoDialog').open && !event.target.matches('input,textarea,button,select,[contenteditable=true]')) { const p=$('#player'); if(event.key===' '){event.preventDefault();p.paused?p.play().catch(()=>{}):p.pause();} else if(event.key==='ArrowLeft'&&p.duration){event.preventDefault();p.currentTime=Math.max(0,p.currentTime-10);} else if(event.key==='ArrowRight'&&p.duration){event.preventDefault();p.currentTime=Math.min(p.duration,p.currentTime+10);} else if(event.key.toLowerCase()==='m'){p.muted=!p.muted;} else if(event.key.toLowerCase()==='f'){if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else p.requestFullscreen?.().catch(()=>{});} else if(/^[0-9]$/.test(event.key)&&p.duration){p.currentTime=p.duration*(Number(event.key)/10);} else if(event.key==='ArrowUp'){event.preventDefault();p.volume=Math.min(1,p.volume+0.05);p.muted=false;} else if(event.key==='ArrowDown'){event.preventDefault();p.volume=Math.max(0,p.volume-0.05);} }
  });
  window.addEventListener('beforeunload', () => { saveProgress(true); blobUrls.forEach(url => URL.revokeObjectURL(url)); });
}
async function init() {
  // Muhim: navigatsiya va asosiy UI hech qanday asinxron ishni kutmasin.
  // IndexedDB yoki server javobi kechiksa ham menyu tugmalari darhol ishlashi kerak.
  applyTheme(safeRead(STORAGE.theme, 'dark'));
  document.documentElement.classList.toggle('reduce-motion', reducedMotion);
  initEvents();
  const initialPage = (location.hash || '#home').slice(1);
  setPage(initialPage, {updateHistory:false});
  renderVideos();
  renderProfile();

  // Mahalliy ma'lumotlar va serverni alohida xatolardan himoyalab yuklaymiz.
  try { db = await getDB(); } catch (error) { console.warn('IndexedDB mavjud emas:', error); }
  try { await restoreUploads(); } catch (error) { console.warn('Mahalliy videolarni tiklab bo‘lmadi:', error); }
  try { await loadServerVideos(); } catch (error) { console.warn('Server ma’lumotlari yuklanmadi:', error); }

  const status = $('#serverStatus');
  if (status && !apiAvailable) {
    status.classList.remove('online');
    status.innerHTML = '<i></i> Mahalliy rejim';
    status.title = 'Serverga ulanish yo‘q. Mahalliy ko‘rish va navigatsiya ishlashda davom etadi.';
  }
  renderVideos();
  renderProfile();
  // Eski cache-first Service Worker sahifalar kontentini yangilamasligi mumkin.
  // 2.6 versiyada eski UZStar SW va uning keshi olib tashlanadi; asosiy fayllar query versiyasi bilan yuklanadi.
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.filter(name => name.startsWith('uzstar-shell-')).map(name => caches.delete(name)));
      }
    } catch (error) { console.warn('Eski offline keshini tozalash yakunlanmadi:', error); }
  }
}
init().catch(error => {
  console.error('UZStar ishga tushish xatosi:', error);
  // Hatto ma'lumot yuklashda kutilmagan xato bo‘lsa ham menyu va demo kontent ishlasin.
  try { setPage('home', {updateHistory:false}); renderVideos(); } catch (uiError) { console.error('UZStar interfeys xatosi:', uiError); }
  toast('Ayrim ma’lumotlar yuklanmadi. Menyu va mahalliy videolarni ishlatishda davom etishingiz mumkin.');
});
