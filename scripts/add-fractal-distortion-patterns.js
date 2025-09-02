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

// Fractal-looking distortion patterns using coordinate-based procedural techniques
const fractalDistortionPatterns = [
  {
    name: 'fractal-brownian-motion',
    description: 'Multi-octave fractal Brownian motion using coordinate-based noise',
    category: 'fractal',
    gpuExpression: 'sqrt(x * x + y * y) * (1.0 + 0.5 * sin(x * 0.1) + 0.25 * sin(x * 0.2 + y * 0.15) + 0.125 * sin(x * 0.4 + y * 0.3) + 0.0625 * sin(x * 0.8 + y * 0.6))'
  },
  {
    name: 'fractal-ridged-noise',
    description: 'Ridged fractal noise creating mountain-like terrain distortions',
    category: 'fractal',
    gpuExpression: 'sqrt(x * x + y * y) * (1.0 + abs(sin(x * 0.05 + y * 0.03)) * 0.8 + abs(sin(x * 0.1 + y * 0.07)) * 0.4 + abs(sin(x * 0.2 + y * 0.15)) * 0.2)'
  },
  {
    name: 'fractal-turbulence',
    description: 'Turbulent fractal pattern using coordinate domain warping',
    category: 'fractal',
    gpuExpression: 'sqrt((x + sin(y * 0.02) * 20) * (x + sin(y * 0.02) * 20) + (y + sin(x * 0.03) * 15) * (y + sin(x * 0.03) * 15)) * (1.0 + sin(x * 0.08 + y * 0.05) * 0.3)'
  },
  {
    name: 'fractal-voronoi-cells',
    description: 'Voronoi-like cellular fractal using coordinate-based cell centers',
    category: 'fractal',
    gpuExpression: 'min(sqrt((x - floor(x / 50) * 50 - 25) * (x - floor(x / 50) * 50 - 25) + (y - floor(y / 50) * 50 - 25) * (y - floor(y / 50) * 50 - 25)), sqrt((x - floor(x / 50) * 50) * (x - floor(x / 50) * 50) + (y - floor(y / 50) * 50) * (y - floor(y / 50) * 50)))'
  },
  {
    name: 'fractal-marble',
    description: 'Marble-like fractal veining using coordinate-based flow fields',
    category: 'fractal',
    gpuExpression: 'sqrt(x * x + y * y) + sin((x + sin(y * 0.01) * 30) * 0.05 + (y + sin(x * 0.015) * 20) * 0.03) * 40 + sin((x + sin(y * 0.02) * 15) * 0.1) * 20'
  },
  {
    name: 'fractal-wood-grain',
    description: 'Wood grain fractal using coordinate-based ring patterns',
    category: 'fractal',
    gpuExpression: 'sqrt(x * x + y * y) + sin(sqrt((x + sin(y * 0.01) * 10) * (x + sin(y * 0.01) * 10) + y * y) * 0.3 + sin(x * 0.02) * 5) * 15'
  },
  {
    name: 'fractal-cloud-wisps',
    description: 'Cloud-like wispy fractal using multi-scale coordinate noise',
    category: 'fractal',
    gpuExpression: 'sqrt(x * x + y * y) * (1.0 + sin(x * 0.02 + y * 0.015) * 0.6 + sin(x * 0.05 + y * 0.04) * 0.3 + sin(x * 0.1 + y * 0.08) * 0.15) + sin(x * 0.003) * 50'
  },
  {
    name: 'fractal-lightning-branches',
    description: 'Lightning-like branching fractal using coordinate-based recursive patterns',
    category: 'fractal',
    gpuExpression: 'sqrt(x * x + y * y) + abs(sin(x * 0.1 + sin(y * 0.05) * 10)) * 20 + abs(sin(x * 0.2 + sin(y * 0.1 + x * 0.05) * 5)) * 10 + abs(sin(x * 0.4)) * 5'
  },
  {
    name: 'fractal-crystal-growth',
    description: 'Crystal growth fractal using coordinate-based dendrite simulation',
    category: 'fractal',
    gpuExpression: 'sqrt(x * x + y * y) * (1.0 + sin(atan2(y, x) * 6 + sqrt(x * x + y * y) * 0.1) * 0.4 + sin(atan2(y, x) * 12 + sqrt(x * x + y * y) * 0.05) * 0.2)'
  },
  {
    name: 'fractal-terrain-erosion',
    description: 'Eroded terrain fractal using coordinate-based hydraulic simulation',
    category: 'fractal',
    gpuExpression: 'sqrt(x * x + y * y) + sin(x * 0.01) * 80 + sin(y * 0.012) * 60 - abs(sin(x * 0.05 + y * 0.03)) * 30 + sin(x * 0.08 + y * 0.06) * 15'
  },
  {
    name: 'fractal-lava-flow',
    description: 'Lava flow fractal using coordinate-based fluid dynamics',
    category: 'fractal',
    gpuExpression: 'sqrt(x * x + y * y) + sin((x + sin(y * 0.005) * 100) * 0.02) * 60 + sin((y + sin(x * 0.008) * 80) * 0.025) * 40 + sin(x * 0.1 + y * 0.08) * 20'
  },
  {
    name: 'fractal-coral-growth',
    description: 'Coral-like organic fractal using coordinate-based growth simulation',
    category: 'fractal',
    gpuExpression: 'sqrt(x * x + y * y) * (1.0 + sin(atan2(y, x) * 8 + sqrt(x * x + y * y) * 0.08 + sin(x * 0.03) * 3) * 0.5 + sin(atan2(y, x) * 16) * 0.25)'
  }
];

// Create a coordinate noise pattern via API
async function createCoordinateNoise(environment, pattern) {
  const env = environments[environment];
  const color = env.color;
  const reset = '\x1b[0m';
  
  try {
    console.log(`${color}[${env.name}]${reset} Creating fractal pattern: ${pattern.name}`);
    
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
  
  console.log(`\n${color}=== Adding ${fractalDistortionPatterns.length} fractal distortion patterns to ${env.name} ===${reset}`);
  
  const results = [];
  
  for (const pattern of fractalDistortionPatterns) {
    const result = await createCoordinateNoise(environment, pattern);
    if (result) {
      results.push(result);
    }
    
    // Small delay between requests to be nice to the API
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`${color}[${env.name}]${reset} 🎯 Successfully added ${results.length}/${fractalDistortionPatterns.length} fractal patterns`);
  return results;
}

// Main function
async function main() {
  console.log('🌋 Adding fractal distortion patterns to coordinate noise database...\n');
  
  const startTime = Date.now();
  
  try {
    // Add patterns to all environments
    const devResults = await addPatternsToEnvironment('development');
    const stageResults = await addPatternsToEnvironment('staging');
    const prodResults = await addPatternsToEnvironment('production');
    
    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log('\n🎉 Fractal Distortion Patterns Added!');
    console.log('=====================================');
    console.log(`Development: ${devResults.length}/${fractalDistortionPatterns.length} patterns`);
    console.log(`Staging: ${stageResults.length}/${fractalDistortionPatterns.length} patterns`);
    console.log(`Production: ${prodResults.length}/${fractalDistortionPatterns.length} patterns`);
    console.log(`Total time: ${totalTime.toFixed(2)} seconds`);
    
    // Show pattern summary
    console.log('\n📊 New Fractal Distortion Techniques:');
    console.log('\n🌊 Multi-Scale Noise:');
    console.log('  fractal-brownian-motion: 4-octave fractal Brownian motion');
    console.log('  fractal-cloud-wisps: Multi-scale cloud-like patterns');
    console.log('\n🏔️  Terrain & Geology:');
    console.log('  fractal-ridged-noise: Mountain ridge-like patterns');
    console.log('  fractal-terrain-erosion: Hydraulic erosion simulation');
    console.log('  fractal-lava-flow: Fluid dynamics lava patterns');
    console.log('\n🌿 Organic Growth:');
    console.log('  fractal-coral-growth: Organic coral-like structures');
    console.log('  fractal-crystal-growth: Dendrite crystal patterns');
    console.log('\n🎨 Material Simulation:');
    console.log('  fractal-marble: Marble veining patterns');
    console.log('  fractal-wood-grain: Wood ring grain patterns');
    console.log('\n⚡ Dynamic Patterns:');
    console.log('  fractal-turbulence: Domain-warped turbulence');
    console.log('  fractal-lightning-branches: Recursive branching');
    console.log('  fractal-voronoi-cells: Cellular Voronoi patterns');
    
  } catch (error) {
    console.error('❌ Error in main process:', error);
    process.exit(1);
  }
}

// Run if called directly
main();
