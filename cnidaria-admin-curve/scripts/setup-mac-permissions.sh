#!/bin/bash

# Cnidaria Mac Development Environment Setup
# This script sets up permanent permissions and optimizations

echo "🔧 Setting up permanent Mac development environment..."

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should not be run as root"
   exit 1
fi

# Create development user group if it doesn't exist
if ! dscl . -read /Groups/dev-users > /dev/null 2>&1; then
    echo "📝 Creating development user group..."
    sudo dscl . -create /Groups/dev-users
    sudo dscl . -create /Groups/dev-users PrimaryGroupID 1001
    sudo dscl . -create /Groups/dev-users RealName "Development Users"
fi

# Add current user to dev-users group
echo "👤 Adding user to development group..."
sudo dscl . -append /Groups/dev-users GroupMembership $(whoami)

# Set up port permissions
echo "🔌 Setting up port permissions..."
sudo chmod 755 /usr/local/bin/node
sudo chmod 755 /opt/homebrew/bin/node

# Create development directory with proper permissions
echo "📁 Setting up development directory permissions..."
sudo chown -R $(whoami):staff .
sudo chmod -R 755 .
sudo chmod -R 644 *.json *.js *.ts *.tsx *.css *.html

# Set up environment variables permanently
echo "⚙️  Setting up permanent environment variables..."

# Create .zshrc entry if it doesn't exist
if ! grep -q "CNIDARIA_DEV" ~/.zshrc; then
    cat >> ~/.zshrc << 'EOF'

# Cnidaria Development Environment
export CNIDARIA_DEV=true
export NODE_OPTIONS="--max-old-space-size=4096 --openssl-legacy-provider"
export CHOKIDAR_USEPOLLING=false
export CHOKIDAR_INTERVAL=1000
export VITE_FORCE_COLOR=1
export VITE_CLEAR_SCREEN=false

# Development ports
export DEV_PORT=5173
export API_PORT=3000

# Mac optimizations
export UV_THREADPOOL_SIZE=64
EOF
    echo "✅ Added environment variables to ~/.zshrc"
fi

# Create development alias
if ! grep -q "cnidaria-dev" ~/.zshrc; then
    cat >> ~/.zshrc << 'EOF'

# Cnidaria development aliases
alias cnidaria-dev="cd /Users/danielcrowder/Desktop/Projects/New\ Cnidaria/cnidaria-admin-curve && npm run dev"
alias cnidaria-api="cd /Users/danielcrowder/Desktop/Projects/New\ Cnidaria/cnidaria-api && npm run dev"
alias cnidaria-start="./scripts/start-dev.sh"
EOF
    echo "✅ Added development aliases to ~/.zshrc"
fi

# Set up firewall rules for development
echo "🔥 Setting up firewall rules for development..."
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /opt/homebrew/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblock /opt/homebrew/bin/node

# Create launchd service for automatic port management
echo "🚀 Creating development service..."
cat > ~/Library/LaunchAgents/com.cnidaria.dev.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cnidaria.dev</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd /Users/danielcrowder/Desktop/Projects/New\ Cnidaria/cnidaria-admin-curve && npm run dev</string>
    </array>
    <key>RunAtLoad</key>
    <false/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>/tmp/cnidaria-dev.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/cnidaria-dev-error.log</string>
</dict>
</plist>
EOF

# Load the service
launchctl load ~/Library/LaunchAgents/com.cnidaria.dev.plist

echo "✅ Permanent setup complete!"
echo ""
echo "🎉 Next steps:"
echo "1. Restart your terminal or run: source ~/.zshrc"
echo "2. Use 'cnidaria-dev' to start the development server"
echo "3. Use 'cnidaria-start' to use the smart startup script"
echo ""
echo "🔧 If you still have issues:"
echo "   - Run: sudo npm run dev"
echo "   - Check: ./scripts/start-dev.sh"
echo ""
echo "📋 Environment variables added:"
echo "   - NODE_OPTIONS: Memory and SSL optimizations"
echo "   - CHOKIDAR_*: File watching optimizations"
echo "   - VITE_*: Vite-specific optimizations"

