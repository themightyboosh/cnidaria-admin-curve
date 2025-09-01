/**
 * WebGPU Service
 * Central service for managing all WebGPU operations
 * Integrates coordinate noise, matrix sorting, and image generation
 */

import { 
  WebGPUCoordinateNoise, 
  createWebGPUCoordinateNoise,
  type GPUCoordinateNoiseResult
} from '../utils/webgpuCoordinateNoise';
import { 
  WebGPUMatrixSort, 
  createWebGPUMatrixSort,
  type GPUMatrixSortResult
} from '../utils/webgpuMatrixSort';
import { 
  WebGPUImageGenerator, 
  createWebGPUImageGenerator,
  type WebGPUImageGenerationParams,
  type WebGPUImageResult
} from '../utils/webgpuImageGeneration';
import { getWebGPUCapabilities } from '../utils/webgpuDetection';

// Local service types
export interface CurveData {
  'curve-data': number[];
  'curve-width': number;
  'curve-index-scaling': number;
  'coordinate-noise': string;
  'noise-calc': 'radial' | 'cartesian-x' | 'cartesian-y';
}

export interface PaletteColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface WebGPUServiceStats {
  coordinateNoiseTime: number;
  matrixSortTime: number;
  imageGenerationTime: number;
  totalTime: number;
  pixelsProcessed: number;
  gpuMemoryUsed: number;
}

// Re-export imported types for external use
export type { 
  GPUCoordinateNoiseResult,
  GPUMatrixSortResult,
  WebGPUImageGenerationParams,
  WebGPUImageResult
};

/**
 * WebGPU Service for coordinating all GPU operations
 */
export class WebGPUService {
  private coordinateNoiseProcessor: WebGPUCoordinateNoise | null = null;
  private matrixSorter: WebGPUMatrixSort | null = null;
  private imageGenerator: WebGPUImageGenerator | null = null;
  private currentGpuExpression: string = '';
  private currentNoiseCalc: 'radial' | 'cartesian-x' | 'cartesian-y' = 'radial';

  /**
   * Initialize WebGPU service with noise pattern
   */
  async initialize(
    gpuExpression: string, 
    noiseCalc: 'radial' | 'cartesian-x' | 'cartesian-y' = 'radial'
  ): Promise<void> {
    console.log('🚀 Initializing WebGPU Service...');
    
    const capabilities = await getWebGPUCapabilities();
    if (!capabilities.supported) {
      throw new Error('WebGPU is not supported');
    }

    // Clean up existing processors if pattern changed
    if (this.currentGpuExpression !== gpuExpression || this.currentNoiseCalc !== noiseCalc) {
      await this.cleanup();
    }

    // Initialize processors if needed
    if (!this.coordinateNoiseProcessor) {
      console.log('🔧 Creating coordinate noise processor...');
      this.coordinateNoiseProcessor = await createWebGPUCoordinateNoise(gpuExpression, noiseCalc);
    }

    if (!this.matrixSorter) {
      console.log('🔧 Creating matrix sorter...');
      this.matrixSorter = await createWebGPUMatrixSort();
    }

    if (!this.imageGenerator) {
      console.log('🔧 Creating image generator...');
      this.imageGenerator = await createWebGPUImageGenerator(gpuExpression, noiseCalc);
    }

    this.currentGpuExpression = gpuExpression;
    this.currentNoiseCalc = noiseCalc;

    console.log('✅ WebGPU Service initialized successfully');
  }

  /**
   * Process coordinates using GPU compute shaders
   */
  async processCoordinates(
    width: number,
    height: number,
    curve: CurveData,
    scale: number = 1.0,
    centerX: number = 0.0,
    centerY: number = 0.0
  ): Promise<GPUCoordinateNoiseResult> {
    if (!this.coordinateNoiseProcessor) {
      throw new Error('WebGPU Service not initialized');
    }

    console.log(`🔥 Processing coordinates: ${width}x${height} with ${curve['coordinate-noise']}`);
    
    return await this.coordinateNoiseProcessor.processCoordinates(
      width,
      height,
      curve['curve-data'],
      curve['curve-index-scaling'],
      scale,
      centerX,
      centerY
    );
  }

  /**
   * Sort matrix data by distance from center
   */
  async sortMatrixByDistance(
    coordinates: Float32Array,
    centerX: number = 0.0,
    centerY: number = 0.0
  ): Promise<GPUMatrixSortResult> {
    if (!this.matrixSorter) {
      throw new Error('WebGPU Service not initialized');
    }

    console.log(`🔥 Sorting ${coordinates.length / 2} points by distance from center`);
    
    return await this.matrixSorter.sortByDistanceFromCenter(coordinates, centerX, centerY);
  }

  /**
   * Sort arbitrary values array
   */
  async sortValues(
    values: Float32Array,
    ascending: boolean = true
  ): Promise<GPUMatrixSortResult> {
    if (!this.matrixSorter) {
      throw new Error('WebGPU Service not initialized');
    }

    console.log(`🔥 Sorting ${values.length} values (ascending: ${ascending})`);
    
    return await this.matrixSorter.sortValues(values, ascending);
  }

  /**
   * Generate complete image using GPU
   */
  async generateImage(
    curve: CurveData,
    palette: PaletteColor[],
    width: number = 512,
    height: number = 512,
    scale: number = 3.0,
    centerX: number = 0.0,
    centerY: number = 0.0,
    gpuExpression: string
  ): Promise<WebGPUImageResult> {
    if (!this.imageGenerator) {
      throw new Error('WebGPU Service not initialized');
    }

    console.log(`🔥 Generating ${width}x${height} image with ${curve['coordinate-noise']}`);
    
    const params: WebGPUImageGenerationParams = {
      curve,
      palette,
      width,
      height,
      scale,
      centerX,
      centerY,
      gpuExpression
    };

    return await this.imageGenerator.generateImage(params);
  }

  /**
   * Complete pipeline: process coordinates, sort, and generate image
   */
  async processCompleteImage(
    curve: CurveData,
    palette: PaletteColor[],
    gpuExpression: string,
    width: number = 512,
    height: number = 512,
    scale: number = 3.0,
    centerX: number = 0.0,
    centerY: number = 0.0,
    onProgress?: (stage: string, progress: number) => void
  ): Promise<{ 
    result: WebGPUImageResult; 
    stats: WebGPUServiceStats;
    sortedData: GPUMatrixSortResult;
    coordinatesData: GPUCoordinateNoiseResult;
  }> {
    const totalStartTime = performance.now();
    
    console.log('🚀 Starting complete WebGPU image processing pipeline...');
    
    // Ensure service is initialized for this pattern
    await this.initialize(gpuExpression, curve['noise-calc']);
    
    onProgress?.('Initializing GPU processing...', 0);

    // Stage 1: Process coordinates
    onProgress?.('Processing coordinates...', 10);
    const coordStartTime = performance.now();
    const coordinatesData = await this.processCoordinates(
      width, height, curve, scale, centerX, centerY
    );
    const coordinateNoiseTime = performance.now() - coordStartTime;
    
    onProgress?.('Sorting matrix data...', 40);
    
    // Stage 2: Sort coordinates by distance
    const sortStartTime = performance.now();
    const sortedData = await this.sortMatrixByDistance(
      coordinatesData.coordinates, centerX, centerY
    );
    const matrixSortTime = performance.now() - sortStartTime;
    
    onProgress?.('Generating final image...', 70);
    
    // Stage 3: Generate image
    const imageStartTime = performance.now();
    const result = await this.generateImage(
      curve, palette, width, height, scale, centerX, centerY, gpuExpression
    );
    const imageGenerationTime = performance.now() - imageStartTime;
    
    onProgress?.('Processing complete!', 100);
    
    const totalTime = performance.now() - totalStartTime;
    
    const stats: WebGPUServiceStats = {
      coordinateNoiseTime,
      matrixSortTime,
      imageGenerationTime,
      totalTime,
      pixelsProcessed: width * height,
      gpuMemoryUsed: this.estimateGPUMemoryUsage(width, height)
    };
    
    console.log('✅ Complete WebGPU pipeline finished:', stats);
    
    return {
      result,
      stats,
      sortedData,
      coordinatesData
    };
  }

  /**
   * Get GPU processing performance metrics
   */
  getPerformanceMetrics(): {
    isInitialized: boolean;
    currentPattern: string;
    currentNoiseCalc: string;
    memoryEstimate: string;
  } {
    return {
      isInitialized: !!(this.coordinateNoiseProcessor && this.matrixSorter && this.imageGenerator),
      currentPattern: this.currentGpuExpression,
      currentNoiseCalc: this.currentNoiseCalc,
      memoryEstimate: this.formatMemoryUsage(this.estimateGPUMemoryUsage(512, 512))
    };
  }

  /**
   * Estimate GPU memory usage for given image size
   */
  private estimateGPUMemoryUsage(width: number, height: number): number {
    const pixels = width * height;
    // Rough estimation:
    // - RGBA buffer: 4 bytes per pixel
    // - Value plane: 4 bytes per pixel
    // - Coordinates: 8 bytes per pixel (vec2<f32>)
    // - Staging buffers: double the above
    // - Curve data, palette, params: ~16KB
    return (pixels * (4 + 4 + 8) * 2) + 16384;
  }

  /**
   * Format memory usage for display
   */
  private formatMemoryUsage(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Check if service is ready for processing
   */
  isReady(): boolean {
    return !!(this.coordinateNoiseProcessor && this.matrixSorter && this.imageGenerator);
  }

  /**
   * Get current GPU expression and noise calculation
   */
  getCurrentConfiguration(): { gpuExpression: string; noiseCalc: string } {
    return {
      gpuExpression: this.currentGpuExpression,
      noiseCalc: this.currentNoiseCalc
    };
  }

  /**
   * Cleanup GPU resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up WebGPU Service...');
    
    if (this.coordinateNoiseProcessor) {
      this.coordinateNoiseProcessor.destroy();
      this.coordinateNoiseProcessor = null;
    }
    
    if (this.matrixSorter) {
      this.matrixSorter.destroy();
      this.matrixSorter = null;
    }
    
    if (this.imageGenerator) {
      this.imageGenerator.destroy();
      this.imageGenerator = null;
    }
    
    this.currentGpuExpression = '';
    this.currentNoiseCalc = 'radial';
    
    console.log('✅ WebGPU Service cleanup complete');
  }
}

// Global WebGPU service instance
let webgpuServiceInstance: WebGPUService | null = null;

/**
 * Get singleton WebGPU service instance
 */
export function getWebGPUService(): WebGPUService {
  if (!webgpuServiceInstance) {
    webgpuServiceInstance = new WebGPUService();
  }
  return webgpuServiceInstance;
}

/**
 * Initialize global WebGPU service
 */
export async function initializeWebGPUService(
  gpuExpression: string,
  noiseCalc: 'radial' | 'cartesian-x' | 'cartesian-y' = 'radial'
): Promise<WebGPUService> {
  const service = getWebGPUService();
  await service.initialize(gpuExpression, noiseCalc);
  return service;
}

/**
 * Cleanup global WebGPU service
 */
export async function cleanupWebGPUService(): Promise<void> {
  if (webgpuServiceInstance) {
    await webgpuServiceInstance.cleanup();
    webgpuServiceInstance = null;
  }
}
