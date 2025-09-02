import fetch from 'node-fetch';

const apiUrl = 'https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev';

async function addDistanceModulusToAllCurves() {
  try {
    console.log('🔄 Adding distance-modulus field to all curves...');
    
    // Fetch all curves
    const response = await fetch(`${apiUrl}/api/curves`);
    if (!response.ok) {
      console.error('❌ API not responding:', response.status, response.statusText);
      return false;
    }
    
    const data = await response.json();
    if (!data.success) {
      console.error('❌ API returned error:', data.error);
      return false;
    }
    
    const curves = data.data?.curves || [];
    console.log(`📊 Found ${curves.length} curves`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const curve of curves) {
      const curveName = curve['curve-name'] || 'Unnamed Curve';
      
      try {
        // Check if distance-modulus already exists
        if (curve.hasOwnProperty('distance-modulus')) {
          console.log(`⏭️  ${curveName} already has distance-modulus: ${curve['distance-modulus']}`);
          skipped++;
          continue;
        }
        
        console.log(`🔄 Adding distance-modulus to "${curveName}"...`);
        
        // Add distance-modulus field
        const updateData = {
          'distance-modulus': 0 // Default: no modulus applied
        };
        
        const updateResponse = await fetch(`${apiUrl}/api/curves/${curve.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        });
        
        if (updateResponse.ok) {
          const result = await updateResponse.json();
          if (result.success) {
            console.log(`✅ "${curveName}" updated successfully`);
            updated++;
          } else {
            console.error(`❌ Failed to update "${curveName}":`, result.error?.message || result.message);
            errors++;
          }
        } else {
          const errorData = await updateResponse.json().catch(() => ({}));
          console.error(`❌ HTTP error updating "${curveName}": ${updateResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
          errors++;
        }
      } catch (error) {
        console.error(`❌ Error updating "${curveName}":`, error.message);
        errors++;
      }
      
      // Small delay between updates
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`   Updated: ${updated} curves`);
    console.log(`   Skipped: ${skipped} curves`);
    console.log(`   Errors: ${errors} curves`);
    console.log(`   Total: ${curves.length} curves processed`);
    
    if (errors === 0) {
      console.log('\n✅ All curves now have distance-modulus field!');
      console.log('\n🎯 Ready to test locally!');
      console.log('   1. Open: http://localhost:5173');
      console.log('   2. Test the new distance-modulus field in curve editor');
      console.log('   3. Test bypass checkbox in mapped mode');
    } else {
      console.log(`\n⚠️  Migration completed with ${errors} errors`);
    }
    
    return errors === 0;
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    return false;
  }
}

// Run the migration
addDistanceModulusToAllCurves();
