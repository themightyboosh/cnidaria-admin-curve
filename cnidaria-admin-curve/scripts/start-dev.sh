#!/bin/bash

# Cnidaria Development Server Startup Script
# Handles Mac permission issues and Cursor conflicts

echo "🚀 Starting Cnidaria development server..."

# Check if running in Cursor
if [[ "$TERM_PROGRAM" == "vscode" ]]; then
    echo "⚠️  Detected Cursor/VS Code terminal"
    echo "💡 Consider using external terminal for better compatibility"
fi

# Set environment variables for Mac optimization
export NODE_OPTIONS="--max-old-space-size=4096"
export CHOKIDAR_USEPOLLING=false
export CHOKIDAR_INTERVAL=1000

# Try different ports if default is blocked
PORTS=(5173 3001 3002 3003 3004)

for port in "${PORTS[@]}"; do
    echo "🔍 Trying port $port..."
    
    # Check if port is available
    if ! lsof -i :$port > /dev/null 2>&1; then
        echo "✅ Port $port is available"
        
        # Start the server
        if npm run dev -- -p $port; then
            echo "✅ Server started successfully on port $port"
            echo "🌐 Open http://localhost:$port in your browser"
            exit 0
        else
            echo "❌ Failed to start on port $port"
        fi
    else
        echo "❌ Port $port is in use"
    fi
done

echo "❌ All ports are blocked. Try running with sudo or check permissions."
echo "💡 Run: sudo npm run dev"

