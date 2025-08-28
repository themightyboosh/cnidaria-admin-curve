// Environment Configuration for Cnidaria Admin Curve
const environments = {
  development: {
    name: 'Development',
    apiUrl: 'https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev',
    firebaseProject: 'cnidaria-dev',
    description: 'Development environment for testing and development'
  },
  staging: {
    name: 'Staging',
    apiUrl: 'https://us-central1-cnidaria-stage.cloudfunctions.net/cnidaria-api-stage',
    firebaseProject: 'cnidaria-stage',
    description: 'Staging environment for QA and integration testing'
  },
  production: {
    name: 'Production',
    apiUrl: 'https://us-central1-cnidaria-prod.cloudfunctions.net/cnidaria-api-prod',
    firebaseProject: 'cnidaria-prod',
    description: 'Production environment for live use'
  }
};

// Get current environment from localStorage or default to development
const getCurrentEnvironment = () => {
  return localStorage.getItem('cnidaria-environment') || 'development';
};

// Set current environment
const setCurrentEnvironment = (env) => {
  if (environments[env]) {
    localStorage.setItem('cnidaria-environment', env);
    return true;
  }
  return false;
};

// Get environment config
const getEnvironmentConfig = (env = null) => {
  const environment = env || getCurrentEnvironment();
  return environments[environment] || environments.development;
};

// Get all environments
const getAllEnvironments = () => {
  return Object.keys(environments);
};

// Validate environment
const isValidEnvironment = (env) => {
  return environments.hasOwnProperty(env);
};

// Get API base URL for current environment
const getApiBaseUrl = () => {
  return getEnvironmentConfig().apiUrl;
};

module.exports = {
  environments,
  getCurrentEnvironment,
  setCurrentEnvironment,
  getEnvironmentConfig,
  getAllEnvironments,
  isValidEnvironment,
  getApiBaseUrl
};
