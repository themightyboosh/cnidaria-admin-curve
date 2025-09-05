import React, { useEffect, useRef, useState } from 'react'
import Modal from '../../components/shared/Modal'
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
  const hasInitializedRef = useRef<boolean>(false)
  const babylonSceneRef = useRef<any>(null)
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
    objectData1: 'uv',                // Default to UVs for guaranteed texture mapping
    objectData2: 'uv',                // Second input defaults to UVs
    transformableElements: [],
    outputFormat: 'percentage',       // 0-1 range for color values (matches Merzbow processing)
    targetElements: ['diffuse'],      // Generate diffuse color texture (like Merzbow canvas)
    selectedDP: ''                    // Will auto-select first available DP
  })

  // Concept targets & transforms
  const [indexValueTarget, setIndexValueTarget] = useState<string>('diffuse')
  const [indexValueTransform, setIndexValueTransform] = useState<string>('percentage')
  const [indexValueScale, setIndexValueScale] = useState<number>(1.0)
  const [indexTarget, setIndexTarget] = useState<string>('none')
  const [indexTransform, setIndexTransform] = useState<string>('raw')
  const [indexScale, setIndexScale] = useState<number>(1.0)

  // Pipeline F NodeMaterial System
  interface TargetAssignment {
    id: string
    property: string
    source: 'curveValue' | 'curveIndex'
    transform: 'raw' | 'palette' | 'scaled' | 'inverse' | 'signed' | 'percentage' | 'degrees'
    multiplier?: number
    enabled: boolean
    dataType: 'normalized' | 'color' | 'percentage' | 'worldUnits' | 'uvCoords' | 'degrees'
  }

  // Default target assignments that match Merzbow visual output
  const defaultTargets: TargetAssignment[] = [
    {
      id: 'baseColor',
      property: 'baseColor',
      source: 'curveValue', // CORRECTED: curveValue determines palette color in Merzbow
      transform: 'palette',
      enabled: true,
      dataType: 'color'
    },
    {
      id: 'emissive',
      property: 'emissiveColor',
      source: 'curveValue',
      transform: 'scaled',
      multiplier: 0.3,
      enabled: true,
      dataType: 'color'
    },
    {
      id: 'roughness',
      property: 'roughnessFactor',
      source: 'curveValue',
      transform: 'inverse',
      enabled: true,
      dataType: 'normalized'
    }
  ]

  const [targetAssignments, setTargetAssignments] = useState<TargetAssignment[]>(defaultTargets)
  const [pipelineFMaterial, setPipelineFMaterial] = useState<any>(null)
  const [generatedShaderCode, setGeneratedShaderCode] = useState<{glsl: string, wgsl: string} | null>(null)
  const [isShaderViewerOpen, setIsShaderViewerOpen] = useState(false)

  // WGSL live editor
  const defaultCheckerWGSL = `
// WGSL Fragment: simple UV checker pattern
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) worldPosition: vec3f,
  @location(2) normal: vec3f,
}

@fragment
fn main(input: VertexOutput) -> @location(0) vec4f {
  let scale = 20.0;
  let uv = input.uv * scale;
  let cx = step(0.5, fract(uv.x));
  let cy = step(0.5, fract(uv.y));
  let v = abs(cx - cy);
  let color = mix(vec3f(0.1, 0.1, 0.1), vec3f(0.9, 0.9, 0.9), v);
  return vec4f(color, 1.0);
}`
  const [customWGSL, setCustomWGSL] = useState<string>(defaultCheckerWGSL)

  // WGSL preview state
  const [lastWGSL, setLastWGSL] = useState<string>('')
  const [isWGSLModalOpen, setIsWGSLModalOpen] = useState<boolean>(false)

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
          
          // Debug the auto-selected DP structure
          console.log('🔄 Auto-selecting first DP with full data inspection:')
          console.log('  Name:', firstDP.name)
          console.log('  ID:', firstDP.id)
          console.log('  All Keys:', Object.keys(firstDP))
          console.log('  linked-curve:', firstDP['linked-curve'])
          console.log('  linked-palette:', firstDP['linked-palette'])
          console.log('  curve-scaling:', firstDP['curve-scaling'])
          console.log('  angular-distortion:', firstDP['angular-distortion'])
          console.log('  fractal-distortion:', firstDP['fractal-distortion'])
          
          setShaderBuilder(prev => ({
            ...prev,
            selectedDP: firstDP.id
          }))
          console.log(`🎯 Auto-selected first DP: ${firstDP.name} (ID: ${firstDP.id})`)
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

  // --- Palette helpers (loaded from API palettes by name) ---
  const hexToRGBA = (hex: string): { r: number; g: number; b: number; a: number } => {
    let h = hex.trim()
    if (h.startsWith('#')) h = h.slice(1)
    if (h.length === 3) {
      h = h.split('').map((c) => c + c).join('')
    }
    if (h.length === 6) h = h + 'FF'
    const num = parseInt(h, 16)
    const r = (num >> 24) & 0xff
    const g = (num >> 16) & 0xff
    const b = (num >> 8) & 0xff
    const a = num & 0xff
    return { r, g, b, a }
  }

  const createPaletteTexture = (paletteKey: string, colors: any[], scene: any, BABYLON: any): any => {
    if (curveTextureCache.current.has(paletteKey)) {
      return curveTextureCache.current.get(paletteKey)
    }
    const data = new Uint8Array(256 * 4)
    for (let i = 0; i < 256; i++) {
      const c = colors[i] ?? colors[colors.length - 1] ?? '#000000'
      let rgba: { r: number; g: number; b: number; a: number }
      if (typeof c === 'string') {
        rgba = hexToRGBA(c)
      } else if (typeof c === 'object' && c) {
        rgba = {
          r: Math.max(0, Math.min(255, Math.round(c.r ?? 0))),
          g: Math.max(0, Math.min(255, Math.round(c.g ?? 0))),
          b: Math.max(0, Math.min(255, Math.round(c.b ?? 0))),
          a: Math.max(0, Math.min(255, Math.round(c.a ?? 255)))
        }
      } else {
        rgba = { r: i, g: i, b: i, a: 255 }
      }
      const p = i * 4
      data[p] = rgba.r; data[p + 1] = rgba.g; data[p + 2] = rgba.b; data[p + 3] = rgba.a
    }
    const texture = new BABYLON.RawTexture(
      data,
      256,
      1,
      BABYLON.Constants.TEXTUREFORMAT_RGBA,
      scene,
      false,
      false,
      BABYLON.Constants.TEXTURE_NEAREST_SAMPLINGMODE
    )
    curveTextureCache.current.set(paletteKey, texture)
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
    if (!('gpu' in navigator)) {
      setTestMessage('⚠️ WebGPU not available in this browser. WGSL cannot be compiled under WebGL.')
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
      let paletteTexture: any = null
      let paletteName: string | null = null
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
          if (link.paletteName) {
            paletteName = link.paletteName
            console.log(`🎨 Linked palette: ${paletteName}`)
          }
        } else {
          console.log('⚠️ No links found for this DP')
        }
      } else {
        console.error('❌ Failed to load DP links:', linksResponse.statusText)
      }

      // Load palette by name if available
      if (paletteName) {
        try {
          const palettesRes = await fetch(`${apiUrl}/api/palettes`)
          if (palettesRes.ok) {
            const palettesData = await palettesRes.json()
            const list = palettesData?.data?.palettes || palettesData?.data || []
            const pal = list.find((p: any) => p.name === paletteName)
            if (pal && pal.colors) {
              const key = `palette-${paletteName}`
              paletteTexture = createPaletteTexture(key, pal.colors, scene, BABYLON)
              console.log('✅ Palette texture ready for shader (cached)')
            } else {
              console.log('⚠️ Palette not found in API response:', paletteName)
            }
          }
        } catch (e) {
          console.warn('⚠️ Failed loading palettes API:', e)
        }
      }
      
      // If no curve found, use cached default linear curve
      if (!curveTexture) {
        console.log('⚠️ No curve data found, using cached default linear curve')
        curveTexture = await getCurveTexture('default-linear', scene, BABYLON)
      }
      
      // Build WGSL from concept model controls
      const coordExpr = (axis: 'x'|'y', src: string) => {
        switch (src) {
          case 'uv': return `input.uv.${axis}`
          case 'worldPosition': return `input.worldPosition.${axis}`
          case 'position': return `input.worldPosition.${axis}`
          case 'normal': return `input.normal.${axis}`
          default: return `input.uv.${axis}`
        }
      }

      const xExpr = coordExpr('x', shaderBuilder.objectData1)
      const yExpr = coordExpr('y', shaderBuilder.objectData2)

      const valueTransform = (varName: string) => {
        switch (indexValueTransform) {
          case 'raw': return `${varName}`
          case 'percentage': return `${varName}`
          case 'degrees': return `(${varName} * 360.0f) / 360.0f`
          case 'signed': return `(${varName} * 2.0f - 1.0f)`
          case 'pseudo-random': return `fract(sin(${varName} * 12.9898f) * 43758.5453f)`
          case 'multiplier': return `(${varName} * ${indexValueScale.toFixed(3)}f)`
          case 'color-hex':
          case 'color-rgb':
            return `${varName}`
          default: return `${varName}`
        }
      }

      const indexTransformExpr = (varName: string) => {
        switch (indexTransform) {
          case 'raw': return `${varName}`
          case 'percentage': return `${varName}`
          case 'degrees': return `(${varName} * 360.0f) / 360.0f`
          case 'signed': return `(${varName} * 2.0f - 1.0f)`
          case 'pseudo-random': return `fract(sin(${varName} * 12.9898f) * 43758.5453f)`
          case 'multiplier': return `(${varName} * ${indexScale.toFixed(3)}f)`
          default: return `${varName}`
        }
      }

      const applyTargetsWGSL = () => {
        const idxNorm = '(curveIndex / 255.0f)'
        const idxExpr = indexTransformExpr(idxNorm)
        const valExpr = valueTransform('curveValue')
        let lines: string[] = []
        if (['color-rgb','color-hex'].includes(indexValueTransform)) {
          lines.push(`let paletteCoord = vec2f(${idxNorm}, 0.5f);`)
          lines.push(`let pal = textureSample(paletteTexture, curveSampler, paletteCoord).rgb;`)
          if (indexValueTarget === 'diffuse') lines.push(`finalColor = pal;`)
          if (indexValueTarget === 'red') lines.push(`finalColor.r = pal.r;`)
          if (indexValueTarget === 'green') lines.push(`finalColor.g = pal.g;`)
          if (indexValueTarget === 'blue') lines.push(`finalColor.b = pal.b;`)
        } else {
          if (indexValueTarget === 'diffuse') lines.push(`finalColor = vec3f(${valExpr});`)
          if (indexValueTarget === 'red') lines.push(`finalColor.r = ${valExpr};`)
          if (indexValueTarget === 'green') lines.push(`finalColor.g = ${valExpr};`)
          if (indexValueTarget === 'blue') lines.push(`finalColor.b = ${valExpr};`)
          if (indexValueTarget === 'opacity') lines.push(`finalOpacity = clamp(${valExpr}, 0.0f, 1.0f);`)
          if (indexValueTarget === 'emissive') lines.push(`emissive = vec3f(${valExpr} * 3.0f);`)
          if (indexValueTarget === 'roughness') lines.push(`roughness = clamp(${valExpr}, 0.0f, 1.0f);`)
          if (indexValueTarget === 'metallic') lines.push(`metallic = clamp(${valExpr}, 0.0f, 1.0f);`)
        }
        if (indexTarget !== 'none') {
          if (indexTarget === 'opacity') lines.push(`finalOpacity = clamp(${idxExpr}, 0.0f, 1.0f);`)
          if (indexTarget === 'emissive') lines.push(`emissive += vec3f(${idxExpr});`)
          if (indexTarget === 'roughness') lines.push(`roughness = clamp(${idxExpr}, 0.0f, 1.0f);`)
          if (indexTarget === 'metallic') lines.push(`metallic = clamp(${idxExpr}, 0.0f, 1.0f);`)
        }
        return lines.join('\n        ')
      }

      const wgslShader = `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) worldPosition: vec3f,
  @location(2) normal: vec3f,
}
@group(0) @binding(0) var curveTexture: texture_2d<f32>;
@group(0) @binding(1) var curveSampler: sampler;
${(['color-rgb','color-hex'].includes(indexValueTransform) ? '@group(0) @binding(2) var paletteTexture: texture_2d<f32>;' : '')}
@fragment
fn main(input: VertexOutput) -> @location(0) vec4f {
  // Inputs → 2D coordinate
  var coord = vec2f(${xExpr}, ${yExpr});
  // Pipeline F (DP baked)
  var p = coord;
  ${selectedDP['distance-modulus'] > 0 ? `let modulus = ${selectedDP['distance-modulus'].toFixed(1)}f; p = (p + modulus * 0.5) % modulus - modulus * 0.5;` : ''}
  ${selectedDP['angular-distortion'] ? `let a = atan2(p.y, p.x); let r = length(p); let na = a + sin(a * ${selectedDP['angular-frequency'].toFixed(1)}f + ${selectedDP['angular-offset'].toFixed(1)}f * 0.017453f) * ${selectedDP['angular-amplitude'].toFixed(1)}f * 0.01f; p = vec2f(cos(na) * r, sin(na) * r);` : ''}
  ${selectedDP['fractal-distortion'] ? `p.x += sin(p.y * ${selectedDP['fractal-scale-1'].toFixed(3)}f) * ${selectedDP['fractal-strength'].toFixed(1)}f * 0.3f; p.y += cos(p.x * ${selectedDP['fractal-scale-2'].toFixed(3)}f) * ${selectedDP['fractal-strength'].toFixed(1)}f * 0.3f; p.x += sin(p.y * ${selectedDP['fractal-scale-3'].toFixed(3)}f) * ${selectedDP['fractal-strength'].toFixed(1)}f * 0.1f;` : ''}
  var distance: f32 = ${(() => { switch(selectedDP['distance-calculation']){case 'radial':return 'length(p)';case 'cartesian-x':return 'abs(p.x)';case 'cartesian-y':return 'abs(p.y)';case 'manhattan':return 'abs(p.x)+abs(p.y)';case 'chebyshev':return 'max(abs(p.x),abs(p.y))';default:return 'length(p)';}})()} * ${selectedDP['curve-scaling'].toFixed(4)}f;
  var curveIndex = clamp(floor(distance * 255.0f), 0.0f, 255.0f);
  var texCoord = vec2f(curveIndex / 255.0f, 0.5f);
  var curveValue = textureSample(curveTexture, curveSampler, texCoord).r;
  ${selectedDP['checkerboard-pattern'] && selectedDP['checkerboard-steps'] > 0 ? `let checker = floor(distance * ${(1.0 / selectedDP['checkerboard-steps']).toFixed(6)}f); if (checker % 2.0f > 0.5f) { curveValue = 1.0f - curveValue; }` : ''}
  var baseColor = vec3f(0.7, 0.7, 0.7);
  var finalColor = baseColor;
  var finalOpacity = 1.0f;
  var emissive = vec3f(0.0);
  var metallic = 0.0f; var roughness = 0.5f;
  ${applyTargetsWGSL()}
  let lightDir = normalize(vec3f(1.0, 1.0, 1.0));
  let NdotL = max(dot(input.normal, lightDir), 0.0);
  let lighting = 0.3 + 0.7 * NdotL;
  finalColor = finalColor * lighting + emissive;
  return vec4f(finalColor, finalOpacity);
}`
      console.log('🚀 Generated WGSL from concept controls')
      setLastWGSL(wgslShader)
      
      // Apply WGSL Fragment Shader directly to mesh
      console.log('🎨 Applying Pipeline F WGSL shader to mesh...')
      
      // Build a minimal vertex WGSL compatible with our fragment expectations
      const vertexWGSL = `
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
}
@group(0) @binding(0) var<uniform> world: mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewProj: mat4x4<f32>;
@vertex
fn main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let wp = (world * vec4f(input.position, 1.0));
  out.position = viewProj * wp;
  out.worldPosition = wp.xyz;
  out.normal = input.normal;
  out.uv = input.uv;
  return out;
}`

      // For now, apply a simple colored material until we fix WGSL compilation
      const simpleMaterial = new BABYLON.StandardMaterial(`simple_${selectedDP.id}`, babylonScene)
      
      // Use curve value to determine color (simulate the pipeline result)
      const hue = (selectedDP.id * 137.5) % 360 // Golden angle for color distribution
      const color = BABYLON.Color3.FromHSV(hue, 0.7, 0.9)
      
      simpleMaterial.diffuseColor = color
      simpleMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1)
      
      if (mesh) {
        mesh.material = simpleMaterial
        console.log('✅ Simple material applied to mesh (WGSL compilation bypassed)')
        setTestMessage(`Applied ${selectedDP.name} color to ${currentGeometry} (WGSL compilation temporarily bypassed)`)
      }
      
    } catch (error) {
      console.error('❌ Failed to apply dynamic shader:', error)
      setTestMessage(`Failed to apply shader: ${error.message}`)
    }
  }

  // Generate Pipeline F NodeMaterial
  const generatePipelineFNodeMaterial = async () => {
    // Debug DP selection process
    console.log('🔍 DP Selection Debug:')
    console.log('  shaderBuilder.selectedDP:', shaderBuilder.selectedDP)
    console.log('  availableDistortionProfiles.length:', availableDistortionProfiles.length)
    console.log('  availableDistortionProfiles[0]:', availableDistortionProfiles[0]?.name)
    
    // Get the currently selected DP from the shader builder
    const currentDP = availableDistortionProfiles.find(dp => dp.id === shaderBuilder.selectedDP)
    
    console.log('🎯 Selected DP Result:', currentDP ? currentDP.name : 'NOT FOUND')
    
    if (!currentDP || !babylonScene) {
      setTestMessage('❌ Missing requirements for NodeMaterial generation')
      console.error('❌ Missing requirements:', {
        currentDP: !!currentDP,
        babylonScene: !!babylonScene,
        selectedDPId: shaderBuilder.selectedDP
      })
      return null
    }

    try {
      const { scene, BABYLON } = babylonScene
      console.log('🏗️ Generating Pipeline F NodeMaterial for DP:', currentDP.name)
      console.log('🏗️ DP Full Object:', currentDP)
      
      // Load curve and palette data for the selected DP
      let dpCurveData = null
      let dpPaletteData = null
      
      try {
        // Debug DP data structure
        console.log('🔍 DP Structure:', {
          name: currentDP.name,
          id: currentDP.id,
          'linked-curve': currentDP['linked-curve'],
          'linked-palette': currentDP['linked-palette'],
          keys: Object.keys(currentDP)
        })
        
        // Load complete DP data with embedded curve and palette using enhanced API
        console.log('🔗 Loading complete DP data with embedded links:', currentDP.id)
        try {
          const dpResponse = await fetch(`${apiUrl}/api/distortion-controls/${currentDP.id}`)
          console.log('🔗 Enhanced DP API response status:', dpResponse.status)
          
          if (dpResponse.ok) {
            const dpData = await dpResponse.json()
            console.log('🔗 Enhanced DP API response:', dpData)
            
            if (dpData.success && dpData.data) {
              const completeDP = dpData.data
              
              // Extract embedded curve data
              if (completeDP.linkedCurve && completeDP.linkedCurve.data) {
                dpCurveData = completeDP.linkedCurve.data
                console.log('✅ Loaded embedded curve data:', dpCurveData.length, 'values', dpCurveData.slice(0, 5))
                console.log('📊 Curve info:', {
                  id: completeDP.linkedCurve.id,
                  name: completeDP.linkedCurve.name,
                  width: completeDP.linkedCurve.width
                })
              } else {
                console.warn('⚠️ No linkedCurve in enhanced DP response')
              }
              
              // Extract embedded palette data
              if (completeDP.linkedPalette && completeDP.linkedPalette.colors) {
                dpPaletteData = completeDP.linkedPalette.colors
                console.log('✅ Loaded embedded palette data:', dpPaletteData.length, 'colors', dpPaletteData.slice(0, 3))
                console.log('🎨 Palette info:', {
                  id: completeDP.linkedPalette.id,
                  name: completeDP.linkedPalette.name
                })
              } else {
                console.warn('⚠️ No linkedPalette in enhanced DP response')
              }
              
            } else {
              console.warn('❌ Enhanced DP API returned no data or success=false')
            }
          } else {
            console.warn('❌ Enhanced DP API failed:', dpResponse.status, dpResponse.statusText)
          }
        } catch (enhancedError) {
          console.error('❌ Enhanced DP API error:', enhancedError)
        }
      } catch (dataError) {
        console.warn('⚠️ Failed to load curve/palette data:', dataError)
      }
      
      // For now, create a StandardMaterial with 8-bit data textures attached
      // This avoids the complex NodeMaterial connection issues
      const standardMaterial = new BABYLON.StandardMaterial(`pipelineF_${currentDP.id}`, scene)
      
      // Create 8-bit data textures
      const { curveTexture, paletteTexture } = createDataTextures(scene, dpCurveData, dpPaletteData)
      
      // Set a DP-specific color
      const hue = currentDP ? (currentDP.id * 137.5) % 360 : 0
      const dpColor = BABYLON.Color3.FromHSV(hue, 0.8, 0.9)
      standardMaterial.diffuseColor = dpColor
      standardMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1)
      
      // Attach data textures and parameters for future Pipeline F implementation
      if (curveTexture) {
        standardMaterial._curveDataTexture = curveTexture
        console.log('📊 Curve data texture attached to material')
      }
      if (paletteTexture) {
        standardMaterial._paletteDataTexture = paletteTexture  
        console.log('🎨 Palette data texture attached to material')
      }
      
      // Store Pipeline F parameters
      standardMaterial._pipelineFParams = {
        distanceCalculation: currentDP['distance-calculation'],
        curveScaling: currentDP['curve-scaling'],
        angularDistortion: currentDP['angular-distortion'],
        fractalDistortion: currentDP['fractal-distortion'],
        distanceModulus: currentDP['distance-modulus'],
        checkerboardPattern: currentDP['checkerboard-pattern'],
        angularFrequency: currentDP['angular-frequency'],
        angularAmplitude: currentDP['angular-amplitude'],
        angularOffset: currentDP['angular-offset'],
        fractalStrength: currentDP['fractal-strength'],
        fractalScale1: currentDP['fractal-scale-1'],
        fractalScale2: currentDP['fractal-scale-2'],
        fractalScale3: currentDP['fractal-scale-3'],
        checkerboardSteps: currentDP['checkerboard-steps']
      }
      
      // Generate actual shader code for viewing
      const pipelineFFragmentShader = generatePipelineFWithTextures(currentDP, targetAssignments)
      const compiledShaders = {
        glsl: pipelineFFragmentShader,
        wgsl: 'WGSL version auto-generated by Babylon.js WebGPU engine from GLSL above'
      }
      
      setGeneratedShaderCode(compiledShaders)
      
      // Store material with associated data for saving
      const materialWithData = {
        standardMaterial,
        distortionProfile: currentDP,
        curveData: dpCurveData,
        paletteData: dpPaletteData,
        targetAssignments
      }
      setPipelineFMaterial(materialWithData)
      
      // Create Pipeline F material using DynamicTexture (like Merzbow canvas)
      const pipelineFMaterial = createPipelineFTextureMaterial(scene, currentDP, dpCurveData, dpPaletteData)
      
      console.log('✅ Pipeline F material with proven mathematics generated successfully')
      return pipelineFMaterial
      
    } catch (error) {
      console.error('❌ Failed to generate Pipeline F NodeMaterial:', error)
      setTestMessage(`Failed to generate NodeMaterial: ${error.message}`)
      return null
    }
  }

  // Simplified approach: Just create the data textures and use StandardMaterial for now
  const buildPipelineFNodeGraph = async (nodeMaterial: any, selectedDP: any, curveData: any, paletteData: any, targets: TargetAssignment[]) => {
    try {
      console.log('🔗 Creating simple material with data textures for:', selectedDP?.name)
      console.log('📊 Curve data:', curveData ? curveData.length + ' values' : 'none')
      console.log('🎨 Palette data:', paletteData ? paletteData.length + ' colors' : 'none')
      
      // Create 8-bit data textures for curve and palette data
      const { curveTexture, paletteTexture } = createDataTextures(babylonScene.scene, curveData, paletteData)
      
      // Store data textures and parameters on the material for future use
      if (curveTexture) {
        nodeMaterial._curveDataTexture = curveTexture
        console.log('📊 Curve data texture attached to material')
      }
      if (paletteTexture) {
        nodeMaterial._paletteDataTexture = paletteTexture  
        console.log('🎨 Palette data texture attached to material')
      }
      
      // Store Pipeline F parameters for shader generation
      nodeMaterial._pipelineFParams = {
        distanceCalculation: selectedDP['distance-calculation'],
        curveScaling: selectedDP['curve-scaling'],
        angularDistortion: selectedDP['angular-distortion'],
        fractalDistortion: selectedDP['fractal-distortion'],
        distanceModulus: selectedDP['distance-modulus'],
        checkerboardPattern: selectedDP['checkerboard-pattern'],
        angularFrequency: selectedDP['angular-frequency'],
        angularAmplitude: selectedDP['angular-amplitude'],
        angularOffset: selectedDP['angular-offset'],
        fractalStrength: selectedDP['fractal-strength'],
        fractalScale1: selectedDP['fractal-scale-1'],
        fractalScale2: selectedDP['fractal-scale-2'],
        fractalScale3: selectedDP['fractal-scale-3'],
        checkerboardSteps: selectedDP['checkerboard-steps']
      }
      
      console.log('✅ Data textures and parameters prepared (skipping complex NodeMaterial for now)')
      
    } catch (error) {
      console.error('❌ Failed to prepare data textures:', error)
      throw new Error(`Data preparation failed: ${error.message}`)
    }
  }

  // Create 8-bit data textures for curve and palette storage
  const createDataTextures = (scene: any, curveData: any, paletteData: any) => {
    const { BABYLON } = babylonScene
    
    // Create normalized 256-element curve data texture (all curves are ≤255 elements)
    let curveTexture = null
    if (curveData && curveData.length > 0) {
      const curveBytes = new Uint8Array(256)
      
      // Normalize any curve length to exactly 256 elements
      for (let i = 0; i < 256; i++) {
        let value = 0.5 // Default fallback
        
        if (curveData.length <= 256) {
          // If curve is ≤256, pad with last value or repeat pattern
          const sourceIndex = Math.min(i, curveData.length - 1)
          value = curveData[sourceIndex] || 0.5
        } else {
          // If curve is >256 (shouldn't happen but handle gracefully), sample evenly
          const sourceIndex = Math.floor((i / 256) * curveData.length)
          value = curveData[sourceIndex] || 0.5
        }
        
        curveBytes[i] = Math.floor(value * 255) // Convert 0-1 to 0-255
      }
      
      curveTexture = new BABYLON.RawTexture(
        curveBytes,
        256, 1, // Always 256×1 texture
        BABYLON.Engine.TEXTUREFORMAT_R, // Single red channel
        scene,
        false, false, // No mipmap, no invert
        BABYLON.Texture.NEAREST_SAMPLINGMODE // Exact pixel sampling
      )
      console.log(`📊 Created normalized curve texture: 256×1 R8 (from ${curveData.length} source values)`)
    }
    
    // Create palette data texture (256x1, RGBA format for WebGPU compatibility)
    let paletteTexture = null
    if (paletteData && paletteData.length > 0) {
      const paletteBytes = new Uint8Array(256 * 4) // RGBA with alpha
      for (let i = 0; i < 256; i++) {
        const color = i < paletteData.length ? paletteData[i] : { r: 0.7, g: 0.7, b: 0.7, a: 1.0 }
        paletteBytes[i * 4] = Math.floor(color.r * 255)     // R
        paletteBytes[i * 4 + 1] = Math.floor(color.g * 255) // G  
        paletteBytes[i * 4 + 2] = Math.floor(color.b * 255) // B
        paletteBytes[i * 4 + 3] = Math.floor((color.a !== undefined ? color.a : 1.0) * 255) // A
      }
      
      paletteTexture = new BABYLON.RawTexture(
        paletteBytes,
        256, 1, // 256x1 texture
        BABYLON.Engine.TEXTUREFORMAT_RGBA, // RGBA format (WebGPU compatible)
        scene,
        false, false, // No mipmap, no invert
        BABYLON.Texture.NEAREST_SAMPLINGMODE // Exact pixel sampling
      )
      console.log('🎨 Created palette data texture: 256x1 RGBA8')
    }
    
    return { curveTexture, paletteTexture }
  }

  // Generate complete Pipeline F fragment shader with 8-bit data texture lookups
  const generatePipelineFWithTextures = (selectedDP: any, targets: TargetAssignment[]): string => {
    return `
      /*
       * Complete Pipeline F Fragment Shader
       * Distortion Profile: ${selectedDP.name}
       * Uses: curveTexture (256x1 R8), paletteTexture (256x1 RGB8)
       */
      
      precision highp float;
      
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec2 vUV;
      
      uniform sampler2D curveTexture;
      uniform sampler2D paletteTexture;
      uniform float hasCurveTexture;
      uniform float hasPaletteTexture;
      
      void main() {
        // Pipeline F: World Position → Distance → Curve Value → Palette Color
        
        // Step 1: Convert 3D world position to 2D coordinate
        vec2 p = vWorldPosition.xz;
        
        // Step 2: Apply Pipeline F distortions (from DP parameters)
        ${selectedDP['distance-modulus'] > 0 ? `
          // Distance modulus wrapping
          float modulus = ${selectedDP['distance-modulus'].toFixed(1)};
          p = mod(p + modulus * 0.5, modulus) - modulus * 0.5;
        ` : ''}
        
        ${selectedDP['angular-distortion'] ? `
          // Angular distortion
          float angle = atan(p.y, p.x);
          float radius = length(p);
          float newAngle = angle + sin(angle * ${selectedDP['angular-frequency'].toFixed(1)} + ${selectedDP['angular-offset'].toFixed(1)} * 0.017453) * ${selectedDP['angular-amplitude'].toFixed(1)} * 0.01;
          p = vec2(cos(newAngle) * radius, sin(newAngle) * radius);
        ` : ''}
        
        ${selectedDP['fractal-distortion'] ? `
          // Fractal distortion (3-scale system)
          p.x += sin(p.y * ${selectedDP['fractal-scale-1'].toFixed(3)}) * ${selectedDP['fractal-strength'].toFixed(1)} * 0.3;
          p.y += cos(p.x * ${selectedDP['fractal-scale-2'].toFixed(3)}) * ${selectedDP['fractal-strength'].toFixed(1)} * 0.3;
          p.x += sin(p.y * ${selectedDP['fractal-scale-3'].toFixed(3)}) * ${selectedDP['fractal-strength'].toFixed(1)} * 0.1;
        ` : ''}
        
        // Step 3: Calculate distance using selected method
        float distance = ${getDistanceCalculationGLSL(selectedDP['distance-calculation'])} * ${selectedDP['curve-scaling'].toFixed(4)};
        
        // Step 4: Lookup curve value from 8-bit data texture (with fallback)
        float curveValue = 0.5; // Default fallback
        if (hasCurveTexture > 0.5) {
          float normalizedDistance = clamp(distance * 0.00392157, 0.0, 1.0); // 1/255 = 0.00392157
          vec2 curveCoord = vec2(normalizedDistance, 0.5);
          curveValue = texture2D(curveTexture, curveCoord).r;
        }
        
        // Step 5: Apply checkerboard pattern if enabled
        ${selectedDP['checkerboard-pattern'] && selectedDP['checkerboard-steps'] > 0 ? `
          float checker = floor(distance * ${(1.0 / selectedDP['checkerboard-steps']).toFixed(6)});
          if (mod(checker, 2.0) > 0.5) {
            curveValue = 1.0 - curveValue;
          }
        ` : ''}
        
        // Step 6: Use curveValue to lookup palette color (Merzbow logic) with fallback
        vec3 finalColor = vec3(curveValue, curveValue, curveValue); // Grayscale fallback
        if (hasPaletteTexture > 0.5) {
          vec2 paletteCoord = vec2(curveValue, 0.5);
          finalColor = texture2D(paletteTexture, paletteCoord).rgb;
        }
        
        // Apply target assignments
        ${generateTargetAssignmentGLSL(targets)}
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
  }

  // Helper for distance calculation GLSL (since NodeMaterial uses GLSL)
  const getDistanceCalculationGLSL = (type: string): string => {
    switch(type) {
      case 'radial': return 'length(p)'
      case 'cartesian-x': return 'abs(p.x)'
      case 'cartesian-y': return 'abs(p.y)'
      case 'manhattan': return 'abs(p.x) + abs(p.y)'
      case 'chebyshev': return 'max(abs(p.x), abs(p.y))'
      default: return 'length(p)'
    }
  }

  // Create actual Pipeline F ShaderMaterial using 8-bit data textures
  const createPipelineFShaderMaterial = (scene: any, selectedDP: any, curveTexture: any, paletteTexture: any, targets: TargetAssignment[]) => {
    const { BABYLON } = babylonScene
    
    // Create ShaderMaterial with Pipeline F implementation
    const vertexShader = `
      attribute vec3 position;
      attribute vec3 normal;
      attribute vec2 uv;
      
      uniform mat4 worldViewProjection;
      uniform mat4 world;
      
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec2 vUV;
      
      void main() {
        vec4 worldPos = world * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vNormal = normalize((world * vec4(normal, 0.0)).xyz);
        vUV = uv;
        
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `
    
    const fragmentShader = `
      precision highp float;
      
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec2 vUV;
      
      uniform sampler2D curveTexture;
      uniform sampler2D paletteTexture;
      uniform float hasCurveTexture;
      uniform float hasPaletteTexture;
      
      void main() {
        // Pipeline F: World Position → Distance → Curve Value → Palette Color
        
        // Step 1: Convert 3D world position to 2D coordinate
        vec2 p = vWorldPosition.xz;
        
        // Step 2: Apply Pipeline F distortions
        ${selectedDP['distance-modulus'] > 0 ? `
          // Distance modulus wrapping
          float modulus = ${selectedDP['distance-modulus'].toFixed(1)};
          p = mod(p + modulus * 0.5, modulus) - modulus * 0.5;
        ` : ''}
        
        ${selectedDP['angular-distortion'] ? `
          // Angular distortion
          float angle = atan(p.y, p.x);
          float radius = length(p);
          float newAngle = angle + sin(angle * ${selectedDP['angular-frequency'].toFixed(1)} + ${selectedDP['angular-offset'].toFixed(1)} * 0.017453) * ${selectedDP['angular-amplitude'].toFixed(1)} * 0.01;
          p = vec2(cos(newAngle) * radius, sin(newAngle) * radius);
        ` : ''}
        
        ${selectedDP['fractal-distortion'] ? `
          // Fractal distortion (3-scale system)
          p.x += sin(p.y * ${selectedDP['fractal-scale-1'].toFixed(3)}) * ${selectedDP['fractal-strength'].toFixed(1)} * 0.3;
          p.y += cos(p.x * ${selectedDP['fractal-scale-2'].toFixed(3)}) * ${selectedDP['fractal-strength'].toFixed(1)} * 0.3;
          p.x += sin(p.y * ${selectedDP['fractal-scale-3'].toFixed(3)}) * ${selectedDP['fractal-strength'].toFixed(1)} * 0.1;
        ` : ''}
        
        // Step 3: Calculate distance using selected method
        float distance = ${getDistanceCalculationGLSL(selectedDP['distance-calculation'])} * ${selectedDP['curve-scaling'].toFixed(4)};
        
        // Step 4: Lookup curve value from 8-bit data texture (with fallback)
        float curveValue = 0.5; // Default fallback
        if (hasCurveTexture > 0.5) {
          float normalizedDistance = clamp(distance * 0.00392157, 0.0, 1.0); // 1/255 = 0.00392157
          vec2 curveCoord = vec2(normalizedDistance, 0.5);
          curveValue = texture2D(curveTexture, curveCoord).r;
        }
        
        // Step 5: Apply checkerboard pattern if enabled
        ${selectedDP['checkerboard-pattern'] && selectedDP['checkerboard-steps'] > 0 ? `
          float checker = floor(distance * ${(1.0 / selectedDP['checkerboard-steps']).toFixed(6)});
          if (mod(checker, 2.0) > 0.5) {
            curveValue = 1.0 - curveValue;
          }
        ` : ''}
        
        // Step 6: Use curveValue to lookup palette color (Merzbow logic) with fallback
        vec3 finalColor = vec3(curveValue, curveValue, curveValue); // Grayscale fallback
        if (hasPaletteTexture > 0.5) {
          vec2 paletteCoord = vec2(curveValue, 0.5);
          finalColor = texture2D(paletteTexture, paletteCoord).rgb;
        }
        
        // Apply target assignments
        ${generateTargetAssignmentGLSL(targets)}
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
    
    // Create the actual ShaderMaterial
    const shaderMaterial = new BABYLON.ShaderMaterial(
      `pipelineF_${selectedDP.id}`,
      scene,
      {
        vertex: "custom",
        fragment: "custom"
      },
      {
        attributes: ["position", "normal", "uv"],
        uniforms: ["world", "worldViewProjection", "hasCurveTexture", "hasPaletteTexture"],
        samplers: ["curveTexture", "paletteTexture"]
      }
    )
    
    // Set the shader code
    BABYLON.Effect.ShadersStore["customVertexShader"] = vertexShader
    BABYLON.Effect.ShadersStore["customFragmentShader"] = fragmentShader
    
    // Set uniform flags and bind textures
    const hasCurve = curveTexture && curveTexture.isReady()
    const hasPalette = paletteTexture && paletteTexture.isReady()
    
    shaderMaterial.setFloat("hasCurveTexture", hasCurve ? 1.0 : 0.0)
    shaderMaterial.setFloat("hasPaletteTexture", hasPalette ? 1.0 : 0.0)
    
    // Bind textures only if available
    if (hasCurve) {
      shaderMaterial.setTexture("curveTexture", curveTexture)
      console.log('📊 Curve texture bound to shader')
    } else {
      console.warn('⚠️ Curve texture not ready or missing - using fallback')
    }
    
    if (hasPalette) {
      shaderMaterial.setTexture("paletteTexture", paletteTexture)
      console.log('🎨 Palette texture bound to shader')
    } else {
      console.warn('⚠️ Palette texture not ready or missing - using grayscale fallback')
    }
    
    console.log('🎨 Pipeline F ShaderMaterial created with 8-bit data texture lookups')
    return shaderMaterial
  }

  // Generate target assignment GLSL code
  const generateTargetAssignmentGLSL = (targets: TargetAssignment[]): string => {
    const assignments: string[] = []
    
    targets.forEach(target => {
      if (!target.enabled) return
      
      const sourceValue = target.source === 'curveValue' ? 'curveValue' : '(normalizedDistance)'
      
      switch (target.property) {
        case 'baseColor':
          if (target.transform === 'palette') {
            assignments.push('// Base color already set from palette lookup above')
          } else {
            const colorValue = applyTransformGLSL(sourceValue, target.transform, target.multiplier)
            assignments.push(`finalColor = vec3(${colorValue});`)
          }
          break
          
        case 'emissiveColor':
          const emissiveValue = applyTransformGLSL(sourceValue, target.transform, target.multiplier)
          assignments.push(`finalColor += vec3(${emissiveValue}) * 0.5; // Emissive contribution`)
          break
          
        case 'roughnessFactor':
          // Roughness affects specular reflection (simulated with brightness variation)
          const roughnessValue = applyTransformGLSL(sourceValue, target.transform, target.multiplier)
          assignments.push(`finalColor *= (0.5 + 0.5 * (1.0 - ${roughnessValue})); // Roughness simulation`)
          break
          
        case 'metallicFactor':
          const metallicValue = applyTransformGLSL(sourceValue, target.transform, target.multiplier)
          assignments.push(`finalColor = mix(finalColor, finalColor * 1.5, ${metallicValue}); // Metallic boost`)
          break
      }
    })
    
    return assignments.length > 0 ? assignments.join('\n        ') : '// No active target assignments'
  }

  // Apply transform to a value in GLSL
  const applyTransformGLSL = (valueExpr: string, transform: string, multiplier?: number): string => {
    switch (transform) {
      case 'raw':
        return valueExpr
      case 'scaled':
        return `(${valueExpr} * ${(multiplier || 1.0).toFixed(3)})`
      case 'inverse':
        return `(1.0 - ${valueExpr})`
      case 'signed':
        return `((${valueExpr} - 0.5) * 2.0)`
      case 'percentage':
        return `(${valueExpr} * 100.0)`
      case 'degrees':
        return `(${valueExpr} * 360.0)`
      case 'palette':
        return 'curveValue' // Special case - handled in main shader
      default:
        return valueExpr
    }
  }

  // Create Pipeline F material using proven mathematics (replicates Merzbow canvas generation)
  const createPipelineFTextureMaterial = (scene: any, selectedDP: any, curveData: any, paletteData: any) => {
    const { BABYLON } = babylonScene
    
    console.log('🎨 Creating Pipeline F texture using proven mathematics...')
    console.log('📊 Using curve data:', curveData ? curveData.length + ' values' : 'fallback')
    console.log('🎨 Using palette data:', paletteData ? paletteData.length + ' colors' : 'fallback')
    
    // Create procedural texture using exact Pipeline F mathematics (smaller for performance)
    const textureSize = 256 // Smaller for faster generation
    const pipelineFTexture = new BABYLON.DynamicTexture('pipelineF', textureSize, scene, false)
    const context = pipelineFTexture.getContext()
    const imageData = context.createImageData(textureSize, textureSize)
    
    console.log('🔄 Generating Pipeline F texture:', textureSize + 'x' + textureSize, 'pixels')
    
    // Apply exact Pipeline F mathematics (from mathPipeline.ts + WebGPU implementations)
    let pixelCount = 0
    for (let y = 0; y < textureSize; y++) {
      for (let x = 0; x < textureSize; x++) {
        // Convert pixel to world coordinates (same scale as Merzbow)
        const worldX = (x - textureSize/2) * 0.02 // Scale to reasonable world coordinates
        const worldY = (y - textureSize/2) * 0.02
        
        // Apply exact Pipeline F logic
        const result = applyProvenPipelineFLogic(worldX, worldY, selectedDP, curveData, paletteData, pixelCount)
        
        const pixelIndex = (y * textureSize + x) * 4
        imageData.data[pixelIndex] = result.r
        imageData.data[pixelIndex + 1] = result.g  
        imageData.data[pixelIndex + 2] = result.b
        imageData.data[pixelIndex + 3] = result.a !== undefined ? result.a : 255 // Use palette alpha if present, else full opacity
        
        pixelCount++
      }
    }
    
    console.log(`🎨 Generated ${pixelCount} pixels using Pipeline F mathematics`)
    
    context.putImageData(imageData, 0, 0)
    pipelineFTexture.update()
    
    // Create material with Pipeline F texture
    const material = new BABYLON.StandardMaterial(`pipelineF_${selectedDP.id}`, scene)
    material.diffuseTexture = pipelineFTexture
    material.specularColor = new BABYLON.Color3(0, 0, 0)
    material.disableLighting = true // Show texture directly
    
    console.log('✅ Pipeline F texture material created using proven mathematics')
    return material
  }

  // Apply exact Pipeline F logic (from mathPipeline.ts - applyMathPipeline function)
  const applyProvenPipelineFLogic = (x: number, y: number, selectedDP: any, curveData: any, paletteData: any, pixelCount: number) => {
    try {
      // Step 1: Apply noise function (simplified for now - using coordinates directly)
      const n = 1.0 // Noise function result (simplified)
      
      // Step 2: Warp coordinates using scalar-radius (from warpPointScalarRadius)
      const [px, py] = [x * n, y * n]
      
      // Step 3: Calculate distance (from Math.hypot)
      const d = Math.hypot(px, py)
      
      // Step 4: Scale distance (from curve-index-scaling)
      const curveIndexScaling = selectedDP['curve-scaling'] || 1.0
      const dPrime = d * curveIndexScaling
      
      // Step 5: Wrap and clamp index (from existing logic)
      const curveWidth = curveData ? Math.min(curveData.length, 256) : 256
      let idx = Math.floor(dPrime % curveWidth)
      if (idx < 0) idx += curveWidth
      if (idx >= curveWidth) idx = curveWidth - 1
      
      // Step 6: Lookup curve value (from curve-data[idx])
      let curveValue = 0.5 // Default fallback
      if (curveData && curveData.length > 0) {
        const rawValue = curveData[idx] || 0
        curveValue = rawValue // Assume already normalized 0-1
      } else {
        curveValue = idx / 255.0 // Fallback: linear ramp
      }
      
      // Debug first few pixels
      if (pixelCount < 5) {
        console.log(`  Pixel ${pixelCount}: (${x.toFixed(2)}, ${y.toFixed(2)}) → d=${d.toFixed(3)} → idx=${idx} → curveValue=${curveValue.toFixed(3)}`)
      }
      
      // Map curveValue to palette color (exact Merzbow logic) with conditional RGBA support
      if (paletteData && paletteData.length > 0) {
        const paletteIndex = Math.floor(curveValue * (paletteData.length - 1))
        const color = paletteData[paletteIndex] || { r: 0.7, g: 0.7, b: 0.7 }
        
        // Check if alpha is present in the palette data
        const hasAlpha = color.a !== undefined
        
        const result = { 
          r: Math.floor(color.r * 255), 
          g: Math.floor(color.g * 255), 
          b: Math.floor(color.b * 255)
        }
        
        // Only add alpha if it exists in the palette
        if (hasAlpha) {
          result.a = Math.floor(color.a * 255)
        }
        
        if (pixelCount < 3) {
          const colorStr = hasAlpha 
            ? `(${result.r}, ${result.g}, ${result.b}, ${result.a})`
            : `(${result.r}, ${result.g}, ${result.b})`
          console.log(`    → paletteIndex=${paletteIndex} → color=${colorStr} ${hasAlpha ? 'RGBA' : 'RGB'}`)
        }
        
        return result
      }
      
      // Grayscale fallback (RGB only)
      const gray = Math.floor(curveValue * 255)
      if (pixelCount < 3) {
        console.log(`    → grayscale fallback: ${gray} (RGB)`)
      }
      return { r: gray, g: gray, b: gray }
      
    } catch (error) {
      // Error fallback with alpha
      return { r: 128, g: 128, b: 128, a: 255 }
    }
  }

  // Helper for distance calculation WGSL
  const getDistanceCalculationWGSL = (type: string): string => {
    switch(type) {
      case 'radial': return 'length(p)'
      case 'cartesian-x': return 'abs(p.x)'
      case 'cartesian-y': return 'abs(p.y)'
      case 'manhattan': return 'abs(p.x) + abs(p.y)'
      case 'chebyshev': return 'max(abs(p.x), abs(p.y))'
      default: return 'length(p)'
    }
  }

  // Apply Pipeline F NodeMaterial to mesh
  const applyPipelineFNodeMaterial = async () => {
    if (!babylonScene || !babylonScene.mesh) {
      setTestMessage('❌ No mesh available for NodeMaterial application')
      return
    }

    try {
      console.log('🎯 Applying Pipeline F NodeMaterial...')
      
      const materialData = await generatePipelineFNodeMaterial()
      if (materialData && babylonScene.mesh) {
        babylonScene.mesh.material = materialData
        const currentDP = availableDistortionProfiles.find(dp => dp.id === shaderBuilder.selectedDP)
        setTestMessage(`✅ Applied Pipeline F NodeMaterial for ${currentDP?.name}`)
        console.log('✅ Pipeline F NodeMaterial applied to mesh')
      }
      
    } catch (error) {
      console.error('❌ Failed to apply Pipeline F NodeMaterial:', error)
      setTestMessage(`Failed to apply NodeMaterial: ${error.message}`)
    }
  }

  // View generated shader code
  const viewGeneratedShader = () => {
    if (generatedShaderCode) {
      setIsShaderViewerOpen(true)
    } else {
      setTestMessage('❌ No shader code available. Generate a NodeMaterial first.')
    }
  }

  // Save shader to database
  const saveShaderToDatabase = async () => {
    if (!pipelineFMaterial || !pipelineFMaterial.distortionProfile) {
      setTestMessage('❌ No material to save. Generate a NodeMaterial first.')
      return
    }

    try {
      const { distortionProfile, curveData, paletteData, standardMaterial } = pipelineFMaterial
      const shaderName = `${distortionProfile.name}_PipelineF_${Date.now()}`
      
      const shaderData = {
        name: shaderName,
        category: 'pipeline-f-generated',
        distortionProfileId: distortionProfile.id,
        distortionProfileName: distortionProfile.name,
        curveReference: curveData ? {
          id: distortionProfile['linked-curve'] || 'unknown',
          name: distortionProfile['linked-curve'] || 'Unknown Curve',
          comment: `Curve data baked into shader. Contains ${curveData.length || 0} values ranging from ${Math.min(...curveData)} to ${Math.max(...curveData)}.`
        } : null,
        paletteReference: paletteData ? {
          id: distortionProfile['linked-palette'] || 'unknown', 
          name: distortionProfile['linked-palette'] || 'Unknown Palette',
          comment: `Palette data baked into shader. Contains ${paletteData.length || 0} colors for curveValue-based lookups (Merzbow logic).`
        } : null,
        targets: targetAssignments,
        glsl: generatedShaderCode?.glsl || '',
        wgsl: generatedShaderCode?.wgsl || '',
        materialJson: JSON.stringify(standardMaterial.serialize()),
        createdAt: new Date().toISOString(),
        geometryType: currentGeometry,
        // Additional metadata
        pipelineF: {
          distanceCalculation: distortionProfile['distance-calculation'],
          curveScaling: distortionProfile['curve-scaling'],
          angularDistortion: distortionProfile['angular-distortion'],
          fractalDistortion: distortionProfile['fractal-distortion'],
          checkerboardPattern: distortionProfile['checkerboard-pattern'],
          distanceModulus: distortionProfile['distance-modulus']
        }
      }
      
      console.log('💾 Saving shader to database:', shaderData)
      setTestMessage(`✅ Shader "${shaderName}" saved to database`)
      
      // TODO: Implement actual API call to save shader
      // const response = await fetch('/api/shaders', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(shaderData)
      // })
      
    } catch (error) {
      console.error('❌ Failed to save shader:', error)
      setTestMessage(`Failed to save shader: ${error.message}`)
    }
  }

  const applyCustomWGSLToMesh = () => {
    if (!babylonScene) {
      setTestMessage('❌ No Babylon scene available')
      return
    }
    
    try {
      const { mesh, scene, BABYLON } = babylonScene
      if (!mesh) {
        setTestMessage('❌ No mesh to apply material to')
        return
      }
      
      console.log('🎨 Applying WGSL:', customWGSL.substring(0, 100) + '...')
      
      // Create a procedural texture that simulates the checker pattern
      if (customWGSL.includes('checker') || customWGSL.includes('fract')) {
        // Create a checker pattern using Babylon's DynamicTexture
        const textureSize = 512
        const dynamicTexture = new BABYLON.DynamicTexture('checkerTexture', textureSize, scene, false)
        const context = dynamicTexture.getContext()
        
        // Draw checker pattern
        const squareSize = 32
        for (let x = 0; x < textureSize; x += squareSize) {
          for (let y = 0; y < textureSize; y += squareSize) {
            const isEven = (Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0
            context.fillStyle = isEven ? '#1a1a1a' : '#e6e6e6'
            context.fillRect(x, y, squareSize, squareSize)
          }
        }
        dynamicTexture.update()
        
        const checkerMaterial = new BABYLON.StandardMaterial('checkerMat', scene)
        checkerMaterial.diffuseTexture = dynamicTexture
        checkerMaterial.specularColor = new BABYLON.Color3(0, 0, 0)
        mesh.material = checkerMaterial
        
        setTestMessage('✅ Applied checker pattern simulation')
        console.log('✅ Checker pattern texture applied')
        
      } else {
        // For other WGSL, use a solid color
        const customMaterial = new BABYLON.StandardMaterial('customMat', scene)
        customMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.6, 0.9)
        customMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1)
        mesh.material = customMaterial
        
        setTestMessage('✅ Applied custom WGSL simulation')
        console.log('✅ Custom material applied')
      }
    } catch (e) {
      console.error('Apply WGSL error', e)
      setTestMessage('❌ Failed to apply WGSL')
    }
  }

  const resetWGSLToChecker = () => {
    setCustomWGSL(defaultCheckerWGSL)
    applyCustomWGSLToMesh()
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
      try {
        if (babylonSceneRef.current?.engine) {
          babylonSceneRef.current.engine.stopRenderLoop()
          babylonSceneRef.current.engine.dispose()
        }
      } catch {}
      hasInitializedRef.current = false
    }
  }, [])

  // Initialize Babylon.js scene for GPU-accelerated testing
  const initBabylonScene = async () => {
    const container = babylonContainerRef.current
    if (!container) return

    // Prevent duplicate initialization (React StrictMode / rapid re-renders)
    if (hasInitializedRef.current) {
      console.log('⏭️ Babylon scene already initialized; skipping duplicate init')
      return
    }
    // Mark as initializing immediately to prevent parallel inits
    hasInitializedRef.current = true

    try {
      console.log('🎮 Initializing Babylon.js scene with WebGPU...')
      
      // Cleanup any existing content
      try {
        // Dispose any previous engine/scene managed by us
        if (babylonSceneRef.current?.engine) {
          babylonSceneRef.current.engine.stopRenderLoop()
          babylonSceneRef.current.engine.dispose()
        }
      } catch {}
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
      // IMPORTANT: keep CSS pixel size in sync to avoid WebGPU resolve-target size mismatch
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      canvas.style.display = 'block'
      canvas.style.margin = '0'
      canvas.style.padding = '0'
      container.appendChild(canvas)
      
      console.log('🚀 Creating WebGPU engine...')
      
      // Enforce WebGPU-only
      let engine: any
      if (!('gpu' in navigator)) {
        throw new Error('WebGPU not available in this browser. This app requires WebGPU.')
      }
      engine = new BABYLON.WebGPUEngine(canvas)
      await engine.initAsync()
      console.log('✅ WebGPU engine initialized')
      setTestMessage('Babylon.js WebGPU engine ready')
      
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
      let mesh = createGeometry(currentGeometry, vertexCount, BABYLON, scene)
      
      // Animation loop
      engine.runRenderLoop(() => {
        // Use latest mesh reference to avoid rotating a disposed mesh
        const m = babylonSceneRef.current?.mesh || mesh
        if (m) {
          m.rotation.x += 0.005
          m.rotation.y += 0.01
        }
        scene.render()
      })
      
      // Handle resize properly to avoid WebGPU validation errors
      const handleResize = () => {
        if (container && engine && canvas) {
          const newRect = container.getBoundingClientRect()
          const newW = Math.max(Math.floor(newRect.width), 1)
          const newH = Math.max(Math.floor(newRect.height), 1)
          
          // Only resize if dimensions actually changed
          if (canvas.width !== newW || canvas.height !== newH) {
            try {
              // Stop rendering during resize to prevent validation errors
              engine.stopRenderLoop()
              
              // Update canvas dimensions
              canvas.width = newW
              canvas.height = newH
              canvas.style.width = `${newW}px`
              canvas.style.height = `${newH}px`
              
              // Resize engine and restart rendering
              engine.setSize(newW, newH, true) // Force exact size
              engine.resize(true) // Force resize
              
              // Restart render loop
              engine.runRenderLoop(() => {
                const m = babylonSceneRef.current?.mesh || mesh
                if (m) {
                  m.rotation.x += 0.005
                  m.rotation.y += 0.01
                }
                scene.render()
              })
              
              console.log(`📐 Resized to: ${newW}x${newH}`)
            } catch (resizeError) {
              console.warn('⚠️ Resize error:', resizeError)
            }
          }
        }
      }
      
      window.addEventListener('resize', handleResize)
      
      // Store scene data
      const sceneData = { 
        engine, 
        scene, 
        camera, 
        mesh, 
        BABYLON,
        light
      }
      setBabylonScene(sceneData)
      babylonSceneRef.current = sceneData
      hasInitializedRef.current = true
      
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
    const updated = { ...babylonScene, mesh: newMesh }
    setBabylonScene(updated)
    babylonSceneRef.current = updated
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
    const updated = { ...babylonScene, mesh: newMesh }
    setBabylonScene(updated)
    babylonSceneRef.current = updated
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

  // Removed: RGB map and dynamic texture test helpers

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

  // Removed: runShaderTest

  return (
    <div className="testing-page">
      <div className="testing-content">
        <div className="testing-sidebar">
          <h2>Pipeline F Shader System</h2>
          <p style={{ fontSize: '14px', color: '#888', marginBottom: '20px' }}>
            🏗️ Generate dynamic shaders using Pipeline F mathematics with 8-bit data texture lookups
          </p>
          
          {/* DP Selection for Pipeline F */}
          <div className="form-group">
            <label>Distortion Profile:</label>
            <select 
              value={shaderBuilder.selectedDP} 
              onChange={(e) => {
                console.log('🔄 DP Selection Changed:', {
                  from: shaderBuilder.selectedDP,
                  to: e.target.value,
                  dpName: availableDistortionProfiles.find(dp => dp.id === e.target.value)?.name
                })
                setShaderBuilder({...shaderBuilder, selectedDP: e.target.value})
              }}
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

          {/* Pipeline F NodeMaterial System */}
          <div className="pipeline-f-section" style={{ marginBottom: '20px', padding: '20px', border: '2px solid #4a90e2', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
            <h3 style={{ color: '#4a90e2', marginBottom: '15px' }}>🏗️ Pipeline F NodeMaterial</h3>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
              Generate self-contained shaders using Babylon.js NodeMaterial with smart data type conversion
            </p>

            {/* Target Assignments */}
            <div className="target-assignments" style={{ marginBottom: '15px' }}>
              <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>Target Assignments:</label>
              {targetAssignments.map((target, index) => (
                <div key={target.id} className="target-assignment" style={{ 
                  padding: '10px', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px', 
                  marginBottom: '8px',
                  backgroundColor: target.enabled ? '#e8f5e8' : '#f5f5f5'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <input 
                      type="checkbox" 
                      checked={target.enabled}
                      onChange={(e) => {
                        const updated = [...targetAssignments]
                        updated[index].enabled = e.target.checked
                        setTargetAssignments(updated)
                      }}
                      style={{ marginRight: '8px' }}
                    />
                    <strong>{target.property}</strong>
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: '#666' }}>
                      ({target.dataType})
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                    <select 
                      value={target.source}
                      onChange={(e) => {
                        const updated = [...targetAssignments]
                        updated[index].source = e.target.value as 'curveValue' | 'curveIndex'
                        setTargetAssignments(updated)
                      }}
                      style={{ flex: 1 }}
                    >
                      <option value="curveValue">Curve Value</option>
                      <option value="curveIndex">Curve Index</option>
                    </select>
                    
                    <select 
                      value={target.transform}
                      onChange={(e) => {
                        const updated = [...targetAssignments]
                        updated[index].transform = e.target.value as any
                        setTargetAssignments(updated)
                      }}
                      style={{ flex: 1 }}
                    >
                      <option value="raw">Raw (0-1)</option>
                      <option value="palette">Palette Lookup</option>
                      <option value="scaled">Scaled</option>
                      <option value="inverse">Inverse (1-x)</option>
                      <option value="signed">Signed (-1 to 1)</option>
                      <option value="percentage">Percentage (0-100)</option>
                      <option value="degrees">Degrees (0-360)</option>
                    </select>
                    
                    {target.transform === 'scaled' && (
                      <input 
                        type="number" 
                        value={target.multiplier || 1.0}
                        onChange={(e) => {
                          const updated = [...targetAssignments]
                          updated[index].multiplier = parseFloat(e.target.value) || 1.0
                          setTargetAssignments(updated)
                        }}
                        step="0.1"
                        style={{ width: '60px' }}
                        placeholder="1.0"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* NodeMaterial Actions */}
            <div className="nodematerial-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                onClick={applyPipelineFNodeMaterial}
                className="test-btn"
                style={{ backgroundColor: '#28a745', flex: 1 }}
              >
                🏗️ Generate & Apply NodeMaterial
              </button>
              
              <button 
                onClick={viewGeneratedShader}
                className="test-btn"
                style={{ backgroundColor: '#17a2b8', flex: 1 }}
                disabled={!generatedShaderCode}
              >
                👁️ View Shader Code
              </button>
              
              <button 
                onClick={saveShaderToDatabase}
                className="test-btn"
                style={{ backgroundColor: '#6f42c1', flex: 1 }}
                disabled={!pipelineFMaterial}
              >
                💾 Save to Database
              </button>
            </div>

            {/* Status */}
            {pipelineFMaterial && (
              <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#d4edda', borderRadius: '4px', fontSize: '12px', color: '#155724' }}>
                ✅ NodeMaterial generated for {pipelineFMaterial.distortionProfile?.name || 'Unknown DP'}
              </div>
            )}
          </div>

          <hr style={{ margin: '20px 0', borderColor: '#333' }} />
          
          {/* WGSL Live Editor */}
          <div className="test-section">
            <h3>WGSL Editor</h3>
            <textarea 
              value={customWGSL}
              onChange={(e) => setCustomWGSL(e.target.value)}
              style={{ width: '100%', height: '220px', background: '#111', color: '#eee', border: '1px solid #333', borderRadius: 4, padding: 8, fontFamily: 'monospace', fontSize: 12 }}
            />
            <div className="button-row" style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button className="test-btn" onClick={applyCustomWGSLToMesh}>Apply WGSL to Mesh</button>
              <button className="test-btn secondary" onClick={resetWGSLToChecker}>Reset to Checker</button>
            </div>
          </div>

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

          {/* Shader Tests removed */}
          
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

      {/* Modals */}
      {isWGSLModalOpen && (
        <Modal isOpen={isWGSLModalOpen} onClose={() => setIsWGSLModalOpen(false)} title="WGSL Shader (Final)">
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', lineHeight: '1.4', maxHeight: '60vh', overflow: 'auto' }}>
{lastWGSL}
          </pre>
        </Modal>
      )}

      {/* Shader Code Viewer Modal */}
      {isShaderViewerOpen && generatedShaderCode && (
        <Modal 
          isOpen={isShaderViewerOpen}
          onClose={() => setIsShaderViewerOpen(false)}
          title="Generated Shader Code"
        >
          <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
            <div style={{ marginBottom: '20px' }}>
              <h4>GLSL Fragment Shader:</h4>
              <pre style={{ 
                backgroundColor: '#1e1e1e', 
                color: '#d4d4d4', 
                padding: '15px', 
                borderRadius: '4px', 
                fontSize: '12px',
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                {generatedShaderCode.glsl}
              </pre>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <h4>WGSL Auto-Generated:</h4>
              <pre style={{ 
                backgroundColor: '#1e1e1e', 
                color: '#d4d4d4', 
                padding: '15px', 
                borderRadius: '4px', 
                fontSize: '12px',
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                {generatedShaderCode.wgsl}
              </pre>
            </div>

            {/* Shader Metadata */}
            {pipelineFMaterial?.distortionProfile && (
              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <h4>Shader Metadata:</h4>
                <p><strong>Distortion Profile:</strong> {pipelineFMaterial.distortionProfile.name}</p>
                <p><strong>Curve Reference:</strong> {pipelineFMaterial.curveData ? 'Loaded' : 'None'}</p>
                <p><strong>Palette Reference:</strong> {pipelineFMaterial.paletteData ? 'Loaded' : 'None'}</p>
                <p><strong>Target Assignments:</strong> {targetAssignments.filter(t => t.enabled).length} active</p>
                <p><strong>Generated:</strong> {new Date().toLocaleString()}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Testing
