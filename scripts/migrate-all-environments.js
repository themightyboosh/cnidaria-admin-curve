#!/usr/bin/env node

/**
 * Migration Script: Coordinate Noise Patterns to All Environments
 * 
 * This script migrates all coordinate noise patterns to dev, stage, and prod environments.
 */

const fs = require('fs');
const path = require('path');

// Environment configurations
const ENVIRONMENTS = {
  dev: {
    name: 'Development',
    apiUrl: 'https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev',
    projectId: 'cnidaria-dev'
  },
  stage: {
    name: 'Staging', 
    apiUrl: 'https://us-central1-cnidaria-stage.cloudfunctions.net/cnidaria-api-stage',
    projectId: 'cnidaria-stage'
  },
  prod: {
    name: 'Production',
    apiUrl: 'https://us-central1-cnidaria-prod.cloudfunctions.net/cnidaria-api-prod', 
    projectId: 'cnidaria-prod'
  }
};

// Load coordinate noise patterns from the static file
const coordinateNoisePath = path.join(__dirname, '..', 'coordinateNoise.js');
const coordinateNoiseContent = fs.readFileSync(coordinateNoisePath, 'utf8');

// Extract the coordinateNoise object from the file
const coordinateNoiseMatch = coordinateNoiseContent.match(/const COORDINATE_NOISE_PATTERNS = ({[\s\S]*?});/);
if (!coordinateNoiseMatch) {
  console.error('❌ Could not find COORDINATE_NOISE_PATTERNS object in coordinateNoise.js');
  process.exit(1);
}

// Evaluate the coordinateNoise object
const coordinateNoise = eval(`(${coordinateNoiseMatch[1]})`);

console.log(`📊 Found ${Object.keys(coordinateNoise).length} coordinate noise patterns to migrate`);
console.log('🚀 Starting migration to all environments...\n');

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
 * Check if a noise type already exists in an environment
 */
async function checkNoiseTypeExists(apiUrl, noiseId) {
  try {
    const response = await makeApiRequest(`${apiUrl}/api/coordinate-noise/firebase`);
    const existingTypes = response.data.noiseTypes;
    return existingTypes.some(type => type.id === noiseId);
  } catch (error) {
    console.warn(`⚠️  Could not check if ${noiseId} exists in ${apiUrl}: ${error.message}`);
    return false;
  }
}

/**
 * Create a noise type via API
 */
async function createNoiseType(apiUrl, noiseData) {
  const { name, description, gpuExpression, category } = noiseData;
  
  const requestBody = {
    name,
    gpuExpression,
    description,
    category
  };

  try {
    const response = await makeApiRequest(`${apiUrl}/api/coordinate-noise`, 'POST', requestBody);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to create ${name}: ${error.message}`);
  }
}

/**
 * Migrate patterns to a specific environment
 */
async function migrateToEnvironment(envKey, envConfig) {
  console.log(`\n🌍 Migrating to ${envConfig.name} (${envKey.toUpperCase()})...`);
  console.log(`📡 API URL: ${envConfig.apiUrl}`);
  
  const patterns = Object.entries(coordinateNoise);
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const [noiseId, pattern] of patterns) {
    try {
      console.log(`  📝 Processing: ${noiseId}`);
      
      // Check if already exists
      const exists = await checkNoiseTypeExists(envConfig.apiUrl, noiseId);
      if (exists) {
        console.log(`    ⏭️  Skipping ${noiseId} - already exists`);
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
      const result = await createNoiseType(envConfig.apiUrl, noiseData);
      
      console.log(`    ✅ Created: ${result.name} (CPU Level: ${result.cpuLoadLevel})`);
      successCount++;

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`    ❌ Error processing ${noiseId}: ${error.message}`);
      errorCount++;
    }
  }

  // Summary for this environment
  console.log(`\n📊 ${envConfig.name} Migration Summary:`);
  console.log(`  ✅ Successfully migrated: ${successCount}`);
  console.log(`  ⏭️  Skipped (already exists): ${skippedCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  📈 Total processed: ${patterns.length}`);

  return { successCount, errorCount, skippedCount };
}

/**
 * Verify migration for a specific environment
 */
async function verifyEnvironment(envKey, envConfig) {
  try {
    console.log(`\n🔍 Verifying ${envConfig.name} migration...`);
    const response = await makeApiRequest(`${envConfig.apiUrl}/api/coordinate-noise/firebase`);
    const { noiseTypes, total, cpuLoadDistribution } = response.data;
    
    console.log(`📊 ${envConfig.name} now contains ${total} coordinate noise types`);
    console.log('📈 CPU Load Distribution:');
    
    Object.entries(cpuLoadDistribution)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([level, count]) => {
        console.log(`   Level ${level}: ${count} patterns`);
      });

  } catch (error) {
    console.error(`❌ ${envConfig.name} verification failed: ${error.message}`);
  }
}

/**
 * Main migration function
 */
async function migrateAllEnvironments() {
  const results = {};
  
  for (const [envKey, envConfig] of Object.entries(ENVIRONMENTS)) {
    try {
      const result = await migrateToEnvironment(envKey, envConfig);
      results[envKey] = result;
      
      // Verify the migration
      await verifyEnvironment(envKey, envConfig);
      
    } catch (error) {
      console.error(`❌ Migration to ${envConfig.name} failed: ${error.message}`);
      results[envKey] = { successCount: 0, errorCount: 1, skippedCount: 0 };
    }
  }

  // Overall summary
  console.log('\n🎯 OVERALL MIGRATION SUMMARY:');
  console.log('================================');
  
  for (const [envKey, result] of Object.entries(results)) {
    const envName = ENVIRONMENTS[envKey].name;
    console.log(`${envName}:`);
    console.log(`  ✅ Success: ${result.successCount}`);
    console.log(`  ⏭️  Skipped: ${result.skippedCount}`);
    console.log(`  ❌ Errors: ${result.errorCount}`);
  }

  const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errorCount, 0);
  if (totalErrors > 0) {
    console.log('\n⚠️  Some migrations had errors. Check the details above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All environment migrations completed successfully!');
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await migrateAllEnvironments();
  } catch (error) {
    console.error(`❌ Migration failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the migration
main();
