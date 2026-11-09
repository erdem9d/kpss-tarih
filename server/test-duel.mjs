// Uçtan uca test: hesap, profil doğrulama, düello + ödül/ELO, bot, mağaza, sıralama, arcade, kalıcılık.
// Çalıştır:  node server/test-duel.mjs      (kendi sunucusunu geçici veritabanıyla başlatır)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3002;
const URL = `http://localhost:${PORT}`;
const tmp = mkdtempSync(path.join(tmpdir(), 'kpss-test-'));
const DB_PATH = path.join(tmp, 'db.json');

let failed = 0;
const log = (...a) => console.log(...a);
const check = (name, cond, extra) => {
  log(cond ? '  ✓' : '  ✗ HATA:', name, cond ? '' : (extra !== undefined ? JSON.stringify(extra) : ''));
  if (!cond) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server;
function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn(process.execPath, [path.join(here, 'index.js')], {
      env: { ...process.env, PORT, DB_PATH, BOT_AFTER_MS: '3000', NODE_ENV: 'test' },
    });
    server.stdout.on('data', (d) => { if (String(d).includes('hazır')) resolve(); });
    server.stderr.on('data', (d) => process.stderr.write(d));
    server.on('error', reject);
  });
}
const stopServer = async () => { await sleep(700); server.kill(); await sleep(300); };

const connect = () => new Promise((res) => {
  const s = io(URL, { transports: ['websocket'], reconnection: false });
  s.on('connect', () => res(s));
});
const ask = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, res));

const { questions } = await import('../src/data/questions.js');
const correctOf = (text) => questions.find((x) => x.question === text).correctAnswer;
const wrongOf = (text) => [0, 1, 2, 3].find((i) => i !== correctOf(text));

async function newUser() {
  const s = await connect();
  const r = await ask(s, 'register');
  return { s, token: r.token, profile: r.profile };
}

function attachDuel(u, strategy) {
  u.events = []; u.rounds = []; u.over = null; u.leak = false;
  u.s.on('match_found', (m) => { u.opponent = m.opponent; u.events.push('match_found'); });
  u.s.on('question', (q) => {
    u.events.push('question');
    if ('correctAnswer' in q || 'correctIndex' in q) u.leak = true;
    strategy?.(u, q);
  });
  u.s.on('you_locked', () => u.events.push('you_locked'));
  u.s.on('opponent_locked', (d) => { u.events.push('opponent_locked'); u.oppLock = d; });
  u.s.on('round_result', (r) => u.rounds.push(r));
  u.s.on('game_over', (g) => { u.over = g; });
  u.s.on('queue_error', (e) => { u.queueError = e.error; });
}

try {
  await startServer();

  // ---------------------------------------------------------------- Hesap
  log('\n[Hesap ve profil]');
  const A = await newUser();
  const B = await newUser();
  check('kayıt: token ve profil geldi', !!A.token && A.profile.coins === 500 && A.profile.elo === 1200 && A.profile.diamonds === 50, A.profile);
  check('farklı kullanıcı adları üretildi', A.profile.username !== B.profile.username);

  const r1 = await ask(A.s, 'update_profile', { username: 'Ali Bey', avatar: '🦁' });
  check('geçerli ad + avatar kabul edildi', r1.ok && r1.profile.username === 'Ali Bey' && r1.profile.avatar === '🦁', r1);
  check('çok kısa ad reddedildi', (await ask(A.s, 'update_profile', { username: 'ab' })).error === 'invalid_name');
  check('özel karakterli ad reddedildi', (await ask(A.s, 'update_profile', { username: '<script>x</script>' })).error === 'invalid_name');
  check('16+ karakterli ad reddedildi', (await ask(A.s, 'update_profile', { username: 'a'.repeat(16) })).error === 'invalid_name');
  check('aynı ad (büyük/küçük harf fark etmez) reddedildi', (await ask(B.s, 'update_profile', { username: 'ali bey' })).error === 'name_taken');
  check('Türkçe karakterli ad kabul edildi', (await ask(B.s, 'update_profile', { username: 'Şükrü Çağlar' })).ok);
  check('premium avatar paketsiz reddedildi', (await ask(A.s, 'update_profile', { avatar: '🐉' })).error === 'invalid_avatar');
  check('rastgele metin avatar olarak reddedildi', (await ask(A.s, 'update_profile', { avatar: 'http://x.com' })).error === 'invalid_avatar');

  const s2 = await connect();
  const au = await ask(s2, 'auth', { token: A.token });
  check('token ile tekrar giriş aynı profili verdi', au.ok && au.profile.username === 'Ali Bey', au);
  s2.close();
  const s3 = await connect();
  check('geçersiz token reddedildi', (await ask(s3, 'auth', { token: 'x'.repeat(64) })).ok === false);
  check('girişsiz leaderboard reddedildi', (await ask(s3, 'leaderboard', {})).error === 'not_authenticated');
  check('girişsiz satın alma reddedildi', (await ask(s3, 'purchase', { itemId: 'gems_100' })).error === 'not_authenticated');
  attachDuel({ s: s3 });
  let qerr; s3.on('queue_error', (e) => { qerr = e.error; });
  s3.emit('join_queue'); await sleep(300);
  check('girişsiz kuyruğa girilemedi', qerr === 'not_authenticated');
  s3.close();

  // ---------------------------------------------------------------- Düello
  log('\n[İnsan düellosu: ödül ve ELO]');
  attachDuel(A, (u, q) => setTimeout(() => u.s.emit('answer', { option: correctOf(q.text) }), q.index === 2 ? 700 : 300));
  attachDuel(B, (u, q) => { if (q.index === 2) u.s.emit('answer', { option: wrongOf(q.text) }); });
  A.s.emit('join_queue'); B.s.emit('join_queue');

  // Aynı hesabın ikinci bağlantısı kuyruğa giremez
  const A2 = await connect();
  await ask(A2, 'auth', { token: A.token });
  let dupErr; A2.on('queue_error', (e) => { dupErr = e.error; });
  A2.emit('join_queue'); await sleep(300);
  check('aynı hesap iki yerde oynayamaz', dupErr === 'already_playing');
  A2.close();

  const t0 = Date.now();
  while (!(A.over && B.over) && Date.now() - t0 < 60000) await sleep(300);

  check('eşleşme: rakip insan ve güncel adıyla geldi', A.opponent?.isBot === false && A.opponent?.name === 'Şükrü Çağlar', A.opponent);
  check('10 tur oynandı, oyun bitti', A.rounds.length === 10 && !!A.over && !!B.over);
  check('Ali 100, Veli 0 puan', A.over?.playerScore === 100 && B.over?.playerScore === 0);
  check('Veli kilitlendi, Ali ek süre aldı', B.events.includes('you_locked') && A.oppLock?.bonusSeconds === 5);
  check('cevap soruyla birlikte sızmadı', !A.leak && !B.leak);
  check('kazanan ödülü: +25 altın, +16 ELO', A.over?.rewards?.coins === 25 && A.over?.rewards?.eloDelta === 16, A.over?.rewards);
  check('kaybeden ödülü: +10 altın, -16 ELO', B.over?.rewards?.coins === 10 && B.over?.rewards?.eloDelta === -16, B.over?.rewards);

  const chkA = await connect(); const pa = (await ask(chkA, 'auth', { token: A.token })).profile;
  const chkB = await connect(); const pb = (await ask(chkB, 'auth', { token: B.token })).profile;
  check('Ali profili: 525 altın, 1216 ELO, 1 galibiyet', pa.coins === 525 && pa.elo === 1216 && pa.stats.wins === 1 && pa.stats.totalGames === 1, pa);
  check('Veli profili: 510 altın, 1184 ELO, 1 mağlubiyet', pb.coins === 510 && pb.elo === 1184 && pb.stats.losses === 1, pb);
  check('maç geçmişi kaydedildi', pa.history[0]?.result === 'W' && pa.history[0]?.opponent === 'Şükrü Çağlar', pa.history);
  check('lig bilgisi hesaplandı', pa.league === 'Gümüş' && pa.nextLeague?.name === 'Altın', pa);

  // ---------------------------------------------------------------- Sıralama
  log('\n[Sıralama]');
  for (const period of ['all', 'weekly', 'daily']) {
    const lb = await ask(chkA, 'leaderboard', { period });
    check(`${period}: Ali 1., Veli 2.`, lb.ok && lb.entries[0]?.username === 'Ali Bey' && lb.entries[1]?.rank === 2 && lb.me?.isMe && lb.me.rank === 1, lb);
  }

  // ---------------------------------------------------------------- Mağaza
  log('\n[Mağaza]');
  let p = await ask(chkA, 'purchase', { itemId: 'extra_time' });
  check('Ekstra Süre x5: 50 elmas harcandı, envanter 5', p.ok && p.profile.diamonds === 0 && p.profile.inventory.extraTime === 5, p);
  check('elmas yetersizse reddedildi', (await ask(chkA, 'purchase', { itemId: 'shield' })).error === 'insufficient_diamonds');
  check('bilinmeyen ürün reddedildi', (await ask(chkA, 'purchase', { itemId: 'free_gold' })).error === 'unknown_item');
  p = await ask(chkA, 'purchase', { itemId: 'gems_500' });
  check('test modunda elmas paketi verildi (+500)', p.ok && p.profile.diamonds === 500, p);
  p = await ask(chkA, 'purchase', { itemId: 'avatar_pack' });
  check('Avatar paketi: 150 elmas, premium avatarlar açıldı', p.ok && p.profile.diamonds === 350 && p.profile.unlockedAvatars.includes('🐉'), p);
  check('avatar paketi ikinci kez alınamaz', (await ask(chkA, 'purchase', { itemId: 'avatar_pack' })).error === 'already_owned');
  check('premium avatar artık seçilebilir', (await ask(chkA, 'update_profile', { avatar: '🐉' })).ok);
  p = await ask(chkA, 'purchase', { itemId: 'gold_boost' });
  check('Altın boost alındı (5 maç)', p.ok && p.profile.goldBoost === 5 && p.profile.diamonds === 270, p);

  // ---------------------------------------------------------------- Arcade
  log('\n[Arcade ödülü]');
  const C = await newUser();
  const ar1 = await ask(C.s, 'arcade_reward', { score: 10000 });
  check('arcade ödülü üst sınırla (150) verildi', ar1.ok && ar1.coins === 150 && ar1.profile.coins === 650, ar1);
  check('arka arkaya ödül reddedildi', (await ask(C.s, 'arcade_reward', { score: 50 })).error === 'too_fast');
  const ar2 = await ask(chkB, 'arcade_reward', { score: 'abc' });
  check('saçma skor 0 altın verir', ar2.ok && ar2.coins === 0, ar2);

  // ---------------------------------------------------------------- Bot + erken çıkış
  log('\n[Bot eşleşmesi ve erken çıkış = yenilgi]');
  attachDuel(C, () => {});
  C.s.emit('join_queue');
  const t1 = Date.now();
  while (!C.opponent && Date.now() - t1 < 15000) await sleep(200);
  check('tek oyuncu 3 sn sonra botla eşleşti', C.opponent?.isBot === true, C.opponent);
  C.s.emit('leave_room'); await sleep(500);
  const chkC = await connect(); const pc = (await ask(chkC, 'auth', { token: C.token })).profile;
  check('botlu maçtan çıkmak yenilgi sayıldı', pc.stats.totalGames === 1 && pc.stats.losses === 1 && pc.coins === 660, pc);
  check('bota karşı ELO kaybı yarım (K=16)', pc.elo >= 1190 && pc.elo < 1200, pc.elo);

  // ---------------------------------------------------------------- Kalıcılık
  log('\n[Kalıcılık: sunucu yeniden başlatılınca veri korunur]');
  for (const s of [A.s, B.s, C.s, chkA, chkB, chkC]) s.close();
  await stopServer();
  await startServer();
  const r = await connect();
  const again = await ask(r, 'auth', { token: A.token });
  check('yeniden başlatma sonrası Ali profili aynı', again.ok && again.profile.elo === 1216 && again.profile.username === 'Ali Bey' && again.profile.avatarPack === true, again);
  r.close();
} finally {
  server?.kill();
  rmSync(tmp, { recursive: true, force: true });
}

log(failed ? `\n❌ ${failed} test başarısız` : '\n✅ Tüm testler geçti');
process.exit(failed ? 1 : 0);
