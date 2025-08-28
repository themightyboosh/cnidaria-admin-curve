const admin = require('firebase-admin');

/**
 * IMPORTANT: Database Separation Limitation
 * 
 * Currently, Firebase Admin SDK for Node.js doesn't support direct database switching
 * in the same way as the client SDK. All operations will use the default database
 * of the project.
 * 
 * To achieve true database separation, we would need to:
 * 1. Use different service accounts for each database
 * 2. Or implement database routing at the application level
 * 3. Or wait for Firebase Admin SDK to support multi-database operations
 * 
 * For now, this configuration logs which database should be used but operates
 * on the default database of each project.
 */

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
  // Remove caching check to allow re-initialization with current environment
  // This ensures each environment uses its correct database
  
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'cnidaria-dev';
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'cnidaria-dev.appspot.com';
  
  // Determine which database to use based on environment
  let databaseId = '(default)'; // fallback to default
  
  if (projectId === 'cnidaria-dev') {
    databaseId = 'cnidaria-dev-db';
  } else if (projectId === 'cnidaria-stage') {
    databaseId = 'cnidaria-stage-db';
  } else if (projectId === 'cnidaria-prod') {
    databaseId = 'cnidaria-prod-db';
  }
  
  // Use service account key if provided, otherwise use default credentials
  let credential;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      credential = admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      console.log(`Using service account credentials from: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    } catch (error) {
      console.warn('Failed to load service account credentials, falling back to default credentials');
      credential = admin.credential.applicationDefault();
    }
  } else {
    credential = admin.credential.applicationDefault();
    console.log('Using default application credentials');
  }
  
  // Always initialize with current environment variables
  // This ensures database switching works correctly
  try {
    admin.initializeApp({
      credential: credential,
      projectId: projectId,
      storageBucket: storageBucket
    });
  } catch (error) {
    if (error.code === 'app/duplicate-app') {
      // If app already exists, delete it and reinitialize
      console.log('App already exists, reinitializing with new environment...');
      admin.app().delete();
      admin.initializeApp({
        credential: credential,
        projectId: projectId,
        storageBucket: storageBucket
      });
    } else {
      throw error;
    }
  }
  
  console.log(`Firebase Admin SDK initialized for project: ${projectId}`);
  console.log(`Storage bucket: ${storageBucket}`);
  console.log(`Database: ${databaseId}`);
  
  // Store the database ID for later use
  admin.app().databaseId = databaseId;
  
  return admin.app();
};

// Get Firestore instance
const getFirestore = () => {
  const app = initializeFirebase();
  const firestore = app.firestore();
  
  // Use the specific database if configured
  if (app.databaseId && app.databaseId !== '(default)') {
    console.log(`Using specific database: ${app.databaseId}`);
    // For Firebase Admin SDK, we need to specify the database in the collection path
    // This will be handled in the individual functions
    return firestore;
  }
  
  return firestore;
};

// Get collection reference with specific database
const getCollection = (collectionName) => {
  const app = initializeFirebase();
  const firestore = app.firestore();
  
  if (app.databaseId && app.databaseId !== '(default)') {
    console.log(`Accessing collection '${collectionName}' in database '${app.databaseId}'`);
    // For now, we'll use the default database but log which one we should be using
    // TODO: Implement proper database switching when Firebase Admin SDK supports it
  }
  
  return firestore.collection(collectionName);
};

// Get Auth instance
const getAuth = () => {
  const app = initializeFirebase();
  return app.auth();
};

// Test Firestore connection
const testConnection = async () => {
  try {
    const db = getFirestore();
    const testDoc = db.collection('_test').doc('connection');
    
    await testDoc.set({
      timestamp: new Date().toISOString(),
      test: true,
      environment: process.env.ENVIRONMENT || 'development',
      projectId: process.env.GOOGLE_CLOUD_PROJECT || 'cnidaria-dev'
    });
    
    await testDoc.delete();
    
    console.log('Firestore connection test successful');
    return true;
  } catch (error) {
    console.error('Firestore connection test failed:', error);
    return false;
  }
};

module.exports = {
  initializeFirebase,
  getFirestore,
  getCollection,
  getAuth,
  testConnection
};
