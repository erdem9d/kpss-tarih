import { io } from 'socket.io-client';

// Sunucu adresi: yayında VITE_SERVER_URL ile verilir.
// Geliştirmede aynı makinede veya yerel ağdan (telefon) açılan sayfa
// kendi host adresinin 3001 portuna bağlanır. Derlenmiş (production) sürümde
// oyunu sunan sunucu ile oyun sunucusu aynıdır: sayfanın kendi adresi kullanılır.
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV ? `http://${window.location.hostname}:3001` : window.location.origin);

const TOKEN_KEY = 'kpss_token';
const PROFILE_KEY = 'kpss_profile_v1';
const PEERS_KEY = 'kpss_peers_v1';
const LB_CACHE_KEY = 'kpss_lb_cache_v1';

function loadSavedProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadSavedPeers() {
  try {
    const raw = localStorage.getItem(PEERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePeersLocal(incoming) {
  if (!Array.isArray(incoming) || incoming.length === 0) return;
  try {
    const current = loadSavedPeers();
    const byId = new Map();
    for (const p of current) if (p?.id) byId.set(p.id, p);
    for (const p of incoming) {
      if (!p?.id) continue;
      const ex = byId.get(p.id);
      const exGames = Number(ex?.stats?.totalGames) || 0;
      const newGames = Number(p?.stats?.totalGames) || 0;
      if (!ex || newGames >= exGames) byId.set(p.id, p);
    }
    localStorage.setItem(PEERS_KEY, JSON.stringify([...byId.values()].slice(0, 50)));
  } catch {
    // localStorage doluysa sessizce geç
  }
}

export function loadCachedLeaderboard(period = 'all') {
  try {
    const raw = localStorage.getItem(`${LB_CACHE_KEY}_${period}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCachedLeaderboard(period, data) {
  try {
    localStorage.setItem(`${LB_CACHE_KEY}_${period}`, JSON.stringify(data));
  } catch {
    // sessizce geç
  }
}

function saveProfileLocal(profile) {
  if (!profile) return;
  try {
    if (Array.isArray(profile.peers)) savePeersLocal(profile.peers);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // localStorage dolu veya kapalıysa sessizce geç
  }
}

let socket = null;
const listeners = new Set(); // oturum durumu dinleyicileri
let state = { status: 'connecting', profile: loadSavedProfile() }; // connecting | online | offline

function setState(patch) {
  if (patch.profile) saveProfileLocal(patch.profile);
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

export const getSessionState = () => state;

export function subscribeSession(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function getSocket() {
  return socket;
}

/** Soket üzerinden onaylı (ack) istek gönderir; 8 sn içinde cevap gelmezse hata döner. */
export function request(event, payload) {
  return new Promise((resolve) => {
    if (!socket || !socket.connected) return resolve({ ok: false, error: 'offline' });
    const timer = setTimeout(() => resolve({ ok: false, error: 'timeout' }), 8000);
    socket.emit(event, payload, (res) => {
      clearTimeout(timer);
      if (res?.peers) savePeersLocal(res.peers);
      if (event === 'leaderboard' && res?.ok) {
        saveCachedLeaderboard(payload?.period || 'all', res);
      }
      resolve(res);
    });
  });
}

async function authenticate() {
  const saved = localStorage.getItem(TOKEN_KEY);
  const backup = loadSavedProfile();
  const peers = loadSavedPeers();
  if (saved) {
    const res = await request('auth', { token: saved, backup, peers });
    if (res.ok) return setState({ status: 'online', profile: res.profile });
    if (res.error !== 'invalid_token') return setState({ status: 'offline' });
    localStorage.removeItem(TOKEN_KEY);
  }
  const res = await request('register', { backup, peers });
  if (res.ok) {
    localStorage.setItem(TOKEN_KEY, res.token);
    setState({ status: 'online', profile: res.profile });
  } else {
    setState({ status: 'offline' });
  }
}

/** Uygulama açılırken bir kez çağrılır; bağlantı kopsa da kendini yeniden bağlar. */
export function startSession() {
  if (socket) return;
  socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 5000,
  });

  socket.on('connect', authenticate);
  socket.on('connect_error', () => setState({ status: 'offline' }));
  socket.on('disconnect', () => setState({ status: 'offline' }));
  // Sunucu profili değiştirdiğinde (maç sonu ödülü vb.) anında yansıt
  socket.on('profile', (profile) => setState({ profile }));
}

/** Sunucudan gelen profili (satın alma, ad değiştirme gibi işlemlerden sonra) uygular. */
export function applyProfile(profile) {
  if (profile) setState({ profile });
}
