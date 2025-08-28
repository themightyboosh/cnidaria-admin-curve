# 🧪 **API TESTING SUITE**

Mathematical Pipeline Testing and Visualization for the Cnidaria API

## 🎯 **What This Tests**

- **Mathematical Pipeline** - Complete terrain generation algorithms
- **Grid Processing** - Coordinate mapping and index calculations
- **Curve Validation** - Test curve generation with various parameters
- **Performance Metrics** - Cache efficiency and processing speed
- **Visual Outputs** - Interactive HTML grids and terminal displays

## 📁 **Test Files**

- **`testCurve.js`** - Test curve generator with configurable parameters
- **`mathTester.js`** - Comprehensive mathematical pipeline testing
- **`gridVisualizer.js`** - Grid visualization and HTML generation
- **`runTests.js`** - Command-line test runner
- **`demo.js`** - Quick demo script

## 🚀 **Quick Start**

### **From Workspace Root**
```bash
# Run comprehensive tests
node Tests/API/runTests.js comprehensive

# Quick demo
node Tests/API/demo.js

# Get help
node Tests/API/runTests.js help
```

### **From API Project Directory**
```bash
# Switch to API project
cnidaria api

# Run tests from Tests/API
cd Tests/API
node runTests.js help
```

## 📊 **Available Test Commands**

### **Comprehensive Testing**
```bash
node runTests.js comprehensive
```
Runs all test suites: single coordinates, multiple coordinates, grid processing, curve types, distortion levels, and scaling values.

### **Single Coordinate Testing**
```bash
node runTests.js single <x> <y> [curve]
# Examples:
node runTests.js single 50 50 highDistortion
node runTests.js single 0 0 noDistortion
```

### **Grid Processing Tests**
```bash
node runTests.js grid <x1> <y1> <x2> <y2> [curve]
# Examples:
node runTests.js grid 0 0 10 10 lowDistortion
node runTests.js grid -5 -5 5 5 highDistortion
```

### **Visualization-Focused Tests**
```bash
node runTests.js visualize <x1> <y1> <x2> <y2> [curve]
# Examples:
node runTests.js visualize 0 0 20 20 highDistortion
node runTests.js visualize -10 -10 10 10 angularOnly
```

### **Curve Type Comparison**
```bash
node runTests.js curve-types
```
Tests the same coordinates with different curve types (Radial, Cartesian X, Cartesian Y).

### **Distortion Level Testing**
```bash
node runTests.js distortion
```
Tests the same coordinates with different distortion levels (none, low, high).

### **Scaling Value Testing**
```bash
node runTests.js scaling
```
Tests the same coordinates with different index scaling values.

### **Pipeline Step Testing**
```bash
node runTests.js pipeline-step <step> [curve]
# Available steps: distance, scaling, distortion, angular, final
# Examples:
node runTests.js pipeline-step distortion highDistortion
node runTests.js pipeline-step angular angularOnly
```

### **Custom Curve Testing**
```bash
node runTests.js custom-curve [param value]...
# Examples:
node runTests.js custom-curve curve-index-scaling 0.3 index-distortion-distortion_level 0.5
node runTests.js custom-curve curve-type "Cartesian X" curve-index-scaling 0.8
```

## 🎨 **Available Test Curves**

- **`noDistortion`** - No distortion effects
- **`lowDistortion`** - Mild distortion
- **`highDistortion`** - Strong distortion
- **`angularOnly`** - Angular distortion only
- **`indexOnly`** - Index distortion only
- **`radial`** - Radial distance calculation
- **`cartesianX`** - Cartesian X distance calculation
- **`cartesianY`** - Cartesian Y distance calculation
- **`lowScaling`** - Low index scaling
- **`highScaling`** - High index scaling

## 📈 **Test Outputs**

### **Terminal Outputs**
- **Mathematical Pipeline Steps** - Distance, scaling, distortion, angular, final
- **Grid Visualizations** - ASCII art grids showing index positions and curve values
- **Performance Metrics** - Processing time, cache hits/misses
- **Error Handling** - Validation errors and processing failures

### **HTML Visualizations**
- **Index Position Grids** - Grayscale representation of final index positions
- **Curve Value Grids** - Hue color representation of terrain values
- **Side-by-Side Comparisons** - Both visualizations for easy comparison
- **Interactive Features** - Hover tooltips with detailed information

## 🔧 **Test Configuration**

### **Grid Sizes**
- **Small**: 10×10 to 15×15 (100-225 cells) - Quick tests
- **Medium**: 20×20 to 25×25 (400-625 cells) - Standard testing
- **Large**: 50×50 to 100×100 (2,500-10,000 cells) - Performance testing

### **Coordinate Ranges**
- **Positive Only**: (0,0) to (20,20) - Simple testing
- **Centered**: (-10,-10) to (10,10) - Origin-centered testing
- **Large Range**: (-50,-50) to (50,50) - Extended coordinate testing

## 📊 **Performance Benchmarks**

### **Processing Speed**
- **Single Coordinate**: < 1ms
- **Small Grid (10×10)**: 1-5ms
- **Medium Grid (20×20)**: 5-20ms
- **Large Grid (50×50)**: 50-200ms

### **Cache Efficiency**
- **First Run**: 0% hits, 100% misses
- **Subsequent Runs**: 100% hits, 0% misses
- **Cache Size**: 10,000 keys maximum
- **TTL**: 30 minutes per cached item

## 🎯 **Testing Best Practices**

1. **Start Small** - Begin with single coordinates and small grids
2. **Test Parameters** - Use custom-curve to find optimal values
3. **Compare Results** - Use curve-types and distortion commands
4. **Validate Visuals** - Check HTML outputs for expected patterns
5. **Performance Test** - Use larger grids to test cache efficiency

## 🚨 **Troubleshooting**

### **Common Issues**
- **Module not found**: Ensure dependencies are installed (`npm install`)
- **Grid too large**: Start with smaller grids for testing
- **Memory issues**: Reduce grid size or clear cache between tests

### **Debug Mode**
```bash
# Enable verbose output
DEBUG=true node runTests.js comprehensive

# Test specific components
node runTests.js pipeline-step distance noDistortion
```

## 📝 **Adding New Tests**

1. **Create test file** in `Tests/API/`
2. **Add test command** to `runTests.js`
3. **Update this README** with new test information
4. **Add to comprehensive suite** if appropriate

## 🔄 **Integration with Main API**

Tests use the same modules as the main API:
- **`mathProcessor.js`** - Mathematical pipeline implementation
- **`cache.js`** - Caching system
- **`validation.js`** - Input validation schemas

This ensures test results accurately reflect production behavior.

---

**Maintained by**: New Cnidaria Workspace  
**Last Updated**: $(date)  
**Version**: 1.0.0
