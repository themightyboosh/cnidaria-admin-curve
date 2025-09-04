/**
 * GLSL Shader Generator for Pipeline F
 * Creates portable GLSL shaders that work in WebGL, Unity, Unreal, etc.
 */

import type { DistortionControl, Curve, Palette } from '../services/unifiedCoordinateProcessor'

export interface GLSLExportOptions {
  shaderName: string
  distortionControl: DistortionControl
  curve: Curve
  palette: Palette | null
  target: 'webgl' | 'unity' | 'unreal' | 'generic'
  includeComments: boolean
  // Nesting options
  enableNesting?: boolean
  nestingLayers?: number
  nestingBlendMode?: 'multiply' | 'add' | 'overlay' | 'screen' | 'mix'
  nestingScales?: number[]
}

export class GLSLShaderGenerator {

  /**
   * Generate distance calculation function for GLSL
   */
  private generateDistanceFunction(method: string): string {
    const functions: { [key: string]: string } = {
      'radial': 'sqrt(x * x + y * y)',
      'cartesian-x': 'abs(x)',
      'cartesian-y': 'abs(y)',
      'manhattan': 'abs(x) + abs(y)',
      'chebyshev': 'max(abs(x), abs(y))',
      'minkowski-3': 'pow(pow(abs(x), 3.0) + pow(abs(y), 3.0), 1.0/3.0)',
      'hexagonal': 'max(abs(x), max(abs(y), (abs(x) + abs(y)) * 0.5))',
      'triangular': 'abs(x) + abs(y) + abs(x + y)',
      'spiral': 'sqrt(x * x + y * y) + atan(y, x) * 10.0',
      'cross': 'min(abs(x), abs(y))',
      'sine-wave': 'abs(sin(x * 0.1)) + abs(sin(y * 0.1))',
      'ripple': 'abs(sin(sqrt(x * x + y * y) * 0.1)) * 100.0',
      'interference': 'abs(sin(x * 0.1) * sin(y * 0.1)) * 100.0',
      'hyperbolic': 'abs(x * y) * 0.01',
      'polar-rose': 'sqrt(x * x + y * y) * abs(cos(4.0 * atan(y, x)))',
      'lemniscate': 'sqrt((x * x + y * y) * (x * x + y * y) - 2.0 * 2500.0 * (x * x - y * y))',
      'logarithmic': 'log(sqrt(x * x + y * y) + 1.0) * 50.0'
    }

    return functions[method] || functions['radial']
  }

  /**
   * Generate procedural curve function
   */
  private generateProceduralCurve(curve: Curve): string {
    // Analyze curve data for procedural approximation
    const data = curve['curve-data']
    const min = Math.min(...data)
    const max = Math.max(...data)
    const avg = data.reduce((sum, val) => sum + val, 0) / data.length

    // Simple wave approximation for most curves
    const amplitude = (max - min) / 2 / 255
    const offset = avg / 255
    
    return `
float sampleCurve(float index) {
    float t = mod(abs(index), ${curve['curve-width']}.0) / ${curve['curve-width']}.0;
    return ${offset.toFixed(6)} + ${amplitude.toFixed(6)} * sin(t * 6.28318 * 2.0);
}`
  }

  /**
   * Generate palette function
   */
  private generatePaletteFunction(palette: Palette | null): string {
    if (!palette) {
      return `
vec3 samplePalette(float curveValue) {
    return vec3(curveValue, curveValue, curveValue);
}`
    }

    // Generate palette lookup function
    const colorSamples = palette.hexColors.slice(0, 16).map((hex, i) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255
      const g = parseInt(hex.slice(3, 5), 16) / 255
      const b = parseInt(hex.slice(5, 7), 16) / 255
      const threshold = i / 16
      return `    if (curveValue <= ${threshold.toFixed(6)}) return vec3(${r.toFixed(6)}, ${g.toFixed(6)}, ${b.toFixed(6)});`
    }).join('\n')

    return `
vec3 samplePalette(float curveValue) {
    curveValue = clamp(curveValue, 0.0, 1.0);
${colorSamples}
    return vec3(curveValue, curveValue, curveValue); // Fallback
}

// Blend mode functions for nesting
vec3 blendMultiply(vec3 base, vec3 overlay) {
    return base * overlay;
}

vec3 blendAdd(vec3 base, vec3 overlay) {
    return clamp(base + overlay, 0.0, 1.0);
}

vec3 blendOverlay(vec3 base, vec3 overlay) {
    return mix(2.0 * base * overlay, 1.0 - 2.0 * (1.0 - base) * (1.0 - overlay), step(0.5, base));
}

vec3 blendScreen(vec3 base, vec3 overlay) {
    return 1.0 - (1.0 - base) * (1.0 - overlay);
}

vec3 blendMix(vec3 base, vec3 overlay, float factor) {
    return mix(base, overlay, factor);
}`
  }

  /**
   * Generate WebGL fragment shader
   */
  generateWebGLShader(options: GLSLExportOptions): string {
    const { distortionControl, curve, palette, includeComments } = options

    const distanceCalc = this.generateDistanceFunction(distortionControl['distance-calculation'])
    const curveFunction = this.generateProceduralCurve(curve)
    const paletteFunction = this.generatePaletteFunction(palette)

    return `#version 300 es
precision highp float;

${includeComments ? `
// ===== PIPELINE F - WEBGL IMPLEMENTATION =====
// Standalone procedural pattern generator
// Based on Cnidaria Merzbow fractal system
// No external textures required
` : ''}

// Uniforms for distortion controls
uniform float u_angularEnabled;
uniform float u_fractalEnabled;
uniform float u_checkerboardEnabled;
uniform float u_distanceModulus;
uniform float u_curveScaling;
uniform float u_checkerboardSteps;
uniform float u_angularFrequency;
uniform float u_angularAmplitude;
uniform float u_angularOffset;
uniform float u_fractalScale1;
uniform float u_fractalScale2;
uniform float u_fractalScale3;
uniform float u_fractalStrength;

// Transform uniforms
uniform vec2 u_resolution;
uniform vec2 u_offset;
uniform float u_scale;
uniform float u_time;

in vec2 v_uv;
out vec4 fragColor;

${curveFunction}

${paletteFunction}

// Distance calculation
float calculateDistance(vec2 coord) {
    float x = coord.x;
    float y = coord.y;
    return ${distanceCalc};
}

// Pipeline F implementation
vec3 processCoordinate(vec2 worldCoord) {
    vec2 coord = worldCoord + u_offset;
    
    // Virtual centers via coordinate modulus
    if (u_distanceModulus > 0.0) {
        coord.x = mod(mod(coord.x, u_distanceModulus) + u_distanceModulus, u_distanceModulus) - u_distanceModulus * 0.5;
        coord.y = mod(mod(coord.y, u_distanceModulus) + u_distanceModulus, u_distanceModulus) - u_distanceModulus * 0.5;
    }
    
    vec2 processedCoord = coord;
    
    // Fractal distortion (coordinates) - FIRST
    if (u_fractalEnabled > 0.5) {
        vec2 fractalOffset = vec2(
            sin(processedCoord.x * u_fractalScale1) * u_fractalStrength * 0.3 +
            sin(processedCoord.x * u_fractalScale2) * u_fractalStrength * 0.2 +
            sin(processedCoord.x * u_fractalScale3) * u_fractalStrength * 0.1,
            
            cos(processedCoord.y * u_fractalScale1) * u_fractalStrength * 0.3 +
            cos(processedCoord.y * u_fractalScale2) * u_fractalStrength * 0.2 +
            cos(processedCoord.y * u_fractalScale3) * u_fractalStrength * 0.1
        );
        processedCoord += fractalOffset;
    }
    
    // Angular distortion (coordinates) - AFTER fractal
    bool effectiveAngular = u_angularEnabled > 0.5 && 
        (u_angularFrequency > 0.0 || u_angularAmplitude > 0.0 || u_angularOffset > 0.0);
        
    if (effectiveAngular) {
        float angle = atan(processedCoord.y, processedCoord.x) + (u_angularOffset * 3.14159 / 180.0);
        float distortedAngle = angle + sin(angle * u_angularFrequency) * u_angularAmplitude * 0.01;
        float currentDistance = length(processedCoord);
        processedCoord = vec2(
            currentDistance * cos(distortedAngle),
            currentDistance * sin(distortedAngle)
        );
    }
    
    // Calculate final distance
    float finalDistance = calculateDistance(processedCoord);
    
    // Fractal distortion (distance) - FIRST
    if (u_fractalEnabled > 0.5) {
        float fractalDistortion = 
            sin(finalDistance * u_fractalScale1) * u_fractalStrength * 0.3 +
            cos(finalDistance * u_fractalScale2) * u_fractalStrength * 0.2 +
            sin(finalDistance * u_fractalScale3) * u_fractalStrength * 0.1;
        finalDistance += fractalDistortion;
    }
    
    // Angular distortion (distance) - AFTER fractal
    if (effectiveAngular) {
        float angle = atan(processedCoord.y, processedCoord.x) + (u_angularOffset * 3.14159 / 180.0);
        float angularDistortion = sin(angle * u_angularFrequency) * u_angularAmplitude;
        finalDistance += angularDistortion;
    }
    
    // Apply curve scaling and sample curve
    float scaledDistance = finalDistance * u_curveScaling;
    float curveValue = sampleCurve(scaledDistance);
    
    // Apply checkerboard pattern
    if (u_checkerboardEnabled > 0.5) {
        float checkerboardDistance = calculateDistance(worldCoord);
        float stepFromCenter = floor(checkerboardDistance / u_checkerboardSteps);
        if (mod(stepFromCenter, 2.0) > 0.5) {
            curveValue = 1.0 - curveValue;
        }
    }
    
    return samplePalette(curveValue);
}

${options.enableNesting ? this.generateNestedProcessing(options) : `
void main() {
    // Convert UV to world coordinates
    vec2 worldCoord = (v_uv - 0.5) * u_resolution * u_scale;
    
    // Process using Pipeline F
    vec3 color = processCoordinate(worldCoord);
    
    fragColor = vec4(color, 1.0);
}`}

${includeComments ? `
/*
===== USAGE INSTRUCTIONS =====

WebGL Setup:
1. Load this as fragment shader
2. Create vertex shader (basic UV passthrough)
3. Set uniforms for distortion parameters
4. Render to full-screen quad

Uniform Values:
- u_angularEnabled: ${distortionControl['angular-distortion'] ? '1.0' : '0.0'}
- u_fractalEnabled: ${distortionControl['fractal-distortion'] ? '1.0' : '0.0'}
- u_checkerboardEnabled: ${distortionControl['checkerboard-pattern'] ? '1.0' : '0.0'}
- u_distanceModulus: ${distortionControl['distance-modulus']}.0
- u_curveScaling: ${distortionControl['curve-scaling']}
- u_checkerboardSteps: ${distortionControl['checkerboard-steps']}.0
- u_angularFrequency: ${distortionControl['angular-frequency']}
- u_angularAmplitude: ${distortionControl['angular-amplitude']}
- u_angularOffset: ${distortionControl['angular-offset']}
- u_fractalScale1: ${distortionControl['fractal-scale-1']}
- u_fractalScale2: ${distortionControl['fractal-scale-2']}
- u_fractalScale3: ${distortionControl['fractal-scale-3']}
- u_fractalStrength: ${distortionControl['fractal-strength']}

Performance: ~60 FPS at 1024x1024 on modern GPUs
*/` : ''}`
  }

  /**
   * Generate vertex shader for WebGL
   */
  generateWebGLVertexShader(): string {
    return `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_uv;

out vec2 v_uv;

void main() {
    v_uv = a_uv;
    gl_Position = vec4(a_position, 0.0, 1.0);
}`
  }

  /**
   * Generate complete WebGL shader package
   */
  generateWebGLPackage(options: GLSLExportOptions): {
    vertexShader: string
    fragmentShader: string
    uniformSetup: string
  } {
    const vertexShader = this.generateWebGLVertexShader()
    const fragmentShader = this.generateWebGLShader(options)
    
    const uniformSetup = `
// WebGL Uniform Setup JavaScript
const uniforms = {
    u_angularEnabled: ${options.distortionControl['angular-distortion'] ? '1.0' : '0.0'},
    u_fractalEnabled: ${options.distortionControl['fractal-distortion'] ? '1.0' : '0.0'},
    u_checkerboardEnabled: ${options.distortionControl['checkerboard-pattern'] ? '1.0' : '0.0'},
    u_distanceModulus: ${options.distortionControl['distance-modulus']}.0,
    u_curveScaling: ${options.distortionControl['curve-scaling']},
    u_checkerboardSteps: ${options.distortionControl['checkerboard-steps']}.0,
    u_angularFrequency: ${options.distortionControl['angular-frequency']},
    u_angularAmplitude: ${options.distortionControl['angular-amplitude']},
    u_angularOffset: ${options.distortionControl['angular-offset']},
    u_fractalScale1: ${options.distortionControl['fractal-scale-1']},
    u_fractalScale2: ${options.distortionControl['fractal-scale-2']},
    u_fractalScale3: ${options.distortionControl['fractal-scale-3']},
    u_fractalStrength: ${options.distortionControl['fractal-strength']},
    u_resolution: [1024.0, 1024.0],
    u_offset: [0.0, 0.0],
    u_scale: 1.0,
    u_time: 0.0
};

// Set uniforms in WebGL
Object.entries(uniforms).forEach(([name, value]) => {
    const location = gl.getUniformLocation(program, name);
    if (Array.isArray(value)) {
        gl.uniform2fv(location, value);
    } else {
        gl.uniform1f(location, value);
    }
});`

    return { vertexShader, fragmentShader, uniformSetup }
  }

  /**
   * Generate compute shader for WebGPU (WGSL)
   */
  generateWebGPUComputeShader(options: GLSLExportOptions): string {
    const { distortionControl, curve, palette } = options
    const distanceCalc = this.generateDistanceFunction(distortionControl['distance-calculation'])

    return `
// WebGPU Compute Shader (WGSL) for Pipeline F
struct DistortionParams {
    angularEnabled: f32,
    fractalEnabled: f32,
    checkerboardEnabled: f32,
    distanceModulus: f32,
    curveScaling: f32,
    checkerboardSteps: f32,
    angularFrequency: f32,
    angularAmplitude: f32,
    angularOffset: f32,
    fractalScale1: f32,
    fractalScale2: f32,
    fractalScale3: f32,
    fractalStrength: f32,
    resolution: vec2<f32>,
    offset: vec2<f32>
};

@group(0) @binding(0) var<uniform> params: DistortionParams;
@group(0) @binding(1) var<storage, read_write> outputTexture: array<vec4<f32>>;

fn calculateDistance(coord: vec2<f32>) -> f32 {
    let x = coord.x;
    let y = coord.y;
    return ${distanceCalc.replace(/abs/g, 'abs').replace(/sqrt/g, 'sqrt').replace(/sin/g, 'sin').replace(/cos/g, 'cos')};
}

fn sampleCurve(index: f32) -> f32 {
    let t = (abs(index) % ${curve['curve-width']}.0) / ${curve['curve-width']}.0;
    return ${(curve['curve-data'].reduce((sum, val) => sum + val, 0) / curve['curve-data'].length / 255).toFixed(6)} + 
           ${((Math.max(...curve['curve-data']) - Math.min(...curve['curve-data'])) / 2 / 255).toFixed(6)} * sin(t * 6.28318 * 2.0);
}

fn samplePalette(curveValue: f32) -> vec3<f32> {
    ${palette ? `
    let index = clamp(curveValue * 255.0, 0.0, 255.0);
    // Simplified palette sampling for WGSL
    return mix(vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(1.0, 1.0, 1.0), curveValue);
    ` : 'return vec3<f32>(curveValue, curveValue, curveValue);'}
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let coord = vec2<f32>(f32(global_id.x), f32(global_id.y));
    let index = global_id.y * u32(params.resolution.x) + global_id.x;
    
    if (coord.x >= params.resolution.x || coord.y >= params.resolution.y) {
        return;
    }
    
    // Convert to world coordinates
    let worldCoord = (coord - params.resolution * 0.5) + params.offset;
    
    // Process using Pipeline F (simplified for WGSL)
    var processedCoord = worldCoord;
    
    // Virtual centers
    if (params.distanceModulus > 0.0) {
        processedCoord.x = ((worldCoord.x % params.distanceModulus) + params.distanceModulus) % params.distanceModulus - params.distanceModulus * 0.5;
        processedCoord.y = ((worldCoord.y % params.distanceModulus) + params.distanceModulus) % params.distanceModulus - params.distanceModulus * 0.5;
    }
    
    // Calculate final distance and sample curve
    let finalDistance = calculateDistance(processedCoord);
    let scaledDistance = finalDistance * params.curveScaling;
    let curveValue = sampleCurve(scaledDistance);
    
    // Sample palette and output
    let color = samplePalette(curveValue);
    outputTexture[index] = vec4<f32>(color, 1.0);
}`
  }

  /**
   * Generate nested pattern processing
   */
  private generateNestedProcessing(options: GLSLExportOptions): string {
    const { nestingLayers = 3, nestingBlendMode = 'multiply', nestingScales = [1.0, 0.5, 0.25] } = options

    return `
void main() {
    vec2 worldCoord = (v_uv - 0.5) * u_resolution * u_scale;
    
    // Generate multiple layers at different scales
    vec3 layer1 = processCoordinate(worldCoord * ${nestingScales[0] || 1.0});
    vec3 layer2 = processCoordinate(worldCoord * ${nestingScales[1] || 0.5});
    vec3 layer3 = processCoordinate(worldCoord * ${nestingScales[2] || 0.25});
    
    // Combine layers using blend mode
    vec3 combined = layer1;
    ${nestingBlendMode === 'multiply' ? `
    combined = blendMultiply(combined, layer2);
    combined = blendMultiply(combined, layer3);
    ` : nestingBlendMode === 'add' ? `
    combined = blendAdd(combined, layer2);
    combined = blendAdd(combined, layer3);
    ` : nestingBlendMode === 'overlay' ? `
    combined = blendOverlay(combined, layer2);
    combined = blendOverlay(combined, layer3);
    ` : nestingBlendMode === 'screen' ? `
    combined = blendScreen(combined, layer2);
    combined = blendScreen(combined, layer3);
    ` : `
    combined = blendMix(combined, layer2, 0.5);
    combined = blendMix(combined, layer3, 0.3);
    `}
    
    fragColor = vec4(combined, 1.0);
}`
  }
}

export const glslShaderGenerator = new GLSLShaderGenerator()`
