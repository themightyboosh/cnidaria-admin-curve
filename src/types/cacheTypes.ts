/**
 * Cache Types for Unified Coordinate Cache
 * Part of Phase 2.1: Unified Coordinate Cache
 */

import { CoordinateResult, ViewportBounds } from './coordinateTypes'

/**
 * Cache metadata for tracking cache state and performance
 */
export interface CacheMetadata {
  /** Last curve ID used */
  lastCurveId?: string
  /** Last noise pattern used */
  lastNoisePattern?: string
  /** Last cache update timestamp */
  lastUpdate?: number
  /** Total cache hits */
  totalHits: number
  /** Total cache misses */
  totalMisses: number
  /** Cache generation version for invalidation */
  version: number
}

/**
 * Cache statistics for monitoring and optimization
 */
export interface CacheStats {
  /** Number of cached coordinates */
  size: number
  /** Cache hit rate (0-1) */
  hitRate: number
  /** Memory usage estimate in bytes */
  memoryUsage: number
  /** Age of cache in milliseconds */
  age: number
  /** Cache metadata */
  metadata: CacheMetadata
}

/**
 * Cache invalidation strategies
 */
export type InvalidationStrategy = 'curve-change' | 'noise-change' | 'manual' | 'time-based'

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Maximum number of coordinates to cache */
  maxSize: number
  /** Maximum age in milliseconds before invalidation */
  maxAge: number
  /** Enable automatic cleanup of old entries */
  autoCleanup: boolean
  /** Cleanup interval in milliseconds */
  cleanupInterval: number
}
