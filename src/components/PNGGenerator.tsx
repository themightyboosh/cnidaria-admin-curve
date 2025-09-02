import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, useMemo } from 'react';
import * as UPNG from 'upng-js';
import { CONFIG, type Curve, type CoordinateNoise, type GenerationJob, type GenerationResult } from '../utils/mathPipeline';
import { getPaletteByName, getPaletteOptions, type PaletteColor } from '../utils/paletteUtils';
import { getWebGPUService, type WebGPUServiceStats } from '../services/webgpuService';
import { getWebGPUCapabilities } from '../utils/webgpuDetection';
import { getGPUConfig } from '../utils/webgpuConfig';
import LiquidViewport from './LiquidViewport';

// Extend Window interface for resize timeout
declare global {
  interface Window {
    resizeTimeout: number;
  }
}

// Hard-coded configuration values
const GENERATION_CONFIG = {
  IMAGE_SIZE: 512,
  WORKER_PATH: '/src/workers/imageGenerator.worker.ts',
  DOWNLOAD_FILENAME_PREFIX: 'cnidaria-curve',
  PROGRESS_UPDATE_INTERVAL: 262144 // Show progress every 262144 pixels (0x3FFFF) - ~1 update for 512x512
} as const;

interface PNGGeneratorProps {
  curve: Curve;
  coordinateNoise: CoordinateNoise;
  selectedPalette?: string;
  imageSize?: '32' | '64' | '128' | '256' | '512' | '1024' | '1:1';
  onError?: (error: string) => void;
  onNoiseCalcChange?: (noiseCalc: 'radial' | 'cartesian-x' | 'cartesian-y') => void;
}

interface GenerationProgress {
  done: number;
  total: number;
  percentage: number;
  stage: string;
}

interface WebGPUGenerationResult {
  rgba: Uint8ClampedArray;
  valuePlane: Float32Array;
  width: number;
  height: number;
  stats: WebGPUServiceStats;
}

const PNGGenerator = React.forwardRef<{ startGeneration: () => void }, PNGGeneratorProps>(({ 
  curve, 
  coordinateNoise, 
  selectedPalette: externalSelectedPalette = 'default',
  imageSize: externalImageSize = '512',
  onError, 
  onNoiseCalcChange 
}, ref) => {
  // Debug logging for props
  console.log('🔍 PNGGenerator render with props:', {
    hasCurve: !!curve,
    hasCoordinateNoise: !!coordinateNoise,
    curveName: curve?.['curve-name'],
    coordinateNoiseName: coordinateNoise?.name,
    selectedPalette: externalSelectedPalette,
    imageSize: externalImageSize
  });

  // State management
  const [selectedPalette, setSelectedPalette] = useState<string>(externalSelectedPalette);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress>({ done: 0, total: 0, percentage: 0 });
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [displaySize, setDisplaySize] = useState({ width: 512, height: 512 });
  const [lastGenerationParams, setLastGenerationParams] = useState<{
    curveId: string;
    noiseId: string;
    noiseCalc: string;
    palette: string;
    imageSize: number;
  } | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastResultRef = useRef<GenerationResult | null>(null);

  // Get palette options for dropdown
  const paletteOptions = getPaletteOptions();

  // Ensure WebGPU is ready for PNG generation
  useEffect(() => {
    const ensureWebGPU = async () => {
      try {
        // Initialize WebGPU capabilities first
        const capabilities = await getWebGPUCapabilities();
        if (!capabilities.supported) {
          onError?.('WebGPU is required but not available');
          return;
        }
        
        // GPU config should now be available
        console.log('🔧 WebGPU ready for PNG generation');
      } catch (error) {
        console.error('WebGPU initialization failed:', error);
        onError?.('WebGPU initialization failed');
      }
    };

    ensureWebGPU();
  }, [onError]);

  // Sync external palette prop with internal state
  useEffect(() => {
    setSelectedPalette(externalSelectedPalette);
  }, [externalSelectedPalette]);

  // Simple image size - just return what was requested
  const getImageSize = useCallback(() => {
    if (externalImageSize === '1:1') {
      return 512; // Default size for 1:1 mode
    }
    return parseInt(externalImageSize);
  }, [externalImageSize]);

  // Simple display size - just use the actual generated image size
  const getDisplaySize = useCallback(() => {
    const imageSize = getImageSize();
    return {
      width: imageSize,
      height: imageSize
    };
  }, [getImageSize]);

  // Update display size when image size changes or image is generated
  useEffect(() => {
    setDisplaySize(getDisplaySize());
  }, [getDisplaySize, generatedImage]);

  // Add window resize listener - for "1:1" mode regenerate, for others update display size
  useEffect(() => {
    const handleResize = () => {
      // Debounce resize events
      clearTimeout(window.resizeTimeout);
      window.resizeTimeout = setTimeout(() => {
        if (externalImageSize === '1:1' && !isGenerating) {
          console.log('🔄 Window resized - regenerating PNG to fit new size');
          // Force regeneration by clearing last params for 1:1 mode
          setLastGenerationParams(null);
        } else {
          // For fixed sizes, update display size to fill new viewport
          console.log('🔄 Window resized - updating display size');
          setDisplaySize(getDisplaySize());
        }
      }, 300);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(window.resizeTimeout);
    };
  }, [externalImageSize, isGenerating, getDisplaySize]);

  // Expose startGeneration method via ref
  useImperativeHandle(ref, () => ({
    startGeneration
  }), []);

  // Legacy Worker code (COMPLETELY REMOVED - using WebGPU now)
  /*
  const initLegacyWorker = () => {
    if (false) { // Disabled
      try {
        // Create worker with inline code to avoid Vite module loading issues
        const workerCode = `
// Worker code inline to avoid module loading issues
const CONFIG = {
  IMAGE_SIZE: 512,
  COORDINATE_RANGE: 512,
  CURVE_HEIGHT: 255,
  PALETTE_SIZE: 256,
  PROGRESS_UPDATE_INTERVAL: 0x3FFFF,
  DEFAULT_COORDINATE_NOISE: 'radial'
};

function* centerSpiral(width = 512, height = 512) {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  
  let sx = 0, sy = 0;
  let stepLen = 1;
  const dirs = [[1,0],[0,-1],[-1,0],[0,1]];
  let yielded = 0;
  const total = width * height;

  const emit = (sx, sy) => {
    const ix = cx + sx;
    const iy = cy + sy;
    if (ix >= 0 && ix < width && iy >= 0 && iy < height) {
      yielded++;
      return [sx, sy, ix, iy];
    }
    return null;
  };

  const c = emit(0, 0);
  if (c) yield c;
  if (yielded >= total) return;

  let dirIndex = 0;
  while (yielded < total) {
    for (let rep = 0; rep < 2; rep++) {
      const [dx, dy] = dirs[dirIndex];
      for (let i = 0; i < stepLen; i++) {
        sx += dx; sy += dy;
        const out = emit(sx, sy);
        if (out) yield out;
        if (yielded >= total) return;
      }
      dirIndex = (dirIndex + 1) & 3;
    }
    stepLen++;
  }
}

function buildNoiseFn(exprSource) {
  const body = \`
    "use strict";
    const sqrt=Math.sqrt, sin=Math.sin, cos=Math.cos, tan=Math.tan, pow=Math.pow, abs=Math.abs,
          min=Math.min, max=Math.max, log=Math.log, exp=Math.exp, PI=Math.PI, E=Math.E,
          atan=Math.atan, atan2=Math.atan2, floor=Math.floor, ceil=Math.ceil, round=Math.round;
    const r = (\${exprSource});
    if (!Number.isFinite(r)) return 0.0;
    return r;
  \`;
  return new Function("x", "y", body);
}

function applyNoiseCalculation(x, y, noiseValue, noiseCalc) {
  switch (noiseCalc) {
    case 'radial':
      const r = Math.hypot(x, y);
      if (r > 0) {
        const scale = noiseValue / r;
        const warpedX = x * scale;
        const warpedY = y * scale;
        return Math.hypot(warpedX, warpedY);
      }
      return 0;
      
    case 'cartesian-x':
      return Math.abs(x + noiseValue);
      
    case 'cartesian-y':
      return Math.abs(y + noiseValue);
      
    default:
      const rDefault = Math.hypot(x, y);
      if (rDefault > 0) {
        const scaleDefault = noiseValue / rDefault;
        const warpedXDefault = x * scaleDefault;
        const warpedYDefault = y * scaleDefault;
        return Math.hypot(warpedXDefault, warpedYDefault);
      }
      return 0;
  }
}

function warpPointScalarRadius(x, y, n) {
  const r = Math.hypot(x, y);
  if (r > 0) {
    const s = n / r;
    return [x * s, y * s];
  }
  return [0, 0];
}

self.onmessage = (e) => {
  const { jobId, size, curve, noise, palette, seed } = e.data;
  
  try {
    console.log('🔧 Worker: Building noise function for', noise.name, 'with expression:', noise.gpuExpression);
    const noiseFn = buildNoiseFn(noise.gpuExpression);
    
    const width = size || 512;
    const height = size || 512;
    const rgba = new Uint8Array(width * height * 4);
    const valuePlane = new Uint8Array(width * height);
    
    let pixelCount = 0;
    const totalPixels = width * height;
    
    // Test coordinate noise transformation
    console.log('🧪 Testing coordinate noise transformation:');
    const testPoints = [[0, 0], [10, 0], [0, 10], [10, 10], [50, 50], [100, 100]];
    
    testPoints.forEach(([x, y]) => {
      try {
        const n = noiseFn(x, y);
        const [px, py] = warpPointScalarRadius(x, y, n);
        const d = Math.hypot(px, py);
        console.log(\`  Input: (\${x},\${y}) → Noise: \${n.toFixed(3)} → Warped: (\${px.toFixed(2)},\${py.toFixed(2)}) → Distance: \${d.toFixed(3)}\`);
      } catch (e) {
        console.log(\`  Input: (\${x},\${y}) → ERROR: \${e.message}\`);
      }
    });
    
    // Generate image using spiral fill pattern
    for (const [sx, sy, ix, iy] of centerSpiral(width, height)) {
      try {
        const n = noiseFn(sx, sy);
        const [px, py] = warpPointScalarRadius(sx, sy, n);
        const d = Math.hypot(px, py);
        const dPrime = d * curve['curve-index-scaling'];
        
        const curveWidth = Math.max(1, curve['curve-width'] | 0);
        let idx = Math.floor(dPrime % curveWidth);
        if (idx < 0) idx += curveWidth;
        if (idx >= curveWidth) idx = curveWidth - 1;
        
        const v = curve['curve-data'][idx] | 0;
        valuePlane[iy * width + ix] = v;
        
        // Debug logging removed for performance
        
        const color = palette[v] || palette[0];
        const base = (iy * width + ix) * 4;
        rgba[base + 0] = color.r | 0;
        rgba[base + 1] = color.g | 0;
        rgba[base + 2] = color.b | 0;
        rgba[base + 3] = (color.a == null ? 255 : color.a) | 0;
        
      } catch (noiseError) {
        const v = curve['curve-data'][0] | 0;
        valuePlane[iy * width + ix] = v;
        
        const color = palette[v] || palette[0];
        const base = (iy * width + ix) * 4;
        rgba[base + 0] = color.r | 0;
        rgba[base + 1] = color.g | 0;
        rgba[base + 2] = color.b | 0;
        rgba[base + 3] = (color.a == null ? 255 : color.a) | 0;
      }
      
      pixelCount++;
      
      if ((pixelCount & 0xFFFF) === 0) {
        self.postMessage({ 
          type: "progress", 
          jobId, 
          done: pixelCount, 
          total: totalPixels,
          percentage: Math.round((pixelCount / totalPixels) * 100)
        });
      }
    }
    
    self.postMessage({ 
      type: "done", 
      jobId, 
      rgba, 
      valuePlane, 
      width, 
      height 
    }, [rgba.buffer, valuePlane.buffer]);
    
  } catch (err) {
    self.postMessage({ 
      type: "error", 
      jobId, 
      message: err.message || String(err) 
    });
  }
};
`;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        workerRef.current = new Worker(URL.createObjectURL(blob));

  // Legacy worker message handler completely removed - using WebGPU now
  */

  // Handle generation completion
  const handleGenerationComplete = useCallback((result: GenerationResult) => {
    try {
      // Generate PNG blob
      const palette = getPaletteByName(selectedPalette);
      const pngBlob = rgbaToIndexedPng(result.rgba, result.width, result.height, palette.length);
      
      // Create download URL
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
      const newDownloadUrl = URL.createObjectURL(pngBlob);
      setDownloadUrl(newDownloadUrl);

      // Display in canvas
      displayImageOnCanvas(result.rgba, result.width, result.height);

    } catch (error) {
      console.error('Failed to process generated image:', error);
      onError?.('Failed to process generated image');
    }
  }, [selectedPalette, downloadUrl, onError]);

  // Convert RGBA to indexed PNG
  const rgbaToIndexedPng = (rgba: Uint8Array, width: number, height: number, paletteLength: number): Blob => {
    // Use UPNG to encode as indexed PNG
    const arrayBuffer = UPNG.encode([rgba.buffer], width, height, paletteLength);
    return new Blob([arrayBuffer], { type: 'image/png' });
  };

  // Display image on canvas
  const displayImageOnCanvas = (rgba: Uint8Array, width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Create ImageData and display
    const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
    ctx.putImageData(imageData, 0, 0);

    // Create object URL for display
    canvas.toBlob((blob) => {
      if (blob) {
        if (generatedImage) {
          URL.revokeObjectURL(generatedImage);
        }
        setGeneratedImage(URL.createObjectURL(blob));
      }
    }, 'image/png');
  };

  // Start generation
  const startGeneration = useCallback(async () => {
    if (isGenerating) return;

    console.log('🚀 Starting WebGPU PNG generation with:');
    console.log('  Curve:', curve['curve-name'], 'coordinate-noise:', curve['coordinate-noise']);
    console.log('  Noise object:', coordinateNoise.name, 'expression:', coordinateNoise.gpuExpression);
    console.log('  Palette:', selectedPalette);

    try {
      const imageSize = getImageSize();
      setIsGenerating(true);
      setProgress({ done: 0, total: imageSize * imageSize, percentage: 0, stage: 'Initializing WebGPU...' });
      
      // Update last generation params
      setLastGenerationParams({
        curveId: curve['curve-name'],
        noiseId: coordinateNoise.name,
        noiseCalc: curve['noise-calc'] || 'radial',
        palette: selectedPalette,
        imageSize: imageSize
      });

      const palette = getPaletteByName(selectedPalette);
      const webgpuService = getWebGPUService();
      
      // Prepare curve data for WebGPU
      const curveData = {
        'curve-data': curve['curve-data'],
        'curve-width': curve['curve-width'],
        'curve-index-scaling': curve['curve-index-scaling'],
        'coordinate-noise': curve['coordinate-noise'],
        'noise-calc': (curve['noise-calc'] || 'radial') as 'radial' | 'cartesian-x' | 'cartesian-y'
      };

      // Process complete image with progress tracking
      const result = await webgpuService.processCompleteImage(
        curveData,
        palette,
        coordinateNoise.gpuExpression,
        imageSize,
        imageSize,
        3.0, // 300% zoom scale
        0, 0,
        (stage: string, progressPercent: number) => {
          const totalPixels = imageSize * imageSize;
          const done = Math.round((progressPercent / 100) * totalPixels);
          setProgress({ 
            done, 
            total: totalPixels, 
            percentage: progressPercent,
            stage 
          });
        }
      );

      console.log('✅ WebGPU generation complete:', result.stats);

      // Create ImageData and generate PNG
      const imageData = result.result.imageData;
      const rgbaArray = new Uint8Array(result.result.rgbaData);
      
      // Generate PNG using UPNG
      const png = UPNG.encode([rgbaArray.buffer], imageData.width, imageData.height, 0);
      const blob = new Blob([png], { type: 'image/png' });
      const pngUrl = URL.createObjectURL(blob);
      
      // Create canvas for display
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(imageData, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        setGeneratedImage(dataUrl);
      }
      
      setDownloadUrl(pngUrl);
      setProgress({ done: result.stats.pixelsProcessed, total: result.stats.pixelsProcessed, percentage: 100, stage: 'Complete!' });
      
    } catch (error) {
      console.error('❌ WebGPU generation failed:', error);
      onError?.(error instanceof Error ? error.message : 'WebGPU generation failed');
      setProgress({ done: 0, total: 0, percentage: 0, stage: 'Error' });
    } finally {
      setIsGenerating(false);
    }
  }, [curve, coordinateNoise, selectedPalette, isGenerating, onError]);

  // Handle palette change (recolor only if we have a previous result)
  const handlePaletteChange = useCallback((newPalette: string) => {
    setSelectedPalette(newPalette);

    // If we have a previous result and only palette changed, just recolor
    if (lastResultRef.current && lastGenerationParams && 
        lastGenerationParams.curveId === curve['curve-name'] &&
        lastGenerationParams.noiseId === coordinateNoise.name &&
        lastGenerationParams.noiseCalc === (curve['noise-calc'] || 'radial')) {
      
      // Recolor the existing result
      const result = lastResultRef.current;
      const newPaletteColors = getPaletteByName(newPalette);
      
      // Create new RGBA data with new palette
      const newRgba = new Uint8Array(result.rgba.length);
      for (let i = 0; i < result.valuePlane.length; i++) {
        const value = result.valuePlane[i];
        const color = newPaletteColors[value];
        const base = i * 4;
        newRgba[base + 0] = color.r;
        newRgba[base + 1] = color.g;
        newRgba[base + 2] = color.b;
        newRgba[base + 3] = color.a || 255;
      }

      // Update the result and display
      const newResult = { ...result, rgba: newRgba };
      lastResultRef.current = newResult;
      handleGenerationComplete(newResult);
    }
  }, [curve, coordinateNoise, lastGenerationParams, handleGenerationComplete]);

  // Download handler
  const handleDownload = useCallback(() => {
    if (!downloadUrl) return;

    const filename = `${GENERATION_CONFIG.DOWNLOAD_FILENAME_PREFIX}-${curve['curve-name']}-${coordinateNoise.name}-${selectedPalette}.png`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [downloadUrl, curve, coordinateNoise, selectedPalette]);

  // Check if regeneration is needed
  const needsRegeneration = useMemo(() => {
    const result = lastGenerationParams === null ||
      lastGenerationParams.curveId !== curve['curve-name'] ||
      lastGenerationParams.noiseId !== coordinateNoise.name ||
      lastGenerationParams.noiseCalc !== (curve['noise-calc'] || 'radial') ||
      lastGenerationParams.palette !== selectedPalette ||
      lastGenerationParams.imageSize !== getImageSize();
    
    console.log('🔍 Regeneration check:', {
      result,
      lastParams: lastGenerationParams,
      currentParams: {
        curveId: curve['curve-name'],
        noiseId: coordinateNoise.name,
        noiseCalc: curve['noise-calc'] || 'radial',
        palette: selectedPalette,
        imageSize: getImageSize()
      }
    });
    
    return result;
  }, [lastGenerationParams, curve, coordinateNoise, selectedPalette, getImageSize]);

  // Test coordinate noise function
  const testCoordinateNoise = useCallback(() => {
    console.log('🧪 Testing coordinate noise function:');
    console.log('  Noise:', coordinateNoise.name);
    console.log('  Expression:', coordinateNoise.gpuExpression);
    
    try {
      // Create a test function (same as worker)
      const testExpr = coordinateNoise.gpuExpression;
      const testFn = new Function('x', 'y', `
        "use strict";
        const sqrt=Math.sqrt, sin=Math.sin, cos=Math.cos, tan=Math.tan, pow=Math.pow, abs=Math.abs,
              min=Math.min, max=Math.max, log=Math.log, exp=Math.exp, PI=Math.PI, E=Math.E,
              atan=Math.atan, atan2=Math.atan2, floor=Math.floor, ceil=Math.ceil, round=Math.round;
        const r = (${testExpr});
        if (!Number.isFinite(r)) return 0.0;
        return r;
      `);
      
      // Test some coordinates
      const testPoints = [
        [0, 0], [10, 0], [0, 10], [10, 10], [50, 50], [100, 100]
      ];
      
      testPoints.forEach(([x, y]) => {
        try {
          const result = testFn(x, y);
          console.log(`  (${x}, ${y}) → ${result}`);
        } catch (e) {
          console.log(`  (${x}, ${y}) → ERROR: ${e.message}`);
        }
      });
      
    } catch (error) {
      console.error('❌ Error testing noise function:', error);
    }
  }, [coordinateNoise]);

  // Cancel current generation and reset
  const cancelAndReset = useCallback(() => {
    if (isGenerating) {
      console.log('🛑 Cancelling current WebGPU generation and resetting');
      
      // Reset state
      const initWorker = () => {
        const workerCode = `
// Worker code inline to avoid module loading issues
const CONFIG = {
  IMAGE_SIZE: 512,
  COORDINATE_RANGE: 512,
  CURVE_HEIGHT: 255,
  PALETTE_SIZE: 256,
  PROGRESS_UPDATE_INTERVAL: 0x3FFFF,
  DEFAULT_COORDINATE_NOISE: 'radial'
};

function* centerSpiral(width = 512, height = 512) {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  
  let sx = 0, sy = 0;
  let stepLen = 1;
  const dirs = [[1,0],[0,-1],[-1,0],[0,1]];
  let yielded = 0;
  const total = width * height;

  const emit = (sx, sy) => {
    const ix = cx + sx;
    const iy = cy + sy;
    if (ix >= 0 && ix < width && iy >= 0 && iy < height) {
      yielded++;
      return [sx, sy, ix, iy];
    }
    return null;
  };

  const c = emit(0, 0);
  if (c) yield c;
  if (yielded >= total) return;

  let dirIndex = 0;
  while (yielded < total) {
    for (let rep = 0; rep < 2; rep++) {
      const [dx, dy] = dirs[dirIndex];
      for (let i = 0; i < stepLen; i++) {
        sx += dx; sy += dy;
        const out = emit(sx, sy);
        if (out) yield out;
        if (yielded >= total) return;
      }
      dirIndex = (dirIndex + 1) & 3;
    }
    stepLen++;
  }
}

function buildNoiseFn(exprSource) {
  const body = \`
    "use strict";
    const sqrt=Math.sqrt, sin=Math.sin, cos=Math.cos, tan=Math.tan, pow=Math.pow, abs=Math.abs,
          min=Math.min, max=Math.max, log=Math.log, exp=Math.exp, PI=Math.PI, E=Math.E,
          atan=Math.atan, atan2=Math.atan2, floor=Math.floor, ceil=Math.ceil, round=Math.round;
    const r = (\${exprSource});
    if (!Number.isFinite(r)) return 0.0;
    return r;
  \`;
  return new Function("x", "y", body);
}

function applyNoiseCalculation(x, y, noiseValue, noiseCalc) {
  switch (noiseCalc) {
    case 'radial':
      const r = Math.hypot(x, y);
      if (r > 0) {
        const scale = noiseValue / r;
        const warpedX = x * scale;
        const warpedY = y * scale;
        return Math.hypot(warpedX, warpedY);
      }
      return 0;
      
    case 'cartesian-x':
      return Math.abs(x + noiseValue);
      
    case 'cartesian-y':
      return Math.abs(y + noiseValue);
      
    default:
      const rDefault = Math.hypot(x, y);
      if (rDefault > 0) {
        const scaleDefault = noiseValue / rDefault;
        const warpedXDefault = x * scaleDefault;
        const warpedYDefault = y * scaleDefault;
        return Math.hypot(warpedXDefault, warpedYDefault);
      }
      return 0;
  }
}

function warpPointScalarRadius(x, y, n) {
  const r = Math.hypot(x, y);
  if (r > 0) {
    const s = n / r;
    return [x * s, y * s];
  }
  return [0, 0];
}

self.onmessage = (e) => {
  const { jobId, size, curve, noise, palette, seed } = e.data;
  
  try {
    console.log('🔧 Worker: Building noise function for', noise.name, 'with expression:', noise.gpuExpression);
    const noiseFn = buildNoiseFn(noise.gpuExpression);
    
    const width = size || 512;
    const height = size || 512;
    const rgba = new Uint8Array(width * height * 4);
    const valuePlane = new Uint8Array(width * height);
    
    let pixelCount = 0;
    const totalPixels = width * height;
    
    // Test coordinate noise transformation
    console.log('🧪 Testing coordinate noise transformation:');
    const testPoints = [[0, 0], [10, 0], [0, 10], [10, 10], [50, 50], [100, 100]];
    
    testPoints.forEach(([x, y]) => {
      try {
        const n = noiseFn(x, y);
        const [px, py] = warpPointScalarRadius(x, y, n);
        const d = Math.hypot(px, py);
        console.log(\`  Input: (\${x},\${y}) → Noise: \${n.toFixed(3)} → Warped: (\${px.toFixed(2)},\${py.toFixed(2)}) → Distance: \${d.toFixed(3)}\`);
      } catch (e) {
        console.log(\`  Input: (\${x},\${y}) → ERROR: \${e.message}\`);
      }
    });
    
    // Generate image using spiral fill pattern
    for (const [sx, sy, ix, iy] of centerSpiral(width, height)) {
      try {
        const n = noiseFn(sx, sy);
        const [px, py] = warpPointScalarRadius(sx, sy, n);
        const d = Math.hypot(px, py);
        const dPrime = d * curve['curve-index-scaling'];
        
        const curveWidth = Math.max(1, curve['curve-width'] | 0);
        let idx = Math.floor(dPrime % curveWidth);
        if (idx < 0) idx += curveWidth;
        if (idx >= curveWidth) idx = curveWidth - 1;
        
        const v = curve['curve-data'][idx] | 0;
        valuePlane[iy * width + ix] = v;
        
        // Debug logging removed for performance
        
        const color = palette[v] || palette[0];
        const base = (iy * width + ix) * 4;
        rgba[base + 0] = color.r | 0;
        rgba[base + 1] = color.g | 0;
        rgba[base + 2] = color.b | 0;
        rgba[base + 3] = (color.a == null ? 255 : color.a) | 0;
        
      } catch (noiseError) {
        const v = curve['curve-data'][0] | 0;
        valuePlane[iy * width + ix] = v;
        
        const color = palette[v] || palette[0];
        const base = (iy * width + ix) * 4;
        rgba[base + 0] = color.r | 0;
        rgba[base + 1] = color.g | 0;
        rgba[base + 2] = color.b | 0;
        rgba[base + 3] = (color.a == null ? 255 : color.a) | 0;
      }
      
      pixelCount++;
      
      if ((pixelCount & 0xFFFF) === 0) {
        self.postMessage({ 
          type: "progress", 
          jobId, 
          done: pixelCount, 
          total: totalPixels,
          percentage: Math.round((pixelCount / totalPixels) * 100)
        });
      }
    }
    
    self.postMessage({ 
      type: "done", 
      jobId, 
      rgba, 
      valuePlane, 
      width, 
      height 
    }, [rgba.buffer, valuePlane.buffer]);
    
  } catch (err) {
    self.postMessage({ 
      type: "error", 
      jobId, 
      message: err.message || String(err) 
    });
  }
};
`;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        workerRef.current = new Worker(URL.createObjectURL(blob));

        workerRef.current.onmessage = (e: MessageEvent<WorkerMessage>) => {
          const { type, jobId, done, total, percentage, rgba, valuePlane, width, height, message } = e.data;

          // Ignore messages from old jobs
          if (jobId !== jobIdRef.current) return;

          switch (type) {
            case 'progress':
              if (done !== undefined && total !== undefined && percentage !== undefined) {
                setProgress({ done, total, percentage });
              }
              break;

            case 'done':
              if (rgba && valuePlane && width && height) {
                const result: GenerationResult = { rgba, valuePlane, width, height };
                lastResultRef.current = result;
                handleGenerationComplete(result);
              }
              setIsGenerating(false);
              break;

            case 'error':
              console.error('Worker error:', message);
              onError?.(message || 'Unknown generation error');
              setIsGenerating(false);
              break;
          }
        };

        workerRef.current.onerror = (error) => {
          console.error('Worker error:', error);
          onError?.('Worker initialization failed');
          setIsGenerating(false);
        };
      };

      initWorker();
    }
    
    // Reset state
    setIsGenerating(false);
    setProgress({ done: 0, total: 0, percentage: 0 });
    setGeneratedImage(null);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
    lastResultRef.current = null;
    setLastGenerationParams(null);
  }, [isGenerating, downloadUrl, onError]);

  // Auto-generate when curve, noise, palette, or size changes
  useEffect(() => {
    console.log('🔍 Auto-generation check:', {
      hasCurve: !!curve,
      hasCoordinateNoise: !!coordinateNoise,
      isGenerating,
      needsRegeneration,
      hasGeneratedImage: !!generatedImage,
      curveName: curve?.['curve-name'],
      noiseName: coordinateNoise?.name
    });

    if (curve && coordinateNoise && !isGenerating) {
      // Always generate if we have the required data and aren't currently generating
      if (needsRegeneration || !generatedImage) {
        console.log('🔄 Auto-generating PNG due to parameter change or missing image');
        
        // Start generation immediately
        startGeneration();
      } else {
        console.log('✅ Image already exists and no regeneration needed');
      }
    } else {
      console.log('❌ Missing requirements for auto-generation:', {
        missingCurve: !curve,
        missingNoise: !coordinateNoise,
        currentlyGenerating: isGenerating
      });
    }
  }, [curve, coordinateNoise, selectedPalette, externalImageSize, needsRegeneration, isGenerating, startGeneration, generatedImage]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#000000' }}>
      {/* Progress Bar (only when generating) */}
      {isGenerating && (
        <div style={{ padding: '8px 16px', backgroundColor: '#1a1a1a', borderBottom: '1px solid #333' }}>
          <div style={{ color: '#fff', fontSize: '14px', textAlign: 'center' }}>
            {progress.stage} - {progress.percentage}% ({progress.done.toLocaleString()}/{progress.total.toLocaleString()} pixels)
          </div>
        </div>
      )}

      {/* Liquid Viewport Display */}
      <div style={{ 
        flex: 1, 
        position: 'relative',
        backgroundColor: '#000000' // Fallback background
      }}>
        <LiquidViewport 
          textureDataUrl={generatedImage}
          onError={(error) => onError?.(error)}
        />
        
        {/* Overlay status when generating or no image */}
        {(!generatedImage || isGenerating) && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#666',
            fontSize: '16px',
            textAlign: 'center',
            zIndex: 10
          }}>
            {isGenerating ? (
              <div>
                <div>🚀 WebGPU Processing {getImageSize()}×{getImageSize()} PNG...</div>
                <div style={{ marginTop: '8px', fontSize: '14px' }}>
                  {progress.stage} - {progress.percentage}% complete
                </div>
              </div>
            ) : (
              <div>
                <div>Ready to generate {getImageSize()}×{getImageSize()} PNG visualization</div>
                <div style={{ marginTop: '8px', fontSize: '14px', color: '#555' }}>
                  Using {coordinateNoise.name} coordinate noise with {curve['curve-name']}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden canvas for image processing */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />
    </div>
  );
});

export default PNGGenerator;
