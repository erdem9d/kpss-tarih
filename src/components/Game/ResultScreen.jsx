import React, { useMemo } from 'react';

const ResultScreen = ({ playerScore, opponentScore, stats, rewards, onPlayAgain, onMainMenu }) => {
  const isWin = playerScore > opponentScore;
  const isDraw = playerScore === opponentScore;

  // ~30 altın konfeti parçası (yalnızca galibiyette)
  const pieces = useMemo(() => {
    const colors = ['#ffe08a', '#f6c85f', '#d4a843', '#8a6a1f'];
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 6 + Math.random() * 8,
      delay: Math.random() * 3,
      duration: 2.8 + Math.random() * 2.5,
      color: colors[i % colors.length],
      round: i % 3 === 0,
    }));
  }, []);

  const panelBase = { width: '100%', maxWidth: 400 };
  const s = stats || {};

  const statRows = [
    ['✔️', 'Doğru Cevap', s.correctAnswers || 0],
    ['⚡', 'İlk Bilen', s.firstToAnswer || 0],
    ['🚀', 'Hızlı Bonus', s.fastBonus || 0],
  ];

  const titleStyle = isWin
    ? { fontSize: '2.6rem', letterSpacing: 3, filter: 'drop-shadow(0 0 14px rgba(246,200,95,0.6))' }
    : {
        fontSize: '2.4rem',
        letterSpacing: 3,
        fontFamily: 'var(--font-title)',
        fontWeight: 800,
        color: isDraw ? 'var(--gold-400)' : '#7fa6d6',
        textShadow: '0 2px 8px rgba(0,0,0,0.6)',
      };

  const scoreName = { fontSize: '0.8rem', fontWeight: 800, color: 'var(--gold-400)', letterSpacing: 2 };

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '36px 18px 28px',
        gap: 18,
        overflow: 'hidden',
        background: isWin || isDraw ? undefined : 'linear-gradient(180deg, rgba(10,26,58,0.7), rgba(5,13,31,0.95))',
      }}
    >
      {isWin &&
        pieces.map((p) => (
          <span
            key={p.id}
            style={{
              position: 'absolute',
              top: 0,
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 1.6,
              borderRadius: p.round ? '50%' : 2,
              background: p.color,
              pointerEvents: 'none',
              opacity: 0,
              animation: `confetti ${p.duration}s linear ${p.delay}s infinite`,
              zIndex: 1,
            }}
          />
        ))}

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, animation: 'bounceIn 0.7s ease-out' }}>
        <div
          style={{
            fontSize: '6rem',
            lineHeight: 1,
            animation: isWin ? 'float 2.5s ease-in-out infinite' : 'none',
            filter: isWin
              ? 'drop-shadow(0 0 24px rgba(246,200,95,0.9)) drop-shadow(0 8px 10px rgba(0,0,0,0.5))'
              : 'grayscale(0.4) drop-shadow(0 6px 8px rgba(0,0,0,0.5))',
          }}
        >
          {isWin ? '🏆' : isDraw ? '🤝' : '💔'}
        </div>
        {isWin ? (
          <h1 className="gold-text" style={titleStyle}>KAZANDIN!</h1>
        ) : (
          <h1 style={titleStyle}>{isDraw ? 'BERABERE' : 'KAYBETTİN'}</h1>
        )}
      </div>

      {/* Skor paneli */}
      <div className="panel" style={{ ...panelBase, zIndex: 2, display: 'flex', alignItems: 'center', padding: '18px 24px', animation: 'slideUp 0.6s ease-out' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 26 }}>👤</span>
          <span style={scoreName}>SEN</span>
          <span className={isWin ? 'gold-text' : 'title-font'} style={{ fontSize: '2.8rem', fontWeight: 800 }}>{playerScore}</span>
        </div>
        <div className="title-font" style={{ fontSize: '1.6rem', color: 'var(--gold-700)', padding: '0 10px' }}>—</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 26 }}>🤖</span>
          <span style={scoreName}>RAKİP</span>
          <span className="title-font" style={{ fontSize: '2.8rem', fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>{opponentScore}</span>
        </div>
      </div>

      {/* İstatistikler */}
      <div className="panel" style={{ ...panelBase, zIndex: 2, padding: '16px 20px', animation: 'slideUp 0.8s ease-out' }}>
        <h3 className="gold-text" style={{ textAlign: 'center', fontSize: '1.05rem', letterSpacing: 2, marginBottom: 8 }}>
          MAÇ İSTATİSTİKLERİ
        </h3>
        {statRows.map(([icon, label, value], i) => (
          <div
            key={label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 0',
              fontWeight: 700,
              borderBottom: i < statRows.length - 1 ? '1px solid rgba(212,168,67,0.25)' : 'none',
            }}
          >
            <span>{icon} {label}</span>
            <span className="title-font" style={{ fontSize: '1.2rem', color: 'var(--gold-300)' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Ödüller & Lig Durumu */}
      <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%', maxWidth: 400, animation: 'fadeIn 1s ease-out' }}>
        {rewards ? (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <span className="pill" style={{ fontSize: '1rem', padding: '8px 16px', color: 'var(--gold-300)' }}>
                🪙 +{rewards.coins} Altın{rewards.boosted ? ' (x2 ⚡)' : ''}
              </span>
              <span className="pill" style={{ fontSize: '1rem', padding: '8px 16px', color: rewards.eloDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                📈 {rewards.eloDelta >= 0 ? '+' : ''}{rewards.eloDelta} ELO
              </span>
            </div>

            {rewards.promoted && (
              <div className="panel" style={{
                width: '100%', padding: '12px 16px', textAlign: 'center',
                borderColor: 'var(--gold-300)',
                background: 'linear-gradient(160deg, rgba(212,168,67,0.45), rgba(10,26,58,0.95))',
                boxShadow: '0 0 26px rgba(246,200,95,0.65)',
                animation: 'bounceIn 0.6s ease-out',
              }}>
                <div style={{ fontSize: '1.5rem' }}>🎉 {rewards.newLeagueIcon || '🏆'} 🎉</div>
                <div className="gold-text" style={{ fontSize: '1.2rem', letterSpacing: 2 }}>
                  LİG ATLADIN: {rewards.newLeague?.toUpperCase()} LİGİ!
                </div>
              </div>
            )}

            {rewards.newLeague && (
              <div className="panel" style={{ width: '100%', padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', fontWeight: 800, marginBottom: 6 }}>
                  <span style={{ color: rewards.newLeagueColor || 'var(--gold-300)' }}>
                    {rewards.newLeagueIcon || '🛡️'} {rewards.newLeague} Ligi ({rewards.elo} ELO)
                  </span>
                  {rewards.nextLeague ? (
                    <span style={{ color: '#9fb0d4', fontSize: '0.74rem' }}>
                      {rewards.nextLeague.icon} {rewards.nextLeague.name}: +{Math.max(0, rewards.nextLeague.min - rewards.elo)} ELO
                    </span>
                  ) : (
                    <span style={{ color: 'var(--gold-300)', fontSize: '0.74rem' }}>👑 En Üst Lig</span>
                  )}
                </div>
                <div className="timer-track" style={{ height: 10 }}>
                  <div
                    className="timer-fill"
                    style={{
                      width: `${rewards.nextLeague
                        ? Math.min(100, Math.max(0, ((rewards.elo - (rewards.leagueMin || 0)) / (rewards.nextLeague.min - (rewards.leagueMin || 0))) * 100))
                        : 100}%`,
                      background: `linear-gradient(90deg, var(--gold-700), ${rewards.newLeagueColor || 'var(--gold-300)'})`,
                    }}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <span className="pill" style={{ fontSize: '.85rem', padding: '8px 16px', opacity: 0.8 }}>
            🎯 Alıştırma maçı — ödül yok
          </span>
        )}
      </div>

      {/* Butonlar */}
      <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 320, marginTop: 'auto', paddingTop: 8 }}>
        <button className="btn-gold" onClick={onPlayAgain} style={{ fontSize: '1.15rem', animation: isWin ? 'glow 2s ease-in-out infinite' : 'none' }}>
          🔄 TEKRAR OYNA
        </button>
        <button className="btn-navy" onClick={onMainMenu} style={{ fontSize: '1rem' }}>
          🏠 ANA MENÜ
        </button>
      </div>
    </div>
  );
};

export default ResultScreen;
