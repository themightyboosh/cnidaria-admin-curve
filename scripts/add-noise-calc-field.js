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

// Add noise-calc field to existing curves
async function addNoiseCalcField(environment) {
  const env = environments[environment];
  const color = env.color;
  const reset = '\x1b[0m';
  
  try {
    console.log(`\n${color}=== Adding noise-calc field to curves in ${env.name} ===${reset}`);
    
    // Fetch all curves
    const response = await fetch(`${env.apiUrl}/api/curves`);
    if (!response.ok) {
      console.error(`${color}[${env.name}]${reset} ❌ Failed to fetch curves: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    if (!data.success) {
      console.error(`${color}[${env.name}]${reset} ❌ API returned error:`, data.error);
      return;
    }
    
    const curves = data.data?.curves || data.curves || [];
    console.log(`${color}[${env.name}]${reset} Found ${curves.length} curves`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const curve of curves) {
      // Check if noise-calc already exists
      if (curve['noise-calc']) {
        console.log(`${color}[${env.name}]${reset} ⏭️  Skipping ${curve['curve-name']} (already has noise-calc: ${curve['noise-calc']})`);
        skipped++;
        continue;
      }
      
      // Randomly assign noise-calc
      const noiseCalcOptions = ['radial', 'cartesian-x', 'cartesian-y'];
      const randomNoiseCalc = noiseCalcOptions[Math.floor(Math.random() * noiseCalcOptions.length)];
      
      // Update the curve
      const updatedCurve = {
        ...curve,
        'noise-calc': randomNoiseCalc
      };
      
      try {
        const updateResponse = await fetch(`${env.apiUrl}/api/curves/${curve.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedCurve)
        });
        
        if (updateResponse.ok) {
          console.log(`${color}[${env.name}]${reset} ✅ Updated ${curve['curve-name']} with noise-calc: ${randomNoiseCalc}`);
          updated++;
        } else {
          const errorData = await updateResponse.json();
          console.error(`${color}[${env.name}]${reset} ❌ Failed to update ${curve['curve-name']}: ${updateResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error(`${color}[${env.name}]${reset} ❌ Error updating ${curve['curve-name']}:`, error.message);
      }
      
      // Small delay between updates
      await new Promise(resolve => setTimeout(resolve, 100));
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
  console.log('🔧 Adding noise-calc field to existing curves...\n');
  
  const startTime = Date.now();
  
  try {
    // Add noise-calc field to all environments
    const devResults = await addNoiseCalcField('development');
    const stageResults = await addNoiseCalcField('staging');
    const prodResults = await addNoiseCalcField('production');
    
    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log('\n🎉 Noise-Calc Field Migration Complete!');
    console.log('======================================');
    console.log(`Development: ${devResults.updated} updated, ${devResults.skipped} skipped`);
    console.log(`Staging: ${stageResults.updated} updated, ${stageResults.skipped} skipped`);
    console.log(`Production: ${prodResults.updated} updated, ${prodResults.skipped} skipped`);
    console.log(`Total time: ${totalTime.toFixed(2)} seconds`);
    
    console.log('\n📊 Noise-Calc Options:');
    console.log('  radial: Traditional radial distance with noise warping');
    console.log('  cartesian-x: X-coordinate influence with noise offset');
    console.log('  cartesian-y: Y-coordinate influence with noise offset');
    
    console.log('\n🎯 Next Steps:');
    console.log('  1. The UI now has a "Noise Calc" dropdown in mapped view');
    console.log('  2. Changes are auto-saved when the dropdown is modified');
    console.log('  3. PNG generation uses the selected noise calculation method');
    console.log('  4. Existing curves have been randomly assigned noise-calc values');
    
  } catch (error) {
    console.error('❌ Error in main process:', error);
    process.exit(1);
  }
}

// Run if called directly
main();
