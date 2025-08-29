import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Lobby } from './components/Lobby';
import { EnhancedCanvasGame } from './components/EnhancedCanvasGame';
import { Scoreboard } from './components/Scoreboard';
import { Player, GameState, ScoreboardEntry, Shield } from './types';

const App: React.FC = () => {
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

  useEffect(() => {
    // Use relative URL for production, absolute for development
    const socketUrl = process.env.NODE_ENV === 'production' 
      ? '' // Empty string means same origin
      : 'http://localhost:3001';
    
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnectionStatus('connected');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnectionStatus('disconnected');
    });

    newSocket.on('player-joined', ({ player, isHost }) => {
      setCurrentPlayer(player);
    });

    // Handle batch updates for better performance
    newSocket.on('batch-update', (updates: any[]) => {
      setGameState(prev => {
        const newState = { ...prev };
        updates.forEach(update => {
          const playerIndex = newState.players.findIndex(p => p.id === update.id);
          if (playerIndex !== -1) {
            newState.players[playerIndex] = {
              ...newState.players[playerIndex],
              ...update
            };
          }
        });
        return newState;
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
      newSocket.disconnect();
    };
  }, []);

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

  const handlePlayerMove = (x: number, y: number, vx?: number, vy?: number) => {
    if (socket && currentPlayer?.isAlive) {
      socket.emit('player-move', { x, y, vx, vy });
    }
  };

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

  if (connectionStatus === 'connecting') {
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
  return (
    <div className="min-h-screen">
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
      <div style={{ display: gameState.gameStatus === 'finished' && scoreboard.length > 0 ? 'block' : 'none' }}>
        {scoreboard.length > 0 && (
          <Scoreboard scoreboard={scoreboard} onPlayAgain={handlePlayAgain} />
        )}
      </div>
    </div>
  );
};

export default App;