#!/bin/bash

# Admin Curve Tool - Google Cloud Run Deployment Script
# This script builds and deploys the React app to Google Cloud Run

set -e

echo "🚀 Deploying Admin Curve Tool to Google Cloud Run..."

# Configuration
PROJECT_ID="zone-eaters"
REGION="us-central1"
SERVICE_NAME="admin-curve"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "📋 Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service Name: $SERVICE_NAME"
echo "  Image: $IMAGE_NAME"

# Build the React app
echo "🔨 Building React app..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

echo "✅ Build completed successfully"

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t $IMAGE_NAME .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed"
    exit 1
fi

echo "✅ Docker image built successfully"

# Push to Google Container Registry
echo "📤 Pushing image to Google Container Registry..."
docker push $IMAGE_NAME

if [ $? -ne 0 ]; then
    echo "❌ Failed to push Docker image"
    exit 1
fi

echo "✅ Image pushed successfully"

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --platform managed \
    --region $REGION \
    --project $PROJECT_ID \
    --allow-unauthenticated \
    --port 80 \
    --memory 512Mi \
    --cpu 1 \
    --max-instances 10

if [ $? -ne 0 ]; then
    echo "❌ Cloud Run deployment failed"
    exit 1
fi

echo "✅ Deployment completed successfully!"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID --format='value(status.url)')

echo "🌐 Service URL: $SERVICE_URL"
echo "🎉 Admin Curve Tool is now live!"
echo ""
echo "📝 Next steps:"
echo "  - Test the application at: $SERVICE_URL"
echo "  - Monitor logs: gcloud logs tail --service=$SERVICE_NAME --region=$REGION"
echo "  - View service: gcloud run services describe $SERVICE_NAME --region=$REGION"
