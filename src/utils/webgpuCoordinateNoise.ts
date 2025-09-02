/**
 * WebGPU Coordinate Noise Processing
 * GPU-accelerated coordinate noise calculations using compute shaders
 */

import { getGPUConfig, getShaderConstants, calculateDispatchGroups } from './webgpuConfig';

export interface GPUCoordinateNoiseResult {
  coordinates: Float32Array;
  values: Float32Array;
  width: number;
  height: number;
  totalPixels: number;
}

/**
 * Generate WebGPU compute shader code for coordinate noise calculation
 */
function generateCoordinateNoiseShader(
  gpuExpression: string,
  noiseCalc: 'radial' | 'cartesian-x' | 'cartesian-y'
): string {
  // Validate and sanitize the GPU expression
  const sanitizedExpression = gpuExpression
    .replace(/Math\./g, '') // Remove Math. prefix if present
    .replace(/\batan\([^,)]+,\s*[^)]+\)/g, (match) => {
      // Convert atan(y, x) to atan2(y, x)
      return match.replace(/\batan\b/, 'atan2');
    })
    .replace(/\batan2\b/g, 'atan2') // Ensure atan2 is correct
    .replace(/\bpow\b/g, 'pow')
    .replace(/\bsqrt\b/g, 'sqrt')
    .replace(/\bsin\b/g, 'sin')
    .replace(/\bcos\b/g, 'cos')
    .replace(/\babs\b/g, 'abs')
    .replace(/\bfloor\b/g, 'floor')
    .replace(/\bmax\b/g, 'max')
    .replace(/\bmin\b/g, 'min');

  // Generate distance calculation based on noise-calc type (this is the DISTANCE calculation)
  let distanceCalculation: string;
  switch (noiseCalc) {
    case 'cartesian-x':
      distanceCalculation = 'let distance = abs(coord.x);';
      break;
    case 'cartesian-y':
      distanceCalculation = 'let distance = abs(coord.y);';
      break;
    case 'radial':
    default:
      distanceCalculation = 'let distance = sqrt(coord.x * coord.x + coord.y * coord.y);';
      break;
  }

  return `
// WebGPU Compute Shader for Coordinate Noise Processing
// Compatible with ≤256 invocations per workgroup

override WORKGROUP_X: u32 = 16;
override WORKGROUP_Y: u32 = 16;
override WORKGROUP_Z: u32 = 1;

@group(0) @binding(0) var<storage, read_write> coordinates: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> values: array<f32>;
@group(0) @binding(2) var<uniform> params: CoordinateParams;

struct CoordinateParams {
  width: u32,
  height: u32,
  scale: f32,
  center_x: f32,
  center_y: f32,
  curve_index_scaling: f32,
  curve_width: u32,
  padding: u32, // Ensure 16-byte alignment
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
  
  // Step 1: Calculate initial distance using noise-calc (distance calculation)
  let coord = vec2<f32>(world_x, world_y);
  ${distanceCalculation}
  
  // Step 2: Apply coordinate noise transformation (with distance available)
  let transformed_result = coordinate_noise_transform(coord, distance);
  let transformed_coord = transformed_result.coord;
  let final_distance = transformed_result.distance;
  
  // Apply curve index scaling using final distance and sample curve data
  let scaled_distance = final_distance * params.curve_index_scaling;
  let curve_index = u32(scaled_distance) % params.curve_width;
  let curve_value = curve_data[curve_index];
  
  // Store results
  coordinates[index] = transformed_coord;
  values[index] = curve_value;
}

// Result structure for coordinate transformation
struct CoordinateTransformResult {
  coord: vec2<f32>,
  distance: f32,
}

// Coordinate noise transformation function with distance input
fn coordinate_noise_transform(coord: vec2<f32>, distance: f32) -> CoordinateTransformResult {
  let x = coord.x;
  let y = coord.y;
  
  // Apply the coordinate noise expression (can use x, y, and distance)
  let noise_value = ${sanitizedExpression};
  
  // For 'none' pattern, just return original coordinates and distance
  if (noise_value == x) { // 'none' pattern returns x
    return CoordinateTransformResult(coord, distance);
  }
  
  // For other patterns, the noise_value IS the new distance
  // Calculate new coordinates that would produce this distance
  let angle = atan2(y, x);
  let new_x = noise_value * cos(angle);
  let new_y = noise_value * sin(angle);
  
  return CoordinateTransformResult(vec2<f32>(new_x, new_y), noise_value);
}
`;
}

/**
 * WebGPU Coordinate Noise Processor
 */
export class WebGPUCoordinateNoise {
  private device: GPUDevice;
  private computePipeline: GPUComputePipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  
  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Initialize compute pipeline for specific noise pattern
   */
  async initializePipeline(
    gpuExpression: string, 
    noiseCalc: 'radial' | 'cartesian-x' | 'cartesian-y' = 'radial'
  ): Promise<void> {
    const shaderCode = generateCoordinateNoiseShader(gpuExpression, noiseCalc);
    
    console.log('🔧 Creating WebGPU compute shader:', {
      gpuExpression,
      noiseCalc,
      shaderLength: shaderCode.length
    });

    // Create shader module
    const shaderModule = this.device.createShaderModule({
      label: `coordinate-noise-${noiseCalc}`,
      code: shaderCode
    });

    // Create bind group layout
    this.bindGroupLayout = this.device.createBindGroupLayout({
      label: 'coordinate-noise-bind-group-layout',
      entries: [
        // Coordinates buffer (read/write)
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' }
        },
        // Values buffer (read/write)
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' }
        },
        // Parameters uniform buffer
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' }
        },
        // Curve data buffer (read-only)
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' }
        }
      ]
    });

    // Create compute pipeline
    const pipelineLayout = this.device.createPipelineLayout({
      label: 'coordinate-noise-pipeline-layout',
      bindGroupLayouts: [this.bindGroupLayout]
    });

    this.computePipeline = this.device.createComputePipeline({
      label: 'coordinate-noise-pipeline',
      layout: pipelineLayout,
      compute: {
        module: shaderModule,
        entryPoint: 'main',
        constants: getShaderConstants()
      }
    });

    console.log('✅ WebGPU compute pipeline created successfully');
  }

  /**
   * Process coordinates using GPU compute shader
   */
  async processCoordinates(
    width: number,
    height: number,
    curveData: number[],
    curveIndexScaling: number,
    scale: number = 1.0,
    centerX: number = 0.0,
    centerY: number = 0.0
  ): Promise<GPUCoordinateNoiseResult> {
    if (!this.computePipeline || !this.bindGroupLayout) {
      throw new Error('Compute pipeline not initialized. Call initializePipeline() first.');
    }

    const totalPixels = width * height;
    console.log(`🔥 Processing ${totalPixels} pixels on GPU (${width}x${height})`);

    // Create buffers
    const coordinatesBuffer = this.device.createBuffer({
      label: 'coordinates-buffer',
      size: totalPixels * 2 * 4, // vec2<f32> = 2 * 4 bytes
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    const valuesBuffer = this.device.createBuffer({
      label: 'values-buffer',
      size: totalPixels * 4, // f32 = 4 bytes
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    // Parameters uniform buffer (must be 16-byte aligned)
    const paramsData = new ArrayBuffer(32); // 8 * 4 bytes with padding
    const paramsView = new DataView(paramsData);
    paramsView.setUint32(0, width, true);      // width
    paramsView.setUint32(4, height, true);     // height
    paramsView.setFloat32(8, scale, true);     // scale
    paramsView.setFloat32(12, centerX, true);  // center_x
    paramsView.setFloat32(16, centerY, true);  // center_y
    paramsView.setFloat32(20, curveIndexScaling, true); // curve_index_scaling
    paramsView.setUint32(24, curveData.length, true);   // curve_width
    paramsView.setUint32(28, 0, true);         // padding

    const paramsBuffer = this.device.createBuffer({
      label: 'params-buffer',
      size: paramsData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Curve data buffer
    const curveDataArray = new Float32Array(curveData);
    const curveDataBuffer = this.device.createBuffer({
      label: 'curve-data-buffer',
      size: curveDataArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    // Upload data to GPU
    this.device.queue.writeBuffer(paramsBuffer, 0, paramsData);
    this.device.queue.writeBuffer(curveDataBuffer, 0, curveDataArray);

    // Create bind group
    const bindGroup = this.device.createBindGroup({
      label: 'coordinate-noise-bind-group',
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: coordinatesBuffer } },
        { binding: 1, resource: { buffer: valuesBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } },
        { binding: 3, resource: { buffer: curveDataBuffer } }
      ]
    });

    // Dispatch compute shader
    const commandEncoder = this.device.createCommandEncoder({
      label: 'coordinate-noise-compute-encoder'
    });

    const computePass = commandEncoder.beginComputePass({
      label: 'coordinate-noise-compute-pass'
    });

    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, bindGroup);

    // Dispatch with configured workgroup size
    const groups = calculateDispatchGroups(width, height);
    computePass.dispatchWorkgroups(groups.x, groups.y, groups.z);
    computePass.end();

    // Create staging buffers for reading results
    const coordinatesStagingBuffer = this.device.createBuffer({
      label: 'coordinates-staging-buffer',
      size: coordinatesBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    const valuesStagingBuffer = this.device.createBuffer({
      label: 'values-staging-buffer',
      size: valuesBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    // Copy results to staging buffers
    commandEncoder.copyBufferToBuffer(coordinatesBuffer, 0, coordinatesStagingBuffer, 0, coordinatesBuffer.size);
    commandEncoder.copyBufferToBuffer(valuesBuffer, 0, valuesStagingBuffer, 0, valuesBuffer.size);

    // Submit commands
    this.device.queue.submit([commandEncoder.finish()]);

    // Read results
    await coordinatesStagingBuffer.mapAsync(GPUMapMode.READ);
    await valuesStagingBuffer.mapAsync(GPUMapMode.READ);

    const coordinatesData = new Float32Array(coordinatesStagingBuffer.getMappedRange());
    const valuesData = new Float32Array(valuesStagingBuffer.getMappedRange());

    // Copy data (mapped arrays become invalid after unmap)
    const coordinates = new Float32Array(coordinatesData);
    const values = new Float32Array(valuesData);

    coordinatesStagingBuffer.unmap();
    valuesStagingBuffer.unmap();

    // Cleanup GPU resources
    coordinatesBuffer.destroy();
    valuesBuffer.destroy();
    paramsBuffer.destroy();
    curveDataBuffer.destroy();
    coordinatesStagingBuffer.destroy();
    valuesStagingBuffer.destroy();

    console.log('✅ GPU coordinate processing complete');

    return {
      coordinates,
      values,
      width,
      height,
      totalPixels
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // WebGPU resources are garbage collected automatically
    this.computePipeline = null;
    this.bindGroupLayout = null;
    console.log('🧹 WebGPU coordinate noise processor destroyed');
  }
}

/**
 * Factory function to create WebGPU coordinate noise processor
 */
export async function createWebGPUCoordinateNoise(
  gpuExpression: string,
  noiseCalc: 'radial' | 'cartesian-x' | 'cartesian-y' = 'radial'
): Promise<WebGPUCoordinateNoise> {
  const config = getGPUConfig();
  
  if (!config.device) {
    throw new Error('WebGPU device is not available or not initialized');
  }

  const processor = new WebGPUCoordinateNoise(config.device);
  await processor.initializePipeline(gpuExpression, noiseCalc);
  
  return processor;
}
