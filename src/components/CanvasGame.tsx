import React, { useEffect, useRef, useState } from 'react';
import { Player, GameState, Shield } from '../types';

interface CanvasGameProps {
  gameState: GameState;
  currentPlayer: Player | null;
  onPlayerMove: (x: number, y: number) => void;
  nextWaveIn?: number;
  currentRound: number;
}

export const CanvasGame: React.FC<CanvasGameProps> = ({
  gameState,
  currentPlayer,
  onPlayerMove,
  nextWaveIn = 10000,
  currentRound
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timeRemaining, setTimeRemaining] = useState(nextWaveIn);
  const [keys, setKeys] = useState<Set<string>>(new Set<string>());
  const animationFrameRef = useRef<number | undefined>(undefined);
  const playerPosRef = useRef({ x: currentPlayer?.x || 400, y: currentPlayer?.y || 300 });

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        e.preventDefault();
        setKeys(prev => {
          const newKeys = new Set(prev);
          newKeys.add(e.key);
          return newKeys;
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => {
        const newKeys = new Set(prev);
        newKeys.delete(e.key);
        return newKeys;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!currentPlayer?.isAlive) return;

    const moveSpeed = 5;
    let lastMoveTime = Date.now();

    const gameLoop = () => {
      const now = Date.now();
      if (now - lastMoveTime > 50) { // Throttle movement updates
        let dx = 0;
        let dy = 0;

        if (keys.has('ArrowUp') || keys.has('w')) dy -= moveSpeed;
        if (keys.has('ArrowDown') || keys.has('s')) dy += moveSpeed;
        if (keys.has('ArrowLeft') || keys.has('a')) dx -= moveSpeed;
        if (keys.has('ArrowRight') || keys.has('d')) dx += moveSpeed;

        if (dx !== 0 || dy !== 0) {
          const newX = Math.max(20, Math.min(780, playerPosRef.current.x + dx));
          const newY = Math.max(20, Math.min(480, playerPosRef.current.y + dy));
          
          if (newX !== playerPosRef.current.x || newY !== playerPosRef.current.y) {
            playerPosRef.current = { x: newX, y: newY };
            onPlayerMove(newX, newY);
            lastMoveTime = now;
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    if (keys.size > 0) {
      gameLoop();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [keys, currentPlayer, onPlayerMove]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // Clear canvas
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, 800, 500);

      // Draw grid pattern
      ctx.strokeStyle = '#16213e';
      ctx.lineWidth = 1;
      for (let i = 0; i < 800; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 500);
        ctx.stroke();
      }
      for (let i = 0; i < 500; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(800, i);
        ctx.stroke();
      }

      // Draw shields
      gameState.shields.forEach(shield => {
        ctx.save();
        ctx.translate(shield.x, shield.y);
        
        // Shield glow effect
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 25);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI * 2);
        ctx.fill();
        
        // Shield icon
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛡️', 0, 0);
        ctx.restore();
      });

      // Draw players
      gameState.players.forEach(player => {
        if (!player.isAlive) return;

        ctx.save();
        ctx.translate(player.x, player.y);

        // Player glow
        if (player.id === currentPlayer?.id) {
          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
          gradient.addColorStop(0, `${player.color}66`);
          gradient.addColorStop(1, `${player.color}00`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(0, 0, 30, 0, Math.PI * 2);
          ctx.fill();
        }

        // Player circle
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();

        // Flag emoji
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚩', 0, 0);

        // Player name
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(player.name, 0, -25);

        // Shield indicators
        if (player.shields > 0) {
          ctx.font = '10px Arial';
          let shieldText = '';
          for (let i = 0; i < player.shields; i++) {
            shieldText += '🛡️';
          }
          ctx.fillText(shieldText, 0, 25);
        }

        ctx.restore();
      });

      // Draw dead players with fade effect
      gameState.players.forEach(player => {
        if (player.isAlive) return;

        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.translate(player.x, player.y);

        ctx.strokeStyle = player.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#666';
        ctx.fillText('💀', 0, 0);

        ctx.fillStyle = '#999';
        ctx.font = '10px Arial';
        ctx.fillText(player.name, 0, -25);
        ctx.fillText('ARCHIVED', 0, 25);

        ctx.restore();
      });

      requestAnimationFrame(draw);
    };

    draw();
  }, [gameState, currentPlayer]);

  const alivePlayers = gameState.players.filter(p => p.isAlive);

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-3xl font-bold">Round {currentRound}</h2>
            <p className="text-gray-300">Flags Active: {alivePlayers.length}</p>
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
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      i < currentPlayer.shields
                        ? 'bg-blue-500'
                        : 'bg-gray-700'
                    }`}
                  >
                    {i < currentPlayer.shields ? '🛡️' : ''}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-400">
                {currentPlayer.isAlive ? 'Active' : 'Archived'}
              </p>
            </div>
          )}
        </div>

        <div className="relative">
          <canvas
            ref={canvasRef}
            width={800}
            height={500}
            className="border-2 border-purple-500 rounded-lg shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}
          />
          
          {!currentPlayer?.isAlive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
              <div className="text-center">
                <p className="text-3xl font-bold text-red-500 mb-2">YOU'VE BEEN ARCHIVED!</p>
                <p className="text-xl text-gray-300">Watch the remaining players battle it out</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flag-card">
          <p className="text-sm text-gray-300 mb-2">
            <strong>Controls:</strong> Use WASD or Arrow Keys to move
          </p>
          <p className="text-sm text-gray-300">
            <strong>Objective:</strong> Collect shields 🛡️ to protect yourself from archiving waves!
          </p>
        </div>
      </div>
    </div>
  );
};