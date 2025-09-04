/**
 * Update All Curves with Interesting Mathematical Patterns
 * Replaces existing curve-data with sine waves, sawtooth, fractals, etc.
 */

const { getFirestore } = require('./firebase-config');

// Pattern generators that fill 0-255 range
const generatePatterns = {
  sineWave: (width) => {
    return Array.from({ length: width }, (_, i) => {
      const t = (i / width) * Math.PI * 4 // 4 full cycles
      return Math.floor(127.5 + 127.5 * Math.sin(t))
    })
  },

  sawtooth: (width) => {
    return Array.from({ length: width }, (_, i) => {
      const t = (i / width) * 4 // 4 cycles
      const sawValue = (t % 1) // 0 to 1 sawtooth
      return Math.floor(sawValue * 255)
    })
  },

  triangle: (width) => {
    return Array.from({ length: width }, (_, i) => {
      const t = (i / width) * 4 // 4 cycles
      const phase = t % 1
      const triangleValue = phase < 0.5 ? phase * 2 : 2 - (phase * 2)
      return Math.floor(triangleValue * 255)
    })
  },

  square: (width) => {
    return Array.from({ length: width }, (_, i) => {
      const t = (i / width) * 8 // 8 cycles
      const phase = t % 1
      return phase < 0.5 ? 0 : 255
    })
  },

  fractalNoise: (width) => {
    return Array.from({ length: width }, (_, i) => {
      const t = i / width
      // Multi-scale noise
      const scale1 = Math.sin(t * Math.PI * 16) * 0.5
      const scale2 = Math.sin(t * Math.PI * 32) * 0.25
      const scale3 = Math.sin(t * Math.PI * 64) * 0.125
      const combined = 0.5 + scale1 + scale2 + scale3
      return Math.floor(Math.max(0, Math.min(255, combined * 255)))
    })
  },

  exponential: (width) => {
    return Array.from({ length: width }, (_, i) => {
      const t = i / width
      const expValue = (Math.exp(t * 3) - 1) / (Math.exp(3) - 1) // Normalize 0-1
      return Math.floor(expValue * 255)
    })
  },

  logarithmic: (width) => {
    return Array.from({ length: width }, (_, i) => {
      const t = i / width
      const logValue = Math.log(1 + t * 9) / Math.log(10) // Log base 10, normalized
      return Math.floor(logValue * 255)
    })
  },

  spiral: (width) => {
    return Array.from({ length: width }, (_, i) => {
      const t = (i / width) * Math.PI * 8
      const spiralValue = (Math.sin(t) * Math.cos(t * 0.5) + 1) * 0.5
      return Math.floor(spiralValue * 255)
    })
  },

  chaotic: (width) => {
    return Array.from({ length: width }, (_, i) => {
      const t = i / width
      // Chaotic function with multiple frequencies
      const chaos = Math.sin(t * 23.7) * Math.cos(t * 17.3) * Math.sin(t * 41.1)
      const normalized = (chaos + 1) * 0.5 // -1,1 → 0,1
      return Math.floor(normalized * 255)
    })
  },

  stepped: (width) => {
    return Array.from({ length: width }, (_, i) => {
      const steps = 8
      const stepSize = width / steps
      const stepIndex = Math.floor(i / stepSize)
      const stepValue = stepIndex / (steps - 1)
      return Math.floor(stepValue * 255)
    })
  }
}

async function updateAllCurveData(environment = 'dev') {
  console.log(`🎨 Updating all curve data with mathematical patterns for ${environment}...`)

  // Initialize Firebase
  process.env.GOOGLE_CLOUD_PROJECT = `cnidaria-${environment}`
  const db = getFirestore()
  
  try {
    // Get all curves
    const curvesSnap = await db.collection('curves').get()
    const curves = []
    curvesSnap.forEach(doc => {
      curves.push({
        id: doc.id,
        data: doc.data()
      })
    })

    console.log(`📊 Found ${curves.length} curves to update`)

    const patternNames = Object.keys(generatePatterns)
    let updatedCount = 0

    // Update each curve with a different pattern
    for (let i = 0; i < curves.length; i++) {
      const curve = curves[i]
      const patternName = patternNames[i % patternNames.length]
      const generator = generatePatterns[patternName]
      
      const currentWidth = curve.data['curve-width'] || 256
      const newCurveData = generator(currentWidth)
      
      // Update the curve
      await db.collection('curves').doc(curve.id).update({
        'curve-data': newCurveData,
        'curve-width': newCurveData.length,
        'pattern-type': patternName,
        'updated-at': new Date().toISOString()
      })

      console.log(`✅ Updated curve "${curve.data.name || curve.id}" with ${patternName} pattern (${newCurveData.length} points)`)
      updatedCount++
    }

    console.log(`🎉 Updated ${updatedCount} curves with mathematical patterns!`)
    console.log(`📋 Patterns used: ${patternNames.join(', ')}`)

  } catch (error) {
    console.error('❌ Failed to update curve data:', error)
    throw error
  }
}

// Run the update
if (require.main === module) {
  const environment = process.argv[2] || 'dev'
  updateAllCurveData(environment)
    .then(() => {
      console.log('🎊 Curve data update completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Curve data update failed:', error)
      process.exit(1)
    })
}

module.exports = { updateAllCurveData }
