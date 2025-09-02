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

// "None" coordinate noise pattern - pure base value with no processing
const noneNoisePattern = {
  name: 'none',
  description: 'No coordinate noise processing - returns pure base value (100)',
  category: 'unopinionated',
  gpuExpression: '100',
  cpuLoadLevel: 1 // Minimal processing
};

// Create the "none" coordinate noise pattern
async function createNonePattern(environment) {
  const env = environments[environment];
  const color = env.color;
  const reset = '\x1b[0m';
  
  try {
    console.log(`${color}[${env.name}]${reset} Creating "none" coordinate noise pattern`);
    
    // Check if "none" pattern already exists
    const checkResponse = await fetch(`${env.apiUrl}/api/coordinate-noise/firebase`);
    if (checkResponse.ok) {
      const data = await checkResponse.json();
      if (data.success) {
        const existing = data.data?.noiseTypes?.find(n => n.name === 'none');
        if (existing) {
          console.log(`${color}[${env.name}]${reset} ⏭️  "none" pattern already exists`);
          return { created: false, existed: true };
        }
      }
    }
    
    const response = await fetch(`${env.apiUrl}/api/coordinate-noise`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(noneNoisePattern)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`${color}[${env.name}]${reset} ✅ Created "none" pattern (CPU: ${result.data?.cpuLoadLevel || 1})`);
      return { created: true, existed: false };
    } else {
      const errorData = await response.json();
      console.error(`${color}[${env.name}]${reset} ❌ Failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      return { created: false, existed: false };
    }
  } catch (error) {
    console.error(`${color}[${env.name}]${reset} ❌ Error:`, error.message);
    return { created: false, existed: false };
  }
}

// Add "none" pattern to all environments
async function main() {
  console.log('🔧 Adding "none" coordinate noise pattern to all environments...\n');
  
  const startTime = Date.now();
  
  try {
    // Add to all environments
    const devResults = await createNonePattern('development');
    const stageResults = await createNonePattern('staging');
    const prodResults = await createNonePattern('production');
    
    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log('\n🎉 "None" Coordinate Noise Pattern Added!');
    console.log('========================================');
    console.log(`Development: ${devResults.created ? 'Created' : (devResults.existed ? 'Already exists' : 'Failed')}`);
    console.log(`Staging: ${stageResults.created ? 'Created' : (stageResults.existed ? 'Already exists' : 'Failed')}`);
    console.log(`Production: ${prodResults.created ? 'Created' : (prodResults.existed ? 'Already exists' : 'Failed')}`);
    console.log(`Total time: ${totalTime.toFixed(2)} seconds`);
    
    console.log('\n📊 "None" Pattern Details:');
    console.log('  Name: none');
    console.log('  Expression: 100 (pure base value)');
    console.log('  Description: No coordinate noise processing');
    console.log('  Category: unopinionated');
    console.log('  CPU Load: 1 (minimal)');
    
    console.log('\n🎯 Usage:');
    console.log('  • Use "none" when you want pure coordinate-based calculations');
    console.log('  • Perfect for radial/cartesian-x/cartesian-y noise-calc modes');
    console.log('  • No additional noise processing applied');
    console.log('  • Returns constant base value of 100');
    
    console.log('\n🔄 Effect with noise-calc modes:');
    console.log('  • radial + none = pure radial distance from center');
    console.log('  • cartesian-x + none = pure X coordinate influence');
    console.log('  • cartesian-y + none = pure Y coordinate influence');
    
  } catch (error) {
    console.error('❌ Error in main process:', error);
    process.exit(1);
  }
}

// Run if called directly
main();
