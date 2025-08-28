const fetch = require('node-fetch');

const PROD_API_URL = 'https://us-central1-cnidaria-prod.cloudfunctions.net/cnidaria-api-prod';

// Random curve types
const curveTypes = ['Radial', 'Cartesian X', 'Cartesian Y'];

// Random tags for variety
const possibleTags = [
  'terrain', 'mountain', 'valley', 'plateau', 'canyon', 'hill', 'cliff',
  'beach', 'desert', 'forest', 'swamp', 'volcano', 'cave', 'ridge',
  'test', 'demo', 'sample', 'random', 'generated', 'auto', 'batch',
  'production', 'live', 'stable', 'verified', 'tested'
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
  const noiseScale = (Math.random() * 0.8) + 0.1; // 0.1-0.9
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
    "curve-name": `Production Curve ${index + 1}`,
    "curve-description": `Production environment curve #${index + 1} for ${curveType} system`,
    "curve-tags": tags,
    "curve-type": curveType,
    "curve-width": width,
    "curve-data": curveData,
    "curve-index-scaling": parseFloat(indexScaling.toFixed(2)),
    "coordinate-noise-strength": parseFloat(noiseStrength.toFixed(2)),
    "coordinate-noise-scale": parseFloat(noiseScale.toFixed(2)),
    "coordinate-noise-seed": noiseSeed
  };
}

// Create a curve via API
async function createCurve(curveData) {
  try {
    console.log(`🔄 Creating curve: ${curveData["curve-name"]}`);
    
    const response = await fetch(`${PROD_API_URL}/api/curves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(curveData)
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data && result.data.id) {
        console.log(`✅ Successfully created curve: ${result.data.id}`);
        return result.data;
      } else {
        console.error(`❌ Unexpected response structure:`, JSON.stringify(result, null, 2));
        return null;
      }
    } else {
      const errorText = await response.text();
      console.error(`❌ Failed to create curve: ${response.status} ${errorText}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error creating curve:`, error.message);
    return null;
  }
}

// Generate curves for production
async function generateProductionCurves(count = 33) {
  console.log(`🚀 Generating ${count} curves for Production Environment`);
  console.log(`API URL: ${PROD_API_URL}\n`);
  
  const results = [];
  const batchSize = 5; // Process in batches to avoid overwhelming the API
  
  for (let i = 0; i < count; i += batchSize) {
    const batch = [];
    for (let j = 0; j < batchSize && (i + j) < count; j++) {
      batch.push(generateRandomCurve(i + j));
    }
    
    console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(count/batchSize)}`);
    
    // Create curves in parallel within the batch
    const batchPromises = batch.map(curveData => createCurve(curveData));
    const batchResults = await Promise.all(batchPromises);
    
    results.push(...batchResults.filter(result => result !== null));
    
    // Small delay between batches
    if (i + batchSize < count) {
      console.log('⏳ Waiting 1 second before next batch...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`\n🎯 Generated ${results.length}/${count} curves successfully`);
  return results;
}

// Main function
async function main() {
  const startTime = Date.now();
  
  try {
    const results = await generateProductionCurves(33);
    
    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log('\n🎉 Production Curve Generation Complete!');
    console.log('========================================');
    console.log(`Total curves created: ${results.length}/33`);
    console.log(`Total time: ${totalTime.toFixed(2)} seconds`);
    
    // Summary by curve type
    const typeCounts = {};
    results.forEach(curve => {
      const type = curve["curve-type"];
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    console.log('\n📊 Curve Type Distribution:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} curves`);
    });
    
    // List all curve IDs
    console.log('\n🆔 Created Curve IDs:');
    results.forEach((curve, index) => {
      console.log(`  ${index + 1}. ${curve.id} - ${curve["curve-name"]}`);
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
  generateProductionCurves
};
