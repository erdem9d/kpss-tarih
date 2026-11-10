// Oyunun sabit verileri: ligler, avatarlar, mağaza ürünleri.
// Fiyatlar ve ödüller yalnızca sunucuda belirlenir; istemci sadece ürün kimliği gönderir.

export const LEAGUES = [
  { name: 'Bronz', min: 0, icon: '🥉', color: '#cd7f32' },
  { name: 'Gümüş', min: 1150, icon: '🥈', color: '#c0c8d4' },
  { name: 'Altın', min: 1230, icon: '🥇', color: '#f6c85f' },
  { name: 'Elmas', min: 1320, icon: '💎', color: '#4cc9f0' },
  { name: 'Efsane', min: 1450, icon: '👑', color: '#c77dff' },
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
  gems_100: { kind: 'gems', amount: 100, priceTRY: 29.90 },
  gems_500: { kind: 'gems', amount: 500, priceTRY: 99.90 },
  gems_1200: { kind: 'gems', amount: 1200, priceTRY: 199.90 },
  extra_time: { kind: 'powerup', key: 'extraTime', amount: 5, diamonds: 50 },
  eliminate_wrong: { kind: 'powerup', key: 'eliminateWrong', amount: 3, diamonds: 40 },
  shield: { kind: 'powerup', key: 'shield', amount: 3, diamonds: 60 },
  avatar_pack: { kind: 'avatar_pack', diamonds: 150 },
  gold_boost: { kind: 'gold_boost', matches: 5, diamonds: 80 },
};
