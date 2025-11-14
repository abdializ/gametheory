"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// Maximum number of rounds in a game
const MAX_ROUNDS = 15;

// Define types
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

//notes

// Helper function to calculate enhanced payoffs (client-side for bot mode)
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
  alwaysCooperate: () => 'cooperate',
  alwaysDefect: () => 'defect',
  random: () => Math.random() < 0.5 ? 'cooperate' : 'defect',
  titForTat: (history: GameRound[], playerNum: number) => {
    if (history.length === 0) return 'cooperate';
    const lastRound = history[history.length - 1];
    return playerNum === 1 ? lastRound.player2 : lastRound.player1;
  },
  grudger: (history: GameRound[], playerNum: number) => {
    const opponentDefected = history.some(round => 
      (playerNum === 1 ? round.player2 : round.player1) === 'defect'
    );
    return opponentDefected ? 'defect' : 'cooperate';
  }
};

function PrisonersDilemmaGame() {
  const searchParams = useSearchParams();
  const mode = searchParams?.get("mode");
  const botType = searchParams?.get("bot") as keyof typeof botStrategies;
  
  // Game state
  const [gameState, setGameState] = useState<'menu' | 'waiting' | 'playing' | 'choosing' | 'roundResult' | 'gameOver'>('menu');
  const [currentRound, setCurrentRound] = useState(0);
  const [scores, setScores] = useState({ player1: 0, player2: 0 });
  const [gameHistory, setGameHistory] = useState<GameRound[]>([]);
  const [lastRoundResult, setLastRoundResult] = useState<GameRound | null>(null);
  
  // Multiplayer state
  const [roomCode, setRoomCode] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [playerId] = useState(() => `player_${Math.random().toString(36).substr(2, 9)}`);
  const [playerNumber, setPlayerNumber] = useState<number>(0);
  const [playerCount, setPlayerCount] = useState(0);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
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
          
          if (data.gameState === 'finished') {
            setGameState('gameOver');
          } else if (data.gameState === 'playing') {
            if (gameState === 'waiting') {
              setGameState('choosing');
            }
            
            setCurrentRound(data.currentRound);
            
            // Check if round just completed
            if (data.lastRound && data.lastRound.round === currentRound && !waitingForOpponent) {
              setLastRoundResult(data.lastRound);
              setGameState('roundResult');
            }
            
            // Update waiting status
            if (data.waitingForOpponent && !waitingForOpponent) {
              setWaitingForOpponent(true);
            } else if (!data.waitingForOpponent && waitingForOpponent && gameState !== 'roundResult') {
              setWaitingForOpponent(false);
              // Both players ready, show result
              if (data.lastRound) {
                setLastRoundResult(data.lastRound);
                setGameState('roundResult');
              }
            }
          }
        }
      } catch {
        // Silently handle polling errors
      }
    }, 1000); // Poll every second
    
    return () => clearInterval(pollInterval);
  }, [isMultiplayer, roomCode, playerId, gameState, currentRound, waitingForOpponent]);
  
  // Create room
  const handleCreateRoom = async () => {
    try {
      const response = await fetch('/api/game/create', { method: 'POST' });
      const data = await response.json();
      
      if (data.roomCode) {
        setRoomCode(data.roomCode);
        await joinRoom(data.roomCode);
      }
    } catch {
      setError('Failed to create room');
    }
  };
  
  // Join room
  const joinRoom = async (code: string) => {
    try {
      const response = await fetch('/api/game/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: code, playerId })
      });
      
      if (response.ok) {
        const data = await response.json();
        setRoomCode(code);
        setPlayerNumber(data.room.playerNumber);
        setPlayerCount(data.room.playerCount);
        setScores(data.room.scores);
        setCurrentRound(data.room.currentRound);
        
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
      joinRoom(inputRoomCode.trim());
    }
  };
  
  // Handle player choice
  const handleChoice = async (choice: 'cooperate' | 'defect') => {
    if (isBotMode) {
      // Bot mode - immediate response
      const botChoice = botStrategies[botType](gameHistory, 2);
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
      setWaitingForOpponent(true);
      
      try {
        const response = await fetch('/api/game/choice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode, playerId, choice })
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (!data.waitingForOpponent && data.lastRound) {
            // Both players chose, show result immediately
            setLastRoundResult(data.lastRound);
            setScores(data.scores);
            setCurrentRound(data.currentRound);
            setGameHistory(data.gameHistory);
            setWaitingForOpponent(false);
            
            if (data.gameState === 'finished') {
              setGameState('gameOver');
            } else {
              setGameState('roundResult');
            }
          }
        } else {
          setError('Failed to submit choice');
          setWaitingForOpponent(false);
        }
      } catch {
        setError('Failed to submit choice');
        setWaitingForOpponent(false);
      }
    }
  };
  
  const handleNextRound = () => {
    setGameState('choosing');
    setLastRoundResult(null);
    setWaitingForOpponent(false);
  };
  
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
                type="text"
                value={inputRoomCode}
                onChange={(e) => setInputRoomCode(e.target.value)}
                placeholder="Enter room code"
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white"
                maxLength={6}
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
  
  const ChoiceScreen = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Round {currentRound} / {MAX_ROUNDS}</h2>
        <div className="text-lg">
          <span className="text-blue-400">You: {scores.player1}</span>
          <span className="mx-4">|</span>
          <span className="text-red-400">{isBotMode ? 'Bot' : 'Opponent'}: {scores.player2}</span>
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
        <div className="text-center text-yellow-400 animate-pulse">
          Waiting for opponent to choose...
        </div>
      )}
    </div>
  );
  
  const RoundResultScreen = () => {
    if (!lastRoundResult) return null;
    
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Round {lastRoundResult.round} Result</h2>
          <div className="text-lg">
            <span className="text-blue-400">You: {scores.player1}</span>
            <span className="mx-4">|</span>
            <span className="text-red-400">{isBotMode ? 'Bot' : 'Opponent'}: {scores.player2}</span>
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
        
        <button
          onClick={handleNextRound}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          Next Round
        </button>
      </div>
    );
  };
  
  const GameOverScreen = () => {
    const winner = scores.player1 > scores.player2 ? 'You win!' : 
                   scores.player1 < scores.player2 ? (isBotMode ? 'Bot wins!' : 'Opponent wins!') : 
                   "It's a tie!";
    
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-4xl font-bold mb-4">{winner}</h2>
          <div className="text-2xl mb-6">
            <span className="text-blue-400">You: {scores.player1}</span>
            <span className="mx-4">|</span>
            <span className="text-red-400">{isBotMode ? 'Bot' : 'Opponent'}: {scores.player2}</span>
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

