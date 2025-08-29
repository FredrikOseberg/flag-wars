#!/bin/bash

# Feature Flag Game - Deployment Script

echo "🚩 Feature Flag Game Deployment Script"
echo "======================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t feature-flag-game:latest .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed"
    exit 1
fi

echo "✅ Docker image built successfully"

# Option 1: Run locally with Docker
if [ "$1" = "local" ]; then
    echo ""
    echo "🏃 Running locally with Docker..."
    docker stop feature-flag-game 2>/dev/null
    docker rm feature-flag-game 2>/dev/null
    docker run -d \
        --name feature-flag-game \
        -p 3000:3000 \
        -e NODE_ENV=production \
        -e PORT=3000 \
        --restart unless-stopped \
        feature-flag-game:latest
    
    echo "✅ Game is running at http://localhost:3000"
    echo ""
    echo "📝 Useful commands:"
    echo "  docker logs feature-flag-game    # View logs"
    echo "  docker stop feature-flag-game    # Stop the game"
    echo "  docker start feature-flag-game   # Start the game"
    exit 0
fi

# Option 2: Push to Docker Hub
if [ "$1" = "push" ]; then
    if [ -z "$2" ]; then
        echo "❌ Please provide Docker Hub username"
        echo "Usage: ./deploy.sh push <username>"
        exit 1
    fi
    
    echo ""
    echo "🚀 Pushing to Docker Hub..."
    docker tag feature-flag-game:latest $2/feature-flag-game:latest
    docker push $2/feature-flag-game:latest
    
    echo "✅ Pushed to Docker Hub as $2/feature-flag-game:latest"
    echo ""
    echo "📝 To deploy on any server:"
    echo "  docker run -d -p 3000:3000 $2/feature-flag-game:latest"
    exit 0
fi

# Option 3: Deploy to Railway (using Railway CLI)
if [ "$1" = "railway" ]; then
    if ! command -v railway &> /dev/null; then
        echo "❌ Railway CLI is not installed."
        echo "Install it with: npm install -g @railway/cli"
        exit 1
    fi
    
    echo ""
    echo "🚂 Deploying to Railway..."
    railway up
    
    echo "✅ Deployed to Railway!"
    exit 0
fi

# Show usage if no valid option provided
echo "Usage:"
echo "  ./deploy.sh local           # Run locally with Docker"
echo "  ./deploy.sh push <username> # Push to Docker Hub"
echo "  ./deploy.sh railway         # Deploy to Railway"
echo ""
echo "Examples:"
echo "  ./deploy.sh local"
echo "  ./deploy.sh push myusername"
echo "  ./deploy.sh railway"