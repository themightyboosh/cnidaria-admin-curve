#!/bin/bash

# Setup script for New Cnidaria workspace aliases
# This script adds convenient aliases to your shell configuration

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Get the workspace directory
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_NAME="New Cnidaria"

# Detect shell
if [ -n "$ZSH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
    SHELL_NAME="zsh"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
    SHELL_NAME="bash"
else
    print_warning "Unknown shell detected. Please manually add aliases to your shell configuration."
    exit 1
fi

print_status "Detected shell: $SHELL_NAME"
print_status "Shell config file: $SHELL_CONFIG"

# Create aliases
ALIASES=(
    "# New Cnidaria Workspace Aliases"
    "alias cnidaria='cd \"$WORKSPACE_DIR\" && ./cnidaria'"
    "alias cnidaria-api='cd \"$WORKSPACE_DIR/API\" && ./../cnidaria api'"
    "alias cnidaria-admin='cd \"$WORKSPACE_DIR/Admin\" && ./../cnidaria admin'"
    "alias cnidaria-unity='cd \"$WORKSPACE_DIR/Unity\" && ./../cnidaria unity'"
    "alias cnidaria-docs='cd \"$WORKSPACE_DIR/Docs\" && ./../cnidaria docs'"
    "alias cnidaria-workspace='cd \"$WORKSPACE_DIR\" && ./cnidaria --show'"
    ""
)

# Check if aliases already exist
if grep -q "New Cnidaria Workspace Aliases" "$SHELL_CONFIG" 2>/dev/null; then
    print_warning "Aliases already exist in $SHELL_CONFIG"
    print_status "Skipping alias creation..."
else
    print_status "Adding aliases to $SHELL_CONFIG..."
    
    # Add aliases to shell config
    for alias_line in "${ALIASES[@]}"; do
        echo "$alias_line" >> "$SHELL_CONFIG"
    done
    
    print_status "Aliases added successfully!"
fi

# Show the aliases that will be available
echo ""
print_status "Available aliases after restarting your shell:"
echo ""
echo -e "${BLUE}cnidaria${NC}           - Go to workspace root and show status"
echo -e "${BLUE}cnidaria-api${NC}       - Switch to API project"
echo -e "${BLUE}cnidaria-admin${NC}     - Switch to Admin project"
echo -e "${BLUE}cnidaria-unity${NC}     - Switch to Unity project"
echo -e "${BLUE}cnidaria-docs${NC}      - Switch to shared documentation"
echo -e "${BLUE}cnidaria-workspace${NC} - Show workspace information"
echo ""

print_status "To use these aliases:"
print_status "1. Restart your terminal or run: source $SHELL_CONFIG"
print_status "2. Use the aliases from anywhere in your system"
print_status "3. Example: cnidaria-api (switches to API project)"

# Create a quick reference file
QUICK_REF="$WORKSPACE_DIR/QUICK_REFERENCE.md"
cat > "$QUICK_REF" << 'EOF'
# Quick Reference - New Cnidaria Workspace

## Shell Aliases (after setup-aliases.sh)

```bash
cnidaria           # Go to workspace root and show status
cnidaria-api       # Switch to API project
cnidaria-admin     # Switch to Admin project
cnidaria-unity     # Switch to Unity project
cnidaria-docs      # Switch to shared documentation
cnidaria-workspace # Show workspace information
```

## Direct Commands

```bash
./cnidaria [project]  # Switch to specific project
./cnidaria --show     # Show workspace status
./cnidaria --help     # Show help
```

## Project Paths

- **API**: `./API` (Backend service)
- **Admin**: `./Admin` (React interface)
- **Unity**: `./Unity` (Game client)
- **Docs**: `./Docs` (Shared documentation)

## Quick Start

1. `cnidaria` - Go to workspace
2. `cnidaria-api` - Work on API
3. `cnidaria-admin` - Work on Admin
4. `cnidaria-unity` - Work on Unity
5. `cnidaria-docs` - View shared docs

## Git Management

Each project has its own Git repository:
- Automatic initialization on first switch
- Project-specific .gitignore files
- Clear project context awareness
EOF

print_status "Quick reference created: $QUICK_REF"
print_status "Setup complete! Restart your terminal to use the new aliases."
