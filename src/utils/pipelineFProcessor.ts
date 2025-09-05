// Shared Pipeline F Processing Logic
// Used by both Merzbow (2D canvas) and Testing page (3D WGSL shaders)

export interface PipelineFParams {
  // Distance Modulus
  'distance-modulus': number
  
  // Angular Distortion  
  'angular-distortion': boolean
  'angular-frequency': number
  'angular-amplitude': number
  'angular-offset': number
  
  // Fractal Distortion
  'fractal-distortion': boolean
  'fractal-scale-1': number
  'fractal-scale-2': number
  'fractal-scale-3': number
  'fractal-strength': number
  
  // Distance Calculation
  'distance-calculation': string
  
  // Curve Scaling
  'curve-scaling': number
  
  // Checkerboard
  'checkerboard-pattern': boolean
  'checkerboard-steps': number
}

// Distance calculation methods (shared between JS and WGSL)
export const calculateDistance = (x: number, y: number, method: string): number => {
  switch (method) {
    case 'radial': return Math.sqrt(x * x + y * y)
    case 'cartesian-x': return Math.abs(x)
    case 'cartesian-y': return Math.abs(y)
    case 'manhattan': return Math.abs(x) + Math.abs(y)
    case 'chebyshev': return Math.max(Math.abs(x), Math.abs(y))
    case 'minkowski-3': return Math.pow(Math.pow(Math.abs(x), 3) + Math.pow(Math.abs(y), 3), 1/3)
    default: return Math.sqrt(x * x + y * y)
  }
}

// Complete Pipeline F processing (CPU version for Merzbow)
export const processPipelineF = (
  worldX: number, 
  worldY: number, 
  params: PipelineFParams
): { index: number, distance: number } => {
  
  // Step 1: Virtual centers via coordinate modulus
  let processedX = worldX
  let processedY = worldY

  if (params['distance-modulus'] > 0) {
    const modulus = params['distance-modulus']
    processedX = ((worldX % modulus) + modulus) % modulus - modulus/2
    processedY = ((worldY % modulus) + modulus) % modulus - modulus/2
  }

  // Step 2: Fractal distortion (coordinates) - FIRST
  if (params['fractal-distortion']) {
    const scale1X = Math.sin(processedX * params['fractal-scale-1']) * params['fractal-strength'] * 0.3
    const scale1Y = Math.cos(processedY * params['fractal-scale-1']) * params['fractal-strength'] * 0.3
    
    const scale2X = Math.sin(processedX * params['fractal-scale-2']) * params['fractal-strength'] * 0.2
    const scale2Y = Math.cos(processedY * params['fractal-scale-2']) * params['fractal-strength'] * 0.2
    
    const scale3X = Math.sin(processedX * params['fractal-scale-3']) * params['fractal-strength'] * 0.1
    const scale3Y = Math.cos(processedY * params['fractal-scale-3']) * params['fractal-strength'] * 0.1
    
    processedX += scale1X + scale2X + scale3X
    processedY += scale1Y + scale2Y + scale3Y
  }

  // Step 3: Angular distortion (coordinates) - AFTER fractal
  if (params['angular-distortion']) {
    const angle = Math.atan2(processedY, processedX) + (params['angular-offset'] * Math.PI / 180.0)
    const distortedAngle = angle + Math.sin(angle * params['angular-frequency']) * params['angular-amplitude'] * 0.01
    const radius = Math.sqrt(processedX * processedX + processedY * processedY)
    
    processedX = Math.cos(distortedAngle) * radius
    processedY = Math.sin(distortedAngle) * radius
  }

  // Step 4: Distance calculation
  const distance = calculateDistance(processedX, processedY, params['distance-calculation'])
  
  // Step 5: Curve scaling
  const scaledDistance = distance * params['curve-scaling']
  
  // Step 6: Convert to curve index (0-255)
  let curveIndex = Math.floor(scaledDistance * 255) % 256
  if (curveIndex < 0) curveIndex += 256 // Handle negative values
  
  return { index: curveIndex, distance: scaledDistance }
}

// Generate WGSL Pipeline F function from parameters (GPU version)
export const generateWGSLPipelineF = (params: PipelineFParams): string => {
  return `
// Pipeline F processing with baked parameters (WGSL)
fn processPipelineF(worldCoord: vec2f) -> vec2f {
    var coord = worldCoord;
    
    // Step 1: Distance Modulus (Virtual Centers)
    ${params['distance-modulus'] > 0 ? `
    let modulus = ${params['distance-modulus'].toFixed(1)}f;
    coord = (coord + modulus * 0.5) % modulus - modulus * 0.5;
    ` : ''}
    
    // Step 2: Fractal Distortion (3-scale) - FIRST
    ${params['fractal-distortion'] ? `
    coord.x += sin(coord.y * ${params['fractal-scale-1'].toFixed(6)}f) * ${params['fractal-strength'].toFixed(1)}f * 0.3f;
    coord.y += cos(coord.x * ${params['fractal-scale-1'].toFixed(6)}f) * ${params['fractal-strength'].toFixed(1)}f * 0.3f;
    
    coord.x += sin(coord.y * ${params['fractal-scale-2'].toFixed(6)}f) * ${params['fractal-strength'].toFixed(1)}f * 0.2f;
    coord.y += cos(coord.x * ${params['fractal-scale-2'].toFixed(6)}f) * ${params['fractal-strength'].toFixed(1)}f * 0.2f;
    
    coord.x += sin(coord.y * ${params['fractal-scale-3'].toFixed(6)}f) * ${params['fractal-strength'].toFixed(1)}f * 0.1f;
    coord.y += cos(coord.x * ${params['fractal-scale-3'].toFixed(6)}f) * ${params['fractal-strength'].toFixed(1)}f * 0.1f;
    ` : ''}
    
    // Step 3: Angular Distortion - AFTER fractal
    ${params['angular-distortion'] ? `
    let angle = atan2(coord.y, coord.x) + ${params['angular-offset'].toFixed(1)}f * 0.017453f;
    let distortedAngle = angle + sin(angle * ${params['angular-frequency'].toFixed(1)}f) * ${params['angular-amplitude'].toFixed(1)}f * 0.01f;
    let radius = length(coord);
    coord = vec2f(cos(distortedAngle) * radius, sin(distortedAngle) * radius);
    ` : ''}
    
    // Step 4: Distance Calculation
    var distance: f32;
    ${(() => {
      switch(params['distance-calculation']) {
        case 'radial': return 'distance = length(coord);'
        case 'cartesian-x': return 'distance = abs(coord.x);'
        case 'cartesian-y': return 'distance = abs(coord.y);'
        case 'manhattan': return 'distance = abs(coord.x) + abs(coord.y);'
        case 'chebyshev': return 'distance = max(abs(coord.x), abs(coord.y));'
        case 'minkowski-3': return 'distance = pow(pow(abs(coord.x), 3.0f) + pow(abs(coord.y), 3.0f), 1.0f/3.0f);'
        default: return 'distance = length(coord);'
      }
    })()}
    
    // Step 5: Curve Scaling
    distance *= ${params['curve-scaling'].toFixed(6)}f;
    
    // Step 6: Distance → Index (0-255)
    let curveIndex = clamp(floor(distance * 255.0f), 0.0f, 255.0f);
    
    // Step 7: Curve Array Lookup
    let texCoord = vec2f(curveIndex / 255.0f, 0.5f);
    let curveValue = textureSample(curveTexture, curveSampler, texCoord).r;
    
    // Step 8: Checkerboard Pattern (applied to curve value)
    ${params['checkerboard-pattern'] && params['checkerboard-steps'] > 0 ? `
    let checker = floor(distance / ${params['checkerboard-steps'].toFixed(1)}f);
    if (checker % 2.0f > 0.5f) {
        curveValue = 1.0f - curveValue;
    }
    ` : ''}
    
    return vec2f(curveIndex, curveValue);
}`;
}
