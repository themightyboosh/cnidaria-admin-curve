# Pipeline F Testing Implementation Prompt

## **🎯 OBJECTIVE**
Implement the complete Pipeline F system in the Testing app following the PIPELINE_F_SPECIFICATION.md document, using proven Babylon.js patterns to create procedural textures from DP + curve + palette data.

---

## **📋 IMPLEMENTATION REQUIREMENTS**

### **🔗 Reference Documents:**
- **Primary**: `PIPELINE_F_SPECIFICATION.md` - Authoritative implementation guide
- **Secondary**: Babylon.js documentation - WebGPU best practices
- **Validation**: `src/utils/mathPipeline.ts` - Protected shared mathematics

### **📊 Input Data (From Enhanced API):**
```javascript
// Single API call returns complete data
GET /api/distortion-controls/{id} → {
  distortionProfile: { /* all DP parameters */ },
  linkedCurve: { data: [0-255 values], width: number },
  linkedPalette: { colors: [{r,g,b,a?}], hasAlpha: boolean }
}
```

---

## **🧪 STEP-BY-STEP IMPLEMENTATION WITH TESTS**

### **STEP 1: Data Loading Validation**
```javascript
// Test: Verify complete DP data loading
async function testDataLoading(dpId: string) {
  const response = await fetch(`/api/distortion-controls/${dpId}`)
  const data = await response.json()
  
  // ✅ Validate DP structure
  assert(data.success === true)
  assert(data.data.name !== undefined)
  assert(data.data['curve-scaling'] !== undefined)
  assert(data.data['distance-calculation'] !== undefined)
  
  // ✅ Validate linked curve data  
  assert(data.data.linkedCurve.data.length > 0)
  assert(data.data.linkedCurve.data.every(v => v >= 0 && v <= 255))
  
  // ✅ Validate linked palette data
  assert(data.data.linkedPalette.colors.length > 0)
  assert(data.data.linkedPalette.colors[0].r !== undefined)
  
  console.log('✅ Data loading test passed')
}
```

### **STEP 2: Core Pipeline F Mathematics**
```javascript
// Test: Verify mathPipeline.ts integration
function testPipelineFMath(worldX: number, worldY: number, dp: any, curve: any) {
  const noiseFn = () => 1.0 // Simplified for testing
  
  const curveObj = {
    'curve-data': curve.data,
    'curve-width': curve.width,
    'curve-index-scaling': dp['curve-scaling']
  }
  
  // ✅ Test core Pipeline F
  const result = applyPipelineF(worldX, worldY, noiseFn, curveObj, dp)
  
  // ✅ Validate output structure
  assert(typeof result.value === 'number')
  assert(typeof result.index === 'number')
  assert(result.value >= 0 && result.value <= 255)
  assert(result.index >= 0 && result.index < curve.width)
  
  console.log('✅ Pipeline F mathematics test passed')
  return result
}
```

### **STEP 3: Render Mode Implementation (Radio Buttons)**
```javascript
// Test: Verify both render modes generate appropriate shaders
function testRenderModes(dp: any, curve: any, palette: any) {
  
  // ✅ Test Static Mode (Compute Shader)
  const computeShader = generatePipelineFComputeShader(dp, curve.data, palette.colors)
  assert(computeShader.includes('@compute'))
  assert(computeShader.includes('CURVE_DATA'))
  assert(computeShader.includes('PALETTE_DATA'))
  assert(computeShader.includes(`// Baked for DP: ${dp.name}`))
  
  // ✅ Test Real-time Mode (Fragment Shader)
  const fragmentShader = generatePipelineFWithTextures(dp, targetAssignments)
  assert(fragmentShader.includes('void main()'))
  assert(fragmentShader.includes('uniform sampler2D'))
  assert(fragmentShader.includes('gl_FragColor'))
  
  console.log('✅ Render mode generation test passed')
}
```

### **STEP 4: Babylon.js Material Integration**
```javascript
// Test: Verify Babylon.js material creation follows documentation
function testBabylonMaterialCreation(scene: BABYLON.Scene, renderMode: string) {
  
  if (renderMode === 'static') {
    // ✅ Test Compute Shader + StandardMaterial approach
    const computeTexture = new BABYLON.RawTexture(/* ... */)
    const material = new BABYLON.StandardMaterial("pipelineF_static", scene)
    material.diffuseTexture = computeTexture
    material.specularColor = BABYLON.Color3.Black()
    
    assert(material.diffuseTexture !== null)
    console.log('✅ Static material creation test passed')
    
  } else {
    // ✅ Test ShaderMaterial approach  
    const shaderMaterial = new BABYLON.ShaderMaterial(
      "pipelineF_realtime",
      scene,
      {
        vertexSource: vertexWGSL,
        fragmentSource: fragmentWGSL,
        shaderLanguage: BABYLON.ShaderLanguage.WGSL
      },
      {
        attributes: ["position", "normal", "uv"],
        uniforms: ["world", "worldViewProjection"],
        samplers: ["curveTexture", "paletteTexture"]
      }
    )
    
    assert(shaderMaterial !== null)
    console.log('✅ Real-time material creation test passed')
  }
}
```

### **STEP 5: Shader Code Inspection**
```javascript
// Test: Verify shader code is viewable and copyable
function testShaderInspection(generatedCode: {glsl: string, wgsl: string}) {
  
  // ✅ Validate shader code structure
  assert(generatedCode.glsl !== '')
  assert(generatedCode.wgsl !== '')
  
  // ✅ Test copy to WGSL editor functionality
  const copyToEditor = () => {
    setCustomWGSL(generatedCode.glsl)
    setTestMessage('✅ Copied generated shader to WGSL Editor')
  }
  
  // ✅ Validate baked parameters (no runtime switches)
  assert(!generatedCode.wgsl.includes('if (angularDistortion)'))
  assert(generatedCode.wgsl.includes('// Baked'))
  
  console.log('✅ Shader inspection test passed')
}
```

### **STEP 6: Visual Output Validation**
```javascript
// Test: Verify Pipeline F produces expected visual results
function testVisualOutput(mesh: BABYLON.Mesh, dp: any) {
  
  // ✅ Apply Pipeline F material to mesh
  const material = generatePipelineFMaterial(dp)
  mesh.material = material
  
  // ✅ Validate visual characteristics
  // Should produce colorful patterns (not solid colors)
  // Should match DP parameters (angular distortion visible if enabled)
  // Should use real curve and palette data
  
  // ✅ Test with different DPs
  const testDPs = ['ZorWED', 'angular-fractal-mystical-cartesiany-pattern-tides']
  testDPs.forEach(dpName => {
    // Switch DP and verify different visual output
    // Ensure each DP produces unique patterns
  })
  
  console.log('✅ Visual output validation test passed')
}
```

---

## **🔧 BABYLON.JS INTEGRATION REQUIREMENTS**

### **🎯 WebGPU-First Implementation:**
```javascript
// Follow Babylon.js 8.0+ WebGPU best practices
- Use BABYLON.WebGPUEngine (not WebGL fallback)
- Implement WGSL shaders natively  
- Use storage textures for compute shaders
- Follow texture format compatibility guidelines
- Use proper workgroup sizes (16×16×1 for compatibility)
```

### **📊 Material System Integration:**
```javascript
// Replace ALL existing shader systems with Pipeline F
- Remove old WGSL editor manual application
- Remove texture simulation approaches
- Replace with unified Pipeline F material system
- Integrate with existing geometry controls (sphere/cube/landscape)
- Connect to shader database saving functionality
```

---

## **🚨 CRITICAL SUCCESS CRITERIA**

### **✅ Must Pass All Tests:**
1. **Data loading**: Enhanced API returns complete DP + curve + palette
2. **Mathematics**: Uses protected `mathPipeline.ts` functions exactly  
3. **Render modes**: Both static and real-time modes work
4. **Shader inspection**: Generated code is viewable and copyable
5. **Visual output**: Produces colorful Pipeline F patterns (not solid colors)
6. **Babylon.js compliance**: Follows official WebGPU documentation patterns

### **🎯 Expected Results:**
- **Colorful textures**: Real Pipeline F mathematics applied to 3D objects
- **Identical to Merzbow**: Same visual output as proven implementation
- **Performance optimized**: Uses most efficient Babylon.js approaches  
- **Fully inspectable**: All generated shader code viewable
- **WebGPU native**: Leverages modern GPU capabilities

---

## **📋 REPLACEMENT REQUIREMENTS**

### **🔄 Systems to Replace:**
- ❌ **Remove**: Manual WGSL editor application
- ❌ **Remove**: Texture simulation with solid colors
- ❌ **Remove**: Complex texture binding that causes WebGPU errors
- ✅ **Replace with**: Unified Pipeline F system following specification

### **🎯 Integration Points:**
- **Geometry controls**: Apply Pipeline F to sphere/cube/landscape
- **Target assignments**: Use specification's transform logic
- **Shader database**: Save generated Pipeline F shaders
- **UI consistency**: Match existing Testing page design patterns

**This implementation must follow the specification exactly and produce identical results to the proven working Merzbow system!** 🎯
