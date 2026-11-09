import React, { useState, useEffect, useRef, useCallback } from 'react';

const REPORT_REASONS = [
  ['wrong_answer', '❌ Doğru cevap yanlış işaretlenmiş'],
  ['wrong_question', '📝 Soru metni hatalı'],
  ['duplicate', '🔄 Tekrar eden soru'],
  ['other', '💬 Diğer'],
];

const ArcadeScreen = ({ questions, onGameEnd, onExit }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(15);
  const [maxTime, setMaxTime] = useState(15);
  const [gamePhase, setGamePhase] = useState('playing'); // playing | answer_revealed | game_over
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [eliminatedOptions, setEliminatedOptions] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [powerups, setPowerups] = useState({ extraTime: 2, fiftyFifty: 2 });

  const timerRef = useRef(null);
  const gamePhaseRef = useRef(gamePhase);
  const scoreRef = useRef(0);
  const correctRef = useRef(0);
  gamePhaseRef.current = gamePhase;
  scoreRef.current = score;
  correctRef.current = correctCount;

  const q = questions[currentIndex % questions.length];
  const currentQuestion = q ? {
    id: q.id,
    text: q.question,
    options: q.options,
    correctIndex: q.correctAnswer,
    category: q.category,
  } : null;

  const nextQuestion = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
    setTimeLeft(15);
    setMaxTime(15);
    setGamePhase('playing');
    setSelectedAnswer(null);
    setEliminatedOptions([]);
  }, []);

  const handleGameOver = useCallback(() => {
    setGamePhase('game_over');
    setTimeout(() => {
      onGameEnd({ score: scoreRef.current, correctAnswers: correctRef.current });
    }, 2000);
  }, [onGameEnd]);

  const handleWrongAnswer = () => {
    setGamePhase('answer_revealed');
    setLives(prev => {
      const newLives = prev - 1;
      if (newLives <= 0) {
        handleGameOver();
      } else {
        setTimeout(() => {
          if (gamePhaseRef.current === 'answer_revealed') nextQuestion();
        }, 1500);
      }
      return newLives;
    });
  };

  useEffect(() => {
    if (gamePhase === 'playing') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setSelectedAnswer(null);
            handleWrongAnswer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gamePhase]);

  const handleAnswerClick = (optionIndex) => {
    if (gamePhase !== 'playing' || eliminatedOptions.includes(optionIndex)) return;
    clearInterval(timerRef.current);
    setSelectedAnswer(optionIndex);

    if (optionIndex === currentQuestion.correctIndex) {
      setScore(prev => prev + 10);
      setCorrectCount(prev => prev + 1);
      setGamePhase('answer_revealed');
      setTimeout(nextQuestion, 1000);
    } else {
      handleWrongAnswer();
    }
  };

  const useExtraTime = () => {
    if (powerups.extraTime > 0 && gamePhase === 'playing') {
      setTimeLeft(prev => prev + 10);
      setMaxTime(prev => prev + 10);
      setPowerups(prev => ({ ...prev, extraTime: prev.extraTime - 1 }));
    }
  };

  const useFiftyFifty = () => {
    if (powerups.fiftyFifty > 0 && gamePhase === 'playing') {
      const wrong = currentQuestion.options.map((_, i) => i).filter(i => i !== currentQuestion.correctIndex);
      setEliminatedOptions(wrong.sort(() => 0.5 - Math.random()).slice(0, 2));
      setPowerups(prev => ({ ...prev, fiftyFifty: prev.fiftyFifty - 1 }));
    }
  };

  const handleReport = () => {
    setShowReportModal(false);
    alert('Hata bildirildi! Teşekkürler. 🙏');
  };

  const handleExit = () => {
    if (window.confirm('Oyundan çıkmak istiyor musun? İlerlemen kaybolacak.')) {
      clearInterval(timerRef.current);
      onExit && onExit();
    }
  };

  if (!currentQuestion) return null;

  const timerColor = timeLeft > 10 ? 'linear-gradient(180deg,#6dffa6,#1fb35a)' : timeLeft > 5 ? 'linear-gradient(180deg,#ffd36b,#e08a00)' : 'linear-gradient(180deg,#ff8a8f,#d11f2a)';
  const timerWidth = Math.min((timeLeft / maxTime) * 100, 100);
  const revealed = gamePhase === 'answer_revealed' || gamePhase === 'game_over';

  const status = (() => {
    if (gamePhase === 'game_over') return ['OYUN BİTTİ! 💀', '#ff8a8f'];
    if (gamePhase === 'answer_revealed' && selectedAnswer === currentQuestion.correctIndex) return ['DOĞRU! +10 🎯', '#6dffa6'];
    if (gamePhase === 'answer_revealed' && selectedAnswer !== null) return ['YANLIŞ! -1 Can 💔', '#ff8a8f'];
    if (gamePhase === 'answer_revealed') return ['SÜRE BİTTİ! -1 Can ⏰', '#ffd36b'];
    return null;
  })();

  return (
    <div style={{ minHeight: '100vh', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Üst bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn-navy" onClick={handleExit} style={{ padding: '8px 10px', fontSize: '.75rem', borderRadius: 12 }}>← Ana Menü</button>
        <div className="panel" style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '.65rem', color: 'var(--gold-300)', fontWeight: 800, letterSpacing: 1 }}>SKOR</div>
            <div className="title-font" style={{ fontSize: '1.5rem', fontWeight: 800 }}>{score}</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ fontSize: '1.5rem', transition: 'all .3s', filter: i < lives ? 'drop-shadow(0 0 6px rgba(255,90,95,.8))' : 'grayscale(1)', opacity: i < lives ? 1 : 0.3, transform: i < lives ? 'scale(1)' : 'scale(.8)' }}>❤️</span>
            ))}
          </div>
        </div>
      </div>

      {/* Süre */}
      <div>
        <div className="timer-track">
          <div className="timer-fill" style={{ width: `${timerWidth}%`, background: timerColor, transition: 'width 1s linear', animation: timeLeft <= 5 && gamePhase === 'playing' ? 'timerPulse .5s infinite' : 'none' }} />
        </div>
        <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '.85rem', marginTop: 4, color: 'var(--gold-300)' }}>⏱️ {timeLeft} saniye</div>
      </div>

      {/* Soru parşömeni */}
      <div className="parchment" style={{ padding: '26px 18px 20px', minHeight: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <button
          onClick={() => setShowReportModal(true)}
          title="Hatayı Bildir"
          style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(138,106,31,.2)', border: '1.5px solid var(--gold-700)', borderRadius: 10, padding: '3px 8px', fontSize: '.9rem', cursor: 'pointer' }}
        >⚠️</button>
        <span style={{ fontSize: '.65rem', fontWeight: 900, letterSpacing: 1, color: '#6b4a05', background: 'rgba(138,106,31,.2)', padding: '3px 10px', borderRadius: 999 }}>{currentQuestion.category}</span>
        <h2 style={{ fontSize: '1.15rem', lineHeight: 1.5, textAlign: 'center', fontWeight: 800 }}>{currentQuestion.text}</h2>
      </div>

      {/* Durum */}
      <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {status && <div style={{ color: status[1], fontWeight: 900, fontSize: '1rem', animation: 'bounceIn .35s', textShadow: '0 2px 6px rgba(0,0,0,.6)' }}>{status[0]}</div>}
      </div>

      {/* Şıklar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {currentQuestion.options.map((option, idx) => {
          const eliminated = eliminatedOptions.includes(idx);
          let cls = 'answer-btn';
          if (eliminated) cls += ' eliminated';
          else if (revealed && idx === currentQuestion.correctIndex) cls += ' correct';
          else if (revealed && idx === selectedAnswer) cls += ' wrong';
          return (
            <button key={idx} className={cls} disabled={gamePhase !== 'playing' || eliminated} onClick={() => handleAnswerClick(idx)}>
              <span className="letter">{['A', 'B', 'C', 'D'][idx]}</span>
              {option}
            </button>
          );
        })}
      </div>

      {/* Jokerler */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 'auto', paddingTop: 8 }}>
        <button className="btn-navy" style={{ padding: '10px 16px', fontSize: '.85rem' }} onClick={useExtraTime} disabled={!powerups.extraTime || gamePhase !== 'playing'}>⏱️ Süre ({powerups.extraTime})</button>
        <button className="btn-navy" style={{ padding: '10px 16px', fontSize: '.85rem' }} onClick={useFiftyFifty} disabled={!powerups.fiftyFifty || gamePhase !== 'playing'}>🎯 Şık Eleme ({powerups.fiftyFifty})</button>
      </div>

      {/* Hata bildir penceresi */}
      {showReportModal && (
        <div onClick={() => setShowReportModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,15,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
          <div className="panel" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, padding: 22, display: 'flex', flexDirection: 'column', gap: 10, animation: 'bounceIn .3s' }}>
            <h3 className="gold-text" style={{ textAlign: 'center', fontSize: '1.2rem' }}>⚠️ HATAYI BİLDİR</h3>
            {REPORT_REASONS.map(([key, label]) => (
              <button key={key} className="btn-navy" style={{ textAlign: 'left', fontSize: '.85rem', padding: '11px 14px' }} onClick={handleReport}>{label}</button>
            ))}
            <button onClick={() => setShowReportModal(false)} style={{ background: 'none', border: 'none', color: '#8ea0c4', fontWeight: 800, cursor: 'pointer', padding: 6 }}>İptal</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArcadeScreen;
