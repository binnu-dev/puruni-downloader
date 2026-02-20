/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  푸르니 알림장 뷰어 PRO 🎨                           ║
 * ║  Premium Design · Timeline · Search · Favorites     ║
 * ╚══════════════════════════════════════════════════════╝
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = {};
process.argv.slice(2).forEach(a => {
  if (a.startsWith('--')) { const [k, ...v] = a.replace(/^--/, '').split('='); args[k] = v.join('=') || true; }
});
const PORT = parseInt(args.port) || 3000;
const DATA_DIR = path.resolve(args.dir || './downloaded');

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function loadNotifications() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR)
    .filter(d => !d.startsWith('_') && fs.statSync(path.join(DATA_DIR, d)).isDirectory())
    .sort().reverse()
    .map(dir => {
      const fd = path.join(DATA_DIR, dir);
      const n = { date: dir, teacherMessage: '', parentMessage: '', photos: [] };
      const msgNew = path.join(fd, `${dir}_message.txt`);
      const msgOld = path.join(fd, 'message.txt');
      const mp = fs.existsSync(msgNew) ? msgNew : msgOld;
      if (fs.existsSync(mp)) n.teacherMessage = fs.readFileSync(mp, 'utf-8').trim();
      const ppNew = path.join(fd, `${dir}_parent_message.txt`);
      const ppOld = path.join(fd, 'parent_message.txt');
      const pp = fs.existsSync(ppNew) ? ppNew : ppOld;
      if (fs.existsSync(pp)) n.parentMessage = fs.readFileSync(pp, 'utf-8').trim();
      fs.readdirSync(fd).forEach(f => {
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(path.extname(f).toLowerCase()))
          n.photos.push(`/photos/${dir}/${f}`);
      });
      return n;
    });
}

function generateHTML(notifications) {
  const totalPhotos = notifications.reduce((s, n) => s + n.photos.length, 0);
  const totalMsgs = notifications.filter(n => n.teacherMessage).length;

  const years = {};
  notifications.forEach(n => {
    const y = n.date.substring(0, 4);
    const m = n.date.substring(5, 7);
    if (!years[y]) years[y] = {};
    if (!years[y][m]) years[y][m] = [];
    years[y][m].push(n);
  });
  const yearKeys = Object.keys(years).sort().reverse();

  const allPhotos = [];
  notifications.forEach(n => n.photos.forEach(p => allPhotos.push({ src: p, date: n.date, msg: n.teacherMessage })));

  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>📔 푸르니 알림장 PRO</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
:root {
  --pri: #9297e0; --pri-h: #818cf8; --pri-bg: #f0f1ff;
  --fav: #ff8585; --fav-bg: #fff5f5;
  --bg: #f8f9fc; --card: #ffffff;
  --t1: #4a4e69; --t2: #6b7280; --t3: #9ca3af;
  --border: #eef0f5; --r: 22px;
  --sh-sm: 0 1px 2px rgba(0,0,0,0.03);
  --sh: 0 10px 15px -3px rgba(100,100,150,0.05);
  --sh-lg: 0 20px 25px -5px rgba(100,100,150,0.08);
}

* { margin: 0; padding: 0; box-sizing: border-box; outline-color: var(--pri); }
body { font-family: 'Outfit', 'Noto Sans KR', sans-serif; background: var(--bg); color: var(--t1); line-height: 1.6; -webkit-font-smoothing: antialiased; }
button { font-family: inherit; cursor: pointer; border: none; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }

/* HEADER */
.hero { background-image: linear-gradient(120deg, #fbc2eb 0%, #a6c1ee 100%); color: var(--t1); padding: 5rem 1rem 7rem; text-align: center; position: relative; }
.hero h1 { font-size: 2.8rem; font-weight: 800; letter-spacing: -0.04em; margin-bottom: 0.6rem; color: #4a4e69; }
.hero p { opacity: 0.8; font-weight: 500; font-size: 1.15rem; color: #6b7280; letter-spacing: -0.01em; }
.stat-chips { display: flex; justify-content: center; gap: 1.2rem; margin-top: 2.5rem; }
.stat-chip { background: rgba(255,255,255,0.45); backdrop-filter: blur(12px); padding: 0.7rem 1.4rem; border-radius: 99px; border: 1px solid rgba(255,255,255,0.4); font-size: 0.85rem; font-weight: 600; color: #6b7280; box-shadow: 0 4px 15px rgba(0,0,0,0.03); }
.stat-chip b { color: #818cf8; font-weight: 800; }

/* MODERN TOOLBAR */
.toolbar-wrap { position: sticky; top: 0; z-index: 100; margin-top: -3rem; padding: 0 1rem; }
.toolbar { max-width: 1000px; margin: 0 auto; background: rgba(255,255,255,0.85); backdrop-filter: blur(20px); border-radius: 24px; padding: 0.8rem 1.2rem; border: 1px solid var(--border); box-shadow: var(--sh-lg); }
.tb-top { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.8rem; }
.tb-bottom { display: flex; align-items: center; gap: 0.5rem; border-top: 1px solid var(--border); padding-top: 0.8rem; }

/* SEARCH BAR */
.search-container { flex: 1; position: relative; min-width: 200px; }
.search-container input { width: 100%; height: 44px; padding: 0 1rem 0 2.8rem; border-radius: 14px; border: 1px solid var(--border); background: var(--bg); font-size: 0.9rem; transition: all 0.2s; }
.search-container input:focus { background: white; border-color: var(--pri); box-shadow: 0 0 0 4px rgba(99,102,241,0.15); }
.search-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--t3); pointer-events: none; }

/* FAV TOGGLE */
.fav-toggle-btn { height: 44px; padding: 0 1.2rem; border-radius: 14px; background: white; border: 1px solid var(--border); display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.85rem; color: var(--t2); }
.fav-toggle-btn:hover { background: var(--bg); }
.fav-toggle-btn.on { border-color: var(--fav); color: var(--fav); background: var(--fav-bg); }

/* PILLS */
.pill-group { display: flex; align-items: center; gap: 0.5rem; overflow-x: auto; scrollbar-width: none; }
.pill-group::-webkit-scrollbar { display: none; }
.pill-label { font-size: 0.75rem; font-weight: 700; color: var(--t3); text-transform: uppercase; margin-right: 0.5rem; flex-shrink: 0; }
.pill { padding: 0.4rem 1rem; border-radius: 99px; font-size: 0.85rem; font-weight: 600; background: transparent; color: var(--t2); border: 1px solid transparent; white-space: nowrap; }
.pill:hover { background: var(--border); }
.pill.on { background: var(--t1); color: white; border-color: var(--t1); }

/* VIEW SWITCH */
.view-switch { display: flex; background: var(--bg); padding: 4px; border-radius: 12px; border: 1px solid var(--border); }
.vs-btn { width: 40px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: transparent; color: var(--t2); font-size: 1.1rem; }
.vs-btn.on { background: white; color: var(--pri); box-shadow: var(--sh-sm); }

/* MAIN CONTENT */
.main { max-width: 1000px; margin: 2rem auto 8rem; padding: 0 1rem; }
.mg { margin-bottom: 3rem; }
.month-header { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1.2rem; }
.month-header h2 { font-size: 1.2rem; font-weight: 800; color: var(--t1); }
.month-header .count { font-size: 0.75rem; font-weight: 700; background: var(--pri-bg); color: var(--pri); padding: 0.2rem 0.6rem; border-radius: 99px; }

/* CARDS */
.card { background: var(--card); border-radius: var(--r); border: 1px solid var(--border); overflow: hidden; margin-bottom: 1.5rem; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.card:hover { transform: translateY(-4px); box-shadow: var(--sh-lg); }
.card-head { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); }
.card-date { font-weight: 700; font-size: 1rem; display: flex; align-items: center; gap: 0.4rem; }
.card-weekday { font-weight: 400; color: var(--t3); font-size: 0.85rem; }
.card-badges { display: flex; gap: 0.4rem; }
.badge { font-size: 0.65rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 8px; text-transform: uppercase; }
.badge-photo { background: #eff6ff; color: #2563eb; }
.badge-msg { background: #f0fdf4; color: #16a34a; }

/* PHOTO GRID */
.photos { display: grid; gap: 2px; background: var(--border); }
.photos.g1 { grid-template-columns: 1fr; }
.photos.g2 { grid-template-columns: 1fr 1fr; }
.photos.g3, .photos.g4 { grid-template-columns: 1fr 1fr; }
.photos.g5, .photos.gm { grid-template-columns: 1fr 1fr 1fr; }
.photos.g3 .pi:first-child { grid-column: 1 / -1; }
.pi { position: relative; aspect-ratio: 4/3; overflow: hidden; background: #f1f5f9; cursor: pointer; }
.pi img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s; }
.pi:hover img { transform: scale(1.08); }

/* MESSAGE BUBBLES */
.msgs { padding: 1.2rem 1.5rem; display: flex; flex-direction: column; gap: 0.8rem; }
.bubble { padding: 1rem 1.2rem; border-radius: 18px; font-size: 0.95rem; position: relative; }
.bubble-teacher { background: #f8faff; border: 1px solid #e0e7ff; color: #1e1b4b; }
.bubble-parent { background: #fffcf0; border: 1px solid #fef3c7; color: #78350f; }
.bubble-label { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.3rem; }
.bubble-teacher .bubble-label { color: var(--pri); }
.bubble-parent .bubble-label { color: #b45309; }
.bubble-text { white-space: pre-wrap; word-break: keep-all; font-weight: 400; }

/* FAVORITE BUTTON */
.fav-btn { position: absolute; top: 0.8rem; right: 0.8rem; width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.9); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border: 1px solid rgba(0,0,0,0.05); z-index: 10; font-size: 1.2rem; color: #cbd5e1; }
.fav-btn:hover { transform: scale(1.15); background: white; }
.fav-btn.active { color: var(--fav); }
.fav-btn.pulse { animation: heartPulse 0.4s ease-out; }
@keyframes heartPulse { 0% { transform: scale(1); } 50% { transform: scale(1.4); } 100% { transform: scale(1); } }

/* GALLERY VIEW */
.gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.gi { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); box-shadow: var(--sh-sm); cursor: pointer; }
.gi img { width: 100%; height: 100%; object-fit: cover; transition: all 0.5s; }
.gi:hover img { transform: scale(1.1); filter: brightness(0.85); }
.gi-info { position: absolute; bottom: 0; left: 0; right: 0; padding: 1.5rem 0.8rem 0.5rem; background: linear-gradient(transparent, rgba(0,0,0,0.6)); color: white; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
.gi:hover .gi-info { opacity: 1; }
.gi-date { font-size: 0.75rem; font-weight: 600; }

/* LIGHTBOX & SLIDESHOW */
/* OVERLAY & SLIDESHOW */
.overlay { display: none; position: fixed; inset: 0; z-index: 2000; background: rgba(10,10,15,0.98); backdrop-filter: blur(25px); flex-direction: column; color: white; animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.overlay.open { display: flex; }
.overlay-top { display: flex; align-items: center; justify-content: space-between; padding: 1.2rem 2rem; background: linear-gradient(rgba(0,0,0,0.5), transparent); position: absolute; top: 0; left: 0; right: 0; z-index: 50; }
.overlay-counter { font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.5); letter-spacing: 0.05em; }

.overlay-body { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 2rem 0; }
.overlay-img { max-width: 95vw; max-height: 88vh; object-fit: contain; border-radius: 4px; transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 30px 60px rgba(0,0,0,0.5); }
.overlay-img.fade { opacity: 0; }

.overlay-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 50px; height: 50px; border-radius: 50%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; color: rgba(255,255,255,0.4); z-index: 30; }
.overlay-nav:hover { background: rgba(255,255,255,0.15); color: white; border-color: rgba(255,255,255,0.2); }
.overlay-nav.left { left: 1.5rem; }
.overlay-nav.right { right: 1.5rem; }

.overlay-bottom { padding: 1.2rem 2rem; background: linear-gradient(transparent, rgba(0,0,0,0.85)); display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 10; }
.overlay-info { flex: 1; min-width: 0; margin-right: 2rem; }
.overlay-date { font-weight: 700; font-size: 1rem; margin-bottom: 0.2rem; color: white; display: flex; align-items: center; gap: 0.5rem; }
.overlay-msg { opacity: 0.7; font-size: 0.85rem; white-space: pre-wrap; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5; }

.msg-more-btn { background: rgba(255,255,255,0.12); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 6px 12px; border-radius: 8px; font-size: 0.7rem; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
.msg-more-btn:hover { background: rgba(255,255,255,0.22); }
.msg-more-btn.active { background: white; color: black; }

.msg-full-layer { display: none; position: absolute; inset: 0; background: rgba(0,0,0,0.9); z-index: 80; flex-direction: column; overflow-y: auto; padding: 6rem 2rem; align-items: center; justify-content: flex-start; backdrop-filter: blur(10px); }
.msg-full-layer.open { display: flex; }
.msg-full-content { max-width: 700px; font-size: 1.15rem; line-height: 1.9; color: #f8fafc; white-space: pre-wrap; text-align: left; }

.overlay-actions { display: flex; gap: 0.8rem; align-items: center; }
.ss-speed-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 5px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: 700; }
.btn-close { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; opacity: 0.4; background: none; color: white; margin-left: 0.5rem; }
.btn-close:hover { opacity: 1; background: rgba(255,255,255,0.1); border-radius: 50%; }

.ss-progress { position: absolute; bottom: 0; left: 0; height: 3px; background: var(--pri); transition: width linear; z-index: 100; box-shadow: 0 0 10px var(--pri); }
.btn-close { font-size: 2rem; opacity: 0.5; background: none; color: white; }
.btn-close:hover { opacity: 1; }

.hidden { display: none !important; }
.to-top { position: fixed; bottom: 2rem; right: 2rem; width: 54px; height: 54px; border-radius: 50%; background: white; color: var(--pri); border: 1px solid var(--border); box-shadow: var(--sh-lg); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; z-index: 50; opacity: 0; transform: translateY(10px); transition: all 0.3s; }
.to-top.show { opacity: 1; transform: translateY(0); }
.to-top:hover { background: var(--pri); color: white; }

@media (max-width: 768px) {
  .hero { padding: 3rem 1rem 5rem; }
  .hero h1 { font-size: 1.8rem; }
  .toolbar { border-radius: 0; border-left: none; border-right: none; margin-top: -3.5rem; }
  .overlay-nav { width: 44px; height: 44px; font-size: 1rem; }
  .overlay-msg { display: none; }
  .search-container { order: 2; width: 100%; }
  .fav-toggle-btn { order: 3; }
  .view-switch { order: 1; }
}

</style>
</head><body>

<section class="hero">
  <h1>📔 푸르니 알림장 PRO</h1>
  <p>우리 아이의 소중한 기록을 가장 아름답게 보관하세요</p>
  <div class="stat-chips">
    <div class="stat-chip"><b>${notifications.length}</b> 알림</div>
    <div class="stat-chip"><b>${totalPhotos}</b> 사진</div>
    <div class="stat-chip"><b>${totalMsgs}</b> 메시지</div>
  </div>
</section>

<div class="toolbar-wrap">
  <div class="toolbar">
    <div class="tb-top">
      <div class="view-switch">
        <button class="vs-btn on" data-v="timeline" onclick="setView('timeline', this)" title="타임라인">📋</button>
        <button class="vs-btn" data-v="gallery" onclick="setView('gallery', this)" title="갤러리">🖼️</button>
        <button class="vs-btn" onclick="startSlideshow()" title="슬라이드쇼">▶️</button>
      </div>
      <div class="search-container">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="메시지 키워드 검색..." oninput="onSearch(this.value)">
      </div>
      <button class="fav-toggle-btn" id="favFilterBtn" onclick="toggleFavFilter()">
        <span id="favFilterIcon">🤍</span> <span id="favFilterText">전체 보기</span>
      </button>
    </div>
    <div class="tb-bottom">
      <span class="pill-label">📅 필터</span>
      <div class="pill-group" id="yearPills">
        <button class="pill on" onclick="pickYear('all', this)">모든 연도</button>
        ${yearKeys.map(y => `<button class="pill" onclick="pickYear('${y}', this)">${y}년</button>`).join('')}
      </div>
      <div style="width:1px;height:24px;background:var(--border);margin:0 0.5rem"></div>
      <div class="pill-group" id="monthPills">
        <button class="pill on" onclick="pickMonth('all', this)">전체</button>
      </div>
    </div>
  </div>
</div>

<main class="main">
  <!-- TIMELINE -->
  <div id="vTimeline">
  ${Object.entries(years).sort(([a], [b]) => b.localeCompare(a)).map(([yr, months]) =>
    Object.entries(months).sort(([a], [b]) => b.localeCompare(a)).map(([mo, notis]) => `
    <div class="mg" data-y="${yr}" data-m="${mo}">
      <div class="month-header">
        <h2>${yr}년 ${parseInt(mo)}월</h2>
        <span class="count">${notis.length}개의 기록</span>
      </div>
      ${notis.map(n => {
      const d = new Date(n.date + 'T00:00:00');
      const dw = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
      const pc = n.photos.length; const gc = pc <= 5 ? `g${pc}` : 'gm';
      return `
      <div class="card" data-noti-date="${n.date}">
        <div class="card-head">
          <div class="card-date">${n.date.slice(5)} <span class="card-weekday">${dw}요일</span></div>
          <div class="card-badges">
            ${pc ? `<span class="badge badge-photo">PHOTO ${pc}</span>` : ''}
            ${n.teacherMessage ? `<span class="badge badge-msg">MSG</span>` : ''}
          </div>
        </div>
        ${pc ? `<div class="photos ${gc}">${n.photos.map((p, i) => `
          <div class="pi" onclick="openLB('${n.date}', ${i})">
            <img src="${p}" loading="lazy">
            <button class="fav-btn" data-url="${p}" onclick="handleFav(event, this)">❤</button>
          </div>`).join('')}</div>` : ''}
        ${n.teacherMessage || n.parentMessage ? `<div class="msgs">
          ${n.teacherMessage ? `<div class="bubble bubble-teacher"><div class="bubble-label">👩‍🏫 선생님 메시지</div><div class="bubble-text">${esc(n.teacherMessage)}</div></div>` : ''}
          ${n.parentMessage ? `<div class="bubble bubble-parent"><div class="bubble-label">🏠 가정에서</div><div class="bubble-text">${esc(n.parentMessage)}</div></div>` : ''}
        </div>` : ''}
      </div>`;
    }).join('')}
    </div>`).join('')
  ).join('')}
  </div>

  <!-- GALLERY -->
  <div id="vGallery" class="hidden">
    <div class="gallery-grid">${allPhotos.map((p, i) => `
      <div class="gi" data-y="${p.date.substring(0, 4)}" data-m="${p.date.substring(5, 7)}" data-url="${p.src}" data-msg="${esc(p.msg || '')}" onclick="openLBG(${i})">
        <img src="${p.src}" loading="lazy">
        <div class="gi-info"><div class="gi-date">${p.date}</div></div>
        <button class="fav-btn" data-url="${p.src}" onclick="handleFav(event, this)">❤</button>
      </div>`
  ).join('')}</div>
  </div>
</main>

<!-- OVERLAY (LIGHTBOX/SLIDESHOW) -->
<div class="overlay" id="overlay">
  <div class="overlay-top">
    <div class="overlay-counter" id="overlayCounter">0 / 0</div>
    <div class="overlay-actions">
      <div id="ssControls" class="hidden" style="display:flex;gap:0.5rem">
        <button class="ss-speed-btn" id="ssSpeed" onclick="cycleSpeed()">5초</button>
        <button class="vs-btn on" id="ssPlayBtn" onclick="togglePlay()" style="width:36px; height:36px;">⏸</button>
      </div>
      <button class="fav-btn" id="overlayFav" style="position:static; width:36px; height:36px; background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.3); border:1px solid rgba(255,255,255,0.05)" onclick="handleFav(event, this)">❤</button>
      <button class="btn-close" onclick="closeOverlay()">&times;</button>
    </div>
  </div>
  <div class="overlay-body">
    <button class="overlay-nav left" onclick="navOverlay(-1)">‹</button>
    <div id="fullMsgLayer" class="msg-full-layer" onclick="toggleFullMsg()">
      <div id="fullMsgContent" class="msg-full-content"></div>
    </div>
    <img id="overlayImg" class="overlay-img" src="">
    <button class="overlay-nav right" onclick="navOverlay(1)">›</button>
  </div>
  <div class="overlay-bottom">
    <div class="overlay-info">
      <div class="overlay-date" id="overlayDate"></div>
      <div class="overlay-msg" id="overlayMsg"></div>
    </div>
    <div class="overlay-actions">
      <button id="msgMoreBtn" class="msg-more-btn hidden" onclick="toggleFullMsg()">메시지 펼치기</button>
      <div id="ssControls" class="hidden" style="display:flex;gap:0.5rem">
        <button class="ss-speed-btn" id="ssSpeed" onclick="cycleSpeed()">5초</button>
        <button class="vs-btn on" id="ssPlayBtn" onclick="togglePlay()" style="width:36px; height:36px;">⏸</button>
      </div>
      <button class="fav-btn" id="overlayFav" style="position:static; width:36px; height:36px; background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.3); border:1px solid rgba(255,255,255,0.05)" onclick="handleFav(event, this)">❤</button>
    </div>
  </div>
  <div id="ssProgress" class="ss-progress hidden"></div>
</div>

<button class="to-top" id="toTop" onclick="window.scrollTo({top:0, behavior:'smooth'})">↑</button>

<script>
const PD = ${JSON.stringify(notifications.reduce((a, n) => { a[n.date] = n.photos; return a; }, {}))};
const AP = ${JSON.stringify(allPhotos)};
const YEARS = ${JSON.stringify(years, null, 0)};

let curYear='all', curMonth='all', curView='timeline', curSearch='', curFavOnly=false;
let overlayMode = 'lb'; // 'lb' or 'ss'
let overlayIdx = 0;
let overlayPhotos = [];

// FAVORITES
let FAVS = new Set(JSON.parse(localStorage.getItem('puruni_favs') || '[]'));
function saveFavs() { localStorage.setItem('puruni_favs', JSON.stringify([...FAVS])); }

function handleFav(e, btn) {
  if (e) e.stopPropagation();
  const url = btn.dataset.url;
  const isActive = FAVS.has(url);
  if (isActive) FAVS.delete(url); else FAVS.add(url);
  
  saveFavs();
  updateHeartUI(url);
}

function updateHeartUI(url) {
  const isActive = FAVS.has(url);
  document.querySelectorAll(\`.fav-btn[data-url="\${url}"]\`).forEach(b => {
    b.classList.toggle('active', isActive);
    b.classList.add('pulse');
    setTimeout(() => b.classList.remove('pulse'), 400);
  });
  
  // Update Overlay Heart
  const ovFav = document.getElementById('overlayFav');
  if (ovFav.dataset.url === url) {
    ovFav.classList.toggle('active', isActive);
    if (isActive) ovFav.style.color = 'var(--fav)';
    else ovFav.style.color = 'rgba(255,255,255,0.3)';
  }

  if (curFavOnly) applyFilter();
}

function toggleFavFilter() {
  curFavOnly = !curFavOnly;
  const btn = document.getElementById('favFilterBtn');
  btn.classList.toggle('on', curFavOnly);
  document.getElementById('favFilterIcon').textContent = curFavOnly ? '❤️' : '🤍';
  document.getElementById('favFilterText').textContent = curFavOnly ? '찜한 사진만' : '전체 보기';
  applyFilter();
}

function applyFilter() {
  // Timeline
  document.querySelectorAll('.mg').forEach(g => {
    const yOk = curYear === 'all' || g.dataset.y === curYear;
    const mOk = curMonth === 'all' || g.dataset.m === curMonth;
    
    let gHasMatch = false;
    g.querySelectorAll('.card').forEach(c => {
      const txt = c.innerText.toLowerCase();
      const sOk = !curSearch || txt.includes(curSearch);
      
      let cHasFav = false;
      c.querySelectorAll('.pi').forEach(pi => {
        const btn = pi.querySelector('.fav-btn');
        const url = btn ? btn.dataset.url : '';
        const isFav = FAVS.has(url);
        const fOk = !curFavOnly || isFav;
        pi.classList.toggle('hidden', !fOk);
        if (isFav) cHasFav = true;
      });

      const fOk = !curFavOnly || cHasFav;
      const isVisible = sOk && fOk;
      c.classList.toggle('hidden', !isVisible);
      if (isVisible) gHasMatch = true;
    });
    g.style.display = (yOk && mOk && gHasMatch) ? '' : 'none';
  });

  // Gallery
  document.querySelectorAll('.gi').forEach(g => {
    const yOk = curYear === 'all' || g.dataset.y === curYear;
    const mOk = curMonth === 'all' || g.dataset.m === curMonth;
    const sOk = !curSearch || (g.dataset.msg && g.dataset.msg.toLowerCase().includes(curSearch));
    const fOk = !curFavOnly || FAVS.has(g.dataset.url);
    g.style.display = (yOk && mOk && sOk && fOk) ? '' : 'none';
  });
}

function onSearch(val) { curSearch = val.toLowerCase().trim(); applyFilter(); }

function pickYear(y, btn) {
  curYear = y; curMonth = 'all';
  document.querySelectorAll('#yearPills .pill').forEach(p => p.classList.remove('on'));
  btn.classList.add('on');
  buildMonthPills();
  applyFilter();
}
function pickMonth(m, btn) {
  curMonth = m;
  document.querySelectorAll('#monthPills .pill').forEach(p => p.classList.remove('on'));
  btn.classList.add('on');
  applyFilter();
}
function buildMonthPills() {
  const mp = document.getElementById('monthPills');
  let html = '<button class="pill on" onclick="pickMonth(\\'all\\', this)">전체</button>';
  const target = (curYear === 'all') ? Object.values(YEARS).reduce((a, v) => ({...a, ...v}), {}) : YEARS[curYear];
  Object.keys(target || {}).sort().reverse().forEach(m => {
    html += \`<button class="pill" onclick="pickMonth('\${m}', this)">\${parseInt(m)}월</button>\`;
  });
  mp.innerHTML = html;
}

function setView(v, btn) {
  curView = v;
  document.getElementById('vTimeline').classList.toggle('hidden', v !== 'timeline');
  document.getElementById('vGallery').classList.toggle('hidden', v !== 'gallery');
  document.querySelectorAll('.vs-btn').forEach(b => b.classList.toggle('on', b.dataset.v === v));
}

// OVERLAY LOGIC
function toggleFullMsg() {
  const layer = document.getElementById('fullMsgLayer');
  const btn = document.getElementById('msgMoreBtn');
  const isOpen = layer.classList.toggle('open');
  btn.textContent = isOpen ? '메시지 닫기' : '메시지 펼치기';
  btn.classList.toggle('active', isOpen);
}

function openLB(date, idx) {
  overlayMode = 'lb';
  overlayPhotos = getFilteredPhotos();
  const currentUrl = PD[date][idx];
  overlayIdx = overlayPhotos.findIndex(p => p.src === currentUrl);
  if (overlayIdx < 0) overlayIdx = 0;
  showOverlay();
}
function openLBG(ai) {
  overlayMode = 'lb';
  const filtered = getFilteredPhotos();
  const allCards = [...document.querySelectorAll('.gi')].filter(el => el.style.display !== 'none');
  const targetUrl = allCards[ai].dataset.url;
  overlayIdx = filtered.findIndex(p => p.src === targetUrl);
  if (overlayIdx < 0) overlayIdx = 0;
  overlayPhotos = filtered;
  showOverlay();
}

function showOverlay() {
  const p = overlayPhotos[overlayIdx];
  if (!p) return;
  
  const img = document.getElementById('overlayImg');
  img.classList.add('fade');
  document.getElementById('fullMsgLayer').classList.remove('open');
  
  setTimeout(() => {
    img.src = p.src;
    document.getElementById('overlayCounter').textContent = (overlayIdx + 1) + ' / ' + overlayPhotos.length;
    document.getElementById('overlayDate').textContent = p.date;
    const msgEl = document.getElementById('overlayMsg');
    const moreBtn = document.getElementById('msgMoreBtn');
    const fullContent = document.getElementById('fullMsgContent');
    
    msgEl.textContent = p.msg || '';
    fullContent.textContent = p.msg || '';
    moreBtn.textContent = '메시지 펼치기';
    moreBtn.classList.remove('active');
    
    if (p.msg && p.msg.length > 70) {
      moreBtn.classList.remove('hidden');
    } else {
      moreBtn.classList.add('hidden');
    }
    
    const ovFav = document.getElementById('overlayFav');
    ovFav.dataset.url = p.src;
    ovFav.classList.toggle('active', FAVS.has(p.src));
    ovFav.style.color = FAVS.has(p.src) ? 'var(--fav)' : 'rgba(255,255,255,0.3)';
    
    img.onload = () => img.classList.remove('fade');
    document.getElementById('overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }, 100);
}

function navOverlay(dir) {
  overlayIdx = (overlayIdx + dir + overlayPhotos.length) % overlayPhotos.length;
  showOverlay();
  if (overlayMode === 'ss') startSSTimer(); 
}

function closeOverlay() {
  document.getElementById('overlay').classList.remove('open');
  document.body.style.overflow = '';
  stopSlideshow();
}

// SLIDESHOW
let ssPlaying = false, ssTimer = null, ssInterval = 5000;
const SPEEDS = [3000, 5000, 8000, 12000];
let speedIdx = 1;

function startSlideshow() {
  overlayMode = 'ss';
  overlayPhotos = getFilteredPhotos();
  if (!overlayPhotos.length) return;
  overlayIdx = 0;
  ssPlaying = true;
  document.getElementById('ssControls').classList.remove('hidden');
  document.getElementById('ssProgress').classList.remove('hidden');
  document.getElementById('ssPlayBtn').textContent = '⏸';
  showOverlay();
  startSSTimer();
}

function stopSlideshow() {
  ssPlaying = false;
  clearInterval(ssTimer);
  document.getElementById('ssControls').classList.add('hidden');
  document.getElementById('ssProgress').classList.add('hidden');
}

function startSSTimer() {
  clearInterval(ssTimer);
  if (!ssPlaying) return;
  
  const pg = document.getElementById('ssProgress');
  pg.style.transition = 'none';
  pg.style.width = '0%';
  requestAnimationFrame(() => {
    pg.style.transition = \`width \${ssInterval}ms linear\`;
    pg.style.width = '100%';
  });
  
  ssTimer = setInterval(() => {
    navOverlay(1);
  }, ssInterval);
}

function togglePlay() {
  ssPlaying = !ssPlaying;
  document.getElementById('ssPlayBtn').textContent = ssPlaying ? '⏸' : '▶';
  document.getElementById('ssPlayBtn').classList.toggle('on', ssPlaying);
  if (ssPlaying) startSSTimer(); else clearInterval(ssTimer);
}
function cycleSpeed() {
  speedIdx = (speedIdx + 1) % SPEEDS.length;
  ssInterval = SPEEDS[speedIdx];
  document.getElementById('ssSpeed').textContent = (ssInterval/1000) + '초';
  if (ssPlaying) startSSTimer();
}

function getFilteredPhotos() {
  return AP.filter(p => {
    const yOk = curYear === 'all' || p.date.substring(0,4) === curYear;
    const mOk = curMonth === 'all' || p.date.substring(5,7) === curMonth;
    const sOk = !curSearch || (p.msg && p.msg.toLowerCase().includes(curSearch));
    const fOk = !curFavOnly || FAVS.has(p.src);
    return yOk && mOk && sOk && fOk;
  });
}

// INITIALIZATION
document.querySelectorAll('.fav-btn').forEach(b => {
  if (FAVS.has(b.dataset.url)) b.classList.add('active');
});

document.addEventListener('keydown', e => {
  if (document.getElementById('overlay').classList.contains('open')) {
    if (e.key === 'Escape') closeOverlay();
    if (e.key === 'ArrowLeft') navOverlay(-1);
    if (e.key === 'ArrowRight') navOverlay(1);
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    if (e.key === 'f') { handleFav(null, document.getElementById('overlayFav')); }
  }
});

window.addEventListener('scroll', () => {
  document.getElementById('toTop').classList.toggle('show', window.scrollY > 500);
});

buildMonthPills();
</script>
</body></html>`;
}

// SERVER
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/photos/')) {
    const fp = path.join(DATA_DIR, url.pathname.replace('/photos/', '')); const sp = path.resolve(fp);
    if (!sp.startsWith(DATA_DIR)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(sp)) { const e = path.extname(sp).toLowerCase(); res.writeHead(200, { 'Content-Type': MIME[e] || 'application/octet-stream', 'Cache-Control': 'public,max-age=86400' }); fs.createReadStream(sp).pipe(res) }
    else { res.writeHead(404); res.end() } return;
  }
  if (url.pathname === '/' || url.pathname === '/index.html') { const n = loadNotifications(); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(generateHTML(n)); return; }
  res.writeHead(404); res.end();
});
server.listen(PORT, () => {
  const n = loadNotifications(); const tp = n.reduce((s, x) => s + x.photos.length, 0);
  console.log(`\n╔═══════════════════════════════════════╗`);
  console.log(`║  📔 푸르니 알림장 뷰어 PRO            ║`);
  console.log(`╚═══════════════════════════════════════╝`);
  console.log(`📋 ${n.length}개 알림 | 📸 ${tp}장 | 📁 ${DATA_DIR}`);
  console.log(`\n🌐 http://localhost:${PORT}\n`);
});
