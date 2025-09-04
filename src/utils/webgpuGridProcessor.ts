/**
 * WebGPU Grid Processor
 * 
 * Optimized WebGPU compute shaders specifically for real-time grid processing.
 * Designed for smaller grids (128x128) with sub-100ms response times.
 * 
 * Part of Phase 3.1: WebGPU Service Enhancement
 */

/**
 * Generate optimized compute shader for real-time grid processing
 * Optimized for smaller workgroup sizes and faster dispatch
 */
export function generateGridProcessingShader(
  gpuExpression: string,
  distanceCalc: 'radial' | 'cartesian-x' | 'cartesian-y'
): string {
  
  // Sanitize GPU expression for shader
  // NOTE: Database expressions use bare function names that work in WGSL shaders
  // No replacement needed for WebGPU - WGSL supports sqrt, abs, max, min natively
  const sanitizedExpression = gpuExpression

  // Distance calculation based on curve-distance-calc
  let initialDistanceCalculation: string
  switch (distanceCalc) {
    case 'cartesian-x':
      initialDistanceCalculation = 'let initial_distance = abs(coord.x);'
      break
    case 'cartesian-y':
      initialDistanceCalculation = 'let initial_distance = abs(coord.y);'
      break
    case 'radial':
    default:
      initialDistanceCalculation = 'let initial_distance = sqrt(coord.x * coord.x + coord.y * coord.y);'
      break
  }

  // Final distance calculation (after noise transformation)
  let finalDistanceCalculation: string
  switch (distanceCalc) {
    case 'cartesian-x':
      finalDistanceCalculation = 'final_distance = abs(transformed_coord.x);'
      break
    case 'cartesian-y':
      finalDistanceCalculation = 'final_distance = abs(transformed_coord.y);'
      break
    case 'radial':
    default:
      finalDistanceCalculation = 'final_distance = sqrt(transformed_coord.x * transformed_coord.x + transformed_coord.y * transformed_coord.y);'
      break
  }

  return `
// WebGPU Grid Processing Compute Shader - Optimized for Real-Time
// Smaller workgroups for faster dispatch and lower latency

override WORKGROUP_X: u32 = 8;
override WORKGROUP_Y: u32 = 8;
override WORKGROUP_Z: u32 = 1;

@group(0) @binding(0) var<storage, read_write> coordinates: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> values: array<f32>;
@group(0) @binding(2) var<uniform> params: GridParams;

struct GridParams {
  width: u32,
  height: u32,
  scale: f32,
  center_x: f32,
  center_y: f32,
  curve_index_scaling: f32,
  curve_width: u32,
  distance_modulus: f32, // NEW: Support for distance-modulus
}

@group(0) @binding(3) var<storage, read> curve_data: array<f32>;

@compute @workgroup_size(WORKGROUP_X, WORKGROUP_Y, WORKGROUP_Z)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let x = global_id.x;
  let y = global_id.y;
  
  if (x >= params.width || y >= params.height) {
    return;
  }
  
  let index = y * params.width + x;
  
  // Convert pixel coordinates to world coordinates
  let world_x = (f32(x) - f32(params.width) * 0.5) * params.scale + params.center_x;
  let world_y = (f32(y) - f32(params.height) * 0.5) * params.scale + params.center_y;
  
  // Step 1: Calculate initial distance using curve-distance-calc
  let coord = vec2<f32>(world_x, world_y);
  ${initialDistanceCalculation}
  
  // Step 2: Apply coordinate noise transformation (with distance as input)
  let transformed_coord = coordinate_noise_transform(coord, initial_distance);
  
  // Step 3: Calculate final distance from transformed coordinates
  var final_distance: f32;
  ${finalDistanceCalculation}
  
  // Step 4: Apply distance-modulus if specified
  if (params.distance_modulus > 0.0) {
    final_distance = final_distance % params.distance_modulus;
  }
  
  // Step 5: Apply curve index scaling and get curve index
  let scaled_distance = final_distance * params.curve_index_scaling;
  let curve_index = u32(scaled_distance) % params.curve_width;
  
  // Step 6: Lookup curve value
  let curve_value = curve_data[curve_index];
  
  // Store results
  coordinates[index] = transformed_coord;
  values[index] = curve_value;
}

// Coordinate noise transformation function with distance input
fn coordinate_noise_transform(coord: vec2<f32>, distance: f32) -> vec2<f32> {
  let x = coord.x;
  let y = coord.y;
  
  // Apply the coordinate noise expression (can use x, y, and distance)
  let noise_value = ${sanitizedExpression};
  
  // For now, return original coordinates (noise transformation can be enhanced)
  // TODO: Implement actual coordinate transformation based on noise_value
  return coord;
}
`;
}

/**
 * Calculate optimal dispatch groups for grid processing
 * Optimized for smaller grids and faster response times
 */
export function calculateGridDispatchGroups(width: number, height: number): { x: number; y: number; z: number } {
  const WORKGROUP_SIZE = 8 // Smaller workgroups for lower latency
  
  return {
    x: Math.ceil(width / WORKGROUP_SIZE),
    y: Math.ceil(height / WORKGROUP_SIZE), 
    z: 1
  }
}

/**
 * Grid processing performance metrics
 */
export interface GridProcessingStats {
  /** Grid dimensions */
  width: number
  height: number
  /** Total coordinates processed */
  totalCoordinates: number
  /** Processing time in milliseconds */
  processingTime: number
  /** Coordinates per second */
  coordinatesPerSecond: number
  /** Memory usage estimate */
  memoryUsage: number
  /** WebGPU workgroup configuration */
  workgroups: { x: number; y: number; z: number }
}
