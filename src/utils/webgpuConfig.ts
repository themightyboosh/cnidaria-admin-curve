/**
 * WebGPU Global Configuration
 * Adapter probing, workgroup selection, and compatibility mode detection
 * Ensures ≤256 total threads per workgroup for low-power GPUs
 */

export interface WorkgroupConfig {
  x: number;
  y: number;
  z: number;
  total: number;
}

export interface GPUProfile {
  type: 'compat' | 'full';
  workgroup: WorkgroupConfig;
  tilePx: number;
  bakeBudget: number;
  message: string;
}

export interface GPUGlobalConfig {
  adapter: GPUAdapter;
  device: GPUDevice;
  limits: GPUSupportedLimits;
  profile: GPUProfile;
  forceCompatMode: boolean;
}

let globalGPUConfig: GPUGlobalConfig | null = null;

/**
 * Choose optimal workgroup size based on adapter limits
 */
function chooseWorkgroup(limits: GPUSupportedLimits): WorkgroupConfig {
  const maxX = limits.maxComputeWorkgroupSizeX ?? 256;
  const maxY = limits.maxComputeWorkgroupSizeY ?? 256;
  const maxZ = limits.maxComputeWorkgroupSizeZ ?? 64;
  const cap = limits.maxComputeInvocationsPerWorkgroup ?? 256;
  
  const ok = (x: number, y: number, z: number) => 
    x <= maxX && y <= maxY && z <= maxZ && (x * y * z) <= cap;
  
  // Try different workgroup configurations, prioritizing square layouts
  if (ok(16, 16, 1)) return { x: 16, y: 16, z: 1, total: 256 };  // Ideal for most GPUs
  if (ok(8, 16, 2)) return { x: 8, y: 16, z: 2, total: 256 };   // Alternative 256
  if (ok(8, 8, 4)) return { x: 8, y: 8, z: 4, total: 256 };     // 3D alternative
  if (ok(8, 8, 1)) return { x: 8, y: 8, z: 1, total: 64 };      // Low-power fallback
  
  // Last resort for very constrained hardware
  return { x: 4, y: 4, z: 1, total: 16 };
}

/**
 * Determine GPU profile based on capabilities
 */
function determineProfile(limits: GPUSupportedLimits, workgroup: WorkgroupConfig, forceCompat: boolean): GPUProfile {
  const isFullCapable = (limits.maxComputeInvocationsPerWorkgroup ?? 256) >= 1024;
  const useCompat = forceCompat || !isFullCapable || workgroup.total <= 256;
  
  if (useCompat) {
    return {
      type: 'compat',
      workgroup,
      tilePx: 128,  // Smaller tiles for compatibility
      bakeBudget: 2, // Reduced budget per frame
      message: 'Compatibility Mode (≤256): Reduced workgroup sizes, smaller tiles, and paced compute. All features enabled; performance scaled for this GPU.'
    };
  } else {
    return {
      type: 'full',
      workgroup,
      tilePx: 256,  // Larger tiles for performance
      bakeBudget: 4, // Higher budget per frame
      message: 'Full Fidelity (≥1024): Larger tiles and higher per-frame budget.'
    };
  }
}

/**
 * Initialize global GPU configuration
 */
export async function initializeGPUConfig(forceCompatMode: boolean = false): Promise<GPUGlobalConfig> {
  console.log('🔧 Initializing GPU configuration...');
  
  // Request adapter with low-power preference for better compatibility detection
  const adapter = await navigator.gpu.requestAdapter({ 
    powerPreference: "low-power" 
  });
  
  if (!adapter) {
    throw new Error('WebGPU adapter not available');
  }
  
  console.log('📊 GPU Adapter Info:', {
    architecture: adapter.info.architecture,
    device: adapter.info.device,
    vendor: adapter.info.vendor,
    description: adapter.info.description
  });
  
  // Get device with default limits
  const device = await adapter.requestDevice({
    requiredFeatures: [],
    requiredLimits: {}
  });
  
  const limits = adapter.limits;
  const workgroup = chooseWorkgroup(limits);
  const profile = determineProfile(limits, workgroup, forceCompatMode);
  
  // Log comprehensive adapter information
  console.log('📊 GPU Limits Analysis:');
  console.log('  maxComputeInvocationsPerWorkgroup:', limits.maxComputeInvocationsPerWorkgroup);
  console.log('  maxComputeWorkgroupSizeX:', limits.maxComputeWorkgroupSizeX);
  console.log('  maxComputeWorkgroupSizeY:', limits.maxComputeWorkgroupSizeY);
  console.log('  maxComputeWorkgroupSizeZ:', limits.maxComputeWorkgroupSizeZ);
  console.log('  maxStorageBufferBindingSize:', limits.maxStorageBufferBindingSize);
  console.log('  maxBufferSize:', limits.maxBufferSize);
  
  console.log('⚙️ Chosen Configuration:');
  console.log('  Workgroup Size:', `${workgroup.x}×${workgroup.y}×${workgroup.z} (${workgroup.total} total)`);
  console.log('  Profile:', profile.type.toUpperCase());
  console.log('  Tile Size:', `${profile.tilePx}px`);
  console.log('  Bake Budget:', `${profile.bakeBudget} per frame`);
  console.log('  Message:', profile.message);
  
  globalGPUConfig = {
    adapter,
    device,
    limits,
    profile,
    forceCompatMode
  };
  
  return globalGPUConfig;
}

/**
 * Get global GPU configuration (must be initialized first)
 */
export function getGPUConfig(): GPUGlobalConfig {
  if (!globalGPUConfig) {
    throw new Error('GPU configuration not initialized. Call initializeGPUConfig() first.');
  }
  return globalGPUConfig;
}

/**
 * Calculate dispatch groups for given dimensions
 */
export function calculateDispatchGroups(width: number, height: number, depth: number = 1): { x: number; y: number; z: number } {
  const config = getGPUConfig();
  const wg = config.profile.workgroup;
  
  return {
    x: Math.ceil(width / wg.x),
    y: Math.ceil(height / wg.y),
    z: Math.ceil(depth / wg.z)
  };
}

/**
 * Get shader constants for workgroup size
 */
export function getShaderConstants(): Record<string, number> {
  const config = getGPUConfig();
  const wg = config.profile.workgroup;
  
  return {
    WORKGROUP_X: wg.x,
    WORKGROUP_Y: wg.y,
    WORKGROUP_Z: wg.z
  };
}

/**
 * Get tile configuration for current profile
 */
export function getTileConfig(): { tilePx: number; bakeBudget: number } {
  const config = getGPUConfig();
  return {
    tilePx: config.profile.tilePx,
    bakeBudget: config.profile.bakeBudget
  };
}

/**
 * Check if running in compatibility mode
 */
export function isCompatibilityMode(): boolean {
  const config = getGPUConfig();
  return config.profile.type === 'compat';
}

/**
 * Get profile message for UI display
 */
export function getProfileMessage(): string {
  const config = getGPUConfig();
  return config.profile.message;
}

/**
 * Toggle force compatibility mode (for testing)
 */
export async function toggleForceCompatMode(): Promise<void> {
  if (!globalGPUConfig) {
    throw new Error('GPU configuration not initialized');
  }
  
  const newForceMode = !globalGPUConfig.forceCompatMode;
  console.log(`🔄 ${newForceMode ? 'Enabling' : 'Disabling'} Force Compatibility Mode`);
  
  // Re-initialize with new force mode
  await initializeGPUConfig(newForceMode);
}

/**
 * Run self-test to validate GPU configuration
 */
export async function runGPUSelfTest(): Promise<{ success: boolean; timingMs: number; message: string }> {
  console.log('🧪 Running GPU self-test...');
  const startTime = performance.now();
  
  try {
    const config = getGPUConfig();
    const device = config.device;
    const wg = config.profile.workgroup;
    
    // Create a simple test compute shader
    const testShader = `
      enable f16;
      override WORKGROUP_X: u32 = 16;
      override WORKGROUP_Y: u32 = 16;
      override WORKGROUP_Z: u32 = 1;
      
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;
      
      @compute @workgroup_size(WORKGROUP_X, WORKGROUP_Y, WORKGROUP_Z)
      fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
        let index = gid.y * 128u + gid.x;
        if (index < arrayLength(&data)) {
          data[index] = f32(gid.x + gid.y);
        }
      }
    `;
    
    const shaderModule = device.createShaderModule({
      label: 'gpu-self-test',
      code: testShader
    });
    
    const pipeline = device.createComputePipeline({
      label: 'gpu-self-test-pipeline',
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'main',
        constants: getShaderConstants()
      }
    });
    
    // Create test buffer
    const bufferSize = 128 * 128 * 4; // 128x128 f32 values
    const buffer = device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });
    
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer } }
      ]
    });
    
    // Dispatch test compute
    const commandEncoder = device.createCommandEncoder({ label: 'gpu-self-test-encoder' });
    const computePass = commandEncoder.beginComputePass({ label: 'gpu-self-test-pass' });
    
    computePass.setPipeline(pipeline);
    computePass.setBindGroup(0, bindGroup);
    
    const groups = calculateDispatchGroups(128, 128);
    computePass.dispatchWorkgroups(groups.x, groups.y, groups.z);
    computePass.end();
    
    device.queue.submit([commandEncoder.finish()]);
    await device.queue.onSubmittedWorkDone();
    
    // Cleanup
    buffer.destroy();
    
    const endTime = performance.now();
    const timingMs = endTime - startTime;
    
    const success = timingMs < 50; // Should complete within 50ms
    const message = success 
      ? `✅ Self-test passed in ${timingMs.toFixed(2)}ms`
      : `⚠️ Self-test slow: ${timingMs.toFixed(2)}ms (expected <50ms)`;
    
    console.log(message);
    return { success, timingMs, message };
    
  } catch (error) {
    const endTime = performance.now();
    const timingMs = endTime - startTime;
    const message = `❌ Self-test failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    
    console.error(message, error);
    return { success: false, timingMs, message };
  }
}

/**
 * Get safe fallback configuration for pipeline creation failures
 */
export function getSafeFallbackConfig(): { workgroup: WorkgroupConfig; tilePx: number; bakeBudget: number } {
  return {
    workgroup: { x: 8, y: 8, z: 1, total: 64 },
    tilePx: 64,
    bakeBudget: 1
  };
}
