"use client";

import { useState, useEffect, useCallback, useRef, useContext, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SocketContext } from "../../pages/_app";

// Maximum number of rounds in a game
const MAX_ROUNDS = 15;

// Calculate cooperation streaks for each player
const calculateStreaks = (gameHistory: {p1: string, p2: string}[], currentP1Choice: string, currentP2Choice: string) => {
  let p1Streak = 0;
  let p2Streak = 0;
  
  // Count consecutive cooperations from the end
  for (let i = gameHistory.length - 1; i >= 0; i--) {
    if (gameHistory[i].p1 === 'cooperate') {
      p1Streak++;
    } else {
      break;
    }
  }
  
  for (let i = gameHistory.length - 1; i >= 0; i--) {
    if (gameHistory[i].p2 === 'cooperate') {
      p2Streak++;
    } else {
      break;
    }
  }
  
  // Add current round if cooperating
  if (currentP1Choice === 'cooperate') p1Streak++;
  if (currentP2Choice === 'cooperate') p2Streak++;
  
  return { p1Streak, p2Streak };
};

// Calculate defection rate (reputation)
const calculateDefectionRate = (gameHistory: {p1: string, p2: string}[], playerId: number) => {
  if (gameHistory.length === 0) return 0;
  
  const choiceKey = playerId === 1 ? 'p1' : 'p2';
  const defects = gameHistory.filter(round => round[choiceKey] === 'defect').length;
  return defects / gameHistory.length;
};

// Check if player switched from defect to cooperate (forgiveness bonus)
const checkForgiveness = (gameHistory: {p1: string, p2: string}[], currentChoice: string, playerId: number) => {
  if (gameHistory.length === 0) return false;
  
  const choiceKey = playerId === 1 ? 'p1' : 'p2';
  const lastChoice = gameHistory[gameHistory.length - 1][choiceKey];
  return lastChoice === 'defect' && currentChoice === 'cooperate';
};

// Calculate payoffs with enhanced mechanics to balance the game
const calculateEnhancedPayoffs = (p1Choice: string, p2Choice: string, gameHistory: {p1: string, p2: string}[] = []) => {
  let p1Payoff = 0;
  let p2Payoff = 0;
  
  // Base payoffs from standard Prisoner's Dilemma
  if (p1Choice === 'cooperate' && p2Choice === 'cooperate') {
    p1Payoff = 3;
    p2Payoff = 3;
  } else if (p1Choice === 'cooperate' && p2Choice === 'defect') {
    p1Payoff = 0;
    p2Payoff = 5;
  } else if (p1Choice === 'defect' && p2Choice === 'cooperate') {
    p1Payoff = 5;
    p2Payoff = 0;
  } else if (p1Choice === 'defect' && p2Choice === 'defect') {
    p1Payoff = 1;
    p2Payoff = 1;
  }
  
  // Calculate streaks
  const { p1Streak, p2Streak } = calculateStreaks(gameHistory, p1Choice, p2Choice);
  
  // Cooperation streak bonus: +1 point for every 2 consecutive cooperations
  if (p1Choice === 'cooperate' && p2Choice === 'cooperate') {
    const p1Bonus = Math.floor(p1Streak / 2);
    const p2Bonus = Math.floor(p2Streak / 2);
    p1Payoff += p1Bonus;
    p2Payoff += p2Bonus;
  }
  
  // Reputation penalty: if defection rate > 60%, reduce defection rewards
  const p1DefectRate = calculateDefectionRate(gameHistory, 1);
  const p2DefectRate = calculateDefectionRate(gameHistory, 2);
  
  if (p1Choice === 'defect' && p2Choice === 'cooperate') {
    // P1 defects against cooperator
    if (p1DefectRate > 0.6) {
      // Reduce reward for excessive defection
      p1Payoff = Math.max(2, p1Payoff - Math.floor(p1DefectRate * 3));
    }
  }
  
  if (p2Choice === 'defect' && p1Choice === 'cooperate') {
    // P2 defects against cooperator
    if (p2DefectRate > 0.6) {
      // Reduce reward for excessive defection
      p2Payoff = Math.max(2, p2Payoff - Math.floor(p2DefectRate * 3));
    }
  }
  
  // Forgiveness bonus: +2 points for switching from defect to cooperate
  if (checkForgiveness(gameHistory, p1Choice, 1) && p2Choice === 'cooperate') {
    p1Payoff += 2;
  }
  
  if (checkForgiveness(gameHistory, p2Choice, 2) && p1Choice === 'cooperate') {
    p2Payoff += 2;
  }
  
  // Mutual defection penalty: if both defect repeatedly, reduce points further
  if (p1Choice === 'defect' && p2Choice === 'defect') {
    const mutualDefects = gameHistory.filter(r => 
      r.p1 === 'defect' && r.p2 === 'defect'
    ).length;
    
    if (mutualDefects >= 3) {
      // After 3+ mutual defections, both get 0 points
      p1Payoff = 0;
      p2Payoff = 0;
    }
  }
  
  return { p1Payoff, p2Payoff };
};

// Bot strategy implementations
const botStrategies = {
  'always-cooperate': {
    name: "Always Cooperate",
    description: "A nice bot that always cooperates",
    getNextMove: (_history: {p1: string, p2: string}[]) => "cooperate"
  },
  'always-defect': {
    name: "Always Defect",
    description: "A mean bot that always defects",
    getNextMove: (_history: {p1: string, p2: string}[]) => "defect"
  },
  'tit-for-tat': {
    name: "Tit-for-Tat",
    description: "Starts with cooperation, then mimics opponent's last move",
    getNextMove: (history: {p1: string, p2: string}[]) => {
      if (history.length === 0) return "cooperate";
      return history[history.length - 1].p1;  // Copy opponent's last move
    }
  },
  'random': {
    name: "Random",
    description: "Makes random choices",
    getNextMove: (_history: {p1: string, p2: string}[]) => 
      Math.random() > 0.5 ? "cooperate" : "defect"
  },
  'grudger': {
    name: "Grudger",
    description: "Cooperates until opponent defects, then always defects",
    getNextMove: (history: {p1: string, p2: string}[]) => {
      // If opponent has ever defected, always defect
      return history.some(round => round.p1 === "defect") ? "defect" : "cooperate";
    }
  },
  'pavlov': {
    name: "Pavlov",
    description: "Starts with cooperation, changes strategy if last round was unfavorable",
    getNextMove: (history: {p1: string, p2: string}[]) => {
      if (history.length === 0) return "cooperate";
      
      const lastRound = history[history.length - 1];
      // If both players made the same choice, cooperate; otherwise defect
      return lastRound.p1 === lastRound.p2 ? "cooperate" : "defect";
    }
  }
};

// Choice component representing a single choice button
const ChoiceButton = ({ 
  label, 
  onClick, 
  disabled 
}: { 
  label: string; 
  onClick: () => void; 
  disabled: boolean;
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-md font-medium transition-colors ${
        disabled 
          ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed" 
          : "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
      }`}
    >
      {label}
    </button>
  );
};

// Simple spinner animation component
const Spinner = () => {
  return (
    <div className="flex justify-center my-4">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400"></div>
    </div>
  );
};

// Game over screen component
const GameOverScreen = ({ 
  scores, 
  onPlayAgain,
  tieRoundCount,
  playerId,
  gameHistory
}: { 
  scores: { p1: number; p2: number }; 
  onPlayAgain: () => void;
  tieRoundCount?: number;
  isBotGame?: boolean;
  botStrategy?: string;
  playerId: number | null;
  gameHistory: {p1: string, p2: string}[];
}) => {
  // State for animated reveal
  const [showScores, setShowScores] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // For debugging, log the game history
  useEffect(() => {
    console.log('GameOverScreen received history:', gameHistory, 'length:', gameHistory.length);
  }, [gameHistory]);
  
  // Determine the winner
  let winner = null;
  if (scores.p1 > scores.p2) {
    winner = playerId === 1 ? "You" : "They";
  } else if (scores.p2 > scores.p1) {
    winner = playerId === 2 ? "You" : "They";
  }
  
  // Calculate per-round payoffs for history display using enhanced mechanics
  const roundPayoffs = gameHistory.map((round, index) => {
    // Get history up to (but not including) this round
    const historyUpToRound = gameHistory.slice(0, index);
    // Use enhanced payoff calculation
    return calculateEnhancedPayoffs(round.p1, round.p2, historyUpToRound);
  });
  
  // Delayed reveal effect
  useEffect(() => {
    // First show the scores after a delay
    const scoresTimer = setTimeout(() => {
      setShowScores(true);
    }, 1000);
    
    // Then show the history after another delay
    const historyTimer = setTimeout(() => {
      setShowHistory(true);
    }, 2000);
    
    return () => {
      clearTimeout(scoresTimer);
      clearTimeout(historyTimer);
    };
  }, []);

  // Game history timeline with animation
  // Only show history section if we have history to display
  const historySection = gameHistory && gameHistory.length > 0 ? (
    <div 
      className={`transition-all duration-1000 ease-in-out mb-6 overflow-hidden ${
        showHistory ? 'max-h-96 opacity-100 translate-y-0' : 'max-h-0 opacity-0 translate-y-10'
      }`}
    >
      <h3 className="text-lg font-medium mb-3">Game History</h3>
      <div className="text-left max-h-60 overflow-y-auto bg-white dark:bg-gray-700 rounded-lg p-4">
        {gameHistory.map((round, index) => {
          const payoff = roundPayoffs[index];
          const yourChoice = playerId === 1 ? round.p1 : round.p2;
          const theirChoice = playerId === 1 ? round.p2 : round.p1;
          const yourPayoff = playerId === 1 ? payoff.p1Payoff : payoff.p2Payoff;
          const theirPayoff = playerId === 1 ? payoff.p2Payoff : payoff.p1Payoff;
          
          return (
            <div 
              key={index} 
              className={`mb-2 pb-2 ${
                index < gameHistory.length - 1 ? 'border-b border-gray-200 dark:border-gray-600' : ''
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">Round {index + 1}:</span>
                <span className={`text-sm ${
                  yourPayoff > theirPayoff ? 'text-green-600 dark:text-green-400' : 
                  yourPayoff < theirPayoff ? 'text-red-600 dark:text-red-400' : 
                  'text-blue-600 dark:text-blue-400'
                }`}>
                  You got {yourPayoff}, they got {theirPayoff}
                </span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                You {yourChoice === 'cooperate' ? 'cooperated' : 'defected'}, 
                they {theirChoice === 'cooperate' ? 'cooperated' : 'defected'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  ) : (
    <div className={`transition-opacity duration-1000 ease-in-out mb-6 ${showHistory ? 'opacity-100' : 'opacity-0'}`}>
      <p className="text-gray-500 italic">No round history available</p>
    </div>
  );

  return (
    <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg text-center mb-6 dark:text-white">
      <h2 className="text-2xl font-bold mb-4">Game Over!</h2>
      
      {tieRoundCount && tieRoundCount > 0 ? (
        <p className="text-lg text-blue-600 dark:text-blue-400 mb-4">
          Winner decided after {tieRoundCount} sudden-death {tieRoundCount === 1 ? 'round' : 'rounds'}!
        </p>
      ) : null}
      
      {/* Animated score reveal */}
      <div 
        className={`transition-opacity duration-1000 ease-in-out mb-6 ${showScores ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="flex justify-around mb-4">
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">
              {playerId === 1 ? "You" : "They"}
            </h3>
            <p className="text-3xl font-bold">{scores.p1}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">points</p>
          </div>
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">
              {playerId === 2 ? "You" : "They"}
            </h3>
            <p className="text-3xl font-bold">{scores.p2}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">points</p>
          </div>
        </div>
        
        <div className="mb-6">
          {winner ? (
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {winner === "You" ? "You win!" : "They win!"}
            </p>
          ) : (
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">It&apos;s a tie!</p>
          )}
        </div>
      </div>
      
      {/* Render the history section */}
      {historySection}
      
      <div className="flex justify-center gap-4">
        <button
          onClick={onPlayAgain}
          className="px-6 py-3 bg-green-500 text-white rounded-md hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 transition-colors font-medium"
        >
          Play Again
        </button>
        
        <Link
          href="/"
          className="px-6 py-3 bg-gray-500 text-white rounded-md hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 transition-colors font-medium"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
};

// Tie-break banner component
const TieBreakBanner = ({ roundCount }: { roundCount: number }) => {
  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 p-4 rounded-lg mb-6 text-center">
      <h2 className="text-xl font-bold text-amber-800 dark:text-amber-400 mb-2">Tie-Break Mode</h2>
      <p className="text-amber-700 dark:text-amber-300">
        Scores are tied after {MAX_ROUNDS} rounds! 
        Playing sudden-death round {roundCount}.
      </p>
    </div>
  );
};

// Waiting for players component
const WaitingForPlayers = ({ playerCount, yourPlayerId, waitingQueueLength, roomCode }: { playerCount: number, yourPlayerId?: number, waitingQueueLength?: number, roomCode?: string }) => {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-6 rounded-lg text-center mb-6">
      <h2 className="text-xl font-bold text-blue-800 dark:text-blue-300 mb-4">Waiting for Players</h2>
      <p className="text-blue-700 dark:text-blue-300 mb-3">
        {playerCount === 1 
          ? "Waiting for another player to join..." 
          : "Game is ready! Both players connected."}
      </p>
      
      {yourPlayerId && (
        <div className="bg-blue-100 dark:bg-blue-800/50 p-3 rounded mb-4">
          <p className="font-medium text-blue-700 dark:text-blue-300">
            You are Player {yourPlayerId}
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            {yourPlayerId === 1 
              ? "You're the first player (Player 1)" 
              : "You're the second player (Player 2)"}
          </p>
        </div>
      )}
      
      <div className="mb-4">
        <div className="flex justify-center gap-2 my-2">
          <div className={`w-4 h-4 rounded-full ${playerCount >= 1 ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
          <div className={`w-4 h-4 rounded-full ${playerCount >= 2 ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
        </div>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          {playerCount}/2 players connected
        </p>
        
        {waitingQueueLength && waitingQueueLength > 0 && (
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
            {waitingQueueLength} {waitingQueueLength === 1 ? 'person' : 'people'} waiting to play
          </p>
        )}
        
        {!yourPlayerId && (
          <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded mt-3">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              You&apos;re in the waiting queue. When a player slot opens, you&apos;ll be assigned automatically.
            </p>
          </div>
        )}
      </div>
      
      {roomCode && playerCount < 2 && (
        <div className="text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded mt-3 text-gray-700 dark:text-gray-300">
          <p>To invite a friend to play:</p>
          <div className="mt-2 flex flex-col items-center">
            <div className="font-mono bg-white dark:bg-gray-900 p-2 rounded border dark:border-gray-700 mb-2">
              {roomCode}
            </div>
            <p className="text-xs">Share this code with them and have them &quot;Join Room&quot; using this code</p>
          </div>
        </div>
      )}
    </div>
  );
};

// PlayerPanel component for each player
const PlayerPanel = ({ 
  player, 
  choice, 
  onChoose, 
  disabled, 
  roundComplete,
  isCurrentPlayer,
  isBot,
  botStrategy
}: { 
  player: string; 
  choice: string | null; 
  onChoose: (choice: "cooperate" | "defect") => void; 
  disabled: boolean;
  roundComplete: boolean;
  isCurrentPlayer: boolean;
  isBot?: boolean;
  botStrategy?: string;
}) => {
  // Using useMemo to improve rendering performance
  const statusMessage = useMemo(() => {
    if (choice === "pending") {
      return <span className="text-blue-500 dark:text-blue-400">Opponent has chosen...</span>;
    } else if (choice) {
      return "Waiting for round to complete...";
    } else {
      return "Waiting for other player's choice...";
    }
  }, [choice]);

  return (
    <div className={`border dark:border-gray-700 rounded-lg p-6 shadow-md flex-1 ${
      isCurrentPlayer ? 'bg-blue-50 dark:bg-blue-900/20' : isBot ? 'bg-gray-50 dark:bg-gray-800/50' : 'dark:bg-gray-800'
    }`}>
      <h2 className="text-xl font-bold mb-4 flex items-center dark:text-white">
        {player}
        {isCurrentPlayer && <span className="ml-2 text-sm bg-blue-500 text-white px-2 py-1 rounded-full">You</span>}
        {isBot && <span className="ml-2 text-sm bg-purple-500 text-white px-2 py-1 rounded-full">Bot</span>}
      </h2>
      
      {isBot && botStrategy && (
        <div className="mb-4 p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md">
          <p className="text-sm text-purple-800 dark:text-purple-300 font-medium">
            {botStrategies[botStrategy as keyof typeof botStrategies]?.name || "Bot"}
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-400">
            {botStrategies[botStrategy as keyof typeof botStrategies]?.description || ""}
          </p>
        </div>
      )}
      
      {roundComplete && choice && choice !== "pending" ? (
        <div className="mb-4 py-2 px-4 bg-gray-100 dark:bg-gray-700 rounded-md dark:text-white">
          Choice: <span className="font-semibold">{choice === "cooperate" ? "Cooperate" : "Defect"}</span>
        </div>
      ) : choice === "pending" ? (
        <div className="mb-4 py-2 px-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-md dark:text-white">
          Choice submitted (waiting for server)
        </div>
      ) : choice ? (
        <div className="mb-4 py-2 px-4 bg-gray-100 dark:bg-gray-700 rounded-md dark:text-white">
          Choice made (hidden)
        </div>
      ) : null}
      
      {isCurrentPlayer ? (
        <div className="flex gap-4">
          <ChoiceButton 
            label="Cooperate" 
            onClick={() => onChoose("cooperate")} 
            disabled={disabled || roundComplete || choice === "pending"} 
          />
          <ChoiceButton 
            label="Defect" 
            onClick={() => onChoose("defect")} 
            disabled={disabled || roundComplete || choice === "pending"} 
          />
        </div>
      ) : (
        <div className="text-gray-500 dark:text-gray-400 italic">
          {statusMessage}
        </div>
      )}
    </div>
  );
};

// Room creation/joining UI component
const RoomOptions = ({ 
  onCreateRoom, 
  onJoinRoom,
  inputRoomCode,
  setInputRoomCode,
  roomError
}: { 
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  inputRoomCode: string;
  setInputRoomCode: (code: string) => void;
  roomError: string | null;
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6">
      <h2 className="text-xl font-bold mb-4 text-center dark:text-white">Multiplayer Game</h2>
      
      <div className="flex flex-col gap-4">
        <div>
          <button 
            onClick={onCreateRoom}
            className="w-full py-3 px-4 bg-blue-500 text-white font-medium rounded-md hover:bg-blue-600 transition-colors"
          >
            Create New Room
          </button>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 text-center">
            Create a new room and invite a friend to join
          </p>
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-700 my-2 pt-4">
          <p className="text-center text-gray-600 dark:text-gray-400 mb-2">OR</p>
        </div>
        
        <div>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={inputRoomCode}
              onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-digit code"
              maxLength={6}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={onJoinRoom}
              className="px-4 py-2 bg-green-500 text-white font-medium rounded-md hover:bg-green-600 transition-colors"
            >
              Join Room
            </button>
          </div>
          
          {roomError && (
            <p className="text-sm text-red-500 mt-1">{roomError}</p>
          )}
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 text-center">
            Join an existing room with a 6-digit code
          </p>
        </div>
      </div>
    </div>
  );
};

// Room display component
const RoomInfo = ({ 
  roomCode, 
  playerId 
}: { 
  roomCode: string;
  playerId: number | null;
}) => {
  // Function to copy room code to clipboard
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    alert('Room code copied to clipboard!');
  };
  
  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg mb-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-blue-700 dark:text-blue-300">Room Code:</h3>
        <div 
          className="bg-white dark:bg-gray-800 px-3 py-1 rounded-md font-mono text-lg font-bold border border-blue-200 dark:border-blue-800 flex items-center gap-2 cursor-pointer"
          onClick={copyRoomCode}
          title="Click to copy"
        >
          {roomCode}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
      
      {playerId && (
        <p className="text-sm text-blue-600 dark:text-blue-400">
          You are Player {playerId} {playerId === 1 ? '(first player)' : '(second player)'}
        </p>
      )}
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
        Share this code with a friend so they can join your game
      </p>
    </div>
  );
};

// Define types for socket events
type RoomCreatedEvent = { roomCode: string; playerId: string; gameMode: string; };
type RoomJoinedEvent = { roomCode: string; playerId: string; gameMode: string; };
type GameStateEvent = { 
  round: number; 
  isTieBreak: boolean; 
  isGameOver: boolean;
  playerCount?: { total: number; p1: number; p2: number; };
  scores?: { p1: number; p2: number; };
};
type RoundResultEvent = {
  round: number;
  isTieBreak: boolean;
  isGameOver: boolean;
  result: {
    p1Choice: string;
    p2Choice: string;
    pts1: number;
    pts2: number;
    scores: { p1: number; p2: number; };
  };
};
type GameReadyEvent = { ready: boolean; };
type ErrorEvent = { message: string; };

// Main PrisonersDilemma component
function PrisonersDilemmaGame() {
  // Get the socket from context
  const socket = useContext(SocketContext);
  const [isConnected, setIsConnected] = useState(false);
  
  // Get the mode from query parameters
  const searchParams = useSearchParams();
  const modeParam = searchParams?.get('mode');
  const botStrategyParam = searchParams?.get('strategy');
  
  // Determine if we're in bot mode
  const isBotMode = modeParam === 'bot';
  
  // Determine bot strategy (use a valid strategy from our list)
  // Update to use hyphenated names for better compatibility
  const botStrategy = botStrategyParam && Object.keys(botStrategies).includes(botStrategyParam) 
    ? botStrategyParam 
    : 'tit-for-tat';
  
  // Store game history for bot decisions
  const gameHistory = useRef<{p1: string, p2: string}[]>([]);
  
  // Room management states
  const [roomCode, setRoomCode] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [roomJoined, setRoomJoined] = useState(false);
  const [, setIsCreatingRoom] = useState(false);
  const [, setIsJoiningRoom] = useState(false);
  
  // State for connection
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [waitingQueueLength] = useState(0);
  const [gameReady, setGameReady] = useState(false);
  const [playerId, setPlayerId] = useState<number | null>(null);
  
  // Game state
  const [player1Choice, setPlayer1Choice] = useState<string | null>(null);
  const [player2Choice, setPlayer2Choice] = useState<string | null>(null);
  const [roundCount, setRoundCount] = useState(0);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [roundComplete, setRoundComplete] = useState(false);
  const [isTieBreak, setIsTieBreak] = useState(false);
  const [tieRoundCount, setTieRoundCount] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [roundPayoffs, setRoundPayoffs] = useState<{ pts1: number; pts2: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Connection states
  const [, setHasError] = useState(false);
  const [, setErrorMessage] = useState("");
  
  // Generate a random room code
  const generateRoomCode = () => {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  };
  
  // Handle room creation
  const handleCreateRoom = useCallback(() => {
    if (!socket) return;
    
    setIsCreatingRoom(true);
    
    // Generate a new room code
    const newCode = generateRoomCode();
    setRoomCode(newCode);
    
    console.log(`Creating ${isBotMode ? 'bot' : 'multiplayer'} room with code: ${newCode}`);
    
    // Emit room creation event
    socket.emit('createRoom', { 
      mode: isBotMode ? 'bot' : 'multiplayer',
      botStrategy: isBotMode ? botStrategy : undefined
    });
    
  }, [socket, isBotMode, botStrategy]);
  
  // Handle room joining
  const handleJoinRoom = useCallback(() => {
    if (!socket) return;
    
    if (!inputRoomCode.trim()) {
      setRoomError('Please enter a room code');
      return;
    }
    
    setRoomCode(inputRoomCode.trim().toUpperCase());
    setIsJoiningRoom(true);
    
    console.log(`Joining room with code: ${inputRoomCode.trim().toUpperCase()}`);
    
    // Emit join room event
    socket.emit('joinRoom', { roomCode: inputRoomCode.trim().toUpperCase() });
    
  }, [socket, inputRoomCode]);
  
  // Initialize bot game if in bot mode
  useEffect(() => {
    if (isBotMode) {
      console.log('Initializing bot game');
      setConnected(true);
      setRoomJoined(true);
      setPlayerId(1);
      setPlayerCount(2);
      setGameReady(true);
      setIsConnected(true);
    }
  }, [isBotMode]);
  
  // Setup socket connection and event listeners
  useEffect(() => {
    if (isBotMode) return;
    
    if (!socket) return;
    
    console.log('Attempting socket.connect()...');
    socket.connect();
    
    // Connection events
    const handleConnect = () => {
      console.log('Socket connected:', socket.id);
      setConnected(true);
      setIsConnected(true);
      setHasError(false);
      setErrorMessage("");
      setError(null);
    };
    
    const handleDisconnect = (reason: string) => {
      console.log('Socket disconnected:', reason);
      setConnected(false);
      setIsConnected(false);
      setError(`Connection lost: ${reason}. The socket will try to reconnect automatically.`);
    };
    
    const handleConnectError = (err: Error) => {
      console.error('Connection error:', err);
      setIsConnected(false);
      setHasError(true);
      setErrorMessage(err.message || "Unknown error");
    };
    
    // Game state events
    const handleRoomCreated = (data: RoomCreatedEvent) => {
      console.log('Room created:', data);
      setRoomCode(data.roomCode);
      setRoomJoined(true);
      setPlayerId(data.playerId === 'p1' ? 1 : 2);
    };
    
    const handleRoomJoined = (data: RoomJoinedEvent) => {
      console.log('Room joined:', data);
      setRoomJoined(true);
      setPlayerId(data.playerId === 'p1' ? 1 : 2);
    };
    
    const handleGameState = (data: GameStateEvent) => {
      console.log('Game state received:', data);
      setRoundCount(data.round);
      setIsTieBreak(data.isTieBreak || false);
      setIsGameOver(data.isGameOver || false);
      
      // Update player count and other details
      if (data.playerCount) {
        setPlayerCount(data.playerCount.total);
      }
      
      // Set scores
      if (data.scores) {
        setScores(data.scores);
      }
    };
    
    const handleRoundResult = (data: RoundResultEvent) => {
      console.log('Round result received:', data);
      console.log('Updating UI with round result data');
      
      // Update game state
      setRoundCount(data.round);
      setIsTieBreak(data.isTieBreak);
      
      // Show animation
      setIsAnimating(true);
      
      // Update choices and payoffs
      console.log('Setting player choices:', data.result.p1Choice, data.result.p2Choice);
      setPlayer1Choice(data.result.p1Choice);
      setPlayer2Choice(data.result.p2Choice);
      setRoundPayoffs({
        pts1: data.result.pts1,
        pts2: data.result.pts2
      });
      
      // Record game history for the final reveal
      gameHistory.current.push({
        p1: data.result.p1Choice,
        p2: data.result.p2Choice
      });
      console.log('Updated game history:', gameHistory.current);
      
      // Update scores
      setScores(data.result.scores);
      
      // Check if the game is over
      if (data.isGameOver) {
        setIsGameOver(true);
        
        // In tie-break mode, keep track of tie rounds
        if (data.isTieBreak) {
          setTieRoundCount(prevCount => prevCount + 1);
        }
      }
      
      // Set round as complete
      setRoundComplete(true);
      
      // Trigger animation timeout
      setTimeout(() => {
        setIsAnimating(false);
        
        // If game is not over, reset for next round
        if (!data.isGameOver) {
          // Reset player choices 
          setPlayer1Choice(null);
          setPlayer2Choice(null);
          setRoundPayoffs(null);
          setRoundComplete(false);
        }
      }, 1000);
    };
    
    const handleGameReset = () => {
      console.log('Game reset received');
      // Reset all state
      setRoundCount(0);
      setScores({ p1: 0, p2: 0 });
      setPlayer1Choice(null);
      setPlayer2Choice(null);
      setIsAnimating(false);
      setRoundComplete(false);
      setIsTieBreak(false);
      setTieRoundCount(0);
      setIsGameOver(false);
      setRoundPayoffs(null);
      
      // Reset game history for bot
      gameHistory.current = [];
      console.log('Server game reset, history cleared');
    };
    
    const handleGameReady = (data: GameReadyEvent) => {
      console.log('Game ready state updated:', data);
      setGameReady(data.ready || false);
    };
    
    const handleError = (data: ErrorEvent) => {
      console.error('Server error:', data.message);
      setRoomError(data.message);
      setError(data.message);
    };
    
    // Listen for when a player has made their choice
    const handlePlayerChosen = () => {
      console.log('Opponent has made a choice');
      // Set the opponent's choice as pending based on our playerId - do this immediately
      if (playerId === 1) {
        console.log('Setting player 2 choice to pending');
        setPlayer2Choice('pending');
      } else {
        console.log('Setting player 1 choice to pending');
        setPlayer1Choice('pending');
      }
    };
    
    // Register connection event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    
    socket.on('roomCreated', handleRoomCreated);
    socket.on('roomJoined', handleRoomJoined);
    socket.on('gameState', handleGameState);
    socket.on('roundResult', handleRoundResult);
    socket.on('gameReset', handleGameReset);
    socket.on('gameReady', handleGameReady);
    socket.on('error', handleError);
    socket.on('playerChosen', handlePlayerChosen);
    
    return () => {
      // Remove event listeners
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('roomCreated', handleRoomCreated);
      socket.off('roomJoined', handleRoomJoined);
      socket.off('gameState', handleGameState);
      socket.off('roundResult', handleRoundResult);
      socket.off('gameReset', handleGameReset);
      socket.off('gameReady', handleGameReady);
      socket.off('error', handleError);
      socket.off('playerChosen', handlePlayerChosen);
    };
  }, [socket, isBotMode, playerId]);

  // Initialize game state when component mounts
  useEffect(() => {
    // Create an empty game history array if it doesn't exist
    if (!gameHistory.current) {
      gameHistory.current = [];
      console.log('Initialized empty game history array');
    }
    
    // ... existing initialization code ...
  }, []);

  // Handle player choice
  const handleChoice = useCallback((choice: 'cooperate' | 'defect') => {
    // Handle bot game locally without socket
    if (isBotMode) {
      console.log(`Bot game: Player chose ${choice}`);
      
      // Show player choice as pending
      setPlayer1Choice("pending");
      
      // Simulate network delay
      setTimeout(() => {
        // Get bot's decision based on strategy
        let botChoice: string;
        
        if (gameHistory.current.length === 0) {
          // First move is based on strategy definition
          botChoice = botStrategies[botStrategy as keyof typeof botStrategies].getNextMove([]);
        } else {
          // Use the strategy's getNextMove function to determine bot's move
          botChoice = botStrategies[botStrategy as keyof typeof botStrategies].getNextMove(gameHistory.current);
        }
        
        console.log(`Bot chose: ${botChoice}`);
        
        // Calculate payoffs using enhanced mechanics (before adding to history)
        const { p1Payoff, p2Payoff } = calculateEnhancedPayoffs(choice, botChoice, gameHistory.current);
        
        // Update scores
        setScores(prevScores => ({
          p1: prevScores.p1 + p1Payoff,
          p2: prevScores.p2 + p2Payoff
        }));
        
        // Store round in history for future bot decisions and end-game display
        const historyEntry = {
          p1: choice,
          p2: botChoice
        };
        gameHistory.current.push(historyEntry);
        console.log('Added to game history:', historyEntry, 'History length:', gameHistory.current.length);
        
        // Increment round
        const newRoundCount = roundCount + 1;
        setRoundCount(newRoundCount);
        
        // Check for tie-break or game over
        const newIsTieBreak = newRoundCount === MAX_ROUNDS && scores.p1 + p1Payoff === scores.p2 + p2Payoff;
        setIsTieBreak(newIsTieBreak);
        
        const isGameCompleted = (newRoundCount >= MAX_ROUNDS && scores.p1 + p1Payoff !== scores.p2 + p2Payoff) ||
          (newIsTieBreak && scores.p1 + p1Payoff !== scores.p2 + p2Payoff);
        
        if (isGameCompleted) {
          setIsGameOver(true);
          
          if (newIsTieBreak) {
            setTieRoundCount(prevCount => prevCount + 1);
          }
        }
        
        // Show animation
        setIsAnimating(true);
        
        // Update UI with choices and payoffs
        setPlayer1Choice(choice);
        setPlayer2Choice(botChoice);
        setRoundPayoffs({
          pts1: p1Payoff,
          pts2: p2Payoff
        });
        setRoundComplete(true);
        
        // End animation after delay
        setTimeout(() => {
          setIsAnimating(false);
          
          // Reset for next round if game not over
          if (!isGameCompleted) {
            setPlayer1Choice(null);
            setPlayer2Choice(null);
            setRoundPayoffs(null);
            setRoundComplete(false);
          }
        }, 1000);
      }, 300); // Slight delay to simulate processing
      
      return;
    }
    
    // Normal multiplayer mode using socket
    if (!socket || (!playerId && !isBotMode)) return;
    
    console.log(`Making choice as player ${playerId}: ${choice}`);
    
    // Send choice to server (server identifies player by socket.id)
    socket.emit('choice', { choice });
    
    // Temporarily show choice as pending only for the current player
    if (playerId === 1) {
      console.log("Setting temporary p1Choice:", choice);
      setPlayer1Choice("pending");
      // Important: Do not change player2Choice here as it may already be in 'pending' state
    } else {
      console.log("Setting temporary p2Choice:", choice);
      setPlayer2Choice("pending");
      // Important: Do not change player1Choice here as it may already be in 'pending' state
    }
  }, [socket, playerId, isBotMode, botStrategy, roundCount, scores]);

  // Handle reset game
  const handleResetGame = useCallback(() => {
    if (isBotMode) {
      // Reset game state locally for bot games
      setRoundCount(0);
      setScores({ p1: 0, p2: 0 });
      setPlayer1Choice(null);
      setPlayer2Choice(null);
      setIsAnimating(false);
      setRoundComplete(false);
      setIsTieBreak(false);
      setTieRoundCount(0);
      setIsGameOver(false);
      setRoundPayoffs(null);
      gameHistory.current = [];
      console.log('Game reset, history cleared');
      return;
    }
    
    if (!socket) return;
    
    socket.emit('resetGame');
    
    // Reset game history for bot
    gameHistory.current = [];
    console.log('Game reset, history cleared');
  }, [socket, isBotMode]);

  // Determine current game state for UI rendering (kept for potential future use)
  // const isPlayersTurn = !isGameOver && !isAnimating && 
  //   ((playerId === 1 && player1Choice === null) || (playerId === 2 && player2Choice === null) || 
  //    (isBotMode && player1Choice === null));
  
  // Check if both players are present (always true in bot mode)
  const areBothPlayersConnected = isBotMode || playerCount >= 2 || gameReady;

  // Loading guard
  if (!isConnected && !isBotMode) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 dark:bg-gray-900 dark:text-white text-center">
        <h1 className="text-3xl font-bold mb-6">Prisoner&apos;s Dilemma</h1>
        <p className="mb-4">Initializing connection… please wait</p>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 dark:bg-gray-900 dark:text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Prisoner&apos;s Dilemma</h1>
        <Link 
          href="/" 
          className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Back to Home
        </Link>
      </div>
      
      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6 border dark:border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="font-medium">Status:</span>
            <span className="ml-1">{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
          {playerId && (
            <div>
              <span className="font-medium">You are:</span>
              <span className="text-blue-600 dark:text-blue-400">Player {playerId}</span>
            </div>
          )}
        </div>
      </div>

      {isBotMode && (
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg mb-6 border border-purple-200 dark:border-purple-700">
          <h2 className="text-lg font-bold text-purple-700 dark:text-purple-300">
            Bot Game: {botStrategies[botStrategy as keyof typeof botStrategies]?.name || "Unknown Bot"}
          </h2>
          <p className="text-sm text-purple-600 dark:text-purple-400">
            {botStrategies[botStrategy as keyof typeof botStrategies]?.description || ""}
          </p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg mb-6">
          <div className="font-bold mb-1">Error:</div>
          <div>{error}</div>
        </div>
      )}
      
      {!roomJoined && (
        <RoomOptions 
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          inputRoomCode={inputRoomCode}
          setInputRoomCode={setInputRoomCode}
          roomError={roomError}
        />
      )}
      
      {/* Room Code Display (if in a room, but not in bot mode) */}
      {roomJoined && !isBotMode && (
        <RoomInfo roomCode={roomCode} playerId={playerId} />
      )}
      
      {/* Game Mechanics Info Banner */}
      {roomJoined && areBothPlayersConnected && !isGameOver && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg mb-6">
          <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">Enhanced Game Mechanics</h3>
          <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <li><span className="font-mono text-xs bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">[BONUS]</span> <strong>Cooperation Streak:</strong> Earn +1 bonus point for every 2 consecutive mutual cooperations</li>
            <li><span className="font-mono text-xs bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">[FORGIVENESS]</span> <strong>Forgiveness Bonus:</strong> Get +2 points when you switch from defecting to cooperating</li>
            <li><span className="font-mono text-xs bg-yellow-100 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded">[WARNING]</span> <strong>Reputation Penalty:</strong> Excessive defection (&gt;60%) reduces your defection rewards</li>
            <li><span className="font-mono text-xs bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">[PENALTY]</span> <strong>Mutual Defection Penalty:</strong> After 3+ mutual defections, both players get 0 points</li>
          </ul>
        </div>
      )}
      
      {/* Waiting for players screen - only show in multiplayer mode when connected but not enough players */}
      {roomJoined && !areBothPlayersConnected && !isGameOver && !isBotMode && (
        <WaitingForPlayers 
          playerCount={playerCount} 
          yourPlayerId={playerId !== null ? playerId : undefined}
          waitingQueueLength={waitingQueueLength}
          roomCode={roomCode}
        />
      )}
      
      {/* Game content - shown when both players are connected (or always in bot mode) */}
      {roomJoined && areBothPlayersConnected && (
        <>
          {/* Round counter with live scores */}
          {!isTieBreak ? (
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6 text-center border dark:border-gray-700">
              <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Round</h3>
              <p className="text-2xl font-bold mb-4">{roundCount} / {MAX_ROUNDS}</p>
              
              {/* Live scores display */}
              <div className="flex justify-around items-center mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {isBotMode ? "You" : playerId === 1 ? "You" : "Player 1"}
                  </p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{scores.p1}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">points</p>
                </div>
                <div className="text-2xl font-bold text-gray-400 dark:text-gray-500">vs</div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {isBotMode ? (botStrategies[botStrategy as keyof typeof botStrategies]?.name || "Bot") : playerId === 2 ? "You" : "Player 2"}
                  </p>
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{scores.p2}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">points</p>
                </div>
              </div>
            </div>
          ) : (
            <TieBreakBanner roundCount={tieRoundCount + 1} />
          )}
          
          {/* Game over screen - with animated score reveal */}
          {isGameOver ? (
            <GameOverScreen 
              scores={scores} 
              onPlayAgain={handleResetGame} 
              tieRoundCount={tieRoundCount}
              isBotGame={isBotMode}
              botStrategy={botStrategy}
              playerId={playerId}
              gameHistory={gameHistory.current}
            />
          ) : (
            <>
              {/* Animation spinner */}
              {isAnimating && <Spinner />}
              
              {roundComplete && !isAnimating && roundPayoffs && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
                  <h3 className="font-bold text-center mb-2 dark:text-white">Round Result</h3>
                  <div className="flex justify-around text-center">
                    <div className="dark:text-white">
                      <p>{isBotMode ? "You" : "Player 1"}: {player1Choice === "cooperate" ? "Cooperate" : "Defect"}</p>
                      {roundPayoffs.pts1 > 3 && player1Choice === "cooperate" && player2Choice === "cooperate" && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          <span className="font-mono bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">[BONUS]</span> Cooperation streak bonus!
                        </p>
                      )}
                      {checkForgiveness(gameHistory.current.slice(0, -1), player1Choice || '', 1) && player2Choice === "cooperate" && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          <span className="font-mono bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">[FORGIVENESS]</span> Forgiveness bonus!
                        </p>
                      )}
                    </div>
                    <div className="dark:text-white">
                      <p>{isBotMode ? (botStrategies[botStrategy as keyof typeof botStrategies]?.name || "Bot") : "Player 2"}: {player2Choice === "cooperate" ? "Cooperate" : "Defect"}</p>
                      {roundPayoffs.pts2 > 3 && player1Choice === "cooperate" && player2Choice === "cooperate" && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          <span className="font-mono bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">[BONUS]</span> Cooperation streak bonus!
                        </p>
                      )}
                      {checkForgiveness(gameHistory.current.slice(0, -1), player2Choice || '', 2) && player1Choice === "cooperate" && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          <span className="font-mono bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">[FORGIVENESS]</span> Forgiveness bonus!
                        </p>
                      )}
                    </div>
                  </div>
                  {player1Choice === "defect" && player2Choice === "defect" && gameHistory.current.filter(r => r.p1 === "defect" && r.p2 === "defect").length >= 3 && (
                    <p className="text-xs text-red-600 dark:text-red-400 text-center mt-2">
                      <span className="font-mono bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">[PENALTY]</span> Mutual defection penalty applied
                    </p>
                  )}
                </div>
              )}
              
              <div className="flex gap-6 mb-6">
                <PlayerPanel 
                  player={isBotMode ? "You" : "Player 1"}
                  choice={player1Choice} 
                  onChoose={handleChoice} 
                  disabled={isBotMode ? false : playerId !== 1} 
                  roundComplete={roundComplete && !isAnimating}
                  isCurrentPlayer={isBotMode || playerId === 1}
                />
                
                <PlayerPanel 
                  player={isBotMode ? "Bot" : "Player 2"}
                  choice={player2Choice} 
                  onChoose={handleChoice} 
                  disabled={isBotMode ? true : playerId !== 2} 
                  roundComplete={roundComplete && !isAnimating}
                  isCurrentPlayer={!isBotMode && playerId === 2}
                  isBot={isBotMode}
                  botStrategy={isBotMode ? botStrategy : undefined}
                />
              </div>
            </>
          )}
          
          {/* Only show reset button during game, not at game over */}
          {!isGameOver && !isAnimating && (
            <div className="flex justify-center">
              <button
                onClick={handleResetGame}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-md transition-colors"
              >
                Reset Game
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Export with Suspense boundary for useSearchParams
export default function PrisonersDilemmaGameWrapper() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto py-8 px-4 dark:bg-gray-900 dark:text-white text-center">
        <h1 className="text-3xl font-bold mb-6">Prisoner&apos;s Dilemma</h1>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400 mx-auto"></div>
        <p className="mt-4">Loading game...</p>
      </div>
    }>
      <PrisonersDilemmaGame />
    </Suspense>
  );
} 