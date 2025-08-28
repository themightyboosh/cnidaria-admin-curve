#!/bin/bash

# Staging Environment Deployment Script
echo "🚀 Deploying to Staging Environment..."

# Ensure we're on the stage branch
git checkout stage
git pull origin stage

# Merge latest changes from master
echo "📥 Merging latest changes from master..."
git merge master

# Set the project
gcloud config set project cnidaria-stage

# Deploy the function
echo "☁️ Deploying to Google Cloud Functions..."
gcloud functions deploy cnidaria-api-stage \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=apiHandler \
  --trigger-http \
  --allow-unauthenticated \
  --memory=512MB \
  --timeout=60s \
  --set-env-vars ENVIRONMENT=stage,GOOGLE_CLOUD_PROJECT=cnidaria-stage,FIREBASE_STORAGE_BUCKET=cnidaria-stage.appspot.com

# Commit deployment timestamp
git add .
git commit -m "Deploy to staging environment - $(date)"

echo "✅ Staging deployment complete!"
echo "🌐 Function URL: https://us-central1-cnidaria-stage.cloudfunctions.net/cnidaria-api-stage"
echo "📝 Deployment committed to stage branch"
