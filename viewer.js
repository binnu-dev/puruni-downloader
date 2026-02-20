/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  푸르니 알림장 뷰어 v3 🎨                            ║
 * ║  타임라인 · 갤러리 · 슬라이드쇼                       ║
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
      // Support both old (message.txt) and new (date_message.txt) formats
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

  // Build year/month structure
  const years = {};
  notifications.forEach(n => {
    const y = n.date.substring(0, 4);
    const m = n.date.substring(5, 7);
    if (!years[y]) years[y] = {};
    if (!years[y][m]) years[y][m] = [];
    years[y][m].push(n);
  });
  const yearKeys = Object.keys(years).sort().reverse();

  // Flat photos for gallery/slideshow
  const allPhotos = [];
  notifications.forEach(n => n.photos.forEach(p => allPhotos.push({ src: p, date: n.date, msg: n.teacherMessage })));

  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>📔 푸르니 알림장</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#f0f2f5;--card:#fff;--t1:#111827;--t2:#4b5563;--t3:#9ca3af;
--pri:#6366f1;--pri-g:rgba(99,102,241,.12);--pri-dk:#4f46e5;
--ora:#f59e0b;--border:#e5e7eb;--r:16px;
--sh:0 1px 3px rgba(0,0,0,.05),0 4px 14px rgba(0,0,0,.04);}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Noto Sans KR',system-ui,sans-serif;background:var(--bg);color:var(--t1);line-height:1.7;-webkit-font-smoothing:antialiased}

/* HEADER */
header{background:linear-gradient(135deg,#4f46e5,#7c3aed 50%,#a855f7);color:#fff;padding:2.5rem 1rem 2.8rem;text-align:center;position:relative;overflow:hidden}
header::after{content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='1' fill='white' opacity='.06'/%3E%3C/svg%3E")}
header h1{font-size:1.8rem;font-weight:700;position:relative;z-index:1}
header .sub{font-size:.88rem;opacity:.75;margin-top:.3rem;font-weight:300;position:relative;z-index:1}
.chips{display:flex;justify-content:center;gap:.7rem;flex-wrap:wrap;margin-top:1.2rem;position:relative;z-index:1}
.chip{background:rgba(255,255,255,.15);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:.35rem .9rem;font-size:.78rem;display:flex;align-items:center;gap:.3rem}
.chip b{font-size:1rem}

/* TOOLBAR */
.toolbar{position:sticky;top:0;z-index:100;background:var(--bg);border-bottom:1px solid var(--border)}
.tb-inner{max-width:960px;margin:0 auto;padding:.5rem 1rem}
.tb-row{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
.tb-row+.tb-row{margin-top:.4rem}

/* PILLS */
.pills{display:flex;gap:.25rem;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0}
.pills::-webkit-scrollbar{display:none}
.pill{flex-shrink:0;padding:.35rem .85rem;border-radius:999px;font-size:.76rem;font-weight:500;
border:1.5px solid transparent;cursor:pointer;transition:all .2s;background:transparent;
color:var(--t2);font-family:inherit;white-space:nowrap}
.pill:hover{background:var(--pri-g);color:var(--pri)}
.pill.on{background:var(--pri);color:#fff;border-color:var(--pri);box-shadow:0 2px 8px var(--pri-g)}
.pill-label{font-size:.7rem;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;padding:.35rem .3rem;flex-shrink:0}

/* VIEW BTNS */
.vb.on{background:#fff;color:var(--pri);box-shadow:0 1px 4px rgba(0,0,0,.1)}

/* SEARCH */
.search-box{flex:1;min-width:180px;position:relative}
.search-box input{width:100%;padding:.4rem .7rem .4rem 2rem;border-radius:10px;border:1.5px solid var(--border);
  font-family:inherit;font-size:.8rem;transition:all .2s;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%239ca3af' viewBox='0 0 256 256'%3E%3Cpath d='M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z'%3E%3C/path%3E%3C/svg%3E") no-repeat .6rem center}
.search-box input:focus{outline:none;border-color:var(--pri);box-shadow:0 0 0 3px var(--pri-g)}
.search-box input::placeholder{color:var(--t3)}

/* MAIN */
.main{max-width:960px;margin:0 auto;padding:1.2rem 1rem 5rem}

/* MONTH LABEL */
.mlabel{font-size:.9rem;font-weight:700;color:var(--pri);margin:1.4rem 0 .7rem .15rem;display:flex;align-items:center;gap:.4rem}
.mlabel:first-child{margin-top:0}
.mlabel .cnt{font-size:.65rem;font-weight:600;background:var(--pri-g);color:var(--pri);padding:.1rem .5rem;border-radius:999px}

/* CARD */
.card{background:var(--card);border-radius:var(--r);box-shadow:var(--sh);margin-bottom:1rem;overflow:hidden;transition:transform .25s,box-shadow .25s}
.card:hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(0,0,0,.07)}
.card-h{display:flex;align-items:center;justify-content:space-between;padding:.75rem 1.1rem;border-bottom:1px solid var(--border)}
.card-d{font-weight:600;font-size:.9rem}
.card-d .dw{font-weight:400;font-size:.78rem;color:var(--t3);margin-left:.3rem}
.bds{display:flex;gap:.3rem}
.bd{font-size:.62rem;font-weight:600;padding:.12rem .45rem;border-radius:999px}
.bd-p{background:#eff6ff;color:#2563eb}.bd-m{background:#ecfdf5;color:#059669}

.photos{display:grid;gap:2px;background:#f1f5f9}
.photos.g1{grid-template-columns:1fr}
.photos.g2{grid-template-columns:1fr 1fr}
.photos.g3{grid-template-columns:1fr 1fr}
.photos.g4{grid-template-columns:1fr 1fr}
.photos.g5{grid-template-columns:1fr 1fr 1fr}
.photos.gm{grid-template-columns:1fr 1fr 1fr}
.photos.g3 .pi:first-child{grid-column:1/-1}
.pi{position:relative;overflow:hidden;cursor:pointer;aspect-ratio:4/3;background:#e2e8f0}
.photos.g1 .pi{aspect-ratio:16/10;max-height:450px}
.pi img{width:100%;height:100%;object-fit:cover;transition:transform .3s;display:block}
.pi:hover img{transform:scale(1.03)}

.msgs{padding:1rem 1.1rem;display:flex;flex-direction:column;gap:.55rem}
.mb{border-radius:11px;padding:.75rem 1rem}
.mb-t{background:linear-gradient(135deg,#eef2ff,#e8ecf8);border-left:3px solid var(--pri)}
.mb-p{background:linear-gradient(135deg,#fffbeb,#fef3c7);border-left:3px solid var(--ora)}
.mb-l{font-size:.65rem;font-weight:700;letter-spacing:.05em;margin-bottom:.25rem}
.mb-t .mb-l{color:var(--pri)}.mb-p .mb-l{color:#b45309}
.mb-tx{font-size:.88rem;white-space:pre-wrap;word-break:keep-all;line-height:1.75}
.mb-p .mb-tx{color:#78350f}

/* GALLERY */
.gal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:4px}
.gi{position:relative;aspect-ratio:1;overflow:hidden;cursor:pointer;border-radius:5px;background:#e2e8f0}
.gi img{width:100%;height:100%;object-fit:cover;transition:transform .3s;display:block}
.gi:hover img{transform:scale(1.05)}
.gi .gd{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.55));
color:#fff;font-size:.68rem;font-weight:500;padding:1rem .5rem .35rem;opacity:0;transition:opacity .25s}
.gi:hover .gd{opacity:1}

/* SLIDESHOW */
.ss-overlay{display:none;position:fixed;inset:0;z-index:1000;background:#000;flex-direction:column}
.ss-overlay.open{display:flex}
.ss-top{display:flex;align-items:center;justify-content:space-between;padding:.8rem 1.2rem;background:rgba(0,0,0,.6);position:absolute;top:0;left:0;right:0;z-index:10}
.ss-title{color:rgba(255,255,255,.8);font-size:.85rem;font-weight:500}
.ss-controls{display:flex;align-items:center;gap:.6rem}
.ss-btn{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.15);color:#fff;
padding:.3rem .7rem;border-radius:8px;cursor:pointer;font-size:.75rem;font-family:inherit;transition:all .2s}
.ss-btn:hover{background:rgba(255,255,255,.22)}
.ss-btn.active{background:var(--pri);border-color:var(--pri)}
.ss-close{background:none;border:none;color:rgba(255,255,255,.6);font-size:1.8rem;cursor:pointer;transition:color .2s;line-height:1}
.ss-close:hover{color:#fff}
.ss-body{flex:1;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.ss-img{max-width:92vw;max-height:80vh;object-fit:contain;border-radius:6px;transition:opacity .4s ease}
.ss-img.fade{opacity:0}
.ss-arrow{position:absolute;top:50%;transform:translateY(-50%);width:52px;height:52px;border-radius:50%;
background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.7);
font-size:1.4rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;z-index:5}
.ss-arrow:hover{background:rgba(255,255,255,.18);color:#fff}
.ss-arrow.left{left:1.5rem}.ss-arrow.right{right:1.5rem}
.ss-bottom{position:absolute;bottom:0;left:0;right:0;padding:1rem 1.5rem;
background:linear-gradient(transparent,rgba(0,0,0,.7));z-index:5;display:flex;align-items:flex-end;justify-content:space-between}
.ss-date{color:rgba(255,255,255,.8);font-size:.9rem;font-weight:500}
.ss-msg{color:rgba(255,255,255,.6);font-size:.8rem;max-width:60%;text-align:right;
overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.ss-progress{position:absolute;bottom:0;left:0;height:3px;background:var(--pri);transition:width .3s linear;z-index:11}
.ss-counter{color:rgba(255,255,255,.5);font-size:.75rem}

/* LIGHTBOX */
.lb{display:none;position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.93);backdrop-filter:blur(14px);
align-items:center;justify-content:center;flex-direction:column}
.lb.open{display:flex}
.lb img{max-width:94vw;max-height:84vh;object-fit:contain;border-radius:5px;box-shadow:0 16px 48px rgba(0,0,0,.5);animation:zi .25s ease}
@keyframes zi{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}
.lb-x{position:absolute;top:1rem;right:1.2rem;background:none;border:none;color:rgba(255,255,255,.5);font-size:2rem;cursor:pointer;z-index:1001;line-height:1}
.lb-x:hover{color:#fff}
.lb-nav{display:flex;gap:1rem;margin-top:1rem;align-items:center}
.lb-b{width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.1);
color:#fff;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}
.lb-b:hover{background:rgba(255,255,255,.2)}
.lb-c{color:rgba(255,255,255,.55);font-size:.82rem;min-width:55px;text-align:center}
.lb-dt{color:rgba(255,255,255,.4);font-size:.75rem;margin-top:.4rem}

.to-top{position:fixed;bottom:1.5rem;right:1.5rem;width:42px;height:42px;border-radius:50%;
background:var(--pri);color:#fff;border:none;cursor:pointer;font-size:1.1rem;
box-shadow:0 3px 14px var(--pri-g);opacity:0;pointer-events:none;transition:all .3s;z-index:50;
display:flex;align-items:center;justify-content:center}
.to-top.show{opacity:1;pointer-events:auto}
.to-top:hover{transform:translateY(-2px)}

.hidden{display:none!important}
@media(max-width:640px){
  header h1{font-size:1.4rem}
  .main{padding:.8rem .5rem 3rem}
  .card{border-radius:12px}
  .photos.g5,.photos.gm{grid-template-columns:1fr 1fr}
  .gal-grid{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}
  .tb-row{flex-wrap:nowrap}
  .ss-arrow{width:40px;height:40px;font-size:1.1rem}
  .ss-arrow.left{left:.5rem}.ss-arrow.right{right:.5rem}
  .ss-msg{display:none}
}
</style>
</head><body>

<header>
  <h1>📔 푸르니 알림장</h1>
  <p class="sub">우리 아이의 소중한 하루하루</p>
  <div class="chips">
    <div class="chip">📋 <b>${notifications.length}</b> 알림</div>
    <div class="chip">📸 <b>${totalPhotos}</b> 사진</div>
    <div class="chip">✉️ <b>${totalMsgs}</b> 메시지</div>
  </div>
</header>

<div class="toolbar">
  <div class="tb-inner">
    <div class="tb-row">
      <span class="pill-label">연도</span>
      <div class="pills" id="yearPills">
        <button class="pill on" onclick="pickYear('all',this)">전체</button>
        ${yearKeys.map(y => `<button class="pill" onclick="pickYear('${y}',this)">${y}년</button>`).join('')}
      </div>
      <div class="search-box">
        <input type="text" placeholder="메시지 검색..." oninput="onSearch(this.value)">
      </div>
      <div class="vbtns">
        <button class="vb on" data-v="timeline" onclick="setView('timeline',this)">📋</button>
        <button class="vb" data-v="gallery" onclick="setView('gallery',this)">🖼️</button>
        <button class="vb" data-v="slideshow" onclick="startSlideshow()">▶️</button>
      </div>
    </div>
    <div class="tb-row" id="monthRow">
      <span class="pill-label">월</span>
      <div class="pills" id="monthPills">
        <button class="pill on" onclick="pickMonth('all',this)">전체</button>
      </div>
    </div>
  </div>
</div>

<div class="main" id="main">
  <!-- TIMELINE -->
  <div id="vTimeline">
  ${Object.entries(years).sort(([a], [b]) => b.localeCompare(a)).map(([yr, months]) =>
    Object.entries(months).sort(([a], [b]) => b.localeCompare(a)).map(([mo, notis]) => `
    <div class="mg" data-y="${yr}" data-m="${mo}">
      <div class="mlabel">📅 ${yr}년 ${parseInt(mo)}월 <span class="cnt">${notis.length}개</span></div>
      ${notis.map(n => {
      const d = new Date(n.date + 'T00:00:00');
      const dw = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
      const pc = n.photos.length; const gc = pc <= 5 ? `g${pc}` : 'gm';
      return `
      <div class="card">
        <div class="card-h">
          <div class="card-d">${n.date.slice(5)}<span class="dw">${dw}</span></div>
          <div class="bds">${pc ? `<span class="bd bd-p">📸 ${pc}</span>` : ''}${n.teacherMessage ? '<span class="bd bd-m">✉️</span>' : ''}</div>
        </div>
        ${pc ? `<div class="photos ${gc}">${n.photos.map((p, i) => `<div class="pi" onclick="openLB('${n.date}',${i})"><img src="${p}" loading="lazy"></div>`).join('')}</div>` : ''}
        ${n.teacherMessage || n.parentMessage ? `<div class="msgs">
          ${n.teacherMessage ? `<div class="mb mb-t"><div class="mb-l">👩‍🏫 선생님</div><div class="mb-tx">${esc(n.teacherMessage)}</div></div>` : ''}
          ${n.parentMessage ? `<div class="mb mb-p"><div class="mb-l">🏠 가정</div><div class="mb-tx">${esc(n.parentMessage)}</div></div>` : ''}
        </div>`: ''}
      </div>`;
    }).join('')}
    </div>`).join('')
  ).join('')}
  </div>

  <!-- GALLERY -->
  <div id="vGallery" class="hidden">
    <div class="gal-grid">${allPhotos.map((p, i) =>
    `<div class="gi" data-y="${p.date.substring(0, 4)}" data-m="${p.date.substring(5, 7)}" data-msg="${esc(p.msg || '')}" onclick="openLBG(${i})"><img src="${p.src}" loading="lazy"><div class="gd">${p.date.slice(5)}</div></div>`
  ).join('')}</div>
  </div>
</div>

<!-- SLIDESHOW -->
<div class="ss-overlay" id="ssOverlay">
  <div class="ss-top">
    <div class="ss-title">📔 슬라이드쇼</div>
    <div class="ss-controls">
      <span class="ss-counter" id="ssCnt"></span>
      <button class="ss-btn" id="ssSpeed" onclick="cycleSpeed()">5초</button>
      <button class="ss-btn active" id="ssPlayBtn" onclick="togglePlay()">⏸</button>
      <button class="ss-close" onclick="stopSlideshow()">&times;</button>
    </div>
  </div>
  <div class="ss-body">
    <button class="ss-arrow left" onclick="ssNav(-1)">‹</button>
    <img class="ss-img" id="ssImg" src="">
    <button class="ss-arrow right" onclick="ssNav(1)">›</button>
  </div>
  <div class="ss-bottom">
    <div class="ss-date" id="ssDate"></div>
    <div class="ss-msg" id="ssMsg"></div>
  </div>
  <div class="ss-progress" id="ssProgress"></div>
</div>

<!-- LIGHTBOX -->
<div class="lb" id="lb">
  <button class="lb-x" onclick="closeLB()">&times;</button>
  <img id="lbImg" src="">
  <div class="lb-nav">
    <button class="lb-b" onclick="navLB(event,-1)">‹</button>
    <span class="lb-c" id="lbC"></span>
    <button class="lb-b" onclick="navLB(event,1)">›</button>
  </div>
  <div class="lb-dt" id="lbDt"></div>
</div>

<button class="to-top" id="toTop" onclick="window.scrollTo({top:0,behavior:'smooth'})">↑</button>

<script>
const PD=${JSON.stringify(notifications.reduce((a, n) => { a[n.date] = n.photos; return a; }, {}))};
const AP=${JSON.stringify(allPhotos)};
const YEARS=${JSON.stringify(years, null, 0)};

let curYear='all', curMonth='all', curView='timeline', curSearch='';

// ── SEARCH ──
function onSearch(val) {
  curSearch = val.toLowerCase().trim();
  applyFilter();
}

// ── YEAR / MONTH FILTER ──
function pickYear(y, btn) {
  curYear=y; curMonth='all';
  document.querySelectorAll('#yearPills .pill').forEach(p=>p.classList.remove('on'));
  btn.classList.add('on');
  buildMonthPills();
  applyFilter();
}
function pickMonth(m, btn) {
  curMonth=m;
  document.querySelectorAll('#monthPills .pill').forEach(p=>p.classList.remove('on'));
  btn.classList.add('on');
  applyFilter();
}
function buildMonthPills() {
  const mp=document.getElementById('monthPills');
  let html='<button class="pill on" onclick="pickMonth(\\'all\\',this)">전체</button>';
  if(curYear!=='all' && YEARS[curYear]) {
    Object.keys(YEARS[curYear]).sort().reverse().forEach(m=>{
      html+=\`<button class="pill" onclick="pickMonth('\${m}',this)">\${parseInt(m)}월</button>\`;
    });
  } else {
    // Collect all unique months across all years
    const ms=new Set();
    Object.values(YEARS).forEach(yv=>Object.keys(yv).forEach(m=>ms.add(m)));
    [...ms].sort().reverse().forEach(m=>{
      html+=\`<button class="pill" onclick="pickMonth('\${m}',this)">\${parseInt(m)}월</button>\`;
    });
  }
  mp.innerHTML=html;
}
function applyFilter() {
  // Timeline
  document.querySelectorAll('.mg').forEach(g=>{
    const yOk=curYear==='all'||g.dataset.y===curYear;
    const mOk=curMonth==='all'||g.dataset.m===curMonth;
    
    let gHasMatch = false;
    g.querySelectorAll('.card').forEach(c => {
      const txt = c.innerText.toLowerCase();
      const sOk = !curSearch || txt.includes(curSearch);
      c.classList.toggle('hidden', !sOk);
      if (sOk) gHasMatch = true;
    });

    g.style.display=(yOk&&mOk&&gHasMatch)?'':'none';
  });
  // Gallery
  const visArray = [];
  document.querySelectorAll('.gi').forEach(g=>{
    const yOk=curYear==='all'||g.dataset.y===curYear;
    const mOk=curMonth==='all'||g.dataset.m===curMonth;
    const sOk=!curSearch || (g.dataset.msg && g.dataset.msg.toLowerCase().includes(curSearch));
    g.style.display=(yOk&&mOk&&sOk)?'':'none';
  });
}

// ── VIEW TOGGLE ──
function setView(v, btn) {
  curView=v;
  document.getElementById('vTimeline').classList.toggle('hidden',v!=='timeline');
  document.getElementById('vGallery').classList.toggle('hidden',v!=='gallery');
  document.querySelectorAll('.vb').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
}

// ── LIGHTBOX (timeline mode) ──
let lbD='',lbI=0;
function openLB(date,idx){lbD=date;lbI=idx;const p=PD[date]||[];showLB(p[idx],idx+1,p.length,date)}
function navLB(e,dir){
  e.stopPropagation();
  if(curView==='gallery')return navLBG(e,dir);
  const p=PD[lbD]||[];lbI=(lbI+dir+p.length)%p.length;showLB(p[lbI],lbI+1,p.length,lbD);
}
// LIGHTBOX (gallery mode)
let gI=0,visG=[];
function buildVisG(){visG=[];document.querySelectorAll('.gi').forEach((e,i)=>{if(e.style.display!=='none')visG.push(i)})}
function openLBG(ai){buildVisG();gI=visG.indexOf(ai);if(gI<0)gI=0;const p=AP[visG[gI]];showLB(p.src,gI+1,visG.length,p.date)}
function navLBG(e,dir){e.stopPropagation();gI=(gI+dir+visG.length)%visG.length;const p=AP[visG[gI]];showLB(p.src,gI+1,visG.length,p.date)}

function showLB(s,c,t,d){document.getElementById('lbImg').src=s;document.getElementById('lbC').textContent=c+' / '+t;
document.getElementById('lbDt').textContent=d;document.getElementById('lb').classList.add('open');document.body.style.overflow='hidden'}
function closeLB(){document.getElementById('lb').classList.remove('open');document.body.style.overflow=''}
document.getElementById('lb').addEventListener('click',e=>{if(e.target===document.getElementById('lb'))closeLB()});

// ── SLIDESHOW ──
let ssIdx=0, ssPlaying=false, ssTimer=null, ssInterval=5000, ssPhotos=[];
const SPEEDS=[3000,5000,8000,12000];
let speedIdx=1;

function getFilteredPhotos(){
  return AP.filter(p=>{
    const yOk=curYear==='all'||p.date.substring(0,4)===curYear;
    const mOk=curMonth==='all'||p.date.substring(5,7)===curMonth;
    const sOk=!curSearch || (p.msg && p.msg.toLowerCase().includes(curSearch));
    return yOk&&mOk&&sOk;
  });
}
function startSlideshow(){
  ssPhotos=getFilteredPhotos();
  if(!ssPhotos.length)return;
  ssIdx=0; ssPlaying=true;
  document.getElementById('ssOverlay').classList.add('open');
  document.body.style.overflow='hidden';
  document.getElementById('ssPlayBtn').textContent='⏸';
  document.getElementById('ssPlayBtn').classList.add('active');
  showSS();
  startSSTimer();
}
function stopSlideshow(){
  ssPlaying=false; clearInterval(ssTimer);
  document.getElementById('ssOverlay').classList.remove('open');
  document.body.style.overflow='';
}
function showSS(){
  const p=ssPhotos[ssIdx];
  const img=document.getElementById('ssImg');
  img.classList.add('fade');
  setTimeout(()=>{
    img.src=p.src;
    img.onload=()=>img.classList.remove('fade');
    document.getElementById('ssDate').textContent=p.date;
    document.getElementById('ssMsg').textContent=p.msg||'';
    document.getElementById('ssCnt').textContent=(ssIdx+1)+' / '+ssPhotos.length;
    document.getElementById('ssProgress').style.transition='none';
    document.getElementById('ssProgress').style.width='0%';
    requestAnimationFrame(()=>{
      document.getElementById('ssProgress').style.transition='width '+(ssInterval/1000)+'s linear';
      document.getElementById('ssProgress').style.width='100%';
    });
  },200);
}
function startSSTimer(){clearInterval(ssTimer);if(ssPlaying)ssTimer=setInterval(()=>{ssIdx=(ssIdx+1)%ssPhotos.length;showSS()},ssInterval)}
function ssNav(dir){ssIdx=(ssIdx+dir+ssPhotos.length)%ssPhotos.length;showSS();if(ssPlaying){startSSTimer()}}
function togglePlay(){
  ssPlaying=!ssPlaying;
  document.getElementById('ssPlayBtn').textContent=ssPlaying?'⏸':'▶';
  document.getElementById('ssPlayBtn').classList.toggle('active',ssPlaying);
  if(ssPlaying)startSSTimer(); else clearInterval(ssTimer);
}
function cycleSpeed(){
  speedIdx=(speedIdx+1)%SPEEDS.length;
  ssInterval=SPEEDS[speedIdx];
  document.getElementById('ssSpeed').textContent=(ssInterval/1000)+'초';
  if(ssPlaying)startSSTimer();
}

// ── KEYBOARD ──
document.addEventListener('keydown',e=>{
  if(document.getElementById('ssOverlay').classList.contains('open')){
    if(e.key==='Escape')stopSlideshow();
    if(e.key==='ArrowLeft')ssNav(-1);
    if(e.key==='ArrowRight')ssNav(1);
    if(e.key===' '){e.preventDefault();togglePlay();}
    return;
  }
  if(document.getElementById('lb').classList.contains('open')){
    if(e.key==='Escape')closeLB();
    if(e.key==='ArrowLeft')navLB(e,-1);
    if(e.key==='ArrowRight')navLB(e,1);
  }
});

// ── SCROLL ──
window.addEventListener('scroll',()=>document.getElementById('toTop').classList.toggle('show',window.scrollY>400));

// Init month pills
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
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  📔 푸르니 알림장 뷰어 v3                        ║`);
  console.log(`╚══════════════════════════════════════════════════╝`);
  console.log(`📋 ${n.length}개 알림 | 📸 ${tp}장 | 📁 ${DATA_DIR}`);
  console.log(`\n🌐 http://localhost:${PORT}\n`);
});
