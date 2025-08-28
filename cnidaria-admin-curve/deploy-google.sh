#!/bin/bash

# Google Cloud Run deployment script for Cnidaria Admin Curve Tool
# This script builds and deploys the React app to Google Cloud Run

set -e

# Configuration
PROJECT_ID="zone-eaters"
SERVICE_NAME="cnidaria-admin-curve"
REGION="us-central1"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🚀 Deploying Cnidaria Admin Curve Tool to Google Cloud Run..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "Please install Google Cloud CLI: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Set the project
echo "📋 Setting Google Cloud project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Build the Docker image
echo "🔨 Building Docker image: $IMAGE_NAME"
docker build -t $IMAGE_NAME .

# Push the image to Google Container Registry
echo "📤 Pushing image to Google Container Registry..."
docker push $IMAGE_NAME

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 80 \
    --memory 512Mi \
    --cpu 1 \
    --max-instances 10 \
    --set-env-vars NODE_ENV=production

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')

echo "✅ Deployment successful!"
echo "🌐 Service URL: $SERVICE_URL"
echo "📊 View logs: gcloud logs read --filter resource.type=cloud_run_revision --limit=50"
echo "🔧 Manage service: https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME"
