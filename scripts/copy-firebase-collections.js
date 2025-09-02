#!/usr/bin/env node

/**
 * Firebase Collection Copy Script
 * 
 * This script copies the 'noise' collection from cnidaria-dev to cnidaria-stage and cnidaria-prod
 */

const admin = require('firebase-admin');
const path = require('path');

// Environment configurations
const ENVIRONMENTS = {
  source: {
    name: 'Development (Source)',
    projectId: 'cnidaria-dev',
    keyPath: path.join(__dirname, '..', 'cnidaria-dev-firebase-adminsdk.json')
  },
  stage: {
    name: 'Staging (Target)',
    projectId: 'cnidaria-stage',
    keyPath: path.join(__dirname, '..', 'cnidaria-stage-firebase-adminsdk.json')
  },
  prod: {
    name: 'Production (Target)',
    projectId: 'cnidaria-prod',
    keyPath: path.join(__dirname, '..', 'cnidaria-prod-firebase-adminsdk.json')
  }
};

// Collection to copy
const COLLECTION_NAME = 'noise';

/**
 * Initialize Firebase Admin SDK for a specific project
 */
function initializeFirebase(projectId, keyPath) {
  try {
    const serviceAccount = require(keyPath);
    
    // Initialize the app with the service account
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId
    }, projectId); // Use projectId as app name to avoid conflicts
    
    return app;
  } catch (error) {
    throw new Error(`Failed to initialize Firebase for ${projectId}: ${error.message}`);
  }
}

/**
 * Get all documents from a collection
 */
async function getAllDocuments(app, collectionName) {
  const db = app.firestore();
  const snapshot = await db.collection(collectionName).get();
  
  const documents = [];
  snapshot.forEach(doc => {
    documents.push({
      id: doc.id,
      data: doc.data()
    });
  });
  
  return documents;
}

/**
 * Copy documents to target collection
 */
async function copyDocuments(sourceApp, targetApp, collectionName, documents) {
  const targetDb = targetApp.firestore();
  const batch = targetDb.batch();
  
  console.log(`  📝 Copying ${documents.length} documents...`);
  
  for (const doc of documents) {
    const docRef = targetDb.collection(collectionName).doc(doc.id);
    batch.set(docRef, doc.data);
  }
  
  await batch.commit();
  console.log(`  ✅ Successfully copied ${documents.length} documents`);
}

/**
 * Verify collection in target
 */
async function verifyCollection(app, collectionName) {
  const db = app.firestore();
  const snapshot = await db.collection(collectionName).get();
  
  console.log(`  📊 Collection '${collectionName}' now contains ${snapshot.size} documents`);
  
  // Show sample documents
  const sampleDocs = [];
  snapshot.forEach(doc => {
    if (sampleDocs.length < 3) {
      sampleDocs.push({
        id: doc.id,
        name: doc.data().name,
        category: doc.data().category,
        cpuLoadLevel: doc.data().cpuLoadLevel
      });
    }
  });
  
  if (sampleDocs.length > 0) {
    console.log('  📋 Sample documents:');
    sampleDocs.forEach(doc => {
      console.log(`    • ${doc.name} (${doc.category}) - CPU Level ${doc.cpuLoadLevel}`);
    });
  }
}

/**
 * Copy collection from source to target
 */
async function copyCollection(sourceEnv, targetEnv) {
  console.log(`\n🔄 Copying from ${sourceEnv.name} to ${targetEnv.name}...`);
  
  try {
    // Initialize source Firebase
    console.log(`  🔧 Initializing source Firebase (${sourceEnv.projectId})...`);
    const sourceApp = initializeFirebase(sourceEnv.projectId, sourceEnv.keyPath);
    
    // Initialize target Firebase
    console.log(`  🔧 Initializing target Firebase (${targetEnv.projectId})...`);
    const targetApp = initializeFirebase(targetEnv.projectId, targetEnv.keyPath);
    
    // Get all documents from source
    console.log(`  📥 Fetching documents from source collection '${COLLECTION_NAME}'...`);
    const documents = await getAllDocuments(sourceApp, COLLECTION_NAME);
    
    if (documents.length === 0) {
      console.log(`  ⚠️  No documents found in source collection '${COLLECTION_NAME}'`);
      return;
    }
    
    console.log(`  📊 Found ${documents.length} documents to copy`);
    
    // Copy documents to target
    await copyDocuments(sourceApp, targetApp, COLLECTION_NAME, documents);
    
    // Verify the copy
    console.log(`  🔍 Verifying copy...`);
    await verifyCollection(targetApp, COLLECTION_NAME);
    
    // Clean up apps
    await sourceApp.delete();
    await targetApp.delete();
    
    console.log(`  ✅ Successfully copied collection from ${sourceEnv.name} to ${targetEnv.name}`);
    
  } catch (error) {
    console.error(`  ❌ Failed to copy collection: ${error.message}`);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Firebase Collection Copy...');
  console.log(`📋 Collection: ${COLLECTION_NAME}`);
  console.log(`🔄 Source: ${ENVIRONMENTS.source.name} (${ENVIRONMENTS.source.projectId})`);
  console.log(`🎯 Targets: ${ENVIRONMENTS.stage.name}, ${ENVIRONMENTS.prod.name}\n`);
  
  try {
    // Copy to staging
    await copyCollection(ENVIRONMENTS.source, ENVIRONMENTS.stage);
    
    // Copy to production
    await copyCollection(ENVIRONMENTS.source, ENVIRONMENTS.prod);
    
    console.log('\n🎉 All Firebase collections copied successfully!');
    console.log('\n📊 Summary:');
    console.log(`  ✅ ${ENVIRONMENTS.stage.name}: Collection '${COLLECTION_NAME}' copied`);
    console.log(`  ✅ ${ENVIRONMENTS.prod.name}: Collection '${COLLECTION_NAME}' copied`);
    
  } catch (error) {
    console.error(`\n❌ Firebase collection copy failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main();
