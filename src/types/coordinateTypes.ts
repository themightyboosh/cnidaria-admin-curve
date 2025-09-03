/**
 * Unified Coordinate Types
 * 
 * This file defines the standardized coordinate data structures used across
 * all services and components. Part of Phase 1.2: Response Shape Normalization.
 */

/**
 * Unified coordinate result - the standard format used internally
 */
export interface CoordinateResult {
  /** X coordinate in world space */
  x: number
  /** Y coordinate in world space */
  y: number
  /** The curve index value (0-255) */
  indexValue: number
  /** Position within the curve array */
  indexPosition: number
  /** Alias for indexValue for clarity in some contexts */
  curveValue?: number
}

/**
 * Standard API response format from /api/curves/{id}/process endpoint
 */
export interface ProcessCoordinateResponse {
  "cell-coordinates": [number, number]
  "coordKey": string
  "index-position": number
  "index-value": number
}

/**
 * API response wrapper - contains curve name as key
 */
export interface CurveDataResponse {
  [curveName: string]: ProcessCoordinateResponse[]
}

/**
 * Viewport bounds for coordinate requests
 */
export interface ViewportBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * Options for coordinate processing
 */
export interface CoordinateOptions {
  /** Whether to include curve value alias */
  includeCurveValue?: boolean
  /** Coordinate key format preference */
  keyFormat?: 'underscore' | 'comma'
}
