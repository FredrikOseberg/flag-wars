import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, GameState, Shield } from '../types';

interface EnhancedCanvasGameProps {
  gameState: GameState;
  currentPlayer: Player | null;
  onPlayerMove: (x: number, y: number, vx?: number, vy?: number) => void;
  nextWaveIn?: number;
  currentRound: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  twinkleSpeed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  color: string;
}

interface PlayerInterpolation {
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
}

export const EnhancedCanvasGame: React.FC<EnhancedCanvasGameProps> = ({
  gameState,
  currentPlayer,
  onPlayerMove,
  nextWaveIn = 10000,
  currentRound
}) => {
  // Store onPlayerMove in a ref to avoid restarting game loop
  const onPlayerMoveRef = useRef(onPlayerMove);
  useEffect(() => {
    onPlayerMoveRef.current = onPlayerMove;
  }, [onPlayerMove]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const [timeRemaining, setTimeRemaining] = useState(nextWaveIn);
  const [keys, setKeys] = useState<Set<string>>(new Set<string>());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth - 100, height: window.innerHeight - 250 });
  const [showStats, setShowStats] = useState(false);
  const [fps, setFps] = useState(60);
  const [shieldFeedback, setShieldFeedback] = useState<{ x: number; y: number; time: number; message: string } | null>(null);
  const [totalShieldsCollected, setTotalShieldsCollected] = useState(0);
  
  const animationFrameRef = useRef<number | undefined>(undefined);
  const playerPosRef = useRef({ x: 400, y: 300 });
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const starsRef = useRef<Star[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const playerInterpolationsRef = useRef<Map<string, PlayerInterpolation>>(new Map());
  const lastFrameTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const gridPulseRef = useRef(0);
  const prevShieldsRef = useRef(currentPlayer?.shields || 0);

  // Update player position when current player is set
  useEffect(() => {
    if (currentPlayer) {
      playerPosRef.current = { x: currentPlayer.x, y: currentPlayer.y };
    }
  }, [currentPlayer]);

  // Shield collection feedback
  useEffect(() => {
    if (currentPlayer) {
      if (currentPlayer.shields > prevShieldsRef.current) {
        setShieldFeedback({
          x: playerPosRef.current.x,
          y: playerPosRef.current.y - 50,
          time: Date.now(),
          message: '+1 Shield!'
        });
        setTotalShieldsCollected(prev => prev + 1);
        
        // Clear feedback after animation
        setTimeout(() => setShieldFeedback(null), 2000);
      }
      prevShieldsRef.current = currentPlayer.shields;
    }
  }, [currentPlayer?.shields]);

  // Update canvas size based on window
  useEffect(() => {
    const updateCanvasSize = () => {
      const padding = isFullscreen ? 0 : 100;
      setCanvasSize({
        width: window.innerWidth - padding,
        height: window.innerHeight - padding - 150 // Account for UI
      });
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [isFullscreen]);

  // Initialize stars for background
  useEffect(() => {
    const starCount = 200;
    const stars: Star[] = [];
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * canvasSize.width,
        y: Math.random() * canvasSize.height,
        size: Math.random() * 2,
        brightness: Math.random(),
        twinkleSpeed: Math.random() * 0.05 + 0.01
      });
    }
    starsRef.current = stars;
  }, [canvasSize]);

  // Spawn particles periodically
  useEffect(() => {
    const spawnParticle = () => {
      if (particlesRef.current.length < 50) {
        particlesRef.current.push({
          x: Math.random() * canvasSize.width,
          y: Math.random() * canvasSize.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: Math.random() * 3 + 1,
          life: 1,
          color: `hsl(${Math.random() * 60 + 240}, 70%, 50%)`
        });
      }
    };

    const interval = setInterval(spawnParticle, 200);
    return () => clearInterval(interval);
  }, [canvasSize]);

  // Calculate FPS
  useEffect(() => {
    const calculateFPS = () => {
      const now = performance.now();
      const delta = now - lastFrameTimeRef.current;
      frameCountRef.current++;
      
      if (delta >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / delta));
        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
      }
    };

    const interval = setInterval(calculateFPS, 100);
    return () => clearInterval(interval);
  }, []);

  // Wave timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 100));
    }, 100);
    return () => clearInterval(timer);
  }, [nextWaveIn]);

  useEffect(() => {
    setTimeRemaining(nextWaveIn);
  }, [nextWaveIn]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('[Keyboard] Key down:', e.key);
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === '`') {
        setShowStats(prev => !prev);
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        e.preventDefault();
        console.log('[Keyboard] Movement key pressed:', e.key);
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

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error('Failed to enter fullscreen:', err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(err => {
        console.error('Failed to exit fullscreen:', err);
      });
      setIsFullscreen(false);
    }
  }, []);

  // Store keys in a ref to avoid effect restarts
  const keysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    keysRef.current = keys;
  }, [keys]);

  // Smooth movement with velocity - single persistent game loop
  useEffect(() => {
    console.log('[EnhancedCanvasGame] Movement effect triggered, alive:', currentPlayer?.isAlive);
    if (!currentPlayer?.isAlive) {
      console.log('[EnhancedCanvasGame] Player not alive, skipping movement');
      return;
    }

    const moveSpeed = 0.5;
    const maxSpeed = 8;
    const friction = 0.85;
    let running = true;
    let loopCount = 0;

    const gameLoop = () => {
      if (!running) return;
      
      // Debug: log every 60 frames (once per second at 60fps)
      if (loopCount % 60 === 0) {
        console.log('[GameLoop] Running, keys pressed:', Array.from(keysRef.current), 'Position:', playerPosRef.current);
      }
      loopCount++;

      // Apply acceleration based on input from ref
      if (keysRef.current.has('ArrowUp') || keysRef.current.has('w')) velocityRef.current.vy -= moveSpeed;
      if (keysRef.current.has('ArrowDown') || keysRef.current.has('s')) velocityRef.current.vy += moveSpeed;
      if (keysRef.current.has('ArrowLeft') || keysRef.current.has('a')) velocityRef.current.vx -= moveSpeed;
      if (keysRef.current.has('ArrowRight') || keysRef.current.has('d')) velocityRef.current.vx += moveSpeed;

      // Apply friction
      velocityRef.current.vx *= friction;
      velocityRef.current.vy *= friction;

      // Limit max speed
      const speed = Math.sqrt(velocityRef.current.vx ** 2 + velocityRef.current.vy ** 2);
      if (speed > maxSpeed) {
        velocityRef.current.vx = (velocityRef.current.vx / speed) * maxSpeed;
        velocityRef.current.vy = (velocityRef.current.vy / speed) * maxSpeed;
      }

      // Update position
      const newX = Math.max(20, Math.min(canvasSize.width - 20, playerPosRef.current.x + velocityRef.current.vx));
      const newY = Math.max(20, Math.min(canvasSize.height - 20, playerPosRef.current.y + velocityRef.current.vy));

      // Only send updates if moved significantly (reduces network traffic)
      const now = Date.now();
      const distanceMoved = Math.sqrt((newX - playerPosRef.current.x) ** 2 + (newY - playerPosRef.current.y) ** 2);
      
      if (distanceMoved > 2 && now - lastUpdateRef.current > 50) {
        playerPosRef.current = { x: newX, y: newY };
        console.log('[Movement] Sending position update:', { x: newX, y: newY, vx: velocityRef.current.vx, vy: velocityRef.current.vy });
        // Use the ref to avoid dependency issues
        if (onPlayerMoveRef.current) {
          onPlayerMoveRef.current(newX, newY, velocityRef.current.vx, velocityRef.current.vy);
        }
        lastUpdateRef.current = now;
      } else if (distanceMoved > 0.1) {
        playerPosRef.current = { x: newX, y: newY };
      }

      // Always continue the loop
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    // Start the persistent game loop
    console.log('[EnhancedCanvasGame] Starting game loop');
    gameLoop();

    return () => {
      console.log('[EnhancedCanvasGame] Cleaning up game loop');
      running = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentPlayer?.isAlive, canvasSize.width, canvasSize.height]); // Minimal dependencies to prevent restarts!

  // Update player interpolations for smooth multiplayer
  useEffect(() => {
    gameState.players.forEach(player => {
      if (!playerInterpolationsRef.current.has(player.id)) {
        playerInterpolationsRef.current.set(player.id, {
          currentX: player.x,
          currentY: player.y,
          targetX: player.x,
          targetY: player.y,
          vx: 0,
          vy: 0
        });
      } else {
        const interp = playerInterpolationsRef.current.get(player.id)!;
        interp.targetX = player.x;
        interp.targetY = player.y;
      }
    });

    // Remove old interpolations
    const playerIds = new Set(gameState.players.map(p => p.id));
    Array.from(playerInterpolationsRef.current.keys()).forEach(id => {
      if (!playerIds.has(id)) {
        playerInterpolationsRef.current.delete(id);
      }
    });
  }, [gameState.players]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const bgCanvas = backgroundCanvasRef.current;
    if (!canvas || !bgCanvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    const bgCtx = bgCanvas.getContext('2d', { alpha: false });
    if (!ctx || !bgCtx) return;

    let animationId: number;

    const renderBackground = () => {
      // Dark space background
      const gradient = bgCtx.createLinearGradient(0, 0, canvasSize.width, canvasSize.height);
      gradient.addColorStop(0, '#0a0a1f');
      gradient.addColorStop(0.5, '#1a1a3e');
      gradient.addColorStop(1, '#0f0f2e');
      bgCtx.fillStyle = gradient;
      bgCtx.fillRect(0, 0, canvasSize.width, canvasSize.height);

      // Render stars with twinkle
      starsRef.current.forEach(star => {
        star.brightness += star.twinkleSpeed;
        const brightness = (Math.sin(star.brightness) + 1) / 2;
        bgCtx.fillStyle = `rgba(255, 255, 255, ${brightness * 0.8})`;
        bgCtx.beginPath();
        bgCtx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        bgCtx.fill();
      });

      // Animated grid
      gridPulseRef.current += 0.01;
      const gridAlpha = (Math.sin(gridPulseRef.current) + 1) / 4 + 0.1;
      bgCtx.strokeStyle = `rgba(100, 50, 200, ${gridAlpha})`;
      bgCtx.lineWidth = 1;
      
      const gridSize = 50;
      for (let x = 0; x < canvasSize.width; x += gridSize) {
        bgCtx.beginPath();
        bgCtx.moveTo(x, 0);
        bgCtx.lineTo(x, canvasSize.height);
        bgCtx.stroke();
      }
      for (let y = 0; y < canvasSize.height; y += gridSize) {
        bgCtx.beginPath();
        bgCtx.moveTo(0, y);
        bgCtx.lineTo(canvasSize.width, y);
        bgCtx.stroke();
      }
    };

    const render = () => {
      // Safety check - ensure canvas still exists
      if (!canvasRef.current || !backgroundCanvasRef.current) return;
      
      // Clear main canvas
      ctx.fillStyle = 'rgba(10, 10, 31, 0.1)';
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

      // Update and render particles
      particlesRef.current = particlesRef.current.filter(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= 0.01;

        if (particle.life > 0) {
          ctx.save();
          ctx.globalAlpha = particle.life;
          ctx.fillStyle = particle.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = particle.color;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          return true;
        }
        return false;
      });

      // Render shields with enhanced effects
      gameState.shields.forEach(shield => {
        ctx.save();
        ctx.translate(shield.x, shield.y);
        
        // Animated glow
        const time = Date.now() / 1000;
        const pulseSize = 30 + Math.sin(time * 3) * 5;
        
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, pulseSize);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
        gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.font = '28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛡️', 0, 0);
        ctx.restore();
      });

      // Interpolate and render players
      playerInterpolationsRef.current.forEach((interp, playerId) => {
        const player = gameState.players.find(p => p.id === playerId);
        if (!player) return;

        // For current player, use local position (immediate feedback)
        // For other players, use interpolated server positions
        let renderX, renderY;
        if (player.id === currentPlayer?.id) {
          // Use local position for immediate feedback
          renderX = playerPosRef.current.x;
          renderY = playerPosRef.current.y;
        } else {
          // Smooth interpolation for other players
          const lerpSpeed = 0.15;
          interp.currentX += (interp.targetX - interp.currentX) * lerpSpeed;
          interp.currentY += (interp.targetY - interp.currentY) * lerpSpeed;
          renderX = interp.currentX;
          renderY = interp.currentY;
        }

        if (!player.isAlive) {
          renderDeadPlayer(ctx, player, renderX, renderY);
        } else {
          renderPlayer(ctx, player, renderX, renderY, player.id === currentPlayer?.id);
        }
      });

      // Render shield collection feedback
      if (shieldFeedback) {
        const elapsed = Date.now() - shieldFeedback.time;
        const alpha = Math.max(0, 1 - elapsed / 2000);
        const yOffset = -elapsed * 0.05;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(shieldFeedback.x, shieldFeedback.y + yOffset);
        
        // Glow effect
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#3B82F6';
        
        // Background for text
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.fillRect(-60, -20, 120, 40);
        
        // Text
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.strokeText(shieldFeedback.message, 0, 0);
        ctx.fillText(shieldFeedback.message, 0, 0);
        
        // Shield icon
        ctx.font = '28px Arial';
        ctx.fillText('🛡️', 0, -30);
        
        ctx.restore();
      }

      animationId = requestAnimationFrame(render);
    };

    const renderPlayer = (ctx: CanvasRenderingContext2D, player: Player, x: number, y: number, isCurrentPlayer: boolean) => {
      ctx.save();
      ctx.translate(x, y);

      // Enhanced glow for current player
      if (isCurrentPlayer) {
        const time = Date.now() / 1000;
        const glowSize = 35 + Math.sin(time * 2) * 5;
        
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
        gradient.addColorStop(0, `${player.color}99`);
        gradient.addColorStop(0.5, `${player.color}44`);
        gradient.addColorStop(1, `${player.color}00`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Player circle with gradient
      const playerGradient = ctx.createRadialGradient(-5, -5, 0, 0, 0, 20);
      playerGradient.addColorStop(0, player.color);
      playerGradient.addColorStop(1, player.color + '88');
      ctx.fillStyle = playerGradient;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();

      // Border
      ctx.strokeStyle = isCurrentPlayer ? '#fff' : player.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Flag
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚩', 0, 0);

      // Name with background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(-40, -40, 80, 20);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(player.name, 0, -30);

      // Shield indicators
      if (player.shields > 0) {
        ctx.font = '12px Arial';
        let shieldText = '';
        for (let i = 0; i < player.shields; i++) {
          shieldText += '🛡️';
        }
        ctx.fillText(shieldText, 0, 30);
      }

      ctx.restore();
    };

    const renderDeadPlayer = (ctx: CanvasRenderingContext2D, player: Player, x: number, y: number) => {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.translate(x, y);

      ctx.strokeStyle = player.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#666';
      ctx.fillText('💀', 0, 0);

      ctx.fillStyle = '#999';
      ctx.font = '10px Arial';
      ctx.fillText(player.name, 0, -30);
      ctx.fillText('ARCHIVED', 0, 30);

      ctx.restore();
    };

    // Initial background render
    renderBackground();
    
    // Start render loop
    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [gameState, currentPlayer, canvasSize]);

  const alivePlayers = gameState.players.filter(p => p.isAlive);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* HUD Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="flex justify-between items-start">
          <div className="flag-card bg-black/70 backdrop-blur">
            <h2 className="text-2xl font-bold text-white">Round {currentRound}</h2>
            <p className="text-gray-300">Flags Active: {alivePlayers.length}</p>
            {showStats && (
              <p className="text-xs text-green-400">FPS: {fps}</p>
            )}
          </div>
          
          <div className="text-center flag-card bg-black/70 backdrop-blur">
            <div className="text-3xl font-bold text-purple-400">
              {(timeRemaining / 1000).toFixed(1)}s
            </div>
            <p className="text-sm text-gray-400">Next Archiving Wave</p>
          </div>

          {currentPlayer && (
            <div className="text-right flag-card bg-black/70 backdrop-blur">
              <p className="text-lg font-semibold text-white">{currentPlayer.name}</p>
              <div className="flex items-center justify-end gap-1 mt-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                      i < currentPlayer.shields ? 'bg-blue-500' : 'bg-gray-700'
                    }`}
                  >
                    {i < currentPlayer.shields ? '🛡️' : ''}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {currentPlayer.isAlive ? '🟢 Active' : '🔴 Archived'}
              </p>
              {totalShieldsCollected > 0 && (
                <p className="text-xs text-blue-400 mt-1">
                  Collected: {totalShieldsCollected} 🛡️
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Canvas Container - isolates from React DOM manipulation */}
      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        <canvas
          ref={backgroundCanvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="absolute inset-0"
          style={{ zIndex: 1 }}
        />
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="absolute inset-0"
          style={{ zIndex: 2 }}
        />
      </div>

      {/* Death Overlay */}
      {currentPlayer && !currentPlayer.isAlive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
          <div className="text-center animate-slide-in">
            <p className="text-5xl font-bold text-red-500 mb-4">YOU'VE BEEN ARCHIVED!</p>
            <p className="text-2xl text-gray-300">Spectating remaining players...</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="flag-card bg-black/70 backdrop-blur text-xs space-y-1">
          <p className="text-gray-300"><strong>Move:</strong> WASD / Arrow Keys</p>
          <p className="text-gray-300"><strong>Fullscreen:</strong> F</p>
          <p className="text-gray-300"><strong>Stats:</strong> ` (backtick)</p>
        </div>
      </div>

      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        className="absolute bottom-4 right-4 z-10 btn-secondary bg-black/70"
      >
        {isFullscreen ? '🗗 Exit Fullscreen' : '⛶ Fullscreen'}
      </button>
    </div>
  );
};