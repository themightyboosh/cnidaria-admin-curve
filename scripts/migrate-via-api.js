#!/usr/bin/env node

/**
 * Migration Script: Coordinate Noise Patterns via API
 * 
 * This script migrates all coordinate noise patterns from the static coordinateNoise.js
 * file to Firebase using the new API endpoints.
 */

const fs = require('fs');
const path = require('path');

// API Configuration
const API_BASE_URL = 'https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev';
const COORDINATE_NOISE_ENDPOINT = `${API_BASE_URL}/api/coordinate-noise`;

// Load coordinate noise patterns from the static file
const coordinateNoisePath = path.join(__dirname, '..', 'coordinateNoise.js');
const coordinateNoiseContent = fs.readFileSync(coordinateNoisePath, 'utf8');

// Extract the coordinateNoise object from the file
// This is a simple approach - in production you might want to use a proper JS parser
const coordinateNoiseMatch = coordinateNoiseContent.match(/const coordinateNoise = ({[\s\S]*?});/);
if (!coordinateNoiseMatch) {
  console.error('❌ Could not find coordinateNoise object in coordinateNoise.js');
  process.exit(1);
}

// Evaluate the coordinateNoise object (safe in this context since we control the file)
const coordinateNoise = eval(`(${coordinateNoiseMatch[1]})`);

console.log(`📊 Found ${Object.keys(coordinateNoise).length} coordinate noise patterns to migrate`);
console.log('🚀 Starting migration via API...\n');

/**
 * Helper function to make API requests
 */
async function makeApiRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(endpoint, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${data.error?.message || data.message || 'Unknown error'}`);
    }
    
    return data;
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

/**
 * Check if a noise type already exists
 */
async function checkNoiseTypeExists(noiseId) {
  try {
    const response = await makeApiRequest(`${COORDINATE_NOISE_ENDPOINT}/firebase`);
    const existingTypes = response.data.noiseTypes;
    return existingTypes.some(type => type.id === noiseId);
  } catch (error) {
    console.warn(`⚠️  Could not check if ${noiseId} exists: ${error.message}`);
    return false;
  }
}

/**
 * Create a noise type via API
 */
async function createNoiseType(noiseData) {
  const { name, description, gpuExpression, category } = noiseData;
  
  const requestBody = {
    name,
    gpuExpression,
    description,
    category
  };

  try {
    const response = await makeApiRequest(COORDINATE_NOISE_ENDPOINT, 'POST', requestBody);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to create ${name}: ${error.message}`);
  }
}

/**
 * Update a noise type via API
 */
async function updateNoiseType(noiseId, noiseData) {
  const { name, description, gpuExpression, category } = noiseData;
  
  const requestBody = {
    name,
    gpuExpression,
    description,
    category
  };

  try {
    const response = await makeApiRequest(`${COORDINATE_NOISE_ENDPOINT}/${noiseId}`, 'PUT', requestBody);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to update ${noiseId}: ${error.message}`);
  }
}

/**
 * Main migration function
 */
async function migrateCoordinateNoise() {
  const patterns = Object.entries(coordinateNoise);
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  console.log('🔄 Processing patterns...\n');

  for (const [noiseId, pattern] of patterns) {
    try {
      console.log(`📝 Processing: ${noiseId}`);
      
      // Check if already exists
      const exists = await checkNoiseTypeExists(noiseId);
      if (exists) {
        console.log(`⏭️  Skipping ${noiseId} - already exists`);
        skippedCount++;
        continue;
      }

      // Prepare data for API
      const noiseData = {
        name: pattern.name,
        description: pattern.description,
        gpuExpression: pattern.gpuExpression,
        category: pattern.category || 'custom'
      };

      // Create via API
      const result = await createNoiseType(noiseData);
      
      console.log(`✅ Created: ${result.name} (CPU Level: ${result.cpuLoadLevel})`);
      console.log(`   Description: ${result.gpuDescription}`);
      successCount++;

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`❌ Error processing ${noiseId}: ${error.message}`);
      errorCount++;
    }
  }

  // Summary
  console.log('\n📊 Migration Summary:');
  console.log(`✅ Successfully migrated: ${successCount}`);
  console.log(`⏭️  Skipped (already exists): ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📈 Total processed: ${patterns.length}`);

  if (errorCount > 0) {
    console.log('\n⚠️  Some patterns failed to migrate. Check the errors above.');
    process.exit(1);
  } else {
    console.log('\n🎉 Migration completed successfully!');
  }
}

/**
 * Verify migration by fetching all patterns from Firebase
 */
async function verifyMigration() {
  try {
    console.log('\n🔍 Verifying migration...');
    const response = await makeApiRequest(`${COORDINATE_NOISE_ENDPOINT}/firebase`);
    const { noiseTypes, total, cpuLoadDistribution } = response.data;
    
    console.log(`📊 Firebase now contains ${total} coordinate noise types`);
    console.log('📈 CPU Load Distribution:');
    
    Object.entries(cpuLoadDistribution)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([level, count]) => {
        console.log(`   Level ${level}: ${count} patterns`);
      });

    console.log('\n📋 Sample patterns in Firebase:');
    noiseTypes.slice(0, 5).forEach(type => {
      console.log(`   • ${type.name} (${type.category}) - CPU Level ${type.cpuLoadLevel}`);
    });

    if (noiseTypes.length > 5) {
      console.log(`   ... and ${noiseTypes.length - 5} more`);
    }

  } catch (error) {
    console.error(`❌ Verification failed: ${error.message}`);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await migrateCoordinateNoise();
    await verifyMigration();
  } catch (error) {
    console.error(`❌ Migration failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the migration
main();
