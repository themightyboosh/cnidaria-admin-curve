/**
 * Test Curve Generator for Mathematical Pipeline Testing
 * Creates a simple 33-width curve with configurable parameters
 */

class TestCurveGenerator {
  constructor() {
    this.defaultCurve = {
      'curve-name': 'test-curve',
      'curve-description': 'Test curve for mathematical pipeline validation',
      'curve-tags': ['test', 'pipeline', 'validation'],
      'curve-width': 33,
      'curve-height': 255,
      'curve-type': 'Radial',
      'curve-index-scaling': 0.5,
      'curve-data': this.generateSimpleCurveData(33),
      'generator-noise-type': 'test',
      'generator-noise-setting': {},
      'generator-top-shelf': 255,
      'generator-bottom-shelf': 0,
      'generator-value-fill': 1.0,
      'generator-value-offset': 0,
      'index-distortion-distortion_level': 0.0,
      'index-distortion-frequency': 1.0,
      'index-distortion-angular': 0.0
    };
  }

  /**
   * Generate simple curve data with a recognizable pattern
   * @param {number} width - Width of the curve
   * @returns {Array} Array of float values
   */
  generateSimpleCurveData(width) {
    const data = [];
    
    for (let i = 0; i < width; i++) {
      // Create a wave pattern: sine wave + some variation
      const baseValue = Math.sin((i / width) * 2 * Math.PI) * 100 + 127;
      const variation = Math.random() * 20 - 10; // ±10 variation
      const finalValue = Math.max(0, Math.min(255, baseValue + variation));
      
      data.push(parseFloat(finalValue.toFixed(2)));
    }
    
    return data;
  }

  /**
   * Generate a curve with custom parameters
   * @param {Object} params - Custom parameters
   * @returns {Object} Curve object
   */
  generateCustomCurve(params = {}) {
    const curve = { ...this.defaultCurve };
    
    // Override with custom parameters
    Object.keys(params).forEach(key => {
      if (curve.hasOwnProperty(key)) {
        curve[key] = params[key];
      }
    });
    
    // Regenerate curve data if width changed
    if (params['curve-width']) {
      curve['curve-data'] = this.generateSimpleCurveData(params['curve-width']);
    }
    
    return curve;
  }

  /**
   * Generate test curves with different distortion settings
   * @returns {Object} Object with different test curves
   */
  generateTestCurves() {
    return {
      // No distortion
      noDistortion: this.generateCustomCurve({
        'curve-name': 'no-distortion-test',
        'index-distortion-distortion_level': 0.0,
        'index-distortion-angular': 0.0
      }),
      
      // Low distortion
      lowDistortion: this.generateCustomCurve({
        'curve-name': 'low-distortion-test',
        'index-distortion-distortion_level': 0.3,
        'index-distortion-angular': 0.2
      }),
      
      // High distortion
      highDistortion: this.generateCustomCurve({
        'curve-name': 'high-distortion-test',
        'index-distortion-distortion_level': 0.8,
        'index-distortion-angular': 0.6
      }),
      
      // Angular distortion only
      angularOnly: this.generateCustomCurve({
        'curve-name': 'angular-distortion-test',
        'index-distortion-distortion_level': 0.0,
        'index-distortion-angular': 0.8
      }),
      
      // Index distortion only
      indexOnly: this.generateCustomCurve({
        'curve-name': 'index-distortion-test',
        'index-distortion-distortion_level': 0.7,
        'index-distortion-angular': 0.0
      }),
      
      // Different curve types
      radial: this.generateCustomCurve({
        'curve-name': 'radial-test',
        'curve-type': 'Radial'
      }),
      
      cartesianX: this.generateCustomCurve({
        'curve-name': 'cartesian-x-test',
        'curve-type': 'Cartesian X'
      }),
      
      cartesianY: this.generateCustomCurve({
        'curve-name': 'cartesian-y-test',
        'curve-type': 'Cartesian Y'
      }),
      
      // Different scaling values
      lowScaling: this.generateCustomCurve({
        'curve-name': 'low-scaling-test',
        'curve-index-scaling': 0.1
      }),
      
      highScaling: this.generateCustomCurve({
        'curve-name': 'high-scaling-test',
        'curve-index-scaling': 1.0
      })
    };
  }

  /**
   * Generate a 256x256 grid test pattern
   * @returns {Object} Grid test configuration
   */
  generate256x256GridTest() {
    return {
      grid: {
        x1: 0,
        y1: 0,
        x2: 255,
        y2: 255
      },
      testPoints: [
        { x: 0, y: 0, description: 'Origin' },
        { x: 127, y: 127, description: 'Center' },
        { x: 255, y: 255, description: 'Far corner' },
        { x: 64, y: 64, description: 'Quarter point' },
        { x: 192, y: 192, description: 'Three-quarter point' },
        { x: 0, y: 255, description: 'Top-left' },
        { x: 255, y: 0, description: 'Bottom-right' }
      ]
    };
  }

  /**
   * Print curve data in a readable format
   * @param {Object} curve - Curve object
   * @param {string} name - Name for the curve
   */
  printCurve(curve, name = 'Curve') {
    console.log(`\n=== ${name} ===`);
    console.log(`Width: ${curve['curve-width']}`);
    console.log(`Type: ${curve['curve-type']}`);
    console.log(`Index Scaling: ${curve['curve-index-scaling']}`);
    console.log(`Distortion Level: ${curve['index-distortion-distortion_level']}`);
    console.log(`Angular Distortion: ${curve['index-distortion-angular']}`);
    console.log(`Data (first 10 values): [${curve['curve-data'].slice(0, 10).join(', ')}...]`);
    console.log(`Data (last 10 values): [...${curve['curve-data'].slice(-10).join(', ')}]`);
  }
}

module.exports = new TestCurveGenerator();
