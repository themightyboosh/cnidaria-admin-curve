# 🚀 Cnidaria Admin Curves - Cloud Run Deployment

This project is configured to deploy exclusively to **Google Cloud Run** using Google Cloud Build. This approach eliminates local Docker dependencies and provides seamless CI/CD.

## 🏗️ Deployment Architecture

- **Platform**: Google Cloud Run (preferred)
- **Build**: Google Cloud Build (serverless)
- **Container Registry**: Google Container Registry (gcr.io)
- **Project**: zone-eaters
- **Region**: us-central1

## 🌍 Environment URLs

| Environment | Service Name | URL |
|-------------|--------------|-----|
| **Development** | `cnidaria-admin-curves-dev` | https://cnidaria-admin-curves-dev-824079132046.us-central1.run.app |
| **Staging** | `cnidaria-admin-curves-stage` | https://cnidaria-admin-curves-stage-824079132046.us-central1.run.app |
| **Production** | `cnidaria-admin-curves-prod` | https://cnidaria-admin-curves-prod-824079132046.us-central1.run.app |

## 🚀 Quick Deployment Commands

### From Project Root
```bash
# Deploy to development
npm run deploy:dev

# Deploy to staging  
npm run deploy:stage

# Deploy to production
npm run deploy:prod

# Check deployment status
npm run cloud-run:status
```

### From cnidaria-admin-curve Directory
```bash
# Deploy to development
npm run deploy:dev
./deploy-cloudrun-dev.sh

# Deploy to staging
npm run deploy:stage
./deploy-cloudrun-stage.sh

# Deploy to production  
npm run deploy:prod
./deploy-cloudrun-prod.sh
```

## 📋 Prerequisites

1. **Google Cloud CLI** installed and authenticated
   ```bash
   gcloud auth login
   gcloud config set project zone-eaters
   ```

2. **Required APIs enabled** (automated in deployment scripts):
   - Cloud Build API
   - Cloud Run API
   - Container Registry API

## 🔧 How It Works

1. **Code Commit**: Scripts automatically commit and push changes
2. **Cloud Build**: Google Cloud Build creates the container
3. **Auto Deploy**: Container automatically deploys to Cloud Run
4. **Live URL**: Service available immediately at predictable URL

## 🎯 Why Cloud Run Over Docker?

✅ **Advantages**:
- No local Docker installation required
- Faster builds with Cloud Build caching
- Automatic scaling and HTTPS
- Consistent build environment
- No ARM/x64 compatibility issues
- Integrated with Google Cloud ecosystem

❌ **Docker Issues We Avoid**:
- Docker daemon startup problems
- ARM64 rollup dependencies
- Local build environment differences
- Large local container images

## 📊 Monitoring & Debugging

### View Deployment Status
```bash
gcloud run services list --region=us-central1
```

### View Service Logs
```bash
# Development logs
npm run cloud-run:logs:dev

# Staging logs  
npm run cloud-run:logs:stage

# Production logs
npm run cloud-run:logs:prod
```

### Direct gcloud Commands
```bash
# Service details
gcloud run services describe cnidaria-admin-curves-dev --region=us-central1

# Recent deployments
gcloud builds list --limit=5
```

## 🔒 Environment Configuration

Environment-specific settings are managed in `src/config/environments.ts`:

- **API URLs**: Points to corresponding Cloud Functions
- **Service Names**: Cloud Run service identifiers  
- **Deployment Config**: Platform and project settings
- **Auto-detection**: Determines environment from hostname

## 🚨 Troubleshooting

### Build Failures
1. Check Cloud Build logs: `gcloud builds list`
2. Verify permissions: `gcloud auth list`
3. Check API enablement in Google Cloud Console

### Service Not Starting
1. Check port configuration (should be 8080)
2. Review nginx.conf and Dockerfile
3. Check environment variables in Cloud Run console

### Access Issues
1. Ensure service allows unauthenticated access
2. Check firewall rules
3. Verify domain/SSL configuration

## 📝 Migration Notes

This project has migrated **FROM**:
- ❌ Local Docker builds
- ❌ Firebase Hosting (for this service)
- ❌ Manual deployment scripts

**TO**:
- ✅ Google Cloud Run
- ✅ Google Cloud Build
- ✅ Automated CI/CD
- ✅ Standardized npm scripts

All old Docker and Firebase deployment files have been removed and replaced with Cloud Run alternatives.
