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
export function warpPointScalarRadius(x: number, y: number, n: number): [number, number] {
  const r = Math.hypot(x, y);
  if (r > 0) {
    const s = n / r;
    return [x * s, y * s];
  }
  return [0, 0];
}

// 6-step math pipeline
export function applyMathPipeline(
  x: number, 
  y: number, 
  noiseFn: (x: number, y: number) => number,
  curve: Curve
): { value: number; index: number; valuePct: number; indexPct: number } {
  // Step 1: Read x,y from the grid (already provided)
  
  // Step 2: Compute n = gpuExpression(x,y); form p' per the scalar-radius contract
  const n = noiseFn(x, y);
  const [px, py] = warpPointScalarRadius(x, y, n);
  
  // Step 3: d = length(p')
  const d = Math.hypot(px, py);
  
  // Step 4: Scale: d' = d * curve-index-scaling
  const dPrime = d * curve['curve-index-scaling'];
  
  // Step 5: Wrap+clamp: idx = clamp(floor(d' mod curve-width), 0, curve-width−1)
  const curveWidth = Math.max(1, curve['curve-width'] | 0);
  let idx = Math.floor(dPrime % curveWidth);
  if (idx < 0) idx += curveWidth; // handle negative mod if any
  if (idx >= curveWidth) idx = curveWidth - 1;
  
  // Step 6: Lookup: v = curve-data[idx] (0..255)
  const v = curve['curve-data'][idx] | 0; // 0..255
  
  // Compute percentages
  const valuePct = v / CONFIG.CURVE_HEIGHT;
  const indexPct = curveWidth > 1 ? idx / (curveWidth - 1) : 0;
  
  return { value: v, index: idx, valuePct, indexPct };
}

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
