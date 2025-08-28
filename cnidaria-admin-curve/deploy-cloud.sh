#!/bin/bash

# Cloud Build Deployment Script
echo "🚀 Cloud Build Frontend Deployment..."

# Get environment from argument
ENV=${1:-dev}
echo "📋 Deploying to environment: $ENV"

# Set environment variables based on environment
case $ENV in
    dev|development)
        export VITE_ENVIRONMENT=dev
        export VITE_API_URL=https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev
        PROJECT_ID="cnidaria-dev"
        SERVICE_NAME="cnidaria-admin-curves-dev"
        ;;
    stage|staging)
        export VITE_ENVIRONMENT=stage
        export VITE_API_URL=https://us-central1-cnidaria-stage.cloudfunctions.net/cnidaria-api-stage
        PROJECT_ID="cnidaria-stage"
        SERVICE_NAME="cnidaria-admin-curves-stage"
        ;;
    prod|production)
        export VITE_ENVIRONMENT=prod
        export VITE_API_URL=https://us-central1-cnidaria-prod.cloudfunctions.net/cnidaria-api-prod
        PROJECT_ID="cnidaria-prod"
        SERVICE_NAME="cnidaria-admin-curves-prod"
        ;;
    *)
        echo "❌ Invalid environment: $ENV"
        echo "Valid options: dev, stage, prod"
        exit 1
        ;;
esac

echo "📋 Configuration:"
echo "  Environment: $VITE_ENVIRONMENT"
echo "  API URL: $VITE_API_URL"
echo "  Project ID: $PROJECT_ID"
echo "  Service Name: $SERVICE_NAME"

# Build the React app locally
echo "🔨 Building React app locally..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

echo "✅ Build completed successfully"

# Build and push using Google Cloud Build
echo "🐳 Building Docker image using Google Cloud Build..."
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

# Build and push in one command using Cloud Build
gcloud builds submit --substitutions=_IMAGE_NAME=$IMAGE_NAME .

if [ $? -ne 0 ]; then
    echo "❌ Google Cloud Build failed"
    exit 1
fi

echo "✅ Docker image built and pushed successfully"

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --platform managed \
    --region us-central1 \
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
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=us-central1 --project=$PROJECT_ID --format='value(status.url)')

echo "🌐 Service URL: $SERVICE_URL"
echo "🎉 Frontend is now live on $ENV!"
echo ""
echo "📝 Next steps:"
echo "  - Test the application at: $SERVICE_URL"
echo "  - Monitor logs: gcloud logs tail --service=$SERVICE_NAME --region=us-central1"
echo "  - View service: gcloud run services describe $SERVICE_NAME --region=us-central1"
echo ""
echo "🔗 API Endpoint: $VITE_API_URL"
