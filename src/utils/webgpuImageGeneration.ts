/**
 * WebGPU Image Generation
 * GPU-accelerated PNG image generation replacing Web Worker implementation
 * Processes 512x512 images at 300% zoom using compute shaders
 */

import { getGPUConfig, getShaderConstants, calculateDispatchGroups } from './webgpuConfig';

export interface WebGPUImageGenerationParams {
  curve: {
    'curve-data': number[];
    'curve-width': number;
    'curve-index-scaling': number;
    'coordinate-noise': string;
    'noise-calc': 'radial' | 'cartesian-x' | 'cartesian-y';
  };
  palette: Array<{ r: number; g: number; b: number; a?: number }>;
  width: number;
  height: number;
  scale: number;
  centerX: number;
  centerY: number;
  gpuExpression: string;
}

export interface WebGPUImageResult {
  imageData: ImageData;
  rgbaData: Uint8ClampedArray;
  valuePlane: Float32Array;
  coordinatesData: Float32Array;
  processingTime: number;
}

/**
 * Generate WebGPU compute shader for complete image processing
 * Combines coordinate noise, curve sampling, and color mapping in one pass
 */
function generateImageGenerationShader(
  gpuExpression: string,
  noiseCalc: 'radial' | 'cartesian-x' | 'cartesian-y'
): string {
  // Sanitize GPU expression
  const sanitizedExpression = gpuExpression
    .replace(/Math\./g, '')
    .replace(/\batan2\b/g, 'atan2')
    .replace(/\bpow\b/g, 'pow')
    .replace(/\bsqrt\b/g, 'sqrt')
    .replace(/\bsin\b/g, 'sin')
    .replace(/\bcos\b/g, 'cos')
    .replace(/\babs\b/g, 'abs')
    .replace(/\bfloor\b/g, 'floor')
    .replace(/\bmax\b/g, 'max')
    .replace(/\bmin\b/g, 'min');

  // Generate noise calculation
  let noiseCalculation: string;
  switch (noiseCalc) {
    case 'cartesian-x':
      noiseCalculation = 'let noise_result = abs(warped_coord.x);';
      break;
    case 'cartesian-y':
      noiseCalculation = 'let noise_result = abs(warped_coord.y);';
      break;
    case 'radial':
    default:
      noiseCalculation = 'let noise_result = sqrt(warped_coord.x * warped_coord.x + warped_coord.y * warped_coord.y);';
      break;
  }

  return `
// WebGPU Image Generation Compute Shader - Compatible with ≤256 invocations
enable f16;

override WORKGROUP_X: u32 = 16;
override WORKGROUP_Y: u32 = 16;
override WORKGROUP_Z: u32 = 1;

@group(0) @binding(0) var<storage, read_write> rgba_output: array<u32>;
@group(0) @binding(1) var<storage, read_write> value_plane: array<f32>;
@group(0) @binding(2) var<storage, read_write> coordinates_output: array<vec2<f32>>;
@group(0) @binding(3) var<uniform> params: ImageParams;
@group(0) @binding(4) var<storage, read> curve_data: array<f32>;
@group(0) @binding(5) var<storage, read> palette_data: array<vec4<u32>>; // RGBA as u32 components

struct ImageParams {
  width: u32,
  height: u32,
  scale: f32,
  center_x: f32,
  center_y: f32,
  curve_index_scaling: f32,
  curve_width: u32,
  warp_strength: f32,
}

@compute @workgroup_size(WORKGROUP_X, WORKGROUP_Y, WORKGROUP_Z)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let x = global_id.x;
  let y = global_id.y;
  
  if (x >= params.width || y >= params.height) {
    return;
  }
  
  let pixel_index = y * params.width + x;
  
  // Convert pixel coordinates to world coordinates
  let world_x = (f32(x) - f32(params.width) * 0.5) * params.scale + params.center_x;
  let world_y = (f32(y) - f32(params.height) * 0.5) * params.scale + params.center_y;
  
  // Apply coordinate noise transformation
  let coord = vec2<f32>(world_x, world_y);
  let warped_coord = coordinate_noise_transform(coord);
  
  // Store transformed coordinates
  coordinates_output[pixel_index] = warped_coord;
  
  // Calculate noise-based distance/value
  ${noiseCalculation}
  
  // Apply curve index scaling and sample curve data
  let scaled_distance = noise_result * params.curve_index_scaling;
  
  // Handle curve wrapping
  let curve_index_float = scaled_distance % f32(params.curve_width);
  let curve_index = u32(curve_index_float);
  let safe_curve_index = clamp(curve_index, 0u, params.curve_width - 1u);
  
  let curve_value = curve_data[safe_curve_index];
  let palette_index = u32(clamp(curve_value, 0.0, f32(arrayLength(&palette_data) - 1u)));
  
  // Store curve value
  value_plane[pixel_index] = curve_value;
  
  // Get color from palette
  let color = palette_data[palette_index];
  
  // Pack RGBA into single u32 for efficient storage
  // Format: 0xAABBGGRR (little endian)
  let packed_color = (color.w << 24u) | (color.z << 16u) | (color.y << 8u) | color.x;
  rgba_output[pixel_index] = packed_color;
}

// Coordinate noise transformation function
fn coordinate_noise_transform(coord: vec2<f32>) -> vec2<f32> {
  let x = coord.x;
  let y = coord.y;
  
  // Apply the GPU expression to get noise value
  let noise_value = ${sanitizedExpression};
  
  // Transform coordinates based on noise (warp effect)
  let warped_x = x + noise_value * params.warp_strength * cos(noise_value);
  let warped_y = y + noise_value * params.warp_strength * sin(noise_value);
  
  return vec2<f32>(warped_x, warped_y);
}
`;
}

/**
 * WebGPU Image Generator
 */
export class WebGPUImageGenerator {
  private device: GPUDevice;
  private computePipeline: GPUComputePipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  
  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Initialize compute pipeline for image generation
   */
  async initializePipeline(
    gpuExpression: string, 
    noiseCalc: 'radial' | 'cartesian-x' | 'cartesian-y' = 'radial'
  ): Promise<void> {
    const shaderCode = generateImageGenerationShader(gpuExpression, noiseCalc);
    
    console.log('🔧 Creating WebGPU image generation pipeline:', {
      gpuExpression,
      noiseCalc,
      shaderLength: shaderCode.length
    });

    // Create shader module
    const shaderModule = this.device.createShaderModule({
      label: `image-generation-${noiseCalc}`,
      code: shaderCode
    });

    // Create bind group layout
    this.bindGroupLayout = this.device.createBindGroupLayout({
      label: 'image-generation-bind-group-layout',
      entries: [
        // RGBA output buffer
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' }
        },
        // Value plane output
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' }
        },
        // Coordinates output
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' }
        },
        // Parameters uniform
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' }
        },
        // Curve data buffer
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' }
        },
        // Palette data buffer
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' }
        }
      ]
    });

    // Create compute pipeline
    const pipelineLayout = this.device.createPipelineLayout({
      label: 'image-generation-pipeline-layout',
      bindGroupLayouts: [this.bindGroupLayout]
    });

    this.computePipeline = this.device.createComputePipeline({
      label: 'image-generation-pipeline',
      layout: pipelineLayout,
      compute: {
        module: shaderModule,
        entryPoint: 'main',
        constants: getShaderConstants()
      }
    });

    console.log('✅ WebGPU image generation pipeline created successfully');
  }

  /**
   * Generate image using GPU compute shader
   */
  async generateImage(params: WebGPUImageGenerationParams): Promise<WebGPUImageResult> {
    if (!this.computePipeline || !this.bindGroupLayout) {
      throw new Error('Pipeline not initialized. Call initializePipeline() first.');
    }

    const startTime = performance.now();
    const { width, height, curve, palette, scale, centerX, centerY } = params;
    const totalPixels = width * height;
    
    console.log(`🔥 Generating ${width}x${height} image on GPU (${totalPixels} pixels)`);

    // Create output buffers
    const rgbaBuffer = this.device.createBuffer({
      label: 'rgba-output-buffer',
      size: totalPixels * 4, // u32 per pixel
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    const valuePlaneBuffer = this.device.createBuffer({
      label: 'value-plane-buffer',
      size: totalPixels * 4, // f32 per pixel
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    const coordinatesBuffer = this.device.createBuffer({
      label: 'coordinates-buffer',
      size: totalPixels * 2 * 4, // vec2<f32> per pixel
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    // Create parameters buffer
    const paramsData = new ArrayBuffer(32); // 8 * 4 bytes
    const paramsView = new DataView(paramsData);
    paramsView.setUint32(0, width, true);
    paramsView.setUint32(4, height, true);
    paramsView.setFloat32(8, scale, true);
    paramsView.setFloat32(12, centerX, true);
    paramsView.setFloat32(16, centerY, true);
    paramsView.setFloat32(20, curve['curve-index-scaling'], true);
    paramsView.setUint32(24, curve['curve-width'], true);
    paramsView.setFloat32(28, 0.1, true); // warp_strength

    const paramsBuffer = this.device.createBuffer({
      label: 'params-buffer',
      size: paramsData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Create curve data buffer
    const curveDataArray = new Float32Array(curve['curve-data']);
    const curveDataBuffer = this.device.createBuffer({
      label: 'curve-data-buffer',
      size: curveDataArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    // Create palette buffer (convert to u32 components)
    const paletteArray = new Uint32Array(palette.length * 4);
    for (let i = 0; i < palette.length; i++) {
      const color = palette[i];
      paletteArray[i * 4 + 0] = Math.max(0, Math.min(255, Math.round(color.r))); // R
      paletteArray[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(color.g))); // G
      paletteArray[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(color.b))); // B
      paletteArray[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(color.a ?? 255))); // A
    }

    const paletteBuffer = this.device.createBuffer({
      label: 'palette-buffer',
      size: paletteArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    // Upload data to GPU
    this.device.queue.writeBuffer(paramsBuffer, 0, paramsData);
    this.device.queue.writeBuffer(curveDataBuffer, 0, curveDataArray);
    this.device.queue.writeBuffer(paletteBuffer, 0, paletteArray);

    // Create bind group
    const bindGroup = this.device.createBindGroup({
      label: 'image-generation-bind-group',
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: rgbaBuffer } },
        { binding: 1, resource: { buffer: valuePlaneBuffer } },
        { binding: 2, resource: { buffer: coordinatesBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } },
        { binding: 4, resource: { buffer: curveDataBuffer } },
        { binding: 5, resource: { buffer: paletteBuffer } }
      ]
    });

    // Dispatch compute shader
    const commandEncoder = this.device.createCommandEncoder({
      label: 'image-generation-encoder'
    });

    const computePass = commandEncoder.beginComputePass({
      label: 'image-generation-pass'
    });

    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, bindGroup);

    // Dispatch with configured workgroup size
    const groups = calculateDispatchGroups(width, height);
    computePass.dispatchWorkgroups(groups.x, groups.y, groups.z);
    computePass.end();

    // Create staging buffers for reading results
    const rgbaStagingBuffer = this.device.createBuffer({
      label: 'rgba-staging-buffer',
      size: rgbaBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    const valuePlaneStagingBuffer = this.device.createBuffer({
      label: 'value-plane-staging-buffer',
      size: valuePlaneBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    const coordinatesStagingBuffer = this.device.createBuffer({
      label: 'coordinates-staging-buffer',
      size: coordinatesBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    // Copy results to staging buffers
    commandEncoder.copyBufferToBuffer(rgbaBuffer, 0, rgbaStagingBuffer, 0, rgbaBuffer.size);
    commandEncoder.copyBufferToBuffer(valuePlaneBuffer, 0, valuePlaneStagingBuffer, 0, valuePlaneBuffer.size);
    commandEncoder.copyBufferToBuffer(coordinatesBuffer, 0, coordinatesStagingBuffer, 0, coordinatesBuffer.size);

    // Submit commands
    this.device.queue.submit([commandEncoder.finish()]);

    // Read results from GPU
    await rgbaStagingBuffer.mapAsync(GPUMapMode.READ);
    await valuePlaneStagingBuffer.mapAsync(GPUMapMode.READ);
    await coordinatesStagingBuffer.mapAsync(GPUMapMode.READ);

    const packedRgbaData = new Uint32Array(rgbaStagingBuffer.getMappedRange());
    const valuePlaneData = new Float32Array(valuePlaneStagingBuffer.getMappedRange());
    const coordinatesData = new Float32Array(coordinatesStagingBuffer.getMappedRange());

    // Unpack RGBA data
    const rgbaData = new Uint8ClampedArray(totalPixels * 4);
    for (let i = 0; i < totalPixels; i++) {
      const packed = packedRgbaData[i];
      rgbaData[i * 4 + 0] = (packed >>> 0) & 0xFF;  // R
      rgbaData[i * 4 + 1] = (packed >>> 8) & 0xFF;  // G
      rgbaData[i * 4 + 2] = (packed >>> 16) & 0xFF; // B
      rgbaData[i * 4 + 3] = (packed >>> 24) & 0xFF; // A
    }

    // Copy data before unmapping
    const valuePlane = new Float32Array(valuePlaneData);
    const coordinates = new Float32Array(coordinatesData);
    const finalRgbaData = new Uint8ClampedArray(rgbaData);

    // Unmap staging buffers
    rgbaStagingBuffer.unmap();
    valuePlaneStagingBuffer.unmap();
    coordinatesStagingBuffer.unmap();

    // Create ImageData
    const imageData = new ImageData(finalRgbaData, width, height);

    // Cleanup GPU resources
    rgbaBuffer.destroy();
    valuePlaneBuffer.destroy();
    coordinatesBuffer.destroy();
    paramsBuffer.destroy();
    curveDataBuffer.destroy();
    paletteBuffer.destroy();
    rgbaStagingBuffer.destroy();
    valuePlaneStagingBuffer.destroy();
    coordinatesStagingBuffer.destroy();

    const processingTime = performance.now() - startTime;
    console.log(`✅ GPU image generation complete in ${processingTime.toFixed(2)}ms`);

    return {
      imageData,
      rgbaData: finalRgbaData,
      valuePlane,
      coordinatesData: coordinates,
      processingTime
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.computePipeline = null;
    this.bindGroupLayout = null;
    console.log('🧹 WebGPU image generator destroyed');
  }
}

/**
 * Factory function to create WebGPU image generator
 */
export async function createWebGPUImageGenerator(
  gpuExpression: string,
  noiseCalc: 'radial' | 'cartesian-x' | 'cartesian-y' = 'radial'
): Promise<WebGPUImageGenerator> {
  const config = getGPUConfig();
  
  if (!config.device) {
    throw new Error('WebGPU device is not available or not initialized');
  }

  const generator = new WebGPUImageGenerator(config.device);
  await generator.initializePipeline(gpuExpression, noiseCalc);
  
  return generator;
}
