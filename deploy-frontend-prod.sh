#!/bin/bash

# Frontend Production Environment Deployment Script
# Automatically deploys to production environment with correct API configuration

set -e

echo "🚀 Deploying Frontend to Production Environment..."

# Ensure we're on the prod branch
git checkout prod
git pull origin prod

# Set environment variables for production build
export VITE_ENVIRONMENT=prod
export VITE_API_URL=https://us-central1-cnidaria-prod.cloudfunctions.net/cnidaria-api-prod
export VITE_WEB_URL=https://cnidaria-admin-curves-prod-xxxxx-uc.a.run.app
export VITE_APP_TITLE="Cnidaria Admin Curves (Prod)"

echo "📋 Production Configuration:"
echo "  Environment: $VITE_ENVIRONMENT"
echo "  API URL: $VITE_API_URL"
echo "  Web URL: $VITE_WEB_URL"
echo "  App Title: $VITE_APP_TITLE"

# Build the React app with production environment
echo "🔨 Building React app for production..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

echo "✅ Production build completed successfully"

# Deploy to Cloud Run using source deployment (no Docker build needed)
echo "🚀 Deploying to Cloud Run (Production)..."
gcloud run deploy cnidaria-admin-curves-prod \
    --source . \
    --platform managed \
    --region us-central1 \
    --project cnidaria-prod \
    --allow-unauthenticated \
    --port 80 \
    --memory 512Mi \
    --cpu 1 \
    --max-instances 20

if [ $? -ne 0 ]; then
    echo "❌ Cloud Run deployment failed"
    exit 1
fi

echo "✅ Production deployment completed successfully!"

# Get the service URL
SERVICE_URL=$(gcloud run services describe cnidaria-admin-curves-prod --region=us-central1 --project=cnidaria-prod --format='value(status.url)')

echo "🌐 Production Service URL: $SERVICE_URL"
echo "🎉 Frontend is now live on production!"
echo ""
echo "📝 Next steps:"
echo "  - Test the application at: $SERVICE_URL"
echo "  - Monitor logs: gcloud logs tail --service=cnidaria-admin-curves-prod --region=us-central1"
echo "  - View service: gcloud run services describe cnidaria-admin-curves-prod --region=us-central1"
echo ""
echo "🔗 API Endpoint: $VITE_API_URL"
