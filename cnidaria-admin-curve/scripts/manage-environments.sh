#!/bin/bash

# Environment Management Script for Cnidaria Admin Curve
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
    
    print_status "$env environment synced with master"
}

# Function to build and deploy for environment
deploy_environment() {
    local env=$1
    
    print_status "Building and preparing $env environment..."
    
    case $env in
        dev|development)
            git checkout dev
            print_status "Building development version..."
            npm run build
            print_status "Development build complete! Ready for deployment."
            ;;
        stage|staging)
            git checkout stage
            print_status "Building staging version..."
            npm run build
            print_status "Staging build complete! Ready for deployment."
            ;;
        prod|production)
            git checkout prod
            print_status "Building production version..."
            npm run build
            print_status "Production build complete! Ready for deployment."
            ;;
        *)
            print_error "Invalid environment: $env"
            exit 1
            ;;
    esac
}

# Function to commit and push changes
commit_and_push() {
    local env=$1
    local message=$2
    
    if [ -z "$message" ]; then
        message="Update $env environment - $(date)"
    fi
    
    print_status "Committing and pushing changes to $env..."
    
    case $env in
        dev|development)
            git checkout dev
            git add .
            git commit -m "$message"
            git push origin dev
            ;;
        stage|staging)
            git checkout stage
            git add .
            git commit -m "$message"
            git push origin stage
            ;;
        prod|production)
            git checkout prod
            git add .
            git commit -m "$message"
            git push origin prod
            ;;
        *)
            print_error "Invalid environment: $env"
            exit 1
            ;;
    esac
    
    print_status "Changes committed and pushed to $env branch"
}

# Function to show help
show_help() {
    echo "Usage: $0 [COMMAND] [ENVIRONMENT] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  status                    Show current environment status"
    echo "  switch <env>             Switch to environment (dev/stage/prod)"
    echo "  sync <env>               Sync environment with master branch"
    echo "  deploy <env>             Build environment for deployment"
    echo "  commit <env> [message]   Commit and push changes to environment"
    echo "  help                     Show this help message"
    echo ""
    echo "Environments:"
    echo "  dev, development         Development environment (dev branch)"
    echo "  stage, staging          Staging environment (stage branch)"
    echo "  prod, production        Production environment (prod branch)"
    echo ""
    echo "Examples:"
    echo "  $0 status"
    echo "  $0 switch dev"
    echo "  $0 sync stage"
    echo "  $0 deploy prod"
    echo "  $0 commit dev 'Add new feature'"
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
    commit)
        if [ -z "$2" ]; then
            print_error "Please specify an environment"
            show_help
            exit 1
        fi
        commit_and_push $2 "$3"
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
