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

// Mapping of old patterns to new unopinionated expressions
const noisePatternUpdates = {
  // Simple radial patterns -> pure noise value
  'radial': {
    newExpression: '100',
    description: 'Pure noise base (no processing) - use with radial noise-calc'
  },
  
  // Cartesian patterns -> pure coordinate values
  'cartesian-x': {
    newExpression: 'abs(x)',
    description: 'Pure X coordinate - use with cartesian-x noise-calc for enhanced effect'
  },
  'cartesian-y': {
    newExpression: 'abs(y)',
    description: 'Pure Y coordinate - use with cartesian-y noise-calc for enhanced effect'
  },
  
  // Radial-based patterns -> remove sqrt(x*x + y*y) component, keep the interesting parts
  'spiral': {
    newExpression: '100 + atan2(y, x) * 20',
    description: 'Pure angular spiral pattern (no radial component)'
  },
  'dna': {
    newExpression: '100 + sin(atan2(y, x) * 2.0) * 30 + cos(atan2(y, x) * 2.0) * 20',
    description: 'DNA angular pattern (no radial component)'
  },
  'lightning': {
    newExpression: '100 + pow(abs(sin(atan2(y, x) * 3.0)), 0.5) * 50',
    description: 'Lightning angular pattern (no radial component)'
  },
  
  // Angular patterns -> keep angular components, remove radial
  'angular-wave': {
    newExpression: '100 + sin(atan2(y, x) * (3.0 + (x % 7) * 0.5)) * 30',
    description: 'Angular wave pattern (no radial component)'
  },
  'angular-spiral-random': {
    newExpression: '100 + atan2(y, x) * (2.0 + sin((x + y) * 0.1) * 1.5)',
    description: 'Random angular spiral (no radial component)'
  },
  'angular-burst-seed': {
    newExpression: '100 + sin(atan2(y, x) * (4.0 + (abs(x) % 5))) * 40',
    description: 'Coordinate-seeded angular burst (no radial component)'
  },
  'angular-flower': {
    newExpression: '100 + sin(atan2(y, x) * (6.0 + (y % 3) * 2.0)) * 50',
    description: 'Flower petal pattern (no radial component)'
  },
  'angular-chaos': {
    newExpression: '100 + sin(atan2(y, x) * (8.0 + sin((x * y) % 13) * 3.0)) * 60',
    description: 'Chaotic angular pattern (no radial component)'
  },
  'angular-ripple-random': {
    newExpression: '100 + sin(atan2(y, x) * 4.0) * (3.0 + sin((abs(x + y) % 4) * 0.1))',
    description: 'Angular ripple with coordinate randomization (no radial component)'
  },
  'angular-star-seed': {
    newExpression: '100 + sin(atan2(y, x) * (5.0 + (x % 6) + (y % 4))) * 40',
    description: 'Variable star pattern (no radial component)'
  },
  'angular-vortex-chaos': {
    newExpression: '100 + sin(atan2(y, x) * (3.0 + sin((x * 0.1) + (y * 0.13)) * 2.0)) * 40',
    description: 'Chaotic vortex pattern (no radial component)'
  },
  'angular-mandala': {
    newExpression: '100 + sin(atan2(y, x) * (8.0 + (abs(x) % 3))) * 30 + cos(atan2(y, x) * (12.0 + (abs(y) % 5))) * 20',
    description: 'Mandala symmetry pattern (no radial component)'
  },
  'angular-web': {
    newExpression: '100 + sin(atan2(y, x) * (6.0 + (x + y) % 7)) * 50 + sin(atan2(y, x) * (18.0 + (x * y) % 11)) * 30',
    description: 'Web-like angular pattern (no radial component)'
  }
};

// Update coordinate noise patterns to be unopinionated
async function updateNoisePatterns(environment) {
  const env = environments[environment];
  const color = env.color;
  const reset = '\x1b[0m';
  
  try {
    console.log(`\n${color}=== Updating coordinate noise patterns in ${env.name} to be unopinionated ===${reset}`);
    
    // Fetch all coordinate noise patterns
    const response = await fetch(`${env.apiUrl}/api/coordinate-noise/firebase`);
    if (!response.ok) {
      console.error(`${color}[${env.name}]${reset} ❌ Failed to fetch patterns: ${response.status}`);
      return { updated: 0, skipped: 0 };
    }
    
    const data = await response.json();
    if (!data.success) {
      console.error(`${color}[${env.name}]${reset} ❌ API returned error:`, data.error);
      return { updated: 0, skipped: 0 };
    }
    
    const patterns = data.data?.noiseTypes || [];
    console.log(`${color}[${env.name}]${reset} Found ${patterns.length} coordinate noise patterns`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const pattern of patterns) {
      const update = noisePatternUpdates[pattern.name];
      
      if (!update) {
        console.log(`${color}[${env.name}]${reset} ⏭️  Skipping ${pattern.name} (no update needed)`);
        skipped++;
        continue;
      }
      
      // Check if already updated
      if (pattern.gpuExpression === update.newExpression) {
        console.log(`${color}[${env.name}]${reset} ⏭️  Skipping ${pattern.name} (already updated)`);
        skipped++;
        continue;
      }
      
      // Update the pattern
      const updatedPattern = {
        ...pattern,
        gpuExpression: update.newExpression,
        description: update.description,
        category: 'unopinionated' // Mark as unopinionated
      };
      
      try {
        const updateResponse = await fetch(`${env.apiUrl}/api/coordinate-noise/${pattern.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedPattern)
        });
        
        if (updateResponse.ok) {
          console.log(`${color}[${env.name}]${reset} ✅ Updated ${pattern.name}:`);
          console.log(`${color}[${env.name}]${reset}    Old: ${pattern.gpuExpression}`);
          console.log(`${color}[${env.name}]${reset}    New: ${update.newExpression}`);
          updated++;
        } else {
          const errorData = await updateResponse.json();
          console.error(`${color}[${env.name}]${reset} ❌ Failed to update ${pattern.name}: ${updateResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error(`${color}[${env.name}]${reset} ❌ Error updating ${pattern.name}:`, error.message);
      }
      
      // Small delay between updates
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`${color}[${env.name}]${reset} 🎯 Results: ${updated} updated, ${skipped} skipped`);
    return { updated, skipped };
    
  } catch (error) {
    console.error(`${color}[${env.name}]${reset} ❌ Error:`, error.message);
    return { updated: 0, skipped: 0 };
  }
}

// Main function
async function main() {
  console.log('🔄 Converting coordinate noise patterns to unopinionated expressions...\n');
  console.log('This removes built-in radial/cartesian processing since we now handle that via noise-calc\n');
  
  const startTime = Date.now();
  
  try {
    // Update patterns in all environments
    const devResults = await updateNoisePatterns('development');
    const stageResults = await updateNoisePatterns('staging');
    const prodResults = await updateNoisePatterns('production');
    
    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log('\n🎉 Coordinate Noise Patterns Updated to Unopinionated!');
    console.log('====================================================');
    console.log(`Development: ${devResults.updated} updated, ${devResults.skipped} skipped`);
    console.log(`Staging: ${stageResults.updated} updated, ${stageResults.skipped} skipped`);
    console.log(`Production: ${prodResults.updated} updated, ${prodResults.skipped} skipped`);
    console.log(`Total time: ${totalTime.toFixed(2)} seconds`);
    
    console.log('\n📊 Key Changes Made:');
    console.log('  radial → 100 (pure noise base)');
    console.log('  cartesian-x → abs(x) (pure X coordinate)');
    console.log('  cartesian-y → abs(y) (pure Y coordinate)');
    console.log('  angular-* → removed sqrt(x*x + y*y), kept angular components');
    console.log('  spiral/dna/lightning → removed radial component, kept interesting parts');
    
    console.log('\n🎯 Result:');
    console.log('  • Noise patterns are now unopinionated about coordinate calculation');
    console.log('  • Use noise-calc dropdown to choose radial/cartesian-x/cartesian-y application');
    console.log('  • Same patterns now work with all calculation methods');
    console.log('  • More flexible and predictable behavior');
    
  } catch (error) {
    console.error('❌ Error in main process:', error);
    process.exit(1);
  }
}

// Run if called directly
main();
