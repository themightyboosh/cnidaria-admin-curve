const fetch = require('node-fetch');

// Environment configurations
const environments = {
  development: {
    name: 'Development',
    apiUrl: 'https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev',
    color: '\x1b[32m' // Green
  },
  staging: {
    name: 'Staging',
    apiUrl: 'https://us-central1-cnidaria-stage.cloudfunctions.net/cnidaria-api-stage',
    color: '\x1b[33m' // Yellow
  },
  production: {
    name: 'Production',
    apiUrl: 'https://us-central1-cnidaria-prod.cloudfunctions.net/cnidaria-api-prod',
    color: '\x1b[31m' // Red
  }
};

// Random curve types
const curveTypes = ['Radial', 'Cartesian X', 'Cartesian Y'];

// Random tags for variety
const possibleTags = [
  'terrain', 'mountain', 'valley', 'plateau', 'canyon', 'hill', 'cliff',
  'beach', 'desert', 'forest', 'swamp', 'volcano', 'cave', 'ridge',
  'test', 'demo', 'sample', 'random', 'generated', 'auto', 'batch'
];

// Generate random curve data
function generateRandomCurve(index) {
  const curveType = curveTypes[Math.floor(Math.random() * curveTypes.length)];
  const width = Math.floor(Math.random() * 200) + 50; // 50-250
  
  // Generate random curve data points
  const curveData = [];
  for (let i = 0; i < width; i++) {
    curveData.push(Math.random() * 100); // Random values 0-100
  }
  
  // Random parameters
  const indexScaling = (Math.random() * 2) + 0.5; // 0.5-2.5
  const noiseStrength = Math.random() * 2; // 0-2
  const noiseScale = Math.random() * 1.0; // 0.0000-1.0000 (allows no noise)
  const noiseSeed = Math.floor(Math.random() * 1000);
  
  // Random tags (1-4 tags)
  const numTags = Math.floor(Math.random() * 4) + 1;
  const tags = [];
  for (let i = 0; i < numTags; i++) {
    const tag = possibleTags[Math.floor(Math.random() * possibleTags.length)];
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }
  
  return {
    "curve-name": `Random Curve ${index + 1}`,
    "curve-description": `Automatically generated test curve #${index + 1} for ${curveType} system`,
    "curve-tags": tags,
    "curve-type": curveType,
    "curve-width": width,
    "curve-data": curveData,
    "curve-index-scaling": indexScaling,
    "coordinate-noise-strength": noiseStrength,
    "coordinate-noise-scale": noiseScale,
    "coordinate-noise-seed": noiseSeed
  };
}

// Create a curve via API
async function createCurve(environment, curveData) {
  const env = environments[environment];
  const color = env.color;
  const reset = '\x1b[0m';
  
  try {
    console.log(`${color}[${env.name}]${reset} Creating curve: ${curveData["curve-name"]}`);
    
    const response = await fetch(`${env.apiUrl}/api/curves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(curveData)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`${color}[${env.name}]${reset} ✅ Successfully created curve: ${result.id}`);
      return result;
    } else {
      const errorText = await response.text();
      console.error(`${color}[${env.name}]${reset} ❌ Failed to create curve: ${response.status} ${errorText}`);
      return null;
    }
  } catch (error) {
    console.error(`${color}[${env.name}]${reset} ❌ Error creating curve:`, error.message);
    return null;
  }
}

// Generate curves for a specific environment
async function generateCurvesForEnvironment(environment, count = 33) {
  const env = environments[environment];
  const color = env.color;
  const reset = '\x1b[0m';
  
  console.log(`\n${color}=== Generating ${count} curves for ${env.name} ===${reset}`);
  
  const results = [];
  const batchSize = 5; // Process in batches to avoid overwhelming the API
  
  for (let i = 0; i < count; i += batchSize) {
    const batch = [];
    for (let j = 0; j < batchSize && (i + j) < count; j++) {
      batch.push(generateRandomCurve(i + j));
    }
    
    // Create curves in parallel within the batch
    const batchPromises = batch.map(curveData => createCurve(environment, curveData));
    const batchResults = await Promise.all(batchPromises);
    
    results.push(...batchResults.filter(result => result !== null));
    
    // Small delay between batches
    if (i + batchSize < count) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`${color}[${env.name}]${reset} 🎯 Generated ${results.length}/${count} curves successfully`);
  return results;
}

// Main function
async function main() {
  console.log('🚀 Starting random curve generation for all environments...\n');
  
  const startTime = Date.now();
  
  try {
    // Generate curves for all environments
    const devResults = await generateCurvesForEnvironment('development', 33);
    const stageResults = await generateCurvesForEnvironment('staging', 33);
    const prodResults = await generateCurvesForEnvironment('production', 33);
    
    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log('\n🎉 Curve Generation Complete!');
    console.log('================================');
    console.log(`Development: ${devResults.length}/33 curves`);
    console.log(`Staging: ${stageResults.length}/33 curves`);
    console.log(`Production: ${prodResults.length}/33 curves`);
    console.log(`Total time: ${totalTime.toFixed(2)} seconds`);
    
    // Summary by curve type
    const allResults = [...devResults, ...stageResults, ...prodResults];
    const typeCounts = {};
    allResults.forEach(curve => {
      const type = curve["curve-type"];
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    console.log('\n📊 Curve Type Distribution:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} curves`);
    });
    
  } catch (error) {
    console.error('❌ Error in main process:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateRandomCurve,
  createCurve,
  generateCurvesForEnvironment,
  environments
};
