/**
 * WebGPU Matrix Sorting
 * GPU-accelerated sorting of distance matrices from nearest to farthest
 * Uses bitonic sort algorithm optimized for GPU parallel processing
 */

import { getWebGPUCapabilities } from './webgpuDetection';

export interface GPUMatrixSortResult {
  sortedValues: Float32Array;
  sortedIndices: Uint32Array;
  originalValues: Float32Array;
  length: number;
}

/**
 * Generate WebGPU compute shader for bitonic sort
 * Bitonic sort is ideal for GPU because it has a fixed comparison pattern
 */
function generateBitonicSortShader(): string {
  return `
// WebGPU Bitonic Sort Compute Shader
@group(0) @binding(0) var<storage, read_write> values: array<f32>;
@group(0) @binding(1) var<storage, read_write> indices: array<u32>;
@group(0) @binding(2) var<uniform> params: SortParams;

struct SortParams {
  length: u32,
  stage: u32,
  step: u32,
  ascending: u32, // 1 for ascending (nearest to farthest), 0 for descending
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  
  if (index >= params.length) {
    return;
  }
  
  // Calculate comparison partner for bitonic sort
  let step_size = 1u << params.step;
  let stage_size = 1u << params.stage;
  
  // Determine if this thread should participate in this step
  if (index % (step_size * 2u) >= step_size) {
    return;
  }
  
  let partner = index + step_size;
  if (partner >= params.length) {
    return;
  }
  
  // Determine sort direction for this stage
  let ascending = ((index / stage_size) % 2u) == (params.ascending % 2u);
  
  // Compare and swap if necessary
  let should_swap = if (ascending) {
    values[index] > values[partner]
  } else {
    values[index] < values[partner]
  };
  
  if (should_swap) {
    // Swap values
    let temp_value = values[index];
    values[index] = values[partner];
    values[partner] = temp_value;
    
    // Swap indices
    let temp_index = indices[index];
    indices[index] = indices[partner];
    indices[partner] = temp_index;
  }
}
`;
}

/**
 * Generate compute shader for radial distance calculation
 */
function generateDistanceCalculationShader(): string {
  return `
// WebGPU Distance Calculation Compute Shader
@group(0) @binding(0) var<storage, read_write> distances: array<f32>;
@group(0) @binding(1) var<storage, read_write> indices: array<u32>;
@group(0) @binding(2) var<storage, read> coordinates: array<vec2<f32>>;
@group(0) @binding(3) var<uniform> params: DistanceParams;

struct DistanceParams {
  length: u32,
  center_x: f32,
  center_y: f32,
  padding: u32, // Ensure 16-byte alignment
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  
  if (index >= params.length) {
    return;
  }
  
  // Calculate distance from center
  let coord = coordinates[index];
  let dx = coord.x - params.center_x;
  let dy = coord.y - params.center_y;
  let distance = sqrt(dx * dx + dy * dy);
  
  // Store distance and initialize index
  distances[index] = distance;
  indices[index] = index;
}
`;
}

/**
 * WebGPU Matrix Sorter using Bitonic Sort algorithm
 */
export class WebGPUMatrixSort {
  private device: GPUDevice;
  private sortPipeline: GPUComputePipeline | null = null;
  private distancePipeline: GPUComputePipeline | null = null;
  private sortBindGroupLayout: GPUBindGroupLayout | null = null;
  private distanceBindGroupLayout: GPUBindGroupLayout | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Initialize compute pipelines for sorting and distance calculation
   */
  async initializePipelines(): Promise<void> {
    console.log('🔧 Creating WebGPU matrix sort pipelines...');

    // Create sort shader
    const sortShaderModule = this.device.createShaderModule({
      label: 'bitonic-sort-shader',
      code: generateBitonicSortShader()
    });

    // Create distance calculation shader
    const distanceShaderModule = this.device.createShaderModule({
      label: 'distance-calculation-shader',
      code: generateDistanceCalculationShader()
    });

    // Create bind group layouts
    this.sortBindGroupLayout = this.device.createBindGroupLayout({
      label: 'sort-bind-group-layout',
      entries: [
        // Values buffer
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' }
        },
        // Indices buffer
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' }
        },
        // Parameters uniform
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' }
        }
      ]
    });

    this.distanceBindGroupLayout = this.device.createBindGroupLayout({
      label: 'distance-bind-group-layout',
      entries: [
        // Distances buffer
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' }
        },
        // Indices buffer
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' }
        },
        // Coordinates buffer
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' }
        },
        // Parameters uniform
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' }
        }
      ]
    });

    // Create compute pipelines
    this.sortPipeline = this.device.createComputePipeline({
      label: 'bitonic-sort-pipeline',
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.sortBindGroupLayout]
      }),
      compute: {
        module: sortShaderModule,
        entryPoint: 'main'
      }
    });

    this.distancePipeline = this.device.createComputePipeline({
      label: 'distance-calculation-pipeline',
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.distanceBindGroupLayout]
      }),
      compute: {
        module: distanceShaderModule,
        entryPoint: 'main'
      }
    });

    console.log('✅ WebGPU matrix sort pipelines created successfully');
  }

  /**
   * Calculate distances from coordinates and sort nearest to farthest
   */
  async sortByDistanceFromCenter(
    coordinates: Float32Array,
    centerX: number = 0.0,
    centerY: number = 0.0
  ): Promise<GPUMatrixSortResult> {
    if (!this.sortPipeline || !this.distancePipeline || !this.sortBindGroupLayout || !this.distanceBindGroupLayout) {
      throw new Error('Pipelines not initialized. Call initializePipelines() first.');
    }

    const length = coordinates.length / 2; // coordinates are vec2
    const paddedLength = this.nextPowerOfTwo(length);
    
    console.log(`🔥 GPU sorting ${length} points by distance from center (${centerX}, ${centerY})`);
    console.log(`📏 Padded to ${paddedLength} for bitonic sort`);

    // Create buffers
    const coordinatesBuffer = this.device.createBuffer({
      label: 'coordinates-buffer',
      size: paddedLength * 2 * 4, // vec2<f32>
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    const distancesBuffer = this.device.createBuffer({
      label: 'distances-buffer',
      size: paddedLength * 4, // f32
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    const indicesBuffer = this.device.createBuffer({
      label: 'indices-buffer',
      size: paddedLength * 4, // u32
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    // Prepare padded coordinate data
    const paddedCoordinates = new Float32Array(paddedLength * 2);
    paddedCoordinates.set(coordinates);
    // Fill padding with far away coordinates so they sort to the end
    for (let i = length * 2; i < paddedLength * 2; i += 2) {
      paddedCoordinates[i] = 1e6;     // x
      paddedCoordinates[i + 1] = 1e6; // y
    }

    // Upload coordinate data
    this.device.queue.writeBuffer(coordinatesBuffer, 0, paddedCoordinates);

    // Step 1: Calculate distances
    const distanceParamsData = new ArrayBuffer(16);
    const distanceParamsView = new DataView(distanceParamsData);
    distanceParamsView.setUint32(0, paddedLength, true); // length
    distanceParamsView.setFloat32(4, centerX, true);     // center_x
    distanceParamsView.setFloat32(8, centerY, true);     // center_y
    distanceParamsView.setUint32(12, 0, true);           // padding

    const distanceParamsBuffer = this.device.createBuffer({
      label: 'distance-params-buffer',
      size: distanceParamsData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.device.queue.writeBuffer(distanceParamsBuffer, 0, distanceParamsData);

    const distanceBindGroup = this.device.createBindGroup({
      label: 'distance-bind-group',
      layout: this.distanceBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: distancesBuffer } },
        { binding: 1, resource: { buffer: indicesBuffer } },
        { binding: 2, resource: { buffer: coordinatesBuffer } },
        { binding: 3, resource: { buffer: distanceParamsBuffer } }
      ]
    });

    // Dispatch distance calculation
    const commandEncoder = this.device.createCommandEncoder({
      label: 'matrix-sort-encoder'
    });

    let computePass = commandEncoder.beginComputePass({
      label: 'distance-calculation-pass'
    });

    computePass.setPipeline(this.distancePipeline);
    computePass.setBindGroup(0, distanceBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(paddedLength / 256));
    computePass.end();

    // Step 2: Bitonic sort
    const stages = Math.log2(paddedLength);
    
    for (let stage = 0; stage < stages; stage++) {
      for (let step = stage; step >= 0; step--) {
        const sortParamsData = new ArrayBuffer(16);
        const sortParamsView = new DataView(sortParamsData);
        sortParamsView.setUint32(0, paddedLength, true); // length
        sortParamsView.setUint32(4, stage, true);        // stage
        sortParamsView.setUint32(8, step, true);         // step
        sortParamsView.setUint32(12, 1, true);           // ascending (nearest to farthest)

        const sortParamsBuffer = this.device.createBuffer({
          label: `sort-params-buffer-${stage}-${step}`,
          size: sortParamsData.byteLength,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.device.queue.writeBuffer(sortParamsBuffer, 0, sortParamsData);

        const sortBindGroup = this.device.createBindGroup({
          label: `sort-bind-group-${stage}-${step}`,
          layout: this.sortBindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: distancesBuffer } },
            { binding: 1, resource: { buffer: indicesBuffer } },
            { binding: 2, resource: { buffer: sortParamsBuffer } }
          ]
        });

        computePass = commandEncoder.beginComputePass({
          label: `sort-pass-${stage}-${step}`
        });

        computePass.setPipeline(this.sortPipeline);
        computePass.setBindGroup(0, sortBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(paddedLength / 256));
        computePass.end();

        // Clean up temporary buffer
        sortParamsBuffer.destroy();
      }
    }

    // Create staging buffers for reading results
    const distancesStagingBuffer = this.device.createBuffer({
      label: 'distances-staging-buffer',
      size: distancesBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    const indicesStagingBuffer = this.device.createBuffer({
      label: 'indices-staging-buffer',
      size: indicesBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    // Copy results to staging buffers
    commandEncoder.copyBufferToBuffer(distancesBuffer, 0, distancesStagingBuffer, 0, distancesBuffer.size);
    commandEncoder.copyBufferToBuffer(indicesBuffer, 0, indicesStagingBuffer, 0, indicesBuffer.size);

    // Submit all commands
    this.device.queue.submit([commandEncoder.finish()]);

    // Read results
    await distancesStagingBuffer.mapAsync(GPUMapMode.READ);
    await indicesStagingBuffer.mapAsync(GPUMapMode.READ);

    const sortedDistances = new Float32Array(distancesStagingBuffer.getMappedRange());
    const sortedIndicesData = new Uint32Array(indicesStagingBuffer.getMappedRange());

    // Copy data and trim to original length
    const sortedValues = new Float32Array(sortedDistances.slice(0, length));
    const sortedIndices = new Uint32Array(sortedIndicesData.slice(0, length));
    const originalValues = new Float32Array(coordinates);

    distancesStagingBuffer.unmap();
    indicesStagingBuffer.unmap();

    // Cleanup GPU resources
    coordinatesBuffer.destroy();
    distancesBuffer.destroy();
    indicesBuffer.destroy();
    distanceParamsBuffer.destroy();
    distancesStagingBuffer.destroy();
    indicesStagingBuffer.destroy();

    console.log('✅ GPU matrix sort complete');

    return {
      sortedValues,
      sortedIndices,
      originalValues,
      length
    };
  }

  /**
   * Sort arbitrary values array (pre-calculated distances)
   */
  async sortValues(values: Float32Array, ascending: boolean = true): Promise<GPUMatrixSortResult> {
    if (!this.sortPipeline || !this.sortBindGroupLayout) {
      throw new Error('Sort pipeline not initialized. Call initializePipelines() first.');
    }

    const length = values.length;
    const paddedLength = this.nextPowerOfTwo(length);
    
    console.log(`🔥 GPU sorting ${length} values (ascending: ${ascending})`);
    console.log(`📏 Padded to ${paddedLength} for bitonic sort`);

    // Create buffers
    const valuesBuffer = this.device.createBuffer({
      label: 'sort-values-buffer',
      size: paddedLength * 4, // f32
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });

    const indicesBuffer = this.device.createBuffer({
      label: 'sort-indices-buffer',
      size: paddedLength * 4, // u32
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    // Prepare padded data
    const paddedValues = new Float32Array(paddedLength);
    const paddedIndices = new Uint32Array(paddedLength);
    
    paddedValues.set(values);
    for (let i = 0; i < length; i++) {
      paddedIndices[i] = i;
    }
    
    // Fill padding with extreme values
    const paddingValue = ascending ? Number.MAX_VALUE : -Number.MAX_VALUE;
    for (let i = length; i < paddedLength; i++) {
      paddedValues[i] = paddingValue;
      paddedIndices[i] = i;
    }

    // Upload data
    this.device.queue.writeBuffer(valuesBuffer, 0, paddedValues);
    this.device.queue.writeBuffer(indicesBuffer, 0, paddedIndices);

    // Execute bitonic sort
    const commandEncoder = this.device.createCommandEncoder({
      label: 'values-sort-encoder'
    });

    const stages = Math.log2(paddedLength);
    
    for (let stage = 0; stage < stages; stage++) {
      for (let step = stage; step >= 0; step--) {
        const sortParamsData = new ArrayBuffer(16);
        const sortParamsView = new DataView(sortParamsData);
        sortParamsView.setUint32(0, paddedLength, true);    // length
        sortParamsView.setUint32(4, stage, true);           // stage
        sortParamsView.setUint32(8, step, true);            // step
        sortParamsView.setUint32(12, ascending ? 1 : 0, true); // ascending

        const sortParamsBuffer = this.device.createBuffer({
          label: `values-sort-params-${stage}-${step}`,
          size: sortParamsData.byteLength,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.device.queue.writeBuffer(sortParamsBuffer, 0, sortParamsData);

        const sortBindGroup = this.device.createBindGroup({
          label: `values-sort-bind-group-${stage}-${step}`,
          layout: this.sortBindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: valuesBuffer } },
            { binding: 1, resource: { buffer: indicesBuffer } },
            { binding: 2, resource: { buffer: sortParamsBuffer } }
          ]
        });

        const computePass = commandEncoder.beginComputePass({
          label: `values-sort-pass-${stage}-${step}`
        });

        computePass.setPipeline(this.sortPipeline);
        computePass.setBindGroup(0, sortBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(paddedLength / 256));
        computePass.end();

        sortParamsBuffer.destroy();
      }
    }

    // Read results
    const valuesStagingBuffer = this.device.createBuffer({
      label: 'values-staging-buffer',
      size: valuesBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    const indicesStagingBuffer = this.device.createBuffer({
      label: 'indices-staging-buffer',
      size: indicesBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    commandEncoder.copyBufferToBuffer(valuesBuffer, 0, valuesStagingBuffer, 0, valuesBuffer.size);
    commandEncoder.copyBufferToBuffer(indicesBuffer, 0, indicesStagingBuffer, 0, indicesBuffer.size);

    this.device.queue.submit([commandEncoder.finish()]);

    await valuesStagingBuffer.mapAsync(GPUMapMode.READ);
    await indicesStagingBuffer.mapAsync(GPUMapMode.READ);

    const sortedValuesData = new Float32Array(valuesStagingBuffer.getMappedRange());
    const sortedIndicesData = new Uint32Array(indicesStagingBuffer.getMappedRange());

    const sortedValues = new Float32Array(sortedValuesData.slice(0, length));
    const sortedIndices = new Uint32Array(sortedIndicesData.slice(0, length));
    const originalValues = new Float32Array(values);

    valuesStagingBuffer.unmap();
    indicesStagingBuffer.unmap();

    // Cleanup
    valuesBuffer.destroy();
    indicesBuffer.destroy();
    valuesStagingBuffer.destroy();
    indicesStagingBuffer.destroy();

    console.log('✅ GPU values sort complete');

    return {
      sortedValues,
      sortedIndices,
      originalValues,
      length
    };
  }

  /**
   * Find next power of two (required for bitonic sort)
   */
  private nextPowerOfTwo(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.sortPipeline = null;
    this.distancePipeline = null;
    this.sortBindGroupLayout = null;
    this.distanceBindGroupLayout = null;
    console.log('🧹 WebGPU matrix sort destroyed');
  }
}

/**
 * Factory function to create WebGPU matrix sorter
 */
export async function createWebGPUMatrixSort(): Promise<WebGPUMatrixSort> {
  const capabilities = await getWebGPUCapabilities();
  
  if (!capabilities.supported || !capabilities.device) {
    throw new Error('WebGPU is not available or not initialized');
  }

  const sorter = new WebGPUMatrixSort(capabilities.device);
  await sorter.initializePipelines();
  
  return sorter;
}
