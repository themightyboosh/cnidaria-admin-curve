const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function testLinkingProcess() {
  console.log('🧪 Testing the linking process for Fredo Puffins...');
  
  try {
    // 1. Find Fredo Puffins DP
    const dpQuery = await db.collection('distortion-controls')
      .where('name', '==', 'Fredo Puffins')
      .limit(1)
      .get();
    
    if (dpQuery.empty) {
      console.log('❌ Fredo Puffins DP not found');
      return;
    }
    
    const fredoDP = dpQuery.docs[0];
    const fredoData = fredoDP.data();
    console.log(`✅ Found Fredo Puffins: ${fredoDP.id}`);
    
    // 2. Check current links
    const currentLinksQuery = await db.collection('distortion-control-links')
      .where('distortionControlId', '==', fredoDP.id)
      .get();
    
    console.log(`\n🔗 Current links for Fredo Puffins: ${currentLinksQuery.size}`);
    currentLinksQuery.docs.forEach(doc => {
      const data = doc.data();
      console.log(`   📋 Link: ${doc.id}`);
      console.log(`      🎯 Curve: ${data.curveId || 'none'}`);
      console.log(`      🎨 Palette: ${data.paletteName || 'none'}`);
    });
    
    // 3. Test linking a curve and palette
    console.log(`\n🧪 Testing link creation...`);
    
    // Get a test curve
    const curvesSnapshot = await db.collection('curves').limit(1).get();
    const testCurve = curvesSnapshot.docs[0];
    
    // Get a test palette  
    const palettesSnapshot = await db.collection('palettes').limit(1).get();
    const testPalette = palettesSnapshot.docs[0];
    
    console.log(`🎯 Test curve: ${testCurve.data().name}`);
    console.log(`🎨 Test palette: ${testPalette.data().name}`);
    
    // Create test link
    const testLinkId = `${testCurve.data().name}-${fredoDP.id}`;
    const testLinkData = {
      curveId: testCurve.data().name,
      distortionControlId: fredoDP.id,
      paletteName: testPalette.data().name,
      linkedAt: new Date().toISOString(),
      paletteLinkedAt: new Date().toISOString()
    };
    
    await db.collection('distortion-control-links').doc(testLinkId).set(testLinkData);
    console.log(`✅ Created test link: ${testLinkId}`);
    
    // 4. Verify the link was created
    const verifyQuery = await db.collection('distortion-control-links')
      .where('distortionControlId', '==', fredoDP.id)
      .get();
    
    console.log(`\n✅ Verification - Links for Fredo Puffins: ${verifyQuery.size}`);
    verifyQuery.docs.forEach(doc => {
      const data = doc.data();
      console.log(`   📋 Link: ${doc.id}`);
      console.log(`      🎯 Curve: ${data.curveId || 'none'}`);
      console.log(`      🎨 Palette: ${data.paletteName || 'none'}`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
testLinkingProcess()
  .then(() => {
    console.log('\n🎉 Test complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
