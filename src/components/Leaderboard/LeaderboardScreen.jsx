import React, { useState, useEffect } from 'react';
import { request, loadCachedLeaderboard } from '../../net/socket';

const DEFAULT_LEAGUES = [
  { name: 'Bronz', min: 0, icon: '🥉', color: '#cd7f32' },
  { name: 'Gümüş', min: 1150, icon: '🥈', color: '#c0c8d4' },
  { name: 'Altın', min: 1230, icon: '🥇', color: '#f6c85f' },
  { name: 'Elmas', min: 1320, icon: '💎', color: '#4cc9f0' },
  { name: 'Efsane', min: 1450, icon: '👑', color: '#c77dff' },
];

const LEAGUE_COLORS = {
  Bronz: '#cd7f32',
  Gümüş: '#c0c8d4',
  Altın: '#f6c85f',
  Elmas: '#4cc9f0',
  Efsane: '#c77dff',
};

const LEAGUE_ICONS = {
  Bronz: '🥉',
  Gümüş: '🥈',
  Altın: '🥇',
  Elmas: '💎',
  Efsane: '👑',
};

const TABS = [
  ['Tüm Zamanlar', 'all'],
  ['Haftalık', 'weekly'],
  ['Günlük', 'daily'],
];

const leagueOfElo = (elo) => {
  let cur = DEFAULT_LEAGUES[0];
  for (const l of DEFAULT_LEAGUES) if ((elo ?? 1200) >= l.min) cur = l;
  return cur;
};

const nextLeagueOfElo = (elo) => DEFAULT_LEAGUES.find((l) => l.min > (elo ?? 1200)) || null;

const leagueBadge = (league, small) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontSize: small ? '0.62rem' : '0.7rem',
    fontWeight: 900,
    padding: small ? '1px 7px' : '2px 9px',
    borderRadius: 999,
    color: LEAGUE_COLORS[league] || '#fff',
    border: `1.5px solid ${LEAGUE_COLORS[league] || '#fff'}`,
    background: 'rgba(5,13,31,0.75)',
  }}>
    <span>{LEAGUE_ICONS[league] || '🛡️'}</span>
    <span>{league}</span>
  </span>
);

const ringColors = { 1: '#f6c85f', 2: '#c0c8d4', 3: '#cd7f32' };

export default function LeaderboardScreen({ playerData, online = true, onBack }) {
  const [period, setPeriod] = useState('all');
  const [selectedLeague, setSelectedLeague] = useState(null); // null = tüm ligler
  const [data, setData] = useState(() => loadCachedLeaderboard('all'));
  const [status, setStatus] = useState(() => (loadCachedLeaderboard('all') ? 'ok' : 'loading'));

  useEffect(() => {
    let cancelled = false;
    const cached = loadCachedLeaderboard(period);
    if (cached) {
      setData(cached);
      setStatus('ok');
    } else {
      setStatus('loading');
    }
    request('leaderboard', { period }).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setData(res);
        setStatus('ok');
      } else if (!cached) {
        setStatus('error');
      }
    });
    return () => { cancelled = true; };
  }, [period, online]);

  const myElo = playerData?.elo ?? 1200;
  const myLeagueObj = leagueOfElo(myElo);
  const myNextLeague = nextLeagueOfElo(myElo);
  const progressPct = myNextLeague
    ? Math.min(100, Math.max(0, ((myElo - myLeagueObj.min) / (myNextLeague.min - myLeagueObj.min)) * 100))
    : 100;

  const allEntries = data?.entries || [];
  const entries = selectedLeague
    ? allEntries.filter((e) => e.league === selectedLeague)
    : allEntries;

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  // Sıra: 2. - 1. - 3. (ortadaki en yüksek)
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const meOutside = data?.me && !entries.some((e) => e.isMe) && (!selectedLeague || data.me.league === selectedLeague)
    ? data.me
    : null;

  const row = (player, i) => (
    <div
      key={player.id}
      className="panel"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 16,
        animation: `fadeIn 0.5s ${0.1 + i * 0.04}s both`,
        ...(player.isMe ? { borderColor: 'var(--gold-300)', boxShadow: '0 0 22px rgba(246,200,95,0.7), inset 0 0 0 3px rgba(5,13,31,0.9), inset 0 0 0 4px rgba(246,200,95,0.6)', background: 'linear-gradient(160deg, rgba(138,106,31,0.55), rgba(10,26,58,0.92))' } : {}),
      }}
    >
      <div className="title-font" style={{ width: 38, textAlign: 'center', fontWeight: 800, fontSize: '1.05rem', color: 'var(--gold-400)' }}>#{player.rank}</div>
      <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '1.3rem', background: 'var(--navy-700)', border: `2px solid ${LEAGUE_COLORS[player.league] || 'var(--gold-500)'}` }}>{player.avatar || '👤'}</div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontWeight: 800, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.username} {player.isMe && <span style={{ color: 'var(--gold-300)' }}>(Sen)</span>}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {leagueBadge(player.league)}
          {(player.wins > 0 || player.losses > 0) && (
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#9fb0d4' }}>
              <span style={{ color: 'var(--green)' }}>{player.wins}G</span> · <span style={{ color: 'var(--red)' }}>{player.losses}M</span>
            </span>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 900, color: 'var(--gold-300)', fontSize: '1rem' }}>{player.elo}</div>
        {player.gain !== null && player.gain !== undefined ? (
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: player.gain >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {player.gain >= 0 ? '+' : ''}{player.gain} ELO
          </div>
        ) : (
          <div style={{ fontSize: '0.62rem', opacity: 0.7, fontWeight: 700 }}>ELO</div>
        )}
      </div>
    </div>
  );

  const message = (icon, text) => (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9fb0d4', fontWeight: 700 }}>
      <div style={{ fontSize: '2.6rem', marginBottom: 10 }}>{icon}</div>
      {text}
    </div>
  );

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', padding: '20px 16px 90px', boxSizing: 'border-box', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, animation: 'fadeIn 0.5s both' }}>
        <button className="btn-navy" onClick={onBack} style={{ padding: '6px 14px', fontSize: '1.1rem', borderRadius: 14 }}>←</button>
        <h1 className="gold-text" style={{ flex: 1, textAlign: 'center', fontSize: '1.7rem', letterSpacing: 3 }}>SIRALAMA & LİG</h1>
        <div style={{ width: 48 }} />
      </div>

      {/* Oyuncunun mevcut ligi & kademe çubuğu */}
      <div className="panel" style={{ padding: '12px 14px', marginBottom: 14, animation: 'fadeIn 0.5s 0.05s both' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.5rem' }}>{myLeagueObj.icon}</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: '0.9rem', color: myLeagueObj.color }}>
                {myLeagueObj.name} Ligi · {myElo} ELO
              </div>
              <div style={{ fontSize: '0.7rem', color: '#9fb0d4', fontWeight: 700 }}>
                {myNextLeague
                  ? `${myNextLeague.icon} ${myNextLeague.name} Ligi için +${Math.max(0, myNextLeague.min - myElo)} ELO kaldı`
                  : 'En üst ligdesin! 👑'}
              </div>
            </div>
          </div>
          {data?.me && (
            <div className="pill" style={{ padding: '4px 10px', fontSize: '0.78rem', color: 'var(--gold-300)' }}>
              Sıran: #{data.me.rank}
            </div>
          )}
        </div>

        <div className="timer-track" style={{ height: 10, marginBottom: 10 }}>
          <div className="timer-fill" style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, var(--gold-700), ${myLeagueObj.color})`, transition: 'width .5s' }} />
        </div>

        {/* 5 Lig Kademe Seçici */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
          {DEFAULT_LEAGUES.map((lg) => {
            const isCurrent = lg.name === myLeagueObj.name;
            const isSelected = selectedLeague === lg.name;
            return (
              <button
                key={lg.name}
                onClick={() => setSelectedLeague(isSelected ? null : lg.name)}
                style={{
                  background: isSelected
                    ? 'linear-gradient(160deg, rgba(212,168,67,0.4), rgba(10,26,58,0.95))'
                    : isCurrent
                      ? 'rgba(246,200,95,0.16)'
                      : 'rgba(5,13,31,0.65)',
                  border: `1.5px solid ${isSelected || isCurrent ? lg.color : 'rgba(212,168,67,0.22)'}`,
                  borderRadius: 10,
                  padding: '5px 2px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  boxShadow: isCurrent ? `0 0 10px ${lg.color}55` : 'none',
                }}
              >
                <span style={{ fontSize: '1.05rem' }}>{lg.icon}</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 900, color: lg.color }}>{lg.name}</span>
                <span style={{ fontSize: '0.55rem', color: '#9fb0d4', fontWeight: 700 }}>{lg.min}+</span>
              </button>
            );
          })}
        </div>
        {selectedLeague && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button
              onClick={() => setSelectedLeague(null)}
              style={{ background: 'none', border: 'none', color: 'var(--gold-300)', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Filtreyi Kaldır (Tüm Ligleri Göster)
            </button>
          </div>
        )}
      </div>

      {/* Dönem Sekmeleri */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, animation: 'fadeIn 0.5s 0.1s both' }}>
        {TABS.map(([label, key]) => {
          const active = period === key;
          return (
            <button
              key={key}
              className={active ? 'btn-gold' : 'pill'}
              onClick={() => setPeriod(key)}
              style={active
                ? { flex: 1, padding: '10px 6px', fontSize: '0.8rem', borderRadius: 999, boxShadow: '0 3px 0 var(--gold-700), 0 6px 14px rgba(246,200,95,0.35)' }
                : { flex: 1, justifyContent: 'center', padding: '11px 6px', fontSize: '0.8rem', color: 'var(--gold-300)', cursor: 'pointer' }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {!online && status !== 'ok' && message('📡', 'Sıralamayı görmek için internet bağlantısı gerekli.')}
      {online && status === 'loading' && message('⏳', 'Yükleniyor...')}
      {online && status === 'error' && message('⚠️', 'Sıralama yüklenemedi. Tekrar dene.')}
      {status === 'ok' && entries.length === 0 && message('🏁', selectedLeague ? `${selectedLeague} Ligi'nde henüz oyuncu yok.` : period === 'all' ? 'Henüz maç oynayan yok. İlk sen ol!' : 'Bu dönemde henüz maç oynanmadı.')}

      {status === 'ok' && entries.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginBottom: 22 }}>
            {podiumOrder.map((p, idx) => {
              const first = p.rank === 1 || (top3.length === 1 && idx === 0);
              const size = first ? 82 : 64;
              const color = ringColors[p.rank] || '#f6c85f';
              return (
                <div key={p.id} style={{ flex: 1, maxWidth: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', animation: `fadeIn 0.6s ${0.15 + idx * 0.1}s both` }}>
                  {first && <div style={{ fontSize: '1.8rem', animation: 'float 2.4s ease-in-out infinite', marginBottom: -4 }}>👑</div>}
                  <div style={{
                    width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center',
                    fontSize: size * 0.5, background: 'var(--navy-700)', border: `4px solid ${color}`,
                    boxShadow: `0 0 ${first ? 26 : 14}px ${color}`,
                  }}>{p.avatar || '👤'}</div>
                  <div style={{ fontWeight: 800, fontSize: '0.78rem', marginTop: 8, textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: p.isMe ? 'var(--gold-300)' : undefined }}>
                    {p.username} {p.isMe ? '(Sen)' : ''}
                  </div>
                  <div style={{ color: 'var(--gold-300)', fontWeight: 900, fontSize: '0.8rem', marginBottom: 4 }}>
                    {p.gain !== null && p.gain !== undefined ? `${p.gain >= 0 ? '+' : ''}${p.gain} ELO` : `${p.elo} ELO`}
                  </div>
                  <div className="panel" style={{
                    width: '100%', height: first ? 88 : p.rank === 2 ? 66 : 52, borderRadius: '14px 14px 4px 4px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                    borderColor: color,
                  }}>
                    <span className="title-font" style={{ fontSize: first ? '1.7rem' : '1.35rem', fontWeight: 800, color }}>#{p.rank}</span>
                    {leagueBadge(p.league, true)}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rest.map(row)}
            {meOutside && (
              <>
                <div style={{ textAlign: 'center', color: 'var(--gold-500)', letterSpacing: 6, fontWeight: 900 }}>···</div>
                {row(meOutside, 0)}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
