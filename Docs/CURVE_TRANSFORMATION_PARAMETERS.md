# Curve Transformation Parameters

## Overview
This document explains how the key transformation parameters (distortion, frequency, angular, and value scales) work to affect the position on the curve data and its resulting values in the Cnidaria terrain generation system.

## 1. Frequency Scaling

### 1.1 Basic Frequency Concept
- **Frequency**: Controls how many complete cycles of the noise pattern occur across the curve width
- **Mathematical Representation**: `f(x) = sin(2π * frequency * x / width)`
- **Effect on Position**: Higher frequency means more cycles, effectively "compressing" the pattern

### 1.2 Frequency Impact on Curve Positioning
```
Low Frequency (0.5):
- Pattern repeats 0.5 times across the curve
- Each cycle uses 2 * width pixels
- Smooth, gradual transitions between values

Medium Frequency (1.0):
- Pattern repeats exactly once across the curve
- Each cycle uses width pixels
- Balanced pattern distribution

High Frequency (4.0):
- Pattern repeats 4 times across the curve
- Each cycle uses width/4 pixels
- Rapid, detailed transitions
```

### 1.3 Frequency and Index Mapping
```python
def apply_frequency_scaling(index, frequency, curve_width):
    # Scale the index by frequency
    scaled_index = (index * frequency) % curve_width
    
    # Ensure the result is within bounds
    if scaled_index < 0:
        scaled_index += curve_width
    
    return int(scaled_index)
```

## 2. Angular Distortion

### 2.1 Angular Distortion Concept
- **Angular Distortion**: Applies non-linear transformations to the index based on angular relationships
- **Purpose**: Creates organic, non-uniform terrain patterns that mimic natural geological formations
- **Mathematical Basis**: Uses trigonometric functions to distort the linear index progression

### 2.2 Angular Distortion Effects
```
No Angular Distortion:
- Linear index progression: 0, 1, 2, 3, 4, 5...
- Uniform terrain distribution
- Predictable patterns

With Angular Distortion:
- Non-linear index progression: 0, 1.2, 2.8, 3.1, 4.9, 5.3...
- Organic, irregular terrain distribution
- Natural-looking variations
```

### 2.3 Angular Distortion Implementation
```python
def apply_angular_distortion(index, distortion_strength, curve_width):
    # Convert index to normalized position (0 to 2π)
    angle = (index / curve_width) * 2 * math.pi
    
    # Apply distortion using sine wave modulation
    distortion = math.sin(angle * distortion_strength) * distortion_strength
    
    # Apply the distortion to the index
    distorted_index = index + distortion
    
    # Wrap around and clamp to valid range
    distorted_index = distorted_index % curve_width
    distorted_index = max(0, min(distorted_index, curve_width - 1))
    
    return distorted_index
```

## 3. Index Distortion

### 3.1 Index Distortion Concept
- **Index Distortion**: Applies mathematical transformations to the base index before accessing curve data
- **Purpose**: Creates more complex and interesting terrain patterns by warping the coordinate space
- **Types**: 
  - **Perlin-based distortion**: Uses Perlin noise to create smooth, organic distortions
  - **Fractal distortion**: Combines multiple octaves of distortion for complex patterns
  - **Custom distortion**: User-defined distortion functions

### 3.2 Index Distortion Effects on Positioning
```
Base Index: 100
No Distortion: curve_data[100]

With Perlin Distortion:
- distortion_offset = perlin_noise(100 * 0.01) * 50
- distorted_index = 100 + distortion_offset
- Result: curve_data[distorted_index] where distorted_index varies around 100

With Fractal Distortion:
- distortion_offset = fractal_noise(100 * 0.01, octaves=4) * 100
- distorted_index = 100 + distortion_offset
- Result: curve_data[distorted_index] with complex, multi-scale variations
```

### 3.3 Index Distortion Implementation
```python
def apply_index_distortion(base_index, distortion_type, distortion_params, curve_width):
    if distortion_type == "perlin":
        # Apply Perlin noise-based distortion
        noise_input = base_index * distortion_params.get('scale', 0.01)
        distortion_offset = perlin_noise(noise_input) * distortion_params.get('strength', 50)
        
    elif distortion_type == "fractal":
        # Apply fractal noise-based distortion
        noise_input = base_index * distortion_params.get('scale', 0.01)
        octaves = distortion_params.get('octaves', 4)
        distortion_offset = fractal_noise(noise_input, octaves) * distortion_params.get('strength', 100)
        
    else:
        distortion_offset = 0
    
    # Apply distortion to base index
    distorted_index = base_index + distortion_offset
    
    # Wrap around and clamp to valid range
    distorted_index = distorted_index % curve_width
    distorted_index = max(0, min(distorted_index, curve_width - 1))
    
    return int(distorted_index)
```

## 4. Value Scaling

### 4.1 Value Scaling Concept
- **Value Scaling**: Multiplies the retrieved curve value by a scaling factor
- **Purpose**: Controls the amplitude/intensity of the terrain features
- **Range**: Typically 0.0 to 2.0, where 1.0 is the original value

### 4.2 Value Scaling Effects
```
Original Value: 0.5
Scale Factor: 0.5 → Scaled Value: 0.25 (reduced intensity)
Scale Factor: 1.0 → Scaled Value: 0.5 (original intensity)
Scale Factor: 1.5 → Scaled Value: 0.75 (increased intensity)
Scale Factor: 2.0 → Scaled Value: 1.0 (maximum intensity)
```

### 4.3 Value Scaling Implementation
```python
def apply_value_scaling(raw_value, scale_factor):
    # Apply scaling factor
    scaled_value = raw_value * scale_factor
    
    # Clamp to valid range (0.0 to 1.0)
    scaled_value = max(0.0, min(scaled_value, 1.0))
    
    return scaled_value
```

## 5. Combined Transformation Pipeline

### 5.1 Transformation Order
The transformation parameters are applied in a specific order to achieve the desired terrain effect:

1. **Base Index Calculation**: Calculate initial index from coordinates
2. **Frequency Scaling**: Apply frequency to compress/expand the pattern
3. **Angular Distortion**: Apply angular-based distortions for organic patterns
4. **Index Distortion**: Apply Perlin/fractal distortions for complexity
5. **Value Retrieval**: Get the base value from the curve data
6. **Value Scaling**: Scale the retrieved value for intensity control

### 5.2 Complete Transformation Example
```python
def transform_coordinate_to_terrain_value(x, y, coordinate_mode, curve_data, params):
    # 1. Calculate base index
    if coordinate_mode == "radial":
        base_index = calculate_radial_index(x, y, params)
    else:  # cartesian
        base_index = calculate_cartesian_index(x, y, params)
    
    # 2. Apply frequency scaling
    frequency = params.get('frequency', 1.0)
    freq_scaled_index = apply_frequency_scaling(base_index, frequency, len(curve_data))
    
    # 3. Apply angular distortion
    angular_strength = params.get('angular_distortion', 0.0)
    angular_distorted_index = apply_angular_distortion(
        freq_scaled_index, angular_strength, len(curve_data)
    )
    
    # 4. Apply index distortion
    distortion_type = params.get('distortion_type', 'none')
    distortion_params = params.get('distortion_params', {})
    final_index = apply_index_distortion(
        angular_distorted_index, distortion_type, distortion_params, len(curve_data)
    )
    
    # 5. Retrieve base value
    base_value = curve_data[final_index]
    
    # 6. Apply value scaling
    value_scale = params.get('value_scaling', 1.0)
    final_value = apply_value_scaling(base_value, value_scale)
    
    return final_value
```

## 6. Parameter Interactions and Effects

### 6.1 Frequency + Angular Distortion
```
Low Frequency + High Angular Distortion:
- Creates broad, organic terrain features
- Angular distortion adds natural variation to large-scale patterns
- Result: Rolling hills with natural irregularities

High Frequency + Low Angular Distortion:
- Creates detailed, structured terrain features
- Angular distortion adds subtle organic touches
- Result: Detailed terrain with slight natural variation
```

### 6.2 Index Distortion + Value Scaling
```
High Index Distortion + Low Value Scaling:
- Creates complex, varied terrain patterns
- Low scaling reduces overall intensity
- Result: Complex but subtle terrain features

Low Index Distortion + High Value Scaling:
- Creates simple, intense terrain patterns
- High scaling amplifies existing features
- Result: Simple but dramatic terrain features
```

### 6.3 All Parameters Combined
```
Balanced Parameters:
- Frequency: 1.0 (natural scale)
- Angular Distortion: 0.3 (subtle organic variation)
- Index Distortion: 0.5 (moderate complexity)
- Value Scaling: 1.0 (natural intensity)
- Result: Natural-looking terrain with organic variation and moderate complexity

Extreme Parameters:
- Frequency: 4.0 (high detail)
- Angular Distortion: 1.0 (strong organic variation)
- Index Distortion: 1.0 (high complexity)
- Value Scaling: 2.0 (maximum intensity)
- Result: Highly detailed, complex terrain with strong organic patterns and maximum intensity
```

## 7. Performance Considerations

### 7.1 Computational Complexity
```
Parameter Impact on Performance:
- Frequency: Minimal impact (simple multiplication)
- Angular Distortion: Low impact (trigonometric functions)
- Index Distortion: Medium impact (noise generation)
- Value Scaling: Minimal impact (simple multiplication)

Optimization Strategies:
- Cache distortion calculations for repeated coordinates
- Use lookup tables for trigonometric functions
- Implement progressive distortion (start simple, add complexity)
```

### 7.2 Memory Usage
```
Memory Requirements:
- Base curve data: O(width)
- Distortion caches: O(cache_size)
- Parameter storage: O(1) per parameter
- Total: O(width + cache_size)
```

## 8. Quality and Artifact Prevention

### 8.1 Common Artifacts
```
Frequency Artifacts:
- Aliasing: Use anti-aliasing techniques for high frequencies
- Seam discontinuities: Ensure seamless looping

Distortion Artifacts:
- Index wrapping: Proper modulo operations
- Bounds checking: Clamp indices to valid range
- Smooth transitions: Use smooth noise functions

Scaling Artifacts:
- Value clamping: Prevent values outside valid range
- Precision loss: Maintain sufficient precision
```

### 8.2 Quality Assurance
```
Validation Checks:
- Index bounds: 0 ≤ index < curve_width
- Value range: 0.0 ≤ value ≤ 1.0
- Parameter ranges: Validate all parameter inputs
- Smoothness: Check for discontinuities in output
```

## 9. API Integration

### 9.1 Parameter Transmission
```json
{
  "frequency": 1.5,
  "angular_distortion": 0.4,
  "distortion_type": "perlin",
  "distortion_params": {
    "scale": 0.01,
    "strength": 75,
    "octaves": 3
  },
  "value_scaling": 1.2
}
```

### 9.2 Response Processing
```python
def process_api_response(api_response, coordinates):
    terrain_values = []
    
    for coord in coordinates:
        # Extract transformed value from API response
        value = api_response.get(f"{coord[0]}_{coord[1]}")
        
        # Apply any additional local processing if needed
        processed_value = apply_local_post_processing(value)
        
        terrain_values.append(processed_value)
    
    return terrain_values
```

## 10. Future Enhancements

### 10.1 Advanced Distortion Types
- **Voronoi-based distortion**: Use Voronoi diagrams for cellular patterns
- **Wave-based distortion**: Apply wave functions for fluid-like patterns
- **Custom mathematical functions**: User-defined distortion equations

### 10.2 Adaptive Parameters
- **Terrain-aware scaling**: Adjust parameters based on terrain complexity
- **Performance-based optimization**: Automatically adjust detail level based on performance
- **User preference learning**: Learn and apply user's preferred parameter combinations

---

## Summary

The transformation parameters work together to create rich, varied terrain:

- **Frequency** controls the scale and density of terrain features
- **Angular Distortion** adds organic, non-linear variations
- **Index Distortion** introduces complexity and natural randomness
- **Value Scaling** controls the intensity and visibility of features

When combined in the transformation pipeline, these parameters allow for the creation of diverse terrain types ranging from simple, structured landscapes to complex, organic formations that closely mimic natural geological processes.

The system maintains performance through intelligent caching and optimization while providing the flexibility to create virtually any type of terrain pattern desired by the user.
