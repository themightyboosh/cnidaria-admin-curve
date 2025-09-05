import React, { useEffect, useRef, useState } from 'react'
import Header from '../../components/Header'
import { apiUrl } from '../../config/environments'
import './Testing.css'

type GeometryType = 'sphere' | 'cube' | 'landscape-box'

interface Shader {
  id: string
  name: string
  category: string
  glsl: Record<string, string>
  targets: string[]
  createdAt: string
  updatedAt: string
}

interface DistortionProfile {
  id: string
  name: string
  'angular-distortion': boolean
  'fractal-distortion': boolean
  'checkerboard-pattern': boolean
  'distance-calculation': string
  'distance-modulus': number
  'curve-scaling': number
  'checkerboard-steps': number
  'angular-frequency': number
  'angular-amplitude': number
  'angular-offset': number
  'fractal-scale-1': number
  'fractal-scale-2': number
  'fractal-scale-3': number
  'fractal-strength': number
}

interface ShaderBuilderConfig {
  shaderType: string
  objectData1: string
  objectData2: string
  transformableElements: string[]
  outputFormat: string
  targetElements: string[]
  selectedDP: string
}

// Shader capabilities matrix
const SHADER_CAPABILITIES = {
  fragment: {
    canAffect: ['material', 'color', 'lighting'],
    objectData: ['position', 'uv', 'normal', 'cameraDistance', 'viewDirection'],
    targetElements: ['diffuse', 'red', 'green', 'blue', 'opacity', 'emissive', 'roughness', 'metallic'],
    internalElements: ['lighting', 'fresnel', 'reflection', 'refraction'],
    transformFormats: ['percentage', 'color', 'intensity', 'signed']
  },
  compute: {
    canAffect: ['texture', 'data', 'simulation'],
    objectData: ['position', 'uv', 'index', 'workgroupId'],
    targetElements: ['rgba', 'data', 'buffer'],
    internalElements: ['parallelProcessing', 'storageBuffer', 'workgroupSync'],
    transformFormats: ['raw', 'normalized', 'integer', 'float']
  },
  vertex: {
    canAffect: ['geometry', 'position', 'attributes'],
    objectData: ['position', 'normal', 'uv', 'vertexIndex'],
    targetElements: ['worldPosition', 'clipPosition', 'normal', 'uv'],
    internalElements: ['transformation', 'displacement', 'morphing'],
    transformFormats: ['worldSpace', 'clipSpace', 'displacement', 'scale']
  },
  procedural: {
    canAffect: ['texture', 'pattern'],
    objectData: ['uv', 'position', 'time'],
    targetElements: ['diffuse', 'red', 'green', 'blue', 'alpha'],
    internalElements: ['tiling', 'animation', 'noise'],
    transformFormats: ['percentage', 'color', 'pattern']
  }
}

// Transform curve value (0-1) to target element format
const CURVE_TRANSFORMS = {
  // Color transforms (0-1 → color space)
  diffuse: (curve: number) => `vec3f(${curve.toFixed(3)})`,
  red: (curve: number) => `${curve.toFixed(3)}`,
  green: (curve: number) => `${curve.toFixed(3)}`,
  blue: (curve: number) => `${curve.toFixed(3)}`,
  
  // Material property transforms (0-1 → material range)
  opacity: (curve: number) => `${curve.toFixed(3)}`, // 0-1 directly
  emissive: (curve: number) => `vec3f(${(curve * 3.0).toFixed(3)})`, // 0-3 range for glow
  roughness: (curve: number) => `${curve.toFixed(3)}`, // 0-1 directly
  metallic: (curve: number) => `${curve.toFixed(3)}`, // 0-1 directly
  
  // Geometry transforms (0-1 → world space)
  worldPosition: (curve: number) => `vec3f(input.position.x, input.position.y + ${(curve * 2.0 - 1.0).toFixed(3)}, input.position.z)`, // ±1 displacement
  clipPosition: (curve: number) => `input.position * ${(0.5 + curve * 0.5).toFixed(3)}`, // 0.5-1.0 scale
  displacement: (curve: number) => `input.normal * ${(curve * 0.5).toFixed(3)}`, // 0-0.5 normal displacement
  
  // Lighting transforms (0-1 → lighting range)  
  lighting: (curve: number) => `${(0.2 + curve * 0.8).toFixed(3)}`, // 0.2-1.0 range
  fresnel: (curve: number) => `pow(1.0 - dot(input.viewDirection, input.normal), ${(1.0 + curve * 4.0).toFixed(3)})`, // 1-5 power
  
  // Texture/Pattern transforms (0-1 → texture space)
  rgba: (curve: number) => `vec4f(${curve.toFixed(3)}, ${curve.toFixed(3)}, ${curve.toFixed(3)}, 1.0)`,
  pattern: (curve: number) => `${curve.toFixed(3)}`,
  tiling: (curve: number) => `${(1.0 + curve * 9.0).toFixed(3)}`, // 1-10 tiling factor
}

const Testing: React.FC = () => {
  const babylonContainerRef = useRef<HTMLDivElement>(null)
  const [testMessage, setTestMessage] = useState('Testing page loaded')
  const [availableShaders, setAvailableShaders] = useState<Shader[]>([])
  const [selectedShader, setSelectedShader] = useState<Shader | null>(null)
  const [isLoadingShaders, setIsLoadingShaders] = useState(false)
  const [babylonScene, setBabylonScene] = useState<any>(null)
  const [currentGeometry, setCurrentGeometry] = useState<GeometryType>('sphere')
  const [vertexCount, setVertexCount] = useState(32)
  
  // Shader Builder State
  const [availableDistortionProfiles, setAvailableDistortionProfiles] = useState<DistortionProfile[]>([])
  const [shaderBuilder, setShaderBuilder] = useState<ShaderBuilderConfig>({
    shaderType: 'fragment',           // Fragment shader for texture generation (like Merzbow)
    objectData1: 'position',          // World position coordinates (primary - matches Merzbow worldX/worldY)
    objectData2: 'position',          // World position coordinates (secondary - pure position like Merzbow)
    transformableElements: [],
    outputFormat: 'percentage',       // 0-1 range for color values (matches Merzbow processing)
    targetElements: ['diffuse'],      // Generate diffuse color texture (like Merzbow canvas)
    selectedDP: ''                    // Will auto-select first available DP
  })

  // Curve texture cache - SINGLE TEXTURE PER CURVE, SHARED ACROSS ALL INSTANCES
  const curveTextureCache = useRef<Map<string, any>>(new Map())

  // Load all shaders from API
  const loadShaders = async () => {
    setIsLoadingShaders(true)
    try {
      console.log('📡 Loading shaders from API...')
      const response = await fetch(`${apiUrl}/api/shaders`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setAvailableShaders(data.data)
          console.log(`✅ Loaded ${data.data.length} shaders`)
          setTestMessage(`Loaded ${data.data.length} shaders from system`)
        } else {
          console.error('❌ Invalid shader data:', data)
          setTestMessage('Failed to load shader data')
        }
      } else {
        console.error('❌ Failed to load shaders:', response.statusText)
        setTestMessage(`Failed to load shaders: ${response.statusText}`)
      }
    } catch (error) {
      console.error('❌ Error loading shaders:', error)
      setTestMessage(`Error loading shaders: ${error.message}`)
    } finally {
      setIsLoadingShaders(false)
    }
  }

  // Load all distortion profiles from API
  const loadDistortionProfiles = async () => {
    try {
      console.log('📡 Loading distortion profiles from API...')
      const response = await fetch(`${apiUrl}/api/distortion-controls/firebase`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data && data.data.distortionControls) {
          const distortionControls = data.data.distortionControls
          setAvailableDistortionProfiles(distortionControls)
          console.log(`✅ Loaded ${distortionControls.length} distortion profiles`)
          
          // Auto-select the first DP for immediate testing (like Merzbow auto-selection)
          if (distortionControls.length > 0 && !shaderBuilder.selectedDP) {
            const firstDP = distortionControls[0]
            setShaderBuilder(prev => ({
              ...prev,
              selectedDP: firstDP.id
            }))
            console.log(`🎯 Auto-selected first DP: ${firstDP.name}`)
            setTestMessage(`Loaded ${distortionControls.length} DPs, auto-selected: ${firstDP.name}`)
          } else {
            setTestMessage(`Loaded ${distortionControls.length} distortion profiles`)
          }
        } else {
          console.error('❌ Invalid API response structure:', data)
          setTestMessage('Failed to load distortion profiles - invalid response')
        }
      } else {
        console.error('❌ Failed to load distortion profiles:', response.statusText)
      }
    } catch (error) {
      console.error('❌ Error loading distortion profiles:', error)
    }
  }

  // Direct DP → WGSL Pipeline F Shader (Identical to Merzbow Math)
  const generatePipelineFShader = (dp: DistortionProfile): string => {
    console.log(`🚀 DP → WGSL: ${dp.name} → Fragment Shader (identical Merzbow mathematics)`)
    
    return `
// WGSL Fragment Shader - Direct Pipeline F from DP
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
    @location(1) worldPosition: vec3f,
    @location(2) normal: vec3f,
}

// Curve data texture for array lookup
@group(0) @binding(0) var curveTexture: texture_2d<f32>;
@group(0) @binding(1) var curveSampler: sampler;

@fragment
fn main(input: VertexOutput) -> @location(0) vec4f {
    // Pipeline F Mathematics - Direct from DP
    var coord = input.worldPosition.xy;
    
    // Step 1: Distance Modulus
    ${dp['distance-modulus'] > 0 ? `
    let modulus = ${dp['distance-modulus'].toFixed(1)}f;
    coord = (coord + modulus * 0.5) % modulus - modulus * 0.5;
    ` : ''}
    
    // Step 2: Angular Distortion
    ${dp['angular-distortion'] ? `
    let angle = atan2(coord.y, coord.x);
    let radius = length(coord);
    let newAngle = angle + sin(angle * ${dp['angular-frequency'].toFixed(1)}f + ${dp['angular-offset'].toFixed(1)}f * 0.017453f) * ${dp['angular-amplitude'].toFixed(1)}f * 0.01f;
    coord = vec2f(cos(newAngle) * radius, sin(newAngle) * radius);
    ` : ''}
    
    // Step 3: Fractal Distortion (3-scale)
    ${dp['fractal-distortion'] ? `
    coord.x += sin(coord.y * ${dp['fractal-scale-1'].toFixed(3)}f) * ${dp['fractal-strength'].toFixed(1)}f * 0.3f;
    coord.y += cos(coord.x * ${dp['fractal-scale-2'].toFixed(3)}f) * ${dp['fractal-strength'].toFixed(1)}f * 0.3f;
    coord.x += sin(coord.y * ${dp['fractal-scale-3'].toFixed(3)}f) * ${dp['fractal-strength'].toFixed(1)}f * 0.1f;
    ` : ''}
    
    // Step 4: Distance Calculation
    var distance: f32;
    ${(() => {
      switch(dp['distance-calculation']) {
        case 'radial': return 'distance = length(coord);'
        case 'cartesian-x': return 'distance = abs(coord.x);'
        case 'cartesian-y': return 'distance = abs(coord.y);'
        case 'manhattan': return 'distance = abs(coord.x) + abs(coord.y);'
        case 'chebyshev': return 'distance = max(abs(coord.x), abs(coord.y));'
        default: return 'distance = length(coord);'
      }
    })()}
    
    // Step 5: Curve Scaling
    distance *= ${dp['curve-scaling'].toFixed(4)}f;
    
    // Step 6: Index → Curve Array Lookup
    let curveIndex = clamp(floor(distance * 255.0f), 0.0f, 255.0f);
    let texCoord = vec2f(curveIndex / 255.0f, 0.5f);
    let curveValue = textureSample(curveTexture, curveSampler, texCoord).r;
    
    // Step 7: Checkerboard Pattern
    ${dp['checkerboard-pattern'] && dp['checkerboard-steps'] > 0 ? `
    let checker = floor(distance / ${dp['checkerboard-steps'].toFixed(1)}f);
    if (checker % 2.0f > 0.5f) {
        curveValue = 1.0f - curveValue;
    }
    ` : ''}
    
    // Apply curve value to diffuse color (Merzbow-style)
    let finalColor = vec3f(curveValue);
    
    return vec4f(finalColor, 1.0f);
}`

    // WGSL Pipeline F function with DP parameters baked in
    const wgslPipelineF = `
// WGSL Pipeline F processing with baked DP parameters
// Returns: vec2f(curveIndex, curveValue) - both index and curve data available
fn processPipelineF(worldCoord: vec2f) -> vec2f {
    var coord = worldCoord;
    
    // Step 1: Distance Modulus (Virtual Centers)
    ${dp['distance-modulus'] > 0 ? `
    let modulus = ${dp['distance-modulus'].toFixed(1)}f;
    coord = (coord + modulus * 0.5) % modulus - modulus * 0.5;
    ` : ''}
    
    // Step 2: Angular Distortion
    ${dp['angular-distortion'] ? `
    let angle = atan2(coord.y, coord.x);
    let radius = length(coord);
    let newAngle = angle + sin(angle * ${dp['angular-frequency'].toFixed(1)}f + ${dp['angular-offset'].toFixed(1)}f * 0.017453f) * ${dp['angular-amplitude'].toFixed(1)}f * 0.01f;
    coord = vec2f(cos(newAngle) * radius, sin(newAngle) * radius);
    ` : ''}
    
    // Step 3: Fractal Distortion (3-scale)
    ${dp['fractal-distortion'] ? `
    coord.x += sin(coord.y * ${dp['fractal-scale-1'].toFixed(3)}f) * ${dp['fractal-strength'].toFixed(1)}f * 0.3f;
    coord.y += cos(coord.x * ${dp['fractal-scale-2'].toFixed(3)}f) * ${dp['fractal-strength'].toFixed(1)}f * 0.3f;
    coord.x += sin(coord.y * ${dp['fractal-scale-3'].toFixed(3)}f) * ${dp['fractal-strength'].toFixed(1)}f * 0.1f;
    ` : ''}
    
    // Step 4: Distance Calculation
    var distance: f32;
    ${(() => {
      switch(dp['distance-calculation']) {
        case 'radial': return 'distance = length(coord);'
        case 'cartesian-x': return 'distance = abs(coord.x);'
        case 'cartesian-y': return 'distance = abs(coord.y);'
        case 'manhattan': return 'distance = abs(coord.x) + abs(coord.y);'
        case 'chebyshev': return 'distance = max(abs(coord.x), abs(coord.y));'
        default: return 'distance = length(coord);'
      }
    })()}
    
    // Step 5: Curve Scaling
    distance *= ${dp['curve-scaling'].toFixed(4)}f;
    
    // Step 6: Distance → Index (0-255) → Curve Array Lookup → Transform Values
    // Convert distance to curve index (0-255 integer range) 
    let curveIndex = clamp(floor(distance * 255.0f), 0.0f, 255.0f);
    
    // Look up the actual curve value at this specific index
    let curveValue = lookupCurveValue(curveIndex);
    
    // BOTH VALUES NOW AVAILABLE FOR TRANSFORMS:
    // - curveIndex: Raw calculated index (0-255) for integer-based transforms
    // - curveValue: Curve data at that index (0-1) for normalized transforms
    
    return vec2f(curveIndex, curveValue); // Return both values
    
    // Step 7: Checkerboard Pattern (applied to curve value)
    ${dp['checkerboard-pattern'] && dp['checkerboard-steps'] > 0 ? `
    let checker = floor(distance / ${dp['checkerboard-steps'].toFixed(1)}f);
    if (checker % 2.0f > 0.5f) {
        curveValue = 1.0f - curveValue;
    }
    ` : ''}
    
    return vec2f(curveIndex, curveValue);
}`;

    // GLSL Pipeline F function (fallback)
    const glslPipelineF = `
// GLSL Pipeline F processing with baked DP parameters
// Returns: vec2(curveIndex, curveValue) - both index and curve data available
vec2 processPipelineF(vec2 worldCoord) {
    vec2 coord = worldCoord;
    
    // Step 1: Distance Modulus (Virtual Centers)
    ${dp['distance-modulus'] > 0 ? `
    float modulus = ${dp['distance-modulus'].toFixed(1)};
    coord = mod(coord + modulus * 0.5, modulus) - modulus * 0.5;
    ` : ''}
    
    // Step 2: Angular Distortion
    ${dp['angular-distortion'] ? `
    float angle = atan(coord.y, coord.x);
    float radius = length(coord);
    angle += sin(angle * ${dp['angular-frequency'].toFixed(1)} + ${dp['angular-offset'].toFixed(1)} * 0.017453) * ${dp['angular-amplitude'].toFixed(1)} * 0.01;
    coord = vec2(cos(angle) * radius, sin(angle) * radius);
    ` : ''}
    
    // Step 3: Fractal Distortion (3-scale)
    ${dp['fractal-distortion'] ? `
    coord.x += sin(coord.y * ${dp['fractal-scale-1'].toFixed(3)}) * ${dp['fractal-strength'].toFixed(1)} * 0.3;
    coord.y += cos(coord.x * ${dp['fractal-scale-2'].toFixed(3)}) * ${dp['fractal-strength'].toFixed(1)} * 0.3;
    coord.x += sin(coord.y * ${dp['fractal-scale-3'].toFixed(3)}) * ${dp['fractal-strength'].toFixed(1)} * 0.1;
    ` : ''}
    
    // Step 4: Distance Calculation
    float distance;
    ${(() => {
      switch(dp['distance-calculation']) {
        case 'radial': return 'distance = length(coord);'
        case 'cartesian-x': return 'distance = abs(coord.x);'
        case 'cartesian-y': return 'distance = abs(coord.y);'
        case 'manhattan': return 'distance = abs(coord.x) + abs(coord.y);'
        case 'chebyshev': return 'distance = max(abs(coord.x), abs(coord.y));'
        default: return 'distance = length(coord);'
      }
    })()}
    
    // Step 5: Curve Scaling
    distance *= ${dp['curve-scaling'].toFixed(4)};
    
    // Step 6: Distance → Index (0-255) → Curve Array Lookup → Transform Values
    // Convert distance to curve index (0-255 integer range)
    float curveIndex = clamp(floor(distance * 255.0), 0.0, 255.0);
    
    // Look up the actual curve value at this specific index
    float curveValue = lookupCurveValue(curveIndex);
    
    // BOTH VALUES NOW AVAILABLE FOR TRANSFORMS:
    // - curveIndex: Raw calculated index (0-255) for integer-based transforms
    // - curveValue: Curve data at that index (0-1) for normalized transforms
    
    // Step 7: Checkerboard Pattern (applied to curve value)
    ${dp['checkerboard-pattern'] && dp['checkerboard-steps'] > 0 ? `
    float checker = floor(distance / ${dp['checkerboard-steps'].toFixed(1)});
    if (mod(checker, 2.0) > 0.5) {
        curveValue = 1.0 - curveValue;
    }
    ` : ''}
    
    return vec2(curveIndex, curveValue);
}`;

    // Generate WGSL Compute Shader
    if (config.shaderType === 'compute') {
      const wgsl = `
// WGSL Compute Shader for Pipeline F
@group(0) @binding(0) var<storage, read_write> outputBuffer: array<vec4f>;

${wgslPipelineF}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let texSize = 1024u;
    if (global_id.x >= texSize || global_id.y >= texSize) {
        return;
    }
    
    // Convert to world coordinates
    let uv = vec2f(f32(global_id.x), f32(global_id.y)) / f32(texSize);
    let worldCoord = (uv - 0.5) * 20.0;
    
    // Get raw curve value from Pipeline F
    var curve = processPipelineF(worldCoord);
    
    // Transform curve value based on output format
    ${(() => {
      switch(config.outputFormat) {
        case 'percentage': return 'curve = curve;' // 0-1 range
        case 'hex': return 'curve = floor(curve * 255.0f) / 255.0f;' // Hex-compatible
        case 'multiplier': return 'curve = curve * 2.0f;' // 0-2 range
        case 'signed': return 'curve = curve * 2.0f - 1.0f;' // -1 to 1 range
        default: return 'curve = curve;'
      }
    })()}
    
    // Apply to target elements
    var finalColor = vec3f(0.5);
    var finalOpacity = 1.0f;
    
    ${config.targetElements.includes('diffuse') ? 'finalColor = vec3f(curve);' : ''}
    ${config.targetElements.includes('red') ? 'finalColor.r = curve;' : ''}
    ${config.targetElements.includes('green') ? 'finalColor.g = curve;' : ''}
    ${config.targetElements.includes('blue') ? 'finalColor.b = curve;' : ''}
    ${config.targetElements.includes('opacity') ? 'finalOpacity = curve;' : ''}
    ${config.targetElements.includes('emissive') ? 'finalColor *= curve * 2.0f;' : ''}
    
    let index = global_id.y * texSize + global_id.x;
    outputBuffer[index] = vec4f(finalColor, finalOpacity);
}`;

      const glsl = '// GLSL fallback not available for compute shaders';
      return { wgsl, glsl };
    }
    
    // Generate Material Shader (WGSL + GLSL) - Full Babylon.js Integration
    if (config.shaderType === 'fragment') {
      const coord1 = getCoordinateSource(config.objectData1)
      const coord2 = getCoordinateSource(config.objectData2)
      
      const vertexWGSL = `
// WGSL Vertex Shader for Pipeline F Material
struct VertexInput {
    @location(0) position: vec3f,
    @location(1) normal: vec3f,
    @location(2) uv: vec2f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
    @location(1) worldPosition: vec3f,
    @location(2) normal: vec3f,
    @location(3) viewDirection: vec3f,
}

struct Uniforms {
    worldMatrix: mat4x4f,
    viewProjectionMatrix: mat4x4f,
    cameraPosition: vec3f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    // Transform to world space
    let worldPos = uniforms.worldMatrix * vec4f(input.position, 1.0);
    output.worldPosition = worldPos.xyz;
    
    // Transform to clip space
    output.position = uniforms.viewProjectionMatrix * worldPos;
    
    // Pass through UV and normal
    output.uv = input.uv;
    output.normal = normalize((uniforms.worldMatrix * vec4f(input.normal, 0.0)).xyz);
    output.viewDirection = normalize(uniforms.cameraPosition - worldPos.xyz);
    
    return output;
}`;

      const wgsl = `
// WGSL Fragment Shader for Pipeline F Material
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
    @location(1) worldPosition: vec3f,
    @location(2) normal: vec3f,
    @location(3) viewDirection: vec3f,
}

struct MaterialUniforms {
    cameraPosition: vec3f,
    time: f32,
}

@group(1) @binding(0) var<uniform> material: MaterialUniforms;

${getCurveDataFunction(true)}

${wgslPipelineF}

@fragment
fn main(input: VertexOutput) -> @location(0) vec4f {
    // Use selected object data for coordinates
    let coord1 = ${coord1};
    let coord2 = ${coord2};
    
    // Combine coordinates based on user selection
    let finalCoord = coord1 + coord2 * 0.1; // Blend the two data sources
    
    // Get BOTH index and curve value from Pipeline F
    let pipelineResult = processPipelineF(finalCoord);
    let curveIndex = pipelineResult.x; // Raw index (0-255)
    var curveValue = pipelineResult.y; // Curve data (0-1)
    
    // Transform curve value based on output format
    ${(() => {
      switch(config.outputFormat) {
        case 'percentage': return 'curveValue = curveValue;' // 0-1 range
        case 'hex': return 'curveValue = floor(curveValue * 255.0f) / 255.0f;' // Hex-compatible
        case 'multiplier': return 'curveValue = curveValue * 2.0f;' // 0-2 range
        case 'signed': return 'curveValue = curveValue * 2.0f - 1.0f;' // -1 to 1 range
        default: return 'curveValue = curveValue;'
      }
    })()}
    
    // Apply transforms using BOTH index and curve value
    var baseColor = vec3f(0.7, 0.7, 0.7); // Default material color
    var finalColor = baseColor;
    var finalOpacity = 1.0f;
    var emissive = vec3f(0.0);
    var metallic = 0.0f;
    var roughness = 0.5f;
    
    // Transform options: Use curveValue (0-1) for most, curveIndex (0-255) for discrete effects
    ${config.targetElements.includes('diffuse') ? 'finalColor = vec3f(curveValue);' : ''}
    ${config.targetElements.includes('red') ? 'finalColor.r = curveValue;' : ''}
    ${config.targetElements.includes('green') ? 'finalColor.g = curveValue;' : ''}
    ${config.targetElements.includes('blue') ? 'finalColor.b = curveValue;' : ''}
    ${config.targetElements.includes('opacity') ? 'finalOpacity = curveValue;' : ''}
    ${config.targetElements.includes('emissive') ? 'emissive = vec3f(curveValue * 3.0f);' : ''}
    ${config.targetElements.includes('roughness') ? 'roughness = curveValue;' : ''}
    ${config.targetElements.includes('metallic') ? 'metallic = curveValue;' : ''}
    
    // Example of using curveIndex for discrete effects (commented out for now)
    // ${config.targetElements.includes('discrete') ? 'let discreteLevel = floor(curveIndex / 32.0f); // 8 discrete levels' : ''}
    
    // Simple lighting calculation
    let lightDir = normalize(vec3f(1.0, 1.0, 1.0));
    let NdotL = max(dot(input.normal, lightDir), 0.0);
    let lighting = 0.3 + 0.7 * NdotL; // Ambient + diffuse
    
    finalColor = finalColor * lighting + emissive;
    
    return vec4f(finalColor, finalOpacity);
}`;

      const vertexGLSL = `
// GLSL Vertex Shader for Pipeline F Material
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 worldMatrix;
uniform mat4 viewProjectionMatrix;
uniform vec3 cameraPosition;

varying vec2 vUV;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vViewDirection;

void main() {
    vec4 worldPos = worldMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    
    gl_Position = viewProjectionMatrix * worldPos;
    
    vUV = uv;
    vNormal = normalize((worldMatrix * vec4(normal, 0.0)).xyz);
    vViewDirection = normalize(cameraPosition - worldPos.xyz);
}`;

      const glsl = `
precision highp float;

varying vec2 vUV;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vViewDirection;

uniform vec3 cameraPosition;
uniform float time;

${getCurveDataFunction(false)}

${glslPipelineF}

void main() {
    // Use selected object data for coordinates
    vec2 coord1 = ${coord1.replace(/input\./g, 'v').replace(/vec2f/g, 'vec2')};
    vec2 coord2 = ${coord2.replace(/input\./g, 'v').replace(/vec2f/g, 'vec2')};
    
    // Combine coordinates based on user selection
    vec2 finalCoord = coord1 + coord2 * 0.1; // Blend the two data sources
    
    // Get BOTH index and curve value from Pipeline F
    vec2 pipelineResult = processPipelineF(finalCoord);
    float curveIndex = pipelineResult.x; // Raw index (0-255)
    float curveValue = pipelineResult.y; // Curve data (0-1)
    
    // Transform curve value based on output format
    ${(() => {
      switch(config.outputFormat) {
        case 'percentage': return 'curveValue = curveValue;' // 0-1 range
        case 'hex': return 'curveValue = floor(curveValue * 255.0) / 255.0;' // Hex-compatible
        case 'multiplier': return 'curveValue = curveValue * 2.0;' // 0-2 range
        case 'signed': return 'curveValue = curveValue * 2.0 - 1.0;' // -1 to 1 range
        default: return 'curveValue = curveValue;'
      }
    })()}
    
    // Apply transforms using BOTH index and curve value
    vec3 baseColor = vec3(0.7, 0.7, 0.7); // Default material color
    vec3 finalColor = baseColor;
    float finalOpacity = 1.0;
    vec3 emissive = vec3(0.0);
    
    // Transform options: Use curveValue (0-1) for most, curveIndex (0-255) for discrete effects
    ${config.targetElements.includes('diffuse') ? 'finalColor = vec3(curveValue);' : ''}
    ${config.targetElements.includes('red') ? 'finalColor.r = curveValue;' : ''}
    ${config.targetElements.includes('green') ? 'finalColor.g = curveValue;' : ''}
    ${config.targetElements.includes('blue') ? 'finalColor.b = curveValue;' : ''}
    ${config.targetElements.includes('opacity') ? 'finalOpacity = curveValue;' : ''}
    ${config.targetElements.includes('emissive') ? 'emissive = vec3(curveValue * 3.0);' : ''}
    
    // Example of using curveIndex for discrete effects (commented out for now)
    // ${config.targetElements.includes('discrete') ? 'float discreteLevel = floor(curveIndex / 32.0); // 8 discrete levels' : ''}
    
    // Simple lighting calculation
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float NdotL = max(dot(vNormal, lightDir), 0.0);
    float lighting = 0.3 + 0.7 * NdotL; // Ambient + diffuse
    
    finalColor = finalColor * lighting + emissive;
    
    gl_FragColor = vec4(finalColor, finalOpacity);
}`;

      return { wgsl, glsl, vertexWGSL, vertexGLSL };
    }
    
    return { 
      wgsl: '// WGSL shader type not implemented yet', 
      glsl: '// GLSL shader type not implemented yet' 
    };
  }

  // Get curve data array (256 values, 0-1 normalized) for shader index lookup
  const getCurveDataArray = async (curveId: string): Promise<Float32Array> => {
    try {
      console.log(`📊 Getting curve data array for: ${curveId}`)
      const response = await fetch(`${apiUrl}/api/curves`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data && data.data.curves) {
          const curves = data.data.curves
          
          // Find curve by ID or name
          const targetCurve = curves.find((curve: any) => curve.id === curveId || curve.name === curveId)
          if (targetCurve && targetCurve.data) {
            console.log(`✅ Found curve data: ${targetCurve.data.length} values`)
            
            // THIS IS THE KEY: Convert raw curve data (0-255) to normalized array (0-1)
            const curveArray = new Float32Array(256)
            for (let i = 0; i < 256; i++) {
              curveArray[i] = (targetCurve.data[i] || 0) / 255.0
            }
            
            console.log(`🎯 Curve array ready: 256 values (0-1 normalized)`)
            return curveArray
          }
        }
      }
      
      console.log('⚠️ Curve not found, creating default array')
      // Fallback: Simple curve data array
      const defaultArray = new Float32Array(256)
      for (let i = 0; i < 256; i++) {
        defaultArray[i] = i / 255.0 // Linear ramp 0-1
      }
      return defaultArray
      
    } catch (error) {
      console.error('❌ Error getting curve data:', error)
      // Return default array on error
      const defaultArray = new Float32Array(256)
      for (let i = 0; i < 256; i++) {
        defaultArray[i] = i / 255.0
      }
      return defaultArray
    }
  }

  // Create curve texture from curve data array (with caching for memory efficiency)
  const createCurveTexture = (curveData: Float32Array, curveId: string, scene: any, BABYLON: any): any => {
    // Check if texture already exists in cache
    if (curveTextureCache.current.has(curveId)) {
      console.log(`♻️ Using cached curve texture for: ${curveId}`)
      return curveTextureCache.current.get(curveId)
    }
    
    console.log(`🎨 Creating NEW curve data texture for: ${curveId}`)
    
    // Create 256x1 texture data (RGBA format)
    const textureData = new Uint8Array(256 * 4) // 256 pixels × 4 channels (RGBA)
    
    for (let i = 0; i < 256; i++) {
      const value = Math.floor(curveData[i] * 255) // Convert 0-1 back to 0-255 for texture
      const pixelIndex = i * 4
      
      textureData[pixelIndex] = value     // Red channel (curve value)
      textureData[pixelIndex + 1] = value // Green channel (same value)
      textureData[pixelIndex + 2] = value // Blue channel (same value)
      textureData[pixelIndex + 3] = 255   // Alpha channel (fully opaque)
    }
    
    // Create Babylon.js texture from data
    const texture = new BABYLON.RawTexture(
      textureData,
      256,  // width
      1,    // height
      BABYLON.Constants.TEXTUREFORMAT_RGBA,
      scene,
      false, // generateMipMaps
      false, // invertY
      BABYLON.Constants.TEXTURE_NEAREST_SAMPLINGMODE // Use nearest sampling for exact values
    )
    
    // Cache the texture for reuse across multiple shader instances
    curveTextureCache.current.set(curveId, texture)
    
    console.log(`✅ Curve texture created and cached: ${curveId} (256x1 RGBA)`)
    console.log(`📊 Cache size: ${curveTextureCache.current.size} textures`)
    return texture
  }

  // Get curve texture with full 256-value array for shader index lookup
  const getCurveTexture = async (curveId: string, scene: any, BABYLON: any): Promise<any> => {
    // Check cache first
    if (curveTextureCache.current.has(curveId)) {
      console.log(`⚡ Cache hit for curve: ${curveId}`)
      return curveTextureCache.current.get(curveId)
    }
    
    // Get the full curve data array (256 values, 0-1 normalized)
    console.log(`📊 Loading curve data array for: ${curveId}`)
    const curveDataArray = await getCurveDataArray(curveId)
    
    // Create texture from the curve data array
    return createCurveTexture(curveDataArray, curveId, scene, BABYLON)
  }

  // Apply dynamically generated shader from DP
  const applyDynamicShader = async () => {
    if (!babylonScene || !shaderBuilder.selectedDP) {
      setTestMessage('❌ No Babylon scene or DP selected')
      return
    }

    const selectedDP = availableDistortionProfiles.find(dp => dp.id === shaderBuilder.selectedDP)
    if (!selectedDP) {
      setTestMessage('❌ Selected DP not found')
      return
    }

    try {
      console.log(`🎨 Applying dynamic shader from DP: ${selectedDP.name}`)
      const { mesh, scene, BABYLON, engine } = babylonScene
      
      // Get the linked curve data for this DP (with caching)
      console.log('📡 Getting linked curve data for DP...')
      const linksResponse = await fetch(`${apiUrl}/api/distortion-control-links/control/${selectedDP.id}`)
      let curveTexture: any = null
      let curveId = 'default-linear'
      
      if (linksResponse.ok) {
        const linksData = await linksResponse.json()
        if (linksData.success && linksData.data && linksData.data.length > 0) {
          const link = linksData.data[0] // Get first link
          if (link.curveId) {
            console.log(`📊 Found linked curve: ${link.curveId}`)
            curveId = link.curveId
            curveTexture = await getCurveTexture(curveId, scene, BABYLON)
            console.log('✅ Curve texture ready for shader (cached)')
          }
        } else {
          console.log('⚠️ No links found for this DP')
        }
      } else {
        console.error('❌ Failed to load DP links:', linksResponse.statusText)
      }
      
      // If no curve found, use cached default linear curve
      if (!curveTexture) {
        console.log('⚠️ No curve data found, using cached default linear curve')
        curveTexture = await getCurveTexture('default-linear', scene, BABYLON)
      }
      
      // Generate WGSL shader directly from DP
      const wgslShader = generatePipelineFShader(selectedDP)
      console.log(`🚀 Generated WGSL fragment shader with Pipeline F math`)
      
      // Apply WGSL Fragment Shader directly to mesh
      console.log('🎨 Applying Pipeline F WGSL shader to mesh...')
      
      // Use ProceduralTexture for simplicity (avoids ShaderMaterial complexity)
      const proceduralTexture = new BABYLON.ProceduralTexture(
        `pipelineF_${selectedDP.id}`, 
        1024, 
        wgslShader, 
        scene
      )
      
      // Set curve texture on procedural texture
      if (curveTexture) {
        proceduralTexture.setTexture("curveTexture", curveTexture)
        console.log('🎨 Curve texture bound to procedural texture')
      }
      
      // Create material and apply
      const material = new BABYLON.StandardMaterial(`pipelineF_${selectedDP.id}`, scene)
      material.diffuseTexture = proceduralTexture
      material.disableLighting = true
      
      if (mesh) {
        mesh.material = material
        console.log('✅ Pipeline F WGSL shader applied to mesh')
        setTestMessage(`Applied ${selectedDP.name} Pipeline F shader to ${currentGeometry}`)
      }
      
    } catch (error) {
      console.error('❌ Failed to apply dynamic shader:', error)
      setTestMessage(`Failed to apply shader: ${error.message}`)
    }
  }

  useEffect(() => {
    console.log('🧪 Testing page initialized')
    loadShaders()
    loadDistortionProfiles()
    
    // Initialize Babylon.js scene
    setTimeout(() => {
      initBabylonScene()
    }, 100) // Small delay to ensure container is mounted
    
    // Cleanup Babylon.js on unmount
    return () => {
      if (babylonScene?.engine) {
        babylonScene.engine.dispose()
      }
    }
  }, [])

  // Initialize Babylon.js scene for GPU-accelerated testing
  const initBabylonScene = async () => {
    const container = babylonContainerRef.current
    if (!container) return

    try {
      console.log('🎮 Initializing Babylon.js scene with WebGPU...')
      
      // Cleanup any existing content
      container.innerHTML = ''
      
      const BABYLON = await import('@babylonjs/core')
      
      // Get container dimensions with fallbacks for WebGPU validation
      const containerRect = container.getBoundingClientRect()
      const width = Math.max(containerRect.width || 800, 400) // Minimum 400px width
      const height = Math.max(containerRect.height || 600, 400) // Minimum 400px height
      
      console.log(`📐 Container dimensions: ${width}x${height} (original: ${containerRect.width}x${containerRect.height})`)
      
      // Create canvas with valid dimensions for WebGPU
      const canvas = document.createElement('canvas')
      canvas.className = 'babylon-canvas'
      canvas.width = width
      canvas.height = height
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.style.display = 'block'
      canvas.style.margin = '0'
      canvas.style.padding = '0'
      container.appendChild(canvas)
      
      console.log('🚀 Creating WebGPU engine...')
      
      // Try WebGPU first, fallback to WebGL
      let engine: any
      try {
        engine = new BABYLON.WebGPUEngine(canvas)
        await engine.initAsync()
        console.log('✅ WebGPU engine initialized')
        setTestMessage('Babylon.js WebGPU engine ready')
      } catch (webgpuError) {
        console.log('⚠️ WebGPU failed, falling back to WebGL...')
        engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
        console.log('✅ WebGL engine initialized')
        setTestMessage('Babylon.js WebGL engine ready (WebGPU unavailable)')
      }
      
      // Set proper engine size
      engine.setSize(width, height)
      
      // Create scene
      const scene = new BABYLON.Scene(engine)
      scene.clearColor = new BABYLON.Color3(0.1, 0.1, 0.1)
      
      // Create isometric camera
      const camera = new BABYLON.ArcRotateCamera(
        'camera', 
        -Math.PI / 4, 
        Math.PI / 3, 
        10, 
        BABYLON.Vector3.Zero(), 
        scene
      )
      
      // Attach camera controls (debug available methods)
      console.log('🔍 Camera methods available:', Object.getOwnPropertyNames(camera).filter(name => name.includes('attach')))
      
      try {
        // Try different attachment methods
        if (typeof camera.attachToCanvas === 'function') {
          camera.attachToCanvas(canvas, true)
          console.log('✅ Camera attached via attachToCanvas')
        } else if (typeof camera.attachControls === 'function') {
          camera.attachControls(canvas)
          console.log('✅ Camera attached via attachControls')
        } else {
          // Manual setup
          camera.setTarget(BABYLON.Vector3.Zero())
          scene.activeCamera = camera
          console.log('✅ Camera set manually as active camera')
        }
      } catch (cameraError) {
        console.error('⚠️ Camera attachment failed:', cameraError)
        camera.setTarget(BABYLON.Vector3.Zero())
        scene.activeCamera = camera
      }
      
      // Add lighting
      const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene)
      light.intensity = 0.7
      
      // Create default geometry
      const mesh = createGeometry(currentGeometry, vertexCount, BABYLON, scene)
      
      // Animation loop
      engine.runRenderLoop(() => {
        // Slow rotation for better viewing
        if (mesh) {
          mesh.rotation.x += 0.005
          mesh.rotation.y += 0.01
        }
        scene.render()
      })
      
      // Handle resize properly
      const handleResize = () => {
        if (container && engine) {
          const newRect = container.getBoundingClientRect()
          canvas.width = newRect.width
          canvas.height = newRect.height
          canvas.style.width = `${newRect.width}px`
          canvas.style.height = `${newRect.height}px`
          engine.setSize(newRect.width, newRect.height)
          engine.resize()
          console.log(`📐 Resized to: ${newRect.width}x${newRect.height}`)
        }
      }
      
      window.addEventListener('resize', handleResize)
      
      // Store scene data
      setBabylonScene({ 
        engine, 
        scene, 
        camera, 
        mesh, 
        BABYLON,
        light
      })
      
      console.log('✅ Babylon.js scene initialized')
      console.log(`📐 Current geometry: ${currentGeometry} with ${vertexCount} subdivisions`)
      
    } catch (error) {
      console.error('❌ Failed to initialize Babylon.js scene:', error)
      setTestMessage(`Failed to initialize Babylon.js: ${error.message}`)
    }
  }

  // Create geometry based on type and vertex count
  const createGeometry = (type: GeometryType, subdivisions: number, BABYLON: any, scene: any) => {
    console.log(`🔺 Creating ${type} with ${subdivisions} subdivisions`)
    
    let mesh: any
    
    switch (type) {
      case 'sphere':
        mesh = BABYLON.MeshBuilder.CreateSphere('sphere', {
          diameter: 3,
          segments: subdivisions
        }, scene)
        break
        
      case 'cube':
        mesh = BABYLON.MeshBuilder.CreateBox('cube', {
          size: 3,
          subdivisions: subdivisions
        }, scene)
        break
        
      case 'landscape-box':
        mesh = BABYLON.MeshBuilder.CreateBox('landscapeBox', {
          width: 10,
          height: 3, 
          depth: 10,
          subdivisionsX: subdivisions,
          subdivisionsY: Math.floor(subdivisions / 3),
          subdivisionsZ: subdivisions
        }, scene)
        break
    }
    
    // Default material
    const material = new BABYLON.StandardMaterial('defaultMaterial', scene)
    material.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4)
    mesh.material = material
    
    console.log(`✅ Created ${type} with ~${mesh.getTotalVertices()} vertices`)
    return mesh
  }

  // Switch geometry type
  const switchGeometry = (newType: GeometryType) => {
    if (!babylonScene) return
    
    console.log(`🔄 Switching geometry from ${currentGeometry} to ${newType}`)
    
    // Remove old mesh
    if (babylonScene.mesh) {
      babylonScene.mesh.dispose()
    }
    
    // Create new mesh
    const newMesh = createGeometry(newType, vertexCount, babylonScene.BABYLON, babylonScene.scene)
    
    // Update scene
    setBabylonScene({ ...babylonScene, mesh: newMesh })
    setCurrentGeometry(newType)
    setTestMessage(`Switched to ${newType} (${newMesh.getTotalVertices()} vertices)`)
  }

  // Update vertex count
  const updateVertexCount = (newCount: number) => {
    if (!babylonScene) return
    
    console.log(`🔢 Updating vertex count from ${vertexCount} to ${newCount}`)
    
    // Remove old mesh
    if (babylonScene.mesh) {
      babylonScene.mesh.dispose()
    }
    
    // Create new mesh with updated vertex count
    const newMesh = createGeometry(currentGeometry, newCount, babylonScene.BABYLON, babylonScene.scene)
    
    // Update scene
    setBabylonScene({ ...babylonScene, mesh: newMesh })
    setVertexCount(newCount)
    setTestMessage(`Updated ${currentGeometry} to ${newMesh.getTotalVertices()} vertices`)
  }

  // Apply procedural texture with nested Pipeline F functions
  const applyPipelineFTexture = async () => {
    if (!babylonScene) {
      console.log('⚠️ No Babylon.js scene available')
      return
    }

    try {
      console.log('🎨 Creating nested Pipeline F procedural texture...')
      const { mesh, scene, BABYLON } = babylonScene
      
      // Create nested Pipeline F fragment shader
      const pipelineFShader = `
precision highp float;
varying vec2 vUV;

// Pipeline F Step 1: Distance Modulus (Virtual Centers)
vec2 applyDistanceModulus(vec2 coord, float modulus) {
    if (modulus > 0.0) {
        return mod(coord + modulus * 0.5, modulus) - modulus * 0.5;
    }
    return coord;
}

// Pipeline F Step 2: Angular Distortion
vec2 applyAngularDistortion(vec2 coord, float frequency, float amplitude, float offset) {
    float angle = atan(coord.y, coord.x);
    float radius = length(coord);
    angle += sin(angle * frequency + offset * 0.017453) * amplitude * 0.01;
    return vec2(cos(angle) * radius, sin(angle) * radius);
}

// Pipeline F Step 3: Fractal Distortion (3-scale)
vec2 applyFractalDistortion(vec2 coord, float scale1, float scale2, float scale3, float strength) {
    vec2 result = coord;
    result.x += sin(coord.y * scale1) * strength * 0.3;
    result.y += cos(coord.x * scale2) * strength * 0.3;
    result.x += sin(coord.y * scale3) * strength * 0.1;
    return result;
}

// Pipeline F Step 4: Distance Calculations
float calculateRadialDistance(vec2 coord) { return length(coord); }
float calculateCartesianX(vec2 coord) { return abs(coord.x); }
float calculateCartesianY(vec2 coord) { return abs(coord.y); }
float calculateManhattan(vec2 coord) { return abs(coord.x) + abs(coord.y); }
float calculateChebyshev(vec2 coord) { return max(abs(coord.x), abs(coord.y)); }

// Pipeline F Step 5: Checkerboard Pattern
float applyCheckerboard(float pattern, float distance, float steps) {
    if (steps > 0.0) {
        float checker = floor(distance / steps);
        if (mod(checker, 2.0) > 0.5) {
            return 1.0 - pattern;
        }
    }
    return pattern;
}

// Main nested processing function
vec3 processNestedPipelineF(vec2 uv) {
    // Convert UV to world coordinates
    vec2 coord = (uv - 0.5) * 20.0;
    
    // Nested Pipeline F processing (modular functions)
    coord = applyDistanceModulus(coord, 50.0);           // Virtual centers
    coord = applyAngularDistortion(coord, 8.0, 30.0, 45.0); // Angular warping
    coord = applyFractalDistortion(coord, 0.01, 0.05, 0.1, 10.0); // 3-scale fractal
    
    // Calculate distance and generate pattern
    float distance = calculateRadialDistance(coord);
    distance *= 0.5; // Curve scaling
    float pattern = sin(distance * 2.0) * 0.5 + 0.5;
    
    // Apply checkerboard effect
    pattern = applyCheckerboard(pattern, distance, 20.0);
    
    // Generate color variation
    return vec3(pattern, pattern * 0.8, pattern * 0.6);
}

void main() {
    vec3 color = processNestedPipelineF(vUV);
    gl_FragColor = vec4(color, 1.0);
}`;

      // Create procedural texture with nested Pipeline F
      const proceduralTexture = new BABYLON.ProceduralTexture(
        "nestedPipelineF", 
        1024, 
        pipelineFShader, 
        scene
      )
      
      // Create material and apply texture
      const material = new BABYLON.StandardMaterial("pipelineFMaterial", scene)
      material.diffuseTexture = proceduralTexture
      material.disableLighting = true // Show texture clearly
      
      // Apply to current mesh
      if (mesh) {
        mesh.material = material
        console.log('✅ Nested Pipeline F texture applied')
        setTestMessage(`Applied nested Pipeline F texture to ${currentGeometry}`)
      }
      
    } catch (error) {
      console.error('❌ Failed to apply Pipeline F texture:', error)
      setTestMessage(`Failed to apply texture: ${error.message}`)
    }
  }

  // Apply selected shader to the mesh (placeholder for future Babylon.js shader implementation)
  const applyShaderToMesh = async (shader: Shader) => {
    if (!babylonScene) {
      console.log('⚠️ No Babylon.js scene available')
      return
    }

    try {
      console.log(`🎨 Applying shader to ${currentGeometry}: ${shader.name}`)
      // TODO: Convert Three.js shader to Babylon.js format
      setTestMessage(`Shader conversion coming soon: ${shader.name}`)
      
    } catch (error) {
      console.error('❌ Failed to apply shader:', error)
      setTestMessage(`Failed to apply shader: ${error.message}`)
    }
  }

  const exportShaderGLSL = (shader: Shader) => {
    console.log(`🎨 Exporting GLSL pairs for: ${shader.name}`)
    
    const targets = Object.keys(shader.glsl)
    if (targets.length === 0) {
      alert('No GLSL code found in this shader')
      return
    }
    
    // Export each GLSL target as a separate file
    targets.forEach(target => {
      const glslCode = shader.glsl[target]
      const fileName = `${shader.name}-${target}.glsl`
      
      const blob = new Blob([glslCode], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      console.log(`✅ Exported: ${fileName}`)
    })
    
    setTestMessage(`Exported ${targets.length} GLSL files for ${shader.name}`)
  }

  // Apply hardcoded test shader (guaranteed to work)
  const applyHardcodedTestShader = () => {
    if (!threejsScene) {
      setTestMessage('Three.js scene not initialized')
      return
    }

    try {
      console.log('🧪 Applying hardcoded test shader...')
      const { cube, THREE } = threejsScene
      
      // Simple, guaranteed-to-work Three.js shader
      const testShader = `
varying vec2 vUv;
uniform float time;

void main() {
    vec2 coord = vUv * 8.0;
    float dist = length(coord - 4.0);
    float pattern = sin(dist * 2.0 + time) * 0.5 + 0.5;
    
    vec3 color = vec3(
        pattern,
        pattern * 0.8,
        sin(time * 0.5) * 0.5 + 0.5
    );
    
    gl_FragColor = vec4(color, 1.0);
}`
      
      const testMaterial = new THREE.ShaderMaterial({
        fragmentShader: testShader,
        vertexShader: `
          varying vec2 vUv;
          uniform float time;
          
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        uniforms: {
          time: { value: 0.0 }
        }
      })
      
      // Update time in animation loop
      const originalAnimate = threejsScene.animate
      if (originalAnimate) {
        const animateWithTime = () => {
          testMaterial.uniforms.time.value = Date.now() * 0.001
          originalAnimate()
        }
        animateWithTime()
      }
      
      cube.material = testMaterial
      console.log('✅ Hardcoded test shader applied')
      setTestMessage('Test shader applied - animated procedural texture')
      
    } catch (error) {
      console.error('❌ Failed to apply test shader:', error)
      setTestMessage(`Test shader failed: ${error.message}`)
    }
  }

  const runShaderTest = () => {
    console.log('🎨 Running shader test...')
    if (selectedShader) {
      applyShaderToMesh(selectedShader)
    } else {
      setTestMessage('Please select a shader first')
    }
  }

  return (
    <div className="testing-page">
      <div className="testing-content">
        <div className="testing-sidebar">
          <h2>Dynamic Shader Builder</h2>
          <p style={{ fontSize: '14px', color: '#888', marginBottom: '20px' }}>
            🎨 Generate Merzbow-style textures using Pipeline F mathematics with real curve data
          </p>
          
          {/* Shader Builder Configuration */}
          <div className="shader-builder">
            <div className="form-group">
              <label>Distortion Profile:</label>
              <select 
                value={shaderBuilder.selectedDP} 
                onChange={(e) => setShaderBuilder({...shaderBuilder, selectedDP: e.target.value})}
                className="shader-dropdown"
              >
                <option value="">Select DP...</option>
                {availableDistortionProfiles.map((dp) => (
                  <option key={dp.id} value={dp.id}>
                    {dp.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Pipeline F Mode:</label>
              <select 
                value={shaderBuilder.shaderType} 
                onChange={(e) => setShaderBuilder({...shaderBuilder, shaderType: e.target.value})}
                className="shader-dropdown"
              >
                <option value="fragment">Fragment Shader (WGSL)</option>
              </select>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                Direct DP → WGSL → Babylon.js Pipeline
              </div>
            </div>

            <div className="form-group">
              <label>Object Data 1:</label>
              <select 
                value={shaderBuilder.objectData1} 
                onChange={(e) => setShaderBuilder({...shaderBuilder, objectData1: e.target.value})}
                className="shader-dropdown"
              >
                {SHADER_CAPABILITIES[shaderBuilder.shaderType as keyof typeof SHADER_CAPABILITIES]?.objectData.map(data => (
                  <option key={data} value={data}>
                    {data.charAt(0).toUpperCase() + data.slice(1).replace(/([A-Z])/g, ' $1')}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Object Data 2:</label>
              <select 
                value={shaderBuilder.objectData2} 
                onChange={(e) => setShaderBuilder({...shaderBuilder, objectData2: e.target.value})}
                className="shader-dropdown"
              >
                {SHADER_CAPABILITIES[shaderBuilder.shaderType as keyof typeof SHADER_CAPABILITIES]?.objectData.map(data => (
                  <option key={data} value={data}>
                    {data.charAt(0).toUpperCase() + data.slice(1).replace(/([A-Z])/g, ' $1')}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Curve Transform:</label>
              <select 
                value={shaderBuilder.outputFormat} 
                onChange={(e) => setShaderBuilder({...shaderBuilder, outputFormat: e.target.value})}
                className="shader-dropdown"
              >
                {SHADER_CAPABILITIES[shaderBuilder.shaderType as keyof typeof SHADER_CAPABILITIES]?.transformFormats.map(format => (
                  <option key={format} value={format}>
                    {format.charAt(0).toUpperCase() + format.slice(1).replace(/([A-Z])/g, ' $1')}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Target Elements ({SHADER_CAPABILITIES[shaderBuilder.shaderType as keyof typeof SHADER_CAPABILITIES]?.canAffect.join(', ')}):</label>
              <div className="checkbox-group">
                {SHADER_CAPABILITIES[shaderBuilder.shaderType as keyof typeof SHADER_CAPABILITIES]?.targetElements.map(target => (
                  <label key={target} className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={shaderBuilder.targetElements.includes(target)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setShaderBuilder({
                            ...shaderBuilder, 
                            targetElements: [...shaderBuilder.targetElements, target]
                          })
                        } else {
                          setShaderBuilder({
                            ...shaderBuilder, 
                            targetElements: shaderBuilder.targetElements.filter(t => t !== target)
                          })
                        }
                      }}
                    />
                    {target.charAt(0).toUpperCase() + target.slice(1)}
                    <span className="transform-hint">
                      {target === 'emissive' ? ' (0-3x)' : 
                       target === 'opacity' ? ' (0-1)' : 
                       target === 'roughness' ? ' (0-1)' : 
                       target === 'metallic' ? ' (0-1)' : 
                       target === 'worldPosition' ? ' (±1)' : 
                       target === 'displacement' ? ' (0-0.5)' : ' (0-1)'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {SHADER_CAPABILITIES[shaderBuilder.shaderType as keyof typeof SHADER_CAPABILITIES]?.internalElements.length > 0 && (
              <div className="form-group">
                <label>Internal Elements:</label>
                <div className="internal-elements">
                  {SHADER_CAPABILITIES[shaderBuilder.shaderType as keyof typeof SHADER_CAPABILITIES]?.internalElements.map(element => (
                    <span key={element} className="internal-element-tag">
                      {element.charAt(0).toUpperCase() + element.slice(1)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={applyDynamicShader}
              className="test-btn"
              style={{ backgroundColor: '#ff6b35', marginBottom: '20px' }}
              disabled={!shaderBuilder.selectedDP}
            >
              🚀 Generate Merzbow-Style Texture
            </button>
          </div>

          <hr style={{ margin: '20px 0', borderColor: '#333' }} />
          
          <div className="test-section">
            <h3>Existing Shaders</h3>
            <select 
              value={selectedShader?.id || ''} 
              onChange={(e) => {
                const shader = availableShaders.find(s => s.id === e.target.value)
                setSelectedShader(shader || null)
                if (shader) {
                  setTestMessage(`Selected: ${shader.name} (${shader.targets.length} targets: ${shader.targets.join(', ')})`)
                  // Apply shader to Babylon.js mesh (coming soon)
                  applyShaderToMesh(shader)
                }
              }}
              disabled={isLoadingShaders}
              className="shader-dropdown"
            >
              <option value="">{isLoadingShaders ? 'Loading shaders...' : 'Select shader...'}</option>
              {availableShaders.map(shader => (
                <option key={shader.id} value={shader.id}>
                  {shader.name} ({shader.category})
                </option>
              ))}
            </select>
            
            {selectedShader && (
              <div className="shader-info">
                <div className="shader-details">
                  <strong>{selectedShader.name}</strong>
                  <div>Category: {selectedShader.category}</div>
                  <div>Targets: {selectedShader.targets.join(', ')}</div>
                  <div>Created: {new Date(selectedShader.createdAt).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => applyShaderToCube(selectedShader)} 
                    className="test-btn"
                  >
                    Apply to Cube
                  </button>
                  <button 
                    onClick={() => exportShaderGLSL(selectedShader)} 
                    className="test-btn secondary"
                  >
                    Export GLSL
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="test-section">
            <h3>Geometry Controls</h3>
            
            <div className="form-group">
              <label>Geometry Type:</label>
              <div className="button-row">
                <button 
                  onClick={() => switchGeometry('sphere')}
                  className={`test-btn ${currentGeometry === 'sphere' ? 'active' : 'secondary'}`}
                >
                  Sphere
                </button>
                <button 
                  onClick={() => switchGeometry('cube')}
                  className={`test-btn ${currentGeometry === 'cube' ? 'active' : 'secondary'}`}
                >
                  Cube
                </button>
                <button 
                  onClick={() => switchGeometry('landscape-box')}
                  className={`test-btn ${currentGeometry === 'landscape-box' ? 'active' : 'secondary'}`}
                >
                  Landscape
                </button>
              </div>
            </div>
            
            <div className="form-group">
              <label>Vertex Count: {vertexCount}</label>
              <input 
                type="range" 
                min="4" 
                max="128" 
                step="4"
                value={vertexCount}
                onChange={(e) => updateVertexCount(parseInt(e.target.value))}
                className="vertex-slider"
              />
              <div className="vertex-info">
                {babylonScene?.mesh ? `${babylonScene.mesh.getTotalVertices()} vertices` : 'No mesh'}
              </div>
            </div>
          </div>

          <div className="test-section">
            <h3>Scene Controls</h3>
            <button 
              onClick={() => {
                initBabylonScene()
                setTestMessage('Babylon.js scene reinitialized')
              }} 
              className="test-btn"
            >
              Reinit Scene
            </button>
          </div>

          <div className="test-section">
            <h3>Shader Tests</h3>
            <button 
              onClick={() => applyPipelineFTexture()}
              className="test-btn"
              style={{ backgroundColor: '#00ff88', color: '#000' }}
            >
              Apply Pipeline F
            </button>
            <button onClick={runShaderTest} className="test-btn">
              Apply Selected Shader
            </button>
            <button 
              onClick={() => {
                if (babylonScene?.mesh) {
                  const { mesh, BABYLON, scene } = babylonScene
                  const defaultMaterial = new BABYLON.StandardMaterial('default', scene)
                  defaultMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4)
                  mesh.material = defaultMaterial
                  setTestMessage('Reset to default material')
                }
              }}
              className="test-btn secondary"
            >
              Reset Material
            </button>
          </div>
          
          <div className="test-section">
            <h3>Status</h3>
            <div className="status-message">
              {testMessage}
            </div>
          </div>
          
        </div>
        
        <div className="testing-viewport">
          {/* Babylon.js viewport - WebGPU accelerated */}
          <div 
            ref={babylonContainerRef}
            className="babylon-viewport"
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </div>
  )
}

export default Testing
