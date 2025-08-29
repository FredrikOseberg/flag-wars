export interface Player {
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

export interface Shield {
  id: string;
  x: number;
  y: number;
}

export interface GameState {
  players: Player[];
  gameStatus: 'waiting' | 'playing' | 'finished';
  currentRound: number;
  startTime: number | null;
  shields: Shield[];
}

export interface ScoreboardEntry {
  rank: number;
  name: string;
  survivalTime: number;
  roundsSurvived: number;
  isWinner: boolean;
}