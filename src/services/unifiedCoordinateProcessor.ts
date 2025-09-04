/**
 * Unified Coordinate Processing Service
 * Implements Merzbow Pipeline F as the primary coordinate processing system
 * Replaces all old coordinate-noise and expression-based processing
 */

import { apiUrl } from '../config/environments'

export interface DistortionControl {
  id: string
  name: string
  'angular-distortion': boolean
  'fractal-distortion': boolean
  'checkerboard-pattern': boolean
  'distance-calculation': string
  'distance-modulus': number
  'curve-scaling': number
  'checkerboard-steps': number
  'angular-frequency': number
  'angular-amplitude': number
  'angular-offset': number
  'fractal-scale-1': number
  'fractal-scale-2': number
  'fractal-scale-3': number
  'fractal-strength': number
}

export interface Curve {
  name: string
  'curve-data': number[]
  'curve-width': number
  'noise-seed'?: number
}

export interface Palette {
  id: string
  name: string
  hexColors: string[]
}

export interface ProcessingParams {
  curve: Curve
  distortionControl: DistortionControl | null
  palette: Palette | null
  centerOffsetX?: number
  centerOffsetY?: number
}

export interface CoordinateResult {
  worldX: number
  worldY: number
  finalDistance: number
  curveValue: number
  color: { r: number; g: number; b: number; a: number }
}

export class UnifiedCoordinateProcessor {
  private static instance: UnifiedCoordinateProcessor | null = null
  private distortionControlCache = new Map<string, DistortionControl>()
  private paletteCache = new Map<string, Palette>()

  static getInstance(): UnifiedCoordinateProcessor {
    if (!this.instance) {
      this.instance = new UnifiedCoordinateProcessor()
    }
    return this.instance
  }

  /**
   * Load distortion control for a curve (follows linking system)
   */
  async loadDistortionControlForCurve(curveName: string): Promise<DistortionControl | null> {
    try {
      const response = await fetch(`${apiUrl}/api/distortion-control-links/curve/${curveName}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data.hasLink && data.data.distortionControl) {
          const control = data.data.distortionControl
          this.distortionControlCache.set(curveName, control)
          return control
        }
      }
    } catch (error) {
      console.error('Failed to load distortion control for curve:', error)
    }
    return null
  }

  /**
   * Load palette for a curve (follows linking system)
   */
  async loadPaletteForCurve(curveName: string): Promise<Palette | null> {
    try {
      const response = await fetch(`${apiUrl}/api/curve-palette-links/curve/${curveName}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data.hasLink) {
          // Get full palette data
          const paletteResponse = await fetch(`${apiUrl}/api/palettes/${data.data.link.paletteId}`)
          if (paletteResponse.ok) {
            const paletteData = await paletteResponse.json()
            if (paletteData.success) {
              const palette = paletteData.data
              this.paletteCache.set(curveName, palette)
              return palette
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load palette for curve:', error)
    }
    return null
  }

  /**
   * Distance calculation helper function (from Merzbow Pipeline F)
   */
  private calculateDistance(x: number, y: number, method: string): number {
    switch (method) {
      case 'cartesian-x': return Math.abs(x)
      case 'cartesian-y': return Math.abs(y)
      case 'radial': 
      default: return Math.sqrt(x * x + y * y)
      
      // Classic Metrics
      case 'manhattan': return Math.abs(x) + Math.abs(y)
      case 'chebyshev': return Math.max(Math.abs(x), Math.abs(y))
      case 'minkowski-3': return Math.pow(Math.pow(Math.abs(x), 3) + Math.pow(Math.abs(y), 3), 1/3)
      
      // Geometric
      case 'hexagonal': {
        const dx = Math.abs(x)
        const dy = Math.abs(y)
        return Math.max(dx, dy, (dx + dy) / 2)
      }
      case 'triangular': return Math.abs(x) + Math.abs(y) + Math.abs(x + y)
      case 'spiral': return Math.sqrt(x * x + y * y) + Math.atan2(y, x) * 10
      case 'cross': return Math.min(Math.abs(x), Math.abs(y))
      
      // Wave-based
      case 'sine-wave': return Math.abs(Math.sin(x * 0.1)) + Math.abs(Math.sin(y * 0.1))
      case 'ripple': return Math.abs(Math.sin(Math.sqrt(x * x + y * y) * 0.1)) * 100
      case 'interference': return Math.abs(Math.sin(x * 0.1) * Math.sin(y * 0.1)) * 100
      
      // Exotic
      case 'hyperbolic': return Math.abs(x * y) * 0.01
      case 'polar-rose': {
        const r = Math.sqrt(x * x + y * y)
        const theta = Math.atan2(y, x)
        const k = 4 // 4-petal rose
        return r * Math.abs(Math.cos(k * theta))
      }
      case 'lemniscate': {
        const a = 50 // scale factor
        return Math.sqrt((x * x + y * y) * (x * x + y * y) - 2 * a * a * (x * x - y * y))
      }
      case 'logarithmic': return Math.log(Math.sqrt(x * x + y * y) + 1) * 50
    }
  }

  /**
   * Process single coordinate using Pipeline F
   */
  processCoordinate(
    worldX: number,
    worldY: number,
    params: ProcessingParams,
    centerOffsetX: number = 0,
    centerOffsetY: number = 0
  ): CoordinateResult {
    const { curve, distortionControl, palette } = params

    // Use defaults if no distortion control
    const distortion = distortionControl || {
      'angular-distortion': false,
      'fractal-distortion': false,
      'checkerboard-pattern': false,
      'distance-calculation': 'radial',
      'distance-modulus': 0,
      'curve-scaling': 1.0,
      'checkerboard-steps': 50,
      'angular-frequency': 0,
      'angular-amplitude': 0,
      'angular-offset': 0,
      'fractal-scale-1': 0,
      'fractal-scale-2': 0,
      'fractal-scale-3': 0,
      'fractal-strength': 1
    } as DistortionControl

    // Apply center offset
    const offsetX = worldX + centerOffsetX
    const offsetY = worldY + centerOffsetY

    // Pipeline F processing
    const trueDistance = this.calculateDistance(offsetX, offsetY, distortion['distance-calculation'])

    // Virtual centers via coordinate modulus
    let processedX = offsetX
    let processedY = offsetY

    if (distortion['distance-modulus'] > 0) {
      const modulus = distortion['distance-modulus']
      processedX = ((offsetX % modulus) + modulus) % modulus - modulus/2
      processedY = ((offsetY % modulus) + modulus) % modulus - modulus/2
    }

    // Fractal distortion (coordinates) - FIRST
    if (distortion['fractal-distortion']) {
      const scale1X = Math.sin(processedX * distortion['fractal-scale-1']) * distortion['fractal-strength'] * 0.3
      const scale1Y = Math.cos(processedY * distortion['fractal-scale-1']) * distortion['fractal-strength'] * 0.3
      
      const scale2X = Math.sin(processedX * distortion['fractal-scale-2']) * distortion['fractal-strength'] * 0.2
      const scale2Y = Math.cos(processedY * distortion['fractal-scale-2']) * distortion['fractal-strength'] * 0.2
      
      const scale3X = Math.sin(processedX * distortion['fractal-scale-3']) * distortion['fractal-strength'] * 0.1
      const scale3Y = Math.cos(processedY * distortion['fractal-scale-3']) * distortion['fractal-strength'] * 0.1
      
      processedX += scale1X + scale2X + scale3X
      processedY += scale1Y + scale2Y + scale3Y
    }

    // Angular distortion (coordinates) - AFTER fractal
    const effectiveAngularEnabled = distortion['angular-distortion'] && 
      (distortion['angular-frequency'] !== 0 || distortion['angular-amplitude'] !== 0 || distortion['angular-offset'] !== 0)
    
    if (effectiveAngularEnabled) {
      const angle = Math.atan2(processedY, processedX) + (distortion['angular-offset'] * Math.PI / 180.0)
      const distortedAngle = angle + Math.sin(angle * distortion['angular-frequency']) * distortion['angular-amplitude'] * 0.01
      const currentDistance = Math.sqrt(processedX * processedX + processedY * processedY)
      processedX = currentDistance * Math.cos(distortedAngle)
      processedY = currentDistance * Math.sin(distortedAngle)
    }

    // Calculate final distance
    const baseDistance = this.calculateDistance(processedX, processedY, distortion['distance-calculation'])
    let finalDistance = baseDistance

    // Fractal distortion (distance) - FIRST
    if (distortion['fractal-distortion']) {
      const distScale1 = Math.sin(finalDistance * distortion['fractal-scale-1']) * distortion['fractal-strength'] * 0.3
      const distScale2 = Math.cos(finalDistance * distortion['fractal-scale-2']) * distortion['fractal-strength'] * 0.2
      const distScale3 = Math.sin(finalDistance * distortion['fractal-scale-3']) * distortion['fractal-strength'] * 0.1
      finalDistance += distScale1 + distScale2 + distScale3
    }

    // Angular distortion (distance) - AFTER fractal
    if (effectiveAngularEnabled) {
      const angle = Math.atan2(processedY, processedX) + (distortion['angular-offset'] * Math.PI / 180.0)
      const angularDistortion = Math.sin(angle * distortion['angular-frequency']) * distortion['angular-amplitude']
      finalDistance += angularDistortion
    }

    // Apply curve scaling and calculate index position
    const scaledFinalDistance = finalDistance * distortion['curve-scaling']
    const indexPosition = Math.floor(Math.abs(scaledFinalDistance)) % curve['curve-width']
    let curveValue = curve['curve-data'][indexPosition]

    // Apply checkerboard pattern
    if (distortion['checkerboard-pattern']) {
      const checkerboardDistance = this.calculateDistance(offsetX, offsetY, distortion['distance-calculation'])
      const stepFromCenter = Math.floor(checkerboardDistance / distortion['checkerboard-steps'])
      if (stepFromCenter % 2 === 1) {
        curveValue = 255 - curveValue
      }
    }

    // Generate color from palette or default grayscale
    let color: { r: number; g: number; b: number; a: number }
    
    if (palette && palette.hexColors) {
      const paletteIndex = Math.floor(curveValue) & 0xFF // Force 8-bit index
      const hexColor = palette.hexColors[paletteIndex] || '#000000'
      
      // Parse hex color and force 8-bit values (ignore alpha)
      const r = parseInt(hexColor.slice(1, 3), 16) & 0xFF
      const g = parseInt(hexColor.slice(3, 5), 16) & 0xFF
      const b = parseInt(hexColor.slice(5, 7), 16) & 0xFF
      
      color = { r, g, b, a: 255 }
    } else {
      // Default grayscale (8-bit)
      const gray = Math.floor(curveValue) & 0xFF
      color = { r: gray, g: gray, b: gray, a: 255 }
    }

    return {
      worldX: offsetX,
      worldY: offsetY,
      finalDistance,
      curveValue,
      color
    }
  }

  /**
   * Process multiple coordinates efficiently
   */
  async processCoordinates(
    coordinates: Array<{ x: number; y: number }>,
    params: ProcessingParams,
    centerOffsetX: number = 0,
    centerOffsetY: number = 0
  ): Promise<Map<string, CoordinateResult>> {
    const results = new Map<string, CoordinateResult>()
    
    for (const coord of coordinates) {
      const result = this.processCoordinate(coord.x, coord.y, params, centerOffsetX, centerOffsetY)
      const key = `${coord.x},${coord.y}`
      results.set(key, result)
    }
    
    return results
  }

  /**
   * Load complete processing context for a curve
   */
  async loadProcessingContext(curveName: string): Promise<{
    curve: Curve | null
    distortionControl: DistortionControl | null
    palette: Palette | null
  }> {
    try {
      // Load curve data
      const curveResponse = await fetch(`${apiUrl}/api/curves`)
      let curve: Curve | null = null
      
      if (curveResponse.ok) {
        const curveData = await curveResponse.json()
        if (curveData.success) {
          curve = curveData.data.curves.find((c: any) => c.name === curveName) || null
        }
      }

      // Load linked distortion control
      const distortionControl = await this.loadDistortionControlForCurve(curveName)
      
      // Load linked palette
      const palette = await this.loadPaletteForCurve(curveName)

      console.log(`🎛️ Loaded processing context for ${curveName}:`, {
        curve: !!curve,
        distortionControl: !!distortionControl,
        palette: !!palette
      })

      return { curve, distortionControl, palette }
    } catch (error) {
      console.error('Failed to load processing context:', error)
      return { curve: null, distortionControl: null, palette: null }
    }
  }

  /**
   * Generate image data using Pipeline F
   */
  generateImageData(
    width: number,
    height: number,
    params: ProcessingParams,
    centerOffsetX: number = 0,
    centerOffsetY: number = 0
  ): ImageData {
    const imageData = new ImageData(width, height)
    const data = imageData.data

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4

        // Convert to world coordinates
        const worldX = (x - width / 2) + centerOffsetX
        const worldY = (y - height / 2) + centerOffsetY

        try {
          const result = this.processCoordinate(worldX, worldY, params, 0, 0)
          
          data[pixelIndex + 0] = result.color.r
          data[pixelIndex + 1] = result.color.g
          data[pixelIndex + 2] = result.color.b
          data[pixelIndex + 3] = result.color.a
        } catch (error) {
          // Red for errors
          data[pixelIndex + 0] = 255
          data[pixelIndex + 1] = 0
          data[pixelIndex + 2] = 0
          data[pixelIndex + 3] = 255
        }
      }
    }

    return imageData
  }
}

// Export singleton instance
export const unifiedCoordinateProcessor = UnifiedCoordinateProcessor.getInstance()
