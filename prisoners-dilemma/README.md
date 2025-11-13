# Prisoner's Dilemma Game

An interactive web-based implementation of the classic Prisoner's Dilemma game theory experiment, featuring real-time multiplayer gameplay and AI bot opponents.

## Features

- 🎮 **Real-time Multiplayer**: Play against friends online with Socket.IO
- 🤖 **AI Bot Opponents**: Challenge various AI strategies (Tit-for-Tat, Always Defect, Always Cooperate, Random, Grudger, Pavlov)
- ✨ **Enhanced Game Mechanics**: 
  - Cooperation streak bonuses
  - Forgiveness bonuses for switching strategies
  - Reputation penalties for excessive defection
  - Mutual defection penalties
- 📊 **Live Score Tracking**: Real-time score updates during gameplay
- 🎨 **Modern UI**: Beautiful, responsive design with dark mode support

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm

### Local Development

1. Clone the repository:
```bash
git clone <your-repo-url>
cd prisoners-dilemma
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

### Deploy to Vercel (Recommended)

Vercel is the easiest way to deploy this Next.js application with Socket.IO support.

#### Option 1: Deploy via Vercel Dashboard

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Deploy on Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Sign up/Login with your GitHub account
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js settings
   - Click "Deploy"

3. **Your app will be live!** Vercel will provide you with a URL like `https://your-app.vercel.app`

#### Option 2: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
cd prisoners-dilemma
vercel
```

3. Follow the prompts to link your project

### Important Notes for Production

- **Socket.IO Configuration**: The app is configured to work with Vercel's serverless functions. The `vercel.json` file includes the necessary configuration.
- **WebSocket Support**: Vercel supports WebSockets for real-time multiplayer functionality.
- **Environment Variables**: No environment variables are required for basic deployment.

### Alternative Deployment Options

#### Deploy to Other Platforms

If deploying to other platforms (Railway, Render, etc.):

1. Ensure the platform supports:
   - Node.js 18+
   - WebSocket connections
   - Long-running server processes (for Socket.IO)

2. Build the application:
```bash
npm run build
npm start
```

3. Set the `PORT` environment variable if needed (defaults to 3000)

## Game Modes

### Multiplayer Mode
- Create a room and share the 6-digit code with a friend
- Both players join the same room to start playing
- Works across the internet (not just local network)

### Bot Mode
- Play against AI opponents
- Choose from different bot strategies
- Perfect for practice or solo play

## Game Mechanics

The game uses enhanced mechanics to make cooperation more rewarding:

- **Cooperation Streak Bonus**: Earn +1 bonus point for every 2 consecutive mutual cooperations
- **Forgiveness Bonus**: Get +2 points when switching from defecting to cooperating
- **Reputation Penalty**: Excessive defection (>60%) reduces defection rewards
- **Mutual Defection Penalty**: After 3+ mutual defections, both players get 0 points

## Project Structure

```
prisoners-dilemma/
├── app/                    # Next.js app directory
│   ├── prisoners-dilemma/  # Game page
│   └── api/                # API routes
├── pages/
│   ├── api/
│   │   └── socket.js       # Socket.IO server
│   └── _app.tsx           # App wrapper with Socket context
├── public/                 # Static assets
└── vercel.json            # Vercel configuration
```

## Technologies Used

- **Next.js 15**: React framework
- **Socket.IO**: Real-time multiplayer communication
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **React 19**: UI library

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

## Support

If you encounter any issues with deployment or have questions, please open an issue on GitHub.
