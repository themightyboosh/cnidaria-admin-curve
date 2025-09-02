#!/bin/bash

# Simple Staging Deployment - No Docker Build
echo "🚀 Deploying Frontend to Staging Environment (Simple Mode)..."

# Ensure we're on the stage branch
git checkout stage
git pull origin stage

# Set environment variables for staging build
export VITE_ENVIRONMENT=stage
export VITE_API_URL=https://us-central1-cnidaria-stage.cloudfunctions.net/cnidaria-api-stage
export VITE_WEB_URL=https://cnidaria-admin-curves-stage-xxxxx-uc.a.run.app
export VITE_APP_TITLE="Cnidaria Admin Curves (Stage)"

echo "📋 Staging Configuration:"
echo "  Environment: $VITE_ENVIRONMENT"
echo "  API URL: $VITE_API_URL"
echo "  Web URL: $VITE_WEB_URL"
echo "  App Title: $VITE_APP_TITLE"

# Build the React app with staging environment
echo "🔨 Building React app for staging..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

echo "✅ Staging build completed successfully"

# Deploy to Cloud Run using source deployment
echo "🚀 Deploying to Cloud Run (Staging)..."
gcloud run deploy cnidaria-admin-curves-stage \
    --source . \
    --platform managed \
    --region us-central1 \
    --project cnidaria-stage \
    --allow-unauthenticated \
    --port 80 \
    --memory 512Mi \
    --cpu 1 \
    --max-instances 10

if [ $? -ne 0 ]; then
    echo "❌ Cloud Run deployment failed"
    exit 1
fi

echo "✅ Staging deployment completed successfully!"

# Get the service URL
SERVICE_URL=$(gcloud run services describe cnidaria-admin-curves-stage --region=us-central1 --project=cnidaria-stage --format='value(status.url)')

echo "🌐 Staging Service URL: $SERVICE_URL"
echo "🎉 Frontend is now live on staging!"
echo ""
echo "📝 Next steps:"
echo "  - Test the application at: $SERVICE_URL"
echo "  - Monitor logs: gcloud logs tail --service=cnidaria-admin-curves-stage --region=us-central1"
echo "  - View service: gcloud run services describe cnidaria-admin-curves-stage --region=us-central1"
echo ""
echo "�� API Endpoint: $VITE_API_URL"
