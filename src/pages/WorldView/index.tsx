import React, { useState, useEffect, useRef, useCallback } from 'react'
import './WorldView.css'

// Types for our data structures
interface Curve {
  id: string
  'curve-name': string
  'curve-description': string
  'coordinate-noise': string
  'curve-width': number
  'curve-height': number
  'curve-index-scaling': number
  'curve-data': number[]
  'curve-tags'?: string[]
  'random-seed': number
  'created_at': string
  'updated_at': string
  'original-coordinate-noise'?: string
}

interface CoordinateNoise {
  id: string
  name: string
  description: string
  cpuLoad: 'l' | 'lm' | 'm' | 'mh' | 'h' | 'vh'
  category: string
  gpuExpression: string
  gpuDescription: string
  createdAt: string
  updatedAt: string
}

interface WorldViewState {
  curves: Curve[]
  coordinateNoise: Record<string, CoordinateNoise>
  selectedCurve: Curve | null
  selectedNoiseOverride: CoordinateNoise | null
  isLoading: boolean
  error: string | null
}

// WebGPU Constants
const CHUNK_WORLD_SIZE = 32
const TILE_PX = 256
const R_ACTIVE = 4
const R_CACHE = 8
const WORKGROUP_SIZE = 64
const COMPUTE_BUDGET_PER_FRAME = 4 // Max chunk dispatches per frame

// Pipeline signature for deterministic caching
interface PipelineSignature {
  curveId: string
  curveWidth: number
  indexScaling: number
  noiseId: string
  seed: number
}

// Chunk addressing for infinite world
interface ChunkKey {
  cx: number
  cy: number
}

// Chunk data structure
interface ChunkData {
  key: ChunkKey
  signature: PipelineSignature
  buffer: GPUBuffer
  lastUsed: number
  distance: number
}

// WGSL Shader Code
const WGSL_SHADERS = `
struct Globals {
  viewProj: mat4x4<f32>,
  worldOffset: vec2<f32>,
  chunkSizeWorld: f32,
  invChunkSizeWorld: f32,
  curveWidth: u32,
  curveHeight: f32,
  curveIndexScaling: f32,
  time: f32,
  instanceCount: u32,
  pad0: vec3<f32>
};

struct NoiseParams {
  seed: f32,
  chunkX: i32,
  chunkY: i32,
  padN: f32
};

struct Instance {
  basePos: vec2<f32>,
  height: f32,
  colorT: f32
};

@group(0) @binding(0) var<uniform> G: Globals;
@group(0) @binding(1) var<storage, read> curveData: array<u32>;
@group(0) @binding(2) var<uniform> N: NoiseParams;

@group(1) @binding(0) var<storage, read_write> instances: array<Instance>;

fn hash21(p: vec2<f32>) -> f32 {
  let h = dot(p, vec2<f32>(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

fn hashChunk(chunkX: i32, chunkY: i32, seed: f32) -> f32 {
  let h = f32(chunkX) * 73856093.0 + f32(chunkY) * 19349663.0 + seed;
  return fract(sin(h) * 43758.5453123);
}

fn Noise(p: vec2<f32>, chunkX: i32, chunkY: i32, seed: f32) -> vec2<f32> {
  // Deterministic noise based on chunk coordinates
  let chunkSeed = hashChunk(chunkX, chunkY, seed);
  let j = hash21(p + chunkSeed);
  let a = 6.2831853 * j;
  let d = 0.5 + 0.5 * sin(dot(p, vec2<f32>(0.9, 1.3)) + chunkSeed + G.time * 0.35);
  let disp = vec2<f32>(cos(a), sin(a)) * (0.15 * d);
  return p + disp;
}

fn curveSample01(idx: i32) -> f32 {
  let w = i32(G.curveWidth);
  if (w <= 0) { return 0.0; }
  var i = idx % w;
  if (i < 0) { i = i + w; }
  let v = f32(curveData[u32(i)]);
  return clamp(v / G.curveHeight, 0.0, 1.0);
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn bake_instances(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= G.instanceCount) { return; }

  // Calculate chunk coordinates for this instance
  let base = instances[i].basePos + G.worldOffset;
  let chunkX = i32(floor(base.x / G.chunkSizeWorld));
  let chunkY = i32(floor(base.y / G.chunkSizeWorld));
  
  // Local coordinates within chunk
  let localX = base.x - f32(chunkX) * G.chunkSizeWorld;
  let localY = base.y - f32(chunkY) * G.chunkSizeWorld;
  let localPos = vec2<f32>(localX, localY);

  // 6-Step Math Pipeline:
  // 1) Read XY coordinate (localPos)
  // 2) Apply coordinate-noise to distort XY
  let pn = Noise(localPos, chunkX, chunkY, N.seed);

  // 3) Compute distance from origin
  let dist = length(pn);

  // 4) Apply curve-index-scaling
  let scaled = dist * G.curveIndexScaling;

  // 5) Modulus wrap into curve index
  let wrapFactor = 1.0;
  let rawIndex = i32(floor(scaled * wrapFactor));
  let h01 = curveSample01(rawIndex);

  // 6) Outputs
  instances[i].height = h01;
  let normIdx = fract(scaled * wrapFactor / f32(max(i32(G.curveWidth), 1)));
  instances[i].colorT = clamp(normIdx, 0.0, 1.0);
}

struct VSIn {
  @location(0) pos: vec3<f32>,
  @location(1) nrm: vec3<f32>,
  @builtin(instance_index) inst: u32
};

struct VSOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) vColorT: f32
};

fn composeModel(inst: u32, localPos: vec3<f32>) -> vec4<f32> {
  let cellSize = 0.9;
  let h = max(instances[inst].height, 0.0);
  let stretch = vec3<f32>(cellSize, max(h, 0.001), cellSize);

  let base = instances[inst].basePos;
  let worldPos = vec3<f32>(
    base.x + localPos.x * stretch.x,
    localPos.y * stretch.y,
    base.y + localPos.z * stretch.z
  );

  return G.viewProj * vec4<f32>(worldPos.x, worldPos.y, worldPos.z, 1.0);
}

@vertex
fn vs_main(in: VSIn) -> VSOut {
  var o: VSOut;
  o.clip = composeModel(in.inst, in.pos);
  o.vColorT = instances[in.inst].colorT;
  return o;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let t = clamp(in.vColorT, 0.0, 1.0);
  let col = mix(vec3<f32>(0.1, 0.1, 0.9), vec3<f32>(0.9, 0.1, 0.9), t);
  return vec4<f32>(col, 1.0);
}
`

const WorldView: React.FC = () => {
  console.log('🎯 WorldView component loaded')
  
  const [state, setState] = useState<WorldViewState>({
    curves: [],
    coordinateNoise: {},
    selectedCurve: null,
    selectedNoiseOverride: null,
    isLoading: true,
    error: null
  })

  const [webGpuSupported, setWebGpuSupported] = useState<boolean>(false)
  const [webGpuChecked, setWebGpuChecked] = useState<boolean>(false)
  const [isRendering, setIsRendering] = useState<boolean>(false)

  // Performance monitoring
  const [performanceMetrics, setPerformanceMetrics] = useState({
    frameTime: 0,
    gpuTime: 0,
    computeTime: 0,
    dispatchCount: 0,
    activeChunks: 0,
    cacheChunks: 0,
    cacheHitRate: 0,
    adapterInfo: null as any
  })

  // WebGPU refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const deviceRef = useRef<GPUDevice | null>(null)
  const contextRef = useRef<GPUCanvasContext | null>(null)
  const pipelineRef = useRef<GPURenderPipeline | null>(null)
  const computePipelineRef = useRef<GPUComputePipeline | null>(null)
  const buffersRef = useRef<{
    globals: GPUBuffer
    curveData: GPUBuffer
    noiseParams: GPUBuffer
    instances: GPUBuffer
    vertexBuffer: GPUBuffer
    indexBuffer: GPUBuffer
  } | null>(null)
  const bindGroupsRef = useRef<{
    render: GPUBindGroup
    compute: GPUBindGroup
  } | null>(null)

  // Animation state
  const worldOffsetRef = useRef<[number, number]>([0, 0])
  const isDraggingRef = useRef<boolean>(false)
  const lastMousePosRef = useRef<[number, number]>([0, 0])
  const animationFrameRef = useRef<number | null>(null)
  const timeRef = useRef<number>(0)

  // Infinite world state
  const chunkCacheRef = useRef<Map<string, ChunkData>>(new Map())
  const activeChunksRef = useRef<Set<string>>(new Set())
  const cacheChunksRef = useRef<Set<string>>(new Set())
  const currentSignatureRef = useRef<PipelineSignature | null>(null)
  const frameCountRef = useRef<number>(0)

  // Initialize instance data
  const initializeInstanceData = useCallback(() => {
    if (!deviceRef.current || !buffersRef.current) return

    const device = deviceRef.current
    const instanceCount = TILE_PX * TILE_PX
    const instanceData = new Float32Array(instanceCount * 4) // basePos (2) + height (1) + colorT (1)

    // Create grid of instances
    for (let z = 0; z < TILE_PX; z++) {
      for (let x = 0; x < TILE_PX; x++) {
        const index = (z * TILE_PX + x) * 4
        const worldX = (x - TILE_PX / 2) * 1.0 // 1.0 unit spacing
        const worldZ = (z - TILE_PX / 2) * 1.0
        
        instanceData[index + 0] = worldX // basePos.x
        instanceData[index + 1] = worldZ // basePos.y (Z in world space)
        instanceData[index + 2] = 0.0    // height (computed by GPU)
        instanceData[index + 3] = 0.0    // colorT (computed by GPU)
      }
    }

    device.queue.writeBuffer(buffersRef.current.instances, 0, instanceData)
  }, [])

  // Chunk management functions
  const getChunkKey = useCallback((worldX: number, worldY: number): ChunkKey => {
    return {
      cx: Math.floor(worldX / CHUNK_WORLD_SIZE),
      cy: Math.floor(worldY / CHUNK_WORLD_SIZE)
    }
  }, [])

  const getChunkStringKey = useCallback((key: ChunkKey): string => {
    return `${key.cx},${key.cy}`
  }, [])

  const getCurrentSignature = useCallback((): PipelineSignature | null => {
    if (!state.selectedCurve) return null
    
    const effectiveNoise = getEffectiveNoise()
    if (!effectiveNoise) return null

    return {
      curveId: state.selectedCurve.id,
      curveWidth: state.selectedCurve['curve-width'],
      indexScaling: state.selectedCurve['curve-index-scaling'],
      noiseId: effectiveNoise.id,
      seed: state.selectedCurve['random-seed']
    }
  }, [state.selectedCurve, state.selectedNoiseOverride, state.coordinateNoise])

  const updateChunkVisibility = useCallback(() => {
    if (!currentSignatureRef.current) return

    const [worldX, worldY] = worldOffsetRef.current
    const centerChunk = getChunkKey(worldX, worldY)
    
    // Calculate visible chunks based on R_ACTIVE radius
    const newActiveChunks = new Set<string>()
    const newCacheChunks = new Set<string>()
    
    for (let dx = -R_ACTIVE; dx <= R_ACTIVE; dx++) {
      for (let dy = -R_ACTIVE; dy <= R_ACTIVE; dy++) {
        const chunkKey = getChunkStringKey({
          cx: centerChunk.cx + dx,
          cy: centerChunk.cy + dy
        })
        
        if (Math.abs(dx) <= R_ACTIVE && Math.abs(dy) <= R_ACTIVE) {
          newActiveChunks.add(chunkKey)
        } else if (Math.abs(dx) <= R_CACHE && Math.abs(dy) <= R_CACHE) {
          newCacheChunks.add(chunkKey)
        }
      }
    }

    activeChunksRef.current = newActiveChunks
    cacheChunksRef.current = newCacheChunks
    
    console.log('🗺️ Active chunks:', newActiveChunks.size, 'Cache chunks:', newCacheChunks.size)
  }, [getChunkKey, getChunkStringKey])

  // Update uniform buffers
  const updateUniforms = useCallback(() => {
    if (!deviceRef.current || !buffersRef.current || !state.selectedCurve) return

    const device = deviceRef.current
    const curve = state.selectedCurve
    const effectiveNoise = getEffectiveNoise()
    
    console.log('🔄 Updating uniforms for curve:', curve['curve-name'])
    console.log('📊 Curve data length:', curve['curve-data']?.length)
    console.log('🎲 Effective noise:', effectiveNoise?.name)

    // Update globals
    const globalsData = new Float32Array(24) // 24 floats = 96 bytes (including padding)
    
    // Create a simple perspective projection matrix
    const aspect = 800 / 600
    const fov = Math.PI / 4 // 45 degrees
    const near = 0.1
    const far = 1000.0
    const f = 1.0 / Math.tan(fov / 2)
    
    const viewProj = new Float32Array(16)
    viewProj[0] = f / aspect
    viewProj[5] = f
    viewProj[10] = (far + near) / (near - far)
    viewProj[11] = -1.0
    viewProj[14] = (2 * far * near) / (near - far)
    viewProj[15] = 0.0
    
    // Add a simple camera transform (move back and up)
    const cameraPos = [0, 50, 100] // x, y, z
    const viewMatrix = new Float32Array(16)
    viewMatrix[0] = 1.0
    viewMatrix[5] = 1.0
    viewMatrix[10] = 1.0
    viewMatrix[15] = 1.0
    viewMatrix[14] = -cameraPos[2] // translate back
    
    // Multiply view * projection
    const viewProjMatrix = new Float32Array(16)
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let sum = 0
        for (let k = 0; k < 4; k++) {
          sum += viewMatrix[i * 4 + k] * viewProj[k * 4 + j]
        }
        viewProjMatrix[i * 4 + j] = sum
      }
    }
    
    globalsData.set(viewProjMatrix, 0) // viewProj (16 floats)
    globalsData[16] = worldOffsetRef.current[0] // worldOffset.x
    globalsData[17] = worldOffsetRef.current[1] // worldOffset.y
    globalsData[18] = CHUNK_WORLD_SIZE // chunkSizeWorld
    globalsData[19] = 1.0 / CHUNK_WORLD_SIZE // invChunkSizeWorld
    globalsData[20] = curve['curve-width'] || 1024 // curveWidth
    globalsData[21] = curve['curve-height'] || 255 // curveHeight
    globalsData[22] = curve['curve-index-scaling'] || 1.0 // curveIndexScaling
    globalsData[23] = timeRef.current // time

    // Create a new buffer with proper size
    const globalsBuffer = device.createBuffer({
      size: 96,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(globalsBuffer, 0, globalsData)
    buffersRef.current.globals = globalsBuffer

    // Update noise params
    const noiseData = new Float32Array(4)
    noiseData[0] = curve['random-seed'] || 0.0
    noiseData[1] = 0.0 // chunkX (will be set per chunk)
    noiseData[2] = 0.0 // chunkY (will be set per chunk)
    noiseData[3] = 0.0 // pad

    const noiseBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(noiseBuffer, 0, noiseData)
    buffersRef.current.noiseParams = noiseBuffer

    // Update curve data
    const curveDataArray = new Uint32Array(curve['curve-data'])
    const curveBuffer = device.createBuffer({
      size: curveDataArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(curveBuffer, 0, curveDataArray)
    buffersRef.current.curveData = curveBuffer

    // Recreate bind groups with new buffers
    if (bindGroupsRef.current && pipelineRef.current && computePipelineRef.current) {
      const renderBindGroup = device.createBindGroup({
        layout: pipelineRef.current.getBindGroupLayout(0),
        entries: [{
          binding: 0,
          resource: { buffer: globalsBuffer }
        }, {
          binding: 1,
          resource: { buffer: curveBuffer }
        }, {
          binding: 2,
          resource: { buffer: noiseBuffer }
        }]
      })

      const computeBindGroup = device.createBindGroup({
        layout: computePipelineRef.current.getBindGroupLayout(0),
        entries: [{
          binding: 0,
          resource: { buffer: globalsBuffer }
        }, {
          binding: 1,
          resource: { buffer: curveBuffer }
        }, {
          binding: 2,
          resource: { buffer: noiseBuffer }
        }, {
          binding: 0,
          resource: { buffer: buffersRef.current.instances }
        }]
      })

      bindGroupsRef.current = {
        render: renderBindGroup,
        compute: computeBindGroup
      }
    }
  }, [state.selectedCurve, state.selectedNoiseOverride, state.coordinateNoise])

  // Render frame
  const renderFrame = useCallback(() => {
    if (!deviceRef.current || !contextRef.current || !pipelineRef.current || 
        !computePipelineRef.current || !bindGroupsRef.current || !buffersRef.current) {
      console.log('⚠️ Missing WebGPU resources for rendering')
      return
    }

    const frameStart = performance.now()
    const device = deviceRef.current
    const context = contextRef.current
    const commandEncoder = device.createCommandEncoder()

    // Update time
    timeRef.current += 0.016 // ~60fps
    frameCountRef.current++

    // Update chunk visibility
    updateChunkVisibility()

    // Update uniforms
    updateUniforms()

    // Compute pass: bake instances
    const computeStart = performance.now()
    const computePass = commandEncoder.beginComputePass()
    computePass.setPipeline(computePipelineRef.current)
    computePass.setBindGroup(0, bindGroupsRef.current.compute)
    
    const instanceCount = TILE_PX * TILE_PX
    const workgroupCount = Math.ceil(instanceCount / WORKGROUP_SIZE)
    console.log('⚡ Dispatching compute workgroups:', workgroupCount, 'for', instanceCount, 'instances')
    computePass.dispatchWorkgroups(workgroupCount)
    computePass.end()
    const computeEnd = performance.now()

    // Render pass
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store'
      }],
      depthStencilAttachment: {
        view: device.createTexture({
          size: { width: 800, height: 600 },
          format: 'depth24plus',
          usage: GPUTextureUsage.RENDER_ATTACHMENT
        }).createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    })

    renderPass.setPipeline(pipelineRef.current)
    renderPass.setBindGroup(0, bindGroupsRef.current.render)
    renderPass.setVertexBuffer(0, buffersRef.current.vertexBuffer)
    renderPass.setIndexBuffer(buffersRef.current.indexBuffer, 'uint16')
    renderPass.drawIndexed(36, instanceCount) // 36 indices per cube, instanceCount instances
    renderPass.end()

    device.queue.submit([commandEncoder.finish()])

    // Update performance metrics
    const frameEnd = performance.now()
    const frameTime = frameEnd - frameStart
    const computeTime = computeEnd - computeStart
    
    setPerformanceMetrics(prev => ({
      ...prev,
      frameTime,
      computeTime,
      dispatchCount: workgroupCount,
      activeChunks: activeChunksRef.current.size,
      cacheChunks: cacheChunksRef.current.size,
      cacheHitRate: 0 // TODO: implement cache hit tracking
    }))

    // Update curve visualization
    drawCurveVisualization()

    // Schedule next frame
    animationFrameRef.current = requestAnimationFrame(renderFrame)
  }, [updateUniforms, updateChunkVisibility, drawCurveVisualization])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Start/stop rendering
  useEffect(() => {
    if (isRendering && state.selectedCurve) {
      initializeInstanceData()
      renderFrame()
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isRendering, state.selectedCurve, initializeInstanceData, renderFrame])

  // Curve visualization
  const [showCurvePanel, setShowCurvePanel] = useState<boolean>(true)
  const [showDebugOverlay, setShowDebugOverlay] = useState<boolean>(false)
  const curveCanvasRef = useRef<HTMLCanvasElement>(null)

  // Get effective noise for current curve
  const getEffectiveNoise = useCallback(() => {
    if (state.selectedNoiseOverride) {
      return state.selectedNoiseOverride
    }
    if (state.selectedCurve && state.selectedCurve['coordinate-noise']) {
      return state.coordinateNoise[state.selectedCurve['coordinate-noise']]
    }
    return null
  }, [state.selectedNoiseOverride, state.selectedCurve, state.coordinateNoise])

  // Draw curve visualization
  const drawCurveVisualization = useCallback(() => {
    if (!curveCanvasRef.current || !state.selectedCurve) return

    const canvas = curveCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const curve = state.selectedCurve
    const curveData = curve['curve-data']
    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, width, height)

    // Draw curve bars
    const barWidth = width / curveData.length
    ctx.fillStyle = '#007acc'
    
    for (let i = 0; i < curveData.length; i++) {
      const value = curveData[i]
      const barHeight = (value / 255) * height
      const x = i * barWidth
      const y = height - barHeight
      
      ctx.fillRect(x, y, barWidth - 1, barHeight)
    }

    // Draw current index marker (center of view)
    const [worldX, worldY] = worldOffsetRef.current
    const centerChunk = getChunkKey(worldX, worldY)
    const localX = worldX - centerChunk.cx * CHUNK_WORLD_SIZE
    const localY = worldY - centerChunk.cy * CHUNK_WORLD_SIZE
    const dist = Math.sqrt(localX * localX + localY * localY)
    const scaled = dist * curve['curve-index-scaling']
    const index = Math.floor(scaled) % curveData.length
    
    const markerX = (index / curveData.length) * width
    ctx.strokeStyle = '#ff6b6b'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(markerX, 0)
    ctx.lineTo(markerX, height)
    ctx.stroke()

    // Draw index text
    ctx.fillStyle = '#ffffff'
    ctx.font = '12px monospace'
    ctx.fillText(`Index: ${index}`, 10, 20)
    ctx.fillText(`Distance: ${dist.toFixed(2)}`, 10, 35)
  }, [state.selectedCurve, worldOffsetRef, getChunkKey])

  // WebGPU availability check
  useEffect(() => {
    const checkWebGPU = async () => {
      try {
        console.log('🔍 Checking WebGPU availability...')
        
        if (!navigator.gpu) {
          console.log('❌ navigator.gpu not available')
          setWebGpuSupported(false)
          setWebGpuChecked(true)
          return
        }

        const adapter = await navigator.gpu.requestAdapter()
        if (!adapter) {
          console.log('❌ No WebGPU adapter available')
          setWebGpuSupported(false)
          setWebGpuChecked(true)
          return
        }

        // Log detailed adapter information
        const adapterInfo = {
          name: adapter.name,
          vendor: adapter.vendor,
          architecture: adapter.architecture,
          device: adapter.device,
          description: adapter.description,
          limits: adapter.limits,
          features: Array.from(adapter.features)
        }
        
        console.log('✅ WebGPU adapter found:', adapterInfo)
        setPerformanceMetrics(prev => ({ ...prev, adapterInfo }))

        const device = await adapter.requestDevice()
        if (!device) {
          console.log('❌ Failed to create WebGPU device')
          setWebGpuSupported(false)
          setWebGpuChecked(true)
          return
        }

        console.log('✅ WebGPU device created successfully')
        setWebGpuSupported(true)
        setWebGpuChecked(true)
        
        // Set up device lost handler
        device.addEventListener('uncapturederror', (event) => {
          console.error('🚨 WebGPU device lost:', event)
          setWebGpuSupported(false)
          setState(prev => ({ ...prev, error: 'WebGPU device lost - please refresh' }))
        })
        
      } catch (error) {
        console.error('❌ WebGPU check failed:', error)
        setWebGpuSupported(false)
        setWebGpuChecked(true)
      }
    }

    checkWebGPU()
  }, [])

  // Fetch curves and coordinate noise data
  useEffect(() => {
    const fetchData = async () => {
      if (!webGpuSupported) return

      setState(prev => ({ ...prev, isLoading: true, error: null }))

      try {
        const apiUrl = 'https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api'
        console.log('🌐 Fetching data from API:', apiUrl)

        // Fetch curves
        const curvesResponse = await fetch(`${apiUrl}/api/curves`)
        if (!curvesResponse.ok) {
          throw new Error(`Failed to fetch curves: ${curvesResponse.status}`)
        }
        const curvesData = await curvesResponse.json()
        console.log('📊 Curves response:', curvesData)
        
        if (!curvesData.success) {
          throw new Error('API returned error for curves')
        }

        const curves = curvesData.data?.curves || []
        console.log('📈 Found curves:', curves.length)

        // Fetch coordinate noise patterns
        const noiseResponse = await fetch(`${apiUrl}/api/coordinate-noise`)
        if (!noiseResponse.ok) {
          throw new Error(`Failed to fetch coordinate noise: ${noiseResponse.status}`)
        }
        const noiseData = await noiseResponse.json()
        console.log('🎲 Noise response:', noiseData)
        
        if (!noiseData.success) {
          throw new Error('API returned error for coordinate noise')
        }

        const coordinateNoise = noiseData.data?.coordinateNoise || {}
        console.log('🎯 Found noise patterns:', Object.keys(coordinateNoise).length)

        setState(prev => ({
          ...prev,
          curves,
          coordinateNoise,
          isLoading: false
        }))

        // Auto-select first curve if available
        if (curves.length > 0) {
          console.log('🎯 Auto-selecting first curve:', curves[0]['curve-name'])
          setState(prev => ({
            ...prev,
            selectedCurve: curves[0]
          }))
        }

      } catch (error) {
        console.error('❌ Failed to fetch data:', error)
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error',
          isLoading: false
        }))
      }
    }

    fetchData()
  }, [webGpuSupported])

  // Initialize WebGPU
  const initializeWebGPU = useCallback(async () => {
    if (!canvasRef.current || !webGpuSupported) return

    try {
      console.log('🚀 Initializing WebGPU...')
      const canvas = canvasRef.current
      const context = canvas.getContext('webgpu')
      if (!context) {
        throw new Error('Failed to get WebGPU context')
      }

      const adapter = await navigator.gpu!.requestAdapter()
      if (!adapter) {
        throw new Error('Failed to get WebGPU adapter')
      }

      const device = await adapter.requestDevice()
      if (!device) {
        throw new Error('Failed to get WebGPU device')
      }

      const format = navigator.gpu!.getPreferredCanvasFormat()
      context.configure({
        device,
        format,
        alphaMode: 'premultiplied'
      })

      deviceRef.current = device
      contextRef.current = context
      console.log('✅ WebGPU device initialized')

      // Create shader modules
      console.log('📝 Creating shader modules...')
      const shaderModule = device.createShaderModule({
        code: WGSL_SHADERS
      })

      // Create compute pipeline
      const computePipeline = device.createComputePipeline({
        layout: 'auto',
        compute: {
          module: shaderModule,
          entryPoint: 'bake_instances'
        }
      })

      // Create render pipeline
      const renderPipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
          buffers: [{
            arrayStride: 24, // 3 floats * 8 bytes
            attributes: [{
              shaderLocation: 0,
              offset: 0,
              format: 'float32x3'
            }, {
              shaderLocation: 1,
              offset: 12,
              format: 'float32x3'
            }]
          }]
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [{
            format
          }]
        },
        primitive: {
          topology: 'triangle-list'
        },
        depthStencil: {
          depthWriteEnabled: true,
          depthCompare: 'less',
          format: 'depth24plus'
        }
      })

      computePipelineRef.current = computePipeline
      pipelineRef.current = renderPipeline
      console.log('✅ Shader pipelines created')

      // Create cube geometry
      const cubeVertices = new Float32Array([
        // Front face
        -0.5, -0.5,  0.5,  0.0,  0.0,  1.0,
         0.5, -0.5,  0.5,  0.0,  0.0,  1.0,
         0.5,  0.5,  0.5,  0.0,  0.0,  1.0,
        -0.5,  0.5,  0.5,  0.0,  0.0,  1.0,
        // Back face
        -0.5, -0.5, -0.5,  0.0,  0.0, -1.0,
         0.5, -0.5, -0.5,  0.0,  0.0, -1.0,
         0.5,  0.5, -0.5,  0.0,  0.0, -1.0,
        -0.5,  0.5, -0.5,  0.0,  0.0, -1.0,
        // Left face
        -0.5, -0.5, -0.5, -1.0,  0.0,  0.0,
        -0.5, -0.5,  0.5, -1.0,  0.0,  0.0,
        -0.5,  0.5,  0.5, -1.0,  0.0,  0.0,
        -0.5,  0.5, -0.5, -1.0,  0.0,  0.0,
        // Right face
         0.5, -0.5, -0.5,  1.0,  0.0,  0.0,
         0.5, -0.5,  0.5,  1.0,  0.0,  0.0,
         0.5,  0.5,  0.5,  1.0,  0.0,  0.0,
         0.5,  0.5, -0.5,  1.0,  0.0,  0.0,
        // Top face
        -0.5,  0.5, -0.5,  0.0,  1.0,  0.0,
         0.5,  0.5, -0.5,  0.0,  1.0,  0.0,
         0.5,  0.5,  0.5,  0.0,  1.0,  0.0,
        -0.5,  0.5,  0.5,  0.0,  1.0,  0.0,
        // Bottom face
        -0.5, -0.5, -0.5,  0.0, -1.0,  0.0,
         0.5, -0.5, -0.5,  0.0, -1.0,  0.0,
         0.5, -0.5,  0.5,  0.0, -1.0,  0.0,
        -0.5, -0.5,  0.5,  0.0, -1.0,  0.0
      ])

      const cubeIndices = new Uint16Array([
        0,  1,  2,    0,  2,  3,   // Front
        4,  5,  6,    4,  6,  7,   // Back
        8,  9,  10,   8,  10, 11,   // Left
        12, 13, 14,   12, 14, 15,   // Right
        16, 17, 18,   16, 18, 19,   // Top
        20, 21, 22,   20, 22, 23    // Bottom
      ])

      // Create buffers
      const vertexBuffer = device.createBuffer({
        size: cubeVertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      })
      device.queue.writeBuffer(vertexBuffer, 0, cubeVertices)

      const indexBuffer = device.createBuffer({
        size: cubeIndices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
      })
      device.queue.writeBuffer(indexBuffer, 0, cubeIndices)

      // Create instance buffer (will be updated with actual data)
      const instanceCount = TILE_PX * TILE_PX
      const instances = device.createBuffer({
        size: instanceCount * 16, // 2 floats (basePos) + 2 floats (height, colorT)
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      })

      // Create uniform buffers
      const globals = device.createBuffer({
        size: 96, // Size of Globals struct
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      })

      const noiseParams = device.createBuffer({
        size: 16, // Size of NoiseParams struct
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      })

      // Placeholder curve data buffer
      const curveData = device.createBuffer({
        size: 1024 * 4, // 1024 u32 values
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      })

      buffersRef.current = {
        globals,
        curveData,
        noiseParams,
        instances,
        vertexBuffer,
        indexBuffer
      }

      // Create bind groups
      const renderBindGroup = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [{
          binding: 0,
          resource: { buffer: globals }
        }, {
          binding: 1,
          resource: { buffer: curveData }
        }, {
          binding: 2,
          resource: { buffer: noiseParams }
        }]
      })

      const computeBindGroup = device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [{
          binding: 0,
          resource: { buffer: globals }
        }, {
          binding: 1,
          resource: { buffer: curveData }
        }, {
          binding: 2,
          resource: { buffer: noiseParams }
        }, {
          binding: 0,
          resource: { buffer: instances }
        }]
      })

      bindGroupsRef.current = {
        render: renderBindGroup,
        compute: computeBindGroup
      }

      setIsRendering(true)

    } catch (error) {
      console.error('Failed to initialize WebGPU:', error)
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'WebGPU initialization failed'
      }))
    }
  }, [webGpuSupported])

  // Initialize WebGPU when ready
  useEffect(() => {
    if (webGpuSupported && state.selectedCurve) {
      initializeWebGPU()
    }
  }, [webGpuSupported, state.selectedCurve, initializeWebGPU])

  // Handle curve selection
  const handleCurveSelect = (curveId: string) => {
    const curve = state.curves.find(c => c.id === curveId)
    if (curve) {
      setState(prev => ({
        ...prev,
        selectedCurve: curve,
        selectedNoiseOverride: null // Reset noise override when curve changes
      }))
    }
  }

  // Handle noise override selection
  const handleNoiseOverride = (noiseId: string | null) => {
    const noise = noiseId ? state.coordinateNoise[noiseId] : null
    setState(prev => ({
      ...prev,
      selectedNoiseOverride: noise
    }))
  }

  // Get effective noise pattern (curve's default or override) - using the useCallback version above

  // Mouse event handlers for drag interaction
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true
    lastMousePosRef.current = [e.clientX, e.clientY]
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current) return

    const [lastX, lastY] = lastMousePosRef.current
    const deltaX = e.clientX - lastX
    const deltaY = e.clientY - lastY

    worldOffsetRef.current[0] += deltaX * 0.01
    worldOffsetRef.current[1] += deltaY * 0.01

    lastMousePosRef.current = [e.clientX, e.clientY]
  }, [])

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
  }, [])

  // Render WebGPU unsupported message
  if (webGpuChecked && !webGpuSupported) {
    return (
      <div className="world-view">
        <div className="error-container">
          <h1>WebGPU Not Supported</h1>
          <p>This application requires WebGPU support, which is currently only available in:</p>
          <ul>
            <li>Chrome 113+ (with flags enabled)</li>
            <li>Safari 17+ (on macOS 14+)</li>
          </ul>
          <p>Please update your browser or enable WebGPU flags.</p>
        </div>
      </div>
    )
  }

  // Render loading state
  if (!webGpuChecked || state.isLoading) {
    return (
      <div className="world-view">
        <div className="loading-container">
          <h1>Loading World View</h1>
          <p>Initializing WebGPU and fetching data...</p>
          <p>WebGPU Checked: {webGpuChecked ? 'Yes' : 'No'}</p>
          <p>WebGPU Supported: {webGpuSupported ? 'Yes' : 'No'}</p>
          <p>Loading: {state.isLoading ? 'Yes' : 'No'}</p>
        </div>
      </div>
    )
  }

  // Render error state
  if (state.error) {
    return (
      <div className="world-view">
        <div className="error-container">
          <h1>Error Loading Data</h1>
          <p>{state.error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    )
  }

  // Debug render to see what's happening
  console.log('🎯 Rendering WorldView:', {
    webGpuChecked,
    webGpuSupported,
    isLoading: state.isLoading,
    curvesCount: state.curves.length,
    selectedCurve: state.selectedCurve?.id
  })

  // Main render
  return (
    <div className="world-view">
      <div className="controls-panel">
        <div className="control-group">
          <label htmlFor="curve-select">Curve:</label>
          <select
            id="curve-select"
            value={state.selectedCurve?.id || ''}
            onChange={(e) => handleCurveSelect(e.target.value)}
          >
            <option value="">Select a curve...</option>
            {state.curves.map(curve => (
              <option key={curve.id} value={curve.id}>
                {curve['curve-name']}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="noise-select">Noise Override:</label>
          <select
            id="noise-select"
            value={state.selectedNoiseOverride?.id || ''}
            onChange={(e) => handleNoiseOverride(e.target.value || null)}
          >
            <option value="">Use curve default</option>
            {Object.values(state.coordinateNoise).map(noise => (
              <option key={noise.id} value={noise.id}>
                {noise.name} ({noise.cpuLoad})
              </option>
            ))}
          </select>
        </div>

        {state.selectedCurve && (
          <div className="info-panel">
            <h3>Selected Curve</h3>
            <p><strong>Name:</strong> {state.selectedCurve['curve-name']}</p>
            <p><strong>Width:</strong> {state.selectedCurve['curve-width']}</p>
            <p><strong>Index Scaling:</strong> {state.selectedCurve['curve-index-scaling']}</p>
            <p><strong>Random Seed:</strong> {state.selectedCurve['random-seed']}</p>
            <p><strong>Effective Noise:</strong> {getEffectiveNoise()?.name || 'None'}</p>
            {isRendering && (
              <p><strong>Status:</strong> <span style={{color: '#00ff00'}}>WebGPU Active</span></p>
            )}
          </div>
        )}

        {/* Performance HUD */}
        <div className="performance-hud">
          <h3>Performance</h3>
          <p><strong>Frame Time:</strong> {performanceMetrics.frameTime.toFixed(2)}ms</p>
          <p><strong>Compute Time:</strong> {performanceMetrics.computeTime.toFixed(2)}ms</p>
          <p><strong>Dispatch Count:</strong> {performanceMetrics.dispatchCount}</p>
          <p><strong>Active Chunks:</strong> {performanceMetrics.activeChunks}</p>
          <p><strong>Cache Chunks:</strong> {performanceMetrics.cacheChunks}</p>
          <p><strong>Cache Hit Rate:</strong> {(performanceMetrics.cacheHitRate * 100).toFixed(1)}%</p>
          {performanceMetrics.adapterInfo && (
            <p><strong>Adapter:</strong> {performanceMetrics.adapterInfo.name}</p>
          )}
        </div>

        {/* Debug Controls */}
        <div className="debug-controls">
          <h3>Debug</h3>
          <label>
            <input
              type="checkbox"
              checked={showCurvePanel}
              onChange={(e) => setShowCurvePanel(e.target.checked)}
            />
            Show Curve Panel
          </label>
          <label>
            <input
              type="checkbox"
              checked={showDebugOverlay}
              onChange={(e) => setShowDebugOverlay(e.target.checked)}
            />
            Show Debug Overlay
          </label>
        </div>
      </div>

              <div className="renderer-container">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              border: '1px solid #333',
              cursor: isDraggingRef.current ? 'grabbing' : 'grab'
            }}
          />
          <div className="renderer-info">
            <p>Drag to move the landscape</p>
            <p>World Offset: [{worldOffsetRef.current[0].toFixed(2)}, {worldOffsetRef.current[1].toFixed(2)}]</p>
          </div>

          {/* Curve Visualization Panel */}
          {showCurvePanel && (
            <div className="curve-panel">
              <h3>Curve Visualization</h3>
              <canvas
                ref={curveCanvasRef}
                width={300}
                height={150}
                style={{
                  border: '1px solid #333',
                  background: '#1a1a1a'
                }}
              />
            </div>
          )}
        </div>
    </div>
  )
}

export default WorldView
