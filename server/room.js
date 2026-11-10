import { questions as allQuestions } from '../src/data/questions.js';

export const ROUNDS = 10;
export const ROUND_SECONDS = 15;
export const LOCK_BONUS_SECONDS = 5;
export const POINTS = 10;
const REVEAL_MS = 2200;

const pickQuestions = (n) =>
  [...allQuestions].sort(() => Math.random() - 0.5).slice(0, n);

const rand = (min, max) => min + Math.random() * (max - min);

/**
 * Tek bir düello odası. Tüm kurallar (kim önce bildi, kilitlenme, ek süre,
 * puanlama) burada, sunucuda çözülür. Oyuncu tarafı sadece olayları gösterir.
 *
 * Oyuncu: { id, name, avatar, elo, socket|null, isBot }
 */
export class Room {
  constructor(id, players, onClose, settle) {
    this.id = id;
    this.players = players;
    this.onClose = onClose;
    this.settle = settle; // (player, outcome) => rewards | null
    this.settled = false;
    this.questions = pickQuestions(ROUNDS);
    this.index = -1;
    this.round = null;
    this.closed = false;
    this.stats = {};
    this.scores = {};
    for (const p of players) {
      this.scores[p.id] = 0;
      this.stats[p.id] = { correct: 0, wrong: 0, fast: 0 };
    }
  }

  other(id) {
    return this.players.find((p) => p.id !== id);
  }

  send(player, event, payload) {
    if (player.socket) player.socket.emit(event, payload);
  }

  broadcast(event, payloadFor) {
    for (const p of this.players) this.send(p, event, payloadFor(p));
  }

  publicOpponent(forPlayer) {
    const o = this.other(forPlayer.id);
    return { name: o.name, avatar: o.avatar, elo: o.elo, isBot: !!o.isBot };
  }

  start() {
    this.broadcast('match_found', (p) => ({
      roomId: this.id,
      opponent: this.publicOpponent(p),
      rounds: ROUNDS,
    }));
    this.timer = setTimeout(() => this.nextRound(), 4500);
  }

  nextRound() {
    if (this.closed) return;
    this.index += 1;
    if (this.index >= ROUNDS) return this.finish();

    const q = this.questions[this.index];
    this.round = {
      resolved: false,
      locked: new Map(), // playerId -> yanlış seçilen şık
      startedAt: Date.now(),
      endsAt: Date.now() + ROUND_SECONDS * 1000,
      timeout: null,
      botTimeout: null,
    };
    this.armTimeout();

    this.broadcast('question', () => ({
      index: this.index,
      total: ROUNDS,
      text: q.question,
      options: q.options,
      category: q.category,
      seconds: ROUND_SECONDS,
      scores: null,
    }));
    this.scheduleBot();
  }

  armTimeout() {
    clearTimeout(this.round.timeout);
    const ms = Math.max(0, this.round.endsAt - Date.now());
    this.round.timeout = setTimeout(() => this.resolve(null, 'timeout'), ms);
  }

  scheduleBot() {
    const bot = this.players.find((p) => p.isBot);
    if (!bot || this.round.resolved || this.round.locked.has(bot.id)) return;
    clearTimeout(this.round.botTimeout);

    const human = this.other(bot.id);
    const humanLocked = this.round.locked.has(human.id);
    // Rakip yanlış yaptıysa bot daha hızlı karar verir
    const delay = humanLocked ? rand(1200, 3500) : rand(2500, 9000);
    const correctChance = humanLocked ? 0.75 : 0.6;

    this.round.botTimeout = setTimeout(() => {
      if (this.round?.resolved) return;
      const q = this.questions[this.index];
      let pick = q.correctAnswer;
      if (Math.random() > correctChance) {
        const banned = new Set([q.correctAnswer, ...this.round.locked.values()]);
        const wrong = [0, 1, 2, 3].filter((i) => !banned.has(i));
        pick = wrong[Math.floor(Math.random() * wrong.length)];
      }
      this.handleAnswer(bot.id, pick);
    }, delay);
  }

  handleAnswer(playerId, option) {
    const r = this.round;
    if (this.closed || !r || r.resolved) return;
    if (!Number.isInteger(option) || option < 0 || option > 3) return;
    if (r.locked.has(playerId)) return; // zaten yanlış yaptı

    const q = this.questions[this.index];
    const me = this.players.find((p) => p.id === playerId);
    const opp = this.other(playerId);

    // Rakip yanlış seçtiyse o şık artık seçilemez
    const oppWrong = r.locked.get(opp.id);
    if (oppWrong === option) return;

    if (option === q.correctAnswer) {
      const elapsed = Date.now() - r.startedAt;
      this.scores[playerId] += POINTS;
      this.stats[playerId].correct += 1;
      if (elapsed <= 5000) this.stats[playerId].fast += 1;
      return this.resolve(playerId, 'correct', { [playerId]: option });
    }

    // Yanlış cevap
    this.stats[playerId].wrong += 1;
    r.locked.set(playerId, option);

    if (r.locked.size >= this.players.length) {
      return this.resolve(null, 'both_wrong');
    }

    // Rakibe ek süre ver
    r.endsAt += LOCK_BONUS_SECONDS * 1000;
    this.armTimeout();
    this.send(me, 'you_locked', { option });
    this.send(opp, 'opponent_locked', {
      option,
      bonusSeconds: LOCK_BONUS_SECONDS,
    });
    this.scheduleBot();
  }

  resolve(winnerId, reason, picks = {}) {
    const r = this.round;
    if (!r || r.resolved) return;
    r.resolved = true;
    clearTimeout(r.timeout);
    clearTimeout(r.botTimeout);

    const q = this.questions[this.index];
    this.broadcast('round_result', (p) => {
      const o = this.other(p.id);
      return {
        index: this.index,
        reason,
        correctIndex: q.correctAnswer,
        winner: winnerId === null ? null : winnerId === p.id ? 'you' : 'opponent',
        myWrong: r.locked.has(p.id) ? r.locked.get(p.id) : null,
        opponentWrong: r.locked.has(o.id) ? r.locked.get(o.id) : null,
        scores: { you: this.scores[p.id], opponent: this.scores[o.id] },
      };
    });
    this.timer = setTimeout(() => this.nextRound(), REVEAL_MS);
  }

  /** Her oyuncu için maç sonucunu hesaplar ve (varsa) ödülünü işler. Maç başına bir kez çalışır. */
  settleAll(forfeitBy) {
    const rewards = {};
    if (this.settled) return rewards;
    this.settled = true;
    for (const p of this.players) {
      if (p.isBot) continue;
      const o = this.other(p.id);
      const mine = this.scores[p.id];
      const theirs = this.scores[o.id];
      const won = forfeitBy ? p.id !== forfeitBy : mine > theirs;
      const draw = !forfeitBy && mine === theirs;
      rewards[p.id] = this.settle?.(p, {
        won,
        draw,
        opponentId: o.userId || null,
        opponentElo: o.elo,
        opponentName: o.name,
        opponentAvatar: o.avatar,
        isBot: !!o.isBot,
        correct: this.stats[p.id].correct,
      }) ?? null;
    }
    return rewards;
  }

  finish(forfeitBy = null) {
    if (this.closed) return;
    const rewards = this.settleAll(forfeitBy);
    this.broadcast('game_over', (p) => {
      const o = this.other(p.id);
      const mine = this.stats[p.id];
      return {
        forfeit: forfeitBy ? (forfeitBy === p.id ? 'you' : 'opponent') : null,
        playerScore: this.scores[p.id],
        opponentScore: this.scores[o.id],
        rewards: rewards[p.id] || null,
        stats: {
          correctAnswers: mine.correct,
          firstToAnswer: mine.correct,
          fastBonus: mine.fast * 5,
          wrongAnswers: mine.wrong,
        },
      };
    });
    this.close();
  }

  playerLeft(playerId) {
    if (this.closed) return;
    const left = this.players.find((p) => p.id === playerId);
    const stayer = this.other(playerId);
    if (!stayer) return this.close();
    if (stayer.isBot) {
      // Botlu maçtan çıkmak yenilgi sayılır (çıkarak ELO kaybından kaçılamaz)
      this.settleAll(playerId);
      return this.close();
    }
    // Rakip ayrıldı: kalan oyuncu hükmen kazanır
    this.scores[stayer.id] = Math.max(this.scores[stayer.id], this.scores[left.id] + POINTS);
    this.send(stayer, 'opponent_left', {});
    this.finish(playerId);
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    if (this.round) {
      clearTimeout(this.round.timeout);
      clearTimeout(this.round.botTimeout);
    }
    this.onClose?.(this);
  }
}
