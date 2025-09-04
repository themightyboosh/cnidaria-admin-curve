const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function migratePalettesToDistortionLinks() {
  console.log('🔄 Migrating palette data from palette-links to distortion-control-links...');
  
  try {
    // Get all palette-links for distortion objects
    const paletteLinksSnapshot = await db.collection('palette-links')
      .where('objectType', '==', 'distortion')
      .get();
    
    console.log(`📋 Found ${paletteLinksSnapshot.size} palette-links for distortion objects`);
    
    let migrated = 0;
    let errors = 0;
    let skipped = 0;
    
    for (const paletteLinkDoc of paletteLinksSnapshot.docs) {
      try {
        const paletteLinkData = paletteLinkDoc.data();
        const distortionControlId = paletteLinkData.objectId;
        const paletteName = paletteLinkData.paletteName;
        
        if (!distortionControlId || !paletteName) {
          console.log(`⚠️ Skipping incomplete palette link: ${paletteLinkDoc.id}`);
          skipped++;
          continue;
        }
        
        console.log(`\n🔄 Processing: DP=${distortionControlId}, Palette=${paletteName}`);
        
        // Find all distortion-control-links for this distortion control
        const distortionLinksSnapshot = await db.collection('distortion-control-links')
          .where('distortionControlId', '==', distortionControlId)
          .get();
        
        if (distortionLinksSnapshot.empty) {
          console.log(`❌ No distortion-control-links found for ${distortionControlId}`);
          errors++;
          continue;
        }
        
        // Update ALL links for this distortion control with the palette
        for (const distortionLinkDoc of distortionLinksSnapshot.docs) {
          const linkData = distortionLinkDoc.data();
          
          // Only update if palette is not already set
          if (!linkData.paletteName) {
            await distortionLinkDoc.ref.update({
              paletteName: paletteName,
              paletteLinkedAt: new Date().toISOString(),
              migratedFromPaletteLinks: true
            });
            
            console.log(`✅ Added palette "${paletteName}" to link: ${distortionLinkDoc.id}`);
            migrated++;
          } else {
            console.log(`⚪ Link ${distortionLinkDoc.id} already has palette: ${linkData.paletteName}`);
            skipped++;
          }
        }
        
      } catch (error) {
        console.error(`❌ Error processing palette link ${paletteLinkDoc.id}:`, error);
        errors++;
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Links updated with palettes: ${migrated}`);
    console.log(`   ⚪ Skipped (already had palette): ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📋 Total palette-links processed: ${paletteLinksSnapshot.size}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run migration
migratePalettesToDistortionLinks()
  .then(() => {
    console.log('\n🎉 Palette migration to distortion-control-links complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
