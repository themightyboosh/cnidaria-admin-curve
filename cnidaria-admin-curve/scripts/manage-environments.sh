#!/bin/bash

# Frontend Environment Management Script for Cnidaria Admin Curves
# This script helps manage environment branches and deployments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Function to show current status
show_status() {
    print_header "Current Environment Status"
    echo "Current branch: $(git branch --show-current)"
    echo ""
    echo "Available branches:"
    git branch -v
    echo ""
    echo "Available environments:"
    echo "  - dev (development branch)"
    echo "  - stage (staging branch)"
    echo "  - prod (production branch)"
    echo ""
    echo "Remote branches:"
    git branch -r
}

# Function to switch to environment
switch_environment() {
    local env=$1
    
    case $env in
        dev|development)
            print_status "Switching to development environment..."
            git checkout dev
            print_status "Switched to development branch (dev)"
            ;;
        stage|staging)
            print_status "Switching to staging environment..."
            git checkout stage
            print_status "Switched to staging branch (stage)"
            ;;
        prod|production)
            print_status "Switching to production environment..."
            git checkout prod
            print_status "Switched to production branch (prod)"
            ;;
        *)
            print_error "Invalid environment: $env"
            print_status "Valid options: dev, stage, prod"
            exit 1
            ;;
    esac
}

# Function to sync environment with master
sync_environment() {
    local env=$1
    
    print_status "Syncing $env environment with master..."
    
    case $env in
        dev|development)
            git checkout dev
            git pull origin dev
            git merge master
            ;;
        stage|staging)
            git checkout stage
            git pull origin stage
            git merge master
            ;;
        prod|production)
            git checkout prod
            git pull origin prod
            git merge master
            ;;
        *)
            print_error "Invalid environment: $env"
            exit 1
            ;;
    esac
    
    print_status "Environment $env synced with master"
}

# Function to deploy to environment
deploy_environment() {
    local env=$1
    
    print_status "Deploying to $env environment..."
    
    case $env in
        dev|development)
            ./deploy-frontend-dev.sh
            ;;
        stage|staging)
            ./deploy-frontend-stage.sh
            ;;
        prod|production)
            ./deploy-frontend-prod.sh
            ;;
        *)
            print_error "Invalid environment: $env"
            exit 1
            ;;
    esac
}

# Function to show environment configuration
show_config() {
    local env=$1
    
    print_header "Environment Configuration for $env"
    
    case $env in
        dev|development)
            if [ -f ".env.dev" ]; then
                cat .env.dev
            else
                print_error ".env.dev file not found"
            fi
            ;;
        stage|staging)
            if [ -f ".env.stage" ]; then
                cat .env.stage
            else
                print_error ".env.stage file not found"
            fi
            ;;
        prod|production)
            if [ -f ".env.prod" ]; then
                cat .env.prod
            else
                print_error ".env.prod file not found"
            fi
            ;;
        *)
            print_error "Invalid environment: $env"
            exit 1
            ;;
    esac
}

# Function to build for environment
build_environment() {
    local env=$1
    
    print_status "Building for $env environment..."
    
    # Load environment variables
    case $env in
        dev|development)
            export $(cat .env.dev | xargs)
            ;;
        stage|staging)
            export $(cat .env.stage | xargs)
            ;;
        prod|production)
            export $(cat .env.prod | xargs)
            ;;
        *)
            print_error "Invalid environment: $env"
            exit 1
            ;;
    esac
    
    # Build the app
    npm run build
    
    if [ -d "dist" ]; then
        print_status "Build completed successfully for $env"
        print_status "Environment: $VITE_ENVIRONMENT"
        print_status "API URL: $VITE_API_URL"
        print_status "App Title: $VITE_APP_TITLE"
    else
        print_error "Build failed - dist directory not found"
        exit 1
    fi
}

# Function to run locally
run_local() {
    print_status "Starting local development server..."
    
    # Ensure we're on dev branch
    if [ "$(git branch --show-current)" != "dev" ]; then
        print_warning "Not on dev branch, switching..."
        git checkout dev
    fi
    
    # Load dev environment
    if [ -f ".env.dev" ]; then
        export $(cat .env.dev | xargs)
        print_status "Loaded dev environment configuration"
    fi
    
    print_status "Starting development server..."
    print_status "Environment: $VITE_ENVIRONMENT"
    print_status "API URL: $VITE_API_URL"
    print_status "Local URL: http://localhost:5173"
    
    npm run dev
}

# Function to show help
show_help() {
    echo "Frontend Environment Management Script"
    echo ""
    echo "Usage: $0 [COMMAND] [ENVIRONMENT]"
    echo ""
    echo "Commands:"
    echo "  status                    Show current environment status"
    echo "  switch <env>             Switch to environment (dev/stage/prod)"
    echo "  sync <env>               Sync environment with master"
    echo "  deploy <env>             Deploy to environment"
    echo "  config <env>             Show environment configuration"
    echo "  build <env>              Build for environment"
    echo "  local                    Run local development server"
    echo "  help                     Show this help message"
    echo ""
    echo "Environments:"
    echo "  dev                      Development environment"
    echo "  stage                    Staging environment"
    echo "  prod                     Production environment"
    echo ""
    echo "Examples:"
    echo "  $0 status                # Show current status"
    echo "  $0 switch dev            # Switch to development"
    echo "  $0 deploy stage          # Deploy to staging"
    echo "  $0 build prod            # Build for production"
    echo "  $0 local                 # Run local development server"
}

# Main script logic
case $1 in
    status)
        show_status
        ;;
    switch)
        if [ -z "$2" ]; then
            print_error "Please specify an environment"
            show_help
            exit 1
        fi
        switch_environment $2
        ;;
    sync)
        if [ -z "$2" ]; then
            print_error "Please specify an environment"
            show_help
            exit 1
        fi
        sync_environment $2
        ;;
    deploy)
        if [ -z "$2" ]; then
            print_error "Please specify an environment"
            show_help
            exit 1
        fi
        deploy_environment $2
        ;;
    config)
        if [ -z "$2" ]; then
            print_error "Please specify an environment"
            show_help
            exit 1
        fi
        show_config $2
        ;;
    build)
        if [ -z "$2" ]; then
            print_error "Please specify an environment"
            show_help
            exit 1
        fi
        build_environment $2
        ;;
    local)
        run_local
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
