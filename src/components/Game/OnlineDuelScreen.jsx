import React, { useState, useEffect, useRef } from 'react';
import { getSocket, getSessionState } from '../../net/socket';

function Shell({ children }) {
  return (
    <div style={{ minHeight: '100vh', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center' }}>
      {children}
    </div>
  );
}

const REPORT_REASONS = [
  ['wrong_answer', '❌ Doğru cevap yanlış işaretlenmiş'],
  ['wrong_question', '📝 Soru metni hatalı'],
  ['duplicate', '🔄 Tekrar eden soru'],
  ['other', '💬 Diğer'],
];

/**
 * Gerçek online düello. Tüm oyun kuralları sunucuda işler; bu ekran sadece
 * olayları gösterir ve oyuncunun şık seçimini sunucuya gönderir.
 * Props: playerData, onGameEnd(results), onExit(), onOffline()
 */
export default function OnlineDuelScreen({ playerData, onGameEnd, onExit, onOffline }) {
  const [phase, setPhase] = useState('connecting'); // connecting | searching | found | playing | error
  const [opponent, setOpponent] = useState(null);
  const [question, setQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [maxTime, setMaxTime] = useState(15);
  const [scores, setScores] = useState({ you: 0, opponent: 0 });
  const [selected, setSelected] = useState(null);
  const [myWrong, setMyWrong] = useState(null);
  const [oppWrong, setOppWrong] = useState(null);
  const [result, setResult] = useState(null); // round_result
  const [notice, setNotice] = useState(null);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [showReport, setShowReport] = useState(false);

  const endedRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Olaylar: ortak (oturum) soketi kullanılır; ekran kapanınca sadece kendi dinleyicileri kaldırılır
  useEffect(() => {
    const socket = getSocket();
    const session = getSessionState();

    if (!socket || !socket.connected || session.status !== 'online') {
      setPhase('error');
      return undefined;
    }

    const fail = () => {
      if (!endedRef.current) setPhase('error');
    };

    const handlers = {
      queue_joined: () => setPhase('searching'),
      queue_error: fail,
      disconnect: fail,
      match_found: ({ opponent: opp }) => {
        setOpponent(opp);
        setPhase('found');
      },
      question: (q) => {
        setQuestion(q);
        setTimeLeft(q.seconds);
        setMaxTime(q.seconds);
        setSelected(null);
        setMyWrong(null);
        setOppWrong(null);
        setResult(null);
        setNotice(null);
        setPhase('playing');
      },
      you_locked: ({ option }) => {
        setMyWrong(option);
        setNotice(['Yanlış! Rakibin kalan şıklardan seçmesini bekle ⏳', '#ffd36b']);
      },
      opponent_locked: ({ option, bonusSeconds }) => {
        setOppWrong(option);
        setTimeLeft((t) => t + bonusSeconds);
        setMaxTime((t) => t + bonusSeconds);
        setNotice([`Rakip yanlış yaptı! +${bonusSeconds} sn ek süre ⚡`, '#6dffa6']);
      },
      round_result: (r) => {
        setResult(r);
        setScores(r.scores);
        setNotice(null);
      },
      opponent_left: () => setNotice(['Rakip oyundan ayrıldı! 🏳️', '#ffd36b']),
      game_over: (g) => {
        endedRef.current = true;
        onGameEnd({
          playerScore: g.playerScore,
          opponentScore: g.opponentScore,
          stats: g.stats,
          forfeit: g.forfeit,
          rewards: g.rewards,
        });
      },
    };

    Object.entries(handlers).forEach(([ev, fn]) => socket.on(ev, fn));
    setPhase('searching');
    socket.emit('join_queue');

    return () => {
      Object.entries(handlers).forEach(([ev, fn]) => socket.off(ev, fn));
      if (!endedRef.current) {
        socket.emit('leave_queue');
        socket.emit('leave_room');
      }
      endedRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sadece görsel geri sayım; asıl süreyi sunucu yönetir
  useEffect(() => {
    if (phase !== 'playing' || result) return;
    const t = setInterval(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase, result, question]);

  // Arama süresi sayacı
  useEffect(() => {
    if (phase !== 'searching') return;
    const t = setInterval(() => setSearchSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const answer = (option) => {
    if (result || selected !== null || myWrong !== null || option === oppWrong) return;
    setSelected(option);
    getSocket().emit('answer', { option });
  };

  const handleExit = () => {
    const inGame = phase === 'playing' || phase === 'found';
    if (!inGame || window.confirm('Düellodan çıkarsan maçı kaybedersin. Çıkmak istiyor musun?')) {
      onExit();
    }
  };

  // ---------- Ekranlar ----------

  if (phase === 'error') {
    return (
      <Shell>
        <div style={{ fontSize: '3.5rem' }}>📡</div>
        <h2 className="gold-text" style={{ fontSize: '1.5rem' }}>SUNUCUYA BAĞLANILAMADI</h2>
        <p style={{ color: '#9fb0d4', maxWidth: 300, fontSize: '.9rem' }}>
          İnternet bağlantını kontrol et. İstersen rakibi bilgisayar olan çevrimdışı düello oynayabilirsin.
        </p>
        <button className="btn-gold" style={{ width: '100%', maxWidth: 300 }} onClick={onOffline}>ÇEVRİMDIŞI OYNA</button>
        <button className="btn-navy" style={{ width: '100%', maxWidth: 300 }} onClick={onExit}>ANA MENÜ</button>
      </Shell>
    );
  }

  if (phase === 'connecting' || phase === 'searching') {
    return (
      <Shell>
        <div style={{ position: 'relative', width: 150, height: 150, display: 'grid', placeItems: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px dashed var(--gold-500)', animation: 'spin 4s linear infinite' }} />
          <div style={{ position: 'absolute', inset: 14, borderRadius: '50%', border: '2px solid rgba(246,200,95,.4)', animation: 'pulse 1.6s ease-in-out infinite' }} />
          <div style={{ fontSize: '3.2rem', animation: 'float 2.4s ease-in-out infinite' }}>⚔️</div>
        </div>
        <h2 className="gold-text" style={{ fontSize: '1.5rem' }}>{phase === 'connecting' ? 'BAĞLANILIYOR...' : 'RAKİP ARANIYOR...'}</h2>
        {phase === 'searching' && <div className="pill">⏱️ {searchSeconds} sn</div>}
        <button className="btn-navy" style={{ width: 200 }} onClick={handleExit}>İPTAL</button>
      </Shell>
    );
  }

  if (phase === 'found') {
    return (
      <Shell>
        <h2 className="gold-text" style={{ fontSize: '1.7rem', animation: 'bounceIn .5s' }}>RAKİP BULUNDU!</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="panel" style={{ padding: 16, width: 120, animation: 'slideInLeft .5s' }}>
            <div style={{ fontSize: '2.6rem' }}>{playerData?.avatar || '👤'}</div>
            <div style={{ fontWeight: 900, marginTop: 4, fontSize: '.9rem' }}>{playerData?.username || 'Oyuncu'}</div>
          </div>
          <div className="gold-text" style={{ fontSize: '1.8rem' }}>VS</div>
          <div className="panel" style={{ padding: 16, width: 120, animation: 'slideInRight .5s' }}>
            <div style={{ fontSize: '2.6rem' }}>{opponent?.avatar}</div>
            <div style={{ fontWeight: 900, marginTop: 4, fontSize: '.9rem' }}>{opponent?.name}</div>
            <div style={{ fontSize: '.7rem', color: 'var(--gold-300)', fontWeight: 700 }}>{opponent?.elo} ELO</div>
          </div>
        </div>
        <div style={{ color: '#9fb0d4', fontWeight: 700 }}>Düello başlıyor...</div>
      </Shell>
    );
  }

  // ---------- Oyun ----------
  if (!question) return null;

  const revealed = !!result;
  const lockedMe = myWrong !== null;
  const timerColor = timeLeft > 10 ? 'linear-gradient(180deg,#6dffa6,#1fb35a)' : timeLeft > 5 ? 'linear-gradient(180deg,#ffd36b,#e08a00)' : 'linear-gradient(180deg,#ff8a8f,#d11f2a)';
  const timerWidth = Math.min((timeLeft / maxTime) * 100, 100);

  const status = (() => {
    if (revealed) {
      if (result.winner === 'you') return ['DOĞRU! +10 🎯', '#6dffa6'];
      if (result.winner === 'opponent') return ['Rakip doğru bildi! 😞', '#ff8a8f'];
      if (result.reason === 'both_wrong') return ['İkisi de yanlış! Puan yok 🤷', '#ffd36b'];
      return ['Süre doldu! ⏰', '#b8c4e0'];
    }
    return notice;
  })();

  const optionClass = (idx) => {
    let cls = 'answer-btn';
    if (revealed) {
      if (idx === result.correctIndex) cls += ' correct';
      else if (idx === result.myWrong) cls += ' wrong';
      else if (idx === result.opponentWrong) cls += ' opp';
    } else {
      if (idx === myWrong) cls += ' wrong';
      else if (idx === oppWrong) cls += ' eliminated';
      else if (idx === selected) cls += ' opp';
    }
    return cls;
  };

  return (
    <div style={{ minHeight: '100vh', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn-navy" onClick={handleExit} style={{ padding: '8px 10px', fontSize: '.8rem', borderRadius: 12 }}>✕</button>
        <div className="panel" style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '.65rem', color: 'var(--gold-300)', fontWeight: 800, letterSpacing: 1 }}>{(playerData?.username || 'SEN').toUpperCase()}</div>
            <div className="title-font" style={{ fontSize: '1.5rem', fontWeight: 800 }}>{scores.you}</div>
          </div>
          <div className="pill" style={{ fontSize: '.8rem' }}>Soru {question.index + 1}/{question.total}</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '.65rem', color: '#ff9a9f', fontWeight: 800, letterSpacing: 1 }}>{(opponent?.name || 'RAKİP').toUpperCase()}</div>
            <div className="title-font" style={{ fontSize: '1.5rem', fontWeight: 800 }}>{scores.opponent}</div>
          </div>
        </div>
      </div>

      <div>
        <div className="timer-track">
          <div className="timer-fill" style={{ width: `${timerWidth}%`, background: timerColor, transition: 'width 1s linear', animation: timeLeft <= 5 && !revealed ? 'timerPulse .5s infinite' : 'none' }} />
        </div>
        <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '.85rem', marginTop: 4, color: 'var(--gold-300)' }}>⏱️ {timeLeft} saniye</div>
      </div>

      <div className="parchment" style={{ padding: '26px 18px 20px', minHeight: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <button onClick={() => setShowReport(true)} title="Hatayı Bildir" style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(138,106,31,.2)', border: '1.5px solid var(--gold-700)', borderRadius: 10, padding: '3px 8px', fontSize: '.9rem', cursor: 'pointer' }}>⚠️</button>
        <span style={{ fontSize: '.65rem', fontWeight: 900, letterSpacing: 1, color: '#6b4a05', background: 'rgba(138,106,31,.2)', padding: '3px 10px', borderRadius: 999 }}>{question.category}</span>
        <h2 style={{ fontSize: '1.15rem', lineHeight: 1.5, textAlign: 'center', fontWeight: 800 }}>{question.text}</h2>
      </div>

      <div style={{ minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {status && <div key={status[0]} style={{ color: status[1], fontWeight: 900, fontSize: '.95rem', textAlign: 'center', animation: 'bounceIn .35s', textShadow: '0 2px 6px rgba(0,0,0,.6)' }}>{status[0]}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {question.options.map((opt, idx) => (
          <button
            key={idx}
            className={optionClass(idx)}
            disabled={revealed || lockedMe || idx === oppWrong || (selected !== null && idx !== selected)}
            onClick={() => answer(idx)}
          >
            <span className="letter">{['A', 'B', 'C', 'D'][idx]}</span>
            {opt}
          </button>
        ))}
      </div>

      {showReport && (
        <div onClick={() => setShowReport(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,15,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, padding: 22, display: 'flex', flexDirection: 'column', gap: 10, animation: 'bounceIn .3s' }}>
            <h3 className="gold-text" style={{ textAlign: 'center', fontSize: '1.2rem' }}>⚠️ HATAYI BİLDİR</h3>
            {REPORT_REASONS.map(([key, label]) => (
              <button key={key} className="btn-navy" style={{ textAlign: 'left', fontSize: '.85rem', padding: '11px 14px' }} onClick={() => { setShowReport(false); alert('Geri bildiriminiz kaydedildi. Teşekkürler! 🙏'); }}>{label}</button>
            ))}
            <button onClick={() => setShowReport(false)} style={{ background: 'none', border: 'none', color: '#8ea0c4', fontWeight: 800, cursor: 'pointer', padding: 6 }}>İptal</button>
          </div>
        </div>
      )}
    </div>
  );
}
