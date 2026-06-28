/* ============================================================================
 * The Dragon World — game.js
 * Stage 1: core playable loop (castle, hero, dragons, fire, collect/collide,
 * hearts, score). Menus/modes, costumes, PWA come in later stages.
 *
 * Sections:  CONFIG · STATE · AUDIO · INPUT · ART · ENTITIES · UPDATE ·
 *            RENDER · HUD · LOOP · UI WIRING
 * Coordinate system is a fixed 1280x720 logical canvas, scaled to fit.
 * ==========================================================================*/

'use strict';

/* ============================== CONFIG ================================== */

const LOGICAL_W = 1280;
const LOGICAL_H = 720;

const GROUND_Y = LOGICAL_H - 150;   // top of the castle rampart = hero's feet
const WALL_LEFT = 120;              // hero movement bounds (center x)
const WALL_RIGHT = LOGICAL_W - 120;

// Dragons fly in this vertical band (center y), reachable by a jump.
const DRAGON_BAND_TOP = 230;
const DRAGON_BAND_BOTTOM = 400;

// Per-difficulty tuning. (Easy is deliberately forgiving.)
const DIFFICULTY = {
  easy: {
    hearts: 5, maxDragons: 2, maxFireballs: 2,
    dragonSpeed: 130, spawnInterval: 1.4,
    fireInterval: [2.6, 4.2], firePerBreath: 1,
    fireballSpeed: 150, fireballGravity: 120,
    jumpV: 1050, gravity: 2300, moveSpeed: 430,
    collectPad: 28, hitScale: 0.72, shake: false,
  },
  medium: {
    hearts: 4, maxDragons: 3, maxFireballs: 4,
    dragonSpeed: 185, spawnInterval: 1.1,
    fireInterval: [1.8, 3.2], firePerBreath: 1,
    fireballSpeed: 200, fireballGravity: 180,
    jumpV: 1000, gravity: 2500, moveSpeed: 480,
    collectPad: 16, hitScale: 0.82, shake: true,
  },
  brave: {
    hearts: 3, maxDragons: 5, maxFireballs: 6,
    dragonSpeed: 250, spawnInterval: 0.8,
    fireInterval: [1.2, 2.4], firePerBreath: 2,
    fireballSpeed: 260, fireballGravity: 240,
    jumpV: 980, gravity: 2650, moveSpeed: 520,
    collectPad: 6, hitScale: 0.9, shake: true,
  },
};

const PLAYER_W = 46;
const PLAYER_H = 64;
const PLAYER_R = 24;          // collision radius
const DRAGON_R = 36;
const FIREBALL_R = 16;
const INVULN_TIME = 1.5;      // seconds
const COMBO_WINDOW = 2.0;     // seconds

// Default hero look for Stage 1 (character select arrives in Stage 2).
const HERO_PALETTE = {
  tunic: '#3a6ea5', trim: '#ffd23f', skin: '#f2c79b',
  hat: '#c0392b', cape: '#9b59b6', boots: '#5b3a1a',
};

/* ============================== STATE ================================== */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let viewScaleX = 1, viewScaleY = 1; // logical -> backing store

const game = {
  phase: 'start',          // start | playing | paused | over
  diff: DIFFICULTY.medium,
  diffName: 'medium',
  player: null,
  dragons: [],
  fireballs: [],
  particles: [],
  floats: [],
  clouds: [],
  spawnTimer: 0,
  nextDragonSide: 'left',
  score: 0,
  dragonsCollected: 0,
  comboStreak: 0,
  comboTimer: 0,
  hearts: 0,
  shake: 0,                 // current screen-shake magnitude
  t: 0,                     // elapsed gameplay time (s)
  muted: false,
};

/* ============================== AUDIO ================================== */
/* Procedural Web Audio — no asset files, works offline. */

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
  function tone(freq, dur, type = 'square', vol = 0.18, slideTo = null) {
    if (game.muted) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  return {
    resume: ensure,
    jump() { tone(420, 0.16, 'square', 0.16, 760); },
    collect(streak) { const base = 660 + Math.min(streak, 8) * 60; tone(base, 0.12, 'triangle', 0.2, base * 1.5); },
    hit() { tone(180, 0.32, 'sawtooth', 0.22, 70); },
    click() { tone(520, 0.07, 'square', 0.12); },
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
        input.jumpHeld = true;
        e.preventDefault();
        break;
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
  c.save();
  c.translate(x, y);
  c.scale(s / 24, s / 24);
  c.beginPath();
  c.moveTo(0, 7);
  c.bezierCurveTo(-2, 2, -12, 0, -12, -8);
  c.bezierCurveTo(-12, -15, -4, -16, 0, -9);
  c.bezierCurveTo(4, -16, 12, -15, 12, -8);
  c.bezierCurveTo(12, 0, 2, 2, 0, 7);
  c.closePath();
  if (filled) {
    c.fillStyle = '#ff5a5f'; c.fill();
    c.lineWidth = 2; c.strokeStyle = '#c0303a'; c.stroke();
  } else {
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.55)'; c.stroke();
  }
  c.restore();
}

function drawStar(c, x, y, r, color) {
  c.save();
  c.translate(x, y);
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    c.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
  }
  c.closePath();
  c.fillStyle = color;
  c.fill();
  c.restore();
}

// The hero: a little vector knight/prince. p = palette, squash for jump anim.
function drawHero(c, x, feetY, facing, squash, alpha) {
  const p = HERO_PALETTE;
  c.save();
  c.globalAlpha = alpha;
  // shadow
  c.globalAlpha = alpha * 0.25;
  c.fillStyle = '#000';
  c.beginPath();
  c.ellipse(x, feetY + 2, PLAYER_W * 0.5, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = alpha;

  c.translate(x, feetY);
  const sx = (1 + squash * 0.35) * (facing < 0 ? -1 : 1);
  const sy = (1 - squash * 0.35);
  c.scale(sx, sy);

  const w = PLAYER_W, h = PLAYER_H;
  // cape
  c.fillStyle = p.cape;
  c.beginPath();
  c.moveTo(-w * 0.22, -h * 0.78);
  c.quadraticCurveTo(-w * 0.62, -h * 0.4, -w * 0.34, -h * 0.04);
  c.lineTo(-w * 0.06, -h * 0.1);
  c.lineTo(-w * 0.06, -h * 0.78);
  c.closePath();
  c.fill();
  // legs
  c.fillStyle = p.boots;
  roundRect(c, -w * 0.28, -h * 0.26, w * 0.22, h * 0.26, 5); c.fill();
  roundRect(c, w * 0.06, -h * 0.26, w * 0.22, h * 0.26, 5); c.fill();
  // body / tunic
  c.fillStyle = p.tunic;
  roundRect(c, -w * 0.34, -h * 0.66, w * 0.68, h * 0.46, 10); c.fill();
  // belt trim
  c.fillStyle = p.trim;
  roundRect(c, -w * 0.34, -h * 0.34, w * 0.68, h * 0.07, 3); c.fill();
  // arm (front)
  c.fillStyle = p.tunic;
  roundRect(c, w * 0.18, -h * 0.6, w * 0.16, h * 0.3, 6); c.fill();
  // shield
  c.fillStyle = p.trim;
  c.beginPath();
  c.ellipse(w * 0.4, -h * 0.45, w * 0.16, h * 0.18, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#b8860b'; c.lineWidth = 2; c.stroke();
  // head
  c.fillStyle = p.skin;
  c.beginPath();
  c.arc(0, -h * 0.78, w * 0.24, 0, Math.PI * 2);
  c.fill();
  // hat / helmet
  c.fillStyle = p.hat;
  c.beginPath();
  c.arc(0, -h * 0.82, w * 0.26, Math.PI, 0);
  c.fill();
  roundRect(c, -w * 0.28, -h * 0.84, w * 0.56, h * 0.06, 3); c.fill();
  // little plume
  c.fillStyle = p.trim;
  c.beginPath();
  c.ellipse(w * 0.02, -h * 1.02, w * 0.06, h * 0.1, 0.4, 0, Math.PI * 2);
  c.fill();
  // eyes
  c.fillStyle = '#23314a';
  c.beginPath(); c.arc(w * 0.08, -h * 0.78, 2.4, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(-w * 0.06, -h * 0.78, 2.4, 0, Math.PI * 2); c.fill();
  // smile
  c.strokeStyle = '#a85b3a'; c.lineWidth = 2;
  c.beginPath(); c.arc(0, -h * 0.72, 5, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();

  c.restore();
}

// A friendly dragon. dir +1 faces right.
function drawDragon(c, d) {
  const x = d.x, y = d.drawY, s = d.scale, dir = d.dir;
  const flap = Math.sin(d.wingPhase) * 0.5;
  c.save();
  c.translate(x, y);
  c.scale(dir * s, s);

  // tail
  c.strokeStyle = d.body; c.lineWidth = 10; c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-30, 0);
  c.quadraticCurveTo(-60, -6, -72, 10);
  c.stroke();
  c.fillStyle = d.body;
  c.beginPath();
  c.moveTo(-72, 10); c.lineTo(-86, 2); c.lineTo(-82, 18); c.closePath(); c.fill();

  // far wing
  c.fillStyle = d.wing;
  c.save(); c.rotate(-0.5 - flap);
  c.beginPath();
  c.moveTo(-6, -6);
  c.quadraticCurveTo(-30, -46, -56, -30);
  c.quadraticCurveTo(-34, -16, -6, -6);
  c.closePath(); c.fill();
  c.restore();

  // body
  c.fillStyle = d.body;
  c.beginPath();
  c.ellipse(0, 0, 34, 24, 0, 0, Math.PI * 2);
  c.fill();
  // belly
  c.fillStyle = d.belly;
  c.beginPath();
  c.ellipse(2, 8, 22, 13, 0, 0, Math.PI * 2);
  c.fill();

  // near wing
  c.fillStyle = d.wing2;
  c.save(); c.rotate(-0.35 + flap);
  c.beginPath();
  c.moveTo(0, -8);
  c.quadraticCurveTo(-22, -54, 18, -42);
  c.quadraticCurveTo(14, -20, 0, -8);
  c.closePath(); c.fill();
  c.restore();

  // head
  c.fillStyle = d.body;
  c.beginPath();
  c.ellipse(34, -8, 18, 15, 0, 0, Math.PI * 2);
  c.fill();
  // snout
  c.beginPath();
  c.ellipse(50, -4, 9, 7, 0, 0, Math.PI * 2);
  c.fill();
  // horns
  c.fillStyle = '#fff4d6';
  c.beginPath(); c.moveTo(28, -20); c.lineTo(24, -34); c.lineTo(34, -22); c.closePath(); c.fill();
  // eye
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(38, -12, 5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#1c2536';
  c.beginPath(); c.arc(39.5, -12, 2.4, 0, Math.PI * 2); c.fill();
  // nostril
  c.fillStyle = '#1c2536';
  c.beginPath(); c.arc(54, -4, 1.6, 0, Math.PI * 2); c.fill();
  // smile
  c.strokeStyle = '#1c2536'; c.lineWidth = 1.6;
  c.beginPath(); c.arc(46, 0, 5, 0.1 * Math.PI, 0.6 * Math.PI); c.stroke();

  // about-to-breathe glow
  if (d.fireCooldown < 0.35) {
    c.fillStyle = 'rgba(255,140,40,' + (0.5 * (1 - d.fireCooldown / 0.35)) + ')';
    c.beginPath(); c.arc(58, -2, 8, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

function drawFireball(c, f) {
  c.save();
  c.translate(f.x, f.y);
  const r = f.r;
  const g = c.createRadialGradient(0, 0, 2, 0, 0, r * 1.6);
  g.addColorStop(0, '#fff3b0');
  g.addColorStop(0.4, '#ffae33');
  g.addColorStop(1, 'rgba(255,60,20,0)');
  c.fillStyle = g;
  c.beginPath(); c.arc(0, 0, r * 1.6, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ff5a1f';
  c.beginPath(); c.arc(0, 0, r * 0.72, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffd24a';
  c.beginPath(); c.arc(0, -2, r * 0.4, 0, Math.PI * 2); c.fill();
  c.restore();
}

/* ============================== ENTITIES =============================== */

function makePlayer() {
  return { x: LOGICAL_W / 2, y: GROUND_Y, vx: 0, vy: 0, onGround: true,
           facing: 1, squash: 0, invuln: 0 };
}

function rand(a, b) { return a + Math.random() * (b - a); }

function spawnDragon() {
  const side = game.nextDragonSide;
  game.nextDragonSide = side === 'left' ? 'right' : 'left';
  const dir = side === 'left' ? 1 : -1;
  const baseY = rand(DRAGON_BAND_TOP, DRAGON_BAND_BOTTOM);
  game.dragons.push({
    x: side === 'left' ? -80 : LOGICAL_W + 80,
    baseY, drawY: baseY, dir,
    speed: game.diff.dragonSpeed * rand(0.85, 1.15),
    scale: rand(0.92, 1.12),
    bobAmp: rand(16, 32), bobFreq: rand(1.5, 2.6), bobPhase: rand(0, 6.28),
    wingPhase: rand(0, 6.28),
    fireCooldown: rand(game.diff.fireInterval[0], game.diff.fireInterval[1]),
    body: pick(['#5fbf5f', '#7a6ff0', '#ef6db0', '#48b6d6']),
  });
  const d = game.dragons[game.dragons.length - 1];
  d.belly = '#fdf0c8';
  d.wing = shade(d.body, -18);
  d.wing2 = shade(d.body, 14);
}

function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function breatheFire(d) {
  const n = game.diff.firePerBreath;
  for (let i = 0; i < n; i++) {
    if (game.fireballs.length >= game.diff.maxFireballs) break;
    game.fireballs.push({
      x: d.x + d.dir * 52 * d.scale + rand(-6, 6),
      y: d.drawY - 2,
      vx: rand(-40, 40) + d.dir * 20,
      vy: game.diff.fireballSpeed * rand(0.85, 1.1),
      r: FIREBALL_R,
    });
  }
}

function addSparkles(x, y, color) {
  for (let i = 0; i < 14; i++) {
    const a = rand(0, 6.28), sp = rand(60, 240);
    game.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
      life: rand(0.4, 0.8), maxLife: 0.8, size: rand(3, 7),
      color, kind: 'spark',
    });
  }
}

function addEmber(x, y) {
  game.particles.push({
    x, y, vx: rand(-20, 20), vy: rand(-10, 30),
    life: 0.4, maxLife: 0.4, size: rand(2, 4), color: '#ff8a3d', kind: 'ember',
  });
}

function addFloat(x, y, text) {
  game.floats.push({ x, y, text, life: 1.0 });
}

function makeClouds() {
  game.clouds = [];
  for (let i = 0; i < 5; i++) {
    game.clouds.push({
      x: rand(0, LOGICAL_W), y: rand(40, 200),
      s: rand(0.7, 1.4), v: rand(6, 16),
    });
  }
}

/* ============================== UPDATE ================================= */

function startGame(diffName) {
  game.diffName = diffName;
  game.diff = DIFFICULTY[diffName];
  game.player = makePlayer();
  game.dragons = [];
  game.fireballs = [];
  game.particles = [];
  game.floats = [];
  game.spawnTimer = 0.4;
  game.nextDragonSide = 'left';
  game.score = 0;
  game.dragonsCollected = 0;
  game.comboStreak = 0;
  game.comboTimer = 0;
  game.hearts = game.diff.hearts;
  game.shake = 0;
  game.t = 0;
  makeClouds();
  game.phase = 'playing';
  hideAllOverlays();
}

function update(dt) {
  game.t += dt;

  // clouds drift regardless of phase
  for (const cl of game.clouds) {
    cl.x += cl.v * dt;
    if (cl.x > LOGICAL_W + 80) cl.x = -80;
  }

  if (game.phase !== 'playing') return;

  const d = game.diff;
  const pl = game.player;

  // ---- player horizontal ----
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  pl.vx = dir * d.moveSpeed;
  pl.x += pl.vx * dt;
  if (pl.x < WALL_LEFT) pl.x = WALL_LEFT;
  if (pl.x > WALL_RIGHT) pl.x = WALL_RIGHT;
  if (dir !== 0) pl.facing = dir;

  // ---- jump ----
  if (input.jumpRequested && pl.onGround) {
    pl.vy = -d.jumpV;
    pl.onGround = false;
    pl.squash = -0.4;            // stretch up
    Audio.jump();
  }
  input.jumpRequested = false;

  // ---- player vertical ----
  pl.vy += d.gravity * dt;
  pl.y += pl.vy * dt;
  if (pl.y >= GROUND_Y) {
    if (!pl.onGround) pl.squash = 0.5; // squash on landing
    pl.y = GROUND_Y; pl.vy = 0; pl.onGround = true;
  }
  pl.squash += (0 - pl.squash) * Math.min(1, dt * 12); // ease back to neutral

  if (pl.invuln > 0) pl.invuln -= dt;
  if (game.comboTimer > 0) game.comboTimer -= dt; else game.comboStreak = 0;

  // ---- dragons ----
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0 && game.dragons.length < d.maxDragons) {
    spawnDragon();
    game.spawnTimer = d.spawnInterval;
  }
  for (let i = game.dragons.length - 1; i >= 0; i--) {
    const dr = game.dragons[i];
    dr.x += dr.dir * dr.speed * dt;
    dr.drawY = dr.baseY + Math.sin(game.t * dr.bobFreq + dr.bobPhase) * dr.bobAmp;
    dr.wingPhase += dt * 9;
    dr.fireCooldown -= dt;
    if (dr.fireCooldown <= 0 && dr.x > 40 && dr.x < LOGICAL_W - 40) {
      breatheFire(dr);
      dr.fireCooldown = rand(d.fireInterval[0], d.fireInterval[1]);
    }
    if (dr.x < -120 || dr.x > LOGICAL_W + 120) game.dragons.splice(i, 1);
  }

  // ---- fireballs ----
  for (let i = game.fireballs.length - 1; i >= 0; i--) {
    const f = game.fireballs[i];
    f.vy += d.fireballGravity * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (Math.random() < 0.5) addEmber(f.x, f.y);
    if (f.y > LOGICAL_H + 40) game.fireballs.splice(i, 1);
  }

  // ---- particles & floats ----
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.life -= dt;
    p.vy += 300 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.life <= 0) game.particles.splice(i, 1);
  }
  for (let i = game.floats.length - 1; i >= 0; i--) {
    const fl = game.floats[i];
    fl.life -= dt; fl.y -= 40 * dt;
    if (fl.life <= 0) game.floats.splice(i, 1);
  }

  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 28);

  // ---- collisions ----
  const pcx = pl.x, pcy = pl.y - PLAYER_H / 2;

  // dragons -> collect
  for (let i = game.dragons.length - 1; i >= 0; i--) {
    const dr = game.dragons[i];
    const dx = pcx - dr.x, dy = pcy - dr.drawY;
    const reach = PLAYER_R + DRAGON_R * dr.scale + d.collectPad;
    if (dx * dx + dy * dy <= reach * reach) {
      collectDragon(dr);
      game.dragons.splice(i, 1);
    }
  }

  // fireballs -> damage
  if (pl.invuln <= 0) {
    for (let i = game.fireballs.length - 1; i >= 0; i--) {
      const f = game.fireballs[i];
      const dx = pcx - f.x, dy = pcy - f.y;
      const reach = (PLAYER_R + f.r) * d.hitScale;
      if (dx * dx + dy * dy <= reach * reach) {
        game.fireballs.splice(i, 1);
        hitPlayer();
        break;
      }
    }
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
}

function hitPlayer() {
  game.hearts--;
  game.player.invuln = INVULN_TIME;
  if (game.diff.shake) game.shake = 12;
  Audio.hit();
  if (game.hearts <= 0) endGame();
}

function endGame() {
  game.phase = 'over';
  document.getElementById('final-score').textContent = game.score;
  document.getElementById('final-dragons').textContent = game.dragonsCollected;
  showOverlay('overlay-over');
}

/* ============================== RENDER ================================= */

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, '#6db8f0');
  g.addColorStop(1, '#bfe7ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  // sun
  ctx.save();
  ctx.fillStyle = 'rgba(255, 236, 150, 0.9)';
  ctx.beginPath(); ctx.arc(1130, 120, 56, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255, 240, 170, 0.35)';
  ctx.beginPath(); ctx.arc(1130, 120, 84, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // clouds
  for (const cl of game.clouds) drawCloud(cl);
}

function drawCloud(cl) {
  ctx.save();
  ctx.translate(cl.x, cl.y);
  ctx.scale(cl.s, cl.s);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.arc(24, -8, 28, 0, Math.PI * 2);
  ctx.arc(52, 0, 22, 0, Math.PI * 2);
  ctx.arc(26, 12, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCastle() {
  const top = GROUND_Y;
  // wall body
  const g = ctx.createLinearGradient(0, top, 0, LOGICAL_H);
  g.addColorStop(0, '#b6a892');
  g.addColorStop(1, '#8a7a64');
  ctx.fillStyle = g;
  ctx.fillRect(0, top, LOGICAL_W, LOGICAL_H - top);

  // crenellations (merlons) along the rampart, behind the hero
  ctx.fillStyle = '#a2937c';
  const mw = 54, gap = 34, mh = 26;
  for (let x = 10; x < LOGICAL_W; x += mw + gap) {
    ctx.fillRect(x, top - mh, mw, mh);
  }
  // walkway line
  ctx.fillStyle = '#7a6c58';
  ctx.fillRect(0, top, LOGICAL_W, 6);

  // brick lines
  ctx.strokeStyle = 'rgba(90,76,58,0.35)';
  ctx.lineWidth = 2;
  for (let y = top + 40; y < LOGICAL_H; y += 38) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LOGICAL_W, y); ctx.stroke();
  }

  // towers
  drawTower(40);
  drawTower(LOGICAL_W - 40 - 96);

  // gate
  ctx.fillStyle = '#5b4a36';
  const gw = 120, gx = LOGICAL_W / 2 - gw / 2, gy = LOGICAL_H - 96;
  ctx.beginPath();
  ctx.moveTo(gx, LOGICAL_H);
  ctx.lineTo(gx, gy);
  ctx.arc(LOGICAL_W / 2, gy, gw / 2, Math.PI, 0);
  ctx.lineTo(gx + gw, LOGICAL_H);
  ctx.closePath();
  ctx.fill();
}

function drawTower(x) {
  const top = GROUND_Y - 60;
  ctx.fillStyle = '#9c8d76';
  ctx.fillRect(x, top, 96, LOGICAL_H - top);
  ctx.fillStyle = '#8a7b64';
  for (let mx = x; mx < x + 96; mx += 30) ctx.fillRect(mx, top - 18, 18, 18);
  // window
  ctx.fillStyle = '#3a2f22';
  ctx.beginPath();
  ctx.arc(x + 48, top + 60, 14, Math.PI, 0);
  ctx.fillRect(x + 34, top + 60, 28, 30);
  ctx.fill();
  // flag
  ctx.strokeStyle = '#5b4a36'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + 48, top - 18); ctx.lineTo(x + 48, top - 64); ctx.stroke();
  ctx.fillStyle = '#e8443b';
  const wave = Math.sin(game.t * 4) * 4;
  ctx.beginPath();
  ctx.moveTo(x + 48, top - 64);
  ctx.lineTo(x + 84, top - 56 + wave);
  ctx.lineTo(x + 48, top - 48);
  ctx.closePath(); ctx.fill();
}

function drawParticles() {
  for (const p of game.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    if (p.kind === 'spark') {
      drawStar(ctx, p.x, p.y, p.size, p.color);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawFloats() {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px system-ui, sans-serif';
  for (const fl of game.floats) {
    ctx.globalAlpha = Math.max(0, fl.life);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#ff8a1f'; ctx.lineWidth = 5;
    ctx.strokeText(fl.text, fl.x, fl.y);
    ctx.fillText(fl.text, fl.x, fl.y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function render() {
  // backing-store transform with shake
  let ox = 0, oy = 0;
  if (game.shake > 0) {
    ox = (Math.random() - 0.5) * game.shake;
    oy = (Math.random() - 0.5) * game.shake;
  }
  ctx.setTransform(viewScaleX, 0, 0, viewScaleY, ox * viewScaleX, oy * viewScaleY);
  ctx.clearRect(-20, -20, LOGICAL_W + 40, LOGICAL_H + 40);

  drawSky();
  for (const dr of game.dragons) drawDragon(ctx, dr);
  drawCastle();

  if (game.player) {
    const pl = game.player;
    const flashing = pl.invuln > 0 && Math.floor(game.t * 16) % 2 === 0;
    drawHero(ctx, pl.x, pl.y, pl.facing, pl.squash, flashing ? 0.35 : 1);
  }

  for (const f of game.fireballs) drawFireball(ctx, f);
  drawParticles();
  drawFloats();
  drawHUD();
}

/* ============================== HUD =================================== */

function drawHUD() {
  if (game.phase === 'start') return;
  // hearts
  for (let i = 0; i < game.diff.hearts; i++) {
    drawHeart(ctx, 40 + i * 38, 44, 30, i < game.hearts);
  }
  // score
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(40,28,70,0.7)'; ctx.lineWidth = 6;
  const s = String(game.score);
  ctx.strokeText(s, LOGICAL_W / 2, 56);
  ctx.fillText(s, LOGICAL_W / 2, 56);
  // combo
  if (game.comboStreak > 0 && game.comboTimer > 0) {
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('Combo x' + (game.comboStreak + 1) + '!', LOGICAL_W / 2, 92);
  }
  ctx.restore();
}

/* ============================== LOOP ================================== */

let lastTime = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

/* ============================== UI WIRING ============================= */

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
    if (game.phase === 'playing') game.phase = 'paused';
  } else {
    rotate.classList.add('hidden');
  }
}

function showOverlay(id) {
  document.getElementById(id).classList.remove('hidden');
}
function hideAllOverlays() {
  for (const id of ['overlay-start', 'overlay-pause', 'overlay-over', 'overlay-rotate']) {
    document.getElementById(id).classList.add('hidden');
  }
}

function togglePause() {
  if (game.phase === 'playing') {
    game.phase = 'paused';
    showOverlay('overlay-pause');
  } else if (game.phase === 'paused') {
    game.phase = 'playing';
    document.getElementById('overlay-pause').classList.add('hidden');
  }
}

function toggleMute() {
  game.muted = !game.muted;
  try { localStorage.setItem('dw_muted', game.muted ? '1' : '0'); } catch (e) {}
  document.getElementById('btn-mute').textContent = game.muted ? '🔇' : '🔊';
}

function wireUI() {
  // difficulty selector
  document.querySelectorAll('.diff').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.diff').forEach((x) => x.classList.remove('selected'));
      b.classList.add('selected');
      game.diffName = b.dataset.diff;
      Audio.click();
    });
  });
  document.getElementById('btn-play').addEventListener('click', () => {
    Audio.resume(); Audio.click(); startGame(game.diffName);
  });
  document.getElementById('btn-again').addEventListener('click', () => {
    Audio.click(); startGame(game.diffName);
  });
  document.getElementById('btn-resume').addEventListener('click', () => { Audio.click(); togglePause(); });
  document.getElementById('btn-restart-pause').addEventListener('click', () => { Audio.click(); startGame(game.diffName); });
  document.getElementById('btn-pause').addEventListener('click', () => { Audio.click(); togglePause(); });
  document.getElementById('btn-mute').addEventListener('click', () => { toggleMute(); });
}

function init() {
  try { game.muted = localStorage.getItem('dw_muted') === '1'; } catch (e) {}
  document.getElementById('btn-mute').textContent = game.muted ? '🔇' : '🔊';
  bindKeyboard();
  bindTouchControls();
  wireUI();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();
  makeClouds();
  showOverlay('overlay-start');
  requestAnimationFrame(frame);
}

init();
