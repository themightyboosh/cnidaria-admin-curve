# 🐙 Cnidaria Admin Curves - Multi-Environment Frontend

A sophisticated React-based curve management application with complete multi-environment infrastructure, automatic environment detection, and smart API routing.

## 🌟 Features

- **Multi-Environment Support**: Development, Staging, and Production
- **Smart Environment Detection**: Automatic API routing based on deployment
- **Real-time Curve Management**: Create, edit, and visualize mathematical curves
- **Coordinate Distortion System**: Universal noise application for all curve types
- **Responsive UI**: Modern, collapsible interface with dark theme
- **Cloud-Native**: Built for Google Cloud Platform with Cloud Run deployment

## 🏗️ Architecture

### Environment Structure
```
┌─────────────────┬─────────────────┬─────────────────┐
│   Development   │     Staging     │   Production    │
├─────────────────┼─────────────────┼─────────────────┤
│ cnidaria-dev    │ cnidaria-stage  │ cnidaria-prod   │
│ Frontend: ✅    │ Frontend: ✅    │ Frontend: ✅    │
│ API: ✅         │ API: ✅         │ API: ✅         │
│ Database: ✅    │ Database: ✅    │ Database: ✅    │
└─────────────────┴─────────────────┴─────────────────┘
```

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Google Cloud Functions (Node.js 20)
- **Database**: Firebase Firestore
- **Deployment**: Google Cloud Run
- **Build System**: Google Cloud Build
- **Container**: Docker + Nginx

## 🚀 Live Environments

### Development
- **Frontend**: [https://cnidaria-admin-curves-dev-nunalm7mga-uc.a.run.app](https://cnidaria-admin-curves-dev-nunalm7mga-uc.a.run.app)
- **API**: [https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev](https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev)
- **Project**: `cnidaria-dev`

### Staging
- **Frontend**: [https://cnidaria-admin-curves-stage-hwnbgyr3mq-uc.a.run.app](https://cnidaria-admin-curves-stage-hwnbgyr3mq-uc.a.run.app)
- **API**: [https://us-central1-cnidaria-stage.cloudfunctions.net/cnidaria-api-stage](https://us-central1-cnidaria-stage.cloudfunctions.net/cnidaria-api-stage)
- **Project**: `cnidaria-stage`

### Production
- **Frontend**: [https://cnidaria-admin-curves-prod-r24ijqzhna-uc.a.run.app](https://cnidaria-admin-curves-prod-r24ijqzhna-uc.a.run.app)
- **API**: [https://us-central1-cnidaria-prod.cloudfunctions.net/cnidaria-api-prod](https://us-central1-cnidaria-prod.cloudfunctions.net/cnidaria-api-prod)
- **Project**: `cnidaria-prod`

## 🛠️ Local Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

### Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd cnidaria-admin-curve

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Configuration
The app automatically detects the environment and configures:
- API endpoints
- App titles
- Web URLs
- Environment-specific features

## 📦 Deployment

### Quick Deploy Commands
```bash
# Deploy to development
./deploy-cloud.sh dev

# Deploy to staging
./deploy-cloud.sh stage

# Deploy to production
./deploy-cloud.sh prod
```

### Manual Deployment Steps
1. **Set Google Cloud Project**
   ```bash
   gcloud config set project cnidaria-{env}
   ```

2. **Build and Deploy**
   ```bash
   ./deploy-cloud.sh {env}
   ```

3. **Verify Deployment**
   ```bash
   gcloud run services list --region=us-central1
   ```

### Deployment Scripts
- `deploy-cloud.sh` - Main deployment script for all environments
- `cloudbuild.yaml` - Google Cloud Build configuration
- `Dockerfile.simple` - Container configuration for static file serving

## 🔧 Environment Management

### Environment Variables
Each environment has its own configuration:

#### Development (`.env.dev`)
```bash
VITE_ENVIRONMENT=dev
VITE_API_URL=https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev
VITE_WEB_URL=http://localhost:5173
VITE_APP_TITLE=Cnidaria Admin Curves (Dev)
```

#### Staging (`.env.stage`)
```bash
VITE_ENVIRONMENT=stage
VITE_API_URL=https://us-central1-cnidaria-stage.cloudfunctions.net/cnidaria-api-stage
VITE_WEB_URL=https://cnidaria-admin-curves-stage-xxxxx-uc.a.run.app
VITE_APP_TITLE=Cnidaria Admin Curves (Stage)
```

#### Production (`.env.prod`)
```bash
VITE_ENVIRONMENT=prod
VITE_API_URL=https://us-central1-cnidaria-prod.cloudfunctions.net/cnidaria-api-prod
VITE_WEB_URL=https://cnidaria-admin-curves-prod-xxxxx-uc.a.run.app
VITE_APP_TITLE=Cnidaria Admin Curves (Prod)
```

### Smart Environment Detection
The frontend automatically detects the environment using:
1. **Explicit Environment Variable**: `VITE_ENVIRONMENT`
2. **Hostname Detection**: 
   - `localhost` → `dev`
   - `stage` in hostname → `stage`
   - `prod` in hostname → `prod`
3. **Default Fallback**: `dev`

## 📊 API Endpoints

### Core Endpoints
- `GET /api/curves` - List all curves
- `POST /api/curves` - Create new curve
- `GET /api/curves/:id` - Get specific curve
- `PUT /api/curves/:id` - Update curve
- `DELETE /api/curves/:id` - Delete curve
- `POST /api/curves/:id/process` - Process curve coordinates
- `GET /api/collections/status` - Check collection status

### Environment-Specific APIs
- **Development**: `https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev`
- **Staging**: `https://us-central1-cnidaria-stage.cloudfunctions.net/cnidaria-api-stage`
- **Production**: `https://us-central1-cnidaria-prod.cloudfunctions.net/cnidaria-api-prod`

## 🎯 Usage

### Creating Curves
1. Navigate to the curve creation section
2. Select curve type (Radial, Cartesian X, Cartesian Y)
3. Configure parameters:
   - Base coordinates
   - Distortion settings
   - Angular parameters
   - Index scaling
4. Save the curve

### Managing Curves
- **View**: Browse all curves in the grid
- **Edit**: Modify curve parameters and settings
- **Delete**: Remove unwanted curves
- **Process**: Generate coordinate data for visualization

### Environment Switching
The application automatically adapts to each environment:
- **Local Development**: Always uses development API
- **Staging Deployment**: Connects to staging API
- **Production Deployment**: Connects to production API

## 🔍 Monitoring and Debugging

### Cloud Run Logs
```bash
# Development
gcloud logs tail --service=cnidaria-admin-curves-dev --region=us-central1

# Staging
gcloud logs tail --service=cnidaria-admin-curves-stage --region=us-central1

# Production
gcloud logs tail --service=cnidaria-admin-curves-prod --region=us-central1
```

### Service Status
```bash
# Check service status
gcloud run services describe cnidaria-admin-curves-{env} --region=us-central1

# List all services
gcloud run services list --region=us-central1
```

### Build Logs
```bash
# View Cloud Build logs
gcloud builds log [BUILD_ID] --region=us-central1
```

## 🚨 Troubleshooting

### Common Issues

#### Build Failures
- **Problem**: Docker build fails on ARM64 Mac
- **Solution**: Use Google Cloud Build (automated in deployment scripts)

#### Environment Detection Issues
- **Problem**: Wrong API endpoint being used
- **Solution**: Check `VITE_ENVIRONMENT` variable and hostname detection

#### Deployment Failures
- **Problem**: Cloud Run deployment fails
- **Solution**: Verify project configuration and service account permissions

### Debug Commands
```bash
# Check current project
gcloud config get-value project

# Verify environment variables
./scripts/manage-environments.sh config {env}

# Test API connectivity
curl https://us-central1-cnidaria-{env}.cloudfunctions.net/cnidaria-api-{env}/api/curves
```

## 📚 Additional Documentation

- [Multi-Environment Setup](MULTI_ENVIRONMENT_SETUP.md) - Detailed environment configuration
- [API Reference](Docs/API_REFERENCE.md) - Complete API documentation
- [Development Workflow](Docs/DEVELOPMENT_WORKFLOW.md) - Development best practices

## 🤝 Contributing

### Development Workflow
1. **Work on `dev` branch** for all development
2. **Test on staging** before production
3. **Use environment management scripts** for consistency
4. **Follow deployment procedures** for each environment

### Code Standards
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Component-based architecture

## 📄 License

This project is proprietary and confidential.

## 🆘 Support

For technical support or questions:
- Check the troubleshooting section above
- Review Cloud Build and Cloud Run logs
- Verify environment configurations
- Test API connectivity

---

**🎉 Your multi-environment frontend infrastructure is now fully operational and documented!**
