/* ============================================================
   Neon Runner — main script
   Version 2.0 (April 2026) — menu, pause, settings, achievements,
   daily rewards, sound, music, platform-aware payments.
   ============================================================ */

(() => {
"use strict";

/* ============================================================
   1. PLATFORM DETECTION
   ============================================================ */
const Platform = {
  isTelegram: !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData),
  isCapacitor: !!(window.Capacitor && window.Capacitor.Plugins),
  hasVibrate: typeof navigator !== "undefined" && typeof navigator.vibrate === "function",
};

/* ============================================================
   2. SUPABASE (graceful offline fallback)
   ============================================================ */
const SUPABASE_URL = "https://rtzzkxkoakeikpupgqym.supabase.co";
const SUPABASE_KEY = "sb_publishable_-EHItCU8f7QcCyP3Hzx_2A_ewvckfLd";

let _supabase = null;
let isOfflineMode = false;
let playerDbId = null;

try {
  if (window.supabase) {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } else {
    isOfflineMode = true;
  }
} catch (err) {
  isOfflineMode = true;
}

/* ============================================================
   3. PERSISTENT STORAGE KEYS
   ============================================================ */
const KEYS = {
  totalCoins: "neonRunner_totalCoins",
  ownedSkins: "neonRunner_ownedSkins",
  currentSkin: "neonRunner_currentSkin",
  highScore: "neonRunner_highScore",
  settings: "neonRunner_settings",
  achievements: "neonRunner_achievements",
  stats: "neonRunner_stats",
  daily: "neonRunner_daily",
  tutorialSeen: "neonRunner_tutorialSeen",
};

/* ============================================================
   4. SKINS (added new ones for v2)
   ============================================================ */
const SKINS = [
  { id: "default",   name: "Neon Core",   price: 0,    primaryColor: "#54ffff", secondaryColor: "#8af7ff", accentColor: "#ff4ee9", borderColor: "rgba(2, 10, 22, 0.9)",  glowColor: "rgba(84, 255, 255, 0.9)", trailBase: "84, 255, 255",  symbol: "",   symbolColor: "#fff",    badge: "FREE" },
  { id: "fire",      name: "Inferno",     price: 300,  primaryColor: "#ff5e00", secondaryColor: "#ffae00", accentColor: "#ff0040", borderColor: "rgba(60, 5, 0, 0.9)",   glowColor: "rgba(255, 80, 0, 0.95)",  trailBase: "255, 100, 0",   symbol: "🔥", symbolColor: "#fff",    badge: "HOT" },
  { id: "batman",    name: "Neo Batman",  price: 500,  primaryColor: "#050608", secondaryColor: "#1b1f2a", accentColor: "#ffd600", borderColor: "rgba(255, 214, 0, 0.9)", glowColor: "rgba(255, 214, 0, 0.95)", trailBase: "255, 214, 0",  symbol: "🦇", symbolColor: "#ffd600", badge: "EPIC" },
  { id: "ufo",       name: "Neon UFO",    price: 800,  primaryColor: "#00e5ff", secondaryColor: "#00ffaa", accentColor: "#00ffaa", borderColor: "#00ffaa",                glowColor: "#00ffaa",                  trailBase: "255, 230, 20",  symbol: "🛸", symbolColor: "#e0fff7", badge: "RARE" },
  { id: "pinkPony",  name: "Pink Pony",   price: 1000, primaryColor: "#ff7ce0", secondaryColor: "#ffb3ff", accentColor: "#7df9ff", borderColor: "rgba(255, 181, 255, 0.95)", glowColor: "rgba(255, 125, 224, 0.95)", trailBase: "255, 20, 200", symbol: "🦄", symbolColor: "#fff",   badge: "MYTHIC" },
  { id: "ghost",     name: "Phantom",     price: 1500, primaryColor: "#a0a0c8", secondaryColor: "#d0d0ff", accentColor: "#8080ff", borderColor: "rgba(255,255,255,0.6)",  glowColor: "rgba(180, 180, 255, 0.9)", trailBase: "200, 200, 255", symbol: "👻", symbolColor: "#fff",   badge: "SPOOKY" },
  { id: "dragon",    name: "Cyber Dragon", price: 2500, primaryColor: "#00ff88", secondaryColor: "#ff00ff", accentColor: "#00ffff", borderColor: "rgba(0,255,200,0.9)",   glowColor: "rgba(0, 255, 136, 0.95)", trailBase: "0, 255, 136",   symbol: "🐉", symbolColor: "#fff",   badge: "LEGEND" },
  { id: "alien",     name: "Xeno",         price: 3500, primaryColor: "#9d00ff", secondaryColor: "#ff00aa", accentColor: "#00ff80", borderColor: "rgba(157,0,255,0.9)",   glowColor: "rgba(157, 0, 255, 0.95)", trailBase: "157, 0, 255",   symbol: "👽", symbolColor: "#caffd0", badge: "ULTRA" },
  { id: "rocket",    name: "Star Rider",   price: 5000, primaryColor: "#ffeb3b", secondaryColor: "#ff9800", accentColor: "#ff5722", borderColor: "rgba(255,235,59,0.9)",  glowColor: "rgba(255, 200, 0, 0.95)", trailBase: "255, 100, 0",   symbol: "🚀", symbolColor: "#fff",   badge: "PRO" },
];

/* ============================================================
   5. BANK OFFERS (per-platform)
   ============================================================ */
const BANK_OFFERS_TG = [
  { id: "coins_500",   productId: "coins_500",   name: "Горсть монет", coins: 500,   stars: 10,  icon: "💰", badge: "BASIC" },
  { id: "coins_2500",  productId: "coins_2500",  name: "Мешок монет",  coins: 2500,  stars: 40,  icon: "💰", badge: "BEST VALUE" },
  { id: "coins_10000", productId: "coins_10000", name: "Сундук монет", coins: 10000, stars: 150, icon: "💎", badge: "SUPER DEAL" },
];
const BANK_OFFERS_GP = [
  { id: "coins_500",   name: "Горсть монет",  coins: 500,   priceUsd: 0.99, productId: "coins_500",   icon: "💰", badge: "BASIC" },
  { id: "coins_2500",  name: "Мешок монет",   coins: 2500,  priceUsd: 3.99, productId: "coins_2500",  icon: "💰", badge: "BEST VALUE" },
  { id: "coins_10000", name: "Сундук монет",  coins: 10000, priceUsd: 9.99, productId: "coins_10000", icon: "💎", badge: "SUPER DEAL" },
];

function getBankOffers() {
  return Platform.isCapacitor ? BANK_OFFERS_GP : BANK_OFFERS_TG;
}

/* ============================================================
   6. ACHIEVEMENTS
   ============================================================ */
const ACHIEVEMENTS = [
  { id: "first_jump",  icon: "👟", name: "Первый прыжок",   desc: "Сделай 1 прыжок",          goal: 1,    reward: 50,   stat: "totalJumps" },
  { id: "score_100",   icon: "💯", name: "Сотня",            desc: "Набери 100 очков",         goal: 100,  reward: 100,  stat: "highScore" },
  { id: "score_500",   icon: "🏃", name: "Бегун",            desc: "Набери 500 очков",         goal: 500,  reward: 300,  stat: "highScore" },
  { id: "score_2000",  icon: "🏆", name: "Чемпион",          desc: "Набери 2000 очков",        goal: 2000, reward: 1000, stat: "highScore" },
  { id: "coins_100",   icon: "🟡", name: "Коллекционер",     desc: "Собери 100 монет",         goal: 100,  reward: 100,  stat: "totalCoinsCollected" },
  { id: "coins_1000",  icon: "💰", name: "Богач",            desc: "Собери 1000 монет",        goal: 1000, reward: 500,  stat: "totalCoinsCollected" },
  { id: "coins_10000", icon: "💎", name: "Магнат",           desc: "Собери 10000 монет",       goal: 10000,reward: 2500, stat: "totalCoinsCollected" },
  { id: "jumps_500",   icon: "🦘", name: "Кенгуру",          desc: "Сделай 500 прыжков",       goal: 500,  reward: 400,  stat: "totalJumps" },
  { id: "deaths_10",   icon: "💀", name: "Без боли нет роста", desc: "Умри 10 раз",            goal: 10,   reward: 200,  stat: "totalDeaths" },
  { id: "owner_5",     icon: "👗", name: "Модник",           desc: "Купи 5 скинов",            goal: 5,    reward: 1000, stat: "ownedSkinsCount" },
];

/* ============================================================
   7. DAILY REWARDS
   ============================================================ */
const DAILY_REWARDS = [50, 100, 150, 250, 400, 600, 1000];

/* ============================================================
   8. STATE
   ============================================================ */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let width = 0, height = 0;
let player = null;
let obstacles = [], particles = [], coins = [], coinParticles = [], powerUps = [], viruses = [];

let baseSpeed, speedMultiplier, maxSpeedMultiplier, elapsedRunTime;
let gravity, jumpVelocity;
let isJumpingAllowed;
let lastTime;
let obstacleSpawnTimer, obstacleSpawnInterval;
let score = 0, roundCoins = 0;
let coinSpawnCooldown, coinGroupPlan;
let rafId = null;
let lavaTime = 0;
let magnetTimer = 0, doubleTimer = 0, shieldTimer = 0;

const MAGNET_DURATION = 7;
const DOUBLE_DURATION = 7;
const SHIELD_DURATION = 10;
const VIRUS_SPAWN_CHANCE = 0.45;
const POWERUP_SPAWN_CHANCE = 0.15;
const MAX_VIRUSES = 2;

// Game state machine
let gameState = "menu"; // 'menu' | 'playing' | 'paused' | 'gameover'

// Persisted state
let totalCoins = 0;
let highScore = 0;
let ownedSkins = ["default"];
let currentSkinId = "default";
let currentSkin = SKINS[0];

const settings = { sfx: true, music: true, vibro: true, hardMode: false };
const stats = { totalJumps: 0, totalDeaths: 0, totalCoinsCollected: 0, longestRun: 0 };
const dailyState = { lastClaim: null, streak: 0 };
const achievementsState = {}; // id -> { claimed, notified }

/* ============================================================
   9. DOM SHORTCUTS
   ============================================================ */
const $ = (id) => document.getElementById(id);
const els = {
  scoreEl: $("scoreValue"),
  coinEl: $("coinValue"),
  finalScoreEl: $("finalScoreValue"),
  roundCoinsEl: $("roundCoinsValue"),
  totalCoinsEl: $("totalCoinsValue"),
  newRecordLine: $("newRecordLine"),
  // overlays
  mainMenu: $("mainMenuOverlay"),
  pause: $("pauseOverlay"),
  gameOver: $("gameOverOverlay"),
  shop: $("shopOverlay"),
  bank: $("bankOverlay"),
  leaderboard: $("leaderboardOverlay"),
  settings: $("settingsOverlay"),
  achievements: $("achievementsOverlay"),
  daily: $("dailyOverlay"),
  tutorial: $("tutorialOverlay"),
  // grids
  shopGrid: $("shopGrid"),
  bankGrid: $("bankGrid"),
  bankSubtitle: $("bankSubtitle"),
  achievementsList: $("achievementsList"),
  dailyGrid: $("dailyGrid"),
  dailyStreakLabel: $("dailyStreakLabel"),
  leaderboardBody: $("leaderboardBody"),
  leaderboardLoading: $("leaderboardLoading"),
  // menu stats
  menuHighScore: $("menuHighScore"),
  menuCoins: $("menuCoins"),
  // toggles
  sfxToggle: $("sfxToggle"),
  musicToggle: $("musicToggle"),
  vibroToggle: $("vibroToggle"),
  hardModeToggle: $("hardModeToggle"),
  // power-up HUD
  powerupHud: $("powerupHud"),
  // float notice
  floatNotice: $("floatNotice"),
};

/* ============================================================
   10. PERSISTENCE
   ============================================================ */
function loadAllProgress() {
  // coins
  const c = parseInt(localStorage.getItem(KEYS.totalCoins) || "0", 10);
  totalCoins = Number.isFinite(c) && c > 0 ? c : 0;

  // high score
  const hs = parseInt(localStorage.getItem(KEYS.highScore) || "0", 10);
  highScore = Number.isFinite(hs) && hs > 0 ? hs : 0;

  // skins
  try {
    const rawOwned = localStorage.getItem(KEYS.ownedSkins);
    if (rawOwned) {
      const arr = JSON.parse(rawOwned);
      if (Array.isArray(arr)) ownedSkins = arr.filter((id) => SKINS.some((s) => s.id === id));
    }
  } catch {}
  if (!ownedSkins.includes("default")) ownedSkins.unshift("default");
  const cur = localStorage.getItem(KEYS.currentSkin);
  currentSkinId = (cur && SKINS.some((s) => s.id === cur)) ? cur : "default";
  currentSkin = SKINS.find((s) => s.id === currentSkinId) || SKINS[0];

  // settings
  try {
    const raw = localStorage.getItem(KEYS.settings);
    if (raw) Object.assign(settings, JSON.parse(raw));
  } catch {}

  // stats
  try {
    const raw = localStorage.getItem(KEYS.stats);
    if (raw) Object.assign(stats, JSON.parse(raw));
  } catch {}

  // achievements
  try {
    const raw = localStorage.getItem(KEYS.achievements);
    if (raw) Object.assign(achievementsState, JSON.parse(raw));
  } catch {}

  // daily
  try {
    const raw = localStorage.getItem(KEYS.daily);
    if (raw) Object.assign(dailyState, JSON.parse(raw));
  } catch {}
}

function saveCoins() { try { localStorage.setItem(KEYS.totalCoins, String(totalCoins)); } catch {} }
function saveHighScore() { try { localStorage.setItem(KEYS.highScore, String(highScore)); } catch {} }
function saveSkins() {
  try {
    localStorage.setItem(KEYS.ownedSkins, JSON.stringify(ownedSkins));
    localStorage.setItem(KEYS.currentSkin, currentSkinId);
  } catch {}
}
function saveSettings() { try { localStorage.setItem(KEYS.settings, JSON.stringify(settings)); } catch {} }
function saveStats() { try { localStorage.setItem(KEYS.stats, JSON.stringify(stats)); } catch {} }
function saveAchievements() { try { localStorage.setItem(KEYS.achievements, JSON.stringify(achievementsState)); } catch {} }
function saveDaily() { try { localStorage.setItem(KEYS.daily, JSON.stringify(dailyState)); } catch {} }

function resetAllProgress() {
  totalCoins = 0; highScore = 0;
  ownedSkins = ["default"]; currentSkinId = "default"; currentSkin = SKINS[0];
  Object.assign(stats, { totalJumps: 0, totalDeaths: 0, totalCoinsCollected: 0, longestRun: 0 });
  for (const k of Object.keys(achievementsState)) delete achievementsState[k];
  Object.assign(dailyState, { lastClaim: null, streak: 0 });
  saveCoins(); saveHighScore(); saveSkins(); saveStats(); saveAchievements(); saveDaily();
}

/* ============================================================
   11. SUPABASE SYNC (best effort)
   ============================================================ */
async function initUserData() {
  if (isOfflineMode || !_supabase) return;
  try {
    const tgUser = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe
      ? window.Telegram.WebApp.initDataUnsafe.user : null;
    const userId = tgUser ? tgUser.id : (parseInt(localStorage.getItem("neonRunner_devId") || "0", 10) || (12345 + Math.floor(Math.random() * 9000)));
    if (!tgUser) localStorage.setItem("neonRunner_devId", String(userId));
    const userName = tgUser ? (tgUser.username || tgUser.first_name) : "Player";

    const { data, error } = await _supabase.from("players").select("*").eq("id", userId).single();
    if (error && error.code !== "PGRST116") throw error;

    if (data) {
      playerDbId = userId;
      // Take server values if higher than local
      if ((data.coins || 0) > totalCoins) { totalCoins = data.coins; saveCoins(); }
      if ((data.high_score || 0) > highScore) { highScore = data.high_score; saveHighScore(); }
      updateAllUI();
    } else {
      await _supabase.from("players").insert([{ id: userId, username: userName, coins: totalCoins, high_score: highScore }]);
      playerDbId = userId;
    }
  } catch (err) {
    isOfflineMode = true;
  }
}

async function syncToServer() {
  if (isOfflineMode || !_supabase || !playerDbId) return;
  try {
    await _supabase.from("players").update({ coins: totalCoins, high_score: highScore }).eq("id", playerDbId);
  } catch {}
}

async function fetchLeaderboard() {
  if (!els.leaderboardBody) return;
  els.leaderboardBody.innerHTML = "";
  if (els.leaderboardLoading) els.leaderboardLoading.style.display = "block";

  if (isOfflineMode || !_supabase) {
    if (els.leaderboardLoading) els.leaderboardLoading.style.display = "none";
    els.leaderboardBody.innerHTML = "<tr><td colspan='3' style='text-align:center'>Offline</td></tr>";
    return;
  }
  try {
    const { data, error } = await _supabase.from("players")
      .select("username, high_score").order("high_score", { ascending: false }).limit(10);
    if (error) throw error;
    if (els.leaderboardLoading) els.leaderboardLoading.style.display = "none";
    data.forEach((p, i) => {
      const tr = document.createElement("tr");
      let style = "";
      if (i === 0) style = "color:#ffd700;font-weight:bold";
      else if (i === 1) style = "color:#c0c0c0;font-weight:bold";
      else if (i === 2) style = "color:#cd7f32;font-weight:bold";
      tr.innerHTML = `<td style="${style}">#${i + 1}</td><td style="${style}">${escapeHtml(p.username || "Anon")}</td><td style="${style}">${p.high_score}</td>`;
      els.leaderboardBody.appendChild(tr);
    });
  } catch {
    if (els.leaderboardLoading) els.leaderboardLoading.style.display = "none";
    els.leaderboardBody.innerHTML = "<tr><td colspan='3' style='text-align:center'>Ошибка</td></tr>";
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

/* ============================================================
   12. AUDIO (WebAudio synthesized — no asset files needed)
   ============================================================ */
let audioCtx = null;
let musicNode = null;
let musicGain = null;
let musicInterval = null;

function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { return null; }
  }
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

function sfx(type) {
  if (!settings.sfx) return;
  const ac = ensureAudio();
  if (!ac) return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  switch (type) {
    case "jump":
      osc.type = "square";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.10, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);
      osc.start(now); osc.stop(now + 0.12);
      break;
    case "coin":
      osc.type = "triangle";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.06);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.start(now); osc.stop(now + 0.1);
      break;
    case "powerup":
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.start(now); osc.stop(now + 0.25);
      break;
    case "hit":
      osc.type = "square";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      osc.start(now); osc.stop(now + 0.5);
      break;
    case "click":
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.start(now); osc.stop(now + 0.08);
      break;
    case "achievement":
      // Two-tone fanfare
      const o2 = ac.createOscillator();
      const g2 = ac.createGain();
      o2.connect(g2); g2.connect(ac.destination);
      osc.type = "triangle"; o2.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.24); // G5
      o2.frequency.setValueAtTime(261.63, now); o2.frequency.setValueAtTime(329.63, now + 0.12); o2.frequency.setValueAtTime(392, now + 0.24);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.50);
      g2.gain.setValueAtTime(0.0001, now);
      g2.gain.exponentialRampToValueAtTime(0.10, now + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.50);
      osc.start(now); osc.stop(now + 0.55);
      o2.start(now); o2.stop(now + 0.55);
      break;
    default:
      osc.start(now); osc.stop(now + 0.05);
  }
}

function vibrate(pattern) {
  if (!settings.vibro) return;
  if (Platform.hasVibrate) {
    try { navigator.vibrate(pattern); } catch {}
  }
  if (Platform.isTelegram && window.Telegram.WebApp.HapticFeedback) {
    try {
      const style = Array.isArray(pattern) ? "medium" : (pattern > 30 ? "heavy" : "light");
      window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
    } catch {}
  }
}

// Procedural ambient music (simple arpeggio)
const MUSIC_NOTES = [261.63, 329.63, 392, 523.25, 392, 329.63]; // C-E-G-C-G-E
let musicStep = 0;
function startMusic() {
  if (!settings.music || musicInterval) return;
  const ac = ensureAudio();
  if (!ac) return;
  if (!musicGain) {
    musicGain = ac.createGain();
    musicGain.gain.value = 0.04;
    musicGain.connect(ac.destination);
  }
  const playNote = () => {
    if (!settings.music || !audioCtx) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "triangle";
    o.frequency.value = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
    musicStep++;
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.04, ac.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.45);
    o.connect(g); g.connect(musicGain);
    o.start(); o.stop(ac.currentTime + 0.5);
  };
  musicInterval = setInterval(playNote, 350);
  playNote();
}
function stopMusic() {
  if (musicInterval) { clearInterval(musicInterval); musicInterval = null; }
}

/* ============================================================
   13. PAYMENTS — platform-aware
   ============================================================ */
async function purchaseCoinsPlatform(offer) {
  // -----------------------------------------------------------------
  // Capacitor / Google Play Billing (Android)
  // -----------------------------------------------------------------
  if (Platform.isCapacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GooglePlayBilling) {
    try {
      const result = await window.Capacitor.Plugins.GooglePlayBilling.purchase({ productId: offer.productId });
      if (result && result.success) {
        addCoins(offer.coins);
        showFloatNotice(`+${offer.coins.toLocaleString()} монет`);
        sfx("achievement");
        return true;
      }
    } catch (e) {
      alert("Ошибка покупки: " + (e.message || e));
    }
    return false;
  }

  // -----------------------------------------------------------------
  // Telegram Stars — REAL payment via Supabase Edge Function
  // -----------------------------------------------------------------
  if (Platform.isTelegram && window.Telegram.WebApp.openInvoice) {
    try {
      const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
      const userId = tgUser?.id ? String(tgUser.id) : null;
      if (!userId) {
        alert("Не удалось определить Telegram-аккаунт. Запустите игру через бота.");
        return false;
      }
      const username = tgUser?.username || tgUser?.first_name || "Player";

      // 1. Ask backend to create an invoice link
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "apikey": SUPABASE_KEY,
        },
        body: JSON.stringify({ productId: offer.productId, userId, username }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      const data = await res.json();
      if (!data.invoiceUrl) throw new Error(data.error || "no invoice url");

      // 2. Open the Telegram payment UI
      return await new Promise((resolve) => {
        window.Telegram.WebApp.openInvoice(data.invoiceUrl, async (status) => {
          if (status === "paid") {
            sfx("achievement");
            // 3. Backend webhook will credit coins; refresh balance from server
            await refreshBalanceFromServer();
            showFloatNotice(`+${offer.coins.toLocaleString()} монет`);
            resolve(true);
          } else if (status === "cancelled") {
            resolve(false);
          } else if (status === "failed") {
            alert("Оплата не прошла. Попробуйте снова.");
            resolve(false);
          } else {
            // pending — поллим баланс
            await refreshBalanceFromServer();
            resolve(false);
          }
        });
      });
    } catch (e) {
      console.error("Telegram payment error:", e);
      alert("Ошибка оплаты: " + (e.message || e));
      return false;
    }
  }

  // -----------------------------------------------------------------
  // Web simulation (only outside Telegram & Capacitor)
  // -----------------------------------------------------------------
  const ok = confirm(`Симуляция оплаты (вне Telegram): получить ${offer.coins.toLocaleString()} монет?`);
  if (ok) {
    addCoins(offer.coins);
    showFloatNotice(`+${offer.coins.toLocaleString()} монет`);
    sfx("achievement");
    return true;
  }
  return false;
}

// Pull authoritative coin balance from Supabase (after a Telegram purchase)
async function refreshBalanceFromServer() {
  if (isOfflineMode || !_supabase || !playerDbId) return;
  try {
    const { data, error } = await _supabase
      .from("players")
      .select("coins, high_score")
      .eq("id", playerDbId)
      .single();
    if (error) throw error;
    if (data && typeof data.coins === "number" && data.coins > totalCoins) {
      totalCoins = data.coins;
      saveCoins();
      updateAllUI();
    }
  } catch (e) {
    console.warn("refreshBalanceFromServer failed", e);
  }
}

function addCoins(amount) {
  totalCoins += amount;
  saveCoins();
  syncToServer();
  updateAllUI();
}

/* ============================================================
   14. UI HELPERS
   ============================================================ */
function showFloatNotice(text) {
  if (!els.floatNotice) return;
  const div = document.createElement("div");
  div.className = "float-notice__item";
  div.textContent = text;
  els.floatNotice.appendChild(div);
  setTimeout(() => { try { els.floatNotice.removeChild(div); } catch {} }, 1100);
}

function updateAllUI() {
  if (els.coinEl) els.coinEl.textContent = String(totalCoins);
  if (els.totalCoinsEl) els.totalCoinsEl.textContent = String(totalCoins);
  if (els.menuCoins) els.menuCoins.textContent = String(totalCoins);
  if (els.menuHighScore) els.menuHighScore.textContent = String(highScore);
  if (els.roundCoinsEl) els.roundCoinsEl.textContent = String(roundCoins);
  if (els.scoreEl) els.scoreEl.textContent = String(Math.floor(score));
  if (els.sfxToggle) els.sfxToggle.checked = settings.sfx;
  if (els.musicToggle) els.musicToggle.checked = settings.music;
  if (els.vibroToggle) els.vibroToggle.checked = settings.vibro;
  if (els.hardModeToggle) els.hardModeToggle.checked = settings.hardMode;
}

function closeAllOverlays() {
  document.querySelectorAll(".overlay").forEach((o) => o.classList.add("hidden"));
}

function showOverlay(el) {
  closeAllOverlays();
  if (el) el.classList.remove("hidden");
}

/* ============================================================
   15. ACHIEVEMENTS LOGIC
   ============================================================ */
function getStatValue(stat) {
  if (stat === "ownedSkinsCount") return ownedSkins.length;
  if (stat === "highScore") return highScore;
  return stats[stat] || 0;
}

function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    const cur = getStatValue(a.stat);
    const state = achievementsState[a.id] || (achievementsState[a.id] = { claimed: false, notified: false });
    if (!state.notified && cur >= a.goal) {
      state.notified = true;
      saveAchievements();
      showFloatNotice(`🏅 ${a.name}`);
      sfx("achievement");
    }
  }
}

function claimAchievement(id) {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return;
  const state = achievementsState[id] || (achievementsState[id] = { claimed: false, notified: false });
  if (state.claimed) return;
  if (getStatValue(a.stat) < a.goal) return;
  state.claimed = true;
  addCoins(a.reward);
  showFloatNotice(`+${a.reward} монет`);
  sfx("coin");
  saveAchievements();
  renderAchievements();
}

function renderAchievements() {
  if (!els.achievementsList) return;
  els.achievementsList.innerHTML = "";
  for (const a of ACHIEVEMENTS) {
    const cur = Math.min(getStatValue(a.stat), a.goal);
    const state = achievementsState[a.id] || { claimed: false };
    const ready = cur >= a.goal && !state.claimed;
    const done = state.claimed;
    const card = document.createElement("div");
    card.className = "ach-card" + (done ? " ach-card--done" : "") + (ready ? " ach-card--ready" : "");
    const pct = Math.round((cur / a.goal) * 100);
    card.innerHTML = `
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-info">
        <div class="ach-name">${escapeHtml(a.name)}</div>
        <div class="ach-desc">${escapeHtml(a.desc)} (${cur}/${a.goal})</div>
        <div class="ach-progress"><div class="ach-progress__bar" style="width:${pct}%"></div></div>
      </div>
      ${done
        ? `<div class="ach-reward">✅ +${a.reward}</div>`
        : ready
          ? `<button class="ach-claim-btn" data-claim="${a.id}">+${a.reward} 🟡</button>`
          : `<div class="ach-reward">+${a.reward} 🟡</div>`}
    `;
    els.achievementsList.appendChild(card);
  }
}

/* ============================================================
   16. DAILY REWARDS
   ============================================================ */
function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function yesterdayKey(t) {
  const d = new Date(t + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function canClaimDailyToday() {
  return dailyState.lastClaim !== todayKey();
}
function renderDaily() {
  if (!els.dailyGrid) return;
  els.dailyGrid.innerHTML = "";
  const day = (dailyState.streak % DAILY_REWARDS.length);
  for (let i = 0; i < DAILY_REWARDS.length; i++) {
    const d = document.createElement("div");
    d.className = "daily-day"
      + (i < day ? " daily-day--done" : "")
      + (i === day && canClaimDailyToday() ? " daily-day--today" : "");
    d.innerHTML = `<div class="daily-day__num">День ${i + 1}</div><div class="daily-day__amt">${DAILY_REWARDS[i]} 🟡</div>`;
    els.dailyGrid.appendChild(d);
  }
  if (els.dailyStreakLabel) {
    els.dailyStreakLabel.textContent = `Текущая серия: ${dailyState.streak} дн.${canClaimDailyToday() ? " — награда готова!" : " — заходи завтра"}`;
  }
  const claimBtn = $("claimDailyButton");
  if (claimBtn) claimBtn.disabled = !canClaimDailyToday();
}
function claimDaily() {
  if (!canClaimDailyToday()) return;
  // Streak: if last claim was yesterday, increment; else reset
  const today = todayKey();
  const lastWasYesterday = dailyState.lastClaim && yesterdayKey(dailyState.lastClaim) === today;
  dailyState.streak = lastWasYesterday ? (dailyState.streak + 1) : 1;
  dailyState.lastClaim = today;
  saveDaily();
  const reward = DAILY_REWARDS[(dailyState.streak - 1) % DAILY_REWARDS.length];
  addCoins(reward);
  showFloatNotice(`+${reward} монет`);
  sfx("achievement");
  renderDaily();
}

/* ============================================================
   17. CANVAS / GAME
   ============================================================ */
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  width = rect.width * dpr;
  height = rect.height * dpr;
  canvas.width = width;
  canvas.height = height;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function getJumpFlightTimeSec() {
  const v = Math.abs(jumpVelocity);
  return (2 * v) / gravity;
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function initGameState() {
  const baseUnit = Math.min(canvas.clientWidth, canvas.clientHeight || 400);
  const playerSize = baseUnit * 0.07;
  player = {
    x: canvas.clientWidth * 0.16,
    y: canvas.clientHeight * 0.5 - playerSize / 2,
    width: playerSize, height: playerSize,
    vy: 0, onGround: true, trail: [],
  };
  obstacles = []; particles = []; coins = []; coinParticles = []; powerUps = []; viruses = [];
  magnetTimer = 0; doubleTimer = 0; shieldTimer = 0;

  const hardMul = settings.hardMode ? 1.4 : 1.0;
  baseSpeed = canvas.clientWidth * 0.38 * 0.7 * hardMul;
  speedMultiplier = 1;
  maxSpeedMultiplier = 2.1;
  elapsedRunTime = 0;
  gravity = canvas.clientHeight * 2.2;
  jumpVelocity = -canvas.clientHeight * 0.5;
  isJumpingAllowed = true;
  lastTime = performance.now();
  obstacleSpawnTimer = -2200;
  obstacleSpawnInterval = 1200;
  score = 0;
  roundCoins = 0;
  coinSpawnCooldown = 0;
  coinGroupPlan = null;

  if (els.scoreEl) els.scoreEl.textContent = "0";
  if (els.finalScoreEl) els.finalScoreEl.textContent = "0";
  updatePowerupHud();
  updateAllUI();
}

function startGame() {
  initGameState();
  gameState = "playing";
  closeAllOverlays();
  ensureAudio();
  startMusic();
  lastTime = performance.now();
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(gameLoop);
}

function pauseGame() {
  if (gameState !== "playing") return;
  gameState = "paused";
  showOverlay(els.pause);
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
}
function resumeGame() {
  if (gameState !== "paused") return;
  gameState = "playing";
  closeAllOverlays();
  lastTime = performance.now();
  rafId = requestAnimationFrame(gameLoop);
}
function goToMenu() {
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  gameState = "menu";
  stopMusic();
  initGameState();
  showOverlay(els.mainMenu);
  updateAllUI();
  render(); // single frame so background not blank
}

function handleJump() {
  if (gameState !== "playing") return;
  ensureAudio();
  if (player) {
    player.vy = jumpVelocity;
    stats.totalJumps += 1;
    saveStats();
    sfx("jump");
    vibrate(15);
    checkAchievements();
  }
}

/* ============================================================
   18. SPAWNING
   ============================================================ */
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

  const coinCount = 3 + Math.floor(Math.random() * 3);
  const coinRadius = clamp(baseUnit * 0.018, 6, 12);
  const coinY = gapCenter;
  const startX = topObstacle.x + obstacleWidth + clamp(baseUnit * 0.12, 40, 72);
  const stepX = clamp(baseUnit * 0.085, 34, 64);

  if (Math.random() < POWERUP_SPAWN_CHANCE) {
    const r = Math.random();
    let type = "magnet";
    if (r > 0.33) type = "double";
    if (r > 0.66) type = "shield";
    const puR = baseUnit * 0.027;
    const puX = topObstacle.x + obstacleWidth + clamp(baseUnit * 0.12, 40, 72) + 50;
    const puY = clamp(gapCenter + (Math.random() - 0.5) * playerHeight * 0.6, gapTop + puR, gapBottom - puR);
    powerUps.push({ type, x: puX, y: puY, r: puR });
  }

  if (Math.random() < VIRUS_SPAWN_CHANCE && viruses.length < MAX_VIRUSES) {
    const vR = clamp(baseUnit * (0.020 + Math.random() * 0.02), 10, 22);
    const vX = topObstacle.x + obstacleWidth + clamp(baseUnit * 0.14, 44, 84);
    const vY = clamp(gapCenter + (Math.random() - 0.5) * gapSize * 0.55, gapTop + vR + 20, gapBottom - vR - 20);
    viruses.push({ x: vX, y: vY, baseY: vY, r: vR, phase: Math.random() * Math.PI * 2, amp: 8 + Math.random() * 22, speed: 1 + Math.random() * 1.6 });
  }

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
  if (coinOverlapsObstacle(x, y, r)) return false;
  coins.push({ x, y, r, phase: Math.random() * Math.PI * 2, spin: (Math.random() < 0.5 ? -1 : 1) * (1.8 + Math.random() * 1.4), collected: false, meta });
  return true;
}
function coinOverlapsObstacle(cx, cy, r) {
  for (const o of obstacles) {
    const pad = 6;
    const ox = o.x - pad, oy = o.y - pad, ow = o.width + pad * 2, oh = o.height + pad * 2;
    const closestX = clamp(cx, ox, ox + ow);
    const closestY = clamp(cy, oy, oy + oh);
    const dx = cx - closestX, dy = cy - closestY;
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

/* ============================================================
   19. UPDATE
   ============================================================ */
function update(delta) {
  if (gameState !== "playing" || !player) return;
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

  let trailOffsetY = player.height / 2;
  if (currentSkinId === "ufo") trailOffsetY = player.height * 0.85;
  player.trail.push({ x: player.x + player.width / 2, y: player.y + trailOffsetY, life: 1, vx: -currentSpeed * 0.35 });
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

  // Coins (with magnet)
  coins.forEach((c) => {
    if (magnetTimer > 0) {
      const pxC = player.x + player.width / 2;
      const pyC = player.y + player.height / 2;
      const dx = pxC - c.x, dy = pyC - c.y;
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

  // Score
  const hardScoreMul = settings.hardMode ? 1.6 : 1.0;
  score += dt * 10 * speedMultiplier * hardScoreMul;
  if (els.scoreEl) els.scoreEl.textContent = Math.floor(score).toString();

  // Hitbox
  const hitPadding = Math.max(5, Math.min(10, player.width * 0.14));
  const px = player.x + hitPadding, py = player.y + hitPadding;
  const pw = Math.max(1, player.width - hitPadding * 2);
  const ph = Math.max(1, player.height - hitPadding * 2);

  // Ceiling/ground death
  if (player.y <= 0 || player.y + player.height >= groundY) {
    if (shieldTimer > 0) { useShield(); player.y = clamp(player.y, 5, groundY - player.height - 5); player.vy = jumpVelocity * 0.5; }
    else { triggerGameOver(); return; }
  }

  // Coin collection
  for (const c of coins) {
    if (c.collected) continue;
    const closestX = clamp(c.x, px, px + pw);
    const closestY = clamp(c.y, py, py + ph);
    const dx = c.x - closestX, dy = c.y - closestY;
    if (dx * dx + dy * dy <= c.r * c.r) {
      c.collected = true;
      const baseGain = doubleTimer > 0 ? 2 : 1;
      const hardMul = settings.hardMode ? 3 : 1;
      const gain = baseGain * hardMul;
      roundCoins += gain;
      totalCoins += gain;
      stats.totalCoinsCollected += gain;
      saveCoins(); saveStats();
      updateAllUI();
      sfx("coin");
      const count = 14;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const sp = 120 + Math.random() * 160;
        coinParticles.push({ x: c.x, y: c.y, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, life: 0.35 + Math.random() * 0.15 });
      }
    }
  }

  // Power-ups
  for (const pu of powerUps) {
    pu.x -= currentSpeed * dt;
    pu.y += Math.sin((elapsedRunTime * 3) + (pu.x % 1)) * 6 * dt;
    const closestX = clamp(pu.x, px, px + pw);
    const closestY = clamp(pu.y, py, py + ph);
    const dx = pu.x - closestX, dy = pu.y - closestY;
    if (dx * dx + dy * dy <= (pu.r || 10) * (pu.r || 10)) {
      if (pu.type === "magnet") magnetTimer = MAGNET_DURATION;
      else if (pu.type === "shield") shieldTimer = SHIELD_DURATION;
      else if (pu.type === "double") {
        doubleTimer = DOUBLE_DURATION;
        const coinsCopy = [...coins];
        const secondYOffset = -Math.max(10, player.height * 0.18 + 15);
        coinsCopy.forEach((c) => {
          if (!c.collected && c.x > player.x && (!c.meta || c.meta.row !== 2)) {
            coins.push({ x: c.x, y: c.y + secondYOffset, r: c.r, phase: c.phase, spin: c.spin, collected: false, meta: { row: 2 } });
          }
        });
      }
      pu._consumed = true;
      sfx("powerup");
      vibrate(10);
      showFloatNotice(pu.type === "magnet" ? "🧲 Магнит!" : pu.type === "double" ? "×2 Двойные монеты!" : "🛡 Щит!");
    }
  }
  powerUps = powerUps.filter((p) => !p._consumed && p.x + (p.r || 0) > -40);

  // Viruses
  for (const v of viruses) {
    v.phase += dt * v.speed;
    v.y = v.baseY + Math.sin(v.phase) * v.amp;
    v.x -= currentSpeed * dt;
    const cxV = clamp(v.x, px, px + pw);
    const cyV = clamp(v.y, py, py + ph);
    const dxV = v.x - cxV, dyV = v.y - cyV;
    if (dxV * dxV + dyV * dyV <= v.r * v.r) {
      if (shieldTimer > 0) { useShield(); v.x = -999; }
      else { triggerGameOver(); return; }
    }
  }
  viruses = viruses.filter((v) => v.x + v.r > -60);

  // Obstacle collision
  for (const o of obstacles) {
    if (px < o.x + o.width && px + pw > o.x && py < o.y + o.height && py + ph > o.y) {
      if (shieldTimer > 0) { useShield(); o.x = -999; }
      else { triggerGameOver(); break; }
    }
  }

  updatePowerupHud();
}

function useShield() {
  shieldTimer = 0;
  const cx = player.x + player.width / 2, cy = player.y + player.height / 2;
  for (let i = 0; i < 20; i++) {
    particles.push({ x: cx, y: cy, vx: (Math.random() - 0.5) * 500, vy: (Math.random() - 0.5) * 500, life: 0.5, color: "rgba(191, 0, 255, 1)" });
  }
  vibrate(25);
  sfx("powerup");
}

function triggerGameOver() {
  if (gameState === "gameover") return;
  gameState = "gameover";
  stats.totalDeaths += 1;
  if (Math.floor(score) > stats.longestRun) stats.longestRun = Math.floor(score);
  saveStats();
  const isNewRecord = Math.floor(score) > highScore;
  if (isNewRecord) {
    highScore = Math.floor(score);
    saveHighScore();
    syncToServer();
  } else {
    syncToServer();
  }
  if (els.finalScoreEl) els.finalScoreEl.textContent = Math.floor(score).toString();
  if (els.newRecordLine) els.newRecordLine.style.display = isNewRecord ? "block" : "none";
  updateAllUI();
  showOverlay(els.gameOver);
  sfx("hit");
  vibrate([40, 60, 40]);
  checkAchievements();

  // Explosion
  const centerX = player.x + player.width / 2, centerY = player.y + player.height / 2;
  const count = 36;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 200 + Math.random() * 260;
    particles.push({ x: centerX, y: centerY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.7 + Math.random() * 0.3, color: Math.random() < 0.5 ? "rgba(84, 255, 255, 1)" : "rgba(255, 78, 233, 1)" });
  }
  // keep particle anim going
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(particleLoop);
}

function particleLoop(timestamp) {
  let delta = timestamp - lastTime;
  if (delta > 50) delta = 50;
  lastTime = timestamp;
  const dt = delta / 1000;
  particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
  particles = particles.filter((p) => p.life > 0);
  coinParticles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
  coinParticles = coinParticles.filter((p) => p.life > 0);
  render();
  if ((particles.length > 0 || coinParticles.length > 0) && gameState === "gameover") {
    rafId = requestAnimationFrame(particleLoop);
  } else {
    rafId = null;
  }
}

function updatePowerupHud() {
  if (!els.powerupHud) return;
  const chips = els.powerupHud.querySelectorAll(".pu-chip");
  chips.forEach((chip) => {
    const t = chip.dataset.pu;
    const sec = t === "magnet" ? magnetTimer : t === "double" ? doubleTimer : t === "shield" ? shieldTimer : 0;
    const timeEl = chip.querySelector(".pu-time");
    if (sec > 0.05) {
      chip.classList.remove("hidden");
      if (timeEl) timeEl.textContent = sec.toFixed(1);
    } else {
      chip.classList.add("hidden");
    }
  });
}

/* ============================================================
   20. DRAWING
   ============================================================ */
function drawBackground() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
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
  function drawLava(y) {
    const grad = ctx.createLinearGradient(-w * 0.7, 0, w * 1.7, 0);
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
  drawLava(0);
  drawLava(groundY - lavaHeight);

  ctx.save();
  ctx.strokeStyle = "rgba(0, 255, 255, 0.11)";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 42) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x + 60, h);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTrail() {
  if (!player) return;
  for (const p of player.trail) {
    const alpha = p.life;
    const radius = (player.width * 0.55 * (2 - p.life)) / 2;
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    const tb = currentSkin.trailBase;
    gradient.addColorStop(0, `rgba(${tb}, ${0.9 * alpha})`);
    gradient.addColorStop(0.6, `rgba(${tb}, ${0.4 * alpha})`);
    gradient.addColorStop(1, `rgba(${tb}, 0)`);
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
  const cx = x + w / 2, cy = y + h / 2;

  if (shieldTimer > 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(lavaTime);
    ctx.shadowBlur = 40;
    ctx.shadowColor = "#d600ff";
    ctx.strokeStyle = `rgba(214, 0, 255, ${0.8 + Math.sin(lavaTime * 8) * 0.2})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = i * Math.PI / 3;
      const r = w * 1.4;
      ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = `rgba(214, 0, 255, ${0.1 + Math.sin(lavaTime * 4) * 0.05})`;
    ctx.fill();
    ctx.restore();
  }
  if (magnetTimer > 0) {
    ctx.save();
    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 20;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0, 255, 255, 0.8)";
    ctx.beginPath();
    ctx.arc(cx, cy, w * 1.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (doubleTimer > 0) {
    const gPulse = 0.6 + 0.4 * Math.sin(lavaTime * 5);
    const rg = ctx.createRadialGradient(cx, cy, w * 0.2, cx, cy, w * 1.8);
    rg.addColorStop(0, `rgba(255,235,150,${0.28 * gPulse})`);
    rg.addColorStop(0.45, `rgba(255,195,80,${0.16 * gPulse})`);
    rg.addColorStop(0.85, `rgba(255,150,30,${0.06 * gPulse})`);
    rg.addColorStop(1, "rgba(255,140,0,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (skin.symbol) {
    const fontSize = h * 1.3;
    ctx.save();
    ctx.translate(cx, cy);
    if (skin.id === "batman" || skin.id === "pinkPony") ctx.scale(-1, 1);
    ctx.shadowColor = skin.glowColor;
    ctx.shadowBlur = 28;
    ctx.font = `${fontSize}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = skin.symbolColor || "#fff";
    ctx.fillText(skin.symbol, 0, 2);
    ctx.restore();
  } else {
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
    const baseHue = 180 + o.hueOffset;
    const colorA = `hsl(${baseHue}, 100%, 60%)`;
    const colorB = `hsl(${baseHue + 60}, 100%, 60%)`;
    ctx.save();
    ctx.shadowColor = "rgba(255, 0, 200, 0.9)";
    ctx.shadowBlur = 24;
    const grad = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.height);
    grad.addColorStop(0, colorA);
    grad.addColorStop(1, colorB);
    ctx.fillStyle = grad;
    const r = 6;
    ctx.beginPath();
    ctx.moveTo(o.x + r, o.y);
    ctx.lineTo(o.x + o.width - r, o.y);
    ctx.quadraticCurveTo(o.x + o.width, o.y, o.x + o.width, o.y + r);
    ctx.lineTo(o.x + o.width, o.y + o.height - r);
    ctx.quadraticCurveTo(o.x + o.width, o.y + o.height, o.x + o.width - r, o.y + o.height);
    ctx.lineTo(o.x + r, o.y + o.height);
    ctx.quadraticCurveTo(o.x, o.y + o.height, o.x, o.y + o.height - r);
    ctx.lineTo(o.x, o.y + r);
    ctx.quadraticCurveTo(o.x, o.y, o.x + r, o.y);
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
    const x = pu.x, y = pu.y, r = pu.r;
    ctx.save();
    ctx.translate(x, y);
    const auraSize = r * (1.3 + 0.1 * Math.sin(lavaTime * 4));
    let aS, aE;
    if (pu.type === "magnet") { aS = "rgba(0, 255, 255, 0.4)"; aE = "rgba(0, 255, 255, 0)"; }
    else if (pu.type === "double") { aS = "rgba(255, 215, 0, 0.4)"; aE = "rgba(255, 215, 0, 0)"; }
    else { aS = "rgba(191, 0, 255, 0.4)"; aE = "rgba(191, 0, 255, 0)"; }
    const grad = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, auraSize);
    grad.addColorStop(0, aS);
    grad.addColorStop(1, aE);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, auraSize, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    if (pu.type === "magnet") {
      ctx.shadowColor = "rgba(84,255,255,0.95)";
      ctx.shadowBlur = 25;
      ctx.lineWidth = Math.max(4, r * 0.35);
      ctx.lineCap = "round";
      ctx.strokeStyle = "#00ffff";
      ctx.beginPath();
      ctx.arc(x, y - r * 0.2, r * 0.6, Math.PI, 0, false);
      ctx.moveTo(x - r * 0.6, y); ctx.lineTo(x - r * 0.6, y - r * 0.7);
      ctx.moveTo(x + r * 0.6, y); ctx.lineTo(x + r * 0.6, y - r * 0.7);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.shadowBlur = 10;
      ctx.fillRect(x - r * 0.85, y - r * 0.9, r * 0.5, r * 0.3);
      ctx.fillRect(x + r * 0.35, y - r * 0.9, r * 0.5, r * 0.3);
    } else if (pu.type === "double") {
      ctx.shadowColor = "rgba(255,214,0,0.98)";
      ctx.shadowBlur = 28;
      const grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, 0, x, y, r);
      grad.addColorStop(0, "rgba(255,255,230,1)");
      grad.addColorStop(0.35, "rgba(255,220,70,1)");
      grad.addColorStop(1, "rgba(255,150,20,1)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(30,18,0,0.9)";
      ctx.font = Math.floor(r * 1.2) + "px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("$", x, y);
    } else {
      ctx.shadowColor = "#bf00ff"; ctx.shadowBlur = 25;
      ctx.fillStyle = "#bf00ff";
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 10);
      ctx.lineTo(x + 10, y - 10);
      ctx.lineTo(x + 10, y);
      ctx.quadraticCurveTo(x, y + 15, x - 10, y);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
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
    ctx.beginPath(); ctx.arc(0, 0, coreR, 0, Math.PI * 2); ctx.fill();
    for (let s = 0; s < 8; s++) {
      const ang = (Math.PI * 2 * s) / 8 + t * 0.8;
      ctx.beginPath();
      const sx = Math.cos(ang) * (coreR * 0.9);
      const sy = Math.sin(ang) * (coreR * 0.9);
      const ex = Math.cos(ang) * coreR * 1.6;
      const ey = Math.sin(ang) * coreR * 1.6;
      ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
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
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.2;
    const a = c.phase;
    ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.72, a, a + Math.PI * 0.86); ctx.stroke();
    ctx.strokeStyle = "rgba(20,10,0,0.55)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.62, 0, Math.PI * 2); ctx.stroke();
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
  if (gameState === "playing") {
    update(delta);
    render();
    rafId = requestAnimationFrame(gameLoop);
  } else {
    // For paused/menu/gameover we still want particles to animate gently — but keep simple:
    rafId = requestAnimationFrame(gameLoop);
  }
}

/* ============================================================
   21. SHOP / BANK RENDER
   ============================================================ */
function renderShop() {
  if (!els.shopGrid) return;
  els.shopGrid.innerHTML = "";
  SKINS.forEach((skin) => {
    const owned = ownedSkins.includes(skin.id);
    const equipped = currentSkinId === skin.id;
    const card = document.createElement("div");
    card.className = "skin-card";
    if (equipped) card.classList.add("skin-card--equipped");
    if (owned && !equipped) card.classList.add("skin-card--owned");

    const preview = document.createElement("div");
    preview.className = "skin-preview";
    preview.style.background = `linear-gradient(135deg, ${skin.primaryColor}, ${skin.secondaryColor})`;
    preview.style.boxShadow = `0 0 24px ${skin.glowColor}`;
    if (skin.symbol) {
      const sym = document.createElement("span");
      sym.textContent = skin.symbol;
      sym.style.fontSize = "28px";
      preview.appendChild(sym);
    }

    const name = document.createElement("div");
    name.className = "skin-name";
    name.textContent = skin.name;

    const badge = document.createElement("div");
    badge.className = "skin-badge";
    badge.textContent = skin.badge || "";

    const btn = document.createElement("button");
    btn.className = "btn-primary skin-btn";
    if (equipped) {
      btn.textContent = "В использовании";
      btn.disabled = true;
    } else if (owned) {
      btn.textContent = "Надеть";
      btn.addEventListener("click", () => {
        currentSkinId = skin.id;
        currentSkin = skin;
        saveSkins();
        sfx("click");
        renderShop();
      });
    } else {
      btn.textContent = `Купить · ${skin.price} 🪙`;
      btn.addEventListener("click", () => {
        if (totalCoins >= skin.price) {
          totalCoins -= skin.price;
          ownedSkins.push(skin.id);
          currentSkinId = skin.id;
          currentSkin = skin;
          saveCoins();
          saveSkins();
          syncToServer();
          updateAllUI();
          sfx("achievement");
          showFloatNotice(`Куплено: ${skin.name}`);
          checkAchievements();
          renderShop();
        } else {
          showFloatNotice("Не хватает монет");
          sfx("hit");
        }
      });
    }

    card.appendChild(preview);
    card.appendChild(name);
    if (skin.badge) card.appendChild(badge);
    card.appendChild(btn);
    els.shopGrid.appendChild(card);
  });
}

function renderBank() {
  if (!els.bankGrid) return;
  els.bankGrid.innerHTML = "";
  const offers = getBankOffers();
  if (els.bankSubtitle) {
    els.bankSubtitle.textContent = Platform.isCapacitor
      ? "Купите монеты через Google Play"
      : (Platform.isTelegram ? "Оплата через Telegram Stars ⭐" : "Тестовый режим (web)");
  }
  offers.forEach((offer) => {
    const card = document.createElement("div");
    card.className = "bank-card";
    const icon = document.createElement("div");
    icon.className = "bank-icon";
    icon.textContent = offer.icon || "💰";
    const name = document.createElement("div");
    name.className = "bank-name";
    name.textContent = offer.name;
    const coins = document.createElement("div");
    coins.className = "bank-coins";
    coins.textContent = `${offer.coins.toLocaleString()} монет`;
    const badge = document.createElement("div");
    badge.className = "bank-badge";
    badge.textContent = offer.badge || "";
    const btn = document.createElement("button");
    btn.className = "btn-primary";
    btn.textContent = Platform.isCapacitor
      ? `$${offer.priceUsd}`
      : (Platform.isTelegram ? `${offer.stars} ⭐` : `Получить (тест)`);
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      await purchaseCoinsPlatform(offer);
      btn.disabled = false;
    });
    card.appendChild(icon);
    card.appendChild(name);
    card.appendChild(coins);
    if (offer.badge) card.appendChild(badge);
    card.appendChild(btn);
    els.bankGrid.appendChild(card);
  });
}

/* ============================================================
   22. EVENTS
   ============================================================ */
function afterCloseOverlay() {
  if (gameState === "playing") {
    lastTime = performance.now();
    if (rafId === null) rafId = requestAnimationFrame(gameLoop);
  } else if (gameState === "menu") {
    showOverlay(els.mainMenu);
  } else if (gameState === "paused") {
    showOverlay(els.pause);
  } else if (gameState === "gameover") {
    showOverlay(els.gameOver);
  }
}

function bindUiEvents() {
  // canvas / input
  const onTap = (e) => {
    if (gameState === "playing") {
      e.preventDefault();
      handleJump();
    }
  };
  canvas.addEventListener("pointerdown", onTap);
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      if (gameState === "playing") handleJump();
      else if (gameState === "menu") startGame();
      else if (gameState === "gameover") startGame();
      else if (gameState === "paused") resumeGame();
    } else if (e.code === "Escape" || e.key === "p" || e.key === "P") {
      if (gameState === "playing") pauseGame();
      else if (gameState === "paused") resumeGame();
    }
  });

  // header buttons
  $("pauseButton")?.addEventListener("click", () => {
    if (gameState === "playing") pauseGame();
    else if (gameState === "paused") resumeGame();
    sfx("click");
  });
  $("shopButton")?.addEventListener("click", () => { renderShop(); showOverlay(els.shop); sfx("click"); });
  $("bankButton")?.addEventListener("click", () => { renderBank(); showOverlay(els.bank); sfx("click"); });
  $("leaderboardButton")?.addEventListener("click", () => { fetchLeaderboard(); showOverlay(els.leaderboard); sfx("click"); });
  $("achievementsButton")?.addEventListener("click", () => { renderAchievements(); showOverlay(els.achievements); sfx("click"); });
  $("settingsButton")?.addEventListener("click", () => { showOverlay(els.settings); sfx("click"); });

  // main menu
  $("playButton")?.addEventListener("click", () => { startGame(); sfx("click"); });
  $("menuShopButton")?.addEventListener("click", () => { renderShop(); showOverlay(els.shop); sfx("click"); });
  $("menuLeaderboardButton")?.addEventListener("click", () => { fetchLeaderboard(); showOverlay(els.leaderboard); sfx("click"); });
  $("menuAchievementsButton")?.addEventListener("click", () => { renderAchievements(); showOverlay(els.achievements); sfx("click"); });
  $("menuSettingsButton")?.addEventListener("click", () => { showOverlay(els.settings); sfx("click"); });
  $("menuDailyButton")?.addEventListener("click", () => { renderDaily(); showOverlay(els.daily); sfx("click"); });

  // pause overlay
  $("resumeButton")?.addEventListener("click", () => { resumeGame(); sfx("click"); });
  $("pauseMenuButton")?.addEventListener("click", () => { goToMenu(); sfx("click"); });
  $("pauseRestartButton")?.addEventListener("click", () => { startGame(); sfx("click"); });

  // game over
  $("restartButton")?.addEventListener("click", () => { startGame(); sfx("click"); });
  $("gameOverMenuButton")?.addEventListener("click", () => { goToMenu(); sfx("click"); });
  $("gameOverShopButton")?.addEventListener("click", () => { renderShop(); showOverlay(els.shop); sfx("click"); });

  // close buttons (all overlays)
  $("shopCloseButton")?.addEventListener("click", () => { closeAllOverlays(); afterCloseOverlay(); sfx("click"); });
  $("bankCloseButton")?.addEventListener("click", () => { closeAllOverlays(); afterCloseOverlay(); sfx("click"); });
  $("leaderboardCloseButton")?.addEventListener("click", () => { closeAllOverlays(); afterCloseOverlay(); sfx("click"); });
  $("settingsCloseButton")?.addEventListener("click", () => { closeAllOverlays(); afterCloseOverlay(); sfx("click"); });
  $("achievementsCloseButton")?.addEventListener("click", () => { closeAllOverlays(); afterCloseOverlay(); sfx("click"); });
  $("dailyCloseButton")?.addEventListener("click", () => { closeAllOverlays(); afterCloseOverlay(); sfx("click"); });
  $("tutorialCloseButton")?.addEventListener("click", () => {
    closeAllOverlays();
    try { localStorage.setItem(KEYS.tutorialSeen, "1"); } catch {}
    showOverlay(els.mainMenu);
    sfx("click");
  });

  // settings toggles
  els.sfxToggle?.addEventListener("change", (e) => { settings.sfx = e.target.checked; saveSettings(); });
  els.musicToggle?.addEventListener("change", (e) => {
    settings.music = e.target.checked;
    saveSettings();
    if (settings.music && gameState === "playing") startMusic(); else stopMusic();
  });
  els.vibroToggle?.addEventListener("change", (e) => { settings.vibro = e.target.checked; saveSettings(); });
  els.hardModeToggle?.addEventListener("change", (e) => { settings.hardMode = e.target.checked; saveSettings(); });
  $("resetProgressButton")?.addEventListener("click", () => {
    if (confirm("Сбросить весь прогресс? Это действие необратимо.")) {
      resetAllProgress();
      updateAllUI();
      goToMenu();
    }
  });

  // daily
  $("claimDailyButton")?.addEventListener("click", () => { claimDaily(); });

  // window
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", () => setTimeout(resizeCanvas, 200));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && gameState === "playing") pauseGame();
  });
}

/* ============================================================
   23. INITIAL BOOT
   ============================================================ */
async function boot() {
  loadAllProgress();
  resizeCanvas();
  bindUiEvents();
  updateAllUI();

  // first-time tutorial
  let tutorialSeen = false;
  try { tutorialSeen = !!localStorage.getItem(KEYS.tutorialSeen); } catch {}
  if (!tutorialSeen) {
    showOverlay(els.tutorial);
  } else {
    showOverlay(els.mainMenu);
  }

  // run particle/render single frame so menu has nice background
  initGameState();
  render();

  // start a passive raf loop so menu animates particles slowly
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(gameLoop);

  // network init (non-blocking)
  initUserData().catch(() => {});
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

})();
