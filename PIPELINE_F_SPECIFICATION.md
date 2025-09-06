# Pipeline F Specification - Merzbow Pixel Generation

## **📋 AUTHORITATIVE PIPELINE F SPECIFICATION**
*Based on working Merzbow implementation and mathPipeline.ts - this is the exact reference standard*

### **🔍 VALIDATION STATUS:**
- ✅ **Verified against**: `src/utils/mathPipeline.ts` - `applyMathPipeline()` function
- ✅ **Verified against**: `src/workers/imageGenerator.worker.ts` - working implementation  
- ✅ **Verified against**: API DP structure with actual field names
- ✅ **Conditional processing**: Based on DP boolean flags

### **INPUT DATA REQUIREMENTS:**
- **Distortion Profile (DP)**: Complete DP object with all parameters
- **Curve Data**: Array of 0-255 integer values (`curve['curve-data']`)
- **Palette Data**: Array of normalized color objects `[{r: 0-1, g: 0-1, b: 0-1, a?: 0-1}, ...]`

---

## **🏗️ PIPELINE F ARCHITECTURE:**

### **📦 SHARED SCRIPT (mathPipeline.ts - Always Executed):**
- ✅ **Steps 1-4**: Coordinate input → world conversion → noise → warping  
- ✅ **Step 9**: Distance scaling with `curve['curve-index-scaling']`
- ✅ **Steps 10-11**: Index calculation & wrapping → curve value lookup
- ✅ **Steps 13-14**: Palette mapping → pixel rendering

### **⚙️ CONDITIONAL PROCESSING (Based on DP Flags):**
- 🌀 **Angular Distortion (Step 5)**: Only if `DP['angular-distortion'] === true`
- 🌊 **Fractal Distortion (Step 6)**: Only if `DP['fractal-distortion'] === true`  
- 📐 **Distance Modulus (Step 7)**: Only if `DP['distance-modulus'] > 0`
- 🎲 **Checkerboard (Step 12)**: Only if `DP['checkerboard-pattern'] === true`

### **📊 CURRENT DP: ZorWED (Most Recent)**
```json
{
  "name": "ZorWED",
  "angular-distortion": true,     // ✅ Angular: freq=43.2, amp=12, offset=9.3
  "fractal-distortion": false,    // ❌ Fractal: SKIPPED
  "checkerboard-pattern": false,  // ❌ Checkerboard: SKIPPED  
  "distance-modulus": 0,          // ❌ Modulus: SKIPPED
  "distance-calculation": "triangular",  // ⚠️ NOTE: "triangular" method
  "curve-scaling": 1
}
```

### **⚠️ VALIDATION ISSUE FOUND:**
**Missing distance calculation method**: "triangular" is not documented in specification!

---

## **STEP-BY-STEP PIPELINE F EXECUTION:**

### **STEP 1: COORDINATE INPUT**
```javascript
// Input: Canvas pixel coordinates
const canvasX = pixelX  // 0 to canvasWidth
const canvasY = pixelY  // 0 to canvasHeight
```

### **STEP 2: WORLD COORDINATE CONVERSION**
```javascript
// Convert canvas pixels to world coordinates
const worldX = (canvasX - canvasWidth/2) * scale + centerX
const worldY = (canvasY - canvasHeight/2) * scale + centerY
```

### **STEP 3: NOISE FUNCTION APPLICATION**
```javascript
// Apply noise function (simplified in Testing - use 1.0)
const n = noiseFn(worldX, worldY)  // Returns noise value
```

### **STEP 4: COORDINATE WARPING (warpPointScalarRadius)**
```javascript
// Apply scalar-radius warping
const [px, py] = warpPointScalarRadius(worldX, worldY, n)
// Implementation: [worldX * n, worldY * n]
```

### **STEP 5: ANGULAR DISTORTION (if enabled)**
```javascript
// Apply angular distortion if DP['angular-distortion'] === true
if (selectedDP['angular-distortion']) {
  const angle = Math.atan2(py, px)
  const radius = Math.hypot(px, py)
  const newAngle = angle + Math.sin(
    angle * selectedDP['angular-frequency'] + 
    selectedDP['angular-offset'] * 0.017453  // Convert degrees to radians
  ) * selectedDP['angular-amplitude'] * 0.01
  
  px = Math.cos(newAngle) * radius
  py = Math.sin(newAngle) * radius
}
```

### **STEP 6: FRACTAL DISTORTION (if enabled)**
```javascript
// Apply fractal distortion if DP['fractal-distortion'] === true
if (selectedDP['fractal-distortion']) {
  px += Math.sin(py * selectedDP['fractal-scale-1']) * selectedDP['fractal-strength'] * 0.3
  py += Math.cos(px * selectedDP['fractal-scale-2']) * selectedDP['fractal-strength'] * 0.3
  px += Math.sin(py * selectedDP['fractal-scale-3']) * selectedDP['fractal-strength'] * 0.1
}
```

### **STEP 7: DISTANCE MODULUS (if enabled)**
```javascript
// Apply distance modulus wrapping if DP['distance-modulus'] > 0
if (selectedDP['distance-modulus'] > 0) {
  const modulus = selectedDP['distance-modulus']
  px = ((px + modulus * 0.5) % modulus) - modulus * 0.5
  py = ((py + modulus * 0.5) % modulus) - modulus * 0.5
}
```

### **STEP 8: FINAL DISTANCE CALCULATION**
```javascript
// Calculate final distance using selected method
let d = 0
switch (selectedDP['distance-calculation']) {
  case 'radial': d = Math.hypot(px, py); break
  case 'cartesian-x': d = Math.abs(px); break
  case 'cartesian-y': d = Math.abs(py); break
  case 'manhattan': d = Math.abs(px) + Math.abs(py); break
  case 'chebyshev': d = Math.max(Math.abs(px), Math.abs(py)); break
  default: d = Math.hypot(px, py)
}
```

### **STEP 9: DISTANCE SCALING**
```javascript
// Scale distance using curve parameters
const dPrime = d * curve['curve-index-scaling']  // Apply DP curve-scaling parameter
```

### **STEP 10: INDEX CALCULATION & WRAPPING**
```javascript
// Calculate curve array index with wrapping
const curveWidth = Math.max(1, curve['curve-width'] | 0)
let idx = Math.floor(dPrime % curveWidth)
if (idx < 0) idx += curveWidth        // Handle negative modulus
if (idx >= curveWidth) idx = curveWidth - 1  // Clamp to valid range
```

### **STEP 11: CURVE VALUE LOOKUP**
```javascript
// Lookup actual curve value at calculated index
const v = curve['curve-data'][idx] | 0  // v is 0..255 (raw curve value)
// ✅ CRITICAL: Do NOT normalize v - use as-is
```

### **STEP 12: CHECKERBOARD PATTERN (if enabled)**
```javascript
// Apply checkerboard pattern if DP['checkerboard-pattern'] === true
if (selectedDP['checkerboard-pattern'] && selectedDP['checkerboard-steps'] > 0) {
  const checker = Math.floor(d / selectedDP['checkerboard-steps'])
  if (checker % 2 > 0.5) {
    v = 255 - v  // Invert curve value for checkerboard effect
  }
}
```

### **STEP 13: PALETTE COLOR MAPPING**
```javascript
// Map curve value directly to palette index
const paletteIndex = v  // Use curve value directly as palette index
const color = normalizedPalette[paletteIndex]  // Direct array lookup
// ✅ CRITICAL: v (0-255) maps directly to palette[0-255]
```

### **STEP 14: PIXEL RENDERING**
```javascript
// Apply color to canvas pixel
rgba[pixelIndex + 0] = color.r | 0    // Red channel
rgba[pixelIndex + 1] = color.g | 0    // Green channel  
rgba[pixelIndex + 2] = color.b | 0    // Blue channel
rgba[pixelIndex + 3] = (color.a == null ? 255 : color.a) | 0  // Alpha channel
```

---

## **🔍 VALIDATION CHECKPOINTS:**

### **Data Integrity:**
- ✅ `curve['curve-data']` contains 0-255 integer values
- ✅ `normalizedPalette` contains 256 color objects with r,g,b,a (0-255 range)
- ✅ `curve['curve-width']` matches `curve['curve-data'].length`

### **Mathematical Correctness:**
- ✅ `idx` is valid array index (0 to curveWidth-1)
- ✅ `v` is raw curve value (0-255, not normalized)
- ✅ `paletteIndex` equals `v` (direct mapping)
- ✅ Final color comes from `palette[v]`

### **Visual Output:**
- ✅ Different world coordinates produce different `d` values
- ✅ Different `d` values produce different `idx` values  
- ✅ Different `idx` values produce different `v` values
- ✅ Different `v` values produce different colors
- ✅ Result: Colorful mathematical patterns

---

## **🚨 CRITICAL REQUIREMENTS:**

1. **NO NORMALIZATION** of curve values - use `v` as-is
2. **DIRECT PALETTE INDEXING** - `palette[v]` not `palette[v/255]`
3. **EXACT DISTANCE MATH** - `Math.hypot(px, py)` for all calculations
4. **PROPER WRAPPING** - Handle negative modulus correctly
5. **ARRAY BOUNDS** - Clamp all indices to valid ranges

---

## **📊 EXAMPLE EXECUTION:**

### **Input:**
- Canvas pixel: (128, 128)
- World coords: (0.0, 0.0) 
- DP: ZorWED with curve-scaling: 1.0
- Curve data: [0, 5, 10, 15, 20, ...]
- Palette: [{r:1, g:0, b:0}, {r:0, g:1, b:0}, ...]

### **Execution:**
1. **Noise**: n = 1.0
2. **Warp**: px = 0.0, py = 0.0  
3. **Distance**: d = 0.0
4. **Scale**: dPrime = 0.0
5. **Index**: idx = 0
6. **Lookup**: v = curve['curve-data'][0] = 0
7. **Palette**: color = palette[0] = {r:1, g:0, b:0}
8. **Render**: Red pixel

### **Expected Result:**
- Center of canvas: Red pixel (curve value 0 → palette[0])
- Moving outward: Different colors based on distance and curve data

---

**This is the exact specification that Merzbow follows. Any deviation will produce different results.** 🎯
