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
const typeName = n => ({ folder: 'File folder', computer: 'System folder', drive: 'Local Disk', bin: 'System folder', txt: 'Text Document', img: 'Picture', video: 'Video', minesweeper: 'Game', wordle: 'Game', pinball: 'Game', snake: 'Game', solitaire: 'Game', airhockey: 'Game', tetris: 'Game', guessdraw: 'Game', rhythm: 'Game', leaderboards: 'Game', tictactoe: 'Game', connect4: 'Game', checkers: 'Game', chess: 'Game', g2048: 'Game', sudoku: 'Game',  paint: 'Application', pixelpaint: 'Application', audio: 'Audio', browser: 'Application' })[n.type];
function iconSrc(n) {
  if (n.icon) return n.icon;
  if (n.type === 'img') return n.src;
  if (n.type === 'video' && n.poster) return n.poster;
  if (n.type === 'folder') return n.art ? I.folderArts : I.folder;
  if (n.type === 'bin') return n.children.length ? I.binFull : I.binEmpty;
  return { txt: I.textFile, computer: I.computer, drive: I.drive, video: I.video, minesweeper: I.minesweeper, wordle: I.wordle, paint: I.paint, pixelpaint: I.pixelpaint, pinball: I.pinball, snake: I.snake, solitaire: I.solitaire, airhockey: I.airhockey, tetris: I.tetris, guessdraw: I.guessdraw, rhythm: I.rhythm, leaderboards: I.leaderboards, tictactoe: I.tictactoe, connect4: I.connect4, checkers: I.checkers, chess: I.chess, g2048: I.g2048, sudoku: I.sudoku,  audio: I.music, browser: I.browser }[n.type] || I.textFile;
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

/* ---------- taskbar ---------- */
// Each window has its own button (W.tk), kept out of sight in tkStore; the taskbar shows one button per kind
// of window. With several windows of a kind the button is stacked, and clicking it lists them to pick from.
const tasksEl = document.getElementById('tasks'), tkStore = document.createElement('div'), tkButtons = new Map();
let tkPop = null, tkPopGroup = null, tkQueued = false;
function renderTasks() {
  tkQueued = false;
  const groups = new Map();
  [...tkStore.children].forEach(t => { const k = t.dataset.group; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); });
  tkButtons.forEach((b, k) => { if (!groups.has(k)) { b.remove(); tkButtons.delete(k); } });
  [...groups].forEach(([k, list]) => {
    let b = tkButtons.get(k);
    if (!b) {
      b = el('<button class="tk"></button>'); tkButtons.set(k, b);
      b.onclick = e => { e.stopPropagation(); const l = groups2(k); if (l.length === 1) l[0].click(); else if (tkPopGroup === k) closeTkPop(); else openTkPop(k, b); };
    }
    tasksEl.append(b); // keeps the buttons in the order the kinds were first opened
    const html = list[list.length - 1].innerHTML + (list.length > 1 ? `<span class="tk-n">${list.length}</span>` : '');
    if (b.innerHTML !== html) b.innerHTML = html;
    b.classList.toggle('on', list.some(t => t.classList.contains('on')));
    b.classList.toggle('stack', list.length > 1);
    b.title = list.map(t => t.title).join('\n');
  });
  if (tkPopGroup) { if (groups.has(tkPopGroup) && groups.get(tkPopGroup).length > 1) fillTkPop(); else closeTkPop(); }
}
const groups2 = k => [...tkStore.children].filter(t => t.dataset.group === k);
new MutationObserver(() => { if (!tkQueued) { tkQueued = true; requestAnimationFrame(renderTasks); } })
  .observe(tkStore, { childList: true, subtree: true, attributes: true, characterData: true });
function openTkPop(k, b) {
  closeTkPop(); tkPopGroup = k;
  tkPop = el('<div id="tkpop" role="menu"></div>'); document.body.append(tkPop);
  fillTkPop();
  const r = lrect(b); tkPop.style.left = Math.max(4, Math.min(innerWidth - tkPop.offsetWidth - 4, r.left + r.width / 2 - tkPop.offsetWidth / 2)) + 'px';
}
function fillTkPop() {
  const winOf = t => wins.find(w => w.tk === t);
  tkPop.replaceChildren(...groups2(tkPopGroup).map(t => {
    const W = winOf(t), row = el(`<div class="tkp-row${t.classList.contains('on') ? ' on' : ''}${W && W.el.classList.contains('min') ? ' min' : ''}" role="menuitem"><span class="tkp-ic">${t.innerHTML}</span><span class="tkp-t"></span><button class="tkp-x" aria-label="Close">×</button></div>`);
    row.querySelector('.tkp-t').textContent = t.title;
    row.onclick = () => { closeTkPop(); if (W) { W.el.classList.remove('min'); focusWin(W); } };
    row.querySelector('.tkp-x').onclick = e => { e.stopPropagation(); if (W) closeWin(W); };
    return row;
  }));
}
function closeTkPop() { if (tkPop) tkPop.remove(); tkPop = null; tkPopGroup = null; }
document.addEventListener('pointerdown', e => { if (tkPop && !e.target.closest('#tkpop, .tk')) closeTkPop(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTkPop(); });

/* ---------- window manager ---------- */
const wins = []; let z = 10, cascade = 0;
const touchy = matchMedia('(hover:none)').matches;
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

function makeWin({ title, icon, w = 640, h = 440, cls = '', noMax = false, group = '' }) {
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
  tk.dataset.group = group || icon; // windows of the same kind share one taskbar button
  tkStore.append(tk);
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
const mp = { self: Math.random().toString(36).slice(2, 10), send: null, remote: false, incoming: null, peers: new Map(), relayed: new Set() };
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
  W.push = d => { if (W.sid) mpSend(d === undefined ? { t: 'app', sid: W.sid, d: get(), lw: 1 } : { t: 'app', sid: W.sid, d }); }; // lw: a whole snapshot, a newer one replaces it
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
  if (n.type === 'airhockey') return openAirHockey();
  if (n.type === 'tetris') return openTetris();
  if (n.type === 'guessdraw') return openGuessDraw();
  if (n.type === 'rhythm') return openRhythm();
  if (n.type === 'leaderboards') return openLeaderboards();
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
  const W = makeWin({ title: start.name, icon: iconSrc(start), w: 760, h: 500, group: 'explorer' });
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
  mixChannel(W, 'video', SOUND.videoVolume, lv => { v.volume = lv; }, { label: () => n.name });
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
    const lb = el('<button class="okbtn">Leaderboard</button>'); lb.onclick = () => lbOn() ? openLeaderboards('ms', { level }) : openMsLeaderboard(level);
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
  function saveDaily(status, won = false) {
    if (!daily) return;
    const r = { ...result(won), status }; store.set(dailyKey(), r);
    if (status === 'done' && lbSolo()) lbSubmit('ms', `ms:${today}:${level.toLowerCase()}`, won ? r.time / 1000 : 1e6 - r.bombs * 1000 - r.cleared, msSummary(r)); // wins by time, then mines found, then cleared
  }
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
      ['Leaderboard', () => lbOn() ? openLeaderboards('ms', { level }) : openMsLeaderboard(level)],
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
    if (state.done) { finish(); if (lbSolo()) lbSubmit('wordle', `wordle:${today}`, state.won ? state.guesses.length : 7, `${state.won ? state.guesses.length : 'X'}/6`); }
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
      + (state.done ? '<div class="wd-end"><span class="wd-next"></span><button class="okbtn wd-share">Share</button></div>' : '')
      + '<button class="okbtn wd-lb">🏆 Leaderboard</button>';
    panel.querySelector('.wd-lb').onclick = () => openLeaderboards('wordle');
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
// Spotify's embed API: lets the page play, pause, seek and follow which song is on
let spApi = null;
function spotifyApi() {
  return spApi ||= new Promise((ok, fail) => {
    if (window.SpotifyIframeApi) return ok(window.SpotifyIframeApi);
    window.onSpotifyIframeApiReady = api => ok(api);
    const sc = document.createElement('script'); sc.src = 'https://open.spotify.com/embed/iframe-api/v1'; sc.async = true;
    sc.onerror = () => { spApi = null; fail(new Error('spotify api')); };
    document.head.append(sc);
    setTimeout(() => fail(new Error('spotify api timeout')), 10000);
  });
}
const spotifyUri = url => { const m = url.match(/^https:\/\/open\.spotify\.com\/embed\/(\w+)\/(\w+)/); return m ? `spotify:${m[1]}:${m[2]}` : ''; };

function openBrowser(start) {
  const W = makeWin({ title: 'Internet', icon: I.browser, w: 900, h: 600 });
  const nav = el(`<div class="nav"><button class="nb bk" aria-label="Back">${img(U.back, '')}</button><button class="nb fw" aria-label="Forward">${img(U.forward, '')}</button>`
    + '<button class="nb wb-re" aria-label="Reload" title="Reload">⟳</button><button class="nb wb-home" aria-label="Home" title="Home">⌂</button>'
    + '<form class="wb-form"><input class="wb-url" type="text" spellcheck="false" autocomplete="off" aria-label="Address or search"></form>'
    + '<button class="nb wb-out" aria-label="Open in a new tab" title="Open in a new tab">↗</button></div>');
  W.el.insertBefore(nav, W.body);
  W.body.innerHTML = '<div class="tools wb-marks"></div><div class="wb-page"><iframe class="wb-frame" referrerpolicy="no-referrer-when-downgrade" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe><div class="wb-note" hidden></div>'
    + '<div class="wb-sp" hidden><div class="wb-sp-host"></div><div class="wb-sp-bar"></div></div>'
    + `<div class="wb-start" hidden><div class="wb-logo"></div><form class="wb-sform"><input class="wb-sq" type="search" spellcheck="false" autocomplete="off" placeholder="Search Google or type a web address" aria-label="Search"><button class="okbtn">Search</button></form>`
    + '<div class="wb-tiles"></div><p class="wb-tip">In a multiplayer room, pages opened from here or the address bar open for everyone. Clicks, typing and scrolling inside other websites stay private to each person (browsers don\'t let one site watch another), so search from this page or the address bar to search together.</p></div></div>';
  const q = sel => W.el.querySelector(sel);
  const frame = q('.wb-frame'), note = q('.wb-note'), urlIn = q('.wb-url');
  const st = { hist: [], i: -1 };
  let pausedMusic = false;
  W.onClose = () => { if (pausedMusic) setMusic(true); removeEventListener('message', onYt); clearInterval(ytListen); clearInterval(spTimer); if (sp.ctl) try { sp.ctl.destroy(); } catch {} };

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
  // mixer channel: YouTube's volume is set through its embed messages; Spotify's player can't be reached
  mixChannel(W, 'web', 1, lv => { if (yt && yt.ready) ytSend('setVolume', [Math.round(lv * 100)]); else if (W.spMute) W.spMute(mix.muted || W.audio.muted || !mix.master); }, {
    active: () => !!ytId() || /^https:\/\/open\.spotify\.com\/embed\//.test(frame.src) || !spBox.hidden,
    label: () => ytId() ? 'YouTube' : 'Spotify',
  });
  // Spotify's player has no volume control that other pages can reach, so its mixer row only mutes
  Object.defineProperty(W.audio, 'locked', { get: () => ytId() || !spBox.hidden ? '' : "Use Spotify's own volume" });
  Object.defineProperty(W.audio, 'muteOnly', { get: () => !ytId() && !spBox.hidden ? 'Mute only' : '' });
  function onYt(e) {
    if (!yt || e.source !== frame.contentWindow || !/youtube/.test(e.origin)) return;
    let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
    if (!d || !d.event) return;
    if (!yt.ready) {
      yt.ready = true; clearInterval(ytListen); ytSend('addEventListener', ['onStateChange']); W.audio.apply();
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

  // Spotify: in a room, the song, play/pause and jumps are shared. Spotify's embed API reports what's
  // playing; the last person to press something leads. Everyone hears it through their own Spotify
  // (full songs when logged in to Spotify in this browser, 30-second previews otherwise).
  const spBox = q('.wb-sp'), spBar = q('.wb-sp-bar');
  const sp = { ctl: null, ready: false, uri: '', track: '', paused: true, t: 0, at: 0, want: null, after: null, waitPlay: false, target: null, remote: null, failed: false, muted: false, wasPlaying: false };
  const spNow = () => sp.t + (sp.paused ? 0 : (performance.now() - sp.at) / 1000);
  const spState = () => sp.ready && sp.uri && !spBox.hidden ? { u: sp.uri, tr: sp.track, p: sp.paused, t: spNow() } : null;
  const spPush = () => { const d = !sp.muted && live() && spState(); if (d) W.push({ sp: d }); };
  // muting Spotify in the mixer pauses it for you only; unmuting picks up where the room is now
  function spMute(on) {
    if (on === sp.muted || !sp.ctl) { sp.muted = on; return; }
    sp.muted = on;
    if (on) { sp.wasPlaying = !sp.paused; if (!sp.paused) sp.ctl.pause(); return; }
    const r = live() && sp.remote;
    if (r) { const d = { ...r.d, t: r.d.t + (r.d.p ? 0 : (performance.now() - r.got) / 1000) }; sp.remote = null; applySp(d); }
    else if (sp.wasPlaying) sp.ctl.resume();
  }
  W.spMute = spMute;
  function spShow(url) { // returns false when the API can't be used, so the plain player is shown instead
    if (sp.failed) return false;
    const uri = spotifyUri(url);
    frame.hidden = true; frame.removeAttribute('src'); spBox.hidden = false;
    if (sp.uri === uri && sp.ctl) return true;
    sp.uri = uri; sp.track = ''; sp.ready = false;
    if (sp.ctl) { sp.ctl.loadUri(uri); setTimeout(() => spReady(uri), 2500); return true; }
    const host = document.createElement('div'); q('.wb-sp-host').replaceChildren(host);
    spotifyApi().then(api => api.createController(host, { uri, width: '100%', height: '100%' }, ctl => {
      sp.ctl = ctl;
      ctl.addListener('ready', () => spReady(sp.uri));
      ctl.addListener('playback_update', e => onSp(e.data || {}));
    })).catch(() => { // no API (blocked or offline): fall back to the plain player, without sharing
      sp.failed = true; spBox.hidden = true; const e = st.hist[st.i]; if (e && e.url && /open\.spotify\.com/.test(embedUrl(e.url))) { frame.hidden = false; frame.src = embedUrl(e.url); }
    });
    return true;
  }
  function spReady(uri) { // the player has loaded: run whatever was waiting for it
    if (uri !== sp.uri) return;
    sp.ready = true;
    if (sp.after) { const f = sp.after; sp.after = null; f(); }
    else if (sp.want) { const d = sp.want; sp.want = null; applySp(d); }
  }
  function onSp(d) {
    if (!sp.ready) spReady(sp.uri);
    const pos = (d.position || 0) / 1000, paused = !!d.isPaused && !d.isBuffering, track = d.playingURI || sp.track;
    const jumped = !paused && !sp.paused && Math.abs(pos - spNow()) > 3, changed = (sp.track && track !== sp.track) || paused !== sp.paused;
    const joining = sp.waitPlay && !paused && sp.paused; // pressed play to join a song the room is already playing
    sp.t = pos; sp.at = performance.now(); sp.paused = paused; sp.track = track;
    if (!paused) sp.waitPlay = false;
    if (joining && sp.remote) { const r = sp.remote, t = r.d.t + (performance.now() - r.got) / 1000; if (Math.abs(t - pos) > 2) sp.ctl.seek(t); sp.target = { tr: track, p: false, until: performance.now() + 2500 }; spStatus(); return; }
    // our own catching up shows up here too: only pass on changes that someone made in this player
    const tg = sp.target && performance.now() < sp.target.until ? sp.target : null;
    const echo = tg && paused === tg.p && (!tg.tr || track === tg.tr);
    if ((changed || jumped) && !echo && !sp.after) spPush(); // (sp.after: still loading a song someone else picked)
    spStatus();
  }
  function applySp(d) {
    if (!d || !d.u) return;
    if (!sp.ctl || !sp.ready || d.u !== sp.uri) { sp.want = d; return; }
    const got = performance.now();
    sp.remote = { d, got }; sp.target = { tr: d.tr, p: d.p, until: got + 3000 }; // what follows is us catching up
    if (sp.muted) return; // muted: just remember where the room is
    const catchUp = () => {
      const t = d.t + (d.p ? 0 : (performance.now() - got) / 1000);
      if (Math.abs(spNow() - t) > 2) sp.ctl.seek(Math.max(0, t));
      if (d.p) { if (!sp.paused) sp.ctl.pause(); }
      else if (sp.paused) { sp.ctl.resume(); sp.waitPlay = true; setTimeout(spStatus, 2500); }
    };
    if (d.tr && d.tr !== sp.track && d.tr !== d.u) { // a different song: load it, then jump to the same spot
      sp.track = d.tr; sp.paused = true; sp.t = 0; sp.after = catchUp; sp.ctl.loadUri(d.tr); // a song starts out paused
      setTimeout(() => { if (sp.after === catchUp) { sp.after = null; catchUp(); } }, 2000);
    } else catchUp();
  }
  function spStatus() {
    if (spBox.hidden) return;
    const behind = sp.waitPlay && sp.paused && (!sp.target || performance.now() > sp.target.until - 1000);
    spBar.textContent = !live() ? 'Open a multiplayer room to listen together.'
      : behind ? '▶ Press play in the player once to join the music (your browser needs one click first).'
      : '🎧 Listening together: songs, play/pause and skipping are shared with the room.';
    spBar.classList.toggle('warn', !!behind);
  }
  const spTimer = setInterval(spStatus, 1500);
  const spHide = () => { if (spBox.hidden) return; spBox.hidden = true; if (sp.ctl && !sp.paused) sp.ctl.pause(); };

  function show(entry) {
    urlIn.value = entry.url || '';
    q('.wb-start').hidden = !entry.start;
    const spotify = !entry.start && !entry.note && /^https:\/\/open\.spotify\.com\/embed\//.test(embedUrl(entry.url || ''));
    if (!spotify) spHide();
    if (entry.start) { frame.hidden = true; frame.removeAttribute('src'); note.hidden = true; yt = null; q('.wb-sq').value = ''; }
    else if (entry.note) { frame.hidden = true; frame.removeAttribute('src'); note.hidden = false; note.textContent = entry.note; }
    else if (spotify && spShow(embedUrl(entry.url))) {
      note.hidden = true; yt = null; clearInterval(ytListen); spStatus();
      if (!pausedMusic) { pausedMusic = true; setMusic(false); }
    }
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
  shareState(W, () => ({ e: st.hist[st.i], yt: yt && yt.ready ? { v: ytId(), p: yt.state !== 1, t: ytNow() } : null, sp: spState() }), d => {
    const cur = st.hist[st.i];
    if (d.e && !(cur && cur.url === d.e.url && cur.note === d.e.note && !!cur.start === !!d.e.start)) go(d.e);
    if (d.yt) applyYt(d.yt);
    if (d.sp) applySp(d.sp);
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
  mixChannel(W, 'player', SOUND.musicVolume, v => { au.volume = v; }, { label: () => 'Music Player' });
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

// a little synth for game sound effects, with its own slider in the volume mixer; returns tone(freq, seconds, opts)
function makeSynth(W, key, label, vol = 0.5) {
  let actx = null, out = null;
  mixChannel(W, key, vol, v => { if (out) out.gain.value = v; }, { label: () => label });
  W.closeSynth = () => { if (actx) actx.close().catch(() => {}); actx = null; };
  return function tone(f, dur, { type = 'square', vol = 0.12, slide = 0, at = 0, noise = false } = {}) {
    try {
      if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); out = actx.createGain(); out.connect(actx.destination); W.audio.apply(); }
      if (actx.state === 'suspended') actx.resume();
      const t0 = actx.currentTime + at, v = actx.createGain();
      let src;
      if (noise) { // a burst of noise, for thuds and crashes
        const buf = actx.createBuffer(1, Math.ceil(actx.sampleRate * dur), actx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        src = actx.createBufferSource(); src.buffer = buf;
        const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f; src.connect(lp); lp.connect(v);
      } else {
        src = actx.createOscillator(); src.type = type; src.frequency.setValueAtTime(f, t0);
        if (slide) src.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + dur);
        src.connect(v);
      }
      v.gain.setValueAtTime(vol, t0); v.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      v.connect(out); src.start(t0); src.stop(t0 + dur + 0.02);
    } catch {}
  };
}

/* ---------- pinball ---------- */
let pbWin = null;
function openPinball() {
  if (pbWin) { focusWin(pbWin); return pbWin; }
  const TW = 360, TH = 600, R = 8, G = 700;
  const W = makeWin({ title: '3D Pinball', icon: I.pinball, w: 620, h: 700 });
  W.body.innerHTML = '<div class="pb"><div class="pb-main"><div class="pb-wrap"><canvas class="pb-c" width="360" height="600" aria-label="Pinball table"></canvas></div>'
    + '<div class="pb-panel"><canvas class="pb-logo" width="200" height="150" aria-hidden="true"></canvas><div class="pb-ballrow">BALL <b class="pb-ball">1</b></div>'
    + '<div class="pb-scorerow"><b class="pb-player">1</b><b class="pb-score">0</b></div><div class="pb-msg" role="status"></div><div class="pb-info"></div><button class="pb-lb">🏆 Leaderboard</button></div></div>'
    + '<div class="pb-help">Z or ← left flipper · / or → right flipper · hold Space to launch · F3 pause<br>Touch: tap left/right half for flippers, hold to launch</div></div>';
  const cv = W.body.querySelector('canvas'), g = cv.getContext('2d');
  const path = pts => pts.slice(1).map((p, k) => [...pts[k], ...p]);
  const walls = [
    ...path([[10, 470], [10, 110], [30, 60], [70, 25], [120, 10], [240, 10], [290, 25], [330, 60], [350, 110], [350, 600]]),
    [320, 600, 320, 150], // launch lane
    [10, 470, 92, 528], [320, 470, 238, 528], // inlanes to the flippers
    [60, 400, 60, 440], [270, 400, 270, 440], // small guide posts
    [120, 34, 120, 60], [152, 34, 152, 60], [184, 34, 184, 60], [216, 34, 216, 60], // posts between the three top lanes
  ];
  // things to aim for: three top lanes (light all for a bigger end-of-ball bonus), three drop targets on the
  // left, the rocket target on the right and the black hole in the middle (sinks the ball when lit; two
  // sinks start multiball). Missions ask for one of them and promote you through the ranks.
  const LANES = [136, 168, 200], HOLE = { x: 165, y: 395 }, TARGETS = [186, 210, 234], ROCKET = [316, 232, 316, 268];
  const RANKS = [[0, 'Cadet'], [1, 'Ensign'], [3, 'Lieutenant'], [5, 'Captain'], [8, 'Commander'], [12, 'Admiral']];
  const rankName = n => RANKS.filter(([k]) => n >= k).pop()[1];
  const MISSIONS = [
    { ev: 'bumper', goal: r => 12 + r * 2, text: n => `Hit the bumpers ${n} times`, reward: 5000 },
    { ev: 'star', goal: r => 4 + Math.floor(r / 2), text: n => `Hit the yellow stars ${n} times`, reward: 6000 },
    { ev: 'lanes', goal: r => 1 + Math.floor(r / 4), text: n => n > 1 ? `Light all 3 top lanes ${n} times` : 'Light all 3 top lanes', reward: 7500 },
    { ev: 'bank', goal: r => 1 + Math.floor(r / 4), text: n => n > 1 ? `Knock down all 3 targets ${n} times` : 'Knock down all 3 targets', reward: 7500 },
    { ev: 'rocket', goal: r => 3 + Math.floor(r / 3), text: n => `Refuel: hit the rocket ${n} times`, reward: 6000 },
    { ev: 'hole', goal: () => 1, text: () => 'Sink the ball in the black hole', reward: 10000, lights: true },
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
  // effects: worked out from what changed between frames, so friends watching in a room see them too
  const fx = { parts: [], rings: [], texts: [], trail: [], shake: 0, drain: 0, flash: 0, shown: 0, prev: null, wallT: 0 };
  const tone = makeSynth(W, 'pinball', '3D Pinball');
  const SFX = {
    bumper: big => { tone(big ? 520 : 880, 0.12, { type: 'square', vol: 0.08, slide: big ? 260 : 400 }); tone(big ? 130 : 260, 0.1, { type: 'triangle', vol: 0.14 }); },
    flip: () => tone(900, 0.04, { noise: true, vol: 0.12 }),
    launch: p => { tone(1400, 0.25, { noise: true, vol: 0.12 }); tone(180, 0.35, { type: 'sawtooth', vol: 0.06, slide: 600 + p * 900 }); },
    drain: () => [0, -4, -9].forEach((st, k) => tone(330 * Math.pow(2, st / 12), 0.35, { type: 'triangle', vol: 0.14, at: k * 0.18 })),
    over: () => [0, -3, -7, -12].forEach((st, k) => tone(294 * Math.pow(2, st / 12), 0.45, { type: 'square', vol: 0.06, at: k * 0.22 })),
    start: () => [0, 4, 7, 12].forEach((st, k) => tone(392 * Math.pow(2, st / 12), 0.16, { type: 'square', vol: 0.07, at: k * 0.08 })),
    milestone: () => [0, 7, 12, 16, 19, 24].forEach((st, k) => tone(523 * Math.pow(2, st / 12), 0.18, { type: 'square', vol: 0.06, at: k * 0.06 })),
    wall: v => tone(500, 0.03, { noise: true, vol: Math.min(0.1, v / 9000) }),
    mission: () => [0, 7].forEach((st, k) => tone(660 * Math.pow(2, st / 12), 0.14, { type: 'triangle', vol: 0.12, at: k * 0.12 })),
    complete: () => [0, 4, 7, 12, 16].forEach((st, k) => tone(587 * Math.pow(2, st / 12), 0.16, { type: 'square', vol: 0.06, at: k * 0.07 })),
    fail: () => [0, -5].forEach((st, k) => tone(220 * Math.pow(2, st / 12), 0.3, { type: 'sawtooth', vol: 0.06, at: k * 0.2 })),
    lanes: () => [0, 5, 10].forEach((st, k) => tone(784 * Math.pow(2, st / 12), 0.1, { type: 'square', vol: 0.06, at: k * 0.06 })),
    bank: () => { tone(300, 0.2, { noise: true, vol: 0.1 }); [0, 7].forEach((st, k) => tone(440 * Math.pow(2, st / 12), 0.15, { type: 'square', vol: 0.06, at: 0.1 + k * 0.08 })); },
    hole: () => tone(500, 0.9, { type: 'sine', vol: 0.15, slide: -430 }),
    multi: () => [0, 4, 7, 12, 7, 12, 16].forEach((st, k) => tone(523 * Math.pow(2, st / 12), 0.12, { type: 'square', vol: 0.07, at: k * 0.07 })),
    save: () => [0, 12].forEach((st, k) => tone(440 * Math.pow(2, st / 12), 0.15, { type: 'triangle', vol: 0.12, at: k * 0.1 })),
    extra: () => [0, 4, 7, 12].forEach((st, k) => tone(659 * Math.pow(2, st / 12), 0.2, { type: 'triangle', vol: 0.14, at: k * 0.1 })),
  };
  const sparks = (x, y, color, n, power = 1) => { for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, v = (60 + Math.random() * 200) * power; fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.35 + Math.random() * 0.4, color }); } };
  const popText = (text, x, y, color = '#ffe66b', size = 14) => {
    fx.texts = fx.texts.filter(o => Math.hypot(o.x - x, o.y - o.t * 26 - y) > size * 1.6); // the newest wins its spot
    fx.texts.push({ text, x, y, color, size, t: 0 }); if (fx.texts.length > 8) fx.texts.shift();
  };
  const MILESTONES = [5000, 10000, 25000, 50000, 100000];
  let helped = false; // someone else pressed the flippers: not a leaderboard game
  let extra = [], lanes = [0, 0, 0], targets = [1, 1, 1], targetsBack = 0, mult = 1, bonus = 0, holeLit = false, locks = 0, held = null, saveUntil = 0;
  let rank = 0, mission = null, missionNext = 0, gt = 0, rocketFlash = 0, rocketT = 0, skillLane = -1, skillUntil = 0, ann = null, annN = 0;
  const resetBall = () => { ball = { x: 335, y: 562, vx: 0, vy: 0, onPlunger: true, inLane: true, lane: -1 }; charge = 0; };
  function newGame() {
    score = 0; balls = 3; over = false; resetBall(); extra = []; held = null; helped = false;
    lanes = [0, 0, 0]; targets = [1, 1, 1]; mult = 1; bonus = 0; holeLit = false; locks = 0; rank = 0; mission = null; missionNext = 0; gt = 0;
  }
  // a message for everyone at the table: shown here and sent with the table so watchers see it too
  function announce(text, color = '#ffe66b', size = 18, sfx = '', y = 200) { popText(text, 165, y, color, size); if (sfx && SFX[sfx]) SFX[sfx](); ann = { n: ++annN, text, color, size, sfx, y }; }
  function newMission() {
    let k; do k = Math.floor(Math.random() * MISSIONS.length); while (mission && k === mission.k && MISSIONS.length > 1);
    const M = MISSIONS[k], goal = M.goal(rank);
    mission = { k, prog: 0, goal, left: 45 };
    if (M.lights) holeLit = true;
    announce(`NEW MISSION: ${M.text(goal)}`, '#7de3ff', 13, 'mission', 150);
  }
  function progress(ev, n = 1) {
    if (!mission || MISSIONS[mission.k].ev !== ev) return;
    mission.prog = Math.min(mission.goal, mission.prog + n);
    if (mission.prog < mission.goal) return;
    const M = MISSIONS[mission.k], pts = Math.round(M.reward * (1 + rank * 0.25) / 100) * 100, before = rankName(rank);
    score += pts; rank++; mission = null; missionNext = gt + 3;
    announce(`MISSION COMPLETE +${pts.toLocaleString()}`, '#8dff8a', 17, 'complete', 180);
    if (rankName(rank) !== before) {
      const r = rankName(rank); setTimeout(() => announce(`PROMOTED: ${r.toUpperCase()}!`, '#ffd23f', 20, 'milestone', 230), 900);
      if (r === 'Captain' || r === 'Admiral') { balls++; setTimeout(() => announce('EXTRA BALL!', '#ff9df5', 20, 'extra', 270), 1800); }
    }
  }
  function laneHit(i) {
    if (gt < skillUntil && i === skillLane) { score += 7500; skillUntil = 0; announce('SKILL SHOT! +7,500', '#ff9df5', 18, 'complete', 120); }
    if (lanes[i]) return;
    lanes[i] = 1; score += 300; bonus += 100;
    if (lanes.every(Boolean)) {
      lanes = [0, 0, 0]; mult = Math.min(5, mult + 1); holeLit = true; progress('lanes');
      announce(`BONUS ${mult}X · HOLE LIT`, '#ffd23f', 17, 'lanes', 110);
    }
  }
  function capture() { // the black hole swallows the ball for a moment, then fires it back out
    held = { b: ball, until: gt + 1.3 }; ball.vx = ball.vy = 0; ball.x = HOLE.x; ball.y = HOLE.y; ball.held = true;
    holeLit = false; score += 2000; bonus += 500; locks++; progress('hole');
    if (locks >= 2 && !extra.length) { locks = 0; held.multi = true; announce('MULTIBALL!', '#ff7ad9', 26, 'multi', 320); }
    else announce(locks === 1 && !extra.length ? 'BALL LOCKED · ONE MORE FOR MULTIBALL' : 'BLACK HOLE +2,000', '#b49bff', 14, 'hole', 340);
  }
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
    const all = [ball, ...extra];
    all.forEach(b => { ball = b; stepBall(dt); });
    ball = all[0];
    extra = extra.filter(b => !b.gone);
    if (ball.gone) { if (extra.length) { ball = extra.shift(); announce('MULTIBALL OVER', '#ff9df5', 14, '', 470); } else drain(); }
  }
  function stepBall(dt) {
    if (ball.held) { ball.x = HOLE.x; ball.y = HOLE.y; return; }
    if (ball.onPlunger) { ball.x = 335; ball.y = 562 + charge * 14; return; }
    ball.vy += G * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.inLane && ball.x < 316) ball.inLane = false;
    walls.forEach(s => { const c = hitSeg(...s, 2); if (c) { const vn = -(ball.vx * c.nx + ball.vy * c.ny); if (vn > 350 && performance.now() - fx.wallT > 60) { fx.wallT = performance.now(); SFX.wall(vn); } bounce(c, 0.45); } });
    if (!ball.inLane) { const c = hitSeg(...gate, 2); if (c) bounce(c, 0.45); }
    bumpers.forEach(b => {
      const dx = ball.x - b.x, dy = ball.y - b.y, d = Math.hypot(dx, dy);
      if (d >= R + b.r || d === 0) return;
      const c = { nx: dx / d, ny: dy / d };
      ball.x = b.x + c.nx * (R + b.r); ball.y = b.y + c.ny * (R + b.r);
      bounce(c, 0.9); ball.vx += c.nx * 180; ball.vy += c.ny * 180;
      score += b.pts; b.flash = 0.15; bonus += 20; progress(b.pts > 50 ? 'bumper' : 'star');
    });
    // top lanes: passing through one lights it
    const inLane = ball.y > 38 && ball.y < 58 ? LANES.findIndex(x => Math.abs(ball.x - x) < 11) : -1;
    if (inLane >= 0 && inLane !== ball.lane) laneHit(inLane);
    ball.lane = inLane;
    // drop targets: standing ones are solid, a hit knocks one down
    TARGETS.forEach((y, k) => {
      if (!targets[k]) return;
      const c = hitSeg(17, y, 17, y + 16, 3); if (!c) return;
      bounce(c, 0.5); targets[k] = 0; score += 500; bonus += 100;
      if (targets.every(t => !t)) { score += 3000; holeLit = true; targetsBack = gt + 1.5; progress('bank'); announce('TARGETS CLEARED · HOLE LIT', '#ff9d5c', 16, 'bank', 260); }
    });
    { const c = hitSeg(...ROCKET, 3); if (c) { bounce(c, 0.6); if (gt - rocketT > 0.3) { rocketT = gt; rocketFlash = 0.4; score += 250; bonus += 50; progress('rocket'); SFX.bumper(false); } } }
    if (holeLit && !held && Math.hypot(ball.x - HOLE.x, ball.y - HOLE.y) < 13) capture();
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
    if (ball.y > TH + 20) ball.gone = true;
  }
  function drain() {
    if (gt < saveUntil) { resetBall(); saveUntil = 0; announce('BALL SAVED', '#7de3ff', 22, 'save', 440); return; } // lost straight away: have it back
    if (bonus) { const total = bonus * mult; score += total; popText(`BONUS ${bonus.toLocaleString()} × ${mult} = ${total.toLocaleString()}`, 165, 250, '#ffd23f', 14); ann = { n: ++annN, text: `BONUS ${bonus.toLocaleString()} × ${mult} = ${total.toLocaleString()}`, color: '#ffd23f', size: 14, y: 250 }; }
    bonus = 0; mult = 1; lanes = [0, 0, 0];
    balls--;
    if (balls > 0) return resetBall();
    over = true; resetBall(); mission = null;
    if (!helped && score > 0 && isLead(W)) lbSubmit('pinball', 'pinball', score, `${rankName(rank)} · ${rank} missions`);
    if (score > best) { best = score; store.set('pinball-best', best); }
    W.push();
  }
  function launch() {
    if (!ball.onPlunger || over) return;
    ball.onPlunger = false; ball.vy = -(850 + 550 * charge); charge = 0;
    saveUntil = gt + 8; skillLane = Math.floor(Math.random() * 3); skillUntil = gt + 4; // a quick shot into the blinking lane is a skill shot
    if (!mission && gt >= missionNext) newMission();
  }

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
  function detectFx() { // compare with the last frame and set off the matching effects
    const p = fx.prev;
    if (p) {
      bumpers.forEach((b, k) => {
        if (b.flash <= p.fl[k] + 0.001) return;
        const big = b.pts > 50;
        fx.rings.push({ x: b.x, y: b.y, r: b.r, t: 0, color: big ? '#ffe66b' : '#ffb000' });
        sparks(b.x, b.y, big ? '#fff3a0' : '#ffc94a', big ? 10 : 6);
        popText(`+${b.pts}`, b.x, b.y - b.r - 4, big ? '#ffe66b' : '#ffc94a', big ? 15 : 12);
        fx.shake = Math.max(fx.shake, big ? 3 : 1.5); SFX.bumper(big);
      });
      flippers.forEach((f, k) => { const up = Math.abs(f.a - f.rest) > 0.05, was = Math.abs(p.f[k] - f.rest) > 0.05; if (up && !was) SFX.flip(); });
      if (p.onPlunger && !ball.onPlunger) { SFX.launch(p.charge); sparks(335, 560, '#ff8c3a', 14, 0.8); popText('LAUNCH!', 300, 520, '#ff9d5c', 16); fx.flash = 0.3; }
      if (!p.over && over) { SFX.over(); fx.drain = 1; fx.shake = 8; popText('GAME OVER', 165, 300, '#ff5d5d', 26); }
      else if (balls < p.balls) { SFX.drain(); fx.drain = 1; fx.shake = 6; popText(balls === 1 ? 'LAST BALL!' : 'BALL LOST', 165, 470, '#ff6b6b', 20); }
      if (p.over && !over) { SFX.start(); popText('MISSION START', 165, 300, '#7de3ff', 22); }
      const m = MILESTONES.find(v => p.score < v && score >= v);
      if (m) { SFX.milestone(); fx.flash = 1; popText(`${m.toLocaleString()} POINTS!`, 165, 230, '#8dff8a', 22); for (let k = 0; k < LIGHTS; k++) sparks(165, 395, `hsl(${k * 20},90%,65%)`, 2, 1.4); }
    }
    fx.prev = { fl: bumpers.map(b => b.flash), f: flippers.map(f => f.a), onPlunger: ball.onPlunger, over, balls, score, charge };
  }
  function stepFx(dt) {
    fx.parts.forEach(q => { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96; });
    fx.parts = fx.parts.filter(q => q.t < q.life);
    fx.rings.forEach(r => r.t += dt); fx.rings = fx.rings.filter(r => r.t < 0.35);
    fx.texts.forEach(x => x.t += dt); fx.texts = fx.texts.filter(x => x.t < 1);
    fx.shake *= Math.pow(0.001, dt); fx.drain = Math.max(0, fx.drain - dt * 1.5); fx.flash = Math.max(0, fx.flash - dt * 2);
    if (!ball.onPlunger) { fx.trail.push([ball.x, ball.y]); if (fx.trail.length > 10) fx.trail.shift(); } else fx.trail.length = 0;
    fx.shown += (score - fx.shown) * Math.min(1, dt * 10); if (Math.abs(score - fx.shown) < 1) fx.shown = score; // the score rolls up
  }
  function draw() {
    const now = performance.now(), dt = Math.min(0.05, (now - (fx.last || now)) / 1000); fx.last = now;
    detectFx(); stepFx(dt);
    g.save();
    if (fx.shake > 0.3) g.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
    g.drawImage(art, 0, 0);
    // the black hole, with a ring of lights that fills up as the mission goes along
    const cx = HOLE.x, cy = HOLE.y, pulse = holeLit ? 0.5 + 0.5 * Math.sin(now / 140) : 0, glow = g.createRadialGradient(cx, cy, 2, cx, cy, 30 + pulse * 6);
    glow.addColorStop(0, holeLit ? '#ffffff' : '#bff3ff'); glow.addColorStop(0.4, holeLit ? '#b06bff' : '#3cb7ff'); glow.addColorStop(1, 'rgba(20,60,160,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, 30 + pulse * 6, 0, Math.PI * 2); g.fill();
    if (held) { g.strokeStyle = 'rgba(220,190,255,.8)'; g.lineWidth = 2; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(cx, cy, 6 + ((now / 8 + k * 7) % 20), now / 100 + k, now / 100 + k + 4); g.stroke(); } }
    if (holeLit) { g.fillStyle = `rgba(255,255,255,${0.6 + pulse * 0.4})`; g.font = 'bold 9px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.fillText('LIT', cx, cy + 22); }
    const done = mission ? Math.floor(LIGHTS * mission.prog / mission.goal) : 0;
    for (let k = 0; k < LIGHTS; k++) {
      const ang = k / LIGHTS * Math.PI * 2 - Math.PI / 2, on = fx.flash > 0.2 || k < done || Math.floor(now / 90) % LIGHTS === k || (!mission && score && (k + Math.floor(now / 400)) % 6 === 0);
      g.fillStyle = k < done ? '#7dff8a' : on ? '#ffd23f' : '#6b3a1c'; g.beginPath(); g.arc(cx + Math.cos(ang) * 40, cy + Math.sin(ang) * 40, 3.5, 0, Math.PI * 2); g.fill();
    }
    // top lane lights (the skill-shot lane blinks after a launch)
    LANES.forEach((x, i) => {
      const blink = i === skillLane && gt < skillUntil && Math.floor(now / 150) % 2;
      g.fillStyle = lanes[i] ? '#ffd23f' : blink ? '#ff9df5' : '#3a2a10'; g.beginPath(); g.arc(x, 72, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.stroke();
    });
    // drop targets and the rocket target
    TARGETS.forEach((y, k) => {
      if (targets[k]) { g.fillStyle = '#e8473c'; g.fillRect(13, y, 8, 16); g.fillStyle = '#ffd9a8'; g.fillRect(13, y + 6, 8, 4); }
      else { g.fillStyle = '#2a1414'; g.fillRect(13, y + 12, 8, 4); }
    });
    g.fillStyle = rocketFlash > 0 ? '#fff6a8' : '#2fb3e8'; g.fillRect(311, ROCKET[1], 7, ROCKET[3] - ROCKET[1]);
    g.fillStyle = '#0b2a40'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; [..."FUEL"].forEach((ch, k) => g.fillText(ch, 314.5, ROCKET[1] + 9 + k * 8));
    if (mult > 1) { g.fillStyle = '#ffd23f'; g.font = '900 13px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.fillText(`${mult}X`, 165, 470); }
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
    // bumper shock rings
    fx.rings.forEach(r => { const k = r.t / 0.35; g.strokeStyle = r.color; g.globalAlpha = 1 - k; g.lineWidth = 3 * (1 - k) + 1; g.beginPath(); g.arc(r.x, r.y, r.r + 4 + k * 22, 0, Math.PI * 2); g.stroke(); });
    g.globalAlpha = 1;
    // ball trail: a fading streak, longer the faster it goes
    const speed = Math.hypot(ball.vx || 0, ball.vy || 0);
    fx.trail.forEach(([x, y], k) => { const a = (k + 1) / fx.trail.length; g.fillStyle = `rgba(150,210,255,${a * 0.35})`; g.beginPath(); g.arc(x, y, R * (0.4 + a * 0.5), 0, Math.PI * 2); g.fill(); });
    if (speed > 900 || fx.trail.length > 1 && Math.hypot(fx.trail[fx.trail.length - 1][0] - fx.trail[0][0], fx.trail[fx.trail.length - 1][1] - fx.trail[0][1]) > 90) { // glow when it's flying
      const hg = g.createRadialGradient(ball.x, ball.y, R * 0.5, ball.x, ball.y, R * 2.4); hg.addColorStop(0, 'rgba(140,220,255,.45)'); hg.addColorStop(1, 'rgba(140,220,255,0)');
      g.fillStyle = hg; g.beginPath(); g.arc(ball.x, ball.y, R * 2.4, 0, Math.PI * 2); g.fill();
    }
    [ball, ...extra].forEach(b => {
      const bb = g.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, R);
      bb.addColorStop(0, '#ffffff'); bb.addColorStop(0.5, '#b9c2cf'); bb.addColorStop(1, '#4b5464');
      g.fillStyle = bb; g.beginPath(); g.arc(b.x, b.y, held && b === held.b ? R * 0.6 : R, 0, Math.PI * 2); g.fill();
    });
    fx.parts.forEach(q => { g.globalAlpha = Math.max(0, 1 - q.t / q.life); g.fillStyle = q.color; g.fillRect(q.x - 1.5, q.y - 1.5, 3, 3); });
    g.globalAlpha = 1;
    // charging the plunger: the lane glows brighter the harder you pull
    if (ball.onPlunger && charge > 0) { const lg = g.createLinearGradient(0, 600, 0, 380); lg.addColorStop(0, `rgba(255,120,40,${0.15 + charge * 0.45})`); lg.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = lg; g.fillRect(322, 380, 26, 220); }
    if (fx.drain > 0) { const dg = g.createLinearGradient(0, TH, 0, TH - 220); dg.addColorStop(0, `rgba(255,30,30,${fx.drain * 0.6})`); dg.addColorStop(1, 'rgba(255,30,30,0)'); g.fillStyle = dg; g.fillRect(0, 0, TW, TH); }
    if (fx.flash > 0) { g.fillStyle = `rgba(255,255,255,${fx.flash * 0.25})`; g.fillRect(0, 0, TW, TH); }
    fx.texts.forEach(x => {
      const a = x.t < 0.1 ? x.t / 0.1 : Math.max(0, 1 - (x.t - 0.55) / 0.45), sc = x.t < 0.1 ? 0.5 + 5 * x.t : 1;
      g.save(); g.globalAlpha = a; g.translate(x.x, x.y - x.t * 26); g.scale(sc, sc);
      g.font = `900 ${x.size}px "Trebuchet MS", sans-serif`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(x.text, 0, 0); g.fillStyle = x.color; g.fillText(x.text, 0, 0);
      g.restore();
    });
    g.restore();
    // score panel
    panel.ball.textContent = over ? '-' : Math.min(3, 4 - balls);
    panel.score.textContent = Math.round(fx.shown);
    panel.score.classList.toggle('up', fx.shown < score);
    const M = mission && MISSIONS[mission.k];
    let msg = '', info = `Rank: ${rankName(rank)}\nBonus ${mult}X · ${bonus.toLocaleString()}\n\n`
      + (M ? `Mission:\n${M.text(mission.goal)}\n${mission.prog} / ${mission.goal} · ${Math.max(0, Math.ceil(mission.left))}s left` : over ? '' : 'Next mission\nsoon…')
      + `\n\nHigh score ${best}`;
    if (over) msg = 'Game Over\nSpace to play again';
    else if (paused) msg = 'Game Paused\nF3 to Resume';
    else if (!inUse(W)) msg = 'Game Paused\nClick to Resume';
    else if (ball.onPlunger) msg = charging ? 'Launch!' : 'Hold Space\nto launch';
    else if (extra.length) msg = 'MULTIBALL!';
    else msg = M ? 'Mission in\nprogress' : 'Hit things for\na new mission';
    if (panel.msg.textContent !== msg) panel.msg.textContent = msg;
    if (panel.info.textContent !== info) panel.info.textContent = info;
  }
  W.body.querySelector('.pb-lb').onclick = () => openLeaderboards('pinball');
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
      if (!ball.onPlunger || extra.length) {
        gt += dt; rocketFlash = Math.max(0, rocketFlash - dt);
        if (mission) { mission.left -= dt; if (mission.left <= 0) { mission = null; missionNext = gt + 4; announce('MISSION FAILED', '#ff6b6b', 18, 'fail', 180); } }
        else if (missionNext && gt >= missionNext) newMission();
      }
      if (held && gt >= held.until) { // fire it back out of the hole
        const b = held.b; b.held = false; b.vx = (Math.random() - 0.5) * 300; b.vy = -620;
        if (held.multi) { extra.push({ x: HOLE.x, y: HOLE.y, vx: -b.vx - 80, vy: -560, onPlunger: false, inLane: false, lane: -1 }); saveUntil = gt + 6; }
        held = null; SFX.launch(0.3);
      }
      if (targetsBack && gt >= targetsBack) { targets = [1, 1, 1]; targetsBack = 0; }
      if (live() && ++sendTick % 2) W.push();
    }
    draw();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // in a room the opener's computer runs the table; the others send flipper and plunger presses
  const flip = (side, on) => {
    if (!isLead(W)) return sendInput(W, { flip: [side, on] });
    if (on && !flippers[side].on && !ball.onPlunger) lanes = side ? [lanes[2], lanes[0], lanes[1]] : [lanes[1], lanes[2], lanes[0]]; // flippers move the lit lanes along
    flippers[side].on = on;
  };
  const plunge = on => {
    if (!isLead(W)) return sendInput(W, { plunge: on });
    if (on) { if (over) newGame(); else if (ball.onPlunger) charging = true; }
    else if (charging) { charging = false; launch(); }
    W.push();
  };
  const togglePause = () => { if (!isLead(W)) return sendInput(W, { pause: 1 }); if (!over) paused = !paused; W.push(); };
  W.onInput = d => { if (d.flip || d.plunge) helped = true; if (d.flip) flip(...d.flip); if (d.plunge != null) plunge(d.plunge); if (d.pause) togglePause(); };
  shareState(W, () => ({ b: [ball.x, ball.y, ball.onPlunger, ball.inLane], f: flippers.map(f => f.a), fl: bumpers.map(b => b.flash), score, balls, over, charge, charging, paused,
    x: extra.map(b => [Math.round(b.x), Math.round(b.y)]), lanes, targets, mult, bonus, holeLit, held: !!held, rank, rf: rocketFlash, sk: gt < skillUntil ? skillLane : -1,
    m: mission ? [mission.k, mission.prog, mission.goal, Math.ceil(mission.left)] : null, ann }), d => {
    paused = !!d.paused;
    [ball.x, ball.y, ball.onPlunger, ball.inLane] = d.b;
    extra = (d.x || []).map(([x, y]) => ({ x, y }));
    ({ lanes = [0, 0, 0], targets = [1, 1, 1], mult = 1, bonus = 0, holeLit = false, rank = 0 } = d); rocketFlash = d.rf || 0; skillLane = d.sk ?? -1; skillUntil = d.sk >= 0 ? Infinity : 0;
    held = d.held ? {} : null;
    mission = d.m ? { k: d.m[0], prog: d.m[1], goal: d.m[2], left: d.m[3] } : null;
    if (d.ann && (!ann || d.ann.n !== ann.n)) { ann = d.ann; popText(ann.text, 165, ann.y || 200, ann.color, ann.size); if (ann.sfx && SFX[ann.sfx]) SFX[ann.sfx](); }
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
  W.onClose = () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', onDown); document.removeEventListener('keyup', onUp); W.closeSynth(); pbWin = null; };
  pbWin = W;
  return W;
}

/* ---------- snake ---------- */
let snWin = null;
function openSnake() {
  if (snWin) { focusWin(snWin); return snWin; }
  const N = 20, C = 20, S = N * C;
  const W = makeWin({ title: 'Snake', icon: I.snake, w: 440, h: 540 });
  W.body.innerHTML = `<div class="sn"><div class="sn-top"><span class="sn-score"></span><span class="sn-best"></span><button class="tbtn sn-lb">🏆</button></div><div class="sn-wrap"><canvas class="sn-c" width="${S}" height="${S}" aria-label="Snake board"></canvas></div>`
    + '<div class="sn-help">Arrow keys or WASD to steer · P or Space to pause<br>Touch: swipe to steer, tap to start</div></div>';
  const cv = W.body.querySelector('canvas'), g = cv.getContext('2d');
  const scoreEl = W.body.querySelector('.sn-score'), bestEl = W.body.querySelector('.sn-best');
  W.body.querySelector('.sn-lb').onclick = () => openLeaderboards('snake'); W.body.querySelector('.sn-lb').title = 'Leaderboard';
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  let snake, dir, queue, food, score, best = store.get('snake-best', 0), state, acc = 0, last = 0, raf = 0, dirty = false, helped = false; // helped: someone else steered
  const speed = () => Math.max(60, 140 - score / 10 * 4); // ms per step, faster with every apple
  function placeFood() {
    const free = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!snake.some(p => p[0] === x && p[1] === y)) free.push([x, y]);
    food = free[Math.floor(Math.random() * free.length)];
  }
  function newGame() {
    snake = [[8, 10], [7, 10], [6, 10]]; dir = DIRS.right; queue = []; score = 0; state = 'ready'; acc = 0; helped = false;
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
      if (!helped && score > 0 && isLead(W)) lbSubmit('snake', 'snake', score, `length ${snake.length}`);
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
  W.onInput = d => { if (d.turn) { helped = true; resume(); turn(d.turn); } if (d.pause) pause(); };
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
        c.className = 'ttt-c' + (v === 0 ? ' x' : v === 1 ? ' o' : '') + (line.includes(i) ? ' won' : '') + (v < 0 && view.mine ? ' can' : '');
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
        h.className = 'c4-h' + (v === 0 ? ' red' : v === 1 ? ' yel' : '') + (line.includes(i) ? ' won' : '');
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
      if (st.daily && lbSolo()) lbSubmit('sudoku', `sudoku:${st.day}`, st.time, `solved in ${lbTime(st.time)}`);
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
    Game: [['Daily puzzle', () => newPuzzle(true), () => st.daily], ['New random puzzle', () => newPuzzle(false), () => !st.daily], ['Leaderboard', () => openLeaderboards('sudoku')], ['Close', () => closeWin(W)]],
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
  W.onClose = () => { prevClose && prevClose(); flush(); store.set('pixel-doc', serialize()); clearInterval(ants); clearInterval(anim); document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); pxWin = null; };
  pxWin = W;
  loadDoc(store.get('pixel-doc', null));
  refresh();
  requestAnimationFrame(() => { fit(); });
  render();
  return W;
}

/* ---------- air hockey ---------- */
// Red defends the bottom goal, Blue the top. An empty side is played by the computer, so it works alone too;
// in a room a friend takes a side with the button. One computer runs the puck (like Pinball) and the others
// send where their mallet is going. Everyone sees their own side at the bottom.
let ahWin = null;
function openAirHockey() {
  if (ahWin) { focusWin(ahWin); return ahWin; }
  const TW = 300, TH = 500, PR = 12, MR = 21, GOAL = 112, WIN_AT = 7;
  const W = makeWin({ title: 'Air Hockey', icon: I.airhockey, w: 420, h: 700 });
  W.body.innerHTML = '<div class="ah"><div class="ah-score"><span class="ah-s0"></span><b class="ah-msg"></b><span class="ah-s1"></span></div>'
    + '<div class="ah-wrap"><canvas class="ah-c" width="300" height="500" aria-label="Air hockey table"></canvas><div class="ah-seats"></div></div>'
    + '<div class="ah-help">Move the mouse (or your finger) on your half to move your mallet · first to 7 wins</div></div>';
  const q = sel => W.body.querySelector(sel), cv = q('.ah-c'), g = cv.getContext('2d');
  const fresh = (seats = [mp.self, null]) => ({ p: [TW / 2, TH / 2, 0, 0], m: [[TW / 2, TH - 60], [TW / 2, 60]], s: [0, 0], seats, over: -1, pause: 0 });
  let st = fresh(), aims = [null, null], prevM = st.m.map(m => [...m]), raf = 0, last = 0, tick = 0, myAim = null;
  const mySeat = () => st.seats.indexOf(mp.self);
  const flip = () => mySeat() === 1; // the top player sees the table turned around
  const toTable = e => { const r = lrect(cv); let x = (cX(e) - r.left) / r.width * TW, y = (cY(e) - r.top) / r.height * TH; if (flip()) { x = TW - x; y = TH - y; } return [x, y]; };
  const clampMallet = (k, x, y) => [Math.max(MR, Math.min(TW - MR, x)), k === 0 ? Math.max(TH / 2 + MR, Math.min(TH - MR, y)) : Math.max(MR, Math.min(TH / 2 - MR, y))];
  function serve(toward) { st.p = [TW / 2, toward === 0 ? TH * 0.62 : TH * 0.38, 0, 0]; st.pause = 0.6; }
  function step(dt) { // runs on the computer that holds the game
    if (st.over >= 0) return;
    for (let k = 0; k < 2; k++) { // mallets chase their aim (a player's pointer or the computer's plan)
      let aim = st.seats[k] ? aims[k] : cpuAim(k);
      if (!aim) continue;
      aim = clampMallet(k, ...aim);
      const m = st.m[k], dx = aim[0] - m[0], dy = aim[1] - m[1], d = Math.hypot(dx, dy), max = (st.seats[k] ? 2200 : 520) * dt;
      if (d > max) { m[0] += dx / d * max; m[1] += dy / d * max; } else { m[0] = aim[0]; m[1] = aim[1]; }
    }
    if (st.pause > 0) { st.pause -= dt; prevM = st.m.map(m => [...m]); return; }
    const p = st.p;
    p[0] += p[2] * dt; p[1] += p[3] * dt;
    const f = Math.pow(0.6, dt); p[2] *= f; p[3] *= f; // air friction
    if (p[0] < PR) { p[0] = PR; p[2] = Math.abs(p[2]) * 0.9; } else if (p[0] > TW - PR) { p[0] = TW - PR; p[2] = -Math.abs(p[2]) * 0.9; }
    const inMouth = Math.abs(p[0] - TW / 2) < GOAL / 2 - PR / 2;
    if (!inMouth) { if (p[1] < PR) { p[1] = PR; p[3] = Math.abs(p[3]) * 0.9; } else if (p[1] > TH - PR) { p[1] = TH - PR; p[3] = -Math.abs(p[3]) * 0.9; } }
    if (p[1] < -PR || p[1] > TH + PR) { // goal
      const scorer = p[1] < 0 ? 0 : 1; st.s[scorer]++;
      if (st.s[scorer] >= WIN_AT) st.over = scorer; else serve(1 - scorer);
      return;
    }
    for (let k = 0; k < 2; k++) {
      const m = st.m[k], mv = [(m[0] - prevM[k][0]) / dt, (m[1] - prevM[k][1]) / dt];
      const dx = p[0] - m[0], dy = p[1] - m[1], d = Math.hypot(dx, dy);
      if (d >= PR + MR || d === 0) continue;
      const nx = dx / d, ny = dy / d;
      p[0] = m[0] + nx * (PR + MR); p[1] = m[1] + ny * (PR + MR);
      const rel = (p[2] - mv[0]) * nx + (p[3] - mv[1]) * ny;
      if (rel < 0) { p[2] -= 1.9 * rel * nx; p[3] -= 1.9 * rel * ny; }
    }
    const sp = Math.hypot(p[2], p[3]); if (sp > 1100) { p[2] *= 1100 / sp; p[3] *= 1100 / sp; }
    prevM = st.m.map(m => [...m]);
  }
  function cpuAim(k) { // stay between the puck and the goal; strike when the puck is on our half and not racing away
    const [px, py, vx, vy] = st.p, home = k === 1 ? 52 : TH - 52, mine = k === 1 ? py < TH / 2 : py > TH / 2;
    if (mine && (k === 1 ? vy < 260 : vy > -260)) return [px + (px - TW / 2) * 0.15, py + (k === 1 ? -PR : PR)];
    const t = Math.max(0, Math.min(0.6, Math.abs((home - py) / (vy || 1))));
    return [Math.max(MR, Math.min(TW - MR, TW / 2 + (px + vx * t - TW / 2) * 0.55)), home];
  }
  function draw() {
    g.save();
    if (flip()) { g.translate(TW, TH); g.rotate(Math.PI); }
    g.fillStyle = '#eaf6ff'; g.fillRect(0, 0, TW, TH);
    g.strokeStyle = 'rgba(40,110,200,.35)'; g.lineWidth = 2;
    g.beginPath(); g.arc(TW / 2, TH / 2, 46, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(TW / 2, 0, GOAL / 2 + 22, 0, Math.PI); g.stroke(); g.beginPath(); g.arc(TW / 2, TH, GOAL / 2 + 22, Math.PI, 0); g.stroke();
    g.strokeStyle = 'rgba(220,40,60,.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, TH / 2); g.lineTo(TW, TH / 2); g.stroke();
    for (const [y, c] of [[0, '#2a6fe0'], [TH, '#e0283d']]) { g.fillStyle = c; g.fillRect(TW / 2 - GOAL / 2, y === 0 ? 0 : TH - 6, GOAL, 6); }
    g.strokeStyle = '#9fb3c8'; g.lineWidth = 6; g.strokeRect(3, 3, TW - 6, TH - 6);
    const p = st.p; // puck, a little ahead when it's someone else's simulation (smoother)
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(p[0] + 2, p[1] + 3, PR, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#222'; g.beginPath(); g.arc(p[0], p[1], PR, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#555'; g.lineWidth = 2; g.beginPath(); g.arc(p[0], p[1], PR - 4, 0, Math.PI * 2); g.stroke();
    st.m.forEach((m, k) => {
      const [x, y] = k === mySeat() && myAim && !isLead(W) ? clampMallet(k, ...myAim) : m; // my own mallet follows my pointer right away
      const col = k ? ['#2a6fe0', '#9cc0ff'] : ['#e0283d', '#ff9aa5'];
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.arc(x + 2, y + 4, MR, 0, Math.PI * 2); g.fill();
      const gr = g.createRadialGradient(x - 6, y - 6, 2, x, y, MR); gr.addColorStop(0, col[1]); gr.addColorStop(1, col[0]);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, MR, 0, Math.PI * 2); g.fill();
      g.fillStyle = col[0]; g.beginPath(); g.arc(x, y, MR * 0.45, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, MR * 0.45, 0, Math.PI * 2); g.stroke();
    });
    g.restore();
    const who = k => st.seats[k] ? personName(st.seats[k]) : 'Computer';
    const [lo, hi] = flip() ? [1, 0] : [0, 1];
    q('.ah-s0').innerHTML = `<i class="ah-dot ${hi ? 'blue' : 'red'}"></i>${esc(who(hi))} <b>${st.s[hi]}</b>`;
    q('.ah-s1').innerHTML = `<b>${st.s[lo]}</b> ${esc(who(lo))}<i class="ah-dot ${lo ? 'blue' : 'red'}"></i>`;
    q('.ah-msg').textContent = st.over >= 0 ? `${who(st.over)} wins!` : !inUse(W) ? 'Paused' : '';
  }
  function seats() { // buttons to take or leave a side
    const box = q('.ah-seats'), mine = mySeat();
    const html = [];
    if (st.over >= 0) html.push('<button class="okbtn" data-a="again">Play again</button>');
    for (const k of [0, 1]) if (!st.seats[k] && mine < 0) html.push(`<button class="okbtn" data-a="seat${k}">Play ${k ? 'Blue (top)' : 'Red (bottom)'}</button>`);
    if (mine >= 0 && live()) html.push('<button class="tbtn" data-a="leave">Leave my side</button>');
    const sig = html.join('');
    if (box.dataset.sig !== sig) { box.dataset.sig = sig; box.innerHTML = sig; box.querySelectorAll('button').forEach(b => b.onclick = () => act(b.dataset.a)); }
  }
  const ask = (d, fn) => { if (isLead(W)) { fn(mp.self); W.push(); } else sendInput(W, d); };
  function act(a) {
    if (a === 'again') ask({ again: 1 }, () => { st = fresh(st.seats); aims = [null, null]; });
    else if (a.startsWith('seat')) { const k = +a[4]; ask({ seat: k }, who => takeSeat(k, who)); }
    else if (a === 'leave') ask({ leave: 1 }, who => leaveSeat(who));
  }
  const takeSeat = (k, who) => { if (!st.seats[k] && !st.seats.includes(who)) st.seats[k] = who; };
  const leaveSeat = who => { st.seats = st.seats.map(s => s === who ? null : s); };
  W.onInput = (d, from) => {
    if (d.aim) { const k = st.seats.indexOf(from); if (k >= 0) aims[k] = d.aim.map(Number); return; }
    if (d.again) { st = fresh(st.seats); aims = [null, null]; }
    if (d.seat != null) takeSeat(d.seat | 0, from);
    if (d.leave) leaveSeat(from);
    W.push();
  };
  shareState(W, () => st, d => { st = d; });
  let aimSent = 0;
  cv.addEventListener('pointermove', e => {
    if (mySeat() < 0) return;
    myAim = toTable(e);
    if (isLead(W)) aims[mySeat()] = myAim;
    else if (performance.now() - aimSent > 30) { aimSent = performance.now(); sendInput(W, { aim: myAim.map(v => Math.round(v)) }); }
  });
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); cv.dispatchEvent(new PointerEvent('pointermove', e)); });
  cv.style.touchAction = 'none';
  function frame(t) {
    const dt = Math.min(0.033, (t - last) / 1000 || 0); last = t;
    if (isLead(W) && inUse(W)) {
      for (let k = 0; k < 4; k++) step(dt / 4);
      if (live() && ++tick % 2) W.push();
    }
    draw(); seats();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  W.onClose = () => { cancelAnimationFrame(raf); ahWin = null; };
  ahWin = W;
  return W;
}

/* ---------- tetris ---------- */
// Solo, or Versus in a room: everyone gets the same pieces, clearing 2+ lines sends junk rows to an
// opponent, last one standing wins. Each person's board runs on their own computer; boards are shared
// for watching and the junk rows are sent as messages.
const TT_COLORS = { I: '#2fd3e8', O: '#f5d33b', T: '#a95ce0', S: '#5bd35b', Z: '#ef4b4b', J: '#3b6fe8', L: '#f39a2e', G: '#8a8f99' };
const TT_SHAPES = { I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]] };
// standard wall kicks (y down), for rotating from state a to state b
const TT_KICKS = {
  '01': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], '10': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], '12': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '21': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], '23': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], '32': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '30': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '03': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]] };
const TT_KICKS_I = {
  '01': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]], '10': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]], '12': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '21': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]], '23': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]], '32': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '30': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]], '03': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]] };
function ttCells(type, rot) { // the piece's cells after `rot` quarter turns clockwise inside its box
  const n = type === 'I' ? 4 : type === 'O' ? 4 : 3;
  return TT_SHAPES[type].map(([x, y]) => { for (let k = 0; k < rot; k++) [x, y] = [n - 1 - y, x]; return [x, y]; });
}
let ttWin = null;
function openTetris() {
  if (ttWin) { focusWin(ttWin); return ttWin; }
  const COLS = 10, ROWS = 20, HID = 2, CELL = 26;
  const W = makeWin({ title: 'Tetris', icon: I.tetris, w: 640, h: 640 });
  W.body.innerHTML = '<div class="tt"><div class="tt-side"><h4>Hold</h4><canvas class="tt-hold" width="104" height="70"></canvas><div class="tt-stats"></div>'
    + '<div class="tt-btns"><button class="okbtn tt-solo">New game</button><button class="okbtn tt-vs" hidden>Versus room</button><button class="okbtn tt-share" hidden></button><button class="okbtn tt-set">Settings</button><button class="okbtn tt-lb">🏆 Leaderboard</button></div></div>'
    + '<div class="tt-mid"><canvas class="tt-c" width="260" height="520" aria-label="Tetris board"></canvas><div class="tt-note"></div></div>'
    + '<div class="tt-side"><h4>Next</h4><canvas class="tt-next" width="104" height="260"></canvas><div class="tt-opps"></div></div>'
    + '<div class="tt-touch"><button data-k="left">◀</button><button data-k="rot">⟳</button><button data-k="right">▶</button><button data-k="soft">▼</button><button data-k="drop">⤓</button><button data-k="hold">Hold</button></div>'
    + '<div class="tt-help"></div><div class="tt-cfg" hidden></div></div>';
  const q = sel => W.body.querySelector(sel), cv = q('.tt-c'), g = cv.getContext('2d');
  let grid, cur, bag, rnd, queue, hold, canHold, score, lines, level, over, paused, dropT, lockT, lockMoves, versus = null, junk = 0, countdown = 0, raf = 0, last = 0, best = store.get('tetris-best', 0);
  let combo = -1, b2b = false, lastRot = false;
  // effects: particles, flashes, pop-up words and shake; they only change how things look
  const newFx = () => ({ parts: [], flashes: [], texts: [], trails: [], shake: 0, glow: 0, glowColor: '#fff', hit: 0, deadAt: 0 });
  let fx = newFx();
  // watching: in a room, people who aren't playing see someone else's game live (sent ~10 times a second);
  // the player can let the watchers press keys too
  const remoteOpen = !!mp.incoming && live();
  let helped = false; // someone else pressed keys in this game: it doesn't go on the leaderboard
  const lbSolo2 = () => true; // a Tetris game is your own even in a room, unless you let others play
  let idle = remoteOpen, viewing = null, allowCtrl = false, vfx = newFx(), soloT = 0, outbox = [];
  const views = new Map(); // id -> { v: their latest board, at }
  const pop = (text, color = '#fff', size = 22) => {
    fx.texts.push({ text, color, size, t: 0 }); if (fx.texts.length > 4) fx.texts.shift();
    if (fx !== vfx && !versus && live()) outbox.push(['p', text, color, size]);
  };
  const burst = (x, y, color, n = 6, power = 1) => { for (let k = 0; k < n; k++) fx.parts.push({ x, y, vx: (Math.random() - 0.5) * 260 * power, vy: (-Math.random() * 220 - 40) * power, life: 0.5 + Math.random() * 0.5, t: 0, color, size: 2 + Math.random() * 3 }); };
  const tone = makeSynth(W, 'tetris', 'Tetris');
  const SFX = {
    move: () => tone(420, 0.03, { vol: 0.04 }),
    rotate: () => tone(620, 0.05, { vol: 0.05, slide: 200 }),
    hold: () => tone(330, 0.08, { type: 'triangle', vol: 0.1, slide: 220 }),
    lock: () => tone(140, 0.08, { type: 'triangle', vol: 0.18, slide: -60 }),
    drop: () => { tone(90, 0.16, { type: 'sawtooth', vol: 0.12, slide: -50 }); tone(200, 0.06, { type: 'triangle', vol: 0.12 }); },
    clear: (n, c) => { const base = 520 * Math.pow(1.06, Math.max(0, c)); [0, 4, 7, 12].slice(0, n + 1).forEach((st, k) => tone(base * Math.pow(2, st / 12), 0.16, { type: 'square', vol: 0.07, at: k * 0.05 })); },
    tetris: () => [0, 4, 7, 12, 16, 19, 24].forEach((st, k) => tone(523 * Math.pow(2, st / 12), 0.22, { type: 'square', vol: 0.07, at: k * 0.045 })),
    level: () => [0, 7, 12].forEach((st, k) => tone(392 * Math.pow(2, st / 12), 0.2, { type: 'triangle', vol: 0.14, at: k * 0.09 })),
    junk: () => { tone(110, 0.25, { type: 'sawtooth', vol: 0.12, slide: -40 }); tone(73, 0.3, { type: 'square', vol: 0.06 }); },
    count: last => tone(last ? 880 : 440, last ? 0.3 : 0.12, { type: 'triangle', vol: 0.15 }),
    over: () => [0, -3, -7, -12].forEach((st, k) => tone(330 * Math.pow(2, st / 12), 0.3, { type: 'triangle', vol: 0.13, at: k * 0.15 })),
    win: () => [0, 4, 7, 12, 7, 12].forEach((st, k) => tone(523 * Math.pow(2, st / 12), 0.2, { type: 'square', vol: 0.08, at: k * 0.1 })),
  };
  const opps = new Map(); // other players in versus: id -> { name, color, grid, score, lines, over }
  const empty = () => Array.from({ length: ROWS + HID }, () => Array(COLS).fill(''));
  function nextPiece() {
    if (queue.length < 7) { const b = shuffleBy(Object.keys(TT_SHAPES), rnd); queue.push(...b); } // 7-bag
    return queue.shift();
  }
  function spawn(type) {
    cur = { t: type, r: 0, x: 3, y: 0 };
    if (!fits(cur.x, cur.y, cur.r)) { gameOver(); return; }
    lockT = 0; lockMoves = 0; canHold = true; lastRot = false;
  }
  function start(seed) {
    grid = empty(); rnd = seed != null ? seededRandom('tetris|' + seed) : Math.random; queue = []; hold = null; score = 0; lines = 0; level = 1; over = false; paused = false; dropT = 0; junk = 0;
    combo = -1; b2b = false; Object.assign(fx, { parts: [], flashes: [], texts: [], trails: [], shake: 0, glow: 0, hit: 0, deadAt: 0 }); won = false;
    idle = false; viewing = null; helped = false;
    spawn(nextPiece()); draw();
  }
  const fits = (x, y, r, t = cur.t) => ttCells(t, r).every(([cx, cy]) => { const X = x + cx, Y = y + cy; return X >= 0 && X < COLS && Y < ROWS + HID && (Y < 0 || !grid[Y][X]); });
  const move = (dx, dy) => { if (over || paused || countdown > 0 || !fits(cur.x + dx, cur.y + dy, cur.r)) return false; cur.x += dx; cur.y += dy; lastRot = false; if (lockT && lockMoves < 15) { lockT = 0; lockMoves++; } return true; };
  function rotate(dir) {
    if (over || paused || countdown > 0 || cur.t === 'O') return;
    const to = (cur.r + dir + 4) % 4, kicks = (cur.t === 'I' ? TT_KICKS_I : TT_KICKS)[`${cur.r}${to}`];
    for (const [kx, ky] of kicks) if (fits(cur.x + kx, cur.y - ky, to)) { cur.x += kx; cur.y -= ky; cur.r = to; lastRot = true; SFX.rotate(); if (lockT && lockMoves < 15) { lockT = 0; lockMoves++; } return; }
  }
  const ghostY = () => { let y = cur.y; while (fits(cur.x, y + 1, cur.r)) y++; return y; };
  function hardDrop() {
    if (over || paused || countdown > 0) return;
    const y = ghostY(), cells = ttCells(cur.t, cur.r);
    if (y !== cur.y) {
      lastRot = false;
      cells.forEach(([cx, cy]) => fx.trails.push({ x: cur.x + cx, y0: cur.y + cy - HID, y1: y + cy - HID, color: TT_COLORS[cur.t], t: 0 }));
    }
    score += 2 * (y - cur.y); cur.y = y;
    const bottom = Math.max(...cells.map(([, cy]) => cy));
    cells.filter(([, cy]) => cy === bottom).forEach(([cx]) => burst((cur.x + cx + 0.5) * CELL, (y + bottom + 1 - HID) * CELL, '#cfd8ff', 3, 0.5));
    fx.shake = Math.max(fx.shake, 5); SFX.drop(); lock(true);
  }
  function doHold() {
    if (over || paused || countdown > 0 || !canHold) return;
    const t = cur.t; if (hold) spawn(hold); else spawn(nextPiece()); hold = t; canHold = false; SFX.hold();
  }
  // T-spin: a T that was just rotated into place with 3 of the 4 corners around its middle filled
  const tCorners = () => [[0, 0], [2, 0], [0, 2], [2, 2]].filter(([dx, dy]) => { const X = cur.x + dx, Y = cur.y + dy; return X < 0 || X >= COLS || Y >= ROWS + HID || (Y >= 0 && grid[Y][X]); }).length;
  const COMBO_JUNK = [0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5];
  function lock(dropped) {
    const cells = ttCells(cur.t, cur.r), tspin = cur.t === 'T' && lastRot && tCorners() >= 3;
    cells.forEach(([cx, cy]) => { const Y = cur.y + cy; if (Y >= 0) grid[Y][cur.x + cx] = cur.t; });
    if (cells.every(([, cy]) => cur.y + cy < HID)) return gameOver(); // locked fully above the top
    const full = [];
    for (let y = 0; y < ROWS + HID; y++) if (grid[y].every(Boolean)) full.push(y);
    full.forEach(y => { // light the rows up and throw their blocks around before they go
      fx.flashes.push({ y: y - HID, t: 0 });
      if (!versus && live()) outbox.push(['r', y - HID, grid[y].join(''), full.length]);
      grid[y].forEach((c, x) => burst((x + 0.5) * CELL, (y - HID + 0.5) * CELL, TT_COLORS[c], full.length >= 4 ? 4 : 2, full.length >= 4 ? 1.4 : 1));
    });
    if (!full.length) { cells.forEach(([cx, cy]) => fx.flashes.push({ x: cur.x + cx, y: cur.y + cy - HID, t: 0, cell: true })); if (!dropped) SFX.lock(); }
    full.forEach(y => { grid.splice(y, 1); grid.unshift(Array(COLS).fill('')); });
    const cleared = full.length, hard = cleared === 4 || (tspin && cleared > 0);
    let send = 0;
    if (cleared || tspin) {
      const was = b2b, before = level;
      let pts = (tspin ? [400, 800, 1200, 1600] : [0, 100, 300, 500, 800])[cleared];
      send = (tspin ? [0, 2, 4, 6] : [0, 0, 1, 2, 4])[cleared];
      if (cleared) {
        combo++;
        if (hard && was) { pts *= 1.5; send++; }
        b2b = hard ? true : false;
        pts += 50 * combo; send += COMBO_JUNK[Math.min(combo, COMBO_JUNK.length - 1)];
      }
      lines += cleared; score += Math.round(pts * level); level = 1 + Math.floor(lines / 10);
      const perfect = cleared && grid.every(r => r.every(c => !c));
      if (perfect) { score += 2000 * level; send = 10; }
      const name = tspin ? `T-Spin ${['', 'Single', 'Double', 'Triple'][cleared]}`.trim() : ['', '', 'Double', 'Triple', 'TETRIS!'][cleared];
      if (name) pop(name, tspin ? '#d48cff' : cleared === 4 ? '#5ff0ff' : '#fff', cleared === 4 ? 30 : 24);
      if (hard && was && cleared) pop('Back-to-Back', '#ffd75e', 16);
      if (combo > 0) pop(`Combo ×${combo + 1}`, '#ff9d5c', 16 + Math.min(combo, 6) * 2);
      if (perfect) pop('PERFECT CLEAR', '#7dff8a', 26);
      if (cleared === 4 || perfect) { fx.shake = Math.max(fx.shake, 10); fx.glow = 1; fx.glowColor = '#5ff0ff'; SFX.tetris(); }
      else if (cleared) { fx.shake = Math.max(fx.shake, 2 + cleared * 2); fx.glow = 0.5 + cleared * 0.15; fx.glowColor = tspin ? '#d48cff' : '#ffffff'; SFX.clear(cleared, combo); }
      else SFX.rotate();
      if (level > before) { pop(`Level ${level}`, '#9fe870', 22); SFX.level(); }
    } else combo = -1;
    if (versus && send) { const cancel = Math.min(junk, send); junk -= cancel; if (send - cancel) attack(send - cancel); }
    else if (!cleared && junk) { const n = junk; junk = 0; if (!addJunk(n)) return; }
    spawn(nextPiece()); share();
  }
  function addJunk(n) { // rows of grey with one gap, pushed in from the bottom; returns false if that pushed you out
    const hole = Math.floor(Math.random() * COLS);
    let out = false;
    for (let k = 0; k < n; k++) { if (grid[0].some(Boolean)) out = true; grid.shift(); const row = Array(COLS).fill('G'); row[hole] = ''; grid.push(row); }
    fx.shake = Math.max(fx.shake, 4 + n * 1.5); fx.hit = 1; SFX.junk();
    if (out) { gameOver(); return false; }
    return true;
  }
  function gameOver() {
    if (over) return;
    if (!versus && !idle && !helped && score > 0 && lbSolo2()) lbSubmit('tetris', 'tetris', score, `${lines} lines · level ${level}`);
    over = true; fx.deadAt = performance.now(); fx.shake = Math.max(fx.shake, 8); SFX.over();
    if (!versus && score > best) { best = score; store.set('tetris-best', best); }
    share(); draw();
  }
  // versus: pieces come from a shared seed; boards are sent for the side view, junk goes to one living opponent
  const alive = () => [...opps.entries()].filter(([, o]) => !o.over);
  function attack(n) {
    const targets = alive(); if (!targets.length) return;
    const [id] = targets[Math.floor(Math.random() * targets.length)];
    W.push({ junk: { to: id, n, from: mp.self } });
    pop(`${n} line${n > 1 ? 's' : ''} → ${opps.get(id).name}`, '#ff8a8a', 14);
  }
  let shareT = 0, lastCount = 0, won = false;
  function share(force) {
    if (!versus || !live()) return;
    const now = performance.now(); if (!force && now - shareT < 250 && !over) return; shareT = now;
    W.push({ vs: { id: mp.self, name: me.name, color: me.color, g: grid.slice(HID).map(r => r.map(c => c || '.').join('')).join(''), score, lines, over, round: versus.round } });
  }
  const snap = () => ({ id: mp.self, name: me.name, color: me.color, g: grid.map(r => r.map(c => c || '.').join('')).join(''), c: cur && !over ? [cur.t, cur.r, cur.x, cur.y] : null,
    h: hold || '', q: queue.slice(0, 3).join(''), score, lines, level, over, paused: paused || (!W.el.classList.contains('active') && !allowCtrl), ctrl: allowCtrl,
    fx: [Math.round(fx.shake * 10) / 10, Math.round(fx.glow * 100) / 100, fx.glowColor, Math.round(fx.hit * 100) / 100], ev: outbox.splice(0) });
  function shareSolo(now) { // while playing alone in a room, send the board for anyone watching
    if (versus || idle || !live()) { outbox.length = 0; return; }
    if (now - soloT < (over ? 1000 : 100) && !outbox.length) return;
    soloT = now; W.push({ solo: snap() });
  }
  function seeSolo(v) {
    if (!v || v.id === mp.self) return;
    if (v.gone) { views.delete(v.id); if (viewing === v.id) viewing = null; return; }
    views.set(v.id, { v, at: performance.now() });
    if (viewing === v.id) (v.ev || []).forEach(e => { // replay their effects on our copy
      if (e[0] === 'p') { vfx.texts.push({ text: e[1], color: e[2], size: e[3], t: 0 }); if (vfx.texts.length > 4) vfx.texts.shift(); }
      else if (e[0] === 'r') { vfx.flashes.push({ y: e[1], t: 0 }); [...e[2]].forEach((c, x) => { const col = TT_COLORS[c]; if (col) for (let k = 0; k < (e[3] >= 4 ? 4 : 2); k++) vfx.parts.push({ x: (x + 0.5) * CELL, y: (e[1] + 0.5) * CELL, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 220 - 40, life: 0.5 + Math.random() * 0.5, t: 0, color: col, size: 2 + Math.random() * 3 }); }); }
    });
    if (v.fx) { vfx.shake = Math.max(vfx.shake, v.fx[0]); vfx.glow = Math.max(vfx.glow, v.fx[1]); vfx.glowColor = v.fx[2]; vfx.hit = Math.max(vfx.hit, v.fx[3]); }
    if (!viewing && (idle || over) && !versus && !v.over) { viewing = v.id; vfx = newFx(); } // not playing: watch them
  }
  const watched = () => { const w = viewing && views.get(viewing); return w && performance.now() - w.at < 5000 ? w.v : null; };
  function withView(v, fn) { // draw their board with our drawing code: swap their game in for a moment
    const mine = { grid, cur, hold, queue, score, lines, level, over, paused, junk, fx };
    grid = []; for (let y = 0; y < ROWS + HID; y++) grid.push([...v.g.slice(y * COLS, y * COLS + COLS)].map(c => c === '.' ? '' : c));
    cur = v.c ? { t: v.c[0], r: v.c[1], x: v.c[2], y: v.c[3] } : null; hold = v.h || null; queue = [...(v.q || '')];
    ({ score, lines, level, over } = v); paused = false; junk = 0; fx = vfx;
    try { fn(); } finally { ({ grid, cur, hold, queue, score, lines, level, over, paused, junk, fx } = mine); }
  }
  function startVersus() { // anyone in the room can start; everyone who has the window open plays
    const round = { seed: Math.floor(Math.random() * 1e9), round: Date.now() };
    W.push({ start: round }); beginVersus(round);
  }
  function beginVersus(r) {
    versus = r; opps.clear(); countdown = 3; lastCount = 4; start(r.seed); share(true);
    q('.tt-note').textContent = '';
  }
  shareState(W, () => ({}), d => {
    if (d.solo) seeSolo(d.solo);
    else if (d.ctl && d.ctl.to === mp.self && allowCtrl && !idle && !versus) { helped = true; if (d.ctl.down) press(d.ctl.k); else release(d.ctl.k); } // a watcher's key
    else if (d.start) beginVersus(d.start);
    else if (d.vs && versus && d.vs.round === versus.round && d.vs.id !== mp.self) {
      const was = opps.get(d.vs.id); opps.set(d.vs.id, d.vs);
      if (d.vs.over && was && !was.over) pop(`${d.vs.name} is out!`, d.vs.color, 16);
    } else if (d.junk && versus && d.junk.to === mp.self && !over) {
      const n = Math.min(10, d.junk.n | 0), o = opps.get(d.junk.from);
      junk += n; fx.hit = 0.6; SFX.junk();
      pop(`+${n} from ${o ? o.name : 'someone'}`, '#ff6b6b', 15);
    }
  });
  q('.tt-solo').onclick = () => { versus = null; opps.clear(); countdown = 0; start(); };
  q('.tt-share').onclick = () => { allowCtrl = !allowCtrl; soloT = 0; };
  q('.tt-vs').onclick = () => startVersus();

  function drawCell(ctx, x, y, s, t, ghost) {
    const c = TT_COLORS[t];
    if (ghost) { ctx.strokeStyle = c; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.strokeRect(x * s + 2, y * s + 2, s - 4, s - 4); ctx.globalAlpha = 1; return; }
    ctx.fillStyle = c; ctx.fillRect(x * s, y * s, s, s);
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x * s, y * s, s, 3); ctx.fillRect(x * s, y * s, 3, s);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x * s, y * s + s - 3, s, 3); ctx.fillRect(x * s + s - 3, y * s, 3, s);
  }
  function drawMini(canvas, t) {
    const c = canvas.getContext('2d'); c.clearRect(0, 0, canvas.width, canvas.height); if (!t) return;
    const cells = ttCells(t, 0), s = 20, minX = Math.min(...cells.map(p => p[0])), maxX = Math.max(...cells.map(p => p[0])), minY = Math.min(...cells.map(p => p[1])), maxY = Math.max(...cells.map(p => p[1]));
    const ox = (canvas.width - (maxX - minX + 1) * s) / 2 - minX * s, oy = (70 - (maxY - minY + 1) * s) / 2 - minY * s;
    c.save(); c.translate(ox, oy); cells.forEach(([x, y]) => drawCell(c, x, y, s, t)); c.restore();
  }
  let drawingView = null;
  function draw() {
    if (!drawingView && !versus) { const v = watched(); if (v) { drawingView = v; try { withView(v, draw); } finally { drawingView = null; } return; } }
    g.fillStyle = '#10131c'; g.fillRect(0, 0, cv.width, cv.height);
    g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1;
    for (let x = 1; x < COLS; x++) { g.beginPath(); g.moveTo(x * CELL + 0.5, 0); g.lineTo(x * CELL + 0.5, ROWS * CELL); g.stroke(); }
    for (let y = 1; y < ROWS; y++) { g.beginPath(); g.moveTo(0, y * CELL + 0.5); g.lineTo(COLS * CELL, y * CELL + 0.5); g.stroke(); }
    const dead = over && fx.deadAt ? (performance.now() - fx.deadAt) / 40 : -1; // after a loss the stack turns grey from the bottom up
    for (let y = HID; y < ROWS + HID; y++) for (let x = 0; x < COLS; x++) if (grid[y][x]) drawCell(g, x, y - HID, CELL, dead >= 0 && ROWS + HID - y <= dead ? 'G' : grid[y][x]);
    if (!over && cur) {
      const gy = ghostY();
      ttCells(cur.t, cur.r).forEach(([cx, cy]) => { if (gy + cy >= HID) drawCell(g, cur.x + cx, gy + cy - HID, CELL, cur.t, true); });
      ttCells(cur.t, cur.r).forEach(([cx, cy]) => { if (cur.y + cy >= HID) drawCell(g, cur.x + cx, cur.y + cy - HID, CELL, cur.t); });
    }
    drawFx();
    if (junk) { g.fillStyle = '#ef4b4b'; g.fillRect(cv.width - 5, cv.height - Math.min(ROWS, junk) * CELL, 5, Math.min(ROWS, junk) * CELL); }
    let msg = '';
    if (countdown > 0) msg = String(Math.ceil(countdown));
    else if (versus && opps.size) { // versus: last one standing wins
      const left = alive();
      if (!over && !left.length) { msg = 'You win!'; if (!won) { won = true; SFX.win(); pop('VICTORY', '#ffd75e', 30); } }
      else if (over) msg = left.length === 1 ? `${left[0][1].name} wins!` : left.length ? 'Out! Watching…' : 'Game over';
    } else if (drawingView) msg = drawingView.over ? `${drawingView.name}: game over` : drawingView.paused ? `${drawingView.name} paused` : '';
    else if (idle) msg = 'Press New game to play';
    else if (over) msg = 'Game over';
    else if (paused) msg = 'Paused';
    else if (!W.el.classList.contains('active')) msg = 'Click to play';
    if (msg) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, cv.height / 2 - 30, cv.width, 60); g.fillStyle = '#fff'; g.font = 'bold 24px Segoe UI, sans-serif'; g.textAlign = 'center'; g.fillText(msg, cv.width / 2, cv.height / 2 + 8); }
    drawMini(q('.tt-hold'), hold);
    const nc = q('.tt-next'), n2 = nc.getContext('2d'); n2.clearRect(0, 0, nc.width, nc.height);
    queue.slice(0, 3).forEach((t, k) => { const tmp = document.createElement('canvas'); tmp.width = 104; tmp.height = 70; drawMini(tmp, t); n2.drawImage(tmp, 0, k * 84); });
    q('.tt-stats').innerHTML = `<div><small>Score</small><b>${score}</b></div><div><small>Lines</small><b>${lines}</b></div><div><small>Level</small><b>${level}</b></div>${versus || drawingView ? '' : `<div><small>Best</small><b>${best}</b></div>`}`;
    q('.tt-vs').hidden = !live();
    const sh = q('.tt-share'); sh.hidden = !live() || !!versus || idle || !!drawingView;
    if (!sh.hidden) { const t = allowCtrl ? 'Others can play: On' : 'Others can play: Off'; if (sh.textContent !== t) sh.textContent = t; sh.classList.toggle('on', allowCtrl); }
    const note = q('.tt-note'), players = [...views.values()].filter(w => performance.now() - w.at < 5000 && !w.v.over).map(w => w.v);
    const banner = drawingView ? `👀 Watching ${esc(drawingView.name)}${drawingView.ctrl ? ' · they let you play: your keys move their pieces' : ''}`
      : !versus && live() && players.length ? `${players.map(v => `<button class="tt-watchbtn" data-id="${esc(v.id)}">👀 Watch ${esc(v.name)}</button>`).join('')}` : '';
    if (note.dataset.h !== banner) { note.dataset.h = banner; note.innerHTML = banner; note.querySelectorAll('.tt-watchbtn').forEach(b => b.onclick = () => { viewing = b.dataset.id; vfx = newFx(); }); }
    const box = q('.tt-opps');
    box.innerHTML = versus && opps.size ? '<h4>Opponents</h4>' : '';
    if (versus) opps.forEach(o => {
      const c = el(`<div class="tt-opp${o.over ? ' out' : ''}"><canvas width="60" height="120"></canvas><span></span></div>`);
      c.querySelector('span').textContent = `${o.name} · ${o.score}${o.over ? ' · out' : ''}`; c.querySelector('span').style.color = o.color;
      const cc = c.firstChild.getContext('2d'); cc.fillStyle = '#10131c'; cc.fillRect(0, 0, 60, 120);
      [...(o.g || '')].forEach((ch, i) => { if (ch !== '.' && TT_COLORS[ch]) { cc.fillStyle = TT_COLORS[ch]; cc.fillRect((i % COLS) * 6, Math.floor(i / COLS) * 6, 6, 6); } });
      box.append(c);
    });
  }
  function drawFx() {
    // hard-drop streaks
    fx.trails.forEach(r => { const a = 1 - r.t / 0.18, top = r.y0 * CELL, h = (r.y1 - r.y0) * CELL; if (h <= 0) return; const gr = g.createLinearGradient(0, top, 0, top + h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, r.color); g.globalAlpha = Math.max(0, a) * 0.5; g.fillStyle = gr; g.fillRect(r.x * CELL + 3, top, CELL - 6, h); });
    g.globalAlpha = 1;
    // cleared rows and freshly locked blocks flash white
    fx.flashes.forEach(f => { const a = 1 - f.t / (f.cell ? 0.15 : 0.3); g.fillStyle = `rgba(255,255,255,${Math.max(0, a) * (f.cell ? 0.45 : 0.9)})`; if (f.cell) g.fillRect(f.x * CELL, f.y * CELL, CELL, CELL); else g.fillRect(0, f.y * CELL - (1 - a) * 6, cv.width, CELL + (1 - a) * 12); });
    fx.parts.forEach(p => { g.globalAlpha = Math.max(0, 1 - p.t / p.life); g.fillStyle = p.color; g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); });
    g.globalAlpha = 1;
    // danger: the stack is near the top
    const top = grid.findIndex(r => r.some(Boolean)), danger = !over && top >= 0 && top - HID < 5;
    if (danger) { const a = 0.18 + 0.12 * Math.sin(performance.now() / 120); const gr = g.createLinearGradient(0, 0, 0, CELL * 5); gr.addColorStop(0, `rgba(255,40,40,${a})`); gr.addColorStop(1, 'rgba(255,40,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, cv.width, CELL * 5); }
    if (fx.hit > 0) { const gr = g.createLinearGradient(0, cv.height, 0, cv.height - CELL * 8); gr.addColorStop(0, `rgba(255,50,50,${fx.hit * 0.55})`); gr.addColorStop(1, 'rgba(255,50,50,0)'); g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height); }
    // pop-up words float up and fade
    fx.texts.forEach((x, k) => {
      const a = x.t < 0.15 ? x.t / 0.15 : Math.max(0, 1 - (x.t - 0.7) / 0.5), sc = x.t < 0.15 ? 0.6 + 0.4 * (x.t / 0.15) * 1.15 : 1;
      g.save(); g.globalAlpha = a; g.translate(cv.width / 2, cv.height * 0.34 + k * 30 - x.t * 24); g.scale(sc, sc);
      g.font = `900 ${x.size}px Segoe UI, sans-serif`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(x.text, 0, 0); g.fillStyle = x.color; g.fillText(x.text, 0, 0);
      g.restore();
    });
    // board edge: glows on big clears, red when in danger, tinted by level otherwise
    const hue = (200 + (level - 1) * 37) % 360;
    cv.style.borderColor = danger ? `rgb(${200 + 55 * Math.abs(Math.sin(performance.now() / 160)) | 0},60,60)` : `hsl(${hue},45%,${35 + fx.glow * 40}%)`;
    cv.style.boxShadow = fx.glow > 0.02 ? `0 0 ${12 + fx.glow * 30}px ${fx.glowColor}` : danger ? '0 0 14px rgba(255,60,60,.5)' : `0 0 10px hsla(${hue},60%,50%,.25)`;
    cv.style.transform = fx.shake > 0.3 ? `translate(${(Math.random() - 0.5) * fx.shake}px,${(Math.random() - 0.5) * fx.shake}px)` : '';
    W.body.querySelector('.tt').style.setProperty('--tt-hue', hue);
  }
  function stepFx(dt) {
    const s = dt / 1000;
    fx.parts.forEach(p => { p.t += s; p.x += p.vx * s; p.y += p.vy * s; p.vy += 700 * s; });
    fx.parts = fx.parts.filter(p => p.t < p.life);
    fx.flashes.forEach(f => f.t += s); fx.flashes = fx.flashes.filter(f => f.t < 0.3);
    fx.trails.forEach(r => r.t += s); fx.trails = fx.trails.filter(r => r.t < 0.18);
    fx.texts.forEach(x => x.t += s); fx.texts = fx.texts.filter(x => x.t < 1.2);
    fx.shake *= Math.pow(0.0005, s); fx.glow *= Math.pow(0.02, s); fx.hit *= Math.pow(0.03, s);
  }
  function frame(t) {
    const dt = Math.min(100, t - last || 0); last = t;
    stepFx(dt); if (watched()) { const f = fx; fx = vfx; try { stepFx(dt); } finally { fx = f; } }
    if (viewing && !watched()) viewing = null; // they stopped or left
    shareSolo(t);
    if (countdown > 0) { countdown -= dt / 1000; const c = Math.ceil(countdown); if (c < lastCount) { lastCount = c; SFX.count(c <= 0); if (c <= 0) pop('GO!', '#7dff8a', 30); } }
    else if (!idle && !over && !paused && (W.el.classList.contains('active') || versus || (allowCtrl && live()))) { // versus doesn't pause when you click away
      const speed = Math.max(30, Math.pow(0.8 - (level - 1) * 0.007, level - 1) * 1000) / (keys.soft ? 20 : 1);
      dropT += dt;
      while (dropT >= speed) { dropT -= speed; if (move(0, 1)) { if (keys.soft) score++; } else break; }
      if (!fits(cur.x, cur.y + 1, cur.r)) { lockT += dt; if (lockT >= 500) lock(); } else lockT = 0;
      for (const dir of ['left', 'right']) if (keys[dir]) { keys[dir].t += dt; while (keys[dir].t >= keys[dir].next) { move(dir === 'left' ? -1 : 1, 0); keys[dir].t -= keys[dir].next; keys[dir].next = Math.max(1, cfg.arr); } }
      share();
    }
    draw();
    raf = requestAnimationFrame(frame);
  }
  const TT_ACTIONS = [['left', 'Move left'], ['right', 'Move right'], ['soft', 'Soft drop'], ['drop', 'Hard drop'], ['rot', 'Rotate right'], ['rotb', 'Rotate left'], ['hold', 'Hold'], ['pause', 'Pause']];
  const TT_DEFAULT = { keys: { left: ['ArrowLeft'], right: ['ArrowRight'], soft: ['ArrowDown'], drop: ['Space'], rot: ['ArrowUp', 'KeyX'], rotb: ['KeyZ', 'ControlLeft'], hold: ['KeyC', 'ShiftLeft'], pause: ['KeyP', 'Escape'] }, das: 160, arr: 40 };
  const saved = store.get('tetris-settings', {});
  const cfg = { keys: { ...TT_DEFAULT.keys, ...(saved.keys || {}) }, das: saved.das ?? TT_DEFAULT.das, arr: saved.arr ?? TT_DEFAULT.arr };
  const keyAction = code => TT_ACTIONS.find(([a]) => (cfg.keys[a] || []).includes(code))?.[0];
  const keyName = code => ({ ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', Escape: 'Esc', ControlLeft: 'Ctrl', ControlRight: 'Right Ctrl', ShiftLeft: 'Shift', ShiftRight: 'Right Shift', AltLeft: 'Alt', AltRight: 'Right Alt', Enter: 'Enter', Backspace: 'Backspace', Tab: 'Tab' })[code]
    || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
  const help = () => {
    const k = a => (cfg.keys[a] || []).map(keyName).join('/') || '—';
    q('.tt-help').textContent = `${k('left')} ${k('right')} move · ${k('soft')} soft drop · ${k('drop')} hard drop · ${k('rot')} rotate · ${k('rotb')} rotate back · ${k('hold')} hold · ${k('pause')} pause`;
  };
  const saveCfg = () => { store.set('tetris-settings', cfg); help(); };
  let binding = null, cfgPaused = false; // binding: [action, slot] waiting for a key press
  function openCfg() {
    const box = q('.tt-cfg');
    cfgPaused = !versus && !over && !paused; if (cfgPaused) paused = true;
    box.hidden = false; binding = null;
    const rows = TT_ACTIONS.map(([a, label]) => `<div class="tt-cfg-row"><span>${label}</span>${[0, 1].map(i => `<button class="tt-key" data-a="${a}" data-i="${i}"></button>`).join('')}</div>`).join('');
    box.innerHTML = `<div class="tt-cfg-box"><h3>Controls</h3><p class="tt-cfg-tip">Click a box, then press the key you want. Delete or Backspace clears it, Esc cancels.</p>${rows}`
      + `<label class="tt-cfg-row"><span title="How long to hold left/right before the piece starts sliding">Slide delay</span><input type="range" class="tt-das" min="50" max="300" step="5"><b class="tt-das-v"></b></label>`
      + `<label class="tt-cfg-row"><span title="How fast the piece slides once it starts">Slide speed</span><input type="range" class="tt-arr" min="0" max="100" step="5"><b class="tt-arr-v"></b></label>`
      + `<div class="tt-cfg-btns"><button class="okbtn tt-cfg-reset">Reset to default</button><button class="okbtn tt-cfg-done">Done</button></div></div>`;
    const paint = () => {
      box.querySelectorAll('.tt-key').forEach(b => {
        const code = (cfg.keys[b.dataset.a] || [])[+b.dataset.i];
        const on = binding && binding[0] === b.dataset.a && binding[1] === +b.dataset.i;
        b.textContent = on ? 'Press a key…' : code ? keyName(code) : '—'; b.classList.toggle('on', !!on);
      });
      box.querySelector('.tt-das').value = cfg.das; box.querySelector('.tt-das-v').textContent = cfg.das + ' ms';
      box.querySelector('.tt-arr').value = cfg.arr; box.querySelector('.tt-arr-v').textContent = cfg.arr ? cfg.arr + ' ms' : 'instant';
    };
    box.querySelectorAll('.tt-key').forEach(b => b.onclick = () => { binding = [b.dataset.a, +b.dataset.i]; paint(); });
    box.querySelector('.tt-das').oninput = e => { cfg.das = +e.target.value; saveCfg(); paint(); };
    box.querySelector('.tt-arr').oninput = e => { cfg.arr = +e.target.value; saveCfg(); paint(); };
    box.querySelector('.tt-cfg-reset').onclick = () => { cfg.keys = structuredClone(TT_DEFAULT.keys); cfg.das = TT_DEFAULT.das; cfg.arr = TT_DEFAULT.arr; binding = null; saveCfg(); paint(); };
    box.querySelector('.tt-cfg-done').onclick = closeCfg;
    box.paint = paint; paint();
  }
  function closeCfg() { q('.tt-cfg').hidden = true; binding = null; keys.left = keys.right = null; keys.soft = false; if (cfgPaused) paused = false; cfgPaused = false; }
  const onBind = e => {
    const box = q('.tt-cfg'); if (box.hidden || !W.el.classList.contains('active')) return;
    if (!binding) { if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); closeCfg(); } return; }
    e.preventDefault(); e.stopPropagation();
    const [a, i] = binding;
    if (e.code !== 'Escape') {
      const mine = [...(cfg.keys[a] || [])];
      if (e.code === 'Backspace' || e.code === 'Delete') mine.splice(i, 1);
      else {
        TT_ACTIONS.forEach(([b]) => { if (b !== a) cfg.keys[b] = (cfg.keys[b] || []).filter(c => c !== e.code); }); // one key does one thing
        const at = mine.indexOf(e.code); if (at >= 0) mine.splice(at, 1);
        mine.splice(Math.min(i, mine.length), i < mine.length ? 1 : 0, e.code);
      }
      cfg.keys[a] = mine.slice(0, 2); saveCfg();
    }
    binding = null; box.paint();
  };
  document.addEventListener('keydown', onBind, true);
  q('.tt-set').onclick = openCfg;
  q('.tt-lb').onclick = () => openLeaderboards('tetris');
  help();
  const keys = { left: null, right: null, soft: false };
  const press = k => {
    if (k === 'left' || k === 'right') { if (move(k === 'left' ? -1 : 1, 0)) SFX.move(); keys[k] = { t: 0, next: cfg.das }; }
    else if (k === 'soft') keys.soft = true;
    else if (k === 'rot') rotate(1); else if (k === 'rotb') rotate(-1);
    else if (k === 'drop') hardDrop(); else if (k === 'hold') doHold();
    else if (k === 'pause' && !versus && !over) paused = !paused;
  };
  const release = k => { if (k === 'left' || k === 'right') keys[k] = null; else if (k === 'soft') keys.soft = false; };
  // keys can be changed in Settings; they're stored by physical key, so they work on any keyboard layout
  const onKey = e => {
    if (binding || !q('.tt-cfg').hidden) return;
    const k = keyAction(e.code); if (!k || !W.el.classList.contains('active') || e.target.matches?.('input, textarea')) return;
    e.preventDefault();
    const v = watched();
    if (v) { if (v.ctrl && k !== 'pause' && (e.type === 'keyup' || !e.repeat)) W.push({ ctl: { to: v.id, k, down: e.type === 'keydown' } }); return; } // watching: only with their say-so
    if (idle) return;
    if (e.type === 'keydown') { if (!e.repeat) press(k); } else release(k);
  };
  document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
  W.body.querySelectorAll('.tt-touch button').forEach(b => {
    const touch = (k, down) => { const v = watched(); if (v) { if (v.ctrl) W.push({ ctl: { to: v.id, k, down } }); } else if (!idle) (down ? press : release)(k); };
    b.addEventListener('pointerdown', e => { e.preventDefault(); touch(b.dataset.k, true); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => touch(b.dataset.k, false)));
  });
  W.onClose = () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', onBind, true); document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); if (versus && !over) { over = true; share(true); } if (live() && !idle) W.push({ solo: { id: mp.self, gone: true } }); W.closeSynth(); ttWin = null; };
  ttWin = W;
  start(); if (remoteOpen) idle = true; // someone else opened it: watch them until you start your own
  raf = requestAnimationFrame(frame);
  return W;
}

/* ---------- guess the drawing ---------- */
// For a multiplayer room: one person draws a secret word, the others type guesses. Faster guesses score
// more; the drawer scores for every right guess. Letters of the word appear as hints over time.
// The opener's computer runs the turns, timer and scores; the drawing is sent stroke by stroke.
const GD_WORDS = ('apple banana pizza burger cake cookie donut icecream sandwich carrot cheese egg bread coffee popcorn ' +
  'cat dog fish bird rabbit horse cow pig sheep duck frog snake spider bee butterfly turtle penguin elephant giraffe lion monkey shark whale octopus dinosaur ' +
  'house castle tree flower sun moon star cloud rain rainbow snowman mountain volcano island beach river bridge tower lighthouse tent ' +
  'car bus train plane rocket boat bicycle tractor helicopter submarine skateboard ' +
  'guitar piano drum trumpet microphone headphones camera phone computer keyboard mouse television robot lamp clock key lock door window chair bed ' +
  'ball kite balloon present candle crown sword shield bow arrow hammer ladder umbrella glasses hat shoe sock shirt backpack ring ' +
  'ghost dragon unicorn alien mermaid wizard pirate ninja zombie vampire superhero king queen princess knight ' +
  'football basketball tennis bowling fishing swimming skiing ' +
  'heart smile eye nose hand foot tooth skeleton brain ' +
  'pencil book scissors paint envelope map compass magnet battery lightbulb rocketship snowflake fire waterfall tornado').split(' ');
let gdWin = null;
function openGuessDraw() {
  if (gdWin) { focusWin(gdWin); return gdWin; }
  const CW = 800, CH = 520;
  const W = makeWin({ title: 'Guess the Drawing', icon: I.guessdraw, w: 1000, h: 660 });
  W.body.innerHTML = '<div class="gd"><div class="gd-top"><span class="gd-round"></span><b class="gd-hint"></b><span class="gd-time"></span></div>'
    + '<div class="gd-main"><div class="gd-players"></div><div class="gd-center"><div class="gd-stage"><canvas class="gd-c" width="800" height="520"></canvas><div class="gd-over"></div></div><div class="gd-tools"></div></div>'
    + '<div class="gd-chat"><div class="gd-log" role="log"></div><form class="gd-form"><input class="gd-in" maxlength="60" placeholder="Type your guess here" autocomplete="off" aria-label="Guess"></form></div></div></div>';
  const q = sel => W.body.querySelector(sel), cv = q('.gd-c'), g = cv.getContext('2d');
  const words = [...GD_WORDS, ...(typeof GUESS_WORDS !== 'undefined' && Array.isArray(GUESS_WORDS) ? GUESS_WORDS : [])].map(w => String(w).trim().toLowerCase()).filter(Boolean);
  const fresh = () => ({ phase: 'lobby', rounds: 3, total: 80, round: 0, order: [], turn: -1, drawer: null, word: '', choices: [], shown: [], left: 0, scores: {}, guessed: [], log: [] });
  let st = fresh(), timer = null;
  const players = () => [mp.self, ...[...mp.peers.values()].map(p => p.id)];
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
  // ---- the game itself (runs on the computer that holds it) ----
  const say = (text, extra = {}) => { st.log.push({ text, ...extra }); if (st.log.length > 60) st.log.shift(); };
  const push = () => { draw(); W.push({ st }); };
  function clearCanvas() { g.fillStyle = '#fff'; g.fillRect(0, 0, CW, CH); }
  function startGame(opts = {}) {
    const order = players();
    if (order.length < 2) return;
    Object.assign(st, fresh(), { rounds: opts.rounds || st.rounds, total: opts.total || st.total, order: shuffleBy(order), round: 1, log: [] });
    order.forEach(id => { st.scores[id] = 0; });
    say('Game started!', { sys: 1 }); nextTurn();
  }
  function nextTurn() {
    st.turn++;
    if (st.turn >= st.order.length) { st.turn = 0; st.round++; }
    if (st.round > st.rounds) { st.phase = 'end'; st.drawer = null; say('Game over!', { sys: 1 }); return push(); }
    const here = players();
    st.drawer = st.order[st.turn];
    if (!here.includes(st.drawer)) return nextTurn(); // they left
    st.choices = shuffleBy([...words]).slice(0, 3); st.word = ''; st.shown = []; st.guessed = []; st.phase = 'choose'; st.left = 15;
    clearCanvas(); W.push({ op: 'clear' });
    say(`${personName(st.drawer)} is choosing a word…`, { sys: 1 }); push();
  }
  function pick(i, from) {
    if (st.phase !== 'choose' || from !== st.drawer || !st.choices[i]) return;
    st.word = st.choices[i]; st.phase = 'draw'; st.left = st.total; push();
  }
  function endTurn() {
    st.phase = 'reveal'; st.left = 5;
    say(`The word was "${st.word}"`, { sys: 1 }); push();
  }
  function guess(text, from) {
    text = String(text).slice(0, 60).trim(); if (!text) return;
    const name = personName(from), color = from === mp.self ? me.color : ([...mp.peers.values()].find(p => p.id === from) || {}).color;
    if (st.phase === 'draw' && from !== st.drawer && !st.guessed.includes(from)) {
      if (norm(text) === norm(st.word)) {
        st.guessed.push(from);
        st.scores[from] = (st.scores[from] || 0) + 50 + Math.round(250 * st.left / st.total);
        st.scores[st.drawer] = (st.scores[st.drawer] || 0) + 40;
        say(`${name} guessed the word!`, { sys: 1, good: 1 });
        if (st.order.filter(id => id !== st.drawer && players().includes(id)).every(id => st.guessed.includes(id))) return endTurn();
        return push();
      }
      if (st.word.length >= 4 && lev(norm(text), norm(st.word)) === 1) say(`"${text}" is close!`, { sys: 1, to: from });
    } else if (st.phase === 'draw' && norm(text).includes(norm(st.word))) { say(`${name}: (hidden, no spoilers)`, { color }); return push(); } // the drawer or someone who got it
    say(text, { name, color }); push();
  }
  function tick() {
    if (!isLead(W) || !['choose', 'draw', 'reveal'].includes(st.phase)) return;
    st.left--;
    if (st.phase === 'choose' && st.left <= 0) return pick(Math.floor(Math.random() * 3), st.drawer);
    if (st.phase === 'draw') {
      const letters = [...st.word].map((c, i) => i).filter(i => /[a-z0-9]/i.test(st.word[i]) && !st.shown.includes(i));
      if ((st.left === Math.floor(st.total / 2) || st.left === Math.floor(st.total / 4)) && letters.length > 2) st.shown.push(letters[Math.floor(Math.random() * letters.length)]);
      if (st.left <= 0) return endTurn();
    }
    if (st.phase === 'reveal' && st.left <= 0) return nextTurn();
    W.push({ st }); draw();
  }
  timer = setInterval(tick, 1000);
  const ask = (d, fn) => { if (isLead(W)) fn(mp.self); else sendInput(W, d); };
  W.onInput = (d, from) => {
    if (d.guess != null) guess(d.guess, from);
    else if (d.pick != null) pick(d.pick | 0, from);
    else if (d.start) startGame(d.start);
    else if (d.lobby) { st = fresh(); push(); }
  };

  // ---- drawing ----
  const COLORS = ['#000000', '#ffffff', '#7f7f7f', '#c1c1c1', '#ef130b', '#ff7100', '#ffe400', '#00cc00', '#00b2ff', '#231fd3', '#a300ba', '#d37caa', '#a0522d', '#592f2a', '#ecbcb4', '#004d1f'];
  let color = '#000000', size = 6, drawing = null;
  const canDraw = () => st.phase === 'draw' && st.drawer === mp.self;
  const at = e => { const r = lrect(cv); return [(cX(e) - r.left) / r.width * CW, (cY(e) - r.top) / r.height * CH]; };
  function line(x1, y1, x2, y2, c, w) { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  cv.addEventListener('pointerdown', e => {
    if (!canDraw()) return;
    cv.setPointerCapture(e.pointerId); const [x, y] = at(e); drawing = [x, y];
    line(x, y, x + 0.01, y, color, size); W.push({ op: 'l', a: [x, y, x + 0.01, y].map(Math.round), c: color, w: size });
  });
  cv.addEventListener('pointermove', e => {
    if (!drawing || !canDraw()) return;
    const [x, y] = at(e); line(...drawing, x, y, color, size);
    W.push({ op: 'l', a: [...drawing, x, y].map(Math.round), c: color, w: size }); drawing = [x, y];
  });
  ['pointerup', 'pointercancel'].forEach(ev => cv.addEventListener(ev, () => { drawing = null; }));
  const tools = q('.gd-tools');
  tools.innerHTML = COLORS.map(c => `<button class="gd-col" data-c="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')
    + [3, 6, 14, 28].map(s => `<button class="gd-size" data-s="${s}" aria-label="Size ${s}"><i style="width:${Math.min(22, s)}px;height:${Math.min(22, s)}px"></i></button>`).join('')
    + '<button class="tbtn gd-clear">Clear</button>';
  const paintTools = () => { tools.querySelectorAll('.gd-col').forEach(b => b.classList.toggle('on', b.dataset.c === color)); tools.querySelectorAll('.gd-size').forEach(b => b.classList.toggle('on', +b.dataset.s === size)); };
  tools.querySelectorAll('.gd-col').forEach(b => b.onclick = () => { color = b.dataset.c; paintTools(); });
  tools.querySelectorAll('.gd-size').forEach(b => b.onclick = () => { size = +b.dataset.s; paintTools(); });
  q('.gd-clear').onclick = () => { if (canDraw()) { clearCanvas(); W.push({ op: 'clear' }); } };
  paintTools(); clearCanvas();

  // ---- screen ----
  function draw() {
    const here = players(), mine = st.drawer === mp.self, knows = mine || st.guessed.includes(mp.self) || st.phase === 'reveal' || st.phase === 'end';
    q('.gd-round').textContent = st.phase === 'lobby' ? 'Lobby' : st.phase === 'end' ? 'Game over' : `Round ${Math.min(st.round, st.rounds)} of ${st.rounds}`;
    q('.gd-time').textContent = ['choose', 'draw', 'reveal'].includes(st.phase) ? `⏱ ${Math.max(0, st.left)}` : '';
    q('.gd-hint').textContent = st.phase === 'draw' ? (knows ? st.word.toUpperCase() : [...st.word].map((c, i) => /[a-z0-9]/i.test(c) ? (st.shown.includes(i) ? c.toUpperCase() : '_') : c).join(' ') + `  (${st.word.replace(/[^a-z0-9]/gi, '').length})`) : '';
    const ranked = [...new Set([...st.order, ...here])].sort((a, b) => (st.scores[b] || 0) - (st.scores[a] || 0));
    q('.gd-players').innerHTML = ranked.map((id, k) => `<div class="gd-p${st.guessed.includes(id) ? ' got' : ''}${id === st.drawer ? ' drawing' : ''}${here.includes(id) ? '' : ' gone'}"><b>#${k + 1}</b><span>${esc(personName(id))}${id === mp.self ? ' (you)' : ''}</span><small>${st.scores[id] || 0} pts</small>${id === st.drawer ? '<i>✏️</i>' : ''}</div>`).join('');
    const over = q('.gd-over');
    let html = '';
    if (st.phase === 'lobby') html = here.length < 2
      ? `<h3>Guess the Drawing</h3><p>You need at least 2 people in a multiplayer room.</p><button class="okbtn gd-mp">Open Multiplayer</button>`
      : `<h3>Guess the Drawing</h3><p>${here.length} players here. Each person draws once per round.</p><div class="gd-opts">Rounds <select class="gd-r"><option>2</option><option selected>3</option><option>5</option></select> Draw time <select class="gd-t"><option>60</option><option selected>80</option><option>120</option></select> s</div><button class="okbtn gd-go">Start game</button>`;
    else if (st.phase === 'choose') html = mine ? '<h3>Choose a word to draw</h3><div class="gd-picks">' + st.choices.map((w, i) => `<button class="okbtn" data-i="${i}">${esc(w)}</button>`).join('') + '</div>' : `<h3>${esc(personName(st.drawer))} is choosing a word…</h3>`;
    else if (st.phase === 'reveal') html = `<h3>The word was <u>${esc(st.word)}</u></h3>`;
    else if (st.phase === 'end') html = '<h3>🏆 Results</h3><ol class="gd-pod">' + ranked.slice(0, 5).map(id => `<li>${esc(personName(id))} · ${st.scores[id] || 0} pts</li>`).join('') + '</ol><button class="okbtn gd-again">Back to lobby</button>';
    if (over.dataset.html !== html) {
      over.dataset.html = html; over.innerHTML = html; over.hidden = !html;
      const go = over.querySelector('.gd-go'); if (go) go.onclick = () => { const opts = { rounds: +over.querySelector('.gd-r').value, total: +over.querySelector('.gd-t').value }; ask({ start: opts }, () => startGame(opts)); };
      const mpb = over.querySelector('.gd-mp'); if (mpb) mpb.onclick = openMpPanel;
      over.querySelectorAll('.gd-picks button').forEach(b => b.onclick = () => ask({ pick: +b.dataset.i }, who => pick(+b.dataset.i, who)));
      const again = over.querySelector('.gd-again'); if (again) again.onclick = () => ask({ lobby: 1 }, () => { st = fresh(); push(); });
    }
    tools.hidden = !canDraw(); cv.style.cursor = canDraw() ? 'crosshair' : 'default';
    const input = q('.gd-in'); input.placeholder = mine && st.phase === 'draw' ? 'You are drawing! (chat only)' : 'Type your guess here';
    const log = q('.gd-log'), lines = st.log.filter(m => !m.to || m.to === mp.self), atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 30;
    if (log.dataset.n !== String(st.log.length) || log.dataset.last !== JSON.stringify(st.log[st.log.length - 1] || '')) {
      log.dataset.n = st.log.length; log.dataset.last = JSON.stringify(st.log[st.log.length - 1] || '');
      log.replaceChildren(...lines.map(m => {
        const d = el(`<div class="gd-m${m.sys ? ' sys' : ''}${m.good ? ' good' : ''}"></div>`);
        if (m.name) { const b = el('<b></b>'); b.textContent = m.name + ': '; b.style.color = m.color || '#333'; d.append(b); }
        d.append(document.createTextNode(m.text)); return d;
      }));
      if (atEnd) log.scrollTop = log.scrollHeight;
    }
  }
  q('.gd-form').onsubmit = e => { e.preventDefault(); const i = q('.gd-in'), v = i.value; i.value = ''; if (v.trim()) ask({ guess: v }, who => guess(v, who)); };
  shareState(W, () => ({ st, img: cv.toDataURL('image/png') }), d => {
    if (d.st) { st = d.st; draw(); }
    if (d.img) { const im = new Image(); im.onload = () => { clearCanvas(); g.drawImage(im, 0, 0); }; im.src = d.img; }
    if (d.op === 'clear') clearCanvas();
    else if (d.op === 'l' && Array.isArray(d.a)) line(...d.a, d.c, d.w);
  });
  const peersT = setInterval(draw, 2000); // people joining and leaving the room
  W.onClose = () => { clearInterval(timer); clearInterval(peersT); gdWin = null; };
  gdWin = W;
  draw();
  return W;
}

/* ---------- rhythm keys (4-key falling notes, like osu!mania) ---------- */
// Plays any song in the site. Songs with a Friday Night Funkin' chart (chart: in config.js) play that chart,
// held notes included; for the rest the song is decoded and its beats are found (sudden jumps in bass,
// middle and treble loudness); bass beats lean to the left lanes, treble to the right.
// Hit D F J K (or tap the lanes) as notes cross the line. In a room, "Play together" starts the same song
// for everyone at once with a live scoreboard.
const RK_JUDGE = [['Perfect', 40, 300, '#7df9ff'], ['Great', 80, 200, '#7dff8a'], ['Good', 120, 100, '#ffe066']]; // window in ms
const RK_MISS = 150;
const RK_DIFF = { Easy: { k: 1.7, gap: 300, max: 2.2, chords: 0 }, Normal: { k: 1.35, gap: 190, max: 4.5, chords: 0.05 }, Hard: { k: 1.12, gap: 120, max: 8, chords: 0.14 } };
const rkCharts = {}, rkBuffers = {};
let rkCtx = null;
async function rkDecode(src) {
  rkCtx ||= new (window.AudioContext || window.webkitAudioContext)();
  return rkBuffers[src] ||= fetch(urlOf(src)).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(b => rkCtx.decodeAudioData(b));
}
function rkChart(buf, diff, seed) { // find beats and turn them into notes: [{ t (s), lane }]
  const D = RK_DIFF[diff], sr = buf.sampleRate, hop = Math.round(sr * 0.01), n = buf.length;
  const chs = [...Array(buf.numberOfChannels).keys()].map(c => buf.getChannelData(c));
  const frames = Math.floor(n / hop), bands = [new Float32Array(frames), new Float32Array(frames), new Float32Array(frames)];
  const aLow = 1 - Math.exp(-2 * Math.PI * 180 / sr), aHigh = 1 - Math.exp(-2 * Math.PI * 2500 / sr);
  let lp = 0, lp2 = 0;
  for (let f = 0; f < frames; f++) { // one-pole filters split the sound into bass / middle / treble
    let eL = 0, eM = 0, eH = 0;
    for (let i = f * hop, end = i + hop; i < end; i++) {
      let s = 0; for (const ch of chs) s += ch[i]; s /= chs.length;
      lp += aLow * (s - lp); lp2 += aHigh * (s - lp2);
      const low = lp, high = s - lp2, mid = lp2 - lp;
      eL += low * low; eM += mid * mid; eH += high * high;
    }
    bands[0][f] = Math.sqrt(eL / hop); bands[1][f] = Math.sqrt(eM / hop); bands[2][f] = Math.sqrt(eH / hop);
  }
  const flux = bands.map(b => { const o = new Float32Array(frames); for (let f = 1; f < frames; f++) o[f] = Math.max(0, b[f] - b[f - 1]); return o; });
  const norm = flux.map(o => { let m = 1e-9; for (const v of o) m = Math.max(m, v); return o.map(v => v / m); }); // each band counts the same
  const on = new Float32Array(frames); for (let f = 0; f < frames; f++) on[f] = norm[0][f] * 1.2 + norm[1][f] + norm[2][f] * 0.9;
  // 1) find the beats
  const beats = [], W = 40; // 0.4 s around each frame sets the bar
  let sum = 0; for (let f = 0; f < Math.min(frames, W * 2); f++) sum += on[f];
  let lastT = -9;
  for (let f = 1; f < frames - 1; f++) {
    const a = Math.max(0, f - W), b = Math.min(frames, f + W);
    if (f > W && f + W < frames) sum += on[f + W] - on[f - W - 1];
    const mean = sum / (b - a), v = on[f];
    if (v < mean * D.k + 0.04 || v < on[f - 1] || v < on[f + 1]) continue;
    const t = f * hop / sr;
    if ((t - lastT) * 1000 < D.gap) continue;
    const s3 = norm[0][f] + norm[1][f] + norm[2][f] || 1;
    beats.push({ t, side: (norm[2][f] - norm[0][f]) / s3, strong: v > mean * D.k * 2.2 }); lastT = t;
  }
  // 2) lanes: how bass- or treble-heavy a beat is compared with the rest of this song picks left or right,
  //    and a lane that's been quiet longer wins ties, so all four get used
  const order = beats.map(x => x.side).sort((p, q) => p - q), rank = v => { let lo = 0, hi = order.length; while (lo < hi) { const m = (lo + hi) >> 1; if (order[m] < v) lo = m + 1; else hi = m; } return lo / Math.max(1, order.length - 1); };
  const notes = [], rnd = seededRandom(seed + diff), lastIn = [-9, -9, -9, -9];
  for (const bt of beats) {
    const want = rank(bt.side) * 3, t = bt.t;
    const lane = [0, 1, 2, 3].map(l => ({ l, score: -Math.abs(l - want) * 0.7 + Math.min(1, (t - lastIn[l]) / 0.8) + rnd() * 0.5 - ((t - lastIn[l]) * 1000 < D.gap ? 5 : 0) }))
      .sort((p, q) => q.score - p.score)[0].l;
    notes.push({ t, lane }); lastIn[lane] = t;
    if (bt.strong && rnd() < D.chords) { // strong hits sometimes become two keys at once
      const other = [0, 1, 2, 3].filter(l => l !== lane && (t - lastIn[l]) * 1000 > D.gap)[0];
      if (other != null) { notes.push({ t, lane: other }); lastIn[other] = t; }
    }
  }
  // keep it playable: no more than D.max notes in any second
  const out = []; for (const nt of notes) if (out.filter(o => nt.t - o.t < 1).length < D.max) out.push(nt);
  return out;
}
// Friday Night Funkin' charts: a song with chart: '...json' in config.js plays that chart instead of a made one.
// Handles the classic / Psych Engine format (sections with mustHitSection) and the newer FNF one
// (notes listed per difficulty). Each note: { t (s), lane 0-3 (left, down, up, right), len (s, held notes) }.
function rkParseFnf(json) {
  const out = { diffs: {}, speed: 0, bpm: 0 };
  const tidy = list => { // in time order, without notes stacked on top of each other
    list.sort((a, b) => a.t - b.t || a.lane - b.lane);
    return list.filter((n, i) => !list.slice(Math.max(0, i - 4), i).some(o => o.lane === n.lane && n.t - o.t < 0.005));
  };
  const skip = type => typeof type === 'string' && /hurt|mine|death|kill/i.test(type); // notes you're meant to avoid
  if (json && json.notes && !Array.isArray(json.notes) && typeof json.notes === 'object') { // newer FNF: { notes: { easy: [{ t, d, l }] } }
    for (const [name, list] of Object.entries(json.notes)) {
      const player = [], opp = [];
      for (const n of Array.isArray(list) ? list : []) {
        const d = n.d | 0; if (d < 0 || d > 7 || skip(n.k)) continue;
        (d < 4 ? player : opp).push({ t: (+n.t || 0) / 1000, lane: d % 4, len: Math.max(0, (+n.l || 0) / 1000) });
      }
      out.diffs[name.charAt(0).toUpperCase() + name.slice(1)] = { player: tidy(player), opp: tidy(opp) };
    }
    const sp = json.scrollSpeed; out.speed = typeof sp === 'object' && sp ? +(sp.normal || Object.values(sp)[0]) || 0 : +sp || 0;
    return out;
  }
  const song = json && json.song && typeof json.song === 'object' ? json.song : json;
  const v1 = /psych_v1/.test(song && song.format || ''); // Psych 1.0 keeps the player's notes in 0-3 everywhere
  const player = [], opp = [];
  for (const sec of song && Array.isArray(song.notes) ? song.notes : []) for (const n of sec.sectionNotes || []) {
    const [t, d, len, type] = n; if (typeof t !== 'number' || typeof d !== 'number' || d < 0 || d > 7 || skip(type)) continue;
    const mine = v1 ? d < 4 : sec.mustHitSection ? d < 4 : d >= 4;
    (mine ? player : opp).push({ t: t / 1000, lane: d % 4, len: Math.max(0, (+len || 0) / 1000) });
  }
  out.diffs.Chart = { player: tidy(player), opp: tidy(opp) };
  out.speed = +song.speed || 0; out.bpm = +song.bpm || 0;
  return out;
}
const rkFnf = {};
const rkLoadFnf = path => rkFnf[path] ||= fetch(urlOf(path)).then(r => { if (!r.ok) throw new Error(`chart ${r.status}`); return r.json(); }).then(rkParseFnf)
  .catch(e => { delete rkFnf[path]; throw e; });
const RK_ARROW = ['#c24b99', '#00ffff', '#12fa05', '#f9393f']; // left, down, up, right, the usual FNF colours
const RK_DIFF_COLOR = { Easy: '#4cd964', Normal: '#4aa3ff', Hard: '#ff5a5f', Chart: '#b07cff', Erect: '#ff4fd8', Nightmare: '#ff3b3b' };
const rkHue = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const rkTime = s => s ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '–';
const rkTitle = s => s.name.replace(/\.[^.]+$/, '');
let rkWin = null;
function openRhythm() {
  if (rkWin) { focusWin(rkWin); return rkWin; }
  const CW = 600, H = 600, PX = 120, LW = 90, JY = 510;
  const W = makeWin({ title: 'Rhythm Keys', icon: I.rhythm, w: 880, h: 660 });
  W.body.innerHTML = '<div class="rk"><div class="rk-bg"><i></i><i></i><i></i></div><div class="rk-menu"></div><div class="rk-play" hidden><canvas class="rk-c" width="600" height="600" aria-label="Playfield"></canvas><div class="rk-live"></div></div></div>';
  const q = sel => W.body.querySelector(sel), cv = q('.rk-c'), g = cv.getContext('2d'), menuEl = q('.rk-menu');
  const songs = []; (function walk(n) { (n.children || []).forEach(c => { if (c.type === 'audio' && !songs.some(s => s.src === c.src)) songs.push(c); else if (c.children) walk(c); }); })(desktop);
  const opt = { speed: store.get('rk-speed', 900), offset: store.get('rk-offset', 0), style: store.get('rk-style', 'arrows'), side: store.get('rk-side', 'player'), keys: store.get('rk-keys', ['KeyD', 'KeyF', 'KeyJ', 'KeyK']) };
  const saveOpt = () => ['speed', 'offset', 'style', 'side', 'keys'].forEach(k => store.set('rk-' + k, opt[k]));
  let song = songs.find(s => s.src === store.get('rk-song', '')) || songs[0], diff = store.get('rk-diff', 'Normal');
  let game = null, raf = 0, gain = null, analyser = null, together = null, binding = -1;
  const others = new Map(); // live scores in a shared song
  const meta = {}; // per song: { len, fnf }
  let preview = null, previewFor = null; // song preview in the song list
  mixChannel(W, 'rhythm', 0.8, v => { if (gain) gain.gain.value = v; if (preview) preview.volume = v * 0.6; }, { label: () => 'Rhythm Keys' });
  const diffsOf = s => s && s.chart ? (meta[s.src] && meta[s.src].fnf ? Object.keys(meta[s.src].fnf.diffs) : ['Chart']) : Object.keys(RK_DIFF);
  const pickDiff = s => { const l = diffsOf(s); return l.includes(diff) ? diff : l.includes('Normal') ? 'Normal' : l[0]; };
  const bestKey = (s, d) => `rk-best:${s.src}:${d}${s.chart && opt.side === 'opp' ? ':opp' : ''}`;
  const best = (s, d) => store.get(bestKey(s, d), null);
  function learn(s) { // length from the file, BPM and note counts from the chart
    const m = meta[s.src] ||= {};
    if (m.len == null) { // let go of the file once its length is known, or it holds a connection open
      m.len = 0; const a = new Audio(), done = () => { a.onloadedmetadata = a.onerror = null; a.removeAttribute('src'); a.load(); };
      a.preload = 'metadata'; a.onloadedmetadata = () => { m.len = a.duration; done(); refresh(); }; a.onerror = done; a.src = urlOf(s.src);
    }
    if (s.chart && !m.fnf && !m.loading) { m.loading = true; rkLoadFnf(s.chart).then(f => { m.fnf = f; refresh(); }, () => { m.bad = true; refresh(); }); }
  }
  // song preview, like the song select of most rhythm games
  function startPreview(s) {
    if (previewFor === s.src && preview) return;
    stopPreview(); if (!W.el.classList.contains('active') || game) return;
    previewFor = s.src; preview = new Audio(urlOf(s.src)); preview.loop = true; preview.volume = 0;
    preview.onloadedmetadata = () => { if (preview) preview.currentTime = preview.duration * 0.35; };
    preview.play().then(() => { const p = preview, target = mixLevel(W.audio) * 0.6; let v = 0; const f = setInterval(() => { if (p !== preview) return clearInterval(f); v = Math.min(target, v + 0.05); p.volume = v; if (v >= target) clearInterval(f); }, 60); }).catch(() => {});
  }
  function stopPreview() { if (preview) { preview.pause(); preview.removeAttribute('src'); preview.load(); } preview = null; previewFor = null; }
  const previewT = setInterval(() => { // only while the song list is showing and this window is in front
    if (!W.el.classList.contains('active') || (game && !game.done) || menuEl.hidden) stopPreview(); else if (song && !preview && menuEl.dataset.view === 'select') startPreview(song);
    players.forEach((p, id) => { if (performance.now() - (p.seen || 0) > 6000) players.delete(id); }); watchBanner();
  }, 700);

  /* ---- song select ---- */
  function card(s, i) {
    const m = meta[s.src] || {}, b = best(s, pickDiff(s)), f = m.fnf;
    const sub = s.chart ? `FNF chart${f && f.bpm ? ` · ${f.bpm} BPM` : ''}` : 'Auto chart';
    return `<button class="rk-card${s === song ? ' on' : ''}" data-i="${i}" style="--h:${rkHue(rkTitle(s))}"><span class="rk-card-art">${esc(rkTitle(s).replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '♪')}</span>`
      + `<span class="rk-card-txt"><b>${esc(rkTitle(s))}</b><small>${sub} · ${rkTime(m.len)}</small></span>${b ? `<span class="rk-badge g${b.grade}">${b.grade}</span>` : ''}</button>`;
  }
  function detail() {
    const s = song; if (!s) return '<div class="rk-empty">No songs yet: add some to the Music folder in config.js.</div>';
    const m = meta[s.src] || {}, d = pickDiff(s), f = m.fnf, b = best(s, d);
    const chart = f && f.diffs[d] ? f.diffs[d][opt.side === 'opp' ? 'opp' : 'player'] : null, holds = chart ? chart.filter(n => n.len > 0.05).length : 0;
    const tags = [s.chart ? 'FNF chart' : 'Made from the song', f && f.bpm ? `${f.bpm} BPM` : '', m.len ? rkTime(m.len) : '', chart ? `${chart.length} notes` : '', holds ? `${holds} holds` : ''].filter(Boolean);
    const keyName = c => c.replace(/^Key/, '').replace(/^Digit/, '').replace('Space', '␣');
    return `<div class="rk-cover" style="--h:${rkHue(rkTitle(s))}"><b>${esc(rkTitle(s))}</b></div>`
      + `<div class="rk-tags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>`
      + (m.bad ? '<p class="rk-msg">Couldn\'t read this song\'s chart file.</p>' : '')
      + `<div class="rk-diffs">${diffsOf(s).map(x => `<button class="rk-pill${x === d ? ' on' : ''}" data-d="${esc(x)}" style="--c:${RK_DIFF_COLOR[x] || '#9aa6c8'}">${esc(x)}</button>`).join('')}</div>`
      + (s.chart ? `<div class="rk-row"><span>Play as</span><div class="rk-seg"><button data-side="player" class="${opt.side !== 'opp' ? 'on' : ''}">Boyfriend</button><button data-side="opp" class="${opt.side === 'opp' ? 'on' : ''}">Opponent</button></div></div>` : '')
      + `<div class="rk-best">${b ? `<span class="rk-bgrade g${b.grade}">${b.grade}</span><div><small>Personal best</small><b>${b.score.toLocaleString()}</b><span>${b.acc}%${b.combo ? ` · ${b.combo}x combo` : ''}</span></div>` : '<div><small>Personal best</small><b>Not played yet</b></div>'}</div>`
      + `<details class="rk-set"${store.get('rk-set-open', false) ? ' open' : ''}><summary>Settings</summary>`
      + `<label class="rk-row"><span>Scroll speed</span><input type="range" class="rk-speed" min="400" max="2200" step="50" value="${opt.speed}"><b class="rk-speed-v">${(opt.speed / 100).toFixed(1)}</b></label>`
      + `<label class="rk-row"><span>Timing offset</span><input type="number" class="rk-off" value="${opt.offset}" step="5"> ms</label>`
      + `<div class="rk-row"><span>Notes</span><div class="rk-seg"><button data-style="arrows" class="${opt.style === 'arrows' ? 'on' : ''}">Arrows</button><button data-style="bars" class="${opt.style === 'bars' ? 'on' : ''}">Bars</button></div></div>`
      + `<div class="rk-row"><span>Keys</span><div class="rk-keyset">${opt.keys.map((k, i) => `<button data-k="${i}" class="${binding === i ? 'on' : ''}">${binding === i ? '…' : esc(keyName(k))}</button>`).join('')}</div></div></details>`
      + `<div class="rk-go"><button class="rk-start">▶ Play</button>${live() ? '<button class="rk-together">Play together</button>' : ''}</div><p class="rk-msg"></p>`;
  }
  function menu(msg = '') {
    stop(); game = null;
    q('.rk-play').hidden = true; menuEl.hidden = false; menuEl.dataset.view = 'select';
    songs.forEach(learn);
    menuEl.innerHTML = `<div class="rk-head"><span class="rk-logo">Rhythm<b>Keys</b></span><span class="rk-hint">↑ ↓ song · ← → difficulty · Enter play</span></div>`
      + `<div class="rk-cols"><div class="rk-list">${songs.map(card).join('')}</div><div class="rk-detail"></div></div>`;
    menuEl.querySelectorAll('.rk-card').forEach(b => b.onclick = () => select(songs[+b.dataset.i]));
    renderDetail(); if (msg) say(msg);
    const on = menuEl.querySelector('.rk-card.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  const say = msg => { const m = menuEl.querySelector('.rk-msg'); if (m) m.textContent = msg; };
  function refresh() { // metadata arrived: update the cards and details without rebuilding the list
    if (menuEl.hidden || menuEl.dataset.view !== 'select') return;
    menuEl.querySelectorAll('.rk-card').forEach(b => { const n = el(card(songs[+b.dataset.i], +b.dataset.i)); n.onclick = b.onclick; b.replaceWith(n); });
    renderDetail();
  }
  function select(s) {
    if (!s || s === song) return;
    song = s; store.set('rk-song', s.src); stopPreview();
    menuEl.querySelectorAll('.rk-card').forEach(b => b.classList.toggle('on', songs[+b.dataset.i] === s));
    const on = menuEl.querySelector('.rk-card.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    renderDetail();
  }
  function renderDetail() {
    const box = menuEl.querySelector('.rk-detail'); if (!box) return;
    const msg = (box.querySelector('.rk-msg') || {}).textContent || '';
    box.innerHTML = detail(); const m = box.querySelector('.rk-msg'); if (m && msg) m.textContent = msg;
    box.querySelectorAll('.rk-pill').forEach(b => b.onclick = () => { diff = b.dataset.d; store.set('rk-diff', diff); refresh(); });
    box.querySelectorAll('[data-side]').forEach(b => b.onclick = () => { opt.side = b.dataset.side; saveOpt(); refresh(); });
    box.querySelectorAll('[data-style]').forEach(b => b.onclick = () => { opt.style = b.dataset.style; saveOpt(); renderDetail(); });
    box.querySelectorAll('.rk-keyset button').forEach(b => b.onclick = () => { binding = +b.dataset.k; renderDetail(); });
    const set = box.querySelector('.rk-set'); if (set) set.ontoggle = () => store.set('rk-set-open', set.open);
    const sp = box.querySelector('.rk-speed'); if (sp) sp.oninput = () => { opt.speed = +sp.value; saveOpt(); box.querySelector('.rk-speed-v').textContent = (opt.speed / 100).toFixed(1); };
    const of = box.querySelector('.rk-off'); if (of) of.onchange = () => { opt.offset = +of.value || 0; saveOpt(); };
    const st = box.querySelector('.rk-start'); if (st) st.onclick = () => play(song, pickDiff(song));
    const tg = box.querySelector('.rk-together'); if (tg) tg.onclick = () => { const r = { src: song.src, diff: pickDiff(song), id: Date.now() }; W.push({ together: r }); play(song, r.diff, r); };
  }

  /* ---- playing ---- */
  async function loadSong(s, d, sideName) { // the decoded song and the notes for one side of its chart
    const buf = await rkDecode(s.src);
    let notes, opp = [], bpm = 0;
    if (s.chart) {
      const f = await rkLoadFnf(s.chart), c = f.diffs[d] || Object.values(f.diffs)[0];
      if (!c) throw new Error('the chart has no notes');
      const side = sideName === 'opp'; notes = side ? c.opp : c.player; opp = side ? c.player : c.opp; bpm = f.bpm;
      const shift = (+s.chartOffset || 0) / 1000; if (shift) { notes = notes.map(n => ({ ...n, t: n.t + shift })); opp = opp.map(n => ({ ...n, t: n.t + shift })); }
    } else { const key = `${s.src}|${d}`; notes = rkCharts[key] ||= rkChart(buf, d, s.src); }
    return { buf, notes, opp, bpm };
  }
  async function play(s, d, tog = null) {
    if (!s) return;
    stopWatch(); stopPreview(); say(s.chart ? 'Loading the song and chart…' : 'Listening to the song and making the chart…');
    menuEl.classList.add('loading');
    try {
      const { buf, notes, opp, bpm } = await loadSong(s, d, opt.side);
      if (rkCtx.state === 'suspended') await rkCtx.resume();
      setMusic(false); if (playerWin) { const a = playerWin.body.querySelector('audio'); if (a) a.pause(); }
      together = tog; others.clear();
      const src = rkCtx.createBufferSource(); src.buffer = buf; gain = rkCtx.createGain(); analyser = rkCtx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.75;
      W.audio.apply(); src.connect(gain); gain.connect(analyser); analyser.connect(rkCtx.destination);
      const lead = 2.2, t0 = rkCtx.currentTime + lead; src.start(t0);
      game = { s, d, src, t0, bpm, run: Date.now(), side: s.chart ? opt.side : 'player', notes: notes.map((n, i) => ({ ...n, i, hit: null })), opp: opp.map(n => ({ ...n })), score: 0, combo: 0, maxCombo: 0, out: [],
        counts: { Perfect: 0, Great: 0, Good: 0, Miss: 0 }, held: [0, 0, 0, 0], press: [0, 0, 0, 0], fx: [], pop: null, errs: [], end: buf.duration, done: false, bump: 0, spec: new Uint8Array(analyser.frequencyBinCount) };
      src.onended = () => finish();
      menuEl.classList.remove('loading'); menuEl.hidden = true; q('.rk-play').hidden = false;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    } catch (e) { menuEl.classList.remove('loading'); say(`Couldn't play that song (${e.message || e}).`); }
  }
  const now = () => rkCtx.currentTime - game.t0 - (rkCtx.outputLatency || rkCtx.baseLatency || 0) - opt.offset / 1000; // song time the ear hears
  function judge(lane) {
    if (!game || game.done || game.watch) return;
    game.held[lane] = 1; game.press[lane] = 1;
    const t = now(), n = game.notes.find(x => x.lane === lane && !x.hit && Math.abs(x.t - t) * 1000 <= RK_MISS);
    if (!n) return;
    const err = (t - n.t) * 1000, j = RK_JUDGE.find(([, w]) => Math.abs(err) <= w);
    if (!j) { n.hit = 'Miss'; game.out.push([n.i, 'Miss']); return miss(); }
    n.hit = j[0]; game.counts[j[0]]++; game.out.push([n.i, j[0], Math.round(err)]); game.combo++; game.maxCombo = Math.max(game.maxCombo, game.combo);
    game.score += Math.round(j[2] * (1 + Math.min(game.combo, 100) / 100));
    game.pop = { text: j[0], color: j[3], at: performance.now(), err: j[0] === 'Perfect' ? 0 : err };
    game.errs.push({ err, at: performance.now() }); if (game.errs.length > 30) game.errs.shift();
    game.allErrs = game.allErrs || []; game.allErrs.push(err);
    if (n.len > 0.05) n.holding = true; // a held note: keep the key down until its tail
    game.bump = 1;
    game.fx.push({ lane, at: performance.now(), color: laneColor(lane), big: j[0] === 'Perfect' });
  }
  function release(lane) {
    if (!game || game.watch) return;
    game.held[lane] = 0;
    const t = now(), n = game.notes.find(x => x.lane === lane && x.holding);
    if (n && t < n.t + n.len - 0.12) { n.holding = false; n.broke = true; game.out.push([n.i, 'Dropped']); miss('Dropped'); } // let go too soon
  }
  function miss(text = 'Miss') { game.counts.Miss++; game.combo = 0; game.pop = { text, color: '#ff5a5a', at: performance.now() }; }
  const accuracy = () => { const c = game.counts, total = c.Perfect + c.Great + c.Good + c.Miss; return total ? (c.Perfect * 300 + c.Great * 200 + c.Good * 100) / (total * 300) * 100 : 100; };
  const grade = a => a >= 95 ? 'S' : a >= 90 ? 'A' : a >= 80 ? 'B' : a >= 70 ? 'C' : 'D';
  const laneColor = l => opt.style === 'arrows' ? RK_ARROW[l] : l === 0 || l === 3 ? '#8fa8ff' : '#ff8ad0';
  function arrow(x, y, s, lane, fill, stroke) { // a chunky arrow; lane 0 left, 1 down, 2 up, 3 right
    g.save(); g.translate(x, y); g.rotate([-Math.PI / 2, Math.PI, 0, Math.PI / 2][lane]); g.scale(s, s);
    g.beginPath(); g.moveTo(0, -1); g.lineTo(0.95, -0.02); g.lineTo(0.4, -0.02); g.lineTo(0.4, 0.9); g.lineTo(-0.4, 0.9); g.lineTo(-0.4, -0.02); g.lineTo(-0.95, -0.02); g.closePath();
    g.lineJoin = 'round'; if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = 0.16; g.strokeStyle = stroke; g.stroke(); }
    g.restore();
  }
  function note(x, y, lane, alpha = 1) {
    g.globalAlpha = alpha;
    if (opt.style === 'arrows') { arrow(x, y, 30, lane, laneColor(lane), '#10131c'); g.fillStyle = 'rgba(255,255,255,.35)'; arrow(x, y - 4, 13, lane, 'rgba(255,255,255,.35)'); }
    else {
      const c = lane === 0 || lane === 3 ? ['#c9d6ff', '#7f9cff'] : ['#ffd3f0', '#ff7ac8'], gr = g.createLinearGradient(0, y - 11, 0, y + 11);
      gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]); g.fillStyle = gr; g.beginPath(); g.roundRect(x - LW / 2 + 6, y - 11, LW - 12, 22, 7); g.fill();
    }
    g.globalAlpha = 1;
  }
  let liveT = 0;
  function frame() {
    if (!game) return;
    const t = now(), nowMs = performance.now();
    if (game.watch) { // someone else's game: hits come from them, held notes follow their keys
      for (const n of game.notes) if (n.len > 0.05 && n.hit && !n.broke && !n.held && n.hit !== 'Miss') { if (t >= n.t + n.len) { n.holding = false; n.held = true; } else n.holding = !!game.held[n.lane]; }
    } else for (const n of game.notes) {
      if (!n.hit && (t - n.t) * 1000 > RK_MISS) { n.hit = 'Miss'; game.out.push([n.i, 'Miss']); miss(); }
      if (n.holding) { if (t >= n.t + n.len) { n.holding = false; n.held = true; game.score += 50; } else if (game.held[n.lane]) game.score += 1; }
    }
    // background: the song's spectrum and a pulse on the beat
    let bass = 0; analyser.getByteFrequencyData(game.spec); for (let k = 1; k < 8; k++) bass += game.spec[k]; bass /= 7 * 255;
    const beat = game.bpm ? Math.exp(-((Math.max(0, t) * game.bpm / 60) % 1) * 5) : bass;
    game.bump = Math.max(0, game.bump - 0.08);
    const hue = rkHue(rkTitle(game.s));
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, `hsl(${hue},45%,${8 + beat * 5}%)`); bg.addColorStop(1, '#07080d');
    g.fillStyle = bg; g.fillRect(0, 0, CW, H);
    const bins = game.spec.length;
    for (let k = 0; k < 48; k++) { const v = game.spec[Math.floor(k / 48 * bins * 0.7)] / 255, h = v * v * 260; g.fillStyle = `hsla(${hue + k * 3},80%,60%,${0.1 + v * 0.18})`; g.fillRect(k * CW / 48 + 1, H - h, CW / 48 - 2, h); }
    // playfield
    g.fillStyle = 'rgba(6,8,14,.82)'; g.fillRect(PX, 0, LW * 4, H);
    g.strokeStyle = `hsla(${hue},90%,70%,${0.25 + beat * 0.5})`; g.lineWidth = 2; g.strokeRect(PX - 1, -2, LW * 4 + 2, H + 4);
    for (let l = 0; l < 4; l++) {
      if (game.held[l]) { const gr = g.createLinearGradient(0, JY, 0, JY - 300); gr.addColorStop(0, hexA(laneColor(l), 0.28)); gr.addColorStop(1, hexA(laneColor(l), 0)); g.fillStyle = gr; g.fillRect(PX + l * LW, JY - 300, LW, 300); }
      if (l) { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(PX + l * LW, 0, 1, H); }
    }
    // receptors
    for (let l = 0; l < 4; l++) {
      const x = PX + l * LW + LW / 2, p = game.press[l]; game.press[l] = Math.max(0, p - 0.12);
      if (opt.style === 'arrows') arrow(x, JY, 30 * (1 - p * 0.12), l, game.held[l] ? hexA(laneColor(l), 0.55) : 'rgba(140,150,180,.25)', game.held[l] ? '#fff' : 'rgba(200,210,240,.6)');
      else { g.fillStyle = game.held[l] ? hexA(laneColor(l), 0.6) : 'rgba(140,150,180,.18)'; g.beginPath(); g.roundRect(x - LW / 2 + 6, JY - 11, LW - 12, 22, 7); g.fill(); g.strokeStyle = 'rgba(220,230,255,.6)'; g.lineWidth = 2; g.stroke(); }
      g.fillStyle = game.held[l] ? '#fff' : 'rgba(170,180,210,.7)'; g.font = 'bold 15px Segoe UI, sans-serif'; g.textAlign = 'center';
      g.fillText(opt.keys[l].replace(/^Key/, '').replace(/^Digit/, ''), x, JY + 62);
    }
    // notes (held notes draw their tail first)
    for (const n of game.notes) {
      const x = PX + n.lane * LW + LW / 2, y = JY - (n.t - t) * opt.speed;
      if (y < -60 - n.len * opt.speed) break;
      if (n.len > 0.05 && !n.held && !n.broke && !(n.hit === 'Miss' && y > H + 40)) {
        const ty = JY - (n.t + n.len - t) * opt.speed, top = Math.max(-20, ty), bot = n.holding ? JY : y;
        if (bot > top) { const w = opt.style === 'arrows' ? 22 : LW - 40; g.fillStyle = hexA(laneColor(n.lane), n.hit === 'Miss' ? 0.25 : n.holding ? 0.85 : 0.6); g.beginPath(); g.roundRect(x - w / 2, top, w, bot - top, w / 2); g.fill(); }
      }
      if (n.hit || y > H + 40) continue;
      note(x, y, n.lane);
    }
    // hit bursts
    game.fx = game.fx.filter(f => nowMs - f.at < 300);
    for (const f of game.fx) {
      const k = (nowMs - f.at) / 300, x = PX + f.lane * LW + LW / 2;
      g.strokeStyle = hexA(f.color, 1 - k); g.lineWidth = 4 * (1 - k) + 1; g.beginPath(); g.arc(x, JY, 26 + k * (f.big ? 34 : 22), 0, Math.PI * 2); g.stroke();
      if (f.big) for (let s = 0; s < 6; s++) { const a = s / 6 * Math.PI * 2 + f.at, r = 20 + k * 50; g.fillStyle = hexA('#ffffff', 1 - k); g.fillRect(x + Math.cos(a) * r - 2, JY + Math.sin(a) * r - 2, 4, 4); }
    }
    // judgement, early/late and combo
    const pop = game.pop, age = pop ? nowMs - pop.at : 1e9;
    if (age < 600) {
      const sc = 1 + Math.max(0, 0.25 - age / 400); g.save(); g.globalAlpha = Math.min(1, 2 - age / 300); g.translate(PX + LW * 2, 300); g.scale(sc, sc);
      g.font = 'italic 900 34px Segoe UI, sans-serif'; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(pop.text.toUpperCase(), 0, 0); g.fillStyle = pop.color; g.fillText(pop.text.toUpperCase(), 0, 0);
      if (pop.err) { g.font = 'bold 13px Segoe UI, sans-serif'; g.fillStyle = pop.err < 0 ? '#7fc8ff' : '#ffb36b'; g.fillText(pop.err < 0 ? `EARLY ${Math.round(-pop.err)}ms` : `LATE ${Math.round(pop.err)}ms`, 0, 22); }
      g.restore();
    }
    if (game.combo > 1) { const s = 1 + game.bump * 0.15; g.save(); g.translate(PX + LW * 2, 228); g.scale(s, s); g.textAlign = 'center'; g.font = '900 46px Segoe UI, sans-serif'; g.fillStyle = 'rgba(255,255,255,.9)'; g.fillText(game.combo, 0, 0); g.font = 'bold 11px Segoe UI, sans-serif'; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText('COMBO', 0, 16); g.restore(); }
    // hit error bar under the keys
    const ey = H - 14, ew = 180, ex = PX + LW * 2;
    g.fillStyle = 'rgba(255,90,90,.35)'; g.fillRect(ex - ew / 2, ey - 2, ew, 4);
    RK_JUDGE.slice().reverse().forEach(([, w, , c]) => { g.fillStyle = hexA(c, 0.5); g.fillRect(ex - ew / 2 * w / RK_MISS, ey - 2, ew * w / RK_MISS, 4); });
    g.fillStyle = '#fff'; g.fillRect(ex - 1, ey - 7, 2, 14);
    for (const e of game.errs) { const a = Math.max(0, 1 - (nowMs - e.at) / 3000); if (!a) continue; g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(ex + e.err / RK_MISS * ew / 2 - 1, ey - 6, 2, 12); }
    // left side: title and the opponent's notes
    g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = 'bold 13px Segoe UI, sans-serif'; wrapText(rkTitle(game.s), 10, 24, 100, 16);
    g.font = '11px Segoe UI, sans-serif'; g.fillStyle = RK_DIFF_COLOR[game.d] || '#9aa6c8'; g.fillText(game.d + (game.s.chart && opt.side === 'opp' ? ' · opponent' : ''), 10, 64);
    if (game.opp.length) {
      const ox = 12, ow = 23, oy = 440;
      g.fillStyle = 'rgba(6,8,14,.6)'; g.fillRect(ox - 4, 80, ow * 4 + 8, H - 120);
      g.fillStyle = 'rgba(200,210,240,.5)'; g.font = 'bold 9px Segoe UI, sans-serif'; g.fillText(opt.side === 'opp' ? 'BOYFRIEND' : 'OPPONENT', ox, 94);
      for (let l = 0; l < 4; l++) {
        const lit = game.opp.some(n => t >= n.t && t <= n.t + Math.max(0.1, n.len) && n.lane === l);
        g.save(); g.globalAlpha = lit ? 1 : 0.35; if (opt.style === 'arrows') arrow(ox + l * ow + ow / 2, oy, 8, l, lit ? laneColor(l) : 'rgba(160,170,200,.6)'); else { g.fillStyle = lit ? laneColor(l) : 'rgba(160,170,200,.6)'; g.fillRect(ox + l * ow + 2, oy - 4, ow - 4, 8); } g.restore();
      }
      const os = opt.speed * 0.4;
      for (const n of game.opp) {
        const y = oy - (n.t - t) * os; if (y < 100 - n.len * os) break; if (y > oy + 4 && t > n.t + n.len) continue;
        const x = ox + n.lane * ow + ow / 2;
        if (n.len > 0.05) { const ty = Math.max(100, oy - (n.t + n.len - t) * os), by = Math.min(oy, y); if (by > ty) { g.fillStyle = hexA(laneColor(n.lane), 0.5); g.fillRect(x - 3, ty, 6, by - ty); } }
        if (y <= oy + 2 && y >= 100) { if (opt.style === 'arrows') arrow(x, y, 8, n.lane, laneColor(n.lane)); else { g.fillStyle = laneColor(n.lane); g.fillRect(x - ow / 2 + 2, y - 4, ow - 4, 8); } }
      }
    }
    // right side: score
    const rx = PX + LW * 4 + 12; g.textAlign = 'left';
    g.fillStyle = '#fff'; g.font = '900 22px Segoe UI, sans-serif'; g.fillText(String(game.score).padStart(7, '0'), rx, 34);
    g.font = 'bold 15px Segoe UI, sans-serif'; g.fillStyle = '#cfd8ff'; g.fillText(accuracy().toFixed(2) + '%', rx, 56);
    const lg = grade(accuracy()); g.font = '900 30px Segoe UI, sans-serif'; g.fillStyle = { S: '#ffd23f', A: '#7dff8a', B: '#7df9ff', C: '#c49bff', D: '#ff7a7a' }[lg]; g.fillText(lg, rx, 96);
    g.font = '12px Segoe UI, sans-serif';
    [['Perfect', '#7df9ff'], ['Great', '#7dff8a'], ['Good', '#ffe066'], ['Miss', '#ff5a5a']].forEach(([k, c], i) => { g.fillStyle = c; g.fillText(k, rx, 130 + i * 18); g.fillStyle = '#fff'; g.textAlign = 'right'; g.fillText(game.counts[k], CW - 10, 130 + i * 18); g.textAlign = 'left'; });
    // progress ring
    const pr = Math.max(0, Math.min(1, t / game.end)), pcx = rx + 34, pcy = 250;
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 6; g.beginPath(); g.arc(pcx, pcy, 26, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = `hsl(${hue},90%,65%)`; g.beginPath(); g.arc(pcx, pcy, 26, -Math.PI / 2, -Math.PI / 2 + pr * Math.PI * 2); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 11px Segoe UI, sans-serif'; g.textAlign = 'center'; g.fillText(rkTime(Math.max(0, game.end - Math.max(0, t))), pcx, pcy + 4);
    if (t < 0) { const c = Math.ceil(-t); g.textAlign = 'center'; g.font = '900 64px Segoe UI, sans-serif'; g.fillStyle = `rgba(255,255,255,${0.4 + (-t % 1) * 0.6})`; g.fillText(c, PX + LW * 2, 330); g.font = 'bold 13px Segoe UI, sans-serif'; g.fillStyle = '#cfd8ff'; g.fillText('Esc to quit', PX + LW * 2, 360); }
    if (together && nowMs - liveT > 500) { liveT = nowMs; W.push({ live: { tog: together.id, id: mp.self, name: me.name, color: me.color, score: game.score, acc: accuracy(), done: false } }); }
    else if (!together && !game.watch && live() && (nowMs - liveT > 90 || game.out.length > 6)) { liveT = nowMs; W.push({ rw: rwPacket(t) }); } // for anyone watching
    if (game.watch) {
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(PX, 0, LW * 4, 26); g.fillStyle = game.color || '#fff'; g.font = 'bold 13px Segoe UI, sans-serif'; g.textAlign = 'center';
      g.fillText(`👀 Watching ${game.name} · Esc to stop`, PX + LW * 2, 18);
    }
    renderLive();
    raf = requestAnimationFrame(frame);
  }
  function wrapText(text, x, y, w, lh) { // short titles on one line, long ones on two
    const words = text.split(' '); let line = '', n = 0;
    for (const word of words) { const tryL = line ? line + ' ' + word : word; if (g.measureText(tryL).width > w && line) { g.fillText(line, x, y + n++ * lh); line = word; if (n > 1) break; } else line = tryL; }
    if (n < 2) g.fillText(line, x, y + n * lh);
  }
  function renderLive() {
    const box = q('.rk-live');
    if (!together) { if (box.innerHTML) box.innerHTML = ''; return; }
    const rows = [{ name: me.name + ' (you)', color: me.color, score: game ? game.score : 0, acc: game ? accuracy() : 100 }, ...others.values()].sort((a, b) => b.score - a.score);
    box.innerHTML = '<h4>Together</h4>' + rows.map((r, i) => `<div><b>${i + 1}.</b> <span style="color:${esc(r.color)}">${esc(r.name)}</span> ${r.score} · ${r.acc.toFixed(1)}%${r.done ? ' ✓' : ''}</div>`).join('');
  }
  function finish() {
    if (!game || game.done) return;
    if (game.watch) { const w = game; stopWatch(); menu(`${w.name}'s song ended.`); return; }
    game.done = true; cancelAnimationFrame(raf);
    game.notes.forEach(n => { if (!n.hit) { n.hit = 'Miss'; game.counts.Miss++; } });
    const acc = accuracy(), gr = grade(acc), b = best(game.s, game.d), isBest = !b || game.score > b.score;
    if (isBest) store.set(bestKey(game.s, game.d), { score: game.score, grade: gr, acc: +acc.toFixed(2), combo: game.maxCombo });
    if (together) W.push({ live: { tog: together.id, id: mp.self, name: me.name, color: me.color, score: game.score, acc, done: true } });
    else if (live()) W.push({ rw: { id: mp.self, run: game.run, end: true, name: me.name, score: game.score, acc, grade: gr } });
    if (game.score > 0) lbSubmit('rhythm', `rk:${lbSlug(game.s.src)}:${game.d.toLowerCase()}:${game.side === 'opp' ? 'opp' : 'player'}`, game.score, `${acc.toFixed(2)}% · ${gr} · ${game.maxCombo}x`);
    const c = game.counts, total = Math.max(1, c.Perfect + c.Great + c.Good + c.Miss);
    // how early or late the hits were, in 10 ms buckets
    const bucket = new Array(31).fill(0); (game.allErrs || []).forEach(e => { bucket[Math.max(0, Math.min(30, Math.round(e / 10) + 15))]++; });
    const peak = Math.max(1, ...bucket), errs = game.allErrs || [], mean = errs.length ? errs.reduce((a, v) => a + v, 0) / errs.length : 0;
    q('.rk-play').hidden = true; menuEl.hidden = false; menuEl.dataset.view = 'result';
    menuEl.innerHTML = `<div class="rk-result" style="--h:${rkHue(rkTitle(game.s))}"><div class="rk-rhead"><b>${esc(rkTitle(game.s))}</b><span style="color:${RK_DIFF_COLOR[game.d] || '#9aa6c8'}">${esc(game.d)}</span></div>`
      + `<div class="rk-rmain"><div class="rk-grade g${gr}">${gr}</div><div class="rk-rstats">${isBest ? '<span class="rk-new">NEW BEST!</span>' : ''}<b class="rk-rscore">${game.score.toLocaleString()}</b>`
      + `<div class="rk-res"><div><small>Accuracy</small><b>${acc.toFixed(2)}%</b></div><div><small>Max combo</small><b>${game.maxCombo}x</b></div><div><small>Timing</small><b>${errs.length ? (mean < 0 ? `${Math.round(-mean)}ms early` : `${Math.round(mean)}ms late`) : '–'}</b></div></div></div></div>`
      + `<div class="rk-counts">${[['Perfect', '#7df9ff'], ['Great', '#7dff8a'], ['Good', '#ffe066'], ['Miss', '#ff5a5a']].map(([k, col]) => `<div><span style="color:${col}">${k}</span><i><em style="width:${c[k] / total * 100}%;background:${col}"></em></i><b>${c[k]}</b></div>`).join('')}</div>`
      + `<div class="rk-hist" title="How early (left) or late (right) your hits were">${bucket.map((v, i) => `<i style="height:${v / peak * 100}%;background:${Math.abs(i - 15) <= 4 ? '#7df9ff' : Math.abs(i - 15) <= 8 ? '#7dff8a' : '#ffe066'}"></i>`).join('')}<span>early</span><span>late</span></div>`
      + `<div class="rk-live2"></div><div class="rk-go"><button class="rk-retry">↻ Retry</button><button class="rk-back">Song list</button><button class="rk-lb">🏆 Leaderboard</button></div></div>`;
    const lv = menuEl.querySelector('.rk-live2'); if (lv && together) lv.innerHTML = q('.rk-live').innerHTML;
    const s = game.s, d = game.d;
    menuEl.querySelector('.rk-retry').onclick = () => play(s, d, null);
    menuEl.querySelector('.rk-back').onclick = () => menu();
    menuEl.querySelector('.rk-lb').onclick = () => openLeaderboards('rhythm', { song: lbSlug(s.src), diff: d.toLowerCase(), side: game && game.side === 'opp' ? 'opp' : 'player' });
    setMusic(true);
  }
  function stop() {
    if (game && game.watch) return stopWatch();
    if (game && !game.done) { game.done = true; try { game.src.onended = null; game.src.stop(); } catch {} cancelAnimationFrame(raf); setMusic(true); if (live() && !together) W.push({ rw: { id: mp.self, run: game.run, end: true, stopped: true, name: me.name } }); }
  }
  // watching someone play alone: their song, their notes and their hits, about ten times a second
  const rwPacket = t => ({ id: mp.self, run: game.run, name: me.name, color: me.color, src: game.s.src, diff: game.d, side: game.side, t, score: game.score, combo: game.combo, max: game.maxCombo,
    counts: game.counts, held: game.held.slice(), ev: game.out.splice(0) });
  const players = new Map(); // id -> latest packet from someone playing alone
  let skipRun = null, watchLoading = null;
  function stopWatch() {
    if (!game || !game.watch) return;
    game.done = true; try { game.src.onended = null; game.src.stop(); } catch {} cancelAnimationFrame(raf); setMusic(true);
    skipRun = game.run; game = null;
  }
  function syncWatch(p) { // keep our copy of their song playing at the same spot
    const est = p.t, lat = rkCtx.outputLatency || rkCtx.baseLatency || 0;
    if (game.src && Math.abs(now() - est) < 0.2) return;
    try { if (game.src) { game.src.onended = null; game.src.stop(); } } catch {}
    const at = rkCtx.currentTime + 0.03; game.t0 = at - est - lat - opt.offset / 1000;
    const src = rkCtx.createBufferSource(); src.buffer = game.buf; src.connect(gain);
    const pos = at - game.t0; if (pos >= 0) src.start(at, pos); else src.start(game.t0, 0);
    src.onended = () => { if (game && game.watch && game.src === src) finish(); };
    game.src = src;
  }
  function applyWatch(p) {
    Object.assign(game, { score: p.score, combo: p.combo, maxCombo: p.max, counts: p.counts, held: p.held || [0, 0, 0, 0] });
    for (const [i, j, err] of p.ev || []) {
      const n = game.notes[i]; if (!n) continue;
      n.hit = j;
      if (j === 'Dropped') { n.broke = true; n.holding = false; game.pop = { text: j, color: '#ff5a5a', at: performance.now() }; }
      else if (j === 'Miss') game.pop = { text: j, color: '#ff5a5a', at: performance.now() };
      else {
        const col = (RK_JUDGE.find(x => x[0] === j) || [])[3] || '#fff';
        game.pop = { text: j, color: col, at: performance.now(), err: j === 'Perfect' ? 0 : err || 0 }; game.bump = 1; game.press[n.lane] = 1;
        game.fx.push({ lane: n.lane, at: performance.now(), color: laneColor(n.lane), big: j === 'Perfect' });
        game.errs.push({ err: err || 0, at: performance.now() }); if (game.errs.length > 30) game.errs.shift();
      }
    }
    syncWatch(p);
  }
  async function startWatch(p) {
    const s = songs.find(x => x.src === p.src); if (!s || watchLoading === p.run) return;
    watchLoading = p.run; stopPreview();
    try {
      const { buf, notes, opp, bpm } = await loadSong(s, p.diff, p.side);
      if (rkCtx.state === 'suspended') rkCtx.resume().catch(() => {});
      const cur = players.get(p.id) || p; if (watchLoading !== p.run || (game && !game.done) || cur.run !== p.run || cur.end) return;
      setMusic(false);
      gain = rkCtx.createGain(); analyser = rkCtx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.75;
      W.audio.apply(); gain.connect(analyser); analyser.connect(rkCtx.destination);
      game = { watch: true, who: p.id, name: p.name, color: p.color, run: p.run, s, d: p.diff, side: p.side, buf, src: null, t0: 0, bpm, notes: notes.map((n, i) => ({ ...n, i, hit: n.t < cur.t - 0.15 ? 'old' : null, held: n.t + n.len < cur.t })),
        opp: opp.map(n => ({ ...n })), score: 0, combo: 0, maxCombo: 0, counts: { Perfect: 0, Great: 0, Good: 0, Miss: 0 }, held: [0, 0, 0, 0], press: [0, 0, 0, 0], fx: [], pop: null, errs: [], out: [], end: buf.duration, done: false, bump: 0, spec: new Uint8Array(analyser.frequencyBinCount) };
      menuEl.hidden = true; q('.rk-play').hidden = false;
      applyWatch(cur);
      cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    } catch { /* can't load it here: stay on the menu */ } finally { if (watchLoading === p.run) watchLoading = null; }
  }
  function seePlayer(p) {
    if (!p || p.id === mp.self) return;
    if (p.end) {
      players.delete(p.id);
      if (game && game.watch && game.who === p.id) { stopWatch(); menu(p.stopped ? `${p.name} stopped playing.` : `${p.name} finished: ${p.grade} · ${p.score.toLocaleString()} · ${(+p.acc).toFixed(2)}%`); }
      return;
    }
    const was = players.get(p.id); players.set(p.id, { ...p, ev: [] });
    if (game && game.watch && game.who === p.id && game.run === p.run) return applyWatch(p);
    if (game && game.watch && game.who === p.id) { stopWatch(); skipRun = null; } // they started another song
    if ((!game || game.done) && !menuEl.hidden && p.run !== skipRun && W.el.isConnected) startWatch(p); // not playing ourselves: watch them
    if (!was) watchBanner();
  }
  function watchBanner() { // on the song list: who's playing, to watch again after stopping
    const head = menuEl.querySelector('.rk-head'); if (!head) return;
    let box = head.querySelector('.rk-watch'); const list = [...players.values()].filter(p => performance.now() - (p.seen || 0) < 4000);
    if (!list.length) { if (box) box.remove(); return; }
    if (!box) { box = el('<span class="rk-watch"></span>'); head.insertBefore(box, head.lastChild); }
    const html = list.map(p => `<button data-id="${esc(p.id)}">👀 Watch ${esc(p.name)}</button>`).join('');
    if (box.dataset.h !== html) { box.dataset.h = html; box.innerHTML = html; box.querySelectorAll('button').forEach(b => b.onclick = () => { const p = players.get(b.dataset.id); if (p) { skipRun = null; startWatch(p); } }); }
  }
  // input
  const onKey = e => {
    if (!W.el.classList.contains('active') || e.target.matches?.('input, textarea')) return;
    if (binding >= 0 && e.type === 'keydown') { // choosing a key in Settings
      e.preventDefault(); if (e.code !== 'Escape') { const i = opt.keys.indexOf(e.code); if (i >= 0) opt.keys[i] = opt.keys[binding]; opt.keys[binding] = e.code; saveOpt(); }
      binding = -1; renderDetail(); return;
    }
    if (game && !game.done) {
      if (e.key === 'Escape' && e.type === 'keydown') { menu(game.watch ? 'Stopped watching.' : 'Stopped.'); return; }
      if (game.watch) return;
      const l = opt.keys.indexOf(e.code); if (l < 0 || e.repeat) return;
      e.preventDefault(); if (e.type === 'keydown') judge(l); else release(l);
      return;
    }
    if (e.type !== 'keydown' || menuEl.hidden) return;
    if (menuEl.dataset.view === 'result') { if (e.key === 'Enter') { e.preventDefault(); menuEl.querySelector('.rk-retry').click(); } else if (e.key === 'Escape') menu(); return; }
    const i = songs.indexOf(song), ds = diffsOf(song), di = ds.indexOf(pickDiff(song));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); select(songs[(i + (e.key === 'ArrowDown' ? 1 : -1) + songs.length) % songs.length]); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); diff = ds[(di + (e.key === 'ArrowRight' ? 1 : -1) + ds.length) % ds.length]; store.set('rk-diff', diff); refresh(); }
    else if (e.key === 'Enter' && !e.target.closest?.('button')) { e.preventDefault(); play(song, pickDiff(song)); }
  };
  document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
  const laneAt = e => { const r = lrect(cv), x = (cX(e) - r.left) / r.width * CW; return Math.floor((x - PX) / LW); };
  cv.addEventListener('pointerdown', e => { const l = laneAt(e); if (l >= 0 && l < 4) { judge(l); cv.setPointerCapture(e.pointerId); cv.dataset.l = l; } });
  ['pointerup', 'pointercancel'].forEach(ev => cv.addEventListener(ev, () => { if (game && cv.dataset.l) { release(+cv.dataset.l); delete cv.dataset.l; } }));
  cv.style.touchAction = 'none';
  // multiplayer: someone pressed "Play together"; live scores while playing it
  shareState(W, () => ({}), d => {
    if (d.together) { const s = songs.find(x => x.src === d.together.src); if (s) { stop(); diff = d.together.diff; song = s; play(s, d.together.diff, d.together); } }
    else if (d.rw) { const p = d.rw; if (!p.end) p.seen = performance.now(); seePlayer(p); }
    else if (d.live && together && d.live.tog === together.id) { others.set(d.live.id, d.live); renderLive(); const lv = q('.rk-live2'); if (lv) lv.innerHTML = q('.rk-live').innerHTML; }
  });
  W.onClose = () => { stop(); stopWatch(); stopPreview(); clearInterval(previewT); document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); rkWin = null; };
  rkWin = W;
  menu();
  return W;
}
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${Math.max(0, Math.min(1, a))})`; };

/* ---------- leaderboards ---------- */
// Online high scores, kept in a Supabase database (see LEADERBOARD in config.js). Each person keeps one
// row per board, their best. Only scores from games played alone count: nobody else's keys or moves.
const lbOn = () => !!(typeof LEADERBOARD === 'object' && LEADERBOARD.url && LEADERBOARD.key);
const lbPlayer = store.get('lb-id', null) || (() => { const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join(''); store.set('lb-id', id); return id; })();
const lbName = () => (store.get('lb-name', '') || me.name).slice(0, 24);
const lbSolo = () => !live() || mp.peers.size === 0;
const lbSlug = t => String(t).toLowerCase().replace(/^.*\//, '').replace(/[^a-z0-9._-]+/g, '-').slice(0, 60);
const lbTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const LB_GAMES = [
  { id: 'tetris', name: 'Tetris', icon: 'tetris', board: () => 'tetris', fmt: v => v.toLocaleString(), col: 'Score' },
  { id: 'rhythm', name: 'Rhythm Keys', icon: 'rhythm', board: sel => `rk:${sel.song}:${sel.diff}:${sel.side}`, fmt: v => v.toLocaleString(), col: 'Score' },
  { id: 'pinball', name: 'Pinball', icon: 'pinball', board: () => 'pinball', fmt: v => v.toLocaleString(), col: 'Score' },
  { id: 'snake', name: 'Snake', icon: 'snake', board: () => 'snake', fmt: v => v.toLocaleString(), col: 'Score' },
  { id: 'ms', name: 'Minesweeper daily', icon: 'minesweeper', daily: true, lower: true, board: (sel, day) => `ms:${day}:${sel.level.toLowerCase()}`, fmt: (v, r) => r.detail || '', col: 'Result' },
  { id: 'wordle', name: 'Wordle', icon: 'wordle', daily: true, lower: true, board: (sel, day) => `wordle:${day}`, fmt: (v, r) => r.detail || '', col: 'Guesses' },
  { id: 'sudoku', name: 'Sudoku daily', icon: 'sudoku', daily: true, lower: true, board: (sel, day) => `sudoku:${day}`, fmt: v => lbTime(v), col: 'Time' },
];
async function lbFetch(path, opts = {}) {
  const r = await fetch(LEADERBOARD.url.replace(/\/+$/, '') + '/rest/v1/' + path, { ...opts, headers: { apikey: LEADERBOARD.key, Authorization: `Bearer ${LEADERBOARD.key}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`leaderboard ${r.status}`);
  return r;
}
async function lbTop(board, lower, limit = 50) {
  const r = await lbFetch(`scores?board=eq.${encodeURIComponent(board)}&select=name,score,detail,created_at,player&order=score.${lower ? 'asc' : 'desc'},created_at.asc&limit=${limit}`);
  return r.json();
}
async function lbRank(board, lower) { // where my best on this board stands
  const mine = await (await lbFetch(`scores?board=eq.${encodeURIComponent(board)}&player=eq.${lbPlayer}&select=score`)).json();
  if (!mine.length) return null;
  const r = await lbFetch(`scores?board=eq.${encodeURIComponent(board)}&score=${lower ? 'lt' : 'gt'}.${mine[0].score}&select=id`, { headers: { Prefer: 'count=exact', Range: '0-0' } });
  const total = +((r.headers.get('content-range') || '').split('/')[1] || 0);
  return { rank: total + 1, score: mine[0].score };
}
async function lbSubmit(gameId, board, score, detail = '') {
  if (!lbOn() || !Number.isFinite(score)) return;
  const G = LB_GAMES.find(x => x.id === gameId);
  try {
    const before = await lbRank(board, G.lower).catch(() => null);
    await lbFetch('rpc/submit_score', { method: 'POST', body: JSON.stringify({ p_board: board, p_player: lbPlayer, p_name: lbName(), p_score: score, p_detail: String(detail).slice(0, 80), p_lower: !!G.lower }) });
    const now = await lbRank(board, G.lower);
    const better = !before || now.score !== before.score;
    if (now) toast(better ? `🏆 ${G.name}: new best, you're #${now.rank} on the leaderboard!` : `🏆 ${G.name}: your best is still #${now.rank} on the leaderboard`);
    if (lbWin) lbWin.refresh();
  } catch { toast(`Couldn't send your ${G.name} score to the leaderboard.`); }
}
let lbWin = null;
function openLeaderboards(gameId = store.get('lb-game', 'tetris'), sel = {}) {
  if (lbWin) { lbWin.show(gameId, sel); focusWin(lbWin); return lbWin; }
  const W = makeWin({ title: 'Leaderboards', icon: I.leaderboards, w: 720, h: 520 });
  W.body.innerHTML = '<div class="lbx"><nav class="lbx-games"></nav><div class="lbx-main"><div class="lbx-head"></div><div class="lbx-list"></div>'
    + '<div class="lbx-foot"><label>Your name on the leaderboards <input class="lbx-name" maxlength="24"></label><button class="okbtn lbx-ref">Refresh</button></div></div></div>';
  const q = x => W.body.querySelector(x);
  const songs = []; (function walk(n) { (n.children || []).forEach(c => { if (c.type === 'audio' && !songs.some(t => t.src === c.src)) songs.push(c); else if (c.children) walk(c); }); })(desktop);
  let game = gameId, day = dayKey(), opt = { level: 'Beginner', song: songs[0] ? lbSlug(songs[0].src) : '', diff: 'normal', side: 'player' }, ask = 0;
  q('.lbx-games').innerHTML = LB_GAMES.map(G => `<button data-g="${G.id}">${img(I[G.icon] || I.leaderboards, '')}<span>${esc(G.name)}</span></button>`).join('');
  q('.lbx-games').querySelectorAll('button').forEach(b => b.onclick = () => W.show(b.dataset.g));
  const name = q('.lbx-name'); name.value = lbName(); name.onchange = () => { store.set('lb-name', name.value.trim().slice(0, 24)); name.value = lbName(); };
  q('.lbx-ref').onclick = () => W.refresh();
  function head() {
    const G = LB_GAMES.find(x => x.id === game);
    let h = `<h3>${esc(G.name)}</h3>`;
    if (G.daily) h += `<div class="lbx-day"><button data-d="-1" aria-label="Day before">◀</button><span>${day === dayKey() ? 'Today' : esc(day)}</span><button data-d="1" aria-label="Next day"${day >= dayKey() ? ' disabled' : ''}>▶</button></div>`;
    if (G.id === 'ms') h += `<div class="lbx-opts">${Object.keys(MS_LEVELS).map(l => `<button class="tbtn${l === opt.level ? ' on' : ''}" data-level="${l}">${l}</button>`).join('')}</div>`;
    if (G.id === 'rhythm') {
      const s = songs.find(x => lbSlug(x.src) === opt.song), diffs = s && s.chart ? ['chart'] : Object.keys(RK_DIFF).map(d => d.toLowerCase());
      if (s && !diffs.includes(opt.diff)) opt.diff = diffs[0];
      h += `<div class="lbx-opts"><select class="lbx-song">${songs.map(x => `<option value="${esc(lbSlug(x.src))}"${lbSlug(x.src) === opt.song ? ' selected' : ''}>${esc(x.name.replace(/\.[^.]+$/, ''))}</option>`).join('')}</select>`
        + `<select class="lbx-diff">${diffs.map(d => `<option${d === opt.diff ? ' selected' : ''} value="${d}">${d[0].toUpperCase() + d.slice(1)}</option>`).join('')}</select>`
        + (s && s.chart ? `<select class="lbx-side"><option value="player"${opt.side === 'player' ? ' selected' : ''}>Boyfriend</option><option value="opp"${opt.side === 'opp' ? ' selected' : ''}>Opponent</option></select>` : '') + '</div>';
    }
    q('.lbx-head').innerHTML = h;
    q('.lbx-head').querySelectorAll('[data-d]').forEach(b => b.onclick = () => { day = dayKey(new Date(Date.parse(day) + +b.dataset.d * 864e5)); W.refresh(); });
    q('.lbx-head').querySelectorAll('[data-level]').forEach(b => b.onclick = () => { opt.level = b.dataset.level; W.refresh(); });
    const so = q('.lbx-song'); if (so) so.onchange = () => { opt.song = so.value; W.refresh(); };
    const di = q('.lbx-diff'); if (di) di.onchange = () => { opt.diff = di.value; W.refresh(); };
    const si = q('.lbx-side'); if (si) si.onchange = () => { opt.side = si.value; W.refresh(); };
  }
  W.refresh = async () => {
    head();
    const G = LB_GAMES.find(x => x.id === game), list = q('.lbx-list'), my = ++ask;
    q('.lbx-games').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.g === game));
    if (!lbOn()) { list.innerHTML = '<div class="lbx-msg">Leaderboards aren\'t set up yet.<br><br>The site owner needs a free Supabase project: see LEADERBOARD in config.js for the three steps.</div>'; return; }
    list.innerHTML = '<div class="lbx-msg">Loading…</div>';
    try {
      const board = G.board(opt, day), rows = await lbTop(board, G.lower), me2 = rows.findIndex(r => r.player === lbPlayer);
      if (my !== ask) return;
      if (!rows.length) { list.innerHTML = `<div class="lbx-msg">No scores here yet${G.daily && day === dayKey() ? ' today' : ''}. Be the first!</div>`; return; }
      let extra = '';
      if (me2 < 0) { const r = await lbRank(board, G.lower).catch(() => null); if (my !== ask) return; if (r) extra = `<tr class="me"><td>${r.rank}</td><td>${esc(lbName())} (you)</td><td>${esc(G.fmt(r.score, {}))}</td><td></td><td></td></tr>`; }
      const medal = k => ['🥇', '🥈', '🥉'][k] || k + 1;
      list.innerHTML = `<table class="lbx-table"><thead><tr><th>#</th><th>Name</th><th>${G.col}</th><th>Details</th><th>When</th></tr></thead><tbody>`
        + rows.map((r, k) => `<tr${r.player === lbPlayer ? ' class="me"' : ''}><td>${medal(k)}</td><td>${esc(r.name)}${r.player === lbPlayer ? ' (you)' : ''}</td><td>${esc(G.fmt(r.score, r))}</td><td>${G.id === 'wordle' || G.id === 'ms' ? '' : esc(r.detail || '')}</td><td>${esc(new Date(r.created_at).toLocaleDateString())}</td></tr>`).join('')
        + (extra ? '<tr class="gap"><td colspan="5">…</td></tr>' + extra : '') + '</tbody></table>';
    } catch (e) { if (my === ask) list.innerHTML = `<div class="lbx-msg">Couldn't load the leaderboard (${esc(e.message)}).</div>`; }
  };
  W.show = (g, s2 = {}) => { if (LB_GAMES.some(x => x.id === g)) game = g; store.set('lb-game', game); Object.assign(opt, s2); if (s2.day) day = s2.day; W.refresh(); };
  W.onClose = () => { lbWin = null; };
  lbWin = W; W.show(gameId, sel);
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
const leftItems = DESKTOP_ITEMS.filter(n => ['folder', 'txt', 'minesweeper', 'wordle', 'paint', 'pixelpaint', 'pinball', 'snake', 'solitaire', 'airhockey', 'tetris', 'guessdraw', 'rhythm', 'leaderboards', 'tictactoe', 'connect4', 'checkers', 'chess', 'g2048', 'sudoku', 'video', 'audio', 'browser'].includes(n.type))
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

/* ---------- sound and volume mixer ---------- */
// The speaker button opens a mixer: Speakers turns everything up or down, and every window that's making
// sound gets its own slider and mute. Levels are yours only; in multiplayer they don't change anyone else's.
const volBtn = document.getElementById('vol'), volPop = document.getElementById('volpop'), mxEl = volPop.querySelector('.mx');
const music = SOUND.music ? new Audio() : null;
const snd = store.get('sound', { volume: SOUND.musicVolume, muted: !!SOUND.startMuted }); // background music
const mix = store.get('mixer', { master: 1, muted: false });
const appLevels = store.get('mixer-apps', {}); // last level per kind of window: player, video, web
let musicOn = true;
if (music) { music.loop = true; music.preload = 'none'; music.src = SOUND.music; }
function mixLevel(a) { return mix.muted || a.muted ? 0 : mix.master * a.vol; }
// windows call this to get a mixer channel; apply() pushes the level into their player
function mixChannel(W, key, defVol, apply, extra = {}) {
  W.audio = Object.assign({ key, vol: appLevels[key] ?? defVol, muted: false, apply: () => apply(mixLevel(W.audio)) }, extra);
  W.audio.apply();
}
function applyVolume() {
  if (music) music.volume = mix.muted || snd.muted ? 0 : mix.master * snd.volume;
  wins.forEach(w => w.audio && w.audio.apply());
  const v = Math.round(mix.master * 100), icon = mix.muted || !v ? U.mute : U.volume;
  volBtn.innerHTML = img(icon, '');
  volBtn.title = mix.muted ? 'Speakers: muted' : `Speakers: ${v}% · click for the volume mixer`;
  store.set('mixer', mix); store.set('sound', snd);
}
// browsers only allow sound once the visitor has clicked or pressed a key
function playMusic() { if (music && musicOn && music.paused) music.play().catch(() => {}); }
function setMusic(on) { musicOn = on; if (on) playMusic(); else if (music) music.pause(); }
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, playMusic, true));

function mixerChannels() {
  const out = [{ id: 'master', name: 'Speakers', icon: U.volume, st: mix, master: true }];
  if (music) out.push({ id: 'bg', name: 'Background music', icon: I.music, st: snd });
  wins.forEach(w => {
    if (!w.audio || (w.audio.active && !w.audio.active())) return;
    const title = w.el.querySelector('.ttl').textContent;
    out.push({ id: 'w' + (w.sid || wins.indexOf(w)) + (w.audio.locked ? 'L' : '') + (w.audio.muteOnly ? 'M' : ''), name: w.audio.label ? w.audio.label() : title, title, icon: (w.el.querySelector('.ti img') || {}).src, st: w.audio, w });
  });
  return out;
}
let mxSig = '', mxTimer = null;
function renderMixer(force) {
  const chans = mixerChannels(), sig = chans.map(c => c.id + c.name).join('|');
  if (!force && sig === mxSig) return;
  mxSig = sig;
  mxEl.replaceChildren(...chans.map(c => {
    const st = c.st, locked = c.w && c.w.audio.locked;
    const box = el('<div class="mx-ch"><img class="mx-ic" alt=""><span class="mx-name"></span><input type="range" min="0" max="100" step="1"><span class="mx-pct"></span><button class="mx-mute"></button></div>');
    box.classList.toggle('master', !!c.master);
    box.querySelector('.mx-ic').src = c.icon || I.music;
    box.querySelector('.mx-name').textContent = c.name; box.title = c.title || c.name;
    const range = box.querySelector('input'), pct = box.querySelector('.mx-pct'), mute = box.querySelector('.mx-mute');
    range.setAttribute('aria-label', `${c.name} volume`);
    const val = () => Math.round((c.master ? st.master : st.vol) * 100);
    const paint = () => { range.value = val(); if (!(c.w && c.w.audio.muteOnly)) pct.textContent = val(); mute.innerHTML = img(st.muted || !val() ? U.mute : U.volume, ''); mute.setAttribute('aria-label', (st.muted ? 'Unmute ' : 'Mute ') + c.name); };
    range.oninput = () => {
      const v = range.value / 100;
      if (c.master) mix.master = v; else st.vol = v;
      st.muted = false;
      if (c.w) { appLevels[c.w.audio.key] = v; store.set('mixer-apps', appLevels); }
      applyVolume(); paint();
    };
    mute.onclick = () => { st.muted = !st.muted; applyVolume(); paint(); };
    paint();
    if (locked) { range.disabled = mute.disabled = true; pct.className = 'mx-note'; pct.textContent = locked; } // Spotify: only its own volume works
    else if (c.w && c.w.audio.muteOnly) { range.disabled = true; pct.className = 'mx-note'; pct.textContent = c.w.audio.muteOnly; box.title = "Spotify doesn't let other pages change its volume, so this can only mute it (for you only)"; }
    return box;
  }));
  if (chans.length === (music ? 2 : 1)) mxEl.append(el('<div class="mx-empty">Windows playing sound (music, videos, YouTube) show up here with their own slider.</div>'));
}
const closeVol = () => { volPop.hidden = true; volBtn.classList.remove('on'); clearInterval(mxTimer); };
function placeMixer() {
  const r = lrect(volBtn);
  volPop.style.left = Math.max(4, Math.min(innerWidth - volPop.offsetWidth - 4, r.left + r.width / 2 - volPop.offsetWidth / 2)) + 'px';
}
volBtn.onclick = e => {
  e.stopPropagation(); closeStart();
  if (!cal.hidden) { cal.hidden = true; tray.classList.remove('on'); }
  if (!volPop.hidden) return closeVol();
  volPop.hidden = false; volBtn.classList.add('on');
  renderMixer(true); placeMixer();
  mxTimer = setInterval(() => { const before = mxSig; renderMixer(); if (mxSig !== before) placeMixer(); }, 600); // windows opening and closing
};
document.addEventListener('pointerdown', e => { if (!volPop.hidden && !volPop.contains(e.target) && !volBtn.contains(e.target)) closeVol(); });
volBtn.addEventListener('wheel', e => { e.preventDefault(); mix.master = Math.max(0, Math.min(1, mix.master + (e.deltaY < 0 ? 0.05 : -0.05))); mix.muted = false; applyVolume(); if (!volPop.hidden) renderMixer(true); }, { passive: false });
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

// can this browser make direct connections at all? 'ok', 'udp' (only works on the same wifi) or 'off' (WebRTC blocked)
let rtcCheck = null, rtcResult = '', rtcSeen = null;
function checkRtc() {
  return rtcCheck ||= new Promise(done => {
    if (typeof RTCPeerConnection !== 'function') return done('off');
    let pc, seen = rtcSeen = { host: 0, srflx: 0, relay: 0, prflx: 0, protos: [] }, end = () => { clearTimeout(t); try { pc.close(); } catch {} done(seen.srflx || seen.relay ? 'ok' : seen.host ? 'udp' : 'off'); };
    const t = setTimeout(end, 6000);
    try {
      pc = new RTCPeerConnection({ iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }, ...(MULTIPLAYER.turn || [])] });
      pc.createDataChannel('x');
      pc.onicecandidate = e => { if (!e.candidate) return end(); const c = e.candidate.candidate, m = / typ (\w+)/.exec(c), pr = / (udp|tcp) /i.exec(c); if (m && m[1] in seen) seen[m[1]]++; if (pr && !seen.protos.includes(pr[1].toLowerCase())) seen.protos.push(pr[1].toLowerCase()); };
      pc.createOffer().then(o => pc.setLocalDescription(o)).catch(end);
    } catch { end(); }
  }).then(r => rtcResult = r);
}

// everything useful for working out why someone can't connect, as text they can copy and send
function connectionReport() {
  const ver = (document.querySelector('script[src*="desktop.js"]') || {}).src?.match(/v=(\w+)/)?.[1] || '?';
  const socks = mpLib && mpLib.getRelaySockets ? mpLib.getRelaySockets() : {};
  const state = ['connecting', 'open', 'closing', 'closed'];
  const relays = Object.entries(socks).map(([u, ws]) => `  ${ws ? state[ws.readyState] : 'none'}  ${u.replace('wss://', '')}`);
  const ua = navigator.userAgent, br = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Brave/.test(ua) || navigator.brave ? 'Brave' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'other';
  const inApp = /Discord|Instagram|FBAN|FBAV|TikTok|Snapchat|Line\//i.test(ua) ? ' (inside an app\'s built-in browser)' : '';
  const s = rtcSeen || {};
  return [
    `KrowOS connection report · ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`,
    `Site version: ${ver} · page: ${location.origin + location.pathname}`,
    `Room: ${roomCode || '(not in a room)'} · in room for ${room ? Math.round((Date.now() - since) / 1000) + 's' : '-'}`,
    `People connected: ${mp.peers.size}${mp.peers.size ? ' (' + [...mp.peers.values()].map(p => p.name).join(', ') + ')' : ''}`,
    `Browser: ${br}${inApp} · ${navigator.platform || ''} · online: ${navigator.onLine}`,
    `Direct connections: ${{ ok: 'OK', udp: 'only on the same network (blocked to the outside)', off: 'blocked by the browser', '': 'still checking' }[rtcResult]}`
      + ` · found ${s.host || 0} local, ${s.srflx || 0} public, ${s.relay || 0} TURN addresses${s.protos && s.protos.length ? ' over ' + s.protos.join('/') : ''}`,
    `TURN server set up: ${MULTIPLAYER.turn ? 'yes' : 'no'}`,
    ...[...mp.peers.values()].map(p => `  ${p.name}: ${p.link === 'turn' ? 'through TURN' : p.link === 'direct' ? 'direct' : 'checking'}${p.ping != null ? ` · ${p.ping} ms` : ''}`),
    `Error from the connection library: ${mpError || 'none'}`,
    `Helper servers: ${Object.values(socks).filter(ws => ws && ws.readyState === 1).length} of ${Object.keys(socks).length} open`,
    ...relays,
    `User agent: ${ua}`,
  ].join('\n');
}

async function joinRoom(code) {
  if (room) await leaveRoom();
  roomCode = code.toLowerCase().replace(/[^\w-]/g, '').slice(0, 32); if (!roomCode) return;
  try { mpLib ||= await import('./assets/vendor/trystero.js'); }
  catch { toast("Couldn't load multiplayer. Open the site from a web server, not straight from a file."); roomCode = ''; return; }
  since = Date.now(); synced = false; mpError = ''; checkRtc().then(() => refreshMp());
  const config = { appId: `krowos-${SITE_NAME}`, password: roomCode };
  // our list plus every relay the library knows: both people use the same list, so any one that works is enough
  const urls = [...(MULTIPLAYER.relays || []), ...(MULTIPLAYER.moreRelays !== false && mpLib.defaultRelayUrls || [])].map(u => u.includes('://') ? u : 'wss://' + u);
  if (urls.length) config.relayConfig = { urls: [...new Set(urls)] };
  if (MULTIPLAYER.turn) config.turnConfig = MULTIPLAYER.turn;
  room = mpLib.joinRoom(config, roomCode, { onJoinError: e => { mpError = e.error || String(e); refreshMp(); } });
  const action = room.makeAction('m');
  const raw = (m, to) => { action.send(m, to ? { target: to } : undefined).catch(() => {}); };
  // over TURN (relayed) connections, mouse moves and whole-game snapshots go out less often to save the
  // free allowance: the newest one waits for its turn and older ones in between are skipped
  const slow = new Map(); // peerId -> { key -> { at, pending, timer } }
  const RELAY_GAP = { cur: 100, app: 66 };
  const viaRelay = (m, id) => {
    const key = m.t === 'cur' ? 'cur' : m.t === 'app' && m.lw ? 'app:' + m.sid : null;
    if (!key) return raw(m, id);
    const per = slow.get(id) || slow.set(id, new Map()).get(id), s = per.get(key) || per.set(key, { at: 0, pending: null, timer: 0 }).get(key);
    const gap = RELAY_GAP[m.t === 'cur' ? 'cur' : 'app'], now = performance.now();
    if (now - s.at >= gap && !s.timer) { s.at = now; return raw(m, id); }
    s.pending = m;
    if (!s.timer) s.timer = setTimeout(() => { s.timer = 0; s.at = performance.now(); if (s.pending && mp.peers.has(id)) raw(s.pending, id); s.pending = null; }, Math.max(0, gap - (now - s.at)));
  };
  mp.send = (m, to) => {
    if (to) return mp.relayed.has(to) ? viaRelay(m, to) : raw(m, to);
    if (!mp.relayed.size) return raw(m);
    mp.peers.forEach((p, id) => mp.relayed.has(id) ? viaRelay(m, id) : raw(m, id));
  };
  action.onMessage = (m, { peerId }) => receive(m, peerId);
  room.onPeerJoin = peerId => { hello(peerId); setTimeout(checkLinks, 1500); };
  room.onPeerLeave = peerId => {
    const p = mp.peers.get(peerId); if (!p) return;
    p.cur.remove(); if (p.box) p.box.remove(); mp.peers.delete(peerId); mp.relayed.delete(peerId); paintSel(); paintFocus(); pickRoomClock(); toast(`${p.name} left`); addChat({ sys: true, text: `${p.name} left` }); refreshMp();
  };
  history.replaceState(null, '', '#room=' + roomCode);
  refreshMp();
}
// every 10 s: how long a message takes to come back from each person, and whether the connection is
// direct or goes through the TURN server
async function checkLinks() {
  if (!room) return;
  mpSend({ t: 'ping', ts: performance.now() });
  let pcs = {}; try { pcs = room.getPeers ? room.getPeers() : {}; } catch {}
  await Promise.all(Object.entries(pcs).map(async ([id, pc]) => {
    const p = mp.peers.get(id); if (!pc || !pc.getStats) return;
    try {
      const stats = await pc.getStats(), all = [...stats.values()];
      const tr = all.find(x => x.type === 'transport' && x.selectedCandidatePairId);
      const pair = tr ? stats.get(tr.selectedCandidatePairId) : all.find(x => x.type === 'candidate-pair' && x.nominated && x.state === 'succeeded');
      if (!pair) return;
      const types = [stats.get(pair.localCandidateId), stats.get(pair.remoteCandidateId)].map(c => c && c.candidateType);
      const relay = types.includes('relay');
      if (relay) mp.relayed.add(id); else mp.relayed.delete(id);
      if (p) p.link = relay ? 'turn' : 'direct';
    } catch {}
  }));
  [...mp.relayed].forEach(id => { if (!mp.peers.has(id)) mp.relayed.delete(id); });
  showPings();
}
setInterval(checkLinks, 10000);
const pingBars = p => {
  const ms = p.ping, lvl = ms == null ? 0 : ms < 80 ? 4 : ms < 150 ? 3 : ms < 250 ? 2 : 1;
  const tip = ms == null ? 'Measuring…' : `${ms} ms${p.link === 'turn' ? ' · through the TURN server' : p.link === 'direct' ? ' · direct connection' : ''}`;
  return `<span class="mp-ping l${lvl}" title="${tip}">${[1, 2, 3, 4].map(k => `<b class="${k <= lvl ? 'on' : ''}"></b>`).join('')}</span>`
    + `<span class="mp-ms">${ms == null ? '' : ms + ' ms'}</span>${p.link === 'turn' ? '<span class="mp-turn" title="This connection goes through the TURN server">TURN</span>' : ''}`;
};
function showPings() { if (mpPanel && mpPanel.people) mpPanel.people(); }

async function leaveRoom() {
  const r = room; room = null; mp.send = null; roomCode = ''; mp.relayed.clear();
  mp.peers.forEach(p => { p.cur.remove(); if (p.box) p.box.remove(); }); mp.peers.clear(); paintSel();
  setIcons(store.get('desktop-pos', {})); // back to your own icon layout
  chatLog.length = 0; unread = 0; pickRoomClock();
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
  if (m.t === 'ping') return mpSend({ t: 'pong', ts: m.ts }, from);
  if (!p) return;
  if (m.t === 'pong') { p.ping = Math.round(performance.now() - m.ts); return showPings(); }
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
  const peopleHtml = () => [{ ...me, you: true }, ...mp.peers.values()].map(p => `<li><i style="background:${p.color}"></i>${esc(p.name)}${p.you ? ' <span class="dim">(you)</span>' : pingBars(p)}</li>`).join('');
  W.people = () => { const ul = q('.mp-people'); if (ul) { const h = peopleHtml(); if (ul.innerHTML !== h) ul.innerHTML = h; } };
  W.render = () => {
    const swatches = MP_COLORS.map(c => `<button class="mp-sw${c === me.color ? ' on' : ''}" data-c="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('');
    const people = peopleHtml();
    top.innerHTML = `<label class="mp-row">Your name <input class="mp-name" maxlength="24"></label><div class="mp-sws">${swatches}</div>`
      + (room
        ? `<div class="mp-box"><div>Room <b class="mp-code">${esc(roomCode)}</b></div><div class="mp-link"><input class="mp-url" readonly><button class="okbtn mp-copy">Copy link</button></div>`
          + `<div class="dim">${mp.peers.size ? 'Everyone here sees the same desktop.' : 'Waiting for someone to join… Send them the link.'}</div><div class="mp-status"></div>`
          + `<button type="button" class="linkbtn mp-report">Can't connect? Copy a connection report</button></div>`
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
      q('.mp-report').onclick = () => {
        const text = connectionReport();
        const done = () => toast('Connection report copied. Paste it to whoever is helping you.');
        navigator.clipboard.writeText(text).then(done, () => { // no clipboard access: show it to copy by hand
          const box = el('<textarea class="mp-reptext" readonly></textarea>'); box.value = text; q('.mp-report').replaceWith(box); box.select();
        });
      };
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
    let text = `Helper servers reachable: ${up} of ${socks.length}`, bad = !up && !mp.peers.size;
    if (rtcResult === 'ok') text += ' · Direct connections: OK';
    if (mp.peers.size) {} // connected to someone, so nothing to warn about
    else if (rtcResult === 'off') { bad = true; text += ' · This browser is blocking direct connections (WebRTC). Turn off the VPN, Brave Shields, or ad blocker WebRTC setting for this site, or try Chrome/Edge.'; }
    else if (rtcResult === 'udp') { bad = true; text += ' · Your network blocks direct connections to other networks (common on school/work wifi, some VPNs and hotspots). Try another network, or add a TURN server (see MULTIPLAYER in config.js).'; }
    else if (mpError) {
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
