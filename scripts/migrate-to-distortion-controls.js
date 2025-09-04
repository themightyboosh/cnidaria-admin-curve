/**
 * Migrate from coordinate-noise to distortion-controls schema
 * Remove all coordinate-noise documents and populate with Pipeline F distortion data
 */

const admin = require('firebase-admin');

// Distance calculation options
const DISTANCE_CALCULATIONS = [
  'radial', 'cartesian-x', 'cartesian-y', 'manhattan', 'chebyshev', 'minkowski-3',
  'hexagonal', 'triangular', 'spiral', 'cross', 'sine-wave', 'ripple', 
  'interference', 'hyperbolic', 'polar-rose', 'lemniscate', 'logarithmic'
];

// Playful name generators
const ADJECTIVES = [
  'cosmic', 'ethereal', 'mystical', 'chaotic', 'serene', 'turbulent', 'prismatic',
  'crystalline', 'flowing', 'twisted', 'luminous', 'shadowy', 'electric', 'organic',
  'geometric', 'fluid', 'sharp', 'soft', 'wild', 'gentle', 'fierce', 'calm',
  'blazing', 'frozen', 'molten', 'crystallized', 'warped', 'pure', 'complex'
];

const NOUNS = [
  'vortex', 'spiral', 'matrix', 'pattern', 'field', 'wave', 'lattice', 'mesh',
  'fabric', 'texture', 'formation', 'structure', 'network', 'grid', 'web',
  'cascade', 'flow', 'stream', 'current', 'pulse', 'rhythm', 'harmony',
  'symphony', 'composition', 'arrangement', 'design', 'blueprint', 'template'
];

const SUFFIXES = [
  'dreams', 'echoes', 'whispers', 'storms', 'winds', 'tides', 'flames',
  'crystals', 'fragments', 'shards', 'threads', 'waves', 'ripples',
  'pulses', 'beats', 'notes', 'chords', 'melodies', 'songs', 'tales'
];

function generatePlayfulName(config) {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
  
  // Add descriptive elements based on active features
  const features = [];
  if (config['angular-distortion']) features.push('angular');
  if (config['fractal-distortion']) features.push('fractal');
  if (config['checkerboard-pattern']) features.push('checkered');
  
  const featurePrefix = features.length > 0 ? features.join('-') + '-' : '';
  const distanceType = config['distance-calculation'].replace('-', '');
  
  return `${featurePrefix}${adj}-${distanceType}-${noun}-${suffix}`;
}

function generateRandomConfig() {
  const hasAngular = Math.random() > 0.6;
  const hasFractal = Math.random() > 0.5;
  const hasCheckerboard = Math.random() > 0.7;
  
  return {
    'angular-distortion': hasAngular,
    'fractal-distortion': hasFractal,
    'checkerboard-pattern': hasCheckerboard,
    'distance-calculation': DISTANCE_CALCULATIONS[Math.floor(Math.random() * DISTANCE_CALCULATIONS.length)],
    'distance-modulus': Math.floor(Math.random() * 200) * 10, // 0-200 in steps of 10
    'curve-scaling': Math.round((0.0001 + Math.random() * 0.9999) * 10000) / 10000, // Random 0.0001-1.0
    'checkerboard-steps': hasCheckerboard ? Math.floor(Math.random() * 150) + 10 : 0,
    'angular-frequency': hasAngular ? Math.round(Math.random() * 64 * 10) / 10 : 0.0,
    'angular-amplitude': hasAngular ? Math.floor(Math.random() * 100) : 0,
    'angular-offset': hasAngular ? Math.round(Math.random() * 360 * 10) / 10 : 0.0,
    'fractal-scale-1': hasFractal ? Math.round(Math.random() * 0.01 * 1000) / 1000 : 0.0,
    'fractal-scale-2': hasFractal ? Math.round(Math.random() * 0.5 * 100) / 100 : 0.0,
    'fractal-scale-3': hasFractal ? Math.round((0.05 + Math.random() * 0.95) * 100) / 100 : 0.05,
    'fractal-strength': hasFractal ? Math.floor(Math.random() * 49) + 1 : 1
  };
}

async function migrateToDistortionControls(environment = 'dev') {
  console.log(`🚀 Starting migration to distortion-controls schema for ${environment}...`);

  // Initialize Firebase
  const serviceAccountPath = `../cnidaria-api/cnidaria-${environment}-firebase-adminsdk.json`;
  const projectId = `cnidaria-${environment}`;
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(require(serviceAccountPath)),
      databaseURL: `https://${projectId}.firebaseio.com`
    });
  }

  const db = admin.firestore();
  
  try {
    // 1. Remove all existing coordinate-noise documents
    console.log('🗑️ Removing existing coordinate-noise documents...');
    const noiseCollection = db.collection('coordinate-noise');
    const noiseDocs = await noiseCollection.get();
    
    const batch1 = db.batch();
    noiseDocs.docs.forEach(doc => {
      batch1.delete(doc.ref);
    });
    await batch1.commit();
    console.log(`✅ Removed ${noiseDocs.size} coordinate-noise documents`);

    // 2. Create distortion-controls collection with random data
    console.log('🎨 Creating distortion-controls with random configurations...');
    const distortionCollection = db.collection('distortion-controls');
    
    const configs = [];
    for (let i = 0; i < 50; i++) { // Create 50 random configurations
      const config = generateRandomConfig();
      const name = generatePlayfulName(config);
      
      const docData = {
        name: name,
        id: name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'),
        ...config,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      configs.push(docData);
    }

    // Add some specific interesting presets
    const presets = [
      {
        name: 'pure-radial-classic',
        id: 'pure-radial-classic',
        'angular-distortion': false,
        'fractal-distortion': false,
        'checkerboard-pattern': false,
        'distance-calculation': 'radial',
        'distance-modulus': 0,
        'curve-scaling': 1.0,
        'checkerboard-steps': 0,
        'angular-frequency': 0.0,
        'angular-amplitude': 0,
        'angular-offset': 0.0,
        'fractal-scale-1': 0.0,
        'fractal-scale-2': 0.0,
        'fractal-scale-3': 0.05,
        'fractal-strength': 1
      },
      {
        name: 'spiral-fractal-storm',
        id: 'spiral-fractal-storm',
        'angular-distortion': true,
        'fractal-distortion': true,
        'checkerboard-pattern': false,
        'distance-calculation': 'spiral',
        'distance-modulus': 100,
        'curve-scaling': 0.5,
        'checkerboard-steps': 0,
        'angular-frequency': 12.0,
        'angular-amplitude': 75,
        'angular-offset': 45.0,
        'fractal-scale-1': 0.008,
        'fractal-scale-2': 0.25,
        'fractal-scale-3': 0.8,
        'fractal-strength': 35
      },
      {
        name: 'hexagonal-checkered-maze',
        id: 'hexagonal-checkered-maze',
        'angular-distortion': false,
        'fractal-distortion': true,
        'checkerboard-pattern': true,
        'distance-calculation': 'hexagonal',
        'distance-modulus': 75,
        'curve-scaling': 0.25,
        'checkerboard-steps': 25,
        'angular-frequency': 0.0,
        'angular-amplitude': 0,
        'angular-offset': 0.0,
        'fractal-scale-1': 0.005,
        'fractal-scale-2': 0.15,
        'fractal-scale-3': 0.6,
        'fractal-strength': 20
      }
    ];

    // Add presets to configs
    configs.push(...presets.map(preset => ({
      ...preset,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })));

    // Batch write all configurations
    const batches = [];
    for (let i = 0; i < configs.length; i += 500) { // Firestore batch limit
      const batch = db.batch();
      const batchConfigs = configs.slice(i, i + 500);
      
      batchConfigs.forEach(config => {
        const docRef = distortionCollection.doc(config.id);
        batch.set(docRef, config);
      });
      
      batches.push(batch);
    }

    for (const batch of batches) {
      await batch.commit();
    }

    console.log(`✅ Created ${configs.length} distortion-controls configurations`);
    console.log('🎨 Sample configurations:');
    configs.slice(0, 5).forEach(config => {
      console.log(`  - ${config.name} (${config['distance-calculation']}, angular: ${config['angular-distortion']}, fractal: ${config['fractal-distortion']})`);
    });

    console.log('🎵 Migration to distortion-controls schema complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
if (require.main === module) {
  const environment = process.argv[2] || 'dev';
  migrateToDistortionControls(environment)
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateToDistortionControls };
