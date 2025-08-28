#!/bin/bash

# Simple Deployment Script - Build locally, deploy with simple Dockerfile
echo "🚀 Simple Frontend Deployment..."

# Get environment from argument
ENV=${1:-dev}
echo "📋 Deploying to environment: $ENV"

# Set environment variables based on environment
case $ENV in
    dev|development)
        export VITE_ENVIRONMENT=dev
        export VITE_API_URL=https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev
        export VITE_WEB_URL=http://localhost:5173
        export VITE_APP_TITLE="Cnidaria Admin Curves (Dev)"
        PROJECT_ID="cnidaria-dev"
        SERVICE_NAME="cnidaria-admin-curves-dev"
        ;;
    stage|staging)
        export VITE_ENVIRONMENT=stage
        export VITE_API_URL=https://us-central1-cnidaria-stage.cloudfunctions.net/cnidaria-api-stage
        export VITE_WEB_URL=https://cnidaria-admin-curves-stage-xxxxx-uc.a.run.app
        export VITE_APP_TITLE="Cnidaria Admin Curves (Stage)"
        PROJECT_ID="cnidaria-stage"
        SERVICE_NAME="cnidaria-admin-curves-stage"
        ;;
    prod|production)
        export VITE_ENVIRONMENT=prod
        export VITE_API_URL=https://us-central1-cnidaria-prod.cloudfunctions.net/cnidaria-api-prod
        export VITE_WEB_URL=https://cnidaria-admin-curves-prod-xxxxx-uc.a.run.app
        export VITE_APP_TITLE="Cnidaria Admin Curves (Prod)"
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

# Build Docker image using simple Dockerfile
echo "🐳 Building Docker image..."
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"
docker build -f Dockerfile.simple -t $IMAGE_NAME .

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
