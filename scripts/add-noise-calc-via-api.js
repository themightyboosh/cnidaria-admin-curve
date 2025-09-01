import fetch from 'node-fetch';

const apiUrl = 'https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev';

async function addNoiseCalcToAllCurves() {
  try {
    console.log('🔄 Fetching all curves...');
    
    // Fetch all curves
    const response = await fetch(`${apiUrl}/api/curves`);
    if (!response.ok) {
      console.error('❌ Failed to fetch curves:', response.status);
      return;
    }
    
    const data = await response.json();
    if (!data.success) {
      console.error('❌ API returned error:', data.error);
      return;
    }
    
    const curves = data.data?.curves || [];
    console.log(`📊 Found ${curves.length} curves`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const curve of curves) {
      // Check if noise-calc already exists
      if (curve['noise-calc']) {
        console.log(`⏭️  Skipping ${curve['curve-name']} (already has noise-calc: ${curve['noise-calc']})`);
        skipped++;
        continue;
      }
      
      // Add noise-calc field with default 'radial' - send complete curve data
      const updatedCurve = {
        ...curve,
        'noise-calc': 'radial'
      };
      
      // Remove any undefined fields that might cause validation issues
      Object.keys(updatedCurve).forEach(key => {
        if (updatedCurve[key] === undefined) {
          delete updatedCurve[key];
        }
      });
      
      try {
        const updateResponse = await fetch(`${apiUrl}/api/curves/${curve.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedCurve)
        });
        
        if (updateResponse.ok) {
          console.log(`✅ Updated ${curve['curve-name']} with noise-calc: radial`);
          updated++;
        } else {
          const errorData = await updateResponse.json();
          console.error(`❌ Failed to update ${curve['curve-name']}: ${updateResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error(`❌ Error updating ${curve['curve-name']}:`, error.message);
      }
      
      // Small delay between updates
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`\n🎯 Results: ${updated} updated, ${skipped} skipped`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the migration
addNoiseCalcToAllCurves();
