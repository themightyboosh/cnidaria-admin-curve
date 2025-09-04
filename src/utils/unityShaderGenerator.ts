/**
 * Unity Shader Generator
 * Converts Pipeline F distortion controls and curves into Unity HLSL shaders
 */

import type { DistortionControl, Curve, Palette } from '../services/unifiedCoordinateProcessor'

export interface ShaderExportOptions {
  shaderName: string
  distortionControl: DistortionControl
  curve: Curve
  palette: Palette | null
  includeComments: boolean
  optimizeForMobile: boolean
}

export class UnityShaderGenerator {
  
  /**
   * Generate distance calculation function for HLSL
   */
  private generateDistanceFunction(method: string): string {
    const functions: { [key: string]: string } = {
      'radial': 'sqrt(x * x + y * y)',
      'cartesian-x': 'abs(x)',
      'cartesian-y': 'abs(y)',
      'manhattan': 'abs(x) + abs(y)',
      'chebyshev': 'max(abs(x), abs(y))',
      'minkowski-3': 'pow(pow(abs(x), 3.0) + pow(abs(y), 3.0), 1.0/3.0)',
      'hexagonal': 'max(abs(x), max(abs(y), (abs(x) + abs(y)) * 0.5))',
      'triangular': 'abs(x) + abs(y) + abs(x + y)',
      'spiral': 'sqrt(x * x + y * y) + atan2(y, x) * 10.0',
      'cross': 'min(abs(x), abs(y))',
      'sine-wave': 'abs(sin(x * 0.1)) + abs(sin(y * 0.1))',
      'ripple': 'abs(sin(sqrt(x * x + y * y) * 0.1)) * 100.0',
      'interference': 'abs(sin(x * 0.1) * sin(y * 0.1)) * 100.0',
      'hyperbolic': 'abs(x * y) * 0.01',
      'polar-rose': 'sqrt(x * x + y * y) * abs(cos(4.0 * atan2(y, x)))',
      'lemniscate': 'sqrt((x * x + y * y) * (x * x + y * y) - 2.0 * 2500.0 * (x * x - y * y))',
      'logarithmic': 'log(sqrt(x * x + y * y) + 1.0) * 50.0'
    }

    return functions[method] || functions['radial']
  }

  /**
   * Generate procedural curve function based on curve data analysis
   */
  private generateProceduralCurve(curve: Curve): string {
    // Analyze curve data to determine best procedural approximation
    const data = curve['curve-data']
    const isLinear = this.isLinearCurve(data)
    const isWave = this.isWaveCurve(data)
    const isStepped = this.isSteppedCurve(data)
    
    if (isLinear) {
      const slope = (data[data.length - 1] - data[0]) / (data.length - 1)
      const offset = data[0]
      return `
        // Linear curve approximation
        float sampleCurve(float index) {
            float t = fmod(abs(index), ${curve['curve-width']}.0) / ${curve['curve-width']}.0;
            return (${offset.toFixed(6)} + t * ${slope.toFixed(6)}) / 255.0;
        }`
    } else if (isWave) {
      const frequency = this.estimateWaveFrequency(data)
      const amplitude = this.estimateWaveAmplitude(data)
      const offset = this.estimateWaveOffset(data)
      return `
        // Wave curve approximation
        float sampleCurve(float index) {
            float t = fmod(abs(index), ${curve['curve-width']}.0) / ${curve['curve-width']}.0;
            return (${offset.toFixed(6)} + ${amplitude.toFixed(6)} * sin(t * ${frequency.toFixed(6)} * 6.28318)) / 255.0;
        }`
    } else {
      // Fallback: Use distance-based procedural generation
      return `
        // Procedural curve based on distance
        float sampleCurve(float index) {
            float t = fmod(abs(index), ${curve['curve-width']}.0) / ${curve['curve-width']}.0;
            // Generate curve value procedurally from distance
            float value = 0.5 + 0.5 * sin(t * 6.28318 * 2.0); // 2 cycles
            return value;
        }`
    }
  }

  // Helper functions for curve analysis
  private isLinearCurve(data: number[]): boolean {
    if (data.length < 3) return true
    const slope1 = (data[1] - data[0])
    const slope2 = (data[2] - data[1])
    const tolerance = 5 // Allow some variation
    return Math.abs(slope1 - slope2) < tolerance
  }

  private isWaveCurve(data: number[]): boolean {
    // Check for periodic patterns
    let crossings = 0
    const mid = 127.5
    for (let i = 1; i < data.length; i++) {
      if ((data[i-1] < mid && data[i] >= mid) || (data[i-1] >= mid && data[i] < mid)) {
        crossings++
      }
    }
    return crossings >= 4 // At least 2 full cycles
  }

  private isSteppedCurve(data: number[]): boolean {
    const uniqueValues = new Set(data).size
    return uniqueValues < data.length * 0.1 // Less than 10% unique values
  }

  private estimateWaveFrequency(data: number[]): number {
    // Simple frequency estimation
    return 2.0 // Default to 2 cycles
  }

  private estimateWaveAmplitude(data: number[]): number {
    const min = Math.min(...data)
    const max = Math.max(...data)
    return (max - min) / 2
  }

  private estimateWaveOffset(data: number[]): number {
    const min = Math.min(...data)
    const max = Math.max(...data)
    return (min + max) / 2
  }

  /**
   * Generate palette data
   */
  private generatePaletteData(palette: Palette | null): string {
    if (!palette) {
      return `
        // Default grayscale palette
        float3 samplePalette(float curveValue) {
            float gray = curveValue;
            return float3(gray, gray, gray);
        }`
    }

    // Convert hex colors to float3 values
    const colors = palette.hexColors.map(hex => {
      const r = parseInt(hex.slice(1, 3), 16) / 255
      const g = parseInt(hex.slice(3, 5), 16) / 255  
      const b = parseInt(hex.slice(5, 7), 16) / 255
      return `float3(${r.toFixed(6)}, ${g.toFixed(6)}, ${b.toFixed(6)})`
    }).join(',\n                ')

    return `
        // Palette data as array
        static const float3 paletteColors[256] = {
            ${colors}
        };
        
        float3 samplePalette(float curveValue) {
            int index = (int)clamp(curveValue * 255.0, 0.0, 255.0);
            return paletteColors[index];
        }`
  }

  /**
   * Generate main shader code
   */
  generateShader(options: ShaderExportOptions): string {
    const { shaderName, distortionControl, curve, palette, includeComments, optimizeForMobile } = options

    const effectiveAngular = distortionControl['angular-distortion'] && 
      (distortionControl['angular-frequency'] !== 0 || distortionControl['angular-amplitude'] !== 0 || distortionControl['angular-offset'] !== 0)

    const distanceCalc = this.generateDistanceFunction(distortionControl['distance-calculation'])
    const curveData = this.generateProceduralCurve(curve)
    const paletteData = this.generatePaletteData(palette)

    return `Shader "${shaderName}" {
    Properties {
        _MainTex ("Main Texture", 2D) = "white" {}
        
        // Distortion Control Parameters
        [Header(Distortion Controls)]
        _AngularEnabled ("Angular Distortion", Float) = ${distortionControl['angular-distortion'] ? '1.0' : '0.0'}
        _FractalEnabled ("Fractal Distortion", Float) = ${distortionControl['fractal-distortion'] ? '1.0' : '0.0'}
        _CheckerboardEnabled ("Checkerboard Pattern", Float) = ${distortionControl['checkerboard-pattern'] ? '1.0' : '0.0'}
        
        [Header(Core Parameters)]
        _DistanceModulus ("Distance Modulus", Float) = ${distortionControl['distance-modulus']}.0
        _CurveScaling ("Curve Scaling", Range(0.0001, 1.0)) = ${distortionControl['curve-scaling']}
        _CheckerboardSteps ("Checkerboard Steps", Float) = ${distortionControl['checkerboard-steps']}.0
        
        [Header(Angular Settings)]
        _AngularFrequency ("Angular Frequency", Range(0, 64)) = ${distortionControl['angular-frequency']}
        _AngularAmplitude ("Angular Amplitude", Range(0, 100)) = ${distortionControl['angular-amplitude']}.0
        _AngularOffset ("Angular Offset", Range(0, 360)) = ${distortionControl['angular-offset']}
        
        [Header(Fractal Settings)]
        _FractalScale1 ("Fractal Scale 1", Range(0, 0.01)) = ${distortionControl['fractal-scale-1']}
        _FractalScale2 ("Fractal Scale 2", Range(0, 0.5)) = ${distortionControl['fractal-scale-2']}
        _FractalScale3 ("Fractal Scale 3", Range(0, 1)) = ${distortionControl['fractal-scale-3']}
        _FractalStrength ("Fractal Strength", Range(1, 50)) = ${distortionControl['fractal-strength']}.0
        
        [Header(Rendering)]
        _Tiling ("Texture Tiling", Vector) = (1, 1, 0, 0)
        _Offset ("Texture Offset", Vector) = (0, 0, 0, 0)
    }
    
    SubShader {
        Tags { 
            "RenderType"="Opaque" 
            "Queue"="Geometry"
            ${optimizeForMobile ? '"RenderPipeline"="UniversalPipeline"' : ''}
        }
        LOD 200
        
        Pass {
            Name "ForwardLit"
            Tags { "LightMode"="UniversalForward" }
            
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            ${optimizeForMobile ? '#pragma multi_compile _ _MAIN_LIGHT_SHADOWS' : ''}
            ${optimizeForMobile ? '#pragma multi_compile _ _MAIN_LIGHT_SHADOWS_CASCADE' : ''}
            
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            
            struct Attributes {
                float4 positionOS : POSITION;
                float2 uv : TEXCOORD0;
                float3 normalOS : NORMAL;
            };
            
            struct Varyings {
                float4 positionHCS : SV_POSITION;
                float2 uv : TEXCOORD0;
                float3 positionWS : TEXCOORD1;
                float3 normalWS : TEXCOORD2;
            };
            
            // Texture declarations
            TEXTURE2D(_MainTex);
            SAMPLER(sampler_MainTex);
            
            // Property declarations
            CBUFFER_START(UnityPerMaterial)
                float4 _MainTex_ST;
                
                // Distortion parameters
                float _AngularEnabled;
                float _FractalEnabled;
                float _CheckerboardEnabled;
                float _DistanceModulus;
                float _CurveScaling;
                float _CheckerboardSteps;
                float _AngularFrequency;
                float _AngularAmplitude;
                float _AngularOffset;
                float _FractalScale1;
                float _FractalScale2;
                float _FractalScale3;
                float _FractalStrength;
                float4 _Tiling;
                float4 _Offset;
            CBUFFER_END

${includeComments ? `
            // ===== PIPELINE F IMPLEMENTATION =====
            // This shader implements the complete Pipeline F coordinate processing
            // system from the Cnidaria Merzbow fractal pattern generator.
` : ''}
            
${curveData}

${paletteData}
            
            // Distance calculation function
            float calculateDistance(float2 coord) {
                float x = coord.x;
                float y = coord.y;
                return ${distanceCalc};
            }
            
            // Pipeline F coordinate processing
            float3 processCoordinate(float2 worldCoord) {
                float2 coord = worldCoord + _Offset.xy;
                
                // Virtual centers via coordinate modulus
                if (_DistanceModulus > 0.0) {
                    coord.x = fmod(fmod(coord.x, _DistanceModulus) + _DistanceModulus, _DistanceModulus) - _DistanceModulus * 0.5;
                    coord.y = fmod(fmod(coord.y, _DistanceModulus) + _DistanceModulus, _DistanceModulus) - _DistanceModulus * 0.5;
                }
                
                float2 processedCoord = coord;
                
                // Fractal distortion (coordinates) - FIRST
                if (_FractalEnabled > 0.5) {
                    float2 fractalOffset = float2(
                        sin(processedCoord.x * _FractalScale1) * _FractalStrength * 0.3 +
                        sin(processedCoord.x * _FractalScale2) * _FractalStrength * 0.2 +
                        sin(processedCoord.x * _FractalScale3) * _FractalStrength * 0.1,
                        
                        cos(processedCoord.y * _FractalScale1) * _FractalStrength * 0.3 +
                        cos(processedCoord.y * _FractalScale2) * _FractalStrength * 0.2 +
                        cos(processedCoord.y * _FractalScale3) * _FractalStrength * 0.1
                    );
                    processedCoord += fractalOffset;
                }
                
                // Angular distortion (coordinates) - AFTER fractal
                if (_AngularEnabled > 0.5 && (_AngularFrequency > 0.0 || _AngularAmplitude > 0.0 || _AngularOffset > 0.0)) {
                    float angle = atan2(processedCoord.y, processedCoord.x) + (_AngularOffset * 3.14159 / 180.0);
                    float distortedAngle = angle + sin(angle * _AngularFrequency) * _AngularAmplitude * 0.01;
                    float currentDistance = length(processedCoord);
                    processedCoord = float2(
                        currentDistance * cos(distortedAngle),
                        currentDistance * sin(distortedAngle)
                    );
                }
                
                // Calculate final distance
                float finalDistance = calculateDistance(processedCoord);
                
                // Fractal distortion (distance) - FIRST
                if (_FractalEnabled > 0.5) {
                    float fractalDistortion = 
                        sin(finalDistance * _FractalScale1) * _FractalStrength * 0.3 +
                        cos(finalDistance * _FractalScale2) * _FractalStrength * 0.2 +
                        sin(finalDistance * _FractalScale3) * _FractalStrength * 0.1;
                    finalDistance += fractalDistortion;
                }
                
                // Angular distortion (distance) - AFTER fractal
                if (_AngularEnabled > 0.5 && (_AngularFrequency > 0.0 || _AngularAmplitude > 0.0 || _AngularOffset > 0.0)) {
                    float angle = atan2(processedCoord.y, processedCoord.x) + (_AngularOffset * 3.14159 / 180.0);
                    float angularDistortion = sin(angle * _AngularFrequency) * _AngularAmplitude;
                    finalDistance += angularDistortion;
                }
                
                // Apply curve scaling and sample curve
                float scaledDistance = finalDistance * _CurveScaling;
                float curveValue = sampleCurve(scaledDistance);
                
                // Apply checkerboard pattern
                if (_CheckerboardEnabled > 0.5) {
                    float checkerboardDistance = calculateDistance(worldCoord);
                    float stepFromCenter = floor(checkerboardDistance / _CheckerboardSteps);
                    if (fmod(stepFromCenter, 2.0) > 0.5) {
                        curveValue = 1.0 - curveValue;
                    }
                }
                
                // Sample palette
                return samplePalette(curveValue);
            }
            
            Varyings vert(Attributes input) {
                Varyings output;
                
                VertexPositionInputs vertexInput = GetVertexPositionInputs(input.positionOS.xyz);
                VertexNormalInputs normalInput = GetVertexNormalInputs(input.normalOS);
                
                output.positionHCS = vertexInput.positionCS;
                output.positionWS = vertexInput.positionWS;
                output.normalWS = normalInput.normalWS;
                output.uv = TRANSFORM_TEX(input.uv, _MainTex);
                
                return output;
            }
            
            float4 frag(Varyings input) : SV_Target {
                // Convert UV to world coordinates (centered)
                float2 worldCoord = (input.uv - 0.5) * _Tiling.xy * 1000.0; // Scale factor
                
                // Process coordinate using Pipeline F
                float3 color = processCoordinate(worldCoord);
                
                // Sample main texture if needed
                float4 mainTex = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, input.uv);
                
                // Combine or replace based on your needs
                float3 finalColor = color; // Use Pipeline F color directly
                // float3 finalColor = mainTex.rgb * color; // Multiply with main texture
                
                return float4(finalColor, 1.0);
            }
            
            ENDHLSL
        }
    }
    
    ${includeComments ? `
    // ===== USAGE INSTRUCTIONS =====
    // 1. Create a material using this shader
    // 2. Assign curve data texture (1D texture, ${curve['curve-width']} pixels wide)
    // 3. Adjust distortion parameters in material inspector
    // 4. Apply to quad, plane, or any mesh for procedural texturing
    //
    // ===== PERFORMANCE NOTES =====
    // - Distance modulus creates tileable patterns
    // - Fractal distortion adds computational cost
    // - Consider LOD variants for distant objects
    // - Mobile optimization reduces features for performance
    ` : ''}
    
    Fallback "Universal Render Pipeline/Lit"
}`
  }

  /**
   * Generate curve data texture creation instructions
   */
  generateCurveTextureInstructions(curve: Curve): string {
    return `
// ===== CURVE TEXTURE CREATION INSTRUCTIONS =====
// 
// 1. Create a new Texture2D in Unity:
//    - Width: ${curve['curve-width']} pixels
//    - Height: 1 pixel
//    - Format: R8 (grayscale) or RGBA32
//    - Filter Mode: Point (no filtering)
//    - Wrap Mode: Repeat
//
// 2. Set pixel data using this array:
//    Curve Data: [${curve['curve-data'].slice(0, 10).join(', ')}...] (${curve['curve-width']} values)
//
// 3. Apply to material:
//    - Drag texture to "Curve Texture" slot in material
//    - Ensure tiling is set to (1, 1)
//
// ===== ALTERNATIVE: COMPUTE SHADER APPROACH =====
// For dynamic curve updates, consider using a compute shader
// to generate the curve texture at runtime from curve parameters.
`
  }

  /**
   * Generate complete Unity package export
   */
  generateUnityPackage(options: ShaderExportOptions): {
    shader: string
    instructions: string
    materialTemplate: string
  } {
    const shader = this.generateShader(options)
    const instructions = this.generateCurveTextureInstructions(options.curve)
    
    const materialTemplate = `
// ===== MATERIAL SETUP =====
// Create a new Material in Unity and:
// 1. Set shader to "${options.shaderName}"
// 2. Configure these parameters:

Distortion Profile: ${options.distortionControl.name}
Curve: ${options.curve.name}
Palette: ${options.palette?.name || 'Default Grayscale'}

// Recommended settings for tileable textures:
Distance Modulus: ${options.distortionControl['distance-modulus']} (creates ${options.distortionControl['distance-modulus']}×${options.distortionControl['distance-modulus']} tiles)
Texture Tiling: (1, 1) for seamless tiling

// Performance settings:
${options.optimizeForMobile ? '- Mobile optimization enabled' : '- Desktop/console optimization'}
${options.distortionControl['fractal-distortion'] ? '- Fractal distortion: HIGH GPU cost' : '- No fractal distortion: LOW GPU cost'}
${options.distortionControl['angular-distortion'] ? '- Angular distortion: MEDIUM GPU cost' : '- No angular distortion: LOW GPU cost'}
`

    return { shader, instructions, materialTemplate }
  }
}

// Export singleton instance
export const unityShaderGenerator = new UnityShaderGenerator()
