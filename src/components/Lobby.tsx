import React, { useState } from 'react';
import { Player, GameState } from '../types';

interface LobbyProps {
  gameState: GameState;
  currentPlayer: Player | null;
  onJoinGame: (name: string) => void;
  onStartGame: () => void;
  onResetGame: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  gameState,
  currentPlayer,
  onJoinGame,
  onStartGame,
  onResetGame
}) => {
  const [playerName, setPlayerName] = useState('');
  
  // Use currentPlayer to determine if joined, not local state
  const hasJoined = !!currentPlayer;

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      onJoinGame(playerName.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            🚩 Flag Wars
          </h1>
          <p className="text-xl text-gray-300">
            Survive the archiving waves and be the last feature flag standing!
          </p>
        </div>

        {!hasJoined ? (
          <div className="flag-card max-w-md mx-auto">
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Your Flag Name
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="e.g., dark_mode_v2"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-purple-400"
                  maxLength={20}
                />
              </div>
              <button type="submit" className="btn-primary w-full">
                Join Game
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flag-card">
              <h2 className="text-2xl font-bold mb-4">Players in Lobby</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {gameState.players.map((player) => (
                  <div
                    key={player.id}
                    className={`p-3 rounded-lg bg-white/10 ${
                      player.id === currentPlayer?.id ? 'ring-2 ring-purple-400' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{player.name}</span>
                      {player.isHost && (
                        <span className="text-xs bg-purple-500 px-2 py-1 rounded">
                          HOST
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {currentPlayer?.isHost && (
              <div className="flag-card text-center">
                <h3 className="text-xl mb-4">Host Controls</h3>
                <div className="space-y-3">
                  <button
                    onClick={onStartGame}
                    disabled={gameState.players.length < 2}
                    className={`btn-primary w-full ${
                      gameState.players.length < 2 ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {gameState.players.length < 2
                      ? 'Need at least 2 players'
                      : 'Start Game'}
                  </button>
                  <button onClick={onResetGame} className="btn-secondary w-full">
                    Reset Lobby
                  </button>
                </div>
              </div>
            )}

            {!currentPlayer?.isHost && (
              <div className="flag-card text-center">
                <p className="text-lg">
                  Waiting for host to start the game...
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Players: {gameState.players.length}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-400">
          <p>Tip: Collect shields to protect yourself from archiving waves!</p>
        </div>
      </div>
    </div>
  );
};