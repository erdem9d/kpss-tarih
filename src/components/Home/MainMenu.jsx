import React from 'react';

const MODES = [
  { key: 'duel', icon: '⚔️', title: 'DÜELLO BUL', sub: 'Gerçek rakiple yarış, ilk bilen puanı alır', primary: true },
  { key: 'arcade', icon: '🕹️', title: 'ARCADE MODU', sub: 'Tek başına oyna • 3 can • sonsuz soru' },
  { key: 'quick', icon: '⚡', title: 'HIZLI QUİZ', sub: '10 soruluk hızlı tur' },
];

export default function MainMenu({ onStartDuel, onQuickQuiz, onArcade, playerData }) {
  const handlers = { duel: onStartDuel, arcade: onArcade, quick: onQuickQuiz };
  const name = playerData?.username || 'Oyuncu';

  return (
    <div style={{ minHeight: '100vh', padding: '16px 16px 90px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Profil çubuğu */}
      <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', animation: 'fadeIn .5s both' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '1.7rem', background: 'radial-gradient(circle, var(--navy-600), var(--navy-900))', border: '3px solid var(--gold-400)', boxShadow: '0 0 14px rgba(246,200,95,.5)' }}>{playerData?.avatar || '👤'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div style={{ fontSize: '.75rem', color: 'var(--gold-300)', fontWeight: 700 }}>🛡️ {playerData?.league || 'Gümüş'} Lig</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="pill">🪙 {playerData?.gold ?? 0}</span>
          <span className="pill">💎 {playerData?.diamonds ?? 0}</span>
        </div>
      </div>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginTop: 8, animation: 'fadeIn .6s .1s both' }}>
        <div style={{ fontSize: '3.4rem', animation: 'float 3s ease-in-out infinite', filter: 'drop-shadow(0 6px 14px rgba(246,200,95,.5))' }}>🏛️</div>
        <h1 className="gold-text" style={{ fontSize: '2.3rem', lineHeight: 1.1, letterSpacing: 2 }}>TARİH DÜELLO</h1>
        <div style={{ color: 'var(--gold-300)', fontWeight: 700, fontSize: '.8rem', letterSpacing: 4, marginTop: 4 }}>✦ KPSS BİLGİ YARIŞMASI ✦</div>
      </div>

      {/* Oyun modları */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
        {MODES.map((m, i) => (
          <button
            key={m.key}
            className={m.primary ? 'btn-gold' : 'btn-navy'}
            onClick={handlers[m.key]}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
              padding: m.primary ? '22px 18px' : '16px 18px',
              animation: `fadeIn .5s ${0.2 + i * 0.1}s both${m.primary ? ', glow 2.4s 1s infinite' : ''}`,
            }}
          >
            <span style={{ fontSize: m.primary ? '2.4rem' : '1.9rem' }}>{m.icon}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: m.primary ? '1.35rem' : '1.1rem', letterSpacing: 1 }}>{m.title}</span>
              <span style={{ display: 'block', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '.75rem', opacity: m.primary ? 0.75 : 0.8, marginTop: 2 }}>{m.sub}</span>
            </span>
            <span style={{ fontSize: '1.4rem' }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
