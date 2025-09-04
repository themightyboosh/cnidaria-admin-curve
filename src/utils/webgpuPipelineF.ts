/**
 * WebGPU Pipeline F Implementation
 * High-performance GPU acceleration for Merzbow coordinate processing
 */

import type { DistortionControl, Curve, Palette } from '../services/unifiedCoordinateProcessor'

export interface WebGPUPipelineFParams {
  distortionControl: DistortionControl
  curve: Curve
  palette: Palette | null
  width: number
  height: number
  centerOffsetX?: number
  centerOffsetY?: number
}

export class WebGPUPipelineF {
  private device: GPUDevice | null = null
  private pipeline: GPUComputePipeline | null = null
  private bindGroup: GPUBindGroup | null = null

  async initialize(): Promise<boolean> {
    try {
      if (!navigator.gpu) {
        console.warn('WebGPU not supported')
        return false
      }

      const adapter = await navigator.gpu.requestAdapter()
      if (!adapter) {
        console.warn('No WebGPU adapter available')
        return false
      }

      this.device = await adapter.requestDevice()
      console.log('✅ WebGPU Pipeline F initialized')
      return true
    } catch (error) {
      console.error('❌ Failed to initialize WebGPU Pipeline F:', error)
      return false
    }
  }

  /**
   * Generate WGSL compute shader for Pipeline F
   */
  private generateComputeShader(params: WebGPUPipelineFParams): string {
    const { distortionControl, curve, palette } = params

    // Generate distance calculation
    const distanceCalc = this.generateWGSLDistance(distortionControl['distance-calculation'])
    
    // Generate palette colors
    const paletteData = palette ? this.generateWGSLPalette(palette) : this.generateWGSLGrayscale()

    return `
struct DistortionParams {
    angularEnabled: f32,
    fractalEnabled: f32,
    checkerboardEnabled: f32,
    distanceModulus: f32,
    curveScaling: f32,
    checkerboardSteps: f32,
    angularFrequency: f32,
    angularAmplitude: f32,
    angularOffset: f32,
    fractalScale1: f32,
    fractalScale2: f32,
    fractalScale3: f32,
    fractalStrength: f32,
    width: f32,
    height: f32,
    centerOffsetX: f32,
    centerOffsetY: f32
};

@group(0) @binding(0) var<uniform> params: DistortionParams;
@group(0) @binding(1) var<storage, read_write> outputBuffer: array<vec4<f32>>;

${paletteData}

fn calculateDistance(coord: vec2<f32>) -> f32 {
    let x = coord.x;
    let y = coord.y;
    return ${distanceCalc};
}

fn sampleCurve(index: f32) -> f32 {
    let t = (abs(index) % ${curve['curve-width']}.0) / ${curve['curve-width']}.0;
    // Procedural curve approximation
    return ${this.generateWGSLCurve(curve)};
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;
    
    if (x >= u32(params.width) || y >= u32(params.height)) {
        return;
    }
    
    let index = y * u32(params.width) + x;
    
    // Convert to world coordinates
    let worldX = (f32(x) - params.width * 0.5) + params.centerOffsetX;
    let worldY = (f32(y) - params.height * 0.5) + params.centerOffsetY;
    var coord = vec2<f32>(worldX, worldY);
    
    // Virtual centers via coordinate modulus
    if (params.distanceModulus > 0.0) {
        coord.x = ((coord.x % params.distanceModulus) + params.distanceModulus) % params.distanceModulus - params.distanceModulus * 0.5;
        coord.y = ((coord.y % params.distanceModulus) + params.distanceModulus) % params.distanceModulus - params.distanceModulus * 0.5;
    }
    
    var processedCoord = coord;
    
    // Fractal distortion (coordinates) - FIRST
    if (params.fractalEnabled > 0.5) {
        let fractalOffset = vec2<f32>(
            sin(processedCoord.x * params.fractalScale1) * params.fractalStrength * 0.3 +
            sin(processedCoord.x * params.fractalScale2) * params.fractalStrength * 0.2 +
            sin(processedCoord.x * params.fractalScale3) * params.fractalStrength * 0.1,
            
            cos(processedCoord.y * params.fractalScale1) * params.fractalStrength * 0.3 +
            cos(processedCoord.y * params.fractalScale2) * params.fractalStrength * 0.2 +
            cos(processedCoord.y * params.fractalScale3) * params.fractalStrength * 0.1
        );
        processedCoord = processedCoord + fractalOffset;
    }
    
    // Angular distortion (coordinates) - AFTER fractal
    let effectiveAngular = params.angularEnabled > 0.5 && 
        (params.angularFrequency > 0.0 || params.angularAmplitude > 0.0 || params.angularOffset > 0.0);
        
    if (effectiveAngular) {
        let angle = atan2(processedCoord.y, processedCoord.x) + (params.angularOffset * 3.14159 / 180.0);
        let distortedAngle = angle + sin(angle * params.angularFrequency) * params.angularAmplitude * 0.01;
        let currentDistance = length(processedCoord);
        processedCoord = vec2<f32>(
            currentDistance * cos(distortedAngle),
            currentDistance * sin(distortedAngle)
        );
    }
    
    // Calculate final distance
    var finalDistance = calculateDistance(processedCoord);
    
    // Fractal distortion (distance) - FIRST
    if (params.fractalEnabled > 0.5) {
        let fractalDistortion = 
            sin(finalDistance * params.fractalScale1) * params.fractalStrength * 0.3 +
            cos(finalDistance * params.fractalScale2) * params.fractalStrength * 0.2 +
            sin(finalDistance * params.fractalScale3) * params.fractalStrength * 0.1;
        finalDistance = finalDistance + fractalDistortion;
    }
    
    // Angular distortion (distance) - AFTER fractal
    if (effectiveAngular) {
        let angle = atan2(processedCoord.y, processedCoord.x) + (params.angularOffset * 3.14159 / 180.0);
        let angularDistortion = sin(angle * params.angularFrequency) * params.angularAmplitude;
        finalDistance = finalDistance + angularDistortion;
    }
    
    // Apply curve scaling and sample curve
    let scaledDistance = finalDistance * params.curveScaling;
    var curveValue = sampleCurve(scaledDistance);
    
    // Apply checkerboard pattern
    if (params.checkerboardEnabled > 0.5) {
        let checkerboardDistance = calculateDistance(vec2<f32>(worldX, worldY));
        let stepFromCenter = floor(checkerboardDistance / params.checkerboardSteps);
        if ((stepFromCenter % 2.0) > 0.5) {
            curveValue = 1.0 - curveValue;
        }
    }
    
    // Sample palette and output
    let color = samplePalette(curveValue);
    outputBuffer[index] = vec4<f32>(color, 1.0);
}`
  }

  private generateWGSLDistance(method: string): string {
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

  private generateWGSLCurve(curve: Curve): string {
    const data = curve['curve-data']
    const min = Math.min(...data) / 255
    const max = Math.max(...data) / 255
    const avg = (data.reduce((sum, val) => sum + val, 0) / data.length) / 255
    const amplitude = (max - min) / 2
    
    return `${avg.toFixed(6)} + ${amplitude.toFixed(6)} * sin(t * 6.28318 * 2.0)`
  }

  private generateWGSLPalette(palette: Palette): string {
    // Generate first 16 colors for performance
    const colors = palette.hexColors.slice(0, 16).map(hex => {
      const r = parseInt(hex.slice(1, 3), 16) / 255
      const g = parseInt(hex.slice(3, 5), 16) / 255
      const b = parseInt(hex.slice(5, 7), 16) / 255
      return `vec3<f32>(${r.toFixed(6)}, ${g.toFixed(6)}, ${b.toFixed(6)})`
    }).join(',\n        ')

    return `
fn samplePalette(curveValue: f32) -> vec3<f32> {
    let paletteColors = array<vec3<f32>, 16>(
        ${colors}
    );
    let index = clamp(curveValue * 15.0, 0.0, 15.0);
    let i = i32(floor(index));
    let frac = fract(index);
    
    if (i >= 15) { return paletteColors[15]; }
    return mix(paletteColors[i], paletteColors[i + 1], frac);
}`
  }

  private generateWGSLGrayscale(): string {
    return `
fn samplePalette(curveValue: f32) -> vec3<f32> {
    return vec3<f32>(curveValue, curveValue, curveValue);
}`
  }

  /**
   * Process image using WebGPU Pipeline F
   */
  async processImage(params: WebGPUPipelineFParams): Promise<ImageData | null> {
    if (!this.device) {
      console.warn('WebGPU not initialized')
      return null
    }

    const { width, height, distortionControl, curve, palette, centerOffsetX = 0, centerOffsetY = 0 } = params

    try {
      // Create compute shader
      const shaderCode = this.generateComputeShader(params)
      const shaderModule = this.device.createShaderModule({ code: shaderCode })

      // Create pipeline
      this.pipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: {
          module: shaderModule,
          entryPoint: 'main'
        }
      })

      // Create buffers
      const paramsBuffer = this.device.createBuffer({
        size: 17 * 4, // 17 float32 values
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      })

      const outputBuffer = this.device.createBuffer({
        size: width * height * 4 * 4, // RGBA float32
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      })

      const readBuffer = this.device.createBuffer({
        size: width * height * 4 * 4,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      })

      // Write parameters
      const paramsData = new Float32Array([
        distortionControl['angular-distortion'] ? 1.0 : 0.0,
        distortionControl['fractal-distortion'] ? 1.0 : 0.0,
        distortionControl['checkerboard-pattern'] ? 1.0 : 0.0,
        distortionControl['distance-modulus'],
        distortionControl['curve-scaling'],
        distortionControl['checkerboard-steps'],
        distortionControl['angular-frequency'],
        distortionControl['angular-amplitude'],
        distortionControl['angular-offset'],
        distortionControl['fractal-scale-1'],
        distortionControl['fractal-scale-2'],
        distortionControl['fractal-scale-3'],
        distortionControl['fractal-strength'],
        width,
        height,
        centerOffsetX,
        centerOffsetY
      ])

      this.device.queue.writeBuffer(paramsBuffer, 0, paramsData)

      // Create bind group
      this.bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: paramsBuffer } },
          { binding: 1, resource: { buffer: outputBuffer } }
        ]
      })

      // Dispatch compute shader
      const commandEncoder = this.device.createCommandEncoder()
      const computePass = commandEncoder.beginComputePass()
      
      computePass.setPipeline(this.pipeline)
      computePass.setBindGroup(0, this.bindGroup)
      computePass.dispatchWorkgroups(
        Math.ceil(width / 16),
        Math.ceil(height / 16)
      )
      computePass.end()

      // Copy to read buffer
      commandEncoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, width * height * 4 * 4)
      
      this.device.queue.submit([commandEncoder.finish()])

      // Read results
      await readBuffer.mapAsync(GPUMapMode.READ)
      const resultData = new Float32Array(readBuffer.getMappedRange())
      
      // Convert to ImageData
      const imageData = new ImageData(width, height)
      const pixels = imageData.data

      for (let i = 0; i < width * height; i++) {
        const floatIndex = i * 4
        const pixelIndex = i * 4
        
        pixels[pixelIndex + 0] = Math.floor(resultData[floatIndex + 0] * 255) // R
        pixels[pixelIndex + 1] = Math.floor(resultData[floatIndex + 1] * 255) // G
        pixels[pixelIndex + 2] = Math.floor(resultData[floatIndex + 2] * 255) // B
        pixels[pixelIndex + 3] = 255 // A (force opaque)
      }

      readBuffer.unmap()
      
      console.log(`🚀 WebGPU Pipeline F processed ${width}×${height} in GPU`)
      return imageData

    } catch (error) {
      console.error('❌ WebGPU Pipeline F processing failed:', error)
      return null
    }
  }

  private generateWGSLPalette(palette: Palette): string {
    // Use first 16 colors for performance
    const colors = palette.hexColors.slice(0, 16).map(hex => {
      const r = parseInt(hex.slice(1, 3), 16) / 255
      const g = parseInt(hex.slice(3, 5), 16) / 255
      const b = parseInt(hex.slice(5, 7), 16) / 255
      return `vec3<f32>(${r.toFixed(6)}, ${g.toFixed(6)}, ${b.toFixed(6)})`
    }).join(',\n        ')

    return `
fn samplePalette(curveValue: f32) -> vec3<f32> {
    let paletteColors = array<vec3<f32>, 16>(
        ${colors}
    );
    let index = clamp(curveValue * 15.0, 0.0, 15.0);
    let i = i32(floor(index));
    let frac = fract(index);
    
    if (i >= 15) { return paletteColors[15]; }
    return mix(paletteColors[i], paletteColors[i + 1], frac);
}`
  }

  private generateWGSLGrayscale(): string {
    return `
fn samplePalette(curveValue: f32) -> vec3<f32> {
    return vec3<f32>(curveValue, curveValue, curveValue);
}`
  }
}

export const webgpuPipelineF = new WebGPUPipelineF()`
