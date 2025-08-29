import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'],
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isAlive: boolean;
  shields: number;
  survivalTime: number;
  eliminatedAt?: number;
  x: number;
  y: number;
  color: string;
}

interface Shield {
  id: string;
  x: number;
  y: number;
}

interface GameState {
  players: Map<string, Player>;
  gameStatus: 'waiting' | 'playing' | 'finished';
  startTime: number | null;
  currentRound: number;
  archivingInterval: number;
  winner: Player | null;
  eliminationOrder: Player[];
  shields: Shield[];
}

const gameState: GameState = {
  players: new Map(),
  gameStatus: 'waiting',
  startTime: null,
  currentRound: 0,
  archivingInterval: 10000,
  winner: null,
  eliminationOrder: [],
  shields: []
};

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7DC6F', '#BB8FCE', '#85C88A', '#FFB6C1', '#FF9F43'];

let archivingTimer: NodeJS.Timeout | null = null;

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('join-game', (playerName: string) => {
    const isHost = gameState.players.size === 0;
    const player: Player = {
      id: socket.id,
      name: playerName || `flag_${Math.random().toString(36).substr(2, 5)}`,
      isHost,
      isAlive: true,
      shields: 0,
      survivalTime: 0,
      x: Math.random() * 700 + 50,
      y: Math.random() * 400 + 50,
      color: COLORS[gameState.players.size % COLORS.length]
    };

    gameState.players.set(socket.id, player);
    socket.emit('player-joined', { player, isHost });
    io.emit('game-state-update', getPublicGameState());
    
    console.log(`Player ${player.name} joined (Host: ${isHost})`);
  });

  socket.on('start-game', () => {
    const player = gameState.players.get(socket.id);
    if (!player?.isHost || gameState.gameStatus === 'playing') return;

    gameState.gameStatus = 'playing';
    gameState.startTime = Date.now();
    gameState.currentRound = 0;
    gameState.winner = null;
    gameState.eliminationOrder = [];
    
    gameState.players.forEach(p => {
      p.isAlive = true;
      p.shields = 1;
      p.survivalTime = 0;
      p.eliminatedAt = undefined;
    });

    io.emit('game-started', getPublicGameState());
    startArchivingWaves();
    
    console.log('Game started!');
  });

  socket.on('player-move', ({ x, y }: { x: number; y: number }) => {
    const player = gameState.players.get(socket.id);
    if (player && player.isAlive && gameState.gameStatus === 'playing') {
      player.x = x;
      player.y = y;
      
      // Check shield collision
      const collectedShield = gameState.shields.findIndex(shield => {
        const distance = Math.sqrt(Math.pow(shield.x - x, 2) + Math.pow(shield.y - y, 2));
        return distance < 30;
      });
      
      if (collectedShield !== -1) {
        player.shields = Math.min(player.shields + 1, 3);
        gameState.shields.splice(collectedShield, 1);
        socket.emit('shield-collected', player.shields);
      }
      
      io.emit('game-state-update', getPublicGameState());
    }
  });

  socket.on('reset-game', () => {
    const player = gameState.players.get(socket.id);
    if (!player?.isHost) return;

    resetGame();
    io.emit('game-reset', getPublicGameState());
  });

  socket.on('request-restart', () => {
    // Any player can request restart after game ends
    if (gameState.gameStatus !== 'finished') return;
    
    // Reset game state but keep players connected
    gameState.gameStatus = 'waiting';
    gameState.startTime = null;
    gameState.currentRound = 0;
    gameState.winner = null;
    gameState.eliminationOrder = [];
    gameState.shields = [];
    
    // Reset player states but keep them in the game
    gameState.players.forEach(player => {
      player.isAlive = true;
      player.shields = 0;
      player.survivalTime = 0;
      player.eliminatedAt = undefined;
    });
    
    io.emit('game-reset', getPublicGameState());
    console.log('Game restarted by player request');
  });

  socket.on('disconnect', () => {
    const player = gameState.players.get(socket.id);
    if (player) {
      gameState.players.delete(socket.id);
      
      if (player.isHost && gameState.players.size > 0) {
        const newHost = gameState.players.values().next().value;
        if (newHost) {
          newHost.isHost = true;
          io.emit('new-host', newHost);
        }
      }
      
      io.emit('player-left', { playerId: socket.id, playerName: player.name });
      io.emit('game-state-update', getPublicGameState());
      
      if (gameState.players.size === 0) {
        resetGame();
      }
    }
    
    console.log('Player disconnected:', socket.id);
  });
});

function spawnShield() {
  if (gameState.gameStatus !== 'playing') return;
  
  // Scale shield spawns based on active player count
  const alivePlayers = Array.from(gameState.players.values()).filter(p => p.isAlive).length;
  const maxShields = Math.min(3 + Math.floor(alivePlayers / 2), 12); // 3 base + 1 per 2 players, max 12
  
  if (gameState.shields.length < maxShields) {
    const shield: Shield = {
      id: Math.random().toString(36).substr(2, 9),
      x: Math.random() * 700 + 50,
      y: Math.random() * 400 + 50
    };
    gameState.shields.push(shield);
    io.emit('shield-spawned', shield);
    console.log(`Shield spawned. Total: ${gameState.shields.length}/${maxShields} (${alivePlayers} players alive)`);
  }
}

let shieldSpawnInterval: NodeJS.Timeout | null = null;

function startArchivingWaves() {
  // Dynamic shield spawning based on player count
  const adjustShieldSpawnRate = () => {
    if (shieldSpawnInterval) {
      clearInterval(shieldSpawnInterval);
    }
    
    const alivePlayers = Array.from(gameState.players.values()).filter(p => p.isAlive).length;
    const spawnRate = Math.max(3000, 6000 - (alivePlayers * 200)); // Faster spawns with more players
    
    shieldSpawnInterval = setInterval(() => {
      spawnShield();
      adjustShieldSpawnRate(); // Re-adjust rate after each spawn
    }, spawnRate);
    
    console.log(`Shield spawn rate adjusted: ${spawnRate}ms for ${alivePlayers} players`);
  };
  
  // Spawn initial shields based on player count
  const initialPlayers = Array.from(gameState.players.values()).filter(p => p.isAlive).length;
  for (let i = 0; i < Math.min(initialPlayers, 3); i++) {
    spawnShield();
  }
  
  adjustShieldSpawnRate();
  
  const runArchivingWave = () => {
    if (gameState.gameStatus !== 'playing') return;

    gameState.currentRound++;
    const alivePlayers = Array.from(gameState.players.values()).filter(p => p.isAlive);
    
    if (alivePlayers.length <= 1) {
      endGame();
      return;
    }

    const archivingSpeed = Math.max(10000 - (gameState.currentRound * 1000), 3000);
    const playersToArchive = Math.ceil(alivePlayers.length * 0.3);
    const targetPlayers = alivePlayers
      .filter(p => p.shields === 0)
      .sort(() => Math.random() - 0.5)
      .slice(0, playersToArchive);

    if (targetPlayers.length === 0 && alivePlayers.length > 1) {
      const randomTarget = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      targetPlayers.push(randomTarget);
    }

    targetPlayers.forEach(player => {
      if (player.shields > 0) {
        player.shields--;
        io.to(player.id).emit('shield-used', player.shields);
      } else {
        player.isAlive = false;
        player.survivalTime = Date.now() - (gameState.startTime || 0);
        player.eliminatedAt = gameState.currentRound;
        gameState.eliminationOrder.push(player);
        io.to(player.id).emit('player-archived', { round: gameState.currentRound });
      }
    });

    io.emit('archiving-wave', {
      round: gameState.currentRound,
      archivedPlayers: targetPlayers.filter(p => !p.isAlive).map(p => p.name),
      nextWaveIn: archivingSpeed
    });

    io.emit('game-state-update', getPublicGameState());

    const remainingAlive = Array.from(gameState.players.values()).filter(p => p.isAlive);
    if (remainingAlive.length <= 1) {
      endGame();
    } else {
      archivingTimer = setTimeout(runArchivingWave, archivingSpeed);
    }
  };

  archivingTimer = setTimeout(runArchivingWave, gameState.archivingInterval);
}

function endGame() {
  if (archivingTimer) {
    clearTimeout(archivingTimer);
    archivingTimer = null;
  }
  
  if (shieldSpawnInterval) {
    clearInterval(shieldSpawnInterval);
    shieldSpawnInterval = null;
  }

  gameState.gameStatus = 'finished';
  const alivePlayers = Array.from(gameState.players.values()).filter(p => p.isAlive);
  
  if (alivePlayers.length === 1) {
    gameState.winner = alivePlayers[0];
    gameState.winner.survivalTime = Date.now() - (gameState.startTime || 0);
  }

  const finalState = getPublicGameState();
  io.emit('game-ended', {
    ...finalState,
    scoreboard: generateScoreboard()
  });
  
  console.log('Game ended! Winner:', gameState.winner?.name || 'No winner');
}

function resetGame() {
  if (archivingTimer) {
    clearTimeout(archivingTimer);
    archivingTimer = null;
  }
  
  if (shieldSpawnInterval) {
    clearInterval(shieldSpawnInterval);
    shieldSpawnInterval = null;
  }

  gameState.gameStatus = 'waiting';
  gameState.startTime = null;
  gameState.currentRound = 0;
  gameState.winner = null;
  gameState.eliminationOrder = [];
  gameState.shields = [];
  
  gameState.players.forEach(player => {
    player.isAlive = true;
    player.shields = 0;
    player.survivalTime = 0;
    player.eliminatedAt = undefined;
  });
}

function getPublicGameState() {
  return {
    players: Array.from(gameState.players.values()),
    gameStatus: gameState.gameStatus,
    currentRound: gameState.currentRound,
    startTime: gameState.startTime,
    shields: gameState.shields
  };
}

function generateScoreboard() {
  const allPlayers = [
    ...gameState.eliminationOrder,
    ...Array.from(gameState.players.values()).filter(p => p.isAlive)
  ].reverse();

  return allPlayers.map((player, index) => ({
    rank: index + 1,
    name: player.name,
    survivalTime: player.survivalTime,
    roundsSurvived: player.eliminatedAt || gameState.currentRound,
    isWinner: player.id === gameState.winner?.id
  }));
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Feature Flag Survival Game running on port ${PORT}`);
});