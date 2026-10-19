/* LaisaOS — desktop logic. Content and asset paths live in config.js. */
(() => {
/* ---------- screen resolution ---------- */
// Everyone gets the same layout: the desktop is drawn on a virtual screen of a fixed resolution (Settings >
// Display, 1600 × 900 unless changed), scaled to fit the browser window with black bars if the shapes differ.
// "Fit my screen" keeps the height and fills the width instead. Inside this file innerWidth/innerHeight,
// mouse positions (cX/cY) and element boxes (lrect) are all in virtual-screen units.
const UI = { s: 1, ox: 0, oy: 0 };
let innerWidth = window.innerWidth, innerHeight = window.innerHeight;
function displayChoice() { // { w, h } fixed, or { w: 0, h } to fill the width
  const d = typeof DISPLAY === 'object' ? DISPLAY : {};
  let saved = null; try { saved = JSON.parse(localStorage.getItem('krowos:display')); } catch {}
  const pick = saved && saved.h ? saved : { w: d.width ?? 1600, h: d.height || 900 };
  return { w: Math.max(0, pick.w | 0), h: Math.max(400, pick.h | 0) };
}
function applyScale() {
  const vw = window.innerWidth, vh = window.innerHeight, d = typeof DISPLAY === 'object' ? DISPLAY : {}, pick = displayChoice();
  const native = d.scale === false || vw <= 640; // phones keep their own layout
  if (native) Object.assign(UI, { s: 1, ox: 0, oy: 0, w: vw, h: vh });
  else if (pick.w) { const k = Math.min(vw / pick.w, vh / pick.h); Object.assign(UI, { s: k, ox: (vw - pick.w * k) / 2, oy: (vh - pick.h * k) / 2, w: pick.w, h: pick.h }); }
  else Object.assign(UI, { s: vh / pick.h, ox: 0, oy: 0, w: vw * pick.h / vh, h: pick.h });
  innerWidth = UI.w; innerHeight = UI.h;
  const b = document.body.style, r = document.documentElement.style;
  if (native) b.transform = b.width = b.height = '';
  else Object.assign(b, { transform: `translate(${UI.ox}px, ${UI.oy}px) scale(${UI.s})`, transformOrigin: '0 0', width: UI.w + 'px', height: UI.h + 'px' });
  document.documentElement.classList.toggle('boxed', !native);
  r.setProperty('--vw', UI.w / 100 + 'px'); r.setProperty('--vh', UI.h / 100 + 'px');
}
applyScale();
window.addEventListener('resize', applyScale); // registered first, so everything else sees the new size
const cX = e => (e.clientX - UI.ox) / UI.s, cY = e => (e.clientY - UI.oy) / UI.s;
const lrect = elm => {
  const r = elm.getBoundingClientRect(), k = UI.s, x = (r.left - UI.ox) / k, y = (r.top - UI.oy) / k;
  return { left: x, top: y, right: x + r.width / k, bottom: y + r.height / k, width: r.width / k, height: r.height / k, x, y };
};

const I = ASSETS.icons, U = ASSETS.ui;
const img = (src, cls = 'ico', alt = '') => `<img class="${cls}" src="${src}" alt="${alt}" draggable="false">`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- tree ---------- */
const desktop = { name: 'Desktop', type: 'folder', children: DESKTOP_ITEMS };
const isFolder = n => ['folder', 'computer', 'drive', 'bin'].includes(n.type);
const typeName = n => ({ folder: 'File folder', computer: 'System folder', drive: 'Local Disk', bin: 'System folder', txt: 'Text Document', img: 'Picture', video: 'Video', minesweeper: 'Game', wordle: 'Game', pinball: 'Game', snake: 'Game', solitaire: 'Game', tictactoe: 'Game', connect4: 'Game', checkers: 'Game', chess: 'Game', g2048: 'Game', sudoku: 'Game',  paint: 'Application', pixelpaint: 'Application', audio: 'Audio', browser: 'Application' })[n.type];
function iconSrc(n) {
  if (n.icon) return n.icon;
  if (n.type === 'img') return n.src;
  if (n.type === 'video' && n.poster) return n.poster;
  if (n.type === 'folder') return n.art ? I.folderArts : I.folder;
  if (n.type === 'bin') return n.children.length ? I.binFull : I.binEmpty;
  return { txt: I.textFile, computer: I.computer, drive: I.drive, video: I.video, minesweeper: I.minesweeper, wordle: I.wordle, paint: I.paint, pixelpaint: I.pixelpaint, pinball: I.pinball, snake: I.snake, solitaire: I.solitaire, tictactoe: I.tictactoe, connect4: I.connect4, checkers: I.checkers, chess: I.chess, g2048: I.g2048, sudoku: I.sudoku,  audio: I.music, browser: I.browser }[n.type] || I.textFile;
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

/* ---------- log in screen ---------- */
// After loading, a pretend log in: any password (even none) is accepted.
const login = document.getElementById('login');
if (LOGIN_SCREEN.enabled) {
  login.hidden = false;
  login.style.backgroundImage = `url("${ASSETS.wallpaper}")`;
  login.querySelector('.lg-pic img').src = ASSETS.avatar;
  login.querySelector('.lg-name').textContent = OWNER_NAME;
  login.querySelector('.lg-brand').textContent = SITE_NAME;
  login.querySelector('.lg-hint').textContent = LOGIN_SCREEN.hint || '';
  login.onsubmit = e => {
    e.preventDefault();
    const pw = login.querySelector('.lg-pw');
    if (LOGIN_SCREEN.eggPassword && pw.value.trim().toLowerCase() === LOGIN_SCREEN.eggPassword.toLowerCase()) { pw.value = ''; return showEgg(); }
    login.querySelector('.lg-row').hidden = true; login.querySelector('.lg-hint').hidden = true;
    login.querySelector('.lg-wait').hidden = false;
    setTimeout(() => { login.classList.add('out'); setTimeout(() => login.remove(), 500); }, LOGIN_SCREEN.welcomeTime ?? 1300);
  };
} else login.remove();
// the secret password: a dark screen with a swaying three-layer tree (click or Esc goes back)
function showEgg() {
  const egg = el('<div id="egg"><canvas width="960" height="540" aria-label="A swaying tree"></canvas></div>');
  document.body.append(egg);
  const cv = egg.querySelector('canvas'), g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const load = src => new Promise(ok => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; });
  let raf = 0;
  Promise.all(['bg', 'tree_1', 'tree_2', 'tree_3'].map(n => load(`assets/egg/${n}.png`))).then(([bg, t1, t2, t3]) => {
    const S = 2, t0 = performance.now();
    const draw = (im, x, y) => { if (im) g.drawImage(im, Math.round(x), Math.round(y), im.width * S, im.height * S); };
    const frame = now => {
      const siner = (now - t0) / 1000 * 30; // GameMaker steps at 30 a second
      g.fillStyle = '#000'; g.fillRect(0, 0, 960, 540);
      if (bg) g.drawImage(bg, 0, 0, 960, 540);
      const w = (t1 || t2 || t3 || { width: 105 }).width * S, h = (t1 || t2 || t3 || { height: 91 }).height * S;
      const x = (960 - w) / 2, y = (540 - h) / 2 - h / 2; // centred, then up by half the tree's height
      draw(t1, x, y);
      draw(t2, x + Math.sin(siner / 12) * 2, y + Math.cos(siner / 20) * 2);
      draw(t3, x + Math.sin(siner / 14) * 1, y + Math.cos(siner / 24) * 1);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
  const close = () => { cancelAnimationFrame(raf); egg.remove(); removeEventListener('keydown', onKey, true); focusLogin(); };
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  egg.addEventListener('click', close);
  addEventListener('keydown', onKey, true);
}
const focusLogin = () => { if (login.isConnected) login.querySelector('.lg-pw').focus(); };

/* ---------- loading screen ---------- */
// stays up until the wallpaper and icons have loaded (at least LOADING_SCREEN.minTime, at most 8 seconds)
(function boot() {
  const b = document.getElementById('boot');
  if (!LOADING_SCREEN.enabled) { b.remove(); focusLogin(); return; }
  b.querySelector('.boot-logo').style.backgroundImage = `url("${ASSETS.startOrb}")`;
  b.querySelector('.boot-text').textContent = (LOADING_SCREEN.text || 'Starting {name}').replace('{name}', SITE_NAME);
  const t0 = performance.now();
  let done = false;
  const hide = () => {
    if (done) return; done = true;
    setTimeout(() => { b.classList.add('out'); focusLogin(); setTimeout(() => b.remove(), 600); }, Math.max(0, (LOADING_SCREEN.minTime ?? 1200) - (performance.now() - t0)));
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
    if (win.classList.contains('max')) { const r = cX(e) / innerWidth; toggleMax(W); win.style.left = (cX(e) - win.offsetWidth * r) + 'px'; win.style.top = '0px'; }
    const ox = cX(e) - win.offsetLeft, oy = cY(e) - win.offsetTop; tb.setPointerCapture(e.pointerId);
    const mv = ev => {
      win.style.left = Math.min(innerWidth - 60, Math.max(60 - win.offsetWidth, cX(ev) - ox)) + 'px'; win.style.top = Math.min(innerHeight - 80, Math.max(0, cY(ev) - oy)) + 'px';
      tellRect(W);
    };
    const up = () => { tb.removeEventListener('pointermove', mv); tb.removeEventListener('pointerup', up); tellRect(W, true); };
    tb.addEventListener('pointermove', mv); tb.addEventListener('pointerup', up);
  });
  // resize from any edge or corner
  win.querySelectorAll('.rz').forEach(h => h.addEventListener('pointerdown', e => {
    if (e.button !== 0 || innerWidth <= 640 || win.classList.contains('max')) return;
    e.preventDefault(); e.stopPropagation(); focusWin(W);
    const d = h.dataset.d, sx = cX(e), sy = cY(e), [x0, y0, w0, h0] = [win.offsetLeft, win.offsetTop, win.offsetWidth, win.offsetHeight];
    const minW = 260, minH = 140;
    h.setPointerCapture(e.pointerId);
    const mv = ev => {
      const dx = cX(ev) - sx, dy = cY(ev) - sy;
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
// Each person has their own active window: someone else opening or clicking a window never takes yours
// (it's outlined in their color instead), so two people can use two windows at once.
function focusWin(W) {
  if (mp.remote) { W.el.style.zIndex = ++z; return; }
  const was = W.el.classList.contains('active') && !W.el.classList.contains('min');
  wins.forEach(o => { o.el.classList.remove('active'); o.tk.classList.remove('on'); }); W.el.classList.remove('min'); W.el.classList.add('active'); W.tk.classList.add('on'); W.el.style.zIndex = ++z;
  if (!was) mpSend({ t: 'focus', sid: W.sid || null });
}
function focusTop() {
  wins.forEach(o => { o.el.classList.remove('active'); o.tk.classList.remove('on'); });
  const top = wins.filter(w => !w.el.classList.contains('min')).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
  if (top) { const was = mp.remote; mp.remote = false; focusWin(top); mp.remote = was; } // picking my next window is my own action
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
  if (!inc) { mpSend({ t: 'open', ...winInfo(W) }); if (W.el.classList.contains('active')) mpSend({ t: 'focus', sid: W.sid }); }
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
// a window is in use if it's my active window or someone in the room is in it (Snake and Pinball keep running)
const inUse = W => W.el.classList.contains('active') || (live() && [...mp.peers.values()].some(p => p.focus === W.sid));
function paintFocus() { // outline the windows other people are in, in their color
  wins.forEach(w => {
    const here = w.sid ? [...mp.peers.values()].filter(p => p.focus === w.sid) : [];
    w.el.classList.toggle('peer-on', here.length > 0);
    if (here.length) w.el.style.setProperty('--pc', here[0].color);
    let tag = w.el.querySelector('.who');
    if (here.length && !tag) { tag = el('<span class="who"></span>'); w.el.querySelector('.ttl').after(tag); }
    if (tag) { tag.hidden = !here.length; tag.textContent = here.map(p => p.name).join(', '); if (here.length) tag.style.background = here[0].color; }
  });
}
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
    if (m.min) W.el.classList.add('min');
  });
  if (m.st && W.setState) W.setState(m.st);
  paintFocus();
}
// selections: mine are sent as they change, other people's show outlined in their color
const lastSel = {};
const selTimers = {};
function watchSel(root, where) { // where() -> 'desk' or a window's sid
  const mo = new MutationObserver(() => {
    const k = where(); if (!k || !live()) return;
    clearTimeout(selTimers[k]);
    selTimers[k] = setTimeout(() => {
      const keys = [...root.querySelectorAll('.sel[data-k]')].map(e => e.dataset.k), json = JSON.stringify(keys);
      if (lastSel[k] === json) return; // painting someone else's selection changes classes too
      lastSel[k] = json; mpSend({ t: 'sel', w: k, k: keys });
    }, 40);
  });
  mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  return mo;
}
function paintSel() {
  document.querySelectorAll('.rsel').forEach(e => { e.classList.remove('rsel'); e.style.removeProperty('--rc'); });
  mp.peers.forEach(p => Object.entries(p.sel || {}).forEach(([where, keys]) => {
    const W = where !== 'desk' && bySid(where), root = where === 'desk' ? dEl : W && W.el.querySelector('.files');
    if (root) keys.forEach(k => { const e = root.querySelector(`[data-k="${CSS.escape(k)}"]`); if (e) { e.classList.add('rsel'); e.style.setProperty('--rc', p.color); } });
  }));
}
function closeWin(W) {
  const wasActive = W.el.classList.contains('active');
  if (W.sid) mpSend({ t: 'close', sid: W.sid });
  W.onClose && W.onClose(); W.el.remove(); W.tk.remove(); wins.splice(wins.indexOf(W), 1);
  if (wasActive || !mp.remote) focusTop();
}

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
  if (n.type === 'pixelpaint') return openPixelPaint();
  if (n.type === 'pinball') return openPinball();
  if (n.type === 'snake') return openSnake();
  if (n.type === 'solitaire') return openSolitaire();
  if (n.type === 'tictactoe') return openTicTacToe();
  if (n.type === 'connect4') return openConnectFour();
  if (n.type === 'checkers') return openCheckers();
  if (n.type === 'chess') return openChess();
  if (n.type === 'g2048') return open2048();
  if (n.type === 'sudoku') return openSudoku();
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
      item.dataset.k = nodeKey(c);
      if (c.type === 'drive') item.append(el(`<div class="meta"><span>${esc(c.name)}</span><div class="bar"><i style="width:${(c.used || 0) * 100}%"></i></div><span class="dim">${esc(c.free || '')}</span></div>`));
      else { const lb = el('<div class="lb"></div>'); lb.textContent = c.name; item.append(lb); }
      item.onclick = () => { files.querySelectorAll('.fi').forEach(f => f.classList.remove('sel')); item.classList.add('sel'); st.sel = c; details(c); if (touchy) open(c); };
      item.ondblclick = () => open(c);
      item.onkeydown = e => { if (e.key === 'Enter') open(c); if (e.key === 'Delete') notHim(); };
      files.append(item);
    });
    st.sel = null; details(null);
    W.push(); if (live()) paintSel();
  }
  function open(c) { if (isFolder(c)) go(c); else openNode(c, cur()); }
  function details(c) {
    const d = W.body.querySelector('.details'), n = cur();
    if (!c) { d.innerHTML = `<span class="ic">${img(iconSrc(n))}</span><span>${n.children.length} item${n.children.length === 1 ? '' : 's'}</span>`; return; }
    d.innerHTML = `<span class="ic">${img(iconSrc(c))}</span><span><b>${esc(c.name)}</b><br><span class="dim">${typeName(c)}</span></span>`;
  }
  const selWatch = watchSel(W.body.querySelector('.files'), () => W.sid);
  W.onClose = () => selWatch.disconnect();
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
    const d = hd.dataset.d, sx = cX(e), sy = cY(e), w0 = cv.width, h0 = cv.height;
    let w = w0, h = h0;
    const mv = ev => {
      if (d.includes('e')) w = Math.max(1, Math.min(4000, Math.round(w0 + (cX(ev) - sx) / zoom)));
      if (d.includes('s')) h = Math.max(1, Math.min(4000, Math.round(h0 + (cY(ev) - sy) / zoom)));
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
  const at = e => { const r = lrect(cv); return [(cX(e) - r.left) * cv.width / r.width, (cY(e) - r.top) * cv.height / r.height]; };
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
  W.body.innerHTML = '<div class="tools wb-marks"></div><div class="wb-page"><iframe class="wb-frame" referrerpolicy="no-referrer-when-downgrade" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe><div class="wb-note" hidden></div>'
    + `<div class="wb-start" hidden><div class="wb-logo"></div><form class="wb-sform"><input class="wb-sq" type="search" spellcheck="false" autocomplete="off" placeholder="Search Google or type a web address" aria-label="Search"><button class="okbtn">Search</button></form>`
    + '<div class="wb-tiles"></div><p class="wb-tip">In a multiplayer room, pages opened from here or the address bar open for everyone. Clicks, typing and scrolling inside other websites stay private to each person (browsers don\'t let one site watch another), so search from this page or the address bar to search together.</p></div></div>';
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
    q('.wb-start').hidden = !entry.start;
    if (entry.start) { frame.hidden = true; frame.removeAttribute('src'); note.hidden = true; yt = null; q('.wb-sq').value = ''; }
    else if (entry.note) { frame.hidden = true; frame.removeAttribute('src'); note.hidden = false; note.textContent = entry.note; }
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
  const goHome = () => BROWSER.home && BROWSER.home !== 'start' ? goUrl(BROWSER.home, 'Home') : go({ start: true, title: 'New tab' });
  q('.wb-home').onclick = goHome;
  // start page: its search box and tiles go through the same path as the address bar, so they're shared
  const logo = q('.wb-logo'), colors = ['#4285f4', '#ea4335', '#fbbc05', '#4285f4', '#34a853', '#ea4335'];
  [...SITE_NAME].forEach((ch, k) => { const s = document.createElement('span'); s.textContent = ch; s.style.color = colors[k % colors.length]; logo.append(s); });
  logo.append(Object.assign(document.createElement('small'), { textContent: ' Search' }));
  q('.wb-sform').onsubmit = e => { e.preventDefault(); const v = q('.wb-sq').value; if (v.trim()) goUrl(toUrl(v)); };
  const tiles = q('.wb-tiles');
  (BROWSER.bookmarks || []).filter(b => b.url).forEach(b => {
    const t = el('<button class="wb-tile"><b></b><span></span></button>');
    t.firstChild.textContent = b.name.slice(0, 1).toUpperCase(); t.lastChild.textContent = b.name;
    t.onclick = () => goUrl(b.url, b.name); tiles.append(t);
  });
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
    if (d.e && !(cur && cur.url === d.e.url && cur.note === d.e.note && !!cur.start === !!d.e.start)) go(d.e);
    if (d.yt) applyYt(d.yt);
  });
  if (start) goUrl(start, ''); else goHome();
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
  const W = makeWin({ title: '3D Pinball', icon: I.pinball, w: 620, h: 700 });
  W.body.innerHTML = '<div class="pb"><div class="pb-main"><div class="pb-wrap"><canvas class="pb-c" width="360" height="600" aria-label="Pinball table"></canvas></div>'
    + '<div class="pb-panel"><canvas class="pb-logo" width="200" height="150" aria-hidden="true"></canvas><div class="pb-ballrow">BALL <b class="pb-ball">1</b></div>'
    + '<div class="pb-scorerow"><b class="pb-player">1</b><b class="pb-score">0</b></div><div class="pb-msg" role="status"></div><div class="pb-info"></div></div></div>'
    + '<div class="pb-help">Z or ← left flipper · / or → right flipper · hold Space to launch · F3 pause<br>Touch: tap left/right half for flippers, hold to launch</div></div>';
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
  let ball, score, balls, best = store.get('pinball-best', 0), over = false, charge = 0, charging = false, raf = 0, last = 0, sendTick = 0, paused = false;
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

  // the look: a deep-space table with chrome rails, mushroom bumpers and a ring of lights (drawn once,
  // then the moving parts on top), tilted back with CSS for the 3D feel, and the black score panel
  const art = document.createElement('canvas'); art.width = TW; art.height = TH;
  (function paintArt() {
    const a = art.getContext('2d'), rnd = seededRandom('pinball-art');
    const bg = a.createRadialGradient(165, 300, 40, 165, 300, 420);
    bg.addColorStop(0, '#22327a'); bg.addColorStop(0.55, '#121a4a'); bg.addColorStop(1, '#070a1f');
    a.fillStyle = bg; a.fillRect(0, 0, TW, TH);
    for (const [x, y, r, c] of [[80, 120, 90, 'rgba(160,60,200,.22)'], [260, 230, 110, 'rgba(40,120,220,.2)'], [120, 470, 80, 'rgba(200,40,90,.14)']]) {
      const n = a.createRadialGradient(x, y, 0, x, y, r); n.addColorStop(0, c); n.addColorStop(1, 'transparent');
      a.fillStyle = n; a.fillRect(0, 0, TW, TH);
    }
    a.strokeStyle = 'rgba(120,150,255,.13)'; a.lineWidth = 1; // the cracked-glass lines
    for (let k = 0; k < 70; k++) {
      let x = rnd() * TW, y = rnd() * TH; a.beginPath(); a.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; a.lineTo(x, y); }
      a.stroke();
    }
    for (let k = 0; k < 140; k++) { a.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.65})`; const s = rnd() < 0.1 ? 2 : 1; a.fillRect(rnd() * TW, rnd() * TH, s, s); }
    const planet = a.createRadialGradient(285, 92, 2, 290, 100, 26); planet.addColorStop(0, '#7fd36a'); planet.addColorStop(1, '#1e5a2a');
    a.fillStyle = planet; a.beginPath(); a.arc(290, 100, 24, 0, Math.PI * 2); a.fill();
    a.strokeStyle = 'rgba(200,220,255,.5)'; a.lineWidth = 2; a.beginPath(); a.ellipse(290, 100, 38, 9, -0.3, 0, Math.PI * 2); a.stroke();
    a.save(); a.translate(240, 420); a.rotate(-0.5); // a rocket decal
    a.fillStyle = 'rgba(200,60,80,.55)'; a.beginPath(); a.moveTo(0, -46); a.quadraticCurveTo(14, -20, 10, 30); a.lineTo(-10, 30); a.quadraticCurveTo(-14, -20, 0, -46); a.fill();
    a.fillStyle = 'rgba(120,200,255,.6)'; a.beginPath(); a.arc(0, -14, 5, 0, Math.PI * 2); a.fill();
    a.fillStyle = 'rgba(255,170,60,.5)'; a.beginPath(); a.moveTo(-8, 30); a.lineTo(0, 52); a.lineTo(8, 30); a.fill();
    a.restore();
    for (const [x, y] of [[48, 380], [282, 380], [30, 250], [300, 250]]) { // lane arrows
      a.fillStyle = 'rgba(255,210,60,.75)'; a.beginPath(); a.moveTo(x, y - 8); a.lineTo(x + 7, y + 5); a.lineTo(x - 7, y + 5); a.fill();
    }
    const rail = (w, c) => { a.lineCap = 'round'; a.lineJoin = 'round'; a.strokeStyle = c; a.lineWidth = w; a.beginPath(); walls.forEach(([x1, y1, x2, y2]) => { a.moveTo(x1, y1); a.lineTo(x2, y2); }); a.stroke(); };
    rail(9, '#1b1f2a'); rail(6, '#6c7686'); rail(2, '#e3e9f2');
    a.fillStyle = '#2a1414'; a.fillRect(322, 560, 26, 40); // plunger slot
  })();
  const LIGHTS = 18;
  function draw() {
    const now = performance.now();
    g.drawImage(art, 0, 0);
    // ring of lights round a glowing hole in the middle (just for looks)
    const cx = 165, cy = 395, glow = g.createRadialGradient(cx, cy, 2, cx, cy, 30);
    glow.addColorStop(0, '#bff3ff'); glow.addColorStop(0.4, '#3cb7ff'); glow.addColorStop(1, 'rgba(20,60,160,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, 30, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < LIGHTS; k++) {
      const ang = k / LIGHTS * Math.PI * 2, on = Math.floor(now / 90) % LIGHTS === k || (score && (k + Math.floor(now / 400)) % 6 === 0);
      g.fillStyle = on ? '#ffd23f' : '#6b3a1c'; g.beginPath(); g.arc(cx + Math.cos(ang) * 40, cy + Math.sin(ang) * 40, 3.5, 0, Math.PI * 2); g.fill();
    }
    if (!ball.inLane) { g.lineCap = 'round'; g.strokeStyle = '#e3e9f2'; g.lineWidth = 3; g.beginPath(); g.moveTo(gate[0], gate[1]); g.lineTo(gate[2], gate[3]); g.stroke(); }
    const py = 566 + charge * 14; // plunger: red knob on a spring
    g.strokeStyle = '#b8c0cc'; g.lineWidth = 2; g.beginPath();
    for (let k = 0; k <= 8; k++) g.lineTo(k % 2 ? 330 : 340, py + 8 + k * (26 - charge * 14) / 8);
    g.stroke();
    g.fillStyle = '#d4282e'; g.fillRect(324, py, 22, 8);
    bumpers.forEach(bp => { // mushroom bumpers: red skirt, white cap, blue middle; small ones are yellow targets
      const lit = bp.flash > 0;
      if (bp.pts > 50) {
        g.fillStyle = lit ? '#fff6a8' : '#c41e2a'; g.beginPath(); g.arc(bp.x, bp.y, bp.r, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#f4f4f4'; g.beginPath(); g.arc(bp.x, bp.y - 2, bp.r * 0.68, 0, Math.PI * 2); g.fill();
        g.fillStyle = lit ? '#ffffff' : '#2a6fe0'; g.beginPath(); g.arc(bp.x, bp.y - 2, bp.r * 0.32, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.5; g.beginPath(); g.arc(bp.x, bp.y, bp.r, 0, Math.PI * 2); g.stroke();
      } else {
        g.fillStyle = lit ? '#fff' : '#f2b705'; g.beginPath();
        for (let k = 0; k < 10; k++) { const rr = k % 2 ? bp.r * 0.5 : bp.r + 2, an = k / 10 * Math.PI * 2 - Math.PI / 2; g.lineTo(bp.x + Math.cos(an) * rr, bp.y + Math.sin(an) * rr); }
        g.fill();
      }
    });
    flippers.forEach(f => { // white flippers with a red stripe
      const ex = f.x + Math.cos(f.a) * f.len, ey = f.y + Math.sin(f.a) * f.len;
      g.lineCap = 'round';
      g.strokeStyle = '#1b1f2a'; g.lineWidth = 16; g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(ex, ey); g.stroke();
      g.strokeStyle = '#f2f4f8'; g.lineWidth = 12; g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(ex, ey); g.stroke();
      g.strokeStyle = '#d4282e'; g.lineWidth = 3; g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(ex, ey); g.stroke();
    });
    const bb = g.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, R);
    bb.addColorStop(0, '#ffffff'); bb.addColorStop(0.5, '#b9c2cf'); bb.addColorStop(1, '#4b5464');
    g.fillStyle = bb; g.beginPath(); g.arc(ball.x, ball.y, R, 0, Math.PI * 2); g.fill();
    // score panel
    panel.ball.textContent = over ? '-' : Math.min(3, 4 - balls);
    panel.score.textContent = score;
    let msg = '', info = `High score ${best}`;
    if (over) msg = 'Game Over\nSpace to play again';
    else if (paused) msg = 'Game Paused\nF3 to Resume';
    else if (!inUse(W)) msg = 'Game Paused\nClick to Resume';
    else if (ball.onPlunger) msg = charging ? 'Launch!' : 'Hold Space\nto launch';
    else msg = 'Mission in\nprogress';
    if (panel.msg.textContent !== msg) panel.msg.textContent = msg;
    if (panel.info.textContent !== info) panel.info.textContent = info;
  }
  const panel = { ball: W.body.querySelector('.pb-ball'), score: W.body.querySelector('.pb-score'), msg: W.body.querySelector('.pb-msg'), info: W.body.querySelector('.pb-info') };
  (function paintLogo() { // the title card: space backdrop, rings and the name in big purple letters
    const lc = W.body.querySelector('.pb-logo'), a = lc.getContext('2d'), rnd = seededRandom('pinball-logo');
    const sky = a.createLinearGradient(0, 0, 0, 150); sky.addColorStop(0, '#05051a'); sky.addColorStop(1, '#16123c');
    a.fillStyle = sky; a.fillRect(0, 0, 200, 150);
    for (let k = 0; k < 60; k++) { a.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`; a.fillRect(rnd() * 200, rnd() * 150, 1, 1); }
    const pl = a.createRadialGradient(160, 118, 2, 165, 122, 30); pl.addColorStop(0, '#ffb35c'); pl.addColorStop(1, '#7a2a10');
    a.fillStyle = pl; a.beginPath(); a.arc(168, 124, 26, 0, Math.PI * 2); a.fill();
    a.textAlign = 'center';
    a.font = 'italic bold 16px "Comic Sans MS", "Trebuchet MS", sans-serif'; a.fillStyle = '#c9b6ff'; a.fillText('3D Pinball', 100, 30);
    const tg = a.createLinearGradient(0, 40, 0, 96); tg.addColorStop(0, '#e9dcff'); tg.addColorStop(0.5, '#a477f0'); tg.addColorStop(1, '#5a2aa8');
    a.font = 'italic 900 34px "Comic Sans MS", "Trebuchet MS", sans-serif'; a.lineWidth = 4; a.strokeStyle = '#1a0b3a';
    a.strokeText('Space', 92, 66); a.fillStyle = tg; a.fillText('Space', 92, 66);
    a.strokeText('Cadet', 108, 100); a.fillText('Cadet', 108, 100);
  })();
  function frame(t) {
    const dt = Math.min(0.033, (t - last) / 1000 || 0); last = t;
    if (inUse(W) && !over && !paused && isLead(W)) {
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
  const togglePause = () => { if (!isLead(W)) return sendInput(W, { pause: 1 }); if (!over) paused = !paused; W.push(); };
  W.onInput = d => { if (d.flip) flip(...d.flip); if (d.plunge != null) plunge(d.plunge); if (d.pause) togglePause(); };
  shareState(W, () => ({ b: [ball.x, ball.y, ball.onPlunger, ball.inLane], f: flippers.map(f => f.a), fl: bumpers.map(b => b.flash), score, balls, over, charge, charging, paused }), d => {
    paused = !!d.paused;
    [ball.x, ball.y, ball.onPlunger, ball.inLane] = d.b;
    d.f.forEach((a, k) => { flippers[k].a = a; }); d.fl.forEach((v, k) => { bumpers[k].flash = v; });
    ({ score, balls, over, charge, charging } = d);
    if (over && score > best) { best = score; store.set('pinball-best', best); }
  });
  const keyOf = e => ['z', 'Z', 'ArrowLeft', 'Shift'].includes(e.key) && e.code !== 'ShiftRight' ? 0
    : ['/', '?', 'ArrowRight'].includes(e.key) || e.code === 'ShiftRight' ? 1 : e.key === ' ' || e.key === 'ArrowDown' ? 'launch' : null;
  const onDown = e => {
    if (!W.el.classList.contains('active')) return;
    if (e.key === 'F3') { e.preventDefault(); return togglePause(); }
    const k = keyOf(e); if (k === null) return;
    e.preventDefault();
    if (paused) { if (k === 'launch' && !e.repeat) togglePause(); return; }
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
    const r = lrect(cv);
    pressed = cX(e) - r.left < r.width / 2 ? 0 : 1; flip(pressed, true);
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
    else if (!inUse(W)) msg = 'Paused · click to play';
    if (msg) {
      g.fillStyle = '#00000099'; g.fillRect(40, S / 2 - 22, S - 80, 40);
      g.fillStyle = '#fff'; g.font = 'bold 16px Segoe UI, sans-serif'; g.textAlign = 'center'; g.fillText(msg, S / 2, S / 2 + 4);
    }
  }
  function frame(t) {
    const dt = Math.min(100, t - last || 0); last = t;
    if (state === 'playing' && inUse(W) && isLead(W)) {
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
  cv.addEventListener('pointerdown', e => { sx = cX(e); sy = cY(e); cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointerup', e => {
    const dx = cX(e) - sx, dy = cY(e) - sy;
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
    const sr = lrect(slots.stock); // a quick second click can land on the card still sliding off the deck
    if (cX(e) >= sr.left && cX(e) <= sr.right && cY(e) >= sr.top && cY(e) <= sr.bottom) return ask({ draw: 1 }, draw);
    const ce = e.target.closest('.sol-card');
    if (!ce) return;
    const k = ce.dataset.k, i = +ce.dataset.i, src = pile(k);
    if (k === 'stock') return ask({ draw: 1 }, draw);
    if (!src[i] || !src[i].up || (k[0] !== 't' && i !== src.length - 1)) return; // only the top card leaves the waste or a foundation
    const cards = src.slice(i), r = lrect(board);
    drag = { k, i, cards, x: cX(e), y: cY(e), moved: false, starts: cards.map(c => [parseFloat(els[c.id].style.left), parseFloat(els[c.id].style.top)]), r };
    board.setPointerCapture(e.pointerId);
  });
  board.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = cX(e) - drag.x, dy = cY(e) - drag.y;
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
    const cx = d.starts[0][0] + cX(e) - d.x + L.cw / 2, cy = d.starts[0][1] + cY(e) - d.y + L.ch / 2;
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

/* ---------- two-player board games ---------- */
// Tic-tac-toe, Connect Four, Checkers and Chess share this part: who plays which side, whose turn it
// is, the computer player and multiplayer. Modes: 'cpu' (you against the computer), 'local' (two people
// on one screen) and, in a room, 'online': each side belongs to whoever moves it first, everyone else
// watches. Like the other shared games, the opener's computer holds the real game.
const personName = id => id === mp.self ? me.name : ([...mp.peers.values()].find(p => p.id === id) || {}).name || 'someone';
const BG_SINGLES = {};
function boardGame(G) {
  // G: { key, title, icon, w, h, sides: [name, name], init(), legal(g, mv, side), apply(g, mv, side) -> true when the turn passes,
  //      result(g, turn) -> null | { winner: side | -1, text?, line? }, ai(g, side) -> move, mount(board, api), render(st, view) }
  if (BG_SINGLES[G.key]) { focusWin(BG_SINGLES[G.key]); return BG_SINGLES[G.key]; }
  const W = makeWin({ title: G.title, icon: G.icon, w: G.w, h: G.h });
  W.body.innerHTML = `<div class="menu"></div><div class="bg ${G.key}"><div class="bg-status"></div><div class="bg-board"></div></div>`;
  const q = sel => W.body.querySelector(sel), statusEl = q('.bg-status'), board = q('.bg-board');
  let st, aiTimer = null;
  const fresh = mode => ({ g: G.init(), turn: 0, mode, seats: [null, null], over: null, n: 0, last: null });
  // the side whose view I get (chess and checkers turn the board around for the second player)
  const mySide = () => st.mode === 'online' ? Math.max(0, st.seats.indexOf(mp.self)) : st.mode === 'cpu' ? 0 : st.turn;
  function canAct(side, who) {
    if (st.over) return false;
    if (st.mode === 'local') return true;
    if (st.mode === 'cpu') return side === 0 || who === 'cpu';
    if (st.seats[side]) return st.seats[side] === who;
    return st.seats[1 - side] !== who || !live() || mp.peers.size === 0; // alone in the room you may play both sides
  }
  function statusText() {
    const name = s => st.mode === 'online' ? (st.seats[s] ? `${G.sides[s]} (${personName(st.seats[s])})` : G.sides[s]) : st.mode === 'cpu' ? (s ? `${G.sides[s]} (computer)` : `${G.sides[s]} (you)`) : G.sides[s];
    if (st.over) return st.over.winner < 0 ? (st.over.text || "It's a draw") : `${name(st.over.winner)} wins${st.over.text ? ' · ' + st.over.text : ''}!`;
    const mine = canAct(st.turn, mp.self);
    let t = `${name(st.turn)} to move${G.check && G.check(st.g, st.turn) ? ' · Check!' : ''}`;
    if (st.mode === 'online' && !st.seats[st.turn] && mine) t += ' · make a move to take this side';
    else if (st.mode !== 'local' && mine) t = `Your move${G.check && G.check(st.g, st.turn) ? ' · Check!' : ''}`;
    return t;
  }
  function draw() {
    statusEl.textContent = statusText();
    statusEl.classList.toggle('over', !!st.over);
    G.render(st, { side: mySide(), mine: canAct(st.turn, mp.self) });
  }
  function doMove(mv, who) { // runs on the computer that holds the game
    const side = st.turn;
    if (!canAct(side, who) || !G.legal(st.g, mv, side)) return;
    if (st.mode === 'online' && !st.seats[side] && who !== 'cpu') st.seats[side] = who;
    const passes = G.apply(st.g, mv, side);
    st.last = mv; st.n++;
    if (passes) st.turn = 1 - side;
    st.over = G.result(st.g, st.turn);
    draw(); W.push();
    if (st.mode === 'cpu' && st.turn === 1 && !st.over) { clearTimeout(aiTimer); aiTimer = setTimeout(() => { const m = G.ai(st.g, 1); if (m != null) doMove(m, 'cpu'); }, 350); }
  }
  const ask = (d, fn) => { if (isLead(W)) fn(); else sendInput(W, d); };
  const restart = mode => ask({ new: mode }, () => { clearTimeout(aiTimer); st = fresh(mode || st.mode); draw(); W.push(); });
  W.onInput = (d, from) => { if (d.new) restart(d.new); else if (d.mv != null) doMove(d.mv, from); };
  shareState(W, () => st, d => { st = d; draw(); });
  G.mount(board, { move: mv => ask({ mv }, () => doMove(mv, mp.self)), get st() { return st; }, view: () => ({ side: mySide(), mine: canAct(st.turn, mp.self) }) });
  menuBar(W, q('.menu'), {
    Game: [['New game', () => restart()],
      ['Play the computer', () => restart('cpu'), () => st.mode === 'cpu'],
      ['Two players, this screen', () => restart('local'), () => st.mode === 'local'],
      ['Two players, multiplayer room', () => live() ? restart('online') : openMpPanel(), () => st.mode === 'online'],
      ['Close', () => closeWin(W)]],
  });
  const prev = W.onClose;
  W.onClose = () => { prev && prev(); clearTimeout(aiTimer); delete BG_SINGLES[G.key]; };
  BG_SINGLES[G.key] = W;
  st = fresh(live() ? 'online' : 'cpu'); draw();
  return W;
}
// helpers for the computer players
const shuffleBy = (arr, rnd = Math.random) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

/* tic-tac-toe */
const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function tttResult(b) {
  for (const l of TTT_LINES) if (b[l[0]] >= 0 && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return { winner: b[l[0]], line: l };
  return b.every(v => v >= 0) ? { winner: -1 } : null;
}
function openTicTacToe() {
  let cells = [];
  return boardGame({
    key: 'ttt', title: 'Tic-Tac-Toe', icon: I.tictactoe, w: 340, h: 420, sides: ['X', 'O'],
    init: () => ({ b: Array(9).fill(-1) }),
    legal: (g, i) => Number.isInteger(i) && g.b[i] === -1,
    apply: (g, i, side) => { g.b[i] = side; return true; },
    result: g => tttResult(g.b),
    ai(g, side) { // perfect play, with a random pick among equally good moves
      const score = (b, turn, depth) => {
        const r = tttResult(b); if (r) return r.winner < 0 ? 0 : (r.winner === side ? 10 - depth : depth - 10);
        let best = turn === side ? -99 : 99;
        b.forEach((v, i) => { if (v < 0) { b[i] = turn; const s = score(b, 1 - turn, depth + 1); b[i] = -1; best = turn === side ? Math.max(best, s) : Math.min(best, s); } });
        return best;
      };
      const opts = shuffleBy(g.b.map((v, i) => v < 0 ? i : -1).filter(i => i >= 0));
      let best = opts[0], bs = -99;
      opts.forEach(i => { g.b[i] = side; const s = score(g.b, 1 - side, 1); g.b[i] = -1; if (s > bs) { bs = s; best = i; } });
      return best;
    },
    mount(board, api) {
      board.innerHTML = '<div class="ttt-grid">' + '<button class="ttt-c"></button>'.repeat(9) + '</div>';
      cells = [...board.querySelectorAll('.ttt-c')];
      cells.forEach((c, i) => c.onclick = () => api.move(i));
    },
    render(st, view) {
      const line = st.over && st.over.line || [];
      cells.forEach((c, i) => {
        const v = st.g.b[i];
        c.textContent = v < 0 ? '' : v ? 'O' : 'X';
        c.className = 'ttt-c' + (v === 0 ? ' x' : v === 1 ? ' o' : '') + (line.includes(i) ? ' win' : '') + (v < 0 && view.mine ? ' can' : '');
      });
    },
  });
}

/* connect four */
const C4_W = 7, C4_H = 6;
function c4Lines(b) { // every run of four, as cell lists
  const out = [];
  for (let r = 0; r < C4_H; r++) for (let c = 0; c < C4_W; c++)
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const er = r + dr * 3, ec = c + dc * 3;
      if (er < 0 || er >= C4_H || ec < 0 || ec >= C4_W) continue;
      out.push([0, 1, 2, 3].map(k => (r + dr * k) * C4_W + c + dc * k));
    }
  return out;
}
const C4_RUNS = c4Lines();
function c4Result(b) {
  for (const l of C4_RUNS) if (b[l[0]] >= 0 && l.every(i => b[i] === b[l[0]])) return { winner: b[l[0]], line: l };
  return b.every(v => v >= 0) ? { winner: -1 } : null;
}
const c4Drop = (b, col) => { for (let r = C4_H - 1; r >= 0; r--) if (b[r * C4_W + col] < 0) return r * C4_W + col; return -1; };
function openConnectFour() {
  let holes = [], cols = [], lastDrop = -1, boardEl = null;
  return boardGame({
    key: 'c4', title: 'Connect Four', icon: I.connect4, w: 470, h: 500, sides: ['Red', 'Yellow'],
    init: () => ({ b: Array(C4_W * C4_H).fill(-1), last: -1 }),
    legal: (g, col) => Number.isInteger(col) && col >= 0 && col < C4_W && c4Drop(g.b, col) >= 0,
    apply: (g, col, side) => { const i = c4Drop(g.b, col); g.b[i] = side; g.last = i; return true; },
    result: g => c4Result(g.b),
    ai(g, side) { // looks 5 moves ahead and scores open runs
      const evalB = b => {
        let s = 0;
        for (const l of C4_RUNS) {
          let mine = 0, theirs = 0;
          for (const i of l) { if (b[i] === side) mine++; else if (b[i] === 1 - side) theirs++; }
          if (mine && !theirs) s += [0, 1, 4, 16][mine] || 0;
          if (theirs && !mine) s -= [0, 1, 5, 20][theirs] || 0;
        }
        for (let r = 0; r < C4_H; r++) { if (b[r * C4_W + 3] === side) s += 2; else if (b[r * C4_W + 3] === 1 - side) s -= 2; }
        return s;
      };
      const order = [3, 2, 4, 1, 5, 0, 6];
      const search = (b, turn, depth, a, z) => {
        const r = c4Result(b);
        if (r) return r.winner < 0 ? 0 : (r.winner === side ? 10000 + depth : -10000 - depth);
        if (!depth) return evalB(b);
        let best = turn === side ? -Infinity : Infinity;
        for (const c of order) {
          const i = c4Drop(b, c); if (i < 0) continue;
          b[i] = turn; const s = search(b, 1 - turn, depth - 1, a, z); b[i] = -1;
          if (turn === side) { best = Math.max(best, s); a = Math.max(a, s); } else { best = Math.min(best, s); z = Math.min(z, s); }
          if (z <= a) break;
        }
        return best;
      };
      let best = -1, bs = -Infinity;
      for (const c of shuffleBy([...order]).sort((x, y) => Math.abs(x - 3) - Math.abs(y - 3))) {
        const i = c4Drop(g.b, c); if (i < 0) continue;
        g.b[i] = side; const s = search(g.b, 1 - side, 5, -Infinity, Infinity); g.b[i] = -1;
        if (s > bs) { bs = s; best = c; }
      }
      return best;
    },
    mount(board, api) {
      boardEl = board;
      board.innerHTML = '<div class="c4-grid">' + Array.from({ length: C4_W }, (_, c) => `<div class="c4-col" data-c="${c}">` + '<div class="c4-h"><i></i></div>'.repeat(C4_H) + '</div>').join('') + '</div>';
      cols = [...board.querySelectorAll('.c4-col')];
      holes = Array(C4_W * C4_H);
      cols.forEach((col, c) => { [...col.children].forEach((h, r) => { holes[r * C4_W + c] = h; }); col.onclick = () => api.move(c); });
    },
    render(st, view) {
      const line = st.over && st.over.line || [];
      holes.forEach((h, i) => {
        const v = st.g.b[i];
        h.className = 'c4-h' + (v === 0 ? ' red' : v === 1 ? ' yel' : '') + (line.includes(i) ? ' win' : '');
        if (i === st.g.last && i !== lastDrop) { h.style.setProperty('--fall', Math.floor(i / C4_W) + 1); h.classList.add('c4-fall'); }
      });
      lastDrop = st.g.last;
      cols.forEach((col, c) => col.classList.toggle('can', view.mine && c4Drop(st.g.b, c) >= 0));
      boardEl.style.setProperty('--next', st.turn ? '#f5c518' : '#e23b3b');
    },
  });
}

/* checkers: side 0 (red) starts at the bottom and moves up. Captures are compulsory, several in a row are
   one turn, and a piece reaching the far row becomes a king. Cells: 0 empty, 1 red, 2 red king, 3 black, 4 black king */
const ck = { side: v => v ? (v < 3 ? 0 : 1) : -1, king: v => v === 2 || v === 4 };
function ckMoves(g, side) {
  const out = [], jumps = [], b = g.b;
  const from = g.chain != null ? [g.chain] : b.map((v, i) => ck.side(v) === side ? i : -1).filter(i => i >= 0);
  for (const f of from) {
    const r = f >> 3, c = f & 7, v = b[f], dirs = ck.king(v) ? [-1, 1] : [side ? 1 : -1];
    for (const dr of dirs) for (const dc of [-1, 1]) {
      const r1 = r + dr, c1 = c + dc, r2 = r + 2 * dr, c2 = c + 2 * dc;
      if (r1 < 0 || r1 > 7 || c1 < 0 || c1 > 7) continue;
      const mid = r1 * 8 + c1;
      if (!b[mid]) { if (g.chain == null) out.push({ f, t: mid }); }
      else if (ck.side(b[mid]) === 1 - side && r2 >= 0 && r2 <= 7 && c2 >= 0 && c2 <= 7 && !b[r2 * 8 + c2]) jumps.push({ f, t: r2 * 8 + c2, x: mid });
    }
  }
  return jumps.length ? jumps : out;
}
function ckApply(g, mv, side) { // true when the turn passes
  const v = g.b[mv.f]; g.b[mv.f] = 0; g.b[mv.t] = v;
  const lastRow = side ? 7 : 0, promoted = !ck.king(v) && (mv.t >> 3) === lastRow;
  if (promoted) g.b[mv.t] = v + 1;
  if (mv.x != null) {
    g.b[mv.x] = 0; g.quiet = 0;
    if (!promoted) { g.chain = mv.t; const more = ckMoves(g, side); if (more.length && more[0].x != null) return false; }
  } else g.quiet = (g.quiet || 0) + 1;
  g.chain = null;
  return true;
}
function openCheckers() {
  let sq = [], pick = null, lastSt = null, lastView = null;
  const findMove = (g, side, f, t) => ckMoves(g, side).find(m => m.f === f && m.t === t);
  return boardGame({
    key: 'ck', title: 'Checkers', icon: I.checkers, w: 470, h: 520, sides: ['Red', 'Black'],
    init: () => ({ b: Array.from({ length: 64 }, (_, i) => ((i >> 3) + (i & 7)) % 2 ? ((i >> 3) < 3 ? 3 : (i >> 3) > 4 ? 1 : 0) : 0), chain: null, quiet: 0 }),
    legal: (g, mv, side) => mv && typeof mv === 'object' && !!findMove(g, side, mv.f, mv.t),
    apply: (g, mv, side) => ckApply(g, findMove(g, side, mv.f, mv.t), side),
    result(g, turn) {
      if (!ckMoves(g, turn).length) return { winner: 1 - turn, text: 'no moves left' };
      return g.quiet >= 80 ? { winner: -1, text: 'Draw · 40 moves each without a capture' } : null;
    },
    ai(g, side) { // looks a few moves ahead; a chain of captures counts as one turn
      const val = b => b.reduce((s, v, i) => { // kings 5, men 3 plus a little for moving forward
        if (!v) return s;
        const w = ck.king(v) ? 5 : 3 + 0.05 * (ck.side(v) ? i >> 3 : 7 - (i >> 3));
        return s + (ck.side(v) === side ? w : -w);
      }, 0);
      const copy = g0 => ({ b: g0.b.slice(), chain: g0.chain, quiet: g0.quiet });
      const search = (g0, turn, depth, a, z) => {
        const ms = ckMoves(g0, turn);
        if (!ms.length) return turn === side ? -1000 - depth : 1000 + depth;
        if (!depth) return val(g0.b);
        let best = turn === side ? -Infinity : Infinity;
        for (const m of ms) {
          const g1 = copy(g0), passes = ckApply(g1, m, turn), next = passes ? 1 - turn : turn;
          const s = search(g1, next, passes ? depth - 1 : depth, a, z);
          if (turn === side) { best = Math.max(best, s); a = Math.max(a, s); } else { best = Math.min(best, s); z = Math.min(z, s); }
          if (z <= a) break;
        }
        return best;
      };
      let best = null, bs = -Infinity;
      for (const m of shuffleBy(ckMoves(g, side))) {
        const g1 = copy(g), passes = ckApply(g1, m, side);
        const s = search(g1, passes ? 1 - side : side, 4, -Infinity, Infinity);
        if (s > bs) { bs = s; best = m; }
      }
      return best && { f: best.f, t: best.t };
    },
    mount(board, api) {
      board.innerHTML = '<div class="ck-grid">' + '<div class="ck-s"><i></i></div>'.repeat(64) + '</div>';
      sq = [...board.querySelectorAll('.ck-s')];
      sq.forEach((s, k) => s.onclick = () => {
        const st = api.st, view = api.view(), i = s.dataset.i | 0;
        if (!view.mine || st.over) return;
        const side = st.turn;
        if (pick != null && findMove(st.g, side, pick, i)) { api.move({ f: pick, t: i }); pick = null; return; }
        pick = ckMoves(st.g, side).some(m => m.f === i) ? i : null;
        this.render(st, view);
      });
    },
    render(st, view) {
      lastSt = st; lastView = view;
      if (st.g.chain != null) pick = st.g.chain;
      if (pick != null && !view.mine) pick = null;
      const flip = view.side === 1, targets = pick != null && view.mine ? ckMoves(st.g, st.turn).filter(m => m.f === pick).map(m => m.t) : [];
      const movable = view.mine ? new Set(ckMoves(st.g, st.turn).map(m => m.f)) : new Set();
      sq.forEach((s, k) => {
        const i = flip ? 63 - k : k, v = st.g.b[i], dark = ((i >> 3) + (i & 7)) % 2;
        s.dataset.i = i;
        s.className = 'ck-s' + (dark ? ' dark' : '') + (i === pick ? ' pick' : '') + (targets.includes(i) ? ' to' : '') + (st.last && (st.last.f === i || st.last.t === i) ? ' last' : '') + (movable.has(i) ? ' can' : '');
        s.firstChild.className = v ? 'ck-p ' + (ck.side(v) ? 'black' : 'red') + (ck.king(v) ? ' king' : '') : '';
      });
    },
  });
}

/* chess: white (side 0) at the bottom. Squares 0-63, row 0 is the 8th rank. Pieces are letters, white in
   capitals (KQRBNP), black in lower case. Pawns promote to a queen. */
const CH_N = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const CH_K = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const CH_ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]], CH_BISHOP = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const chSide = p => !p ? -1 : p === p.toUpperCase() ? 0 : 1;
const chOf = (side, p) => side ? p.toLowerCase() : p;
const onB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
function chAttacked(b, sq, by) {
  const r = sq >> 3, c = sq & 7, pr = by ? r - 1 : r + 1;
  for (const dc of [-1, 1]) if (onB(pr, c + dc) && b[pr * 8 + c + dc] === chOf(by, 'P')) return true;
  for (const [dr, dc] of CH_N) if (onB(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === chOf(by, 'N')) return true;
  for (const [dr, dc] of CH_K) if (onB(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === chOf(by, 'K')) return true;
  for (const [dirs, kinds] of [[CH_ROOK, 'RQ'], [CH_BISHOP, 'BQ']])
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (onB(rr, cc)) {
        const p = b[rr * 8 + cc];
        if (p) { if (chSide(p) === by && kinds.includes(p.toUpperCase())) return true; break; }
        rr += dr; cc += dc;
      }
    }
  return false;
}
function chPseudo(g, side) {
  const b = g.b, out = [];
  for (let f = 0; f < 64; f++) {
    const p = b[f]; if (chSide(p) !== side) continue;
    const r = f >> 3, c = f & 7, k = p.toUpperCase();
    const add = (t, promo) => out.push(promo ? { f, t, p: 'Q' } : { f, t });
    if (k === 'P') {
      const dir = side ? 1 : -1, start = side ? 1 : 6, last = side ? 7 : 0, r1 = r + dir;
      if (onB(r1, c) && !b[r1 * 8 + c]) {
        add(r1 * 8 + c, r1 === last);
        if (r === start && !b[(r + 2 * dir) * 8 + c]) add((r + 2 * dir) * 8 + c);
      }
      for (const dc of [-1, 1]) {
        if (!onB(r1, c + dc)) continue;
        const t = r1 * 8 + c + dc;
        if (chSide(b[t]) === 1 - side || t === g.ep) add(t, r1 === last);
      }
    } else if (k === 'N' || k === 'K') {
      for (const [dr, dc] of k === 'N' ? CH_N : CH_K) if (onB(r + dr, c + dc) && chSide(b[(r + dr) * 8 + c + dc]) !== side) add((r + dr) * 8 + c + dc);
      if (k === 'K' && f === (side ? 4 : 60) && !chAttacked(b, f, 1 - side)) { // castling
        const [kSide, qSide] = side ? ['k', 'q'] : ['K', 'Q'];
        if (g.castle.includes(kSide) && !b[f + 1] && !b[f + 2] && b[f + 3] === chOf(side, 'R') && !chAttacked(b, f + 1, 1 - side) && !chAttacked(b, f + 2, 1 - side)) add(f + 2);
        if (g.castle.includes(qSide) && !b[f - 1] && !b[f - 2] && !b[f - 3] && b[f - 4] === chOf(side, 'R') && !chAttacked(b, f - 1, 1 - side) && !chAttacked(b, f - 2, 1 - side)) add(f - 2);
      }
    } else {
      const dirs = k === 'R' ? CH_ROOK : k === 'B' ? CH_BISHOP : [...CH_ROOK, ...CH_BISHOP];
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (onB(rr, cc)) {
          const t = rr * 8 + cc;
          if (chSide(b[t]) === side) break;
          add(t);
          if (b[t]) break;
          rr += dr; cc += dc;
        }
      }
    }
  }
  return out;
}
function chMake(g, m) {
  const b = g.b.slice(), p = b[m.f], side = chSide(p), k = p.toUpperCase();
  let castle = g.castle, captured = b[m.t];
  if (k === 'P' && m.t === g.ep && !captured) { captured = b[m.t + (side ? -8 : 8)]; b[m.t + (side ? -8 : 8)] = ''; } // en passant
  b[m.t] = m.p ? chOf(side, m.p) : p; b[m.f] = '';
  if (k === 'K' && Math.abs(m.t - m.f) === 2) { // castling moves the rook too
    const [rf, rt] = m.t > m.f ? [m.f + 3, m.f + 1] : [m.f - 4, m.f - 1];
    b[rt] = b[rf]; b[rf] = '';
  }
  if (k === 'K') castle = castle.replace(side ? /[kq]/g : /[KQ]/g, '');
  for (const [sq, right] of [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']]) if (m.f === sq || m.t === sq) castle = castle.replace(right, '');
  return { b, castle, ep: k === 'P' && Math.abs(m.t - m.f) === 16 ? (m.f + m.t) / 2 : -1, half: k === 'P' || captured ? 0 : g.half + 1 };
}
const chKing = (b, side) => b.indexOf(chOf(side, 'K'));
const chInCheck = (g, side) => chAttacked(g.b, chKing(g.b, side), 1 - side);
const chLegal = (g, side) => chPseudo(g, side).filter(m => { const n = chMake(g, m); return !chAttacked(n.b, chKing(n.b, side), 1 - side); });
const CH_VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
function chEval(b, side) { // material, plus a little for central squares and for pawns moving up
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i]; if (!p) continue;
    const k = p.toUpperCase(), ps = chSide(p), r = i >> 3, c = i & 7;
    let v = CH_VAL[k];
    if (k === 'N' || k === 'B') v += 12 - 4 * (Math.abs(3.5 - r) + Math.abs(3.5 - c)) / 2;
    if (k === 'P') v += 6 * (ps ? r - 1 : 6 - r) + (c >= 2 && c <= 5 ? 4 : 0);
    s += ps === side ? v : -v;
  }
  return s;
}
function chAi(g, side) {
  const order = (b, ms) => ms.sort((x, y) => (CH_VAL[(b[y.t] || 'P').toUpperCase()] * (b[y.t] ? 1 : 0)) - (CH_VAL[(b[x.t] || 'P').toUpperCase()] * (b[x.t] ? 1 : 0)));
  const search = (g0, turn, depth, a, z, ply) => {
    const ms = chLegal(g0, turn);
    if (!ms.length) return chInCheck(g0, turn) ? -100000 + ply : 0;
    if (!depth) return chEval(g0.b, turn);
    let best = -Infinity;
    for (const m of order(g0.b, ms)) {
      const s = -search(chMake(g0, m), 1 - turn, depth - 1, -z, -a, ply + 1);
      if (s > best) best = s;
      if (s > a) a = s;
      if (a >= z) break;
    }
    return best;
  };
  let best = null, bs = -Infinity;
  for (const m of order(g.b, shuffleBy(chLegal(g, side)))) {
    const s = -search(chMake(g, m), 1 - side, 2, -Infinity, -bs, 1);
    if (s > bs) { bs = s; best = m; }
  }
  return best;
}
const CH_GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
function openChess() {
  let sq = [], pick = null;
  const find = (g, side, mv) => chLegal(g, side).find(m => m.f === mv.f && m.t === mv.t);
  return boardGame({
    key: 'chess', title: 'Chess', icon: I.chess, w: 500, h: 560, sides: ['White', 'Black'],
    init: () => ({ b: [...'rnbqkbnr', ...'pppppppp', ...Array(32).fill(''), ...'PPPPPPPP', ...'RNBQKBNR'].map(x => x || ''), castle: 'KQkq', ep: -1, half: 0 }),
    legal: (g, mv, side) => mv && typeof mv === 'object' && !!find(g, side, mv),
    apply: (g, mv, side) => { Object.assign(g, chMake(g, find(g, side, mv))); return true; },
    check: (g, side) => chInCheck(g, side),
    result(g, turn) {
      if (!chLegal(g, turn).length) return chInCheck(g, turn) ? { winner: 1 - turn, text: 'checkmate' } : { winner: -1, text: 'Stalemate · draw' };
      if (g.half >= 100) return { winner: -1, text: 'Draw · 50 moves without a capture or pawn move' };
      const rest = g.b.filter(p => p && p.toUpperCase() !== 'K');
      if (rest.length <= 1 && rest.every(p => 'NB'.includes(p.toUpperCase()))) return { winner: -1, text: 'Draw · not enough pieces to checkmate' };
      return null;
    },
    ai: (g, side) => { const m = chAi(g, side); return m && { f: m.f, t: m.t }; },
    mount(board, api) {
      board.innerHTML = '<div class="ch-grid">' + '<div class="ch-s"><span></span><em></em></div>'.repeat(64) + '</div>';
      sq = [...board.querySelectorAll('.ch-s')];
      sq.forEach(s => s.onclick = () => {
        const st = api.st, view = api.view(), i = s.dataset.i | 0;
        if (!view.mine || st.over) return;
        if (pick != null && find(st.g, st.turn, { f: pick, t: i })) { api.move({ f: pick, t: i }); pick = null; return; }
        pick = chSide(st.g.b[i]) === st.turn ? i : null;
        this.render(st, view);
      });
    },
    render(st, view) {
      if (!view.mine) pick = null;
      const flip = view.side === 1, legal = view.mine ? chLegal(st.g, st.turn) : [];
      const targets = pick != null ? legal.filter(m => m.f === pick).map(m => m.t) : [];
      const checked = chInCheck(st.g, st.turn) ? chKing(st.g.b, st.turn) : -1;
      sq.forEach((s, k) => {
        const i = flip ? 63 - k : k, p = st.g.b[i], r = i >> 3, c = i & 7;
        s.dataset.i = i;
        s.className = 'ch-s' + ((r + c) % 2 ? ' dark' : '') + (i === pick ? ' pick' : '') + (targets.includes(i) ? (p ? ' to hit' : ' to') : '')
          + (st.last && (st.last.f === i || st.last.t === i) ? ' last' : '') + (i === checked ? ' check' : '');
        const span = s.firstChild;
        span.textContent = p ? CH_GLYPH[p.toUpperCase()] + '︎' : ''; // text style, never emoji
        span.className = p ? (chSide(p) ? 'bk' : 'wh') : '';
        s.lastChild.textContent = (k % 8 === 0 ? 8 - r : '') + (k >= 56 ? ' ' + 'abcdefgh'[c] : '');
      });
    },
  });
}

/* ---------- 2048 ---------- */
let g2048Win = null;
function open2048() {
  if (g2048Win) { focusWin(g2048Win); return g2048Win; }
  const W = makeWin({ title: '2048', icon: I.g2048, w: 380, h: 520 });
  W.body.innerHTML = '<div class="tz"><div class="tz-top"><div class="tz-box"><small>SCORE</small><b class="tz-score">0</b></div><div class="tz-box"><small>BEST</small><b class="tz-best">0</b></div><button class="okbtn tz-new">New game</button></div>'
    + '<div class="tz-board"><div class="tz-bg">' + '<i></i>'.repeat(16) + '</div><div class="tz-tiles"></div><div class="tz-note" hidden></div></div>'
    + '<div class="tz-help">Arrow keys, WASD or swipe</div></div>';
  const q = sel => W.body.querySelector(sel), tilesEl = q('.tz-tiles'), note = q('.tz-note');
  let st, best = store.get('2048-best', 0), nextId = 1;
  const els = new Map();
  const spawn = s => {
    const free = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!s.tiles.some(t => t.r === r && t.c === c)) free.push([r, c]);
    if (!free.length) return;
    const [r, c] = free[Math.floor(Math.random() * free.length)];
    s.tiles.push({ id: nextId++, v: Math.random() < 0.9 ? 2 : 4, r, c, born: 1 });
  };
  function newGame() { st = { tiles: [], score: 0, over: false, won: false, keep: false }; spawn(st); spawn(st); }
  const canMove = s => s.tiles.length < 16 || s.tiles.some(a => s.tiles.some(b => b.v === a.v && Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1));
  function slide(dir) { // 0 up, 1 right, 2 down, 3 left; true if anything moved
    const [dr, dc] = [[-1, 0], [0, 1], [1, 0], [0, -1]][dir];
    const grid = Array.from({ length: 4 }, () => Array(4).fill(null));
    st.tiles = st.tiles.filter(t => !t.gone);
    st.tiles.forEach(t => { t.born = 0; t.merged = 0; grid[t.r][t.c] = t; });
    const order = [0, 1, 2, 3], rows = dr > 0 ? [...order].reverse() : order, cols = dc > 0 ? [...order].reverse() : order;
    let moved = false;
    for (const r of rows) for (const c of cols) {
      const t = grid[r][c]; if (!t) continue;
      let nr = r, nc = c;
      while (true) {
        const rr = nr + dr, cc = nc + dc;
        if (rr < 0 || rr > 3 || cc < 0 || cc > 3) break;
        const o = grid[rr][cc];
        if (!o) { nr = rr; nc = cc; continue; }
        if (o.v === t.v && !o.merged) { // merge: this tile slides into o and disappears, o doubles
          grid[r][c] = null; t.r = rr; t.c = cc; t.gone = 1; o.v *= 2; o.merged = 1; st.score += o.v; moved = true;
          if (o.v === 2048 && !st.keep) st.won = true;
          nr = null;
        }
        break;
      }
      if (nr !== null && (nr !== r || nc !== c)) { grid[r][c] = null; grid[nr][nc] = t; t.r = nr; t.c = nc; moved = true; }
    }
    if (moved) { spawn(st); st.over = !canMove({ tiles: st.tiles.filter(t => !t.gone) }); }
    return moved;
  }
  function draw() {
    q('.tz-score').textContent = st.score;
    if (st.score > best) { best = st.score; store.set('2048-best', best); }
    q('.tz-best').textContent = best;
    const seen = new Set();
    st.tiles.forEach(t => {
      seen.add(t.id);
      let e = els.get(t.id);
      if (!e) { e = el('<div class="tz-t"></div>'); els.set(t.id, e); tilesEl.append(e); if (t.born) e.classList.add('born'); }
      e.textContent = t.v; e.dataset.v = Math.min(t.v, 4096);
      e.style.setProperty('--r', t.r); e.style.setProperty('--c', t.c);
      e.classList.toggle('merged', !!t.merged); e.style.zIndex = t.gone ? 1 : 2;
      if (t.gone) setTimeout(() => { e.remove(); els.delete(t.id); }, 130);
    });
    els.forEach((e, id) => { if (!seen.has(id)) { e.remove(); els.delete(id); } });
    note.hidden = !(st.over || (st.won && !st.keep));
    if (!note.hidden) {
      note.innerHTML = st.over ? '<b>Game over</b><button class="okbtn">Try again</button>' : '<b>You made 2048!</b><button class="okbtn">Keep going</button>';
      note.querySelector('button').onclick = () => st.over ? restart() : ask({ keep: 1 }, () => { st.keep = true; st.won = false; draw(); W.push(); });
    }
  }
  // in a room everyone plays one board: moves go to the opener's computer and the board comes back
  const ask = (d, fn) => { if (isLead(W)) fn(); else sendInput(W, d); };
  const move = dir => ask({ dir }, () => { if (st.over || (st.won && !st.keep)) return; if (slide(dir)) { draw(); W.push(); } });
  const restart = () => ask({ new: 1 }, () => { els.forEach(e => e.remove()); els.clear(); newGame(); draw(); W.push(); });
  W.onInput = d => { if (d.new) restart(); else if (d.keep) { st.keep = true; st.won = false; draw(); W.push(); } else if ([0, 1, 2, 3].includes(d.dir)) move(d.dir); };
  shareState(W, () => st, d => { st = d; nextId = Math.max(nextId, ...st.tiles.map(t => t.id + 1)); draw(); });
  q('.tz-new').onclick = restart;
  const KEYS = { ArrowUp: 0, w: 0, W: 0, ArrowRight: 1, d: 1, D: 1, ArrowDown: 2, s: 2, S: 2, ArrowLeft: 3, a: 3, A: 3 };
  const onKey = e => { if (!W.el.classList.contains('active') || !(e.key in KEYS) || e.target.matches?.('input, textarea')) return; e.preventDefault(); move(KEYS[e.key]); };
  document.addEventListener('keydown', onKey);
  const bd = q('.tz-board'); let sx = 0, sy = 0;
  bd.addEventListener('pointerdown', e => { sx = cX(e); sy = cY(e); });
  bd.addEventListener('pointerup', e => {
    const dx = cX(e) - sx, dy = cY(e) - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
  });
  W.onClose = () => { document.removeEventListener('keydown', onKey); g2048Win = null; };
  g2048Win = W;
  newGame(); draw();
  return W;
}

/* ---------- daily sudoku ---------- */
// Everyone gets the same puzzle each day (made from the date, like the daily Minesweeper board).
function sdSolve(grid, limit = 2) { // counts solutions up to `limit`; fills `grid` with the first one found
  const rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0), empty = [];
  for (let i = 0; i < 81; i++) {
    const v = grid[i], r = (i / 9) | 0, c = i % 9, bx = ((r / 3) | 0) * 3 + ((c / 3) | 0);
    if (v) { const m = 1 << v; rows[r] |= m; cols[c] |= m; boxes[bx] |= m; } else empty.push(i);
  }
  let count = 0, first = null;
  const go = k => {
    if (count >= limit) return;
    if (k === empty.length) { count++; if (!first) first = grid.slice(); return; }
    // fill the most constrained cell next
    let bi = k, bestOpts = 10;
    for (let j = k; j < empty.length; j++) {
      const i = empty[j], r = (i / 9) | 0, c = i % 9, used = rows[r] | cols[c] | boxes[((r / 3) | 0) * 3 + ((c / 3) | 0)];
      let n = 0; for (let v = 1; v <= 9; v++) if (!(used & (1 << v))) n++;
      if (n < bestOpts) { bestOpts = n; bi = j; if (n <= 1) break; }
    }
    [empty[k], empty[bi]] = [empty[bi], empty[k]];
    const i = empty[k], r = (i / 9) | 0, c = i % 9, bx = ((r / 3) | 0) * 3 + ((c / 3) | 0), used = rows[r] | cols[c] | boxes[bx];
    for (let v = 1; v <= 9; v++) {
      if (used & (1 << v)) continue;
      const m = 1 << v; grid[i] = v; rows[r] |= m; cols[c] |= m; boxes[bx] |= m;
      go(k + 1);
      grid[i] = 0; rows[r] &= ~m; cols[c] &= ~m; boxes[bx] &= ~m;
      if (count >= limit) break;
    }
    [empty[k], empty[bi]] = [empty[bi], empty[k]];
  };
  go(0);
  if (first) first.forEach((v, i) => { grid[i] = v; });
  return count;
}
function sdMake(seedText, keep = 30) { // a full random grid, then cells taken away while there's still exactly one solution
  const rnd = seededRandom(seedText), sol = Array(81).fill(0);
  const fill = i => {
    if (i === 81) return true;
    const r = (i / 9) | 0, c = i % 9;
    for (const v of shuffleBy([1, 2, 3, 4, 5, 6, 7, 8, 9], rnd)) {
      let ok = true;
      for (let k = 0; k < 9 && ok; k++) {
        if (sol[r * 9 + k] === v || sol[k * 9 + c] === v) ok = false;
        const br = ((r / 3) | 0) * 3 + ((k / 3) | 0), bc = ((c / 3) | 0) * 3 + k % 3;
        if (sol[br * 9 + bc] === v) ok = false;
      }
      if (!ok) continue;
      sol[i] = v; if (fill(i + 1)) return true; sol[i] = 0;
    }
    return false;
  };
  fill(0);
  const puzzle = sol.slice();
  let left = 81;
  for (const i of shuffleBy([...Array(81).keys()], rnd)) {
    if (left <= keep) break;
    const v = puzzle[i]; puzzle[i] = 0;
    if (sdSolve(puzzle.slice()) !== 1) puzzle[i] = v; else left--;
  }
  return { puzzle, sol };
}
let sdWin = null;
function openSudoku() {
  if (sdWin) { focusWin(sdWin); return sdWin; }
  const W = makeWin({ title: 'Sudoku', icon: I.sudoku, w: 420, h: 600 });
  W.body.innerHTML = '<div class="menu"></div><div class="sd"><div class="sd-top"><span class="sd-name"></span><span class="sd-time">0:00</span></div>'
    + '<div class="sd-grid">' + ('<div class="sd-c"><b></b><i>' + '<s></s>'.repeat(9) + '</i></div>').repeat(81) + '</div>'
    + '<div class="sd-pad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="sd-k" data-n="${n}">${n}</button>`).join('') + '<button class="sd-k sd-del" data-n="0" aria-label="Erase">⌫</button><button class="sd-k sd-notes" aria-pressed="false">Notes</button></div>'
    + '<div class="sd-note" hidden></div></div>';
  const q = sel => W.body.querySelector(sel), cells = [...W.body.querySelectorAll('.sd-c')], note = q('.sd-note');
  let st, sol = [], sel = -1, notesMode = false, timer = null;
  const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const elapsed = () => st.done ? st.time : st.t0 ? Math.floor((Date.now() - st.t0) / 1000) + (st.time || 0) : st.time || 0;
  function load(daily) {
    const day = dayKey(), seed = daily ? `sudoku|${day}` : `sudoku|free|${Math.random()}`;
    const { puzzle, sol: s } = sdMake(seed);
    sol = s;
    const saved = daily && store.get(`sudoku:${day}`);
    st = saved && saved.vals ? saved : { daily, day, seed, given: puzzle, vals: puzzle.slice(), notes: Array(81).fill(0), done: false, time: 0, t0: 0 };
    st.t0 = st.done ? 0 : Date.now(); sel = -1;
  }
  const save = () => { if (st.daily) store.set(`sudoku:${st.day}`, { ...st, time: elapsed(), t0: 0 }); };
  function conflicts() {
    const bad = new Set();
    for (let i = 0; i < 81; i++) {
      const v = st.vals[i]; if (!v) continue;
      const r = (i / 9) | 0, c = i % 9;
      for (let j = 0; j < 81; j++) {
        if (j === i || st.vals[j] !== v) continue;
        const r2 = (j / 9) | 0, c2 = j % 9;
        if (r2 === r || c2 === c || (((r2 / 3) | 0) === ((r / 3) | 0) && ((c2 / 3) | 0) === ((c / 3) | 0))) bad.add(i);
      }
    }
    return bad;
  }
  function draw() {
    q('.sd-name').textContent = st.daily ? `Daily Sudoku · ${st.day}` : 'Free play';
    const bad = conflicts(), sv = sel >= 0 ? st.vals[sel] : 0, sr = (sel / 9) | 0, sc = sel % 9;
    cells.forEach((cel, i) => {
      const v = st.vals[i], r = (i / 9) | 0, c = i % 9;
      cel.firstChild.textContent = v || '';
      [...cel.lastChild.children].forEach((s, k) => { s.textContent = !v && st.notes[i] & (1 << (k + 1)) ? k + 1 : ''; });
      cel.className = 'sd-c' + (st.given[i] ? ' given' : '') + (i === sel ? ' sel' : '')
        + (sel >= 0 && i !== sel && (r === sr || c === sc || (((r / 3) | 0) === ((sr / 3) | 0) && ((c / 3) | 0) === ((sc / 3) | 0))) ? ' near' : '')
        + (sv && v === sv ? ' same' : '') + (bad.has(i) ? ' bad' : '') + (c % 3 === 2 && c < 8 ? ' rb' : '') + (r % 3 === 2 && r < 8 ? ' bb' : '');
    });
    q('.sd-notes').classList.toggle('on', notesMode); q('.sd-notes').setAttribute('aria-pressed', notesMode);
    q('.sd-time').textContent = mmss(elapsed());
    note.hidden = !st.done;
    if (st.done) {
      const best = store.get('sudoku-best', null);
      note.innerHTML = `<b>Solved in ${mmss(st.time)}!</b>${st.daily ? `<span>Next daily puzzle in ${untilTomorrow()}</span>` : ''}${best != null ? `<span>Best: ${mmss(best)}</span>` : ''}<button class="okbtn">Close</button>`;
      note.querySelector('button').onclick = () => { note.hidden = true; };
    }
  }
  // in a room everyone fills the same grid: entries go to the opener's computer and the grid comes back
  const ask = (d, fn) => { if (isLead(W)) fn(); else sendInput(W, d); };
  function put(i, n, asNote) {
    if (st.done || i < 0 || i > 80 || st.given[i] || !(n >= 0 && n <= 9)) return;
    if (asNote && n) { if (!st.vals[i]) st.notes[i] ^= 1 << n; }
    else { st.vals[i] = n; if (n) st.notes[i] = 0; }
    if (st.vals.every((v, k) => v === sol[k])) {
      st.done = true; st.time = elapsed(); st.t0 = 0;
      const best = store.get('sudoku-best', null); if (best == null || st.time < best) store.set('sudoku-best', st.time);
    }
    save(); draw(); W.push();
  }
  const enter = n => { if (sel >= 0) ask({ put: [sel, n, notesMode] }, () => put(sel, n, notesMode)); };
  const newPuzzle = daily => ask({ fresh: daily ? 'daily' : 'free' }, () => { load(daily); draw(); W.push(); });
  W.onInput = d => { if (d.put) put(...d.put); else if (d.fresh) newPuzzle(d.fresh === 'daily'); };
  shareState(W, () => ({ ...st, time: elapsed(), t0: 0, sol }), d => { sol = d.sol; st = { ...d, t0: d.done ? 0 : Date.now() }; draw(); });
  cells.forEach((cel, i) => cel.onclick = () => { sel = i; draw(); });
  W.body.querySelectorAll('.sd-k[data-n]').forEach(b => b.onclick = () => enter(+b.dataset.n));
  q('.sd-notes').onclick = () => { notesMode = !notesMode; draw(); };
  const onKey = e => {
    if (!W.el.classList.contains('active') || e.ctrlKey || e.metaKey || e.target.matches?.('input, textarea')) return;
    if (/^[1-9]$/.test(e.key)) { e.preventDefault(); enter(+e.key); }
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { e.preventDefault(); enter(0); }
    else if (e.key === 'n' || e.key === 'N') { notesMode = !notesMode; draw(); }
    else if (e.key.startsWith('Arrow')) {
      e.preventDefault(); if (sel < 0) sel = 0;
      const r = (sel / 9) | 0, c = sel % 9, [dr, dc] = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      sel = ((r + dr + 9) % 9) * 9 + (c + dc + 9) % 9; draw();
    }
  };
  document.addEventListener('keydown', onKey);
  menuBar(W, q('.menu'), {
    Game: [['Daily puzzle', () => newPuzzle(true), () => st.daily], ['New random puzzle', () => newPuzzle(false), () => !st.daily], ['Close', () => closeWin(W)]],
  });
  const prev = W.onClose;
  W.onClose = () => { prev && prev(); document.removeEventListener('keydown', onKey); clearInterval(timer); if (st && !st.done) save(); sdWin = null; };
  timer = setInterval(() => { if (st && !st.done) q('.sd-time').textContent = mmss(elapsed()); }, 1000);
  sdWin = W;
  load(true); draw();
  return W;
}

/* ---------- pixel paint ---------- */
// A pixel-art editor. Pixels are stored as 0xRRGGBBAA numbers (0 = see-through), one array per animation frame.
const PX_PALETTES = {
  Classic: ['#000000', '#7f7f7f', '#c3c3c3', '#ffffff', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#b5e61d', '#00a2e8', '#99d9ea', '#3f48cc', '#7092be', '#a349a4', '#c8bfe7', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0'],
  'PICO-8': ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'],
  'Game Boy': ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  Endesga: ['#be4a2f', '#d77643', '#ead4aa', '#e4a672', '#b86f50', '#733e39', '#3e2731', '#a22633', '#e43b44', '#f77622', '#feae34', '#fee761', '#63c74d', '#3e8948', '#265c42', '#193c3e', '#124e89', '#0099db', '#2ce8f5', '#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466', '#262b44', '#181425', '#ff0044', '#68386c', '#b55088', '#f6757a', '#e8b796', '#c28569'],
};
const PX_TOOLS = [['pencil', '✏️', 'Pencil (B)', 'b'], ['eraser', '🧽', 'Eraser (E)', 'e'], ['dither', '▦', 'Dither brush: every other pixel (D)', 'd'], ['fill', '🪣', 'Fill (G) · Shift: every pixel of that color', 'g'],
  ['line', '╱', 'Line (L) · Shift: straight', 'l'], ['rect', '▭', 'Rectangle (R) · Shift: square', 'r'], ['ellipse', '◯', 'Ellipse (O) · Shift: circle', 'o'], ['picker', '💧', 'Color picker (I)', 'i'], ['select', '⬚', 'Select and move (M)', 'm']];
const pxPack = hex => ((parseInt(hex.slice(1, 7), 16) << 8) | 255) >>> 0;
const pxHex = c => '#' + (c >>> 8).toString(16).padStart(6, '0');
const pxB64 = a => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const pxUnB64 = (s, n) => { const b = atob(s), u = new Uint8Array(n * 4); for (let i = 0; i < u.length && i < b.length; i++) u[i] = b.charCodeAt(i); return new Uint32Array(u.buffer); };
function pxGif(frames, w, h, scale, delayCs) { // animated GIF with see-through pixels (its own small LZW encoder)
  const all = new Map([[0, 0]]); // color -> palette index; 0 is the see-through slot
  const key = c => (c & 0xff) < 128 ? 0 : (c | 0xff) >>> 0;
  let shift = 0;
  const reduce = c => { if (!c) return 0; if (!shift) return c; const m = (0xff << shift) & 0xff; return ((((c >>> 24) & m) << 24) | ((((c >>> 16) & 0xff) & m) << 16) | ((((c >>> 8) & 0xff) & m) << 8) | 0xff) >>> 0; };
  for (;;) { all.clear(); all.set(0, 0); for (const f of frames) for (const c of f) { const k = reduce(key(c)); if (!all.has(k)) all.set(k, all.size); } if (all.size <= 256 || shift >= 5) break; shift++; }
  let bits = 1; while ((1 << bits) < all.size) bits++;
  const out = [], W = w * scale, H = h * scale, word = v => out.push(v & 255, (v >> 8) & 255);
  out.push(...[...'GIF89a'].map(c => c.charCodeAt(0))); word(W); word(H); out.push(0xf0 | (bits - 1), 0, 0);
  const pal = Array(1 << bits).fill(0); all.forEach((i, c) => { pal[i] = c; });
  pal.forEach(c => out.push((c >>> 24) & 255, (c >>> 16) & 255, (c >>> 8) & 255));
  out.push(0x21, 0xff, 0x0b, ...[...'NETSCAPE2.0'].map(c => c.charCodeAt(0)), 3, 1, 0, 0, 0); // loop forever
  const minSize = Math.max(2, bits);
  for (const f of frames) {
    out.push(0x21, 0xf9, 4, (2 << 2) | 1); word(delayCs); out.push(0, 0); // clear before the next frame, index 0 see-through
    out.push(0x2c); word(0); word(0); word(W); word(H); out.push(0);
    const idx = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) idx[y * W + x] = all.get(reduce(key(f[((y / scale) | 0) * w + ((x / scale) | 0)]))) || 0;
    const data = [], clear = 1 << minSize, eoi = clear + 1;
    let size = minSize + 1, next = eoi + 1, table = new Map(), cur = 0, nb = 0;
    const emit = code => { cur |= code << nb; nb += size; while (nb >= 8) { data.push(cur & 255); cur >>>= 8; nb -= 8; } };
    emit(clear);
    let prefix = idx[0];
    for (let i = 1; i < idx.length; i++) {
      const k = idx[i], tk = prefix << 8 | k, code = table.get(tk);
      if (code !== undefined) { prefix = code; continue; }
      emit(prefix);
      if (next === 4096) { emit(clear); next = eoi + 1; size = minSize + 1; table = new Map(); }
      else { if (next >= (1 << size)) size++; table.set(tk, next++); }
      prefix = k;
    }
    emit(prefix); emit(eoi); if (nb > 0) data.push(cur & 255);
    out.push(minSize);
    for (let i = 0; i < data.length; i += 255) { const part = data.slice(i, i + 255); out.push(part.length, ...part); }
    out.push(0);
  }
  out.push(0x3b);
  return new Blob([new Uint8Array(out)], { type: 'image/gif' });
}
let pxWin = null;
function openPixelPaint() {
  if (pxWin) { focusWin(pxWin); return pxWin; }
  const W = makeWin({ title: 'Pixel Paint', icon: I.pixelpaint, w: 980, h: 680 });
  W.body.innerHTML = '<div class="menu"></div><div class="pxp">'
    + '<div class="pxp-tools"><div class="pxp-tg pxp-set"></div><div class="pxp-tg pxp-sizes"></div><div class="pxp-tg pxp-opts"></div></div>'
    + '<div class="pxp-mid"><div class="pxp-area"><div class="pxp-stage"><canvas class="pxp-c"></canvas><canvas class="pxp-o"></canvas><canvas class="pxp-ui"></canvas></div></div>'
    + '<div class="pxp-frames"><div class="pxp-fbtns"></div><div class="pxp-strip"></div></div></div>'
    + '<div class="pxp-side"><div class="pxp-cols"><button class="pxp-sw c1" title="Color 1 (left button)"></button><button class="pxp-sw c2" title="Color 2 (right button)"></button>'
    + '<button class="tbtn pxp-swap" title="Swap colors (X)">⇄</button></div><input type="color" class="pxp-custom" title="Pick any color for color 1" aria-label="Custom color">'
    + '<button class="tbtn pxp-clear-c" title="Make color 1 see-through">See-through</button>'
    + '<select class="pxp-palsel" aria-label="Palette"></select><div class="pxp-pal"></div><div class="pxp-recent"></div>'
    + '<h4>Preview</h4><canvas class="pxp-prev"></canvas></div>'
    + '<div class="pxp-dlg" hidden></div></div>'
    + '<div class="status"><span class="pxp-pos"></span><span class="pxp-dim"></span><span class="pxp-zoomt"></span></div>';
  const q = sel => W.body.querySelector(sel);
  const cv = q('.pxp-c'), ov = q('.pxp-o'), ui = q('.pxp-ui'), area = q('.pxp-area'), stage = q('.pxp-stage');
  const g = cv.getContext('2d'), go = ov.getContext('2d'), gu = ui.getContext('2d');
  // document
  let w = 32, h = 32, frames = [new Uint32Array(w * h)], cur = 0;
  let tool = 'pencil', brush = 1, mirrorX = false, mirrorY = false, filled = false, grid = true, onion = false, fps = 8, playing = false;
  let c1 = pxPack('#000000'), c2 = 0, zoom = 12, palName = 'Classic', recent = [];
  let sel = null, float = null, clip = null; // selection {x,y,w,h}; floating pixels {x,y,w,h,d}
  const undo = [], redo = [];
  const frame = () => frames[cur];
  // saving: kept in this browser; in a room every change is sent to the others
  const serialize = () => ({ w, h, frames: frames.map(pxB64), fps });
  function loadDoc(d) {
    if (!d || !d.w || !d.h || !Array.isArray(d.frames) || !d.frames.length) return;
    w = Math.max(1, Math.min(256, d.w | 0)); h = Math.max(1, Math.min(256, d.h | 0));
    frames = d.frames.map(s => pxUnB64(s, w * h)); fps = d.fps || fps; cur = Math.min(cur, frames.length - 1); sel = float = null;
  }
  let saveT = null;
  const saveLater = () => { clearTimeout(saveT); saveT = setTimeout(() => store.set('pixel-doc', serialize()), 400); };
  let pending = []; // pixel changes waiting to go out: [frame, index, color, ...]
  const flush = () => { if (pending.length) { W.push({ op: 'px', d: pending }); pending = []; } };
  function setPx(i, c, f = cur) { if (frames[f][i] === c) return; frames[f][i] = c; if (live()) pending.push(f, i, c); }
  const docChanged = () => { W.push({ doc: serialize() }); saveLater(); };
  function snap() { undo.push({ w, h, frames: frames.map(f => f.slice()), cur }); if (undo.length > 40) undo.shift(); redo.length = 0; }
  const restore = s => { w = s.w; h = s.h; frames = s.frames; cur = Math.min(s.cur, frames.length - 1); sel = float = null; fit(false); render(); docChanged(); };
  function doUndo() { commitFloat(); if (!undo.length) return; redo.push({ w, h, frames: frames.map(f => f.slice()), cur }); restore(undo.pop()); }
  function doRedo() { if (!redo.length) return; undo.push({ w, h, frames: frames.map(f => f.slice()), cur }); restore(redo.pop()); }

  // drawing helpers
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  function plot(x, y, c, dither) { // brush square, mirrored copies, dither skips every other pixel
    const o = Math.floor((brush - 1) / 2);
    for (let dy = 0; dy < brush; dy++) for (let dx = 0; dx < brush; dx++) {
      const px = x - o + dx, py = y - o + dy;
      for (const [mx, my] of [[px, py], ...(mirrorX ? [[w - 1 - px, py]] : []), ...(mirrorY ? [[px, h - 1 - py]] : []), ...(mirrorX && mirrorY ? [[w - 1 - px, h - 1 - py]] : [])]) {
        if (!inside(mx, my) || (dither && (mx + my) % 2)) continue;
        setPx(my * w + mx, c);
      }
    }
  }
  function line(x0, y0, x1, y1, fn) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) { fn(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  function shapePixels(kind, x0, y0, x1, y1, fill, fn) {
    if (kind === 'line') return line(x0, y0, x1, y1, fn);
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
    if (kind === 'rect') { for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) if (fill || x === ax || x === bx || y === ay || y === by) fn(x, y); return; }
    const cx = (ax + bx + 1) / 2, cy = (ay + by + 1) / 2, rx = (bx - ax + 1) / 2, ry = (by - ay + 1) / 2;
    const In = (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0001;
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) if (In(x, y) && (fill || !In(x - 1, y) || !In(x + 1, y) || !In(x, y - 1) || !In(x, y + 1))) fn(x, y);
  }
  function floodFill(x, y, c, everywhere) {
    const f = frame(), target = f[y * w + x];
    if (target === c) return;
    if (everywhere) { for (let i = 0; i < f.length; i++) if (f[i] === target) setPx(i, c); return; }
    const seen = new Uint8Array(w * h), stack = [y * w + x];
    while (stack.length) {
      const i = stack.pop(); if (seen[i]) continue; seen[i] = 1;
      if (f[i] !== target) continue;
      setPx(i, c);
      const px = i % w;
      if (px > 0) stack.push(i - 1); if (px < w - 1) stack.push(i + 1); if (i >= w) stack.push(i - w); if (i < w * (h - 1)) stack.push(i + w);
    }
  }
  // selection
  function lift() { // turn the selected area into floating pixels that can be moved
    if (!sel || float) return;
    snap();
    const d = new Uint32Array(sel.w * sel.h);
    for (let y = 0; y < sel.h; y++) for (let x = 0; x < sel.w; x++) { const i = (sel.y + y) * w + sel.x + x; d[y * sel.w + x] = frame()[i]; setPx(i, 0); }
    float = { x: sel.x, y: sel.y, w: sel.w, h: sel.h, d };
  }
  function commitFloat() {
    if (!float) return;
    for (let y = 0; y < float.h; y++) for (let x = 0; x < float.w; x++) {
      const c = float.d[y * float.w + x], px = float.x + x, py = float.y + y;
      if (c && inside(px, py)) setPx(py * w + px, c);
    }
    sel = { x: float.x, y: float.y, w: float.w, h: float.h }; float = null;
    flush(); saveLater(); render();
  }
  const selRegion = () => sel ? sel : { x: 0, y: 0, w, h };
  function copySel() {
    if (float) { clip = { w: float.w, h: float.h, d: float.d.slice() }; return; }
    const r = selRegion(), d = new Uint32Array(r.w * r.h);
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) d[y * r.w + x] = frame()[(r.y + y) * w + r.x + x];
    clip = { w: r.w, h: r.h, d };
  }
  function deleteSel() {
    if (float) { float = null; sel = null; render(); return; }
    snap(); const r = selRegion();
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) setPx((r.y + y) * w + r.x + x, 0);
    flush(); saveLater(); render();
  }
  function paste() {
    if (!clip) return;
    commitFloat(); snap();
    const x = sel ? sel.x : 0, y = sel ? sel.y : 0;
    float = { x, y, w: clip.w, h: clip.h, d: clip.d.slice() }; sel = { x, y, w: clip.w, h: clip.h };
    setTool('select'); render();
  }
  function transform(kind) { // flip/rotate the floating selection, or the whole picture
    if (sel && !float) lift();
    if (float) {
      const { w: fw, h: fh, d } = float, n = new Uint32Array(fw * fh);
      if (kind === 'rot') { for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) n[x * fh + (fh - 1 - y)] = d[y * fw + x]; float.w = fh; float.h = fw; }
      else for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) n[y * fw + x] = kind === 'h' ? d[y * fw + fw - 1 - x] : d[(fh - 1 - y) * fw + x];
      float.d = n; sel = { x: float.x, y: float.y, w: float.w, h: float.h }; render(); return;
    }
    snap();
    if (kind === 'rot') { // all frames turn, and the canvas swaps width and height
      frames = frames.map(f => { const n = new Uint32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) n[x * h + (h - 1 - y)] = f[y * w + x]; return n; });
      [w, h] = [h, w]; fit(false); render(); docChanged(); return;
    }
    const f = frame(), n = f.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) setPx(y * w + x, kind === 'h' ? n[y * w + w - 1 - x] : n[(h - 1 - y) * w + x]);
    flush(); saveLater(); render();
  }

  // drawing on screen
  const toImage = f => { const im = new ImageData(w, h), u = new Uint32Array(im.data.buffer); for (let i = 0; i < f.length; i++) { const c = f[i]; u[i] = ((c & 0xff) << 24 | ((c >>> 8) & 0xff) << 16 | ((c >>> 16) & 0xff) << 8 | (c >>> 24)) >>> 0; } return im; };
  const tmp = document.createElement('canvas');
  function drawFrameTo(ctx, f, alpha = 1) { tmp.width = w; tmp.height = h; tmp.getContext('2d').putImageData(toImage(f), 0, 0); ctx.globalAlpha = alpha; ctx.drawImage(tmp, 0, 0); ctx.globalAlpha = 1; }
  let preview = null; // shape being dragged: list of pixels for the overlay
  function render() {
    if (cv.width !== w || cv.height !== h) { [cv, ov].forEach(c => { c.width = w; c.height = h; }); }
    const W2 = w * zoom, H2 = h * zoom;
    [cv, ov].forEach(c => { c.style.width = W2 + 'px'; c.style.height = H2 + 'px'; });
    stage.style.width = W2 + 'px'; stage.style.height = H2 + 'px';
    g.clearRect(0, 0, w, h);
    if (onion && frames.length > 1) drawFrameTo(g, frames[(cur - 1 + frames.length) % frames.length], 0.3);
    drawFrameTo(g, frame());
    go.clearRect(0, 0, w, h);
    if (float) { const im = new ImageData(float.w, float.h), u = new Uint32Array(im.data.buffer); float.d.forEach((c, i) => { u[i] = ((c & 0xff) << 24 | ((c >>> 8) & 0xff) << 16 | ((c >>> 16) & 0xff) << 8 | (c >>> 24)) >>> 0; }); tmp.width = float.w; tmp.height = float.h; tmp.getContext('2d').putImageData(im, 0, 0); go.drawImage(tmp, float.x, float.y); }
    if (preview) { go.fillStyle = preview.c ? pxHex(preview.c) : 'rgba(255,255,255,.7)'; preview.px.forEach(([x, y]) => go.fillRect(x, y, 1, 1)); }
    drawUi();
    q('.pxp-dim').textContent = `${w} × ${h}px · frame ${cur + 1}/${frames.length}`;
    q('.pxp-zoomt').textContent = `${Math.round(zoom * 100)}%`;
    renderFrames(); drawPreview();
  }
  let hover = null;
  function drawUi() { // grid, selection outline and the brush outline, at screen resolution
    const W2 = w * zoom, H2 = h * zoom, big = W2 * H2 <= 16e6;
    ui.style.width = W2 + 'px'; ui.style.height = H2 + 'px';
    if (!big) { ui.width = ui.height = 0; return; }
    if (ui.width !== W2 || ui.height !== H2) { ui.width = W2; ui.height = H2; }
    gu.clearRect(0, 0, W2, H2);
    if (grid && zoom >= 4) {
      gu.strokeStyle = 'rgba(0,0,0,.18)'; gu.lineWidth = 1; gu.beginPath();
      for (let x = 1; x < w; x++) { gu.moveTo(x * zoom + 0.5, 0); gu.lineTo(x * zoom + 0.5, H2); }
      for (let y = 1; y < h; y++) { gu.moveTo(0, y * zoom + 0.5); gu.lineTo(W2, y * zoom + 0.5); }
      gu.stroke();
      if (w % 8 === 0 && h % 8 === 0 && w > 16) { gu.strokeStyle = 'rgba(0,0,0,.32)'; gu.beginPath(); for (let x = 8; x < w; x += 8) { gu.moveTo(x * zoom + 0.5, 0); gu.lineTo(x * zoom + 0.5, H2); } for (let y = 8; y < h; y += 8) { gu.moveTo(0, y * zoom + 0.5); gu.lineTo(W2, y * zoom + 0.5); } gu.stroke(); }
    }
    if (mirrorX) { gu.strokeStyle = 'rgba(232,68,90,.8)'; gu.beginPath(); gu.moveTo(W2 / 2, 0); gu.lineTo(W2 / 2, H2); gu.stroke(); }
    if (mirrorY) { gu.strokeStyle = 'rgba(232,68,90,.8)'; gu.beginPath(); gu.moveTo(0, H2 / 2); gu.lineTo(W2, H2 / 2); gu.stroke(); }
    const s = float || sel;
    if (s) {
      gu.setLineDash([4, 3]); gu.lineDashOffset = -(performance.now() / 60 | 0) % 7;
      gu.strokeStyle = '#000'; gu.strokeRect(s.x * zoom + 0.5, s.y * zoom + 0.5, s.w * zoom - 1, s.h * zoom - 1);
      gu.strokeStyle = '#fff'; gu.lineDashOffset += 3.5; gu.strokeRect(s.x * zoom + 0.5, s.y * zoom + 0.5, s.w * zoom - 1, s.h * zoom - 1);
      gu.setLineDash([]);
    }
    if (hover && ['pencil', 'eraser', 'dither'].includes(tool)) {
      const o = Math.floor((brush - 1) / 2);
      gu.strokeStyle = 'rgba(255,255,255,.9)'; gu.strokeRect((hover[0] - o) * zoom + 0.5, (hover[1] - o) * zoom + 0.5, brush * zoom - 1, brush * zoom - 1);
      gu.strokeStyle = 'rgba(0,0,0,.6)'; gu.strokeRect((hover[0] - o) * zoom - 0.5, (hover[1] - o) * zoom - 0.5, brush * zoom + 1, brush * zoom + 1);
    }
  }
  const ants = setInterval(() => { if (sel || float) drawUi(); }, 120); // marching ants
  function fit(center = true) { // biggest whole-number zoom that shows the whole picture
    const aw = area.clientWidth - 24, ah = area.clientHeight - 24;
    if (aw > 0 && ah > 0) zoom = Math.max(1, Math.min(48, Math.floor(Math.min(aw / w, ah / h))));
    if (center) render();
  }
  function setZoom(z, cx, cy) {
    const r = lrect(area), ox = (cx ?? r.left + r.width / 2) - r.left, oy = (cy ?? r.top + r.height / 2) - r.top;
    const px0 = (area.scrollLeft + ox - stage.offsetLeft) / zoom, py0 = (area.scrollTop + oy - stage.offsetTop) / zoom;
    zoom = Math.max(1, Math.min(64, z)); render();
    area.scrollLeft = px0 * zoom + stage.offsetLeft - ox; area.scrollTop = py0 * zoom + stage.offsetTop - oy;
  }
  const zoomStep = (dir, cx, cy) => { const steps = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64]; const i = steps.findIndex(s => s >= zoom); setZoom(steps[Math.max(0, Math.min(steps.length - 1, (steps[i] === zoom ? i : i - (dir > 0 ? 1 : 0)) + dir))], cx, cy); };

  // frames strip and preview
  function renderFrames() {
    const strip = q('.pxp-strip');
    while (strip.children.length > frames.length) strip.lastChild.remove();
    while (strip.children.length < frames.length) { const b = el('<button class="pxp-thumb"><canvas></canvas><span></span></button>'); strip.append(b); }
    [...strip.children].forEach((b, i) => {
      b.classList.toggle('on', i === cur); b.onclick = () => { commitFloat(); cur = i; render(); };
      const c = b.firstChild, s = Math.max(1, Math.floor(44 / Math.max(w, h)));
      c.width = w; c.height = h; c.style.width = w * s + 'px'; c.style.height = h * s + 'px';
      c.getContext('2d').clearRect(0, 0, w, h); drawFrameTo(c.getContext('2d'), frames[i]);
      b.lastChild.textContent = i + 1;
    });
    q('.pxp-play').textContent = playing ? '■ Stop' : '▶ Play';
    q('.pxp-onion').classList.toggle('on', onion);
  }
  const prev = q('.pxp-prev'); let pf = 0, pt = 0;
  function drawPreview() {
    const s = Math.max(1, Math.floor(150 / Math.max(w, h)));
    prev.width = w; prev.height = h; prev.style.width = w * s + 'px'; prev.style.height = h * s + 'px';
    const pc = prev.getContext('2d'); pc.clearRect(0, 0, w, h); drawFrameTo(pc, frames[playing ? pf % frames.length : cur]);
  }
  const anim = setInterval(() => { if (!playing) return; pt++; if (pt >= Math.max(1, Math.round(60 / fps / (60 / 30)))) { pt = 0; pf = (pf + 1) % frames.length; drawPreview(); } }, 1000 / 30);

  // tool bar
  const btn = (cls, html, title, fn) => { const b = el(`<button class="${cls}"></button>`); b.innerHTML = html; b.title = title; b.setAttribute('aria-label', title); b.onclick = fn; return b; };
  const toolBtns = PX_TOOLS.map(([id, icon, title]) => { const b = btn('pt-b', esc(icon), title, () => setTool(id)); b.dataset.t = id; return b; });
  q('.pxp-set').append(...toolBtns);
  const sizeBtns = [1, 2, 3].map(n => { const b = btn('pt-b', `<i style="width:${n * 3 + 1}px;height:${n * 3 + 1}px"></i>`, `Brush ${n}px ([ and ])`, () => { brush = n; refresh(); }); b.dataset.s = n; return b; });
  q('.pxp-sizes').append(...sizeBtns);
  const optBtns = {
    mx: btn('pt-b', '⇹', 'Mirror left/right', () => { mirrorX = !mirrorX; refresh(); render(); }),
    my: btn('pt-b', '⤒', 'Mirror top/bottom', () => { mirrorY = !mirrorY; refresh(); render(); }),
    fill: btn('pt-b', '■', 'Filled rectangles and ellipses', () => { filled = !filled; refresh(); }),
    grid: btn('pt-b', '#', 'Pixel grid', () => { grid = !grid; refresh(); render(); }),
  };
  q('.pxp-opts').append(...Object.values(optBtns));
  function setTool(t) { if (t !== 'select') commitFloat(); if (t !== 'select' && !float) sel = null; tool = t; refresh(); render(); }
  function refresh() {
    toolBtns.forEach(b => b.classList.toggle('on', b.dataset.t === tool));
    sizeBtns.forEach(b => b.classList.toggle('on', +b.dataset.s === brush));
    optBtns.mx.classList.toggle('on', mirrorX); optBtns.my.classList.toggle('on', mirrorY); optBtns.fill.classList.toggle('on', filled); optBtns.grid.classList.toggle('on', grid);
    const sw = (e, c) => { e.style.background = c ? pxHex(c) : ''; e.classList.toggle('clear', !c); };
    sw(q('.c1'), c1); sw(q('.c2'), c2);
    cv.style.cursor = tool === 'select' ? 'move' : tool === 'picker' || tool === 'fill' ? 'pointer' : 'crosshair';
    ui.style.cursor = cv.style.cursor;
    const pal = q('.pxp-pal'); pal.replaceChildren(...PX_PALETTES[palName].map(hex => colorBtn(pxPack(hex))));
    q('.pxp-recent').replaceChildren(...recent.map(colorBtn));
  }
  function colorBtn(c) {
    const b = el('<button class="pxp-pc"></button>'); b.style.background = pxHex(c); b.title = pxHex(c) + ' (left: color 1, right: color 2)';
    b.onclick = () => { c1 = c; refresh(); }; b.oncontextmenu = e => { e.preventDefault(); c2 = c; refresh(); };
    return b;
  }
  const remember = c => { if (!c || PX_PALETTES[palName].some(h => pxPack(h) === c)) return; recent = [c, ...recent.filter(x => x !== c)].slice(0, 12); };
  const palSel = q('.pxp-palsel'); palSel.innerHTML = Object.keys(PX_PALETTES).map(n => `<option>${esc(n)}</option>`).join('');
  palSel.onchange = () => { palName = palSel.value; refresh(); };
  q('.pxp-custom').oninput = e => { c1 = pxPack(e.target.value); refresh(); };
  q('.pxp-custom').onchange = () => { remember(c1); refresh(); };
  q('.pxp-swap').onclick = () => { [c1, c2] = [c2, c1]; refresh(); };
  q('.pxp-clear-c').onclick = () => { c1 = 0; refresh(); };
  q('.c1').onclick = () => q('.pxp-custom').click();
  q('.pxp-fbtns').append(
    btn('tbtn', '＋ Frame', 'Add an empty frame', () => { commitFloat(); snap(); frames.splice(cur + 1, 0, new Uint32Array(w * h)); cur++; render(); docChanged(); }),
    btn('tbtn', '⧉ Copy', 'Duplicate this frame', () => { commitFloat(); snap(); frames.splice(cur + 1, 0, frame().slice()); cur++; render(); docChanged(); }),
    btn('tbtn', '🗑', 'Delete this frame', () => { if (frames.length < 2) return; snap(); frames.splice(cur, 1); cur = Math.min(cur, frames.length - 1); render(); docChanged(); }),
    btn('tbtn', '◀', 'Move frame left', () => { if (cur < 1) return; snap(); [frames[cur - 1], frames[cur]] = [frames[cur], frames[cur - 1]]; cur--; render(); docChanged(); }),
    btn('tbtn', '▶', 'Move frame right', () => { if (cur >= frames.length - 1) return; snap(); [frames[cur + 1], frames[cur]] = [frames[cur], frames[cur + 1]]; cur++; render(); docChanged(); }),
    btn('tbtn pxp-onion', 'Onion skin', 'Show the previous frame faintly', () => { onion = !onion; render(); }),
    btn('tbtn pxp-play', '▶ Play', 'Play the animation in the preview', () => { playing = !playing; pf = cur; render(); }),
  );
  const fpsIn = el('<label class="pxp-fps">FPS <input type="number" min="1" max="30"></label>'); fpsIn.firstElementChild.value = fps;
  fpsIn.firstElementChild.onchange = e => { fps = Math.max(1, Math.min(30, +e.target.value || 8)); e.target.value = fps; docChanged(); };
  q('.pxp-fbtns').append(fpsIn);

  // pointer: left draws color 1, right color 2; middle button or Space+drag pans; wheel zooms
  const at = e => { const r = lrect(cv); return [Math.floor((cX(e) - r.left) / r.width * w), Math.floor((cY(e) - r.top) / r.height * h)]; };
  let drag = null, spaceDown = false;
  ui.addEventListener('contextmenu', e => e.preventDefault());
  ui.addEventListener('pointerdown', e => {
    if (e.button === 1 || spaceDown) { drag = { pan: true, x: cX(e), y: cY(e), sl: area.scrollLeft, st: area.scrollTop }; ui.setPointerCapture(e.pointerId); return; }
    if (e.button !== 0 && e.button !== 2) return;
    const [x, y] = at(e), color = e.button === 2 ? c2 : c1;
    ui.setPointerCapture(e.pointerId);
    if (tool === 'picker') { if (inside(x, y)) { const c = frame()[y * w + x]; if (e.button === 2) c2 = c; else c1 = c; remember(c); refresh(); } return; }
    if (tool === 'select') {
      if (float && x >= float.x && y >= float.y && x < float.x + float.w && y < float.y + float.h) { drag = { move: true, ox: x - float.x, oy: y - float.y }; return; }
      if (sel && !float && x >= sel.x && y >= sel.y && x < sel.x + sel.w && y < sel.y + sel.h) { lift(); drag = { move: true, ox: x - float.x, oy: y - float.y }; render(); return; }
      commitFloat(); sel = null; drag = { select: true, x0: x, y0: y }; render(); return;
    }
    if (!inside(x, y) && tool === 'fill') return;
    snap(); remember(color);
    if (tool === 'fill') { floodFill(x, y, color, e.shiftKey); flush(); saveLater(); render(); return; }
    if (['pencil', 'eraser', 'dither'].includes(tool)) {
      const c = tool === 'eraser' ? 0 : color;
      drag = { paint: true, lx: x, ly: y, c };
      plot(x, y, c, tool === 'dither'); render(); return;
    }
    drag = { shape: tool, x0: x, y0: y, c: color };
  });
  ui.addEventListener('pointermove', e => {
    const [x, y] = at(e);
    hover = inside(x, y) ? [x, y] : null;
    q('.pxp-pos').textContent = hover ? `${x}, ${y}` : '';
    if (!drag) { drawUi(); return; }
    if (drag.pan) { area.scrollLeft = drag.sl - (cX(e) - drag.x); area.scrollTop = drag.st - (cY(e) - drag.y); return; }
    if (drag.paint) { line(drag.lx, drag.ly, x, y, (px, py) => plot(px, py, drag.c, tool === 'dither')); drag.lx = x; drag.ly = y; render(); if (pending.length > 600) flush(); return; }
    if (drag.move) { float.x = x - drag.ox; float.y = y - drag.oy; sel = { x: float.x, y: float.y, w: float.w, h: float.h }; render(); return; }
    let x1 = x, y1 = y;
    const x0 = drag.x0, y0 = drag.y0;
    if (e.shiftKey && drag.shape) { // straight lines; squares and circles
      if (drag.shape === 'line') { const dx = x - x0, dy = y - y0, adx = Math.abs(dx), ady = Math.abs(dy); if (adx > 2 * ady) y1 = y0; else if (ady > 2 * adx) x1 = x0; else { const m = Math.max(adx, ady); x1 = x0 + Math.sign(dx) * m; y1 = y0 + Math.sign(dy) * m; } }
      else { const m = Math.max(Math.abs(x - x0), Math.abs(y - y0)); x1 = x0 + Math.sign(x - x0 || 1) * m; y1 = y0 + Math.sign(y - y0 || 1) * m; }
    }
    drag.x1 = x1; drag.y1 = y1;
    if (drag.select) {
      const ax = Math.max(0, Math.min(x0, x1)), ay = Math.max(0, Math.min(y0, y1)), bx = Math.min(w - 1, Math.max(x0, x1)), by = Math.min(h - 1, Math.max(y0, y1));
      sel = bx >= ax && by >= ay ? { x: ax, y: ay, w: bx - ax + 1, h: by - ay + 1 } : null; drawUi(); return;
    }
    const px = []; shapePixels(drag.shape, x0, y0, x1, y1, filled, (a, b) => { if (inside(a, b)) px.push([a, b]); });
    preview = { px, c: drag.c }; render();
  });
  const up = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.shape) {
      preview = null;
      shapePixels(d.shape, d.x0, d.y0, d.x1 ?? d.x0, d.y1 ?? d.y0, filled, (a, b) => plot(a, b, d.c, false)); // uses the brush size as line width
    }
    if (d.select && sel && sel.w * sel.h <= 1 && d.x1 == null) sel = null;
    flush(); saveLater(); render();
  };
  ui.addEventListener('pointerup', up); ui.addEventListener('pointercancel', up);
  ui.addEventListener('pointerleave', () => { hover = null; drawUi(); });
  area.addEventListener('wheel', e => { e.preventDefault(); zoomStep(e.deltaY < 0 ? 1 : -1, cX(e), cY(e)); }, { passive: false });

  // keys (only while this window is the active one)
  const KEYTOOLS = Object.fromEntries(PX_TOOLS.map(t => [t[3], t[0]]));
  const onKey = e => {
    if (!W.el.classList.contains('active') || e.target.matches?.('input, select, textarea')) return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (e.key === ' ') { spaceDown = e.type === 'keydown'; ui.style.cursor = spaceDown ? 'grab' : cv.style.cursor; e.preventDefault(); return; }
    if (e.type !== 'keydown') return;
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
    else if (mod && k === 'y') { e.preventDefault(); doRedo(); }
    else if (mod && k === 'c') { e.preventDefault(); copySel(); }
    else if (mod && k === 'x') { e.preventDefault(); copySel(); deleteSel(); }
    else if (mod && k === 'v') { e.preventDefault(); paste(); }
    else if (mod && k === 'a') { e.preventDefault(); commitFloat(); sel = { x: 0, y: 0, w, h }; setTool('select'); }
    else if (mod) return;
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); }
    else if (e.key === 'Escape') { commitFloat(); sel = null; render(); }
    else if (e.key === 'Enter') commitFloat();
    else if (KEYTOOLS[k]) setTool(KEYTOOLS[k]);
    else if (k === 'x') { [c1, c2] = [c2, c1]; refresh(); }
    else if (k === '[' || k === ']') { brush = Math.max(1, Math.min(3, brush + (k === ']' ? 1 : -1))); refresh(); }
    else if (k === '+' || k === '=') zoomStep(1); else if (k === '-') zoomStep(-1);
    else if (e.key === 'ArrowLeft' || e.key === ',') { commitFloat(); cur = (cur - 1 + frames.length) % frames.length; render(); }
    else if (e.key === 'ArrowRight' || e.key === '.') { commitFloat(); cur = (cur + 1) % frames.length; render(); }
  };
  document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);

  // dialogs: new / canvas size / export
  const dlg = q('.pxp-dlg');
  function dialog(html, onOk) {
    dlg.innerHTML = `<form class="pxp-box">${html}<div class="pxp-dbtns"><button type="button" class="okbtn pxp-cancel">Cancel</button><button class="okbtn">OK</button></div></form>`;
    dlg.hidden = false;
    const f = dlg.firstChild;
    f.querySelector('.pxp-cancel').onclick = () => { dlg.hidden = true; };
    f.onsubmit = e => { e.preventDefault(); if (onOk(f) !== false) dlg.hidden = true; };
    f.querySelectorAll('[data-wh]').forEach(b => b.onclick = () => { const [a, c] = b.dataset.wh.split('x'); f.w.value = a; f.h.value = c; });
    const first = f.querySelector('input, select'); if (first) first.focus();
  }
  const sizeFields = (a, b) => `<div class="pxp-row">Width <input name="w" type="number" min="1" max="256" value="${a}"> Height <input name="h" type="number" min="1" max="256" value="${b}"></div>`
    + '<div class="pxp-row">' + [8, 16, 24, 32, 48, 64, 128].map(n => `<button type="button" class="tbtn" data-wh="${n}x${n}">${n}×${n}</button>`).join('') + '</div>';
  const clampSize = v => Math.max(1, Math.min(256, v | 0 || 32));
  function newPicture() {
    dialog('<h3>New picture</h3>' + sizeFields(w, h) + '<p class="dim">This replaces the current picture (Undo brings it back).</p>', f => {
      snap(); w = clampSize(f.w.value); h = clampSize(f.h.value); frames = [new Uint32Array(w * h)]; cur = 0; sel = float = null;
      fit(false); render(); docChanged();
    });
  }
  function canvasSize() {
    dialog('<h3>Canvas size</h3>' + sizeFields(w, h) + '<div class="pxp-row">Keep picture at <select name="anchor"><option value="tl">top left</option><option value="c">center</option></select></div>', f => {
      const nw = clampSize(f.w.value), nh = clampSize(f.h.value), ox = f.anchor.value === 'c' ? Math.floor((nw - w) / 2) : 0, oy = f.anchor.value === 'c' ? Math.floor((nh - h) / 2) : 0;
      snap(); commitFloat();
      frames = frames.map(fr => { const n = new Uint32Array(nw * nh); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const X = x + ox, Y = y + oy; if (X >= 0 && Y >= 0 && X < nw && Y < nh) n[Y * nw + X] = fr[y * w + x]; } return n; });
      w = nw; h = nh; sel = null; fit(false); render(); docChanged();
    });
  }
  const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  function exportDialog() {
    commitFloat();
    dialog('<h3>Export</h3><div class="pxp-row"><label><input type="radio" name="kind" value="png" checked> PNG of this frame</label></div>'
      + '<div class="pxp-row"><label><input type="radio" name="kind" value="sheet"> Sprite sheet (all frames in a row)</label></div>'
      + `<div class="pxp-row"><label><input type="radio" name="kind" value="gif"${frames.length > 1 ? '' : ' disabled'}> Animated GIF (${frames.length} frame${frames.length > 1 ? 's' : ''}, ${fps} FPS)</label></div>`
      + '<div class="pxp-row">Size <select name="scale">' + [1, 2, 4, 8, 16, 32].map(s => `<option value="${s}"${s === 8 ? ' selected' : ''}>${s}× (${w * s} × ${h * s})</option>`).join('') + '</select></div>', f => {
      const s = +f.scale.value, kind = f.kind.value;
      if (kind === 'gif') { download(pxGif(frames, w, h, s, Math.round(100 / fps)), 'pixel-art.gif'); return; }
      const list = kind === 'sheet' ? frames : [frame()], c = document.createElement('canvas');
      c.width = w * s * list.length; c.height = h * s;
      const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false;
      list.forEach((fr, i) => { tmp.width = w; tmp.height = h; tmp.getContext('2d').putImageData(toImage(fr), 0, 0); cc.drawImage(tmp, i * w * s, 0, w * s, h * s); });
      c.toBlob(b => download(b, kind === 'sheet' ? 'sprite-sheet.png' : 'pixel-art.png'));
    });
  }
  function importImage() { // any picture, squeezed into the canvas size and turned into pixels
    const inp = el('<input type="file" accept="image/*" hidden>'); document.body.append(inp);
    inp.onchange = () => {
      const file = inp.files[0]; inp.remove(); if (!file) return;
      const im = new Image(); im.onload = () => {
        dialog(`<h3>Open image</h3><p class="dim">${im.naturalWidth} × ${im.naturalHeight} picture. Pixel size to turn it into:</p>` + sizeFields(Math.min(256, im.naturalWidth > 256 ? 64 : im.naturalWidth), Math.min(256, im.naturalHeight > 256 ? Math.round(64 * im.naturalHeight / im.naturalWidth) : im.naturalHeight)), f => {
          const nw = clampSize(f.w.value), nh = clampSize(f.h.value), c = document.createElement('canvas'); c.width = nw; c.height = nh;
          const cc = c.getContext('2d'); cc.imageSmoothingEnabled = nw >= im.naturalWidth; cc.drawImage(im, 0, 0, nw, nh);
          const d = cc.getImageData(0, 0, nw, nh).data, fr = new Uint32Array(nw * nh);
          for (let i = 0; i < fr.length; i++) fr[i] = d[i * 4 + 3] < 128 ? 0 : ((d[i * 4] << 24) | (d[i * 4 + 1] << 16) | (d[i * 4 + 2] << 8) | 255) >>> 0;
          snap(); w = nw; h = nh; frames = [fr]; cur = 0; sel = float = null; fit(false); render(); docChanged();
          URL.revokeObjectURL(im.src);
        });
      };
      im.src = URL.createObjectURL(file);
    };
    inp.click();
  }
  menuBar(W, q('.menu'), {
    File: [['New…', newPicture], ['Open image…', importImage], ['Export (PNG, sprite sheet, GIF)…', exportDialog], ['Close', () => closeWin(W)]],
    Edit: [['Undo   Ctrl+Z', doUndo], ['Redo   Ctrl+Y', doRedo], ['Cut   Ctrl+X', () => { copySel(); deleteSel(); }], ['Copy   Ctrl+C', copySel], ['Paste   Ctrl+V', paste],
      ['Select all   Ctrl+A', () => { commitFloat(); sel = { x: 0, y: 0, w, h }; setTool('select'); }], ['Delete   Del', deleteSel], ['Clear frame', () => { commitFloat(); sel = null; deleteSel(); }]],
    Image: [['Flip left/right', () => transform('h')], ['Flip top/bottom', () => transform('v')], ['Rotate 90°', () => transform('rot')], ['Canvas size…', canvasSize]],
    View: [['Zoom in   +', () => zoomStep(1)], ['Zoom out   −', () => zoomStep(-1)], ['Fit to window', () => fit()], ['Pixel grid', () => { grid = !grid; refresh(); render(); }, () => grid], ['Onion skin', () => { onion = !onion; render(); }, () => onion]],
  });

  // multiplayer: pixel changes go out as they're drawn; new pictures, frames, undo and joining send the whole thing
  shareState(W, () => ({ doc: serialize() }), d => {
    if (d.doc) { loadDoc(d.doc); fit(false); render(); saveLater(); }
    else if (d.op === 'px' && Array.isArray(d.d)) { for (let k = 0; k + 2 < d.d.length; k += 3) { const f = frames[d.d[k]]; if (f && d.d[k + 1] < f.length) f[d.d[k + 1]] = d.d[k + 2] >>> 0; } render(); saveLater(); }
  });
  const prevClose = W.onClose;
  W.onClose = () => { prevClose && prevClose(); flush(); store.set('pixel-doc', serialize()); clearInterval(ants); clearInterval(anim); document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); pxWin = null; };
  pxWin = W;
  loadDoc(store.get('pixel-doc', null));
  refresh();
  requestAnimationFrame(() => { fit(); });
  render();
  return W;
}

/* ---------- settings ---------- */
const RESOLUTIONS = [['Widescreen 16:9', [[1280, 720], [1366, 768], [1600, 900], [1920, 1080], [2560, 1440]]],
  ['16:10', [[1280, 800], [1440, 900], [1680, 1050], [1920, 1200]]], ['Square-ish 4:3 and 5:4', [[1024, 768], [1280, 1024]]]];
let setWin = null;
function openSettings() {
  if (setWin) { focusWin(setWin); return setWin; }
  const W = makeWin({ title: 'Settings', icon: I.settings, w: 460, h: 560 });
  W.body.innerHTML = '<div class="set"><h3>Display resolution</h3><p class="dim">The desktop is drawn at this size and scaled to fit your browser window, '
    + 'with black bars if the shapes differ. In multiplayer, pick the same as the others so everyone has the same space.</p>'
    + '<p class="set-now"></p><div class="set-list"></div><div class="set-room"></div><div class="set-foot"><button class="okbtn set-apply">Apply</button></div></div>';
  const q = sel => W.body.querySelector(sel);
  let choice = displayChoice();
  const key = c => c.w ? `${c.w}x${c.h}` : 'fit';
  W.render = () => {
    q('.set-now').textContent = `Your browser window: ${window.innerWidth} × ${window.innerHeight}. Desktop now: ${Math.round(UI.w)} × ${Math.round(UI.h)}.`;
    const opt = (k, label, extra = '') => `<label class="set-opt"><input type="radio" name="res" value="${k}"${k === key(choice) ? ' checked' : ''}> ${label}${extra}</label>`;
    q('.set-list').innerHTML = RESOLUTIONS.map(([group, list]) => `<h4>${esc(group)}</h4>` + list.map(([w, h]) => opt(`${w}x${h}`, `${w} × ${h}`, w === 1600 && h === 900 ? ' <span class="dim">(default)</span>' : '')).join('')).join('')
      + '<h4>Other</h4>' + opt('fit', 'Fit my screen', ' <span class="dim">(900 tall, as wide as your window)</span>');
    q('.set-list').querySelectorAll('input').forEach(i => i.onchange = () => { const [w, h] = i.value === 'fit' ? [0, 900] : i.value.split('x').map(Number); choice = { w, h }; });
    const others = [...mp.peers.values()].filter(p => Array.isArray(p.res));
    q('.set-room').innerHTML = others.length ? '<h4>In this room</h4>' + others.map(p => `<div><i style="background:${esc(p.color)}"></i>${esc(p.name)}: ${Math.round(p.res[0])} × ${Math.round(p.res[1])}</div>`).join('') : '';
  };
  q('.set-apply').onclick = () => {
    store.set('display', choice);
    applyScale(); window.dispatchEvent(new Event('resize'));
    asRemote(() => wins.forEach(w => setRect(w, [w.el.offsetLeft, w.el.offsetTop, w.el.offsetWidth, w.el.offsetHeight]))); // keep windows on screen
    if (live()) hello();
    W.render();
  };
  W.onClose = () => { setWin = null; };
  setWin = W; W.render();
  return W;
}

/* ---------- desktop ---------- */
// Icons sit on a grid. Visitors can select them (click, Ctrl/Shift+click, or drag a box)
// and drag them to any cell; the layout is remembered in their browser.
const dEl = document.getElementById('desktop');
const GRID_W = 86, GRID_H = 94; // one icon cell + the gap, matches #desktop in style.css
const icons = DESKTOP_ITEMS.map(n => {
  const d = el(`<div class="dicon" role="listitem" tabindex="0"><div class="ic">${img(iconSrc(n))}</div><div class="lb"></div></div>`);
  d.querySelector('.lb').textContent = n.name; d.node = n; d.dataset.k = nodeKey(n);
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
  saveIcons();
  layout();
}
// your layout is saved in your browser; in a room everyone shares one layout instead
function saveIcons() { if (live()) mpSend({ t: 'icons', pos: iconPos }); else store.set('desktop-pos', iconPos); }
function setIcons(pos) {
  if (!pos || typeof pos !== 'object') return;
  iconPos = {};
  for (const [k, v] of Object.entries(pos)) if (Array.isArray(v) && v.length === 2 && v.every(Number.isInteger)) iconPos[k] = v;
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
    drag = { x: cX(e), y: cY(e), moving: false, wasSel, shift: e.shiftKey, group: selected() };
    d.setPointerCapture(e.pointerId);
  });
  d.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = cX(e) - drag.x, dy = cY(e) - drag.y;
    if (!drag.moving && Math.hypot(dx, dy) < 5) return;
    drag.moving = true;
    drag.group.forEach(g => { g.classList.add('dragging'); g.style.transform = `translate(${dx}px, ${dy}px)`; });
  });
  const endDrag = e => {
    if (!drag) return;
    const { x, y, moving, wasSel, shift, group } = drag; drag = null;
    group.forEach(g => { g.classList.remove('dragging'); g.style.transform = ''; });
    if (moving && e.type === 'pointerup') moveIcons(group, Math.round((cX(e) - x) / GRID_W), Math.round((cY(e) - y) / GRID_H));
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

watchSel(dEl, () => 'desk');

// drag a box on empty desktop to select icons (Ctrl adds to the selection)
let box = null, boxSent = 0;
const tellBox = r => { if (live() && (!r || performance.now() - boxSent > 40)) { boxSent = performance.now(); mpSend({ t: 'box', r }); } };
dEl.addEventListener('pointerdown', e => {
  closeCtx();
  if (e.target !== dEl || e.button !== 0) return;
  const base = e.ctrlKey || e.metaKey ? selected() : [];
  selectOnly(base);
  if (e.pointerType === 'touch') return;
  const r0 = lrect(dEl);
  box = { x: cX(e), y: cY(e), base, el: el('<div class="selbox"></div>'), r0 };
  dEl.append(box.el); dEl.setPointerCapture(e.pointerId);
});
dEl.addEventListener('pointermove', e => {
  if (!box) return;
  const l = Math.min(box.x, cX(e)), t = Math.min(box.y, cY(e)), rr = Math.max(box.x, cX(e)), b = Math.max(box.y, cY(e));
  Object.assign(box.el.style, { left: l - box.r0.left + 'px', top: t - box.r0.top + 'px', width: rr - l + 'px', height: b - t + 'px' });
  tellBox([l - box.r0.left, t - box.r0.top, rr - l, b - t]);
  selectOnly([...box.base, ...icons.filter(d => { const q = lrect(d); return q.left < rr && q.right > l && q.top < b && q.bottom > t; })]);
});
const endBox = () => { if (box) { box.el.remove(); box = null; tellBox(null); } };
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
    ['Reset icon positions', () => { iconPos = {}; saveIcons(); layout(); }],
    ['Display settings', openSettings],
  ].map(([label, fn]) => { const b = el('<button></button>'); b.textContent = label; b.onclick = () => { closeCtx(); fn(); }; return b; }));
  ctx.hidden = false;
  ctx.style.left = Math.min(cX(e), innerWidth - ctx.offsetWidth - 4) + 'px';
  ctx.style.top = Math.min(cY(e), innerHeight - ctx.offsetHeight - 4) + 'px';
});
document.addEventListener('pointerdown', e => { if (!ctx.hidden && !ctx.contains(e.target)) closeCtx(); });
addEventListener('resize', layout);
layout();

/* ---------- start menu ---------- */
const start = document.getElementById('start'), orb = document.getElementById('orb');
const closeStart = () => { start.hidden = true; orb.classList.remove('on'); };
document.getElementById('sm-user').innerHTML = img(ASSETS.avatar, '') + `<span>${esc(OWNER_NAME)}</span>`;
const leftItems = DESKTOP_ITEMS.filter(n => ['folder', 'txt', 'minesweeper', 'wordle', 'paint', 'pixelpaint', 'pinball', 'snake', 'solitaire', 'tictactoe', 'connect4', 'checkers', 'chess', 'g2048', 'sudoku', 'video', 'audio', 'browser'].includes(n.type))
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
{ const b = el('<button class="sm-r sm-settings"></button>'); b.textContent = 'Settings'; b.onclick = () => { closeStart(); openSettings(); }; smRight.append(b); }
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
// In a multiplayer room everyone sees the clock of whoever was in the room first (their time zone too),
// so the taskbar clock and calendar match on every screen.
let roomClock = null; // { offset: ms to add to my clock, tz, name }
function clockNow() {
  if (!roomClock) return new Date();
  const now = new Date(Date.now() + roomClock.offset);
  if (!roomClock.tz) return now;
  try { // their wall-clock time, as a normal local Date so the calendar code works unchanged
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: roomClock.tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(now).map(x => [x.type, x.value]));
    return new Date(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second, now.getMilliseconds());
  } catch { return now; }
}
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
  const now = clockNow(), { y, m } = calSt;
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
document.getElementById('cal-long').onclick = () => { const n = clockNow(); calSt.y = n.getFullYear(); calSt.m = n.getMonth(); calSt.sel = null; renderCal(); };
tray.onclick = e => {
  e.stopPropagation(); closeStart(); closeVol();
  if (cal.hidden) { const n = clockNow(); calSt.y = n.getFullYear(); calSt.m = n.getMonth(); calSt.sel = null; renderCal(); drawHands(); }
  cal.hidden = !cal.hidden; tray.classList.toggle('on', !cal.hidden);
};
document.addEventListener('pointerdown', e => { if (!cal.hidden && !cal.contains(e.target) && !tray.contains(e.target)) { cal.hidden = true; tray.classList.remove('on'); } });

// analog clock
const face = document.getElementById('cal-face');
face.innerHTML = '<circle cx="50" cy="50" r="47" class="rim"/><circle cx="50" cy="50" r="43" class="dial"/>'
  + Array.from({ length: 12 }, (_, k) => `<line x1="50" y1="${k % 3 ? 10 : 9}" x2="50" y2="${k % 3 ? 14 : 17}" class="tick${k % 3 ? '' : ' big'}" transform="rotate(${k * 30} 50 50)"/>`).join('')
  + '<line id="h-h" x1="50" y1="52" x2="50" y2="29" class="hh"/><line id="h-m" x1="50" y1="54" x2="50" y2="17" class="hm"/><line id="h-s" x1="50" y1="58" x2="50" y2="14" class="hs"/><circle cx="50" cy="50" r="2.6" class="pin"/>';
function drawHands() {
  const d = clockNow(), s = d.getSeconds(), mi = d.getMinutes() + s / 60, h = d.getHours() % 12 + mi / 60;
  [['h-h', h * 30], ['h-m', mi * 6], ['h-s', s * 6]].forEach(([id, a]) => document.getElementById(id).setAttribute('transform', `rotate(${a} 50 50)`));
  document.getElementById('cal-time').textContent = d.toLocaleTimeString();
}
function tick() {
  const d = clockNow();
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
  const r = lrect(volBtn);
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
store.set('mp-name', me.name); store.set('mp-color', me.color);
const applyMyColor = () => document.documentElement.style.setProperty('--me', me.color);
applyMyColor();
let room = null, roomCode = '', since = 0, synced = false, mpPanel = null, mpLib = null, mpError = '';
const mpBtn = document.getElementById('mpb');
const roomFromUrl = () => (location.hash.match(/room=([\w-]+)/) || [])[1] || '';
const inviteLink = () => `${location.origin}${location.pathname}#room=${roomCode}`;
const newCode = () => Array.from({ length: 6 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');

function toast(text) {
  const t = el('<div class="mp-toast"></div>'); t.textContent = text; document.body.append(t);
  setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3000);
}
// chat: lives in the Multiplayer window; while it's closed, messages pop up as toasts and over the sender's cursor
const chatLog = [];
let unread = 0;
const panelOpen = () => mpPanel && !mpPanel.el.classList.contains('min');
function addChat(entry) {
  chatLog.push({ ...entry, at: entry.at || Date.now() }); if (chatLog.length > 200) chatLog.shift();
  if (mpPanel) mpPanel.chatAdd(chatLog[chatLog.length - 1]);
}
function sendChat(text) {
  text = text.trim().slice(0, 300); if (!text || !room) return;
  mpSend({ t: 'chat', text });
  addChat({ id: mp.self, name: me.name, color: me.color, text });
}
function bubble(p, text) {
  let b = p.cur.querySelector('.mp-bubble');
  if (!b) { b = el('<b class="mp-bubble"></b>'); p.cur.append(b); }
  b.textContent = text; b.hidden = false;
  clearTimeout(p.bubbleT); p.bubbleT = setTimeout(() => { b.hidden = true; }, 4500);
}
const myTz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })();
const hello = to => mpSend({ t: 'hello', id: mp.self, name: me.name, color: me.color, since, now: Date.now(), tz: myTz, res: [Math.round(innerWidth), Math.round(innerHeight)] }, to);
function pickRoomClock() { // the clock of whoever has been in the room longest
  const first = [...mp.peers.values()].filter(p => p.since < since).sort((a, b) => a.since - b.since)[0];
  roomClock = first ? { offset: first.offset || 0, tz: first.tz || '', name: first.name } : null;
  tray.title = roomClock ? `Room time: ${roomClock.name}'s clock` : '';
  tick();
}

async function joinRoom(code) {
  if (room) await leaveRoom();
  roomCode = code.toLowerCase().replace(/[^\w-]/g, '').slice(0, 32); if (!roomCode) return;
  try { mpLib ||= await import('./assets/vendor/trystero.js'); }
  catch { toast("Couldn't load multiplayer. Open the site from a web server, not straight from a file."); roomCode = ''; return; }
  since = Date.now(); synced = false; mpError = '';
  const config = { appId: `krowos-${SITE_NAME}`, password: roomCode };
  // our list plus every relay the library knows: both people use the same list, so any one that works is enough
  const urls = [...(MULTIPLAYER.relays || []), ...(MULTIPLAYER.moreRelays !== false && mpLib.defaultRelayUrls || [])].map(u => u.includes('://') ? u : 'wss://' + u);
  if (urls.length) config.relayConfig = { urls: [...new Set(urls)] };
  if (MULTIPLAYER.turn) config.turnConfig = MULTIPLAYER.turn;
  room = mpLib.joinRoom(config, roomCode, { onJoinError: e => { mpError = e.error || String(e); refreshMp(); } });
  const action = room.makeAction('m');
  mp.send = (m, to) => { action.send(m, to ? { target: to } : undefined).catch(() => {}); };
  action.onMessage = (m, { peerId }) => receive(m, peerId);
  room.onPeerJoin = peerId => hello(peerId);
  room.onPeerLeave = peerId => {
    const p = mp.peers.get(peerId); if (!p) return;
    p.cur.remove(); if (p.box) p.box.remove(); mp.peers.delete(peerId); paintSel(); paintFocus(); pickRoomClock(); toast(`${p.name} left`); addChat({ sys: true, text: `${p.name} left` }); refreshMp();
  };
  history.replaceState(null, '', '#room=' + roomCode);
  refreshMp();
}
async function leaveRoom() {
  const r = room; room = null; mp.send = null; roomCode = '';
  mp.peers.forEach(p => { p.cur.remove(); if (p.box) p.box.remove(); }); mp.peers.clear(); paintSel();
  setIcons(store.get('desktop-pos', {})); // back to your own icon layout chatLog.length = 0; unread = 0; pickRoomClock();
  history.replaceState(null, '', location.pathname + location.search);
  refreshMp();
  if (r) await r.leave().catch(() => {});
}

function receive(m, from) {
  const p = mp.peers.get(from), W = m.sid ? bySid(m.sid) : null;
  if (m.t === 'hello') {
    const known = !!p, peer = p || { cur: el('<div class="mp-cur" hidden><svg viewBox="0 0 16 22" aria-hidden="true"><path d="M1 1v17l4.5-4.2 3 6.7 3-1.4-3-6.6H15z"/></svg><span></span></div>') };
    Object.assign(peer, { id: m.id, name: m.name, color: m.color, since: m.since, tz: typeof m.tz === 'string' ? m.tz : '', res: Array.isArray(m.res) ? m.res.map(Number) : null });
    if (setWin) setWin.render();
    if (typeof m.now === 'number') peer.offset = m.now - Date.now(); // how far their clock is from mine
    peer.cur.style.setProperty('--c', m.color); peer.cur.querySelector('span').textContent = m.name;
    if (!known) {
      document.body.append(peer.cur); mp.peers.set(from, peer);
      if (m.since > since) { toast(`${m.name} joined`); addChat({ sys: true, text: `${m.name} joined` }); } // not for people who were already here
    }
    if (!known && m.since > since) mpSend({ t: 'snap', since, icons: iconPos, chat: chatLog.slice(-50), wins: [...wins].filter(w => w.sid).sort((a, b) => a.el.style.zIndex - b.el.style.zIndex).map(winInfo) }, from);
    pickRoomClock(); refreshMp(); return;
  }
  if (!p) return;
  if (m.t === 'in') { if (W && W.onInput && isLead(W)) W.onInput(m.d, p.id); return; }
  if (m.t === 'chat') {
    const text = String(m.text || '').slice(0, 300).trim(); if (!text) return;
    addChat({ id: p.id, name: p.name, color: p.color, text }); bubble(p, text);
    if (!panelOpen()) { unread++; refreshMp(); toast(`${p.name}: ${text}`); }
    return;
  }
  asRemote(() => {
    if (m.t === 'cur') return moveCursor(p, m);
    if (m.t === 'icons') return setIcons(m.pos);
    if (m.t === 'sel' && Array.isArray(m.k) && typeof m.w === 'string') { (p.sel ||= {})[m.w] = m.k.slice(0, 500).map(String); return paintSel(); }
    if (m.t === 'box') { // their drag-select box on the desktop
      if (!Array.isArray(m.r)) { if (p.box) { p.box.remove(); p.box = null; } return; }
      if (!p.box) { p.box = el('<div class="selbox remote"></div>'); p.box.style.setProperty('--rc', p.color); dEl.append(p.box); }
      const [x, y, w, h] = m.r.map(Number);
      Object.assign(p.box.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      return;
    }
    if (m.t === 'snap') { // someone who was here first: show their desktop instead of mine
      if (synced || m.since >= since) return;
      synced = true;
      setIcons(m.icons);
      if (Array.isArray(m.chat)) { // catch up on what was said before I came
        const before = chatLog.splice(0).filter(c => !c.sys);
        m.chat.forEach(c => c && typeof c.text === 'string' && chatLog.push({ id: c.id, name: String(c.name || ''), color: String(c.color || ''), text: c.text.slice(0, 300), sys: !!c.sys, at: +c.at || Date.now() }));
        chatLog.push(...before);
        if (mpPanel) mpPanel.chatAll();
      }
      wins.filter(w => w.sid).forEach(w => closeWin(w));
      m.wins.forEach(openRemote);
      return;
    }
    if (m.t === 'open') return openRemote(m);
    if (m.t === 'focus') {
      p.focus = typeof m.sid === 'string' ? m.sid : null;
      if (W && W.el.classList.contains('min')) W.el.classList.remove('min'); // they brought it back from the taskbar
      return paintFocus();
    }
    if (!W) return;
    if (m.t === 'close') closeWin(W);
    else if (m.t === 'min') { const a = W.el.classList.contains('active'); W.el.classList.add('min'); if (a) focusTop(); }
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
  curMsg = W ? { t: 'cur', w: W.sid, x: cX(e) - w.offsetLeft, y: cY(e) - w.offsetTop } : { t: 'cur', x: cX(e), y: cY(e) };
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
  if (panelOpen()) unread = 0;
  mpBtn.innerHTML = `<span class="mp-ico">👥</span>${room ? `<b>${n + 1}</b>` : ''}${unread ? `<i class="mp-unread">${unread > 9 ? '9+' : unread}</i>` : ''}`;
  mpBtn.title = room ? `Multiplayer: room ${roomCode}, ${n + 1} here` : 'Multiplayer';
  if (mpPanel) mpPanel.render();
}
function openMpPanel() {
  if (mpPanel) { focusWin(mpPanel); return mpPanel; }
  const W = makeWin({ title: 'Multiplayer', icon: I.multiplayer, w: 400, h: 640 });
  const q = sel => W.body.querySelector(sel);
  W.body.innerHTML = '<div class="mpp"><div class="mp-top"></div><div class="mp-chat" hidden><h4>Chat</h4><div class="mp-log" role="log" aria-live="polite"></div>'
    + '<form class="mp-sayform"><input class="mp-msg" maxlength="300" placeholder="Say something…" aria-label="Chat message" autocomplete="off"><button class="okbtn">Send</button></form></div></div>';
  const log = q('.mp-log'), top = q('.mp-top');
  const hhmm = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  W.chatAdd = c => {
    const line = el(`<div class="mp-line${c.sys ? ' sys' : ''}${c.id === mp.self ? ' mine' : ''}"></div>`);
    if (!c.sys) { const who = el('<b></b>'); who.textContent = c.name; who.style.color = c.color; line.append(who, ' '); }
    line.append(document.createTextNode(c.text));
    const tm = el('<time></time>'); tm.textContent = hhmm(c.at); line.append(tm);
    const atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 30;
    log.append(line);
    if (atEnd || c.id === mp.self) log.scrollTop = log.scrollHeight;
  };
  W.chatAll = () => { log.replaceChildren(); chatLog.forEach(W.chatAdd); log.scrollTop = log.scrollHeight; };
  q('.mp-sayform').onsubmit = e => { e.preventDefault(); const i = q('.mp-msg'); sendChat(i.value); i.value = ''; i.focus(); };
  W.render = () => {
    const swatches = MP_COLORS.map(c => `<button class="mp-sw${c === me.color ? ' on' : ''}" data-c="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('');
    const people = [{ ...me, you: true }, ...mp.peers.values()].map(p => `<li><i style="background:${p.color}"></i>${esc(p.name)}${p.you ? ' <span class="dim">(you)</span>' : ''}</li>`).join('');
    top.innerHTML = `<label class="mp-row">Your name <input class="mp-name" maxlength="24"></label><div class="mp-sws">${swatches}</div>`
      + (room
        ? `<div class="mp-box"><div>Room <b class="mp-code">${esc(roomCode)}</b></div><div class="mp-link"><input class="mp-url" readonly><button class="okbtn mp-copy">Copy link</button></div>`
          + `<div class="dim">${mp.peers.size ? 'Everyone here sees the same desktop.' : 'Waiting for someone to join… Send them the link.'}</div><div class="mp-status"></div></div>`
          + `<div class="mp-here"><h4>Here now</h4><button class="okbtn mp-leave">Leave room</button></div><ul class="mp-people">${people}</ul>`
        : `<div class="mp-box"><button class="okbtn mp-new">Start a room</button><div class="dim">You get a link to send. Whoever opens it sees your desktop, mouse and windows live.</div></div>`
          + `<form class="mp-box mp-join"><span>Have a code?</span><div class="mp-link"><input class="mp-in" placeholder="Room code or link" aria-label="Room code" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"><button class="okbtn">Join</button></div></form>`)
      + (room ? '' : `<div class="dim mp-fine">Connections go straight between browsers, nothing is saved anywhere. Strict school or work networks can block them.</div>`);
    q('.mp-chat').hidden = !room;
    const name = q('.mp-name'); name.value = me.name;
    name.onchange = () => { me.name = name.value.trim().slice(0, 24) || me.name; store.set('mp-name', me.name); hello(); W.render(); };
    W.body.querySelectorAll('.mp-sw').forEach(b => b.onclick = () => { me.color = b.dataset.c; store.set('mp-color', me.color); applyMyColor(); hello(); paintSel(); W.render(); });
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
    else if (!mp.peers.size && Date.now() - since > 25000) text += ' · Nobody found yet: check your friend opened this exact link (same room code) and their panel also says some helper servers are reachable.';
    box.textContent = text; box.classList.toggle('bad', bad);
  };
  const statusTimer = setInterval(W.status, 1500);
  W.onClose = () => { clearInterval(statusTimer); mpPanel = null; };
  mpPanel = W; W.render(); W.chatAll(); refreshMp();
  W.el.addEventListener('pointerdown', () => { if (unread) { unread = 0; refreshMp(); } });
  return W;
}
mpBtn.onclick = () => openMpPanel();
if (!MULTIPLAYER.enabled) mpBtn.hidden = true;
refreshMp();

if (OPEN_ON_START) openNode(OPEN_ON_START);
if (MULTIPLAYER.enabled && roomFromUrl()) joinRoom(roomFromUrl());
})();
