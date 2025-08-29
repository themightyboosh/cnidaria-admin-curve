#!/bin/bash

# Deploy Cnidaria Admin Curves to Google Cloud Run (Stage Environment)
# Uses Google Cloud Build to avoid local Docker issues

set -e

echo "🚀 Deploying Cnidaria Admin Curves to Google Cloud Run (Stage)..."

# Configuration
PROJECT_ID="zone-eaters"
SERVICE_NAME="cnidaria-admin-curves-stage"
REGION="us-central1"

echo "📋 Configuration:"
echo "  Project: $PROJECT_ID"
echo "  Service: $SERVICE_NAME"
echo "  Region: $REGION"

# Ensure we're logged in to gcloud
echo "🔐 Checking Google Cloud authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Not authenticated with Google Cloud. Please run:"
    echo "   gcloud auth login"
    exit 1
fi

# Set the project
echo "🎯 Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Commit and push changes if needed
echo "📤 Ensuring latest code is pushed..."
git add .
git commit -m "Deploy to Cloud Run stage" || echo "No changes to commit"
git push origin dev

# Trigger Cloud Build
echo "🏗️ Starting Google Cloud Build..."
gcloud builds submit \
    --config=cloudbuild-stage.yaml \
    .

echo "✅ Deployment initiated!"
echo "🌐 Your app will be available at:"
echo "   https://$SERVICE_NAME-[hash]-uc.a.run.app"
echo ""
echo "📊 To check deployment status:"
echo "   gcloud run services list --region=$REGION"
echo ""
echo "📝 To view logs:"
echo "   gcloud run services logs read $SERVICE_NAME --region=$REGION"
