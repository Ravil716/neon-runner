// script.js — полный файл с доработками: магниты (🧲), динамическое поле, x2 (физическое дублирование ряда),
// улучшённые вирусы, звуковой фон power-up, и обновлённая лава.
// Важно: вставляйте этот файл как есть, заменяя старый script.js.

/* ========= CORE & DOM ========= */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("scoreValue");
const coinEl = document.getElementById("coinValue");
const finalScoreEl = document.getElementById("finalScoreValue");
const roundCoinsEl = document.getElementById("roundCoinsValue");
const totalCoinsEl = document.getElementById("totalCoinsValue");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const restartButton = document.getElementById("restartButton");
const tapHint = document.getElementById("tapHint");

let width = 0;
let height = 0;

/* ========= GAME STATE ========= */
let player;
let obstacles;
let particles;
let coins;
let coinParticles;
let baseSpeed;
let speedMultiplier;
let maxSpeedMultiplier;
let elapsedRunTime;
let gravity;
let jumpVelocity;
let isJumpingAllowed;
let isGameOver;
let hasStarted;
let lastTime;
let obstacleSpawnTimer;
let obstacleSpawnInterval;
let score;
let roundCoins;
let totalCoins;
let coinSpawnCooldown;
let coinGroupPlan;
let rafId = null;

let audioCtx = null;
let audioEnabled = true;
const STORAGE_TOTAL_COINS_KEY = "neonRunner_totalCoins";

/* Lava animation timer (for moving gradient) */
let lavaTime = 0;

/* ------------------ NEW: powerups & viruses ------------------ */
/* powerUps: objects { type: 'magnet'|'double', x, y, r } */
/* viruses: objects { x, y, baseY, r, phase, amp, speed } */
let powerUps = [];
let viruses = [];
let magnetTimer = 0; // seconds
let doubleTimer = 0; // seconds

// spawn/balance tuning (rare)
const POWERUP_SPAWN_CHANCE = 0.06; // chance per obstacle spawn to spawn magnet
const DOUBLE_SPAWN_CHANCE = 0.04; // chance per obstacle spawn to spawn double
const VIRUS_SPAWN_CHANCE = 0.45; // chance per obstacle spawn to spawn a virus
const MAX_VIRUSES = 2;
const MAGNET_DURATION = 7; // seconds
const DOUBLE_DURATION = 7; // seconds

/* ========= AUDIO: coin + subtle power hum ========= */
function ensureAudio() {
  if (!audioEnabled) return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      audioEnabled = false;
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playCoinSound() {
  const ac = ensureAudio();
  if (!ac) return;

  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(1320, now + 0.06);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  osc.connect(gain);
  gain.connect(ac.destination);

  osc.start(now);
  osc.stop(now + 0.1);
}

/* Power-up hum (subtle background tone while any power-up active) */
let powerHum = null;
function startPowerHum() {
  const ac = ensureAudio();
  if (!ac) return;
  if (powerHum) return;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const mod = ac.createOscillator();
  const modGain = ac.createGain();

  // carrier
  osc.type = "sine";
  osc.frequency.value = 160; // low futuristic hum

  // slow tremolo to avoid monotony
  mod.type = "sine";
  mod.frequency.value = 0.9;
  modGain.gain.value = 0.12;
  modGain.gain.setValueAtTime(0.12, ac.currentTime);

  mod.connect(modGain);
  modGain.connect(gain.gain);

  gain.gain.value = 0.0001;
  gain.gain.setValueAtTime(0.0001, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.03, ac.currentTime + 0.35);

  osc.connect(gain);
  gain.connect(ac.destination);

  osc.start();
  mod.start();

  powerHum = { osc, gain, mod, modGain };
}

function stopPowerHum() {
  if (!powerHum || !audioCtx) return;
  const ac = audioCtx;
  try {
    powerHum.gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.3);
    powerHum.mod.stop(ac.currentTime + 0.32);
    powerHum.osc.stop(ac.currentTime + 0.34);
  } catch {}
  powerHum = null;
}

/* ========= UTILS ========= */
function getMaxJumpHeightPx() {
  const v = Math.abs(jumpVelocity);
  return (v * v) / (2 * gravity);
}
function getJumpFlightTimeSec() {
  const v = Math.abs(jumpVelocity);
  return (2 * v) / gravity;
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function loadTotalCoins() {
  const raw = localStorage.getItem(STORAGE_TOTAL_COINS_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
function saveTotalCoins() {
  localStorage.setItem(STORAGE_TOTAL_COINS_KEY, String(totalCoins));
}
function updateCoinUI() {
  if (coinEl) coinEl.textContent = String(totalCoins);
  if (roundCoinsEl) roundCoinsEl.textContent = String(roundCoins);
  if (totalCoinsEl) totalCoinsEl.textContent = String(totalCoins);
}

/* ========= CANVAS RESIZE & INIT ========= */
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  width = rect.width * dpr;
  height = rect.height * dpr;

  canvas.width = width;
  canvas.height = height;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function initGameState() {
  const baseUnit = Math.min(canvas.clientWidth, canvas.clientHeight || 400);
  const playerSize = baseUnit * 0.07; // ~7% of min dimension

  player = {
    x: canvas.clientWidth * 0.16,
    y: canvas.clientHeight * 0.5 - playerSize / 2,
    width: playerSize,
    height: playerSize,
    vy: 0,
    onGround: true,
    trail: [],
  };

  obstacles = [];
  particles = [];
  coins = [];
  coinParticles = [];

  powerUps = [];
  viruses = [];
  magnetTimer = 0;
  doubleTimer = 0;
  stopPowerHum();

  baseSpeed = canvas.clientWidth * 0.38 * 0.7; // px per second base
  speedMultiplier = 1;
  maxSpeedMultiplier = 2.1;
  elapsedRunTime = 0;

  gravity = canvas.clientHeight * 2.2;
  jumpVelocity = -canvas.clientHeight * 0.5;

  isJumpingAllowed = true;
  isGameOver = false;
  hasStarted = false;
  lastTime = performance.now();
  obstacleSpawnTimer = -2200;
  obstacleSpawnInterval = 1200;
  score = 0;
  roundCoins = 0;
  coinSpawnCooldown = 0;
  coinGroupPlan = null;
  if (typeof totalCoins !== "number") totalCoins = loadTotalCoins();

  scoreEl.textContent = "0";
  finalScoreEl.textContent = "0";
  updateCoinUI();

  gameOverOverlay.classList.add("hidden");
  tapHint.classList.remove("hidden");
}

/* ========= GAME CONTROL ========= */
function startGame() {
  if (hasStarted && !isGameOver) return;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  hasStarted = true;
  isGameOver = false;
  tapHint.classList.add("hidden");
  lastTime = performance.now();
  rafId = requestAnimationFrame(gameLoop);
}

function resetGame() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  initGameState();
  score = 0;
  scoreEl.textContent = "0";
  hasStarted = true;
  isGameOver = false;
  tapHint.classList.add("hidden");
  lastTime = performance.now();
  rafId = requestAnimationFrame(gameLoop);
}

/* ========= SPAWN: obstacles, coins, powerups, viruses ========= */
function spawnCoinAt(x, y, r, meta = {}) {
  if (coinOverlapsObstacle(x, y, r)) return false;

  coins.push({
    x,
    y,
    r,
    phase: Math.random() * Math.PI * 2,
    spin: (Math.random() < 0.5 ? -1 : 1) * (1.8 + Math.random() * 1.4),
    collected: false,
    meta,
  });
  return true;
}

function coinOverlapsObstacle(cx, cy, r) {
  for (const o of obstacles) {
    const pad = 6;
    const ox = o.x - pad;
    const oy = o.y - pad;
    const ow = o.width + pad * 2;
    const oh = o.height + pad * 2;

    const closestX = clamp(cx, ox, ox + ow);
    const closestY = clamp(cy, oy, oy + oh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

function spawnObstacle() {
  const baseUnit = Math.min(canvas.clientWidth, canvas.clientHeight || 400);
  const widthFactor = 0.06 + Math.random() * 0.02;
  const obstacleWidth = baseUnit * widthFactor;
  const groundY = canvas.clientHeight * 0.78;
  const h = canvas.clientHeight;

  const playerHeight = player ? player.height : baseUnit * 0.07;

  const minGap = playerHeight * 4;
  const maxGap = playerHeight * 4.6;
  const gapSize = clamp(
    minGap + Math.random() * (maxGap - minGap),
    minGap,
    maxGap
  );
  const halfGap = gapSize / 2;

  const topSafeMargin = playerHeight * 1.4;
  const bottomSafeMargin = playerHeight * 1.6;

  const minCenter = topSafeMargin + halfGap;
  const maxCenter = groundY - bottomSafeMargin - halfGap;
  const rawCenter = h * (0.3 + Math.random() * 0.4);
  const gapCenter = clamp(rawCenter, minCenter, maxCenter);

  const gapTop = gapCenter - halfGap;
  const gapBottom = gapCenter + halfGap;

  const topHeight = clamp(gapTop, h * 0.1, h * 0.5);
  const topObstacle = {
    x: canvas.clientWidth + obstacleWidth,
    y: 0,
    width: obstacleWidth,
    height: topHeight,
    type: "columnTop",
    hueOffset: Math.random() * 60,
  };

  const bottomHeight = Math.max(10, groundY - gapBottom);
  const bottomObstacle = {
    x: topObstacle.x,
    y: groundY - bottomHeight,
    width: obstacleWidth,
    height: bottomHeight,
    type: "columnBottom",
    hueOffset: Math.random() * 60,
  };

  obstacles.push(topObstacle, bottomObstacle);

  // Coins: primary row
  const coinCount = 3 + Math.floor(Math.random() * 3); // 3–5 coins
  const coinRadius = clamp(baseUnit * 0.018, 6, 12);
  const coinY = gapCenter;
  const startX =
    topObstacle.x + obstacleWidth + clamp(baseUnit * 0.12, 40, 72);
  const stepX = clamp(baseUnit * 0.085, 34, 64);

  for (let i = 0; i < coinCount; i++) {
    const cx = startX + i * stepX;
    spawnCoinAt(cx, coinY, coinRadius, { row: 1 });
  }

  // If double active at spawn-time, spawn second row just above primary
  if (doubleTimer > 0) {
    const secondYOffset = -Math.max(coinRadius * 1.6, playerHeight * 0.18);
    for (let i = 0; i < coinCount; i++) {
      const cx = startX + i * stepX;
      spawnCoinAt(cx, coinY + secondYOffset, coinRadius, { row: 2 });
    }
  }

  // ---- POWER UPS SPAWN ----
  if (Math.random() < POWERUP_SPAWN_CHANCE) {
    const puR = clamp(baseUnit * 0.038, 12, 22);
    const puX = topObstacle.x + obstacleWidth + clamp(baseUnit * 0.12, 40, 72);
    const puY = clamp(
      gapCenter + (Math.random() - 0.5) * playerHeight * 0.6,
      gapTop + puR,
      gapBottom - puR
    );
    powerUps.push({ type: "magnet", x: puX, y: puY, r: puR });
  }

  if (Math.random() < DOUBLE_SPAWN_CHANCE) {
    const puR = clamp(baseUnit * 0.04, 14, 26);
    const puX = topObstacle.x + obstacleWidth + clamp(baseUnit * 0.12, 40, 72) + 36;
    const puY = clamp(
      gapCenter + (Math.random() - 0.5) * playerHeight * 0.6,
      gapTop + puR,
      gapBottom - puR
    );
    powerUps.push({ type: "double", x: puX, y: puY, r: puR });
  }

  // ---- VIRUS SPAWN (always inside safe window, won't block passage) ----
  if (Math.random() < VIRUS_SPAWN_CHANCE) {
    if (viruses.length < MAX_VIRUSES) {
      const safeMargin = playerHeight * 1.2;
      const vR = clamp(baseUnit * (0.020 + Math.random() * 0.02), 10, 22);
      const vX = topObstacle.x + obstacleWidth + clamp(baseUnit * 0.14, 44, 84);
      // ensure placed away from edges of gap so it doesn't block
      const vY = clamp(
        gapCenter + (Math.random() - 0.5) * gapSize * 0.55,
        gapTop + safeMargin + vR,
        gapBottom - safeMargin - vR
      );
      viruses.push({
        x: vX,
        y: vY,
        baseY: vY,
        r: vR,
        phase: Math.random() * Math.PI * 2,
        amp: 8 + Math.random() * 22,
        speed: 1 + Math.random() * 1.6,
      });
    }
  }
}

/* ========= UPDATE ========= */
function update(delta) {
  if (!hasStarted || isGameOver) return;

  const dt = delta / 1000;

  // Update timers
  lavaTime += dt;
  magnetTimer = Math.max(0, magnetTimer - dt);
  doubleTimer = Math.max(0, doubleTimer - dt);

  // audio hum control
  if (magnetTimer > 0 || doubleTimer > 0) startPowerHum();
  else stopPowerHum();

  // Smooth ramp
  elapsedRunTime += dt;
  const t = Math.min(1, elapsedRunTime / 60);
  const smoothStep = t * t * (3 - 2 * t);
  speedMultiplier = 1 + smoothStep * (maxSpeedMultiplier - 1);
  const currentSpeed = baseSpeed * speedMultiplier;

  const groundY = canvas.clientHeight * 0.78;

  // Player physics
  player.vy += gravity * dt;
  player.y += player.vy * dt;
  player.onGround = false;

  // Trail
  player.trail.push({
    x: player.x + player.width / 2,
    y: player.y + player.height / 2,
    life: 1,
    vx: -currentSpeed * 0.35,
  });
  if (player.trail.length > 40) player.trail.shift();
  player.trail.forEach((p) => {
    p.x += (p.vx || 0) * dt;
    p.life -= dt * 1.8;
  });
  player.trail = player.trail.filter((p) => p.life > 0);

  // Spawn obstacles
  obstacleSpawnTimer += delta;
  if (obstacleSpawnTimer >= 0) {
    const minInterval = 900;
    const intervalDecrease = 200 * smoothStep;
    obstacleSpawnInterval = Math.max(minInterval, 1400 - intervalDecrease);

    const lastObstacle = obstacles[obstacles.length - 1];
    const flightTime = getJumpFlightTimeSec();
    const baseGapTime = flightTime + 0.2;
    let minGapPx = Math.max(260, currentSpeed * baseGapTime);

    if (obstacles.length >= 2) {
      const prev = obstacles[obstacles.length - 2];
      const lastGap = lastObstacle.x - (prev.x + prev.width);
      const tightGap = Math.max(220, currentSpeed * (flightTime + 0.08));
      if (lastGap < tightGap) minGapPx *= 1.35;
    }

    const canSpawnByDistance =
      !lastObstacle || lastObstacle.x < canvas.clientWidth - minGapPx;

    if (obstacleSpawnTimer >= obstacleSpawnInterval && canSpawnByDistance) {
      obstacleSpawnTimer = 0;
      spawnObstacle();
    }
  }

  // Update obstacles
  obstacles.forEach((o) => (o.x -= currentSpeed * dt));
  obstacles = obstacles.filter((o) => o.x + o.width > -50);

  // Coin group plan
  coinSpawnCooldown = Math.max(0, coinSpawnCooldown - dt);
  if (coinGroupPlan) {
    if (coinGroupPlan.countRemaining > 0) {
      const spawned = spawnCoinAt(
        coinGroupPlan.nextX,
        coinGroupPlan.y,
        coinGroupPlan.radius
      );
      coinGroupPlan.nextX += coinGroupPlan.stepX;
      coinGroupPlan.countRemaining -= spawned ? 1 : 0;
      if (!spawned) {
        coinGroupPlan.failures = (coinGroupPlan.failures || 0) + 1;
        if (coinGroupPlan.failures >= 6) coinGroupPlan = null;
      }
      if (coinGroupPlan && coinGroupPlan.countRemaining <= 0) coinGroupPlan = null;
    } else {
      coinGroupPlan = null;
    }
  }

  // Update coins (magnet attraction pulls both rows the same)
  coins.forEach((c) => {
    if (magnetTimer > 0) {
      const pxCenter = player.x + player.width / 2;
      const pyCenter = player.y + player.height / 2;
      const dx = pxCenter - c.x;
      const dy = pyCenter - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.0001;
      const magnetRadius = Math.max(160, player.width * 6);
      if (dist < magnetRadius) {
        const pull = (1 - dist / magnetRadius) * (900 + Math.random() * 180);
        c.x += (dx / dist) * pull * dt;
        c.y += (dy / dist) * pull * dt;
      } else {
        c.x -= currentSpeed * dt;
      }
    } else {
      c.x -= currentSpeed * dt;
    }
    c.phase += dt * c.spin;
  });
  coins = coins.filter((c) => c.x + c.r > -40 && !c.collected);

  // Coin particles
  coinParticles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  });
  coinParticles = coinParticles.filter((p) => p.life > 0);

  // Particles
  particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  });
  particles = particles.filter((p) => p.life > 0);

  // Score
  score += dt * 10 * speedMultiplier;
  scoreEl.textContent = Math.floor(score).toString();

  // Hitbox
  const hitPadding = Math.max(5, Math.min(10, player.width * 0.14));
  const px = player.x + hitPadding;
  const py = player.y + hitPadding;
  const pw = Math.max(1, player.width - hitPadding * 2);
  const ph = Math.max(1, player.height - hitPadding * 2);

  // Lava boundaries
  if (player.y <= 0 || player.y + player.height >= groundY) {
    triggerGameOver();
    return;
  }

  // Coin pickup
  for (const c of coins) {
    if (c.collected) continue;
    const closestX = clamp(c.x, px, px + pw);
    const closestY = clamp(c.y, py, py + ph);
    const dx = c.x - closestX;
    const dy = c.y - closestY;
    if (dx * dx + dy * dy <= c.r * c.r) {
      c.collected = true;
      const gain = doubleTimer > 0 ? 2 : 1;
      roundCoins += gain;
      totalCoins += gain;
      saveTotalCoins();
      updateCoinUI();
      playCoinSound();

      // visual particles
      const count = 14;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const sp = 120 + Math.random() * 160;
        coinParticles.push({
          x: c.x,
          y: c.y,
          vx: Math.cos(angle) * sp,
          vy: Math.sin(angle) * sp,
          life: 0.35 + Math.random() * 0.15,
        });
      }
    }
  }

  // Powerup pickup / update
  for (const pu of powerUps) {
    pu.x -= currentSpeed * dt;
    pu.y += Math.sin((elapsedRunTime * 3) + (pu.x % 1)) * 6 * dt;

    const closestX = clamp(pu.x, px, px + pw);
    const closestY = clamp(pu.y, py, py + ph);
    const dx = pu.x - closestX;
    const dy = pu.y - closestY;
    if (dx * dx + dy * dy <= (pu.r || 10) * (pu.r || 10)) {
      if (pu.type === "magnet") magnetTimer = MAGNET_DURATION;
      else if (pu.type === "double") doubleTimer = DOUBLE_DURATION;
      pu._consumed = true;
      playCoinSound();
    }
  }
  powerUps = powerUps.filter((p) => !p._consumed && p.x + (p.r || 0) > -40);

  // Viruses update + collision
  for (const v of viruses) {
    v.phase += dt * v.speed;
    v.y = v.baseY + Math.sin(v.phase) * v.amp;
    v.x -= currentSpeed * dt;

    const closestXv = clamp(v.x, px, px + pw);
    const closestYv = clamp(v.y, py, py + ph);
    const dxv = v.x - closestXv;
    const dyv = v.y - closestYv;
    if (dxv * dxv + dyv * dyv <= v.r * v.r) {
      triggerGameOver();
      return;
    }
  }
  viruses = viruses.filter((v) => v.x + v.r > -60);

  // Obstacles collision
  for (const o of obstacles) {
    if (
      px < o.x + o.width &&
      px + pw > o.x &&
      py < o.y + o.height &&
      py + ph > o.y
    ) {
      triggerGameOver();
      break;
    }
  }
}

/* ========= GAMEOVER ========= */
function triggerGameOver() {
  if (isGameOver) return;
  isGameOver = true;
  hasStarted = false;
  finalScoreEl.textContent = Math.floor(score).toString();
  updateCoinUI();
  gameOverOverlay.classList.remove("hidden");
  stopPowerHum();

  const centerX = player.x + player.width / 2;
  const centerY = player.y + player.height / 2;
  const count = 36;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 200 + Math.random() * 260;
    particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.7 + Math.random() * 0.3,
      color:
        Math.random() < 0.5
          ? "rgba(84, 255, 255, 1)"
          : "rgba(255, 78, 233, 1)",
    });
  }
}

/* ========= DRAW: background (lava improved), trail, player, obstacles, coins, powerups, viruses ========= */

function drawBackground() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "rgba(10, 232, 255, 0.12)");
  gradient.addColorStop(0.4, "rgba(2, 8, 22, 0.6)");
  gradient.addColorStop(1, "rgba(255, 0, 186, 0.16)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const groundY = h * 0.78;

  // ===== Neon Lava (animated deadly borders) =====
  const lavaHeight = Math.max(12, h * 0.04);
  const flowSpeed = 0.42; // slightly smoother
  const offset = (lavaTime * flowSpeed) % 1;

  function drawLava(y, direction = 1) {
    // wider gradient so it flows
    const gx0 = direction > 0 ? -w * 0.7 : w * 1.7;
    const gx1 = direction > 0 ? w * 1.7 : -w * 0.7;
    const grad = ctx.createLinearGradient(gx0, 0, gx1, 0);

    // More varied stops for smoother flow
    const stops = [
      { p: (0.0 + offset) % 1, c: "#ffea00" },
      { p: (0.14 + offset) % 1, c: "#ffb000" },
      { p: (0.28 + offset) % 1, c: "#ff6a00" },
      { p: (0.42 + offset) % 1, c: "#ff2a00" },
      { p: (0.58 + offset) % 1, c: "#ff8c00" },
      { p: (0.77 + offset) % 1, c: "#ffea00" },
    ];
    stops.sort((a, b) => a.p - b.p);
    for (const s of stops) grad.addColorStop(s.p, s.c);

    ctx.save();
    // stronger neon glow
    ctx.shadowColor = "rgba(255, 110, 20, 1)";
    ctx.shadowBlur = 38;

    ctx.fillStyle = grad;
    ctx.fillRect(0, y, w, lavaHeight);

    // top bright stripe
    const edgeGrad = ctx.createLinearGradient(0, y, 0, y + lavaHeight);
    edgeGrad.addColorStop(0, "rgba(255,255,220,1)");
    edgeGrad.addColorStop(0.3, "rgba(255,160,0,0.9)");
    edgeGrad.addColorStop(1, "rgba(255,60,0,0.0)");

    ctx.shadowBlur = 26;
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, y, w, lavaHeight);

    ctx.restore();
  }

  drawLava(0, 1);
  drawLava(groundY - lavaHeight, -1);

  // subtle grid
  ctx.save();
  ctx.strokeStyle = "rgba(0, 255, 255, 0.11)";
  ctx.lineWidth = 1;
  const spacing = 42;
  for (let x = 0; x < w; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x + 60, h);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTrail() {
  for (const p of player.trail) {
    const alpha = p.life;
    const radius = (player.width * 0.55 * (2 - p.life)) / 2;
    const gradient = ctx.createRadialGradient(
      p.x,
      p.y,
      0,
      p.x,
      p.y,
      radius
    );
    gradient.addColorStop(0, `rgba(84, 255, 255, ${0.9 * alpha})`);
    gradient.addColorStop(0.6, `rgba(84, 255, 255, ${0.4 * alpha})`);
    gradient.addColorStop(1, `rgba(84, 255, 255, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* DRAW PLAYER with dynamic magnet field (waves) and X2 golden aura */
function drawPlayer() {
  const { x, y, width: w, height: h } = player;

  // Core cube gradient
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, "#54ffff");
  grad.addColorStop(0.5, "#8af7ff");
  grad.addColorStop(1, "#ff4ee9");

  ctx.shadowColor = "rgba(84, 255, 255, 0.9)";
  ctx.shadowBlur = 28;
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // inner frame
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(2, 10, 22, 0.9)";
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);

  // scan line
  ctx.strokeStyle = "rgba(250,255,255,0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + h * 0.28);
  ctx.lineTo(x + w - 3, y + h * 0.28);
  ctx.stroke();

  const cx = x + w / 2;
  const cy = y + h / 2;
  const t = performance.now() / 1000;

  // MAGNETIC FIELD: moving waves, pulsing & rotating (not static rings)
  if (magnetTimer > 0) {
    const waveCount = 4;
    for (let i = 0; i < waveCount; i++) {
      const progress = (i / waveCount);
      const baseRadius = w * (1.1 + progress * 1.8);
      const wobble = Math.sin(t * (2 + i) + progress * Math.PI * 2) * (0.06 + progress * 0.06) * baseRadius;
      const radius = baseRadius + wobble;
      const start = t * (0.6 + progress * 0.9) + progress * 2;
      const sweep = Math.PI * (1.1 + 0.25 * Math.sin(t * 2 + i));

      ctx.beginPath();
      ctx.lineWidth = 2 + (1 - progress) * 2;
      ctx.strokeStyle = `rgba(84,255,255,${0.22 * (1 - progress)})`;
      ctx.shadowColor = "rgba(84,255,255,0.9)";
      ctx.shadowBlur = 14 + i * 6;

      // draw several short arc segments to evoke "flowing wave"
      const segments = 6;
      for (let s = 0; s < segments; s++) {
        const a0 = start + (s / segments) * (Math.PI * 2);
        const a1 = a0 + sweep / (1 + progress * 2);
        ctx.beginPath();
        ctx.arc(cx, cy, Math.abs(radius) + s * 0.4, a0, a1);
        ctx.stroke();
      }
    }

    // small particle-like streaks between waves
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 6; i++) {
      const angle = t * 2.6 + i * 1.05;
      const rr = w * (0.9 + 1.1 * Math.sin(t * (0.4 + i * 0.12)));
      const sx = cx + Math.cos(angle) * rr * 0.9;
      const sy = cy + Math.sin(angle) * rr * 0.9;
      ctx.fillStyle = "rgba(84,255,255,0.06)";
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1.6, w * 0.03 * (1 - i / 10)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // DOUBLE GOLD AURA — layered, soft, pulsing (no dirty yellow patches)
  if (doubleTimer > 0) {
    const gPulse = 0.6 + 0.4 * Math.sin(t * 5);
    // outer soft glow
    const rg = ctx.createRadialGradient(cx, cy, w * 0.2, cx, cy, w * 1.8);
    rg.addColorStop(0, `rgba(255,235,150,${0.28 * gPulse})`);
    rg.addColorStop(0.45, `rgba(255,195,80,${0.16 * gPulse})`);
    rg.addColorStop(0.85, `rgba(255,150,30,${0.06 * gPulse})`);
    rg.addColorStop(1, "rgba(255,140,0,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // inner subtle layer
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.9);
    inner.addColorStop(0, `rgba(255,245,200,${0.9 * gPulse})`);
    inner.addColorStop(0.5, `rgba(255,210,120,${0.28 * gPulse})`);
    inner.addColorStop(1, "rgba(255,170,60,0)");
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // golden $ sign — but soft, with small vertical bob
    ctx.save();
    ctx.font = Math.floor(w * 0.56) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(255,245,180,${0.95 * gPulse})`;
    ctx.shadowColor = "rgba(255,200,60,0.95)";
    ctx.shadowBlur = 20;
    ctx.fillText("$", cx, cy + Math.sin(t * 6) * (w * 0.02));
    ctx.restore();
  }

  ctx.shadowBlur = 0;
}

/* Obstacles (unchanged style) */
function drawObstacles() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  obstacles.forEach((o) => {
    const x = o.x;
    const y = o.y;
    const width = o.width;
    const height = o.height;

    const baseHue = 180 + o.hueOffset;
    const colorA = `hsl(${baseHue}, 100%, 60%)`;
    const colorB = `hsl(${baseHue + 60}, 100%, 60%)`;

    ctx.save();
    ctx.shadowColor = "rgba(255, 0, 200, 0.9)";
    ctx.shadowBlur = 24;

    const grad = ctx.createLinearGradient(x, y, x, y + height);
    grad.addColorStop(0, colorA);
    grad.addColorStop(1, colorB);

    ctx.fillStyle = grad;
    ctx.beginPath();
    const radius = 6;
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(2, 8, 20, 0.85)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  });
}

/* Power-ups drawing: improved magnet (🧲 horseshoe metallic + neon), refined double */
function drawPowerUps() {
  for (const pu of powerUps) {
    const x = pu.x;
    const y = pu.y;
    const r = pu.r || 10;

    ctx.save();

    if (pu.type === "magnet") {
      // horseshoe shape with metallic shine and neon glow
      // main neon stroke
      ctx.shadowColor = "rgba(84,255,255,0.95)";
      ctx.shadowBlur = 22;
      ctx.lineWidth = Math.max(3, r * 0.25);
      ctx.strokeStyle = "rgba(84,255,255,0.98)";

      // Draw left arc
      ctx.beginPath();
      ctx.arc(x - r * 0.35, y, r * 0.9, Math.PI * 0.32, Math.PI * 1.68, false);
      ctx.stroke();

      // Draw right arc (mirrored)
      ctx.beginPath();
      ctx.arc(x + r * 0.35, y, r * 0.9, Math.PI * 1.82, Math.PI * 0.32, false);
      ctx.stroke();

      // metallic fill for thickness (use radial gradient for shine)
      const shine = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      shine.addColorStop(0, "rgba(220,240,255,0.15)");
      shine.addColorStop(0.5, "rgba(255,255,255,0.34)");
      shine.addColorStop(1, "rgba(180,200,220,0.12)");
      ctx.fillStyle = shine;

      // fill an approximate rectangle between arcs to simulate thickness
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      // draw a rounded rectangle area covering the magnet interior for subtle sheen
      const wMag = r * 1.8;
      const hMag = r * 1.1;
      ctx.ellipse(x, y + r * 0.16, wMag * 0.5, hMag * 0.55, 0, Math.PI * 0.15, Math.PI * 0.85);
      ctx.fill();

      // poles small disc highlights
      ctx.shadowColor = "rgba(255,140,160,0.98)";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "rgba(255,180,190,0.98)";
      ctx.beginPath();
      ctx.arc(x - r * 0.35, y + r * 0.9, Math.max(2, r * 0.22), 0, Math.PI * 2);
      ctx.arc(x + r * 0.35, y + r * 0.9, Math.max(2, r * 0.22), 0, Math.PI * 2);
      ctx.fill();

      // subtle inner glow to show magnetic polarity
      ctx.shadowColor = "rgba(84,255,255,0.9)";
      ctx.shadowBlur = 28;
      ctx.strokeStyle = "rgba(84,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.3, Math.PI * 0.1, Math.PI * 1.9);
      ctx.stroke();
    } else if (pu.type === "double") {
      // golden coin power-up enhanced
      ctx.shadowColor = "rgba(255,214,0,0.98)";
      ctx.shadowBlur = 28;
      const grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, 0, x, y, r);
      grad.addColorStop(0, "rgba(255,255,230,1)");
      grad.addColorStop(0.35, "rgba(255,220,70,1)");
      grad.addColorStop(1, "rgba(255,150,20,1)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // ornate $ sign
      ctx.fillStyle = "rgba(30,18,0,0.9)";
      ctx.font = Math.floor(r * 1.2) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", x, y);
    }

    ctx.restore();
  }
}

/* Viruses: bright green neon, spikes, pulsate */
function drawViruses() {
  for (const v of viruses) {
    ctx.save();
    const t = performance.now() / 1000;
    const pulse = 0.65 + 0.45 * Math.sin(t * 5 + v.phase);
    ctx.translate(v.x, v.y);
    ctx.rotate(Math.sin(t * 2 + v.phase) * 0.5);

    // core green neon glow
    ctx.shadowColor = "rgba(80,255,120,1)";
    ctx.shadowBlur = 26;

    const coreR = v.r * (0.9 + 0.12 * Math.sin(t * 6));
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
    grad.addColorStop(0, "rgba(220,255,220,1)");
    grad.addColorStop(0.5, "rgba(120,255,140,1)");
    grad.addColorStop(1, "rgba(20,140,60,0.22)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, coreR, 0, Math.PI * 2);
    ctx.fill();

    // spikes
    for (let s = 0; s < 8; s++) {
      const ang = (Math.PI * 2 * s) / 8 + t * 0.8;
      ctx.beginPath();
      const sx = Math.cos(ang) * (coreR * 0.9);
      const sy = Math.sin(ang) * (coreR * 0.9);
      const ex = Math.cos(ang) * coreR * (1.6 + 0.1 * Math.sin(t * 3 + s));
      const ey = Math.sin(ang) * coreR * (1.6 + 0.1 * Math.sin(t * 3 + s));
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = "rgba(120,255,160,0.98)";
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // spike tip glow
      ctx.beginPath();
      ctx.fillStyle = "rgba(200,255,220,0.98)";
      ctx.arc(ex, ey, Math.max(1.6, v.r * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

/* Particles */
function drawParticles() {
  particles.forEach((p) => {
    const alpha = Math.max(0, p.life);
    ctx.fillStyle = p.color.replace("1)", `${alpha})`);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 + (1 - p.life) * 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* Coins drawing: improved gold, larger for power-ups or second-row difference */
function drawCoins() {
  for (const c of coins) {
    if (c.collected) continue;

    const pulse = 0.86 + 0.14 * Math.sin(c.phase * 2.2);
    // if coin belongs to second row meta.row === 2, maybe slightly smaller or shifted
    const baseR = c.r;
    const r = baseR * pulse * (c.meta && c.meta.row === 2 ? 0.96 : 1);

    ctx.save();

    // stronger warm gold shadow when double is active
    const glowAlpha = doubleTimer > 0 ? 0.98 : 0.9;
    ctx.shadowColor = `rgba(255, 214, 0, ${glowAlpha})`;
    ctx.shadowBlur = doubleTimer > 0 ? 30 : 20;

    // coin radial neon gold
    const grad = ctx.createRadialGradient(c.x - r * 0.22, c.y - r * 0.22, 0, c.x, c.y, r);
    grad.addColorStop(0, "rgba(255, 255, 220, 1)");
    grad.addColorStop(0.28, "rgba(255, 230, 140, 1)");
    grad.addColorStop(0.6, "rgba(255, 200, 40, 1)");
    grad.addColorStop(1, "rgba(255, 135, 20, 1)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();

    // bright highlight arc
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.2;
    const a = c.phase;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 0.72, a, a + Math.PI * 0.86);
    ctx.stroke();

    // inner ring
    ctx.strokeStyle = "rgba(20,10,0,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}

function drawCoinParticles() {
  coinParticles.forEach((p) => {
    const a = Math.max(0, p.life);
    ctx.fillStyle = `rgba(255, 214, 0, ${a})`;
    ctx.shadowColor = "rgba(255, 214, 0, 0.9)";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2 + (1 - p.life) * 2.4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;
}

/* ========= RENDER & LOOP ========= */
function render() {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  drawBackground();
  drawTrail();
  drawPlayer();
  drawObstacles();
  drawViruses();
  drawPowerUps();
  drawParticles();
  drawCoins();
  drawCoinParticles();
}

function gameLoop(timestamp) {
  let delta = timestamp - lastTime;
  if (delta > 50) delta = 50;
  lastTime = timestamp;

  update(delta);
  render();

  if (!isGameOver && hasStarted) {
    rafId = requestAnimationFrame(gameLoop);
  } else {
    // final render
    render();
  }
}

/* ========= INPUT ========= */
function handleJump() {
  if (isGameOver) return;
  if (!hasStarted) {
    startGame();
  }
  ensureAudio();
  player.vy = jumpVelocity;
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.key === " ") {
    e.preventDefault();
    if (isGameOver) {
      resetGame();
      return;
    }
    handleJump();
  }
});

["mousedown", "touchstart"].forEach((eventName) => {
  canvas.addEventListener(
    eventName,
    (e) => {
      e.preventDefault();
      if (isGameOver) {
        resetGame();
        return;
      }
      handleJump();
    },
    { passive: false }
  );
});

restartButton.addEventListener("click", () => {
  ensureAudio();
  resetGame();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  } else {
    if (!isGameOver && hasStarted) {
      lastTime = performance.now();
      rafId = requestAnimationFrame(gameLoop);
    }
  }
});

window.addEventListener("resize", () => {
  resizeCanvas();
  initGameState();
});

/* ========= INITIALIZE ========= */
resizeCanvas();
totalCoins = loadTotalCoins();
initGameState();
render();

/* ========= NOTES =========
- Magnet appearance: horseshoe with neon glow and metallic sheen.
- Magnetic field: dynamic wave-like arcs drawn around the cube (not static rings).
- Double: layered soft golden aura and physically spawns second coin row when active at obstacle spawn time.
- Viruses: bright green neon, pulsating, appear inside gaps and won't block passage by placement constraints.
- Power-up hum: subtle oscillator started when any power-up active; stops automatically.
- Lava: smoother moving gradient, stronger glow.

Tuning:
- If you want larger/smaller magnet icons or different spawn rate, adjust POWERUP_SPAWN_CHANCE, DOUBLE_SPAWN_CHANCE, MAGNET_DURATION, DOUBLE_DURATION, or visual sizes (r values).
- If sound doesn't start, user must interact with page to allow audio — ensure first tap/click happened (we call ensureAudio() on first jump).
*/
