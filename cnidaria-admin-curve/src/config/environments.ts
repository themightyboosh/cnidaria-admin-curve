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
const detectEnvironment = (): string => {
  // Check for explicit environment override
  if (process.env.NEXT_PUBLIC_ENVIRONMENT) {
    return process.env.NEXT_PUBLIC_ENVIRONMENT;
  }
  
  // Auto-detect based on hostname (client-side only)
  if (typeof window !== 'undefined') {
    const nextData = (window as { __NEXT_DATA__?: { props?: { environment?: string } } }).__NEXT_DATA__;
    if (nextData?.props?.environment) {
      return nextData.props.environment;
    }
    
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
  }
  
  // Default to development
  return 'development';
};

// Get configuration for current environment
export const getEnvironmentConfig = (): EnvironmentConfig => {
  const env = detectEnvironment();
  const isLocal = env === 'development' && (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
  
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
      apiUrl: 'http://localhost:3000',
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
      webUrl: process.env.NEXT_PUBLIC_WEB_URL || 'https://cnidaria-admin-curves-stage-824079132046.us-central1.run.app',
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
      webUrl: process.env.NEXT_PUBLIC_WEB_URL || 'https://cnidaria-admin-curves-prod-824079132046.us-central1.run.app',
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
  if (process.env.NEXT_PUBLIC_API_URL) {
    config.apiUrl = process.env.NEXT_PUBLIC_API_URL;
  }
  
  if (process.env.NEXT_PUBLIC_WEB_URL) {
    config.webUrl = process.env.NEXT_PUBLIC_WEB_URL;
  }
  
  if (process.env.NEXT_PUBLIC_APP_TITLE) {
    config.appTitle = process.env.NEXT_PUBLIC_APP_TITLE;
  }
  
  return config;
};

// Export current configuration (lazy evaluation for SSR compatibility)
let envCache: EnvironmentConfig | null = null;

export const getEnv = (): EnvironmentConfig => {
  if (envCache) return envCache;
  envCache = getEnvironmentConfig();
  return envCache;
};

// Export individual values for convenience (lazy evaluation)
export const getEnvironment = (): string => getEnv().environment;
export const getApiUrl = (): string => getEnv().apiUrl;
export const getWebUrl = (): string => getEnv().webUrl;
export const getAppTitle = (): string => getEnv().appTitle;
export const getIsLocal = (): boolean => getEnv().isLocal;
export const getIsProduction = (): boolean => getEnv().isProduction;
export const getIsStaging = (): boolean => getEnv().isStaging;
export const getIsDevelopment = (): boolean => getEnv().isDevelopment;
export const getDeployment = (): DeploymentConfig => getEnv().deployment;

// For backward compatibility, export the main config
export const env = getEnv();

// Deployment utility functions
export const getCloudRunServiceUrl = (serviceName?: string): string => {
  const service = serviceName || getDeployment().serviceName;
  return `https://${service}-824079132046.${getDeployment().region}.run.app`;
};

export const getDeploymentCommand = (targetEnv?: string): string => {
  const targetEnvironment = targetEnv || getEnvironment();
  return `./deploy-cloudrun-${targetEnvironment}.sh`;
};

export const isCloudRunDeployment = (): boolean => {
  return getDeployment().platform === 'cloud-run';
};

// Log environment info in development
if (getIsDevelopment() && getIsLocal()) {
  console.log('🌍 Environment Configuration:', {
    environment: getEnvironment(),
    apiUrl: getApiUrl(),
    webUrl: getWebUrl(),
    appTitle: getAppTitle(),
    isLocal: getIsLocal(),
    deployment: {
      platform: getDeployment().platform,
      serviceName: getDeployment().serviceName,
      region: getDeployment().region
    }
  });
}
