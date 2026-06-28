/* ============================================================================
 * The Dragon World — game.js
 *
 * A cheerful arcade game: a hero on a castle jumps to touch friendly dragons
 * (collecting them as sparkles/stars) while dodging falling fire. Two modes
 * (Adventure: 12 levels; Endless: ramping survival), three difficulties, five
 * heroes with unlockable costumes. Vanilla JS + Canvas + Web Audio, fully
 * offline. The matrix... no wait — this is a game. 1280x720 logical canvas.
 *
 * Sections: CONFIG · STATE · SAVE/UNLOCKS · AUDIO · INPUT · ART · HERO ART ·
 *           ENTITIES · MODES/UPDATE · RENDER · HUD · LOOP · MENU/UI
 * ==========================================================================*/

'use strict';

/* ============================== CONFIG ================================== */

const LOGICAL_W = 1280;
const LOGICAL_H = 720;

const GROUND_Y = LOGICAL_H - 150;   // top of the castle rampart = hero's feet
const WALL_LEFT = 120;
const WALL_RIGHT = LOGICAL_W - 120;

const DRAGON_BAND_TOP = 230;
const DRAGON_BAND_BOTTOM = 400;

const DIFFICULTY = {
  easy: {
    label: 'Easy', hearts: 5, maxDragons: 2, maxFireballs: 2,
    dragonSpeed: 130, spawnInterval: 1.4, fireInterval: [2.6, 4.2], firePerBreath: 1,
    fireballSpeed: 150, fireballGravity: 120,
    jumpV: 1050, gravity: 2300, moveSpeed: 430, collectPad: 28, hitScale: 0.72, shake: false,
  },
  medium: {
    label: 'Medium', hearts: 4, maxDragons: 3, maxFireballs: 4,
    dragonSpeed: 185, spawnInterval: 1.1, fireInterval: [1.8, 3.2], firePerBreath: 1,
    fireballSpeed: 200, fireballGravity: 180,
    jumpV: 1000, gravity: 2500, moveSpeed: 480, collectPad: 16, hitScale: 0.82, shake: true,
  },
  brave: {
    label: 'Brave', hearts: 3, maxDragons: 5, maxFireballs: 6,
    dragonSpeed: 250, spawnInterval: 0.8, fireInterval: [1.2, 2.4], firePerBreath: 2,
    fireballSpeed: 260, fireballGravity: 240,
    jumpV: 980, gravity: 2650, moveSpeed: 520, collectPad: 6, hitScale: 0.9, shake: true,
  },
};

const ADVENTURE = { levels: 12, baseGoal: 6, goalStep: 1 };  // goal = 6..17 dragons

const PLAYER_W = 46, PLAYER_H = 64, PLAYER_R = 24;
const DRAGON_R = 36, FIREBALL_R = 16;
const INVULN_TIME = 1.5, COMBO_WINDOW = 2.0;
const MAX_PARTICLES = 140;

const SKIN = '#f2c79b', BOOTS = '#5b3a1a';
const CHARACTERS = {
  knight:   { name: 'Knight',   tunic: '#4a78b0', trim: '#d7e1ec', cape: null,      hat: 'helmet', hatColor: '#9aa7b4', shield: true },
  prince:   { name: 'Prince',   tunic: '#c0392b', trim: '#ffd23f', cape: '#7d3cff', hat: 'crown',  hatColor: '#ffd23f' },
  princess: { name: 'Princess', tunic: '#ff6fae', trim: '#ffe08a', cape: null,      hat: 'tiara',  hatColor: '#ffd23f', dress: true, hair: '#7a3b1a' },
  wizard:   { name: 'Wizard',   tunic: '#3b3b8f', trim: '#ffd23f', cape: null,      hat: 'wizard', hatColor: '#2a2a6e', staff: true, beard: '#e8e8f0' },
  archer:   { name: 'Archer',   tunic: '#4a8f43', trim: '#caa46a', cape: null,      hat: 'hood',   hatColor: '#356b30', bow: true },
};
const CHARACTER_ORDER = ['knight', 'prince', 'princess', 'wizard', 'archer'];

const COSTUMES = {
  classic: { name: 'Classic',     recolor: null,                                                  aura: null,      unlock: null },
  royal:   { name: 'Royal',       recolor: { tunic: '#6a2fb0', trim: '#ffd23f', cape: '#ffd23f' }, aura: null,      unlock: 'Finish Adventure once' },
  forest:  { name: 'Forest',      recolor: { tunic: '#2f7d32', trim: '#9acb6b' },                  aura: null,      unlock: 'Reach 5,000 lifetime points' },
  winter:  { name: 'Winter',      recolor: { tunic: '#5aa0d6', trim: '#eaf6ff' },                  aura: 'snow',    unlock: 'Reach 10,000 lifetime points' },
  golden:  { name: 'Golden Hero', recolor: { tunic: '#e0a400', trim: '#fff3b0' },                  aura: 'gold',    unlock: 'Finish Adventure without a single hit' },
  rainbow: { name: 'Rainbow',     recolor: 'rainbow',                                              aura: 'rainbow', unlock: 'Collect 1,000 dragons total' },
};
const COSTUME_ORDER = ['classic', 'royal', 'forest', 'winter', 'golden', 'rainbow'];

const DRAGON_MILESTONES = [25, 100, 250, 500, 1000];

/* ============================== STATE ================================== */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let viewScaleX = 1, viewScaleY = 1;

const game = {
  phase: 'start',            // start | playing | paused | levelcomplete | victory | over
  mode: 'endless',           // adventure | endless
  diff: DIFFICULTY.medium, diffName: 'medium',
  player: null,
  dragons: [], fireballs: [], particles: [], floats: [], clouds: [],
  spawnTimer: 0, nextDragonSide: 'left',
  score: 0, dragonsCollected: 0,
  comboStreak: 0, comboTimer: 0,
  hearts: 0, shake: 0, t: 0,
  heartPulse: 0, fireworkTimer: 0,
  level: 1, goal: 0, levelCollected: 0, flawless: true,
  _dyn: null,
  // persisted
  muted: false,
  character: 'knight', costume: 'classic',
  unlocked: ['classic'],
  lifetimePoints: 0, lifetimeDragons: 0,
  highScores: {}, adventureDone: false, goldenDone: false,
};

/* ============================== SAVE / UNLOCKS ========================= */

function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

function loadSave() {
  try {
    game.character = localStorage.getItem('dw_character') || 'knight';
    game.costume = localStorage.getItem('dw_costume') || 'classic';
    game.muted = localStorage.getItem('dw_muted') === '1';
    game.lifetimePoints = +localStorage.getItem('dw_points') || 0;
    game.lifetimeDragons = +localStorage.getItem('dw_dragons') || 0;
    game.adventureDone = localStorage.getItem('dw_adv') === '1';
    game.goldenDone = localStorage.getItem('dw_gold') === '1';
    game.highScores = JSON.parse(localStorage.getItem('dw_highscores') || '{}') || {};
    const u = JSON.parse(localStorage.getItem('dw_unlocked') || '["classic"]');
    game.unlocked = Array.isArray(u) && u.length ? u : ['classic'];
  } catch (e) { /* ignore */ }
  if (!CHARACTERS[game.character]) game.character = 'knight';
  evaluateUnlocks();
  if (!game.unlocked.includes(game.costume)) game.costume = 'classic';
}

// Recompute owned costumes from stats/flags; returns the keys newly earned.
function evaluateUnlocks() {
  const before = new Set(game.unlocked);
  const owned = new Set(['classic']);
  if (game.adventureDone) owned.add('royal');
  if (game.lifetimePoints >= 5000) owned.add('forest');
  if (game.lifetimePoints >= 10000) owned.add('winter');
  if (game.goldenDone) owned.add('golden');
  if (game.lifetimeDragons >= 1000) owned.add('rainbow');
  game.unlocked = COSTUME_ORDER.filter((k) => owned.has(k));
  save('dw_unlocked', JSON.stringify(game.unlocked));
  return game.unlocked.filter((k) => !before.has(k));
}

// Bank lifetime stats + high score at the end of a run; returns summary.
function finalizeRun() {
  game.lifetimePoints += game.score;
  game.lifetimeDragons += game.dragonsCollected;
  save('dw_points', game.lifetimePoints);
  save('dw_dragons', game.lifetimeDragons);
  const key = game.mode + '_' + game.diffName;
  const prev = game.highScores[key] || 0;
  const isNew = game.score > prev;
  if (isNew) { game.highScores[key] = game.score; save('dw_highscores', JSON.stringify(game.highScores)); }
  const earned = evaluateUnlocks();
  return { earned, high: Math.max(prev, game.score), isNew };
}

/* ============================== AUDIO ================================== */
/* Procedural Web Audio — sound effects + a light background loop. Offline. */

const Audio = (() => {
  let ac = null;
  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ac = new AC();
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function note(freq, dur, type = 'square', vol = 0.18, slideTo = null) {
    if (game.muted || !freq) return;
    const c = ensure(); if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator(), gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function chord(freqs, dur, type, vol) { freqs.forEach((f) => note(f, dur, type, vol)); }

  // ---- background music: simple looping arpeggios ----
  const SEQ = {
    menu: [523, 659, 784, 659, 440, 523, 659, 523],
    play: [523, 784, 659, 988, 523, 784, 659, 1047],
    victory: [523, 659, 784, 1047, 784, 1047, 1319, 1047],
  };
  let mTimer = null, mStep = 0, mName = null;
  function startMusic(name) {
    if (mName === name) return;
    stopMusic();
    mName = name; mStep = 0;
    const seq = SEQ[name];
    if (!seq) return;
    const tempo = name === 'victory' ? 160 : 230;
    mTimer = setInterval(() => {
      const f = seq[mStep % seq.length];
      note(f, 0.18, 'triangle', 0.05);
      if (mStep % 2 === 0) note(f / 2, 0.22, 'sine', 0.04);
      mStep++;
    }, tempo);
  }
  function stopMusic() { if (mTimer) { clearInterval(mTimer); mTimer = null; } mName = null; }

  return {
    resume: ensure, startMusic, stopMusic,
    jump() { note(420, 0.16, 'square', 0.16, 760); },
    collect(streak) { const b = 660 + Math.min(streak, 8) * 60; note(b, 0.12, 'triangle', 0.2, b * 1.5); },
    fire() { note(150, 0.18, 'sawtooth', 0.06, 90); },
    hit() { note(180, 0.32, 'sawtooth', 0.22, 70); },
    heart() { note(660, 0.1, 'sine', 0.18, 990); note(990, 0.12, 'sine', 0.16); },
    levelUp() { chord([523, 659, 784], 0.25, 'triangle', 0.14); },
    win() { chord([523, 659, 784, 1047], 0.5, 'triangle', 0.16); },
    over() { note(330, 0.5, 'sawtooth', 0.2, 110); },
    click() { note(520, 0.07, 'square', 0.12); },
  };
})();

/* ============================== INPUT ================================== */

const input = { left: false, right: false, jumpHeld: false, jumpRequested: false };

function bindKeyboard() {
  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': input.left = true; break;
      case 'ArrowRight': case 'd': case 'D': input.right = true; break;
      case 'ArrowUp': case ' ': case 'w': case 'W':
        if (!e.repeat) input.jumpRequested = true;
        input.jumpHeld = true; e.preventDefault(); break;
      case 'p': case 'P': togglePause(); break;
      case 'm': case 'M': toggleMute(); break;
    }
  });
  window.addEventListener('keyup', (e) => {
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': input.left = false; break;
      case 'ArrowRight': case 'd': case 'D': input.right = false; break;
      case 'ArrowUp': case ' ': case 'w': case 'W': input.jumpHeld = false; break;
    }
  });
}

function bindHoldButton(el, on) {
  const press = (e) => { e.preventDefault(); Audio.resume(); on(true); };
  const release = (e) => { e.preventDefault(); on(false); };
  el.addEventListener('pointerdown', press);
  el.addEventListener('pointerup', release);
  el.addEventListener('pointerleave', release);
  el.addEventListener('pointercancel', release);
}

function bindTouchControls() {
  bindHoldButton(document.getElementById('btn-left'), (v) => input.left = v);
  bindHoldButton(document.getElementById('btn-right'), (v) => input.right = v);
  const jump = document.getElementById('btn-jump');
  jump.addEventListener('pointerdown', (e) => {
    e.preventDefault(); Audio.resume();
    input.jumpRequested = true; input.jumpHeld = true;
  });
  jump.addEventListener('pointerup', (e) => { e.preventDefault(); input.jumpHeld = false; });
  jump.addEventListener('pointercancel', () => { input.jumpHeld = false; });
}

/* ============================== ART HELPERS ============================ */

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawHeart(c, x, y, s, filled) {
  c.save(); c.translate(x, y); c.scale(s / 24, s / 24);
  c.beginPath();
  c.moveTo(0, 7);
  c.bezierCurveTo(-2, 2, -12, 0, -12, -8);
  c.bezierCurveTo(-12, -15, -4, -16, 0, -9);
  c.bezierCurveTo(4, -16, 12, -15, 12, -8);
  c.bezierCurveTo(12, 0, 2, 2, 0, 7);
  c.closePath();
  if (filled) { c.fillStyle = '#ff5a5f'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#c0303a'; c.stroke(); }
  else { c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.55)'; c.stroke(); }
  c.restore();
}

function drawStar(c, x, y, r, color) {
  c.save(); c.translate(x, y);
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    c.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
  }
  c.closePath(); c.fillStyle = color; c.fill(); c.restore();
}

/* ============================== HERO ART =============================== */

function resolveLook(charKey, costKey, time) {
  const ch = CHARACTERS[charKey] || CHARACTERS.knight;
  const co = COSTUMES[costKey] || COSTUMES.classic;
  let tunic = ch.tunic, trim = ch.trim, cape = ch.cape;
  if (co.recolor === 'rainbow') {
    const hd = (time * 60) % 360;
    tunic = `hsl(${hd}, 80%, 55%)`;
    trim = `hsl(${(hd + 60) % 360}, 90%, 72%)`;
    if (ch.cape) cape = `hsl(${(hd + 180) % 360}, 80%, 55%)`;
  } else if (co.recolor) {
    if (co.recolor.tunic) tunic = co.recolor.tunic;
    if (co.recolor.trim) trim = co.recolor.trim;
    if (co.recolor.cape && ch.cape) cape = co.recolor.cape;
  }
  return { ch, co, tunic, trim, cape };
}

function drawHero(c, x, feetY, facing, squash, alpha, charKey, costKey, time) {
  const { ch, co, tunic, trim, cape } = resolveLook(charKey, costKey, time);
  const w = PLAYER_W, h = PLAYER_H;
  c.save();
  c.globalAlpha = alpha;
  c.globalAlpha = alpha * 0.25;
  c.fillStyle = '#000';
  c.beginPath(); c.ellipse(x, feetY + 2, w * 0.5, 7, 0, 0, Math.PI * 2); c.fill();
  c.globalAlpha = alpha;

  c.translate(x, feetY);
  if (co.aura) drawAura(c, co.aura, w, h, time);

  c.scale((1 + squash * 0.35) * (facing < 0 ? -1 : 1), 1 - squash * 0.35);

  if (cape) {
    c.fillStyle = cape;
    c.beginPath();
    c.moveTo(-w * 0.22, -h * 0.78);
    c.quadraticCurveTo(-w * 0.62, -h * 0.4, -w * 0.34, -h * 0.04);
    c.lineTo(-w * 0.06, -h * 0.1); c.lineTo(-w * 0.06, -h * 0.78);
    c.closePath(); c.fill();
  }
  if (ch.bow) {
    c.strokeStyle = '#7a4a1d'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.arc(-w * 0.34, -h * 0.44, h * 0.3, -1.1, 1.1); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-w * 0.34 + Math.cos(-1.1) * h * 0.3, -h * 0.44 + Math.sin(-1.1) * h * 0.3);
    c.lineTo(-w * 0.34 + Math.cos(1.1) * h * 0.3, -h * 0.44 + Math.sin(1.1) * h * 0.3);
    c.stroke();
  }
  c.fillStyle = BOOTS;
  roundRect(c, -w * 0.28, -h * 0.26, w * 0.22, h * 0.26, 5); c.fill();
  roundRect(c, w * 0.06, -h * 0.26, w * 0.22, h * 0.26, 5); c.fill();

  c.fillStyle = tunic;
  if (ch.dress) {
    c.beginPath();
    c.moveTo(-w * 0.2, -h * 0.66); c.lineTo(w * 0.2, -h * 0.66);
    c.lineTo(w * 0.5, -h * 0.04); c.lineTo(-w * 0.5, -h * 0.04);
    c.closePath(); c.fill();
  } else {
    roundRect(c, -w * 0.34, -h * 0.66, w * 0.68, h * 0.46, 10); c.fill();
  }
  c.fillStyle = trim;
  roundRect(c, -w * 0.3, -h * 0.36, w * 0.6, h * 0.06, 3); c.fill();
  c.fillStyle = tunic;
  roundRect(c, w * 0.18, -h * 0.6, w * 0.16, h * 0.3, 6); c.fill();

  if (ch.shield) {
    c.fillStyle = trim;
    c.beginPath(); c.ellipse(w * 0.42, -h * 0.45, w * 0.16, h * 0.18, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#b8860b'; c.lineWidth = 2; c.stroke();
  }
  if (ch.staff) {
    c.strokeStyle = '#8a5a2b'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(w * 0.42, -h * 0.1); c.lineTo(w * 0.42, -h * 0.95); c.stroke();
    c.fillStyle = '#7fe3ff'; c.beginPath(); c.arc(w * 0.42, -h * 1.0, w * 0.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(180,240,255,0.5)'; c.beginPath(); c.arc(w * 0.42, -h * 1.0, w * 0.16, 0, Math.PI * 2); c.fill();
  }

  c.fillStyle = SKIN;
  c.beginPath(); c.arc(0, -h * 0.78, w * 0.24, 0, Math.PI * 2); c.fill();

  if (ch.hair) {
    c.fillStyle = ch.hair;
    c.beginPath();
    c.ellipse(-w * 0.22, -h * 0.66, w * 0.1, h * 0.18, 0, 0, Math.PI * 2);
    c.ellipse(w * 0.22, -h * 0.66, w * 0.1, h * 0.18, 0, 0, Math.PI * 2);
    c.fill();
  }
  if (ch.beard) {
    c.fillStyle = ch.beard;
    c.beginPath();
    c.moveTo(-w * 0.16, -h * 0.74);
    c.quadraticCurveTo(0, -h * 0.44, w * 0.16, -h * 0.74);
    c.closePath(); c.fill();
  }

  drawHat(c, ch, trim, w, h);

  c.fillStyle = '#23314a';
  c.beginPath(); c.arc(w * 0.08, -h * 0.78, 2.4, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(-w * 0.06, -h * 0.78, 2.4, 0, Math.PI * 2); c.fill();
  if (!ch.beard) {
    c.strokeStyle = '#a85b3a'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, -h * 0.72, 5, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  }
  c.restore();
}

function drawHat(c, ch, trim, w, h) {
  const hc = ch.hatColor;
  switch (ch.hat) {
    case 'helmet':
      c.fillStyle = hc;
      c.beginPath(); c.arc(0, -h * 0.82, w * 0.26, Math.PI, 0); c.fill();
      roundRect(c, -w * 0.28, -h * 0.84, w * 0.56, h * 0.06, 3); c.fill();
      c.fillStyle = trim;
      c.beginPath(); c.ellipse(w * 0.02, -h * 1.02, w * 0.06, h * 0.1, 0.4, 0, Math.PI * 2); c.fill();
      break;
    case 'crown': case 'tiara': {
      const top = ch.hat === 'crown' ? -h * 1.0 : -h * 0.98, base = -h * 0.9;
      c.fillStyle = hc;
      c.beginPath();
      c.moveTo(-w * 0.26, base); c.lineTo(-w * 0.26, top + h * 0.06);
      c.lineTo(-w * 0.13, top); c.lineTo(0, top + h * 0.06);
      c.lineTo(w * 0.13, top); c.lineTo(w * 0.26, top + h * 0.06);
      c.lineTo(w * 0.26, base); c.closePath(); c.fill();
      c.fillStyle = '#ff5a5f'; c.beginPath(); c.arc(0, base - 2, 2.6, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'wizard':
      c.fillStyle = hc;
      c.beginPath(); c.moveTo(-w * 0.3, -h * 0.86); c.lineTo(w * 0.3, -h * 0.86); c.lineTo(w * 0.04, -h * 1.28); c.closePath(); c.fill();
      drawStar(c, -w * 0.04, -h * 1.0, 3, trim);
      drawStar(c, w * 0.08, -h * 1.12, 2.2, trim);
      break;
    case 'hood':
      c.fillStyle = hc;
      c.beginPath(); c.arc(0, -h * 0.8, w * 0.3, Math.PI, 0); c.fill();
      roundRect(c, -w * 0.3, -h * 0.82, w * 0.6, h * 0.12, 4); c.fill();
      break;
  }
}

function drawAura(c, kind, w, h, time) {
  const cy = -h * 0.55;
  if (kind === 'gold') {
    const g = c.createRadialGradient(0, cy, 4, 0, cy, w * 0.95);
    g.addColorStop(0, 'rgba(255,225,120,0.55)'); g.addColorStop(1, 'rgba(255,225,120,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, cy, w * 0.95, 0, Math.PI * 2); c.fill();
  } else if (kind === 'rainbow') {
    for (let i = 0; i < 6; i++) {
      c.strokeStyle = `hsla(${(time * 90 + i * 60) % 360}, 90%, 60%, 0.5)`;
      c.lineWidth = 3; c.beginPath(); c.arc(0, cy, w * 0.55 + i * 4, 0, Math.PI * 2); c.stroke();
    }
  } else if (kind === 'snow') {
    c.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 7; i++) {
      const a = time * 1.3 + i * 0.9;
      c.beginPath(); c.arc(Math.cos(a) * w * 0.55, cy + Math.sin(a * 1.6) * h * 0.5, 2.2, 0, Math.PI * 2); c.fill();
    }
  }
}

/* ============================== DRAGON / FIRE ART ===================== */

function drawDragon(c, d) {
  const flap = Math.sin(d.wingPhase) * 0.5;
  c.save();
  c.translate(d.x, d.drawY);
  c.scale(d.dir * d.scale, d.scale);

  c.strokeStyle = d.body; c.lineWidth = 10; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-30, 0); c.quadraticCurveTo(-60, -6, -72, 10); c.stroke();
  c.fillStyle = d.body;
  c.beginPath(); c.moveTo(-72, 10); c.lineTo(-86, 2); c.lineTo(-82, 18); c.closePath(); c.fill();

  c.fillStyle = d.wing;
  c.save(); c.rotate(-0.5 - flap);
  c.beginPath(); c.moveTo(-6, -6); c.quadraticCurveTo(-30, -46, -56, -30); c.quadraticCurveTo(-34, -16, -6, -6); c.closePath(); c.fill();
  c.restore();

  c.fillStyle = d.body; c.beginPath(); c.ellipse(0, 0, 34, 24, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = d.belly; c.beginPath(); c.ellipse(2, 8, 22, 13, 0, 0, Math.PI * 2); c.fill();

  c.fillStyle = d.wing2;
  c.save(); c.rotate(-0.35 + flap);
  c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(-22, -54, 18, -42); c.quadraticCurveTo(14, -20, 0, -8); c.closePath(); c.fill();
  c.restore();

  c.fillStyle = d.body; c.beginPath(); c.ellipse(34, -8, 18, 15, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(50, -4, 9, 7, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff4d6'; c.beginPath(); c.moveTo(28, -20); c.lineTo(24, -34); c.lineTo(34, -22); c.closePath(); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(38, -12, 5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#1c2536'; c.beginPath(); c.arc(39.5, -12, 2.4, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(54, -4, 1.6, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#1c2536'; c.lineWidth = 1.6;
  c.beginPath(); c.arc(46, 0, 5, 0.1 * Math.PI, 0.6 * Math.PI); c.stroke();

  if (d.fireCooldown < 0.35) {
    c.fillStyle = 'rgba(255,140,40,' + (0.5 * (1 - d.fireCooldown / 0.35)) + ')';
    c.beginPath(); c.arc(58, -2, 8, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

function drawFireball(c, f) {
  c.save(); c.translate(f.x, f.y);
  const r = f.r;
  const g = c.createRadialGradient(0, 0, 2, 0, 0, r * 1.6);
  g.addColorStop(0, '#fff3b0'); g.addColorStop(0.4, '#ffae33'); g.addColorStop(1, 'rgba(255,60,20,0)');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 1.6, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ff5a1f'; c.beginPath(); c.arc(0, 0, r * 0.72, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(0, -2, r * 0.4, 0, Math.PI * 2); c.fill();
  c.restore();
}

/* ============================== ENTITIES =============================== */

function makePlayer() {
  return { x: LOGICAL_W / 2, y: GROUND_Y, vx: 0, vy: 0, onGround: true, facing: 1, squash: 0, invuln: 0 };
}

function spawnDragon() {
  const side = game.nextDragonSide;
  game.nextDragonSide = side === 'left' ? 'right' : 'left';
  const dir = side === 'left' ? 1 : -1;
  const baseY = rand(DRAGON_BAND_TOP, DRAGON_BAND_BOTTOM);
  const d = {
    x: side === 'left' ? -80 : LOGICAL_W + 80,
    baseY, drawY: baseY, dir,
    speed: game._dyn.dragonSpeed * rand(0.85, 1.15),
    scale: rand(0.92, 1.12),
    bobAmp: rand(16, 32), bobFreq: rand(1.5, 2.6), bobPhase: rand(0, 6.28),
    wingPhase: rand(0, 6.28),
    fireCooldown: rand(game._dyn.fireIntervalMin, game._dyn.fireIntervalMax),
    body: pick(['#5fbf5f', '#7a6ff0', '#ef6db0', '#48b6d6']),
  };
  d.belly = '#fdf0c8'; d.wing = shade(d.body, -18); d.wing2 = shade(d.body, 14);
  game.dragons.push(d);
}

function breatheFire(d) {
  Audio.fire();
  for (let i = 0; i < game.diff.firePerBreath; i++) {
    if (game.fireballs.length >= game.diff.maxFireballs) break;
    game.fireballs.push({
      x: d.x + d.dir * 52 * d.scale + rand(-6, 6), y: d.drawY - 2,
      vx: rand(-40, 40) + d.dir * 20, vy: game._dyn.fireballSpeed * rand(0.85, 1.1), r: FIREBALL_R,
    });
  }
}

function pushParticle(p) {
  game.particles.push(p);
  if (game.particles.length > MAX_PARTICLES) game.particles.shift();
}

function addSparkles(x, y, color) {
  for (let i = 0; i < 14; i++) {
    const a = rand(0, 6.28), sp = rand(60, 240);
    pushParticle({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: rand(0.4, 0.8), maxLife: 0.8, size: rand(3, 7), color, kind: 'spark' });
  }
}
function addEmber(x, y) {
  pushParticle({ x, y, vx: rand(-20, 20), vy: rand(-10, 30), life: 0.4, maxLife: 0.4, size: rand(2, 4), color: '#ff8a3d', kind: 'ember' });
}
function spawnFirework() {
  const x = rand(200, LOGICAL_W - 200), y = rand(120, 360), color = `hsl(${rand(0, 360) | 0}, 90%, 60%)`;
  for (let i = 0; i < 22; i++) {
    const a = (Math.PI * 2 * i) / 22, sp = rand(120, 260);
    pushParticle({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.7, 1.1), maxLife: 1.1, size: rand(3, 6), color, kind: 'spark' });
  }
  Audio.collect(3);
}
function addFloat(x, y, text) { game.floats.push({ x, y, text, life: 1.0 }); }

function makeClouds() {
  game.clouds = [];
  for (let i = 0; i < 5; i++) game.clouds.push({ x: rand(0, LOGICAL_W), y: rand(40, 200), s: rand(0.7, 1.4), v: rand(6, 16) });
}

/* ============================== MODES / UPDATE ======================== */

function goalForLevel(level) { return ADVENTURE.baseGoal + (level - 1) * ADVENTURE.goalStep; }

// Dynamic per-frame parameters (Adventure scales by level; Endless by time).
function dyn() {
  const d = game.diff;
  let speedMult = 1, fireMult = 1, extra = 0;
  if (game.mode === 'adventure') {
    speedMult = Math.pow(1.08, game.level - 1);
    fireMult = Math.pow(1.05, game.level - 1);
    if (game.level >= 5) extra += 1;
    if (game.level >= 9) extra += 1;
  } else {
    const steps = Math.min(game.t, 600) / 30;   // ramp every 30s, cap at 10 min
    speedMult = Math.pow(1.06, steps);
    fireMult = Math.pow(1.04, steps);
  }
  return {
    dragonSpeed: d.dragonSpeed * speedMult,
    fireballSpeed: d.fireballSpeed * Math.min(speedMult, 1.7),
    spawnInterval: d.spawnInterval / Math.min(fireMult, 2),
    fireIntervalMin: d.fireInterval[0] / fireMult,
    fireIntervalMax: d.fireInterval[1] / fireMult,
    maxDragons: d.maxDragons + extra,
  };
}

function startGame(mode, diffName) {
  game.mode = mode;
  game.diffName = diffName;
  game.diff = DIFFICULTY[diffName];
  game.player = makePlayer();
  game.dragons = []; game.fireballs = []; game.particles = []; game.floats = [];
  game.spawnTimer = 0.4; game.nextDragonSide = 'left';
  game.score = 0; game.dragonsCollected = 0;
  game.comboStreak = 0; game.comboTimer = 0;
  game.hearts = game.diff.hearts; game.shake = 0; game.t = 0;
  game.heartPulse = 0;
  game.level = 1; game.flawless = true;
  game.goal = mode === 'adventure' ? goalForLevel(1) : 0;
  game.levelCollected = 0;
  makeClouds();
  game._dyn = dyn();
  game.phase = 'playing';
  hideAllOverlays();
  Audio.startMusic('play');
}

function update(dt) {
  game.t += dt;
  for (const cl of game.clouds) { cl.x += cl.v * dt; if (cl.x > LOGICAL_W + 80) cl.x = -80; }
  if (game.heartPulse > 0) game.heartPulse = Math.max(0, game.heartPulse - dt);

  if (game.phase === 'victory') {
    game.fireworkTimer -= dt;
    if (game.fireworkTimer <= 0) { spawnFirework(); game.fireworkTimer = rand(0.4, 0.9); }
    updateParticles(dt);
    return;
  }
  if (game.phase !== 'playing') return;

  const d = game.diff;
  const pl = game.player;
  game._dyn = dyn();

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  pl.vx = dir * d.moveSpeed;
  pl.x = Math.max(WALL_LEFT, Math.min(WALL_RIGHT, pl.x + pl.vx * dt));
  if (dir !== 0) pl.facing = dir;

  if (input.jumpRequested && pl.onGround) {
    pl.vy = -d.jumpV; pl.onGround = false; pl.squash = -0.4; Audio.jump();
  }
  input.jumpRequested = false;

  pl.vy += d.gravity * dt;
  pl.y += pl.vy * dt;
  if (pl.y >= GROUND_Y) {
    if (!pl.onGround) pl.squash = 0.5;
    pl.y = GROUND_Y; pl.vy = 0; pl.onGround = true;
  }
  pl.squash += (0 - pl.squash) * Math.min(1, dt * 12);
  if (pl.invuln > 0) pl.invuln -= dt;
  if (game.comboTimer > 0) game.comboTimer -= dt; else game.comboStreak = 0;

  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0 && game.dragons.length < game._dyn.maxDragons) {
    spawnDragon(); game.spawnTimer = game._dyn.spawnInterval;
  }
  for (let i = game.dragons.length - 1; i >= 0; i--) {
    const dr = game.dragons[i];
    dr.x += dr.dir * dr.speed * dt;
    dr.drawY = dr.baseY + Math.sin(game.t * dr.bobFreq + dr.bobPhase) * dr.bobAmp;
    dr.wingPhase += dt * 9;
    dr.fireCooldown -= dt;
    if (dr.fireCooldown <= 0 && dr.x > 40 && dr.x < LOGICAL_W - 40) {
      breatheFire(dr);
      dr.fireCooldown = rand(game._dyn.fireIntervalMin, game._dyn.fireIntervalMax);
    }
    if (dr.x < -120 || dr.x > LOGICAL_W + 120) game.dragons.splice(i, 1);
  }

  for (let i = game.fireballs.length - 1; i >= 0; i--) {
    const f = game.fireballs[i];
    f.vy += d.fireballGravity * dt; f.x += f.vx * dt; f.y += f.vy * dt;
    if (Math.random() < 0.5) addEmber(f.x, f.y);
    if (f.y > LOGICAL_H + 40) game.fireballs.splice(i, 1);
  }

  updateParticles(dt);
  for (let i = game.floats.length - 1; i >= 0; i--) {
    const fl = game.floats[i]; fl.life -= dt; fl.y -= 40 * dt;
    if (fl.life <= 0) game.floats.splice(i, 1);
  }
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 28);

  // collisions
  const pcx = pl.x, pcy = pl.y - PLAYER_H / 2;
  for (let i = game.dragons.length - 1; i >= 0; i--) {
    const dr = game.dragons[i];
    const dx = pcx - dr.x, dy = pcy - dr.drawY;
    const reach = PLAYER_R + DRAGON_R * dr.scale + d.collectPad;
    if (dx * dx + dy * dy <= reach * reach) { game.dragons.splice(i, 1); collectDragon(dr); }
  }
  if (pl.invuln <= 0) {
    for (let i = game.fireballs.length - 1; i >= 0; i--) {
      const f = game.fireballs[i];
      const dx = pcx - f.x, dy = pcy - f.y;
      const reach = (PLAYER_R + f.r) * d.hitScale;
      if (dx * dx + dy * dy <= reach * reach) { game.fireballs.splice(i, 1); hitPlayer(); break; }
    }
  }
}

function updateParticles(dt) {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.life -= dt; p.vy += 300 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.life <= 0) game.particles.splice(i, 1);
  }
}

function collectDragon(dr) {
  game.comboStreak = game.comboTimer > 0 ? game.comboStreak + 1 : 0;
  game.comboTimer = COMBO_WINDOW;
  const pts = 100 + 25 * game.comboStreak;
  game.score += pts;
  game.dragonsCollected++;
  addSparkles(dr.x, dr.drawY, dr.body);
  addFloat(dr.x, dr.drawY - 10, '+' + pts);
  Audio.collect(game.comboStreak);

  if (game.mode === 'adventure') {
    game.levelCollected++;
    if (game.levelCollected >= game.goal) completeLevel();
  }
}

function completeLevel() {
  const completed = game.level;
  Audio.levelUp();
  if (completed % 3 === 0 && game.hearts < game.diff.hearts) {
    game.hearts++; game.heartPulse = 0.5; Audio.heart();
  }
  if (completed >= ADVENTURE.levels) { victory(); return; }
  game.level++;
  game.goal = goalForLevel(game.level);
  game.levelCollected = 0;
  game.phase = 'levelcomplete';
  document.getElementById('lc-title').textContent = 'Level ' + completed + ' complete!';
  document.getElementById('lc-score').textContent = 'Score: ' + game.score;
  document.getElementById('lc-next').textContent = 'Next: Level ' + game.level + ' — catch ' + game.goal + ' dragons';
  showOverlay('overlay-levelcomplete');
}

function continueLevel() {
  game.dragons = []; game.fireballs = [];
  game.spawnTimer = 0.4;
  game.phase = 'playing';
  hideAllOverlays();
}

function victory() {
  game.score += 500 + 100 * game.hearts;       // completion + remaining-hearts bonus
  game.adventureDone = true; save('dw_adv', '1');
  if (game.flawless) { game.goldenDone = true; save('dw_gold', '1'); }
  const res = finalizeRun();
  game.phase = 'victory';
  game.fireworkTimer = 0;
  game.dragons = []; game.fireballs = [];
  Audio.win(); Audio.startMusic('victory');
  document.getElementById('vic-score').textContent = 'Final score: ' + game.score;
  document.getElementById('vic-sub').textContent = game.flawless ? 'A flawless run! 🏆' : 'You saved the Dragon World!';
  setUnlockLine('vic-unlock', res.earned);
  showOverlay('overlay-victory');
}

function hitPlayer() {
  game.hearts--;
  game.flawless = false;
  game.player.invuln = INVULN_TIME;
  game.heartPulse = 0.5;
  if (game.diff.shake) game.shake = 12;
  Audio.hit();
  if (game.hearts <= 0) endGame();
}

function endGame() {
  game.phase = 'over';
  Audio.over(); Audio.stopMusic();
  const res = finalizeRun();
  document.getElementById('final-score').textContent = game.score;
  document.getElementById('final-dragons').textContent = game.dragonsCollected;
  document.getElementById('final-high').textContent = res.high;
  setUnlockLine('final-unlock', res.earned);
  showOverlay('overlay-over');
}

function setUnlockLine(id, earned) {
  const el = document.getElementById(id);
  if (earned && earned.length) {
    el.textContent = '🎉 New costume: ' + earned.map((k) => COSTUMES[k].name).join(', ') + '!';
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

/* ============================== RENDER ================================= */

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, '#6db8f0'); g.addColorStop(1, '#bfe7ff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.save();
  ctx.fillStyle = 'rgba(255, 236, 150, 0.9)';
  ctx.beginPath(); ctx.arc(1130, 120, 56, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255, 240, 170, 0.35)';
  ctx.beginPath(); ctx.arc(1130, 120, 84, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  for (const cl of game.clouds) drawCloud(cl);
}

function drawCloud(cl) {
  ctx.save(); ctx.translate(cl.x, cl.y); ctx.scale(cl.s, cl.s);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.arc(24, -8, 28, 0, Math.PI * 2);
  ctx.arc(52, 0, 22, 0, Math.PI * 2); ctx.arc(26, 12, 26, 0, Math.PI * 2);
  ctx.fill(); ctx.restore();
}

function drawCastle() {
  const top = GROUND_Y;
  const g = ctx.createLinearGradient(0, top, 0, LOGICAL_H);
  g.addColorStop(0, '#b6a892'); g.addColorStop(1, '#8a7a64');
  ctx.fillStyle = g; ctx.fillRect(0, top, LOGICAL_W, LOGICAL_H - top);
  ctx.fillStyle = '#a2937c';
  const mw = 54, gap = 34, mh = 26;
  for (let x = 10; x < LOGICAL_W; x += mw + gap) ctx.fillRect(x, top - mh, mw, mh);
  ctx.fillStyle = '#7a6c58'; ctx.fillRect(0, top, LOGICAL_W, 6);
  ctx.strokeStyle = 'rgba(90,76,58,0.35)'; ctx.lineWidth = 2;
  for (let y = top + 40; y < LOGICAL_H; y += 38) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LOGICAL_W, y); ctx.stroke(); }
  drawTower(40); drawTower(LOGICAL_W - 40 - 96);
  ctx.fillStyle = '#5b4a36';
  const gw = 120, gx = LOGICAL_W / 2 - gw / 2, gy = LOGICAL_H - 96;
  ctx.beginPath();
  ctx.moveTo(gx, LOGICAL_H); ctx.lineTo(gx, gy);
  ctx.arc(LOGICAL_W / 2, gy, gw / 2, Math.PI, 0);
  ctx.lineTo(gx + gw, LOGICAL_H); ctx.closePath(); ctx.fill();
}

function drawTower(x) {
  const top = GROUND_Y - 60;
  ctx.fillStyle = '#9c8d76'; ctx.fillRect(x, top, 96, LOGICAL_H - top);
  ctx.fillStyle = '#8a7b64'; for (let mx = x; mx < x + 96; mx += 30) ctx.fillRect(mx, top - 18, 18, 18);
  ctx.fillStyle = '#3a2f22';
  ctx.beginPath(); ctx.arc(x + 48, top + 60, 14, Math.PI, 0); ctx.fillRect(x + 34, top + 60, 28, 30); ctx.fill();
  ctx.strokeStyle = '#5b4a36'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + 48, top - 18); ctx.lineTo(x + 48, top - 64); ctx.stroke();
  ctx.fillStyle = '#e8443b';
  const wave = Math.sin(game.t * 4) * 4;
  ctx.beginPath();
  ctx.moveTo(x + 48, top - 64); ctx.lineTo(x + 84, top - 56 + wave); ctx.lineTo(x + 48, top - 48);
  ctx.closePath(); ctx.fill();
}

function drawParticles() {
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    if (p.kind === 'spark') drawStar(ctx, p.x, p.y, p.size, p.color);
    else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

function drawFloats() {
  ctx.save(); ctx.textAlign = 'center'; ctx.font = 'bold 30px system-ui, sans-serif';
  for (const fl of game.floats) {
    ctx.globalAlpha = Math.max(0, fl.life);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ff8a1f'; ctx.lineWidth = 5;
    ctx.strokeText(fl.text, fl.x, fl.y); ctx.fillText(fl.text, fl.x, fl.y);
  }
  ctx.restore(); ctx.globalAlpha = 1;
}

function render() {
  let ox = 0, oy = 0;
  if (game.shake > 0) { ox = (Math.random() - 0.5) * game.shake; oy = (Math.random() - 0.5) * game.shake; }
  ctx.setTransform(viewScaleX, 0, 0, viewScaleY, ox * viewScaleX, oy * viewScaleY);
  ctx.clearRect(-20, -20, LOGICAL_W + 40, LOGICAL_H + 40);

  drawSky();
  for (const dr of game.dragons) drawDragon(ctx, dr);
  drawCastle();
  if (game.player && game.phase !== 'start') {
    const pl = game.player;
    const flashing = pl.invuln > 0 && Math.floor(game.t * 16) % 2 === 0;
    drawHero(ctx, pl.x, pl.y, pl.facing, pl.squash, flashing ? 0.35 : 1, game.character, game.costume, game.t);
  }
  for (const f of game.fireballs) drawFireball(ctx, f);
  drawParticles();
  drawFloats();
  drawHUD();
}

/* ============================== HUD =================================== */

function drawHUD() {
  if (game.phase !== 'playing' && game.phase !== 'paused') return;
  for (let i = 0; i < game.diff.hearts; i++) {
    const empties = i >= game.hearts;
    let s = 30;
    if (game.heartPulse > 0 && i === game.hearts) s = 30 + Math.sin(game.heartPulse * 12) * 6; // bounce the changed heart
    drawHeart(ctx, 40 + i * 38, 44, s, !empties);
  }
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(40,28,70,0.7)'; ctx.lineWidth = 6;
  const s = String(game.score);
  ctx.strokeText(s, LOGICAL_W / 2, 56); ctx.fillText(s, LOGICAL_W / 2, 56);

  if (game.mode === 'adventure') {
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#fff3b0';
    const obj = 'Level ' + game.level + '  ·  🐉 ' + game.levelCollected + '/' + game.goal;
    ctx.strokeText(obj, LOGICAL_W / 2, 88); ctx.fillText(obj, LOGICAL_W / 2, 88);
  }
  if (game.comboStreak > 0 && game.comboTimer > 0) {
    ctx.font = 'bold 22px system-ui, sans-serif'; ctx.fillStyle = '#ffd23f';
    ctx.fillText('Combo x' + (game.comboStreak + 1) + '!', LOGICAL_W / 2, game.mode === 'adventure' ? 116 : 92);
  }
  // mode label top-right-ish
  ctx.textAlign = 'right'; ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText((game.mode === 'adventure' ? 'Adventure' : 'Endless') + ' · ' + game.diff.label, LOGICAL_W - 160, 34);
  ctx.restore();
}

/* ============================== LOOP ================================== */

let lastTime = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  render();
  if (game.phase === 'start') drawPreview();
  requestAnimationFrame(frame);
}

/* ============================== MENU / UI ============================= */

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  viewScaleX = canvas.width / LOGICAL_W;
  viewScaleY = canvas.height / LOGICAL_H;
  checkOrientation();
}

function checkOrientation() {
  const portrait = window.innerHeight > window.innerWidth * 1.05;
  const rotate = document.getElementById('overlay-rotate');
  if (portrait && window.innerWidth < 740) {
    rotate.classList.remove('hidden');
    if (game.phase === 'playing') togglePause();
  } else {
    rotate.classList.add('hidden');
  }
}

const OVERLAYS = ['overlay-start', 'overlay-pause', 'overlay-over', 'overlay-rotate',
                  'overlay-levelcomplete', 'overlay-victory', 'overlay-scores',
                  'overlay-collection', 'overlay-howto'];
function showOverlay(id) { document.getElementById(id).classList.remove('hidden'); }
function hideAllOverlays() { for (const id of OVERLAYS) document.getElementById(id).classList.add('hidden'); }

function togglePause() {
  if (game.phase === 'playing') { game.phase = 'paused'; showOverlay('overlay-pause'); }
  else if (game.phase === 'paused') { game.phase = 'playing'; document.getElementById('overlay-pause').classList.add('hidden'); }
}

function toggleMute() {
  game.muted = !game.muted;
  save('dw_muted', game.muted ? '1' : '0');
  document.getElementById('btn-mute').textContent = game.muted ? '🔇' : '🔊';
}

/* ---------- character / costume selection ---------- */
let charIndex = 0, cosIndex = 0;
let previewCanvas = null, pctx = null;

function initSelection() {
  charIndex = Math.max(0, CHARACTER_ORDER.indexOf(game.character));
  cosIndex = Math.max(0, game.unlocked.indexOf(game.costume));
  previewCanvas = document.getElementById('preview');
  pctx = previewCanvas.getContext('2d');
  updateSelectionUI();
}
function cycleCharacter(delta) {
  charIndex = (charIndex + delta + CHARACTER_ORDER.length) % CHARACTER_ORDER.length;
  game.character = CHARACTER_ORDER[charIndex];
  save('dw_character', game.character);
  updateSelectionUI(); Audio.click();
}
function cycleCostume(delta) {
  const n = game.unlocked.length;
  cosIndex = (cosIndex + delta + n) % n;
  game.costume = game.unlocked[cosIndex];
  save('dw_costume', game.costume);
  updateSelectionUI(); Audio.click();
}
function updateSelectionUI() {
  document.getElementById('char-name').textContent = CHARACTERS[game.character].name;
  document.getElementById('cos-name').textContent = COSTUMES[game.costume].name;
  const nextLocked = COSTUME_ORDER.find((k) => !game.unlocked.includes(k));
  document.getElementById('cos-status').textContent = nextLocked
    ? '🔒 Next: ' + COSTUMES[nextLocked].name + ' — ' + COSTUMES[nextLocked].unlock
    : 'All costumes unlocked! 🌈';
}
function drawPreview() {
  if (!pctx) return;
  pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  pctx.save();
  pctx.translate(previewCanvas.width / 2, previewCanvas.height - 16);
  pctx.scale(1.7, 1.7);
  drawHero(pctx, 0, 0, 1, 0, 1, game.character, game.costume, game.t);
  pctx.restore();
}

function goToStart() {
  game.phase = 'start';
  Audio.startMusic('menu');
  cosIndex = Math.max(0, game.unlocked.indexOf(game.costume));
  updateSelectionUI();
  hideAllOverlays();
  showOverlay('overlay-start');
}

/* ---------- info sub-screens ---------- */
function openScores() {
  const order = [['adventure', 'Adventure'], ['endless', 'Endless']];
  const diffs = [['easy', 'Easy'], ['medium', 'Medium'], ['brave', 'Brave']];
  let html = '';
  for (const [m, mLabel] of order) {
    html += '<div class="score-group"><div class="score-mode">' + mLabel + '</div>';
    for (const [dk, dLabel] of diffs) {
      const v = game.highScores[m + '_' + dk] || 0;
      html += '<div class="score-item"><span>' + dLabel + '</span><span>' + v + '</span></div>';
    }
    html += '</div>';
  }
  document.getElementById('scores-list').innerHTML = html;
  hideAllOverlays(); showOverlay('overlay-scores');
}
function openCollection() {
  let html = '<p class="big-count">🐉 ' + game.lifetimeDragons + '</p><p class="muted">dragons collected (all time)</p><div class="badges">';
  for (const m of DRAGON_MILESTONES) {
    const got = game.lifetimeDragons >= m;
    html += '<div class="badge ' + (got ? 'got' : '') + '">' + (got ? '⭐' : '🔒') + '<span>' + m + '</span></div>';
  }
  html += '</div><p class="muted">Costumes unlocked: ' + game.unlocked.length + ' / ' + COSTUME_ORDER.length + '</p>';
  document.getElementById('collection-body').innerHTML = html;
  hideAllOverlays(); showOverlay('overlay-collection');
}

function wireUI() {
  // selection
  document.getElementById('char-prev').addEventListener('click', () => cycleCharacter(-1));
  document.getElementById('char-next').addEventListener('click', () => cycleCharacter(1));
  document.getElementById('cos-prev').addEventListener('click', () => cycleCostume(-1));
  document.getElementById('cos-next').addEventListener('click', () => cycleCostume(1));

  // difficulty
  document.querySelectorAll('.diff').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.diff').forEach((x) => x.classList.remove('selected'));
      b.classList.add('selected');
      game.diffName = b.dataset.diff;
      Audio.click();
    });
  });

  // play modes
  document.getElementById('btn-adventure').addEventListener('click', () => { Audio.resume(); Audio.click(); startGame('adventure', game.diffName); });
  document.getElementById('btn-endless').addEventListener('click', () => { Audio.resume(); Audio.click(); startGame('endless', game.diffName); });

  // menu sub-screens
  document.getElementById('btn-scores').addEventListener('click', () => { Audio.click(); openScores(); });
  document.getElementById('btn-collection').addEventListener('click', () => { Audio.click(); openCollection(); });
  document.getElementById('btn-howto').addEventListener('click', () => { Audio.click(); hideAllOverlays(); showOverlay('overlay-howto'); });
  document.getElementById('btn-scores-back').addEventListener('click', () => { Audio.click(); goToStart(); });
  document.getElementById('btn-coll-back').addEventListener('click', () => { Audio.click(); goToStart(); });
  document.getElementById('btn-howto-back').addEventListener('click', () => { Audio.click(); goToStart(); });

  // level complete / victory
  document.getElementById('btn-continue').addEventListener('click', () => { Audio.click(); continueLevel(); });
  document.getElementById('btn-vic-again').addEventListener('click', () => { Audio.click(); startGame('adventure', game.diffName); });
  document.getElementById('btn-vic-menu').addEventListener('click', () => { Audio.click(); goToStart(); });

  // game over
  document.getElementById('btn-again').addEventListener('click', () => { Audio.click(); startGame(game.mode, game.diffName); });
  document.getElementById('btn-menu').addEventListener('click', () => { Audio.click(); goToStart(); });

  // pause / system
  document.getElementById('btn-resume').addEventListener('click', () => { Audio.click(); togglePause(); });
  document.getElementById('btn-restart-pause').addEventListener('click', () => { Audio.click(); startGame(game.mode, game.diffName); });
  document.getElementById('btn-menu-pause').addEventListener('click', () => { Audio.click(); goToStart(); });
  document.getElementById('btn-pause').addEventListener('click', () => { Audio.click(); togglePause(); });
  document.getElementById('btn-mute').addEventListener('click', () => { toggleMute(); });
}

function init() {
  loadSave();
  document.getElementById('btn-mute').textContent = game.muted ? '🔇' : '🔊';
  bindKeyboard();
  bindTouchControls();
  wireUI();
  initSelection();
  // highlight saved difficulty
  document.querySelectorAll('.diff').forEach((x) => x.classList.toggle('selected', x.dataset.diff === game.diffName));
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();
  makeClouds();
  showOverlay('overlay-start');
  requestAnimationFrame(frame);
}

init();
