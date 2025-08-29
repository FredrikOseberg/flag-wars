import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Lobby } from './components/Lobby';
import { EnhancedCanvasGame } from './components/EnhancedCanvasGame';
import { Scoreboard } from './components/Scoreboard';
import { Player, GameState, ScoreboardEntry, Shield } from './types';

const App: React.FC = () => {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    gameStatus: 'waiting',
    currentRound: 0,
    startTime: null,
    shields: []
  });
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
  const [nextWaveIn, setNextWaveIn] = useState(10000);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // Single useEffect to create socket connection ONCE
  useEffect(() => {
    // Only create socket if we don't have one
    if (socketRef.current) {
      return;
    }

    // Determine socket URL based on environment
    // In development (localhost:8080), connect to separate dev server
    // In production (any other case), connect to same origin
    const isLocalDev = window.location.hostname === 'localhost' && window.location.port === '8080';
    const socketUrl = isLocalDev
      ? 'http://localhost:3001' // Development server on different port
      : ''; // Production - use same origin (works with any port)
    
    console.log('Creating ONE socket connection to:', socketUrl || `same origin (${window.location.host})`);
    
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true
    });
    
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[Socket] Connected to server, socket id:', newSocket.id);
      setConnectionStatus('connected');
      // Re-emit current state if we have a player
      if (currentPlayer) {
        console.log('[Socket] Re-joining with existing player');
        newSocket.emit('join-game', currentPlayer.name);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnectionStatus('disconnected');
    });

    newSocket.on('player-joined', ({ player, isHost }) => {
      console.log('[Socket] Player joined:', player);
      setCurrentPlayer(player);
    });

    // Handle batch updates for better performance
    newSocket.on('batch-update', (updates: any[]) => {
      setGameState(prev => {
        const newState = { ...prev };
        let hasChanges = false;
        updates.forEach(update => {
          const playerIndex = newState.players.findIndex(p => p.id === update.id);
          if (playerIndex !== -1) {
            // Only update if there are actual changes
            const player = newState.players[playerIndex];
            if (player.x !== update.x || player.y !== update.y || 
                player.shields !== update.shields || player.isAlive !== update.isAlive) {
              hasChanges = true;
              newState.players[playerIndex] = {
                ...player,
                ...update
              };
            }
          }
        });
        return hasChanges ? newState : prev;
      });
    });

    newSocket.on('initial-state', (state: any) => {
      setGameState({
        players: state.players,
        gameStatus: state.gameStatus,
        currentRound: state.currentRound,
        startTime: state.startTime,
        shields: state.shields
      });
    });

    newSocket.on('game-state-update', (state: GameState) => {
      setGameState(state);
    });

    newSocket.on('game-started', (state: any) => {
      setGameState(prev => ({
        ...prev,
        gameStatus: state.gameStatus || 'playing',
        startTime: state.startTime,
        players: state.players || prev.players
      }));
      setScoreboard([]);
    });

    newSocket.on('archiving-wave', ({ round, archivedPlayers, nextWaveIn }) => {
      setNextWaveIn(nextWaveIn);
      if (archivedPlayers && archivedPlayers.length > 0) {
        // Update local state for archived players
        setGameState(prev => {
          const newState = { ...prev };
          archivedPlayers.forEach((playerId: string) => {
            const playerIndex = newState.players.findIndex(p => p.id === playerId);
            if (playerIndex !== -1) {
              newState.players[playerIndex].isAlive = false;
            }
          });
          return newState;
        });
      }
    });

    newSocket.on('player-archived', ({ round }) => {
      console.log(`You were archived in round ${round}!`);
      if (currentPlayer) {
        setCurrentPlayer({ ...currentPlayer, isAlive: false });
      }
    });

    newSocket.on('shield-collected', (shields: number) => {
      if (currentPlayer) {
        setCurrentPlayer({ ...currentPlayer, shields });
      }
    });

    newSocket.on('shield-spawned', (shield: Shield) => {
      setGameState(prev => ({
        ...prev,
        shields: [...prev.shields, shield]
      }));
    });

    newSocket.on('shield-removed', (shieldId: string) => {
      setGameState(prev => ({
        ...prev,
        shields: prev.shields.filter(s => s.id !== shieldId)
      }));
    });

    newSocket.on('player-added', (player: Player) => {
      setGameState(prev => ({
        ...prev,
        players: [...prev.players, player]
      }));
    });

    newSocket.on('player-removed', (playerId: string) => {
      setGameState(prev => ({
        ...prev,
        players: prev.players.filter(p => p.id !== playerId)
      }));
    });

    newSocket.on('shield-used', (shields: number) => {
      if (currentPlayer) {
        setCurrentPlayer({ ...currentPlayer, shields });
      }
    });

    newSocket.on('game-ended', ({ scoreboard: finalScoreboard }) => {
      setGameState((prev) => ({ ...prev, gameStatus: 'finished' }));
      setScoreboard(finalScoreboard);
    });

    newSocket.on('game-reset', (state: GameState) => {
      setGameState(state);
      setScoreboard([]);
      if (currentPlayer) {
        setCurrentPlayer({ ...currentPlayer, isAlive: true, shields: 0 });
      }
    });

    newSocket.on('new-host', (newHost: Player) => {
      if (currentPlayer && currentPlayer.id === newHost.id) {
        setCurrentPlayer({ ...currentPlayer, isHost: true });
      }
    });

    newSocket.on('player-left', ({ playerId, playerName }) => {
      console.log(`${playerName} left the game`);
    });

    return () => {
      // Keep socket alive between component unmounts
      console.log('Component unmounting, keeping socket alive');
    };
  }, []); // Empty array - only connect once!

  const handleJoinGame = (name: string) => {
    if (socket) {
      socket.emit('join-game', name);
    }
  };

  const handleStartGame = () => {
    if (socket && currentPlayer?.isHost) {
      socket.emit('start-game');
    }
  };

  const handleResetGame = () => {
    if (socket && currentPlayer?.isHost) {
      socket.emit('reset-game');
    }
  };

  const handlePlayerMove = useCallback((x: number, y: number, vx?: number, vy?: number) => {
    console.log('[App] handlePlayerMove called:', { x, y, vx, vy, hasSocket: !!socket, isAlive: currentPlayer?.isAlive });
    if (socketRef.current && currentPlayer?.isAlive) {
      console.log('[App] Emitting player-move to server');
      socketRef.current.emit('player-move', { x, y, vx, vy });
    } else {
      console.log('[App] Cannot move - socket:', !!socketRef.current, 'alive:', currentPlayer?.isAlive);
    }
  }, [currentPlayer?.isAlive]);

  const handlePlayAgain = () => {
    if (socket && currentPlayer) {
      // Request server to restart the game, keeping players connected
      socket.emit('request-restart');
      setScoreboard([]);
      // Don't reset player or game state - let server handle it
    }
  };

  if (connectionStatus === 'disconnected') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Connection Lost</h2>
          <p className="text-gray-400">Please refresh the page to reconnect</p>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'connecting' && !socket) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🚩</div>
          <h2 className="text-2xl font-bold">Connecting to server...</h2>
        </div>
      </div>
    );
  }

  // Keep all components mounted to prevent DOM issues
  console.log('[App] Rendering game, status:', gameState.gameStatus, 'player:', currentPlayer?.name, 'socket:', !!socket);
  
  // Debug: Show what's happening
  if (!socket) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">No socket connection</h2>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Lobby - show when waiting */}
      <div style={{ display: gameState.gameStatus === 'waiting' ? 'block' : 'none' }}>
        <Lobby
          gameState={gameState}
          currentPlayer={currentPlayer}
          onJoinGame={handleJoinGame}
          onStartGame={handleStartGame}
          onResetGame={handleResetGame}
        />
      </div>

      {/* Game - show when playing */}
      <div style={{ display: gameState.gameStatus === 'playing' ? 'block' : 'none' }}>
        {gameState.gameStatus === 'playing' && (
          <EnhancedCanvasGame
            gameState={gameState}
            currentPlayer={currentPlayer}
            onPlayerMove={handlePlayerMove}
            nextWaveIn={nextWaveIn}
            currentRound={gameState.currentRound}
          />
        )}
      </div>

      {/* Scoreboard - show when finished */}
      <div style={{ display: gameState.gameStatus === 'finished' ? 'block' : 'none' }}>
        {scoreboard.length > 0 ? (
          <Scoreboard scoreboard={scoreboard} onPlayAgain={handlePlayAgain} />
        ) : (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center text-white">
              <h2 className="text-2xl font-bold mb-4">Game Finished</h2>
              <p className="text-gray-400">Waiting for results...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;