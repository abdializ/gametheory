# Vercel-Compatible Multiplayer

## Overview

This game now uses a **polling-based multiplayer system** instead of Socket.IO, making it fully compatible with Vercel's free serverless functions.

## How It Works

### Architecture

1. **In-Memory Game State** (`lib/game-store.js`)
   - Stores active game rooms in server memory
   - Auto-expires inactive rooms after 30 minutes
   - Simple Map-based storage (no database needed)

2. **REST API Endpoints** (`pages/api/game/`)
   - `POST /api/game/create` - Create a new room
   - `POST /api/game/join` - Join an existing room
   - `GET /api/game/state` - Get current game state (polled every second)
   - `POST /api/game/choice` - Submit player choice

3. **Client-Side Polling** (`app/prisoners-dilemma/page.tsx`)
   - Polls `/api/game/state` every 1 second
   - Updates UI based on server response
   - Handles real-time updates without WebSockets

### Why This Works on Vercel

- ✅ **No persistent connections** - Each API call is stateless
- ✅ **Serverless-friendly** - Works with Vercel's function model
- ✅ **Free tier compatible** - No special features needed
- ✅ **Simple deployment** - Push to GitHub, auto-deploys

## Features

### Bot Mode
- Works exactly as before
- All calculations done client-side
- No server needed

### Multiplayer Mode
- Share a 6-digit room code with a friend
- Both players connect over the internet
- Real-time gameplay via polling
- No local network requirement

### Game Mechanics
All enhanced mechanics preserved:
- Cooperation streak bonuses
- Forgiveness bonuses  
- Reputation penalties
- Mutual defection penalties

## Limitations

1. **Room Persistence**
   - Rooms reset when Vercel function cold-starts
   - Inactive rooms expire after 30 minutes
   - Not suitable for long-term game storage

2. **Scalability**
   - In-memory storage limits concurrent rooms
   - For high traffic, consider adding a database (Vercel KV, Postgres)

3. **Latency**
   - 1-second polling interval means ~1s update delay
   - Acceptable for turn-based gameplay
   - Can adjust interval if needed

## Future Improvements

If you need more robust multiplayer:

1. **Add Database Storage**
   - Use Vercel KV or Vercel Postgres
   - Persist rooms across function restarts
   - Support game history/replays

2. **Optimize Polling**
   - Implement long-polling
   - Reduce polling interval for faster updates
   - Add conditional requests to reduce bandwidth

3. **Add Authentication**
   - Track users across sessions
   - Store game statistics
   - Implement matchmaking

## Deployment

The app auto-deploys to Vercel when you push to GitHub:

```bash
git push origin main
```

Vercel detects the changes and rebuilds automatically. No special configuration needed!

## Testing Locally

```bash
npm run dev
```

Then visit:
- Bot mode: `http://localhost:3000/prisoners-dilemma?mode=bot&bot=titForTat`
- Multiplayer: `http://localhost:3000/prisoners-dilemma?mode=multiplayer`

## Domain

Your game is live at: https://gametheory.abdisalam.blog

Enjoy! 🎮

