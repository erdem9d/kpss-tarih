// Oyunun sabit verileri: ligler, avatarlar, mağaza ürünleri.
// Fiyatlar ve ödüller yalnızca sunucuda belirlenir; istemci sadece ürün kimliği gönderir.

export const LEAGUES = [
  { name: 'Bronz', min: 0 },
  { name: 'Gümüş', min: 1000 },
  { name: 'Altın', min: 1400 },
  { name: 'Elmas', min: 1800 },
  { name: 'Efsane', min: 2200 },
];

export function leagueOf(elo) {
  let current = LEAGUES[0];
  for (const l of LEAGUES) if (elo >= l.min) current = l;
  return current;
}

export function nextLeagueOf(elo) {
  return LEAGUES.find((l) => l.min > elo) || null;
}

export const BASE_AVATARS = ['👤', '🧑‍🎓', '🥷', '🤴', '👸', '🦁', '🦅', '🐺', '🌙', '⚔️'];
export const PREMIUM_AVATARS = ['🐉', '👑', '🏹', '🛡️', '🗡️', '🐎', '🏰', '📜', '🔱', '🦂'];

export const START = { coins: 500, diamonds: 50, elo: 1200 };

export const REWARDS = { win: 25, draw: 15, loss: 10 };

// kind: gems | powerup | avatar_pack | gold_boost
export const SHOP = {
  gems_100: { kind: 'gems', amount: 100 },
  gems_500: { kind: 'gems', amount: 500 },
  gems_1200: { kind: 'gems', amount: 1200 },
  extra_time: { kind: 'powerup', key: 'extraTime', amount: 5, diamonds: 50 },
  eliminate_wrong: { kind: 'powerup', key: 'eliminateWrong', amount: 3, diamonds: 40 },
  shield: { kind: 'powerup', key: 'shield', amount: 3, diamonds: 60 },
  avatar_pack: { kind: 'avatar_pack', diamonds: 150 },
  gold_boost: { kind: 'gold_boost', matches: 5, diamonds: 80 },
};
