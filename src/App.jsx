import React, { useState, useCallback, useEffect } from 'react';
import MainMenu from './components/Home/MainMenu';
import MatchmakingScreen from './components/Game/MatchmakingScreen';
import GameScreen from './components/Game/GameScreen';
import ArcadeScreen from './components/Game/ArcadeScreen';
import OnlineDuelScreen from './components/Game/OnlineDuelScreen';
import ResultScreen from './components/Game/ResultScreen';
import ShopScreen from './components/Shop/ShopScreen';
import LeaderboardScreen from './components/Leaderboard/LeaderboardScreen';
import ProfileScreen from './components/Profile/ProfileScreen';
import Navbar from './components/UI/Navbar';
import { questions } from './data/questions';
import { startSession, subscribeSession, request, applyProfile } from './net/socket';

const LEAGUES = [
  { name: 'Bronz', min: 0, icon: '🥉', color: '#cd7f32' },
  { name: 'Gümüş', min: 1150, icon: '🥈', color: '#c0c8d4' },
  { name: 'Altın', min: 1230, icon: '🥇', color: '#f6c85f' },
  { name: 'Elmas', min: 1320, icon: '💎', color: '#4cc9f0' },
  { name: 'Efsane', min: 1450, icon: '👑', color: '#c77dff' },
];

function computeLeagueMeta(elo = 1200) {
  let cur = LEAGUES[0];
  for (const l of LEAGUES) if (elo >= l.min) cur = l;
  const next = LEAGUES.find((l) => l.min > elo) || null;
  return {
    league: cur.name,
    leagueIcon: cur.icon,
    leagueColor: cur.color,
    leagueMin: cur.min,
    nextLeague: next ? { name: next.name, min: next.min, icon: next.icon, color: next.color } : null,
  };
}

// Sunucuya bağlanılamazken kullanılan geçici misafir verisi (kaydedilmez).
const GUEST = {
  username: 'Misafir',
  avatar: '👤',
  coins: 500,
  diamonds: 0,
  elo: 1200,
  ...computeLeagueMeta(1200),
  stats: { totalGames: 0, wins: 0, losses: 0, draws: 0, correctAnswers: 0 },
  inventory: { extraTime: 0, eliminateWrong: 0, shield: 0 },
  unlockedAvatars: ['👤', '🧑‍🎓', '🥷', '🤴', '👸', '🦁', '🦅', '🐺', '🌙', '⚔️'],
  history: [],
};

function App() {
  const [screen, setScreen] = useState('menu'); // menu, online, matchmaking, game, arcade, arcadeResult, result, shop, leaderboard, profile
  const [activeTab, setActiveTab] = useState('home');
  const [gameResults, setGameResults] = useState(null);
  const [session, setSession] = useState({ status: 'connecting', profile: null });
  const [guest, setGuest] = useState(GUEST);

  useEffect(() => {
    startSession();
    return subscribeSession(setSession);
  }, []);

  const online = session.status === 'online' && !!session.profile;
  const rawPlayer = session.profile || guest;
  const playerData = { ...rawPlayer, ...computeLeagueMeta(rawPlayer.elo ?? 1200) };

  const [matchQuestions, setMatchQuestions] = useState([]);
  const [arcadeResult, setArcadeResult] = useState(null);

  const shuffleQuestions = useCallback((count) => {
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    return count ? shuffled.slice(0, count) : shuffled;
  }, []);

  const goMenu = () => { setScreen('menu'); setActiveTab('home'); };

  const handleStartDuel = () => setScreen('online');

  // Sunucuya ulaşılamazsa: rakibi bot olan çevrimdışı düello
  const handleOfflineDuel = () => {
    setMatchQuestions(shuffleQuestions(10));
    setScreen('matchmaking');
  };

  const handleQuickQuiz = () => {
    setMatchQuestions(shuffleQuestions(10));
    setScreen('game');
  };

  const handleArcade = () => {
    setMatchQuestions(shuffleQuestions());
    setScreen('arcade');
  };

  const handleArcadeEnd = async (res) => {
    let coinsEarned = 0;
    if (online) {
      // Ödülü sunucu verir (üst sınırlı); istemcinin hesabına güvenilmez
      const r = await request('arcade_reward', { score: res.score });
      if (r.ok) { coinsEarned = r.coins; applyProfile(r.profile); }
    } else {
      coinsEarned = Math.min(Math.floor(res.score / 2), 150);
      setGuest((g) => ({ ...g, coins: g.coins + coinsEarned }));
    }
    setArcadeResult({ ...res, coinsEarned });
    setScreen('arcadeResult');
  };

  const handleMatchFound = () => setScreen('game');

  const handleGameEnd = (results) => {
    let rewards = results.rewards || null; // online düello: ödülü sunucu hesapladı, profil zaten güncellendi

    if (!rewards && !online) {
      // Çevrimdışı misafir: yerel hesap
      const won = results.playerScore > results.opponentScore;
      rewards = { coins: won ? 25 : 10, eloDelta: won ? 15 : -10 };
      setGuest((g) => ({
        ...g,
        coins: g.coins + rewards.coins,
        elo: Math.max(0, g.elo + rewards.eloDelta),
        stats: {
          ...g.stats,
          totalGames: g.stats.totalGames + 1,
          wins: g.stats.wins + (won ? 1 : 0),
          losses: g.stats.losses + (won ? 0 : 1),
          correctAnswers: g.stats.correctAnswers + (results.stats?.correctAnswers || 0),
        },
      }));
    }
    // online + ödülsüz = alıştırma (Hızlı Quiz / çevrimdışı düello): ödül yok
    setGameResults({ ...results, rewards });
    setScreen('result');
  };

  /** Mağaza: sunucu fiyatı ve stoğu doğrular, güncel profili döner. */
  const handlePurchase = async (item) => {
    if (!online) return { ok: false, error: 'offline' };
    const r = await request('purchase', { itemId: item.id });
    if (r.ok) applyProfile(r.profile);
    return r;
  };

  const handleUpdateProfile = async (updates) => {
    if (!online) {
      const next = { ...(session.profile || guest), ...updates };
      applyProfile(next);
      return { ok: true, profile: next };
    }
    const r = await request('update_profile', updates);
    if (r.ok) applyProfile(r.profile);
    return r;
  };

  const handleNavigate = (tab) => {
    setActiveTab(tab);
    switch (tab) {
      case 'home': setScreen('menu'); break;
      case 'shop': setScreen('shop'); break;
      case 'leaderboard': setScreen('leaderboard'); break;
      case 'profile': setScreen('profile'); break;
      default: setScreen('menu');
    }
  };

  const showNavbar = ['menu', 'shop', 'leaderboard', 'profile'].includes(screen);

  return (
    <div style={{ width: '100%', minHeight: '100vh', position: 'relative' }}>
      {session.status === 'offline' && screen !== 'online' && (
        <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, zIndex: 3000, textAlign: 'center', padding: '5px 10px', fontSize: '.72rem', fontWeight: 800, color: '#2a1c00', background: 'linear-gradient(180deg, var(--gold-300), var(--gold-500))' }}>
          📡 Sunucuya bağlanılamıyor — çevrimdışı mod (ilerleme kaydedilmez)
        </div>
      )}

      {screen === 'menu' && (
        <MainMenu
          onStartDuel={handleStartDuel}
          onQuickQuiz={handleQuickQuiz}
          onArcade={handleArcade}
          onNavigate={handleNavigate}
          playerData={{ ...playerData, gold: playerData.coins }}
        />
      )}

      {screen === 'online' && (
        <OnlineDuelScreen
          playerData={playerData}
          onGameEnd={handleGameEnd}
          onExit={goMenu}
          onOffline={handleOfflineDuel}
        />
      )}

      {screen === 'matchmaking' && (
        <MatchmakingScreen onMatchFound={handleMatchFound} />
      )}

      {screen === 'game' && (
        <GameScreen questions={matchQuestions} onGameEnd={handleGameEnd} onExit={goMenu} />
      )}

      {screen === 'arcade' && (
        <ArcadeScreen questions={matchQuestions} onGameEnd={handleArcadeEnd} onExit={goMenu} />
      )}

      {screen === 'arcadeResult' && arcadeResult && (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '4.5rem', animation: 'float 3s ease-in-out infinite', filter: 'drop-shadow(0 6px 16px rgba(246,200,95,.6))' }}>🕹️</div>
          <h1 className="gold-text" style={{ fontSize: '2.2rem' }}>OYUN BİTTİ</h1>
          <div className="panel" style={{ padding: '18px 28px', width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 10, animation: 'bounceIn .5s' }}>
            <div className="gold-text" style={{ fontSize: '3rem' }}>{arcadeResult.score}</div>
            <div style={{ fontWeight: 800, color: 'var(--gold-300)' }}>PUAN</div>
            <div className="pill" style={{ justifyContent: 'center' }}>✅ Doğru cevap: {arcadeResult.correctAnswers}</div>
            <div className="pill" style={{ justifyContent: 'center' }}>🪙 +{arcadeResult.coinsEarned} Altın</div>
          </div>
          <button className="btn-gold" style={{ width: '100%', maxWidth: 320 }} onClick={handleArcade}>TEKRAR OYNA</button>
          <button className="btn-navy" style={{ width: '100%', maxWidth: 320 }} onClick={goMenu}>ANA MENÜ</button>
        </div>
      )}

      {screen === 'result' && gameResults && (
        <ResultScreen
          playerScore={gameResults.playerScore}
          opponentScore={gameResults.opponentScore}
          stats={gameResults.stats}
          rewards={gameResults.rewards}
          onPlayAgain={handleStartDuel}
          onMainMenu={goMenu}
        />
      )}

      {screen === 'shop' && (
        <ShopScreen playerData={playerData} online={online} onPurchase={handlePurchase} onBack={goMenu} />
      )}

      {screen === 'leaderboard' && (
        <LeaderboardScreen playerData={playerData} online={online} onBack={goMenu} />
      )}

      {screen === 'profile' && (
        <ProfileScreen
          playerData={playerData}
          online={online}
          onUpdateProfile={handleUpdateProfile}
          onBack={goMenu}
        />
      )}

      {showNavbar && (
        <Navbar activeTab={activeTab} onNavigate={handleNavigate} />
      )}
    </div>
  );
}

export default App;
