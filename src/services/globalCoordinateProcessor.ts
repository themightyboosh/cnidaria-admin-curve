/**
 * Global Coordinate Processor
 * 
 * THE SINGLE SOURCE OF TRUTH for all coordinate processing in the application.
 * 
 * This is the ONLY way coordinates should be processed anywhere in the app.
 * All other services must use this processor instead of calling removed API endpoints.
 */

import { WebGPUService } from './webgpuService'
import { apiUrl } from '../config/environments'
import { CoordinateResult } from '../types/coordinateTypes'

export interface CurveData {
  id: string
  'curve-name': string
  'curve-width': number
  'curve-height': number
  'curve-index-scaling': number
  'curve-data': number[]
  'coordinate-noise': string
  'distance-modulus'?: number
  'random-seed'?: number
}

export interface CoordinateNoisePattern {
  id: string
  name: string
  gpuExpression: string
  cpuLoadLevel: string
  category: string
  gpuDescription: string
}

export interface ProcessingOptions {
  useWebGPU?: boolean
  forceCPU?: boolean
  enableCaching?: boolean
  scale?: number
}

/**
 * THE GLOBAL COORDINATE PROCESSOR
 */
export class GlobalCoordinateProcessor {
  private static instance: GlobalCoordinateProcessor | null = null
  private webgpuService: WebGPUService | null = null
  private coordinateNoisePatterns: Map<string, CoordinateNoisePattern> = new Map()
  private curvesCache: Map<string, CurveData> = new Map()
  private coordinateCache: Map<string, Map<string, CoordinateResult>> = new Map()
  private isInitialized = false
  private webgpuAvailable = false

  /**
   * Get the singleton instance
   */
  static getInstance(): GlobalCoordinateProcessor {
    if (!GlobalCoordinateProcessor.instance) {
      GlobalCoordinateProcessor.instance = new GlobalCoordinateProcessor()
    }
    return GlobalCoordinateProcessor.instance
  }

  private constructor() {
    // Private constructor to enforce singleton
  }

  /**
   * Initialize the global coordinate processor
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    console.log('🌍 Initializing GLOBAL coordinate processor...')

    try {
      // Check WebGPU availability
      this.webgpuAvailable = await this.checkWebGPUAvailability()
      console.log(`🔥 WebGPU available: ${this.webgpuAvailable}`)

      // Load coordinate noise patterns
      await this.loadCoordinateNoisePatterns()
      
      this.isInitialized = true
      console.log('✅ GLOBAL coordinate processor initialized')
      
    } catch (error) {
      console.error('❌ Failed to initialize GLOBAL coordinate processor:', error)
      throw error
    }
  }

  /**
   * THE MAIN COORDINATE PROCESSING METHOD
   */
  async processCoordinates(
    curveId: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options: ProcessingOptions = {}
  ): Promise<Map<string, CoordinateResult>> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const {
      useWebGPU = true,
      forceCPU = false,
      enableCaching = true,
      scale = 1.0
    } = options

    // Generate cache key
    const cacheKey = `${curveId}_${x1}_${y1}_${x2}_${y2}_${scale}`
    
    // Check cache first
    if (enableCaching && this.coordinateCache.has(cacheKey)) {
      console.log(`💾 Using cached coordinates for ${cacheKey}`)
      return this.coordinateCache.get(cacheKey)!
    }

    console.log(`🌍 GLOBAL coordinate processing: ${curveId} (${x1}, ${y1}) to (${x2}, ${y2})`)

    try {
      let results: Map<string, CoordinateResult>

      // For now, use CPU processing as WebGPU integration needs more work
      console.log('🧮 Using CPU processing')
      results = await this.processWithCPU(curveId, x1, y1, x2, y2, scale)

      // Cache results
      if (enableCaching) {
        this.coordinateCache.set(cacheKey, results)
      }

      console.log(`✅ GLOBAL processing complete: ${results.size} coordinates`)
      return results

    } catch (error) {
      console.error('❌ GLOBAL coordinate processing failed:', error)
      throw error
    }
  }

  /**
   * CPU coordinate processing
   */
  private async processWithCPU(
    curveId: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    scale: number
  ): Promise<Map<string, CoordinateResult>> {
    // Load curve data
    const curve = await this.loadCurve(curveId)
    
    // Get coordinate noise pattern
    const noisePattern = this.coordinateNoisePatterns.get(curve['coordinate-noise'])
    if (noisePattern && (!noisePattern.gpuExpression || noisePattern.gpuExpression.trim() === '')) {
      throw new Error(`Coordinate noise '${curve['coordinate-noise']}' has empty gpuExpression field`)
    }
    
    const results = new Map<string, CoordinateResult>()
    
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        const key = `${x}_${y}`
        
        // Simple distance calculation (can be enhanced with actual noise processing)
        const distance = Math.sqrt(x * x + y * y)
        const scaledDistance = distance * curve['curve-index-scaling'] * scale
        const indexPosition = Math.floor(scaledDistance) % curve['curve-width']
        const indexValue = curve['curve-data'][indexPosition] || 0
        
        results.set(key, {
          x,
          y,
          indexValue,
          indexPosition,
          curveValue: indexValue
        })
      }
    }
    
    return results
  }

  /**
   * Load curve data from API
   */
  private async loadCurve(curveId: string): Promise<CurveData> {
    if (this.curvesCache.has(curveId)) {
      return this.curvesCache.get(curveId)!
    }

    console.log(`📥 Loading curve data: ${curveId}`)
    
    const response = await fetch(`${apiUrl}/api/curves/${curveId}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch curve: ${response.status}`)
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error('API returned error for curve')
    }

    const curve = data.data.curve
    this.curvesCache.set(curveId, curve)
    
    return curve
  }

  /**
   * Load coordinate noise patterns from API
   */
  private async loadCoordinateNoisePatterns(): Promise<void> {
    try {
      console.log('📥 Loading coordinate noise patterns...')
      
      const response = await fetch(`${apiUrl}/api/coordinate-noise`)
      if (!response.ok) {
        throw new Error(`Failed to fetch coordinate noise: ${response.status}`)
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error('API returned error for coordinate noise')
      }

      const patterns = data.data?.coordinateNoise || {}
      Object.entries(patterns).forEach(([key, pattern]: [string, any]) => {
        this.coordinateNoisePatterns.set(key, {
          id: key,
          name: pattern.name || key,
          gpuExpression: pattern.gpuExpression || '',
          cpuLoadLevel: pattern.cpuLoad || 'unknown',
          category: pattern.category || 'unknown',
          gpuDescription: pattern.gpuDescription || ''
        })
      })

      console.log(`✅ Loaded ${this.coordinateNoisePatterns.size} coordinate noise patterns`)
      
    } catch (error) {
      console.warn('⚠️ Failed to load coordinate noise patterns, using fallback')
      this.coordinateNoisePatterns.set('radial', {
        id: 'radial',
        name: 'Radial',
        gpuExpression: 'sqrt(x * x + y * y)',
        cpuLoadLevel: 'low',
        category: 'basic',
        gpuDescription: 'Basic radial coordinate processing'
      })
    }
  }

  /**
   * Check WebGPU availability
   */
  private async checkWebGPUAvailability(): Promise<boolean> {
    try {
      if (!navigator.gpu) return false
      const adapter = await navigator.gpu.requestAdapter()
      return adapter !== null
    } catch {
      return false
    }
  }

  /**
   * Get available coordinate noise patterns
   */
  getCoordinateNoisePatterns(): CoordinateNoisePattern[] {
    return Array.from(this.coordinateNoisePatterns.values())
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.curvesCache.clear()
    this.coordinateCache.clear()
    console.log('🗑️ Cleared GLOBAL coordinate processor cache')
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    webgpuAvailable: boolean
    cachedCurves: number
    cachedCoordinates: number
    noisePatterns: number
  } {
    return {
      webgpuAvailable: this.webgpuAvailable,
      cachedCurves: this.curvesCache.size,
      cachedCoordinates: this.coordinateCache.size,
      noisePatterns: this.coordinateNoisePatterns.size
    }
  }
}

/**
 * THE GLOBAL COORDINATE PROCESSOR INSTANCE
 */
export const globalCoordinateProcessor = GlobalCoordinateProcessor.getInstance()

export default globalCoordinateProcessor
