import fetch from 'node-fetch';

async function quickAPITest() {
  const apiUrl = 'https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev';
  
  console.log('🔍 Quick API Test');
  console.log('================');
  
  try {
    // Test curves endpoint
    console.log('Testing curves endpoint...');
    const response = await fetch(`${apiUrl}/api/curves`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Curves API: ${data.success ? 'Working' : 'Error'}`);
      const curves = data.data?.curves || data.curves || [];
      console.log(`📊 Found ${curves.length} curves`);
      
      // Check if curves have distance-modulus field
      const withDistanceModulus = curves.filter(c => c.hasOwnProperty('distance-modulus')).length;
      console.log(`📈 Curves with distance-modulus: ${withDistanceModulus}/${curves.length}`);
      
    } else {
      console.log(`❌ Curves API: Not responding (${response.status})`);
    }
    
    // Test coordinate noise endpoint
    console.log('\nTesting coordinate noise endpoint...');
    const noiseResponse = await fetch(`${apiUrl}/api/coordinate-noise/firebase`);
    
    if (noiseResponse.ok) {
      const noiseData = await noiseResponse.json();
      console.log(`✅ Coordinate Noise API: ${noiseData.success ? 'Working' : 'Error'}`);
      console.log(`📊 Found ${noiseData.data?.total || 0} noise patterns`);
    } else {
      console.log(`❌ Coordinate Noise API: Not responding (${noiseResponse.status})`);
    }
    
    console.log('\n🎯 API Status: Ready for local testing!');
    
  } catch (error) {
    console.log(`❌ API Test Failed: ${error.message}`);
    console.log('💡 Make sure the API is deployed and accessible');
  }
}

quickAPITest();
