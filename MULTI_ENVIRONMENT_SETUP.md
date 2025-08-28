# Multi-Environment Frontend Setup

## Overview

The `cnidaria-admin-curve` frontend now supports a complete multi-environment architecture with automatic environment detection and smart API routing.

## Environment Structure

### Branches
- **`dev`** → Development environment
- **`stage`** → Staging environment  
- **`prod`** → Production environment

### API Endpoints
- **Development**: `https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev`
- **Staging**: `https://us-central1-cnidaria-stage.cloudfunctions.net/cnidaria-api-stage`
- **Production**: `https://us-central1-cnidaria-prod.cloudfunctions.net/cnidaria-api-prod`

## Environment Configuration Files

### `.env.dev` (Development)
```bash
VITE_ENVIRONMENT=dev
VITE_API_URL=https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev
VITE_WEB_URL=http://localhost:5173
VITE_APP_TITLE=Cnidaria Admin Curves (Dev)
```

### `.env.stage` (Staging)
```bash
VITE_ENVIRONMENT=stage
VITE_API_URL=https://us-central1-cnidaria-stage.cloudfunctions.net/cnidaria-api-stage
VITE_WEB_URL=https://cnidaria-admin-curves-stage-xxxxx-uc.a.run.app
VITE_APP_TITLE=Cnidaria Admin Curves (Stage)
```

### `.env.prod` (Production)
```bash
VITE_ENVIRONMENT=prod
VITE_API_URL=https://us-central1-cnidaria-prod.cloudfunctions.net/cnidaria-api-prod
VITE_WEB_URL=https://cnidaria-admin-curves-prod-xxxxx-uc.a.run.app
VITE_APP_TITLE=Cnidaria Admin Curves (Prod)
```

## Smart Environment Detection

The frontend automatically detects the environment based on:

1. **Explicit Environment Variable**: `VITE_ENVIRONMENT`
2. **Hostname Detection**: 
   - `localhost` → `dev`
   - `stage` in hostname → `stage`
   - `prod` in hostname → `prod`
3. **Default Fallback**: `dev`

## Deployment Scripts

### Development Deployment
```bash
./deploy-frontend-dev.sh
```
- Switches to `dev` branch
- Sets development environment variables
- Builds the app
- Ready for local development

### Staging Deployment
```bash
./deploy-frontend-stage.sh
```
- Switches to `stage` branch
- Sets staging environment variables
- Builds and deploys to Cloud Run
- Uses staging API endpoint

### Production Deployment
```bash
./deploy-frontend-prod.sh
```
- Switches to `prod` branch
- Sets production environment variables
- Builds and deploys to Cloud Run
- Uses production API endpoint

## Environment Management Script

The `scripts/manage-environments.sh` script provides a unified interface for environment management:

### Commands
```bash
# Show current status
./scripts/manage-environments.sh status

# Switch to environment
./scripts/manage-environments.sh switch dev
./scripts/manage-environments.sh switch stage
./scripts/manage-environments.sh switch prod

# Sync environment with master
./scripts/manage-environments.sh sync dev
./scripts/manage-environments.sh sync stage
./scripts/manage-environments.sh sync prod

# Deploy to environment
./scripts/manage-environments.sh deploy dev
./scripts/manage-environments.sh deploy stage
./scripts/manage-environments.sh deploy prod

# Show environment configuration
./scripts/manage-environments.sh config dev
./scripts/manage-environments.sh config stage
./scripts/manage-environments.sh config prod

# Build for environment
./scripts/manage-environments.sh build dev
./scripts/manage-environments.sh build stage
./scripts/manage-environments.sh build prod

# Run local development server
./scripts/manage-environments.sh local

# Show help
./scripts/manage-environments.sh help
```

## Local Development

### Starting Local Development
```bash
# Ensure you're on dev branch
git checkout dev

# Start development server
npm run dev
```

The local development server will:
- Automatically use the `dev` environment
- Connect to the development API (`cnidaria-dev`)
- Run on `http://localhost:5173`

### Environment Variables
Local development automatically loads `.env.dev` and sets:
- `VITE_ENVIRONMENT=dev`
- `VITE_API_URL=https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev`
- `VITE_APP_TITLE=Cnidaria Admin Curves (Dev)`

## Deployment Workflow

### 1. Development
```bash
# Work on dev branch
git checkout dev
# Make changes...
git add .
git commit -m "Add new feature"
git push origin dev

# Test locally
npm run dev
```

### 2. Staging
```bash
# Deploy to staging
./deploy-frontend-stage.sh

# Or use management script
./scripts/manage-environments.sh deploy stage
```

### 3. Production
```bash
# Deploy to production
./deploy-frontend-prod.sh

# Or use management script
./scripts/manage-environments.sh deploy prod
```

## Environment-Specific Features

### Development
- **API**: `cnidaria-dev` (development database)
- **Web**: `http://localhost:5173`
- **Features**: Full debugging, hot reload, development tools

### Staging
- **API**: `cnidaria-stage` (staging database)
- **Web**: Cloud Run staging service
- **Features**: Pre-production testing, staging data

### Production
- **API**: `cnidaria-prod` (production database)
- **Web**: Cloud Run production service
- **Features**: Live production system, optimized builds

## Troubleshooting

### Common Issues

1. **Wrong API Endpoint**
   - Check current branch: `git branch --show-current`
   - Verify environment variables: `./scripts/manage-environments.sh config dev`

2. **Build Failures**
   - Ensure correct branch: `git checkout dev`
   - Check environment files exist: `ls -la .env*`

3. **Deployment Issues**
   - Verify Google Cloud project: `gcloud config get-value project`
   - Check service account permissions

### Environment Validation
```bash
# Validate all environments
./scripts/manage-environments.sh config dev
./scripts/manage-environments.sh config stage
./scripts/manage-environments.sh config prod

# Test builds
./scripts/manage-environments.sh build dev
./scripts/manage-environments.sh build stage
./scripts/manage-environments.sh build prod
```

## Best Practices

1. **Always work on `dev` branch for development**
2. **Test on staging before production**
3. **Use environment management script for consistency**
4. **Verify environment variables before deployment**
5. **Keep environment files in sync with branch structure**

## Architecture Benefits

- **Automatic Environment Detection**: No manual configuration needed
- **Consistent API Routing**: Each environment uses correct API endpoint
- **Isolated Data**: Each environment has separate database
- **Easy Deployment**: One-command deployment per environment
- **Local Development**: Always uses development API
- **Production Safety**: Clear separation between environments

This setup ensures your frontend automatically adapts to each environment while maintaining data isolation and deployment consistency.
