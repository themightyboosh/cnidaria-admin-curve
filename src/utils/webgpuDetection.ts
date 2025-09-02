/**
 * WebGPU Detection and Initialization Utilities
 * WebGPU-ONLY implementation - no CPU fallback
 * Application requires WebGPU-compatible browser
 */

export interface WebGPUCapabilities {
  supported: boolean;
  adapter: GPUAdapter | null;
  device: GPUDevice | null;
  maxComputeWorkgroupSizeX: number;
  maxComputeWorkgroupSizeY: number;
  maxComputeWorkgroupSizeZ: number;
  maxStorageBufferBindingSize: number;
  maxComputeInvocationsPerWorkgroup: number;
}

let webgpuCapabilities: WebGPUCapabilities | null = null;

/**
 * Check if WebGPU is supported in the current browser
 */
export function isWebGPUSupported(): boolean {
  return 'gpu' in navigator;
}

/**
 * Get detailed browser and WebGPU information for debugging
 */
export function getBrowserInfo() {
  const userAgent = navigator.userAgent;
  const isChrome = userAgent.includes('Chrome');
  const isFirefox = userAgent.includes('Firefox');
  const isSafari = userAgent.includes('Safari') && !isChrome;
  const isEdge = userAgent.includes('Edge');
  
  return {
    userAgent,
    browser: isChrome ? 'Chrome' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : isEdge ? 'Edge' : 'Unknown',
    webgpuSupported: isWebGPUSupported(),
    webgpuObject: 'gpu' in navigator ? 'Available' : 'Not Available'
  };
}

/**
 * Initialize WebGPU and get device capabilities
 * Now uses the new GPU configuration system for compatibility
 */
export async function initializeWebGPU(): Promise<WebGPUCapabilities> {
  if (webgpuCapabilities) {
    return webgpuCapabilities;
  }

  const capabilities: WebGPUCapabilities = {
    supported: false,
    adapter: null,
    device: null,
    maxComputeWorkgroupSizeX: 0,
    maxComputeWorkgroupSizeY: 0,
    maxComputeWorkgroupSizeZ: 0,
    maxStorageBufferBindingSize: 0,
    maxComputeInvocationsPerWorkgroup: 0
  };

  if (!isWebGPUSupported()) {
    console.warn('WebGPU is not supported in this browser');
    webgpuCapabilities = capabilities;
    return capabilities;
  }

  try {
    // Import the new configuration system
    const { initializeGPUConfig } = await import('./webgpuConfig');
    
    // Initialize GPU configuration with compatibility detection
    const config = await initializeGPUConfig();
    
    capabilities.supported = true;
    capabilities.adapter = config.adapter;
    capabilities.device = config.device;
    capabilities.maxComputeWorkgroupSizeX = config.limits.maxComputeWorkgroupSizeX;
    capabilities.maxComputeWorkgroupSizeY = config.limits.maxComputeWorkgroupSizeY;
    capabilities.maxComputeWorkgroupSizeZ = config.limits.maxComputeWorkgroupSizeZ;
    capabilities.maxStorageBufferBindingSize = config.limits.maxStorageBufferBindingSize;
    capabilities.maxComputeInvocationsPerWorkgroup = config.limits.maxComputeInvocationsPerWorkgroup;

    console.log('WebGPU initialized successfully with configuration:', {
      adapter: config.adapter.info,
      profile: config.profile.type,
      workgroup: config.profile.workgroup,
      limits: {
        maxComputeWorkgroupSizeX: config.limits.maxComputeWorkgroupSizeX,
        maxComputeWorkgroupSizeY: config.limits.maxComputeWorkgroupSizeY,
        maxComputeWorkgroupSizeZ: config.limits.maxComputeWorkgroupSizeZ,
        maxStorageBufferBindingSize: config.limits.maxStorageBufferBindingSize,
        maxComputeInvocationsPerWorkgroup: config.limits.maxComputeInvocationsPerWorkgroup
      }
    });

  } catch (error) {
    console.error('Failed to initialize WebGPU:', error);
    capabilities.supported = false;
  }

  webgpuCapabilities = capabilities;
  return capabilities;
}

/**
 * Get cached WebGPU capabilities (initialize first if needed)
 */
export async function getWebGPUCapabilities(): Promise<WebGPUCapabilities> {
  if (!webgpuCapabilities) {
    return await initializeWebGPU();
  }
  return webgpuCapabilities;
}

/**
 * Generate user-friendly WebGPU status message
 */
export function getWebGPUStatusMessage(capabilities: WebGPUCapabilities): string {
  const browserInfo = getBrowserInfo();
  
  if (!browserInfo.webgpuSupported) {
    return `❌ WEBGPU REQUIRED: This application requires WebGPU support. Please use Chrome 113+, Firefox 110+, or Safari 16.4+. Current browser: ${browserInfo.browser}`;
  }
  
  if (!capabilities.supported) {
    return `❌ WEBGPU INITIALIZATION FAILED: WebGPU is supported but could not be initialized. Please check hardware acceleration settings and ensure your GPU drivers are up to date.`;
  }
  
  return `✅ WebGPU Active: GPU-accelerated processing ready! Max workgroup: ${capabilities.maxComputeWorkgroupSizeX}x${capabilities.maxComputeWorkgroupSizeY}x${capabilities.maxComputeWorkgroupSizeZ}`;
}

/**
 * Check if current hardware/browser combination supports required WebGPU features
 */
export function checkWebGPURequirements(capabilities: WebGPUCapabilities): {
  compatible: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  if (!capabilities.supported) {
    issues.push('WebGPU is not available');
    recommendations.push('Update to a WebGPU-compatible browser');
    return { compatible: false, issues, recommendations };
  }
  
  // Check minimum workgroup sizes for our compute shaders
  if (capabilities.maxComputeWorkgroupSizeX < 256) {
    issues.push(`Compute workgroup X size too small: ${capabilities.maxComputeWorkgroupSizeX} (minimum 256)`);
  }
  
  if (capabilities.maxComputeWorkgroupSizeY < 256) {
    issues.push(`Compute workgroup Y size too small: ${capabilities.maxComputeWorkgroupSizeY} (minimum 256)`);
  }
  
  // Check storage buffer size for large images
  const minBufferSize = 512 * 512 * 4 * 4; // 512x512 RGBA + coordinate data
  if (capabilities.maxStorageBufferBindingSize < minBufferSize) {
    issues.push(`Storage buffer too small: ${capabilities.maxStorageBufferBindingSize} bytes (minimum ${minBufferSize})`);
    recommendations.push('GPU may not support full 512x512 image generation');
  }
  
  // Check total invocations per workgroup
  if (capabilities.maxComputeInvocationsPerWorkgroup < 1024) {
    issues.push(`Max invocations per workgroup too small: ${capabilities.maxComputeInvocationsPerWorkgroup} (minimum 1024)`);
  }
  
  const compatible = issues.length === 0;
  
  if (compatible) {
    recommendations.push('✅ All WebGPU requirements met - full GPU acceleration available');
  } else {
    recommendations.push('❌ APPLICATION CANNOT RUN: WebGPU requirements not met');
    recommendations.push('Please upgrade your browser, GPU drivers, or use a more powerful GPU');
  }
  
  return { compatible, issues, recommendations };
}
