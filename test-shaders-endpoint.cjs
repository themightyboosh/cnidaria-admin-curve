/**
 * Test the shaders endpoint and create the collection if needed
 */

const admin = require('firebase-admin')

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'cnidaria-dev'
  })
}

const db = admin.firestore()

async function testShadersEndpoint() {
  console.log('🧪 Testing shaders endpoint and collection...')
  
  try {
    // Check if shaders collection exists
    console.log('🔍 Checking if shaders collection exists...')
    const shadersSnapshot = await db.collection('shaders').limit(1).get()
    console.log(`📊 Current shaders count: ${shadersSnapshot.size}`)
    
    // Test creating a sample shader
    console.log('🎨 Creating sample shader...')
    
    const sampleShader = {
      name: 'test-fractal-basic-glsl',
      category: 'level-one-shaders',
      glsl: {
        'three-js': `// Sample Three.js texture shader
varying vec2 vUv;

#define FRACTAL_ENABLED 1.0
#define ANGULAR_ENABLED 0.0

vec3 generatePattern(vec2 coord) {
    vec2 p = (coord - 0.5) * 10.0;
    float dist = length(p);
    float pattern = sin(dist * 2.0) * 0.5 + 0.5;
    return vec3(pattern, pattern * 0.8, pattern * 0.6);
}

void main() {
    gl_FragColor = vec4(generatePattern(vUv), 1.0);
}`,
        'webgl': `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

void main() {
    vec2 coord = (vUv - 0.5) * 10.0;
    float dist = length(coord);
    float pattern = sin(dist * 2.0) * 0.5 + 0.5;
    fragColor = vec4(vec3(pattern), 1.0);
}`
      }
    }
    
    // Create the shader document
    await db.collection('shaders').doc(sampleShader.name).set({
      ...sampleShader,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    
    console.log('✅ Sample shader created successfully')
    
    // Verify it was created
    const verifySnapshot = await db.collection('shaders').get()
    console.log(`📊 Shaders collection now has ${verifySnapshot.size} documents`)
    
    // List all shaders
    console.log('📋 Current shaders:')
    verifySnapshot.forEach(doc => {
      const data = doc.data()
      console.log(`  - ${data.name} (${data.category}) - targets: ${Object.keys(data.glsl).join(', ')}`)
    })
    
  } catch (error) {
    console.error('❌ Error testing shaders endpoint:', error)
  }
}

// Run the test
testShadersEndpoint()
  .then(() => {
    console.log('🎯 Shaders endpoint test completed')
    process.exit(0)
  })
  .catch(error => {
    console.error('💥 Test failed:', error)
    process.exit(1)
  })
