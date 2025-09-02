/**
 * WebGPU Types Re-exports
 * Centralized export of all WebGPU-related types and interfaces
 */

// Coordinate Noise Types
export interface GPUCoordinateNoiseResult {
  coordinates: Float32Array;
  values: Float32Array;
  width: number;
  height: number;
  totalPixels: number;
}

// Matrix Sort Types  
export interface GPUMatrixSortResult {
  sortedValues: Float32Array;
  sortedIndices: Uint32Array;
  originalValues: Float32Array;
  length: number;
}

// Image Generation Types
export interface WebGPUImageGenerationParams {
  curve: {
    'curve-data': number[];
    'curve-width': number;
    'curve-index-scaling': number;
    'coordinate-noise': string;
    'curve-distance-calc': 'radial' | 'cartesian-x' | 'cartesian-y';
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

// Service Types
export interface WebGPUServiceStats {
  coordinateNoiseTime: number;
  matrixSortTime: number;
  imageGenerationTime: number;
  totalTime: number;
  pixelsProcessed: number;
  gpuMemoryUsed: number;
}

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
