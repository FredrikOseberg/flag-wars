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
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000', 'http://localhost:8080'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling'],
  allowEIO3: true // Allow older Socket.IO clients
});

// Configure CORS for production
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));
app.use(express.json());
// In production, static files are in ../public relative to dist folder
const publicPath = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, '..', 'public')
  : path.join(__dirname, 'public');
app.use(express.static(publicPath));

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
  lastUpdate: number;
  velocityX?: number;
  velocityY?: number;
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

interface PlayerUpdate {
  id: string;
  x: number;
  y: number;
  shields?: number;
  isAlive?: boolean;
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
const UPDATE_RATE = 50; // ms between updates
const POSITION_THRESHOLD = 5; // minimum distance for position update
const VIEWPORT_SIZE = 1200; // viewport radius for proximity updates

let archivingTimer: NodeJS.Timeout | null = null;
let shieldSpawnInterval: NodeJS.Timeout | null = null;
let updateBatch: Map<string, PlayerUpdate> = new Map();
let lastBatchUpdate = Date.now();

// Batch updates for better performance
const batchUpdater = setInterval(() => {
  if (updateBatch.size > 0 && Date.now() - lastBatchUpdate >= UPDATE_RATE) {
    const updates = Array.from(updateBatch.values());
    console.log(`[Server] Sending batch update with ${updates.length} player updates`);
    io.emit('batch-update', updates);
    updateBatch.clear();
    lastBatchUpdate = Date.now();
  }
}, UPDATE_RATE / 2);

io.on('connection', (socket) => {
  const clientAddress = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  console.log(`Player connected: ${socket.id} from ${clientAddress}`);

  socket.on('join-game', (playerName: string) => {
    console.log(`[Server] Player joining: ${playerName} (socket: ${socket.id})`);
    const isHost = gameState.players.size === 0;
    const player: Player = {
      id: socket.id,
      name: playerName || `flag_${Math.random().toString(36).substr(2, 5)}`,
      isHost,
      isAlive: true,
      shields: 0,
      survivalTime: 0,
      x: Math.random() * 1400 + 100,
      y: Math.random() * 700 + 100,
      color: COLORS[gameState.players.size % COLORS.length],
      lastUpdate: Date.now()
    };

    gameState.players.set(socket.id, player);
    socket.emit('player-joined', { player, isHost });
    
    // Send initial state
    socket.emit('initial-state', {
      players: Array.from(gameState.players.values()),
      shields: gameState.shields,
      gameStatus: gameState.gameStatus,
      currentRound: gameState.currentRound
    });
    
    // Notify others of new player
    socket.broadcast.emit('player-added', player);
    
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
    
    // Reset all players
    gameState.players.forEach(p => {
      p.isAlive = true;
      p.shields = 1;
      p.survivalTime = 0;
      p.eliminatedAt = undefined;
    });

    io.emit('game-started', {
      gameStatus: 'playing',
      startTime: gameState.startTime,
      players: Array.from(gameState.players.values())
    });
    
    startArchivingWaves();
    console.log('Game started!');
  });

  socket.on('player-move', ({ x, y, vx, vy }: { x: number; y: number; vx?: number; vy?: number }) => {
    console.log(`[Server] player-move received from ${socket.id}:`, { x, y, vx, vy });
    const player = gameState.players.get(socket.id);
    if (!player || !player.isAlive || gameState.gameStatus !== 'playing') {
      console.log(`[Server] Move rejected - player: ${!!player}, alive: ${player?.isAlive}, status: ${gameState.gameStatus}`);
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - player.lastUpdate;
    
    // Only update if moved significantly or enough time has passed
    const distance = Math.sqrt(Math.pow(player.x - x, 2) + Math.pow(player.y - y, 2));
    
    if (distance > POSITION_THRESHOLD || timeSinceLastUpdate > 100) {
      player.x = x;
      player.y = y;
      player.velocityX = vx;
      player.velocityY = vy;
      player.lastUpdate = now;
      
      // Check shield collision with optimized distance calculation
      for (let i = gameState.shields.length - 1; i >= 0; i--) {
        const shield = gameState.shields[i];
        const dx = shield.x - x;
        const dy = shield.y - y;
        if (dx * dx + dy * dy < 900) { // 30^2 = 900
          player.shields = Math.min(player.shields + 1, 3);
          gameState.shields.splice(i, 1);
          socket.emit('shield-collected', player.shields);
          io.emit('shield-removed', shield.id);
          break;
        }
      }
      
      // Add to batch update
      updateBatch.set(socket.id, {
        id: socket.id,
        x: player.x,
        y: player.y,
        shields: player.shields,
        isAlive: player.isAlive
      });
    }
  });

  socket.on('reset-game', () => {
    const player = gameState.players.get(socket.id);
    if (!player?.isHost) return;

    resetGame();
    io.emit('game-reset', getOptimizedGameState());
  });

  socket.on('disconnect', () => {
    const player = gameState.players.get(socket.id);
    if (player) {
      gameState.players.delete(socket.id);
      
      // Transfer host if needed
      if (player.isHost && gameState.players.size > 0) {
        const newHost = gameState.players.values().next().value;
        if (newHost) {
          newHost.isHost = true;
          io.emit('new-host', newHost);
        }
      }
      
      io.emit('player-removed', socket.id);
      
      if (gameState.players.size === 0) {
        resetGame();
      }
    }
    
    console.log('Player disconnected:', socket.id);
  });
});

function spawnShield() {
  if (gameState.gameStatus === 'playing' && gameState.shields.length < 8) {
    const shield: Shield = {
      id: Math.random().toString(36).substr(2, 9),
      x: Math.random() * 1400 + 100,
      y: Math.random() * 700 + 100
    };
    gameState.shields.push(shield);
    io.emit('shield-spawned', shield);
  }
}

function startArchivingWaves() {
  // Spawn shields periodically
  shieldSpawnInterval = setInterval(spawnShield, 4000);
  spawnShield();
  spawnShield(); // Start with 2 shields
  
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

    // Archive at least one player if all have shields
    if (targetPlayers.length === 0 && alivePlayers.length > 1) {
      const randomTarget = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      targetPlayers.push(randomTarget);
    }

    const archivedIds: string[] = [];
    targetPlayers.forEach(player => {
      if (player.shields > 0) {
        player.shields--;
        updateBatch.set(player.id, {
          id: player.id,
          x: player.x,
          y: player.y,
          shields: player.shields
        });
      } else {
        player.isAlive = false;
        player.survivalTime = Date.now() - (gameState.startTime || 0);
        player.eliminatedAt = gameState.currentRound;
        gameState.eliminationOrder.push(player);
        archivedIds.push(player.id);
        
        updateBatch.set(player.id, {
          id: player.id,
          x: player.x,
          y: player.y,
          isAlive: false
        });
      }
    });

    io.emit('archiving-wave', {
      round: gameState.currentRound,
      archivedPlayers: archivedIds,
      nextWaveIn: archivingSpeed
    });

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

  const finalState = getOptimizedGameState();
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
  updateBatch.clear();
  
  gameState.players.forEach(player => {
    player.isAlive = true;
    player.shields = 0;
    player.survivalTime = 0;
    player.eliminatedAt = undefined;
  });
}

function getOptimizedGameState() {
  return {
    players: Array.from(gameState.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      color: p.color,
      isAlive: p.isAlive,
      shields: p.shields,
      isHost: p.isHost
    })),
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
const HOST = '0.0.0.0'; // Important for Railway

// Railway provides PORT as a string
httpServer.listen(Number(PORT), HOST, () => {
  console.log(`Optimized Feature Flag Game running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Ready for 30+ concurrent players!`);
});

// Cleanup on exit
process.on('SIGINT', () => {
  clearInterval(batchUpdater);
  if (archivingTimer) clearTimeout(archivingTimer);
  if (shieldSpawnInterval) clearInterval(shieldSpawnInterval);
  process.exit();
});