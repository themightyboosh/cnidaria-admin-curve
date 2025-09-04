/**
 * Unified Coordinate Cache
 * 
 * Optimized for matrix/PNG generation where every square needs:
 * - Coordinate (x, y) → Index position in curve → Curve value → Square color
 * 
 * Caching strategy:
 * - Cache any coordinate with its index and index value when loaded
 * - Keep cached until we load a new curve  
 * - Share across all services (PNG generation, grid views, etc.)
 * 
 * Primary beneficiary: Matrix/PNG generation processing thousands of coordinates
 */

import { CoordinateResult, ViewportBounds } from '../types/coordinateTypes'

/**
 * The Unified Coordinate Cache
 * Simple per-curve coordinate caching
 */
export class UnifiedCoordinateCache {
  private cache: Map<string, CoordinateResult> = new Map()
  private currentCurveId: string | null = null
  private currentCacheSignature: string | null = null
  private totalHits = 0
  private totalMisses = 0

  constructor() {
    console.log('🗄️ Unified coordinate cache initialized - cache until curve/distance settings change')
  }

  /**
   * Set a coordinate with its index and index value in the cache
   */
  set(key: string, result: CoordinateResult): void {
    this.cache.set(key, result)
    console.log(`💾 Cached coordinate: ${key} -> value: ${result.indexValue}, pos: ${result.indexPosition}`)
  }

  /**
   * Get a coordinate from the cache
   */
  get(key: string): CoordinateResult | undefined {
    const result = this.cache.get(key)
    
    if (result) {
      this.totalHits++
      return result
    } else {
      this.totalMisses++
      return undefined
    }
  }

  /**
   * Get multiple coordinates for a viewport bounds
   */
  getBounds(bounds: ViewportBounds): Map<string, CoordinateResult> {
    const results = new Map<string, CoordinateResult>()
    
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        const key = `${x}_${y}`
        const result = this.get(key)
        if (result) {
          results.set(key, result)
        }
      }
    }
    
    console.log(`💾 Cache bounds lookup: ${results.size} hits for ${(bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1)} requested`)
    return results
  }

  /**
   * Set multiple coordinates from processing
   */
  setBounds(coordinates: Map<string, CoordinateResult>): void {
    coordinates.forEach((result, key) => {
      this.cache.set(key, result)
    })
    console.log(`💾 Cached ${coordinates.size} coordinates`)
  }

  /**
   * Generate cache signature including all fields that affect coordinate processing
   */
  private generateCacheSignature(curveId: string, coordinateNoise: string, distanceCalc: string, distanceModulus: number): string {
    return `${curveId}_${coordinateNoise}_${distanceCalc}_${distanceModulus}`
  }

  /**
   * Check if cache is valid for the current curve and distance settings
   */
  isValidForCurve(curveId: string, coordinateNoise: string = '', distanceCalc: string = 'radial', distanceModulus: number = 0): boolean {
    const signature = this.generateCacheSignature(curveId, coordinateNoise, distanceCalc, distanceModulus)
    return this.currentCacheSignature === signature
  }

  /**
   * Invalidate cache when curve or distance settings change
   */
  invalidateForCurveChange(curveId: string, coordinateNoise: string = '', distanceCalc: string = 'radial', distanceModulus: number = 0): void {
    const signature = this.generateCacheSignature(curveId, coordinateNoise, distanceCalc, distanceModulus)
    
    if (this.currentCacheSignature !== signature) {
      const oldSize = this.cache.size
      this.cache.clear()
      this.currentCurveId = curveId
      this.currentCacheSignature = signature
      this.totalHits = 0
      this.totalMisses = 0
      
      console.log(`🗑️ Cache invalidated for curve/distance change: ${signature} (cleared ${oldSize} coordinates)`)
      console.log(`   Curve: ${curveId}`)
      console.log(`   Coordinate Noise: ${coordinateNoise}`)
      console.log(`   Distance Calc: ${distanceCalc}`)
      console.log(`   Distance Modulus: ${distanceModulus}`)
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  invalidateForNewCurve(newCurveId: string): void {
    this.invalidateForCurveChange(newCurveId)
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; hitRate: number; currentCurve: string | null } {
    const totalRequests = this.totalHits + this.totalMisses
    const hitRate = totalRequests > 0 ? this.totalHits / totalRequests : 0

    return {
      size: this.cache.size,
      hitRate,
      currentCurve: this.currentCurveId
    }
  }

  /**
   * Get cache hit rate
   */
  getHitRate(): number {
    const totalRequests = this.totalHits + this.totalMisses
    return totalRequests > 0 ? this.totalHits / totalRequests : 0
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    const oldSize = this.cache.size
    this.cache.clear()
    this.currentCurveId = null
    this.totalHits = 0
    this.totalMisses = 0
    console.log(`🗑️ Cache cleared: ${oldSize} coordinates removed`)
  }

  /**
   * Check if cache contains a specific coordinate
   */
  has(key: string): boolean {
    return this.cache.has(key)
  }

  /**
   * Get number of cached coordinates
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Optimized method for PNG/matrix generation
   * Returns cached coordinate data for color determination
   */
  getCoordinateForColor(x: number, y: number): { indexValue: number; indexPosition: number } | null {
    const key = `${x}_${y}`
    const result = this.get(key)
    
    if (result) {
      return {
        indexValue: result.indexValue,    // For curve value → color mapping
        indexPosition: result.indexPosition  // For index-based color mapping
      }
    }
    
    return null
  }

  /**
   * Cache coordinate specifically for PNG/matrix generation
   * Stores the essential data needed for color determination
   */
  cacheCoordinateForColor(x: number, y: number, indexValue: number, indexPosition: number): void {
    const key = `${x}_${y}`
    const result: CoordinateResult = {
      x,
      y,
      indexValue,
      indexPosition,
      curveValue: indexValue
    }
    
    this.set(key, result)
  }

  /**
   * Get cache coverage for a matrix area (useful for PNG generation)
   */
  getMatrixCoverage(width: number, height: number, centerX: number = 0, centerY: number = 0): {
    cached: number
    total: number
    coverage: number
  } {
    let cached = 0
    const total = width * height
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const worldX = x - Math.floor(width / 2) + centerX
        const worldY = y - Math.floor(height / 2) + centerY
        const key = `${worldX}_${worldY}`
        
        if (this.has(key)) {
          cached++
        }
      }
    }
    
    const coverage = total > 0 ? cached / total : 0
    
    return { cached, total, coverage }
  }
}

// Export singleton instance
export const unifiedCoordinateCache = new UnifiedCoordinateCache()
export default unifiedCoordinateCache
