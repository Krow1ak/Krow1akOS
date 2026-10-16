/* LaisaOS — desktop logic. Content and asset paths live in config.js. */
(() => {
const I = ASSETS.icons, U = ASSETS.ui;
const img = (src, cls = 'ico', alt = '') => `<img class="${cls}" src="${src}" alt="${alt}" draggable="false">`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- tree ---------- */
const desktop = { name: 'Desktop', type: 'folder', children: DESKTOP_ITEMS };
const isFolder = n => ['folder', 'computer', 'drive', 'bin'].includes(n.type);
const typeName = n => ({ folder: 'File folder', computer: 'System folder', drive: 'Local Disk', bin: 'System folder', txt: 'Text Document', img: 'Picture', video: 'Video', minesweeper: 'Game' })[n.type];
function iconSrc(n) {
  if (n.icon) return n.icon;
  if (n.type === 'img') return n.src;
  if (n.type === 'video' && n.poster) return n.poster;
  if (n.type === 'folder') return n.art ? I.folderArts : I.folder;
  if (n.type === 'bin') return n.children.length ? I.binFull : I.binEmpty;
  return { txt: I.textFile, computer: I.computer, drive: I.drive, video: I.video, minesweeper: I.minesweeper }[n.type] || I.textFile;
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
  if (n.poster) v.poster = n.poster;
  v.onerror = () => { const e = el('<div class="vp-err"></div>'); e.textContent = `Couldn't play ${n.src}`; W.body.querySelector('.vp').replaceChildren(e); };
  v.src = n.src;
  W.onClose = () => { v.pause(); v.removeAttribute('src'); v.load(); };
  return W;
}

/* ---------- minesweeper ---------- */
const MS_LEVELS = { Beginner: [9, 9, 10], Intermediate: [16, 16, 40], Expert: [30, 16, 99] };
const MS_CELL = 24;
let msWin = null;
function openMinesweeper() {
  if (msWin) { focusWin(msWin); return msWin; }
  const W = makeWin({ title: 'Minesweeper', icon: I.minesweeper, w: 9 * MS_CELL + 40, h: 9 * MS_CELL + 140 });
  W.body.innerHTML = '<div class="menu"></div><div class="ms"><div class="ms-in"><div class="ms-panel"><span class="ms-led ms-left"></span><button class="ms-face" aria-label="New game"></button><span class="ms-led ms-time"></span></div><div class="ms-grid" role="grid" aria-label="Minefield"></div></div></div>';
  const grid = W.body.querySelector('.ms-grid'), face = W.body.querySelector('.ms-face');
  const ledLeft = W.body.querySelector('.ms-left'), ledTime = W.body.querySelector('.ms-time');
  const FACE = { ok: '🙂', press: '😮', win: '😎', lose: '😵' };
  let level = 'Beginner', cols, rows, mines, cells, started, over, opened, flags, time, timer = null;
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

  function newGame(lv = level) {
    level = lv; [cols, rows, mines] = MS_LEVELS[level];
    stopTimer(); started = over = false; opened = flags = time = 0;
    cells = Array.from({ length: cols * rows }, () => ({ mine: false, open: false, flag: false, n: 0 }));
    grid.style.gridTemplateColumns = `repeat(${cols}, ${MS_CELL}px)`;
    grid.replaceChildren(...cells.map((_, i) => { const c = el('<div class="ms-c" role="gridcell"></div>'); c.dataset.i = i; return c; }));
    face.textContent = FACE.ok; ledLeft.textContent = led(mines); ledTime.textContent = led(0);
    fitWindow();
  }
  function fitWindow() {
    if (innerWidth <= 640 || W.el.classList.contains('max')) return;
    const box = W.body.querySelector('.ms'), inner = W.body.querySelector('.ms-in');
    const w = W.el.offsetWidth - box.clientWidth + inner.offsetWidth + 16;
    const h = W.el.offsetHeight - box.clientHeight + inner.offsetHeight + 16;
    W.el.style.width = Math.min(w, innerWidth - 20) + 'px'; W.el.style.height = Math.min(h, innerHeight - 60) + 'px';
    W.el.style.left = Math.max(10, Math.min(W.el.offsetLeft, innerWidth - W.el.offsetWidth - 10)) + 'px';
    W.el.style.top = Math.max(8, Math.min(W.el.offsetTop, innerHeight - 40 - W.el.offsetHeight - 8)) + 'px';
  }
  function layMines(safe) { // first click is never a mine, and opens an area
    const keep = new Set([safe, ...around(safe)]);
    const spots = cells.map((_, i) => i).filter(i => !keep.has(i));
    for (let k = 0; k < mines; k++) { const j = k + Math.floor(Math.random() * (spots.length - k)); [spots[k], spots[j]] = [spots[j], spots[k]]; cells[spots[k]].mine = true; }
    cells.forEach((c, i) => { c.n = around(i).filter(j => cells[j].mine).length; });
  }
  function draw(i) {
    const c = cells[i], d = grid.children[i];
    d.className = 'ms-c' + (c.open ? ' open' : '') + (c.open && c.n && !c.mine ? ' n' + c.n : '');
    d.textContent = c.flag && !c.open ? '🚩' : c.open && c.mine ? '💣' : c.open && c.n ? c.n : '';
  }
  function open(i) {
    if (over || cells[i].flag || cells[i].open) return;
    if (!started) { started = true; layMines(i); timer = setInterval(() => { ledTime.textContent = led(++time); }, 1000); ledTime.textContent = led(time = 1); }
    if (cells[i].mine) return lose(i);
    const stack = [i];
    while (stack.length) {
      const j = stack.pop(), c = cells[j];
      if (c.open || c.flag) continue;
      c.open = true; opened++; draw(j);
      if (!c.n) stack.push(...around(j));
    }
    if (opened === cells.length - mines) win();
  }
  function chord(i) { // clicking an opened number with enough flags around opens the rest
    const c = cells[i];
    if (!c.open || !c.n || over) return;
    const ns = around(i);
    if (ns.filter(j => cells[j].flag).length === c.n) ns.forEach(open);
  }
  function toggleFlag(i) {
    const c = cells[i];
    if (over || c.open) return;
    c.flag = !c.flag; flags += c.flag ? 1 : -1; ledLeft.textContent = led(mines - flags); draw(i);
  }
  function lose(i) {
    over = true; stopTimer(); face.textContent = FACE.lose;
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

  menuBar(W, W.body.querySelector('.menu'), {
    Game: [['New', () => newGame()],
      ...Object.keys(MS_LEVELS).map(lv => [lv, () => newGame(lv), () => level === lv]),
      ['Close', () => closeWin(W)]],
  });
  const prev = W.onClose;
  W.onClose = () => { prev && prev(); stopTimer(); msWin = null; };
  msWin = W;
  newGame();
  return W;
}

/* ---------- desktop ---------- */
const dEl = document.getElementById('desktop');
DESKTOP_ITEMS.forEach(n => {
  const d = el(`<div class="dicon" role="listitem" tabindex="0"><div class="ic">${img(iconSrc(n))}</div><div class="lb"></div></div>`);
  d.querySelector('.lb').textContent = n.name;
  d.onclick = e => { e.stopPropagation(); dEl.querySelectorAll('.dicon').forEach(x => x.classList.remove('sel')); d.classList.add('sel'); if (touchy) openNode(n); };
  d.ondblclick = () => openNode(n);
  d.onkeydown = e => { if (e.key === 'Enter') openNode(n); if (e.key === 'Delete') notHim(); };
  dEl.append(d);
});
dEl.onclick = () => dEl.querySelectorAll('.dicon').forEach(x => x.classList.remove('sel'));

/* ---------- start menu ---------- */
const start = document.getElementById('start'), orb = document.getElementById('orb');
const closeStart = () => { start.hidden = true; orb.classList.remove('on'); };
document.getElementById('sm-user').innerHTML = img(ASSETS.avatar, '') + `<span>${esc(OWNER_NAME)}</span>`;
const leftItems = DESKTOP_ITEMS.filter(n => ['folder', 'txt', 'minesweeper', 'video'].includes(n.type))
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
  closeStart(); off.hidden = false; off.style.cursor = 'default';
  offMsg.innerHTML = '<div class="spin"></div>Shutting down...';
  setTimeout(() => {
    [...wins].forEach(closeWin); off.style.background = '#000'; off.style.cursor = 'pointer'; off.dataset.ready = 1;
    offMsg.innerHTML = `<span style="opacity:.6;font-size:14px">Click anywhere to start ${esc(SITE_NAME)}</span>`;
  }, 1600);
};
off.onclick = () => {
  if (!off.dataset.ready) return; delete off.dataset.ready; off.style.background = ''; off.style.cursor = 'default';
  offMsg.innerHTML = `${img(ASSETS.startOrb, '')}Starting ${esc(SITE_NAME)}<div class="spin"></div>`;
  setTimeout(() => { off.hidden = true; if (OPEN_ON_START) openNode(OPEN_ON_START); }, 1500);
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
  e.stopPropagation(); closeStart();
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

if (OPEN_ON_START) openNode(OPEN_ON_START);
})();
