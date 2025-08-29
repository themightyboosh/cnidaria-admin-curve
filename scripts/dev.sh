#!/bin/bash

# Cnidaria Development Script
# Usage: ./scripts/dev.sh [admin|api|both]

case "$1" in
  "admin")
    echo "🚀 Starting Admin Frontend..."
    cd cnidaria-admin-curve && npm run dev
    ;;
  "api")
    echo "🔧 Starting API Server..."
    cd cnidaria-api && npm start
    ;;
  "both")
    echo "🚀 Starting Both Admin and API..."
    npm run start
    ;;
  *)
    echo "🎯 Cnidaria Development Commands:"
    echo ""
    echo "  ./scripts/dev.sh admin   - Start admin frontend only"
    echo "  ./scripts/dev.sh api     - Start API server only" 
    echo "  ./scripts/dev.sh both    - Start both services"
    echo ""
    echo "  Or use npm commands from root:"
    echo "  npm run admin            - Start admin frontend"
    echo "  npm run api              - Start API server"
    echo "  npm run start            - Start both services"
    echo ""
    ;;
esac
