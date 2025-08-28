const fetch = require('node-fetch');

const DEV_API_URL = 'https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev';

// Test curve data
const testCurve = {
  "curve-name": "Test Curve 1",
  "curve-description": "Simple test curve to verify API functionality",
  "curve-tags": ["test", "verification"],
  "curve-type": "Radial",
  "curve-width": 100,
  "curve-data": Array.from({length: 100}, () => Math.random() * 100),
  "curve-index-scaling": 1.0,
  "coordinate-noise-strength": 0.5,
  "coordinate-noise-scale": 0.3,
  "coordinate-noise-seed": 123
};

async function testDevAPI() {
  console.log('🧪 Testing Development API...');
  console.log(`API URL: ${DEV_API_URL}`);
  
  try {
    // Test 1: Check if API is accessible
    console.log('\n1️⃣ Testing API accessibility...');
    const response = await fetch(`${DEV_API_URL}/api/curves`);
    
    if (response.ok) {
      console.log('✅ API is accessible');
    } else {
      console.log(`❌ API returned status: ${response.status}`);
      const errorText = await response.text();
      console.log(`Error details: ${errorText}`);
      return;
    }
    
    // Test 2: Create a test curve
    console.log('\n2️⃣ Creating test curve...');
    const createResponse = await fetch(`${DEV_API_URL}/api/curves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testCurve)
    });
    
    if (createResponse.ok) {
      const result = await createResponse.json();
      console.log('✅ Test curve created successfully!');
      console.log(`Curve ID: ${result.id}`);
      console.log(`Response:`, JSON.stringify(result, null, 2));
    } else {
      console.log(`❌ Failed to create test curve: ${createResponse.status}`);
      const errorText = await createResponse.text();
      console.log(`Error details: ${errorText}`);
    }
    
    // Test 3: List all curves
    console.log('\n3️⃣ Listing all curves...');
    const listResponse = await fetch(`${DEV_API_URL}/api/curves`);
    
    if (listResponse.ok) {
      const curves = await listResponse.json();
      console.log(`✅ Found ${curves.length} curves in database`);
      if (curves.length > 0) {
        console.log('First curve:', JSON.stringify(curves[0], null, 2));
      }
    } else {
      console.log(`❌ Failed to list curves: ${listResponse.status}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

testDevAPI();
