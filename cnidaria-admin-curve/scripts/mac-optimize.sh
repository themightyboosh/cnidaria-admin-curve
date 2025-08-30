#!/bin/bash

# Mac optimization script for Cnidaria development
echo "🚀 Optimizing development environment for Mac..."

# Set Node.js optimizations
export NODE_OPTIONS="--max-old-space-size=4096 --openssl-legacy-provider"
export UV_THREADPOOL_SIZE=64

# Vite optimizations
export VITE_FORCE_COLOR=1
export VITE_CLEAR_SCREEN=false

# File watching optimizations
export CHOKIDAR_USEPOLLING=false
export CHOKIDAR_INTERVAL=1000

# Memory optimizations
export NODE_OPTIONS="${NODE_OPTIONS} --max-semi-space-size=512"

echo "✅ Mac optimizations applied!"
echo "📊 Node.js memory limit: 4GB"
echo "🔄 File watching: Native (no polling)"
echo "🎨 Colors: Enabled"

# Start the development server
echo "🚀 Starting development server..."
npm run dev
