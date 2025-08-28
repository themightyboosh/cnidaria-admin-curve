#!/bin/bash

# Google Cloud Run Deployment Script for New Cnidaria Admin Tool
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  Google Cloud Run Deploy${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Configuration
SERVICE_NAME="cnidaria-admin"
REGION="us-central1"
PROJECT_ID="zone-eaters"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

print_header

# Check if gcloud CLI is installed
if ! command -v gcloud &> /dev/null; then
    print_warning "Google Cloud CLI not found. Please install it first:"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    print_warning "Not authenticated with Google Cloud. Please run:"
    echo "gcloud auth login"
    echo "gcloud config set project $PROJECT_ID"
    exit 1
fi

# Set project
print_status "Setting project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Enable required APIs
print_status "Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com

# Build the app
print_status "Building React app..."
npm run build

# Build Docker image
print_status "Building Docker image: $IMAGE_NAME"
gcloud builds submit --tag $IMAGE_NAME .

# Deploy to Cloud Run
print_status "Deploying to Cloud Run: $SERVICE_NAME"
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 80 \
    --memory 512Mi \
    --cpu 1 \
    --max-instances 10

# Get service URL
print_status "Getting service URL..."
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")

print_status "Deployment complete! 🎉"
echo ""
echo "Service URL: $SERVICE_URL"
echo ""
echo "Test your admin tool:"
echo "curl $SERVICE_URL"
echo ""

# Test the deployment
print_status "Testing deployment..."
if curl -s "$SERVICE_URL" > /dev/null; then
    print_status "✅ Admin tool is responding successfully!"
else
    print_warning "⚠️  Service might not be ready yet. Wait a few minutes and try again."
fi

echo ""
print_status "Your New Cnidaria Admin Tool is now live on Google Cloud! 🚀"
