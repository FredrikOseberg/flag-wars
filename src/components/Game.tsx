import React, { useState, useEffect } from 'react';
import { Player, GameState } from '../types';

interface GameProps {
  gameState: GameState;
  currentPlayer: Player | null;
  onCollectShield: () => void;
  nextWaveIn?: number;
  currentRound: number;
}

export const Game: React.FC<GameProps> = ({
  gameState,
  currentPlayer,
  onCollectShield,
  nextWaveIn = 10000,
  currentRound
}) => {
  const [timeRemaining, setTimeRemaining] = useState(nextWaveIn);
  const [shieldPositions, setShieldPositions] = useState<{ x: number; y: number }[]>([]);
  const [showArchivingEffect, setShowArchivingEffect] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 100));
    }, 100);

    return () => clearInterval(timer);
  }, [nextWaveIn]);

  useEffect(() => {
    setTimeRemaining(nextWaveIn);
  }, [nextWaveIn]);

  useEffect(() => {
    const spawnShield = () => {
      const newShield = {
        x: Math.random() * 80 + 10,
        y: Math.random() * 60 + 20
      };
      setShieldPositions((prev) => [...prev, newShield]);
      
      setTimeout(() => {
        setShieldPositions((prev) => prev.filter((s) => s !== newShield));
      }, 5000);
    };

    const interval = setInterval(spawnShield, 8000);
    spawnShield();

    return () => clearInterval(interval);
  }, []);

  const handleShieldClick = (index: number) => {
    if (currentPlayer?.isAlive) {
      onCollectShield();
      setShieldPositions((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const alivePlayers = gameState.players.filter((p) => p.isAlive);
  const eliminatedPlayers = gameState.players.filter((p) => !p.isAlive);

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold">Round {currentRound}</h2>
            <p className="text-gray-300">Flags Remaining: {alivePlayers.length}</p>
          </div>
          
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-400">
              {(timeRemaining / 1000).toFixed(1)}s
            </div>
            <p className="text-sm text-gray-400">Next Archiving Wave</p>
          </div>

          {currentPlayer && (
            <div className="text-right">
              <p className="text-lg font-semibold">{currentPlayer.name}</p>
              <div className="flex items-center justify-end gap-1 mt-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-full ${
                      i < currentPlayer.shields
                        ? 'bg-blue-500'
                        : 'bg-gray-700'
                    }`}
                  >
                    🛡️
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-400">
                {currentPlayer.isAlive ? 'Active' : 'Archived'}
              </p>
            </div>
          )}
        </div>

        <div className="relative bg-white/5 rounded-xl p-8 min-h-[500px]">
          {shieldPositions.map((pos, index) => (
            <button
              key={index}
              onClick={() => handleShieldClick(index)}
              className="absolute w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-2xl hover:scale-110 transition-transform animate-pulse-slow"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              🛡️
            </button>
          ))}

          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {alivePlayers.map((player) => (
              <div
                key={player.id}
                className={`flag-card ${
                  player.id === currentPlayer?.id
                    ? 'ring-2 ring-purple-400'
                    : ''
                } ${!player.isAlive ? 'archiving' : ''}`}
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">🚩</div>
                  <p className="font-semibold truncate">{player.name}</p>
                  <div className="flex justify-center gap-1 mt-2">
                    {Array.from({ length: player.shields }).map((_, i) => (
                      <span key={i} className="text-xs">🛡️</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {eliminatedPlayers.length > 0 && (
            <div className="mt-8 pt-8 border-t border-white/20">
              <h3 className="text-xl font-semibold mb-4 text-gray-400">
                Archived Flags
              </h3>
              <div className="flex flex-wrap gap-2">
                {eliminatedPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="px-3 py-1 bg-gray-800/50 rounded-lg text-sm text-gray-500 line-through"
                  >
                    {player.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {showArchivingEffect && (
          <div className="fixed inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-red-500/20 animate-pulse"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-6xl font-bold text-red-500 animate-bounce">
                ARCHIVING WAVE!
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};