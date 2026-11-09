import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { Room } from './room.js';
import * as db from './db.js';

const PORT = process.env.PORT || 3001;
const BOT_AFTER_MS = Number(process.env.BOT_AFTER_MS || 7000);
// Gerçek para ödemesi (Google Play Billing doğrulaması) bağlanana kadar elmas paketleri demo/test modunda verilir.
const TEST_PURCHASES = process.env.TEST_PURCHASES !== '0';

const BOT_NAMES = ['TarihKurdu', 'KpssUzmani', 'OsmanliTorunu', 'Atabey', 'Sultan123', 'Bilge_Kagan', 'Kosem', 'FatihHayrani'];
const BOT_AVATARS = ['🦁', '🦅', '🐺', '🤴', '🥷', '🌙'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Derlenmiş web uygulamasını (dist) sunar; bulunamayan yollar index.html'e düşer (tek sayfa uygulaması). */
function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400); res.end(); return true;
  }
  let file = path.resolve(DIST, `.${pathname}`);
  if (file !== DIST && !file.startsWith(DIST + path.sep)) {
    res.writeHead(403); res.end(); return true; // dist dışına çıkma denemesi
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) return false;
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

const http = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, queue: queue.length, rooms: rooms.size, online: io.engine.clientsCount }));
    return;
  }
  if (serveStatic(req, res)) return;
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('KPSS Tarih Düello sunucusu çalışıyor. (Web uygulaması için önce "npm run build" çalıştırın.)');
});

const io = new Server(http, {
  cors: { origin: '*' }, // Yayında kendi alan adınızla sınırlayın
});

const queue = []; // { player, botTimer }
const rooms = new Map(); // roomId -> Room
const roomOf = new Map(); // socket.id -> Room
const activeUsers = new Map(); // userId -> socket.id (aynı hesapla aynı anda iki maç engellenir)
let roomSeq = 0;

function removeFromQueue(socketId) {
  const i = queue.findIndex((e) => e.player.id === socketId);
  if (i !== -1) {
    clearTimeout(queue[i].botTimer);
    queue.splice(i, 1);
  }
}

function releaseUser(socket) {
  const uid = socket.data.userId;
  if (uid && activeUsers.get(uid) === socket.id) activeUsers.delete(uid);
}

/** Maç sonucunu veritabanına işler ve oyuncuya güncel profili gönderir. */
function settle(player, outcome) {
  const user = db.getUser(player.userId);
  if (!user) return null;
  const rewards = db.settleMatch(user, outcome);
  player.socket?.emit('profile', db.publicProfile(user));
  return rewards;
}

function startRoom(players) {
  const id = `room-${++roomSeq}`;
  const room = new Room(
    id,
    players,
    (r) => {
      rooms.delete(r.id);
      for (const p of r.players) {
        if (roomOf.get(p.id) === r) roomOf.delete(p.id);
        if (!p.isBot && activeUsers.get(p.userId) === p.id) activeUsers.delete(p.userId);
      }
    },
    settle,
  );
  rooms.set(id, room);
  for (const p of players) if (!p.isBot) roomOf.set(p.id, room);
  room.start();
  console.log(`[${id}] ${players.map((p) => p.name + (p.isBot ? ' (bot)' : '')).join(' vs ')}`);
}

io.on('connection', (socket) => {
  console.log(`+ bağlandı ${socket.id} (online: ${io.engine.clientsCount})`);

  const me = () => (socket.data.userId ? db.getUser(socket.data.userId) : null);
  const authed = (ack, fn) => {
    const user = me();
    if (!user) return ack?.({ ok: false, error: 'not_authenticated' });
    return fn(user);
  };

  // ---------- Hesap ----------
  socket.on('register', (_payload, ack) => {
    const { user, token } = db.createUser();
    socket.data.userId = user.id;
    ack?.({ ok: true, token, profile: db.publicProfile(user) });
  });

  socket.on('auth', ({ token } = {}, ack) => {
    const user = db.findByToken(token);
    if (!user) return ack?.({ ok: false, error: 'invalid_token' });
    socket.data.userId = user.id;
    ack?.({ ok: true, profile: db.publicProfile(user) });
  });

  socket.on('update_profile', (payload = {}, ack) =>
    authed(ack, (user) => {
      const res = db.updateProfile(user, { username: payload.username, avatar: payload.avatar });
      ack?.(res.ok ? { ok: true, profile: db.publicProfile(user) } : res);
    }));

  socket.on('leaderboard', ({ period } = {}, ack) =>
    authed(ack, (user) => {
      const p = ['daily', 'weekly', 'all'].includes(period) ? period : 'all';
      ack?.({ ok: true, ...db.leaderboard(p, user.id) });
    }));

  socket.on('purchase', ({ itemId } = {}, ack) =>
    authed(ack, (user) => {
      const res = db.purchase(user, itemId, { testMode: TEST_PURCHASES });
      ack?.(res.ok ? { ...res, profile: db.publicProfile(user) } : res);
    }));

  socket.on('arcade_reward', ({ score } = {}, ack) =>
    authed(ack, (user) => {
      const res = db.arcadeReward(user, score);
      ack?.(res.ok ? { ...res, profile: db.publicProfile(user) } : res);
    }));

  // ---------- Düello ----------
  socket.on('join_queue', () => {
    const user = me();
    if (!user) return socket.emit('queue_error', { error: 'not_authenticated' });
    if (roomOf.has(socket.id)) return;
    if (activeUsers.has(user.id) && activeUsers.get(user.id) !== socket.id) {
      return socket.emit('queue_error', { error: 'already_playing' });
    }
    removeFromQueue(socket.id);
    activeUsers.set(user.id, socket.id);

    // Profil bilgisi istemciden değil veritabanından alınır
    const player = {
      id: socket.id,
      userId: user.id,
      socket,
      name: user.username,
      avatar: user.avatar,
      elo: user.elo,
      isBot: false,
    };

    // Bekleyen biri varsa hemen eşleştir
    const waiting = queue.shift();
    if (waiting) {
      clearTimeout(waiting.botTimer);
      return startRoom([waiting.player, player]);
    }

    // Yoksa sıraya gir; süre dolarsa bot ile eşleştir
    const entry = { player, botTimer: null };
    entry.botTimer = setTimeout(() => {
      removeFromQueue(socket.id);
      const bot = {
        id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        socket: null,
        name: pick(BOT_NAMES),
        avatar: pick(BOT_AVATARS),
        elo: Math.max(0, player.elo + Math.floor((Math.random() - 0.5) * 200)),
        isBot: true,
      };
      startRoom([player, bot]);
    }, BOT_AFTER_MS);
    queue.push(entry);
    socket.emit('queue_joined', { botAfterMs: BOT_AFTER_MS });
  });

  socket.on('leave_queue', () => {
    removeFromQueue(socket.id);
    if (!roomOf.has(socket.id)) releaseUser(socket);
  });

  socket.on('answer', ({ option } = {}) => {
    roomOf.get(socket.id)?.handleAnswer(socket.id, option);
  });

  socket.on('leave_room', () => {
    roomOf.get(socket.id)?.playerLeft(socket.id);
    roomOf.delete(socket.id);
    releaseUser(socket);
  });

  socket.on('disconnect', () => {
    removeFromQueue(socket.id);
    roomOf.get(socket.id)?.playerLeft(socket.id);
    roomOf.delete(socket.id);
    releaseUser(socket);
    console.log(`- ayrıldı ${socket.id} (online: ${io.engine.clientsCount})`);
  });
});

http.listen(PORT, '0.0.0.0', () => {
  console.log(`Düello sunucusu hazır: http://localhost:${PORT}  (bot bekleme: ${BOT_AFTER_MS / 1000}sn, test satın alma: ${TEST_PURCHASES ? 'açık' : 'kapalı'})`);
});
