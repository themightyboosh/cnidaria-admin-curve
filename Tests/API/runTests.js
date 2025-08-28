#!/usr/bin/env node

/**
 * Mathematical Pipeline Test Runner
 * Run this script to test the mathematical pipeline with various configurations
 */

const mathTester = require('./mathTester');
const testCurveGenerator = require('./testCurve');
const gridVisualizer = require('./gridVisualizer');

console.log(`🧮 CNIDARIA MATHEMATICAL PIPELINE TEST RUNNER`);
console.log(`==============================================`);

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'comprehensive';

console.log(`\n🚀 Running: ${command.toUpperCase()} tests`);
console.log(`📊 Test curves available: ${Object.keys(testCurveGenerator.generateTestCurves()).join(', ')}`);

switch (command.toLowerCase()) {
  case 'comprehensive':
    // Run all tests
    mathTester.runComprehensiveTests();
    break;
    
  case 'single':
    // Test single coordinate
    const x = parseInt(args[1]) || 50;
    const y = parseInt(args[2]) || 50;
    const curveType = args[3] || 'noDistortion';
    const curve = testCurveGenerator.generateTestCurves()[curveType];
    
    if (!curve) {
      console.log(`❌ Invalid curve type: ${curveType}`);
      console.log(`Available types: ${Object.keys(testCurveGenerator.generateTestCurves()).join(', ')}`);
      break;
    }
    
    mathTester.testSingleCoordinate(x, y, curve, `Single Coordinate Test (${x}, ${y}) with ${curveType}`);
    break;
    
  case 'grid':
    // Test grid processing
    const x1 = parseInt(args[1]) || 0;
    const y1 = parseInt(args[2]) || 0;
    const x2 = parseInt(args[3]) || 10;
    const y2 = parseInt(args[4]) || 10;
    const gridCurveType = args[5] || 'noDistortion';
    const gridCurve = testCurveGenerator.generateTestCurves()[gridCurveType];
    
    if (!gridCurve) {
      console.log(`❌ Invalid curve type: ${gridCurveType}`);
      console.log(`Available types: ${Object.keys(testCurveGenerator.generateTestCurves()).join(', ')}`);
      break;
    }
    
    const gridResult = mathTester.testGrid(x1, y1, x2, y2, gridCurve, `Grid Test (${x1},${y1}) to (${x2},${y2}) with ${gridCurveType}`);
    
    // Add visualization if grid was successful
    if (gridResult && gridResult.success) {
      console.log(`\n🎨 GRID VISUALIZATIONS:`);
      
      // Show index position grid (grayscale)
      gridVisualizer.renderIndexGrid(gridResult.results, x1, y1, x2, y2, `Index Position Grid - ${gridCurveType}`);
      
      // Show curve value grid (hue colors)
      gridVisualizer.renderValueGrid(gridResult.results, x1, y1, x2, y2, `Curve Value Grid - ${gridCurveType}`);
      
      // Show comparison grids side by side
      gridVisualizer.renderComparisonGrids(gridResult.results, x1, y1, x2, y2, `Grid Comparison - ${gridCurveType}`);
      
      // Generate HTML visualization
      const filename = `grid_${gridCurveType}_${x1}_${y1}_${x2}_${y2}.html`;
      gridVisualizer.saveHTMLVisualization(
        gridResult.results, 
        x1, y1, x2, y2, 
        filename, 
        `Grid Visualization - ${gridCurveType}`
      );
    }
    break;
    
  case 'visualize':
    // Test grid with focus on visualization
    const vx1 = parseInt(args[1]) || 0;
    const vy1 = parseInt(args[2]) || 0;
    const vx2 = parseInt(args[3]) || 20;
    const vy2 = parseInt(args[4]) || 20;
    const vCurveType = args[5] || 'highDistortion';
    const vCurve = testCurveGenerator.generateTestCurves()[vCurveType];
    
    if (!vCurve) {
      console.log(`❌ Invalid curve type: ${vCurveType}`);
      console.log(`Available types: ${Object.keys(testCurveGenerator.generateTestCurves()).join(', ')}`);
      break;
    }
    
    console.log(`\n🎨 VISUALIZATION-FOCUSED GRID TEST`);
    console.log(`📍 Grid: (${vx1}, ${vy1}) to (${vx2}, ${vy2})`);
    console.log(`📊 Curve: ${vCurveType}`);
    console.log(`🎯 Focus: Visual representation of mathematical pipeline results`);
    
    const vResult = mathTester.testGrid(vx1, vy1, vx2, vy2, vCurve, `Visualization Grid Test`);
    
    if (vResult && vResult.success) {
      // Show all visualization types
      console.log(`\n📊 INDEX POSITION GRID (Grayscale):`);
      gridVisualizer.renderIndexGrid(vResult.results, vx1, vy1, vx2, vy2, `Index Position - ${vCurveType}`);
      
      console.log(`\n🎨 CURVE VALUE GRID (Hue Colors):`);
      gridVisualizer.renderValueGrid(vResult.results, vx1, vy1, vx2, vy2, `Curve Values - ${vCurveType}`);
      
      console.log(`\n🔄 SIDE-BY-SIDE COMPARISON:`);
      gridVisualizer.renderComparisonGrids(vResult.results, vx1, vy1, vx2, vy2, `Comparison - ${vCurveType}`);
      
      // Save HTML visualization
      const vFilename = `visualization_${vCurveType}_${vx1}_${vy1}_${vx2}_${vy2}.html`;
      gridVisualizer.saveHTMLVisualization(
        vResult.results, 
        vx1, vy1, vx2, vy2, 
        vFilename, 
        `Visualization Grid - ${vCurveType}`
      );
    }
    break;
    
  case 'curve-types':
    // Test different curve types
    const testCoords = [
      { x: 0, y: 0 },
      { x: 25, y: 25 },
      { x: 50, y: 50 },
      { x: 100, y: 100 }
    ];
    mathTester.testCurveTypes(testCoords, 'Curve Types Comparison Test');
    break;
    
  case 'distortion':
    // Test different distortion levels
    const distortionCoords = [
      { x: 0, y: 0 },
      { x: 25, y: 25 },
      { x: 50, y: 50 },
      { x: 100, y: 100 }
    ];
    mathTester.testDistortionLevels(distortionCoords, 'Distortion Levels Comparison Test');
    break;
    
  case 'scaling':
    // Test different scaling values
    const scalingCoords = [
      { x: 0, y: 0 },
      { x: 25, y: 25 },
      { x: 50, y: 50 },
      { x: 100, y: 100 }
    ];
    mathTester.testScalingValues(scalingCoords, 'Scaling Values Comparison Test');
    break;
    
  case 'pipeline-step':
    // Test specific pipeline step
    const step = args[1] || 'distance';
    const stepCurveType = args[2] || 'noDistortion';
    const stepCurve = testCurveGenerator.generateTestCurves()[stepCurveType];
    
    if (!stepCurve) {
      console.log(`❌ Invalid curve type: ${stepCurveType}`);
      console.log(`Available types: ${Object.keys(testCurveGenerator.generateTestCurves()).join(', ')}`);
      break;
    }
    
    const validSteps = ['distance', 'scaling', 'distortion', 'angular', 'final'];
    if (!validSteps.includes(step)) {
      console.log(`❌ Invalid step: ${step}`);
      console.log(`Available steps: ${validSteps.join(', ')}`);
      break;
    }
    
    mathTester.testPipelineStep(step, stepCurve);
    break;
    
  case 'custom-curve':
    // Test with custom curve parameters
    const customParams = {};
    
    // Parse custom parameters from command line
    for (let i = 1; i < args.length; i += 2) {
      if (args[i] && args[i + 1]) {
        const key = args[i];
        const value = parseFloat(args[i + 1]);
        
        if (!isNaN(value)) {
          customParams[key] = value;
        }
      }
    }
    
    console.log(`\n🔧 Creating custom curve with parameters:`, customParams);
    const customCurve = testCurveGenerator.generateCustomCurve(customParams);
    
    // Test with a few coordinates
    const customCoords = [
      { x: 0, y: 0 },
      { x: 25, y: 25 },
      { x: 50, y: 50 }
    ];
    
    mathTester.testMultipleCoordinates(customCoords, customCurve, 'Custom Curve Test');
    break;
    
  case 'help':
  default:
    console.log(`\n📖 AVAILABLE COMMANDS:`);
    console.log(`   comprehensive          - Run all tests`);
    console.log(`   single <x> <y> [curve] - Test single coordinate`);
    console.log(`   grid <x1> <y1> <x2> <y2> [curve] - Test grid processing with visualization`);
    console.log(`   visualize <x1> <y1> <x2> <y2> [curve] - Focus on grid visualization`);
    console.log(`   curve-types            - Test different curve types`);
    console.log(`   distortion             - Test different distortion levels`);
    console.log(`   scaling                - Test different scaling values`);
    console.log(`   pipeline-step <step> [curve] - Test specific pipeline step`);
    console.log(`   custom-curve [param value]... - Test with custom parameters`);
    console.log(`   help                   - Show this help`);
    
    console.log(`\n📊 AVAILABLE CURVE TYPES:`);
    console.log(`   ${Object.keys(testCurveGenerator.generateTestCurves()).join(', ')}`);
    
    console.log(`\n🔧 AVAILABLE PIPELINE STEPS:`);
    console.log(`   distance, scaling, distortion, angular, final`);
    
    console.log(`\n🎨 VISUALIZATION FEATURES:`);
    console.log(`   • Index Position Grid: Grayscale representation of final index positions`);
    console.log(`   • Curve Value Grid: Hue color representation of terrain values`);
    console.log(`   • Side-by-side comparison of both visualizations`);
    console.log(`   • HTML export for web browser viewing`);
    
    console.log(`\n💡 EXAMPLES:`);
    console.log(`   node runTests.js comprehensive`);
    console.log(`   node runTests.js single 50 50 highDistortion`);
    console.log(`   node runTests.js grid 0 0 10 10 lowDistortion`);
    console.log(`   node runTests.js visualize 0 0 20 20 highDistortion`);
    console.log(`   node runTests.js pipeline-step distortion highDistortion`);
    console.log(`   node runTests.js custom-curve curve-index-scaling 0.3 index-distortion-distortion_level 0.5`);
    break;
}

console.log(`\n✨ Test runner completed!`);
