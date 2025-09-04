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
import { getGPUConfig } from '../utils/webgpuConfig';

// Local service types
export interface CurveData {
  'curve-data': number[];
  'curve-width': number;
  'curve-index-scaling': number;
  'coordinate-noise': string;
  'curve-distance-calc': 'radial' | 'cartesian-x' | 'cartesian-y';
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
    
    const config = getGPUConfig();
    if (!config.device) {
      throw new Error('WebGPU device is not available');
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
   * NEW: Real-time grid processing optimized for interactive views
   * 
   * Optimized for smaller grids with faster processing times
   * Perfect for 128x128 grids that need sub-100ms response times
   */
  async processGridCoordinates(
    curve: CurveData,
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    gpuExpression: string
  ): Promise<Map<string, { indexValue: number; indexPosition: number }>> {
    const width = bounds.maxX - bounds.minX + 1
    const height = bounds.maxY - bounds.minY + 1
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2

    console.log(`🔥 Real-time grid processing: ${width}×${height} grid, center: (${centerX}, ${centerY})`)
    
    // Ensure service is initialized for this curve's settings
    const distanceCalc = curve['curve-distance-calc'] || 'radial'
    await this.initialize(gpuExpression, distanceCalc)

    // Process coordinates
    const result = await this.processCoordinates(width, height, curve, 1.0, centerX, centerY)

    // Convert to grid coordinate format
    const gridResults = new Map<string, { indexValue: number; indexPosition: number }>()
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x
        const worldX = bounds.minX + x
        const worldY = bounds.minY + y
        const key = `${worldX}_${worldY}`
        
        const indexValue = Math.round(result.values[index])
        const indexPosition = Math.floor((result.coordinates[index * 2] + result.coordinates[index * 2 + 1]) * curve['curve-index-scaling']) % curve['curve-width']
        
        gridResults.set(key, { indexValue, indexPosition })
      }
    }

    console.log(`✅ Real-time grid processing complete: ${gridResults.size} coordinates`)
    return gridResults
  }

  /**
   * NEW: Streaming/chunked processing for large datasets
   * 
   * Processes coordinates in chunks to avoid blocking the main thread
   * Useful for very large grids or background processing
   */
  async processGridStreaming(
    curve: CurveData,
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    gpuExpression: string,
    chunkSize: number = 64,
    onChunkComplete?: (chunk: Map<string, { indexValue: number; indexPosition: number }>) => void
  ): Promise<Map<string, { indexValue: number; indexPosition: number }>> {
    const width = bounds.maxX - bounds.minX + 1
    const height = bounds.maxY - bounds.minY + 1
    const totalCoordinates = width * height

    console.log(`🌊 Streaming grid processing: ${width}×${height} in ${chunkSize}×${chunkSize} chunks`)

    const allResults = new Map<string, { indexValue: number; indexPosition: number }>()
    let processedChunks = 0
    const totalChunks = Math.ceil(width / chunkSize) * Math.ceil(height / chunkSize)

    // Process in chunks
    for (let chunkY = bounds.minY; chunkY <= bounds.maxY; chunkY += chunkSize) {
      for (let chunkX = bounds.minX; chunkX <= bounds.maxX; chunkX += chunkSize) {
        const chunkBounds = {
          minX: chunkX,
          maxX: Math.min(chunkX + chunkSize - 1, bounds.maxX),
          minY: chunkY,
          maxY: Math.min(chunkY + chunkSize - 1, bounds.maxY)
        }

        // Process this chunk
        const chunkResults = await this.processGridCoordinates(curve, chunkBounds, gpuExpression)
        
        // Add to overall results
        chunkResults.forEach((value, key) => {
          allResults.set(key, value)
        })

        processedChunks++
        console.log(`🌊 Processed chunk ${processedChunks}/${totalChunks}: ${chunkResults.size} coordinates`)

        // Notify chunk completion
        if (onChunkComplete) {
          onChunkComplete(chunkResults)
        }

        // Small delay to avoid blocking main thread
        await new Promise(resolve => setTimeout(resolve, 1))
      }
    }

    console.log(`✅ Streaming processing complete: ${allResults.size} total coordinates`)
    return allResults
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
    await this.initialize(gpuExpression, curve['curve-distance-calc']);
    
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
