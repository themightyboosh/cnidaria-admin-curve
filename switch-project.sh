#!/bin/bash

# New Cnidaria Project Switcher
# This script helps manage project context and Git repositories

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_project() {
    echo -e "${CYAN}[PROJECT]${NC} $1"
}

print_alert() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}  PROJECT SWITCH ALERT${NC}"
    echo -e "${PURPLE}================================${NC}"
    echo -e "${CYAN}Switched to: $1${NC}"
    echo -e "${CYAN}Repository: $2${NC}"
    echo -e "${CYAN}Type: $3${NC}"
    echo -e "${CYAN}Path: $4${NC}"
    echo -e "${PURPLE}================================${NC}"
}

# Function to show current project info
show_current_project() {
    if [ -f "workspace.json" ]; then
        echo -e "${BLUE}Current Workspace: New Cnidaria${NC}"
        echo -e "${BLUE}Available Projects:${NC}"
        echo -e "  ${GREEN}API${NC} - Backend service"
        echo -e "  ${GREEN}Admin${NC} - React admin interface"
        echo -e "  ${GREEN}Unity${NC} - Unity game client"
        echo -e "  ${GREEN}Docs${NC} - Shared documentation"
        echo ""
    fi
}

# Function to switch to a project
switch_to_project() {
    local project_name=$1
    
    case $project_name in
        "api"|"API")
            cd API
            setup_project_repo "cnidaria-api" "Backend API Service" "backend" "API"
            ;;
        "admin"|"Admin")
            cd Admin
            setup_project_repo "cnidaria-admin" "React Admin Interface" "frontend" "Admin"
            ;;
        "unity"|"Unity")
            cd Unity
            setup_project_repo "cnidaria-unity" "Unity Game Client" "game" "Unity"
            ;;
        "docs"|"Docs")
            cd Docs
            print_alert "Shared Documentation" "N/A" "documentation" "Docs"
            print_status "You are now in the shared documentation directory"
            print_status "This directory is accessible from all projects"
            show_docs_management_tips
            return 0
            ;;
        *)
            print_error "Unknown project: $project_name"
            print_status "Available projects: API, Admin, Unity, Docs"
            return 1
            ;;
    esac
}

# Function to setup project repository
setup_project_repo() {
    local repo_name=$1
    local description=$2
    local type=$3
    local path=$4
    
    # Check if .git exists
    if [ ! -d ".git" ]; then
        print_warning "No Git repository found. Initializing..."
        git init
        git remote add origin "https://github.com/danielcrowder/$repo_name.git"
        
        # Create basic .gitignore
        create_gitignore "$type"
        
        # Create README
        create_readme "$repo_name" "$description" "$type"
        
        print_status "Git repository initialized for $repo_name"
    else
        print_status "Git repository already exists"
    fi
    
    # Show project context
    print_alert "$description" "https://github.com/danielcrowder/$repo_name" "$type" "$path"
    
    # Show shared docs info and smart guidance
    if [ -d "../Docs" ]; then
        print_status "Shared documentation available at: ../Docs"
        print_status "Current docs: $(ls ../Docs | wc -l) files"
        
        # Show smart documentation guidance
        show_docs_guidance
    fi
    
    # Show Git status
    if [ -d ".git" ]; then
        echo ""
        print_status "Git Status:"
        git status --short
    fi
}

# Function to show smart documentation guidance
show_docs_guidance() {
    echo ""
    print_status "📚 Smart Documentation Management:"
    print_status "  • New docs should go in ../Docs/ (shared across all projects)"
    print_status "  • Use '../Docs/' path from this project directory"
    print_status "  • Quick access: ./../cnidaria docs"
    print_status "  • Current shared docs:"
    
    # List current shared documentation
    if [ -d "../Docs" ]; then
        for doc in ../Docs/*.md ../Docs/*.txt ../Docs/*.pdf; do
            if [ -f "$doc" ] 2>/dev/null; then
                doc_name=$(basename "$doc")
                print_status "    - $doc_name"
            fi
        done
    fi
    
    echo ""
    print_status "💡 Tip: Create project-specific docs in ../Docs/ with project prefix"
    print_status "   Example: ../Docs/API_ENDPOINTS.md, ../Docs/UNITY_SETUP.md"
    print_status "   Quick create: touch ../Docs/$(echo $path | tr '[:lower:]' '[:upper:]')_README.md"
}

# Function to show documentation management tips
show_docs_management_tips() {
    echo ""
    print_status "📚 Documentation Management Tips:"
    print_status "  • All projects can access docs here via '../Docs/'"
    print_status "  • Use project prefixes for organization:"
    print_status "    - API_*.md for API documentation"
    print_status "    - ADMIN_*.md for Admin documentation"
    print_status "    - UNITY_*.md for Unity documentation"
    print_status "    - SHARED_*.md for cross-project docs"
    print_status "  • Quick navigation:"
    print_status "    - ./../cnidaria api     (go to API project)"
    print_status "    - ./../cnidaria admin   (go to Admin project)"
    print_status "    - ./../cnidaria unity   (go to Unity project)"
}

# Function to create appropriate .gitignore
create_gitignore() {
    local type=$1
    
    case $type in
        "backend")
            cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
EOF
            ;;
        "frontend")
            cat > .gitignore << 'EOF'
# Dependencies
node_modules/
/.pnp
.pnp.js

# Testing
/coverage

# Production
/build
/dist

# Misc
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
EOF
            ;;
        "game")
            cat > .gitignore << 'EOF'
# Unity generated files
[Ll]ibrary/
[Tt]emp/
[Oo]bj/
[Bb]uild/
[Bb]uilds/
[Ll]ogs/
[Uu]ser[Ss]ettings/

# MemoryCaptures can get excessive in size
[Mm]emoryCaptures/

# Asset meta data should only be ignored when the corresponding asset is also ignored
!/[Aa]ssets/**/*.meta

# Visual Studio cache directory
.vs/

# Gradle cache directory
.gradle/

# Autogenerated VS/MD/Consulo solution and project files
ExportedObj/
.consulo/
*.csproj
*.unityproj
*.sln
*.suo
*.tmp
*.user
*.userprefs
*.pidb
*.booproj
*.svd
*.pdb
*.mdb
*.opendb
*.VC.db

# Unity3D generated meta files
*.pidb.meta
*.pdb.meta
*.mdb.meta

# Unity3D generated file on crash reports
sysinfo.txt

# Builds
*.apk
*.aab
*.unitypackage
*.app

# Crashlytics generated file
crashlytics-build.properties

# Packed Addressables
/[Aa]ddressable[Aa]ssets/*/*.bin*

# Temporary auto-generated Android Assets
/[Aa]ssets/[Ss]treamingAssets/aa.meta
/[Aa]ssets/[Ss]treamingAssets/aa/*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
EOF
            ;;
    esac
}

# Function to create README
create_readme() {
    local repo_name=$1
    local description=$2
    local type=$3
    
    cat > README.md << EOF
# $repo_name

$description

## Project Type
$type

## Part of New Cnidaria Workspace
This project is part of the larger New Cnidaria game development workspace.

## Shared Documentation
Shared documentation is available at \`../Docs\` relative to this project.

## Getting Started
[Add project-specific setup instructions here]

## Development
[Add development workflow information here]

## Contributing
[Add contribution guidelines here]

## License
[Add license information here]
EOF
}

# Function to show help
show_help() {
    echo -e "${BLUE}New Cnidaria Project Switcher${NC}"
    echo ""
    echo "Usage: $0 [PROJECT_NAME]"
    echo ""
    echo "Available projects:"
    echo "  API     - Switch to API backend project"
    echo "  Admin   - Switch to React admin project"
    echo "  Unity   - Switch to Unity game project"
    echo "  Docs    - Switch to shared documentation"
    echo ""
    echo "Examples:"
    echo "  $0 api      # Switch to API project"
    echo "  $0 admin    # Switch to Admin project"
    echo "  $0 unity    # Switch to Unity project"
    echo "  $0 docs     # Switch to Docs directory"
    echo ""
    echo "Options:"
    echo "  -h, --help  Show this help message"
    echo "  -s, --show  Show current workspace info"
    echo ""
}

# Main script logic
main() {
    # Check if we're in the right directory
    if [ ! -f "workspace.json" ]; then
        print_error "workspace.json not found. Please run this script from the New Cnidaria workspace root."
        exit 1
    fi
    
    # Parse command line arguments
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
        -s|--show)
            show_current_project
            exit 0
            ;;
        "")
            show_current_project
            echo ""
            print_status "Use '$0 [PROJECT_NAME]' to switch to a project"
            print_status "Use '$0 --help' for more information"
            exit 0
            ;;
        *)
            switch_to_project "$1"
            ;;
    esac
}

# Run main function
main "$@"
