#!/bin/bash

# Deploy to Firebase Hosting (Dev Environment)
# Simple static hosting - no Docker required

set -e

echo "🚀 Deploying to Firebase Hosting (Dev)..."

# Build the app
echo "🔨 Building React app..."
npm run build

# Check if firebase.json exists, create if not
if [ ! -f "firebase.json" ]; then
    echo "📝 Creating firebase.json..."
    cat > firebase.json << EOF
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
EOF
fi

# Install Firebase CLI if not installed
if ! command -v firebase &> /dev/null; then
    echo "📦 Installing Firebase CLI..."
    npm install -g firebase-tools
fi

# Login to Firebase (if needed)
echo "🔐 Checking Firebase authentication..."
firebase login --reauth

# Initialize Firebase (if needed)
if [ ! -f ".firebaserc" ]; then
    echo "🎯 Initializing Firebase project..."
    firebase init hosting
fi

# Deploy
echo "🚀 Deploying to Firebase Hosting..."
firebase deploy --only hosting

echo "✅ Deployment complete!"
echo "🌐 Your app is live at the URL shown above"
