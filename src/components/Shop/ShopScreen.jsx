import React, { useState } from 'react';

const GEM_PACKS = [
  { id: 'gems_100', name: '100 Elmas', amount: '100', price: '$0.99', icon: '💎', size: 44 },
  { id: 'gems_500', name: '500 Elmas', amount: '500', price: '$3.99', icon: '💎', size: 54, badge: 'EN ÇOK SATAN' },
  { id: 'gems_1200', name: '1200 Elmas', amount: '1200', price: '$7.99', icon: '💎', size: 64, badge: 'EN İYİ DEĞER', best: true },
];

const POWERUPS = [
  { id: 'extra_time', name: 'Ekstra Süre x5', icon: '⏱️', desc: 'Sorularda ekstra süre kazan.', price: '50💎' },
  { id: 'eliminate_wrong', name: 'Şık Eleme x3', icon: '🎯', desc: 'Yanlış bir şıkkı eleyerek doğruya yaklaş.', price: '40💎' },
  { id: 'shield', name: 'Koruma Kalkanı x3', icon: '🛡️', desc: 'Yanlış cevabın cezasından korun.', price: '60💎' },
];

const COSMETICS = [
  { id: 'avatar_pack', name: 'Avatar Paketi', icon: '👑', desc: '10 özel avatar kilidini açar (Profil > ✏️).', price: '150💎' },
  { id: 'gold_boost', name: 'Altın Boost', icon: '⚡', desc: 'Sonraki 5 maçta kazandığın altın ikiye katlanır.', price: '80💎' },
];

const ERRORS = {
  insufficient_diamonds: 'Yeterli elmasın yok. Elmas paketlerine göz at 💎',
  already_owned: 'Bu ürüne zaten sahipsin.',
  payments_disabled: 'Gerçek ödeme henüz aktif değil.',
  offline: 'Sunucuya bağlanılamıyor. İnternetini kontrol et.',
  timeout: 'Sunucu yanıt vermedi. Tekrar dene.',
  not_authenticated: 'Oturum doğrulanamadı. Uygulamayı yeniden aç.',
};

function SectionHeader({ title }) {
  const line = {
    flex: 1,
    height: 2,
    background: 'linear-gradient(90deg, transparent, var(--gold-500), transparent)',
    borderRadius: 2,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '28px 0 16px' }}>
      <div style={line} />
      <span style={{ color: 'var(--gold-400)', fontSize: 14 }}>✦</span>
      <h2 className="gold-text" style={{ fontSize: 16, letterSpacing: 2, whiteSpace: 'nowrap' }}>{title}</h2>
      <span style={{ color: 'var(--gold-400)', fontSize: 14 }}>✦</span>
      <div style={line} />
    </div>
  );
}

export default function ShopScreen({ playerData, online = true, onPurchase, onBack }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [purchased, setPurchased] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleBuyClick = (item) => {
    setSelectedItem(item);
    setShowModal(true);
    setPurchased(false);
    setError(null);
  };

  const confirmPurchase = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = onPurchase ? await onPurchase(selectedItem) : { ok: true };
    setBusy(false);
    if (res.ok) {
      setPurchased(true);
      setTimeout(() => setShowModal(false), 1500);
    } else {
      setError(ERRORS[res.error] || 'Satın alma başarısız oldu.');
    }
  };

  const anim = (i) => ({ animation: `fadeIn 0.5s ease-out ${i * 0.08}s both` });

  const ribbon = {
    position: 'absolute',
    top: -10,
    left: '50%',
    transform: 'translateX(-50%)',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-title)',
    fontWeight: 800,
    fontSize: 9,
    letterSpacing: 0.5,
    color: '#2a1c00',
    padding: '3px 10px',
    borderRadius: 6,
    background: 'linear-gradient(180deg, var(--gold-300), var(--gold-500))',
    border: '1px solid var(--gold-700)',
    boxShadow: '0 3px 8px rgba(0,0,0,0.5)',
    zIndex: 2,
  };

  let idx = 0;

  const renderItemCard = (item) => (
    <div key={item.name} className="panel" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, ...anim(idx++) }}>
      <div style={{
        width: 56, height: 56, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 30,
        borderRadius: 16, background: 'radial-gradient(circle, rgba(246,200,95,0.25), rgba(5,13,31,0.8))',
        border: '1.5px solid rgba(212,168,67,0.6)',
      }}>{item.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="title-font" style={{ fontWeight: 800, fontSize: 14, color: 'var(--gold-300)' }}>{item.name}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 3, lineHeight: 1.3 }}>{item.desc}</div>
      </div>
      <button className="btn-gold" style={{ padding: '8px 12px', fontSize: 13, borderRadius: 14, whiteSpace: 'nowrap' }}
        onClick={() => handleBuyClick({ id: item.id, name: item.name, price: item.price })}>
        {item.price.replace('💎', ' 💎')}
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', paddingBottom: 90, overflowY: 'auto' }}>
      {/* Header */}
      <div className="nav-bar" style={{
        position: 'sticky', top: 0, zIndex: 50, padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        borderTop: 'none', borderBottom: '2px solid var(--gold-500)',
      }}>
        <button className="btn-navy" onClick={onBack} style={{ padding: '6px 12px', fontSize: 18, borderRadius: 12 }}>←</button>
        <h1 className="gold-text" style={{ fontSize: 24, letterSpacing: 3 }}>MAĞAZA</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="pill" style={{ padding: '2px 10px', fontSize: 12 }}>🪙 {playerData?.coins ?? 0}</span>
          <span className="pill" style={{ padding: '2px 10px', fontSize: 12 }}>💎 {playerData?.diamonds ?? 0}</span>
        </div>
      </div>
      {!online && (
        <div style={{ textAlign: 'center', padding: '8px 12px', fontSize: 12, fontWeight: 800, color: '#ffd36b', background: 'rgba(255,211,107,.1)' }}>
          📡 Çevrimdışı: satın alma için internet bağlantısı gerekli
        </div>
      )}

      <div style={{ padding: '0 16px' }}>
        <SectionHeader title="ELMAS PAKETLERİ" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, paddingTop: 8 }}>
          {GEM_PACKS.map((p, i) => (
            <div key={p.name} className="panel" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '18px 6px 12px',
              ...(p.best ? { boxShadow: '0 0 24px rgba(246,200,95,0.5), 0 8px 24px rgba(0,0,0,0.5)', borderColor: 'var(--gold-300)' } : {}),
              ...anim(idx++),
            }}>
              {p.badge && <div style={ribbon}>{p.badge}</div>}
              <div style={{
                fontSize: p.size, lineHeight: 1, animation: `float ${2.5 + i * 0.3}s ease-in-out infinite`,
                filter: 'drop-shadow(0 0 12px rgba(76,201,240,0.9))',
              }}>{p.icon}</div>
              <div className="gold-text" style={{ fontSize: 20 }}>{p.amount}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>Elmas</div>
              <button className="btn-gold" style={{ padding: '8px 4px', fontSize: 13, width: '100%', borderRadius: 14, animation: p.best ? 'glow 2s infinite' : undefined }}
                onClick={() => handleBuyClick({ id: p.id, name: p.name, price: p.price })}>
                {p.price}
              </button>
            </div>
          ))}
        </div>

        <SectionHeader title="GÜÇLENDİRİCİLER" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {POWERUPS.map(renderItemCard)}
        </div>

        <SectionHeader title="KOZMETİKLER" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {COSMETICS.map(renderItemCard)}
        </div>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(2,6,15,0.85)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100,
        }}>
          <div className="panel" style={{ width: '82%', maxWidth: 320, padding: 24, textAlign: 'center', animation: 'bounceIn 0.4s ease-out' }}>
            {purchased ? (
              <div style={{ padding: '16px 0' }}>
                <div style={{ fontSize: 56, animation: 'bounceIn 0.5s ease-out', filter: 'drop-shadow(0 0 14px rgba(246,200,95,0.9))' }}>✨</div>
                <div className="gold-text" style={{ fontSize: 18, marginTop: 10 }}>Başarıyla Satın Alındı!</div>
                <div style={{ color: 'var(--green)', fontWeight: 800, marginTop: 8 }}>{selectedItem?.name}</div>
              </div>
            ) : (
              <>
                <h3 className="gold-text" style={{ fontSize: 18, marginBottom: 12 }}>✦ Satın Alım Onayı ✦</h3>
                <p style={{ fontSize: 14, lineHeight: 1.4 }}>
                  <b style={{ color: 'var(--gold-300)' }}>{selectedItem?.name}</b> ürününü satın almak istiyor musunuz?
                </p>
                <p className="pill" style={{ marginTop: 12, color: 'var(--gold-300)' }}>Fiyat: {selectedItem?.price}</p>
                {selectedItem?.id?.startsWith('gems_') && (
                  <p style={{ marginTop: 10, fontSize: 11, color: '#9fb0d4', lineHeight: 1.4 }}>
                    🧪 Test sürümü: gerçek ödeme alınmaz, elmaslar ücretsiz eklenir.
                  </p>
                )}
                {error && <p style={{ marginTop: 12, fontSize: 13, fontWeight: 800, color: '#ff8a8f' }}>{error}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button className="btn-navy" style={{ flex: 1, padding: '10px' }} onClick={() => setShowModal(false)}>İptal</button>
                  <button className="btn-gold" style={{ flex: 1, padding: '10px', fontSize: 14 }} onClick={confirmPurchase} disabled={busy}>{busy ? '...' : 'Onayla'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
