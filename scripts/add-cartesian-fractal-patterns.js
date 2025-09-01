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

// Pure Cartesian fractal patterns - NO radial distance component
const cartesianFractalPatterns = [
  {
    name: 'cartesian-brownian-motion',
    description: 'Pure Cartesian fractal Brownian motion in X,Y space',
    category: 'cartesian-fractal',
    gpuExpression: '100 + sin(x * 0.05) * 80 + sin(x * 0.1 + y * 0.08) * 40 + sin(x * 0.2 + y * 0.15) * 20 + sin(x * 0.4 + y * 0.3) * 10'
  },
  {
    name: 'cartesian-perlin-layers',
    description: 'Layered Perlin-style noise in pure X,Y coordinates',
    category: 'cartesian-fractal',
    gpuExpression: '100 + sin(x * 0.02 + y * 0.03) * 60 + sin(x * 0.05 + y * 0.04) * 30 + sin(x * 0.1 + y * 0.12) * 15 + sin(x * 0.2 + y * 0.18) * 8'
  },
  {
    name: 'cartesian-ridged-terrain',
    description: 'Ridged terrain fractal in pure Cartesian space',
    category: 'cartesian-fractal',
    gpuExpression: '100 + abs(sin(x * 0.03 + y * 0.02)) * 70 + abs(sin(x * 0.07 + y * 0.05)) * 35 + abs(sin(x * 0.15 + y * 0.1)) * 18'
  },
  {
    name: 'cartesian-wood-grain',
    description: 'Wood grain pattern in pure X,Y coordinates',
    category: 'cartesian-fractal',
    gpuExpression: '100 + sin((x + sin(y * 0.01) * 20) * 0.1) * 50 + sin((x + sin(y * 0.02) * 10) * 0.2) * 25'
  },
  {
    name: 'cartesian-marble-veins',
    description: 'Marble veining in pure Cartesian coordinate space',
    category: 'cartesian-fractal',
    gpuExpression: '100 + sin((x + sin(y * 0.005) * 40) * 0.03 + (y + sin(x * 0.008) * 30) * 0.025) * 80 + sin(x * 0.1 + y * 0.08) * 20'
  },
  {
    name: 'cartesian-cloud-turbulence',
    description: 'Turbulent cloud patterns in X,Y space without radial component',
    category: 'cartesian-fractal',
    gpuExpression: '100 + sin((x + sin(y * 0.01) * 30) * 0.02) * 60 + sin((y + sin(x * 0.015) * 25) * 0.025) * 40 + sin(x * 0.08 + y * 0.06) * 20'
  },
  {
    name: 'cartesian-lightning-forks',
    description: 'Lightning-like branching in pure X,Y coordinates',
    category: 'cartesian-fractal',
    gpuExpression: '100 + abs(sin(x * 0.1 + sin(y * 0.03) * 15)) * 40 + abs(sin(x * 0.2 + sin(y * 0.06 + x * 0.02) * 8)) * 20 + abs(sin(x * 0.4)) * 10'
  },
  {
    name: 'cartesian-cellular-noise',
    description: 'Cellular/Voronoi-like patterns in pure Cartesian space',
    category: 'cartesian-fractal',
    gpuExpression: 'min(min(abs(x % 60 - 30) + abs(y % 60 - 30), abs((x + 30) % 60 - 30) + abs((y + 30) % 60 - 30)), min(abs(x % 40 - 20) + abs(y % 40 - 20), abs((x + 20) % 40 - 20) + abs((y + 20) % 40 - 20)))'
  },
  {
    name: 'cartesian-flow-field',
    description: 'Flow field patterns in pure X,Y coordinate space',
    category: 'cartesian-fractal',
    gpuExpression: '100 + sin(x * 0.02 + sin(y * 0.01) * 10) * 50 + cos(y * 0.025 + sin(x * 0.015) * 8) * 30 + sin(x * 0.05 + y * 0.04) * 15'
  },
  {
    name: 'cartesian-fabric-weave',
    description: 'Fabric weave pattern in pure Cartesian coordinates',
    category: 'cartesian-fractal',
    gpuExpression: '100 + sin(x * 0.2) * sin(y * 0.2) * 40 + sin(x * 0.1) * sin(y * 0.15) * 20 + sin(x * 0.05) * 10'
  },
  {
    name: 'cartesian-brick-pattern',
    description: 'Brick-like tiling pattern in X,Y space',
    category: 'cartesian-fractal',
    gpuExpression: '100 + sin(x * 0.1) * 30 + sin((y + (floor(x / 31.4) % 2) * 15.7) * 0.2) * 25 + sin(x * 0.05 + y * 0.03) * 10'
  },
  {
    name: 'cartesian-interference',
    description: 'Wave interference patterns in pure X,Y coordinates',
    category: 'cartesian-fractal',
    gpuExpression: '100 + sin(x * 0.05 + y * 0.03) * 40 + sin(x * 0.03 - y * 0.05) * 40 + sin(x * 0.08 + y * 0.08) * 20'
  }
];

// Create a coordinate noise pattern via API
async function createCoordinateNoise(environment, pattern) {
  const env = environments[environment];
  const color = env.color;
  const reset = '\x1b[0m';
  
  try {
    console.log(`${color}[${env.name}]${reset} Creating Cartesian fractal: ${pattern.name}`);
    
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
  
  console.log(`\n${color}=== Adding ${cartesianFractalPatterns.length} Cartesian fractal patterns to ${env.name} ===${reset}`);
  
  const results = [];
  
  for (const pattern of cartesianFractalPatterns) {
    const result = await createCoordinateNoise(environment, pattern);
    if (result) {
      results.push(result);
    }
    
    // Small delay between requests to be nice to the API
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`${color}[${env.name}]${reset} 🎯 Successfully added ${results.length}/${cartesianFractalPatterns.length} Cartesian fractal patterns`);
  return results;
}

// Main function
async function main() {
  console.log('📐 Adding PURE Cartesian fractal patterns (NO radial distance)...\n');
  
  const startTime = Date.now();
  
  try {
    // Add patterns to all environments
    const devResults = await addPatternsToEnvironment('development');
    const stageResults = await addPatternsToEnvironment('staging');
    const prodResults = await addPatternsToEnvironment('production');
    
    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log('\n🎉 Pure Cartesian Fractal Patterns Added!');
    console.log('==========================================');
    console.log(`Development: ${devResults.length}/${cartesianFractalPatterns.length} patterns`);
    console.log(`Staging: ${stageResults.length}/${cartesianFractalPatterns.length} patterns`);
    console.log(`Production: ${prodResults.length}/${cartesianFractalPatterns.length} patterns`);
    console.log(`Total time: ${totalTime.toFixed(2)} seconds`);
    
    // Show pattern summary
    console.log('\n📊 Pure Cartesian Fractal Techniques:');
    console.log('\n🌊 Multi-Scale Noise (X,Y only):');
    console.log('  cartesian-brownian-motion: 4-octave Brownian motion in X,Y space');
    console.log('  cartesian-perlin-layers: Perlin-style layered noise');
    console.log('  cartesian-cloud-turbulence: Turbulent patterns without radial bias');
    console.log('\n🏔️  Terrain & Geology (X,Y only):');
    console.log('  cartesian-ridged-terrain: Ridge patterns in Cartesian space');
    console.log('  cartesian-marble-veins: Marble veining without radial component');
    console.log('\n🎨 Material Patterns (X,Y only):');
    console.log('  cartesian-wood-grain: Wood grain in pure X,Y coordinates');
    console.log('  cartesian-fabric-weave: Fabric weave patterns');
    console.log('  cartesian-brick-pattern: Brick tiling patterns');
    console.log('\n⚡ Dynamic Patterns (X,Y only):');
    console.log('  cartesian-lightning-forks: Branching without radial bias');
    console.log('  cartesian-flow-field: Flow fields in X,Y space');
    console.log('  cartesian-cellular-noise: Cellular patterns in Cartesian grid');
    console.log('  cartesian-interference: Wave interference in X,Y plane');
    console.log('\n🔍 KEY DIFFERENCE: These patterns work purely in X,Y coordinates');
    console.log('    - NO sqrt(x*x + y*y) radial distance component');
    console.log('    - Direct X,Y coordinate evaluation');
    console.log('    - No circular/radial bias in the distortion');
    
  } catch (error) {
    console.error('❌ Error in main process:', error);
    process.exit(1);
  }
}

// Run if called directly
main();
