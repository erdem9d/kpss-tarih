import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  BASE_AVATARS, PREMIUM_AVATARS, START, REWARDS, SHOP, leagueOf, nextLeagueOf,
} from './catalog.js';

/**
 * Basit dosya tabanlı veri deposu (prototip için yeterli).
 * Yayında PostgreSQL / Firebase gibi gerçek bir veritabanına taşınmalı:
 * tüm erişim bu dosyadaki fonksiyonlar üzerinden olduğu için sadece burası değişir.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(here, 'data', 'db.json');

let data = { users: {} };
const byToken = new Map(); // tokenHash -> userId

function load() {
  try {
    data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    data = { users: {} };
  }
  byToken.clear();
  for (const u of Object.values(data.users)) byToken.set(u.tokenHash, u.id);
}
load();

let saveTimer = null;
function writeNow() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, DB_PATH); // yarım yazılmış dosya riskine karşı atomik değiştirme
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, 300);
}
export function flush() {
  clearTimeout(saveTimer);
  writeNow();
}

const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

// ---------- Doğrulama ----------
const NAME_RE = /^[\p{L}\p{N}_ ]{3,15}$/u;

function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  return NAME_RE.test(name) ? name : null;
}

function nameTaken(name, exceptId) {
  const lower = name.toLocaleLowerCase('tr');
  return Object.values(data.users).some(
    (u) => u.id !== exceptId && u.username.toLocaleLowerCase('tr') === lower,
  );
}

function allowedAvatars(user) {
  return user.avatarPack ? [...BASE_AVATARS, ...PREMIUM_AVATARS] : BASE_AVATARS;
}

// ---------- Kullanıcı ----------
export function getUser(id) {
  return data.users[id] || null;
}

export function findByToken(token) {
  if (typeof token !== 'string' || token.length < 16) return null;
  const id = byToken.get(hash(token));
  return id ? data.users[id] : null;
}

export function createUser() {
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString('hex');
  let username;
  do {
    username = `Oyuncu${Math.floor(1000 + Math.random() * 9000)}`;
  } while (nameTaken(username));

  const user = {
    id,
    tokenHash: hash(token),
    username,
    avatar: BASE_AVATARS[0],
    coins: START.coins,
    diamonds: START.diamonds,
    elo: START.elo,
    stats: { totalGames: 0, wins: 0, losses: 0, draws: 0, correctAnswers: 0 },
    inventory: { extraTime: 0, eliminateWrong: 0, shield: 0 },
    avatarPack: false,
    goldBoost: 0,
    history: [],
    eloLog: [],
    lastArcadeAt: 0,
    createdAt: Date.now(),
  };
  data.users[id] = user;
  byToken.set(user.tokenHash, id);
  save();
  return { user, token };
}

/** İstemciye gidecek profil (tokenHash gibi gizli alanlar hariç). */
export function publicProfile(u) {
  const next = nextLeagueOf(u.elo);
  const league = leagueOf(u.elo);
  return {
    id: u.id,
    username: u.username,
    avatar: u.avatar,
    coins: u.coins,
    diamonds: u.diamonds,
    elo: u.elo,
    league: league.name,
    leagueMin: league.min,
    nextLeague: next ? { name: next.name, min: next.min } : null,
    stats: u.stats,
    inventory: u.inventory,
    avatarPack: u.avatarPack,
    unlockedAvatars: allowedAvatars(u),
    goldBoost: u.goldBoost,
    history: u.history,
  };
}

export function updateProfile(user, { username, avatar }) {
  if (username !== undefined) {
    const name = cleanName(username);
    if (!name) return { ok: false, error: 'invalid_name' };
    if (nameTaken(name, user.id)) return { ok: false, error: 'name_taken' };
    user.username = name;
  }
  if (avatar !== undefined) {
    if (!allowedAvatars(user).includes(avatar)) return { ok: false, error: 'invalid_avatar' };
    user.avatar = avatar;
  }
  save();
  return { ok: true };
}

// ---------- Maç sonucu ----------
export function settleMatch(user, o) {
  // o: { won, draw, opponentElo, opponentName, isBot, correct }
  const expected = 1 / (1 + 10 ** ((o.opponentElo - user.elo) / 400));
  const score = o.won ? 1 : o.draw ? 0.5 : 0;
  const K = o.isBot ? 16 : 32; // bota karşı ELO etkisi yarım: bot kasarak yükselmeyi zorlaştırır
  const eloDelta = Math.round(K * (score - expected));
  user.elo = Math.max(0, user.elo + eloDelta);

  let coins = o.won ? REWARDS.win : o.draw ? REWARDS.draw : REWARDS.loss;
  let boosted = false;
  if (user.goldBoost > 0) {
    coins *= 2;
    user.goldBoost -= 1;
    boosted = true;
  }
  user.coins += coins;

  user.stats.totalGames += 1;
  if (o.won) user.stats.wins += 1;
  else if (o.draw) user.stats.draws = (user.stats.draws || 0) + 1;
  else user.stats.losses += 1;
  user.stats.correctAnswers += o.correct || 0;

  user.history.unshift({
    opponent: o.opponentName,
    result: o.won ? 'W' : o.draw ? 'D' : 'L',
    eloDelta,
    at: Date.now(),
  });
  user.history = user.history.slice(0, 10);

  user.eloLog.push({ t: Date.now(), d: eloDelta });
  if (user.eloLog.length > 300) user.eloLog = user.eloLog.slice(-300);

  save();
  return { coins, eloDelta, boosted, elo: user.elo };
}

// ---------- Arcade (istemci skoruna kısmen güvenilir) ----------
export function arcadeReward(user, score) {
  const now = Date.now();
  if (now - user.lastArcadeAt < 20_000) return { ok: false, error: 'too_fast' };
  const s = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  const coins = Math.min(Math.floor(s / 2), 150); // üst sınır: hile etkisini sınırlar
  user.lastArcadeAt = now;
  user.coins += coins;
  save();
  return { ok: true, coins };
}

// ---------- Mağaza ----------
export function purchase(user, itemId, { testMode }) {
  const item = SHOP[itemId];
  if (!item) return { ok: false, error: 'unknown_item' };

  if (item.kind === 'gems') {
    // Gerçek para: Google Play Billing makbuz doğrulaması eklenene kadar yalnızca test modunda.
    if (!testMode) return { ok: false, error: 'payments_disabled' };
    user.diamonds += item.amount;
    save();
    return { ok: true, testMode: true };
  }

  if (user.diamonds < item.diamonds) return { ok: false, error: 'insufficient_diamonds' };

  if (item.kind === 'avatar_pack') {
    if (user.avatarPack) return { ok: false, error: 'already_owned' };
    user.avatarPack = true;
  } else if (item.kind === 'gold_boost') {
    user.goldBoost += item.matches;
  } else if (item.kind === 'powerup') {
    user.inventory[item.key] += item.amount;
  }
  user.diamonds -= item.diamonds;
  save();
  return { ok: true };
}

// ---------- Sıralama ----------
const WINDOWS = { daily: 24 * 3600e3, weekly: 7 * 24 * 3600e3 };

export function leaderboard(period, userId, limit = 20) {
  const since = WINDOWS[period] ? Date.now() - WINDOWS[period] : null;

  const rows = Object.values(data.users).map((u) => {
    const gain = since
      ? u.eloLog.filter((e) => e.t >= since).reduce((s, e) => s + e.d, 0)
      : 0;
    const played = since ? u.eloLog.some((e) => e.t >= since) : u.stats.totalGames > 0;
    return { u, gain, played };
  }).filter((r) => r.played);

  rows.sort((a, b) => (since ? b.gain - a.gain || b.u.elo - a.u.elo : b.u.elo - a.u.elo));

  const toEntry = (r, i) => ({
    rank: i + 1,
    id: r.u.id,
    username: r.u.username,
    avatar: r.u.avatar,
    elo: r.u.elo,
    league: leagueOf(r.u.elo).name,
    gain: since ? r.gain : null,
    isMe: r.u.id === userId,
  });

  const all = rows.map(toEntry);
  const me = all.find((e) => e.isMe) || null;
  return { entries: all.slice(0, limit), me, total: all.length };
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { flush(); process.exit(0); });
}
