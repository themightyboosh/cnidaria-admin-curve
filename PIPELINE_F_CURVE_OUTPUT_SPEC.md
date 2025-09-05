# Pipeline F Curve Output Specification

## Goal: Raw Curve Data Return from Distortion Profile System

Instead of generating final colors, our Pipeline F shader should return **raw curve values** that can be fed into **Babylon.js shader templates** for maximum flexibility.

## Current Pipeline F Processing Chain

```
Coordinate (x, y) 
  ↓
Initial Distance (using curve-distance-calc)
  ↓  
Noise transformation (with distance as input)
  ↓
Final Distance
  ↓
Apply distance-modulus
  ↓
Index (0-255)
  ↓
Curve value (0-1 float)
  ↓
Color (RGB from palette) ← STOP HERE, RETURN CURVE VALUE
```

## New Curve-Only Output Format

### Function Signature
```glsl
float processPipelineF(vec2 worldCoord, /* DP parameters */) {
    // Full Pipeline F processing...
    return curveValue; // 0.0 to 1.0 float
}
```

### Babylon.js Integration Pattern
```glsl
// Shader template receives curve value
float curve = processPipelineF(vWorldPosition.xy, dpParams);

// Template can use curve for ANY purpose:
vec3 color = mix(colorA, colorB, curve);           // Color interpolation
float height = curve * maxHeight;                 // Vertex displacement  
float opacity = curve;                            // Transparency
vec3 normal = perturbNormal(vNormal, curve);      // Normal mapping
float emission = curve * emissionStrength;        // Emissive glow
```

## Distortion Profile Parameter Structure

```typescript
interface BabylonDistortionParams {
  // Distance Modulus
  distanceModulus: number;
  
  // Angular Distortion  
  angularDistortion: boolean;
  angularFrequency: number;
  angularAmplitude: number;
  angularOffset: number;
  
  // Fractal Distortion
  fractalDistortion: boolean;
  fractalScale1: number;
  fractalScale2: number; 
  fractalScale3: number;
  fractalStrength: number;
  
  // Distance Calculation
  distanceCalculation: 'radial' | 'cartesian-x' | 'cartesian-y' | 'manhattan' | 'chebyshev' | 'minkowski-3' | 'spiral' | 'diamond' | 'octagonal' | 'hexagonal' | 'triangular' | 'cross' | 'star' | 'ring' | 'wave' | 'noise' | 'perlin';
  
  // Curve Scaling
  curveScaling: number;
  
  // Checkerboard
  checkerboardPattern: boolean;
  checkerboardSteps: number;
}
```

## Babylon.js Shader Template System

### Template Categories

1. **Surface Color Templates**
   - Solid color with curve intensity
   - Gradient mapping with curve position
   - HSV color space manipulation
   - Multi-color palette interpolation

2. **Surface Properties Templates**  
   - Roughness/metallic PBR control
   - Emissive intensity mapping
   - Opacity/transparency control
   - Normal map perturbation

3. **Geometry Deformation Templates**
   - Vertex displacement (height mapping)
   - Surface wave distortion  
   - Mesh morphing/animation
   - Procedural geometry generation

4. **Advanced Effect Templates**
   - Multi-pass rendering effects
   - Screen-space distortions
   - Particle system control
   - Animation parameter driving

### Template Structure
```glsl
// BABYLON.JS SHADER TEMPLATE
// Template: {{TEMPLATE_NAME}}
// Curve Input: processPipelineF() -> float (0.0-1.0)

precision highp float;

// Standard Babylon.js inputs
varying vec2 vUV;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;

// Pipeline F parameters (baked from DP)
{{PIPELINE_F_PARAMS}}

// Pipeline F processing function
{{PIPELINE_F_FUNCTION}}

// Template-specific parameters
{{TEMPLATE_PARAMS}}

void main() {
    // Get raw curve value
    float curve = processPipelineF(vWorldPosition.xy);
    
    // Template-specific processing
    {{TEMPLATE_LOGIC}}
    
    gl_FragColor = vec4(finalColor, finalOpacity);
}
```

## Implementation Steps

1. **Modify Merzbow DP Shader Generation**
   - Change output from `vec3 color` to `float curve`
   - Remove palette processing from generated shader
   - Keep all Pipeline F mathematics intact

2. **Create Babylon.js Template Library**
   - 15-20 common shader templates
   - Parameter injection system
   - Template selection UI

3. **Template Compilation System**
   - Combine Pipeline F function + template
   - Bake DP parameters into shader
   - Generate final Babylon.js material

4. **Testing & Validation**
   - Test all templates on 3 geometries
   - Verify curve value accuracy
   - Performance benchmarking

## Expected Benefits

- **Maximum Flexibility**: One curve function, infinite visual possibilities
- **Performance**: Single Pipeline F calculation, multiple template uses  
- **Modularity**: Templates can be mixed, layered, combined
- **Maintainability**: Pipeline F logic separate from rendering
- **Extensibility**: Easy to add new templates without touching core math

## File Changes Required

- `src/pages/Merzbow/index.tsx`: Modify `generateAndLinkShader()`
- `src/utils/babylonTemplates.ts`: New template library
- `src/pages/Testing/index.tsx`: Template selection UI
- API: Update shader storage to include template metadata

This approach transforms Pipeline F from a **texture generator** into a **universal curve provider** for Babylon.js! 🎯
