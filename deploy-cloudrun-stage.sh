#!/bin/bash

# Deploy Cnidaria Admin Curves to Google Cloud Run (Stage Environment)
# Uses Google Cloud Build to avoid local Docker issues

set -e

echo "🚀 Deploying Cnidaria Admin Curves to Google Cloud Run (Stage) via Buildpacks..."

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
gcloud services enable run.googleapis.com

# Require build-time Firebase vars for Vite
req=(VITE_FIREBASE_STAGE_API_KEY VITE_FIREBASE_STAGE_AUTH_DOMAIN VITE_FIREBASE_STAGE_PROJECT_ID VITE_FIREBASE_STAGE_STORAGE_BUCKET VITE_FIREBASE_STAGE_MESSAGING_SENDER_ID VITE_FIREBASE_STAGE_APP_ID)
missing=()
for k in "${req[@]}"; do
  if [ -z "${!k}" ]; then missing+=("$k"); fi
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "❌ Missing build env vars: ${missing[*]}"
  echo "   Export them before running this script."
  exit 1
fi

echo "🛠️ Deploying from source with build-time Vite vars..."
gcloud run deploy "$SERVICE_NAME" \
  --region="$REGION" \
  --source . \
  --allow-unauthenticated \
  --set-env-vars VITE_ENVIRONMENT=staging,VITE_API_URL=https://us-central1-cnidaria-stage.cloudfunctions.net/cnidaria-api-stage \
  --set-build-env-vars VITE_FIREBASE_STAGE_API_KEY="$VITE_FIREBASE_STAGE_API_KEY",VITE_FIREBASE_STAGE_AUTH_DOMAIN="$VITE_FIREBASE_STAGE_AUTH_DOMAIN",VITE_FIREBASE_STAGE_PROJECT_ID="$VITE_FIREBASE_STAGE_PROJECT_ID",VITE_FIREBASE_STAGE_STORAGE_BUCKET="$VITE_FIREBASE_STAGE_STORAGE_BUCKET",VITE_FIREBASE_STAGE_MESSAGING_SENDER_ID="$VITE_FIREBASE_STAGE_MESSAGING_SENDER_ID",VITE_FIREBASE_STAGE_APP_ID="$VITE_FIREBASE_STAGE_APP_ID"

echo "✅ Stage deploy complete."
