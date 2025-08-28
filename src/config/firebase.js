const admin = require('firebase-admin');
const logger = require('../utils/logger');

let firebaseApp = null;

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
  try {
    // Check if Firebase is already initialized
    if (firebaseApp) {
      logger.info('Firebase already initialized');
      return firebaseApp;
    }

    // Check if we have service account credentials
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      // Initialize with service account credentials
      const serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI,
        token_uri: process.env.FIREBASE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
      };

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
      });

      logger.info('Firebase Admin SDK initialized with service account');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Initialize with Google Application Default Credentials
      firebaseApp = admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'zone-eaters',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'zone-eaters.appspot.com'
      });

      logger.info('Firebase Admin SDK initialized with default credentials');
    } else {
      // Initialize with project ID only (for development)
      firebaseApp = admin.initializeApp({
        projectId: 'zone-eaters',
        storageBucket: 'zone-eaters.appspot.com'
      });

      logger.warn('Firebase Admin SDK initialized in development mode - no authentication configured');
    }

    return firebaseApp;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
};

// Get Firebase Admin instance
const getFirebaseAdmin = () => {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return firebaseApp;
};

// Get Firestore instance
const getFirestore = () => {
  const app = getFirebaseAdmin();
  return app.firestore();
};

// Get Auth instance
const getAuth = () => {
  const app = getFirebaseAdmin();
  return app.auth();
};

// Get Storage instance
const getStorage = () => {
  const app = getFirebaseAdmin();
  return app.storage();
};

// Get Analytics instance
const getAnalytics = () => {
  const app = getFirebaseAdmin();
  return app.analytics();
};

// Test Firebase connection
const testFirebaseConnection = async () => {
  try {
    const firestore = getFirestore();
    const testDoc = firestore.collection('_test').doc('connection');
    
    await testDoc.set({
      timestamp: new Date().toISOString(),
      test: true
    });

    await testDoc.delete();
    
    logger.info('Firebase connection test successful');
    return true;
  } catch (error) {
    logger.error('Firebase connection test failed:', error);
    return false;
  }
};

module.exports = {
  initializeFirebase,
  getFirebaseAdmin,
  getFirestore,
  getAuth,
  getStorage,
  getAnalytics,
  testFirebaseConnection
};
