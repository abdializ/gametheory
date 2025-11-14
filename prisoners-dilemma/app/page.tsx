"use client";

import { useState } from "react";
import Link from "next/link";

export default function Home() {
  const [mode, setMode] = useState('multiplayer'); // 'multiplayer' or 'bot'
  const [bot, setBot] = useState('tit-for-tat');     // Updated to match backend naming

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <div className="text-center sm:text-left w-full">
          <h1 className="text-4xl font-bold mb-4">Prisoner&apos;s Dilemma</h1>
          <p className="text-xl mb-6">Game Theory Simulation</p>
          
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-bold text-blue-800 dark:text-blue-300 mb-4">Game Mode</h2>
            
            <div className="game-mode-selector mb-6">
              <div className="flex flex-col gap-3 md:flex-row md:gap-6">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="multiplayer"
                    checked={mode === 'multiplayer'}
                    onChange={() => setMode('multiplayer')}
                    className="mr-2"
                  />
                  <span className="text-blue-700 dark:text-blue-300">Multiplayer</span>
                </label>
                
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="bot"
                    checked={mode === 'bot'}
                    onChange={() => setMode('bot')}
                    className="mr-2"
                  />
                  <span className="text-blue-700 dark:text-blue-300">Singleplayer vs Bot</span>
                </label>
              </div>
            </div>
            
            {mode === 'bot' && (
              <div className="bot-selector mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">Choose Bot Strategy:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="bot"
                      value="always-cooperate"
                      checked={bot === 'always-cooperate'}
                      onChange={() => setBot('always-cooperate')}
                      className="mr-2"
                    />
                    <span className="dark:text-gray-300">Always Cooperate (Nice)</span>
                  </label>
                  
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="bot"
                      value="always-defect"
                      checked={bot === 'always-defect'}
                      onChange={() => setBot('always-defect')}
                      className="mr-2"
                    />
                    <span className="dark:text-gray-300">Always Defect (Mean)</span>
                  </label>
                  
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="bot"
                      value="tit-for-tat"
                      checked={bot === 'tit-for-tat'}
                      onChange={() => setBot('tit-for-tat')}
                      className="mr-2"
                    />
                    <span className="dark:text-gray-300">Tit-for-Tat</span>
                  </label>
                  
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="bot"
                      value="random"
                      checked={bot === 'random'}
                      onChange={() => setBot('random')}
                      className="mr-2"
                    />
                    <span className="dark:text-gray-300">Random</span>
                  </label>
                  
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="bot"
                      value="grudger"
                      checked={bot === 'grudger'}
                      onChange={() => setBot('grudger')}
                      className="mr-2"
                    />
                    <span className="dark:text-gray-300">Grudger</span>
                  </label>
                  
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="bot"
                      value="pavlov"
                      checked={bot === 'pavlov'}
                      onChange={() => setBot('pavlov')}
                      className="mr-2"
                    />
                    <span className="dark:text-gray-300">Pavlov</span>
                  </label>
                </div>
              </div>
            )}
            
            {mode === 'multiplayer' && (
              <div className="network-instructions mb-6 text-blue-700 dark:text-blue-300">
                <h3 className="font-semibold mb-2">Play Over Local Network:</h3>
                <ol className="list-decimal list-inside">
                  <li className="mb-1">On your PC, run: <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">HOST=0.0.0.0 npm run dev</code></li>
                  <li className="mb-1">Find your PC&apos;s IP address</li>
                  <li className="mb-1">On your phone or other device, navigate to: <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">http://&lt;YOUR-PC-IP&gt;:3000</code></li>
                  <li className="mb-1">On the first device, click &quot;Create New Room&quot; and you&apos;ll receive a room code</li>
                  <li className="mb-1">On the second device, click &quot;Join Room&quot; and enter the room code</li>
                  <li>Both devices must be on the same network for the connection to work properly</li>
                </ol>
                <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                  The game uses Socket.IO for real-time communication between players.
                </p>
              </div>
            )}
            
            <Link 
              href={mode === 'multiplayer' ? "/prisoners-dilemma" : `/prisoners-dilemma?mode=bot&strategy=${bot}`}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white font-bold py-3 px-6 rounded-lg inline-block transition-colors"
            >
              {mode === 'multiplayer' ? "Play Multiplayer" : "Play Against Bot"}
            </Link>
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-lg w-full">
          <h2 className="text-xl font-bold mb-4 dark:text-white">About Prisoner&apos;s Dilemma</h2>
          <p className="mb-4 dark:text-gray-300">
            The Prisoner&apos;s Dilemma is a classic game theory scenario where two players must choose to either cooperate or defect:
          </p>
          <ul className="list-disc list-inside mb-4 dark:text-gray-300">
            <li>If both cooperate, each gets 3 points</li>
            <li>If one cooperates and one defects, the defector gets 5 points and the cooperator gets 0</li>
            <li>If both defect, each gets 1 point</li>
          </ul>
          <p className="dark:text-gray-300">
            This game demonstrates the tension between individual and collective rationality in decision-making.
          </p>
        </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Built with Next.js and Socket.IO
        </p>
      </footer>
    </div>
  );
}
