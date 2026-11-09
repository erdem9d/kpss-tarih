import React, { useState } from 'react';

const LEAGUE_ICONS = { Bronz: '🥉', Gümüş: '🥈', Altın: '🥇', Elmas: '💎', Efsane: '👑' };
const LEAGUE_COLORS = { Bronz: '#cd7f32', Gümüş: '#c0c8d4', Altın: '#f6c85f', Elmas: '#4cc9f0', Efsane: '#c77dff' };

const BASE_AVATARS = ['👤', '🧑‍🎓', '🥷', '🤴', '👸', '🦁', '🦅', '🐺', '🌙', '⚔️'];

const ERRORS = {
  invalid_name: 'Ad 3-15 karakter olmalı; sadece harf, rakam, boşluk ve _ kullanılabilir.',
  name_taken: 'Bu kullanıcı adı başkası tarafından kullanılıyor.',
  invalid_avatar: 'Bu avatar seçilemez.',
  offline: 'Sunucuya bağlanılamıyor. İnternetini kontrol et.',
  timeout: 'Sunucu yanıt vermedi. Tekrar dene.',
};

export default function ProfileScreen({ playerData, online = true, onUpdateProfile, onBack }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('👤');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const p = playerData || {};
  const st = p.stats || {};
  const total = st.totalGames || 0;
  const winRate = total ? Math.round(((st.wins || 0) / total) * 100) : 0;
  const league = p.league || 'Gümüş';
  const elo = p.elo ?? 1200;
  const next = p.nextLeague;
  const from = p.leagueMin ?? 0;
  const progress = next ? Math.min(100, Math.max(0, ((elo - from) / (next.min - from)) * 100)) : 100;
  const avatars = p.unlockedAvatars || BASE_AVATARS;

  const openEdit = () => {
    setEditName(p.username || '');
    setEditAvatar(p.avatar || '👤');
    setError(null);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await onUpdateProfile({ username: editName, avatar: editAvatar });
    setSaving(false);
    if (res?.ok) setIsEditing(false);
    else setError(ERRORS[res?.error] || 'Kaydedilemedi. Tekrar dene.');
  };

  const stats = [
    { value: total, label: 'Toplam Maç', icon: '⚔️' },
    { value: st.wins || 0, label: 'Galibiyet', icon: '🏆', color: 'var(--green)' },
    { value: st.losses || 0, label: 'Mağlubiyet', icon: '💔', color: 'var(--red)' },
    { value: `%${winRate}`, label: 'Kazanma Oranı', icon: '📈' },
  ];

  const inv = p.inventory || {};
  const inventory = [
    { icon: '⏱️', count: inv.extraTime || 0 },
    { icon: '🎯', count: inv.eliminateWrong || 0 },
    { icon: '🛡️', count: inv.shield || 0 },
  ];

  const history = p.history || [];
  const resultStyle = {
    W: { letter: 'G', bg: 'linear-gradient(180deg,#34d97b,#1e9e52)', border: '#b9ffd2', glow: 'rgba(46,204,113,0.6)', color: 'var(--green)' },
    L: { letter: 'M', bg: 'linear-gradient(180deg,#ff6b70,#c0262c)', border: '#ffc2c4', glow: 'rgba(255,90,95,0.6)', color: 'var(--red)' },
    D: { letter: 'B', bg: 'linear-gradient(180deg,#ffd36b,#e08a00)', border: '#ffe9b0', glow: 'rgba(246,200,95,0.6)', color: 'var(--gold-300)' },
  };

  const sectionTitle = (text, delay) => (
    <h3 className="gold-text" style={{ fontSize: '1.05rem', letterSpacing: 2, margin: '0 0 12px', animation: `fadeIn 0.5s ${delay}s both` }}>{text}</h3>
  );

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', padding: '20px 16px 90px', boxSizing: 'border-box', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18, animation: 'fadeIn 0.5s both' }}>
        <button className="btn-navy" onClick={onBack} style={{ padding: '6px 14px', fontSize: '1.1rem', borderRadius: 14 }}>←</button>
        <h1 className="gold-text" style={{ flex: 1, textAlign: 'center', fontSize: '1.7rem', letterSpacing: 3 }}>PROFİL</h1>
        <div style={{ width: 48 }} />
      </div>

      <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 18px 20px', marginBottom: 18, animation: 'fadeIn 0.5s 0.1s both', position: 'relative' }}>
        <button
          onClick={openEdit}
          style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', opacity: 0.8 }}
          title="Düzenle"
        >✏️</button>
        <div style={{
          width: 110, height: 110, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '3.4rem',
          background: 'radial-gradient(circle at 30% 25%, var(--navy-600), var(--navy-900))',
          border: '5px solid var(--gold-400)', boxShadow: '0 0 30px rgba(246,200,95,0.75), inset 0 0 14px rgba(0,0,0,0.6)',
          animation: 'pulse 3s ease-in-out infinite',
        }}>{p.avatar || '👤'}</div>
        <h2 className="title-font" style={{ fontSize: '1.5rem', margin: '14px 0 8px' }}>{p.username || 'Oyuncu'}</h2>
        <span className="pill" style={{ color: LEAGUE_COLORS[league], borderColor: LEAGUE_COLORS[league], fontSize: '0.85rem' }}>
          {LEAGUE_ICONS[league]} {league} Ligi · {elo} ELO
        </span>

        <div style={{ width: '100%', marginTop: 18 }}>
          <div className="timer-track" style={{ height: 16 }}>
            <div className="timer-fill" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--gold-700), var(--gold-400), var(--gold-300))', transition: 'width .6s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: 6, fontWeight: 700 }}>
            <span style={{ color: 'var(--gold-300)' }}>{elo}</span>
            {next ? (
              <span style={{ opacity: 0.75 }}>Sonraki Lig: <span style={{ color: LEAGUE_COLORS[next.name] }}>{next.name}</span> ({next.min})</span>
            ) : (
              <span style={{ opacity: 0.75 }}>En üst lig! 👑</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        {stats.map((s, i) => (
          <div key={s.label} className="panel" style={{ padding: '16px 10px', textAlign: 'center', animation: `fadeIn 0.5s ${0.2 + i * 0.08}s both` }}>
            <div style={{ fontSize: '1.3rem' }}>{s.icon}</div>
            <div className="title-font" style={{ fontSize: '1.7rem', fontWeight: 800, color: s.color || 'var(--gold-300)', margin: '2px 0' }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.75 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {sectionTitle('ENVANTER', 0.55)}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', animation: 'fadeIn 0.5s 0.6s both' }}>
        {inventory.map((it, i) => (
          <span key={i} className="pill" style={{ padding: '10px 16px', fontSize: '1rem', color: 'var(--gold-300)' }}>
            <span style={{ fontSize: '1.4rem' }}>{it.icon}</span>x{it.count}
          </span>
        ))}
        {p.goldBoost > 0 && (
          <span className="pill" style={{ padding: '10px 16px', fontSize: '1rem', color: 'var(--gold-300)' }}>
            <span style={{ fontSize: '1.4rem' }}>⚡</span>{p.goldBoost} maç
          </span>
        )}
      </div>

      {sectionTitle('SON MAÇLAR', 0.65)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {history.length === 0 && (
          <div style={{ textAlign: 'center', padding: '18px 10px', color: '#9fb0d4', fontWeight: 700, fontSize: '.9rem' }}>
            Henüz maç oynamadın. Düello bul ve ilk maçını oyna! ⚔️
          </div>
        )}
        {history.map((match, i) => {
          const r = resultStyle[match.result] || resultStyle.L;
          return (
            <div key={`${match.at}-${i}`} className="panel" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 16, animation: `fadeIn 0.5s ${0.7 + i * 0.07}s both` }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 900, fontFamily: 'var(--font-title)',
                background: r.bg, border: `2px solid ${r.border}`, boxShadow: `0 0 10px ${r.glow}`,
              }}>{r.letter}</div>
              <span style={{ flex: 1, fontWeight: 800, fontSize: '0.92rem' }}>vs {match.opponent}</span>
              <span style={{ fontWeight: 900, color: r.color }}>{match.eloDelta >= 0 ? '+' : ''}{match.eloDelta} ELO</span>
            </div>
          );
        })}
      </div>

      {isEditing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,15,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
          <div className="panel" style={{ width: '100%', maxWidth: 340, padding: 24, display: 'flex', flexDirection: 'column', gap: 18, animation: 'bounceIn .3s' }}>
            <h3 className="gold-text" style={{ textAlign: 'center', fontSize: '1.3rem', margin: 0 }}>PROFİLİ DÜZENLE</h3>

            {!online && (
              <div style={{ fontSize: '.8rem', fontWeight: 800, color: '#ffd36b', textAlign: 'center' }}>
                📡 Profili değiştirmek için internet bağlantısı gerekli.
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#9fb0d4', marginBottom: 8, fontWeight: 700 }}>Kullanıcı Adı (3-15 karakter)</label>
              <input
                type="text"
                maxLength={15}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ width: '100%', background: 'rgba(5, 13, 31, 0.8)', border: '1.5px solid var(--gold-500)', color: '#fff', padding: '12px 14px', borderRadius: 12, fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-body)', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#9fb0d4', marginBottom: 8, fontWeight: 700 }}>Avatar Seç</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {avatars.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setEditAvatar(emoji)}
                    style={{
                      background: editAvatar === emoji ? 'radial-gradient(circle, var(--gold-500), var(--gold-700))' : 'rgba(5, 13, 31, 0.8)',
                      border: `1.5px solid ${editAvatar === emoji ? 'var(--gold-300)' : 'rgba(212, 168, 67, 0.3)'}`,
                      borderRadius: 12, fontSize: '1.5rem', padding: '8px 0', cursor: 'pointer', transition: 'all .2s',
                    }}
                  >{emoji}</button>
                ))}
              </div>
              {!p.avatarPack && (
                <div style={{ fontSize: '.7rem', color: '#9fb0d4', marginTop: 8 }}>👑 Daha fazla avatar için Mağaza'dan Avatar Paketi al.</div>
              )}
            </div>

            {error && <div style={{ fontSize: '.8rem', fontWeight: 800, color: '#ff8a8f', textAlign: 'center' }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="btn-navy" style={{ flex: 1, padding: 12 }} onClick={() => setIsEditing(false)}>İptal</button>
              <button className="btn-gold" style={{ flex: 1, padding: 12 }} onClick={handleSave} disabled={saving || !online}>{saving ? '...' : 'Kaydet'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
