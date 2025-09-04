const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function checkFredoPuffinsLinks() {
  console.log('🔍 Checking "fredo puffins" distortion control links...');
  
  try {
    // First, find the distortion control named "fredo puffins" (or similar)
    const distortionControlsSnapshot = await db.collection('distortion-controls').get();
    
    let fredoControl = null;
    for (const doc of distortionControlsSnapshot.docs) {
      const data = doc.data();
      if (data.name && data.name.toLowerCase().includes('fredo') && data.name.toLowerCase().includes('puffins')) {
        fredoControl = { id: doc.id, ...data };
        break;
      }
    }
    
    if (!fredoControl) {
      console.log('❌ No distortion control found with name containing "fredo puffins"');
      console.log('\n📋 Available distortion controls:');
      for (const doc of distortionControlsSnapshot.docs) {
        const data = doc.data();
        console.log(`   - ${data.name} (ID: ${doc.id})`);
      }
      return;
    }
    
    console.log(`✅ Found distortion control: "${fredoControl.name}" (ID: ${fredoControl.id})`);
    
    // Now check distortion-control-links for this control
    const linksSnapshot = await db.collection('distortion-control-links')
      .where('distortionControlId', '==', fredoControl.id)
      .get();
    
    console.log(`\n🔗 Found ${linksSnapshot.size} links for "${fredoControl.name}":`);
    
    if (linksSnapshot.empty) {
      console.log('❌ No links found in distortion-control-links collection');
    } else {
      for (const linkDoc of linksSnapshot.docs) {
        const linkData = linkDoc.data();
        console.log(`\n📋 Link ID: ${linkDoc.id}`);
        console.log(`   🎯 Curve: ${linkData.curveId || 'NONE'}`);
        console.log(`   🎨 Palette: ${linkData.paletteName || 'NONE'}`);
        console.log(`   📅 Linked: ${linkData.linkedAt || 'unknown'}`);
        if (linkData.paletteLinkedAt) {
          console.log(`   📅 Palette Linked: ${linkData.paletteLinkedAt}`);
        }
      }
    }
    
    // Also check the old palette-links collection for comparison
    const oldPaletteLinksSnapshot = await db.collection('palette-links')
      .where('objectType', '==', 'distortion')
      .where('objectId', '==', fredoControl.id)
      .get();
    
    console.log(`\n🔗 Old palette-links collection: ${oldPaletteLinksSnapshot.size} links found`);
    if (!oldPaletteLinksSnapshot.empty) {
      for (const linkDoc of oldPaletteLinksSnapshot.docs) {
        const linkData = linkDoc.data();
        console.log(`   📋 Old Link: ${linkData.paletteName || linkData.paletteId || 'unknown'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking links:', error);
  }
}

// Run check
checkFredoPuffinsLinks()
  .then(() => {
    console.log('\n🎉 Check complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Check failed:', error);
    process.exit(1);
  });
