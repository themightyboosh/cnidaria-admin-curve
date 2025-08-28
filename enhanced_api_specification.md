# Enhanced Cnidaria API Specification

## **Project Context:**
- **API:** Google Cloud Functions (Node.js 20)
- **Database:** Firebase Firestore
- **Framework:** Express-style with CORS enabled
- **Base URL:** `https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api`
- **API Version:** v1 (future-proofing)

---

## **Endpoint 1: POST /api/curves**
**Purpose:** Create a new curve with all required data

### **Request Headers:**
```
Content-Type: application/json
Accept: application/json
```

### **Data Structure:**

#### **Core Curve Properties:**
```json
{
  "curve-name": "string",           // Alpha-numeric-lowercase, spaces become "-", unique
  "curve-description": "string",    // Optional description
  "curve-tags": ["array"],          // Alpha-numeric-lowercase, max 128 tags, 256 chars each
  "curve-width": 89,                // Integer, default: 89
  "curve-height": 256,              // Always 256 (read-only, ignored if set)
  "curve-type": "Radial"            // "Radial" | "Cartesian X" | "Cartesian Y", default: "Radial"
}
```

#### **Curve Data:**
```json
{
  "curve-data": [0.0, 1.5, 2.3, ...]  // Array of floats (0-255), max 65,536 values, length = curve-width
}
```

#### **Curve Generator Values:**
```json
{
  "generator-noise-type": "string",           // Noise algorithm used
  "generator-noise-setting": {                // Key-value pairs, max 24
    "seed": 12345,
    "frequency": 0.5
  },
  "generator-top-shelf": 255,                // Integer, max height (255 - this value)
  "generator-bottom-shelf": 0,               // Integer, min height, default: 0
  "generator-value-fill": 1.0,               // Float 0-1, default: 1.0
  "generator-value-offset": 0                // Integer -128 to 128, default: 0
}
```

#### **Curve Index Distortion Values:**
```json
{
  "index-distortion-distortion_level": 0.5,  // Float, Perlin noise intensity
  "index-distortion-frequency": 0.01,        // Float, noise scale factor
  "index-distortion-angular": 0.3            // Float, sine wave modulation strength
}
```

### **Success Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "firestore-generated-id",
    "curve-name": "mountain-terrain",
    "curve-description": "Rocky mountain landscape",
    "curve-tags": ["mountain", "rocky", "elevated"],
    "curve-width": 89,
    "curve-height": 256,
    "curve-type": "Radial",
    "curve-index-scaling": 0.8,
    "curve-data": [0.0, 1.5, 2.3, ...],
    "generator-noise-type": "perlin",
    "generator-noise-setting": {
      "seed": 12345,
      "frequency": 0.5
    },
    "generator-top-shelf": 255,
    "generator-bottom-shelf": 0,
    "generator-value-fill": 1.0,
    "generator-value-offset": 0,
    "index-distortion-distortion_level": 0.5,
    "index-distortion-frequency": 0.01,
    "index-distortion-angular": 0.3,
    "created_at": "2025-08-27T04:50:11.827Z",
    "updated_at": "2025-08-27T04:50:11.827Z"
  },
  "message": "Curve created successfully",
  "timestamp": "2025-08-27T04:50:11.827Z"
}
```

---

## **Endpoint 2: GET /api/curves/:id**
**Purpose:** Retrieve specific curve by ID or curve-name

### **Request Headers:**
```
Accept: application/json
```

### **Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "firestore-generated-id",
    "curve-name": "mountain-terrain",
    "curve-description": "Rocky mountain landscape",
    "curve-tags": ["mountain", "rocky", "elevated"],
    "curve-width": 89,
    "curve-height": 256,
    "curve-type": "Radial",
    "curve-index-scaling": 0.8,
    "curve-data": [0.0, 1.5, 2.3, ...],
    "generator-noise-type": "perlin",
    "generator-noise-setting": {
      "seed": 12345,
      "frequency": 0.5
    },
    "generator-top-shelf": 255,
    "generator-bottom-shelf": 0,
    "generator-value-fill": 1.0,
    "generator-value-offset": 0,
    "index-distortion-distortion_level": 0.5,
    "index-distortion-frequency": 0.01,
    "index-distortion-angular": 0.3,
    "created_at": "2025-08-27T04:50:11.827Z",
    "updated_at": "2025-08-27T04:50:11.827Z"
  },
  "timestamp": "2025-08-27T04:50:11.827Z"
}
```

---

## **Endpoint 3: PUT /api/curves/:id**
**Purpose:** Update existing curve

### **Request Headers:**
```
Content-Type: application/json
Accept: application/json
```

### **Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "firestore-generated-id",
    "curve-name": "mountain-terrain",
    "curve-description": "Updated rocky mountain landscape",
    "curve-tags": ["mountain", "rocky", "elevated", "updated"],
    "curve-width": 89,
    "curve-height": 256,
    "curve-type": "Radial",
    "curve-index-scaling": 0.9,
    "curve-data": [0.0, 1.8, 2.5, ...],
    "generator-noise-type": "perlin",
    "generator-noise-setting": {
      "seed": 12345,
      "frequency": 0.6
    },
    "generator-top-shelf": 255,
    "generator-bottom-shelf": 0,
    "generator-value-fill": 1.0,
    "generator-value-offset": 5,
    "index-distortion-distortion_level": 0.6,
    "index-distortion-frequency": 0.015,
    "index-distortion-angular": 0.4,
    "created_at": "2025-08-27T04:50:11.827Z",
    "updated_at": "2025-08-27T05:15:22.456Z"
  },
  "message": "Curve updated successfully",
  "timestamp": "2025-08-27T05:15:22.456Z"
}
```

---

## **Endpoint 4: DELETE /api/curves/:id**
**Purpose:** Remove curve with success message

### **Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "firestore-generated-id",
    "curve-name": "mountain-terrain"
  },
  "message": "Curve deleted successfully",
  "timestamp": "2025-08-27T05:20:33.789Z"
}
```

---

## **Endpoint 5: GET /api/curves**
**Purpose:** List all curves with filtering options

### **Query Parameters:**
```
?filter=tags&date=2024-01-01&page=1&limit=20
```

### **Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "curves": [
      {
        "id": "firestore-generated-id-1",
        "curve-name": "mountain-terrain",
        "curve-description": "Rocky mountain landscape",
        "curve-tags": ["mountain", "rocky", "elevated"],
        "curve-type": "Radial",
        "created_at": "2025-08-27T04:50:11.827Z",
        "updated_at": "2025-08-27T04:50:11.827Z"
      },
      {
        "id": "firestore-generated-id-2",
        "curve-name": "desert-plains",
        "curve-description": "Sandy desert landscape",
        "curve-tags": ["desert", "sandy", "flat"],
        "curve-type": "Cartesian X",
        "created_at": "2025-08-26T10:30:15.123Z",
        "updated_at": "2025-08-26T10:30:15.123Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    },
    "filters": {
      "tags": ["mountain", "desert"],
      "date": "2024-01-01",
      "curve_type": null
    }
  },
  "timestamp": "2025-08-27T05:25:44.123Z"
}
```

---

## **Endpoint 6: POST /api/curves/:id/process**
**Purpose:** Process coordinates and return terrain values

### **Request Headers:**
```
Content-Type: application/json
Accept: application/json
```

### **Request Body (Single Coordinate):**
```json
{
  "x": 10,
  "y": 15
}
```

### **Request Body (Grid Coordinates):**
```json
{
  "x1": 10,
  "y1": 15,
  "x2": 25,
  "y2": 30
}
```

### **Success Response - Single Coordinate (200 OK):**
```json
{
  "success": true,
  "data": {
    "coordinates": {
      "x": 10,
      "y": 15
    },
    "result": {
      "terrain_value": 156.78,
      "final_index": 23,
      "coord_key": "10\x1F15",
      "processing_time_ms": 45,
      "cache_source": "computed"
    },
    "mathematical_pipeline": {
      "distance": 18.03,
      "adjusted_distance": 14.42,
      "distorted_index": 23.45,
      "angular_distorted_index": 23.12,
      "final_index": 23
    }
  },
  "timestamp": "2025-08-27T05:30:55.678Z"
}
```

### **Success Response - Grid Coordinates (200 OK):**
```json
{
  "success": true,
  "data": {
    "grid": {
      "x1": 10,
      "y1": 15,
      "x2": 25,
      "y2": 30,
      "width": 16,
      "height": 16,
      "total_cells": 256
    },
    "results": [
      {
        "coordinates": { "x": 10, "y": 15 },
        "terrain_value": 156.78,
        "final_index": 23,
        "coord_key": "10\x1F15",
        "cache_source": "computed"
      },
      {
        "coordinates": { "x": 11, "y": 15 },
        "terrain_value": 142.33,
        "final_index": 19,
        "coord_key": "11\x1F15",
        "cache_source": "cache"
      }
      // ... 254 more results
    ],
    "cache_stats": {
      "hits": 128,
      "misses": 128,
      "newly_cached": 128,
      "processing_time_ms": 2340
    }
  },
  "timestamp": "2025-08-27T05:35:12.345Z"
}
```

---

## **Endpoint 7: GET /api/curves/:id/cache**
**Purpose:** Get curve-specific cache statistics

### **Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "curve_id": "firestore-generated-id",
    "curve_name": "mountain-terrain",
    "cache_stats": {
      "total_keys": 156,
      "hits": 89,
      "misses": 67,
      "hit_rate": 0.57,
      "memory_usage_mb": 2.3,
      "oldest_entry": "2025-08-27T04:50:11.827Z",
      "newest_entry": "2025-08-27T05:30:55.678Z"
    },
    "cache_config": {
      "ttl_seconds": 1800,
      "max_keys": 10000,
      "check_period_seconds": 600
    },
    "recent_activity": [
      {
        "coordinates": "10\x1F15",
        "last_accessed": "2025-08-27T05:30:55.678Z",
        "access_count": 3
      }
    ]
  },
  "timestamp": "2025-08-27T05:40:23.456Z"
}
```

---

## **Endpoint 8: DELETE /api/curves/:id/cache**
**Purpose:** Clear curve-specific cache

### **Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "curve_id": "firestore-generated-id",
    "curve_name": "mountain-terrain",
    "cleared_keys": 156,
    "freed_memory_mb": 2.3
  },
  "message": "Cache cleared successfully",
  "timestamp": "2025-08-27T05:45:34.567Z"
}
```

---

## **Mathematical Pipeline with API Field References:**

### **1. Distance Calculation:**
- **Radial**: `distance = √(x² + y²)` ← Uses input coordinates (x, y)
- **Cartesian X**: `distance = |x|` ← Uses input coordinate (x)
- **Cartesian Y**: `distance = |y|` ← Uses input coordinate (y)

### **2. Index Scaling:**
- `adjusted_distance = distance * curve_index_scaling`
- **curve_index_scaling** ← From your API: `curve-index-scaling` field

### **3. Index Distortion:**
- `noise_input = adjusted_distance * index-distortion-frequency`
- `distortion_offset = perlin_noise(noise_input) * index-distortion-distortion_level`
- `distorted_index = adjusted_distance + distortion_offset`
- **index-distortion-frequency** ← From your API: `index-distortion-frequency` field
- **index-distortion-distortion_level** ← From your API: `index-distortion-distortion_level` field

### **4. Angular Distortion:**
- `angle = (distorted_index / curve_width) * 2π`
- `angular_distortion = sin(angle * index-distortion-angular) * index-distortion-angular`
- `angular_distorted_index = distorted_index + angular_distortion`
- **curve_width** ← From your API: `curve-width` field
- **index-distortion-angular** ← From your API: `index-distortion-angular` field

### **5. Final Index Calculation:**
- `final_index = angular_distorted_index % curve_width`
- `final_index = max(0, min(final_index, curve_width - 1))`
- **curve_width** ← From your API: `curve-width` field

### **6. Return Value:**
- `return curve_data[final_index]`
- **curve_data** ← From your API: `curve-data` array field

---

## **Cache Strategy Specifications:**

### **Grid Validation Rules:**
```
Grid coordinates must satisfy: x2 > x1 AND y2 > y1
Returns error if coordinates don't form valid rectangle
Grid width = x2 - x1 + 1, Grid height = y2 - y1 + 1
```

### **Cache Radius Calculations:**
```
Single Coordinate: Cache 10-cell radius around (x, y)
Grid Coordinates: Cache (grid_width/2) cell radius outside grid boundary
Example: 16x16 grid → cache 8-cell radius around perimeter
```

### **Cache Performance Metrics:**
```
- TTL: 30 minutes (1800 seconds)
- Background caching: Surrounding cells cached automatically
- Cache invalidation: On curve modification/deletion
- Namespace isolation: Per curve-name
```

---

## **Error Handling & Response Codes:**

### **Standard Error Response Format:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description",
    "field": "field_name_where_error_occurred",
    "details": "Additional technical details"
  },
  "timestamp": "ISO-8601 string"
}
```

### **HTTP Status Codes:**
- **200 OK**: Successful operation
- **201 Created**: Curve successfully created
- **400 Bad Request**: Validation errors, malformed data
- **404 Not Found**: Curve not found, invalid ID
- **409 Conflict**: Curve name already exists
- **422 Unprocessable Entity**: Business logic validation failed
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server processing error

### **Specific Error Codes:**

#### **Validation Errors (400):**
- `VALIDATION_ERROR`: General validation failure
- `MISSING_REQUIRED_FIELD`: Required field not provided
- `INVALID_DATA_TYPE`: Wrong data type for field
- `VALUE_OUT_OF_RANGE`: Value exceeds allowed range
- `INVALID_FORMAT`: Data format not acceptable

#### **Business Logic Errors (422):**
- `CURVE_NAME_TAKEN`: Curve name already exists in system
- `INVALID_CURVE_TYPE`: Curve type not in allowed values
- `ARRAY_LENGTH_MISMATCH`: curve-data length ≠ curve-width
- `INVALID_GRID_COORDINATES`: Grid coordinates don't form valid rectangle
- `COORDINATE_OUT_OF_BOUNDS`: Coordinates exceed system limits

#### **Resource Errors (404):**
- `CURVE_NOT_FOUND`: Curve with specified ID/name doesn't exist
- `INVALID_CURVE_ID`: Malformed or invalid curve identifier

#### **System Errors (500):**
- `PROCESSING_ERROR`: Mathematical calculation failure
- `CACHE_ERROR`: Cache operation failure
- `DATABASE_ERROR`: Firestore operation failure

#### **Rate Limiting (429):**
- `RATE_LIMIT_EXCEEDED`: Too many requests, try again later

### **Error Examples:**

#### **Curve Name Already Exists (409):**
```json
{
  "success": false,
  "error": {
    "code": "CURVE_NAME_TAKEN",
    "message": "A curve with name 'mountain-terrain' already exists",
    "field": "curve-name",
    "details": "Choose a different name or use PUT to update existing curve"
  },
  "timestamp": "2025-08-27T04:50:11.827Z"
}
```

#### **Invalid Grid Coordinates (422):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_GRID_COORDINATES",
    "message": "Grid coordinates must form a valid rectangle with (x2,y2) as lower right corner",
    "field": "coordinates",
    "details": "x2 must be > x1 and y2 must be > y1. Received: x1=25, y1=30, x2=10, y2=15"
  },
  "timestamp": "2025-08-27T04:50:11.827Z"
}
```

#### **Validation Error (400):**
```json
{
  "success": false,
  "error": {
    "code": "VALUE_OUT_OF_RANGE",
    "message": "curve-index-scaling must be between 0 and 1.0",
    "field": "curve-index-scaling",
    "details": "Received value: 1.5, allowed range: 0.0 to 1.0"
  },
  "timestamp": "2025-08-27T04:50:11.827Z"
}
```

#### **Rate Limit Exceeded (429):**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later",
    "field": "rate_limit",
    "details": "Limit: 100 requests per minute, reset at: 2025-08-27T05:50:11.827Z"
  },
  "timestamp": "2025-08-27T05:45:11.827Z"
}
```

---

## **API Rate Limiting:**
```
- Default: 100 requests per minute per IP
- Burst: 200 requests per minute for authenticated users
- Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

## **Versioning Strategy:**
```
- Current: /api/curves (v1)
- Future: /api/v2/curves, /api/v3/curves
- Deprecation notices in response headers
- Backward compatibility for 12 months
```

---

## **Reference Items:**

### **CoordKey.ts Integration:**
The API uses the CoordKey utility for generating unique, predictable keys from integer coordinates:
- **Format**: `"x\x1Fy"` where `\x1F` is ASCII Unit Separator
- **Example**: `coordKey(10, 15)` → `"10\x1F15"`
- **Validation**: Only safe integers (±9,007,199,254,740,991) supported

### **Cell Definition:**
When referring to "cells", we mean integer-based coordinates:
- `(0,0)`, `(0,1)`, `(1,0)`, `(1,1)` = 4 cells
- Grid calculations use inclusive ranges: `[x1, x2]` and `[y1, y2]`

---

## **Appendix: Distortion Implementation Details**

### **Angular Distortion:**
- **Purpose**: Creates organic, non-uniform terrain patterns
- **Implementation**: Trigonometric functions with sine wave modulation
- **Effect**: Non-linear index progression for natural-looking variations

### **Index Distortion:**
- **Purpose**: Warps coordinate space for complex terrain patterns
- **Types**: Perlin noise, fractal noise, custom functions
- **Effect**: Smooth, organic distortions around base coordinates

### **Performance Considerations:**
- **Caching**: 30-minute TTL with automatic background population
- **Batch Processing**: Grid requests optimized with parallel calculations
- **Memory Management**: Automatic cleanup of expired cache entries
- **Scalability**: Cloud Functions auto-scaling based on demand
