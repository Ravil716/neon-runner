/* script.js — FIXED VISUALS: Inverted Magnet 🧲, Magnetic Waves, Neon Pony Trail */

// --- 1. CONFIGURATION & SUPABASE ---
const SUPABASE_URL = 'https://rtzzkxkoakeikpupgqym.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-EHItCU8f7QcCyP3Hzx_2A_ewvckfLd';

let _supabase = null;
let isOfflineMode = false;
let playerDbId = null;

// Инициализация базы данных
try {
  if (window.supabase) {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase connected!");
  } else {
    console.warn("No Supabase lib. Offline mode.");
    isOfflineMode = true;
  }
} catch (err) {
  isOfflineMode = true;
}

// --- 2. DOM ELEMENTS ---
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

const shopButton = document.getElementById("shopButton");
const shopOverlay = document.getElementById("shopOverlay");
const shopCloseButton = document.getElementById("shopCloseButton");
const shopGrid = document.getElementById("shopGrid");
const bankButton = document.getElementById("bankButton");
const bankOverlay = document.getElementById("bankOverlay");
const bankCloseButton = document.getElementById("bankCloseButton");
const bankGrid = document.getElementById("bankGrid");
const leaderboardBtn = document.getElementById("leaderboardButton"); 
const leaderboardOverlay = document.getElementById("leaderboardOverlay");
const leaderboardCloseBtn = document.getElementById("leaderboardCloseButton");
const leaderboardBody = document.getElementById("leaderboardBody");
const leaderboardLoading = document.getElementById("leaderboardLoading");

let width = 0;
let height = 0;

// --- 3. GAME STATE ---
let player;
let obstacles;
let particles;
let coins;
let coinParticles;
let powerUps = [];
let viruses = []; 

let baseSpeed;
let speedMultiplier;
let maxSpeedMultiplier;
let elapsedRunTime;
let gravity;
let jumpVelocity;
let isJumpingAllowed;
let isGameOver;
let hasStarted = false;
let lastTime;
let obstacleSpawnTimer;
let obstacleSpawnInterval;
let score;
let roundCoins;
let totalCoins = 0;
let coinSpawnCooldown;
let coinGroupPlan;
let rafId = null;
let lavaTime = 0;

// Power-ups
let magnetTimer = 0;
let doubleTimer = 0;
let shieldTimer = 0;

const MAGNET_DURATION = 7;
const DOUBLE_DURATION = 7;
const SHIELD_DURATION = 10;

// Configs
const VIRUS_SPAWN_CHANCE = 0.45; 
const POWERUP_SPAWN_CHANCE = 0.12; 
const MAX_VIRUSES = 2; 

const STORAGE_TOTAL_COINS_KEY = "neonRunner_totalCoins";
const STORAGE_OWNED_SKINS_KEY = "neonRunner_ownedSkins";
const STORAGE_CURRENT_SKIN_KEY = "neonRunner_currentSkin";

// Audio
let audioCtx = null;
let audioEnabled = true;

const BANK_OFFERS = [
  { id: "handful", name: "Handful of Coins", coins: 500, stars: 10, icon: "💰", badge: "BASIC" },
  { id: "sack", name: "Sack of Coins", coins: 2500, stars: 40, icon: "💰", badge: "BEST VALUE" },
  { id: "chest", name: "Chest of Coins", coins: 10000, stars: 150, icon: "💎", badge: "SUPER DEAL" },
];

const SKINS = [
  {
    id: "default",
    name: "Neon Core",
    price: 0,
    primaryColor: "#54ffff",
    secondaryColor: "#8af7ff",
    accentColor: "#ff4ee9",
    borderColor: "rgba(2, 10, 22, 0.9)",
    glowColor: "rgba(84, 255, 255, 0.9)",
    trailBase: "84, 255, 255",
    symbol: "",
    symbolColor: "#ffffff",
    badge: "FREE",
  },
  {
    id: "batman",
    name: "Neo Batman",
    price: 500,
    primaryColor: "#050608",
    secondaryColor: "#1b1f2a",
    accentColor: "#ffd600",
    borderColor: "rgba(255, 214, 0, 0.9)",
    glowColor: "rgba(255, 214, 0, 0.95)",
    trailBase: "255, 214, 0",
    symbol: "🦇",
    symbolColor: "#ffd600",
    badge: "EPIC",
  },
  {
    id: "ufo",
    name: "Neon UFO",
    price: 800,
    symbol: "🛸",
    primaryColor: "#00e5ff",
    secondaryColor: "#00ffaa",
    accentColor: "#00ffaa",
    borderColor: "#00ffaa",
    glowColor: "#00ffaa",
    trailBase: "255, 230, 20", // Yellow trail
    symbolColor: "#e0fff7",
    badge: "RARE",
  },
  {
    id: "pinkPony",
    name: "Pink Pony",
    price: 1000,
    primaryColor: "#ff7ce0",
    secondaryColor: "#ffb3ff",
    accentColor: "#7df9ff",
    borderColor: "rgba(255, 181, 255, 0.95)",
    glowColor: "rgba(255, 125, 224, 0.95)",
    // 3. ИЗМЕНЕНО: Более насыщенный неоновый розовый шлейф
    trailBase: "255, 20, 200", 
    symbol: "🦄",
    symbolColor: "#ffffff",
    badge: "MYTHIC",
  },
];

let ownedSkins = ["default"];
let currentSkinId = "default";
let currentSkin = SKINS[0];

// --- 4. DATA LOGIC ---

async function initUserData() {
  if (isOfflineMode) { loadLocalData(); return; }
  try {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser ? tgUser.id : 12345; 
    const userName = tgUser ? (tgUser.username || tgUser.first_name) : "Player";

    const { data, error } = await _supabase.from('players').select('*').eq('id', userId).single();
    if (error && error.code !== 'PGRST116') throw error;

    if (data) {
      playerDbId = userId;
      totalCoins = data.coins || 0;
      loadSkinState(); 
      updateCoinUI();
      renderShop();
    } else {
      await _supabase.from('players').insert([{ id: userId, username: userName, coins: 0, high_score: 0 }]);
      playerDbId = userId;
      totalCoins = 0;
      loadSkinState();
    }
  } catch (err) {
    isOfflineMode = true;
    loadLocalData();
  }
}

function loadLocalData() {
  const raw = localStorage.getItem(STORAGE_TOTAL_COINS_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  totalCoins = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  loadSkinState();
  updateCoinUI();
}

function saveTotalCoins() {
  localStorage.setItem(STORAGE_TOTAL_COINS_KEY, String(totalCoins));
}

async function saveUserData(newScore = 0) {
  saveTotalCoins();
  if (isOfflineMode || !playerDbId) return;
  try {
    await _supabase.from('players').update({ coins: totalCoins }).eq('id', playerDbId);
    if (newScore > 0) {
        const { data } = await _supabase.from('players').select('high_score').eq('id', playerDbId).single();
        if (data && newScore > data.high_score) {
            await _supabase.from('players').update({ high_score: Math.floor(newScore) }).eq('id', playerDbId);
        }
    }
  } catch (err) {}
}

async function fetchLeaderboard() {
  if (!leaderboardBody) return;
  leaderboardBody.innerHTML = "";
  if (leaderboardLoading) leaderboardLoading.style.display = "block";

  if (isOfflineMode) {
      if (leaderboardLoading) leaderboardLoading.style.display = "none";
      leaderboardBody.innerHTML = "<tr><td colspan='3' style='text-align:center'>Offline Mode</td></tr>";
      return;
  }

  try {
    const { data, error } = await _supabase
      .from('players')
      .select('username, high_score')
      .order('high_score', { ascending: false })
      .limit(10);

    if (error) throw error;
    if (leaderboardLoading) leaderboardLoading.style.display = "none";
    
    data.forEach((p, index) => {
        const tr = document.createElement("tr");
        let colorStyle = "";
        if (index === 0) colorStyle = "color: #ffd700; font-weight: bold;";
        else if (index === 1) colorStyle = "color: #c0c0c0; font-weight: bold;";
        else if (index === 2) colorStyle = "color: #cd7f32; font-weight: bold;";

        tr.innerHTML = `
            <td style="${colorStyle}">#${index + 1}</td>
            <td style="${colorStyle}">${p.username || 'Anon'}</td>
            <td style="${colorStyle}">${p.high_score}</td>
        `;
        leaderboardBody.appendChild(tr);
    });
  } catch (err) {
    if (leaderboardLoading) leaderboardLoading.style.display = "none";
    leaderboardBody.innerHTML = "<tr><td colspan='3' style='text-align:center'>Error</td></tr>";
  }
}

// --- UTILS ---
function getJumpFlightTimeSec() {
  const v = Math.abs(jumpVelocity);
  return (2 * v) / gravity;
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function loadSkinState() {
  try {
    const rawOwned = localStorage.getItem(STORAGE_OWNED_SKINS_KEY);
    if (rawOwned) {
      const parsed = JSON.parse(rawOwned);
      if (Array.isArray(parsed)) {
        ownedSkins = parsed.filter((id) => SKINS.some((s) => s.id === id));
      }
    }
  } catch {}
  if (!ownedSkins.includes("default")) ownedSkins.unshift("default");
  const rawCurrent = localStorage.getItem(STORAGE_CURRENT_SKIN_KEY);
  if (rawCurrent && SKINS.some((s) => s.id === rawCurrent)) {
    currentSkinId = rawCurrent;
  } else {
    currentSkinId = "default";
  }
  applyCurrentSkin();
}
function saveSkinState() {
  try {
    localStorage.setItem(STORAGE_OWNED_SKINS_KEY, JSON.stringify(ownedSkins));
    localStorage.setItem(STORAGE_CURRENT_SKIN_KEY, currentSkinId);
  } catch {}
}
function applyCurrentSkin() {
  const found = SKINS.find((s) => s.id === currentSkinId);
  currentSkin = found || SKINS[0];
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
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
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

// --- INIT ---
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
  const playerSize = baseUnit * 0.07; 

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
  shieldTimer = 0;

  baseSpeed = canvas.clientWidth * 0.38 * 0.7; 
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
  
  if (typeof totalCoins !== "number") loadLocalData();

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

function handleJump() {
  if (isGameOver) return;
  if (!hasStarted) {
    startGame();
  }
  ensureAudio();
  if (player) player.vy = jumpVelocity;
}

// --- LOGIC ---

function spawnObstacle() {
  const baseUnit = Math.min(canvas.clientWidth, canvas.clientHeight || 400);
  const widthFactor = 0.06 + Math.random() * 0.02;
  const obstacleWidth = baseUnit * widthFactor;
  const groundY = canvas.clientHeight * 0.78;
  const h = canvas.clientHeight;
  const playerHeight = player ? player.height : baseUnit * 0.07;

  const minGap = playerHeight * 4;
  const maxGap = playerHeight * 4.6;
  const gapSize = clamp(minGap + Math.random() * (maxGap - minGap), minGap, maxGap);
  const gapCenter = clamp(h * (0.3 + Math.random() * 0.4), playerHeight * 2, groundY - playerHeight * 2);
  const gapTop = gapCenter - gapSize / 2;
  const gapBottom = gapCenter + gapSize / 2;

  const topHeight = clamp(gapTop, h * 0.1, h * 0.5);
  const topObstacle = { x: canvas.clientWidth + obstacleWidth, y: 0, width: obstacleWidth, height: topHeight, type: "columnTop", hueOffset: Math.random() * 60 };
  const bottomHeight = Math.max(10, groundY - gapBottom);
  const bottomObstacle = { x: topObstacle.x, y: groundY - bottomHeight, width: obstacleWidth, height: bottomHeight, type: "columnBottom", hueOffset: Math.random() * 60 };
  obstacles.push(topObstacle, bottomObstacle);

  // Coins
  const coinCount = 3 + Math.floor(Math.random() * 3);
  const coinRadius = clamp(baseUnit * 0.018, 6, 12);
  const coinY = gapCenter;
  const startX = topObstacle.x + obstacleWidth + clamp(baseUnit * 0.12, 40, 72);
  const stepX = clamp(baseUnit * 0.085, 34, 64);

  // --- SPAWN LOGIC: ALL INDEPENDENT ---
  
  // 1. Power Ups
  if (Math.random() < POWERUP_SPAWN_CHANCE) {
    const r = Math.random();
    let type = "magnet";
    if (r > 0.33) type = "double";
    if (r > 0.66) type = "shield";

    const puR = baseUnit * 0.027; // Size
    const puX = topObstacle.x + obstacleWidth + clamp(baseUnit * 0.12, 40, 72) + 50;
    const puY = clamp(gapCenter + (Math.random() - 0.5) * playerHeight * 0.6, gapTop + puR, gapBottom - puR);
    
    powerUps.push({ type: type, x: puX, y: puY, r: puR });
  }

  // 2. Viruses
  if (Math.random() < VIRUS_SPAWN_CHANCE && viruses.length < MAX_VIRUSES) {
      const vR = clamp(baseUnit * (0.020 + Math.random() * 0.02), 10, 22);
      const vX = topObstacle.x + obstacleWidth + clamp(baseUnit * 0.14, 44, 84);
      const vY = clamp(gapCenter + (Math.random() - 0.5) * gapSize * 0.55, gapTop + vR + 20, gapBottom - vR - 20);
      viruses.push({ x: vX, y: vY, baseY: vY, r: vR, phase: Math.random() * Math.PI * 2, amp: 8 + Math.random() * 22, speed: 1 + Math.random() * 1.6 });
  }

  // 3. Coins (Always spawn)
  for (let i = 0; i < coinCount; i++) {
    const cx = startX + i * stepX;
    spawnCoinAt(cx, coinY, coinRadius, { row: 1 });
  }

  if (doubleTimer > 0) {
    const secondYOffset = -Math.max(coinRadius * 1.6, playerHeight * 0.18);
    for (let i = 0; i < coinCount; i++) {
      const cx = startX + i * stepX;
      spawnCoinAt(cx, coinY + secondYOffset, coinRadius, { row: 2 });
    }
  }
}

function spawnCoinAt(x, y, r, meta = {}) {
  // Only check walls
  if (coinOverlapsObstacle(x, y, r)) return false;
  coins.push({ x, y, r, phase: Math.random() * Math.PI * 2, spin: (Math.random() < 0.5 ? -1 : 1) * (1.8 + Math.random() * 1.4), collected: false, meta });
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

function update(delta) {
  if (!hasStarted || isGameOver || !player) return;

  const dt = delta / 1000;
  lavaTime += dt;
  magnetTimer = Math.max(0, magnetTimer - dt);
  doubleTimer = Math.max(0, doubleTimer - dt);
  shieldTimer = Math.max(0, shieldTimer - dt);

  elapsedRunTime += dt;
  const t = Math.min(1, elapsedRunTime / 60);
  const smoothStep = t * t * (3 - 2 * t);
  speedMultiplier = 1 + smoothStep * (maxSpeedMultiplier - 1);
  const currentSpeed = baseSpeed * speedMultiplier;
  const groundY = canvas.clientHeight * 0.78;

  player.vy += gravity * dt;
  player.y += player.vy * dt;
  player.onGround = false;

  // Trail
  let trailOffsetY = player.height / 2;
  if (currentSkinId === "ufo") {
      trailOffsetY = player.height * 0.85;
  }

  player.trail.push({
    x: player.x + player.width / 2,
    y: player.y + trailOffsetY, 
    life: 1,
    vx: -currentSpeed * 0.35,
  });
  if (player.trail.length > 40) player.trail.shift();
  player.trail.forEach((p) => { p.x += (p.vx || 0) * dt; p.life -= dt * 1.8; });
  player.trail = player.trail.filter((p) => p.life > 0);

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
      if (lastGap < Math.max(220, currentSpeed * (flightTime + 0.08))) minGapPx *= 1.35;
    }
    if ((!lastObstacle || lastObstacle.x < canvas.clientWidth - minGapPx) && obstacleSpawnTimer >= obstacleSpawnInterval) {
      obstacleSpawnTimer = 0;
      spawnObstacle();
    }
  }

  obstacles.forEach((o) => (o.x -= currentSpeed * dt));
  obstacles = obstacles.filter((o) => o.x + o.width > -50);

  // Coins
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

  coinParticles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
  coinParticles = coinParticles.filter((p) => p.life > 0);
  particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
  particles = particles.filter((p) => p.life > 0);

  score += dt * 10 * speedMultiplier;
  scoreEl.textContent = Math.floor(score).toString();

  const hitPadding = Math.max(5, Math.min(10, player.width * 0.14));
  const px = player.x + hitPadding;
  const py = player.y + hitPadding;
  const pw = Math.max(1, player.width - hitPadding * 2);
  const ph = Math.max(1, player.height - hitPadding * 2);

  if (player.y <= 0 || player.y + player.height >= groundY) { triggerGameOver(); return; }

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
      const count = 14;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const sp = 120 + Math.random() * 160;
        coinParticles.push({ x: c.x, y: c.y, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, life: 0.35 + Math.random() * 0.15 });
      }
    }
  }

  // --- POWERUP COLLECTION ---
  for (const pu of powerUps) {
    pu.x -= currentSpeed * dt;
    pu.y += Math.sin((elapsedRunTime * 3) + (pu.x % 1)) * 6 * dt;
    const closestX = clamp(pu.x, px, px + pw);
    const closestY = clamp(pu.y, py, py + ph);
    const dx = pu.x - closestX;
    const dy = pu.y - closestY;
    
    if (dx * dx + dy * dy <= (pu.r || 10) * (pu.r || 10)) {
      if (pu.type === "magnet") magnetTimer = MAGNET_DURATION;
      else if (pu.type === "shield") shieldTimer = SHIELD_DURATION;
      else if (pu.type === "double") {
          doubleTimer = DOUBLE_DURATION;
          // INSTANTLY SPAWN SECOND ROW
          const coinsCopy = [...coins];
          const secondYOffset = -Math.max(10, player.height * 0.18 + 15);
          coinsCopy.forEach(c => {
              if (!c.collected && c.x > player.x && !c.meta?.row) {
                  coins.push({
                      x: c.x,
                      y: c.y + secondYOffset,
                      r: c.r,
                      phase: c.phase,
                      spin: c.spin,
                      collected: false,
                      meta: { row: 2 }
                  });
              }
          });
      }
      pu._consumed = true;
      playCoinSound();
    }
  }
  powerUps = powerUps.filter((p) => !p._consumed && p.x + (p.r || 0) > -40);

  // Virus Collision
  for (const v of viruses) {
    v.phase += dt * v.speed;
    v.y = v.baseY + Math.sin(v.phase) * v.amp;
    v.x -= currentSpeed * dt;
    const closestXv = clamp(v.x, px, px + pw);
    const closestYv = clamp(v.y, py, py + ph);
    const dxv = v.x - closestXv;
    const dyv = v.y - closestYv;
    if (dxv * dxv + dyv * dyv <= v.r * v.r) {
        if (shieldTimer > 0) { useShield(); v.x = -999; }
        else { triggerGameOver(); return; }
    }
  }
  viruses = viruses.filter((v) => v.x + v.r > -60);

  // Obstacle Collision
  for (const o of obstacles) {
    if (px < o.x + o.width && px + pw > o.x && py < o.y + o.height && py + ph > o.y) {
        if (shieldTimer > 0) { useShield(); o.x = -999; }
        else { triggerGameOver(); break; }
    }
  }
}

function useShield() {
    shieldTimer = 0;
    const cx = player.x + player.width/2;
    const cy = player.y + player.height/2;
    for(let i=0; i<20; i++) {
        particles.push({
            x: cx, y: cy,
            vx: (Math.random()-0.5)*500,
            vy: (Math.random()-0.5)*500,
            life: 0.5,
            color: 'rgba(191, 0, 255, 1)'
        });
    }
}

function triggerGameOver() {
  if (isGameOver) return;
  isGameOver = true;
  hasStarted = false;
  finalScoreEl.textContent = Math.floor(score).toString();
  updateCoinUI();
  gameOverOverlay.classList.remove("hidden");
  saveUserData(score);

  const centerX = player.x + player.width / 2;
  const centerY = player.y + player.height / 2;
  const count = 36;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 200 + Math.random() * 260;
    particles.push({ x: centerX, y: centerY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.7 + Math.random() * 0.3, color: Math.random() < 0.5 ? "rgba(84, 255, 255, 1)" : "rgba(255, 78, 233, 1)" });
  }
}

/* ========= DRAWING ========= */

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
  const lavaHeight = Math.max(12, h * 0.04);
  const flowSpeed = 0.42; 
  const offset = (lavaTime * flowSpeed) % 1;

  function drawLava(y, direction = 1) {
    const gx0 = direction > 0 ? -w * 0.7 : w * 1.7;
    const gx1 = direction > 0 ? w * 1.7 : -w * 0.7;
    const grad = ctx.createLinearGradient(gx0, 0, gx1, 0);
    const stops = [{ p: (0.0 + offset) % 1, c: "#ffea00" }, { p: (0.14 + offset) % 1, c: "#ffb000" }, { p: (0.28 + offset) % 1, c: "#ff6a00" }, { p: (0.42 + offset) % 1, c: "#ff2a00" }, { p: (0.58 + offset) % 1, c: "#ff8c00" }, { p: (0.77 + offset) % 1, c: "#ffea00" }];
    stops.sort((a, b) => a.p - b.p);
    for (const s of stops) grad.addColorStop(s.p, s.c);

    ctx.save();
    ctx.shadowColor = "rgba(255, 110, 20, 1)";
    ctx.shadowBlur = 38;
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, w, lavaHeight);
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
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    gradient.addColorStop(0, `rgba(${currentSkin.trailBase.split(',').slice(0,3).join(',')}, ${0.9 * alpha})`);
    gradient.addColorStop(0.6, `rgba(${currentSkin.trailBase.split(',').slice(0,3).join(',')}, ${0.4 * alpha})`);
    gradient.addColorStop(1, `rgba(${currentSkin.trailBase.split(',').slice(0,3).join(',')}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  if (!player) return;
  const { x, y, width: w, height: h } = player;
  const skin = currentSkin || SKINS[0];
  const centerX = x + w / 2;
  const centerY = y + h / 2;

  // SHIELD
  if (shieldTimer > 0) {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(lavaTime);
    ctx.shadowBlur = 40;
    ctx.shadowColor = "#d600ff";
    ctx.strokeStyle = `rgba(214, 0, 255, ${0.8 + Math.sin(lavaTime*8)*0.2})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i=0; i<6; i++) {
        const ang = i * Math.PI / 3;
        const r = w * 1.4;
        ctx.lineTo(Math.cos(ang)*r, Math.sin(ang)*r);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = `rgba(214, 0, 255, ${0.1 + Math.sin(lavaTime*4)*0.05})`;
    ctx.fill();
    ctx.restore();
  }

  // 2. ИЗМЕНЕНО: Эффект Магнита (Волны)
  if (magnetTimer > 0) {
    ctx.save();
    ctx.translate(centerX, centerY);
    const t = performance.now() / 1000;
    const waveCount = 3;
    for (let i = 0; i < waveCount; i++) {
        const progress = (t * 1.5 + i / waveCount) % 1; // 0 to 1
        const radius = w * (1.2 + progress * 3.0); // Expand outwards
        const alpha = 1 - progress; // Fade out
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 255, 255, ${alpha * 0.9})`; // Cyan Neon
        ctx.lineWidth = 3 + (1-progress) * 2;
        ctx.shadowColor = "rgba(0, 255, 255, 1)";
        ctx.shadowBlur = 15 * alpha;
        ctx.stroke();
    }
    ctx.restore();
  }

  // DOUBLE
  if (doubleTimer > 0) {
    const gPulse = 0.6 + 0.4 * Math.sin(lavaTime * 5);
    const rg = ctx.createRadialGradient(centerX, centerY, w * 0.2, centerX, centerY, w * 1.8);
    rg.addColorStop(0, `rgba(255,235,150,${0.28 * gPulse})`);
    rg.addColorStop(0.45, `rgba(255,195,80,${0.16 * gPulse})`);
    rg.addColorStop(0.85, `rgba(255,150,30,${0.06 * gPulse})`);
    rg.addColorStop(1, "rgba(255,140,0,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(centerX, centerY, w * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // SKIN LOGIC
  if (skin.symbol) {
      const fontSize = h * 1.3;
      ctx.save();
      ctx.translate(centerX, centerY);
      
      if (skin.id === 'batman' || skin.id === 'pinkPony') {
          ctx.scale(-1, 1); 
      }

      ctx.shadowColor = skin.glowColor;
      ctx.shadowBlur = 28;
      ctx.font = `${fontSize}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = skin.symbolColor || "#ffffff";
      ctx.fillText(skin.symbol, 0, 2);
      ctx.restore();
  } else {
      // Draw Cube
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, skin.primaryColor);
      grad.addColorStop(0.5, skin.secondaryColor || skin.primaryColor);
      grad.addColorStop(1, skin.accentColor || skin.primaryColor);
      ctx.shadowColor = skin.glowColor;
      ctx.shadowBlur = 28;
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = skin.borderColor || "#fff";
      ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
      ctx.strokeStyle = "rgba(250,255,255,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + h * 0.28);
      ctx.lineTo(x + w - 3, y + h * 0.28);
      ctx.stroke();
  }
}

function drawObstacles() {
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

function drawPowerUps() {
  for (const pu of powerUps) {
    const x = pu.x;
    const y = pu.y;
    const r = pu.r; 
    
    // Aura
    ctx.save();
    ctx.translate(x, y);
    const auraSize = r * (1.3 + 0.1 * Math.sin(lavaTime * 4));
    let auraColorStart, auraColorEnd;
    if (pu.type === "magnet") { auraColorStart = "rgba(255, 50, 50, 0.4)"; auraColorEnd = "rgba(255, 50, 50, 0)"; }
    else if (pu.type === "double") { auraColorStart = "rgba(255, 215, 0, 0.4)"; auraColorEnd = "rgba(255, 215, 0, 0)"; }
    else { auraColorStart = "rgba(191, 0, 255, 0.4)"; auraColorEnd = "rgba(191, 0, 255, 0)"; }
    const grad = ctx.createRadialGradient(0, 0, r*0.5, 0, 0, auraSize);
    grad.addColorStop(0, auraColorStart);
    grad.addColorStop(1, auraColorEnd);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, auraSize, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    ctx.save();
    if (pu.type === "magnet") {
      // 1. ИЗМЕНЕНО: Перевернутая красная подкова 🧲
      ctx.shadowColor = "rgba(255, 50, 50, 0.8)";
      ctx.shadowBlur = 25;
      ctx.lineWidth = Math.max(4, r * 0.45); 
      ctx.lineCap = "round";
      ctx.strokeStyle = "#d32f2f"; // Красный

      ctx.beginPath();
      // Арка сверху
      ctx.arc(x, y - r * 0.2, r * 0.6, Math.PI, 0, false);
      // Ножки вниз
      ctx.moveTo(x - r * 0.6, y - r * 0.2);
      ctx.lineTo(x - r * 0.6, y + r * 0.5);
      ctx.moveTo(x + r * 0.6, y - r * 0.2);
      ctx.lineTo(x + r * 0.6, y + r * 0.5);
      ctx.stroke();

      // Белые наконечники внизу
      ctx.fillStyle = "#fff";
      ctx.shadowBlur = 10;
      ctx.fillRect(x - r * 0.85, y + r * 0.45, r * 0.5, r * 0.25); 
      ctx.fillRect(x + r * 0.35, y + r * 0.45, r * 0.5, r * 0.25); 

    } else if (pu.type === "double") {
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
      ctx.fillStyle = "rgba(30,18,0,0.9)";
      ctx.font = Math.floor(r * 1.2) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", x, y);
    } else if (pu.type === "shield") {
        ctx.shadowColor = "#bf00ff";
        ctx.shadowBlur = 25;
        ctx.fillStyle = "#bf00ff";
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 10, y - 10);
        ctx.lineTo(x + 10, y - 10);
        ctx.lineTo(x + 10, y);
        ctx.quadraticCurveTo(x, y + 15, x - 10, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText("+", x, y + 4);
    }
    ctx.restore();
  }
}

function drawViruses() {
  for (const v of viruses) {
    ctx.save();
    const t = performance.now() / 1000;
    ctx.translate(v.x, v.y);
    ctx.rotate(Math.sin(t * 2 + v.phase) * 0.5);
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
    for (let s = 0; s < 8; s++) {
      const ang = (Math.PI * 2 * s) / 8 + t * 0.8;
      ctx.beginPath();
      const sx = Math.cos(ang) * (coreR * 0.9);
      const sy = Math.sin(ang) * (coreR * 0.9);
      const ex = Math.cos(ang) * coreR * 1.6;
      const ey = Math.sin(ang) * coreR * 1.6;
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = "rgba(120,255,160,0.98)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = "rgba(200,255,220,0.98)";
      ctx.arc(ex, ey, Math.max(1.6, v.r * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
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
    const pulse = 0.86 + 0.14 * Math.sin(c.phase * 2.2);
    const baseR = c.r;
    const r = baseR * pulse * (c.meta && c.meta.row === 2 ? 0.96 : 1);
    ctx.save();
    const glowAlpha = doubleTimer > 0 ? 0.98 : 0.9;
    ctx.shadowColor = `rgba(255, 214, 0, ${glowAlpha})`;
    ctx.shadowBlur = doubleTimer > 0 ? 30 : 20;
    const grad = ctx.createRadialGradient(c.x - r * 0.22, c.y - r * 0.22, 0, c.x, c.y, r);
    grad.addColorStop(0, "rgba(255, 255, 220, 1)");
    grad.addColorStop(0.28, "rgba(255, 230, 140, 1)");
    grad.addColorStop(0.6, "rgba(255, 200, 40, 1)");
    grad.addColorStop(1, "rgba(255, 135, 20, 1)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.2;
    const a = c.phase;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 0.72, a, a + Math.PI * 0.86);
    ctx.stroke();
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
    render();
  }
}

// --- EVENTS ---

function handleJump() {
  if (isGameOver) return;
  if (!hasStarted) {
    startGame();
  }
  ensureAudio();
  if (player) player.vy = jumpVelocity;
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

function handleBankPurchase(offer) {
    alert("Payment simulated for: " + offer.name);
    totalCoins += offer.coins;
    saveUserData();
    updateCoinUI();
    renderShop();
}

function renderShop() {
  if (!shopGrid) return;
  shopGrid.innerHTML = "";
  SKINS.forEach((skin) => {
    const owned = ownedSkins.includes(skin.id);
    const equipped = currentSkinId === skin.id;
    const canAfford = totalCoins >= skin.price;
    let actionLabel = "";
    let actionClass = "";
    let disabled = false;
    if (!owned) {
      if (skin.price === 0) {
        actionLabel = "Equipped";
        actionClass = "skin-card__action--equipped";
        disabled = true;
      } else if (canAfford) {
        actionLabel = `Buy (${skin.price} 🟡)`;
        actionClass = "skin-card__action--buy";
      } else {
        actionLabel = `Need ${skin.price} 🟡`;
        actionClass = "skin-card__action--need";
        disabled = true;
      }
    } else if (equipped) {
      actionLabel = "Equipped";
      actionClass = "skin-card__action--equipped";
      disabled = true;
    } else {
      actionLabel = "Equip";
      actionClass = "skin-card__action--equip";
    }
    const card = document.createElement("div");
    card.className = "skin-card" + (owned ? " skin-card--owned" : "") + (equipped ? " skin-card--equipped" : "");
    card.dataset.skinId = skin.id;
    const previewStyle = `
      background: linear-gradient(135deg, ${skin.primaryColor}, ${skin.secondaryColor || skin.primaryColor}, ${skin.accentColor || skin.primaryColor});
      color: ${skin.symbolColor || "#ffffff"};
    `;
    card.innerHTML = `
      <div class="skin-card__header">
        <div class="skin-card__name">${skin.name}</div>
        <div class="skin-card__badge">${skin.badge || (skin.price === 0 ? "FREE" : "SKIN")}</div>
      </div>
      <div class="skin-card__preview" style="${previewStyle}">
        ${skin.symbol ? `<span>${skin.symbol}</span>` : ""}
      </div>
      <div class="skin-card__meta">
        <div class="skin-card__price">
          ${skin.price === 0 ? "<span>Базовый скин</span>" : `<span>Цена: <strong>${skin.price}</strong> 🟡</span>`}
        </div>
        <button class="skin-card__action ${actionClass}" data-skin-id="${skin.id}" ${disabled ? "disabled" : ""}>
          ${actionLabel}
        </button>
      </div>
    `;
    shopGrid.appendChild(card);
  });
}

function renderBank() {
  if (!bankGrid) return;
  bankGrid.innerHTML = "";
  BANK_OFFERS.forEach((offer) => {
    const card = document.createElement("div");
    card.className = "bank-card";
    card.dataset.offerId = offer.id;
    card.innerHTML = `
      <div class="bank-card__header">
        <div class="bank-card__name">${offer.name}</div>
        <div class="bank-card__badge">${offer.badge}</div>
      </div>
      <div class="bank-card__preview"><span>${offer.icon}</span></div>
      <div class="bank-card__meta">
        <div class="bank-card__price"><span><strong>${offer.coins.toLocaleString()}</strong></span></div>
        <button class="bank-card__action" data-offer-id="${offer.id}">${offer.stars} ⭐</button>
      </div>
    `;
    bankGrid.appendChild(card);
  });
}

if (shopButton && shopOverlay && shopGrid) {
  shopButton.addEventListener("click", () => { shopOverlay.classList.remove("hidden"); renderShop(); });
  if (shopCloseButton) shopCloseButton.addEventListener("click", () => shopOverlay.classList.add("hidden"));
  shopOverlay.addEventListener("click", (e) => { if (e.target === shopOverlay) shopOverlay.classList.add("hidden"); });
  shopGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".skin-card__action");
    if (!btn) return;
    const skinId = btn.getAttribute("data-skin-id");
    const skin = SKINS.find((s) => s.id === skinId);
    if (!skin) return;
    const owned = ownedSkins.includes(skin.id);
    if (!owned && skin.price > 0) {
      if (totalCoins < skin.price) return;
      totalCoins -= skin.price;
      saveTotalCoins();
      ownedSkins.push(skin.id);
      currentSkinId = skin.id;
      applyCurrentSkin();
      saveSkinState();
      updateCoinUI();
      saveUserData(); 
      renderShop();
      return;
    }
    if (owned && currentSkinId !== skin.id) {
      currentSkinId = skin.id;
      applyCurrentSkin();
      saveSkinState();
      renderShop();
    }
  });
}

if (bankButton && bankOverlay && bankGrid) {
  bankButton.addEventListener("click", () => { bankOverlay.classList.remove("hidden"); renderBank(); });
  if (bankCloseButton) bankCloseButton.addEventListener("click", () => bankOverlay.classList.add("hidden"));
  bankOverlay.addEventListener("click", (e) => { if (e.target === bankOverlay) bankOverlay.classList.add("hidden"); });
  bankGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".bank-card__action");
    if (!btn) return;
    const offerId = btn.getAttribute("data-offer-id");
    const offer = BANK_OFFERS.find((o) => o.id === offerId);
    if (offer) handleBankPurchase(offer);
  });
}

if (leaderboardBtn) {
    leaderboardBtn.addEventListener("click", () => {
        leaderboardOverlay.classList.remove("hidden");
        fetchLeaderboard();
    });
}
if (leaderboardCloseBtn) {
    leaderboardCloseBtn.addEventListener("click", () => leaderboardOverlay.classList.add("hidden"));
}

window.addEventListener("resize", () => {
  resizeCanvas();
  initGameState();
});

// --- FINAL INIT ---
resizeCanvas();
renderShop();
renderBank();
initGameState(); 
render(); 

initUserData().then(() => {
    console.log("Sync complete");
});