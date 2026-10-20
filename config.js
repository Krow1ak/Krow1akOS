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
  startOrb:  'assets/ui/start-orb.png',
  watermark: 'assets/ui/watermark-paw.png', // faint mark on the wallpaper; set to '' to hide
  avatar:    'assets/icons/avatar.png',     // picture in the start menu

  icons: {
    folder:      'assets/icons/folder.png',
    folderArts:  'assets/icons/folder-arts.png',
    folderMusic: 'assets/icons/folder-music.png',
    textFile:    'assets/icons/text-file.png',
    computer:    'assets/icons/computer.png',
    drive:       'assets/icons/drive.png',
    binEmpty:    'assets/icons/recycle-bin-empty.png',
    binFull:     'assets/icons/recycle-bin-full.png',
    notepad:     'assets/icons/notepad.png',
    photoViewer: 'assets/icons/photo-viewer.png',
    info:        'assets/icons/info.png',
    video:       'assets/icons/video.png',
    minesweeper: 'assets/icons/minesweeper.png',
    wordle:      'assets/icons/wordle.png',
    paint:       'assets/icons/paint.png',
    pixelpaint:  'assets/icons/pixelpaint.png',
    pinball:     'assets/icons/pinball.png',
    snake:       'assets/icons/snake.png',
    solitaire:   'assets/icons/solitaire.png',
    airhockey:   'assets/icons/airhockey.png',
    tetris:      'assets/icons/tetris.png',
    guessdraw:   'assets/icons/guessdraw.png',
    rhythm:      'assets/icons/rhythm.png',
    tictactoe:   'assets/icons/tictactoe.png',
    connect4:    'assets/icons/connect4.png',
    checkers:    'assets/icons/checkers.png',
    chess:       'assets/icons/chess.png',
    g2048:       'assets/icons/g2048.png',
    sudoku:      'assets/icons/sudoku.png',
    music:       'assets/icons/music.png',
    browser:     'assets/icons/browser.png',
    settings:    'assets/icons/settings.png',
    multiplayer: 'assets/icons/multiplayer.png',
  },

  ui: {
    minimize: 'assets/ui/minimize.png',
    maximize: 'assets/ui/maximize.png',
    close:    'assets/ui/close.png',
    back:     'assets/ui/back.png',
    forward:  'assets/ui/forward.png',
    up:       'assets/ui/up.png',
    previous: 'assets/ui/previous.png',
    next:     'assets/ui/next.png',
    play:     'assets/ui/play.png',
    pause:    'assets/ui/pause.png',
    volume:   'assets/ui/volume.png',
    mute:     'assets/ui/volume-mute.png',
  },
};

/* ---------- DISPLAY ----------
   So everyone sees the site the same, whatever their screen: the desktop is laid out at a fixed
   resolution and scaled to fit the browser window (black bars if the screen's shape differs).
   This is the starting resolution; visitors can change theirs in Settings > Display.
   width: 0 = no fixed width, fill the screen sideways instead. Phones keep their own layout.
   scale: false turns all of this off. */
const DISPLAY = {
  scale:  true,
  width:  1600,
  height: 900,
};

/* ---------- LOADING SCREEN ----------
   Shown while the site loads. text: {name} becomes SITE_NAME. minTime: shortest time it shows (ms). */
const LOADING_SCREEN = {
  enabled: true,
  text:    'Starting {name}',
  minTime: 1200,
};

/* ---------- LOG IN SCREEN ----------
   Comes after the loading screen: your avatar and OWNER_NAME with a password box.
   It's pretend: any password (or none) logs in. hint: small text under the box ('' = none).
   welcomeTime: how long "Welcome" shows (ms). */
const LOGIN_SCREEN = {
  enabled:     true,
  hint:        'Type any password and press Enter',
  welcomeTime: 1300,
  eggPassword: 'egg',   // a secret: this password shows the tree (assets/egg/) instead of logging in. '' = off
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
  menuColor:     '',   // start menu, calendar and volume popups; '' = same as color (a bit darker)
};

/* ---------- SOUND ----------
   music: background track that loops. Browsers only allow sound after the visitor
     clicks or presses a key, so it starts then. '' = no music (hides the speaker button).
   musicVolume / videoVolume: 0 = silent, 0.35 = 35%, 1 = full. With no background
     track, musicVolume is the starting volume of songs in the Music Player.
   startMuted: true = music is off until the visitor unmutes it, false = it plays.
   Visitors change the music volume with the speaker button next to the clock;
   their choice is remembered in their browser. */
const SOUND = {
  music:       '',   // e.g. 'assets/music/corrupted.mp3'; off so only songs and videos make sound
  startMuted:  true,
  musicVolume: 0.35,
  videoVolume: 0.35,
};

/* ---------- MULTIPLAYER ----------
   The 👥 button on the taskbar starts a room and gives a link to send. Everyone who opens
   it sees the same desktop: each other's mouse, the same windows, Paint, games, songs...
   Browsers connect straight to each other, so there's no server or database to run.
   enabled: false hides the button.
   relays: free public "Nostr" servers that only help browsers find each other (no game data
     goes through them). More of them = more likely to connect. Any wss:// Nostr relay works.
   turn: only needed if someone can't connect and their Multiplayer window says their network
     blocks direct connections (school/work wifi, some VPNs, phone hotspots). A TURN server passes
     the traffic along for them. Free ones: make an account on metered.ca (or expressturn.com),
     create a TURN app, and paste the server list it shows you here, like:
     [{ urls: 'turn:example.com:443?transport=tcp', username: '...', credential: '...' }] */
const MULTIPLAYER = {
  enabled: true,
  relays: ['relay.damus.io', 'nos.lol', 'relay.primal.net', 'nostr.mom', 'relay.snort.social', 'offchain.pub', 'relay.nostr.net', 'nostr.oxtr.dev'],
  moreRelays: true,   // also use the ~28 public relays built into the library, so a few dead ones don't matter
  turn: null,
};

/* Special dates for the calendar (click the clock) */
const DATES_FILE = 'content/dates.txt';

/* ---------- BROWSER ----------
   home: the page the browser opens on. 'start' = the built-in start page with a search box
     (searches from it are shared in multiplayer); or any web address.
   bookmarks: buttons under the address bar, in order. url '' = not set up yet.
   Spotify / YouTube: paste the normal link (open.spotify.com/playlist/...,
     youtube.com/watch?v=...) and it opens as the embedded player.
   Lots of big sites (YouTube's homepage, Discord, Instagram...) refuse to show
   inside another page; the ↗ button opens the current page in a real tab instead. */
const BROWSER = {
  home: 'start',
  bookmarks: [
    { name: 'Google',    url: 'https://www.google.com/webhp?igu=1' },
    { name: 'Spotify',   url: 'https://open.spotify.com/playlist/1JacQnVfZhY5yiVxpc2akH' },
    { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
  ],
};

/* Your own words for Guess the Drawing, added to the built-in ones, e.g. ['chucha', 'krow'] */
const GUESS_WORDS = [];

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
   pixelPaint()                            Pixel Paint (pixel art, animation frames, GIF export)
   pinball()                               Pinball
   snake()                                 Snake
   solitaire()                             Solitaire (Klondike; Game > Draw one / Draw three)
   tictactoe(), connectFour(), checkers(), chess()   two-player games: vs the computer, two on one screen, or in a multiplayer room
   game2048()                              2048
   airHockey()                             Air Hockey (vs the computer, or a friend in a room)
   tetris()                                Tetris (solo, or Versus in a multiplayer room)
   guessDrawing()                          Guess the Drawing (2+ people in a room; add words in GUESS_WORDS below)
   rhythm()                                Rhythm Keys (play the songs in the Music folder with D F J K)
   sudoku()                                the daily Sudoku (Game > New random puzzle for free play)
   browser()                               the web browser (home page and bookmarks are in BROWSER above)
   audio('song.mp3', 'assets/music/song.mp3')   a song; double-click plays it (mp3, ogg or wav)
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

/* Songs go in assets/music/, one audio(...) line each. */
const MUSIC = folder('Music', [
  audio('corrupted.mp3', 'assets/music/corrupted.mp3'),
], { icon: ASSETS.icons.folderMusic });

const MINESWEEPER = minesweeper();
const WORDLE = wordle();
const PAINT = paint();
const PIXEL_PAINT = pixelPaint();
const PINBALL = pinball();
const SNAKE = snake();
const SOLITAIRE = solitaire();
const TICTACTOE = tictactoe();
const CONNECT4 = connectFour();
const CHECKERS = checkers();
const CHESS = chess();
const G2048 = game2048();
const AIR_HOCKEY = airHockey();
const TETRIS = tetris();
const GUESS = guessDrawing();
const RHYTHM = rhythm();
const SUDOKU = sudoku();
const GAMES = folder('Games', [MINESWEEPER, WORDLE, SUDOKU, PINBALL, SNAKE, SOLITAIRE, G2048, TETRIS, AIR_HOCKEY, RHYTHM, GUESS, TICTACTOE, CONNECT4, CHECKERS, CHESS, PAINT, PIXEL_PAINT]);

const BROWSER_APP = browser();

const ABOUT = text('About me.txt');

const RECYCLE_BIN = recycleBin([]);

const DISK = drive('Local Disk (C:)', '97.2 GB free of 256 GB', 0.62, [
  ARTS, CHUCHA, MEMES, MUSIC, GAMES, folder('Users', [ABOUT]),
]);

/* What sits on the desktop, in order */
const DESKTOP_ITEMS = [computer([DISK]), BROWSER_APP, ARTS, CHUCHA, MEMES, MUSIC, GAMES, ABOUT, RECYCLE_BIN];

/* Window that opens when the page loads (set to null for none) */
const OPEN_ON_START = null;   // e.g. ABOUT to open About me.txt


/* ---- helpers (no need to edit below) ---- */
function folder(name, children, opts = {}) { return { name, type: 'folder', children, ...opts }; }
function text(name, opts = {}) { return { name, type: 'txt', ...opts }; }
function picture(name, src, opts = {}) { return { name, type: 'img', src, ...opts }; }
function video(name, src, opts = {}) { return { name, type: 'video', src, ...opts }; }
function minesweeper(opts = {}) { return { name: 'Minesweeper', type: 'minesweeper', ...opts }; }
function wordle(opts = {}) { return { name: 'Wordle', type: 'wordle', ...opts }; }
function paint(opts = {}) { return { name: 'Paint', type: 'paint', ...opts }; }
function airHockey(opts = {}) { return { name: 'Air Hockey', type: 'airhockey', ...opts }; }
function tetris(opts = {}) { return { name: 'Tetris', type: 'tetris', ...opts }; }
function guessDrawing(opts = {}) { return { name: 'Guess the Drawing', type: 'guessdraw', ...opts }; }
function rhythm(opts = {}) { return { name: 'Rhythm Keys', type: 'rhythm', ...opts }; }
function pixelPaint(opts = {}) { return { name: 'Pixel Paint', type: 'pixelpaint', ...opts }; }
function pinball(opts = {}) { return { name: 'Pinball', type: 'pinball', ...opts }; }
function snake(opts = {}) { return { name: 'Snake', type: 'snake', ...opts }; }
function solitaire(opts = {}) { return { name: 'Solitaire', type: 'solitaire', ...opts }; }
function tictactoe(opts = {}) { return { name: 'Tic-Tac-Toe', type: 'tictactoe', ...opts }; }
function connectFour(opts = {}) { return { name: 'Connect Four', type: 'connect4', ...opts }; }
function checkers(opts = {}) { return { name: 'Checkers', type: 'checkers', ...opts }; }
function chess(opts = {}) { return { name: 'Chess', type: 'chess', ...opts }; }
function game2048(opts = {}) { return { name: '2048', type: 'g2048', ...opts }; }
function sudoku(opts = {}) { return { name: 'Sudoku', type: 'sudoku', ...opts }; }
function browser(opts = {}) { return { name: 'Internet', type: 'browser', ...opts }; }
function audio(name, src, opts = {}) { return { name, type: 'audio', src, ...opts }; }
function drive(name, free, used, children, opts = {}) { return { name, type: 'drive', free, used, children, ...opts }; }
function computer(children, opts = {}) { return { name: 'Computer', type: 'computer', children, ...opts }; }
function recycleBin(children, opts = {}) { return { name: 'Recycle Bin', type: 'bin', children, ...opts }; }
