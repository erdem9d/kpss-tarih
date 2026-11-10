import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  BASE_AVATARS, PREMIUM_AVATARS, START, REWARDS, SHOP, LEAGUES, leagueOf, nextLeagueOf,
} from './catalog.js';

const BOT_NAME_SET = new Set([
  'tarihkurdu', 'kpssuzmani', 'osmanlitorunu', 'atabey',
  'sultan123', 'bilge_kagan', 'kosem', 'fatihhayrani',
]);

/**
 * Basit dosya tabanlı veri deposu (prototip için yeterli).
 * Yayında PostgreSQL / Firebase gibi gerçek bir veritabanına taşınmalı:
 * tüm erişim bu dosyadaki fonksiyonlar üzerinden olduğu için sadece burası değişir.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(here, 'data', 'db.json');

let data = { users: {} };
const byToken = new Map(); // tokenHash -> userId

function buildEloLogFromHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((h) => h && Number.isFinite(Number(h.eloDelta)))
    .map((h) => ({ t: Number(h.at) || Date.now(), d: Number(h.eloDelta) }))
    .reverse();
}

function load() {
  try {
    data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!data || typeof data.users !== 'object') data = { users: {} };
  } catch {
    data = { users: {} };
  }
  byToken.clear();
  for (const u of Object.values(data.users)) {
    if (u.tokenHash) byToken.set(u.tokenHash, u.id);
    if ((!Array.isArray(u.eloLog) || u.eloLog.length === 0) && Array.isArray(u.history) && u.history.length > 0) {
      u.eloLog = buildEloLogFromHistory(u.history);
    }
  }
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

function findByUsername(name, exceptId) {
  if (!name) return null;
  const lower = name.toLocaleLowerCase('tr');
  return Object.values(data.users).find(
    (u) => u.id !== exceptId && u.username.toLocaleLowerCase('tr') === lower,
  ) || null;
}

function nameTaken(name, exceptId) {
  const existing = findByUsername(name, exceptId);
  if (!existing) return false;
  // Eğer aynı isimde sadece geçmişten/akrandan geri yüklenmiş yer tutucu kayıt varsa gerçek sahibine devredilebilir
  if (existing.isPeerSnapshot) return false;
  return true;
}

function allowedAvatars(user) {
  return user.avatarPack ? [...BASE_AVATARS, ...PREMIUM_AVATARS] : BASE_AVATARS;
}

/**
 * Kullanıcının maç geçmişindeki (history) gerçek insan rakipleri kontrol eder;
 * sunucu yeniden başladığında arkadaşınız henüz oyuna girmemiş olsa bile
 * geçmiş maçlarınızdan arkadaşınızın sıralama kaydını otomatik geri yükler.
 */
export function reconstructOpponentsFromHistory(user) {
  if (!user || !Array.isArray(user.history)) return;
  const byOpp = new Map();
  // En eskiden en yeniye doğru işle
  for (const h of [...user.history].reverse()) {
    const oppName = cleanName(h?.opponent);
    if (!oppName) continue;
    if (h.isBot || BOT_NAME_SET.has(oppName.toLocaleLowerCase('tr'))) continue;
    if (oppName.toLocaleLowerCase('tr') === user.username.toLocaleLowerCase('tr')) continue;

    let rec = byOpp.get(oppName.toLocaleLowerCase('tr'));
    if (!rec) {
      rec = {
        id: h.opponentId || `peer-${crypto.createHash('md5').update(oppName.toLocaleLowerCase('tr')).digest('hex').slice(0, 12)}`,
        username: oppName,
        avatar: h.opponentAvatar || '🥷',
        elo: START.elo,
        wins: 0,
        losses: 0,
        draws: 0,
        history: [],
        eloLog: [],
      };
      byOpp.set(oppName.toLocaleLowerCase('tr'), rec);
    }
    if (h.opponentAvatar) rec.avatar = h.opponentAvatar;
    if (h.opponentId) rec.id = h.opponentId;

    // Kullanıcının sonucu L ise rakip (arkadaş) kazanmıştır (W)
    const oppWon = h.result === 'L';
    const oppDraw = h.result === 'D';
    const delta = oppWon
      ? Math.max(16, Math.abs(Number(h.eloDelta) || 16))
      : oppDraw
        ? 0
        : -Math.max(12, Math.abs(Number(h.eloDelta) || 14));

    rec.elo = Math.max(0, rec.elo + delta);
    if (oppWon) rec.wins += 1;
    else if (oppDraw) rec.draws += 1;
    else rec.losses += 1;

    const at = Number(h.at) || Date.now();
    rec.history.unshift({
      opponent: user.username,
      result: oppWon ? 'W' : oppDraw ? 'D' : 'L',
      eloDelta: delta,
      at,
    });
    rec.eloLog.push({ t: at, d: delta });
  }

  let changed = false;
  for (const rec of byOpp.values()) {
    // Eğer arkadaş kullanıcıya karşı üstünse ve kullanıcıdan düşük kaldıysa sıralamada doğru yerde durmasını sağla
    if (rec.wins > rec.losses && rec.elo <= user.elo) {
      const boost = (user.elo - rec.elo) + 16;
      rec.elo += boost;
      if (rec.eloLog.length > 0) rec.eloLog[rec.eloLog.length - 1].d += boost;
    }
    const existingByName = findByUsername(rec.username);
    const existingById = data.users[rec.id];
    const existing = existingById || existingByName;
    if (!existing) {
      data.users[rec.id] = {
        id: rec.id,
        tokenHash: null,
        isPeerSnapshot: true,
        username: rec.username,
        avatar: rec.avatar,
        coins: START.coins + rec.wins * REWARDS.win + rec.losses * REWARDS.loss,
        diamonds: START.diamonds,
        elo: rec.elo,
        stats: {
          totalGames: rec.wins + rec.losses + rec.draws,
          wins: rec.wins,
          losses: rec.losses,
          draws: rec.draws,
          correctAnswers: rec.wins * 6 + rec.losses * 3,
        },
        inventory: { extraTime: 0, eliminateWrong: 0, shield: 0 },
        avatarPack: false,
        goldBoost: 0,
        history: rec.history.slice(0, 10),
        eloLog: rec.eloLog,
        lastArcadeAt: 0,
        createdAt: Date.now(),
      };
      changed = true;
    }
  }
  if (changed) save();
}

/** İstemcilerin yerel önbelleğinde tuttuğu diğer gerçek oyuncuları (peers) sunucuya geri yükler. */
export function importPeers(peers) {
  if (!Array.isArray(peers)) return;
  let changed = false;
  for (const p of peers) {
    if (!p || typeof p.id !== 'string' || p.id.length < 6) continue;
    const uname = cleanName(p.username);
    if (!uname || BOT_NAME_SET.has(uname.toLocaleLowerCase('tr'))) continue;

    const existing = data.users[p.id] || findByUsername(uname);
    const pGames = Number(p.stats?.totalGames) || 0;
    const exGames = Number(existing?.stats?.totalGames) || 0;

    if (!existing) {
      const history = Array.isArray(p.history) ? p.history.slice(0, 10) : [];
      data.users[p.id] = {
        id: p.id,
        tokenHash: null,
        isPeerSnapshot: true,
        username: uname,
        avatar: [...BASE_AVATARS, ...PREMIUM_AVATARS].includes(p.avatar) ? p.avatar : BASE_AVATARS[0],
        coins: Number.isFinite(p.coins) ? Math.max(0, Math.floor(p.coins)) : START.coins,
        diamonds: START.diamonds,
        elo: Number.isFinite(p.elo) ? Math.max(0, Math.floor(p.elo)) : START.elo,
        stats: {
          totalGames: pGames,
          wins: Number(p.stats?.wins) || 0,
          losses: Number(p.stats?.losses) || 0,
          draws: Number(p.stats?.draws) || 0,
          correctAnswers: Number(p.stats?.correctAnswers) || 0,
        },
        inventory: { extraTime: 0, eliminateWrong: 0, shield: 0 },
        avatarPack: false,
        goldBoost: 0,
        history,
        eloLog: Array.isArray(p.eloLog) && p.eloLog.length > 0 ? p.eloLog.slice(-100) : buildEloLogFromHistory(history),
        lastArcadeAt: 0,
        createdAt: Date.now(),
      };
      changed = true;
    } else if (existing.isPeerSnapshot && pGames >= exGames) {
      existing.username = uname;
      if ([...BASE_AVATARS, ...PREMIUM_AVATARS].includes(p.avatar)) existing.avatar = p.avatar;
      if (Number.isFinite(p.elo)) existing.elo = Math.max(0, Math.floor(p.elo));
      if (p.stats) {
        existing.stats = {
          totalGames: pGames,
          wins: Number(p.stats.wins) || 0,
          losses: Number(p.stats.losses) || 0,
          draws: Number(p.stats.draws) || 0,
          correctAnswers: Number(p.stats.correctAnswers) || 0,
        };
      }
      if (Array.isArray(p.history) && p.history.length > 0) {
        existing.history = p.history.slice(0, 10);
        existing.eloLog = buildEloLogFromHistory(existing.history);
      }
      changed = true;
    }
  }
  if (changed) save();
}

/** İstemcilerin yedeklemesi için sunucudaki gerçek oyuncuların özet listesini döner. */
export function exportPeers() {
  return Object.values(data.users)
    .filter((u) => (u.stats?.totalGames || 0) > 0 || !u.username.startsWith('Oyuncu'))
    .slice(0, 50)
    .map((u) => ({
      id: u.id,
      username: u.username,
      avatar: u.avatar,
      elo: u.elo,
      stats: u.stats,
      history: (u.history || []).slice(0, 10),
    }));
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

export function syncUserWithBackup(user, backup = {}) {
  if (!user || !backup) return user;
  let changed = false;
  const cleanBackupName = cleanName(backup.username);
  if (cleanBackupName && cleanBackupName !== user.username && !nameTaken(cleanBackupName, user.id)) {
    const ghost = findByUsername(cleanBackupName, user.id);
    if (ghost && ghost.isPeerSnapshot) delete data.users[ghost.id];
    user.username = cleanBackupName;
    changed = true;
  }
  if (backup.avatar && allowedAvatars(user).includes(backup.avatar) && backup.avatar !== user.avatar) {
    user.avatar = backup.avatar;
    changed = true;
  }
  const backupGames = Number(backup.stats?.totalGames) || 0;
  const userGames = Number(user.stats?.totalGames) || 0;
  if (backupGames > userGames) {
    if (Number.isFinite(backup.elo)) user.elo = Math.max(0, Math.floor(backup.elo));
    if (Number.isFinite(backup.coins)) user.coins = Math.max(user.coins, Math.floor(backup.coins));
    if (Number.isFinite(backup.diamonds)) user.diamonds = Math.max(user.diamonds, Math.floor(backup.diamonds));
    user.stats = {
      totalGames: backupGames,
      wins: Number(backup.stats?.wins) || 0,
      losses: Number(backup.stats?.losses) || 0,
      draws: Number(backup.stats?.draws) || 0,
      correctAnswers: Number(backup.stats?.correctAnswers) || 0,
    };
    if (Array.isArray(backup.history) && backup.history.length > 0) {
      user.history = backup.history.slice(0, 10);
      user.eloLog = buildEloLogFromHistory(user.history);
    }
    changed = true;
  }
  if (changed) save();
  reconstructOpponentsFromHistory(user);
  return user;
}

export function createUser(restore = {}) {
  const id = (typeof restore.id === 'string' && restore.id.length >= 8) ? restore.id : crypto.randomUUID();
  const token = (typeof restore.token === 'string' && restore.token.length >= 16)
    ? restore.token
    : crypto.randomBytes(32).toString('hex');

  let username = cleanName(restore.username);
  if (username) {
    const existingGhost = findByUsername(username, id);
    if (existingGhost && existingGhost.isPeerSnapshot) {
      delete data.users[existingGhost.id];
    }
  }
  if (!username || nameTaken(username, id)) {
    do {
      username = `Oyuncu${Math.floor(1000 + Math.random() * 9000)}`;
    } while (nameTaken(username, id));
  }

  const avatarPack = Boolean(restore.avatarPack);
  const allAvatars = avatarPack ? [...BASE_AVATARS, ...PREMIUM_AVATARS] : BASE_AVATARS;
  const avatar = allAvatars.includes(restore.avatar) ? restore.avatar : BASE_AVATARS[0];
  const history = Array.isArray(restore.history) ? restore.history.slice(0, 10) : [];

  const user = {
    id,
    tokenHash: hash(token),
    isPeerSnapshot: false,
    username,
    avatar,
    coins: Number.isFinite(restore.coins) ? Math.max(0, Math.floor(restore.coins)) : START.coins,
    diamonds: Number.isFinite(restore.diamonds) ? Math.max(0, Math.floor(restore.diamonds)) : START.diamonds,
    elo: Number.isFinite(restore.elo) ? Math.max(0, Math.floor(restore.elo)) : START.elo,
    stats: {
      totalGames: Number(restore.stats?.totalGames) || 0,
      wins: Number(restore.stats?.wins) || 0,
      losses: Number(restore.stats?.losses) || 0,
      draws: Number(restore.stats?.draws) || 0,
      correctAnswers: Number(restore.stats?.correctAnswers) || 0,
    },
    inventory: {
      extraTime: Number(restore.inventory?.extraTime) || 0,
      eliminateWrong: Number(restore.inventory?.eliminateWrong) || 0,
      shield: Number(restore.inventory?.shield) || 0,
    },
    avatarPack,
    goldBoost: Number(restore.goldBoost) || 0,
    history,
    eloLog: buildEloLogFromHistory(history),
    lastArcadeAt: 0,
    createdAt: Date.now(),
  };
  data.users[id] = user;
  byToken.set(user.tokenHash, id);
  reconstructOpponentsFromHistory(user);
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
    leagueIcon: league.icon,
    leagueColor: league.color,
    leagueMin: league.min,
    nextLeague: next ? { name: next.name, min: next.min, icon: next.icon, color: next.color } : null,
    leagues: LEAGUES,
    stats: u.stats,
    inventory: u.inventory,
    avatarPack: u.avatarPack,
    unlockedAvatars: allowedAvatars(u),
    goldBoost: u.goldBoost,
    history: u.history,
    peers: exportPeers(),
  };
}

export function updateProfile(user, { username, avatar }) {
  if (username !== undefined) {
    const name = cleanName(username);
    if (!name) return { ok: false, error: 'invalid_name' };
    if (nameTaken(name, user.id)) return { ok: false, error: 'name_taken' };
    const ghost = findByUsername(name, user.id);
    if (ghost && ghost.isPeerSnapshot) delete data.users[ghost.id];
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
  // o: { won, draw, opponentId, opponentElo, opponentName, opponentAvatar, isBot, correct }
  const oldLeague = leagueOf(user.elo);
  const expected = 1 / (1 + 10 ** ((o.opponentElo - user.elo) / 400));
  const score = o.won ? 1 : o.draw ? 0.5 : 0;
  const K = o.isBot ? 24 : 40;
  let eloDelta = Math.round(K * (score - expected));
  if (o.won) eloDelta = Math.max(15, eloDelta);
  else if (!o.draw) eloDelta = Math.min(-10, eloDelta);

  user.elo = Math.max(0, user.elo + eloDelta);
  const newLeague = leagueOf(user.elo);
  const nextLeague = nextLeagueOf(user.elo);

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

  const now = Date.now();
  user.history.unshift({
    opponent: o.opponentName,
    opponentId: o.opponentId || null,
    opponentAvatar: o.opponentAvatar || '👤',
    opponentElo: o.opponentElo || START.elo,
    isBot: Boolean(o.isBot),
    result: o.won ? 'W' : o.draw ? 'D' : 'L',
    eloDelta,
    at: now,
  });
  user.history = user.history.slice(0, 10);

  user.eloLog.push({ t: now, d: eloDelta });
  if (user.eloLog.length > 300) user.eloLog = user.eloLog.slice(-300);

  save();
  return {
    coins,
    eloDelta,
    boosted,
    elo: user.elo,
    oldLeague: oldLeague.name,
    newLeague: newLeague.name,
    newLeagueIcon: newLeague.icon,
    newLeagueColor: newLeague.color,
    leagueMin: newLeague.min,
    nextLeague: nextLeague ? { name: nextLeague.name, min: nextLeague.min, icon: nextLeague.icon } : null,
    promoted: newLeague.min > oldLeague.min,
    demoted: newLeague.min < oldLeague.min,
  };
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
export function purchase(user, itemId, { testMode } = {}) {
  const item = SHOP[itemId];
  if (!item) return { ok: false, error: 'unknown_item' };

  if (item.kind === 'gems') {
    if (!testMode) return { ok: false, error: 'payments_disabled' };
    user.diamonds += item.amount;
    save();
    return { ok: true };
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

export function leaderboard(period, userId, limit = 30) {
  const since = WINDOWS[period] ? Date.now() - WINDOWS[period] : null;

  const rows = Object.values(data.users).map((u) => {
    const log = (Array.isArray(u.eloLog) && u.eloLog.length > 0)
      ? u.eloLog
      : buildEloLogFromHistory(u.history);
    const gain = since
      ? log.filter((e) => e.t >= since).reduce((s, e) => s + e.d, 0)
      : 0;
    const hasPlayed = (u.stats?.totalGames || 0) > 0 || (u.history?.length || 0) > 0 || Boolean(u.isPeerSnapshot);
    const isCustomUser = !u.username.startsWith('Oyuncu') || u.id === userId;
    const played = since
      ? log.some((e) => e.t >= since) || (hasPlayed && log.length === 0)
      : hasPlayed || isCustomUser;
    return { u, gain, played };
  }).filter((r) => r.played);

  rows.sort((a, b) => (since
    ? (b.gain - a.gain) || (b.u.elo - a.u.elo) || ((b.u.stats?.wins || 0) - (a.u.stats?.wins || 0))
    : (b.u.elo - a.u.elo) || ((b.u.stats?.wins || 0) - (a.u.stats?.wins || 0))));

  const toEntry = (r, i) => {
    const lg = leagueOf(r.u.elo);
    return {
      rank: i + 1,
      id: r.u.id,
      username: r.u.username,
      avatar: r.u.avatar,
      elo: r.u.elo,
      league: lg.name,
      leagueIcon: lg.icon,
      leagueColor: lg.color,
      wins: r.u.stats?.wins || 0,
      losses: r.u.stats?.losses || 0,
      totalGames: r.u.stats?.totalGames || 0,
      gain: since ? r.gain : null,
      isMe: r.u.id === userId,
    };
  };

  const all = rows.map(toEntry);
  const me = all.find((e) => e.isMe) || null;
  return {
    entries: all.slice(0, limit),
    me,
    total: all.length,
    leagues: LEAGUES,
    peers: exportPeers(),
  };
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { flush(); process.exit(0); });
}
