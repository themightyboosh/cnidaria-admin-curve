const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function cleanupToSingleLinkPerDP() {
  console.log('🧹 Starting cleanup: Delete all links and create single link per DP');
  
  try {
    // Step 1: Delete ALL existing distortion-control-links
    console.log('\n🗑️ STEP 1: Deleting all existing distortion-control-links...');
    const allLinksSnapshot = await db.collection('distortion-control-links').get();
    console.log(`   Found ${allLinksSnapshot.size} links to delete`);
    
    const deleteBatch = db.batch();
    for (const linkDoc of allLinksSnapshot.docs) {
      deleteBatch.delete(linkDoc.ref);
    }
    await deleteBatch.commit();
    console.log(`   ✅ Deleted ${allLinksSnapshot.size} existing links`);
    
    // Step 2: Get all distortion controls
    const distortionControlsSnapshot = await db.collection('distortion-controls').get();
    console.log(`\n📋 STEP 2: Found ${distortionControlsSnapshot.size} distortion controls`);
    
    // Step 3: Create single link per DP with most recent curve
    const curvesSnapshot = await db.collection('curves').get();
    const curves = curvesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const mostRecentCurve = curves.sort((a, b) => 
      new Date(b.updatedAt || '').getTime() - new Date(a.updatedAt || '').getTime()
    )[0];
    
    console.log(`\n🎯 Using most recent curve for all DPs: "${mostRecentCurve.name}"`);
    
    let created = 0;
    const createBatch = db.batch();
    
    for (const dpDoc of distortionControlsSnapshot.docs) {
      const dpData = dpDoc.data();
      const dpId = dpDoc.id;
      
      // Create single link: most recent curve → this DP (no palette initially)
      const linkId = `${mostRecentCurve.name}-${dpId}`;
      const linkData = {
        curveId: mostRecentCurve.name,
        distortionControlId: dpId,
        linkedAt: new Date().toISOString()
        // No palette initially - will be added when user selects one
      };
      
      const linkRef = db.collection('distortion-control-links').doc(linkId);
      createBatch.set(linkRef, linkData);
      
      console.log(`   ✅ Creating link: ${linkId}`);
      created++;
    }
    
    await createBatch.commit();
    console.log(`\n📊 Cleanup Summary:`);
    console.log(`   🗑️ Deleted: ${allLinksSnapshot.size} old links`);
    console.log(`   ✅ Created: ${created} new single links`);
    console.log(`   🎯 Each DP now has exactly 1 link (curve only, palette TBD)`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Run cleanup
cleanupToSingleLinkPerDP()
  .then(() => {
    console.log('🎉 Cleanup complete - single link per DP established');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Cleanup failed:', error);
    process.exit(1);
  });