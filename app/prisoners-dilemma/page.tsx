"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// Maximum number of rounds in a game
const MAX_ROUNDS = 15;

// Game Round Interface
interface GameRound {
  round: number;
  player1: string;
  player2: string;
  payoffs: {
    player1: number;
    player2: number;
    bonuses: string[];
  };
}

// Calculate enhanced payoffs for bot mode (no Socket.IO)
const calculateEnhancedPayoffs = (p1Choice: string, p2Choice: string, _gameHistory: GameRound[] = []) => {
  let p1Score = 0, p2Score = 0;
  
  // Base payoffs
  if (p1Choice === 'cooperate' && p2Choice === 'cooperate') {
    p1Score = p2Score = 3;
  } else if (p1Choice === 'cooperate' && p2Choice === 'defect') {
    p1Score = 0; p2Score = 5;
  } else if (p1Choice === 'defect' && p2Choice === 'cooperate') {
    p1Score = 5; p2Score = 0;
  } else {
    p1Score = p2Score = 1;
  }
  
  return { player1: p1Score, player2: p2Score, bonuses: [] };
};

// Bot strategies
const botStrategies = {
  'always-cooperate': () => 'cooperate',
  'always-defect': () => 'defect',
  'random': () => Math.random() < 0.5 ? 'cooperate' : 'defect',
  'tit-for-tat': (history: GameRound[], playerNum: number) => {
    if (history.length === 0) return 'cooperate';
    const lastRound = history[history.length - 1];
    return playerNum === 1 ? lastRound.player2 : lastRound.player1;
  },
  'grudger': (history: GameRound[], playerNum: number) => {
    const opponentDefected = history.some(round =>
      (playerNum === 1 ? round.player2 : round.player1) === 'defect'
    );
    return opponentDefected ? 'defect' : 'cooperate';
  }
};

function PrisonersDilemmaGame() {
  const searchParams = useSearchParams();
  const mode = searchParams?.get("mode");
  const botType = searchParams?.get("bot");
  
  // Game state
  const [gameState, setGameState] = useState<'menu' | 'nameInput' | 'waiting' | 'playing' | 'choosing' | 'roundResult' | 'gameOver'>('menu');
  const [currentRound, setCurrentRound] = useState(0);
  const [scores, setScores] = useState({ player1: 0, player2: 0 });
  const [gameHistory, setGameHistory] = useState<GameRound[]>([]);
  const [lastRoundResult, setLastRoundResult] = useState<GameRound | null>(null);

  // Player names
  const [playerName, setPlayerName] = useState('');
  const [opponentName, setOpponentName] = useState('');

  // Generate random name
  const generateRandomName = () => {
    const adjectives = ['Swift', 'Bold', 'Wise', 'Quick', 'Smart', 'Clever', 'Brave', 'Calm', 'Cool', 'Epic'];
    const nouns = ['Eagle', 'Tiger', 'Wolf', 'Bear', 'Lion', 'Fox', 'Owl', 'Hawk', 'Shark', 'Panda'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}`;
  };

  // Multiplayer state
  const [roomCode, setRoomCode] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [playerId] = useState(() => `player_${Math.random().toString(36).substr(2, 9)}`);
  const [playerNumber, setPlayerNumber] = useState<number>(0);
  const [playerCount, setPlayerCount] = useState(0);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [opponentHasChosen, setOpponentHasChosen] = useState(false);
  const [myChoice, setMyChoice] = useState<string | null>(null);
  const [error, setError] = useState('');
  
  const isBotMode = mode === 'bot';
  const isMultiplayer = mode === 'multiplayer';
  
  // Poll for game state updates (multiplayer only)
  useEffect(() => {
    if (!isMultiplayer || !roomCode || gameState === 'menu' || gameState === 'gameOver') {
      return;
    }
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/game/state?roomCode=${roomCode}&playerId=${playerId}`);
        if (response.ok) {
          const data = await response.json();
          
          setPlayerCount(data.playerCount);
          setScores(data.scores);
          setGameHistory(data.gameHistory || []);

          // Update opponent name if we don't have it yet
          if (!opponentName && data.players && data.players.length > 1) {
            const opponent = data.players.find((p: { id: string; name: string }) => p.id !== playerId);
            if (opponent) {
              setOpponentName(opponent.name);
            }
          }
          
          if (data.gameState === 'finished') {
            setGameState('gameOver');
          } else if (data.gameState === 'playing') {
            if (gameState === 'waiting') {
              setGameState('choosing');
            }
            
            setCurrentRound(data.currentRound);
            
            // Update opponent choice status
            if (data.opponentHasChosen !== undefined) {
              setOpponentHasChosen(data.opponentHasChosen);
            }
            
            // Update my choice if available
            if (data.myChoice && !myChoice) {
              setMyChoice(data.myChoice);
            }
            
            // Check if round just completed - both players have chosen
            if (data.lastRound && data.lastRound.round === currentRound) {
              // Both players have chosen, show result
              setLastRoundResult(data.lastRound);
              setScores(data.scores);
              setGameHistory(data.gameHistory || []);
              setWaitingForOpponent(false);
              setOpponentHasChosen(false);
              setMyChoice(null);
              setGameState('roundResult');
            } else if (data.waitingForOpponent !== undefined) {
              setWaitingForOpponent(data.waitingForOpponent);
            }
          }
        }
      } catch {
        // Silently handle polling errors
      }
    }, 1000); // Poll every second
    
    return () => clearInterval(pollInterval);
  }, [isMultiplayer, roomCode, playerId, gameState, currentRound, waitingForOpponent, opponentName, myChoice]);
  
  // Start game with names
  const startGame = () => {
    if (!playerName.trim()) {
      setPlayerName(generateRandomName());
    }

    if (isBotMode) {
      setOpponentName(`${botType?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Bot`);
      setGameState('choosing');
      setCurrentRound(1);
    } else {
      setGameState('waiting');
    }
  };

  // Create room
  const handleCreateRoom = () => {
    setGameState('nameInput');
  };
  
  // Join room
  const joinRoom = async (code: string) => {
    try {
      const response = await fetch('/api/game/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: code,
          playerId,
          playerName: playerName || generateRandomName()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setRoomCode(code);
        setPlayerNumber(data.room.playerNumber);
        setPlayerCount(data.room.playerCount);
        setScores(data.room.scores);
        setCurrentRound(data.room.currentRound);
        setPlayerName(data.playerName);

        // Set opponent name if available
        if (data.room.players && data.room.players.length > 1) {
          const opponent = data.room.players.find((p: { id: string; name: string }) => p.id !== playerId);
          if (opponent) {
            setOpponentName(opponent.name);
          }
        }

        if (data.room.gameState === 'playing') {
          setGameState('choosing');
        } else {
          setGameState('waiting');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to join room');
      }
    } catch {
      setError('Failed to join room');
    }
  };
  
  const handleJoinRoom = () => {
    if (inputRoomCode.trim()) {
      setGameState('nameInput');
    }
  };

  // Actually create room after name input
  const createRoomWithName = async () => {
    try {
      const response = await fetch('/api/game/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: playerName || generateRandomName() })
      });
      const data = await response.json();

      if (data.roomCode) {
        setRoomCode(data.roomCode);
        setPlayerName(data.playerName);
        await joinRoom(data.roomCode);
      }
    } catch {
      setError('Failed to create room');
    }
  };

  // Actually join room after name input
  const joinRoomWithCode = () => {
    if (inputRoomCode.trim()) {
      joinRoom(inputRoomCode.trim());
    }
  };
  
  // Handle player choice
  const handleChoice = async (choice: 'cooperate' | 'defect') => {
    if (isBotMode) {
      // Bot mode - immediate response
      const botChoice = botStrategies[botType as keyof typeof botStrategies](gameHistory, 2);
      const result = calculateEnhancedPayoffs(choice, botChoice as string, gameHistory);
      
      setScores({
        player1: scores.player1 + result.player1,
        player2: scores.player2 + result.player2
      });
      
      const roundData = {
        round: currentRound + 1,
        player1: choice,
        player2: botChoice,
        payoffs: result
      };
      
      setGameHistory([...gameHistory, roundData]);
      setLastRoundResult(roundData);
      
      if (currentRound + 1 >= MAX_ROUNDS) {
        setGameState('gameOver');
      } else {
        setCurrentRound(currentRound + 1);
        setGameState('roundResult');
      }
    } else {
      // Multiplayer mode - submit choice and wait
      setMyChoice(choice);
      setWaitingForOpponent(true);
      setOpponentHasChosen(false);
      
      try {
        const response = await fetch('/api/game/choice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode, playerId, choice })
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (!data.waitingForOpponent && data.lastRound) {
            // Both players chose immediately, show result
            setLastRoundResult(data.lastRound);
            setScores(data.scores);
            setCurrentRound(data.currentRound);
            setGameHistory(data.gameHistory);
            setWaitingForOpponent(false);
            setOpponentHasChosen(false);
            setMyChoice(null);
            
            if (data.gameState === 'finished') {
              setGameState('gameOver');
            } else {
              setGameState('roundResult');
            }
          }
          // If still waiting, polling will handle the update
        } else {
          setError('Failed to submit choice');
          setWaitingForOpponent(false);
          setMyChoice(null);
        }
      } catch {
        setError('Failed to submit choice');
        setWaitingForOpponent(false);
        setMyChoice(null);
      }
    }
  };
  
  const handleNextRound = () => {
    setGameState('choosing');
    setLastRoundResult(null);
    setWaitingForOpponent(false);
    setOpponentHasChosen(false);
    setMyChoice(null);
  };
  
  // Auto-advance from round result to next round after 3 seconds
  useEffect(() => {
    if (gameState === 'roundResult' && !isBotMode && currentRound < MAX_ROUNDS) {
      const timer = setTimeout(() => {
        setGameState('choosing');
        setLastRoundResult(null);
        setWaitingForOpponent(false);
        setOpponentHasChosen(false);
        setMyChoice(null);
      }, 3000); // 3 seconds
      
      return () => clearTimeout(timer);
    }
  }, [gameState, currentRound, isBotMode, myChoice]);
  
  const handlePlayAgain = () => {
    setGameState('menu');
    setCurrentRound(0);
    setScores({ player1: 0, player2: 0 });
    setGameHistory([]);
    setLastRoundResult(null);
    setRoomCode('');
    setPlayerNumber(0);
    setPlayerCount(0);
    setWaitingForOpponent(false);
    setOpponentHasChosen(false);
    setMyChoice(null);
    setError('');
  };
  
  // Auto-start bot game
  useEffect(() => {
    if (isBotMode && botType && gameState === 'menu') {
      setGameState('choosing');
      setCurrentRound(1);
    }
  }, [isBotMode, botType, gameState]);
  
  // UI Components
  const MenuScreen = () => (
    <div className="text-center space-y-6">
      <h1 className="text-4xl font-bold mb-4">Prisoner&apos;s Dilemma</h1>
      <p className="text-gray-300 mb-8">A game theory experiment in cooperation and betrayal</p>
      
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="space-y-4">
        {isMultiplayer && (
          <>
            <button
              onClick={handleCreateRoom}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Create Room
            </button>
            
            <div className="flex gap-2">
              <input
                key="room-code-input"
                type="text"
                value={inputRoomCode}
                onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleJoinRoom();
                  }
                }}
                placeholder="Enter room code"
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400"
                maxLength={6}
                autoFocus
              />
              <button
                onClick={handleJoinRoom}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Join
              </button>
            </div>
          </>
        )}
        
        <Link
          href="/"
          className="block w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors text-center"
        >
          Back to Menu
        </Link>
      </div>
    </div>
  );

  const NameInputScreen = () => (
    <div className="text-center space-y-6">
      <h1 className="text-4xl font-bold mb-4">Enter Your Name</h1>
      <p className="text-gray-300 mb-8">Choose a temporary name for this game</p>

      <div className="space-y-4">
        <div className="flex gap-2 max-w-md mx-auto">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white"
            maxLength={20}
            autoFocus
          />
          <button
            onClick={() => setPlayerName(generateRandomName())}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            title="Generate random name"
          >
            🎲
          </button>
        </div>

        <div className="flex gap-4 justify-center">
          {isMultiplayer && inputRoomCode.trim() ? (
            <button
              onClick={joinRoomWithCode}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Join Room
            </button>
          ) : (
            <button
              onClick={isBotMode ? startGame : createRoomWithName}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              {isBotMode ? 'Start Game' : 'Create Room'}
            </button>
          )}

          <button
            onClick={() => setGameState('menu')}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const WaitingScreen = () => (
    <div className="text-center space-y-6">
      <h2 className="text-3xl font-bold">Waiting for Opponent...</h2>
      
      <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-6">
        <p className="text-xl mb-2">Room Code: <span className="font-mono font-bold text-2xl">{roomCode}</span></p>
        <p className="text-gray-300">Share this code with a friend</p>
      </div>
      
      <p className="text-gray-400">Players: {playerCount}/2</p>
      
      <button
        onClick={handlePlayAgain}
        className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
      >
        Cancel
      </button>
    </div>
  );
  
  const ChoiceScreen = () => {
    // Get correct scores based on player number
    const myScore = isBotMode ? scores.player1 : (playerNumber === 1 ? scores.player1 : scores.player2);
    const opponentScore = isBotMode ? scores.player2 : (playerNumber === 1 ? scores.player2 : scores.player1);

    return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Round {currentRound} / {MAX_ROUNDS}</h2>
        <div className="text-lg">
          <span className="text-blue-400">{playerName}: {myScore}</span>
          <span className="mx-4">vs</span>
          <span className="text-red-400">{opponentName}: {opponentScore}</span>
        </div>
      </div>
      
      {!isBotMode && playerNumber > 0 && (
        <div className="text-center text-gray-400">
          You are Player {playerNumber}
        </div>
      )}
      
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h3 className="text-xl font-bold mb-4 text-center">Make Your Choice</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => handleChoice('cooperate')}
            disabled={waitingForOpponent}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-8 px-6 rounded-lg transition-colors"
          >
            <div className="text-2xl mb-2">🤝</div>
            <div className="text-xl">Cooperate</div>
            <div className="text-sm text-gray-300 mt-2">Work together</div>
          </button>
          
          <button
            onClick={() => handleChoice('defect')}
            disabled={waitingForOpponent}
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-8 px-6 rounded-lg transition-colors"
          >
            <div className="text-2xl mb-2">⚔️</div>
            <div className="text-xl">Defect</div>
            <div className="text-sm text-gray-300 mt-2">Betray them</div>
          </button>
        </div>
      </div>
      
      {waitingForOpponent && (
        <div className="space-y-2">
          <div className="text-center text-yellow-400 animate-pulse">
            {myChoice && (
              <div className="mb-2">
                You chose: <span className="font-bold">{myChoice === 'cooperate' ? '🤝 Cooperate' : '⚔️ Defect'}</span>
              </div>
            )}
            {opponentHasChosen ? (
              <div className="text-green-400">
                ✓ Opponent has chosen! Processing...
              </div>
            ) : (
              <div>Waiting for opponent to choose...</div>
            )}
          </div>
        </div>
      )}
    </div>
    );
  };
  
  const RoundResultScreen = () => {
    if (!lastRoundResult) return null;
    
    // Get correct scores based on player number
    const myScore = isBotMode ? scores.player1 : (playerNumber === 1 ? scores.player1 : scores.player2);
    const opponentScore = isBotMode ? scores.player2 : (playerNumber === 1 ? scores.player2 : scores.player1);

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Round {lastRoundResult.round} Result</h2>
          <div className="text-lg">
            <span className="text-blue-400">{playerName}: {myScore}</span>
            <span className="mx-4">vs</span>
            <span className="text-red-400">{opponentName}: {opponentScore}</span>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <div className="text-gray-400 mb-2">You chose</div>
              <div className={`text-2xl font-bold ${lastRoundResult.player1 === 'cooperate' ? 'text-green-400' : 'text-red-400'}`}>
                {lastRoundResult.player1 === 'cooperate' ? '🤝 Cooperate' : '⚔️ Defect'}
              </div>
              <div className="text-3xl font-bold mt-2">+{lastRoundResult.payoffs.player1}</div>
            </div>
            
            <div className="text-center">
              <div className="text-gray-400 mb-2">{isBotMode ? 'Bot' : 'Opponent'} chose</div>
              <div className={`text-2xl font-bold ${lastRoundResult.player2 === 'cooperate' ? 'text-green-400' : 'text-red-400'}`}>
                {lastRoundResult.player2 === 'cooperate' ? '🤝 Cooperate' : '⚔️ Defect'}
              </div>
              <div className="text-3xl font-bold mt-2">+{lastRoundResult.payoffs.player2}</div>
            </div>
          </div>
          
          {lastRoundResult.payoffs.bonuses && lastRoundResult.payoffs.bonuses.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-400 mb-2">Bonuses:</p>
              {lastRoundResult.payoffs.bonuses.map((bonus: string, i: number) => (
                <p key={i} className="text-sm text-yellow-400">{bonus}</p>
              ))}
            </div>
          )}
        </div>
        
        {isBotMode && currentRound < MAX_ROUNDS && (
          <button
            onClick={handleNextRound}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Next Round
          </button>
        )}
        
        {!isBotMode && currentRound < MAX_ROUNDS && (
          <div className="text-center text-gray-400">
            Next round starting automatically...
          </div>
        )}
      </div>
    );
  };
  
  const GameOverScreen = () => {
    // Get correct scores based on player number
    const myScore = isBotMode ? scores.player1 : (playerNumber === 1 ? scores.player1 : scores.player2);
    const opponentScore = isBotMode ? scores.player2 : (playerNumber === 1 ? scores.player2 : scores.player1);

    const winner = myScore > opponentScore ? `${playerName} wins!` : 
                   myScore < opponentScore ? `${opponentName} wins!` : 
                   "It's a tie!";
    
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-4xl font-bold mb-4">{winner}</h2>
          <div className="text-2xl mb-6">
            <span className="text-blue-400">{playerName}: {myScore}</span>
            <span className="mx-4">vs</span>
            <span className="text-red-400">{opponentName}: {opponentScore}</span>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6 max-h-96 overflow-y-auto">
          <h3 className="text-xl font-bold mb-4">Game History</h3>
          <div className="space-y-2">
            {gameHistory.map((round, i) => (
              <div key={i} className="flex justify-between items-center border-b border-gray-700 pb-2">
                <span className="text-gray-400">Round {round.round}</span>
                <div className="flex gap-4">
                  <span className={round.player1 === 'cooperate' ? 'text-green-400' : 'text-red-400'}>
                    You: {round.player1 === 'cooperate' ? '🤝' : '⚔️'} (+{round.payoffs.player1})
                  </span>
                  <span className={round.player2 === 'cooperate' ? 'text-green-400' : 'text-red-400'}>
                    {isBotMode ? 'Bot' : 'Opp'}: {round.player2 === 'cooperate' ? '🤝' : '⚔️'} (+{round.payoffs.player2})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={handlePlayAgain}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Play Again
          </button>
          <Link
            href="/"
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors text-center"
          >
            Main Menu
          </Link>
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {gameState === 'menu' && <MenuScreen />}
        {gameState === 'nameInput' && <NameInputScreen />}
        {gameState === 'waiting' && <WaitingScreen />}
        {gameState === 'choosing' && <ChoiceScreen />}
        {gameState === 'roundResult' && <RoundResultScreen />}
        {gameState === 'gameOver' && <GameOverScreen />}
      </div>
    </div>
  );
}

export default function PrisonersDilemmaGameWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white flex items-center justify-center">Loading...</div>}>
      <PrisonersDilemmaGame />
    </Suspense>
  );
}

