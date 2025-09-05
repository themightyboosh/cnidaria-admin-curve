/**
 * Debug shader creation 400 error
 */

const admin = require('firebase-admin')

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'cnidaria-dev'
  })
}

const db = admin.firestore()

async function debugShaderCreation() {
  console.log('🔍 Debugging shader creation 400 error...')
  
  // Test the exact data structure that Merzbow is sending
  const testShaderData = {
    name: 'zorro-glsl',  // This should be kebab-case
    category: 'level-one-shaders',
    glsl: {
      'three-js': `// Test shader content
varying vec2 vUv;
void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }`
    }
  }
  
  console.log('🧪 Testing shader data structure:', JSON.stringify(testShaderData, null, 2))
  
  // Test validation function manually
  console.log('🔍 Testing validation...')
  
  // Check name validation
  const kebabRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/
  console.log(`Name "${testShaderData.name}" is kebab-case:`, kebabRegex.test(testShaderData.name))
  console.log(`Category "${testShaderData.category}" is kebab-case:`, kebabRegex.test(testShaderData.category))
  
  // Check GLSL object
  console.log('GLSL object keys:', Object.keys(testShaderData.glsl))
  console.log('GLSL values are strings:', Object.values(testShaderData.glsl).every(v => typeof v === 'string'))
  
  // Test what Merzbow is actually sending
  const problematicData = {
    name: 'Zorro!-glsl',  // This has special characters!
    category: 'level-one-shaders',
    glsl: {
      'three-js': 'shader content...'
    }
  }
  
  console.log('🚨 Problematic data (what Merzbow sends):')
  console.log(`Name "${problematicData.name}" is kebab-case:`, kebabRegex.test(problematicData.name))
  console.log('❌ This will fail validation!')
  
  // Test creating a shader directly
  try {
    await db.collection('shaders').doc(testShaderData.name).set({
      ...testShaderData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    console.log('✅ Direct Firestore creation successful')
  } catch (error) {
    console.error('❌ Direct Firestore creation failed:', error)
  }
}

debugShaderCreation()
  .then(() => {
    console.log('🎯 Debug completed')
    process.exit(0)
  })
  .catch(error => {
    console.error('💥 Debug failed:', error)
    process.exit(1)
  })
