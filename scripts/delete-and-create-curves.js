import fetch from 'node-fetch';

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

// Coordinate noise types
const coordinateNoiseTypes = ['radial', 'cartesian-x', 'cartesian-y', 'dna', 'lightning', 'spiral'];

// Random tags for variety
const possibleTags = [
  'terrain', 'mountain', 'valley', 'plateau', 'canyon', 'hill', 'cliff',
  'beach', 'desert', 'forest', 'swamp', 'volcano', 'cave', 'ridge',
  'test', 'demo', 'sample', 'random', 'generated', 'auto', 'batch',
  'wave', 'pattern', 'noise', 'fractal', 'organic', 'natural'
];

// Generate random curve data using modern generation methods
function generateRandomCurveData(width, mode = 'fractal') {
  const data = [];
  const min = Math.floor(Math.random() * 100);
  const max = min + Math.floor(Math.random() * 155) + 100; // Ensure max > min
  
  switch (mode) {
    case 'fractal':
      for (let i = 0; i < width; i++) {
        const t = (i / width) * Math.PI * 2;
        
        // Multiple frequency layers with true random phases and amplitudes
        const layer1 = Math.sin(t + Math.random() * Math.PI * 2) * (0.3 + Math.random() * 0.2);
        const layer2 = Math.sin(t * (1.5 + Math.random() * 2) + Math.random() * Math.PI * 2) * (0.15 + Math.random() * 0.2);
        const layer3 = Math.sin(t * (3 + Math.random() * 4) + Math.random() * Math.PI * 2) * (0.1 + Math.random() * 0.15);
        const layer4 = Math.sin(t * (6 + Math.random() * 6) + Math.random() * Math.PI * 2) * (0.05 + Math.random() * 0.1);
        const layer5 = Math.sin(t * (10 + Math.random() * 10) + Math.random() * Math.PI * 2) * (0.02 + Math.random() * 0.08);
        
        // Add significant random noise
        const noise = (Math.random() - 0.5) * 0.3;
        
        // Combine all layers with noise
        const value = layer1 + layer2 + layer3 + layer4 + layer5 + noise;
        data.push(Math.floor(((value + 1) / 2) * (max - min) + min));
      }
      break;
      
    case 'sine':
      for (let i = 0; i < width; i++) {
        const t = (i / width) * Math.PI * 2;
        const value = Math.sin(t);
        data.push(Math.floor(((value + 1) / 2) * (max - min) + min));
      }
      break;
      
    case 'sawtooth':
      for (let i = 0; i < width; i++) {
        const t = (i / width) * 2;
        const value = (t - Math.floor(t)) * 2 - 1;
        data.push(Math.floor(((value + 1) / 2) * (max - min) + min));
      }
      break;
      
    case 'square':
      for (let i = 0; i < width; i++) {
        const t = (i / width) * 2;
        const value = Math.sin(t * Math.PI) > 0 ? 1 : -1;
        data.push(Math.floor(((value + 1) / 2) * (max - min) + min));
      }
      break;
      
    case 'ramp':
      for (let i = 0; i < width; i++) {
        const progress = i / (width - 1);
        const value = min + (progress * (max - min));
        data.push(Math.floor(value));
      }
      break;
      
    case 'white-noise':
    default:
      for (let i = 0; i < width; i++) {
        const randomValue = (Math.random() - 0.5) * 2;
        const value = min + ((randomValue + 1) / 2) * (max - min);
        data.push(Math.floor(value));
      }
      break;
  }
  
  return data;
}

// Generate random curve
function generateRandomCurve(index) {
  const curveTypes = ['fractal', 'sine', 'sawtooth', 'square', 'ramp', 'white-noise'];
  const curveType = curveTypes[Math.floor(Math.random() * curveTypes.length)];
  const coordinateNoiseType = coordinateNoiseTypes[Math.floor(Math.random() * coordinateNoiseTypes.length)];
  
  // Use Fibonacci numbers for curve width
  const fibonacciNumbers = [8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];
  const width = fibonacciNumbers[Math.floor(Math.random() * fibonacciNumbers.length)];
  
  // Generate random curve data
  const curveData = generateRandomCurveData(width, curveType);
  
  // Random parameters
  const indexScaling = (Math.random() * 2) + 0.5; // 0.5-2.5
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
    "curve-name": `curve-${String(index + 1).padStart(2, '0')}`,
    "curve-description": `Generated curve #${index + 1} using ${curveType} pattern`,
    "curve-tags": tags,
    "coordinate-noise": coordinateNoiseType,
    "curve-width": width,
    "curve-data": curveData,
    "curve-index-scaling": parseFloat(indexScaling.toFixed(2)),
    "coordinate-noise-seed": noiseSeed
  };
}

// Delete all curves via API
async function deleteAllCurves(environment) {
  const env = environments[environment];
  const color = env.color;
  const reset = '\x1b[0m';
  
  try {
    console.log(`${color}[${env.name}]${reset} Fetching all curves...`);
    
    // First, get all curves
    const listResponse = await fetch(`${env.apiUrl}/api/curves`);
    if (!listResponse.ok) {
      console.error(`${color}[${env.name}]${reset} ❌ Failed to fetch curves: ${listResponse.status}`);
      return false;
    }
    
    const responseData = await listResponse.json();
    const curves = responseData.data?.curves || responseData.curves || responseData || [];
    console.log(`${color}[${env.name}]${reset} Found ${curves.length} curves to delete`);
    
    if (curves.length === 0) {
      console.log(`${color}[${env.name}]${reset} No curves to delete`);
      return true;
    }
    
    // Delete all curves
    const deletePromises = curves.map(curve => 
      fetch(`${env.apiUrl}/api/curves/${curve.id}`, { method: 'DELETE' })
    );
    
    const deleteResults = await Promise.all(deletePromises);
    const successCount = deleteResults.filter(response => response.ok).length;
    
    console.log(`${color}[${env.name}]${reset} ✅ Deleted ${successCount}/${curves.length} curves`);
    return successCount === curves.length;
    
  } catch (error) {
    console.error(`${color}[${env.name}]${reset} ❌ Error deleting curves:`, error.message);
    return false;
  }
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
          console.log(`${color}[${env.name}]${reset} ✅ Successfully created curve: ${result.id} (noise: ${result["coordinate-noise"]})`);
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

// Process environment: delete all curves and create new ones
async function processEnvironment(environment, count = 25) {
  const env = environments[environment];
  const color = env.color;
  const reset = '\x1b[0m';
  
  console.log(`\n${color}=== Processing ${env.name} ===${reset}`);
  
  // Step 1: Delete all existing curves
  console.log(`${color}[${env.name}]${reset} Step 1: Deleting all existing curves...`);
  const deleteSuccess = await deleteAllCurves(environment);
  
  if (!deleteSuccess) {
    console.error(`${color}[${env.name}]${reset} ❌ Failed to delete all curves, skipping creation`);
    return [];
  }
  
  // Step 2: Create new curves
  console.log(`${color}[${env.name}]${reset} Step 2: Creating ${count} new curves...`);
  
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
    
    console.log(`${color}[${env.name}]${reset} Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(count/batchSize)}`);
    
    results.push(...batchResults.filter(result => result !== null));
    
    // Small delay between batches
    if (i + batchSize < count) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`${color}[${env.name}]${reset} 🎯 Created ${results.length}/${count} curves successfully`);
  return results;
}

// Main function
async function main() {
  console.log('🚀 Starting curve deletion and creation process...\n');
  
  const startTime = Date.now();
  
  try {
    // Process all environments
    const devResults = await processEnvironment('development', 25);
    const stageResults = await processEnvironment('staging', 25);
    const prodResults = await processEnvironment('production', 25);
    
    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log('\n🎉 Process Complete!');
    console.log('===================');
    console.log(`Development: ${devResults.length}/25 curves`);
    console.log(`Staging: ${stageResults.length}/25 curves`);
    console.log(`Production: ${prodResults.length}/25 curves`);
    console.log(`Total time: ${totalTime.toFixed(2)} seconds`);
    
    // Summary by curve type
    const allResults = [...devResults, ...stageResults, ...prodResults];
    const noiseCounts = {};
    allResults.forEach(curve => {
      const noise = curve["coordinate-noise"];
      noiseCounts[noise] = (noiseCounts[noise] || 0) + 1;
    });
    
    console.log('\n📊 Coordinate Noise Distribution:');
    Object.entries(noiseCounts).forEach(([noise, count]) => {
      console.log(`  ${noise}: ${count} curves`);
    });
    
  } catch (error) {
    console.error('❌ Error in main process:', error);
    process.exit(1);
  }
}

// Run if called directly
main();
