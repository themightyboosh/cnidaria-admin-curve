/**
 * Coordinate Service
 * 
 * THE SINGLE SERVICE for all coordinate requests in the application.
 * 
 * This service provides a unified interface for all coordinate operations,
 * using the global coordinate processor and unified cache for maximum performance.
 * 
 * ALL coordinate requests should go through this service.
 */

import { globalCoordinateProcessor } from './globalCoordinateProcessor'
import { unifiedCoordinateCache } from './unifiedCoordinateCache'
import { CoordinateResult, ViewportBounds, CoordinateOptions } from '../types/coordinateTypes'

export interface CoordinateServiceOptions extends CoordinateOptions {
  /** Enable background prefetching */
  enablePrefetch?: boolean
  /** Prefetch buffer size around requested bounds */
  prefetchBuffer?: number
  /** Use WebGPU when available */
  useWebGPU?: boolean
  /** Force CPU processing */
  forceCPU?: boolean
}

/**
 * The Shared Coordinate Service
 * 
 * Single point of access for all coordinate operations in the application
 */
export class CoordinateService {
  private static instance: CoordinateService | null = null
  private isInitialized = false
  private prefetchQueue: Array<{ curveId: string; bounds: ViewportBounds }> = []
  private isPrefetching = false

  /**
   * Get the singleton instance
   */
  static getInstance(): CoordinateService {
    if (!CoordinateService.instance) {
      CoordinateService.instance = new CoordinateService()
    }
    return CoordinateService.instance
  }

  private constructor() {
    console.log('🌐 Coordinate service initialized - single point for all coordinate requests')
  }

  /**
   * Initialize the coordinate service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    console.log('🚀 Initializing shared coordinate service...')
    
    try {
      // Initialize the global coordinate processor
      await globalCoordinateProcessor.initialize()
      
      this.isInitialized = true
      console.log('✅ Shared coordinate service ready')
      
    } catch (error) {
      console.error('❌ Failed to initialize coordinate service:', error)
      throw error
    }
  }

  /**
   * THE PRIMARY INTERFACE for all coordinate requests
   * 
   * This method should be used by:
   * - PNG generation
   * - Grid rendering  
   * - 3D terrain
   * - WorldView
   * - Any other coordinate processing
   */
  async getCoordinates(
    curveId: string,
    bounds: ViewportBounds,
    options: CoordinateServiceOptions = {}
  ): Promise<Map<string, CoordinateResult>> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const {
      enablePrefetch = true,
      prefetchBuffer = 10,
      useWebGPU = true,
      forceCPU = false
    } = options

    console.log(`🌐 Coordinate service request: ${curveId} bounds (${bounds.minX}, ${bounds.minY}) to (${bounds.maxX}, ${bounds.maxY})`)

    try {
      // Get coordinates using global processor (which uses unified cache)
      const results = await globalCoordinateProcessor.processCoordinates(
        curveId,
        bounds.minX,
        bounds.minY,
        bounds.maxX,
        bounds.maxY,
        { useWebGPU, forceCPU, enableCaching: true }
      )

      // Schedule background prefetching if enabled
      if (enablePrefetch && prefetchBuffer > 0) {
        this.schedulePrefetch(curveId, bounds, prefetchBuffer)
      }

      console.log(`✅ Coordinate service delivered ${results.size} coordinates`)
      return results

    } catch (error) {
      console.error('❌ Coordinate service request failed:', error)
      throw error
    }
  }

  /**
   * Background prefetching for improved performance
   * Prefetches coordinates around the requested bounds
   */
  async prefetchBounds(
    curveId: string,
    bounds: ViewportBounds,
    bufferSize: number = 10
  ): Promise<void> {
    console.log(`🔄 Prefetching coordinates with buffer: ${bufferSize}`)

    const expandedBounds = {
      minX: bounds.minX - bufferSize,
      maxX: bounds.maxX + bufferSize,
      minY: bounds.minY - bufferSize,
      maxY: bounds.maxY + bufferSize
    }

    try {
      await globalCoordinateProcessor.processCoordinates(
        curveId,
        expandedBounds.minX,
        expandedBounds.minY,
        expandedBounds.maxX,
        expandedBounds.maxY,
        { enableCaching: true }
      )

      console.log(`✅ Prefetched coordinates for expanded bounds`)
    } catch (error) {
      console.warn('⚠️ Prefetch failed:', error.message)
    }
  }

  /**
   * Schedule background prefetching (non-blocking)
   */
  private schedulePrefetch(curveId: string, bounds: ViewportBounds, bufferSize: number): void {
    // Add to prefetch queue
    this.prefetchQueue.push({ curveId, bounds: {
      minX: bounds.minX - bufferSize,
      maxX: bounds.maxX + bufferSize,
      minY: bounds.minY - bufferSize,
      maxY: bounds.maxY + bufferSize
    }})

    // Process prefetch queue if not already running
    if (!this.isPrefetching) {
      this.processPrefetchQueue()
    }
  }

  /**
   * Process the prefetch queue in background
   */
  private async processPrefetchQueue(): Promise<void> {
    if (this.isPrefetching || this.prefetchQueue.length === 0) return

    this.isPrefetching = true

    while (this.prefetchQueue.length > 0) {
      const { curveId, bounds } = this.prefetchQueue.shift()!
      
      try {
        await this.prefetchBounds(curveId, bounds)
        // Small delay to avoid blocking main thread
        await new Promise(resolve => setTimeout(resolve, 10))
      } catch (error) {
        console.warn('⚠️ Background prefetch failed:', error.message)
      }
    }

    this.isPrefetching = false
  }

  /**
   * Get coordinate specifically for color mapping (optimized for PNG/matrix generation)
   */
  async getCoordinateForColor(
    curveId: string,
    x: number,
    y: number
  ): Promise<{ indexValue: number; indexPosition: number } | null> {
    // First check cache
    const cached = unifiedCoordinateCache.getCoordinateForColor(x, y)
    if (cached) {
      return cached
    }

    // If not cached, process single coordinate
    const results = await this.getCoordinates(curveId, { minX: x, maxX: x, minY: y, maxY: y })
    const key = `${x}_${y}`
    const result = results.get(key)

    if (result) {
      return {
        indexValue: result.indexValue,
        indexPosition: result.indexPosition
      }
    }

    return null
  }

  /**
   * Bulk coordinate processing for matrix/PNG generation
   */
  async getCoordinatesForMatrix(
    curveId: string,
    width: number,
    height: number,
    centerX: number = 0,
    centerY: number = 0,
    options: CoordinateServiceOptions = {}
  ): Promise<Map<string, CoordinateResult>> {
    const halfWidth = Math.floor(width / 2)
    const halfHeight = Math.floor(height / 2)

    const bounds = {
      minX: centerX - halfWidth,
      maxX: centerX + halfWidth,
      minY: centerY - halfHeight,
      maxY: centerY + halfHeight
    }

    console.log(`🏁 Matrix coordinate request: ${width}×${height} centered at (${centerX}, ${centerY})`)

    return await this.getCoordinates(curveId, bounds, options)
  }

  /**
   * Clear all cached coordinate data
   */
  clearCache(): void {
    unifiedCoordinateCache.clear()
    this.prefetchQueue = []
    console.log('🗑️ Coordinate service cache cleared')
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number
    hitRate: number
    currentCurve: string | null
    prefetchQueueSize: number
  } {
    const cacheStats = unifiedCoordinateCache.getStats()
    
    return {
      ...cacheStats,
      prefetchQueueSize: this.prefetchQueue.length
    }
  }

  /**
   * Get service statistics including global processor stats
   */
  getServiceStats(): {
    cache: { size: number; hitRate: number; currentCurve: string | null }
    processor: { webgpuAvailable: boolean; cachedCurves: number; noisePatterns: number }
    service: { prefetchQueueSize: number; isInitialized: boolean }
  } {
    const cacheStats = unifiedCoordinateCache.getStats()
    const processorStats = globalCoordinateProcessor.getStats()

    return {
      cache: cacheStats,
      processor: {
        webgpuAvailable: processorStats.webgpuAvailable,
        cachedCurves: processorStats.cachedCurves,
        noisePatterns: processorStats.noisePatterns
      },
      service: {
        prefetchQueueSize: this.prefetchQueue.length,
        isInitialized: this.isInitialized
      }
    }
  }
}

/**
 * THE SHARED COORDINATE SERVICE INSTANCE
 * 
 * This is the single point of access for all coordinate operations
 */
export const coordinateService = CoordinateService.getInstance()

// Export as default for convenience
export default coordinateService
