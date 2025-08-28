const mathProcessor = require('../../API/mathProcessor');
const testCurveGenerator = require('./testCurve');

/**
 * Mathematical Pipeline Tester
 * Tests the complete mathematical pipeline with various curves and coordinates
 */

class MathPipelineTester {
  constructor() {
    this.testCurves = testCurveGenerator.generateTestCurves();
    this.gridTest = testCurveGenerator.generate256x256GridTest();
  }

  /**
   * Test a single coordinate with a specific curve
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} curve - Curve object
   * @param {string} testName - Name for this test
   */
  testSingleCoordinate(x, y, curve, testName = 'Single Coordinate Test') {
    console.log(`\n🧮 ${testName}`);
    console.log(`📍 Coordinates: (${x}, ${y})`);
    console.log(`📊 Curve: ${curve['curve-name']}`);
    
    const result = mathProcessor.processCoordinate(x, y, curve);
    
    if (result.success) {
      console.log(`✅ SUCCESS:`);
      console.log(`   Terrain Value: ${result.result.terrainValue}`);
      console.log(`   Final Index: ${result.result.finalIndex}`);
      console.log(`   Coord Key: ${result.result.coordKey}`);
      console.log(`   Processing Time: ${result.result.processingTimeMs}ms`);
      
      console.log(`\n📐 Mathematical Pipeline:`);
      console.log(`   Distance: ${result.mathematicalPipeline.distance}`);
      console.log(`   Adjusted Distance: ${result.mathematicalPipeline.adjustedDistance}`);
      console.log(`   Distorted Index: ${result.mathematicalPipeline.distortedIndex}`);
      console.log(`   Angular Distorted Index: ${result.mathematicalPipeline.angularDistortedIndex}`);
      console.log(`   Final Index: ${result.mathematicalPipeline.finalIndex}`);
      
      return result;
    } else {
      console.log(`❌ FAILED: ${result.error.message}`);
      console.log(`   Details: ${result.error.details}`);
      return result;
    }
  }

  /**
   * Test multiple coordinates with the same curve
   * @param {Array} coordinates - Array of {x, y} coordinates
   * @param {Object} curve - Curve object
   * @param {string} testName - Name for this test
   */
  testMultipleCoordinates(coordinates, curve, testName = 'Multiple Coordinates Test') {
    console.log(`\n🧮 ${testName}`);
    console.log(`📊 Curve: ${curve['curve-name']}`);
    console.log(`📍 Testing ${coordinates.length} coordinates`);
    
    const results = [];
    
    coordinates.forEach((coord, index) => {
      const result = this.testSingleCoordinate(coord.x, coord.y, curve, `Coordinate ${index + 1}`);
      results.push(result);
    });
    
    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`\n📈 Summary:`);
    console.log(`   Successful: ${successful}`);
    console.log(`   Failed: ${failed}`);
    
    return results;
  }

  /**
   * Test grid processing with a curve
   * @param {number} x1 - Top-left X
   * @param {number} y1 - Top-left Y
   * @param {number} x2 - Bottom-right X
   * @param {number} y2 - Bottom-right Y
   * @param {Object} curve - Curve object
   * @param {string} testName - Name for this test
   */
  testGrid(x1, y1, x2, y2, curve, testName = 'Grid Test') {
    console.log(`\n🧮 ${testName}`);
    console.log(`📊 Curve: ${curve['curve-name']}`);
    console.log(`📍 Grid: (${x1}, ${y1}) to (${x2}, ${y2})`);
    console.log(`📐 Grid Size: ${x2 - x1 + 1} x ${y2 - y1 + 1} = ${(x2 - x1 + 1) * (y2 - y1 + 1)} cells`);
    
    const result = mathProcessor.processGrid(x1, y1, x2, y2, curve);
    
    if (result.success) {
      console.log(`✅ SUCCESS:`);
      console.log(`   Total Results: ${result.results.length}`);
      console.log(`   Cache Hits: ${result.cacheStats.hits}`);
      console.log(`   Cache Misses: ${result.cacheStats.misses}`);
      console.log(`   Processing Time: ${result.cacheStats.processingTimeMs}ms`);
      
      // Show first few results
      console.log(`\n📊 Sample Results (first 3):`);
      result.results.slice(0, 3).forEach((coordResult, index) => {
        console.log(`   ${index + 1}. (${coordResult.coordinates.x}, ${coordResult.coordinates.y}): ${coordResult.result.terrainValue}`);
      });
      
      return result;
    } else {
      console.log(`❌ FAILED: ${result.error.message}`);
      console.log(`   Details: ${result.error.details}`);
      return result;
    }
  }

  /**
   * Test different curve types with the same coordinates
   * @param {Array} coordinates - Array of {x, y} coordinates
   * @param {string} testName - Name for this test
   */
  testCurveTypes(coordinates, testName = 'Curve Types Test') {
    console.log(`\n🧮 ${testName}`);
    console.log(`📍 Testing ${coordinates.length} coordinates with different curve types`);
    
    const curveTypes = ['radial', 'cartesianX', 'cartesianY'];
    const results = {};
    
    curveTypes.forEach(curveType => {
      console.log(`\n--- Testing ${curveType.toUpperCase()} ---`);
      const curve = this.testCurves[curveType];
      const result = this.testMultipleCoordinates(coordinates, curve, `${curveType} Curve Test`);
      results[curveType] = result;
    });
    
    return results;
  }

  /**
   * Test different distortion levels with the same coordinates
   * @param {Array} coordinates - Array of {x, y} coordinates
   * @param {string} testName - Name for this test
   */
  testDistortionLevels(coordinates, testName = 'Distortion Levels Test') {
    console.log(`\n🧮 ${testName}`);
    console.log(`📍 Testing ${coordinates.length} coordinates with different distortion levels`);
    
    const distortionTests = ['noDistortion', 'lowDistortion', 'highDistortion'];
    const results = {};
    
    distortionTests.forEach(testType => {
      console.log(`\n--- Testing ${testType.toUpperCase()} ---`);
      const curve = this.testCurves[testType];
      const result = this.testMultipleCoordinates(coordinates, curve, `${testType} Test`);
      results[testType] = result;
    });
    
    return results;
  }

  /**
   * Test different scaling values with the same coordinates
   * @param {Array} coordinates - Array of {x, y} coordinates
   * @param {string} testName - Name for this test
   */
  testScalingValues(coordinates, testName = 'Scaling Values Test') {
    console.log(`\n🧮 ${testName}`);
    console.log(`📍 Testing ${coordinates.length} coordinates with different scaling values`);
    
    const scalingTests = ['lowScaling', 'default', 'highScaling'];
    const results = {};
    
    scalingTests.forEach(testType => {
      console.log(`\n--- Testing ${testType.toUpperCase()} ---`);
      let curve;
      
      if (testType === 'default') {
        curve = testCurveGenerator.defaultCurve;
      } else {
        curve = this.testCurves[testType];
      }
      
      const result = this.testMultipleCoordinates(coordinates, curve, `${testType} Test`);
      results[testType] = result;
    });
    
    return results;
  }

  /**
   * Run comprehensive pipeline tests
   */
  runComprehensiveTests() {
    console.log(`🚀 MATHEMATICAL PIPELINE COMPREHENSIVE TEST SUITE`);
    console.log(`================================================`);
    
    // Test coordinates (various distances from origin)
    const testCoordinates = [
      { x: 0, y: 0, description: 'Origin' },
      { x: 10, y: 10, description: 'Close to origin' },
      { x: 50, y: 50, description: 'Medium distance' },
      { x: 100, y: 100, description: 'Far from origin' },
      { x: -25, y: 25, description: 'Negative X' },
      { x: 25, y: -25, description: 'Negative Y' },
      { x: 0, y: 100, description: 'Y-axis only' },
      { x: 100, y: 0, description: 'X-axis only' }
    ];
    
    // Test single coordinates with different curves
    console.log(`\n📊 SINGLE COORDINATE TESTS`);
    this.testSingleCoordinate(0, 0, this.testCurves.noDistortion, 'Origin with No Distortion');
    this.testSingleCoordinate(50, 50, this.testCurves.highDistortion, 'Medium Distance with High Distortion');
    this.testSingleCoordinate(100, 100, this.testCurves.angularOnly, 'Far Distance with Angular Distortion');
    
    // Test multiple coordinates
    console.log(`\n📊 MULTIPLE COORDINATE TESTS`);
    this.testMultipleCoordinates(testCoordinates, this.testCurves.noDistortion, 'Multiple Coordinates - No Distortion');
    
    // Test curve types
    console.log(`\n📊 CURVE TYPE TESTS`);
    this.testCurveTypes(testCoordinates.slice(0, 4), 'Curve Types Comparison');
    
    // Test distortion levels
    console.log(`\n📊 DISTORTION LEVEL TESTS`);
    this.testDistortionLevels(testCoordinates.slice(0, 4), 'Distortion Levels Comparison');
    
    // Test scaling values
    console.log(`\n📊 SCALING VALUE TESTS`);
    this.testScalingValues(testCoordinates.slice(0, 4), 'Scaling Values Comparison');
    
    // Test grid processing
    console.log(`\n📊 GRID PROCESSING TESTS`);
    this.testGrid(0, 0, 10, 10, this.testCurves.noDistortion, 'Small Grid Test (11x11)');
    this.testGrid(0, 0, 25, 25, this.testCurves.lowDistortion, 'Medium Grid Test (26x26)');
    
    console.log(`\n✅ COMPREHENSIVE TEST SUITE COMPLETED!`);
  }

  /**
   * Test specific mathematical pipeline step
   * @param {string} step - Step to test ('distance', 'scaling', 'distortion', 'angular', 'final')
   * @param {Object} curve - Curve object
   */
  testPipelineStep(step, curve) {
    console.log(`\n🧮 TESTING PIPELINE STEP: ${step.toUpperCase()}`);
    console.log(`📊 Curve: ${curve['curve-name']}`);
    
    const testCoords = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 50, y: 50 },
      { x: 100, y: 100 }
    ];
    
    testCoords.forEach(coord => {
      console.log(`\n📍 Coordinates: (${coord.x}, ${coord.y})`);
      
      // Test individual steps
      if (step === 'distance') {
        const distance = mathProcessor.calculateDistance(coord.x, coord.y, curve['curve-type']);
        console.log(`   Distance: ${distance.toFixed(4)}`);
      }
      
      if (step === 'scaling') {
        const distance = mathProcessor.calculateDistance(coord.x, coord.y, curve['curve-type']);
        const adjusted = mathProcessor.applyIndexScaling(distance, curve['curve-index-scaling']);
        console.log(`   Distance: ${distance.toFixed(4)} → Adjusted: ${adjusted.toFixed(4)}`);
      }
      
      if (step === 'distortion') {
        const distance = mathProcessor.calculateDistance(coord.x, coord.y, curve['curve-type']);
        const adjusted = mathProcessor.applyIndexScaling(distance, curve['curve-index-scaling']);
        const distorted = mathProcessor.applyIndexDistortion(
          adjusted, 
          curve['index-distortion-distortion_level'], 
          curve['index-distortion-frequency']
        );
        console.log(`   Adjusted: ${adjusted.toFixed(4)} → Distorted: ${distorted.toFixed(4)}`);
      }
      
      if (step === 'angular') {
        const distance = mathProcessor.calculateDistance(coord.x, coord.y, curve['curve-type']);
        const adjusted = mathProcessor.applyIndexScaling(distance, curve['curve-index-scaling']);
        const distorted = mathProcessor.applyIndexDistortion(
          adjusted, 
          curve['index-distortion-distortion_level'], 
          curve['index-distortion-frequency']
        );
        const angular = mathProcessor.applyAngularDistortion(
          distorted, 
          curve['index-distortion-angular'], 
          curve['curve-width']
        );
        console.log(`   Distorted: ${distorted.toFixed(4)} → Angular: ${angular.toFixed(4)}`);
      }
      
      if (step === 'final') {
        const result = mathProcessor.processCoordinate(coord.x, coord.y, curve);
        if (result.success) {
          console.log(`   Final Index: ${result.mathematicalPipeline.finalIndex}`);
          console.log(`   Terrain Value: ${result.result.terrainValue}`);
        }
      }
    });
  }
}

module.exports = new MathPipelineTester();
