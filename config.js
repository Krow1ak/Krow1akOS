/* ============================================================
   LaisaOS — config
   Everything you'd want to change lives in this file:
   asset paths, your name, the popup text, folders and notes.
   ============================================================ */

const SITE_NAME = 'KrowOS';
const OWNER_NAME = 'You';

/* Shown when a visitor tries to type, add pictures, etc. */
const NOT_HIM_MESSAGE = 'You are not HIM :)';

/* ---------- ASSETS ----------
   To swap one: drop your file into the same folder with the same name,
   or point the path below at your new file (png / jpg / gif / svg / webp all work). */
const ASSETS = {
  wallpaper: 'assets/wallpaper.png',
  taskbar:   'assets/taskbar.png',          // repeats sideways, 40px tall looks best
  startOrb:  'assets/ui/start-orb.svg',
  watermark: 'assets/ui/watermark-paw.svg', // faint mark on the wallpaper; set to '' to hide
  avatar:    'assets/icons/avatar.png',     // picture in the start menu

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
    video:       'assets/icons/video.svg',
    minesweeper: 'assets/icons/minesweeper.svg',
    wordle:      'assets/icons/wordle.svg',
    paint:       'assets/icons/paint.svg',
    pinball:     'assets/icons/pinball.svg',
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
    volume:   'assets/ui/volume.svg',
    mute:     'assets/ui/volume-mute.svg',
  },
};

/* ---------- WINDOW LOOK ----------
   color / inactiveColor: frame color of the front window / windows behind it.
     Any CSS color: '#ff88cc', 'rgb(255,136,204)', or 'rgba(255,136,204,.6)'
     (the last number is see-through-ness: 0 = clear, 1 = solid).
   texture: a picture drawn over the frame color, e.g. 'assets/ui/window-texture.png'.
     '' = no texture. A see-through PNG lets the color show through.
   textureSize: 'auto'  = picture at its real size, repeated like tiles
                'cover' = one picture stretched over the whole window
                '64px'  = tiles scaled to 64px wide */
const WINDOW_LOOK = {
  color:         '#6a37b9',
  inactiveColor: '#492583',
  texture:       '',
  textureSize:   'auto',
};

/* ---------- SOUND ----------
   music: background track that loops. Browsers only allow sound after the visitor
     clicks or presses a key, so it starts then. '' = no music (hides the speaker button).
   musicVolume / videoVolume: 0 = silent, 0.35 = 35%, 1 = full.
   Visitors change the music volume with the speaker button next to the clock;
   their choice is remembered in their browser. */
const SOUND = {
  music:       'assets/music/corrupted.mp3',
  musicVolume: 0.35,
  videoVolume: 0.35,
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
   picture('name.png', '...', { pixel:true })   pixel art: stays sharp instead of smoothed
   video('name.mp4', 'assets/videos/name.mp4')   a video (mp4 or webm; keep each file under 50 MB)
   video('name.mp4', '...', { poster: 'assets/videos/name.jpg' })   picture shown before it plays
   minesweeper()                           the Minesweeper game (Game > Daily challenge for the daily board)
   wordle()                                the daily Wordle
   paint()                                 Paint
   pinball()                               Pinball
   Any item can take a custom icon:  text('Hi.txt', { icon: 'assets/icons/my-icon.png' })
   To edit what a note says, just edit its .txt file in the content folder. */

const ARTS = folder('Arts', [
  folder('WIZ', [
    picture('wiz_1.webp', 'assets/arts/wiz/wiz_1.webp'),
    picture('wiz_2.png',  'assets/arts/wiz/wiz_2.png'),
    picture('wiz_3.png',  'assets/arts/wiz/wiz_3.png'),
  ], { art: true }),
  folder('LaisaTheNeko', [
    picture('laisatheneko_1.png', 'assets/arts/laisatheneko/laisatheneko_1.png'),
    video('krowfrog.mp4', 'assets/arts/laisatheneko/krowfrog.mp4'),
  ], { art: true }),
  folder('Sova', [
    picture('sova_1.png', 'assets/arts/sova/sova_1.png'),
  ], { art: true }),
], { art: true });

const CHUCHA = folder('Chucha', [
  text('Chuchu.txt'),
  picture('chucha_1.webp', 'assets/chucha/chucha_1.webp'),
  picture('chucha_2.webp', 'assets/chucha/chucha_2.webp'),
  picture('chucha_3.webp', 'assets/chucha/chucha_3.webp'),
  picture('chucha_4.webp', 'assets/chucha/chucha_4.webp'),
  picture('chucha_5.webp', 'assets/chucha/chucha_5.webp'),
  picture('chucha_6.webp', 'assets/chucha/chucha_6.webp'),
  picture('chucha_7.webp', 'assets/chucha/chucha_7.webp'),
  picture('chucha_8.webp', 'assets/chucha/chucha_8.webp'),
], { art: true });

const MEMES = folder('Memes', [
  picture('meme_1.png', 'assets/memes/meme_1.png'),
  picture('meme_2.png', 'assets/memes/meme_2.png'),
  picture('meme_3.png', 'assets/memes/meme_3.png'),
  picture('meme_4.png', 'assets/memes/meme_4.png'),
], { art: true });

const MINESWEEPER = minesweeper();
const WORDLE = wordle();
const PAINT = paint();
const PINBALL = pinball();
const GAMES = folder('Games', [MINESWEEPER, WORDLE, PINBALL, PAINT]);

const ABOUT = text('About me.txt');

const RECYCLE_BIN = recycleBin([]);

const DISK = drive('Local Disk (C:)', '97.2 GB free of 256 GB', 0.62, [
  ARTS, CHUCHA, MEMES, GAMES, folder('Users', [ABOUT]),
]);

/* What sits on the desktop, in order */
const DESKTOP_ITEMS = [computer([DISK]), ARTS, CHUCHA, MEMES, GAMES, ABOUT, RECYCLE_BIN];

/* Window that opens when the page loads (set to null for none) */
const OPEN_ON_START = ABOUT;


/* ---- helpers (no need to edit below) ---- */
function folder(name, children, opts = {}) { return { name, type: 'folder', children, ...opts }; }
function text(name, opts = {}) { return { name, type: 'txt', ...opts }; }
function picture(name, src, opts = {}) { return { name, type: 'img', src, ...opts }; }
function video(name, src, opts = {}) { return { name, type: 'video', src, ...opts }; }
function minesweeper(opts = {}) { return { name: 'Minesweeper', type: 'minesweeper', ...opts }; }
function wordle(opts = {}) { return { name: 'Wordle', type: 'wordle', ...opts }; }
function paint(opts = {}) { return { name: 'Paint', type: 'paint', ...opts }; }
function pinball(opts = {}) { return { name: 'Pinball', type: 'pinball', ...opts }; }
function drive(name, free, used, children, opts = {}) { return { name, type: 'drive', free, used, children, ...opts }; }
function computer(children, opts = {}) { return { name: 'Computer', type: 'computer', children, ...opts }; }
function recycleBin(children, opts = {}) { return { name: 'Recycle Bin', type: 'bin', children, ...opts }; }
