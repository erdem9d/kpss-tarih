import React from 'react';

const TABS = [
  { key: 'home', icon: '🏠', label: 'Ana Sayfa' },
  { key: 'shop', icon: '🛒', label: 'Mağaza' },
  { key: 'leaderboard', icon: '🏆', label: 'Sıralama' },
  { key: 'profile', icon: '👤', label: 'Profil' },
];

export default function Navbar({ activeTab, onNavigate }) {
  return (
    <nav
      className="nav-bar"
      style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px', height: '70px', display: 'flex',
        justifyContent: 'space-around', alignItems: 'center', zIndex: 1000,
        fontFamily: 'var(--font-body)',
      }}
    >
      {TABS.map((t) => {
        const active = activeTab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onNavigate(t.key)}
            style={{
              flex: 1, height: '100%', background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              color: active ? 'var(--gold-300)' : '#8ea0c4', fontWeight: 800, fontSize: '.7rem',
              position: 'relative', transition: 'color .2s',
            }}
          >
            {active && <span style={{ position: 'absolute', top: -2, width: 36, height: 4, borderRadius: 4, background: 'linear-gradient(90deg, transparent, var(--gold-300), transparent)' }} />}
            <span style={{ fontSize: active ? '1.7rem' : '1.4rem', transition: 'font-size .2s, transform .2s', transform: active ? 'translateY(-3px)' : 'none', filter: active ? 'drop-shadow(0 0 8px rgba(246,200,95,.8))' : 'grayscale(.5)' }}>{t.icon}</span>
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
