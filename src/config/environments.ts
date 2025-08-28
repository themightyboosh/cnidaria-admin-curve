// Smart Environment Configuration
// Automatically detects environment and configures API endpoints

export interface EnvironmentConfig {
  environment: string;
  apiUrl: string;
  webUrl: string;
  appTitle: string;
  isLocal: boolean;
  isProduction: boolean;
  isStaging: boolean;
  isDevelopment: boolean;
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
  
  if (hostname.includes('stage') || hostname.includes('staging')) {
    return 'stage';
  }
  
  if (hostname.includes('prod') || hostname.includes('production')) {
    return 'prod';
  }
  
  // Default to development for local development
  return 'dev';
};

// Get configuration for current environment
export const getEnvironmentConfig = (): EnvironmentConfig => {
  const env = getEnvironment();
  const isLocal = env === 'development' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  // Environment-specific configurations
  const configs = {
    dev: {
      environment: 'dev',
      apiUrl: 'https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev',
      webUrl: 'http://localhost:5173',
      appTitle: 'Cnidaria Admin Curves (Dev)',
      isLocal: true,
      isProduction: false,
      isStaging: false,
      isDevelopment: true
    },
    stage: {
      environment: 'stage',
      apiUrl: 'https://us-central1-cnidaria-stage.cloudfunctions.net/cnidaria-api-stage',
      webUrl: import.meta.env.VITE_WEB_URL || 'https://cnidaria-admin-curves-stage-xxxxx-uc.a.run.app',
      appTitle: 'Cnidaria Admin Curves (Stage)',
      isLocal: false,
      isProduction: false,
      isStaging: true,
      isDevelopment: false
    },
    prod: {
      environment: 'prod',
      apiUrl: 'https://us-central1-cnidaria-prod.cloudfunctions.net/cnidaria-api-prod',
      webUrl: import.meta.env.VITE_WEB_URL || 'https://cnidaria-admin-curves-prod-xxxxx-uc.a.run.app',
      appTitle: 'Cnidaria Admin Curves (Prod)',
      isLocal: false,
      isProduction: true,
      isStaging: false,
      isDevelopment: false
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
  isDevelopment
} = env;

// Log environment info in development
if (isDevelopment) {
  console.log('🌍 Environment Configuration:', {
    environment,
    apiUrl,
    webUrl,
    appTitle,
    isLocal
  });
}
