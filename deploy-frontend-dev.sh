#!/bin/bash

# Frontend Development Environment Deployment Script
# Automatically deploys to development environment with correct API configuration

set -e

echo "🚀 Deploying Frontend to Development Environment..."

# Ensure we're on the dev branch
git checkout dev
git pull origin dev

# Set environment variables for development build
export VITE_ENVIRONMENT=dev
export VITE_API_URL=https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev
export VITE_WEB_URL=http://localhost:5173
export VITE_APP_TITLE="Cnidaria Admin Curves (Dev)"

echo "📋 Development Configuration:"
echo "  Environment: $VITE_ENVIRONMENT"
echo "  API URL: $VITE_API_URL"
echo "  Web URL: $VITE_WEB_URL"
echo "  App Title: $VITE_APP_TITLE"

# Build the React app with development environment
echo "🔨 Building React app for development..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

echo "✅ Development build completed successfully"

# For development, we typically run locally, but you can also deploy to a dev server
echo "🌐 Development deployment options:"
echo "  1. Run locally: npm run dev"
echo "  2. Deploy to dev server (if configured)"
echo "  3. Build for testing: npm run build"

# Optional: Deploy to a development server if you have one configured
# echo "🚀 Deploying to development server..."
# gcloud run deploy cnidaria-admin-curves-dev \
#     --image gcr.io/cnidaria-dev/cnidaria-admin-curves-dev \
#     --platform managed \
#     --region us-central1 \
#     --project cnidaria-dev \
#     --allow-unauthenticated

echo "✅ Development deployment configuration complete!"
echo "🎯 To run locally: npm run dev"
echo "🌍 Local URL: http://localhost:5173"
echo "🔗 API Endpoint: $VITE_API_URL"
