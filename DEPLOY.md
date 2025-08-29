# Deployment Guide

## 🚂 Railway Deployment (Recommended - No Docker!)

Railway now deploys directly using Node.js (no Docker required!) just like your development environment.

### Prerequisites
- GitHub account
- Railway account (sign up at [railway.app](https://railway.app))

Railway provides the simplest deployment with WebSocket support, automatic SSL, and a free tier.

### Prerequisites
- GitHub account
- Railway account (sign up at [railway.app](https://railway.app))

### Step 1: Push to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Feature Flag Survival Game - Ready for deployment"

# Create new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/feature-flag-game.git
git push -u origin main
```

### Step 2: Deploy on Railway

1. Go to [railway.app](https://railway.app)
2. Click **"Start New Project"**
3. Choose **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub
5. Select your `feature-flag-game` repository
6. Railway will automatically:
   - Use Nixpacks (not Docker)
   - Install dependencies with `npm ci`
   - Build with `npm run build:all`
   - Start with `NODE_ENV=production node dist/optimized-server.js`
   - Provide a URL like `https://feature-flag-game.up.railway.app`

### Step 3: Environment Variables (Optional)

In Railway dashboard:
- Click on your project
- Go to "Variables" tab
- Add if needed:
  ```
  NODE_ENV=production
  ```

### Step 4: Custom Domain (Optional)

1. In Railway dashboard, go to Settings
2. Under Domains, click "Generate Domain" for a free railway.app subdomain
3. Or add your own custom domain

## Your Game is Live! 🎮

Share the URL with friends and start playing!

## Monitoring

Railway provides:
- Automatic restart on crashes
- Log viewing in dashboard
- Usage metrics
- Automatic SSL certificates

## Updating

After making changes:
```bash
git add .
git commit -m "Update game"
git push origin main
```
Railway automatically redeploys!

## Cost

- **Free tier**: $5 credit/month (usually enough for small games)
- **Paid**: ~$5-10/month for continuous running

## Troubleshooting

If deployment fails:
1. Check Railway logs in dashboard
2. Ensure `npm run build:all` works locally
3. Verify all dependencies are in package.json

## 🎮 Why No Docker?

We're using Railway's native Node.js support because:
1. The development version works perfectly
2. Simpler deployment (no Docker build required)
3. Faster deployments
4. Same environment as development
5. Movement and WebSocket connections work reliably

## 🔧 Local Testing

```bash
# Test production build locally
npm run build:all
NODE_ENV=production PORT=3000 npm start
```

Open http://localhost:3000 to test

## 🐳 Docker Deployment (Alternative)

If you prefer Docker:
```bash
# Rename Dockerfile.backup back to Dockerfile
mv Dockerfile.backup Dockerfile

# Build and run
docker build -t feature-flag-game .
docker run -p 3000:3000 feature-flag-game
```

## Alternative Platforms

If Railway doesn't work:

### Render.com
- Similar to Railway
- Free tier with spin-down (sleeps after 15 min inactivity)
- WebSocket support

### Heroku
- Requires credit card
- $7/month minimum
- Most reliable for production

### DigitalOcean App Platform
- $5/month minimum
- Good for production
- More complex setup