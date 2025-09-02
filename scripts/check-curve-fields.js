import fetch from 'node-fetch';

const apiUrl = 'https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev';

async function checkCurveFields() {
  try {
    console.log('🔍 Checking curve fields in detail...');
    
    const response = await fetch(`${apiUrl}/api/curves`);
    const data = await response.json();
    const curves = data.data?.curves || [];
    
    console.log(`📊 Found ${curves.length} curves`);
    
    // Check first few curves in detail
    const samplesToCheck = Math.min(3, curves.length);
    
    for (let i = 0; i < samplesToCheck; i++) {
      const curve = curves[i];
      console.log(`\n🔍 Curve ${i + 1}: ${curve['curve-name']}`);
      console.log('   Fields:', Object.keys(curve));
      console.log('   distance-modulus:', curve['distance-modulus']);
      console.log('   noise-calc:', curve['noise-calc']);
      console.log('   curve-distance-calc:', curve['curve-distance-calc']);
      console.log('   coordinate-noise:', curve['coordinate-noise']);
    }
    
    // Count field presence
    let withDistanceModulus = 0;
    let withNoiseCalc = 0;
    let withCurveDistanceCalc = 0;
    
    curves.forEach(curve => {
      if (curve.hasOwnProperty('distance-modulus')) withDistanceModulus++;
      if (curve.hasOwnProperty('noise-calc')) withNoiseCalc++;
      if (curve.hasOwnProperty('curve-distance-calc')) withCurveDistanceCalc++;
    });
    
    console.log('\n📈 Field Summary:');
    console.log(`   distance-modulus: ${withDistanceModulus}/${curves.length}`);
    console.log(`   noise-calc: ${withNoiseCalc}/${curves.length}`);
    console.log(`   curve-distance-calc: ${withCurveDistanceCalc}/${curves.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkCurveFields();
