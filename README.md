# Flag Wars - Feature Flag Survival Game

A fun multiplayer survival game where players compete as feature flags trying to avoid being archived!

## Features

- 🎮 Real-time multiplayer gameplay
- 🛡️ Collect shields to protect against archiving waves
- 🏆 Leaderboard showing survival rankings
- 🎯 Host controls to manage games
- ⏱️ Time-bound rounds with increasing difficulty
- 📱 Responsive design for all devices

## Quick Start

### Installation

```bash
npm install
```

### Development

Run both server and client in development mode:

```bash
npm run dev
```

- Server runs on http://localhost:3000
- Client dev server runs on http://localhost:8080

### Production Build

```bash
npm run build
npm start
```

The game will be available at http://localhost:3000

## How to Play

1. **Join the Lobby**: Enter your feature flag name (e.g., "dark_mode_v2")
2. **Wait for Players**: The host can start when at least 2 players join
3. **Survive**: Every 10 seconds, an archiving wave eliminates random flags
4. **Collect Shields**: Click on shield icons to protect yourself
5. **Be the Last Flag**: The last feature flag standing wins!

## Deployment

### Heroku

```bash
heroku create your-app-name
git push heroku main
```

### Railway

Click "Deploy on Railway" and connect your GitHub repo.

### Docker

```bash
docker build -t flag-wars .
docker run -p 3000:3000 flag-wars
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

## Tech Stack

- **Backend**: Node.js, Express, Socket.io, TypeScript
- **Frontend**: React, TypeScript, Tailwind CSS
- **Build**: Webpack, TypeScript Compiler

## Game Rules

- Players join as feature flags with custom names
- Archiving waves occur every 10 seconds
- Each wave archives ~30% of unshielded players
- Shields protect you for one wave
- Game speeds up as rounds progress
- Last flag enabled wins the game!