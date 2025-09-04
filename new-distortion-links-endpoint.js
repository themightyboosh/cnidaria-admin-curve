// CLEAN REWRITE: Distortion Control Links Endpoint
// Simple, single link per DP with overwrite capability

/**
 * Link curve and/or palette to distortion control
 * Creates/updates single link per DP
 */
async function linkDistortionControlClean(req, res, db) {
  try {
    const { curveId, distortionControlId, paletteName } = req.body;
    
    console.log('🔗 CLEAN LINK REQUEST:', { curveId, distortionControlId, paletteName });
    
    // Validate required fields
    if (!distortionControlId) {
      return res.status(400).json({
        success: false,
        error: 'distortionControlId is required'
      });
    }
    
    // Verify distortion control exists
    const dpDoc = await db.collection('distortion-controls').doc(distortionControlId).get();
    if (!dpDoc.exists) {
      return res.status(404).json({
        success: false,
        error: `Distortion control '${distortionControlId}' not found`
      });
    }
    
    // Verify curve exists if provided
    if (curveId) {
      const curveDoc = await db.collection('curves').doc(curveId).get();
      if (!curveDoc.exists) {
        return res.status(404).json({
          success: false,
          error: `Curve '${curveId}' not found`
        });
      }
    }
    
    // Verify palette exists if provided
    if (paletteName) {
      const paletteQuery = await db.collection('palettes').where('name', '==', paletteName).limit(1).get();
      if (paletteQuery.empty) {
        return res.status(404).json({
          success: false,
          error: `Palette '${paletteName}' not found`
        });
      }
    }
    
    // Find existing link for this DP (single link per DP)
    const existingLinkQuery = await db.collection('distortion-control-links')
      .where('distortionControlId', '==', distortionControlId)
      .limit(1)
      .get();
    
    const timestamp = new Date().toISOString();
    
    if (!existingLinkQuery.empty) {
      // Update existing link
      const existingDoc = existingLinkQuery.docs[0];
      const updateData = {
        updatedAt: timestamp
      };
      
      if (curveId) {
        updateData.curveId = curveId;
        updateData.curveLinkedAt = timestamp;
      }
      
      if (paletteName) {
        updateData.paletteName = paletteName;
        updateData.paletteLinkedAt = timestamp;
      }
      
      await existingDoc.ref.update(updateData);
      
      const updatedDoc = await existingDoc.ref.get();
      
      console.log('✅ UPDATED EXISTING LINK:', updatedDoc.id);
      
      return res.json({
        success: true,
        data: {
          id: updatedDoc.id,
          ...updatedDoc.data()
        },
        message: 'Link updated successfully'
      });
      
    } else {
      // Create new link
      const linkData = {
        distortionControlId,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      
      if (curveId) {
        linkData.curveId = curveId;
        linkData.curveLinkedAt = timestamp;
      }
      
      if (paletteName) {
        linkData.paletteName = paletteName;
        linkData.paletteLinkedAt = timestamp;
      }
      
      // Use simple ID format
      const linkId = `dp-${distortionControlId}-${Date.now()}`;
      
      await db.collection('distortion-control-links').doc(linkId).set(linkData);
      
      console.log('✅ CREATED NEW LINK:', linkId);
      
      return res.json({
        success: true,
        data: {
          id: linkId,
          ...linkData
        },
        message: 'Link created successfully'
      });
    }
    
  } catch (error) {
    console.error('❌ Link error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}

/**
 * Get all links for a distortion control
 */
async function getDistortionControlLinksClean(distortionControlId, res, db) {
  try {
    console.log('🔍 GETTING LINKS FOR DP:', distortionControlId);
    
    const linksQuery = await db.collection('distortion-control-links')
      .where('distortionControlId', '==', distortionControlId)
      .get();
    
    const links = linksQuery.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ FOUND ${links.length} LINKS FOR DP:`, distortionControlId);
    
    return res.json({
      success: true,
      data: links,
      message: `Found ${links.length} links`
    });
    
  } catch (error) {
    console.error('❌ Get links error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}

module.exports = {
  linkDistortionControlClean,
  getDistortionControlLinksClean
};
