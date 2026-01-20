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

// Game state
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

function getMaxJumpHeightPx() {
  // Physics: max height above takeoff point is v^2 / (2g)
  // jumpVelocity is negative (upwards), gravity positive.
  const v = Math.abs(jumpVelocity);
  return (v * v) / (2 * gravity);
}

function getJumpFlightTimeSec() {
  // Time to go up and come back to the same height: t = 2v / g
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
    // Стартуем примерно по центру по высоте для режима полёта
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

  // Base speed reduced by 30% (fairer start)
  baseSpeed = canvas.clientWidth * 0.38 * 0.7; // px per second base
  speedMultiplier = 1;
  maxSpeedMultiplier = 2.1; // capped max speed multiplier for fairness
  elapsedRunTime = 0; // seconds since start (used for smooth ramp)

  // Micro-jumps: более быстрая гравитация и меньший импульс вверх
  gravity = canvas.clientHeight * 2.2; // px/s^2 (чуть сильнее падение)
  jumpVelocity = -canvas.clientHeight * 0.5; // px/s (примерно вдвое слабее)

  isJumpingAllowed = true;
  isGameOver = false;
  hasStarted = false;
  lastTime = performance.now();
  // Задержка перед первым препятствием (2.2 c) для обучения управлению
  obstacleSpawnTimer = -2200;
  obstacleSpawnInterval = 1200; // ms (base, потом чуть уменьшается)
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
  // Полный сброс состояния и безопасный перезапуск цикла игры
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

function spawnObstacle() {
  const baseUnit = Math.min(canvas.clientWidth, canvas.clientHeight || 400);
  const widthFactor = 0.06 + Math.random() * 0.02;
  const obstacleWidth = baseUnit * widthFactor;
  const groundY = canvas.clientHeight * 0.78;
  const h = canvas.clientHeight;

  const playerHeight = player ? player.height : baseUnit * 0.07;

  // Размер безопасного окна (gap) — 4–4.6 высоты игрока
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

  // Верхняя колонна: от потолка до верхней границы окна
  const topHeight = clamp(gapTop, h * 0.1, h * 0.5);
  const topObstacle = {
    x: canvas.clientWidth + obstacleWidth,
    y: 0,
    width: obstacleWidth,
    height: topHeight,
    type: "columnTop",
    hueOffset: Math.random() * 60,
  };

  // Нижняя колонна: от нижней лавы до нижней границы окна
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

  // Монеты: висят в безопасном окне по центру
  const coinCount = 3 + Math.floor(Math.random() * 3); // 3–5 монет
  const coinRadius = clamp(baseUnit * 0.018, 6, 12);
  const coinY = gapCenter;
  const startX =
    topObstacle.x + obstacleWidth + clamp(baseUnit * 0.12, 40, 72);
  const stepX = clamp(baseUnit * 0.085, 34, 64);

  for (let i = 0; i < coinCount; i++) {
    const cx = startX + i * stepX;
    spawnCoinAt(cx, coinY, coinRadius);
  }
}

function coinOverlapsObstacle(cx, cy, r) {
  // Check against obstacles in screen-ish area. Expand obstacle a bit to be safe.
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

function spawnCoinAt(x, y, r) {
  if (coinOverlapsObstacle(x, y, r)) return false;

  coins.push({
    x,
    y,
    r,
    phase: Math.random() * Math.PI * 2,
    spin: (Math.random() < 0.5 ? -1 : 1) * (1.8 + Math.random() * 1.4),
    collected: false,
  });
  return true;
}

function update(delta) {
  if (!hasStarted || isGameOver) return;

  const dt = delta / 1000;

  // Smooth ramp: starts slow and accelerates very smoothly for 60s to a capped max
  elapsedRunTime += dt;
  const t = Math.min(1, elapsedRunTime / 60);
  const smoothStep = t * t * (3 - 2 * t); // 0..1 easing
  speedMultiplier = 1 + smoothStep * (maxSpeedMultiplier - 1);
  const currentSpeed = baseSpeed * speedMultiplier;

  // Update player physics
  const groundY = canvas.clientHeight * 0.78;

  player.vy += gravity * dt;
  player.y += player.vy * dt;

  player.onGround = false;

  // Update trail
  player.trail.push({
    x: player.x + player.width / 2,
    y: player.y + player.height / 2,
    life: 1,
    vx: -currentSpeed * 0.35, // лёгкий снос влево для эффекта скорости
  });
  if (player.trail.length > 40) {
    player.trail.shift();
  }
  player.trail.forEach((p) => {
    p.x += (p.vx || 0) * dt;
    p.life -= dt * 1.8;
  });
  player.trail = player.trail.filter((p) => p.life > 0);

  // Spawn obstacles
  obstacleSpawnTimer += delta;
  if (obstacleSpawnTimer >= 0) {
    // Flappy-style: расстояние между колоннами по времени реакции и скорости
    const minInterval = 900; // ms
    const intervalDecrease = 200 * smoothStep;
    obstacleSpawnInterval = Math.max(minInterval, 1400 - intervalDecrease);

    const lastObstacle = obstacles[obstacles.length - 1];
    const flightTime = getJumpFlightTimeSec();
    const baseGapTime = flightTime + 0.2; // seconds
    let minGapPx = Math.max(260, currentSpeed * baseGapTime);

    if (obstacles.length >= 2) {
      const prev = obstacles[obstacles.length - 2];
      const lastGap = lastObstacle.x - (prev.x + prev.width);
      const tightGap = Math.max(220, currentSpeed * (flightTime + 0.08));
      if (lastGap < tightGap) {
        minGapPx *= 1.35;
      }
    }

    const canSpawnByDistance =
      !lastObstacle || lastObstacle.x < canvas.clientWidth - minGapPx;

    if (obstacleSpawnTimer >= obstacleSpawnInterval && canSpawnByDistance) {
      obstacleSpawnTimer = 0;
      spawnObstacle();
    }
  }

  // Update obstacles
  obstacles.forEach((o) => {
    o.x -= currentSpeed * dt;
  });
  obstacles = obstacles.filter((o) => o.x + o.width > -50);

  // Coin group spawn (planned after obstacles). Coins move with the same world speed.
  coinSpawnCooldown = Math.max(0, coinSpawnCooldown - dt);
  if (coinGroupPlan) {
    // Spawn one coin per frame (at most) to keep it simple and deterministic.
    if (coinGroupPlan.countRemaining > 0) {
      const spawned = spawnCoinAt(
        coinGroupPlan.nextX,
        coinGroupPlan.y,
        coinGroupPlan.radius
      );
      // Even if a coin couldn't be placed (overlap), move forward anyway to avoid stalling.
      coinGroupPlan.nextX += coinGroupPlan.stepX;
      coinGroupPlan.countRemaining -= spawned ? 1 : 0;

      // If we failed too much, abandon the group (rare)
      if (!spawned) {
        coinGroupPlan.failures = (coinGroupPlan.failures || 0) + 1;
        if (coinGroupPlan.failures >= 6) coinGroupPlan = null;
      }
      if (coinGroupPlan && coinGroupPlan.countRemaining <= 0) coinGroupPlan = null;
    } else {
      coinGroupPlan = null;
    }
  }

  coins.forEach((c) => {
    c.x -= currentSpeed * dt;
    c.phase += dt * c.spin;
  });
  coins = coins.filter((c) => c.x + c.r > -30 && !c.collected);

  coinParticles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  });
  coinParticles = coinParticles.filter((p) => p.life > 0);

  // Update particles
  particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  });
  particles = particles.filter((p) => p.life > 0);

  // Score
  score += dt * 10 * speedMultiplier;
  scoreEl.textContent = Math.floor(score).toString();

  // Collision detection
  // Make player's hitbox smaller than the visual cube (padding inward)
  const hitPadding = Math.max(5, Math.min(10, player.width * 0.14)); // css px
  const px = player.x + hitPadding;
  const py = player.y + hitPadding;
  const pw = Math.max(1, player.width - hitPadding * 2);
  const ph = Math.max(1, player.height - hitPadding * 2);

  // Lava mode: касание верхней или нижней границы (земли) = Game Over.
  if (player.y <= 0 || player.y + player.height >= groundY) {
    triggerGameOver();
    return;
  }

  // Coin pickup (AABB vs circle for the smaller hitbox)
  for (const c of coins) {
    if (c.collected) continue;
    const closestX = clamp(c.x, px, px + pw);
    const closestY = clamp(c.y, py, py + ph);
    const dx = c.x - closestX;
    const dy = c.y - closestY;
    if (dx * dx + dy * dy <= c.r * c.r) {
      c.collected = true;
      roundCoins += 1;
      totalCoins += 1;
      saveTotalCoins();
      updateCoinUI();
      playCoinSound();

      // Visual flash particles
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

function triggerGameOver() {
  if (isGameOver) return;
  isGameOver = true;
  hasStarted = false;
  finalScoreEl.textContent = Math.floor(score).toString();
  updateCoinUI();
  gameOverOverlay.classList.remove("hidden");

  // Explosion particles
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

function drawBackground() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "rgba(10, 232, 255, 0.12)");
  gradient.addColorStop(0.4, "rgba(2, 8, 22, 0.6)");
  gradient.addColorStop(1, "rgba(255, 0, 186, 0.22)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const groundY = h * 0.78;

  // Lava lines: опасные зоны вверху и внизу
  const lavaThickness = Math.max(4, h * 0.01);

  // Top lava
  const topLavaGrad = ctx.createLinearGradient(0, 0, 0, lavaThickness * 3);
  topLavaGrad.addColorStop(0, "rgba(255, 80, 0, 1)");
  topLavaGrad.addColorStop(0.4, "rgba(255, 150, 0, 0.9)");
  topLavaGrad.addColorStop(1, "rgba(255, 80, 0, 0)");
  ctx.fillStyle = topLavaGrad;
  ctx.fillRect(0, 0, w, lavaThickness * 3);

  // Bottom lava at "ground" line
  const bottomLavaGrad = ctx.createLinearGradient(
    0,
    groundY - lavaThickness * 2,
    0,
    groundY + lavaThickness * 2
  );
  bottomLavaGrad.addColorStop(0, "rgba(255, 80, 0, 0)");
  bottomLavaGrad.addColorStop(0.4, "rgba(255, 150, 0, 0.9)");
  bottomLavaGrad.addColorStop(1, "rgba(255, 80, 0, 1)");
  ctx.fillStyle = bottomLavaGrad;
  ctx.fillRect(0, groundY - lavaThickness * 2, w, lavaThickness * 4);

  // Grid lines
  ctx.save();
  ctx.strokeStyle = "rgba(0, 255, 255, 0.12)";
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

function drawPlayer() {
  const { x, y, width: w, height: h } = player;

  // Core cube
  const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
  gradient.addColorStop(0, "#54ffff");
  gradient.addColorStop(0.5, "#8af7ff");
  gradient.addColorStop(1, "#ff4ee9");

  ctx.shadowColor = "rgba(84, 255, 255, 0.9)";
  ctx.shadowBlur = 28;
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);

  // Inner frame
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(2, 10, 22, 0.9)";
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);

  // Scan line
  ctx.strokeStyle = "rgba(250, 255, 255, 0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + h * 0.28);
  ctx.lineTo(x + w - 3, y + h * 0.28);
  ctx.stroke();

  // Top glow line
  ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 3);
  ctx.lineTo(x + w - 4, y + 3);
  ctx.stroke();

  ctx.shadowBlur = 0;
}

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

    // Неоновые вертикальные колонны (как трубы)
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

function drawParticles() {
  particles.forEach((p) => {
    const alpha = Math.max(0, p.life);
    ctx.fillStyle = p.color.replace("1)", `${alpha})`);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 + (1 - p.life) * 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawCoins() {
  for (const c of coins) {
    if (c.collected) continue;

    const pulse = 0.85 + 0.15 * Math.sin(c.phase * 2.2);
    const r = c.r * pulse;

    ctx.save();

    // Glow
    ctx.shadowColor = "rgba(255, 214, 0, 0.95)";
    ctx.shadowBlur = 22;

    // Coin body (radial neon gold)
    const grad = ctx.createRadialGradient(c.x - r * 0.25, c.y - r * 0.25, 0, c.x, c.y, r);
    grad.addColorStop(0, "rgba(255, 251, 210, 1)");
    grad.addColorStop(0.35, "rgba(255, 214, 0, 1)");
    grad.addColorStop(1, "rgba(255, 140, 0, 1)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();

    // "Spin" highlight line
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 1.2;
    const a = c.phase;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 0.72, a, a + Math.PI * 0.9);
    ctx.stroke();

    // Inner ring
    ctx.strokeStyle = "rgba(20, 10, 0, 0.55)";
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

function render() {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  drawBackground();
  drawTrail();
  drawPlayer();
  drawObstacles();
  drawParticles();
  drawCoins();
  drawCoinParticles();
}

function gameLoop(timestamp) {
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  update(delta);
  render();

  if (!isGameOver && hasStarted) {
    rafId = requestAnimationFrame(gameLoop);
  } else {
    // Final render state after game over
    render();
  }
}

function handleJump() {
  if (isGameOver) return;
  if (!hasStarted) {
    startGame();
  }
  ensureAudio(); // unlock audio on first gesture
  // Flappy-style impulse: every tap gives upward velocity, even in air.
  player.vy = jumpVelocity;
}

// Input
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

window.addEventListener("resize", () => {
  resizeCanvas();
  initGameState();
});

// Initial setup
resizeCanvas();
totalCoins = loadTotalCoins();
initGameState();
render();

