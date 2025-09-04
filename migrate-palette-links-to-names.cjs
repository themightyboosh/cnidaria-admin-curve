const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function migratePaletteLinksToNames() {
  console.log('🔄 Starting migration: Palette Links ID → Name');
  
  try {
    // Get all palette-links
    const linksSnapshot = await db.collection('palette-links').get();
    console.log(`📋 Found ${linksSnapshot.size} palette links to migrate`);
    
    let migrated = 0;
    let errors = 0;
    
    for (const linkDoc of linksSnapshot.docs) {
      try {
        const linkData = linkDoc.data();
        const paletteId = linkData.paletteId;
        
        if (!paletteId) {
          console.log(`⚠️ Skipping link ${linkDoc.id} - no paletteId`);
          continue;
        }
        
        // Get palette name from the palette document
        const paletteDoc = await db.collection('palettes').doc(paletteId).get();
        
        if (!paletteDoc.exists) {
          console.log(`❌ Palette ${paletteId} not found for link ${linkDoc.id}`);
          errors++;
          continue;
        }
        
        const paletteName = paletteDoc.data().name;
        
        if (!paletteName) {
          console.log(`❌ Palette ${paletteId} has no name for link ${linkDoc.id}`);
          errors++;
          continue;
        }
        
        // Update the link to use paletteName instead of paletteId
        await linkDoc.ref.update({
          paletteName: paletteName,
          paletteId: admin.firestore.FieldValue.delete(), // Remove old field
          migratedAt: new Date().toISOString()
        });
        
        console.log(`✅ Migrated link ${linkDoc.id}: ${paletteId} → ${paletteName}`);
        migrated++;
        
      } catch (error) {
        console.error(`❌ Error migrating link ${linkDoc.id}:`, error);
        errors++;
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Successfully migrated: ${migrated}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📋 Total processed: ${linksSnapshot.size}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run migration
migratePaletteLinksToNames()
  .then(() => {
    console.log('🎉 Migration complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
