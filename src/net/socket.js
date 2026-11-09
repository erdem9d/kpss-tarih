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

function loadSavedProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveProfileLocal(profile) {
  if (!profile) return;
  try {
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
      resolve(res);
    });
  });
}

async function authenticate() {
  const saved = localStorage.getItem(TOKEN_KEY);
  const backup = loadSavedProfile();
  if (saved) {
    const res = await request('auth', { token: saved, backup });
    if (res.ok) return setState({ status: 'online', profile: res.profile });
    if (res.error !== 'invalid_token') return setState({ status: 'offline' });
    localStorage.removeItem(TOKEN_KEY);
  }
  const res = await request('register', { backup });
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
