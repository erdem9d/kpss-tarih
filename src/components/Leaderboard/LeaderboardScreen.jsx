import React, { useState, useEffect } from 'react';
import { request } from '../../net/socket';

const LEAGUE_COLORS = {
  Bronz: '#cd7f32',
  Gümüş: '#c0c8d4',
  Altın: '#f6c85f',
  Elmas: '#4cc9f0',
  Efsane: '#c77dff',
};

const TABS = [
  ['Günlük', 'daily'],
  ['Haftalık', 'weekly'],
  ['Tüm Zamanlar', 'all'],
];

const leagueBadge = (league, small) => (
  <span style={{
    display: 'inline-block',
    fontSize: small ? '0.62rem' : '0.7rem',
    fontWeight: 900,
    padding: small ? '1px 7px' : '2px 9px',
    borderRadius: 999,
    color: LEAGUE_COLORS[league] || '#fff',
    border: `1.5px solid ${LEAGUE_COLORS[league] || '#fff'}`,
    background: 'rgba(5,13,31,0.7)',
  }}>{league}</span>
);

const ringColors = { 1: '#f6c85f', 2: '#c0c8d4', 3: '#cd7f32' };

export default function LeaderboardScreen({ online = true, onBack }) {
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState(null); // { entries, me, total }
  const [status, setStatus] = useState('loading'); // loading | ok | error

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    request('leaderboard', { period }).then((res) => {
      if (cancelled) return;
      if (res.ok) { setData(res); setStatus('ok'); } else { setStatus('error'); }
    });
    return () => { cancelled = true; };
  }, [period, online]);

  const entries = data?.entries || [];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  // Sıra: 2. - 1. - 3. (ortadaki en yüksek)
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const meOutside = data?.me && !entries.some((e) => e.isMe) ? data.me : null;

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
      <div className="title-font" style={{ width: 40, textAlign: 'center', fontWeight: 800, fontSize: '1.05rem', color: 'var(--gold-400)' }}>#{player.rank}</div>
      <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '1.3rem', background: 'var(--navy-700)', border: '2px solid var(--gold-500)' }}>{player.avatar || '👤'}</div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontWeight: 800, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.username} {player.isMe && <span style={{ color: 'var(--gold-300)' }}>(Sen)</span>}
        </span>
        <span>{leagueBadge(player.league)}</span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 900, color: 'var(--gold-300)', fontSize: '1rem' }}>{player.elo}</div>
        {player.gain !== null && player.gain !== undefined ? (
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: player.gain >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {player.gain >= 0 ? '+' : ''}{player.gain}
          </div>
        ) : (
          <div style={{ fontSize: '0.62rem', opacity: 0.7, fontWeight: 700 }}>ELO</div>
        )}
      </div>
    </div>
  );

  const message = (icon, text) => (
    <div style={{ textAlign: 'center', padding: '50px 20px', color: '#9fb0d4', fontWeight: 700 }}>
      <div style={{ fontSize: '2.6rem', marginBottom: 10 }}>{icon}</div>
      {text}
    </div>
  );

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', padding: '20px 16px 90px', boxSizing: 'border-box', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18, animation: 'fadeIn 0.5s both' }}>
        <button className="btn-navy" onClick={onBack} style={{ padding: '6px 14px', fontSize: '1.1rem', borderRadius: 14 }}>←</button>
        <h1 className="gold-text" style={{ flex: 1, textAlign: 'center', fontSize: '1.7rem', letterSpacing: 3 }}>SIRALAMA</h1>
        <div style={{ width: 48 }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 22, animation: 'fadeIn 0.5s 0.1s both' }}>
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
      {status === 'ok' && entries.length === 0 && message('🏁', period === 'all' ? 'Henüz maç oynayan yok. İlk sen ol!' : 'Bu dönemde henüz maç oynanmadı.')}

      {status === 'ok' && entries.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
            {podiumOrder.map((p, idx) => {
              const first = p.rank === 1;
              const size = first ? 84 : 66;
              const color = ringColors[p.rank];
              return (
                <div key={p.id} style={{ flex: 1, maxWidth: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', animation: `fadeIn 0.6s ${0.2 + idx * 0.12}s both` }}>
                  {first && <div style={{ fontSize: '1.8rem', animation: 'float 2.4s ease-in-out infinite', marginBottom: -4 }}>👑</div>}
                  <div style={{
                    width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center',
                    fontSize: size * 0.5, background: 'var(--navy-700)', border: `4px solid ${color}`,
                    boxShadow: `0 0 ${first ? 26 : 14}px ${color}`,
                  }}>{p.avatar || '👤'}</div>
                  <div style={{ fontWeight: 800, fontSize: '0.78rem', marginTop: 8, textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: p.isMe ? 'var(--gold-300)' : undefined }}>{p.username}</div>
                  <div style={{ color: 'var(--gold-300)', fontWeight: 900, fontSize: '0.8rem', marginBottom: 6 }}>
                    {p.gain !== null && p.gain !== undefined ? `${p.gain >= 0 ? '+' : ''}${p.gain}` : p.elo}
                  </div>
                  <div className="panel" style={{
                    width: '100%', height: first ? 90 : p.rank === 2 ? 66 : 50, borderRadius: '14px 14px 4px 4px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                    borderColor: color,
                  }}>
                    <span className="title-font" style={{ fontSize: first ? '1.8rem' : '1.4rem', fontWeight: 800, color }}>{p.rank}</span>
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
