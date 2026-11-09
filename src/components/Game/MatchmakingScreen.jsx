import React, { useState, useEffect } from 'react';

const MatchmakingScreen = ({ onMatchFound }) => {
  const [phase, setPhase] = useState('searching'); // searching, found, countdown
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Radar halkası için yerel keyframe
    const styleSheet = document.createElement('style');
    styleSheet.innerText = `
      @keyframes radarPing {
        0% { transform: scale(0.3); opacity: 0.9; }
        100% { transform: scale(1.5); opacity: 0; }
      }
    `;
    document.head.appendChild(styleSheet);

    const searchTimer = setTimeout(() => {
      setPhase('found');
      setTimeout(() => {
        setPhase('countdown');
        let count = 3;
        const countInterval = setInterval(() => {
          count -= 1;
          setCountdown(count);
          if (count === 0) {
            clearInterval(countInterval);
            onMatchFound();
          }
        }, 1000);
      }, 2000);
    }, 3000);

    return () => {
      clearTimeout(searchTimer);
      document.head.removeChild(styleSheet);
    };
  }, [onMatchFound]);

  const searching = phase === 'searching';
  const title =
    phase === 'searching' ? 'RAKİP ARANIYOR...' :
    phase === 'found' ? 'RAKİP BULUNDU!' : 'DÜELLO BAŞLIYOR!';

  const card = {
    flex: 1,
    maxWidth: 150,
    padding: '18px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  };
  const avatar = {
    width: 76,
    height: 76,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 38,
    border: '3px solid var(--gold-400)',
    boxShadow: '0 0 18px rgba(246,200,95,0.45)',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        padding: '24px 14px',
        overflow: 'hidden',
      }}
    >
      <h1
        className="gold-text"
        style={{ fontSize: '1.7rem', textAlign: 'center', letterSpacing: 2, animation: 'fadeIn 0.6s ease-out' }}
      >
        {title}
      </h1>

      {/* Radar */}
      <div style={{ position: 'relative', width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {[0, 0.8, 1.6].map((d) => (
          <div
            key={d}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px solid var(--gold-400)',
              animation: searching ? `radarPing 2.4s ease-out ${d}s infinite` : 'none',
              opacity: searching ? undefined : 0.15,
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            inset: 20,
            borderRadius: '50%',
            border: '3px dashed var(--gold-500)',
            animation: `spin ${searching ? 4 : 12}s linear infinite`,
            opacity: 0.8,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 50,
            borderRadius: '50%',
            border: '3px solid transparent',
            borderTopColor: 'var(--gold-300)',
            borderRightColor: 'var(--gold-500)',
            animation: 'spin 1.2s linear infinite',
          }}
        />
        <div
          className="panel"
          style={{
            width: 84,
            height: 84,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 40,
            animation: 'float 2s ease-in-out infinite',
          }}
        >
          ⚔️
        </div>
      </div>

      {/* Oyuncular */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 440, gap: 6 }}>
        <div className="panel" style={{ ...card, animation: 'slideInLeft 0.6s ease-out' }}>
          <div style={{ ...avatar, background: 'linear-gradient(180deg, var(--navy-600), var(--navy-800))' }}>👤</div>
          <div className="title-font" style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--gold-300)' }}>SEN</div>
          <span className="pill">🏅 Hazır</span>
        </div>

        <div
          key={phase === 'searching' ? 'vs-s' : 'vs-f'}
          className="gold-text"
          style={{
            fontSize: '2.4rem',
            padding: '0 4px',
            filter: 'drop-shadow(0 0 12px rgba(246,200,95,0.7))',
            animation: searching ? 'pulse 1.2s ease-in-out infinite' : 'bounceIn 0.6s ease-out',
          }}
        >
          VS
        </div>

        <div className="panel" style={{ ...card, animation: 'slideInRight 0.6s ease-out' }}>
          {searching ? (
            <>
              <div style={{ ...avatar, background: 'rgba(5,13,31,0.8)', borderStyle: 'dashed', borderColor: 'var(--gold-700)', boxShadow: 'none' }}>
                <span className="gold-text" style={{ fontSize: 40, animation: 'pulse 1s ease-in-out infinite' }}>?</span>
              </div>
              <div className="title-font" style={{ fontSize: '1rem', fontWeight: 800, color: 'rgba(255,255,255,0.45)' }}>???</div>
              <span className="pill" style={{ opacity: 0.6 }}>⏳ Aranıyor</span>
            </>
          ) : (
            <div style={{ display: 'contents' }}>
              <div style={{ ...avatar, background: 'linear-gradient(180deg, #ff6b70, #c0262c)', animation: 'bounceIn 0.6s ease-out' }}>🤖</div>
              <div className="title-font" style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--gold-300)' }}>Rakip_2024</div>
              <span className="pill">🏅 Hazır</span>
            </div>
          )}
        </div>
      </div>

      {/* Geri sayım */}
      <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {phase === 'countdown' && countdown > 0 && (
          <div
            key={countdown}
            className="gold-text"
            style={{
              fontSize: '6rem',
              lineHeight: 1,
              filter: 'drop-shadow(0 0 18px rgba(246,200,95,0.8))',
              animation: 'countDown 1s ease-in-out',
            }}
          >
            {countdown}
          </div>
        )}
        {phase === 'found' && (
          <div className="pill" style={{ animation: 'fadeIn 0.5s ease-out' }}>⚡ Düello hazırlanıyor...</div>
        )}
      </div>
    </div>
  );
};

export default MatchmakingScreen;
