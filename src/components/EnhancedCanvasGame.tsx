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
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });
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
      setCanvasSize({
        width: window.innerWidth,
        height: window.innerHeight
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

      // Update position with some padding from edges
      const padding = 30;
      const newX = Math.max(padding, Math.min(canvasSize.width - padding, playerPosRef.current.x + velocityRef.current.vx));
      const newY = Math.max(padding + 80, Math.min(canvasSize.height - padding - 60, playerPosRef.current.y + velocityRef.current.vy));

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
      // Modern gradient background with depth
      const gradient = bgCtx.createRadialGradient(
        canvasSize.width / 2, canvasSize.height / 2, 0,
        canvasSize.width / 2, canvasSize.height / 2, Math.max(canvasSize.width, canvasSize.height)
      );
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(0.4, '#16213e');
      gradient.addColorStop(0.7, '#0f3460');
      gradient.addColorStop(1, '#533483');
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

      // Modern animated grid with perspective
      gridPulseRef.current += 0.005;
      const pulse = Math.sin(gridPulseRef.current) * 0.5 + 0.5;
      
      // Draw perspective grid
      const gridSize = 60;
      const centerX = canvasSize.width / 2;
      const centerY = canvasSize.height / 2;
      
      // Horizontal lines with gradient opacity
      for (let y = 0; y < canvasSize.height; y += gridSize) {
        const distance = Math.abs(y - centerY) / centerY;
        const alpha = (1 - distance * 0.7) * 0.15 * (0.5 + pulse * 0.5);
        
        const gradient = bgCtx.createLinearGradient(0, y, canvasSize.width, y);
        gradient.addColorStop(0, `rgba(147, 51, 234, ${alpha * 0.3})`);
        gradient.addColorStop(0.5, `rgba(147, 51, 234, ${alpha})`);
        gradient.addColorStop(1, `rgba(147, 51, 234, ${alpha * 0.3})`);
        
        bgCtx.strokeStyle = gradient;
        bgCtx.lineWidth = 1;
        bgCtx.beginPath();
        bgCtx.moveTo(0, y);
        bgCtx.lineTo(canvasSize.width, y);
        bgCtx.stroke();
      }
      
      // Vertical lines with gradient opacity
      for (let x = 0; x < canvasSize.width; x += gridSize) {
        const distance = Math.abs(x - centerX) / centerX;
        const alpha = (1 - distance * 0.7) * 0.15 * (0.5 + pulse * 0.5);
        
        const gradient = bgCtx.createLinearGradient(x, 0, x, canvasSize.height);
        gradient.addColorStop(0, `rgba(147, 51, 234, ${alpha * 0.3})`);
        gradient.addColorStop(0.5, `rgba(147, 51, 234, ${alpha})`);
        gradient.addColorStop(1, `rgba(147, 51, 234, ${alpha * 0.3})`);
        
        bgCtx.strokeStyle = gradient;
        bgCtx.lineWidth = 1;
        bgCtx.beginPath();
        bgCtx.moveTo(x, 0);
        bgCtx.lineTo(x, canvasSize.height);
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

      // Render shields with modern effects
      gameState.shields.forEach(shield => {
        ctx.save();
        ctx.translate(shield.x, shield.y);
        
        const time = Date.now() / 1000;
        const pulseSize = 35 + Math.sin(time * 3) * 8;
        const rotation = time * 0.5;
        
        // Rotating outer ring
        ctx.save();
        ctx.rotate(rotation);
        const ringGradient = ctx.createRadialGradient(0, 0, pulseSize - 10, 0, 0, pulseSize);
        ringGradient.addColorStop(0, 'rgba(59, 130, 246, 0)');
        ringGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.4)');
        ringGradient.addColorStop(1, 'rgba(147, 51, 234, 0.2)');
        ctx.strokeStyle = ringGradient;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, pulseSize - 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        
        // Inner glow
        const innerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 25);
        innerGradient.addColorStop(0, 'rgba(59, 130, 246, 0.9)');
        innerGradient.addColorStop(0.4, 'rgba(59, 130, 246, 0.5)');
        innerGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = innerGradient;
        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI * 2);
        ctx.fill();
        
        // Shield icon with shadow
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(59, 130, 246, 0.8)';
        ctx.font = '30px Arial';
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

      // Enhanced multi-layer glow effect
      const time = Date.now() / 1000;
      
      if (isCurrentPlayer) {
        // Outer glow
        const outerGlow = 45 + Math.sin(time * 1.5) * 8;
        const outerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, outerGlow);
        outerGradient.addColorStop(0, `${player.color}00`);
        outerGradient.addColorStop(0.3, `${player.color}22`);
        outerGradient.addColorStop(0.7, `${player.color}44`);
        outerGradient.addColorStop(1, `${player.color}00`);
        ctx.fillStyle = outerGradient;
        ctx.beginPath();
        ctx.arc(0, 0, outerGlow, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Inner glow for all players
      const innerGlow = 28;
      const innerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, innerGlow);
      innerGradient.addColorStop(0, `${player.color}66`);
      innerGradient.addColorStop(0.5, `${player.color}33`);
      innerGradient.addColorStop(1, `${player.color}00`);
      ctx.fillStyle = innerGradient;
      ctx.beginPath();
      ctx.arc(0, 0, innerGlow, 0, Math.PI * 2);
      ctx.fill();

      // Main player body with metallic gradient
      const bodyGradient = ctx.createRadialGradient(-8, -8, 0, 0, 0, 22);
      bodyGradient.addColorStop(0, player.color);
      bodyGradient.addColorStop(0.5, player.color);
      bodyGradient.addColorStop(0.8, player.color + 'CC');
      bodyGradient.addColorStop(1, player.color + '88');
      
      ctx.fillStyle = bodyGradient;
      ctx.shadowBlur = 15;
      ctx.shadowColor = player.color;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      
      // Glass effect overlay
      ctx.shadowBlur = 0;
      const glassGradient = ctx.createLinearGradient(0, -20, 0, 20);
      glassGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      glassGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
      glassGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glassGradient;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();

      // Border with gradient
      const borderGradient = ctx.createLinearGradient(-20, -20, 20, 20);
      borderGradient.addColorStop(0, isCurrentPlayer ? '#fff' : player.color);
      borderGradient.addColorStop(0.5, isCurrentPlayer ? '#f0f0f0' : player.color + 'DD');
      borderGradient.addColorStop(1, isCurrentPlayer ? '#fff' : player.color);
      ctx.strokeStyle = borderGradient;
      ctx.lineWidth = isCurrentPlayer ? 3 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.stroke();

      // Flag with shadow
      ctx.shadowBlur = 5;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚩', 0, 0);
      ctx.shadowBlur = 0;

      // Modern name tag
      const nameWidth = ctx.measureText(player.name).width + 20;
      const nameGradient = ctx.createLinearGradient(-nameWidth/2, -45, nameWidth/2, -25);
      nameGradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
      nameGradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
      
      ctx.fillStyle = nameGradient;
      ctx.beginPath();
      ctx.roundRect(-nameWidth/2, -45, nameWidth, 20, 10);
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(player.name, 0, -35);

      // Shield indicators with glow
      if (player.shields > 0) {
        for (let i = 0; i < player.shields; i++) {
          ctx.save();
          ctx.translate((i - 1) * 18, 35);
          
          // Shield glow
          const shieldGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
          shieldGlow.addColorStop(0, 'rgba(59, 130, 246, 0.6)');
          shieldGlow.addColorStop(1, 'rgba(59, 130, 246, 0)');
          ctx.fillStyle = shieldGlow;
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🛡️', 0, 0);
          ctx.restore();
        }
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
    <div className="fixed inset-0 overflow-hidden">
      {/* HUD Overlay with modern glassmorphism */}
      <div className="absolute top-0 left-0 right-0 z-10 p-6">
        <div className="flex justify-between items-start gap-4">
          {/* Round Info */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-2xl">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Round {currentRound}
            </h2>
            <p className="text-white/80 text-sm mt-1">Flags Active: {alivePlayers.length}</p>
            {showStats && (
              <p className="text-xs text-green-400 mt-2">FPS: {fps}</p>
            )}
          </div>
          
          {/* Timer */}
          <div className="text-center bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-2xl">
            <div className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-red-500 bg-clip-text text-transparent">
              {(timeRemaining / 1000).toFixed(1)}s
            </div>
            <p className="text-sm text-white/60 mt-1">Next Archive Wave</p>
          </div>

          {/* Player Info */}
          {currentPlayer && (
            <div className="text-right bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-2xl min-w-[180px]">
              <p className="text-lg font-bold text-white">{currentPlayer.name}</p>
              <div className="flex items-center justify-end gap-2 mt-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all transform ${
                      i < currentPlayer.shields 
                        ? 'bg-gradient-to-br from-blue-400 to-blue-600 scale-110 shadow-lg' 
                        : 'bg-white/5 border border-white/10 scale-100'
                    }`}
                  >
                    {i < currentPlayer.shields ? (
                      <span className="text-base">🛡️</span>
                    ) : (
                      <span className="text-white/20 text-xs">○</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                  currentPlayer.isAlive 
                    ? 'bg-green-500/20 text-green-400 border border-green-400/30' 
                    : 'bg-red-500/20 text-red-400 border border-red-400/30'
                }`}>
                  {currentPlayer.isAlive ? '● Active' : '● Archived'}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-white/40">Shields: {currentPlayer.shields}/3</p>
                {totalShieldsCollected > 0 && (
                  <p className="text-xs text-blue-300">
                    Total collected: {totalShieldsCollected}
                  </p>
                )}
              </div>
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

      {/* Controls - Modern floating card */}
      <div className="absolute bottom-6 left-6 z-10">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 shadow-xl">
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2 text-white/70">
              <span className="text-purple-400">→</span>
              <span><strong>Move:</strong> WASD / Arrow Keys</span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <span className="text-purple-400">→</span>
              <span><strong>Fullscreen:</strong> F</span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <span className="text-purple-400">→</span>
              <span><strong>Stats:</strong> ` (backtick)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Button - Modern gradient */}
      <button
        onClick={toggleFullscreen}
        className="absolute bottom-6 right-6 z-10 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg transform transition-all hover:scale-105"
      >
        {isFullscreen ? '◱ Exit' : '⛶ Fullscreen'}
      </button>
    </div>
  );
};