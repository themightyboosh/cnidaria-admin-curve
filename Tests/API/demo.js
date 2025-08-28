#!/usr/bin/env node

/**
 * Quick Demo Script for Mathematical Pipeline
 * Shows immediate results with visual grids
 */

const mathTester = require('./mathTester');
const testCurveGenerator = require('./testCurve');
const gridVisualizer = require('./gridVisualizer');

console.log(`🚀 CNIDARIA MATHEMATICAL PIPELINE DEMO`);
console.log(`=====================================`);

// Run a quick demo
async function runDemo() {
  console.log(`\n🎯 Running quick demo with 15x15 grid...`);
  
  // Test with a medium-sized grid and high distortion curve
  const x1 = 0, y1 = 0, x2 = 14, y2 = 14;
  const curveType = 'highDistortion';
  const curve = testCurveGenerator.generateTestCurves()[curveType];
  
  console.log(`\n📊 Test Configuration:`);
  console.log(`   Grid: (${x1}, ${y1}) to (${x2}, ${y2})`);
  console.log(`   Curve: ${curveType}`);
  console.log(`   Size: 15 x 15 = 225 cells`);
  
  // Process the grid
  const result = mathTester.testGrid(x1, y1, x2, y2, curve, 'Demo Grid Test');
  
  if (result && result.success) {
    console.log(`\n✅ Grid processing successful!`);
    console.log(`   Processed: ${result.results.length} coordinates`);
    console.log(`   Cache hits: ${result.cacheStats.hits}`);
    console.log(`   Cache misses: ${result.cacheStats.misses}`);
    console.log(`   Processing time: ${result.cacheStats.processingTimeMs}ms`);
    
    // Show visualizations
    console.log(`\n🎨 GENERATING VISUALIZATIONS...`);
    
    // Index position grid (grayscale)
    gridVisualizer.renderIndexGrid(result.results, x1, y1, x2, y2, 'Demo - Index Position Grid');
    
    // Curve value grid (hue colors)
    gridVisualizer.renderValueGrid(result.results, x1, y1, x2, y2, 'Demo - Curve Value Grid');
    
    // Side-by-side comparison
    gridVisualizer.renderComparisonGrids(result.results, x1, y1, x2, y2, 'Demo - Grid Comparison');
    
    // Save HTML visualization
    const filename = 'demo_visualization.html';
    gridVisualizer.saveHTMLVisualization(
      result.results, 
      x1, y1, x2, y2, 
      filename, 
      'Demo Grid Visualization'
    );
    
    console.log(`\n🎉 Demo completed successfully!`);
    console.log(`📁 HTML visualization saved as: ${filename}`);
    console.log(`🌐 Open it in a web browser to see the interactive visualization`);
    
  } else {
    console.log(`\n❌ Demo failed: ${result.error.message}`);
  }
}

// Run the demo
runDemo().catch(error => {
  console.error(`\n💥 Demo error: ${error.message}`);
  console.error(error.stack);
});
