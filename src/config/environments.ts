// Smart Environment Configuration
// Automatically detects environment and configures API endpoints

export interface DeploymentConfig {
  platform: 'cloud-run' | 'docker' | 'firebase';
  projectId: string;
  serviceName: string;
  region: string;
  imageRegistry: string;
}

export interface EnvironmentConfig {
  environment: string;
  apiUrl: string;
  webUrl: string;
  appTitle: string;
  isLocal: boolean;
  isProduction: boolean;
  isStaging: boolean;
  isDevelopment: boolean;
  deployment: DeploymentConfig;
}

// Environment detection
const getEnvironment = (): string => {
  // Check for explicit environment override
  if (import.meta.env.VITE_ENVIRONMENT) {
    return import.meta.env.VITE_ENVIRONMENT;
  }
  
  // Auto-detect based on hostname
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }
  
  // Check for Cloud Run service names
  if (hostname.includes('cnidaria-admin-curves-dev')) {
    return 'development';
  }
  
  if (hostname.includes('cnidaria-admin-curves-stage') || hostname.includes('stage') || hostname.includes('staging')) {
    return 'staging';
  }
  
  if (hostname.includes('cnidaria-admin-curves-prod') || hostname.includes('prod') || hostname.includes('production')) {
    return 'production';
  }
  
  // Default to development
  return 'development';
};

// Get configuration for current environment
export const getEnvironmentConfig = (): EnvironmentConfig => {
  const env = getEnvironment();
  const isLocal = env === 'development' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  // Standard Cloud Run deployment configuration
  const cloudRunDeployment = {
    platform: 'cloud-run' as const,
    projectId: 'zone-eaters',
    region: 'us-central1',
    imageRegistry: 'gcr.io'
  };

  // Environment-specific configurations
  const configs = {
    development: {
      environment: 'development',
      apiUrl: 'https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev',
      webUrl: isLocal ? window.location.origin : 'https://cnidaria-admin-curves-dev-824079132046.us-central1.run.app',
      appTitle: 'Cnidaria Admin Curves (Development)',
      isLocal: isLocal,
      isProduction: false,
      isStaging: false,
      isDevelopment: true,
      deployment: {
        ...cloudRunDeployment,
        serviceName: 'cnidaria-admin-curves-dev'
      }
    },
    staging: {
      environment: 'staging',
      apiUrl: 'https://us-central1-cnidaria-stage.cloudfunctions.net/cnidaria-api-stage',
      webUrl: import.meta.env.VITE_WEB_URL || 'https://cnidaria-admin-curves-stage-824079132046.us-central1.run.app',
      appTitle: 'Cnidaria Admin Curves (Staging)',
      isLocal: false,
      isProduction: false,
      isStaging: true,
      isDevelopment: false,
      deployment: {
        ...cloudRunDeployment,
        serviceName: 'cnidaria-admin-curves-stage'
      }
    },
    production: {
      environment: 'production',
      apiUrl: 'https://us-central1-cnidaria-prod.cloudfunctions.net/cnidaria-api-prod',
      webUrl: import.meta.env.VITE_WEB_URL || 'https://cnidaria-admin-curves-prod-824079132046.us-central1.run.app',
      appTitle: 'Cnidaria Admin Curves (Production)',
      isLocal: false,
      isProduction: true,
      isStaging: false,
      isDevelopment: false,
      deployment: {
        ...cloudRunDeployment,
        serviceName: 'cnidaria-admin-curves-prod'
      }
    }
  };
  
  const config = configs[env as keyof typeof configs] || configs.development;
  
  // Override with environment variables if present
  if (import.meta.env.VITE_API_URL) {
    config.apiUrl = import.meta.env.VITE_API_URL;
  }
  
  if (import.meta.env.VITE_WEB_URL) {
    config.webUrl = import.meta.env.VITE_WEB_URL;
  }
  
  if (import.meta.env.VITE_APP_TITLE) {
    config.appTitle = import.meta.env.VITE_APP_TITLE;
  }
  
  return config;
};

// Export current configuration
export const env = getEnvironmentConfig();

// Export individual values for convenience
export const {
  environment,
  apiUrl,
  webUrl,
  appTitle,
  isLocal,
  isProduction,
  isStaging,
  isDevelopment,
  deployment
} = env;

// Deployment utility functions
export const getCloudRunServiceUrl = (serviceName?: string): string => {
  const service = serviceName || deployment.serviceName;
  return `https://${service}-824079132046.${deployment.region}.run.app`;
};

export const getDeploymentCommand = (targetEnv?: string): string => {
  const targetEnvironment = targetEnv || environment;
  return `./deploy-cloudrun-${targetEnvironment}.sh`;
};

export const isCloudRunDeployment = (): boolean => {
  return deployment.platform === 'cloud-run';
};

// Log environment info in development
if (isDevelopment && isLocal) {
  console.log('🌍 Environment Configuration:', {
    environment,
    apiUrl,
    webUrl,
    appTitle,
    isLocal,
    deployment: {
      platform: deployment.platform,
      serviceName: deployment.serviceName,
      region: deployment.region
    }
  });
}
