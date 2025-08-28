#!/bin/bash

# Development Environment Deployment Script
echo "🚀 Deploying to Development Environment..."

# Ensure we're on the dev branch
git checkout dev
git pull origin dev

# Merge latest changes from master
echo "📥 Merging latest changes from master..."
git merge master

# Set the project
gcloud config set project cnidaria-dev

# Deploy the function
echo "☁️ Deploying to Google Cloud Functions..."
gcloud functions deploy cnidaria-api-dev \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=apiHandler \
  --trigger-http \
  --allow-unauthenticated \
  --memory=512MB \
  --timeout=60s \
  --set-env-vars ENVIRONMENT=dev,GOOGLE_CLOUD_PROJECT=cnidaria-dev,FIREBASE_STORAGE_BUCKET=cnidaria-dev.appspot.com

# Commit deployment timestamp
git add .
git commit -m "Deploy to development environment - $(date)"

echo "✅ Development deployment complete!"
echo "🌐 Function URL: https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev"
echo "📝 Deployment committed to dev branch"
