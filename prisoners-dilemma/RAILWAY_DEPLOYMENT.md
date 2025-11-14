# Deploy to Railway

Railway is a platform that supports persistent Node.js servers and WebSockets, making it perfect for Socket.IO applications.

## Quick Deployment Steps

### 1. Sign up for Railway
- Go to https://railway.app
- Sign up with your GitHub account (free)

### 2. Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your `gametheory` repository
4. Railway will auto-detect it's a Next.js app

### 3. Configure the Project
1. In the project settings, set:
   - **Root Directory**: `prisoners-dilemma`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   
2. Railway will automatically:
   - Install dependencies
   - Build your app
   - Start the server
   - Give you a public URL

### 4. Environment Variables (if needed)
No environment variables are required for basic deployment.

### 5. Custom Domain
1. Go to your project settings
2. Click "Settings" → "Domains"
3. Click "Custom Domain"
4. Add: `gametheory.abdisalam.blog`
5. Railway will give you a CNAME record to add to Porkbun

### 6. Update DNS on Porkbun
1. Log into Porkbun
2. Go to DNS settings for `abdisalam.blog`
3. **Update the existing CNAME record** for `gametheory`:
   - Type: `CNAME`
   - Host: `gametheory`
   - Answer: `<your-railway-url>` (Railway will provide this)
   - TTL: `600`

## Advantages of Railway over Vercel for this project:
- ✅ Full WebSocket support
- ✅ Persistent server connections
- ✅ Native Socket.IO support
- ✅ Free tier available
- ✅ Automatic deployments from GitHub
- ✅ Easy environment management

## Cost
- **Free Tier**: $5 worth of usage per month (plenty for this app)
- Includes all features needed

## Alternative: Keep Bot Mode on Vercel, Use Railway for Multiplayer Only

If you want, you could:
1. Keep the current Vercel deployment for bot mode (works fine)
2. Deploy a separate Socket.IO server to Railway
3. Point multiplayer connections to Railway

But the simplest solution is to deploy everything to Railway.
