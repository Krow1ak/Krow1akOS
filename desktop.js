/* LaisaOS — desktop logic. Content and asset paths live in config.js. */
(() => {
const I = ASSETS.icons, U = ASSETS.ui;
const img = (src, cls = 'ico', alt = '') => `<img class="${cls}" src="${src}" alt="${alt}" draggable="false">`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- tree ---------- */
const desktop = { name: 'Desktop', type: 'folder', children: DESKTOP_ITEMS };
const isFolder = n => ['folder', 'computer', 'drive', 'bin'].includes(n.type);
const typeName = n => ({ folder: 'File folder', computer: 'System folder', drive: 'Local Disk', bin: 'System folder', txt: 'Text Document', img: 'Picture', video: 'Video', minesweeper: 'Game', wordle: 'Game', pinball: 'Game', snake: 'Game', solitaire: 'Game', paint: 'Application', audio: 'Audio', browser: 'Application' })[n.type];
function iconSrc(n) {
  if (n.icon) return n.icon;
  if (n.type === 'img') return n.src;
  if (n.type === 'video' && n.poster) return n.poster;
  if (n.type === 'folder') return n.art ? I.folderArts : I.folder;
  if (n.type === 'bin') return n.children.length ? I.binFull : I.binEmpty;
  return { txt: I.textFile, computer: I.computer, drive: I.drive, video: I.video, minesweeper: I.minesweeper, wordle: I.wordle, paint: I.paint, pinball: I.pinball, snake: I.snake, solitaire: I.solitaire, audio: I.music, browser: I.browser }[n.type] || I.textFile;
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

/* ---------- loading screen ---------- */
// stays up until the wallpaper and icons have loaded (at least LOADING_SCREEN.minTime, at most 8 seconds)
(function boot() {
  const b = document.getElementById('boot');
  if (!LOADING_SCREEN.enabled) { b.remove(); return; }
  b.querySelector('.boot-logo').style.backgroundImage = `url("${ASSETS.startOrb}")`;
  b.querySelector('.boot-text').textContent = (LOADING_SCREEN.text || 'Starting {name}').replace('{name}', SITE_NAME);
  const t0 = performance.now();
  let done = false;
  const hide = () => {
    if (done) return; done = true;
    setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 600); }, Math.max(0, (LOADING_SCREEN.minTime ?? 1200) - (performance.now() - t0)));
  };
  if (document.readyState === 'complete') hide(); else addEventListener('load', hide);
  setTimeout(hide, 8000);
})();

/* ---------- apply assets ---------- */
document.title = SITE_NAME;
document.body.style.backgroundImage = `url("${ASSETS.wallpaper}")`;
document.getElementById('taskbar').style.backgroundImage = `url("${ASSETS.taskbar}")`;
const rootStyle = document.documentElement.style;
if (WINDOW_LOOK.color) rootStyle.setProperty('--glass', WINDOW_LOOK.color);
if (WINDOW_LOOK.inactiveColor) rootStyle.setProperty('--glass-dim', WINDOW_LOOK.inactiveColor);
if (WINDOW_LOOK.menuColor) rootStyle.setProperty('--menu', WINDOW_LOOK.menuColor);
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
  w = Math.min(w + 16, dw - 20); h = Math.min(h + 8, dh - 20); // sizes are asked for without the frame
  const x = Math.max(10, Math.min(dw - w - 10, (dw - w) / 2 - 120 + cascade * 28));
  const y = Math.max(8, Math.min(dh - h - 8, (dh - h) / 2 - 70 + cascade * 28));
  if (!cls) cascade = (cascade + 1) % 6;
  const win = el(`<div class="win opening ${cls}" role="dialog" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">
    <div class="tb"><span class="ti">${img(icon)}</span><span class="ttl"></span>
    <div class="caps">${noMax ? '' : `<button class="cap mn" aria-label="Minimize">${img(U.minimize, '')}</button><button class="cap mx" aria-label="Maximize">${img(U.maximize, '')}</button>`}<button class="cap cls" aria-label="Close">${img(U.close, '')}</button></div></div>
    <div class="wbody"></div>${noMax ? '' : ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(d => `<div class="rz ${d}" data-d="${d}"></div>`).join('')}</div>`);
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
    win.querySelector('.mn').onclick = e => { e.stopPropagation(); if (W.sid) mpSend({ t: 'min', sid: W.sid }); win.classList.add('min'); focusTop(); };
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
    const mv = ev => {
      win.style.left = Math.min(innerWidth - 60, Math.max(60 - win.offsetWidth, ev.clientX - ox)) + 'px'; win.style.top = Math.min(innerHeight - 80, Math.max(0, ev.clientY - oy)) + 'px';
      tellRect(W);
    };
    const up = () => { tb.removeEventListener('pointermove', mv); tb.removeEventListener('pointerup', up); tellRect(W, true); };
    tb.addEventListener('pointermove', mv); tb.addEventListener('pointerup', up);
  });
  // resize from any edge or corner
  win.querySelectorAll('.rz').forEach(h => h.addEventListener('pointerdown', e => {
    if (e.button !== 0 || innerWidth <= 640 || win.classList.contains('max')) return;
    e.preventDefault(); e.stopPropagation(); focusWin(W);
    const d = h.dataset.d, sx = e.clientX, sy = e.clientY, [x0, y0, w0, h0] = [win.offsetLeft, win.offsetTop, win.offsetWidth, win.offsetHeight];
    const minW = 260, minH = 140;
    h.setPointerCapture(e.pointerId);
    const mv = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let x = x0, y = y0, w = w0, hh = h0;
      if (d.includes('e')) w = Math.max(minW, w0 + dx);
      if (d.includes('s')) hh = Math.max(minH, h0 + dy);
      if (d.includes('w')) { w = Math.max(minW, w0 - dx); x = x0 + w0 - w; }
      if (d.includes('n')) { hh = Math.max(minH, h0 - dy); y = Math.max(0, y0 + h0 - hh); hh = y0 + h0 - y; }
      Object.assign(win.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
      tellRect(W);
    };
    const up = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); tellRect(W, true); };
    h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
  }));
  focusWin(W); return W;
}
// position and size go out together, at most every 40ms while dragging plus once at the end
function tellRect(W, final) {
  if (!W.sid || !live()) return;
  const now = performance.now();
  if (!final && now - (W.rectSent || 0) < 40) return;
  W.rectSent = now;
  mpSend({ t: 'rect', sid: W.sid, r: [W.el.offsetLeft, W.el.offsetTop, W.el.offsetWidth, W.el.offsetHeight] });
}
function toggleMax(W) {
  const s = W.el.style;
  if (W.sid) mpSend({ t: 'max', sid: W.sid, on: !W.el.classList.contains('max') });
  if (W.el.classList.toggle('max')) { W.prev = [s.left, s.top, s.width, s.height]; Object.assign(s, { left: '0px', top: '0px', width: '100%', height: 'calc(100% - 40px)' }); }
  else if (W.prev) [s.left, s.top, s.width, s.height] = W.prev;
}
function focusWin(W) {
  if (W.sid && (!W.el.classList.contains('active') || W.el.classList.contains('min'))) mpSend({ t: 'focus', sid: W.sid });
  wins.forEach(o => { o.el.classList.remove('active'); o.tk.classList.remove('on'); }); W.el.classList.remove('min'); W.el.classList.add('active'); W.tk.classList.add('on'); W.el.style.zIndex = ++z; }
function focusTop() {
  wins.forEach(o => { o.el.classList.remove('active'); o.tk.classList.remove('on'); });
  const top = wins.filter(w => !w.el.classList.contains('min')).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
  if (top) focusWin(top);
}
/* ---------- multiplayer: shared windows ---------- */
// Every window opened from a file or app gets a shared id (sid). While in a room, opening, moving,
// focusing, minimizing, maximizing and closing it is sent to the others, and apps send their state.
const mp = { self: Math.random().toString(36).slice(2, 10), send: null, remote: false, incoming: null, peers: new Map() };
const live = () => !!mp.send;
const mpSend = (m, to) => { if (mp.send && !mp.remote) mp.send(m, to); };
function asRemote(fn) { const was = mp.remote; mp.remote = true; try { return fn(); } finally { mp.remote = was; } }
const nodeKeys = new Map(), keyNodes = new Map(); // node <-> its place in the tree, the same on every computer
(function walk(n, k) { if (nodeKeys.has(n)) return; nodeKeys.set(n, k); keyNodes.set(k, n); (n.children || []).forEach((c, i) => walk(c, k + '/' + i)); })(desktop, '');
const nodeKey = n => n ? nodeKeys.get(n) ?? null : null;
let sidN = 0;
function track(spec, W) {
  if (!W || W.sid) return W;
  const inc = mp.incoming;
  W.sid = inc ? inc.sid : `${mp.self}-${++sidN}`; W.owner = inc ? inc.owner : mp.self; W.spec = spec;
  if (!inc) mpSend({ t: 'open', ...winInfo(W) });
  return W;
}
// apps call this to take part: get() returns their state, set() shows a state sent by someone else
function shareState(W, get, set) {
  W.getState = get; W.setState = d => asRemote(() => set(d));
  W.push = (d = get()) => { if (W.sid) mpSend({ t: 'app', sid: W.sid, d }); };
}
// games that run on one computer (Snake, Pinball): the opener runs it, the others send their keys
function leaderOf(W) { // the opener, or whoever is first by id once the opener has left
  if (!live()) return mp.self;
  const ids = [mp.self, ...[...mp.peers.values()].map(p => p.id)];
  return ids.includes(W.owner) ? W.owner : ids.sort()[0];
}
const isLead = W => leaderOf(W) === mp.self;
const sendInput = (W, d) => { if (W.sid) mpSend({ t: 'in', sid: W.sid, d }); };
function winInfo(W) {
  const s = W.el.style, max = W.el.classList.contains('max'), r = max && W.prev ? W.prev : [s.left, s.top, s.width, s.height];
  return { sid: W.sid, owner: W.owner, spec: W.spec, r: r.map(v => parseFloat(v)), max, min: W.el.classList.contains('min'), st: W.getState ? W.getState() : null };
}
const bySid = sid => wins.find(w => w.sid === sid);
function setRect(W, [x, y, w, h]) {
  if (W.el.classList.contains('max')) { W.prev = [x + 'px', y + 'px', w + 'px', h + 'px']; return; }
  w = Math.min(w, innerWidth - 20); h = Math.min(h, innerHeight - 60);
  Object.assign(W.el.style, { width: w + 'px', height: h + 'px',
    left: Math.max(60 - w, Math.min(innerWidth - 60, x)) + 'px', top: Math.max(0, Math.min(innerHeight - 80, y)) + 'px' });
}
function reopen(spec) {
  const n = keyNodes.get(spec.n), f = spec.f != null ? keyNodes.get(spec.f) : undefined;
  if (!n) return null;
  if (spec.k === 'show') return track(spec, openViewer(n, f, true));
  return openNode(n, f);
}
function openRemote(m) {
  if (bySid(m.sid)) return;
  mp.incoming = { sid: m.sid, owner: m.owner };
  let W;
  try { W = asRemote(() => reopen(m.spec)); } finally { mp.incoming = null; }
  if (!W) return;
  if (W.sid !== m.sid) { // both opened the same one-of-a-kind app (Pinball, Music Player...): keep one id
    if (m.sid > W.sid) return;
    W.sid = m.sid; W.owner = m.owner;
  }
  asRemote(() => {
    setRect(W, m.r);
    if (m.max !== W.el.classList.contains('max')) toggleMax(W);
    if (m.min) { W.el.classList.add('min'); focusTop(); }
  });
  if (m.st && W.setState) W.setState(m.st);
}
function closeWin(W) { if (W.sid) mpSend({ t: 'close', sid: W.sid }); W.onClose && W.onClose(); W.el.remove(); W.tk.remove(); wins.splice(wins.indexOf(W), 1); focusTop(); }

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
function openNode(n, folder) { return track({ k: 'node', n: nodeKey(n), f: nodeKey(folder) }, openApp(n, folder)); }
function openApp(n, folder) {
  if (isFolder(n)) return openExplorer(n);
  if (n.type === 'txt') return openNotepad(n);
  if (n.type === 'img') return openViewer(n, folder || parentOf(n) || desktop);
  if (n.type === 'video') return openVideo(n);
  if (n.type === 'minesweeper') return openMinesweeper();
  if (n.type === 'wordle') return openWordle();
  if (n.type === 'paint') return openPaint();
  if (n.type === 'pinball') return openPinball();
  if (n.type === 'snake') return openSnake();
  if (n.type === 'solitaire') return openSolitaire();
  if (n.type === 'audio') return openPlayer(n, folder);
  if (n.type === 'browser') return openBrowser(n.url);
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
      if (pics.length) tb('Slide show', () => track({ k: 'show', n: nodeKey(pics[0]), f: nodeKey(n) }, openViewer(pics[0], n, true)));
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
    W.push();
  }
  function open(c) { if (isFolder(c)) go(c); else openNode(c, cur()); }
  function details(c) {
    const d = W.body.querySelector('.details'), n = cur();
    if (!c) { d.innerHTML = `<span class="ic">${img(iconSrc(n))}</span><span>${n.children.length} item${n.children.length === 1 ? '' : 's'}</span>`; return; }
    d.innerHTML = `<span class="ic">${img(iconSrc(c))}</span><span><b>${esc(c.name)}</b><br><span class="dim">${typeName(c)}</span></span>`;
  }
  shareState(W, () => ({ f: nodeKey(cur()) }), d => { const f = keyNodes.get(d.f); if (f && f !== cur()) go(f); });
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
  const show = () => { const l = list(); if (!l.length) return; i = (i + l.length) % l.length; view.src = l[i].src; view.alt = l[i].name; view.classList.toggle('px', !!l[i].pixel); W.setTitle(`${l[i].name} - Photo Viewer`); W.body.querySelector('.pvname').textContent = `${i + 1} of ${l.length}`; W.push(); };
  W.body.querySelector('.pr').onclick = () => { i--; show(); };
  W.body.querySelector('.nx').onclick = () => { i++; show(); };
  const pl = W.body.querySelector('.pl');
  const toggle = () => {
    if (timer) { clearInterval(timer); timer = null; pl.innerHTML = img(U.play, ''); }
    else { timer = setInterval(() => { i++; show(); }, 2200); pl.innerHTML = img(U.pause, ''); }
  };
  pl.onclick = () => { toggle(); W.push(); }; W.onClose = () => clearInterval(timer);
  shareState(W, () => ({ i, play: !!timer }), d => { if (d.i !== i) { i = d.i; show(); } if (d.play !== !!timer) toggle(); });
  W.el.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { i--; show(); } if (e.key === 'ArrowRight') { i++; show(); } });
  show(); if (auto) toggle(); return W;
}

// video and music: play, pause and jumps follow whoever did them last
function shareMedia(W, m, getItem, setItem) {
  shareState(W, () => ({ k: getItem(), t: m.currentTime || 0, p: m.paused }), d => {
    setItem(d.k);
    if (Math.abs((m.currentTime || 0) - d.t) > 0.7) m.currentTime = d.t;
    if (d.p && !m.paused) m.pause(); else if (!d.p && m.paused) m.play().catch(() => {});
  });
  ['play', 'pause', 'seeked'].forEach(ev => m.addEventListener(ev, () => W.push()));
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
  shareMedia(W, v, () => null, () => {});
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
  let level = 'Beginner', daily = false, today = '', cols, rows, mines, cells, started, over, opened, flags, t0 = 0, timer = null, boom = -1;
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
    stopTimer(); started = over = false; opened = flags = 0; boom = -1;
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
    if (W.push) W.push();
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
    const fp = el('<button class="okbtn">Free play</button>'); fp.onclick = () => restart(level, false);
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
    startClock(performance.now());
  }
  function startClock(from) {
    t0 = from; stopTimer();
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
    grid.children[i].classList.add('boom'); boom = i;
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
  // In a room the opener's computer holds the real board; other players' clicks are sent there and
  // the whole board comes back. (If everyone changed their own copy, two quick clicks would clash.)
  const ask = (d, fn) => { if (isLead(W)) { fn(); W.push(); } else sendInput(W, d); };
  const restart = (lv = level, dy = daily) => ask({ new: [lv, dy] }, () => newGame(lv, dy));
  W.onInput = d => {
    if (d.new) return restart(...d.new);
    const i = d.flag ?? d.hit; if (!(i >= 0 && i < cells.length) || over) return;
    if (d.flag != null) ask(d, () => toggleFlag(i)); else ask(d, () => cells[i].open ? chord(i) : open(i));
  };
  shareState(W, () => ({ level, daily, today, over, started, boom, el: started ? performance.now() - t0 : 0,
    c: cells.map(c => (c.mine ? 1 : 0) | (c.open ? 2 : 0) | (c.flag ? 4 : 0)) }), d => {
    if (d.level !== level || cells.length !== d.c.length) newGame(d.level, false);
    daily = d.daily; today = d.today; started = d.started; over = d.over; boom = d.boom;
    note.hidden = true; modeEl.textContent = daily ? `Daily challenge · ${level} · ${today}` : 'Free play';
    cells.forEach((c, i) => { const v = d.c[i]; c.mine = !!(v & 1); c.open = !!(v & 2); c.flag = !!(v & 4); });
    cells.forEach((c, i) => { c.n = around(i).filter(j => cells[j].mine).length; draw(i); });
    opened = cells.filter(c => c.open && !c.mine).length; flags = cells.filter(c => c.flag).length;
    ledLeft.textContent = led(mines - flags);
    const won = over && boom < 0;
    face.textContent = won ? FACE.win : over ? FACE.lose : FACE.ok;
    if (over && !won) cells.forEach((c, j) => { if (c.flag && !c.mine) grid.children[j].textContent = '❌'; });
    if (boom >= 0) grid.children[boom].classList.add('boom');
    if (started && !over) startClock(performance.now() - d.el); else { stopTimer(); ledTime.textContent = led(Math.ceil(d.el / 1000)); }
  });
  grid.addEventListener('pointerdown', e => {
    const i = cellOf(e); if (i < 0 || over) return;
    if (e.button === 2) { ask({ flag: i }, () => toggleFlag(i)); return; }
    if (e.button !== 0) return;
    face.textContent = FACE.press; held = false;
    if (e.pointerType !== 'mouse') hold = setTimeout(() => { held = true; ask({ flag: i }, () => toggleFlag(i)); face.textContent = FACE.ok; }, 400);
  });
  grid.addEventListener('pointerup', e => {
    clearTimeout(hold);
    const i = cellOf(e); if (e.button !== 0 || over) return;
    face.textContent = FACE.ok;
    if (held || i < 0) return;
    ask({ hit: i }, () => cells[i].open ? chord(i) : open(i));
  });
  grid.addEventListener('pointerleave', () => { clearTimeout(hold); if (!over) face.textContent = FACE.ok; });
  face.onclick = () => restart();

  menuBar(W, q('.menu'), {
    Game: [['New', () => restart()],
      ...Object.keys(MS_LEVELS).map(lv => [lv, () => restart(lv), () => level === lv]),
      ['Daily challenge', () => restart(level, !daily), () => daily],
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
// The answers are stored scrambled and in a random order, so the day's word can't just be read
// off the file. (Anything a browser can check can still be dug out by someone determined.)
const unscramble = s => {
  const key = 'krowos-wordle', b = atob(s);
  const out = Array.from(b, (c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length) ^ (i * 7 & 255))).join('');
  return out.match(/.{5}/g);
};
const loadWords = () => wordsP ||= fetch('assets/wordle/words.json')
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(d => ({ answers: unscramble(d.a), allowed: new Set(d.guesses.split(' ')) }))
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
  const state = store.get(`wordle2:${today}`, { guesses: [], done: false, won: false });
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
  // In a room everyone plays one board together: keys go to the opener's computer, which checks the
  // guesses and sends the board back. Solving it together counts as your daily game too, unless you'd
  // already finished yours.
  const ownDone = state.done;
  const get = () => ({ g: state.guesses, cur, done: state.done, won: state.won });
  shareState(W, get, d => {
    const was = state.done;
    state.guesses = d.g; state.done = d.done; state.won = d.won; cur = d.cur;
    if (!words) return;
    render();
    if (d.shake) shake();
    if (d.say) say(d.say);
    if (!was && state.done) { if (ownDone) say(state.won ? 'Solved!' : answer.toUpperCase(), 0); else { store.set(`wordle2:${today}`, state); finish(); } }
  });

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
    if (!isLead(W)) return sendInput(W, { k });
    if (k === 'Enter') return submit();
    if (k === 'Backspace') cur = cur.slice(0, -1);
    else if (cur.length < 5) cur += k;
    render(); W.push();
  }
  W.onInput = d => { if (typeof d.k === 'string' && (/^[a-z]$/.test(d.k) || d.k === 'Enter' || d.k === 'Backspace')) press(d.k); };
  const nope = text => { say(text); shake(); W.push({ ...get(), say: text, shake: 1 }); };
  function submit() {
    if (cur.length < 5) return nope('Not enough letters');
    if (!words.allowed.has(cur)) return nope('Not in word list');
    state.guesses.push(cur);
    if (cur === answer) state.done = state.won = true;
    else if (state.guesses.length === 6) state.done = true;
    cur = '';
    store.set(`wordle2:${today}`, state);
    render(); W.push();
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
  const W = makeWin({ title: 'Untitled - Paint', icon: I.paint, w: 900, h: 690 });
  W.body.innerHTML = '<div class="pt-tools"><div class="pt-g pt-set"></div><div class="pt-g pt-sizes"></div>'
    + '<div class="pt-g"><span class="pt-sw c1" title="Color 1 (left mouse button)"></span><span class="pt-sw c2" title="Color 2 (right mouse button)"></span></div>'
    + '<div class="pt-g"><div class="pt-pal"></div><input type="color" class="pt-custom" title="Pick any color for color 1" aria-label="Custom color"></div>'
    + '<div class="pt-g pt-act"></div></div>'
    + '<div class="pt-area"><div class="pt-stage"><canvas class="pt-c" width="800" height="480"></canvas><canvas class="pt-o" width="800" height="480"></canvas>'
    + '<div class="pt-rz e" data-d="e" title="Drag to resize the picture"></div><div class="pt-rz s" data-d="s" title="Drag to resize the picture"></div><div class="pt-rz se" data-d="se" title="Drag to resize the picture"></div><div class="pt-ghost" hidden></div></div></div>'
    + '<div class="status"><span class="pt-pos">Left click: color 1 · right click: color 2</span><span class="pt-size"></span>'
    + '<span class="pt-zoom"><button class="pt-zb" data-z="-1" aria-label="Zoom out" title="Zoom out (Ctrl+scroll)">−</button><span class="pt-zv"></span><button class="pt-zb" data-z="1" aria-label="Zoom in" title="Zoom in (Ctrl+scroll)">+</button></span></div>';
  const q = sel => W.body.querySelector(sel);
  const cv = q('.pt-c'), ov = q('.pt-o'), g = cv.getContext('2d', { willReadFrequently: true }), go = ov.getContext('2d');
  let tool = 'pencil', size = 5, c1 = '#000000', c2 = '#ffffff', drawing = null;
  const undo = [], redo = [];

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
    btn('tbtn', 'Clear', 'Clear the picture', () => { snap(); clear(); W.push({ op: 'clear' }); }),
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
  const restore = im => { if (im.width !== cv.width || im.height !== cv.height) setSize(im.width, im.height, false); g.putImageData(im, 0, 0); };
  function doUndo() { if (undo.length) { redo.push(all()); restore(undo.pop()); W.push(); } }
  function doRedo() { if (redo.length) { undo.push(all()); restore(redo.pop()); W.push(); } }

  // picture size (drag the handles at its edges) and zoom
  const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];
  let zoom = 1;
  function applyZoom() {
    [cv, ov].forEach(c => { c.style.width = cv.width * zoom + 'px'; c.style.height = cv.height * zoom + 'px'; });
    cv.classList.toggle('px', zoom > 1);
    q('.pt-zv').textContent = Math.round(zoom * 100) + '%';
    q('.pt-size').textContent = `${cv.width} × ${cv.height}px`;
  }
  const zoomBy = step => { zoom = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + step))]; applyZoom(); };
  W.body.querySelectorAll('.pt-zb').forEach(b => b.onclick = () => zoomBy(+b.dataset.z));
  q('.pt-area').addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); zoomBy(e.deltaY < 0 ? 1 : -1); }, { passive: false });
  function setSize(w, h, keep = true) { // new space is white; the picture stays in the top-left corner
    const old = keep ? all() : null;
    cv.width = ov.width = w; cv.height = ov.height = h;
    clear(); if (old) g.putImageData(old, 0, 0);
    applyZoom();
  }
  const ghost = q('.pt-ghost');
  W.body.querySelectorAll('.pt-rz').forEach(hd => hd.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); hd.setPointerCapture(e.pointerId);
    const d = hd.dataset.d, sx = e.clientX, sy = e.clientY, w0 = cv.width, h0 = cv.height;
    let w = w0, h = h0;
    const mv = ev => {
      if (d.includes('e')) w = Math.max(1, Math.min(4000, Math.round(w0 + (ev.clientX - sx) / zoom)));
      if (d.includes('s')) h = Math.max(1, Math.min(4000, Math.round(h0 + (ev.clientY - sy) / zoom)));
      ghost.hidden = false; ghost.style.width = w * zoom + 'px'; ghost.style.height = h * zoom + 'px';
      q('.pt-size').textContent = `${w} × ${h}px`;
    };
    const up = () => {
      hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', up); hd.removeEventListener('pointercancel', up);
      ghost.hidden = true;
      if (w !== w0 || h !== h0) { snap(); setSize(w, h); W.push(); } else applyZoom();
    };
    hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
  }));
  clear(); applyZoom();
  requestAnimationFrame(() => { // start zoomed out if the picture doesn't fit the window (small screens)
    const a = q('.pt-area'), fit = Math.min((a.clientWidth - 30) / cv.width, (a.clientHeight - 30) / cv.height);
    if (fit < 1) { zoom = [...ZOOMS].reverse().find(z => z <= fit) || ZOOMS[0]; applyZoom(); }
  });
  function clear() { g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height); }
  // in a room every stroke is sent as it's drawn; undo, redo and joining send the whole picture
  shareState(W, () => ({ img: cv.toDataURL() }), d => {
    if (d.img) { const im = new Image(); im.onload = () => { setSize(im.naturalWidth, im.naturalHeight, false); g.drawImage(im, 0, 0); }; im.src = d.img; }
    else if (d.op === 'clear') clear();
    else if (d.op === 'fill') fill(d.x, d.y, d.c);
    else if (d.op) stroke(g, d.op, ...d.a, d.c, d.w);
  });
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
    if (tool === 'fill') { fill(x, y, color); return W.push({ op: 'fill', x, y, c: color }); }
    drawing = { x, y, lx: x, ly: y, color: tool === 'eraser' ? c2 : color };
    cv.setPointerCapture(e.pointerId);
    if (FREEHAND.includes(tool)) line('line', [x, y, x + 0.01, y], drawing.color, width());
  });
  const line = (kind, a, c, w) => { stroke(g, kind, ...a, c, w); W.push({ op: kind, a: a.map(v => Math.round(v * 10) / 10), c, w }); };
  cv.addEventListener('pointermove', e => {
    const [x, y] = at(e);
    q('.pt-pos').textContent = `${Math.round(x)}, ${Math.round(y)}px`;
    if (!drawing) return;
    if (FREEHAND.includes(tool)) { line('line', [drawing.lx, drawing.ly, x, y], drawing.color, width()); drawing.lx = x; drawing.ly = y; }
    else { go.clearRect(0, 0, ov.width, ov.height); stroke(go, tool, drawing.x, drawing.y, x, y, drawing.color, width()); }
  });
  const finishShape = e => {
    if (!drawing) return;
    const [x, y] = at(e);
    if (!FREEHAND.includes(tool)) { go.clearRect(0, 0, ov.width, ov.height); line(tool, [drawing.x, drawing.y, x, y], drawing.color, width()); }
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

/* ---------- web browser ---------- */
// Pages load in an iframe, so sites that forbid framing show blank; ↗ opens them in a real tab.
const SEARCH_URL = 'https://www.google.com/search?igu=1&q=';
function toUrl(input) {
  const s = input.trim();
  if (!s) return '';
  if (!/^[a-z]+:\/\//i.test(s)) return /^[^\s]+\.[a-z]{2,}(\/|$)/i.test(s) ? 'https://' + s : SEARCH_URL + encodeURIComponent(s);
  return s;
}
// turn normal Spotify / YouTube links into their embeddable players
function embedUrl(url) {
  let m = url.match(/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(playlist|album|track|artist|episode|show)\/([\w]+)/i);
  if (m) return `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
  m = url.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([\w-]{11})/i);
  if (m) return `https://www.youtube.com/embed/${m[1]}?enablejsapi=1&origin=${encodeURIComponent(location.origin)}`; // the API lets a room share play/pause
  return url;
}
function openBrowser(start) {
  const W = makeWin({ title: 'Internet', icon: I.browser, w: 900, h: 600 });
  const nav = el(`<div class="nav"><button class="nb bk" aria-label="Back">${img(U.back, '')}</button><button class="nb fw" aria-label="Forward">${img(U.forward, '')}</button>`
    + '<button class="nb wb-re" aria-label="Reload" title="Reload">⟳</button><button class="nb wb-home" aria-label="Home" title="Home">⌂</button>'
    + '<form class="wb-form"><input class="wb-url" type="text" spellcheck="false" autocomplete="off" aria-label="Address or search"></form>'
    + '<button class="nb wb-out" aria-label="Open in a new tab" title="Open in a new tab">↗</button></div>');
  W.el.insertBefore(nav, W.body);
  W.body.innerHTML = '<div class="tools wb-marks"></div><div class="wb-page"><iframe class="wb-frame" referrerpolicy="no-referrer-when-downgrade" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe><div class="wb-note" hidden></div></div>';
  const q = sel => W.el.querySelector(sel);
  const frame = q('.wb-frame'), note = q('.wb-note'), urlIn = q('.wb-url');
  const st = { hist: [], i: -1 };
  let pausedMusic = false;
  W.onClose = () => { if (pausedMusic) setMusic(true); removeEventListener('message', onYt); clearInterval(ytListen); };

  // YouTube: in a room, play, pause and jumps in the video are shared. The embedded player can't be
  // reached directly (it's another site), but it answers YouTube's own embed messages.
  let yt = null, ytNext = null, ytListen = null;
  const ytId = () => (frame.src.match(/^https:\/\/www\.youtube\.com\/embed\/([\w-]{11})/) || [])[1];
  const ytSend = (func, args = []) => frame.contentWindow && frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args, id: 1, channel: 'widget' }), '*');
  const ytNow = () => yt.t + (yt.state === 1 ? (performance.now() - yt.at) / 1000 : 0);
  const ytPush = () => { if (yt && yt.ready) W.push({ yt: { v: ytId(), p: yt.state !== 1, t: ytNow() } }); };
  function applyYt(d) {
    if (!yt || !yt.ready) { ytNext = d; return; }
    if (d.v !== ytId()) return;
    if (Math.abs(ytNow() - d.t) > 2) { ytSend('seekTo', [d.t, true]); yt.t = d.t; yt.at = performance.now(); }
    if (d.p && yt.state === 1) ytSend('pauseVideo');
    else if (!d.p && yt.state !== 1) ytSend('playVideo');
  }
  frame.addEventListener('load', () => {
    clearInterval(ytListen); yt = null;
    if (!ytId()) return;
    yt = { ready: false, state: -1, t: 0, at: performance.now(), pending: ytNext }; ytNext = null;
    let tries = 0; // keep saying hello until the player answers
    ytListen = setInterval(() => {
      if (!yt || yt.ready || ++tries > 40) return clearInterval(ytListen);
      frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
    }, 250);
  });
  function onYt(e) {
    if (!yt || e.source !== frame.contentWindow || !/youtube/.test(e.origin)) return;
    let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
    if (!d || !d.event) return;
    if (!yt.ready) {
      yt.ready = true; clearInterval(ytListen); ytSend('addEventListener', ['onStateChange']);
      if (yt.pending) { const p = yt.pending; yt.pending = null; applyYt(p); }
    }
    const info = d.info && typeof d.info === 'object' ? d.info : {};
    if (typeof info.currentTime === 'number') { // a jump the player made (the viewer dragged the time bar)
      const jumped = yt.state === 1 && Math.abs(info.currentTime - ytNow()) > 2;
      yt.t = info.currentTime; yt.at = performance.now();
      if (jumped) ytPush();
    }
    const state = d.event === 'onStateChange' ? d.info : info.playerState;
    if (typeof state !== 'number' || state === yt.state) return;
    yt.state = state;
    if (state === 1 || state === 2) ytPush();
  }
  addEventListener('message', onYt);

  function show(entry) {
    urlIn.value = entry.url || '';
    if (entry.note) { frame.hidden = true; frame.removeAttribute('src'); note.hidden = false; note.textContent = entry.note; }
    else {
      note.hidden = true; frame.hidden = false; yt = null; clearInterval(ytListen); frame.src = embedUrl(entry.url);
      if (frame.src !== entry.url && !pausedMusic) { pausedMusic = true; setMusic(false); } // a player: don't play over it
    }
    W.setTitle(`${entry.title || entry.url} - Internet`);
    q('.bk').disabled = st.i <= 0; q('.fw').disabled = st.i >= st.hist.length - 1;
    q('.wb-out').disabled = !entry.url;
    W.push();
  }
  function go(entry) {
    const cur = st.hist[st.i];
    if (cur && entry.url && cur.url === entry.url) return show(cur); // same page again: just reload
    st.hist = st.hist.slice(0, st.i + 1); st.hist.push(entry); st.i++; show(entry);
  }
  const goUrl = (url, title) => { if (url) go({ url, title }); };
  q('.bk').onclick = () => { if (st.i > 0) show(st.hist[--st.i]); };
  q('.fw').onclick = () => { if (st.i < st.hist.length - 1) show(st.hist[++st.i]); };
  q('.wb-re').onclick = () => { if (st.i >= 0) show(st.hist[st.i]); };
  q('.wb-home').onclick = () => goUrl(BROWSER.home, 'Home');
  q('.wb-out').onclick = () => { const e = st.hist[st.i]; if (e && e.url) window.open(e.url, '_blank', 'noopener'); };
  q('.wb-form').onsubmit = e => { e.preventDefault(); goUrl(toUrl(urlIn.value)); };
  urlIn.onfocus = () => urlIn.select();
  const marks = q('.wb-marks');
  (BROWSER.bookmarks || []).forEach(b => {
    const btn = el('<button class="tbtn"></button>'); btn.textContent = b.name;
    btn.onclick = () => b.url ? goUrl(b.url, b.name) : go({ title: b.name, note: `No link for "${b.name}" yet.\n\nAdd one in config.js, under BROWSER > bookmarks.` });
    marks.append(btn);
  });
  if (!marks.children.length) marks.remove();
  shareState(W, () => ({ e: st.hist[st.i], yt: yt && yt.ready ? { v: ytId(), p: yt.state !== 1, t: ytNow() } : null }), d => {
    const cur = st.hist[st.i];
    if (d.e && !(cur && cur.url === d.e.url && cur.note === d.e.note)) go(d.e);
    if (d.yt) applyYt(d.yt);
  });
  goUrl(start || BROWSER.home, start ? '' : 'Home');
  return W;
}

/* ---------- music player ---------- */
// Plays the songs in a folder in order; background music pauses while it plays.
let playerWin = null;
function openPlayer(n, folder) {
  if (playerWin) { playerWin.play(n, folder); focusWin(playerWin); return playerWin; }
  const W = makeWin({ title: 'Music Player', icon: I.music, w: 440, h: 340 });
  W.body.innerHTML = '<div class="mp"><div class="mp-now">' + img(I.music, 'mp-art') + '<div><b class="mp-name"></b><span class="mp-pos dim"></span></div></div>'
    + `<div class="mp-ctrl"><button class="pvb mp-prev" aria-label="Previous song">${img(U.previous, '')}</button><audio controls preload="metadata"></audio><button class="pvb mp-next" aria-label="Next song">${img(U.next, '')}</button></div>`
    + '<div class="mp-list" role="list"></div></div>';
  const au = W.body.querySelector('audio'), listEl = W.body.querySelector('.mp-list');
  // follow the speaker button when there is one; without background music it's hidden
  if (music) { au.volume = snd.volume; au.muted = snd.muted; } else au.volume = SOUND.musicVolume;
  let songs = [], i = 0;
  function load() {
    const s = songs[i];
    au.src = s.src; au.play().catch(() => {});
    W.setTitle(`${s.name} - Music Player`);
    W.body.querySelector('.mp-name').textContent = s.name;
    W.body.querySelector('.mp-pos').textContent = `Song ${i + 1} of ${songs.length}`;
    listEl.replaceChildren(...songs.map((t, k) => {
      const b = el(`<button class="mp-song${k === i ? ' on' : ''}" role="listitem">${img(I.music, '')}<span></span></button>`);
      b.querySelector('span').textContent = t.name; b.onclick = () => { i = k; load(); }; return b;
    }));
    if (W.push) W.push();
  }
  W.play = (song, f) => {
    songs = (f || parentOf(song) || desktop).children.filter(c => c.type === 'audio');
    i = Math.max(0, songs.indexOf(song)); load();
  };
  const skip = d => { i = (i + d + songs.length) % songs.length; load(); };
  W.body.querySelector('.mp-prev').onclick = () => skip(-1);
  W.body.querySelector('.mp-next').onclick = () => skip(1);
  au.onended = () => skip(1);
  au.onplay = () => setMusic(false);
  W.onClose = () => { au.pause(); au.removeAttribute('src'); au.load(); playerWin = null; setMusic(true); };
  shareMedia(W, au, () => nodeKey(songs[i]), k => { const song = keyNodes.get(k); if (song && song !== songs[i]) W.play(song); });
  playerWin = W;
  W.play(n, folder);
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
  let ball, score, balls, best = store.get('pinball-best', 0), over = false, charge = 0, charging = false, raf = 0, last = 0, sendTick = 0;
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
    W.push();
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
    if (W.el.classList.contains('active') && !over && isLead(W)) {
      if (charging && ball.onPlunger) charge = Math.min(1, charge + dt * 1.2);
      for (let k = 0; k < 8; k++) step(dt / 8);
      bumpers.forEach(b => { b.flash = Math.max(0, b.flash - dt); });
      if (live() && ++sendTick % 2) W.push();
    }
    draw();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // in a room the opener's computer runs the table; the others send flipper and plunger presses
  const flip = (side, on) => { if (isLead(W)) flippers[side].on = on; else sendInput(W, { flip: [side, on] }); };
  const plunge = on => {
    if (!isLead(W)) return sendInput(W, { plunge: on });
    if (on) { if (over) newGame(); else if (ball.onPlunger) charging = true; }
    else if (charging) { charging = false; launch(); }
    W.push();
  };
  W.onInput = d => { if (d.flip) flip(...d.flip); if (d.plunge != null) plunge(d.plunge); };
  shareState(W, () => ({ b: [ball.x, ball.y, ball.onPlunger, ball.inLane], f: flippers.map(f => f.a), fl: bumpers.map(b => b.flash), score, balls, over, charge, charging }), d => {
    [ball.x, ball.y, ball.onPlunger, ball.inLane] = d.b;
    d.f.forEach((a, k) => { flippers[k].a = a; }); d.fl.forEach((v, k) => { bumpers[k].flash = v; });
    ({ score, balls, over, charge, charging } = d);
    if (over && score > best) { best = score; store.set('pinball-best', best); }
  });
  const keyOf = e => ['z', 'Z', 'ArrowLeft', 'Shift'].includes(e.key) && e.code !== 'ShiftRight' ? 0
    : ['/', '?', 'ArrowRight'].includes(e.key) || e.code === 'ShiftRight' ? 1 : e.key === ' ' || e.key === 'ArrowDown' ? 'launch' : null;
  const onDown = e => {
    if (!W.el.classList.contains('active')) return;
    const k = keyOf(e); if (k === null) return;
    e.preventDefault();
    if (k === 'launch') { if (!e.repeat) plunge(true); }
    else if (!e.repeat) flip(k, true);
  };
  const onUp = e => {
    const k = keyOf(e); if (k === null) return;
    if (k === 'launch') plunge(false);
    else flip(k, false);
  };
  document.addEventListener('keydown', onDown);
  document.addEventListener('keyup', onUp);
  let pressed = null;
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    if (over || ball.onPlunger) { pressed = 'plunge'; return plunge(true); }
    const r = cv.getBoundingClientRect();
    pressed = e.clientX - r.left < r.width / 2 ? 0 : 1; flip(pressed, true);
  });
  const release = () => { if (pressed === 'plunge') plunge(false); else if (pressed != null) flip(pressed, false); pressed = null; };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  W.onClose = () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', onDown); document.removeEventListener('keyup', onUp); pbWin = null; };
  pbWin = W;
  return W;
}

/* ---------- snake ---------- */
let snWin = null;
function openSnake() {
  if (snWin) { focusWin(snWin); return snWin; }
  const N = 20, C = 20, S = N * C;
  const W = makeWin({ title: 'Snake', icon: I.snake, w: 440, h: 540 });
  W.body.innerHTML = `<div class="sn"><div class="sn-top"><span class="sn-score"></span><span class="sn-best"></span></div><div class="sn-wrap"><canvas class="sn-c" width="${S}" height="${S}" aria-label="Snake board"></canvas></div>`
    + '<div class="sn-help">Arrow keys or WASD to steer · P or Space to pause<br>Touch: swipe to steer, tap to start</div></div>';
  const cv = W.body.querySelector('canvas'), g = cv.getContext('2d');
  const scoreEl = W.body.querySelector('.sn-score'), bestEl = W.body.querySelector('.sn-best');
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  let snake, dir, queue, food, score, best = store.get('snake-best', 0), state, acc = 0, last = 0, raf = 0, dirty = false;
  const speed = () => Math.max(60, 140 - score / 10 * 4); // ms per step, faster with every apple
  function placeFood() {
    const free = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!snake.some(p => p[0] === x && p[1] === y)) free.push([x, y]);
    food = free[Math.floor(Math.random() * free.length)];
  }
  function newGame() {
    snake = [[8, 10], [7, 10], [6, 10]]; dir = DIRS.right; queue = []; score = 0; state = 'ready'; acc = 0;
    placeFood(); updateText(); dirty = true;
  }
  function updateText() { scoreEl.textContent = `Score ${score}`; bestEl.textContent = `Best ${best}`; }
  function turn(name) {
    if (!isLead(W)) return sendInput(W, { turn: name });
    if (state === 'over') return;
    const d = DIRS[name], prev = queue.length ? queue[queue.length - 1] : dir;
    if (queue.length < 3 && d !== prev && (d[0] !== -prev[0] || d[1] !== -prev[1])) queue.push(d);
    if (state !== 'playing') state = 'playing';
    dirty = true;
  }
  function step() {
    if (queue.length) dir = queue.shift();
    const head = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
    const eating = head[0] === food[0] && head[1] === food[1];
    const body = eating ? snake : snake.slice(0, -1); // the tail moves out of the way unless we grow
    if (head[0] < 0 || head[1] < 0 || head[0] >= N || head[1] >= N || body.some(p => p[0] === head[0] && p[1] === head[1])) {
      state = 'over'; dirty = true;
      if (score > best) { best = score; store.set('snake-best', best); }
      updateText(); return;
    }
    snake = [head, ...body]; dirty = true;
    if (eating) { score += 10; updateText(); if (snake.length === N * N) { state = 'over'; return; } placeFood(); }
  }

  function draw() {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { g.fillStyle = (x + y) % 2 ? '#a7d948' : '#8ecc39'; g.fillRect(x * C, y * C, C, C); }
    g.fillStyle = '#e7471d'; g.beginPath(); g.arc(food[0] * C + C / 2, food[1] * C + C / 2 + 1, C * 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5a8f29'; g.fillRect(food[0] * C + C / 2 - 1, food[1] * C + 1, 3, 5);
    snake.forEach((p, k) => {
      const t = k / Math.max(1, snake.length - 1);
      g.fillStyle = `rgb(${Math.round(78 - 30 * t)},${Math.round(124 - 40 * t)},${Math.round(246 - 80 * t)})`;
      g.beginPath(); g.roundRect(p[0] * C + 1, p[1] * C + 1, C - 2, C - 2, k ? 5 : 7); g.fill();
    });
    const [hx, hy] = snake[0], ex = dir[1] ? 4 : 0, ey = dir[0] ? 4 : 0; // eyes sit across the direction of travel
    g.fillStyle = '#fff';
    [-1, 1].forEach(s => { g.beginPath(); g.arc(hx * C + C / 2 + dir[0] * 4 + ex * s, hy * C + C / 2 + dir[1] * 4 + ey * s, 3, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = '#111';
    [-1, 1].forEach(s => { g.beginPath(); g.arc(hx * C + C / 2 + dir[0] * 5 + ex * s, hy * C + C / 2 + dir[1] * 5 + ey * s, 1.5, 0, Math.PI * 2); g.fill(); });
    let msg = '';
    if (state === 'over') msg = snake.length === N * N ? 'You win! · Space or tap' : 'GAME OVER · Space or tap';
    else if (state === 'ready') msg = 'Press an arrow key or swipe';
    else if (state === 'paused') msg = 'Paused · P or tap to resume';
    else if (!W.el.classList.contains('active')) msg = 'Paused · click to play';
    if (msg) {
      g.fillStyle = '#00000099'; g.fillRect(40, S / 2 - 22, S - 80, 40);
      g.fillStyle = '#fff'; g.font = 'bold 16px Segoe UI, sans-serif'; g.textAlign = 'center'; g.fillText(msg, S / 2, S / 2 + 4);
    }
  }
  function frame(t) {
    const dt = Math.min(100, t - last || 0); last = t;
    if (state === 'playing' && W.el.classList.contains('active') && isLead(W)) {
      acc += dt;
      while (acc >= speed() && state === 'playing') { acc -= speed(); step(); }
    }
    if (dirty) { dirty = false; W.push(); }
    draw();
    raf = requestAnimationFrame(frame);
  }

  const KEYS = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  const pause = () => {
    if (!isLead(W)) return sendInput(W, { pause: 1 });
    if (state === 'playing') state = 'paused'; else if (state === 'paused') state = 'playing'; else if (state === 'over') newGame();
    dirty = true;
  };
  const resume = () => { if (state === 'paused') pause(); };
  // in a room the opener's computer runs the game; everyone else sends their keys and sees the board
  W.onInput = d => { if (d.turn) { resume(); turn(d.turn); } if (d.pause) pause(); };
  shareState(W, () => ({ snake, dir, food, score, state }), d => {
    ({ snake, food, score, state } = d); dir = Object.values(DIRS).find(v => v[0] === d.dir[0] && v[1] === d.dir[1]);
    if (state === 'over' && score > best) { best = score; store.set('snake-best', best); }
    updateText();
  });
  const onKey = e => {
    if (!W.el.classList.contains('active')) return;
    if (KEYS[e.key]) { e.preventDefault(); resume(); turn(KEYS[e.key]); }
    else if (e.key === ' ' || e.key === 'p' || e.key === 'P') { e.preventDefault(); pause(); }
  };
  document.addEventListener('keydown', onKey);
  let sx = 0, sy = 0;
  cv.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointerup', e => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) { if (state === 'ready') turn('right'); else pause(); return; }
    resume();
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  W.onClose = () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); snWin = null; };
  snWin = W;
  newGame();
  raf = requestAnimationFrame(frame);
  return W;
}

/* ---------- solitaire (klondike) ---------- */
const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const isRed = c => c.s === 1 || c.s === 2;
let solWin = null;
function openSolitaire() {
  if (solWin) { focusWin(solWin); return solWin; }
  const W = makeWin({ title: 'Solitaire', icon: I.solitaire, w: 640, h: 560 });
  W.body.innerHTML = '<div class="menu"></div><div class="sol"><div class="sol-board"></div><div class="sol-note" hidden></div></div><div class="status"><span class="sol-st"></span><span class="sol-t"></span></div>';
  const q = sel => W.body.querySelector(sel);
  const board = q('.sol-board'), note = q('.sol-note'), stEl = q('.sol-st'), tEl = q('.sol-t');
  let drawN = store.get('solitaire-draw', 1), st, history, moves, t0, timer = null, els = {}, auto = null;
  // st: { stock, waste, found[4], tab[7] }, each a list of cards { id, s, r, up }
  const slot = (k, cls) => { const d = el(`<div class="sol-slot ${cls}"></div>`); d.dataset.k = k; board.append(d); return d; };
  const slots = { stock: slot('stock', 'stock'), waste: slot('waste', 'none') };
  for (let i = 0; i < 4; i++) slots['f' + i] = slot('f' + i, 'found');
  for (let i = 0; i < 7; i++) slots['t' + i] = slot('t' + i, 'none');
  const pile = k => k === 'stock' ? st.stock : k === 'waste' ? st.waste : k[0] === 'f' ? st.found[+k[1]] : st.tab[+k[1]];
  const pileKeys = () => ['stock', 'waste', 'f0', 'f1', 'f2', 'f3', 't0', 't1', 't2', 't3', 't4', 't5', 't6'];
  const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const clock = () => { tEl.textContent = `Time ${mmss(t0 ? Math.floor((Date.now() - t0) / 1000) : 0)}`; };

  function newGame() {
    clearInterval(timer); clearTimeout(auto); timer = null; t0 = 0; moves = 0; history = []; note.hidden = true;
    const deck = [];
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ id: `${s}-${r}`, s, r, up: false });
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    st = { stock: [], waste: [], found: [[], [], [], []], tab: [] };
    for (let c = 0; c < 7; c++) { st.tab.push(deck.splice(0, c + 1)); st.tab[c][c].up = true; }
    st.stock = deck;
    [...st.stock, ...st.tab.flat()].forEach(c => {
      if (els[c.id]) return;
      const e = el(`<div class="sol-card${isRed(c) ? ' red' : ''}"><span class="sol-i">${RANKS[c.r]}<br>${SUITS[c.s]}</span><span class="sol-m">${SUITS[c.s]}</span></div>`);
      e.dataset.id = c.id; board.append(e); els[c.id] = e;
    });
    render(); W.push();
  }
  const begin = () => { if (!t0) { t0 = Date.now(); timer = setInterval(clock, 1000); } };
  function act(fn) { // every move goes through here so it can be undone
    history.push(JSON.stringify(st)); if (history.length > 200) history.shift();
    begin(); fn(); moves++;
    for (const col of st.tab) if (col.length && !col[col.length - 1].up) col[col.length - 1].up = true;
    render(); checkWin(); W.push();
  }
  function undo() {
    if (!history.length) return;
    clearTimeout(auto); st = JSON.parse(history.pop()); moves++; note.hidden = true; render(); W.push();
  }
  // In a room the opener's computer holds the real table: other players' moves are sent there,
  // checked, and the whole table comes back to everyone.
  const ask = (d, fn) => { if (isLead(W)) fn(); else sendInput(W, d); };
  const PILES = ['stock', 'waste', 'f0', 'f1', 'f2', 'f3', 't0', 't1', 't2', 't3', 't4', 't5', 't6'];
  const setDraw = n => ask({ drawN: n }, () => { drawN = n; store.set('solitaire-draw', n); newGame(); });
  const restart = () => ask({ new: 1 }, newGame);
  W.onInput = d => {
    if (d.new) restart(); else if (d.undo) undo(); else if (d.draw) draw(); else if (d.drawN === 1 || d.drawN === 3) setDraw(d.drawN);
    else if (d.smart && PILES.includes(d.smart[0])) {
      const [k, i] = d.smart, src = pile(k);
      if (src[i] && src[i].up && (k[0] === 't' || i === src.length - 1)) smartMove(k, i);
    } else if (d.move && PILES.includes(d.move[0]) && PILES.includes(d.move[2])) {
      const [from, n, to] = d.move, cards = pile(from).slice(-n);
      if (n > 0 && cards.length === n && cards[0].up && canDrop(cards, to)) move(from, n, to);
    }
  };
  shareState(W, () => ({ st, moves, drawN, el: t0 ? Date.now() - t0 : 0 }), d => {
    if (drag) { drag.cards.forEach(c => els[c.id].classList.remove('drag')); drag = null; }
    clearTimeout(auto); st = d.st; moves = d.moves; drawN = d.drawN;
    const won = st.found.every(f => f.length === 13);
    clearInterval(timer); timer = null; t0 = d.el ? Date.now() - d.el : 0;
    if (t0 && !won) timer = setInterval(clock, 1000);
    if (won) { note.innerHTML = `<b>You won!</b><span>${moves} moves in ${mmss(Math.floor(d.el / 1000))}</span><button class="okbtn">Play again</button>`; note.querySelector('button').onclick = restart; }
    note.hidden = !won; render();
  });

  // ---- rules ----
  const top = p => p[p.length - 1];
  const fitsFound = (c, f) => f.length ? top(f).s === c.s && top(f).r === c.r - 1 : c.r === 1;
  const fitsTab = (c, col) => col.length ? top(col).up && isRed(top(col)) !== isRed(c) && top(col).r === c.r + 1 : c.r === 13;
  function canDrop(cards, k) {
    if (k[0] === 'f') return cards.length === 1 && fitsFound(cards[0], pile(k));
    if (k[0] === 't') return fitsTab(cards[0], pile(k));
    return false;
  }
  function move(from, n, to) { act(() => { const src = pile(from); pile(to).push(...src.splice(src.length - n, n)); }); }
  function draw() {
    if (st.stock.length) act(() => { for (let i = 0; i < drawN && st.stock.length; i++) { const c = st.stock.pop(); c.up = true; st.waste.push(c); } });
    else if (st.waste.length) act(() => { st.stock = st.waste.reverse().map(c => ({ ...c, up: false })); st.waste = []; });
  }
  function smartMove(from, idx) { // clicking a card sends it to the best place it fits
    const src = pile(from), cards = src.slice(idx);
    if (cards.length === 1 && from[0] !== 'f') for (let i = 0; i < 4; i++) if (fitsFound(cards[0], st.found[i])) return move(from, 1, 'f' + i);
    const cols = [0, 1, 2, 3, 4, 5, 6].map(i => 't' + i).filter(k => k !== from);
    // prefer a column with cards over an empty one, so kings don't hop between empty columns
    const to = cols.find(k => pile(k).length && canDrop(cards, k)) || (idx > 0 || from[0] !== 't' ? cols.find(k => canDrop(cards, k)) : null);
    if (to) move(from, cards.length, to);
    else { cards.forEach(c => els[c.id].classList.add('nope')); setTimeout(() => cards.forEach(c => els[c.id].classList.remove('nope')), 300); }
  }
  function checkWin() {
    if (st.found.every(f => f.length === 13)) {
      clearInterval(timer); clock();
      const secs = Math.floor((Date.now() - t0) / 1000), best = Math.min(secs, store.get('solitaire-best', secs));
      const wins = store.get('solitaire-wins', 0) + 1;
      store.set('solitaire-best', best); store.set('solitaire-wins', wins);
      note.innerHTML = `<b>You won!</b><span>${moves} moves in ${mmss(secs)}</span><span>Best time ${mmss(best)} · ${wins} wins</span><button class="okbtn">Play again</button>`;
      note.querySelector('button').onclick = restart; note.hidden = false;
      return;
    }
    // once everything is face up and dealt, finish the game for the player
    if (!st.stock.length && !st.waste.length && st.tab.every(col => col.every(c => c.up))) {
      auto = setTimeout(() => {
        for (const k of ['t0', 't1', 't2', 't3', 't4', 't5', 't6']) {
          const c = top(pile(k)); if (!c) continue;
          const f = st.found.findIndex(f => fitsFound(c, f));
          if (f >= 0) return move(k, 1, 'f' + f);
        }
      }, 90);
    }
  }

  // ---- layout ----
  let L = {};
  function render() {
    const bw = board.clientWidth, bh = board.clientHeight;
    if (!bw || !bh) return; // minimized
    const gap = Math.max(4, Math.min(12, bw / 60));
    const cw = Math.min(80, (bw - gap * 8) / 7, (bh - gap * 3) / 1.4 / 3.2), ch = cw * 1.4;
    const x0 = (bw - cw * 7 - gap * 6) / 2, colX = i => x0 + i * (cw + gap), tabY = gap + ch + gap * 1.5;
    L = { cw, ch, gap, colX, tabY };
    board.style.setProperty('--cw', cw + 'px');
    const place = (e, x, y) => { e.style.left = x + 'px'; e.style.top = y + 'px'; };
    place(slots.stock, colX(0), gap); place(slots.waste, colX(1), gap);
    for (let i = 0; i < 4; i++) place(slots['f' + i], colX(3 + i), gap);
    for (let i = 0; i < 7; i++) place(slots['t' + i], colX(i), tabY);
    slots.stock.classList.toggle('empty-recycle', !st.stock.length && !!st.waste.length);
    let z = 1;
    const put = (c, x, y, k, i) => {
      const e = els[c.id]; place(e, x, y); e.style.zIndex = z++;
      e.classList.toggle('back', !c.up); e.dataset.k = k; e.dataset.i = i;
    };
    st.stock.forEach((c, i) => put(c, colX(0) + Math.min(i, 20) * 0.15, gap - Math.min(i, 20) * 0.15, 'stock', i));
    const fanFrom = st.waste.length - (drawN === 3 ? 3 : 1);
    st.waste.forEach((c, i) => put(c, colX(1) + Math.max(0, i - fanFrom) * cw * 0.28, gap, 'waste', i));
    st.found.forEach((f, n) => f.forEach((c, i) => put(c, colX(3 + n), gap, 'f' + n, i)));
    st.tab.forEach((col, n) => {
      const downs = col.filter(c => !c.up).length, ups = col.length - downs, room = bh - tabY - ch - gap;
      let dDown = ch * 0.12, dUp = ch * 0.27;
      const need = downs * dDown + Math.max(0, ups - 1) * dUp;
      if (need > room && need > 0) { const s = room / need; dDown *= s; dUp *= s; } // squeeze tall columns to fit
      let y = tabY;
      col.forEach((c, i) => { put(c, colX(n), y, 't' + n, i); y += c.up ? dUp : dDown; });
    });
    stEl.textContent = `Moves ${moves} · Draw ${drawN === 1 ? 'one' : 'three'}`; clock();
  }
  const ro = new ResizeObserver(() => { if (!drag) render(); });
  ro.observe(board);

  // ---- pointer: click to auto-move, drag to place ----
  let drag = null;
  board.addEventListener('pointerdown', e => {
    if (drag || e.button > 0) return;
    const sr = slots.stock.getBoundingClientRect(); // a quick second click can land on the card still sliding off the deck
    if (e.clientX >= sr.left && e.clientX <= sr.right && e.clientY >= sr.top && e.clientY <= sr.bottom) return ask({ draw: 1 }, draw);
    const ce = e.target.closest('.sol-card');
    if (!ce) return;
    const k = ce.dataset.k, i = +ce.dataset.i, src = pile(k);
    if (k === 'stock') return ask({ draw: 1 }, draw);
    if (!src[i] || !src[i].up || (k[0] !== 't' && i !== src.length - 1)) return; // only the top card leaves the waste or a foundation
    const cards = src.slice(i), r = board.getBoundingClientRect();
    drag = { k, i, cards, x: e.clientX, y: e.clientY, moved: false, starts: cards.map(c => [parseFloat(els[c.id].style.left), parseFloat(els[c.id].style.top)]), r };
    board.setPointerCapture(e.pointerId);
  });
  board.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) { drag.moved = true; drag.cards.forEach((c, j) => { const ce = els[c.id]; ce.classList.add('drag'); ce.style.zIndex = 1000 + j; }); }
    drag.cards.forEach((c, j) => { const ce = els[c.id]; ce.style.left = drag.starts[j][0] + dx + 'px'; ce.style.top = drag.starts[j][1] + dy + 'px'; });
  });
  const endDrag = (e, cancel) => {
    if (!drag) return;
    const d = drag; drag = null;
    d.cards.forEach(c => els[c.id].classList.remove('drag'));
    if (!d.moved) { if (!cancel) ask({ smart: [d.k, d.i] }, () => smartMove(d.k, d.i)); return; }
    // drop on whichever pile the middle of the lead card is over
    const cx = d.starts[0][0] + e.clientX - d.x + L.cw / 2, cy = d.starts[0][1] + e.clientY - d.y + L.ch / 2;
    const col = Math.floor((cx - L.colX(0) + L.gap / 2) / (L.cw + L.gap));
    const to = col < 0 || col > 6 ? null : cy < L.tabY - L.gap / 2 ? (col >= 3 ? 'f' + (col - 3) : null) : 't' + col;
    const ok = !cancel && to && to !== d.k && canDrop(d.cards, to);
    if (ok) ask({ move: [d.k, d.cards.length, to] }, () => move(d.k, d.cards.length, to));
    if (!ok || !isLead(W)) render(); // snap back; another player's move shows once it comes back
  };
  board.addEventListener('pointerup', e => endDrag(e, false));
  board.addEventListener('pointercancel', e => endDrag(e, true));
  board.addEventListener('contextmenu', e => e.preventDefault());
  const onKey = e => {
    if (!W.el.classList.contains('active')) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); ask({ undo: 1 }, undo); }
    else if (e.key === 'F2') { e.preventDefault(); restart(); }
  };
  document.addEventListener('keydown', onKey);

  menuBar(W, q('.menu'), {
    Game: [['New game   F2', restart], ['Undo   Ctrl+Z', () => ask({ undo: 1 }, undo)],
      ['Draw one', () => setDraw(1), () => drawN === 1],
      ['Draw three', () => setDraw(3), () => drawN === 3],
      ['Close', () => closeWin(W)]],
  });
  const prev = W.onClose;
  W.onClose = () => { prev && prev(); clearInterval(timer); clearTimeout(auto); ro.disconnect(); document.removeEventListener('keydown', onKey); solWin = null; };
  solWin = W;
  newGame();
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
const leftItems = DESKTOP_ITEMS.filter(n => ['folder', 'txt', 'minesweeper', 'wordle', 'paint', 'pinball', 'snake', 'solitaire', 'video', 'audio', 'browser'].includes(n.type))
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

/* ---------- multiplayer: rooms, people and cursors ---------- */
// Browsers connect straight to each other (WebRTC). Public Nostr relays only help them find each
// other, so there's no server or database; the shared desktop lives in the open browsers.
const MP_COLORS = ['#e8445a', '#f08c2e', '#e6c229', '#3bb273', '#2fa7d8', '#5b6ee1', '#a35bd8', '#e55fae'];
const me = { name: store.get('mp-name', `Guest ${100 + Math.floor(Math.random() * 900)}`), color: store.get('mp-color', MP_COLORS[Math.floor(Math.random() * MP_COLORS.length)]) };
let room = null, roomCode = '', since = 0, synced = false, mpPanel = null, mpLib = null, mpError = '';
const mpBtn = document.getElementById('mpb');
const roomFromUrl = () => (location.hash.match(/room=([\w-]+)/) || [])[1] || '';
const inviteLink = () => `${location.origin}${location.pathname}#room=${roomCode}`;
const newCode = () => Array.from({ length: 6 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');

function toast(text) {
  const t = el('<div class="mp-toast"></div>'); t.textContent = text; document.body.append(t);
  setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3000);
}
const hello = to => mpSend({ t: 'hello', id: mp.self, name: me.name, color: me.color, since }, to);

async function joinRoom(code) {
  if (room) await leaveRoom();
  roomCode = code.toLowerCase().replace(/[^\w-]/g, '').slice(0, 32); if (!roomCode) return;
  try { mpLib ||= await import('./assets/vendor/trystero.js'); }
  catch { toast("Couldn't load multiplayer. Open the site from a web server, not straight from a file."); roomCode = ''; return; }
  since = Date.now(); synced = false; mpError = '';
  const config = { appId: `krowos-${SITE_NAME}`, password: roomCode };
  if (MULTIPLAYER.relays && MULTIPLAYER.relays.length) config.relayConfig = { urls: MULTIPLAYER.relays.map(u => u.includes('://') ? u : 'wss://' + u) };
  if (MULTIPLAYER.turn) config.turnConfig = MULTIPLAYER.turn;
  room = mpLib.joinRoom(config, roomCode, { onJoinError: e => { mpError = e.error || String(e); refreshMp(); } });
  const action = room.makeAction('m');
  mp.send = (m, to) => { action.send(m, to ? { target: to } : undefined).catch(() => {}); };
  action.onMessage = (m, { peerId }) => receive(m, peerId);
  room.onPeerJoin = peerId => hello(peerId);
  room.onPeerLeave = peerId => {
    const p = mp.peers.get(peerId); if (!p) return;
    p.cur.remove(); mp.peers.delete(peerId); toast(`${p.name} left`); refreshMp();
  };
  history.replaceState(null, '', '#room=' + roomCode);
  refreshMp();
}
async function leaveRoom() {
  const r = room; room = null; mp.send = null; roomCode = '';
  mp.peers.forEach(p => p.cur.remove()); mp.peers.clear();
  history.replaceState(null, '', location.pathname + location.search);
  refreshMp();
  if (r) await r.leave().catch(() => {});
}

function receive(m, from) {
  const p = mp.peers.get(from), W = m.sid ? bySid(m.sid) : null;
  if (m.t === 'hello') {
    const known = !!p, peer = p || { cur: el('<div class="mp-cur" hidden><svg viewBox="0 0 16 22" aria-hidden="true"><path d="M1 1v17l4.5-4.2 3 6.7 3-1.4-3-6.6H15z"/></svg><span></span></div>') };
    Object.assign(peer, { id: m.id, name: m.name, color: m.color, since: m.since });
    peer.cur.style.setProperty('--c', m.color); peer.cur.querySelector('span').textContent = m.name;
    if (!known) { document.body.append(peer.cur); mp.peers.set(from, peer); toast(`${m.name} joined`); }
    if (!known && m.since > since) mpSend({ t: 'snap', since, wins: [...wins].filter(w => w.sid).sort((a, b) => a.el.style.zIndex - b.el.style.zIndex).map(winInfo) }, from);
    refreshMp(); return;
  }
  if (!p) return;
  if (m.t === 'in') { if (W && W.onInput && isLead(W)) W.onInput(m.d); return; }
  asRemote(() => {
    if (m.t === 'cur') return moveCursor(p, m);
    if (m.t === 'snap') { // someone who was here first: show their desktop instead of mine
      if (synced || m.since >= since) return;
      synced = true;
      wins.filter(w => w.sid).forEach(w => closeWin(w));
      m.wins.forEach(openRemote);
      return;
    }
    if (m.t === 'open') return openRemote(m);
    if (!W) return;
    if (m.t === 'close') closeWin(W);
    else if (m.t === 'focus') focusWin(W);
    else if (m.t === 'min') { W.el.classList.add('min'); focusTop(); }
    else if (m.t === 'max') { if (m.on !== W.el.classList.contains('max')) toggleMax(W); }
    else if (m.t === 'rect') setRect(W, m.r);
    else if (m.t === 'app' && W.setState) W.setState(m.d);
  });
}

// cursors: over a shared window the spot is sent relative to that window, so it lands on the
// same button even when the two screens are different sizes
function moveCursor(p, m) {
  const W = m.w && bySid(m.w);
  if (m.hide || (m.w && (!W || W.el.classList.contains('min')))) { p.cur.hidden = true; return; }
  const x = W ? W.el.offsetLeft + m.x : m.x, y = W ? W.el.offsetTop + m.y : m.y;
  p.cur.hidden = false;
  p.cur.style.transform = `translate(${Math.max(0, Math.min(innerWidth - 12, x))}px, ${Math.max(0, Math.min(innerHeight - 12, y))}px)`;
  if (m.down) { const r = el('<i class="mp-click"></i>'); p.cur.append(r); setTimeout(() => r.remove(), 450); }
}
let curMsg = null, curTimer = null;
function sendCursor(e, down) {
  if (!live()) return;
  const w = e.target.closest && e.target.closest('.win'), W = w && wins.find(o => o.el === w && o.sid);
  curMsg = W ? { t: 'cur', w: W.sid, x: e.clientX - w.offsetLeft, y: e.clientY - w.offsetTop } : { t: 'cur', x: e.clientX, y: e.clientY };
  if (down) { curMsg.down = 1; mpSend(curMsg); curMsg = null; return; }
  if (!curTimer) curTimer = setTimeout(() => { curTimer = null; if (curMsg) mpSend(curMsg); curMsg = null; }, 40);
}
document.addEventListener('pointermove', e => sendCursor(e, false), true);
document.addEventListener('pointerdown', e => sendCursor(e, true), true);
document.documentElement.addEventListener('pointerleave', () => { if (live()) mpSend({ t: 'cur', hide: 1 }); });

// the panel: start or join a room, share the link, see who's here
function refreshMp() {
  const n = mp.peers.size;
  mpBtn.classList.toggle('live', !!room);
  mpBtn.innerHTML = `<span class="mp-ico">👥</span>${room ? `<b>${n + 1}</b>` : ''}`;
  mpBtn.title = room ? `Multiplayer: room ${roomCode}, ${n + 1} here` : 'Multiplayer';
  if (mpPanel) mpPanel.render();
}
function openMpPanel() {
  if (mpPanel) { focusWin(mpPanel); return mpPanel; }
  const W = makeWin({ title: 'Multiplayer', icon: I.multiplayer, w: 380, h: 470 });
  const q = sel => W.body.querySelector(sel);
  W.render = () => {
    const swatches = MP_COLORS.map(c => `<button class="mp-sw${c === me.color ? ' on' : ''}" data-c="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('');
    const people = [{ ...me, you: true }, ...mp.peers.values()].map(p => `<li><i style="background:${p.color}"></i>${esc(p.name)}${p.you ? ' <span class="dim">(you)</span>' : ''}</li>`).join('');
    W.body.innerHTML = `<div class="mpp"><label class="mp-row">Your name <input class="mp-name" maxlength="24"></label><div class="mp-sws">${swatches}</div>`
      + (room
        ? `<div class="mp-box"><div>Room <b class="mp-code">${esc(roomCode)}</b></div><div class="mp-link"><input class="mp-url" readonly><button class="okbtn mp-copy">Copy link</button></div>`
          + `<div class="dim">${mp.peers.size ? 'Everyone here sees the same desktop.' : 'Waiting for someone to join… Send them the link.'}</div><div class="mp-status"></div></div>`
          + `<h4>Here now</h4><ul class="mp-people">${people}</ul><button class="okbtn mp-leave">Leave room</button>`
        : `<div class="mp-box"><button class="okbtn mp-new">Start a room</button><div class="dim">You get a link to send. Whoever opens it sees your desktop, mouse and windows live.</div></div>`
          + `<form class="mp-box mp-join"><span>Have a code?</span><div class="mp-link"><input class="mp-in" placeholder="Room code or link" aria-label="Room code" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"><button class="okbtn">Join</button></div></form>`)
      + `<div class="dim mp-fine">Connections go straight between browsers, nothing is saved anywhere. Strict school or work networks can block them.</div></div>`;
    const name = q('.mp-name'); name.value = me.name;
    name.onchange = () => { me.name = name.value.trim().slice(0, 24) || me.name; store.set('mp-name', me.name); hello(); W.render(); };
    W.body.querySelectorAll('.mp-sw').forEach(b => b.onclick = () => { me.color = b.dataset.c; store.set('mp-color', me.color); hello(); W.render(); });
    if (room) {
      W.status();
      q('.mp-url').value = inviteLink();
      q('.mp-copy').onclick = () => { navigator.clipboard.writeText(inviteLink()).then(() => toast('Link copied'), () => q('.mp-url').select()); };
      q('.mp-leave').onclick = () => leaveRoom();
    } else {
      q('.mp-new').onclick = () => { // a second room in the same page goes through a fresh load, like the link
        if (mpLib) { location.hash = 'room=' + newCode(); location.reload(); } else joinRoom(newCode());
      };
      // joining by code does exactly what opening the invite link does: load the page fresh in that room
      q('.mp-join').onsubmit = e => {
        e.preventDefault();
        const c = q('.mp-in').value.trim().replace(/.*room=/, '').toLowerCase().replace(/[^\w-]/g, '').slice(0, 32);
        if (!c) return;
        location.hash = 'room=' + c; location.reload();
      };
    }
  };
  // connection check, so it's clear what's wrong when nobody shows up
  W.status = () => {
    const box = q('.mp-status'); if (!box || !room) return;
    const socks = Object.values(mpLib.getRelaySockets ? mpLib.getRelaySockets() : {}), up = socks.filter(ws => ws && ws.readyState === 1).length;
    let text = `Helper servers reachable: ${up} of ${socks.length}`, bad = !up;
    if (mpError) {
      bad = true;
      text += /SDP|TURN/i.test(mpError) ? ' · Found someone, but one of your networks blocked the direct connection. A TURN server fixes this (see MULTIPLAYER in config.js).' : ` · ${mpError}`;
    } else if (!up) text += ' · Your network or an ad blocker may be blocking them.';
    box.textContent = text; box.classList.toggle('bad', bad);
  };
  const statusTimer = setInterval(W.status, 1500);
  W.onClose = () => { clearInterval(statusTimer); mpPanel = null; };
  mpPanel = W; W.render();
  return W;
}
mpBtn.onclick = () => openMpPanel();
if (!MULTIPLAYER.enabled) mpBtn.hidden = true;
refreshMp();

if (OPEN_ON_START) openNode(OPEN_ON_START);
if (MULTIPLAYER.enabled && roomFromUrl()) joinRoom(roomFromUrl());
})();
