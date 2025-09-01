# Coordinate Noise API Reference

## Overview
The Coordinate Noise API provides CRUD operations for managing coordinate noise patterns in Firebase. All endpoints automatically calculate CPU load levels (1-10) and generate GPU descriptions from expression complexity.

**Base URL:** `https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev`

### Firebase Collections
- **`curves`** - Mathematical curves and their data
- **`tags`** - Curve tags and categories
- **`noise`** - Coordinate noise patterns (38 patterns migrated)

## Data Structure

### Coordinate Noise Type Object
```json
{
  "id": "radial-lm",
  "name": "radial",
  "description": "Classic circular distance (x + y)",
  "cpuLoadLevel": 3,
  "gpuExpression": "sqrt(x * x + y * y)",
  "gpuDescription": "Radial distance calculation using square root",
  "category": "circular",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Field Descriptions
- **id**: Kebab-case identifier (auto-generated from name)
- **name**: Kebab-case pattern name (no icons/emojis)
- **description**: Human-readable description (no icons/emojis)
- **cpuLoadLevel**: Calculated complexity (1-10) from expression analysis
- **gpuExpression**: WebGPU-compatible mathematical expression
- **gpuDescription**: Auto-generated description of the expression
- **category**: Kebab-case category (e.g., "circular", "custom")

## Endpoints

### 1. Get All Coordinate Noise Types from Firebase
**GET** `/api/coordinate-noise/firebase`

Returns all coordinate noise types stored in Firebase, sorted by CPU load level.

**Response:**
```json
{
  "success": true,
  "data": {
    "noiseTypes": [
      {
        "id": "radial-lm",
        "name": "radial",
        "description": "Classic circular distance",
        "cpuLoadLevel": 3,
        "gpuExpression": "sqrt(x * x + y * y)",
        "gpuDescription": "Radial distance calculation using square root",
        "category": "circular",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 1,
    "cpuLoadDistribution": {
      "3": 1
    }
  },
  "message": "Coordinate noise types retrieved from Firebase successfully"
}
```

### 2. Create New Coordinate Noise Type
**POST** `/api/coordinate-noise`

Creates a new coordinate noise type. The API automatically:
- Calculates CPU load level (1-10) from expression complexity
- Generates GPU description from expression analysis
- Converts name to kebab-case
- Removes icons/emojis from all text fields

**Request Body:**
```json
{
  "name": "My Custom Pattern",
  "gpuExpression": "sqrt(x * x + y * y) * (1.0 + 0.3 * sin(atan(y, x) * 3.0))",
  "description": "A custom radial pattern with angular modulation",
  "category": "custom"
}
```

**Required Fields:**
- `name`: Pattern name (will be converted to kebab-case)
- `gpuExpression`: WebGPU-compatible mathematical expression

**Optional Fields:**
- `description`: Human-readable description
- `category`: Pattern category (defaults to "custom")

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "my-custom-pattern",
    "name": "my-custom-pattern",
    "description": "A custom radial pattern with angular modulation",
    "cpuLoadLevel": 5,
    "gpuExpression": "sqrt(x * x + y * y) * (1.0 + 0.3 * sin(atan(y, x) * 3.0))",
    "gpuDescription": "Radial distance with angular modulation using square root, sine, arctangent",
    "category": "custom",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Coordinate noise type created successfully"
}
```

### 3. Update Coordinate Noise Type
**PUT** `/api/coordinate-noise/{id}`

Updates an existing coordinate noise type. If `gpuExpression` is changed, CPU load level and GPU description are automatically recalculated.

**Request Body:**
```json
{
  "name": "Updated Pattern Name",
  "gpuExpression": "sqrt(x * x + y * y) * (1.0 + 0.5 * sin(atan(y, x) * 4.0))",
  "description": "Updated description",
  "category": "wave"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "radial-lm",
    "name": "updated-pattern-name",
    "description": "Updated description",
    "cpuLoadLevel": 6,
    "gpuExpression": "sqrt(x * x + y * y) * (1.0 + 0.5 * sin(atan(y, x) * 4.0))",
    "gpuDescription": "Radial distance with angular modulation using square root, sine, arctangent",
    "category": "wave",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T01:00:00.000Z"
  },
  "message": "Coordinate noise type updated successfully"
}
```

### 4. Delete Coordinate Noise Type
**DELETE** `/api/coordinate-noise/{id}`

Deletes a coordinate noise type from Firebase.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "radial-lm",
    "deleted": true
  },
  "message": "Coordinate noise type deleted successfully"
}
```

## CPU Load Level Calculation

The API automatically calculates CPU load levels (1-10) based on expression complexity:

### Complexity Factors
- **sqrt()**: +2 complexity
- **pow()**: +3 complexity
- **sin()/cos()**: +1 complexity each
- **atan()**: +2 complexity
- **abs()**: +1 complexity
- **floor()**: +2 complexity
- **max()/min()**: +1 complexity each
- **Operations (+/-/*/)**: +0.5 each
- **Nested parentheses**: +0.3 each level
- **High-frequency operations**: +2 for multipliers ≥8.0

### Examples
- `"abs(x)"` → Level 1 (basic)
- `"sqrt(x * x + y * y)"` → Level 3 (radial)
- `"sqrt(x * x + y * y) * (1.0 + 0.3 * sin(atan(y, x) * 3.0))"` → Level 5 (complex)
- `"pow(sqrt(x * x + y * y), 1.5) * (1.0 + 0.7 * abs(sin(atan(y, x) * 8.0)))"` → Level 8 (very complex)

## GPU Description Generation

The API automatically generates GPU descriptions by analyzing the expression:

### Description Logic
- **Radial + Angular**: "Radial distance with angular modulation"
- **Radial only**: "Radial distance calculation"
- **Cartesian**: "Cartesian coordinate processing"
- **Trigonometric**: "Trigonometric coordinate transformation"
- **Other**: "Coordinate-based mathematical operation"

### Examples
- `"sqrt(x * x + y * y)"` → "Radial distance calculation using square root"
- `"sqrt(x * x + y * y) * (1.0 + 0.3 * sin(atan(y, x) * 3.0))"` → "Radial distance with angular modulation using square root, sine, arctangent"
- `"abs(x) + abs(y)"` → "Cartesian coordinate processing using absolute value"

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "MISSING_REQUIRED_FIELDS",
    "message": "Name and GPU expression are required",
    "required": ["name", "gpuExpression"]
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOISE_TYPE_NOT_FOUND",
    "message": "Coordinate noise type not found",
    "noiseId": "non-existent-id"
  }
}
```

### 409 Conflict
```json
{
  "success": false,
  "error": {
    "code": "NOISE_TYPE_EXISTS",
    "message": "Coordinate noise type already exists",
    "noiseId": "existing-id"
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "CREATE_NOISE_ERROR",
    "message": "Failed to create coordinate noise type",
    "details": "Error details here"
  }
}
```

## Usage Examples

### React/TypeScript Example
```typescript
interface CoordinateNoiseType {
  id: string;
  name: string;
  description: string;
  cpuLoadLevel: number;
  gpuExpression: string;
  gpuDescription: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

// Get all noise types
const response = await fetch('https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev/api/coordinate-noise/firebase');
const data = await response.json();
const noiseTypes: CoordinateNoiseType[] = data.data.noiseTypes;

// Create new noise type
const createResponse = await fetch('https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev/api/coordinate-noise', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My Custom Pattern',
    gpuExpression: 'sqrt(x * x + y * y) * (1.0 + 0.3 * sin(atan(y, x) * 3.0))',
    description: 'A custom radial pattern with angular modulation'
  })
});
const newNoiseType = await createResponse.json();
```

## Migration Status

✅ **COMPLETED**: All 37 coordinate noise patterns have been successfully migrated from the static `coordinateNoise.js` file to Firebase.

### Migration Results:
- **Total Patterns**: 38 (37 original + 1 test pattern)
- **Collection**: `noise` (new Firebase collection)
- **CPU Load Distribution**:
  - Level 1: 2 patterns (basic operations)
  - Level 2: 1 pattern (diamond)
  - Level 4: 2 patterns (radial, test)
  - Level 6: 1 pattern (cross)
  - Level 8: 2 patterns (spiral, ripple)
  - Level 9: 2 patterns (pulse, maze)
  - Level 10: 28 patterns (complex patterns)

### Current State:
- **Firebase Collection**: `noise` contains all coordinate noise patterns
- **API Endpoints**: Fully functional for CRUD operations
- **Auto-calculations**: CPU load levels and GPU descriptions working
- **Data Format**: Kebab-case enforced, no icons/emojis

### Migration Script:
The migration was performed using `scripts/migrate-via-api.js` which:
1. Reads patterns from `coordinateNoise.js`
2. Creates each pattern via POST `/api/coordinate-noise`
3. Verifies migration via GET `/api/coordinate-noise/firebase`

### For Future Migrations:
If you need to migrate additional patterns or recreate the collection:
```bash
# Run the migration script
node scripts/migrate-via-api.js

# Or manually create patterns via API
curl -X POST "https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev/api/coordinate-noise" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Pattern", "gpuExpression": "sqrt(x * x + y * y)", "description": "Description", "category": "custom"}'
```

---

**Last Updated:** September 1, 2024  
**API Version:** 1.0.0  
**Environment:** Development  
**Migration Status:** ✅ Complete
