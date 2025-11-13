# Deployment Guide

## Quick Start: Deploy to Vercel

### Step 1: Prepare Your Code

1. Make sure all changes are committed:
```bash
cd prisoners-dilemma
git status
```

2. If you haven't initialized git yet:
```bash
git init
git add .
git commit -m "Ready for deployment"
```

### Step 2: Push to GitHub

1. Create a new repository on GitHub (github.com/new)

2. Link your local repository:
```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### Step 3: Deploy to Vercel

#### Method A: Via Vercel Dashboard (Easiest)

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect:
   - Framework: Next.js
   - Root Directory: `prisoners-dilemma` (if needed)
   - Build Command: `npm run build`
   - Output Directory: `.next`
5. Click "Deploy"
6. Wait for deployment (usually 1-2 minutes)
7. Your app will be live at `https://your-app.vercel.app`

#### Method B: Via Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
cd prisoners-dilemma
vercel
```

4. Follow the prompts:
   - Set up and deploy? **Y**
   - Which scope? (select your account)
   - Link to existing project? **N**
   - Project name? (press enter for default)
   - Directory? (press enter for `./`)
   - Override settings? **N**

5. Your app will be deployed and you'll get a URL

### Step 4: Test Your Deployment

1. Visit your deployed URL
2. Test bot mode (should work immediately)
3. Test multiplayer:
   - Open the app in two different browser windows/tabs
   - Create a room in one window
   - Join the room in the other window using the room code
   - Play a game to verify Socket.IO is working

## Troubleshooting

### Socket.IO Not Working

If multiplayer doesn't work after deployment:

1. Check Vercel function logs:
   - Go to your Vercel dashboard
   - Click on your project
   - Go to "Functions" tab
   - Check for any errors in `/api/socket`

2. Verify WebSocket support:
   - Vercel supports WebSockets, but ensure your plan includes it
   - Free tier supports WebSockets

3. Check browser console:
   - Open browser DevTools (F12)
   - Look for Socket.IO connection errors
   - Verify the connection URL is correct

### Build Errors

If you get build errors:

1. Check Node.js version:
   - Vercel uses Node.js 18+ by default
   - Your `package.json` should specify compatible versions

2. Check for TypeScript errors:
```bash
npm run build
```

3. Fix any linting errors:
```bash
npm run lint
```

## Environment Variables

Currently, no environment variables are required. If you need to add any in the future:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add your variables
3. Redeploy

## Custom Domain

To use a custom domain:

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your domain
3. Follow DNS configuration instructions
4. Wait for DNS propagation (can take up to 48 hours)

## Updating Your Deployment

After making changes:

1. Commit and push to GitHub:
```bash
git add .
git commit -m "Your changes"
git push
```

2. Vercel will automatically redeploy (if connected to GitHub)
   - Or run `vercel --prod` if using CLI

## Support

- Vercel Documentation: https://vercel.com/docs
- Next.js Deployment: https://nextjs.org/docs/deployment
- Socket.IO on Vercel: https://vercel.com/docs/functions/serverless-functions#websocket-support

