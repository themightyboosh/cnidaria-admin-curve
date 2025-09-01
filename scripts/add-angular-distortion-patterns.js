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

// Angular distortion patterns using coordinates as random seeds
const angularDistortionPatterns = [
  {
    name: 'angular-wave',
    description: 'Angular wave distortion with coordinate-based randomization',
    category: 'angular',
    gpuExpression: 'sqrt(x * x + y * y) * (1.0 + 0.3 * sin(atan2(y, x) * (3.0 + (x % 7) * 0.5)))'
  },
  {
    name: 'angular-spiral-random',
    description: 'Spiral with coordinate-seeded angular randomization',
    category: 'angular',
    gpuExpression: 'sqrt(x * x + y * y) + atan2(y, x) * (2.0 + sin((x + y) * 0.1) * 1.5)'
  },
  {
    name: 'angular-burst-seed',
    description: 'Burst pattern with coordinate-dependent angular variation',
    category: 'angular',
    gpuExpression: 'pow(sqrt(x * x + y * y), 1.2) * (1.0 + 0.4 * sin(atan2(y, x) * (4.0 + (abs(x) % 5))))'
  },
  {
    name: 'angular-flower',
    description: 'Flower-like pattern with coordinate-based petal variation',
    category: 'angular',
    gpuExpression: 'sqrt(x * x + y * y) * (1.0 + 0.5 * sin(atan2(y, x) * (6.0 + (y % 3) * 2.0)))'
  },
  {
    name: 'angular-chaos',
    description: 'Chaotic angular distortion using coordinate randomization',
    category: 'angular',
    gpuExpression: 'sqrt(x * x + y * y) * (1.0 + 0.6 * sin(atan2(y, x) * (8.0 + sin((x * y) % 13) * 3.0)))'
  },
  {
    name: 'angular-ripple-random',
    description: 'Ripple effect with coordinate-seeded angular modulation',
    category: 'angular',
    gpuExpression: 'sqrt(x * x + y * y) + sin(sqrt(x * x + y * y) * (0.5 + (abs(x + y) % 4) * 0.1)) * (3.0 + sin(atan2(y, x) * 4.0))'
  },
  {
    name: 'angular-star-seed',
    description: 'Star pattern with coordinate-dependent point variation',
    category: 'angular',
    gpuExpression: 'sqrt(x * x + y * y) * (1.0 + 0.4 * sin(atan2(y, x) * (5.0 + (x % 6) + (y % 4))))'
  },
  {
    name: 'angular-vortex-chaos',
    description: 'Chaotic vortex with coordinate-based angular randomization',
    category: 'angular',
    gpuExpression: 'sqrt(x * x + y * y) * (1.0 + sin(atan2(y, x) * (3.0 + sin((x * 0.1) + (y * 0.13)) * 2.0)) * 0.4)'
  },
  {
    name: 'angular-mandala',
    description: 'Mandala pattern with coordinate-seeded symmetry variations',
    category: 'angular',
    gpuExpression: 'sqrt(x * x + y * y) * (1.0 + 0.3 * sin(atan2(y, x) * (8.0 + (abs(x) % 3))) + 0.2 * cos(atan2(y, x) * (12.0 + (abs(y) % 5))))'
  },
  {
    name: 'angular-web',
    description: 'Web-like pattern with coordinate-dependent angular complexity',
    category: 'angular',
    gpuExpression: 'sqrt(x * x + y * y) * (1.0 + 0.5 * sin(atan2(y, x) * (6.0 + (x + y) % 7)) + 0.3 * sin(atan2(y, x) * (18.0 + (x * y) % 11)))'
  }
];

// Create a coordinate noise pattern via API
async function createCoordinateNoise(environment, pattern) {
  const env = environments[environment];
  const color = env.color;
  const reset = '\x1b[0m';
  
  try {
    console.log(`${color}[${env.name}]${reset} Creating pattern: ${pattern.name}`);
    
    const response = await fetch(`${env.apiUrl}/api/coordinate-noise`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pattern)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`${color}[${env.name}]${reset} ✅ Created: ${result.data?.name || pattern.name} (CPU: ${result.data?.cpuLoadLevel || 'unknown'})`);
      return result;
    } else {
      const errorData = await response.json();
      console.error(`${color}[${env.name}]${reset} ❌ Failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      return null;
    }
  } catch (error) {
    console.error(`${color}[${env.name}]${reset} ❌ Error:`, error.message);
    return null;
  }
}

// Add patterns to a specific environment
async function addPatternsToEnvironment(environment) {
  const env = environments[environment];
  const color = env.color;
  const reset = '\x1b[0m';
  
  console.log(`\n${color}=== Adding ${angularDistortionPatterns.length} angular distortion patterns to ${env.name} ===${reset}`);
  
  const results = [];
  
  for (const pattern of angularDistortionPatterns) {
    const result = await createCoordinateNoise(environment, pattern);
    if (result) {
      results.push(result);
    }
    
    // Small delay between requests to be nice to the API
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`${color}[${env.name}]${reset} 🎯 Successfully added ${results.length}/${angularDistortionPatterns.length} patterns`);
  return results;
}

// Main function
async function main() {
  console.log('🚀 Adding angular distortion patterns to coordinate noise database...\n');
  
  const startTime = Date.now();
  
  try {
    // Add patterns to all environments
    const devResults = await addPatternsToEnvironment('development');
    const stageResults = await addPatternsToEnvironment('staging');
    const prodResults = await addPatternsToEnvironment('production');
    
    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log('\n🎉 Angular Distortion Patterns Added!');
    console.log('=====================================');
    console.log(`Development: ${devResults.length}/${angularDistortionPatterns.length} patterns`);
    console.log(`Staging: ${stageResults.length}/${angularDistortionPatterns.length} patterns`);
    console.log(`Production: ${prodResults.length}/${angularDistortionPatterns.length} patterns`);
    console.log(`Total time: ${totalTime.toFixed(2)} seconds`);
    
    // Show pattern summary
    console.log('\n📊 New Angular Distortion Patterns:');
    angularDistortionPatterns.forEach(pattern => {
      console.log(`  ${pattern.name}: ${pattern.description}`);
    });
    
  } catch (error) {
    console.error('❌ Error in main process:', error);
    process.exit(1);
  }
}

// Run if called directly
main();
