# Branch-Based Environment Management for Cnidaria API

This document describes the branch-based environment management system for the Cnidaria API, which provides a clean, maintainable approach to managing multiple environments.

## 🌿 Branch Strategy Overview

We use a **single repository** with **environment-specific branches** to maintain code consistency while allowing environment-specific configurations.

### **Branch Structure:**
```
master (or main)
├── dev           # Development environment (cnidaria-dev)
├── stage         # Staging environment (cnidaria-stage)
└── prod          # Production environment (cnidaria-prod)
```

## 🚀 Quick Start

### **1. Check Current Status:**
```bash
./scripts/manage-environments.sh status
```

### **2. Switch to Environment:**
```bash
# Switch to development
./scripts/manage-environments.sh switch dev

# Switch to staging
./scripts/manage-environments.sh switch stage

# Switch to production
./scripts/manage-environments.sh switch prod
```

### **3. Deploy to Environment:**
```bash
# Deploy to development
./scripts/manage-environments.sh deploy dev

# Deploy to staging
./scripts/manage-environments.sh deploy stage

# Deploy to production
./scripts/manage-environments.sh deploy prod
```

## 🔧 Environment Management Commands

### **Status Command:**
```bash
./scripts/manage-environments.sh status
```
Shows:
- Current branch
- Current Google Cloud project
- Available branches
- Available environments

### **Switch Command:**
```bash
./scripts/manage-environments.sh switch <environment>
```
- Switches to the specified environment branch
- Updates Google Cloud project configuration
- Validates the environment

### **Sync Command:**
```bash
./scripts/manage-environments.sh sync <environment>
```
- Switches to environment branch
- Pulls latest changes
- Merges master branch updates

### **Deploy Command:**
```bash
./scripts/manage-environments.sh deploy <environment>
```
- Runs the appropriate deployment script
- Automatically handles branch switching
- Commits deployment timestamps

## 📁 File Structure

```
cnidaria-api/
├── config/
│   └── environments.js          # Centralized environment configuration
├── scripts/
│   └── manage-environments.sh   # Environment management script
├── deploy-dev.sh                # Development deployment script
├── deploy-stage.sh              # Staging deployment script
├── deploy-prod.sh               # Production deployment script
├── env.dev                      # Development environment variables
├── env.stage                    # Staging environment variables
├── env.prod                     # Production environment variables
└── firebase-config.js           # Firebase configuration
```

## 🌍 Environment Configuration

### **Centralized Configuration (`config/environments.js`):**
```javascript
const environments = {
  dev: {
    name: 'Development',
    projectId: 'cnidaria-dev',
    storageBucket: 'cnidaria-dev.appspot.com',
    apiUrl: 'https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev',
    // ... more config
  },
  // ... staging and production
};
```

### **Environment Variables:**
Each environment has its own `.env` file:
- `env.dev` - Development configuration
- `env.stage` - Staging configuration  
- `env.prod` - Production configuration

## 🔄 Workflow

### **Development Workflow:**
1. **Make changes** on `master` branch
2. **Test locally** with development environment
3. **Deploy to development** for testing
4. **Merge to staging** when ready
5. **Deploy to staging** for QA
6. **Merge to production** when approved
7. **Deploy to production** for release

### **Deployment Process:**
```bash
# 1. Switch to environment
./scripts/manage-environments.sh switch dev

# 2. Sync with master
./scripts/manage-environments.sh sync dev

# 3. Deploy
./scripts/manage-environments.sh deploy dev
```

## 🚀 Deployment Scripts

### **Enhanced Deployment Scripts:**
Each deployment script now:
- **Automatically switches** to the correct branch
- **Pulls latest changes** from the branch
- **Merges master** branch updates
- **Sets Google Cloud project** correctly
- **Deploys the function** with proper environment variables
- **Commits deployment** timestamp to the branch

### **Manual Deployment:**
```bash
# Direct script execution
./deploy-dev.sh
./deploy-stage.sh
./deploy-prod.sh

# NPM scripts
npm run deploy:dev
npm run deploy:stage
npm run deploy:prod
```

## 🔑 Environment Isolation

### **Complete Separation:**
- **Separate Google Cloud projects** for each environment
- **Separate Firestore databases** with identical structure
- **Separate API endpoints** for each environment
- **Separate service accounts** with proper permissions
- **No data sharing** between environments

### **Data Management:**
- Each environment has its own `curves` collection
- Data can be migrated between environments if needed
- No cross-contamination between environments

## 🧪 Testing and Validation

### **Environment Verification:**
```bash
# Check current environment
./scripts/manage-environments.sh status

# Verify Google Cloud project
gcloud config get-value project

# Test API endpoint
curl https://[ENVIRONMENT-URL]/health
```

### **Connection Testing:**
The API includes built-in connection testing that verifies:
- Firebase connection
- Environment detection
- Project ID verification

## 🚨 Troubleshooting

### **Common Issues:**

1. **Branch Not Found:**
   ```bash
   # Create missing branch
   git checkout -b dev
   git push -u origin dev
   ```

2. **Merge Conflicts:**
   ```bash
   # Resolve conflicts manually
   git status
   git add .
   git commit -m "Resolve merge conflicts"
   ```

3. **Google Cloud Project Issues:**
   ```bash
   # Verify project exists
   gcloud projects list
   
   # Set project manually
   gcloud config set project cnidaria-dev
   ```

### **Debug Commands:**
```bash
# Check git status
git status

# Check current branch
git branch --show-current

# Check Google Cloud project
gcloud config get-value project

# List all environments
./scripts/manage-environments.sh status
```

## 📝 Best Practices

### **Development:**
- Always work on `master` branch for new features
- Test changes locally before deploying
- Use development environment for initial testing
- Keep development branch in sync with master

### **Staging:**
- Use staging for QA and integration testing
- Deploy to staging before production
- Validate all features work together
- Test with production-like data

### **Production:**
- Only deploy tested, approved changes
- Use staging environment for final validation
- Monitor deployments closely
- Keep production branch stable

### **Branch Management:**
- Keep all environment branches in sync with master
- Use the management script for all operations
- Commit deployment timestamps for tracking
- Never make direct changes to environment branches

## 🔄 Maintenance

### **Regular Tasks:**
- **Weekly**: Sync all environment branches with master
- **Monthly**: Review and rotate service account keys
- **Quarterly**: Update dependencies across all environments
- **As needed**: Backup important data

### **Key Rotation:**
```bash
# Generate new service account keys
gcloud iam service-accounts keys create ~/cnidaria-dev-key-new.json \
  --iam-account=cnidaria-api-dev@cnidaria-dev.iam.gserviceaccount.com

# Update environment files
# Redeploy functions
```

## 🔗 Related Documentation

- [Multi-Environment Setup](MULTI_ENVIRONMENT_SETUP.md)
- [API Reference](Docs/API_REFERENCE.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Firebase Integration](FIREBASE_INTEGRATION.md)

## 📞 Support

For issues or questions about the environment management system:
1. Check the troubleshooting section above
2. Review the logs in Google Cloud Console
3. Verify branch and project configurations
4. Use the management script for all operations

---

**Remember**: Always use the management script (`./scripts/manage-environments.sh`) for environment operations to ensure consistency and proper configuration.
