#!/bin/bash

# Production Environment Deployment Script
echo "🚀 Deploying to Production Environment..."

# Ensure we're on the prod branch
git checkout prod
git pull origin prod

# Merge latest changes from master
echo "📥 Merging latest changes from master..."
git merge master

# Set the project
gcloud config set project cnidaria-prod

# Deploy the function
echo "☁️ Deploying to Google Cloud Functions..."
gcloud functions deploy cnidaria-api-prod \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=apiHandler \
  --trigger-http \
  --allow-unauthenticated \
  --memory=512MB \
  --timeout=60s \
  --set-env-vars ENVIRONMENT=prod,GOOGLE_CLOUD_PROJECT=cnidaria-prod,FIREBASE_STORAGE_BUCKET=cnidaria-prod.appspot.com

# Commit deployment timestamp
git add .
git commit -m "Deploy to production environment - $(date)"

echo "✅ Production deployment complete!"
echo "🌐 Function URL: https://us-central1-cnidaria-prod.cloudfunctions.net/cnidaria-api-prod"
echo "📝 Deployment committed to prod branch"
