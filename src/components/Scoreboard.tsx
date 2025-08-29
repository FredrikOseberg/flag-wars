import React from 'react';
import { ScoreboardEntry } from '../types';

interface ScoreboardProps {
  scoreboard: ScoreboardEntry[];
  onPlayAgain: () => void;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ scoreboard, onPlayAgain }) => {
  const winner = scoreboard.find((entry) => entry.isWinner);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4">Game Over!</h1>
          {winner && (
            <div className="mb-6">
              <p className="text-2xl text-gray-300 mb-2">Winner:</p>
              <div className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                🏆 {winner.name}
              </div>
              <p className="text-lg text-gray-400 mt-2">
                Survived {winner.roundsSurvived} rounds • {(winner.survivalTime / 1000).toFixed(1)}s
              </p>
            </div>
          )}
        </div>

        <div className="flag-card">
          <h2 className="text-2xl font-bold mb-4">Final Rankings</h2>
          <div className="space-y-2">
            {scoreboard.map((entry) => (
              <div
                key={entry.rank}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  entry.isWinner
                    ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/40'
                    : 'bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-gray-400">
                    {entry.rank === 1 && '🥇'}
                    {entry.rank === 2 && '🥈'}
                    {entry.rank === 3 && '🥉'}
                    {entry.rank > 3 && `#${entry.rank}`}
                  </div>
                  <div>
                    <p className="font-semibold">{entry.name}</p>
                    <p className="text-sm text-gray-400">
                      Round {entry.roundsSurvived} • {(entry.survivalTime / 1000).toFixed(1)}s
                    </p>
                  </div>
                </div>
                {entry.isWinner && (
                  <span className="text-2xl">👑</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-8">
          <button onClick={onPlayAgain} className="btn-primary">
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
};