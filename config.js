/* ============================================================
   LaisaOS — config
   Everything you'd want to change lives in this file:
   asset paths, your name, the popup text, folders and notes.
   ============================================================ */

const SITE_NAME = 'LaisaOS';
const OWNER_NAME = 'LaisaTheNeko';

/* Shown when a visitor tries to type, add pictures, etc. */
const NOT_HIM_MESSAGE = 'You are not him :)';

/* ---------- ASSETS ----------
   To swap one: drop your file into the same folder with the same name,
   or point the path below at your new file (png / jpg / gif / svg / webp all work). */
const ASSETS = {
  wallpaper: 'assets/wallpaper.png',
  taskbar:   'assets/taskbar.png',          // repeats sideways, 40px tall looks best
  startOrb:  'assets/ui/start-orb.svg',
  watermark: 'assets/ui/watermark-paw.svg', // faint mark on the wallpaper; set to '' to hide
  avatar:    'assets/icons/avatar.svg',     // picture in the start menu

  icons: {
    folder:      'assets/icons/folder.svg',
    folderArts:  'assets/icons/folder-arts.svg',
    textFile:    'assets/icons/text-file.svg',
    computer:    'assets/icons/computer.svg',
    drive:       'assets/icons/drive.svg',
    binEmpty:    'assets/icons/recycle-bin-empty.svg',
    binFull:     'assets/icons/recycle-bin-full.svg',
    notepad:     'assets/icons/notepad.svg',
    photoViewer: 'assets/icons/photo-viewer.svg',
    info:        'assets/icons/info.svg',
  },

  ui: {
    minimize: 'assets/ui/minimize.svg',
    maximize: 'assets/ui/maximize.svg',
    close:    'assets/ui/close.svg',
    back:     'assets/ui/back.svg',
    forward:  'assets/ui/forward.svg',
    up:       'assets/ui/up.svg',
    previous: 'assets/ui/previous.svg',
    next:     'assets/ui/next.svg',
    play:     'assets/ui/play.svg',
    pause:    'assets/ui/pause.svg',
  },
};

/* Special dates for the calendar (click the clock) */
const DATES_FILE = 'content/dates.txt';

/* ---------- FILES ----------
   folder('Name', [ ...items ])            a folder
   folder('Name', [ ... ], { art:true })    a folder that shows big picture thumbnails
   text('Name.txt')                        a notepad file. Its text is read from
                                           content/<folder path>/Name.txt
                                           e.g. Projects > Games > Dub studio.txt
                                             ->  content/Projects/Games/Dub studio.txt
   text('Name.txt', { file: 'content/other/place.txt' })   read from a specific file instead
   picture('name.png', 'assets/arts/name.png')   a picture
   Any item can take a custom icon:  text('Hi.txt', { icon: 'assets/icons/my-icon.png' })
   To edit what a note says, just edit its .txt file in the content folder. */

const PROJECTS = folder('Projects', [
  folder('Characters', [
    text('Chaos.txt'),
    text('Hackbark.txt'),
  ]),
  folder('Minecraft', [
    text('Figura chat bubble.txt'),
    text('model_blend avatar.txt'),
    text('Rosethorn mod.txt'),
    text('Fabric server.txt'),
  ]),
  folder('Games', [
    text('FNF browser engine.txt'),
    text('Dub studio.txt'),
    text('Undertale multibox.txt'),
  ]),
  folder('Shaders', [
    text('CF2.5 shaders.txt'),
    text('GameMaker fire wall.txt'),
  ]),
]);

const ARTS = folder('Arts', [
  text('readme.txt'),
  picture('chaos_scribbles.png',  'assets/arts/chaos_scribbles.png'),
  picture('soul_heart.png',       'assets/arts/soul_heart.png'),
  picture('pixel_firewall.png',   'assets/arts/pixel_firewall.png'),
  picture('sunset_hills.png',     'assets/arts/sunset_hills.png'),
  picture('shader_plasma.png',    'assets/arts/shader_plasma.png'),
  picture('hackbark_palette.png', 'assets/arts/hackbark_palette.png'),
], { art: true });

const ABOUT = text('About me.txt');

const RECYCLE_BIN = recycleBin([
  text('old_ideas.txt'),
]);

const DISK = drive('Local Disk (C:)', '97.2 GB free of 256 GB', 0.62, [
  PROJECTS, ARTS, folder('Users', [ABOUT]),
]);

/* What sits on the desktop, in order */
const DESKTOP_ITEMS = [computer([DISK]), PROJECTS, ARTS, ABOUT, RECYCLE_BIN];

/* Window that opens when the page loads (set to null for none) */
const OPEN_ON_START = ABOUT;


/* ---- helpers (no need to edit below) ---- */
function folder(name, children, opts = {}) { return { name, type: 'folder', children, ...opts }; }
function text(name, opts = {}) { return { name, type: 'txt', ...opts }; }
function picture(name, src, opts = {}) { return { name, type: 'img', src, ...opts }; }
function drive(name, free, used, children, opts = {}) { return { name, type: 'drive', free, used, children, ...opts }; }
function computer(children, opts = {}) { return { name: 'Computer', type: 'computer', children, ...opts }; }
function recycleBin(children, opts = {}) { return { name: 'Recycle Bin', type: 'bin', children, ...opts }; }
