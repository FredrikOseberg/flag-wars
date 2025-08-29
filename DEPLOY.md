# Deployment Guide

## 🐳 Docker Deployment (Fixed Movement Issues)

### Quick Local Test
```bash
# Build and run locally
./deploy.sh local

# Or manually:
docker build -t feature-flag-game .
docker run -p 3000:3000 feature-flag-game
```

Open http://localhost:3000 to play!

### Deploy to Any Server
```bash
# Build and push to Docker Hub
./deploy.sh push your-dockerhub-username

# On your server:
docker run -d -p 3000:3000 your-dockerhub-username/feature-flag-game
```

## 🚂 Quick Deploy to Railway (Recommended)

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
   - Detect Node.js project
   - Run `npm run build:all`
   - Start with `node dist/optimized-server.js`
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

## 🔧 Movement Fix Notes

The Docker deployment movement issue has been fixed by:
1. Ensuring gameLoop only runs when keys are pressed or velocity exists
2. Proper WebSocket configuration for production
3. Correct static file serving in Express

If movement still doesn't work:
1. Check browser console for errors
2. Ensure WebSocket connection is established (look for "Connected to server" in console)
3. Try both WASD and arrow keys
4. Verify the server is running on the correct port

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