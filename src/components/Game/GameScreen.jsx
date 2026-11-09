import React, { useState, useEffect, useRef, useCallback } from 'react';

const REPORT_REASONS = [
  ['wrong_answer', '❌ Doğru cevap yanlış işaretlenmiş'],
  ['wrong_question', '📝 Soru metni hatalı'],
  ['duplicate', '🔄 Tekrar eden soru'],
  ['other', '💬 Diğer'],
];

const GameScreen = ({ questions, onGameEnd, onExit }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [maxTime, setMaxTime] = useState(15);
  const [gamePhase, setGamePhase] = useState('playing'); // playing | opponent_turn | answer_revealed
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [opponentSelected, setOpponentSelected] = useState(null);
  const [eliminatedOptions, setEliminatedOptions] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportedQuestions, setReportedQuestions] = useState([]);
  const [playerCorrectCount, setPlayerCorrectCount] = useState(0);
  const [firstToAnswerCount, setFirstToAnswerCount] = useState(0);
  const [powerups, setPowerups] = useState({ extraTime: 1, fiftyFifty: 1 });

  const timerRef = useRef(null);
  const gamePhaseRef = useRef(gamePhase);
  gamePhaseRef.current = gamePhase;

  const q = questions[currentIndex];
  const currentQuestion = q ? {
    id: q.id,
    text: q.question,
    options: q.options,
    correctIndex: q.correctAnswer,
    category: q.category,
  } : null;

  const nextQuestion = useCallback(() => {
    if (currentIndex >= 9) {
      onGameEnd({
        playerScore,
        opponentScore,
        stats: {
          correctAnswers: playerCorrectCount,
          firstToAnswer: firstToAnswerCount,
          fastBonus: firstToAnswerCount * 5,
        },
      });
    } else {
      setCurrentIndex(prev => prev + 1);
      setTimeLeft(15);
      setMaxTime(15);
      setGamePhase('playing');
      setSelectedAnswer(null);
      setOpponentSelected(null);
      setEliminatedOptions([]);
    }
  }, [currentIndex, playerScore, opponentScore, playerCorrectCount, firstToAnswerCount, onGameEnd]);

  useEffect(() => {
    if (gamePhase === 'playing') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setGamePhase('answer_revealed');
            setTimeout(() => {
              if (gamePhaseRef.current === 'answer_revealed') nextQuestion();
            }, 1500);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gamePhase, currentIndex]);

  const handleAnswerClick = (optionIndex) => {
    if (gamePhase !== 'playing' || eliminatedOptions.includes(optionIndex)) return;
    clearInterval(timerRef.current);
    setSelectedAnswer(optionIndex);

    if (optionIndex === currentQuestion.correctIndex) {
      setPlayerScore(prev => prev + 10);
      setPlayerCorrectCount(prev => prev + 1);
      setFirstToAnswerCount(prev => prev + 1);
      setGamePhase('answer_revealed');
      setTimeout(nextQuestion, 1500);
    } else {
      // Yanlış: rakibe ek süre, kalan şıklardan seçer
      setGamePhase('opponent_turn');
      setTimeout(() => {
        if (Math.random() > 0.4) {
          setOpponentSelected(currentQuestion.correctIndex);
          setOpponentScore(prev => prev + 10);
        } else {
          const wrongOptions = currentQuestion.options
            .map((_, i) => i)
            .filter(i => i !== currentQuestion.correctIndex && i !== optionIndex);
          setOpponentSelected(wrongOptions[Math.floor(Math.random() * wrongOptions.length)]);
        }
        setGamePhase('answer_revealed');
        setTimeout(nextQuestion, 2000);
      }, 2500);
    }
  };

  const useExtraTime = () => {
    if (powerups.extraTime > 0 && gamePhase === 'playing') {
      setTimeLeft(prev => prev + 10);
      setMaxTime(prev => prev + 10);
      setPowerups(prev => ({ ...prev, extraTime: 0 }));
    }
  };

  const useFiftyFifty = () => {
    if (powerups.fiftyFifty > 0 && gamePhase === 'playing') {
      const wrong = currentQuestion.options.map((_, i) => i).filter(i => i !== currentQuestion.correctIndex);
      setEliminatedOptions(wrong.sort(() => 0.5 - Math.random()).slice(0, 1));
      setPowerups(prev => ({ ...prev, fiftyFifty: 0 }));
    }
  };

  const handleReport = (reason) => {
    setReportedQuestions(prev => [...prev, { questionId: currentQuestion.id, reason }]);
    setShowReportModal(false);
    alert('Geri bildiriminiz kaydedildi. Teşekkürler! 🙏');
  };

  const handleExit = () => {
    if (window.confirm('Düellodan çıkmak istiyor musun? Maç yenilgi sayılmaz, ilerleme kaybolur.')) {
      clearInterval(timerRef.current);
      onExit && onExit();
    }
  };

  if (!currentQuestion) return null;

  const timerColor = timeLeft > 10 ? 'linear-gradient(180deg,#6dffa6,#1fb35a)' : timeLeft > 5 ? 'linear-gradient(180deg,#ffd36b,#e08a00)' : 'linear-gradient(180deg,#ff8a8f,#d11f2a)';
  const timerWidth = Math.min((timeLeft / maxTime) * 100, 100);
  const revealed = gamePhase === 'answer_revealed';

  const status = (() => {
    if (gamePhase === 'opponent_turn') return ['Yanlış! Rakip kalan şıklardan seçiyor... ⏳', '#ffd36b'];
    if (revealed && selectedAnswer === currentQuestion.correctIndex) return ['DOĞRU! +10 🎯', '#6dffa6'];
    if (revealed && selectedAnswer !== null && opponentSelected === currentQuestion.correctIndex) return ['Rakip doğru bildi! 😞', '#ff8a8f'];
    if (revealed && selectedAnswer !== null) return ['İkisi de yanlış! Puan yok 🤷', '#ffd36b'];
    if (revealed) return ['Süre doldu! ⏰', '#b8c4e0'];
    return null;
  })();

  return (
    <div style={{ minHeight: '100vh', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Üst bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn-navy" onClick={handleExit} style={{ padding: '8px 10px', fontSize: '.8rem', borderRadius: 12 }}>✕</button>
        <div className="panel" style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '.65rem', color: 'var(--gold-300)', fontWeight: 800, letterSpacing: 1 }}>SEN</div>
            <div className="title-font" style={{ fontSize: '1.5rem', fontWeight: 800 }}>{playerScore}</div>
          </div>
          <div className="pill" style={{ fontSize: '.8rem' }}>Soru {currentIndex + 1}/10</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '.65rem', color: '#ff9a9f', fontWeight: 800, letterSpacing: 1 }}>RAKİP</div>
            <div className="title-font" style={{ fontSize: '1.5rem', fontWeight: 800 }}>{opponentScore}</div>
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

      {/* Durum mesajı */}
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
          else if ((revealed || gamePhase === 'opponent_turn') && idx === selectedAnswer) cls += ' wrong';
          else if (revealed && idx === opponentSelected) cls += ' opp';
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
        <button className="btn-navy" style={{ padding: '10px 16px', fontSize: '.85rem' }} onClick={useExtraTime} disabled={!powerups.extraTime || gamePhase !== 'playing'}>⏱️ Ekstra Süre</button>
        <button className="btn-navy" style={{ padding: '10px 16px', fontSize: '.85rem' }} onClick={useFiftyFifty} disabled={!powerups.fiftyFifty || gamePhase !== 'playing'}>🎯 Şık Eleme</button>
      </div>

      {/* Hata bildir penceresi */}
      {showReportModal && (
        <div onClick={() => setShowReportModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,15,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
          <div className="panel" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, padding: 22, display: 'flex', flexDirection: 'column', gap: 10, animation: 'bounceIn .3s' }}>
            <h3 className="gold-text" style={{ textAlign: 'center', fontSize: '1.2rem' }}>⚠️ HATAYI BİLDİR</h3>
            <p style={{ textAlign: 'center', fontSize: '.8rem', color: '#9fb0d4' }}>Bu soruda ne tür bir hata var?</p>
            {REPORT_REASONS.map(([key, label]) => (
              <button key={key} className="btn-navy" style={{ textAlign: 'left', fontSize: '.85rem', padding: '11px 14px' }} onClick={() => handleReport(key)}>{label}</button>
            ))}
            <button onClick={() => setShowReportModal(false)} style={{ background: 'none', border: 'none', color: '#8ea0c4', fontWeight: 800, cursor: 'pointer', padding: 6 }}>İptal</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameScreen;
