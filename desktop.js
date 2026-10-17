/* LaisaOS — desktop logic. Content and asset paths live in config.js. */
(() => {
const I = ASSETS.icons, U = ASSETS.ui;
const img = (src, cls = 'ico', alt = '') => `<img class="${cls}" src="${src}" alt="${alt}" draggable="false">`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- tree ---------- */
const desktop = { name: 'Desktop', type: 'folder', children: DESKTOP_ITEMS };
const isFolder = n => ['folder', 'computer', 'drive', 'bin'].includes(n.type);
const typeName = n => ({ folder: 'File folder', computer: 'System folder', drive: 'Local Disk', bin: 'System folder', txt: 'Text Document', img: 'Picture', video: 'Video', minesweeper: 'Game', wordle: 'Game', pinball: 'Game', paint: 'Application' })[n.type];
function iconSrc(n) {
  if (n.icon) return n.icon;
  if (n.type === 'img') return n.src;
  if (n.type === 'video' && n.poster) return n.poster;
  if (n.type === 'folder') return n.art ? I.folderArts : I.folder;
  if (n.type === 'bin') return n.children.length ? I.binFull : I.binEmpty;
  return { txt: I.textFile, computer: I.computer, drive: I.drive, video: I.video, minesweeper: I.minesweeper, wordle: I.wordle, paint: I.paint, pinball: I.pinball }[n.type] || I.textFile;
}
const isThumb = n => !n.icon && (n.type === 'img' || (n.type === 'video' && n.poster));
const iconFor = n => img(iconSrc(n), isThumb(n) ? (n.pixel ? 'th px' : 'th') : 'ico');
function pathTo(target, n = desktop, acc = []) {
  const p = [...acc, n]; if (n === target) return p;
  for (const c of n.children || []) if (isFolder(c)) { const r = pathTo(target, c, p); if (r) return r; }
  return null;
}

/* ---------- text files ---------- */
// give every note its content/... path, based on where it sits (desktop folders first, then Computer)
(function assign(items, dir) {
  items.forEach(n => {
    if (n.type === 'txt') { if (!n.file) n.file = ['content', ...dir, n.name].join('/'); }
    else if (n.children) assign(n.children, n.type === 'computer' || n.type === 'drive' ? dir : [...dir, n.name]);
  });
})([...DESKTOP_ITEMS.filter(n => n.type !== 'computer'), ...DESKTOP_ITEMS.filter(n => n.type === 'computer')], []);
const textCache = {};
const urlOf = p => p.split('/').map(encodeURIComponent).join('/');
function fetchText(path) {
  return textCache[path] ||= fetch(urlOf(path), { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
    .catch(err => { delete textCache[path]; throw err; });
}
function loadText(n) {
  if (n.text != null) return Promise.resolve(n.text);
  return fetchText(n.file).catch(() => `Couldn't open ${n.file}\n\nCheck that the file exists in the content folder.\nIf you opened index.html straight from your computer, run\nstart-local-server.bat (or upload the site) so the browser\nis allowed to read the txt files.`);
}

/* ---------- apply assets ---------- */
document.title = SITE_NAME;
document.body.style.backgroundImage = `url("${ASSETS.wallpaper}")`;
document.getElementById('taskbar').style.backgroundImage = `url("${ASSETS.taskbar}")`;
const rootStyle = document.documentElement.style;
if (WINDOW_LOOK.color) rootStyle.setProperty('--glass', WINDOW_LOOK.color);
if (WINDOW_LOOK.inactiveColor) rootStyle.setProperty('--glass-dim', WINDOW_LOOK.inactiveColor);
if (WINDOW_LOOK.texture) rootStyle.setProperty('--glass-texture', `url("${WINDOW_LOOK.texture}")`);
if (WINDOW_LOOK.textureSize) rootStyle.setProperty('--glass-texture-size', WINDOW_LOOK.textureSize);
document.querySelector('#orb').innerHTML = img(ASSETS.startOrb, '', 'Start');
const wm = document.getElementById('watermark');
if (ASSETS.watermark) wm.src = ASSETS.watermark; else wm.remove();

/* ---------- window manager ---------- */
const wins = []; let z = 10, cascade = 0;
const touchy = matchMedia('(hover:none)').matches;
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

function makeWin({ title, icon, w = 640, h = 440, cls = '', noMax = false }) {
  const dw = innerWidth, dh = innerHeight - 40;
  w = Math.min(w, dw - 20); h = Math.min(h, dh - 20);
  const x = Math.max(10, Math.min(dw - w - 10, (dw - w) / 2 - 120 + cascade * 28));
  const y = Math.max(8, Math.min(dh - h - 8, (dh - h) / 2 - 70 + cascade * 28));
  if (!cls) cascade = (cascade + 1) % 6;
  const win = el(`<div class="win opening ${cls}" role="dialog" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">
    <div class="tb"><span class="ti">${img(icon)}</span><span class="ttl"></span>
    <div class="caps">${noMax ? '' : `<button class="cap mn" aria-label="Minimize">${img(U.minimize, '')}</button><button class="cap mx" aria-label="Maximize">${img(U.maximize, '')}</button>`}<button class="cap cls" aria-label="Close">${img(U.close, '')}</button></div></div>
    <div class="wbody"></div></div>`);
  document.body.insertBefore(win, document.getElementById('taskbar'));
  const tk = el(`<button class="tk">${img(icon)}</button>`);
  document.getElementById('tasks').append(tk);
  const W = { el: win, body: win.querySelector('.wbody'), tk, onClose: null,
    setTitle(t) { win.querySelector('.ttl').textContent = t; tk.title = t; win.setAttribute('aria-label', t); },
    setIcon(src) { win.querySelector('.ti').innerHTML = img(src); tk.innerHTML = img(src); } };
  W.setTitle(title); wins.push(W);
  win.addEventListener('animationend', () => win.classList.remove('opening'), { once: true });
  win.addEventListener('pointerdown', () => focusWin(W));
  win.querySelector('.cls').onclick = () => closeWin(W);
  if (!noMax) {
    win.querySelector('.mn').onclick = e => { e.stopPropagation(); win.classList.add('min'); focusTop(); };
    win.querySelector('.mx').onclick = () => toggleMax(W);
  }
  tk.onclick = () => {
    if (win.classList.contains('min')) { win.classList.remove('min'); focusWin(W); }
    else if (win.classList.contains('active') && !noMax) { win.classList.add('min'); focusTop(); }
    else focusWin(W);
  };
  const tb = win.querySelector('.tb');
  tb.addEventListener('dblclick', e => { if (!noMax && !e.target.closest('.caps')) toggleMax(W); });
  tb.addEventListener('pointerdown', e => {
    if (e.target.closest('.caps') || innerWidth <= 640) return;
    if (win.classList.contains('max')) { const r = e.clientX / innerWidth; toggleMax(W); win.style.left = (e.clientX - win.offsetWidth * r) + 'px'; win.style.top = '0px'; }
    const ox = e.clientX - win.offsetLeft, oy = e.clientY - win.offsetTop; tb.setPointerCapture(e.pointerId);
    const mv = ev => { win.style.left = Math.min(innerWidth - 60, Math.max(60 - win.offsetWidth, ev.clientX - ox)) + 'px'; win.style.top = Math.min(innerHeight - 80, Math.max(0, ev.clientY - oy)) + 'px'; };
    const up = () => { tb.removeEventListener('pointermove', mv); tb.removeEventListener('pointerup', up); };
    tb.addEventListener('pointermove', mv); tb.addEventListener('pointerup', up);
  });
  focusWin(W); return W;
}
function toggleMax(W) {
  const s = W.el.style;
  if (W.el.classList.toggle('max')) { W.prev = [s.left, s.top, s.width, s.height]; Object.assign(s, { left: '0px', top: '0px', width: '100%', height: 'calc(100% - 40px)' }); }
  else if (W.prev) [s.left, s.top, s.width, s.height] = W.prev;
}
function focusWin(W) { wins.forEach(o => { o.el.classList.remove('active'); o.tk.classList.remove('on'); }); W.el.classList.remove('min'); W.el.classList.add('active'); W.tk.classList.add('on'); W.el.style.zIndex = ++z; }
function focusTop() {
  wins.forEach(o => { o.el.classList.remove('active'); o.tk.classList.remove('on'); });
  const top = wins.filter(w => !w.el.classList.contains('min')).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
  if (top) focusWin(top);
}
function closeWin(W) { W.onClose && W.onClose(); W.el.remove(); W.tk.remove(); wins.splice(wins.indexOf(W), 1); focusTop(); }

/* ---------- "you are not him" ---------- */
let msgWin = null;
function notHim() {
  if (msgWin) { focusWin(msgWin); return; }
  const W = makeWin({ title: SITE_NAME, icon: I.info, w: 320, h: 150, cls: 'msgbox', noMax: true });
  W.body.innerHTML = `<div class="msg-body">${img(I.info, '')}<span></span></div><div class="msg-foot"><button class="okbtn">OK</button></div>`;
  W.body.querySelector('span').textContent = NOT_HIM_MESSAGE;
  const ok = W.body.querySelector('.okbtn'); ok.onclick = () => closeWin(W); ok.focus();
  W.onClose = () => { msgWin = null; };
  msgWin = W;
}

/* ---------- open ---------- */
function openNode(n, folder) {
  if (isFolder(n)) return openExplorer(n);
  if (n.type === 'txt') return openNotepad(n);
  if (n.type === 'img') return openViewer(n, folder || parentOf(n) || desktop);
  if (n.type === 'video') return openVideo(n);
  if (n.type === 'minesweeper') return openMinesweeper();
  if (n.type === 'wordle') return openWordle();
  if (n.type === 'paint') return openPaint();
  if (n.type === 'pinball') return openPinball();
}
function parentOf(target, n = desktop) {
  for (const c of n.children || []) { if (c === target) return n; if (c.children) { const p = parentOf(target, c); if (p) return p; } }
  return null;
}

function openExplorer(start) {
  const W = makeWin({ title: start.name, icon: iconSrc(start), w: 760, h: 500 });
  W.body.innerHTML = `<div class="tools"></div><div class="emain"><nav class="side"></nav><div class="files" role="list"></div></div><div class="details"></div>`;
  const sid = 'search-' + Math.random().toString(36).slice(2);
  const nav = el(`<div class="nav"><button class="nb bk" aria-label="Back">${img(U.back, '')}</button><button class="nb fw" aria-label="Forward">${img(U.forward, '')}</button><button class="nb upb" aria-label="Up one level">${img(U.up, '')}</button><div class="addr"></div><input class="search" id="${sid}" placeholder="Search" aria-label="Search this folder"></div>`);
  W.el.insertBefore(nav, W.body);
  const st = { hist: [start], i: 0, filter: '', sel: null };
  const cur = () => st.hist[st.i];
  const go = n => { st.hist = st.hist.slice(0, st.i + 1); st.hist.push(n); st.i++; st.filter = ''; nav.querySelector('.search').value = ''; render(); };
  nav.querySelector('.bk').onclick = () => { if (st.i > 0) { st.i--; render(); } };
  nav.querySelector('.fw').onclick = () => { if (st.i < st.hist.length - 1) { st.i++; render(); } };
  nav.querySelector('.upb').onclick = () => { const p = pathTo(cur()); if (p && p.length > 1) go(p[p.length - 2]); };
  nav.querySelector('.search').oninput = e => { st.filter = e.target.value.toLowerCase(); render(); };

  const favs = [desktop, ...DESKTOP_ITEMS.filter(n => n.type === 'folder')];
  const drives = []; (function walk(n) { (n.children || []).forEach(c => { if (c.type === 'drive') drives.push(c); else if (c.type === 'computer') walk(c); }); })(desktop);
  const side = W.body.querySelector('.side');
  side.innerHTML = `<h4>Favorites</h4>` + favs.map((n, k) => `<div class="sl" data-f="${k}">${img(iconSrc(n))}${esc(n.name)}</div>`).join('')
    + (drives.length ? `<h4>Computer</h4>` + drives.map((n, k) => `<div class="sl" data-d="${k}">${img(iconSrc(n))}${esc(n.name)}</div>`).join('') : '');
  side.querySelectorAll('.sl').forEach(s => s.onclick = () => go(s.dataset.f != null ? favs[s.dataset.f] : drives[s.dataset.d]));

  function render() {
    const n = cur(); W.setTitle(n.name); W.setIcon(iconSrc(n));
    nav.querySelector('.bk').disabled = st.i === 0;
    nav.querySelector('.fw').disabled = st.i >= st.hist.length - 1;
    const path = pathTo(n) || [n]; nav.querySelector('.upb').disabled = path.length < 2;
    const addr = nav.querySelector('.addr'); addr.innerHTML = '';
    path.forEach((p, k) => {
      if (k) addr.append(el('<span class="sep">▶</span>'));
      const c = el('<span class="crumb"></span>'); c.textContent = p.name; c.onclick = () => { if (p !== n) go(p); }; addr.append(c);
    });
    addr.scrollLeft = 9999;

    const tools = W.body.querySelector('.tools'); tools.innerHTML = '';
    const tb = (label, fn) => { const b = el('<button class="tbtn"></button>'); b.textContent = label; b.onclick = fn; tools.append(b); };
    tb('Open', () => st.sel && open(st.sel));
    if (n.type === 'folder') tb('New text document', notHim);
    if (n.art) {
      tb('Add pictures', notHim);
      const pics = n.children.filter(c => c.type === 'img');
      if (pics.length) tb('Slide show', () => openViewer(pics[0], n, true));
    }
    if (n.type === 'bin' && n.children.length) tb('Empty the Recycle Bin', notHim);
    tb('Delete', notHim);

    const files = W.body.querySelector('.files'); files.classList.toggle('art', !!n.art); files.innerHTML = '';
    const list = n.children.filter(c => !st.filter || c.name.toLowerCase().includes(st.filter));
    if (!list.length) files.append(el(`<div class="empty">${st.filter ? 'No items match your search.' : 'This folder is empty.'}</div>`));
    list.forEach(c => {
      const item = el(`<div class="fi${c.type === 'drive' ? ' drive' : ''}" role="listitem" tabindex="0"><div class="ic">${iconFor(c)}</div></div>`);
      if (c.type === 'drive') item.append(el(`<div class="meta"><span>${esc(c.name)}</span><div class="bar"><i style="width:${(c.used || 0) * 100}%"></i></div><span class="dim">${esc(c.free || '')}</span></div>`));
      else { const lb = el('<div class="lb"></div>'); lb.textContent = c.name; item.append(lb); }
      item.onclick = () => { files.querySelectorAll('.fi').forEach(f => f.classList.remove('sel')); item.classList.add('sel'); st.sel = c; details(c); if (touchy) open(c); };
      item.ondblclick = () => open(c);
      item.onkeydown = e => { if (e.key === 'Enter') open(c); if (e.key === 'Delete') notHim(); };
      files.append(item);
    });
    st.sel = null; details(null);
  }
  function open(c) { if (isFolder(c)) go(c); else openNode(c, cur()); }
  function details(c) {
    const d = W.body.querySelector('.details'), n = cur();
    if (!c) { d.innerHTML = `<span class="ic">${img(iconSrc(n))}</span><span>${n.children.length} item${n.children.length === 1 ? '' : 's'}</span>`; return; }
    d.innerHTML = `<span class="ic">${img(iconSrc(c))}</span><span><b>${esc(c.name)}</b><br><span class="dim">${typeName(c)}</span></span>`;
  }
  render(); return W;
}

function openNotepad(n) {
  const W = makeWin({ title: `${n.name} - Notepad`, icon: I.notepad, w: 560, h: 420 });
  const id = 'pad-' + Math.random().toString(36).slice(2);
  W.body.innerHTML = `<div class="menu"></div><textarea class="pad" id="${id}" spellcheck="false" readonly aria-label="${esc(n.name)}"></textarea><div class="status"><span class="pos">Ln 1, Col 1</span><span class="zm">100%</span></div>`;
  const ta = W.body.querySelector('textarea'); ta.value = 'Loading...';
  loadText(n).then(t => { ta.value = t.replace(/\r\n/g, '\n'); });
  let zoom = 100, wrap = true;
  const pos = () => { const v = ta.value.slice(0, ta.selectionStart).split('\n'); W.body.querySelector('.pos').textContent = `Ln ${v.length}, Col ${v[v.length - 1].length + 1}`; };
  ta.addEventListener('keyup', pos); ta.addEventListener('click', pos);
  ta.addEventListener('keydown', e => {
    const typing = (e.key.length === 1 && !e.ctrlKey && !e.metaKey) || ['Backspace', 'Delete', 'Enter', 'Tab'].includes(e.key) || ((e.ctrlKey || e.metaKey) && ['v', 'x', 'z', 'y'].includes(e.key.toLowerCase()));
    if (typing) { e.preventDefault(); notHim(); }
  });
  ['paste', 'cut', 'drop'].forEach(ev => ta.addEventListener(ev, e => { e.preventDefault(); notHim(); }));
  if (touchy) ta.addEventListener('focus', () => { ta.blur(); });

  const setZoom = v => { zoom = Math.max(50, Math.min(300, v)); ta.style.fontSize = 13 * zoom / 100 + 'px'; W.body.querySelector('.zm').textContent = zoom + '%'; };
  const menus = {
    File: [['New', notHim], ['Save', notHim], ['Close', () => closeWin(W)]],
    Edit: [['Select All', () => { ta.focus(); ta.select(); }], ['Delete', notHim]],
    Format: [['Word Wrap', () => { wrap = !wrap; ta.classList.toggle('nowrap', !wrap); }, () => wrap]],
    View: [['Zoom In', () => setZoom(zoom + 10)], ['Zoom Out', () => setZoom(zoom - 10)], ['Restore Default Zoom', () => setZoom(100)]],
  };
  menuBar(W, W.body.querySelector('.menu'), menus);
  return W;
}

// menus: { Name: [[label, fn, isChecked?], ...] }
function menuBar(W, bar, menus) {
  let dd = null;
  const closeDD = () => { dd && dd.remove(); dd = null; bar.querySelectorAll('.mi').forEach(m => m.classList.remove('open')); };
  Object.entries(menus).forEach(([name, items]) => {
    const b = el(`<button class="mi">${name}</button>`); bar.append(b);
    b.onclick = e => {
      e.stopPropagation(); const was = b.classList.contains('open'); closeDD(); if (was) return;
      b.classList.add('open'); dd = el('<div class="drop"></div>'); dd.style.left = b.offsetLeft + 'px';
      items.forEach(([l, fn, on]) => { const i = el('<button></button>'); i.textContent = l; if (on && on()) i.classList.add('on'); i.onclick = () => { closeDD(); fn(); }; dd.append(i); });
      bar.append(dd);
    };
  });
  const outside = e => { if (dd && !bar.contains(e.target)) closeDD(); };
  document.addEventListener('pointerdown', outside);
  const prev = W.onClose;
  W.onClose = () => { prev && prev(); document.removeEventListener('pointerdown', outside); };
}

function openViewer(n, folder, auto) {
  const W = makeWin({ title: '', icon: I.photoViewer, w: 620, h: 500 });
  W.body.innerHTML = `<div class="pv"><img alt=""></div><div class="pvbar"><button class="pvb pr" aria-label="Previous">${img(U.previous, '')}</button><button class="pvb big pl" aria-label="Play slide show">${img(U.play, '')}</button><button class="pvb nx" aria-label="Next">${img(U.next, '')}</button><span class="pvname"></span></div>`;
  const view = W.body.querySelector('.pv img'); let timer = null;
  const list = () => folder.children.filter(c => c.type === 'img');
  let i = Math.max(0, list().indexOf(n));
  // fit the window to the first picture's shape (tall photos get a tall window)
  view.addEventListener('load', () => {
    if (innerWidth <= 640 || W.el.classList.contains('max')) return;
    const pv = W.body.querySelector('.pv'), exW = W.el.offsetWidth - pv.clientWidth, exH = W.el.offsetHeight - pv.clientHeight;
    const s = Math.min(1, (innerWidth * 0.85 - exW - 24) / view.naturalWidth, ((innerHeight - 40) * 0.88 - exH - 24) / view.naturalHeight);
    const w = Math.max(380, Math.round(view.naturalWidth * s) + 24 + exW), h = Math.round(view.naturalHeight * s) + 24 + exH;
    Object.assign(W.el.style, { width: w + 'px', height: h + 'px',
      left: Math.max(10, Math.min(innerWidth - w - 10, W.el.offsetLeft + (W.el.offsetWidth - w) / 2)) + 'px',
      top: Math.max(8, Math.min(innerHeight - 40 - h - 8, W.el.offsetTop + (W.el.offsetHeight - h) / 2)) + 'px' });
  }, { once: true });
  const show = () => { const l = list(); if (!l.length) return; i = (i + l.length) % l.length; view.src = l[i].src; view.alt = l[i].name; view.classList.toggle('px', !!l[i].pixel); W.setTitle(`${l[i].name} - Photo Viewer`); W.body.querySelector('.pvname').textContent = `${i + 1} of ${l.length}`; };
  W.body.querySelector('.pr').onclick = () => { i--; show(); };
  W.body.querySelector('.nx').onclick = () => { i++; show(); };
  const pl = W.body.querySelector('.pl');
  const toggle = () => {
    if (timer) { clearInterval(timer); timer = null; pl.innerHTML = img(U.play, ''); }
    else { timer = setInterval(() => { i++; show(); }, 2200); pl.innerHTML = img(U.pause, ''); }
  };
  pl.onclick = toggle; W.onClose = () => clearInterval(timer);
  W.el.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { i--; show(); } if (e.key === 'ArrowRight') { i++; show(); } });
  show(); if (auto) toggle(); return W;
}

function openVideo(n) {
  const W = makeWin({ title: `${n.name} - Video Player`, icon: I.video, w: 680, h: 460 });
  W.body.innerHTML = '<div class="vp"><video controls autoplay playsinline preload="metadata"></video></div>';
  const v = W.body.querySelector('video');
  v.volume = SOUND.videoVolume;
  if (n.poster) v.poster = n.poster;
  v.onerror = () => { const e = el('<div class="vp-err"></div>'); e.textContent = `Couldn't play ${n.src}`; W.body.querySelector('.vp').replaceChildren(e); };
  v.src = n.src;
  W.onClose = () => { v.pause(); v.removeAttribute('src'); v.load(); };
  return W;
}

/* ---------- daily puzzles ---------- */
// Daily puzzles follow the UTC date so every visitor gets the same one on the same day.
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
function untilTomorrow() {
  const n = new Date(), ms = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1) - n;
  const h = Math.floor(ms / 36e5), m = Math.floor(ms / 6e4) % 60, sec = Math.floor(ms / 1000) % 60;
  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
}
function seededRandom(text) { // same text -> same sequence of numbers on every computer
  let h = 1779033703 ^ text.length;
  for (let k = 0; k < text.length; k++) { h = Math.imul(h ^ text.charCodeAt(k), 3432918353); h = h << 13 | h >>> 19; }
  return () => {
    h = h + 0x6D2B79F5 | 0;
    let t = Math.imul(h ^ h >>> 15, 1 | h);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// results are kept in this browser only (there is no shared database yet)
const store = {
  get(k, def = null) { try { const v = localStorage.getItem('krowos:' + k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem('krowos:' + k, JSON.stringify(v)); } catch {} },
  all(prefix) {
    const out = [];
    try { for (let k = 0; k < localStorage.length; k++) { const key = localStorage.key(k); if (key.startsWith('krowos:' + prefix)) out.push(JSON.parse(localStorage.getItem(key))); } } catch {}
    return out;
  },
};

/* ---------- minesweeper ---------- */
const MS_LEVELS = { Beginner: [9, 9, 10], Intermediate: [16, 16, 40], Expert: [30, 16, 99] };
const MS_CELL = 24;
// best first: wins by fastest time, then most mines found, then most of the board cleared
const msRank = (a, b) => (b.won - a.won) || (a.won ? a.time - b.time : 0) || (b.bombs - a.bombs) || (b.cleared - a.cleared);
const msTime = ms => (ms / 1000).toFixed(1) + 's';
const msSummary = r => r.won ? `Won in ${msTime(r.time)}` : `Lost: ${r.bombs} of ${r.mines} mines found, ${r.cleared}% cleared`;
let msWin = null;
function openMinesweeper() {
  if (msWin) { focusWin(msWin); return msWin; }
  const W = makeWin({ title: 'Minesweeper', icon: I.minesweeper, w: 9 * MS_CELL + 40, h: 9 * MS_CELL + 160 });
  W.body.innerHTML = '<div class="menu"></div><div class="ms"><div class="ms-in"><div class="ms-mode"></div><div class="ms-panel"><span class="ms-led ms-left"></span><button class="ms-face" aria-label="New game"></button><span class="ms-led ms-time"></span></div><div class="ms-board"><div class="ms-grid" role="grid" aria-label="Minefield"></div><div class="ms-note" hidden></div></div></div></div>';
  const q = sel => W.body.querySelector(sel);
  const grid = q('.ms-grid'), face = q('.ms-face'), ledLeft = q('.ms-left'), ledTime = q('.ms-time'), modeEl = q('.ms-mode'), note = q('.ms-note');
  const FACE = { ok: '🙂', press: '😮', win: '😎', lose: '😵' };
  let level = 'Beginner', daily = false, today = '', cols, rows, mines, cells, started, over, opened, flags, t0 = 0, timer = null;
  const led = n => String(Math.max(-99, Math.min(999, n))).padStart(3, '0');
  const around = i => {
    const x = i % cols, y = (i / cols) | 0, out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((dx || dy) && nx >= 0 && ny >= 0 && nx < cols && ny < rows) out.push(ny * cols + nx);
    }
    return out;
  };
  const stopTimer = () => { clearInterval(timer); timer = null; };
  const dailyKey = () => `ms-daily:${today}:${level}`;

  function newGame(lv = level, isDaily = daily) {
    level = lv; daily = isDaily; [cols, rows, mines] = MS_LEVELS[level];
    stopTimer(); started = over = false; opened = flags = 0;
    cells = Array.from({ length: cols * rows }, () => ({ mine: false, open: false, flag: false, n: 0 }));
    grid.style.gridTemplateColumns = `repeat(${cols}, ${MS_CELL}px)`;
    grid.replaceChildren(...cells.map((_, i) => { const c = el('<div class="ms-c" role="gridcell"></div>'); c.dataset.i = i; return c; }));
    face.textContent = FACE.ok; ledLeft.textContent = led(mines); ledTime.textContent = led(0);
    note.hidden = true;
    if (daily) {
      // everyone gets the same mines and the same opened starting area today
      today = dayKey();
      modeEl.textContent = `Daily challenge · ${level} · ${today}`;
      const rng = seededRandom(`minesweeper|${today}|${level}`);
      const startCell = Math.floor(rng() * cells.length);
      layMines(startCell, rng);
      const prev = store.get(dailyKey());
      if (prev) { // one life: a finished or abandoned daily game can't be replayed
        if (prev.status === 'playing') { prev.status = 'done'; store.set(dailyKey(), prev); }
        over = true; showNote(prev);
      } else flood(startCell);
    } else modeEl.textContent = 'Free play';
    fitWindow();
  }
  function showNote(r) {
    note.hidden = false; note.replaceChildren();
    const add = (tag, text) => { const e = document.createElement(tag); e.textContent = text; note.append(e); return e; };
    add('b', `Today's ${level} challenge is done`);
    add('span', msSummary(r));
    const next = add('span', '');
    const tickNext = () => { next.textContent = `Next board in ${untilTomorrow()}`; };
    tickNext();
    const iv = setInterval(() => { if (note.isConnected && !note.hidden) tickNext(); else clearInterval(iv); }, 1000);
    const btns = add('div', ''); btns.className = 'ms-note-btns';
    const lb = el('<button class="okbtn">Leaderboard</button>'); lb.onclick = () => openMsLeaderboard(level);
    const fp = el('<button class="okbtn">Free play</button>'); fp.onclick = () => newGame(level, false);
    btns.append(lb, fp);
  }
  function fitWindow() {
    if (innerWidth <= 640 || W.el.classList.contains('max')) return;
    const box = q('.ms'), inner = q('.ms-in');
    const w = W.el.offsetWidth - box.clientWidth + inner.offsetWidth + 16;
    const h = W.el.offsetHeight - box.clientHeight + inner.offsetHeight + 16;
    W.el.style.width = Math.min(w, innerWidth - 20) + 'px'; W.el.style.height = Math.min(h, innerHeight - 60) + 'px';
    W.el.style.left = Math.max(10, Math.min(W.el.offsetLeft, innerWidth - W.el.offsetWidth - 10)) + 'px';
    W.el.style.top = Math.max(8, Math.min(W.el.offsetTop, innerHeight - 40 - W.el.offsetHeight - 8)) + 'px';
  }
  function layMines(safe, rng = Math.random) { // the safe cell and its neighbours never hold a mine
    const keep = new Set([safe, ...around(safe)]);
    const spots = cells.map((_, i) => i).filter(i => !keep.has(i));
    for (let k = 0; k < mines; k++) { const j = k + Math.floor(rng() * (spots.length - k)); [spots[k], spots[j]] = [spots[j], spots[k]]; cells[spots[k]].mine = true; }
    cells.forEach((c, i) => { c.n = around(i).filter(j => cells[j].mine).length; });
  }
  function draw(i) {
    const c = cells[i], d = grid.children[i];
    d.className = 'ms-c' + (c.open ? ' open' : '') + (c.open && c.n && !c.mine ? ' n' + c.n : '');
    d.textContent = c.flag && !c.open ? '🚩' : c.open && c.mine ? '💣' : c.open && c.n ? c.n : '';
  }
  function result(won) {
    return { status: 'done', day: today, level, won, mines,
      time: won ? Math.round(performance.now() - t0) : null,
      bombs: cells.filter(c => c.mine && c.flag).length,
      cleared: Math.round(opened / (cells.length - mines) * 1000) / 10 };
  }
  function saveDaily(status, won = false) { if (daily) store.set(dailyKey(), { ...result(won), status }); }
  function begin(i) {
    started = true;
    if (!daily) layMines(i);
    t0 = performance.now();
    timer = setInterval(() => { ledTime.textContent = led(Math.floor((performance.now() - t0) / 1000) + 1); }, 250);
    ledTime.textContent = led(1);
  }
  function flood(i) {
    const stack = [i];
    while (stack.length) {
      const j = stack.pop(), c = cells[j];
      if (c.open || c.flag) continue;
      c.open = true; opened++; draw(j);
      if (!c.n) stack.push(...around(j));
    }
  }
  function open(i) {
    if (over || cells[i].flag || cells[i].open) return;
    if (!started) begin(i);
    if (cells[i].mine) return lose(i);
    flood(i);
    if (opened === cells.length - mines) win(); else saveDaily('playing');
  }
  function chord(i) { // clicking an opened number with enough flags around opens the rest
    const c = cells[i];
    if (!c.open || !c.n || over) return;
    if (!started) begin(i);
    const ns = around(i);
    if (ns.filter(j => cells[j].flag).length === c.n) ns.forEach(open);
  }
  function toggleFlag(i) {
    const c = cells[i];
    if (over || c.open) return;
    c.flag = !c.flag; flags += c.flag ? 1 : -1; ledLeft.textContent = led(mines - flags); draw(i);
    if (started) saveDaily('playing');
  }
  function lose(i) {
    over = true; stopTimer(); face.textContent = FACE.lose;
    saveDaily('done', false);
    cells.forEach((c, j) => {
      if (c.mine && !c.flag) { c.open = true; draw(j); }
      else if (c.flag && !c.mine) { grid.children[j].textContent = '❌'; }
    });
    grid.children[i].classList.add('boom');
  }
  function win() {
    over = true; stopTimer(); face.textContent = FACE.win;
    cells.forEach((c, j) => { if (c.mine && !c.flag) { c.flag = true; draw(j); } });
    ledLeft.textContent = led(0);
    saveDaily('done', true);
  }

  // mouse: left opens, right flags, left on a number chords. touch: tap opens, hold flags.
  let hold = null, held = false;
  const cellOf = e => { const d = e.target.closest('.ms-c'); return d ? +d.dataset.i : -1; };
  grid.addEventListener('contextmenu', e => e.preventDefault());
  grid.addEventListener('pointerdown', e => {
    const i = cellOf(e); if (i < 0 || over) return;
    if (e.button === 2) { toggleFlag(i); return; }
    if (e.button !== 0) return;
    face.textContent = FACE.press; held = false;
    if (e.pointerType !== 'mouse') hold = setTimeout(() => { held = true; toggleFlag(i); face.textContent = FACE.ok; }, 400);
  });
  grid.addEventListener('pointerup', e => {
    clearTimeout(hold);
    const i = cellOf(e); if (e.button !== 0 || over) return;
    face.textContent = FACE.ok;
    if (held || i < 0) return;
    cells[i].open ? chord(i) : open(i);
  });
  grid.addEventListener('pointerleave', () => { clearTimeout(hold); if (!over) face.textContent = FACE.ok; });
  face.onclick = () => newGame();

  menuBar(W, q('.menu'), {
    Game: [['New', () => newGame()],
      ...Object.keys(MS_LEVELS).map(lv => [lv, () => newGame(lv), () => level === lv]),
      ['Daily challenge', () => newGame(level, !daily), () => daily],
      ['Leaderboard', () => openMsLeaderboard(level)],
      ['Close', () => closeWin(W)]],
  });
  const prev = W.onClose;
  W.onClose = () => { prev && prev(); stopTimer(); msWin = null; };
  msWin = W;
  newGame();
  return W;
}

let msBoardWin = null;
function openMsLeaderboard(level = 'Beginner') {
  if (msBoardWin) { msBoardWin.show(level); focusWin(msBoardWin); return msBoardWin; }
  const W = makeWin({ title: 'Minesweeper Daily Leaderboard', icon: I.minesweeper, w: 520, h: 400 });
  W.body.innerHTML = '<div class="lb-tabs"></div><div class="lb-body"></div><div class="lb-foot dim">Your daily results on this device. Wins rank by time; otherwise by mines found, then % of the board cleared.</div>';
  const tabs = W.body.querySelector('.lb-tabs'), body = W.body.querySelector('.lb-body');
  W.show = lv => {
    level = lv;
    tabs.replaceChildren(...Object.keys(MS_LEVELS).map(name => {
      const t = el('<button class="lb-tab"></button>'); t.textContent = name; t.classList.toggle('on', name === level); t.onclick = () => W.show(name); return t;
    }));
    const rows = store.all('ms-daily:').filter(r => r.level === level && r.status === 'done').sort(msRank);
    if (!rows.length) { body.innerHTML = `<div class="empty">No ${esc(level)} daily games yet. In Minesweeper pick Game &gt; Daily challenge.</div>`; return; }
    const today = dayKey();
    body.innerHTML = '<table class="lb-table"><thead><tr><th>#</th><th>Day</th><th>Result</th><th>Mines found</th><th>Cleared</th><th>Time</th></tr></thead><tbody></tbody></table>';
    body.querySelector('tbody').append(...rows.map((r, k) => el(`<tr${r.day === today ? ' class="today"' : ''}><td>${k + 1}</td><td>${esc(r.day)}</td><td>${r.won ? 'Won' : 'Lost'}</td><td>${r.bombs} / ${r.mines}</td><td>${r.cleared}%</td><td>${r.won ? msTime(r.time) : '-'}</td></tr>`)));
  };
  const prev = W.onClose;
  W.onClose = () => { prev && prev(); msBoardWin = null; };
  msBoardWin = W;
  W.show(level);
  return W;
}

/* ---------- daily wordle ---------- */
const WORDLE_START = Date.UTC(2026, 9, 16); // puzzle #1
let wordWin = null, wordsP = null;
const loadWords = () => wordsP ||= fetch('assets/wordle/words.json')
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(d => ({ answers: d.answers, allowed: new Set([...d.answers, ...d.guesses.split(' ')]) }))
  .catch(err => { wordsP = null; throw err; });
function scoreGuess(guess, answer) { // 'correct' | 'present' | 'absent' per letter, counting repeated letters properly
  const res = Array(5).fill('absent'), left = {};
  for (let k = 0; k < 5; k++) { if (guess[k] === answer[k]) res[k] = 'correct'; else left[answer[k]] = (left[answer[k]] || 0) + 1; }
  for (let k = 0; k < 5; k++) if (res[k] !== 'correct' && left[guess[k]]) { res[k] = 'present'; left[guess[k]]--; }
  return res;
}
function openWordle() {
  if (wordWin) { focusWin(wordWin); return wordWin; }
  const W = makeWin({ title: 'Wordle', icon: I.wordle, w: 380, h: 620 });
  W.body.innerHTML = '<div class="wd"><div class="wd-top"><span class="wd-no"></span><button class="tbtn wd-sb">Statistics</button></div><div class="wd-msg" role="status" aria-live="polite"></div><div class="wd-grid"></div><div class="wd-keys"></div><div class="wd-panel" hidden></div></div>';
  const q = sel => W.body.querySelector(sel);
  const gridEl = q('.wd-grid'), keysEl = q('.wd-keys'), msgEl = q('.wd-msg'), panel = q('.wd-panel');
  const today = dayKey(), num = Math.round((Date.parse(today) - WORDLE_START) / 864e5) + 1;
  q('.wd-no').textContent = `Daily Wordle #${num}`;
  let words = null, answer = '', cur = '', msgTimer = null, clock = null;
  const state = store.get(`wordle:${today}`, { guesses: [], done: false, won: false });
  const say = (t, ms = 1600) => { msgEl.textContent = t; clearTimeout(msgTimer); if (ms) msgTimer = setTimeout(() => { msgEl.textContent = ''; }, ms); };

  gridEl.append(...Array.from({ length: 6 }, () => el('<div class="wd-row">' + '<div class="wd-t"></div>'.repeat(5) + '</div>')));
  ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-'].forEach(row => {
    const r = el('<div class="wd-kr"></div>');
    [...row].forEach(ch => {
      const k = el('<button class="wd-k"></button>');
      if (ch === '+') { k.textContent = 'Enter'; k.dataset.k = 'Enter'; }
      else if (ch === '-') { k.textContent = '⌫'; k.dataset.k = 'Backspace'; k.setAttribute('aria-label', 'Backspace'); }
      else { k.textContent = ch; k.dataset.k = ch; }
      r.append(k);
    });
    keysEl.append(r);
  });
  keysEl.addEventListener('click', e => { const k = e.target.closest('.wd-k'); if (k) press(k.dataset.k); });
  const onKey = e => {
    if (!W.el.classList.contains('active') || e.ctrlKey || e.metaKey || e.altKey || (e.target instanceof Element && e.target.matches('input, textarea'))) return;
    if (/^[a-z]$/i.test(e.key) || e.key === 'Enter' || e.key === 'Backspace') { e.preventDefault(); press(e.key.length === 1 ? e.key.toLowerCase() : e.key); }
  };
  document.addEventListener('keydown', onKey);
  W.onClose = () => { document.removeEventListener('keydown', onKey); clearInterval(clock); clearTimeout(msgTimer); wordWin = null; };
  wordWin = W;

  function render() {
    const best = {}, rank = { absent: 1, present: 2, correct: 3 };
    [...gridEl.children].forEach((row, r) => {
      const g = state.guesses[r], marks = g ? scoreGuess(g, answer) : null;
      const txt = g || (r === state.guesses.length && !state.done ? cur : '');
      [...row.children].forEach((t, k) => {
        t.textContent = txt[k] || '';
        t.className = 'wd-t' + (marks ? ' ' + marks[k] : txt[k] ? ' filled' : '');
        if (marks && rank[marks[k]] > (rank[best[g[k]]] || 0)) best[g[k]] = marks[k];
      });
    });
    keysEl.querySelectorAll('.wd-k').forEach(k => { k.className = 'wd-k' + (k.dataset.k.length > 1 ? ' wide' : '') + (best[k.dataset.k] ? ' ' + best[k.dataset.k] : ''); });
  }
  function shake() { const row = gridEl.children[state.guesses.length]; row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake'); }
  function press(k) {
    if (!words || state.done) return;
    if (k === 'Enter') return submit();
    if (k === 'Backspace') cur = cur.slice(0, -1);
    else if (cur.length < 5) cur += k;
    render();
  }
  function submit() {
    if (cur.length < 5) { say('Not enough letters'); return shake(); }
    if (!words.allowed.has(cur)) { say('Not in word list'); return shake(); }
    state.guesses.push(cur);
    if (cur === answer) state.done = state.won = true;
    else if (state.guesses.length === 6) state.done = true;
    cur = '';
    store.set(`wordle:${today}`, state);
    render();
    if (state.done) finish();
  }
  function finish() {
    const st = store.get('wordle-stats', { played: 0, wins: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0, 0], lastWin: null });
    st.played++;
    if (state.won) {
      const yesterday = dayKey(new Date(Date.parse(today) - 864e5));
      st.wins++; st.streak = st.lastWin === yesterday ? st.streak + 1 : 1; st.lastWin = today;
      st.maxStreak = Math.max(st.maxStreak, st.streak); st.dist[state.guesses.length]++;
    } else { st.streak = 0; st.dist[0]++; }
    store.set('wordle-stats', st);
    say(state.won ? ['Genius', 'Magnificent', 'Impressive', 'Splendid', 'Great', 'Phew'][state.guesses.length - 1] : answer.toUpperCase(), 0);
    setTimeout(showStats, 1200);
  }
  function showStats() {
    const st = store.get('wordle-stats', { played: 0, wins: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0, 0] });
    const pct = n => st.played ? Math.round(n / st.played * 100) : 0;
    const most = Math.max(1, ...st.dist);
    const todayRow = state.done ? (state.won ? state.guesses.length : 0) : -1;
    panel.hidden = false;
    panel.innerHTML = '<button class="wd-x" aria-label="Close statistics">✕</button><h3>Statistics</h3>'
      + `<div class="wd-nums"><div><b>${st.played}</b>Played</div><div><b>${pct(st.wins)}</b>Win %</div><div><b>${st.streak}</b>Current streak</div><div><b>${st.maxStreak}</b>Max streak</div></div>`
      + '<h3>Won in how many guesses</h3><div class="wd-dist">'
      + [1, 2, 3, 4, 5, 6, 0].map(n => `<div class="wd-bar${n === todayRow ? ' today' : ''}"><span>${n || 'X'}</span><i style="width:${Math.max(8, st.dist[n] / most * 100)}%">${st.dist[n]}</i><em>${pct(st.dist[n])}%</em></div>`).join('')
      + '</div><p class="dim">Percent of all your games. X = not solved.</p>'
      + (state.done ? '<div class="wd-end"><span class="wd-next"></span><button class="okbtn wd-share">Share</button></div>' : '');
    panel.querySelector('.wd-x').onclick = () => { panel.hidden = true; clearInterval(clock); };
    clearInterval(clock);
    const next = panel.querySelector('.wd-next');
    if (next) { const t = () => { next.textContent = `Next Wordle in ${untilTomorrow()}`; }; t(); clock = setInterval(t, 1000); }
    const share = panel.querySelector('.wd-share');
    if (share) share.onclick = () => {
      const sq = { correct: '🟩', present: '🟨', absent: '⬛' };
      const text = `${SITE_NAME} Wordle #${num} ${state.won ? state.guesses.length : 'X'}/6\n\n` + state.guesses.map(g => scoreGuess(g, answer).map(m => sq[m]).join('')).join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => say('Copied results to clipboard'), () => say("Couldn't copy"));
    };
  }
  q('.wd-sb').onclick = () => { if (panel.hidden) showStats(); else { panel.hidden = true; clearInterval(clock); } };

  say('Loading words...', 0);
  loadWords().then(w => {
    words = w; answer = w.answers[((num - 1) % w.answers.length + w.answers.length) % w.answers.length];
    say('');
    render();
    if (state.done) { say(state.won ? "You solved today's Wordle!" : `The word was ${answer.toUpperCase()}`, 0); showStats(); }
  }, () => say("Couldn't load the word list.", 0));
  return W;
}

/* ---------- paint ---------- */
const PAINT_COLORS = ['#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
  '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7'];
const PAINT_TOOLS = [['pencil', '✏️', 'Pencil'], ['brush', '🖌️', 'Brush'], ['eraser', '🧽', 'Eraser'], ['fill', '🪣', 'Fill with color'],
  ['picker', '💧', 'Color picker'], ['line', '╱', 'Line'], ['rect', '▭', 'Rectangle'], ['ellipse', '◯', 'Ellipse']];
const PAINT_SIZES = [2, 5, 10, 20];
const FREEHAND = ['pencil', 'brush', 'eraser'];
function openPaint() {
  const W = makeWin({ title: 'Untitled - Paint', icon: I.paint, w: 880, h: 620 });
  W.body.innerHTML = '<div class="pt-tools"><div class="pt-g pt-set"></div><div class="pt-g pt-sizes"></div>'
    + '<div class="pt-g"><span class="pt-sw c1" title="Color 1 (left mouse button)"></span><span class="pt-sw c2" title="Color 2 (right mouse button)"></span></div>'
    + '<div class="pt-g"><div class="pt-pal"></div><input type="color" class="pt-custom" title="Pick any color for color 1" aria-label="Custom color"></div>'
    + '<div class="pt-g pt-act"></div></div>'
    + '<div class="pt-area"><div class="pt-stage"><canvas class="pt-c" width="800" height="480"></canvas><canvas class="pt-o" width="800" height="480"></canvas></div></div>'
    + '<div class="status"><span class="pt-pos">Left click: color 1 · right click: color 2</span><span>800 × 480px</span></div>';
  const q = sel => W.body.querySelector(sel);
  const cv = q('.pt-c'), ov = q('.pt-o'), g = cv.getContext('2d', { willReadFrequently: true }), go = ov.getContext('2d');
  let tool = 'pencil', size = 5, c1 = '#000000', c2 = '#ffffff', drawing = null;
  const undo = [], redo = [];
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height);

  const btn = (cls, html, title, fn) => { const b = el(`<button class="${cls}"></button>`); b.innerHTML = html; b.title = title; b.setAttribute('aria-label', title); b.onclick = fn; return b; };
  const toolBtns = PAINT_TOOLS.map(([id, icon, title]) => { const b = btn('pt-b', esc(icon), title, () => { tool = id; refresh(); }); b.dataset.t = id; return b; });
  q('.pt-set').append(...toolBtns);
  const sizeBtns = PAINT_SIZES.map(s => { const b = btn('pt-b', `<i style="width:${Math.min(s, 18)}px;height:${Math.min(s, 18)}px"></i>`, `Size ${s}px`, () => { size = s; refresh(); }); b.dataset.s = s; return b; });
  q('.pt-sizes').append(...sizeBtns);
  q('.pt-pal').append(...PAINT_COLORS.map(c => {
    const b = el('<button></button>'); b.style.background = c; b.title = c + ' (left: color 1, right: color 2)';
    b.onclick = () => { c1 = c; refresh(); };
    b.oncontextmenu = e => { e.preventDefault(); c2 = c; refresh(); };
    return b;
  }));
  q('.pt-custom').oninput = e => { c1 = e.target.value; refresh(); };
  q('.pt-act').append(
    btn('tbtn', 'Undo', 'Undo (Ctrl+Z)', () => doUndo()),
    btn('tbtn', 'Redo', 'Redo (Ctrl+Y)', () => doRedo()),
    btn('tbtn', 'Clear', 'Clear the picture', () => { snap(); g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height); }),
    btn('tbtn', 'Save', 'Save as PNG', () => cv.toBlob(b => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'drawing.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    })));
  function refresh() {
    toolBtns.forEach(b => b.classList.toggle('on', b.dataset.t === tool));
    sizeBtns.forEach(b => b.classList.toggle('on', +b.dataset.s === size));
    q('.c1').style.background = c1; q('.c2').style.background = c2;
    cv.style.cursor = tool === 'fill' || tool === 'picker' ? 'pointer' : 'crosshair';
  }
  refresh();

  const all = () => g.getImageData(0, 0, cv.width, cv.height);
  function snap() { undo.push(all()); if (undo.length > 30) undo.shift(); redo.length = 0; }
  function doUndo() { if (undo.length) { redo.push(all()); g.putImageData(undo.pop(), 0, 0); } }
  function doRedo() { if (redo.length) { undo.push(all()); g.putImageData(redo.pop(), 0, 0); } }
  const width = () => tool === 'pencil' ? 2 : tool === 'eraser' ? size * 2 : size;
  const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  function stroke(ctx, kind, x1, y1, x2, y2, color, w) {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    if (kind === 'rect') ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    else if (kind === 'ellipse') ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
    else { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
    ctx.stroke();
  }
  function fill(x, y, hex) { // flood fill; a small tolerance also covers the soft edges of strokes
    const w = cv.width, h = cv.height, img = all(), d = new Uint32Array(img.data.buffer);
    const start = (y | 0) * w + (x | 0), target = d[start];
    const [r, gg, b] = [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16));
    const col = (255 << 24 | b << 16 | gg << 8 | r) >>> 0; // pixels are stored as ABGR
    if (target === col) return;
    const near = v => Math.abs((v & 255) - (target & 255)) + Math.abs((v >> 8 & 255) - (target >> 8 & 255))
      + Math.abs((v >> 16 & 255) - (target >> 16 & 255)) + Math.abs((v >>> 24) - (target >>> 24)) <= 64;
    const seen = new Uint8Array(w * h), stack = [start];
    while (stack.length) {
      const i = stack.pop();
      if (seen[i]) continue;
      seen[i] = 1;
      if (!near(d[i])) continue;
      d[i] = col;
      const px = i % w;
      if (px > 0) stack.push(i - 1);
      if (px < w - 1) stack.push(i + 1);
      if (i >= w) stack.push(i - w);
      if (i < w * (h - 1)) stack.push(i + w);
    }
    g.putImageData(img, 0, 0);
  }

  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.button !== 2) return;
    const right = e.button === 2, color = right ? c2 : c1, [x, y] = at(e);
    if (tool === 'picker') {
      const p = g.getImageData(x | 0, y | 0, 1, 1).data, hex = '#' + [p[0], p[1], p[2]].map(v => v.toString(16).padStart(2, '0')).join('');
      if (right) c2 = hex; else c1 = hex;
      return refresh();
    }
    snap();
    if (tool === 'fill') return fill(x, y, color);
    drawing = { x, y, lx: x, ly: y, color: tool === 'eraser' ? c2 : color };
    cv.setPointerCapture(e.pointerId);
    if (FREEHAND.includes(tool)) stroke(g, 'line', x, y, x + 0.01, y, drawing.color, width());
  });
  cv.addEventListener('pointermove', e => {
    const [x, y] = at(e);
    q('.pt-pos').textContent = `${Math.round(x)}, ${Math.round(y)}px`;
    if (!drawing) return;
    if (FREEHAND.includes(tool)) { stroke(g, 'line', drawing.lx, drawing.ly, x, y, drawing.color, width()); drawing.lx = x; drawing.ly = y; }
    else { go.clearRect(0, 0, ov.width, ov.height); stroke(go, tool, drawing.x, drawing.y, x, y, drawing.color, width()); }
  });
  const finishShape = e => {
    if (!drawing) return;
    const [x, y] = at(e);
    if (!FREEHAND.includes(tool)) { go.clearRect(0, 0, ov.width, ov.height); stroke(g, tool, drawing.x, drawing.y, x, y, drawing.color, width()); }
    drawing = null;
  };
  cv.addEventListener('pointerup', finishShape);
  cv.addEventListener('pointercancel', finishShape);
  const onKey = e => {
    if (!W.el.classList.contains('active') || !(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z') { e.preventDefault(); doUndo(); }
    if (k === 'y') { e.preventDefault(); doRedo(); }
  };
  document.addEventListener('keydown', onKey);
  W.onClose = () => document.removeEventListener('keydown', onKey);
  return W;
}

/* ---------- pinball ---------- */
let pbWin = null;
function openPinball() {
  if (pbWin) { focusWin(pbWin); return pbWin; }
  const TW = 360, TH = 600, R = 8, G = 700;
  const W = makeWin({ title: 'Pinball', icon: I.pinball, w: 400, h: 720 });
  W.body.innerHTML = '<div class="pb"><div class="pb-wrap"><canvas class="pb-c" width="360" height="600" aria-label="Pinball table"></canvas></div>'
    + '<div class="pb-help">Z or ← left flipper · / or → right flipper · hold Space to launch<br>Touch: tap left/right half for flippers, hold to launch</div></div>';
  const cv = W.body.querySelector('canvas'), g = cv.getContext('2d');
  const path = pts => pts.slice(1).map((p, k) => [...pts[k], ...p]);
  const walls = [
    ...path([[10, 470], [10, 110], [30, 60], [70, 25], [120, 10], [240, 10], [290, 25], [330, 60], [350, 110], [350, 600]]),
    [320, 600, 320, 150], // launch lane
    [10, 470, 92, 528], [320, 470, 238, 528], // inlanes to the flippers
    [60, 400, 60, 440], [270, 400, 270, 440], // small guide posts
  ];
  const gate = [320, 150, 350, 110]; // closes the launch lane once the ball is out
  const bumpers = [
    { x: 110, y: 170, r: 18, pts: 100 }, { x: 220, y: 165, r: 18, pts: 100 }, { x: 165, y: 245, r: 20, pts: 100 },
    { x: 70, y: 300, r: 10, pts: 25 }, { x: 260, y: 300, r: 10, pts: 25 },
  ].map(b => ({ ...b, flash: 0 }));
  const flippers = [
    { x: 98, y: 532, len: 58, rest: 0.5, up: -0.45, a: 0.5, w: 0, on: false },
    { x: 232, y: 532, len: 58, rest: Math.PI - 0.5, up: Math.PI + 0.45, a: Math.PI - 0.5, w: 0, on: false },
  ];
  let ball, score, balls, best = store.get('pinball-best', 0), over = false, charge = 0, charging = false, raf = 0, last = 0;
  const resetBall = () => { ball = { x: 335, y: 562, vx: 0, vy: 0, onPlunger: true, inLane: true }; charge = 0; };
  function newGame() { score = 0; balls = 3; over = false; resetBall(); }
  newGame();

  function hitSeg(x1, y1, x2, y2, thick) { // pushes the ball out of a thick line, returns the contact
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((ball.x - x1) * dx + (ball.y - y1) * dy) / (dx * dx + dy * dy)));
    const px = x1 + t * dx, py = y1 + t * dy;
    let nx = ball.x - px, ny = ball.y - py;
    const d = Math.hypot(nx, ny), min = R + thick;
    if (d >= min || d === 0) return null;
    nx /= d; ny /= d; ball.x = px + nx * min; ball.y = py + ny * min;
    return { nx, ny, px, py };
  }
  function bounce(c, e, vcx = 0, vcy = 0) {
    const vn = (ball.vx - vcx) * c.nx + (ball.vy - vcy) * c.ny;
    if (vn < 0) { ball.vx -= (1 + e) * vn * c.nx; ball.vy -= (1 + e) * vn * c.ny; }
  }
  function step(dt) {
    flippers.forEach(f => {
      const prev = f.a, target = f.on ? f.up : f.rest, sp = 16 * dt;
      f.a += Math.max(-sp, Math.min(sp, target - f.a)); f.w = (f.a - prev) / dt;
    });
    if (ball.onPlunger) { ball.x = 335; ball.y = 562 + charge * 14; return; }
    ball.vy += G * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.inLane && ball.x < 316) ball.inLane = false;
    walls.forEach(s => { const c = hitSeg(...s, 2); if (c) bounce(c, 0.45); });
    if (!ball.inLane) { const c = hitSeg(...gate, 2); if (c) bounce(c, 0.45); }
    bumpers.forEach(b => {
      const dx = ball.x - b.x, dy = ball.y - b.y, d = Math.hypot(dx, dy);
      if (d >= R + b.r || d === 0) return;
      const c = { nx: dx / d, ny: dy / d };
      ball.x = b.x + c.nx * (R + b.r); ball.y = b.y + c.ny * (R + b.r);
      bounce(c, 0.9); ball.vx += c.nx * 180; ball.vy += c.ny * 180;
      score += b.pts; b.flash = 0.15;
    });
    flippers.forEach(f => {
      const ex = f.x + Math.cos(f.a) * f.len, ey = f.y + Math.sin(f.a) * f.len;
      const c = hitSeg(f.x, f.y, ex, ey, 7);
      if (c) bounce(c, 0.3, -f.w * (c.py - f.y), f.w * (c.px - f.x)); // flipper surface speed at the contact
    });
    if (ball.x > 320 && ball.y > 562 && ball.vy > 0) { // back on the plunger
      ball.y = 562; ball.vy *= -0.3;
      if (Math.abs(ball.vy) < 40) { ball.onPlunger = true; ball.inLane = true; ball.vx = ball.vy = 0; }
    }
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > 1400) { ball.vx *= 1400 / sp; ball.vy *= 1400 / sp; }
    if (ball.y > TH + 20) drain();
  }
  function drain() {
    balls--;
    if (balls > 0) return resetBall();
    over = true; resetBall();
    if (score > best) { best = score; store.set('pinball-best', best); }
  }
  function launch() { if (ball.onPlunger && !over) { ball.onPlunger = false; ball.vy = -(850 + 550 * charge); charge = 0; } }

  function draw() {
    const bg = g.createLinearGradient(0, 0, 0, TH); bg.addColorStop(0, '#1d2440'); bg.addColorStop(1, '#0b0f1e');
    g.fillStyle = bg; g.fillRect(0, 0, TW, TH);
    g.lineCap = 'round'; g.strokeStyle = '#7fd3ff'; g.lineWidth = 4;
    g.beginPath(); walls.forEach(([a, b, c, d]) => { g.moveTo(a, b); g.lineTo(c, d); }); if (!ball.inLane) { g.moveTo(gate[0], gate[1]); g.lineTo(gate[2], gate[3]); } g.stroke();
    g.fillStyle = '#4a5677'; g.fillRect(322, 570 + charge * 14, 26, 30); // plunger
    bumpers.forEach(b => {
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      g.fillStyle = b.flash > 0 ? '#ffffff' : b.pts > 50 ? '#ff4fa3' : '#ffd166'; g.fill();
      g.lineWidth = 3; g.strokeStyle = '#ffffff55'; g.stroke();
    });
    g.strokeStyle = '#ffd166'; g.lineWidth = 14;
    flippers.forEach(f => { g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x + Math.cos(f.a) * f.len, f.y + Math.sin(f.a) * f.len); g.stroke(); });
    const bb = g.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, R);
    bb.addColorStop(0, '#ffffff'); bb.addColorStop(1, '#8c98ad');
    g.fillStyle = bb; g.beginPath(); g.arc(ball.x, ball.y, R, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e6ecff'; g.font = 'bold 14px Segoe UI, sans-serif'; g.textAlign = 'left';
    g.fillText(`SCORE ${score}`, 14, 556); g.fillText(`BALLS ${balls}`, 14, 576); g.fillText(`BEST ${best}`, 14, 596);
    let msg = '';
    if (over) msg = 'GAME OVER · press Space or tap';
    else if (!W.el.classList.contains('active')) msg = 'Paused · click to play';
    else if (ball.onPlunger) msg = charging ? 'Release to launch!' : 'Hold Space to launch';
    if (msg) {
      g.textAlign = 'center'; g.font = 'bold 15px Segoe UI, sans-serif';
      g.fillStyle = '#00000099'; g.fillRect(40, 352, 240, 30);
      g.fillStyle = '#ffffff'; g.fillText(msg, 160, 372);
    }
  }
  function frame(t) {
    const dt = Math.min(0.033, (t - last) / 1000 || 0); last = t;
    if (W.el.classList.contains('active') && !over) {
      if (charging && ball.onPlunger) charge = Math.min(1, charge + dt * 1.2);
      for (let k = 0; k < 8; k++) step(dt / 8);
      bumpers.forEach(b => { b.flash = Math.max(0, b.flash - dt); });
    }
    draw();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  const flip = (side, on) => { flippers[side].on = on; };
  const keyOf = e => ['z', 'Z', 'ArrowLeft', 'Shift'].includes(e.key) && e.code !== 'ShiftRight' ? 0
    : ['/', '?', 'ArrowRight'].includes(e.key) || e.code === 'ShiftRight' ? 1 : e.key === ' ' || e.key === 'ArrowDown' ? 'launch' : null;
  const onDown = e => {
    if (!W.el.classList.contains('active')) return;
    const k = keyOf(e); if (k === null) return;
    e.preventDefault();
    if (k === 'launch') { if (over) newGame(); else if (ball.onPlunger) charging = true; }
    else flip(k, true);
  };
  const onUp = e => {
    const k = keyOf(e); if (k === null) return;
    if (k === 'launch') { if (charging) { charging = false; launch(); } }
    else flip(k, false);
  };
  document.addEventListener('keydown', onDown);
  document.addEventListener('keyup', onUp);
  cv.addEventListener('pointerdown', e => {
    if (over) return newGame();
    cv.setPointerCapture(e.pointerId);
    if (ball.onPlunger) { charging = true; return; }
    const r = cv.getBoundingClientRect();
    flip(e.clientX - r.left < r.width / 2 ? 0 : 1, true);
  });
  const release = () => { if (charging) { charging = false; launch(); } flip(0, false); flip(1, false); };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  W.onClose = () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', onDown); document.removeEventListener('keyup', onUp); pbWin = null; };
  pbWin = W;
  return W;
}

/* ---------- desktop ---------- */
// Icons sit on a grid. Visitors can select them (click, Ctrl/Shift+click, or drag a box)
// and drag them to any cell; the layout is remembered in their browser.
const dEl = document.getElementById('desktop');
const GRID_W = 86, GRID_H = 94; // one icon cell + the gap, matches #desktop in style.css
const icons = DESKTOP_ITEMS.map(n => {
  const d = el(`<div class="dicon" role="listitem" tabindex="0"><div class="ic">${img(iconSrc(n))}</div><div class="lb"></div></div>`);
  d.querySelector('.lb').textContent = n.name; d.node = n;
  dEl.append(d); return d;
});
let iconPos = store.get('desktop-pos', {}); // { name: [column, row] }

function gridSize() {
  const cs = getComputedStyle(dEl);
  const w = dEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const h = dEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  return { cols: Math.max(1, Math.floor((w + 2) / GRID_W)), rows: Math.max(1, Math.floor((h + 2) / GRID_H)) };
}
const cellKey = (c, r) => c + ',' + r;
function layout() {
  const { cols, rows } = gridSize(), taken = new Set(), placed = new Map();
  // saved spots that still fit on this screen
  icons.forEach(d => {
    const p = iconPos[d.node.name];
    if (p && p[0] < cols && p[1] < rows && !taken.has(cellKey(...p))) { placed.set(d, p); taken.add(cellKey(...p)); }
  });
  // everything else takes the first free cell, top to bottom, then left to right
  let c = 0, r = 0;
  icons.forEach(d => {
    if (placed.has(d)) return;
    while (taken.has(cellKey(c, r))) if (++r >= rows) { r = 0; c++; }
    placed.set(d, [c, r]); taken.add(cellKey(c, r));
  });
  placed.forEach(([c, r], d) => { d.cell = [c, r]; d.style.gridColumn = c + 1; d.style.gridRow = r + 1; });
}
function nearestFree(c, r, taken, cols, rows) {
  c = Math.max(0, Math.min(cols - 1, c)); r = Math.max(0, Math.min(rows - 1, r));
  for (let dist = 0; dist < cols + rows; dist++)
    for (let dc = -dist; dc <= dist; dc++) for (let dr = -dist; dr <= dist; dr++) {
      if (Math.max(Math.abs(dc), Math.abs(dr)) !== dist) continue;
      const nc = c + dc, nr = r + dr;
      if (nc >= 0 && nr >= 0 && nc < cols && nr < rows && !taken.has(cellKey(nc, nr))) return [nc, nr];
    }
  return [c, r];
}
function moveIcons(group, dc, dr) {
  const { cols, rows } = gridSize();
  const taken = new Set(icons.filter(d => !group.includes(d)).map(d => cellKey(...d.cell)));
  icons.forEach(d => { if (!group.includes(d)) iconPos[d.node.name] = d.cell; }); // the other icons stay where they are
  // the icon nearest the drop direction goes first so a group keeps its shape when it can
  [...group].sort((a, b) => (b.cell[0] - a.cell[0]) * Math.sign(dc || 1) || (b.cell[1] - a.cell[1]) * Math.sign(dr || 1)).forEach(d => {
    const spot = nearestFree(d.cell[0] + dc, d.cell[1] + dr, taken, cols, rows);
    taken.add(cellKey(...spot)); iconPos[d.node.name] = spot;
  });
  store.set('desktop-pos', iconPos);
  layout();
}

const selected = () => icons.filter(d => d.classList.contains('sel'));
const selectOnly = list => icons.forEach(d => d.classList.toggle('sel', list.includes(d)));

icons.forEach(d => {
  const n = d.node;
  let drag = null;
  d.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    e.stopPropagation(); closeCtx();
    if (e.ctrlKey || e.metaKey) { d.classList.toggle('sel'); return; }
    const wasSel = d.classList.contains('sel');
    if (e.shiftKey) d.classList.add('sel'); else if (!wasSel) selectOnly([d]);
    drag = { x: e.clientX, y: e.clientY, moving: false, wasSel, shift: e.shiftKey, group: selected() };
    d.setPointerCapture(e.pointerId);
  });
  d.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moving && Math.hypot(dx, dy) < 5) return;
    drag.moving = true;
    drag.group.forEach(g => { g.classList.add('dragging'); g.style.transform = `translate(${dx}px, ${dy}px)`; });
  });
  const endDrag = e => {
    if (!drag) return;
    const { x, y, moving, wasSel, shift, group } = drag; drag = null;
    group.forEach(g => { g.classList.remove('dragging'); g.style.transform = ''; });
    if (moving && e.type === 'pointerup') moveIcons(group, Math.round((e.clientX - x) / GRID_W), Math.round((e.clientY - y) / GRID_H));
    else if (!moving && wasSel && !shift && e.type === 'pointerup') selectOnly([d]);
  };
  d.addEventListener('pointerup', endDrag);
  d.addEventListener('pointercancel', endDrag);
  d.onclick = e => { e.stopPropagation(); if (touchy) { selectOnly([d]); openNode(n); } };
  d.ondblclick = () => openNode(n);
  d.onkeydown = e => {
    if (e.key === 'Enter') openNode(n);
    if (e.key === 'Delete') notHim();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); selectOnly(icons); }
  };
});

// drag a box on empty desktop to select icons (Ctrl adds to the selection)
let box = null;
dEl.addEventListener('pointerdown', e => {
  closeCtx();
  if (e.target !== dEl || e.button !== 0) return;
  const base = e.ctrlKey || e.metaKey ? selected() : [];
  selectOnly(base);
  if (e.pointerType === 'touch') return;
  const r0 = dEl.getBoundingClientRect();
  box = { x: e.clientX, y: e.clientY, base, el: el('<div class="selbox"></div>'), r0 };
  dEl.append(box.el); dEl.setPointerCapture(e.pointerId);
});
dEl.addEventListener('pointermove', e => {
  if (!box) return;
  const l = Math.min(box.x, e.clientX), t = Math.min(box.y, e.clientY), rr = Math.max(box.x, e.clientX), b = Math.max(box.y, e.clientY);
  Object.assign(box.el.style, { left: l - box.r0.left + 'px', top: t - box.r0.top + 'px', width: rr - l + 'px', height: b - t + 'px' });
  selectOnly([...box.base, ...icons.filter(d => { const q = d.getBoundingClientRect(); return q.left < rr && q.right > l && q.top < b && q.bottom > t; })]);
});
const endBox = () => { if (box) { box.el.remove(); box = null; } };
dEl.addEventListener('pointerup', endBox);
dEl.addEventListener('pointercancel', endBox);

// right-click on empty desktop
const ctx = el('<div class="drop ctx" hidden></div>');
document.body.append(ctx);
function closeCtx() { ctx.hidden = true; }
dEl.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (e.target !== dEl) return closeCtx();
  ctx.replaceChildren(...[
    ['Select all', () => selectOnly(icons)],
    ['Reset icon positions', () => { iconPos = {}; store.set('desktop-pos', iconPos); layout(); }],
  ].map(([label, fn]) => { const b = el('<button></button>'); b.textContent = label; b.onclick = () => { closeCtx(); fn(); }; return b; }));
  ctx.hidden = false;
  ctx.style.left = Math.min(e.clientX, innerWidth - ctx.offsetWidth - 4) + 'px';
  ctx.style.top = Math.min(e.clientY, innerHeight - ctx.offsetHeight - 4) + 'px';
});
document.addEventListener('pointerdown', e => { if (!ctx.hidden && !ctx.contains(e.target)) closeCtx(); });
addEventListener('resize', layout);
layout();

/* ---------- start menu ---------- */
const start = document.getElementById('start'), orb = document.getElementById('orb');
const closeStart = () => { start.hidden = true; orb.classList.remove('on'); };
document.getElementById('sm-user').innerHTML = img(ASSETS.avatar, '') + `<span>${esc(OWNER_NAME)}</span>`;
const leftItems = DESKTOP_ITEMS.filter(n => ['folder', 'txt', 'minesweeper', 'wordle', 'paint', 'pinball', 'video'].includes(n.type))
  .map(n => [n, n.children ? `${n.children.length} items` : typeName(n)]);
const smLeft = document.getElementById('sm-left');
leftItems.forEach(([n, sub]) => {
  const b = el(`<button class="sm-item">${img(iconSrc(n))}<span><span class="nm"></span><small>${esc(sub)}</small></span></button>`);
  b.querySelector('.nm').textContent = n.name; b.onclick = () => { closeStart(); openNode(n); }; smLeft.append(b);
});
const smRight = document.getElementById('sm-links');
DESKTOP_ITEMS.forEach(n => {
  const b = el('<button class="sm-r"></button>'); b.textContent = n.name;
  b.onclick = () => { closeStart(); openNode(n); }; smRight.append(b);
});
orb.onclick = e => { e.stopPropagation(); start.hidden = !start.hidden; orb.classList.toggle('on', !start.hidden); };
document.addEventListener('pointerdown', e => { if (!start.hidden && !start.contains(e.target) && !orb.contains(e.target)) closeStart(); });
document.getElementById('peek').onclick = () => {
  const any = wins.some(w => !w.el.classList.contains('min'));
  wins.forEach(w => w.el.classList.toggle('min', any));
  if (any) wins.forEach(o => o.tk.classList.remove('on')); else focusTop();
};

/* ---------- shut down ---------- */
const off = document.getElementById('off'), offMsg = document.getElementById('off-msg');
document.getElementById('shut').onclick = () => {
  closeStart(); setMusic(false); off.hidden = false; off.style.cursor = 'default';
  offMsg.innerHTML = '<div class="spin"></div>Shutting down...';
  setTimeout(() => {
    [...wins].forEach(closeWin); off.style.background = '#000'; off.style.cursor = 'pointer'; off.dataset.ready = 1;
    offMsg.innerHTML = `<span style="opacity:.6;font-size:14px">Click anywhere to start ${esc(SITE_NAME)}</span>`;
  }, 1600);
};
off.onclick = () => {
  if (!off.dataset.ready) return; delete off.dataset.ready; off.style.background = ''; off.style.cursor = 'default';
  offMsg.innerHTML = `${img(ASSETS.startOrb, '')}Starting ${esc(SITE_NAME)}<div class="spin"></div>`;
  setTimeout(() => { off.hidden = true; setMusic(true); if (OPEN_ON_START) openNode(OPEN_ON_START); }, 1500);
};

/* ---------- clock + calendar ---------- */
const cal = document.getElementById('cal'), tray = document.getElementById('tray');
let SPECIAL = [];
const calSt = { y: 0, m: 0, sel: null };
function parseDates(t) {
  const out = [];
  t.split(/\r?\n/).forEach(line => {
    line = line.trim(); if (!line || line.startsWith('#')) return;
    const [date, title = '', desc = ''] = line.split('|').map(s => s.trim());
    let mt = date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/), e;
    if (mt) e = { y: +mt[1], m: +mt[2], d: +mt[3] };
    else if ((mt = date.match(/^(\d{1,2})-(\d{1,2})$/))) e = { y: null, m: +mt[1], d: +mt[2] };
    if (e) out.push({ ...e, title, desc: desc.replace(/\\n/g, '\n') });
  });
  return out;
}
const specialOn = (y, m, d) => SPECIAL.filter(e => e.m === m + 1 && e.d === d && (e.y === null || e.y === y));
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
fetchText(DATES_FILE).then(t => { SPECIAL = parseDates(t); if (!cal.hidden) renderCal(); }).catch(() => {});

function renderCal() {
  const now = new Date(), { y, m } = calSt;
  document.getElementById('cal-long').textContent = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('cal-month').textContent = new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const grid = document.getElementById('cal-grid'); grid.innerHTML = '';
  const first = new Date(y, m, 1), startDay = (first.getDay() + 6) % 7; // weeks start Monday
  ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].forEach(d => grid.append(el(`<span class="dow">${d}</span>`)));
  for (let k = 0; k < 42; k++) {
    const date = new Date(y, m, 1 - startDay + k);
    const sp = specialOn(date.getFullYear(), date.getMonth(), date.getDate());
    const b = el(`<button class="day">${date.getDate()}</button>`);
    if (date.getMonth() !== m) b.classList.add('other');
    if (sp.length) { b.classList.add('special'); b.title = sp.map(e => e.title).join(', '); }
    if (sameDay(date, now)) b.classList.add('today');
    if (calSt.sel && sameDay(date, calSt.sel)) b.classList.add('sel');
    b.onclick = () => { calSt.sel = date; if (date.getMonth() !== m) { calSt.y = date.getFullYear(); calSt.m = date.getMonth(); } renderCal(); };
    grid.append(b);
  }
  // info panel
  const info = document.getElementById('cal-info'); info.innerHTML = '';
  const fmt = d => d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const showEntries = (date, list) => {
    list.forEach(e => {
      const box = el('<div class="sp"><b></b><span class="when"></span><p></p></div>');
      box.querySelector('b').textContent = e.title; box.querySelector('.when').textContent = fmt(date); box.querySelector('p').textContent = e.desc;
      info.append(box);
    });
  };
  const selSp = calSt.sel ? specialOn(calSt.sel.getFullYear(), calSt.sel.getMonth(), calSt.sel.getDate()) : [];
  if (selSp.length) { showEntries(calSt.sel, selSp); return; }
  if (calSt.sel) info.append(el(`<div class="dim">Nothing special on ${esc(fmt(calSt.sel))}.</div>`));
  // next special day from today
  for (let k = 0; k < 367; k++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k), sp = specialOn(d.getFullYear(), d.getMonth(), d.getDate());
    if (sp.length) {
      const lead = el(`<div class="next">${k === 0 ? 'Today is special!' : `Next special day in ${k} day${k === 1 ? '' : 's'}:`}</div>`);
      info.append(lead); showEntries(d, sp); break;
    }
  }
  if (!info.children.length) info.append(el('<div class="dim">No special dates yet. Add some in content/dates.txt.</div>'));
}
document.getElementById('cal-prev').onclick = () => { calSt.m--; if (calSt.m < 0) { calSt.m = 11; calSt.y--; } renderCal(); };
document.getElementById('cal-next').onclick = () => { calSt.m++; if (calSt.m > 11) { calSt.m = 0; calSt.y++; } renderCal(); };
document.getElementById('cal-long').onclick = () => { const n = new Date(); calSt.y = n.getFullYear(); calSt.m = n.getMonth(); calSt.sel = null; renderCal(); };
tray.onclick = e => {
  e.stopPropagation(); closeStart(); closeVol();
  if (cal.hidden) { const n = new Date(); calSt.y = n.getFullYear(); calSt.m = n.getMonth(); calSt.sel = null; renderCal(); drawHands(); }
  cal.hidden = !cal.hidden; tray.classList.toggle('on', !cal.hidden);
};
document.addEventListener('pointerdown', e => { if (!cal.hidden && !cal.contains(e.target) && !tray.contains(e.target)) { cal.hidden = true; tray.classList.remove('on'); } });

// analog clock
const face = document.getElementById('cal-face');
face.innerHTML = '<circle cx="50" cy="50" r="47" class="rim"/><circle cx="50" cy="50" r="43" class="dial"/>'
  + Array.from({ length: 12 }, (_, k) => `<line x1="50" y1="${k % 3 ? 10 : 9}" x2="50" y2="${k % 3 ? 14 : 17}" class="tick${k % 3 ? '' : ' big'}" transform="rotate(${k * 30} 50 50)"/>`).join('')
  + '<line id="h-h" x1="50" y1="52" x2="50" y2="29" class="hh"/><line id="h-m" x1="50" y1="54" x2="50" y2="17" class="hm"/><line id="h-s" x1="50" y1="58" x2="50" y2="14" class="hs"/><circle cx="50" cy="50" r="2.6" class="pin"/>';
function drawHands() {
  const d = new Date(), s = d.getSeconds(), mi = d.getMinutes() + s / 60, h = d.getHours() % 12 + mi / 60;
  [['h-h', h * 30], ['h-m', mi * 6], ['h-s', s * 6]].forEach(([id, a]) => document.getElementById(id).setAttribute('transform', `rotate(${a} 50 50)`));
  document.getElementById('cal-time').textContent = d.toLocaleTimeString();
}
function tick() {
  const d = new Date();
  document.getElementById('clock-t').textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById('clock-d').textContent = d.toLocaleDateString();
  if (!cal.hidden) drawHands();
}
tick(); setInterval(tick, 1000);

/* ---------- sound ---------- */
const volBtn = document.getElementById('vol'), volPop = document.getElementById('volpop');
const volRange = document.getElementById('vol-range'), volPct = document.getElementById('vol-pct'), volMute = document.getElementById('vol-mute');
const music = SOUND.music ? new Audio() : null;
const snd = store.get('sound', { volume: SOUND.musicVolume, muted: !!SOUND.startMuted }); // the visitor's own choice wins
let musicOn = true;
if (music) { music.loop = true; music.preload = 'none'; music.src = SOUND.music; }
function applyVolume() {
  const v = Math.round(snd.volume * 100), icon = snd.muted || !v ? U.mute : U.volume;
  if (music) { music.volume = snd.volume; music.muted = snd.muted; }
  volRange.value = v; volPct.textContent = v;
  volBtn.innerHTML = img(icon, ''); volMute.innerHTML = img(icon, '');
  volBtn.title = snd.muted ? 'Speakers: muted' : `Speakers: ${v}%`;
  volMute.setAttribute('aria-label', snd.muted ? 'Unmute' : 'Mute');
  store.set('sound', snd);
}
// browsers only allow sound once the visitor has clicked or pressed a key
function playMusic() { if (music && musicOn && music.paused) music.play().catch(() => {}); }
function setMusic(on) { musicOn = on; if (on) playMusic(); else if (music) music.pause(); }
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, playMusic, true));
if (!music) volBtn.hidden = true;

const closeVol = () => { volPop.hidden = true; volBtn.classList.remove('on'); };
volBtn.onclick = e => {
  e.stopPropagation(); closeStart();
  if (!cal.hidden) { cal.hidden = true; tray.classList.remove('on'); }
  if (!volPop.hidden) return closeVol();
  volPop.hidden = false; volBtn.classList.add('on');
  const r = volBtn.getBoundingClientRect();
  volPop.style.left = Math.max(4, Math.min(innerWidth - volPop.offsetWidth - 4, r.left + r.width / 2 - volPop.offsetWidth / 2)) + 'px';
  volRange.focus();
};
document.addEventListener('pointerdown', e => { if (!volPop.hidden && !volPop.contains(e.target) && !volBtn.contains(e.target)) closeVol(); });
volRange.oninput = () => { snd.volume = volRange.value / 100; snd.muted = false; applyVolume(); };
volMute.onclick = () => { snd.muted = !snd.muted; applyVolume(); };
volBtn.addEventListener('wheel', e => { e.preventDefault(); snd.volume = Math.max(0, Math.min(1, snd.volume + (e.deltaY < 0 ? 0.05 : -0.05))); snd.muted = false; applyVolume(); }, { passive: false });
applyVolume();

if (OPEN_ON_START) openNode(OPEN_ON_START);
})();
