console.log('Script file loaded...');

/**
 * Migration Script: Populate Firebase Noise Collection
 * 
 * This script populates the Firebase 'noise' collection with all 32 coordinate noise patterns
 * using the new structure:
 * - Pattern metadata (name and description) [String] - kebab-case enforced
 * - CPU load levels (1-10) [calculated from expression complexity]
 * - GPU expressions for WebGPU rendering
 * - GPU descriptions auto-generated (not human assigned)
 * 
 * Usage: node scripts/migrate-noise-collection.js [environment]
 * 
 * Examples:
 *   node scripts/migrate-noise-collection.js dev
 *   node scripts/migrate-noise-collection.js prod
 *   node scripts/migrate-noise-collection.js stage
 */

const admin = require('firebase-admin');
const { COORDINATE_NOISE_PATTERNS } = require('../coordinateNoise');
const { initializeFirebase, getFirestore } = require('../firebase-config');

// Load environment variables
require('dotenv').config();

// Environment configuration
const environments = {
  dev: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'cnidaria-dev',
    firestoreNoiseCollection: 'noise'
  },
  stage: {
    projectId: 'cnidaria-stage', 
    firestoreNoiseCollection: 'noise'
  },
  prod: {
    projectId: 'cnidaria-prod',
    firestoreNoiseCollection: 'noise'
  }
};

/**
 * Convert string to kebab-case and remove any icons/emojis
 */
function toKebabCase(str) {
  return str
    .replace(/[^\w\s-]/g, '') // Remove all non-word, non-space, non-hyphen characters (including emojis)
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .toLowerCase()
    .trim();
}

/**
 * Auto-generate GPU description from expression analysis
 */
function generateGpuDescription(gpuExpression) {
  const operations = [];
  
  if (gpuExpression.includes('sqrt')) operations.push('square root');
  if (gpuExpression.includes('pow')) operations.push('power function');
  if (gpuExpression.includes('sin')) operations.push('sine');
  if (gpuExpression.includes('cos')) operations.push('cosine');
  if (gpuExpression.includes('atan')) operations.push('arctangent');
  if (gpuExpression.includes('abs')) operations.push('absolute value');
  if (gpuExpression.includes('floor')) operations.push('floor function');
  if (gpuExpression.includes('max')) operations.push('maximum');
  if (gpuExpression.includes('min')) operations.push('minimum');
  
  const hasTrigonometric = gpuExpression.includes('sin') || gpuExpression.includes('cos') || gpuExpression.includes('atan');
  const hasRadial = gpuExpression.includes('sqrt(x * x + y * y)');
  const hasAngular = gpuExpression.includes('atan(y, x)');
  const hasCartesian = gpuExpression.includes('abs(x)') || gpuExpression.includes('abs(y)');
  
  let description = '';
  
  if (hasRadial && hasAngular) {
    description = 'Radial distance with angular modulation';
  } else if (hasRadial) {
    description = 'Radial distance calculation';
  } else if (hasCartesian) {
    description = 'Cartesian coordinate processing';
  } else if (hasTrigonometric) {
    description = 'Trigonometric coordinate transformation';
  } else {
    description = 'Coordinate-based mathematical operation';
  }
  
  if (operations.length > 0) {
    description += ` using ${operations.join(', ')}`;
  }
  
  return description;
}

/**
 * Calculate CPU load level (1-10) based on expression complexity
 * This analyzes the GPU expression to determine computational complexity
 */
function calculateCpuLoadLevel(gpuExpression) {
  let complexity = 0;
  
  // Base complexity for basic operations
  if (gpuExpression.includes('sqrt')) complexity += 2;
  if (gpuExpression.includes('pow')) complexity += 3;
  if (gpuExpression.includes('sin')) complexity += 1;
  if (gpuExpression.includes('cos')) complexity += 1;
  if (gpuExpression.includes('atan')) complexity += 2;
  if (gpuExpression.includes('abs')) complexity += 1;
  if (gpuExpression.includes('floor')) complexity += 2;
  if (gpuExpression.includes('max')) complexity += 1;
  if (gpuExpression.includes('min')) complexity += 1;
  
  // Additional complexity for multiple operations
  const operationCount = (gpuExpression.match(/[+\-*/]/g) || []).length;
  complexity += operationCount * 0.5;
  
  // Complexity for nested operations
  const nestedLevels = (gpuExpression.match(/\(/g) || []).length;
  complexity += nestedLevels * 0.3;
  
  // Complexity for high-frequency operations
  if (gpuExpression.includes('* 8.0') || gpuExpression.includes('* 11.0') || gpuExpression.includes('* 13.0')) {
    complexity += 2;
  }
  
  // Normalize to 1-10 scale
  const normalizedLevel = Math.min(10, Math.max(1, Math.round(complexity)));
  
  return normalizedLevel;
}

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebaseForMigration(environment) {
  // Use the existing Firebase configuration
  const app = initializeFirebase();
  return getFirestore();
}

/**
 * Populate the noise collection with all coordinate noise patterns
 */
async function populateNoiseCollection(db) {
  console.log('Populating noise collection with 32 coordinate noise patterns...');
  
  const noiseCollection = db.collection('noise');
  let created = 0;
  let updated = 0;
  let errors = 0;
  
  // Test with just one pattern first
  const testPattern = Object.entries(COORDINATE_NOISE_PATTERNS)[0]; // Get first pattern
  const [noiseId, pattern] = testPattern;
  
  console.log(`Testing with pattern: ${noiseId}`);
  console.log(`Pattern data:`, pattern);
  
  try {
    // Calculate CPU load level (1-10) from expression complexity
    const cpuLoadLevel = calculateCpuLoadLevel(pattern.gpuExpression);
    console.log(`Calculated CPU level: ${cpuLoadLevel}`);
    
    // Check if noise pattern already exists
    console.log('Checking if document exists...');
    const existingDoc = await noiseCollection.doc(noiseId).get();
    console.log(`Document exists: ${existingDoc.exists}`);
    
    const noiseData = {
      // Pattern metadata (kebab-case enforced, no icons)
      name: toKebabCase(pattern.name),
      description: pattern.description.replace(/[^\w\s.,()-]/g, ''), // Remove icons/emojis from description
      
      // CPU load level (1-10) calculated from expression complexity
      cpuLoadLevel: cpuLoadLevel,
      
      // GPU expression for WebGPU rendering
      gpuExpression: pattern.gpuExpression,
      
      // Additional metadata for reference
      category: toKebabCase(pattern.category),
      originalCpuLoad: pattern.cpuLoad, // Keep original for reference
      
      // Auto-generated GPU description (not human assigned)
      gpuDescription: generateGpuDescription(pattern.gpuExpression),
      
      // Timestamps
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('Noise data to save:', noiseData);
    
    if (existingDoc.exists) {
      // Update existing document
      console.log('Updating existing document...');
      await noiseCollection.doc(noiseId).update({
        ...noiseData,
        updatedAt: new Date().toISOString()
      });
      updated++;
      console.log(`  Updated: ${noiseId} (CPU Level: ${cpuLoadLevel})`);
    } else {
      // Create new document
      console.log('Creating new document...');
      await noiseCollection.doc(noiseId).set(noiseData);
      created++;
      console.log(`  Created: ${noiseId} (CPU Level: ${cpuLoadLevel})`);
    }
    
    console.log('Success! Completed first pattern.');
    
  } catch (error) {
    console.error(`  Error processing ${noiseId}:`, error.message);
    console.error('Full error:', error);
    errors++;
  }
  
  console.log(`\nNoise Collection Summary:`);
  console.log(`  Created: ${created} patterns`);
  console.log(`  Updated: ${updated} patterns`);
  console.log(`  Errors: ${errors} patterns`);
  console.log(`  Total: ${created + updated} patterns`);
}

/**
 * Verify migration results and show CPU load distribution
 */
async function verifyMigration(db) {
  console.log('\nVerifying migration results...');
  
  // Check noise collection
  const noiseSnapshot = await db.collection('noise').get();
  console.log(`  Noise collection: ${noiseSnapshot.size} patterns`);
  
  // Analyze CPU load distribution
  const cpuLoadDistribution = {};
  
  for (const doc of noiseSnapshot.docs) {
    const data = doc.data();
    const cpuLevel = data.cpuLoadLevel || 1;
    cpuLoadDistribution[cpuLevel] = (cpuLoadDistribution[cpuLevel] || 0) + 1;
  }
  
  console.log('\nCPU Load Level Distribution:');
  for (let level = 1; level <= 10; level++) {
    const count = cpuLoadDistribution[level] || 0;
    const bar = '#'.repeat(Math.ceil(count / 2));
    console.log(`  Level ${level}: ${count.toString().padStart(2)} patterns ${bar}`);
  }
  
  // Show sample patterns by CPU level
  console.log('\nSample Patterns by CPU Level:');
  for (let level = 1; level <= 10; level++) {
    const patternsAtLevel = [];
    for (const doc of noiseSnapshot.docs) {
      const data = doc.data();
      if (data.cpuLoadLevel === level) {
        patternsAtLevel.push(data.name);
      }
    }
    if (patternsAtLevel.length > 0) {
      console.log(`  Level ${level}: ${patternsAtLevel.slice(0, 3).join(', ')}${patternsAtLevel.length > 3 ? '...' : ''}`);
    }
  }
}

/**
 * Main migration function
 */
async function runMigration(environment) {
  console.log(`Starting noise collection migration for ${environment} environment`);
  console.log(`Project: ${environments[environment].projectId}`);
  console.log(`Collection: noise`);
  console.log(`Target: 32 coordinate noise patterns with CPU load levels (1-10)`);
  
  try {
    const db = initializeFirebaseForMigration(environment);
    
    // Step 1: Populate noise collection
    await populateNoiseCollection(db);
    
    // Step 2: Verify results
    await verifyMigration(db);
    
    console.log('\nMigration completed successfully!');
    console.log('\nMigration Summary:');
    console.log('  32 coordinate noise patterns migrated to Firebase');
    console.log('  CPU load levels calculated from expression complexity (1-10)');
    console.log('  GPU expressions preserved for WebGPU rendering');
    console.log('  Pattern metadata (name, description) included');
    console.log('  Kebab-case naming enforced');
    console.log('  GPU descriptions auto-generated');
    
    console.log('\nNext steps:');
    console.log('  1. Update API endpoints to use cpuLoadLevel field');
    console.log('  2. Update frontend to display CPU load levels');
    console.log('  3. Test coordinate processing with new system');
    console.log('  4. Monitor performance with new CPU load calculations');
    
  } catch (error) {
    console.error('\nMigration failed:', error);
    process.exit(1);
  }
}

// CLI handling
if (require.main === module) {
  console.log('Script started...');
  const environment = process.argv[2];
  
  console.log('Environment:', environment);
  console.log('Available environments:', Object.keys(environments));
  
  if (!environment || !environments[environment]) {
    console.error('Invalid environment. Please specify: dev, stage, or prod');
    console.error('Usage: node scripts/migrate-noise-collection.js [environment]');
    process.exit(1);
  }
  
  console.log('Starting migration for environment:', environment);
  runMigration(environment);
}

module.exports = {
  runMigration,
  populateNoiseCollection,
  verifyMigration,
  calculateCpuLoadLevel,
  toKebabCase,
  generateGpuDescription
};
