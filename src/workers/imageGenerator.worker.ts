// Image Generation Web Worker
// Generates 1024x1024 indexed PNG using 6-step math pipeline

// Hard-coded configuration values
const CONFIG = {
  IMAGE_SIZE: 1024,
  COORDINATE_RANGE: 512, // -512 to +511
  CURVE_HEIGHT: 255,
  PALETTE_SIZE: 256,
  PROGRESS_UPDATE_INTERVAL: 0x3FFF, // Update progress every 16384 pixels
  DEFAULT_COORDINATE_NOISE: 'radial'
} as const;

// Type definitions (duplicated from mathPipeline.ts for worker scope)
interface Curve {
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

interface CoordinateNoise {
  name: string;
  category: string;
  description: string;
  cpuLoadLevel: number;
  gpuDescription: string;
  gpuExpression: string;
  createdAt: string;
  updatedAt: string;
}

interface PaletteColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface GenerationJob {
  jobId: string;
  size: number;
  curve: Curve;
  noise: CoordinateNoise;
  palette: PaletteColor[];
  seed: number;
}

// Center-out spiral iterator (duplicated for worker scope)
function* centerSpiral(width = CONFIG.IMAGE_SIZE, height = CONFIG.IMAGE_SIZE) {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  
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

// Safe noise function validation and building
function validateExpression(src: string): void {
  // Minimal whitelist: digits, operators, parentheses, x y letters, dot, spaces, Math.* words we allow
  const SAFE_RE = /^[0-9+\-*/%.(), xyradinsqtepowclogmhaPIE_]*$/i;
  
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

function buildNoiseFn(exprSource: string): (x: number, y: number) => number {
  validateExpression(exprSource);
  
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
function warpPointScalarRadius(x: number, y: number, n: number): [number, number] {
  const r = Math.hypot(x, y);
  if (r > 0) {
    const s = n / r;
    return [x * s, y * s];
  }
  return [0, 0];
}

// Normalize palette to 256 entries
function normalizePalette(palette: PaletteColor[]): PaletteColor[] {
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

// Main worker message handler
self.onmessage = (e: MessageEvent<GenerationJob>) => {
  const { jobId, size, curve, noise, palette, seed } = e.data;
  
  try {
    // Build noise function from expression
    console.log('🔧 Worker: Building noise function for', noise.name, 'with expression:', noise.gpuExpression);
    console.log('📊 Curve data summary:');
    console.log('  Name:', curve['curve-name']);
    console.log('  Width:', curve['curve-width']);
    console.log('  Index Scaling:', curve['curve-index-scaling']);
    console.log('  Data length:', curve['curve-data'].length);
    console.log('  Data sample:', curve['curve-data'].slice(0, 10));
    console.log('  Seed:', seed);
    
    const noiseFn = buildNoiseFn(noise.gpuExpression);
    
    const width = size || CONFIG.IMAGE_SIZE;
    const height = size || CONFIG.IMAGE_SIZE;
    const rgba = new Uint8Array(width * height * 4);
    const valuePlane = new Uint8Array(width * height);
    
    // Normalize palette to 256 entries
    const normalizedPalette = normalizePalette(palette);
    
    let pixelCount = 0;
    const totalPixels = width * height;
    
    // Test coordinate noise transformation for debugging
    console.log('🧪 Testing coordinate noise transformation:');
    const testPoints = [
      [0, 0], [10, 0], [0, 10], [10, 10], [50, 50], [100, 100]
    ];
    
    testPoints.forEach(([x, y]) => {
      try {
        const n = noiseFn(x, y);
        const [px, py] = warpPointScalarRadius(x, y, n);
        const d = Math.hypot(px, py);
        console.log(`  Input: (${x},${y}) → Noise: ${n.toFixed(3)} → Warped: (${px.toFixed(2)},${py.toFixed(2)}) → Distance: ${d.toFixed(3)}`);
      } catch (e) {
        console.log(`  Input: (${x},${y}) → ERROR: ${e.message}`);
      }
    });
    
    // Generate image using spiral fill pattern
    for (const [sx, sy, ix, iy] of centerSpiral(width, height)) {
      try {
        // Step 1-2: Get logical coordinates and apply noise function
        const n = noiseFn(sx, sy);
        const [px, py] = warpPointScalarRadius(sx, sy, n);
        
        // Step 3-4: Calculate distance and scale
        const d = Math.hypot(px, py);
        const dPrime = d * curve['curve-index-scaling'];
        
        // Step 5: Wrap and clamp index
        const curveWidth = Math.max(1, curve['curve-width'] | 0);
        let idx = Math.floor(dPrime % curveWidth);
        if (idx < 0) idx += curveWidth; // handle negative mod if any
        if (idx >= curveWidth) idx = curveWidth - 1;
        
        // Step 6: Lookup value from curve data
        const v = curve['curve-data'][idx] | 0; // 0..255
        valuePlane[iy * width + ix] = v;
        
        // Debug first few pixels to see the transformation
        if (pixelCount < 5) {
          console.log(`  Pixel ${pixelCount}: (${sx},${sy}) → n=${n.toFixed(3)} → d=${d.toFixed(3)} → idx=${idx} → value=${v}`);
        }
        
        // Map value to RGBA using palette
        const color = normalizedPalette[v];
        const base = (iy * width + ix) * 4;
        rgba[base + 0] = color.r | 0;
        rgba[base + 1] = color.g | 0;
        rgba[base + 2] = color.b | 0;
        rgba[base + 3] = (color.a == null ? 255 : color.a) | 0;
        
      } catch (noiseError) {
        // If noise function throws, treat as n=0 (p'=(0,0))
        console.warn('Noise function error at', sx, sy, ':', noiseError);
        
        // Use index 0 as fallback
        const v = curve['curve-data'][0] | 0;
        valuePlane[iy * width + ix] = v;
        
        const color = normalizedPalette[v];
        const base = (iy * width + ix) * 4;
        rgba[base + 0] = color.r | 0;
        rgba[base + 1] = color.g | 0;
        rgba[base + 2] = color.b | 0;
        rgba[base + 3] = (color.a == null ? 255 : color.a) | 0;
      }
      
      pixelCount++;
      
      // Post progress updates
      if ((pixelCount & CONFIG.PROGRESS_UPDATE_INTERVAL) === 0) {
        self.postMessage({ 
          type: "progress", 
          jobId, 
          done: pixelCount, 
          total: totalPixels,
          percentage: Math.round((pixelCount / totalPixels) * 100)
        });
      }
    }
    
    // Send completion message with transferable arrays
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
      message: (err && (err as Error).message) || String(err) 
    });
  }
};

// Handle worker termination
self.onmessageerror = (e) => {
  console.error('Worker message error:', e);
};
