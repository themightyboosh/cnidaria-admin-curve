import fetch from 'node-fetch';

async function testAPI() {
  const apiUrl = 'https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev';
  
  try {
    console.log('Testing API response format...');
    const response = await fetch(`${apiUrl}/api/curves`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Response status:', response.status);
      console.log('Response data type:', typeof data);
      console.log('Response data:', JSON.stringify(data, null, 2));
      
      if (Array.isArray(data)) {
        console.log('Data is an array with length:', data.length);
        if (data.length > 0) {
          console.log('First item:', data[0]);
        }
      } else if (data && typeof data === 'object') {
        console.log('Data keys:', Object.keys(data));
        if (data.curves && Array.isArray(data.curves)) {
          console.log('Curves array length:', data.curves.length);
        }
      }
    } else {
      console.error('API request failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAPI();
