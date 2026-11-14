/* Hemmi's Island Splash — v1. Canvas runner, no network, no tracking. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------- Save ---------------- */
const SAVE_KEY = 'hemmi-island-splash-v1';
const defaultSave = () => ({
  shards: 0, unlocked: 1, stars: [0, 0, 0], best: [0, 0, 0], endlessBest: 0,
  owned: [], equipped: [], panels: [], introSeen: false,
  settings: { music: true, sfx: true, shake: true, reduceMotion: false, highContrast: false, largeText: false,
    assistSlow: false, assistInvincible: false, cues: false, touch: !!(window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window) }
});
let save;
try { save = Object.assign(defaultSave(), JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); save.settings = Object.assign(defaultSave().settings, save.settings || {}); }
catch (e) { save = defaultSave(); }
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
const S = () => save.settings;
if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && !localStorage.getItem(SAVE_KEY)) { save.settings.reduceMotion = true; save.settings.shake = false; }

/* ---------------- Images ---------------- */
const IMG = {};
const imgList = ['hemmi_idle','hemmi_run','hemmi_jump','hemmi_happy','hemmi_mischief','mango','star','dragonfruit','coconuts','crab','rock','crate','urchin','ball','shades','lei','surfboard','hat','bg_beach','bg_jungle','bg_town','bg_volcano'];
let loaded = 0;
const loadAll = Promise.all(imgList.map(n => new Promise(res => { const i = new Image(); i.onload = () => { loaded++; res(); }; i.onerror = res; i.src = 'img/' + n + '.webp'; IMG[n] = i; })));

/* ---------------- Audio (Web Audio, generated) ---------------- */
const Audio = (() => {
  let ctx = null, master, musicBus, sfxBus, musicTimer = null, step = 0, nextT = 0;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = .8; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = .32; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = .7; sfxBus.connect(master);
  }
  function tone(f, t, dur, type = 'sine', vol = .3, bus = sfxBus, f2 = null, attack = .005) {
    if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + .02);
  }
  let noiseBuf = null;
  function noise(t, dur, vol = .2, freq = 3000, bus = sfxBus, q = .8) {
    if (!ctx) return; if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * .5); s.stop(t + dur + .02);
  }
  const sfx = {
    jump() { const t = ctx.currentTime; tone(330, t, .18, 'square', .09, sfxBus, 720); tone(660, t, .14, 'sine', .12, sfxBus, 1100); },
    djump() { const t = ctx.currentTime; tone(520, t, .2, 'triangle', .14, sfxBus, 1300); tone(1560, t + .05, .15, 'sine', .06); },
    shard() { const t = ctx.currentTime; [1318, 1760, 2093].forEach((f, i) => tone(f, t + i * .045, .16, 'triangle', .1)); },
    fruit() { const t = ctx.currentTime; tone(880, t, .09, 'sine', .14, sfxBus, 1320); },
    spin() { const t = ctx.currentTime; noise(t, .3, .18, 1400, sfxBus, 2); tone(300, t, .3, 'sawtooth', .04, sfxBus, 900); },
    topple() { const t = ctx.currentTime; tone(140, t, .25, 'sine', .3, sfxBus, 60); noise(t, .22, .25, 600); [523, 659, 784].forEach((f, i) => tone(f, t + .08 + i * .05, .12, 'square', .05)); },
    bonk() { const t = ctx.currentTime; tone(600, t, .12, 'square', .1, sfxBus, 200); tone(1200, t + .08, .2, 'sine', .1, sfxBus, 1500); },
    hurt() { const t = ctx.currentTime; tone(400, t, .35, 'square', .1, sfxBus, 110); noise(t, .15, .15, 900); },
    wave() { const t = ctx.currentTime; noise(t, .7, .2, 700, sfxBus, .5); tone(300, t, .5, 'sine', .1, sfxBus, 900); },
    land() { const t = ctx.currentTime; noise(t, .08, .08, 500); },
    win() { const t = ctx.currentTime; [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * .11, .3, 'triangle', .13)); },
    lose() { const t = ctx.currentTime; [523, 466, 392, 330].forEach((f, i) => tone(f, t + i * .16, .3, 'triangle', .12)); },
    buy() { const t = ctx.currentTime; [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * .07, .2, 'square', .06)); },
    click() { const t = ctx.currentTime; tone(900, t, .05, 'sine', .08); },
    cueHigh() { const t = ctx.currentTime; tone(1500, t, .07, 'sine', .12); tone(1500, t + .1, .07, 'sine', .12); },
    cueLow() { const t = ctx.currentTime; tone(320, t, .15, 'square', .08); },
    cueGood() { const t = ctx.currentTime; tone(1046, t, .1, 'triangle', .08); }
  };
  function play(n) { if (!ctx || !S().sfx) return; try { sfx[n](); } catch (e) {} }
  // catchy island loop: ukulele-ish plucks, bass, shaker, marimba melody
  const BPM = 116, SPB = 60 / BPM / 2; // eighth notes
  const chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
  const bass = [48, 45, 41, 43];
  const mel = [76, null, 79, 76, 74, null, 72, null, 72, null, 74, 76, 79, null, 76, null,
               74, null, 72, 69, 72, null, 74, null, 67, null, 69, 72, 74, null, 72, null];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function schedule() {
    if (!ctx) return;
    while (nextT < ctx.currentTime + .25) {
      const bar = Math.floor(step / 8) % 4, s8 = step % 8;
      const ch = chords[bar];
      if (s8 === 0 || s8 === 4) tone(mtof(bass[bar]), nextT, .38, 'triangle', .35, musicBus);
      if (s8 === 6) tone(mtof(bass[bar] + 7), nextT, .2, 'triangle', .25, musicBus);
      if ([2, 3, 6, 7].includes(s8) || s8 === 5) ch.forEach((n, i) => tone(mtof(n), nextT + i * .012, .22, 'triangle', .07, musicBus));
      noise(nextT, .05, s8 % 2 ? .05 : .09, 7000, musicBus, 1.2);
      const m = mel[step % 32]; if (m) { tone(mtof(m), nextT, .28, 'sine', .14, musicBus); tone(mtof(m + 12), nextT, .12, 'sine', .03, musicBus); }
      nextT += SPB; step++;
    }
  }
  function music(on) {
    if (!ctx) return;
    if (on && S().music && !musicTimer) { nextT = ctx.currentTime + .05; musicTimer = setInterval(schedule, 60); }
    if ((!on || !S().music) && musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }
  return { init, play, music, get ok() { return !!ctx; } };
})();

/* ---------------- Screen reader announcements ---------------- */
let lastSay = 0;
function say(msg, force) { const now = performance.now(); if (!force && now - lastSay < 900) return; lastSay = now; const el = $('#sr-live'); el.textContent = ''; setTimeout(() => el.textContent = msg, 30); }

/* ---------------- Canvas & view ---------------- */
const cv = $('#game'), cx = cv.getContext('2d');
const BAND = 540, GROUND = 448;
let W = 0, H = 0, DPR = 1, scale = 1, viewW = 0, bandTop = 0;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  scale = Math.min(H / BAND, W / (H > W ? 430 : 560));
  viewW = W / scale;
  const groundScreen = H * (H > W ? .74 : .86);
  bandTop = groundScreen / scale - GROUND; // world y offset (in world units) where band starts
}
window.addEventListener('resize', resize); resize();

/* ---------------- Biomes & levels ---------------- */
const BIOMES = {
  beach:   { bg: 'bg_beach', sky: '#5fb3f0', g1: '#f6dea6', g2: '#d8ad68', edge: '#fff2cf', mid: 'palm', name: 'Splashdown Beach' },
  jungle:  { bg: 'bg_jungle', sky: '#3d6b35', g1: '#7a5a34', g2: '#4f3a22', edge: '#79b14a', mid: 'fern', name: 'Whispering Jungle' },
  town:    { bg: 'bg_town', sky: '#f2c79a', g1: '#cfa682', g2: '#9c7656', edge: '#e8c9a6', mid: 'lamp', name: 'Harbor Town' },
  volcano: { bg: 'bg_volcano', sky: '#6a3b8c', g1: '#4b3f4c', g2: '#2c2430', edge: '#7b6a73', mid: 'rock', name: 'Rumble Volcano' }
};
const LEVELS = [
  { id: 0, biome: 'beach', speed: 300, len: 15000, surf: [6200, 9200], title: 'Level 1: Splashdown Beach',
    intro: 'Hemmi is stranded on the sand. Grab star shards, topple coconut stacks, and ride the big wave to find the first piece of his star pod!',
    patterns: ['rock', 'rock', 'urchin', 'crab', 'mischief', 'mischief', 'fruitrow', 'ball'] },
  { id: 1, biome: 'jungle', speed: 335, len: 17000, title: 'Level 2: Whispering Jungle',
    intro: 'Teo is showing Hemmi the jungle shortcut. Watch for falling coconuts (look for the shadow!) and bonk the cranky crabs.',
    patterns: ['rock', 'urchin', 'crab', 'crab', 'fall', 'fall', 'mischief', 'fruitrow', 'double', 'highshards'] },
  { id: 2, biome: 'volcano', speed: 365, len: 19000, title: 'Level 3: Rumble Volcano',
    intro: 'The last star shards are up on the friendly old volcano. Hop over lava cracks and dodge the bubbling lava blobs!',
    patterns: ['rock', 'crack', 'crack', 'lava', 'lava', 'urchin', 'crab', 'mischief', 'double', 'highshards'] }
];
const ENDLESS_PATTERNS = {
  beach: ['rock', 'urchin', 'crab', 'mischief', 'ball', 'fruitrow'],
  jungle: ['rock', 'crab', 'fall', 'mischief', 'double', 'highshards'],
  town: ['crate', 'crate', 'ball', 'crab', 'rock', 'mischief', 'fruitrow', 'double'],
  volcano: ['crack', 'lava', 'rock', 'crab', 'double', 'highshards']
};
const BIOME_ORDER = ['beach', 'jungle', 'town', 'volcano'];
const PANELS = [
  { img: 'img/panel1.webp', alt: 'At night on a beach, a tiny round space pod has crash-landed in a spray of sand. Hemmi peeks out of the hatch with dizzy swirly eyes and a goofy grin.',
    text: 'One starry night, a tiny star pod streaks across the sky and... CRASH! Out pops Hemmi, a fuzzy little alien who has never seen an island before.' },
  { img: 'img/panel2.webp', alt: 'Hemmi sits in a pile of mangoes at a fruit stand, grinning. Teo stands with hands on hips, mouth open in surprise.',
    text: 'Hemmi follows a sweet smell into town and gobbles half of Teo\'s fruit stand. Teo should be upset... but that sticky grin makes him laugh instead.' },
  { img: 'img/panel3.webp', alt: 'In a rainy jungle, Teo holds a giant leaf over himself and Hemmi like an umbrella. Hemmi looks up at him with teary, happy eyes.',
    text: 'When the rain comes, Teo shares his giant-leaf umbrella. Nobody has ever shared anything with Hemmi before. His freckles glow warm.' },
  { img: 'img/panel4.webp', alt: 'On the volcano at dusk, glowing star shards float around Hemmi\'s repaired pod. Hemmi looks back at Teo, thinking.',
    text: 'The star shards fix the pod! Hemmi could fly home now... but home suddenly feels like it\'s standing right next to him.' },
  { img: 'img/panel5.webp', alt: 'At sunset on the beach, Teo and his grandma sit on a blanket with fruit while Hemmi leaps in for a big group hug. The pod rests behind them, decorated with flowers.',
    text: 'Hemmi stays. Teo and Grandma Rosa make room on the blanket, because family is anyone who saves you a seat. Even a messy, mango-loving alien.' }
];
const STORY_AFTER = { intro: [0], 0: [1], 1: [2], 2: [3, 4] };
const OUTFITS = [
  { id: 'shades', name: 'Heart Sunglasses', cost: 30 },
  { id: 'hat', name: 'Sunny Straw Hat', cost: 45 },
  { id: 'lei', name: 'Flower Garland', cost: 60 },
  { id: 'surfboard', name: 'Tiny Surfboard', cost: 90 }
];

/* ---------------- Sprite anchors (fractions of sprite box) ---------------- */
const ANCH = {
  hemmi_idle:     { eye: [.36, .34], eyeW: .30, neck: [.47, .54], top: [.42, .16], back: [.18, .55] },
  hemmi_run:      { eye: [.80, .36], eyeW: .24, neck: [.66, .56], top: [.62, .16], back: [.30, .52] },
  hemmi_jump:     { eye: [.39, .37], eyeW: .28, neck: [.42, .58], top: [.40, .19], back: [.62, .62] },
  hemmi_happy:    { eye: [.35, .34], eyeW: .34, neck: [.42, .55], top: [.40, .17], back: [.88, .55] },
  hemmi_mischief: { eye: [.34, .37], eyeW: .33, neck: [.40, .57], top: [.40, .20], back: [.85, .55] }
};

/* ---------------- RNG ---------------- */
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/* ---------------- Game state ---------------- */
let G = null; // current run
let state = 'menu'; // menu | play | pause | over
const keys = {};

function newRun(levelIdx) {
  const endless = levelIdx === 'endless';
  const L = endless ? null : LEVELS[levelIdx];
  G = {
    endless, L, levelIdx, t: 0, cam: 0, dist: 0,
    baseSpeed: endless ? 300 : L.speed, speed: 0,
    biome: endless ? 'beach' : L.biome, prevBiome: null, biomeFade: 1,
    p: { x: viewW < 520 ? 96 : 150, y: GROUND, vy: 0, onGround: true, jumps: 0, hold: 0, holding: false, spin: 0, spinCd: 0, hurt: 0, sx: 1, sy: 1, rot: 0, pose: 'hemmi_run', happyT: 0, surf: false },
    hearts: 3, score: 0, shards: 0, fruit: 0, fruitTotal: 0, mischief: 0, hits: 0, combo: 0, comboT: 0,
    ents: [], parts: [], pops: [], cursor: 900, rand: rng(endless ? (Date.now() & 0xffff) : 1234 + levelIdx * 777),
    shake: 0, done: false, finishX: endless ? Infinity : L.len, surfZone: (!endless && L.surf) ? L.surf : null, cuedIds: new Set(), nextId: 1,
    startT: performance.now()
  };
  generate();
}

/* ---------------- Generation ---------------- */
function addEnt(e) { e.id = G.nextId++; G.ents.push(e); return e; }
function shardArc(x0, w, h, n, y0 = GROUND - 40) { for (let i = 0; i < n; i++) { const t = n === 1 ? .5 : i / (n - 1); addEnt({ type: 'shard', x: x0 + t * w, y: y0 - Math.sin(t * Math.PI) * h, r: 22 }); } }
function fruitRow(x0, n, y = GROUND - 40) { for (let i = 0; i < n; i++) { addEnt({ type: 'fruit', kind: (i % 3 === 2) ? 'dragonfruit' : 'mango', x: x0 + i * 60, y, r: 24 }); G.fruitTotal++; } }
function biomeAt(x) { return G.endless ? BIOME_ORDER[Math.floor(x / 4500) % 4] : G.L.biome; }
function inSurf(x) { return G.surfZone && x > G.surfZone[0] && x < G.surfZone[1]; }
function generate() {
  const ahead = G.cam + viewW + 1600;
  const R = G.rand;
  while (G.cursor < ahead && G.cursor < G.finishX - 500) {
    const x = G.cursor; const sp = G.endless ? Math.min(560, 300 + x * .0035) : G.baseSpeed;
    if (inSurf(x)) { // wave segment: no hazards, wave ramps & shard arcs
      if (x < G.surfZone[0] + 200) { G.cursor = G.surfZone[0] + 400; continue; }
      addEnt({ type: 'waveramp', x, y: GROUND, w: 60, h: 20 });
      shardArc(x + 40, 420, 230, 7, GROUND - 60);
      G.cursor += 780 + R() * 200; continue;
    }
    const b = biomeAt(x);
    const pats = G.endless ? ENDLESS_PATTERNS[b] : G.L.patterns;
    const pat = pats[Math.floor(R() * pats.length)];
    let w = 100;
    switch (pat) {
      case 'rock': addEnt({ type: 'rock', x, y: GROUND, w: 74, h: 62, hz: true }); if (R() < .7) shardArc(x - 90, 250, 150, 4); w = 90; break;
      case 'urchin': addEnt({ type: 'urchin', x, y: GROUND, w: 66, h: 66, hz: true, ph: R() * 6 }); shardArc(x - 80, 230, 160, 3); w = 80; break;
      case 'crab': addEnt({ type: 'crab', x: x + 120, y: GROUND, w: 76, h: 56, hz: true, vx: -55 - R() * 30, ph: R() * 6 }); fruitRow(x - 140, 3); w = 160; break;
      case 'mischief': { const k = ['coconuts', 'crate', 'ball'][Math.floor(R() * 3)]; const s = { coconuts: [86, 82], crate: [90, 82], ball: [62, 62] }[k];
        addEnt({ type: 'mischief', kind: k, x, y: GROUND, w: s[0], h: s[1] }); fruitRow(x - 260, 3); w = 120; break; }
      case 'crate': addEnt({ type: 'mischief', kind: 'crate', x, y: GROUND, w: 90, h: 82 }); if (R() < .5) addEnt({ type: 'mischief', kind: 'crate', x: x + 92, y: GROUND, w: 90, h: 82 }); w = 200; break;
      case 'ball': addEnt({ type: 'mischief', kind: 'ball', x, y: GROUND, w: 62, h: 62 }); fruitRow(x + 100, 2, GROUND - 160); w = 200; break;
      case 'fruitrow': fruitRow(x, 5); if (R() < .5) shardArc(x + 330, 1, 0, 1, GROUND - 200); w = 340; break;
      case 'fall': addEnt({ type: 'fall', x: x + 60, y: -60, w: 54, h: 54, hz: true, vy: 0, armed: false }); fruitRow(x - 120, 2); w = 140; break;
      case 'double': { const gap = Math.max(140, sp * .45); addEnt({ type: 'rock', x, y: GROUND, w: 74, h: 62, hz: true }); addEnt({ type: b === 'volcano' ? 'crack' : 'urchin', x: x + gap, y: GROUND, w: b === 'volcano' ? 110 : 66, h: b === 'volcano' ? 18 : 66, hz: true, ph: 0 }); shardArc(x - 40, gap + 120, 210, 5); w = gap + 120; break; }
      case 'highshards': shardArc(x, 260, 300, 5, GROUND - 90); w = 280; break;
      case 'crack': addEnt({ type: 'crack', x, y: GROUND, w: 120, h: 18, hz: true }); shardArc(x - 60, 240, 140, 3); w = 130; break;
      case 'lava': addEnt({ type: 'lava', x: x + 40, y: GROUND, w: 48, h: 48, hz: true, ph: R() * 2, by: GROUND }); w = 120; break;
    }
    G.cursor += w + sp * (1.05 + R() * .85) * (G.endless ? clamp(1.25 - x / 60000, .85, 1.25) : 1);
  }
  if (!G.endless && !G.finishAdded && G.cursor >= G.finishX - 500) {
    G.finishAdded = true; addEnt({ type: 'goal', x: G.finishX, y: GROUND - 120, r: 40 });
    fruitRow(G.finishX - 420, 5, GROUND - 40);
  }
}

/* ---------------- Input ---------------- */
function pressJump() { if (state !== 'play') return; const p = G.p;
  if (p.onGround || (p.surf && p.y >= surfY(p.x + G.cam) - 2)) { p.vy = -980; p.onGround = false; p.jumps = 1; p.hold = 0; p.holding = true; p.sx = .8; p.sy = 1.25; Audio.play('jump'); dust(p.x, GROUND, 8); }
  else if (p.jumps < 2) { p.vy = -820; p.jumps = 2; p.hold = 0; p.holding = true; p.sx = .85; p.sy = 1.2; Audio.play('djump'); sparkle(p.x, p.y - 50, 12, '#ffe066'); }
}
function releaseJump() { if (G) G.p.holding = false; }
function pressSpin() { if (state !== 'play') return; const p = G.p; if (p.spinCd > 0) return; p.spin = .5; p.spinCd = .75; Audio.play('spin'); sparkle(p.x, p.y - 55, 10, '#9fe8ff');
  if (!p.onGround && G.p.surf) { addPop(p.x, p.y - 140, 'Trick! +100', '#ffef7a'); G.score += 100; } }
window.addEventListener('keydown', e => {
  if (e.repeat) return; const k = e.key;
  Audio.init();
  if (state === 'play') {
    if ([' ', 'ArrowUp', 'w', 'W'].includes(k)) { e.preventDefault(); pressJump(); }
    else if (['x', 'X', 'd', 'D', 'ArrowRight', 'Shift'].includes(k)) { e.preventDefault(); pressSpin(); }
    else if (['p', 'P', 'Escape'].includes(k)) { e.preventDefault(); pause(); }
  } else if (state === 'pause' && (k === 'Escape' || k === 'p' || k === 'P')) { e.preventDefault(); resume(); }
});
window.addEventListener('keyup', e => { if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key)) releaseJump(); });
function bindHold(btn, down, up) {
  btn.addEventListener('pointerdown', e => { e.preventDefault(); Audio.init(); btn.classList.add('pressed'); down(); });
  const u = e => { btn.classList.remove('pressed'); up && up(); };
  btn.addEventListener('pointerup', u); btn.addEventListener('pointercancel', u); btn.addEventListener('pointerleave', u);
  btn.addEventListener('click', e => { if (e.detail === 0) down(); }); // keyboard activation
}
bindHold($('#btn-jump'), pressJump, releaseJump);
bindHold($('#btn-spin'), pressSpin);
cv.addEventListener('pointerdown', e => { Audio.init(); if (state !== 'play') return; if (e.clientX > W * .5 && e.clientY > H * .55) pressSpin(); else pressJump(); });
cv.addEventListener('pointerup', releaseJump);
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pause(); });

/* ---------------- Effects ---------------- */
const RM = () => S().reduceMotion;
function addPart(o) { if (G.parts.length > 260) return; G.parts.push(o); }
function dust(x, y, n) { for (let i = 0; i < (RM() ? 2 : n); i++) addPart({ x: x + (Math.random() - .5) * 30, y, vx: -60 - Math.random() * 120, vy: -Math.random() * 140, life: .5, max: .5, r: 6 + Math.random() * 8, c: 'rgba(255,240,210,.8)', g: 300 }); }
function sparkle(x, y, n, c) { for (let i = 0; i < (RM() ? 3 : n); i++) { const a = Math.random() * 6.28, s = 80 + Math.random() * 220; addPart({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .6, max: .6, r: 3 + Math.random() * 4, c, g: 200, star: true }); } }
function burst(x, y, c, n = 18) { for (let i = 0; i < (RM() ? 4 : n); i++) { const a = Math.random() * 6.28, s = 120 + Math.random() * 320; addPart({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 150, life: .9, max: .9, r: 5 + Math.random() * 7, c, g: 700 }); } }
function addPop(x, y, txt, c = '#fff') { G.pops.push({ x, y, txt, c, life: 1.1 }); }
function shake(a) { if (S().shake && !RM()) G.shake = Math.max(G.shake, a); }

/* ---------------- Update ---------------- */
function surfY(wx) { return GROUND + 6 + Math.sin(wx * .012 + G.t * 3) * 6; }
function hit(p, cause) {
  if (p.hurt > 0 || S().assistInvincible) { if (S().assistInvincible && p.hurt <= 0) { p.hurt = .6; addPop(p.x, p.y - 140, 'Boing!', '#bdf'); } return; }
  (G.hitLog = G.hitLog || []).push(cause + '@' + Math.round(G.cam)); G.hearts--; G.hits++; G.combo = 0; p.hurt = 1.6; p.vy = -520; p.onGround = false; shake(14); Audio.play('hurt'); burst(p.x, p.y - 50, '#ff9ab0', 10);
  say(G.hearts > 0 ? `Ouch, ${cause}! ${G.hearts} ${G.hearts === 1 ? 'heart' : 'hearts'} left.` : 'Out of hearts.', true);
  if (G.hearts <= 0) setTimeout(() => endRun(false), 700);
}
function update(dt) {
  const p = G.p; G.t += dt;
  const assist = S().assistSlow ? .7 : 1;
  const target = (G.endless ? Math.min(560, G.baseSpeed + G.dist * .0035) : G.baseSpeed) * assist;
  G.speed = lerp(G.speed, G.done ? 0 : target, Math.min(1, dt * (G.done ? 3 : 1.5)));
  G.cam += G.speed * dt; G.dist = G.cam;
  // biome
  const b = biomeAt(G.cam + p.x);
  if (b !== G.biome) { G.prevBiome = G.biome; G.biome = b; G.biomeFade = 0; say('Now entering ' + BIOMES[b].name, true); }
  G.biomeFade = Math.min(1, G.biomeFade + dt * .8);
  const wx = G.cam + p.x;
  p.surf = inSurf(wx);
  // physics
  let grav = 2600; if (p.holding && p.vy < 0 && p.hold < .2) { grav *= .45; p.hold += dt; }
  p.vy += grav * dt; p.y += p.vy * dt;
  const gy = p.surf ? surfY(wx) : GROUND;
  if (p.y >= gy) { if (!p.onGround && p.vy > 300) { p.sx = 1.3; p.sy = .72; dust(p.x, gy, 10); Audio.play('land'); } p.y = gy; p.vy = 0; p.onGround = true; p.jumps = 0; }
  else p.onGround = false;
  p.sx = lerp(p.sx, 1, Math.min(1, dt * 10)); p.sy = lerp(p.sy, 1, Math.min(1, dt * 10));
  p.spin = Math.max(0, p.spin - dt); p.spinCd = Math.max(0, p.spinCd - dt); p.hurt = Math.max(0, p.hurt - dt); p.happyT = Math.max(0, p.happyT - dt);
  p.pose = G.done ? 'hemmi_happy' : p.spin > 0 ? 'hemmi_mischief' : !p.onGround ? 'hemmi_jump' : p.happyT > 0 ? 'hemmi_happy' : 'hemmi_run';
  if (p.onGround && !p.surf && G.speed > 50 && Math.random() < dt * 8 && !RM()) dust(p.x - 20, GROUND, 1);
  if (p.surf && Math.random() < dt * 30 && !RM()) addPart({ x: p.x - 40, y: gy - 4, vx: -150 - Math.random() * 100, vy: -100 - Math.random() * 120, life: .5, max: .5, r: 4 + Math.random() * 5, c: 'rgba(230,252,255,.9)', g: 600 });
  G.comboT = Math.max(0, G.comboT - dt); if (G.comboT === 0) G.combo = 0;
  // entities
  const px = wx, pbox = { l: px - 26, r: px + 26, t: p.y - 92, b: p.y - 6 };
  const sp = p.spin > 0;
  for (const e of G.ents) {
    if (e.dead) continue;
    const sx = e.x - G.cam;
    if (sx < -300) { e.dead = true; continue; }
    if (e.type === 'crab' && !e.bonked) { e.x += e.vx * dt * assist; e.ph += dt * 8; }
    if (e.type === 'urchin') e.ph += dt * 3;
    if (e.type === 'fall') { if (!e.armed && e.x - px < 330 / assist + 40) e.armed = true; if (e.armed && e.y < GROUND) { e.vy += 1700 * dt * assist; e.y = Math.min(GROUND, e.y + e.vy * dt); if (e.y >= GROUND) { e.landed = true; burst(sx + G.cam, GROUND - 10, '#8b5a2b', 8); shake(4); } } }
    if (e.type === 'lava') { e.ph += dt * assist; const c = e.ph % 2.2; e.y = c < 1.1 ? GROUND - Math.sin(c / 1.1 * Math.PI) * 95 : GROUND + 30; }
    if (e.type === 'toppled' || e.type === 'flyaway') { e.vy += 1400 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.rot += e.vr * dt; if (e.y > BAND + 300) e.dead = true; continue; }
    // hazard cues
    if (S().cues && (e.hz || e.type === 'mischief') && !G.cuedIds.has(e.id) && e.x - px < G.speed * 1.1 && e.x > px) { G.cuedIds.add(e.id); Audio.play(e.type === 'crab' ? 'cueLow' : e.type === 'mischief' ? 'cueGood' : 'cueHigh'); }
    // collisions
    if (e.type === 'shard' || e.type === 'fruit') {
      if (Math.abs(e.x - px) < e.r + 28 && e.y > pbox.t - e.r && e.y < pbox.b + e.r) {
        e.dead = true;
        if (e.type === 'shard') { G.shards++; G.score += 25; Audio.play('shard'); sparkle(sx, e.y, 10, '#ffd34d'); }
        else { G.fruit++; G.score += 10; Audio.play('fruit'); sparkle(sx, e.y, 6, '#ff9a3c'); p.happyT = .25; }
      }
      continue;
    }
    if (e.type === 'goal') { if (px > e.x - 30) { e.dead = true; finishLevel(); } continue; }
    if (e.type === 'waveramp') { if (!e.used && px > e.x && px < e.x + 80 && p.onGround) { e.used = true; p.vy = -1180; p.onGround = false; p.jumps = 1; Audio.play('wave'); addPop(p.x, p.y - 150, 'Wave ride!', '#aef'); burst(sx, GROUND, 'rgba(220,250,255,.9)', 14); } continue; }
    const box = { l: e.x - e.w / 2, r: e.x + e.w / 2, t: e.y - e.h, b: e.y };
    if (e.type === 'crack') { box.t = GROUND - 8; box.l += 14; box.r -= 14; }
    if (e.type === 'fall' && !e.armed) continue;
    if (e.type === 'lava' && e.y > GROUND) continue;
    const shrink = 10;
    const overlap = pbox.r > box.l + shrink && pbox.l < box.r - shrink && pbox.b > box.t + shrink * .6 && pbox.t < box.b - 4;
    if (!overlap) continue;
    if (e.type === 'mischief') {
      const pts = sp ? 150 : 50; G.combo++; G.comboT = 2.5; const tot = pts * Math.min(G.combo, 5);
      G.score += tot; G.mischief++; Audio.play('topple'); shake(sp ? 10 : 5); burst(sx, e.y - e.h / 2, e.kind === 'coconuts' ? '#8b5a2b' : e.kind === 'crate' ? '#c58b45' : '#ff5a5a', 16);
      addPop(sx, e.y - e.h - 30, (sp ? 'MISCHIEF! ' : 'Oops! ') + '+' + tot + (G.combo > 1 ? ` x${Math.min(G.combo, 5)}` : ''), sp ? '#ffd34d' : '#fff');
      e.type = 'toppled'; e.vx = 260 + Math.random() * 200; e.vy = -600 - Math.random() * 300; e.rot = 0; e.vr = 8 + Math.random() * 6; p.happyT = .5;
      if (Math.random() < .5) addEnt({ type: 'shard', x: e.x + 140, y: GROUND - 150, r: 22 });
      say(sp ? 'Mischief!' : 'Oops, knocked it over!'); continue;
    }
    if (e.type === 'crab') {
      const stomp = p.vy > 100 && p.y - 20 < e.y - e.h + 30;
      if (sp || stomp) { e.bonked = true; e.kind = 'crab'; e.type = 'flyaway'; e.vx = 300; e.vy = -700; e.rot = 0; e.vr = 10; G.score += 75; Audio.play('bonk'); addPop(sx, e.y - 90, 'Bonk! +75', '#ffd34d'); sparkle(sx, e.y - 30, 12, '#fff'); if (stomp) { p.vy = -700; p.jumps = 1; } shake(6); continue; }
      hit(p, 'a cranky crab'); continue;
    }
    if (e.type === 'fall' && e.landed) { if (sp) { e.kind = 'nut'; e.type = 'flyaway'; e.vx = 400; e.vy = -500; e.rot = 0; e.vr = 12; G.score += 30; Audio.play('bonk'); continue; } }
    if (e.hz) hit(p, { rock: 'a rock', urchin: 'a spiky urchin', fall: 'a coconut', crack: 'a lava crack', lava: 'a lava blob' }[e.type] || 'ouch');
  }
  G.ents = G.ents.filter(e => !e.dead);
  for (const q of G.parts) { q.vy += (q.g || 0) * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
  G.parts = G.parts.filter(q => q.life > 0);
  for (const q of G.pops) { q.y -= 60 * dt; q.life -= dt; } G.pops = G.pops.filter(q => q.life > 0);
  G.shake = Math.max(0, G.shake - dt * 40);
  if (G.endless) G.score = Math.max(G.score, 0);
  generate();
}

/* ---------------- Drawing ---------------- */
function drawImgFit(img, x, y, h, anchorX = .5, anchorY = 1) { if (!img || !img.width) return; const w = img.width * h / img.height; cx.drawImage(img, x - w * anchorX, y - h * anchorY, w, h); return w; }
function drawBg(bname, alpha) {
  const B = BIOMES[bname], img = IMG[B.bg]; if (!img || !img.width) return;
  cx.globalAlpha = alpha;
  // sky fill above band
  const top = -bandTop - 10;
  const grad = cx.createLinearGradient(0, top, 0, 0); grad.addColorStop(0, shadeHex(B.sky, -25)); grad.addColorStop(1, B.sky);
  cx.fillStyle = grad; cx.fillRect(0, top, viewW, -top + 20);
  const h = Math.max(560, (GROUND + bandTop + 4) / .8), w = img.width * h / img.height, y0 = GROUND + 2 - h * .8;
  const off = (G ? G.cam * (RM() ? .12 : .22) : performance.now() * .02) % (w * 2);
  for (let i = -1; i * w - off < viewW + w; i++) {
    const x = i * w - off; const flip = ((i % 2) + 2) % 2 === 1;
    if (flip) { cx.save(); cx.translate(x + w, y0); cx.scale(-1, 1); cx.drawImage(img, 0, 0, w + 1, h); cx.restore(); }
    else cx.drawImage(img, x, y0, w + 1, h);
  }
  cx.globalAlpha = 1;
}
function shadeHex(hex, amt) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt; r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255); return `rgb(${r},${g},${b})`; }
function drawMid(bname) {
  const B = BIOMES[bname]; const off = G.cam * .55; const sp = 340;
  cx.save(); cx.globalAlpha = .9;
  for (let i = Math.floor(off / sp) - 1; i * sp - off < viewW + sp; i++) {
    const x = i * sp - off + ((i * 97) % 120), r = ((i * 7919) % 100) / 100;
    if (B.mid === 'palm') { cx.strokeStyle = '#6b4a2c'; cx.lineWidth = 14; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(x, GROUND); cx.quadraticCurveTo(x + 30, GROUND - 120, x + 10 + r * 30, GROUND - 230); cx.stroke();
      cx.fillStyle = '#2f8a3c'; for (let k = 0; k < 6; k++) { cx.save(); cx.translate(x + 10 + r * 30, GROUND - 230); cx.rotate(k * 1.05 + r); cx.beginPath(); cx.ellipse(55, 0, 60, 14, .25, 0, 6.28); cx.fill(); cx.restore(); } }
    else if (B.mid === 'fern') { cx.fillStyle = r > .5 ? '#2d6b2a' : '#3e8a35'; for (let k = 0; k < 7; k++) { cx.save(); cx.translate(x, GROUND + 4); cx.rotate(-1.4 + k * .45); cx.beginPath(); cx.ellipse(0, -60, 16, 70, 0, 0, 6.28); cx.fill(); cx.restore(); } }
    else if (B.mid === 'lamp') { if (i % 2 === 0) { cx.fillStyle = '#3b3346'; cx.fillRect(x - 4, GROUND - 190, 8, 190); cx.beginPath(); cx.arc(x, GROUND - 196, 14, 0, 6.28); cx.fillStyle = '#ffe9a8'; cx.shadowColor = '#ffd36b'; cx.shadowBlur = 20; cx.fill(); cx.shadowBlur = 0; } else { cx.fillStyle = '#d9584a'; roundRect(x - 40, GROUND - 60, 80, 60, 10); cx.fill(); cx.fillStyle = '#ffd0a0'; for (let k = 0; k < 3; k++) { cx.beginPath(); cx.arc(x - 24 + k * 24, GROUND - 64, 12, 0, 6.28); cx.fill(); } } }
    else { cx.fillStyle = '#3a2f3d'; cx.beginPath(); cx.ellipse(x, GROUND, 60 + r * 40, 40 + r * 40, 0, Math.PI, 0); cx.fill(); cx.fillStyle = 'rgba(255,120,40,.5)'; cx.fillRect(x - 3, GROUND - 30 - r * 20, 6, 30 + r * 20); }
  }
  cx.restore();
}
function roundRect(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
function drawGround(bname) {
  const B = BIOMES[bname]; const bottom = H / scale - bandTop + 10;
  const g = cx.createLinearGradient(0, GROUND, 0, bottom); g.addColorStop(0, B.g1); g.addColorStop(1, B.g2);
  cx.fillStyle = g; cx.fillRect(0, GROUND, viewW, bottom - GROUND);
  cx.fillStyle = B.edge; cx.fillRect(0, GROUND - 3, viewW, 8);
  // texture
  const off = G.cam % 120;
  cx.fillStyle = 'rgba(0,0,0,.08)';
  for (let x = -off; x < viewW + 120; x += 120) for (let row = 0; row < 3; row++) { const yy = GROUND + 26 + row * 34, xx = x + (row % 2) * 60; if (bname === 'town') { roundRect(xx, yy, 52, 24, 8); cx.fill(); } else { cx.beginPath(); cx.ellipse(xx + 20, yy, 18 - row * 3, 4, 0, 0, 6.28); cx.fill(); } }
  if (bname === 'volcano') { cx.strokeStyle = 'rgba(255,120,40,.45)'; cx.lineWidth = 3; for (let x = -((G.cam) % 260); x < viewW; x += 260) { cx.beginPath(); cx.moveTo(x, GROUND + 20); cx.lineTo(x + 40, GROUND + 40); cx.lineTo(x + 30, GROUND + 70); cx.stroke(); } }
}
function drawWater(x0, x1) {
  const bottom = H / scale - bandTop + 10;
  const g = cx.createLinearGradient(0, GROUND - 20, 0, bottom); g.addColorStop(0, '#5fe0ea'); g.addColorStop(.3, '#1fa6c9'); g.addColorStop(1, '#0d5f9a');
  cx.fillStyle = g; cx.beginPath(); cx.moveTo(x0, bottom);
  for (let x = x0; x <= x1; x += 10) cx.lineTo(x, surfY(x + G.cam) - 2);
  cx.lineTo(x1, bottom); cx.closePath(); cx.fill();
  cx.strokeStyle = 'rgba(255,255,255,.85)'; cx.lineWidth = 5; cx.beginPath();
  for (let x = x0; x <= x1; x += 10) { const y = surfY(x + G.cam) - 2; x === x0 ? cx.moveTo(x, y) : cx.lineTo(x, y); } cx.stroke();
}
function shadow(x, y, w, a = .28) { cx.fillStyle = `rgba(20,10,30,${a})`; cx.beginPath(); cx.ellipse(x, y + 2, w, w * .22, 0, 0, 6.28); cx.fill(); }
function hcOutline(x, y, w, h, color = '#ff0') { if (!S().highContrast) return; cx.save(); cx.strokeStyle = '#000'; cx.lineWidth = 8; roundRect(x - w / 2 - 6, y - h - 6, w + 12, h + 12, 12); cx.stroke(); cx.strokeStyle = color; cx.lineWidth = 4; cx.stroke(); cx.restore(); }
function drawEnt(e) {
  const x = e.x - G.cam; if (x < -200 || x > viewW + 200) return;
  const t = G.t;
  switch (e.type) {
    case 'shard': { const bob = RM() ? 0 : Math.sin(t * 4 + e.x) * 5; cx.save(); cx.shadowColor = '#ffdd55'; cx.shadowBlur = S().highContrast ? 0 : 16; drawImgFit(IMG.star, x, e.y + bob, 46, .5, .5); cx.restore(); if (S().highContrast) { cx.strokeStyle = '#000'; cx.lineWidth = 3; cx.beginPath(); cx.arc(x, e.y + bob, 26, 0, 6.28); cx.stroke(); } break; }
    case 'fruit': { const bob = RM() ? 0 : Math.sin(t * 3 + e.x * .1) * 4; drawImgFit(IMG[e.kind], x, e.y + bob, 46, .5, .5); break; }
    case 'rock': shadow(x, e.y, 44); drawImgFit(IMG.rock, x, e.y + 4, e.h + 6); hcOutline(x, e.y, e.w, e.h, '#ff3b3b'); break;
    case 'urchin': { shadow(x, e.y, 38); const s = 1 + (RM() ? 0 : Math.sin(e.ph) * .05); cx.save(); cx.translate(x, e.y); cx.scale(s, 1 / s); drawImgFit(IMG.urchin, 0, 4, e.h + 6); cx.restore(); hcOutline(x, e.y, e.w, e.h, '#ff3b3b'); break; }
    case 'crab': { shadow(x, e.y, 42); const bob = Math.abs(Math.sin(e.ph)) * 5; drawImgFit(IMG.crab, x, e.y - bob + 4, e.h + 8); hcOutline(x, e.y, e.w, e.h, '#ff8a00'); break; }
    case 'mischief': { shadow(x, e.y, e.w * .55); const wob = RM() ? 0 : Math.sin(t * 5 + e.x) * .03; cx.save(); cx.translate(x, e.y); cx.rotate(wob); drawImgFit(IMG[e.kind], 0, 4, e.h + 6); cx.restore();
      if (S().highContrast) hcOutline(x, e.y, e.w, e.h, '#00e676'); break; }
    case 'toppled': case 'flyaway': { const hh = e.h || 54; cx.save(); cx.translate(x, e.y - hh / 2); cx.rotate(e.rot);
      if (e.kind === 'nut') { cx.fillStyle = '#7b4a24'; cx.beginPath(); cx.arc(0, 0, 27, 0, 6.28); cx.fill(); } else drawImgFit(IMG[e.kind], 0, hh / 2, hh + 6); cx.restore(); break; }
    case 'fall': { if (!e.landed) { const k = e.armed ? clamp(e.y / GROUND, 0, 1) : .2; shadow(x, GROUND, 18 + k * 26, .15 + k * .3); if (S().highContrast) { cx.strokeStyle = '#ff0'; cx.lineWidth = 4; cx.beginPath(); cx.ellipse(x, GROUND, 40, 10, 0, 0, 6.28); cx.stroke(); } }
      cx.save(); cx.translate(x, e.y - 27); cx.rotate(e.landed ? 0 : t * 4); cx.fillStyle = '#7b4a24'; cx.beginPath(); cx.arc(0, 0, 27, 0, 6.28); cx.fill(); cx.fillStyle = 'rgba(255,255,255,.15)'; cx.beginPath(); cx.arc(-8, -8, 10, 0, 6.28); cx.fill(); cx.fillStyle = '#3a2210'; [[-6, 2], [6, 2], [0, 12]].forEach(([a, b]) => { cx.beginPath(); cx.arc(a, b, 3.5, 0, 6.28); cx.fill(); }); cx.restore();
      if (e.y < 0 && e.armed === false && S().highContrast) {} break; }
    case 'crack': { const g = cx.createLinearGradient(0, GROUND - 6, 0, GROUND + 18); const pulse = .7 + Math.sin(t * 5) * .3; g.addColorStop(0, `rgba(255,230,120,${pulse})`); g.addColorStop(1, 'rgba(255,60,0,.9)');
      cx.fillStyle = '#1b1218'; roundRect(x - e.w / 2, GROUND - 4, e.w, 22, 10); cx.fill(); cx.fillStyle = g; roundRect(x - e.w / 2 + 8, GROUND, e.w - 16, 12, 6); cx.fill();
      if (!RM() && Math.random() < .1) addPart({ x: e.x + (Math.random() - .5) * e.w, y: GROUND, vx: 0, vy: -80 - Math.random() * 60, life: .6, max: .6, r: 3, c: '#ffb347', g: -20, world: true });
      if (S().highContrast) { cx.strokeStyle = '#ff0'; cx.lineWidth = 4; roundRect(x - e.w / 2 - 4, GROUND - 10, e.w + 8, 30, 10); cx.stroke(); } break; }
    case 'lava': { if (e.y > GROUND) { cx.fillStyle = 'rgba(255,120,30,.8)'; cx.beginPath(); cx.ellipse(x, GROUND + 2, 30, 7, 0, 0, 6.28); cx.fill(); break; }
      cx.save(); cx.shadowColor = '#ff7a00'; cx.shadowBlur = S().highContrast ? 0 : 20; const g = cx.createRadialGradient(x - 8, e.y - 32, 4, x, e.y - 24, 28); g.addColorStop(0, '#fff3a0'); g.addColorStop(.5, '#ff9a1f'); g.addColorStop(1, '#e8400c'); cx.fillStyle = g; cx.beginPath(); cx.arc(x, e.y - 24, 24, 0, 6.28); cx.fill(); cx.restore();
      cx.fillStyle = '#5a1a00'; cx.beginPath(); cx.arc(x - 8, e.y - 28, 3.5, 0, 6.28); cx.arc(x + 8, e.y - 28, 3.5, 0, 6.28); cx.fill(); // cute face
      cx.strokeStyle = '#5a1a00'; cx.lineWidth = 2.5; cx.beginPath(); cx.arc(x, e.y - 22, 6, .2, 2.9); cx.stroke();
      if (S().highContrast) { cx.strokeStyle = '#ff0'; cx.lineWidth = 4; cx.beginPath(); cx.arc(x, e.y - 24, 30, 0, 6.28); cx.stroke(); } break; }
    case 'waveramp': { cx.fillStyle = 'rgba(255,255,255,.9)'; cx.beginPath(); cx.moveTo(x - 50, GROUND + 6); cx.quadraticCurveTo(x + 10, GROUND - 46, x + 50, GROUND - 30); cx.quadraticCurveTo(x + 30, GROUND - 10, x + 60, GROUND + 6); cx.closePath(); cx.fill();
      cx.fillStyle = '#29b6d8'; cx.beginPath(); cx.moveTo(x - 40, GROUND + 6); cx.quadraticCurveTo(x + 10, GROUND - 36, x + 44, GROUND - 22); cx.lineTo(x + 50, GROUND + 6); cx.fill(); break; }
    case 'goal': { const bob = RM() ? 0 : Math.sin(t * 2) * 8; cx.save(); cx.shadowColor = '#fff2a0'; cx.shadowBlur = 40; cx.fillStyle = 'rgba(255,240,160,.35)'; cx.beginPath(); cx.arc(x, e.y + bob, 80, 0, 6.28); cx.fill(); drawImgFit(IMG.star, x, e.y + bob, 110, .5, .5); cx.restore();
      cx.fillStyle = '#fff'; cx.font = 'bold 22px ui-rounded, system-ui, sans-serif'; cx.textAlign = 'center'; cx.lineWidth = 5; cx.strokeStyle = '#1d2340'; cx.strokeText('Star Pod Piece!', x, e.y + bob - 80); cx.fillText('Star Pod Piece!', x, e.y + bob - 80); break; }
  }
}
function drawHemmi(ctx2, pose, x, y, h, sx = 1, sy = 1, rot = 0, alpha = 1, outfit = save.equipped) {
  const img = IMG[pose]; if (!img || !img.width) return;
  const w = img.width * h / img.height; const A = ANCH[pose];
  ctx2.save(); ctx2.globalAlpha = alpha; ctx2.translate(x, y); ctx2.rotate(rot); ctx2.scale(sx, sy);
  const L = -w / 2, T = -h;
  const at = (a) => [L + a[0] * w, T + a[1] * h];
  if (outfit.includes('surfboard')) { const [bx, by] = at(A.back); const im = IMG.surfboard; if (im.width) { ctx2.save(); ctx2.translate(bx, by); ctx2.rotate(pose === 'hemmi_run' ? -.5 : .35); const hh = h * .62; ctx2.drawImage(im, -im.width * hh / im.height / 2, -hh / 2, im.width * hh / im.height, hh); ctx2.restore(); } }
  ctx2.drawImage(img, L, T, w, h);
  if (outfit.includes('lei')) { const [nx, ny] = at(A.neck); const im = IMG.lei; if (im.width) { const ww = h * .5; ctx2.drawImage(im, nx - ww / 2, ny - ww * .32, ww, ww * im.height / im.width * .62); } }
  if (outfit.includes('shades')) { const [ex, ey] = at(A.eye); const im = IMG.shades; if (im.width) { const ww = A.eyeW * h * 1.15 * (pose === 'hemmi_run' ? .8 : 1); const hh = ww * im.height / im.width; ctx2.drawImage(im, ex - ww / 2, ey - hh / 2, ww, hh); } }
  if (outfit.includes('hat')) { const [tx, ty] = at(A.top); const im = IMG.hat; if (im.width) { const ww = h * .52; const hh = ww * im.height / im.width; ctx2.drawImage(im, tx - ww / 2, ty - hh * .78, ww, hh); } }
  ctx2.restore();
}
function drawHUD() {
  const pad = 12, hs = S().largeText ? 1.25 : 1;
  cx.save(); cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const top = Math.max(10, (window.visualViewport ? 0 : 0)) + 8;
  // hearts
  for (let i = 0; i < 3; i++) heart(pad + 18 * hs + i * 36 * hs, top + 18 * hs, 14 * hs, i < G.hearts || S().assistInvincible);
  const fs = Math.round(20 * hs);
  cx.font = `800 ${fs}px ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif`; cx.textBaseline = 'middle'; cx.textAlign = 'left';
  const line2 = top + 50 * hs;
  if (IMG.star.width) cx.drawImage(IMG.star, pad, line2 - 13 * hs, 26 * hs, 26 * hs);
  outlineText(String(G.shards), pad + 32 * hs, line2, '#ffe066');
  outlineText((G.endless ? Math.floor(G.dist / 10) + ' m  ' : '') + 'Score ' + G.score, pad, line2 + 32 * hs, '#fff');
  // progress
  if (!G.endless) { const bw = Math.min(220, W * .4), bx = W / 2 - bw / 2, by = top + 10; cx.fillStyle = 'rgba(0,0,0,.35)'; roundRectS(bx, by, bw, 12, 6); cx.fill(); cx.fillStyle = '#ffd34d'; roundRectS(bx, by, bw * clamp(G.cam / G.finishX, 0, 1), 12, 6); cx.fill(); if (IMG.hemmi_idle.width) cx.drawImage(IMG.hemmi_idle, bx + bw * clamp(G.cam / G.finishX, 0, 1) - 10, by - 8, 22, 25); }
  if (G.combo > 1) outlineText('Mischief combo x' + Math.min(G.combo, 5), W / 2 - 90 * hs, top + 48 * hs, '#ffd34d');
  if (S().assistSlow || S().assistInvincible) { cx.font = `700 ${Math.round(14 * hs)}px system-ui`; outlineText('Assist on', pad, line2 + 60 * hs, '#bdf'); }
  cx.restore();
}
function roundRectS(x, y, w, h, r) { roundRect(x, y, w, h, r); }
function outlineText(t, x, y, c) { cx.lineWidth = 5; cx.strokeStyle = 'rgba(20,20,50,.85)'; cx.lineJoin = 'round'; cx.strokeText(t, x, y); cx.fillStyle = c; cx.fillText(t, x, y); }
function heart(x, y, r, full) { cx.save(); cx.translate(x, y); cx.beginPath(); cx.moveTo(0, r * .9); cx.bezierCurveTo(-r * 1.6, -r * .1, -r * .7, -r * 1.3, 0, -r * .45); cx.bezierCurveTo(r * .7, -r * 1.3, r * 1.6, -r * .1, 0, r * .9); cx.closePath(); cx.fillStyle = full ? '#ff4d73' : 'rgba(255,255,255,.35)'; cx.fill(); cx.lineWidth = 3; cx.strokeStyle = '#1d2340'; cx.stroke(); if (full) { cx.fillStyle = 'rgba(255,255,255,.6)'; cx.beginPath(); cx.arc(-r * .45, -r * .35, r * .22, 0, 6.28); cx.fill(); } cx.restore(); }

function render() {
  cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height);
  if (!G) { cx.fillStyle = '#1f6fd1'; cx.fillRect(0, 0, cv.width, cv.height); return; }
  const sh = G.shake > 0 ? [(Math.random() - .5) * G.shake, (Math.random() - .5) * G.shake] : [0, 0];
  cx.setTransform(DPR * scale, 0, 0, DPR * scale, sh[0] * DPR, (bandTop * scale + sh[1]) * DPR);
  if (G.prevBiome && G.biomeFade < 1) drawBg(G.prevBiome, 1);
  drawBg(G.biome, G.prevBiome ? G.biomeFade : 1);
  if (S().highContrast) { cx.fillStyle = 'rgba(0,0,0,.45)'; cx.fillRect(0, -bandTop - 20, viewW, H / scale + 40); }
  if (!RM()) drawMid(G.biome);
  drawGround(G.biome);
  if (G.surfZone) { const a = G.surfZone[0] - G.cam, b = G.surfZone[1] - G.cam; if (b > 0 && a < viewW) drawWater(Math.max(0, a), Math.min(viewW, b)); }
  for (const e of G.ents) drawEnt(e);
  // hemmi
  const p = G.p; const blink = p.hurt > 0 && Math.floor(p.hurt * 12) % 2 === 0;
  shadow(p.x, p.surf ? surfY(p.x + G.cam) : GROUND, 40 * clamp(1 - (GROUND - p.y) / 500, .4, 1), .3);
  if (p.surf) { const sy = surfY(p.x + G.cam); const im = IMG.surfboard; if (im.width) { cx.save(); cx.translate(p.x, Math.min(p.y, sy) + 4); cx.rotate(Math.PI / 2 + (p.onGround ? Math.sin(G.t * 3) * .05 : -.15)); const hh = 150; cx.drawImage(im, -im.width * hh / im.height / 2 * 1.4, -hh / 2, im.width * hh / im.height * 1.4, hh); cx.restore(); } }
  const runBob = p.onGround && p.pose === 'hemmi_run' && !RM() ? Math.abs(Math.sin(G.t * 14)) * 6 : 0;
  const runSq = p.onGround && p.pose === 'hemmi_run' && !RM() ? Math.sin(G.t * 28) * .04 : 0;
  let rot = p.spin > 0 ? (RM() ? 0 : (1 - p.spin / .5) * Math.PI * 2) : (p.onGround ? (RM() ? 0 : Math.sin(G.t * 14) * .04) : clamp(p.vy / 3000, -.15, .2));
  if (!blink) drawHemmi(cx, p.pose, p.x, p.y + (p.surf ? -6 : 0) - runBob, 124, p.sx * (1 + runSq), p.sy * (1 - runSq), rot);
  if (p.spin > 0 && !RM()) { cx.strokeStyle = 'rgba(160,230,255,.7)'; cx.lineWidth = 6; cx.beginPath(); cx.arc(p.x, p.y - 60, 74, G.t * 20, G.t * 20 + 4); cx.stroke(); }
  for (const q of G.parts) { const a = clamp(q.life / q.max, 0, 1); cx.globalAlpha = a; cx.fillStyle = q.c; const qx = q.world ? q.x - G.cam : q.x; if (q.star) { cx.save(); cx.translate(qx, q.y); cx.rotate(q.life * 8); cx.fillRect(-q.r, -q.r / 3, q.r * 2, q.r * .66); cx.fillRect(-q.r / 3, -q.r, q.r * .66, q.r * 2); cx.restore(); } else { cx.beginPath(); cx.arc(qx, q.y, q.r * (0.5 + a * .5), 0, 6.28); cx.fill(); } }
  cx.globalAlpha = 1;
  cx.textAlign = 'center'; cx.font = `800 ${S().largeText ? 30 : 24}px ui-rounded, system-ui, sans-serif`;
  for (const q of G.pops) { cx.globalAlpha = clamp(q.life * 2, 0, 1); outlineText(q.txt, q.x, q.y, q.c); } cx.globalAlpha = 1;
  // cinematic grade + vignette
  if (!S().highContrast) { cx.setTransform(DPR, 0, 0, DPR, 0, 0); const vg = cx.createRadialGradient(W / 2, H * .55, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .8); vg.addColorStop(0, 'rgba(255,200,120,0)'); vg.addColorStop(1, 'rgba(40,10,60,.35)'); cx.fillStyle = vg; cx.fillRect(0, 0, W, H); }
  drawHUD();
}

/* ---------------- Loop ---------------- */
let last = performance.now(), acc = 0; const STEP = 1 / 60;
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (state === 'play') { acc += dt; let n = 0; while (acc >= STEP && n < 6) { update(STEP); acc -= STEP; n++; } if (n === 6) acc = 0; }
  if (G) render(); else idleRender(now);
  requestAnimationFrame(frame);
}
function idleRender(now) { cx.setTransform(1, 0, 0, 1, 0, 0); const img = IMG.bg_beach; if (img && img.width) { const s = Math.max(cv.width / img.width, cv.height / img.height); const w = img.width * s, h = img.height * s; cx.drawImage(img, (cv.width - w) / 2 - ((now * .01) % 1) * 0, (cv.height - h) / 2, w, h); } }

/* ---------------- Flow ---------------- */
function show(id) { $$('.screen').forEach(s => s.hidden = true); if (id) { const el = $('#scr-' + id); el.hidden = false; const f = el.querySelector('h1,h2'); if (f) { f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); } } }
function setHud(on) { $('#hud').hidden = !on; $('#touch').hidden = !on || !S().touch; }
let storyQueue = [], storyDone = null;
function playStory(list, then) { storyQueue = list.slice(); storyDone = then; nextPanel(); }
function nextPanel() {
  if (!storyQueue.length) { const f = storyDone; storyDone = null; f && f(); return; }
  const i = storyQueue.shift(); const P = PANELS[i];
  if (!save.panels.includes(i)) { save.panels.push(i); persist(); }
  show('story'); const img = $('#story-img'); img.src = P.img; img.alt = P.alt; $('#story-text').textContent = P.text;
  img.style.animation = 'none'; img.offsetHeight; img.style.animation = '';
  $('#story-next').textContent = storyQueue.length ? 'Next ▶' : 'Continue ▶';
  $('#story-next').focus();
}
$('#story-next').onclick = () => { Audio.play('click'); nextPanel(); };
$('#story-skip').onclick = () => { storyQueue = []; nextPanel(); };
let pendingLevel = 0;
function startLevel(idx) {
  Audio.init(); pendingLevel = idx;
  const go = () => {
    if (idx === 'endless') { $('#intro-h').textContent = 'Endless Island Tour'; $('#intro-text').textContent = 'Run as far as you can through the beach, jungle, town and volcano. It gets faster the farther you go!'; }
    else { $('#intro-h').textContent = LEVELS[idx].title; $('#intro-text').textContent = LEVELS[idx].intro; }
    show('intro');
  };
  if (idx === 0 && !save.introSeen) { save.introSeen = true; persist(); playStory(STORY_AFTER.intro, go); } else go();
}
$('#intro-go').onclick = () => { Audio.init(); newRun(pendingLevel); show(null); setHud(true); state = 'play'; Audio.music(true); say((pendingLevel === 'endless' ? 'Endless Island Tour' : LEVELS[pendingLevel].title) + '. Go!', true); cv.focus && cv.focus(); };
function pause() { if (state !== 'play') return; state = 'pause'; show('pause'); Audio.music(false); }
function resume() { show(null); state = 'play'; last = performance.now(); Audio.music(true); setHud(true); }
$('#btn-pause').onclick = pause;
$('#pause-resume').onclick = resume;
$('#pause-restart').onclick = () => { newRun(G.levelIdx); resume(); };
$('#pause-quit').onclick = () => { bankShards(); G = null; state = 'menu'; setHud(false); Audio.music(false); renderLevels(); show('levels'); };
let settingsReturn = 'title';
$('#pause-settings').onclick = () => { settingsReturn = 'pause'; renderSettings(); show('settings'); };
function bankShards() { if (G && !G.banked) { G.banked = true; save.shards += G.shards; persist(); } }
function finishLevel() {
  if (G.done) return; G.done = true; G.p.happyT = 9; Audio.play('win'); sparkle(G.p.x, G.p.y - 80, 30, '#ffe066'); shake(8);
  setTimeout(() => endRun(true), 1300);
}
function endRun(win) {
  if (state !== 'play') return; state = 'over'; setHud(false); Audio.music(false);
  bankShards();
  const L = G.levelIdx; const list = $('#res-list'); list.innerHTML = '';
  const li = t => { const e = document.createElement('li'); e.textContent = t; list.appendChild(e); };
  if (G.endless) {
    const m = Math.floor(G.dist / 10); const best = m > save.endlessBest; if (best) save.endlessBest = m; persist();
    $('#res-h').textContent = best ? 'New Best Run!' : 'Nice Run!'; $('#res-img').src = 'img/hemmi_happy.webp'; $('#res-stars').textContent = ''; $('#res-stars').setAttribute('aria-label', '');
    li(`Distance: ${m} m`); li(`Score: ${G.score}`); li(`Star shards: +${G.shards}`); li(`Mischief: ${G.mischief}`); li(`Best: ${save.endlessBest} m`);
    $('#res-next').hidden = true; Audio.play(best ? 'win' : 'lose');
    say(`Run over. ${m} meters. ${G.shards} star shards collected.`, true);
  } else if (win) {
    const fr = G.fruitTotal ? G.fruit / G.fruitTotal : 1;
    const stars = 1 + (fr >= .6 ? 1 : 0) + (G.hits === 0 ? 1 : 0);
    save.stars[L] = Math.max(save.stars[L], stars); save.best[L] = Math.max(save.best[L], G.score);
    const bonus = stars * 5; save.shards += bonus;
    if (save.unlocked < L + 2) save.unlocked = Math.min(4, L + 2); persist();
    $('#res-h').textContent = 'Level Complete!'; $('#res-img').src = 'img/hemmi_happy.webp';
    $('#res-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars); $('#res-stars').setAttribute('aria-label', `${stars} out of 3 stars`);
    li(`Score: ${G.score}`); li(`Fruit: ${G.fruit} of ${G.fruitTotal}`); li(`Star shards: +${G.shards} (+${bonus} star bonus)`); li(`Mischief: ${G.mischief}`); li(G.hits === 0 ? 'No bumps! Perfect run.' : `Bumps: ${G.hits}`);
    $('#res-next').hidden = false; $('#res-next').textContent = 'Continue ▶';
    say(`Level complete! ${stars} out of 3 stars. Score ${G.score}.`, true);
  } else {
    $('#res-h').textContent = 'Uh oh! Try again?'; $('#res-img').src = 'img/hemmi_mischief.webp'; $('#res-stars').textContent = ''; $('#res-stars').setAttribute('aria-label', '');
    li(`Score: ${G.score}`); li(`You keep your ${G.shards} star shards!`); li('Tip: Assist Mode in Settings can slow things down.');
    $('#res-next').hidden = true; Audio.play('lose'); say('Out of hearts. You keep your star shards. Try again?', true);
  }
  G.win = win;
  setTimeout(() => show('results'), 150);
}
$('#res-next').onclick = () => {
  const L = G.levelIdx; G = null; state = 'menu';
  const after = () => { renderLevels(); show('levels'); };
  if (STORY_AFTER[L]) playStory(STORY_AFTER[L], after); else after();
};
$('#res-retry').onclick = () => { const L = G.levelIdx; G = null; startLevel(L); };
$('#res-menu').onclick = () => { G = null; state = 'menu'; renderLevels(); show('levels'); };

/* ---------------- Menus ---------------- */
$$('[data-go]').forEach(b => b.addEventListener('click', () => { Audio.init(); Audio.play('click'); const id = b.dataset.go; if (id === 'levels') renderLevels(); if (id === 'wardrobe') renderWardrobe(); if (id === 'storybook') renderStorybook(); if (id === 'settings') { settingsReturn = 'title'; renderSettings(); } if (id === 'title') $('#title-shards').textContent = save.shards; show(id); }));
function renderLevels() {
  const el = $('#level-list'); el.innerHTML = '';
  const entries = LEVELS.map((L, i) => ({ i, name: L.title, img: 'img/' + BIOMES[L.biome].bg + '.webp', locked: i >= save.unlocked, sub: save.stars[i] ? 'Best ' + save.best[i] : 'New!', stars: save.stars[i] }));
  entries.push({ i: 'endless', name: 'Endless Island Tour', img: 'img/bg_town.webp', locked: save.unlocked < 2, sub: save.endlessBest ? `Best ${save.endlessBest} m` : 'Beach, jungle, town and volcano', stars: -1 });
  for (const e of entries) {
    const b = document.createElement('button'); b.className = 'lvl'; b.disabled = e.locked;
    const starTxt = e.stars >= 0 ? '★'.repeat(e.stars) + '☆'.repeat(3 - e.stars) : '';
    b.innerHTML = `<img src="${e.img}" alt=""><span><b>${e.name}</b><small>${e.locked ? (e.i === 'endless' ? '🔒 Finish Level 1 to unlock' : '🔒 Finish the level before to unlock') : e.sub}</small>${starTxt ? `<small class="st" aria-hidden="true">${starTxt}</small>` : ''}</span>`;
    b.setAttribute('aria-label', `${e.name}. ${e.locked ? 'Locked.' : e.sub + '.'} ${e.stars >= 0 && !e.locked ? e.stars + ' of 3 stars.' : ''}`);
    b.onclick = () => { Audio.play('click'); startLevel(e.i); };
    el.appendChild(b);
  }
}
function renderWardrobe() {
  $('#ward-shards').textContent = save.shards;
  const el = $('#ward-list'); el.innerHTML = '';
  for (const o of OUTFITS) {
    const owned = save.owned.includes(o.id), on = save.equipped.includes(o.id);
    const d = document.createElement('div'); d.className = 'ward-item';
    d.innerHTML = `<img src="img/${o.id}.webp" alt=""><b>${o.name}</b>`;
    const b = document.createElement('button');
    if (!owned) { b.textContent = `Buy · ${o.cost} ★`; b.disabled = save.shards < o.cost; b.setAttribute('aria-label', `Buy ${o.name} for ${o.cost} star shards${save.shards < o.cost ? '. Not enough shards yet.' : ''}`);
      b.onclick = () => { if (save.shards < o.cost) return; save.shards -= o.cost; save.owned.push(o.id); save.equipped.push(o.id); persist(); Audio.play('buy'); say(`Bought ${o.name}! Hemmi is wearing it.`, true); renderWardrobe(); };
    } else { b.textContent = on ? 'Wearing ✓' : 'Wear'; if (on) b.classList.add('on'); b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', `${o.name}: ${on ? 'wearing. Tap to take off.' : 'not wearing. Tap to wear.'}`);
      b.onclick = () => { if (on) save.equipped = save.equipped.filter(x => x !== o.id); else save.equipped.push(o.id); persist(); Audio.play('click'); renderWardrobe(); };
    }
    d.appendChild(b); el.appendChild(d);
  }
  const wc = $('#ward-canvas'), w2 = wc.getContext('2d'); w2.clearRect(0, 0, 300, 300);
  drawHemmi(w2, 'hemmi_idle', 150, 285, 260, 1, 1, 0, 1, save.equipped);
  wc.setAttribute('aria-label', 'Hemmi wearing: ' + (save.equipped.length ? save.equipped.map(id => OUTFITS.find(o => o.id === id).name).join(', ') : 'nothing extra'));
}
function renderStorybook() {
  const el = $('#sb-list'); el.innerHTML = '';
  PANELS.forEach((P, i) => {
    const has = save.panels.includes(i); const b = document.createElement('button'); b.disabled = !has;
    b.innerHTML = has ? `<img src="${P.img}" alt=""><span>Page ${i + 1}</span>` : `<span style="padding:30px 0">🔒 Page ${i + 1}</span>`;
    b.setAttribute('aria-label', has ? `Story page ${i + 1}: ${P.text}` : `Story page ${i + 1}, locked. Keep playing to unlock.`);
    b.onclick = () => playStory([i], () => { renderStorybook(); show('storybook'); });
    el.appendChild(b);
  });
}
const SETTINGS = [
  ['music', 'Music', 'Catchy island tune'], ['sfx', 'Sound effects', ''], ['shake', 'Screen shake', 'Camera wobble on big hits'],
  ['reduceMotion', 'Reduce motion', 'Calmer camera, fewer particles and bobbing'], ['highContrast', 'High contrast', 'Bold outlines around hazards and darker backgrounds'],
  ['largeText', 'Large text', 'Bigger words everywhere'], ['assistSlow', 'Assist: slower speed', 'Everything moves 30% slower'],
  ['assistInvincible', 'Assist: no damage', 'Bumps never cost hearts'], ['cues', 'Hazard sound cues', 'Beeps before obstacles: two high beeps = jump, low buzz = crab, chime = mischief'],
  ['touch', 'Show touch buttons', 'Big Jump and Spin buttons on screen']
];
function applySettings() {
  document.body.classList.toggle('large-text', S().largeText);
  document.body.classList.toggle('high-contrast', S().highContrast);
  document.body.classList.toggle('reduce-motion', S().reduceMotion);
}
function renderSettings() {
  const el = $('#set-list'); el.innerHTML = '';
  for (const [k, label, sub] of SETTINGS) {
    const row = document.createElement('label'); row.className = 'set-row';
    row.innerHTML = `<span>${label}${sub ? `<small>${sub}</small>` : ''}</span><span style="display:flex;align-items:center"><input type="checkbox" role="switch" ${S()[k] ? 'checked' : ''}><span class="sw" aria-hidden="true"></span><span class="sw-label" aria-hidden="true">${S()[k] ? 'On' : 'Off'}</span></span>`;
    const inp = row.querySelector('input'); inp.setAttribute('aria-label', label + (sub ? '. ' + sub : ''));
    inp.onchange = () => { S()[k] = inp.checked; row.querySelector('.sw-label').textContent = inp.checked ? 'On' : 'Off'; if (k === 'reduceMotion' && inp.checked) S().shake = false; persist(); applySettings(); Audio.init(); Audio.play('click'); if (k === 'music' && state === 'play') Audio.music(inp.checked); if (k === 'reduceMotion') renderSettings(); };
    el.appendChild(row);
  }
}
$('#set-back').onclick = () => { if (settingsReturn === 'pause') show('pause'); else { $('#title-shards').textContent = save.shards; show('title'); } };
$('#set-reset').onclick = () => { if (confirm('Erase all progress, shards and outfits? This cannot be undone.')) { const st = save.settings; save = defaultSave(); save.settings = st; persist(); say('Progress reset.', true); $('#title-shards').textContent = 0; } };

/* ---------------- Boot ---------------- */
applySettings();
$('#title-shards').textContent = save.shards;
show('title');
loadAll.then(() => { requestAnimationFrame(t => { last = t; frame(t); }); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
// test hook (harmless): lets automated tests drive the game
window.__hemmi = { get G() { return G; }, get state() { return state; }, save: () => save, jump: pressJump, spin: pressSpin, release: releaseJump, finish: () => G && finishLevel() };
})();
