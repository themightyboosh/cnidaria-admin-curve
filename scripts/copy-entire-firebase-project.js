#!/usr/bin/env node

/**
 * Firebase Project Copy Script
 * 
 * This script copies ALL collections from cnidaria-dev to cnidaria-stage and cnidaria-prod
 * This ensures all environments have identical data
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

// Collections to copy (all collections in the project)
const COLLECTIONS_TO_COPY = ['curves', 'tags', 'noise'];

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
 * Clear all documents from a collection (for clean copy)
 */
async function clearCollection(app, collectionName) {
  const db = app.firestore();
  const snapshot = await db.collection(collectionName).get();
  
  if (snapshot.size === 0) {
    console.log(`    📭 Collection '${collectionName}' is already empty`);
    return;
  }
  
  console.log(`    🗑️  Clearing ${snapshot.size} existing documents from '${collectionName}'...`);
  
  const batch = db.batch();
  snapshot.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`    ✅ Cleared ${snapshot.size} documents from '${collectionName}'`);
}

/**
 * Copy documents to target collection
 */
async function copyDocuments(sourceApp, targetApp, collectionName, documents) {
  const targetDb = targetApp.firestore();
  
  if (documents.length === 0) {
    console.log(`    ⚠️  No documents to copy for collection '${collectionName}'`);
    return;
  }
  
  console.log(`    📝 Copying ${documents.length} documents to '${collectionName}'...`);
  
  // Use batches to handle large collections efficiently
  const batchSize = 500; // Firestore batch limit
  const batches = [];
  
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = targetDb.batch();
    const chunk = documents.slice(i, i + batchSize);
    
    chunk.forEach(doc => {
      const docRef = targetDb.collection(collectionName).doc(doc.id);
      batch.set(docRef, doc.data);
    });
    
    batches.push(batch);
  }
  
  // Execute all batches
  for (let i = 0; i < batches.length; i++) {
    await batches[i].commit();
    console.log(`      ✅ Batch ${i + 1}/${batches.length} committed`);
  }
  
  console.log(`    ✅ Successfully copied ${documents.length} documents to '${collectionName}'`);
}

/**
 * Verify collection in target
 */
async function verifyCollection(app, collectionName) {
  const db = app.firestore();
  const snapshot = await db.collection(collectionName).get();
  
  console.log(`    📊 Collection '${collectionName}' now contains ${snapshot.size} documents`);
  
  // Show sample documents for non-empty collections
  if (snapshot.size > 0) {
    const sampleDocs = [];
    snapshot.forEach(doc => {
      if (sampleDocs.length < 2) {
        const data = doc.data();
        sampleDocs.push({
          id: doc.id,
          name: data.name || data['curve-name'] || data.id || 'Unknown',
          type: collectionName
        });
      }
    });
    
    console.log(`    📋 Sample documents in '${collectionName}':`);
    sampleDocs.forEach(doc => {
      console.log(`      • ${doc.name} (${doc.type})`);
    });
  }
}

/**
 * Copy entire project from source to target
 */
async function copyEntireProject(sourceEnv, targetEnv) {
  console.log(`\n🔄 Copying entire project from ${sourceEnv.name} to ${targetEnv.name}...`);
  
  try {
    // Initialize source Firebase
    console.log(`  🔧 Initializing source Firebase (${sourceEnv.projectId})...`);
    const sourceApp = initializeFirebase(sourceEnv.projectId, sourceEnv.keyPath);
    
    // Initialize target Firebase
    console.log(`  🔧 Initializing target Firebase (${targetEnv.projectId})...`);
    const targetApp = initializeFirebase(targetEnv.projectId, targetEnv.keyPath);
    
    const projectStats = {
      totalCollections: 0,
      totalDocuments: 0,
      collectionsCopied: 0,
      documentsCopied: 0
    };
    
    // Copy each collection
    for (const collectionName of COLLECTIONS_TO_COPY) {
      console.log(`\n  📋 Processing collection: '${collectionName}'`);
      
      try {
        // Get all documents from source
        console.log(`    📥 Fetching documents from source collection '${collectionName}'...`);
        const documents = await getAllDocuments(sourceApp, collectionName);
        
        projectStats.totalCollections++;
        projectStats.totalDocuments += documents.length;
        
        if (documents.length === 0) {
          console.log(`    ⚠️  No documents found in source collection '${collectionName}'`);
          continue;
        }
        
        console.log(`    📊 Found ${documents.length} documents to copy`);
        
        // Clear target collection for clean copy
        await clearCollection(targetApp, collectionName);
        
        // Copy documents to target
        await copyDocuments(sourceApp, targetApp, collectionName, documents);
        
        // Verify the copy
        console.log(`    🔍 Verifying copy...`);
        await verifyCollection(targetApp, collectionName);
        
        projectStats.collectionsCopied++;
        projectStats.documentsCopied += documents.length;
        
      } catch (error) {
        console.error(`    ❌ Failed to copy collection '${collectionName}': ${error.message}`);
      }
    }
    
    // Clean up apps
    await sourceApp.delete();
    await targetApp.delete();
    
    console.log(`\n  ✅ Successfully copied project from ${sourceEnv.name} to ${targetEnv.name}`);
    console.log(`  📊 Project Stats:`);
    console.log(`    • Collections processed: ${projectStats.totalCollections}`);
    console.log(`    • Collections copied: ${projectStats.collectionsCopied}`);
    console.log(`    • Total documents: ${projectStats.totalDocuments}`);
    console.log(`    • Documents copied: ${projectStats.documentsCopied}`);
    
  } catch (error) {
    console.error(`  ❌ Failed to copy project: ${error.message}`);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Firebase Project Copy...');
  console.log(`📋 Collections to copy: ${COLLECTIONS_TO_COPY.join(', ')}`);
  console.log(`🔄 Source: ${ENVIRONMENTS.source.name} (${ENVIRONMENTS.source.projectId})`);
  console.log(`🎯 Targets: ${ENVIRONMENTS.stage.name}, ${ENVIRONMENTS.prod.name}\n`);
  
  try {
    // Copy to staging
    await copyEntireProject(ENVIRONMENTS.source, ENVIRONMENTS.stage);
    
    // Copy to production
    await copyEntireProject(ENVIRONMENTS.source, ENVIRONMENTS.prod);
    
    console.log('\n🎉 All Firebase projects copied successfully!');
    console.log('\n📊 Final Summary:');
    console.log(`  ✅ ${ENVIRONMENTS.stage.name}: Entire project copied`);
    console.log(`  ✅ ${ENVIRONMENTS.prod.name}: Entire project copied`);
    console.log(`\n🔗 All environments now have identical data:`);
    console.log(`  • Development: ${ENVIRONMENTS.source.projectId}`);
    console.log(`  • Staging: ${ENVIRONMENTS.stage.projectId}`);
    console.log(`  • Production: ${ENVIRONMENTS.prod.projectId}`);
    
  } catch (error) {
    console.error(`\n❌ Firebase project copy failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main();
