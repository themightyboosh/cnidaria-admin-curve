# 🧪 **CNIDARIA TESTING WORKSPACE**

This directory contains all testing infrastructure for the New Cnidaria workspace, organized by project and shared components.

## 📁 **Directory Structure**

```
Tests/
├── API/           # API project tests and visualizations
├── Admin/         # Admin tool tests (future)
├── Unity/         # Unity game tests (future)
├── Shared/        # Common testing utilities
└── README.md      # This file
```

## 🎯 **Purpose**

- **Keep project directories clean** - No test files in API/, Admin/, or Unity/
- **Centralized testing** - All tests accessible from workspace root
- **Cross-project testing** - Shared utilities and common test patterns
- **Consistent workflow** - Same testing approach across all projects

## 🚀 **Quick Start**

### **API Testing**
```bash
# From workspace root
cd Tests/API
node runTests.js help

# Or from any location
node Tests/API/runTests.js help
```

### **Admin Testing** (Future)
```bash
cd Tests/Admin
# React component testing, admin tool validation, etc.
```

### **Unity Testing** (Future)
```bash
cd Tests/Unity
# Unity test scripts, game logic validation, etc.
```

## 📋 **Current Test Suites**

### **API Project** (`Tests/API/`)
- **Mathematical Pipeline Testing** - Core terrain generation algorithms
- **Grid Visualization** - Interactive HTML grids showing results
- **Curve Validation** - Test curve generation and parameter testing
- **Performance Testing** - Cache efficiency and processing speed

### **Admin Project** (`Tests/Admin/`)
- *Coming soon* - React component testing, form validation, API integration

### **Unity Project** (`Tests/Unity/`)
- *Coming soon* - Game logic testing, performance benchmarks, asset validation

### **Shared** (`Tests/Shared/`)
- *Coming soon* - Common test utilities, mock data, test helpers

## 🔧 **Test Configuration**

Each project directory contains:
- `package.json` - Project-specific test dependencies
- `test.config.js` - Test configuration and setup
- `README.md` - Project-specific testing documentation

## 📊 **Running Tests**

### **From Workspace Root**
```bash
# API tests
node Tests/API/runTests.js comprehensive

# Admin tests (future)
npm test --prefix Tests/Admin

# Unity tests (future)
# Unity test runner integration
```

### **From Project Directory**
```bash
# Switch to API project
cnidaria api
cd Tests/API
node runTests.js help
```

## 🎨 **Visualization Outputs**

All HTML visualizations are generated in their respective project test directories:
- **API**: `Tests/API/*.html`
- **Admin**: `Tests/Admin/visualizations/` (future)
- **Unity**: `Tests/Unity/visualizations/` (future)

## 🔄 **Workspace Integration**

The testing workspace integrates with the main workspace through:
- **Project switching** - `cnidaria [project]` command
- **Shared documentation** - `Docs/` directory accessible to all tests
- **Common utilities** - Shared testing patterns and helpers
- **Cross-project validation** - End-to-end testing workflows

## 📝 **Adding New Tests**

1. **Create test files** in appropriate project directory
2. **Update project README** with test documentation
3. **Add test scripts** to project package.json
4. **Update this README** with new test suite information

## 🚨 **Important Notes**

- **Never put test files in project root directories**
- **Always use Tests/[Project]/ for test-related files**
- **Keep test outputs organized by project**
- **Maintain consistent testing patterns across projects**

---

**Maintained by**: New Cnidaria Workspace  
**Last Updated**: $(date)  
**Version**: 1.0.0
