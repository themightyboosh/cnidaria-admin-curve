// Math Pipeline for 1024x1024 PNG Generation
// Hard-coded configuration values
export const CONFIG = {
  IMAGE_SIZE: 1024,
  COORDINATE_RANGE: 512, // -512 to +511
  CURVE_HEIGHT: 255,
  PALETTE_SIZE: 256,
  PROGRESS_UPDATE_INTERVAL: 0x3FFF, // Update progress every 16384 pixels
  DEFAULT_COORDINATE_NOISE: 'radial'
} as const;

// Type definitions
export interface Curve {
  id: string;
  'curve-name': string;
  'curve-description': string;
  'coordinate-noise': string; // The coordinate noise name
  'noise-calc'?: 'radial' | 'cartesian-x' | 'cartesian-y'; // How to calculate noise (optional until migrated)
  'curve-width': number;
  'curve-height'?: number;
  'curve-index-scaling': number;
  'curve-data': number[];
  'coordinate-noise-seed': number;
  created_at?: string;
  updated_at?: string;
}

export interface CoordinateNoise {
  name: string;
  category: string;
  description: string;
  cpuLoadLevel: number;
  gpuDescription: string;
  gpuExpression: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaletteColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface GenerationJob {
  jobId: string;
  size: number;
  curve: Curve;
  noise: CoordinateNoise;
  palette: PaletteColor[];
  seed: number;
}

export interface GenerationResult {
  rgba: Uint8Array;
  valuePlane: Uint8Array;
  width: number;
  height: number;
}

// Center-out spiral iterator for 1024x1024 grid
export function* centerSpiral(width = CONFIG.IMAGE_SIZE, height = CONFIG.IMAGE_SIZE) {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  
  // Spiral in logical coords where center is (0,0), then map to image coords
  let sx = 0, sy = 0;
  let stepLen = 1;
  const dirs = [[1,0],[0,-1],[-1,0],[0,1]]; // Right, Up, Left, Down
  let yielded = 0;
  const total = width * height;

  const emit = (sx: number, sy: number): [number, number, number, number] | null => {
    const ix = cx + sx;        // map to [0..width-1]
    const iy = cy + sy;        // map to [0..height-1]
    if (ix >= 0 && ix < width && iy >= 0 && iy < height) {
      yielded++;
      return [sx, sy, ix, iy]; // return both logical and image coords
    }
    return null;
  };

  // Start at center
  const c = emit(0, 0);
  if (c) yield c;
  if (yielded >= total) return;

  let dirIndex = 0;
  while (yielded < total) {
    for (let rep = 0; rep < 2; rep++) { // two runs per stepLen
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

// Safe noise function builder with validation
export function validateNoiseExpression(src: string): void {
  // Minimal whitelist: digits, operators, parentheses, x y letters, dot, spaces, Math.* words we allow
  const SAFE_RE = /^[0-9+\-*/%.(), xyradinsqtepowclogmhaPIE_]*$/i;
  
  // Fast reject for dangerous characters/backticks/quotes/semicolons/newlines
  if (!SAFE_RE.test(src)) {
    throw new Error("gpuExpression contains unsupported characters");
  }
  
  // Disallow keywords that open escape hatches
  const banned = ["import", "require", "global", "globalThis", "window", "document", "Function", "eval", "=>", "class"];
  const low = src.toLowerCase();
  for (const b of banned) {
    if (low.includes(b)) {
      throw new Error(`gpuExpression contains banned token: ${b}`);
    }
  }
}

export function buildNoiseFn(exprSource: string): (x: number, y: number) => number {
  validateNoiseExpression(exprSource);
  
  // Wrap expression so it can reference Math safely without globals
  const body = `
    "use strict";
    const sqrt=Math.sqrt, sin=Math.sin, cos=Math.cos, tan=Math.tan, pow=Math.pow, abs=Math.abs,
          min=Math.min, max=Math.max, log=Math.log, exp=Math.exp, PI=Math.PI, E=Math.E,
          atan=Math.atan, atan2=Math.atan2, floor=Math.floor, ceil=Math.ceil, round=Math.round;
    const r = (${exprSource});
    if (!Number.isFinite(r)) return 0.0;
    return r;
  `;
  
  // Function args are (x, y); no access to globalThis/window
  return new Function("x", "y", body) as (x: number, y: number) => number;
}

// Scalar-radius mapping (noise contract)
// Apply coordinate noise transformation based on noise-calc mode
export function applyNoiseCalculation(
  x: number, 
  y: number, 
  noiseValue: number, 
  noiseCalc: 'radial' | 'cartesian-x' | 'cartesian-y'
): number {
  switch (noiseCalc) {
    case 'radial':
      // Traditional radial distance with noise warping
      const r = Math.hypot(x, y);
      if (r > 0) {
        const scale = noiseValue / r;
        const [warpedX, warpedY] = [x * scale, y * scale];
        return Math.hypot(warpedX, warpedY);
      }
      return 0;
      
    case 'cartesian-x':
      // Use noise value directly as X coordinate influence
      return Math.abs(x + noiseValue);
      
    case 'cartesian-y':
      // Use noise value directly as Y coordinate influence
      return Math.abs(y + noiseValue);
      
    default:
      // Fallback to radial
      const rDefault = Math.hypot(x, y);
      if (rDefault > 0) {
        const scaleDefault = noiseValue / rDefault;
        const [warpedXDefault, warpedYDefault] = [x * scaleDefault, y * scaleDefault];
        return Math.hypot(warpedXDefault, warpedYDefault);
      }
      return 0;
  }
}

// Legacy function for backward compatibility
export function warpPointScalarRadius(x: number, y: number, n: number): [number, number] {
  const r = Math.hypot(x, y);
  if (r > 0) {
    const s = n / r;
    return [x * s, y * s];
  }
  return [0, 0];
}

// Core Pipeline F: coordinates + curve → index value + index position (NO PALETTE)
export function applyPipelineF(
  x: number, 
  y: number, 
  noiseFn: (x: number, y: number) => number,
  curve: Curve,
  distortionProfile?: any
): { value: number; index: number } {
  // Step 1: Read x,y from the grid (already provided)
  
  // Step 2: Compute n = gpuExpression(x,y); form p' per the scalar-radius contract
  const n = noiseFn(x, y);
  let [px, py] = warpPointScalarRadius(x, y, n);
  
  // Step 3: Apply conditional distortions based on DP settings
  if (distortionProfile) {
    // Angular distortion (if enabled)
    if (distortionProfile['angular-distortion']) {
      const angle = Math.atan2(py, px);
      const radius = Math.hypot(px, py);
      const newAngle = angle + Math.sin(
        angle * distortionProfile['angular-frequency'] + 
        distortionProfile['angular-offset'] * 0.017453
      ) * distortionProfile['angular-amplitude'] * 0.01;
      
      px = Math.cos(newAngle) * radius;
      py = Math.sin(newAngle) * radius;
    }
    
    // Fractal distortion (if enabled)
    if (distortionProfile['fractal-distortion']) {
      px += Math.sin(py * distortionProfile['fractal-scale-1']) * distortionProfile['fractal-strength'] * 0.3;
      py += Math.cos(px * distortionProfile['fractal-scale-2']) * distortionProfile['fractal-strength'] * 0.3;
      px += Math.sin(py * distortionProfile['fractal-scale-3']) * distortionProfile['fractal-strength'] * 0.1;
    }
    
    // Distance modulus (if enabled)
    if (distortionProfile['distance-modulus'] > 0) {
      const modulus = distortionProfile['distance-modulus'];
      px = ((px + modulus * 0.5) % modulus) - modulus * 0.5;
      py = ((py + modulus * 0.5) % modulus) - modulus * 0.5;
    }
  }
  
  // Step 4: Calculate final distance using selected method
  let d = 0;
  const distanceCalc = distortionProfile?.['distance-calculation'] || 'radial';
  switch (distanceCalc) {
    case 'radial': d = Math.hypot(px, py); break;
    case 'cartesian-x': d = Math.abs(px); break;
    case 'cartesian-y': d = Math.abs(py); break;
    case 'manhattan': d = Math.abs(px) + Math.abs(py); break;
    case 'chebyshev': d = Math.max(Math.abs(px), Math.abs(py)); break;
    case 'triangular': d = Math.abs(px) + Math.abs(py); break; // Same as manhattan
    default: d = Math.hypot(px, py);
  }
  
  // Step 5: Scale: d' = d * curve-index-scaling
  const dPrime = d * curve['curve-index-scaling'];
  
  // Step 6: Wrap+clamp: idx = clamp(floor(d' mod curve-width), 0, curve-width−1)
  const curveWidth = Math.max(1, curve['curve-width'] | 0);
  let idx = Math.floor(dPrime % curveWidth);
  if (idx < 0) idx += curveWidth; // handle negative mod if any
  if (idx >= curveWidth) idx = curveWidth - 1;
  
  // Step 7: Lookup: v = curve-data[idx] (0..255)
  let v = curve['curve-data'][idx] | 0; // 0..255
  
  // Step 8: Apply checkerboard pattern (if enabled)
  if (distortionProfile?.['checkerboard-pattern'] && distortionProfile['checkerboard-steps'] > 0) {
    const checker = Math.floor(d / distortionProfile['checkerboard-steps']);
    if (checker % 2 > 0.5) {
      v = 255 - v; // Invert curve value for checkerboard effect
    }
  }
  
  // Return core Pipeline F output (percentages can be computed by shaders if needed)
  return { value: v, index: idx };
}

// Legacy function for backward compatibility (adds percentages for existing code)
// TODO: Remove once all applications migrate to applyPipelineF + applyPaletteMapping
/*
export function applyMathPipeline(
  x: number, 
  y: number, 
  noiseFn: (x: number, y: number) => number,
  curve: Curve
): { value: number; index: number; valuePct: number; indexPct: number } {
  // Call new enhanced function without distortions for backward compatibility
  const result = applyPipelineF(x, y, noiseFn, curve);
  
  // Add percentages for legacy compatibility
  const valuePct = result.value / CONFIG.CURVE_HEIGHT;
  const curveWidth = Math.max(1, curve['curve-width'] | 0);
  const indexPct = curveWidth > 1 ? result.index / (curveWidth - 1) : 0;
  
  return { 
    value: result.value, 
    index: result.index, 
    valuePct, 
    indexPct 
  };
}
*/

// Normalize palette to 256 entries
export function normalizePalette(palette: PaletteColor[]): PaletteColor[] {
  if (!palette || palette.length === 0) {
    // Fallback to 256-level grayscale ramp
    const grayscale: PaletteColor[] = [];
    for (let i = 0; i < CONFIG.PALETTE_SIZE; i++) {
      grayscale.push({ r: i, g: i, b: i, a: 255 });
    }
    return grayscale;
  }
  
  const normalized = palette.slice(0, CONFIG.PALETTE_SIZE);
  
  // Pad with last color if needed
  if (normalized.length < CONFIG.PALETTE_SIZE) {
    const lastColor = normalized[normalized.length - 1];
    while (normalized.length < CONFIG.PALETTE_SIZE) {
      normalized.push({ ...lastColor });
    }
  }
  
  return normalized;
}

// DP-level palette application (separate from core math pipeline)
export function applyPaletteMapping(
  pipelineResult: { value: number; index: number },
  palette: PaletteColor[]
): PaletteColor {
  if (!palette || palette.length === 0) {
    // Grayscale fallback
    const gray = Math.floor((pipelineResult.value / 255) * 255);
    return { r: gray, g: gray, b: gray, a: 255 };
  }
  
  // Use curve value directly as palette index (exact same as imageGenerator.worker.ts)
  const paletteIndex = Math.min(pipelineResult.value, palette.length - 1);
  const color = palette[paletteIndex] || { r: 128, g: 128, b: 128, a: 255 };
  
  return color;
}

// Default coordinate noise expressions
export const DEFAULT_NOISE_EXPRESSIONS = {
  radial: 'sqrt(x * x + y * y)',
  'cartesian-x': 'abs(x)',
  'cartesian-y': 'abs(y)',
  dna: 'sqrt(x * x + y * y) + sin(atan2(y, x) * 2.0) * 3.0 + cos(atan2(y, x) * 2.0) * 2.0',
  lightning: 'sqrt(x * x + y * y) * (1.0 + sin(x * 0.1) * sin(y * 0.1) * 0.5)',
  spiral: 'sqrt(x * x + y * y) + atan2(y, x) * 10.0'
} as const;

export function getDefaultNoiseExpression(noiseName?: string): string {
  if (!noiseName || !(noiseName in DEFAULT_NOISE_EXPRESSIONS)) {
    return DEFAULT_NOISE_EXPRESSIONS[CONFIG.DEFAULT_COORDINATE_NOISE];
  }
  return DEFAULT_NOISE_EXPRESSIONS[noiseName as keyof typeof DEFAULT_NOISE_EXPRESSIONS];
}
