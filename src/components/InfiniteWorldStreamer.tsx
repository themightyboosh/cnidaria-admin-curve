import React, { useRef, useEffect, useCallback, useImperativeHandle, useState } from 'react';
import * as THREE from 'three';
import { getWebGPUService } from '../services/webgpuService';
import { getPaletteByName } from '../utils/paletteUtils';

// MATRIX STREAMING CONFIGURATION - Fine-tune these values for performance
const STREAMING_CONFIG = {
  // Ring sizes (distance from center VIEW tile)
  ZONES: {
    VIEW: 0,     // Center tile - what user sees (1×1)
    RENDER: 2,   // Ready to display - ±2 from center (5×5 total)
    FETCH: 3,    // Currently generating - ±3 from center (7×7 total)
    CACHED: 4,   // Stored in memory - ±4 from center (9×9 total)
    PURGED: 5    // Beyond ±4 - freed from memory
  },
  
  // Performance tuning
  MAX_CONCURRENT_GENERATIONS: 3, // How many tiles can generate simultaneously
  CACHE_SIZE_LIMIT: 81,          // Max tiles in CACHED zone (9×9 = 81 tiles)
  DEFAULT_RESOLUTION: 64,        // Starting resolution
  MOVEMENT_SENSITIVITY: 0.01,    // Mouse movement scale factor
  
  // Texture caching
  ENABLE_BROWSER_CACHE: true,    // Use browser's texture cache
  CACHE_HEADERS: 'max-age=3600', // Cache textures for 1 hour
  USE_OBJECT_URLS: true,         // Use blob URLs for better memory management
  
  // Debug mode
  ENABLE_TEST_MODE: false,       // Disable coordinate grid test mode
  TEST_GRID_SIZE: 16,            // Grid lines per tile for coordinate debugging
  ENABLE_DEBUG_OVERLAY: true     // Show debug info overlay
} as const;

interface InfiniteWorldStreamerProps {
  curve?: any;
  coordinateNoise?: any;
  selectedResolution: number; // Resolution from Size dropdown - impacts matrix calculation
  onError?: (error: string) => void;
}

export interface InfiniteWorldStreamerHandle {
  regenerateAllTiles: () => void;
  setResolution: (resolution: number) => void;
  getGlobalPosition: () => { x: number; y: number };
}

interface TileData {
  id: string;
  tileX: number;
  tileY: number;
  resolution: number;
  status: 'generating' | 'ready' | 'cached';
  dataUrl?: string;
  lastAccessed: number;
  plane?: THREE.Mesh;
}

const InfiniteWorldStreamer = React.forwardRef<InfiniteWorldStreamerHandle, InfiniteWorldStreamerProps>(({ 
  curve,
  coordinateNoise,
  selectedResolution,
  onError 
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State for debug overlay updates
  const [debugData, setDebugData] = useState({
    globalPosition: { x: 0, y: 0 },
    tilePosition: { x: 0, y: 0 },
    panelSize: 0,
    totalMatrixSize: 0,
    planeData: [] as Array<{
      id: number;
      tileX: number;
      tileY: number;
      matrixRange: string;
      position: string;
    }>
  });
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    renderer: THREE.WebGLRenderer;
    textureLoader: THREE.TextureLoader;
    
    // Position tracking
    globalPosition: { x: number; y: number }; // Smooth floating point position
    tilePosition: { x: number; y: number };   // Integer tile coordinates for matrix
    
    // Tile management
    tiles: Map<string, TileData>;             // All tiles by ID
    activePlanes: THREE.Mesh[];               // 3×3 visible planes
    
    // State
    currentResolution: number;
    isOptionPressed: boolean;
    generatingCount: number;                  // Track concurrent generations
    isWireframeMode: boolean;                 // Show wireframe during refresh/generation
    isTestMode: boolean;                      // Show coordinate grid test mode
    lastSnapTime: number;                     // Prevent rapid snap-back oscillations
    debugInfo: {                              // Real-time debug information
      planeData: Array<{
        id: number;
        tileX: number;
        tileY: number;
        matrixRange: string;
        position: string;
      }>;
    };
    
    // Matrix calculation based on selected resolution × 3×3 panels
    totalMatrixSize: number;                  // selectedResolution × 3 (e.g., 128×3 = 384)
    panelSize: number;                        // selectedResolution (e.g., 128)
    
    startTime: number;
  }>();

  // Generate tile ID from coordinates
  const getTileId = useCallback((tileX: number, tileY: number, resolution: number) => {
    return `${tileX},${tileY}@${resolution}`;
  }, []);

  // Initialize Three.js scene
  const initializeScene = useCallback(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2196f3); // Blue background for debugging
    
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: false,
      premultipliedAlpha: false
    });

    // Set initial size
    const rect = containerRef.current.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Position camera
    camera.position.z = 5;

    // Create 5×5 grid of active planes (RENDER zone) with subdivisions for wireframe
    const activePlanes: THREE.Mesh[] = [];
    const planeGeometry = new THREE.PlaneGeometry(2, 2, 16, 16); // Add subdivisions for better wireframe

    for (let x = -2; x <= 2; x++) {
      for (let y = -2; y <= 2; y++) {
        const planeMaterial = new THREE.MeshBasicMaterial({ 
          color: 0xffffff,
          transparent: true,
          alphaTest: 0.001
        });
        
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.position.set(x * 2, y * 2, 0);
        plane.userData = { gridX: x, gridY: y, tileX: x, tileY: y };
        
        scene.add(plane);
        activePlanes.push(plane);
      }
    }

    // Create texture loader with caching options
    const textureLoader = new THREE.TextureLoader();
    
          // Calculate matrix sizes based on selected resolution
      const panelSize = selectedResolution;
      const totalMatrixSize = selectedResolution * 3; // 3×3 panels
      
      console.log(`📐 Matrix calculation: ${panelSize}×${panelSize} panels → ${totalMatrixSize}×${totalMatrixSize} total matrix`);

      // Store references
      sceneRef.current = {
        scene,
        camera,
        renderer,
        textureLoader,
        globalPosition: { x: 0, y: 0 },
        tilePosition: { x: 0, y: 0 },
        tiles: new Map<string, TileData>(),
        activePlanes,
        currentResolution: selectedResolution,
        isOptionPressed: false,
        generatingCount: 0,
        isWireframeMode: false,
        isTestMode: STREAMING_CONFIG.ENABLE_TEST_MODE,
        lastSnapTime: 0,
        debugInfo: { planeData: [] },
        totalMatrixSize,
        panelSize,
        startTime: Date.now()
      };

    // Add renderer to DOM
    containerRef.current.appendChild(renderer.domElement);

    console.log('🎮 Infinite World Streamer initialized with matrix zones:', STREAMING_CONFIG.ZONES);
  }, []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    regenerateAllTiles,
    setResolution: (resolution: number) => {
      if (sceneRef.current) {
        sceneRef.current.currentResolution = resolution;
        regenerateAllTiles();
      }
    },
    getGlobalPosition: () => sceneRef.current?.globalPosition || { x: 0, y: 0 }
  }), []);

  // Generate test grid with coordinates for debugging seams
  const generateTestGrid = useCallback((tileX: number, tileY: number, resolution: number): string => {
    console.log(`🧪 Generating test grid for tile (${tileX}, ${tileY}) at ${resolution}×${resolution}`);
    
    const canvas = document.createElement('canvas');
    canvas.width = resolution;
    canvas.height = resolution;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return '';
    
    // Clear with tile-specific background color
    const tileColors = [
      '#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', 
      '#44ffff', '#ffffff', '#888888', '#444444'
    ];
    const colorIndex = Math.abs((tileX + tileY * 3)) % tileColors.length;
    ctx.fillStyle = tileColors[colorIndex];
    ctx.fillRect(0, 0, resolution, resolution);
    
    // Draw coordinate grid
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.font = '12px monospace';
    ctx.fillStyle = '#000000';
    
    const gridSize = STREAMING_CONFIG.TEST_GRID_SIZE;
    const cellSize = resolution / gridSize;
    
    // Draw grid lines
    for (let i = 0; i <= gridSize; i++) {
      const pos = i * cellSize;
      
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, resolution);
      ctx.stroke();
      
      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(resolution, pos);
      ctx.stroke();
    }
    
    // Draw tile coordinates in center
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(`Tile (${tileX}, ${tileY})`, resolution / 2, resolution / 2 - 10);
    
    // Draw world coordinates at corners
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    
    const startX = tileX * resolution;
    const startY = tileY * resolution;
    const endX = startX + resolution;
    const endY = startY + resolution;
    
    // Top-left corner
    ctx.fillText(`(${startX}, ${startY})`, 5, 15);
    
    // Top-right corner  
    ctx.textAlign = 'right';
    ctx.fillText(`(${endX}, ${startY})`, resolution - 5, 15);
    
    // Bottom-left corner
    ctx.textAlign = 'left';
    ctx.fillText(`(${startX}, ${endY})`, 5, resolution - 5);
    
    // Bottom-right corner
    ctx.textAlign = 'right';
    ctx.fillText(`(${endX}, ${endY})`, resolution - 5, resolution - 5);
    
    // Draw center coordinates
    ctx.textAlign = 'center';
    ctx.fillText(`Center: (${startX + resolution/2}, ${startY + resolution/2})`, resolution / 2, resolution / 2 + 10);
    
    return canvas.toDataURL('image/png');
  }, []);

  // Generate PNG tile with browser caching support
  const generateTile = useCallback(async (tileX: number, tileY: number, resolution: number): Promise<string | null> => {
    if (!curve || !coordinateNoise || !sceneRef.current) return null;

    const tileId = getTileId(tileX, tileY, resolution);
    
    // Check if already generating this tile or if tile already exists
    const existingTile = sceneRef.current.tiles.get(tileId);
    if (existingTile?.status === 'generating') {
      console.log(`⏳ Tile ${tileId} already generating, skipping duplicate`);
      return existingTile.dataUrl || null;
    }
    
    if (sceneRef.current.generatingCount >= STREAMING_CONFIG.MAX_CONCURRENT_GENERATIONS) {
      console.log(`⏳ Generation queue full, skipping tile ${tileId}`);
      return null;
    }

    try {
      sceneRef.current.generatingCount++;
      
      console.log(`🎨 Generating PNG tile ${tileId}`);
      
      // Create tile data entry
      const tileData: TileData = {
        id: tileId,
        tileX,
        tileY,
        resolution,
        status: 'generating',
        lastAccessed: Date.now()
      };
      
      sceneRef.current.tiles.set(tileId, tileData);

      const webgpuService = getWebGPUService();
      const palette = getPaletteByName('default');
      
      // Generate complete PNG for this tile
      // TODO: Add coordinate offset logic for different tile positions
      const result = await webgpuService.processCompleteImage(
        curve,
        palette,
        coordinateNoise.gpuExpression,
        resolution,
        resolution,
        1.0, // Scale
        tileX * resolution, // Offset X by tile coordinate
        tileY * resolution, // Offset Y by tile coordinate
        (stage: string, progressPercent: number) => {
          console.log(`🔄 Tile ${tileId}: ${stage} ${progressPercent}%`);
        }
      );

      // Convert to blob URL for better caching
      const canvas = document.createElement('canvas');
      canvas.width = resolution;
      canvas.height = resolution;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        const imageData = result.result.imageData;
        ctx.putImageData(imageData, 0, 0);
        
        // Create blob URL for browser caching
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob!), 'image/png');
        });
        
        const dataUrl = URL.createObjectURL(blob);
        
        // Update tile data
        tileData.status = 'ready';
        tileData.dataUrl = dataUrl;
        tileData.lastAccessed = Date.now();
        
        console.log(`✅ PNG tile ${tileId} generated and cached`);
        return dataUrl;
      }

      return null;
    } catch (error) {
      console.error(`❌ Failed to generate tile ${tileId}:`, error);
      onError?.(`Failed to generate tile ${tileId}`);
      return null;
    } finally {
      if (sceneRef.current) {
        sceneRef.current.generatingCount--;
      }
    }
  }, [curve, coordinateNoise, onError, getTileId]);

  // Get distance from center for zone classification
  const getTileZone = useCallback((tileX: number, tileY: number, centerX: number, centerY: number) => {
    const distance = Math.max(Math.abs(tileX - centerX), Math.abs(tileY - centerY));
    
    if (distance === STREAMING_CONFIG.ZONES.VIEW) return 'VIEW';
    if (distance <= STREAMING_CONFIG.ZONES.RENDER) return 'RENDER';
    if (distance <= STREAMING_CONFIG.ZONES.FETCH) return 'FETCH';
    if (distance <= STREAMING_CONFIG.ZONES.CACHED) return 'CACHED';
    return 'PURGED';
  }, []);

  // Update matrix based on current position
  const updateMatrix = useCallback(() => {
    if (!sceneRef.current || !curve || !coordinateNoise) return;

    const { tilePosition, tiles, currentResolution } = sceneRef.current;
    const centerX = tilePosition.x;
    const centerY = tilePosition.y;

    console.log(`🗺️ Updating matrix around center (${centerX}, ${centerY})`);

    // Process all tiles in CACHED zone (7×7 grid)
    for (let x = centerX - STREAMING_CONFIG.ZONES.CACHED; x <= centerX + STREAMING_CONFIG.ZONES.CACHED; x++) {
      for (let y = centerY - STREAMING_CONFIG.ZONES.CACHED; y <= centerY + STREAMING_CONFIG.ZONES.CACHED; y++) {
        const tileId = getTileId(x, y, currentResolution);
        const zone = getTileZone(x, y, centerX, centerY);
        const existingTile = tiles.get(tileId);

        if (zone === 'PURGED') {
          // Remove tiles outside CACHED zone
          if (existingTile?.dataUrl) {
            URL.revokeObjectURL(existingTile.dataUrl);
          }
          tiles.delete(tileId);
          console.log(`🗑️ Purged tile ${tileId}`);
          continue;
        }

        if (!existingTile) {
          // Need to generate this tile
          if (zone === 'FETCH' || zone === 'RENDER' || zone === 'VIEW') {
            console.log(`⚡ Starting generation for ${zone} tile ${tileId}`);
            generateTile(x, y, currentResolution);
          }
        } else {
          // Update last accessed time for cache management
          existingTile.lastAccessed = Date.now();
          
          // If tile is ready and in RENDER/VIEW zone, apply to plane
          if (existingTile.status === 'ready' && existingTile.dataUrl && 
              (zone === 'RENDER' || zone === 'VIEW')) {
            applyTileToRenderPlane(x, y, centerX, centerY, existingTile.dataUrl);
          }
        }
      }
    }

    // Clean up old cached tiles (LRU management)
    if (tiles.size > STREAMING_CONFIG.CACHE_SIZE_LIMIT) {
      const sortedTiles = Array.from(tiles.values())
        .sort((a, b) => a.lastAccessed - b.lastAccessed);
      
      const tilesToRemove = sortedTiles.slice(0, tiles.size - STREAMING_CONFIG.CACHE_SIZE_LIMIT);
      tilesToRemove.forEach(tile => {
        if (tile.dataUrl) {
          URL.revokeObjectURL(tile.dataUrl);
        }
        tiles.delete(tile.id);
        console.log(`💾 LRU removed tile ${tile.id}`);
      });
    }
  }, [curve, coordinateNoise, getTileId, getTileZone, generateTile]);

  // Apply tile texture to the appropriate plane in the 3×3 RENDER grid
  const applyTileToRenderPlane = useCallback((tileX: number, tileY: number, centerX: number, centerY: number, dataUrl: string) => {
    if (!sceneRef.current) return;

    const { activePlanes, textureLoader } = sceneRef.current;
    
    // Calculate which plane in the 3×3 grid this tile should go to
    const gridX = tileX - centerX; // -1, 0, or 1
    const gridY = tileY - centerY; // -1, 0, or 1
    
    // Skip if outside the 3×3 RENDER grid
    if (Math.abs(gridX) > 1 || Math.abs(gridY) > 1) return;
    
    // Find the plane for this grid position
    const planeIndex = (gridY + 1) * 3 + (gridX + 1); // Convert to 0-8 index
    const plane = activePlanes[planeIndex];
    
    if (!plane) return;

    // Load texture with caching
    textureLoader.load(
      dataUrl,
      (texture) => {
        // Configure texture for pixelated rendering and caching
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        
        // Enable browser caching if configured
        if (STREAMING_CONFIG.ENABLE_BROWSER_CACHE) {
          texture.image.crossOrigin = 'anonymous';
        }

        // Apply to plane material
        if (plane.material instanceof THREE.MeshBasicMaterial) {
          // Dispose of old texture
          if (plane.material.map) {
            plane.material.map.dispose();
          }
          
          plane.material.map = texture;
          plane.material.needsUpdate = true;
        }
        
        console.log(`🖼️ Applied texture to RENDER plane at grid (${gridX}, ${gridY}) for tile (${tileX}, ${tileY})`);
      },
      undefined,
      (error) => {
        console.error('❌ Failed to load texture:', error);
        onError?.('Failed to load generated texture');
      }
    );
  }, [onError]);

  // Update camera for liquid viewport behavior
  const updateCamera = useCallback(() => {
    if (!containerRef.current || !sceneRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const { camera, renderer } = sceneRef.current;
    const aspect = rect.width / rect.height;

    // Calculate orthographic frustum
    let left, right, top, bottom;
    const planeSize = 1;

    if (aspect > 1) {
      top = planeSize;
      bottom = -planeSize;
      left = -planeSize * aspect;
      right = planeSize * aspect;
    } else {
      left = -planeSize;
      right = planeSize;
      top = planeSize / aspect;
      bottom = -planeSize / aspect;
    }

    // Zoom factor for liquid viewport (fine-tune this)
    const zoomFactor = 0.7;
    camera.left = left * zoomFactor;
    camera.right = right * zoomFactor;
    camera.top = top * zoomFactor;
    camera.bottom = bottom * zoomFactor;
    camera.updateProjectionMatrix();

    renderer.setSize(rect.width, rect.height);
    renderer.setPixelRatio(window.devicePixelRatio);
  }, []);

  // Update plane positions for smooth movement - ULTRA-SIMPLE VERSION THAT WORKS
  const updatePlanePositions = useCallback(() => {
    if (!sceneRef.current) return;

    const { globalPosition, activePlanes } = sceneRef.current;
    
    // ULTRA-SIMPLE approach: just shift the entire grid by global position
    const shiftX = -globalPosition.x * 2; // Scale by 2 for 2-unit grid spacing
    const shiftY = -globalPosition.y * 2; // Scale by 2 for 2-unit grid spacing
    
    activePlanes.forEach((plane, index) => {
      const gridX = (index % 5) - 2; // -2, -1, 0, 1, 2
      const gridY = Math.floor(index / 5) - 2; // -2, -1, 0, 1, 2
      
      // Simple: base grid position + global shift
      const finalX = (gridX * 2) + shiftX;
      const finalY = (gridY * 2) + shiftY;
      
      plane.position.set(finalX, finalY, 0);
    });
  }, []);

  // Toggle wireframe mode for all planes
  const setWireframeMode = useCallback((enabled: boolean) => {
    if (!sceneRef.current) return;

    sceneRef.current.isWireframeMode = enabled;
    sceneRef.current.activePlanes.forEach((plane, index) => {
      if (plane.material instanceof THREE.MeshBasicMaterial) {
        plane.material.wireframe = enabled;
        plane.material.needsUpdate = true;
        
        if (enabled) {
          // Show plane structure in wireframe with different colors per plane
          const wireframeColors = [
            0xff0000, 0x00ff00, 0x0000ff, // Red, Green, Blue
            0xffff00, 0xff00ff, 0x00ffff, // Yellow, Magenta, Cyan  
            0xffffff, 0x888888, 0x444444  // White, Gray, Dark Gray
          ];
          plane.material.color.setHex(wireframeColors[index] || 0xffffff);
        } else {
          // Reset to white for texture display
          plane.material.color.setHex(0xffffff);
        }
      }
    });
    
    console.log(`🔧 Wireframe mode ${enabled ? 'ENABLED' : 'DISABLED'} - showing plane structure`);
  }, []);

  // Shift textures and generate new panels for smooth contiguous generation
  const shiftTexturesAndGenerateNew = useCallback((shiftX: number, shiftY: number) => {
    if (!sceneRef.current) return;

    const { activePlanes, tilePosition, currentResolution } = sceneRef.current;
    
    console.log(`🔄 Shifting textures by (${shiftX}, ${shiftY}) panels for smooth continuity`);
    
    // Create new texture assignments for shifted grid
    const newTextureAssignments = new Map<number, string>();
    
    // For each plane in the 5×5 grid
    activePlanes.forEach((plane, planeIndex) => {
      const gridX = (planeIndex % 5) - 2; // -2, -1, 0, 1, 2
      const gridY = Math.floor(planeIndex / 5) - 2; // -2, -1, 0, 1, 2
      
      // Calculate which tile this plane should now show after shift
      const newTileX = tilePosition.x + gridX;
      const newTileY = tilePosition.y + gridY;
      const tileId = getTileId(newTileX, newTileY, currentResolution);
      
      // Check if we have this tile cached
      const cachedTile = sceneRef.current!.tiles.get(tileId);
      
      if (cachedTile?.dataUrl && cachedTile.status === 'ready') {
        // Use cached texture
        console.log(`📦 Using cached texture for plane ${planeIndex} at tile (${newTileX}, ${newTileY})`);
        applyTextureToPlane(plane, cachedTile.dataUrl);
      } else {
        // Need to generate new texture (test mode or normal)
        console.log(`🎨 Generating new texture for plane ${planeIndex} at tile (${newTileX}, ${newTileY})`);
        const generatePromise = sceneRef.current!.isTestMode 
          ? Promise.resolve(generateTestGrid(newTileX, newTileY, currentResolution))
          : generateTileForContiguousMatrix(newTileX, newTileY, currentResolution);
          
        generatePromise.then((dataUrl) => {
          if (dataUrl) {
            applyTextureToPlane(plane, dataUrl);
          }
        });
      }
      
      // Update plane's tile tracking
      plane.userData.tileX = newTileX;
      plane.userData.tileY = newTileY;
    });
    
    console.log('✅ Texture shift complete - smooth contiguous generation maintained');
  }, [getTileId]);

  // Generate tile specifically for contiguous matrix (with proper coordinate offset)
  const generateTileForContiguousMatrix = useCallback(async (tileX: number, tileY: number, resolution: number): Promise<string | null> => {
    if (!curve || !sceneRef.current) return null;
    
    // Handle bypass mode - use 'none' coordinate noise when bypassed
    const effectiveCoordinateNoise = coordinateNoise || { 
      name: 'none', 
      gpuExpression: 'x' // Pass through coordinates
    };

    const { panelSize, totalMatrixSize } = sceneRef.current;
    const tileId = getTileId(tileX, tileY, resolution);
    
    try {
      console.log(`🌍 Generating contiguous matrix tile ${tileId} (panel: ${panelSize}×${panelSize}, total matrix: ${totalMatrixSize}×${totalMatrixSize})`);
      
      const webgpuService = getWebGPUService();
      const palette = getPaletteByName('default');
      
      // Calculate the starting coordinates for this tile to ensure contiguous generation
      // Each tile represents a section of the infinite coordinate space
      const tileStartX = tileX * panelSize;
      const tileStartY = tileY * panelSize;
      
      console.log(`📐 Contiguous coordinates: tile (${tileX}, ${tileY}) → start (${tileStartX}, ${tileStartY}) for ${panelSize}×${panelSize} panel`);
      
      // Generate this panel as part of the larger contiguous coordinate space
      const result = await webgpuService.processCompleteImage(
        curve,
        palette,
        effectiveCoordinateNoise.gpuExpression,
        resolution, // Panel resolution (e.g., 128×128)
        resolution,
        1.0, // Scale - keep at 1.0 for pixel-perfect mapping
        tileStartX, // Start X for this tile's coordinate space
        tileStartY, // Start Y for this tile's coordinate space
        (stage: string, progressPercent: number) => {
          console.log(`🔄 Contiguous tile ${tileId}: ${stage} ${progressPercent}%`);
        }
      );

      // Convert to blob URL for caching
      const canvas = document.createElement('canvas');
      canvas.width = resolution;
      canvas.height = resolution;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        const imageData = result.result.imageData;
        ctx.putImageData(imageData, 0, 0);
        
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob!), 'image/png');
        });
        
        const dataUrl = URL.createObjectURL(blob);
        
        // Cache the tile
        const tileData: TileData = {
          id: tileId,
          tileX,
          tileY,
          resolution,
          status: 'ready',
          dataUrl,
          lastAccessed: Date.now()
        };
        
        sceneRef.current!.tiles.set(tileId, tileData);
        
        console.log(`✅ Contiguous matrix tile ${tileId} generated and cached`);
        return dataUrl;
      }

      return null;
    } catch (error) {
      console.error(`❌ Failed to generate contiguous matrix tile ${tileId}:`, error);
      onError?.(`Failed to generate tile ${tileId}`);
      return null;
    }
  }, [curve, coordinateNoise, onError, getTileId]);

  // Update debug information for real-time display
  const updateDebugInfo = useCallback(() => {
    if (!sceneRef.current || !STREAMING_CONFIG.ENABLE_DEBUG_OVERLAY) return;

    const { activePlanes, globalPosition, panelSize, totalMatrixSize, tilePosition } = sceneRef.current;
    
    const planeData = activePlanes.map((plane, index) => {
      const tileX = plane.userData.tileX || 0;
      const tileY = plane.userData.tileY || 0;
      
      // Calculate matrix range for this tile
      const startX = tileX * panelSize;
      const startY = tileY * panelSize;
      const endX = startX + panelSize;
      const endY = startY + panelSize;
      
      return {
        id: index,
        tileX,
        tileY,
        matrixRange: `(${startX},${startY}) to (${endX},${endY})`,
        position: `(${plane.position.x.toFixed(2)}, ${plane.position.y.toFixed(2)})`
      };
    });
    
    // Update React state to trigger re-render
    setDebugData({
      globalPosition: { ...globalPosition },
      tilePosition: { ...tilePosition },
      panelSize,
      totalMatrixSize,
      planeData
    });
  }, []);

  // Apply texture to plane
  const applyTextureToPlane = useCallback((plane: THREE.Mesh, dataUrl: string) => {
    if (!sceneRef.current) return;

    const { textureLoader } = sceneRef.current;
    
    textureLoader.load(
      dataUrl,
      (texture) => {
        // Configure for pixelated contiguous rendering
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        // Apply to plane
        if (plane.material instanceof THREE.MeshBasicMaterial) {
          if (plane.material.map) {
            console.log(`🗑️ Disposing old texture for plane`);
            plane.material.map.dispose();
          }
          
          console.log(`🖼️ Applying new texture to plane`);
          plane.material.map = texture;
          
          // Disable wireframe mode when texture is applied
          plane.material.wireframe = false;
          plane.material.color.setHex(0xffffff); // Reset to white
          plane.material.needsUpdate = true;
        }
        
        // Check if all planes have textures loaded, then disable wireframe globally
        checkAllPlanesLoaded();
      },
      undefined,
      (error) => {
        console.error('❌ Texture load failed:', error);
        onError?.('Failed to load texture');
      }
    );
  }, [onError]);

  // Check if all planes have textures loaded and disable wireframe mode
  const checkAllPlanesLoaded = useCallback(() => {
    if (!sceneRef.current || !sceneRef.current.isWireframeMode) return;

    const { activePlanes } = sceneRef.current;
    
    // Check if all planes have textures
    const allPlanesLoaded = activePlanes.every(plane => {
      if (plane.material instanceof THREE.MeshBasicMaterial) {
        return plane.material.map !== null;
      }
      return false;
    });

    if (allPlanesLoaded) {
      console.log('✅ All planes loaded - disabling wireframe mode');
      setWireframeMode(false);
    }
  }, [setWireframeMode]);

  // Generate initial tiles for the 3×3 grid
  const generateInitialTiles = useCallback(() => {
    if (!sceneRef.current || !curve || !coordinateNoise) return;

    const { tilePosition, currentResolution, activePlanes } = sceneRef.current;
    
    console.log('🎨 Generating initial 5×5 tile grid');
    
    // Generate tiles for each plane in the 5×5 grid
    activePlanes.forEach((plane, planeIndex) => {
      const gridX = (planeIndex % 5) - 2; // -2, -1, 0, 1, 2
      const gridY = Math.floor(planeIndex / 5) - 2; // -2, -1, 0, 1, 2
      
      const tileX = tilePosition.x + gridX;
      const tileY = tilePosition.y + gridY;
      
      // Update plane tracking
      plane.userData.tileX = tileX;
      plane.userData.tileY = tileY;
      
                // Generate texture for this tile (test mode or normal)
          const generatePromise = sceneRef.current.isTestMode 
            ? Promise.resolve(generateTestGrid(tileX, tileY, currentResolution))
            : generateTileForContiguousMatrix(tileX, tileY, currentResolution);
            
          generatePromise.then((dataUrl) => {
            if (dataUrl) {
              applyTextureToPlane(plane, dataUrl);
            }
          });
    });
  }, [curve, coordinateNoise]);

  // Immediately recenter viewable area and redraw after matrix changes
  const recenterAndRedrawImmediate = useCallback(() => {
    if (!sceneRef.current) return;

    console.log('🎯 Recentering and redrawing viewable area immediately');
    
    // Reset all plane positions to 5×5 grid layout (no fractional offset)
    sceneRef.current.activePlanes.forEach((plane, index) => {
      const gridX = (index % 5) - 2; // -2, -1, 0, 1, 2
      const gridY = Math.floor(index / 5) - 2; // -2, -1, 0, 1, 2
      
      // Reset to exact grid positions (no smooth offset)
      plane.position.set(gridX * 2, gridY * 2, 0);
    });
    
    // Force immediate generation of center tiles
    const { tilePosition, currentResolution } = sceneRef.current;
    
    // Generate the 5×5 grid immediately with priority on center tile
    const centerTileX = tilePosition.x;
    const centerTileY = tilePosition.y;
    
    console.log(`🎯 Immediate redraw around center tile (${centerTileX}, ${centerTileY})`);
    
    // Generate center tile first (highest priority)
    const centerPlane = sceneRef.current.activePlanes[12]; // Center of 5×5 grid (index 12)
    centerPlane.userData.tileX = centerTileX;
    centerPlane.userData.tileY = centerTileY;
    
    generateTileForContiguousMatrix(centerTileX, centerTileY, currentResolution).then((dataUrl) => {
      if (dataUrl) {
        applyTextureToPlane(centerPlane, dataUrl);
        console.log('✅ Center tile redrawn immediately');
      }
    });
    
    // Generate surrounding tiles
    sceneRef.current.activePlanes.forEach((plane, index) => {
      if (index === 12) return; // Skip center (already done)
      
      const gridX = (index % 5) - 2;
      const gridY = Math.floor(index / 5) - 2;
      const tileX = centerTileX + gridX;
      const tileY = centerTileY + gridY;
      
      plane.userData.tileX = tileX;
      plane.userData.tileY = tileY;
      
      generateTileForContiguousMatrix(tileX, tileY, currentResolution).then((dataUrl) => {
        if (dataUrl) {
          applyTextureToPlane(plane, dataUrl);
        }
      });
    });
    
  }, []);

  // Regenerate all tiles (for resolution changes, etc.)
  const regenerateAllTiles = useCallback(() => {
    if (!sceneRef.current) return;

    console.log('🔄 Regenerating all tiles at resolution:', sceneRef.current.currentResolution);
    
    // Enable wireframe mode during regeneration
    setWireframeMode(true);
    
    // Clear all cached tiles
    sceneRef.current.tiles.forEach(tile => {
      if (tile.dataUrl) {
        URL.revokeObjectURL(tile.dataUrl);
      }
    });
    sceneRef.current.tiles.clear();
    
    // Force regeneration by clearing plane tile assignments
    sceneRef.current.activePlanes.forEach(plane => {
      plane.userData.tileX = Number.MIN_SAFE_INTEGER;
      plane.userData.tileY = Number.MIN_SAFE_INTEGER;
    });
    
    // Generate initial tiles
    generateInitialTiles();
  }, [setWireframeMode]);

  // Animation loop
  const animate = useCallback(() => {
    if (!sceneRef.current) return;

    const { scene, camera, renderer } = sceneRef.current;
    
    // Update plane positions for smooth movement
    updatePlanePositions();
    
    // Update debug info for overlay
    updateDebugInfo();
    
    // Render the scene
    renderer.render(scene, camera);
    
    // Continue animation loop
    requestAnimationFrame(animate);
  }, [updatePlanePositions, updateDebugInfo]);

  // Option key polling for resolution scaling
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Alt' || event.key === 'Option') {
        if (sceneRef.current && !sceneRef.current.isOptionPressed) {
          sceneRef.current.isOptionPressed = true;
          console.log('🔍 Option key pressed - resolution scaling enabled');
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Alt' || event.key === 'Option') {
        if (sceneRef.current && sceneRef.current.isOptionPressed) {
          sceneRef.current.isOptionPressed = false;
          console.log('🔍 Option key released - resolution scaling disabled');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Mouse movement and controls
  useEffect(() => {
    if (!containerRef.current) return;

    let isDragging = false;
    let lastMousePos = { x: 0, y: 0 };

    const handleMouseDown = (event: MouseEvent) => {
      isDragging = true;
      lastMousePos = { x: event.clientX, y: event.clientY };
      containerRef.current!.style.cursor = 'grabbing';
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging || !sceneRef.current) return;

      const deltaX = event.clientX - lastMousePos.x;
      const deltaY = event.clientY - lastMousePos.y;
      
      // Convert to world coordinates
      const worldDeltaX = -deltaX * STREAMING_CONFIG.MOVEMENT_SENSITIVITY;
      const worldDeltaY = -deltaY * STREAMING_CONFIG.MOVEMENT_SENSITIVITY; // Fixed: negative for correct Y direction

      // Update smooth global position
      sceneRef.current.globalPosition.x += worldDeltaX;
      sceneRef.current.globalPosition.y += worldDeltaY;

      // Debug current position (reduced logging)
      // console.log(`🖱️ Mouse move - Global: (${sceneRef.current.globalPosition.x.toFixed(3)}, ${sceneRef.current.globalPosition.y.toFixed(3)}), Tile: (${sceneRef.current.tilePosition.x}, ${sceneRef.current.tilePosition.y})`);

      // Check if we need to snap back (moved beyond panel boundary)
      // With 5×5 grid, we have more room before needing to snap
      const panelBoundary = 1.0; // Back to full panel width for 5×5 grid
      
      let needsSnap = false;
      let panelShiftX = 0;
      let panelShiftY = 0;
      
      // Check X direction with hysteresis to prevent oscillation
      if (sceneRef.current.globalPosition.x >= panelBoundary) {
        panelShiftX = 1; // Moving right
        needsSnap = true;
      } else if (sceneRef.current.globalPosition.x <= -panelBoundary) {
        panelShiftX = -1; // Moving left
        needsSnap = true;
      }
      
      // Check Y direction with hysteresis
      if (sceneRef.current.globalPosition.y >= panelBoundary) {
        panelShiftY = 1; // Moving up
        needsSnap = true;
      } else if (sceneRef.current.globalPosition.y <= -panelBoundary) {
        panelShiftY = -1; // Moving down
        needsSnap = true;
      }
      
      if (needsSnap) {
        // Prevent rapid snap-backs (debounce)
        const now = Date.now();
        if (now - sceneRef.current.lastSnapTime < 100) {
          return; // Skip if too soon after last snap
        }
        sceneRef.current.lastSnapTime = now;
        
        console.log(`🔄 SNAP-BACK TRIGGERED!`);
        console.log(`📍 Before: Global(${sceneRef.current.globalPosition.x.toFixed(3)}, ${sceneRef.current.globalPosition.y.toFixed(3)}), Tile(${sceneRef.current.tilePosition.x}, ${sceneRef.current.tilePosition.y})`);
        console.log(`➡️ Shift: (${panelShiftX}, ${panelShiftY})`);
        
        // Snap back to center with exact values to prevent accumulation errors
        sceneRef.current.globalPosition.x = sceneRef.current.globalPosition.x - panelShiftX;
        sceneRef.current.globalPosition.y = sceneRef.current.globalPosition.y - panelShiftY;
        
        // Ensure global position stays within bounds after snap
        sceneRef.current.globalPosition.x = Math.max(-0.49, Math.min(0.49, sceneRef.current.globalPosition.x));
        sceneRef.current.globalPosition.y = Math.max(-0.49, Math.min(0.49, sceneRef.current.globalPosition.y));
        
        // Update tile position for matrix generation
        sceneRef.current.tilePosition.x += panelShiftX;
        sceneRef.current.tilePosition.y += panelShiftY;
        
        console.log(`📍 After: Global(${sceneRef.current.globalPosition.x.toFixed(3)}, ${sceneRef.current.globalPosition.y.toFixed(3)}), Tile(${sceneRef.current.tilePosition.x}, ${sceneRef.current.tilePosition.y})`);
        
        // Enable wireframe mode during refresh
        setWireframeMode(true);
        
        // Shift textures and generate new panels for smooth contiguous view
        shiftTexturesAndGenerateNew(panelShiftX, panelShiftY);
      }

      lastMousePos = { x: event.clientX, y: event.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grab';
      }
    };

    const handleWheel = (event: WheelEvent) => {
      if (!sceneRef.current) return;

      if (sceneRef.current.isOptionPressed) {
        event.preventDefault();
        
        const resolutions = [8, 16, 32, 64, 128, 256];
        const currentIndex = resolutions.indexOf(sceneRef.current.currentResolution);
        
        let newIndex;
        if (event.deltaY > 0) {
          newIndex = Math.max(0, currentIndex - 1);
        } else {
          newIndex = Math.min(resolutions.length - 1, currentIndex + 1);
        }

        const newResolution = resolutions[newIndex];
        if (newResolution !== sceneRef.current.currentResolution) {
          sceneRef.current.currentResolution = newResolution;
          console.log('🔍 Resolution changed to:', newResolution + '×' + newResolution);
          
          // Enable wireframe mode during resolution change
          setWireframeMode(true);
          
          regenerateAllTiles();
        }
      }
    };

    const container = containerRef.current;
    container.style.cursor = 'grab';
    
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [updateMatrix, regenerateAllTiles]);

  // Initialize scene
  useEffect(() => {
    initializeScene();
    
    return () => {
      // Cleanup Three.js resources
      if (sceneRef.current) {
        const { renderer, tiles } = sceneRef.current;
        
        // Dispose of all cached textures
        tiles.forEach(tile => {
          if (tile.dataUrl) {
            URL.revokeObjectURL(tile.dataUrl);
          }
        });
        
        renderer.dispose();
        
        if (containerRef.current && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
  }, [initializeScene]);

  // Start animation and camera setup
  useEffect(() => {
    if (sceneRef.current) {
      updateCamera();
      animate();
    }
  }, [updateCamera, animate]);

  // Reset matrix and regenerate when curve or coordinate noise changes
  useEffect(() => {
    if (curve && coordinateNoise && sceneRef.current) {
      console.log('🔄 Curve or noise changed - resetting matrix and regenerating all tiles');
      
      // Reset global position to origin
      sceneRef.current.globalPosition = { x: 0, y: 0 };
      sceneRef.current.tilePosition = { x: 0, y: 0 };
      
      // Clear all cached textures and tiles
      sceneRef.current.tiles.forEach(tile => {
        if (tile.dataUrl) {
          URL.revokeObjectURL(tile.dataUrl);
        }
      });
      sceneRef.current.tiles.clear();
      
      // Clear all plane textures
      sceneRef.current.activePlanes.forEach(plane => {
        if (plane.material instanceof THREE.MeshBasicMaterial && plane.material.map) {
          plane.material.map.dispose();
          plane.material.map = null;
          plane.material.needsUpdate = true;
        }
        // Reset plane tile assignments
        plane.userData.tileX = Number.MIN_SAFE_INTEGER;
        plane.userData.tileY = Number.MIN_SAFE_INTEGER;
      });
      
      // Trigger regeneration and immediate recentering
      regenerateAllTiles();
      
      // Immediately recenter and redraw the viewable area
      recenterAndRedrawImmediate();
    }
  }, [curve, coordinateNoise, regenerateAllTiles]);

  // Reset matrix when selected resolution changes
  useEffect(() => {
    if (sceneRef.current && sceneRef.current.currentResolution !== selectedResolution) {
      console.log(`🔄 Resolution changed from ${sceneRef.current.currentResolution} to ${selectedResolution} - resetting matrix`);
      
      // Update resolution and matrix calculations
      sceneRef.current.currentResolution = selectedResolution;
      sceneRef.current.panelSize = selectedResolution;
      sceneRef.current.totalMatrixSize = selectedResolution * 3;
      
      console.log(`📐 Updated matrix: ${sceneRef.current.panelSize}×${sceneRef.current.panelSize} panels → ${sceneRef.current.totalMatrixSize}×${sceneRef.current.totalMatrixSize} total`);
      
      // Clear everything and regenerate with immediate recentering
      regenerateAllTiles();
      
      // Immediately recenter and redraw the viewable area
      recenterAndRedrawImmediate();
    }
  }, [selectedResolution, regenerateAllTiles]);

  // Resize handler
  useEffect(() => {
    let resizeTimeout: number;
    
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateCamera, 100);
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [updateCamera]);

  return (
    <div 
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#000000',
        position: 'relative'
      }}
    >
      {/* Real-time Debug Overlay */}
      {STREAMING_CONFIG.ENABLE_DEBUG_OVERLAY && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: '#00ff00',
          padding: '10px',
          borderRadius: '5px',
          fontFamily: 'monospace',
          fontSize: '12px',
          zIndex: 1000,
          maxWidth: '400px',
          pointerEvents: 'none'
        }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#ffff00' }}>
            🔍 INFINITE WORLD DEBUG
          </div>
          
          <div style={{ marginBottom: '5px' }}>
            <strong>Global Position:</strong> ({debugData.globalPosition.x.toFixed(3)}, {debugData.globalPosition.y.toFixed(3)})
          </div>
          
          <div style={{ marginBottom: '5px' }}>
            <strong>Tile Center:</strong> ({debugData.tilePosition.x}, {debugData.tilePosition.y})
          </div>
          
          <div style={{ marginBottom: '5px' }}>
            <strong>Matrix:</strong> {debugData.panelSize}×{debugData.panelSize} panels → {debugData.totalMatrixSize}×{debugData.totalMatrixSize} total
          </div>
          
          <div style={{ marginBottom: '8px', color: '#ff8800' }}>
            <strong>5×5 PLANE GRID:</strong>
          </div>
          
          {debugData.planeData.map((plane) => (
            <div key={plane.id} style={{ 
              marginBottom: '2px',
              color: plane.id === 12 ? '#ff0000' : '#ffffff' // Highlight center plane
            }}>
              <strong>Plane {plane.id}:</strong> Tile({plane.tileX},{plane.tileY}) | Matrix{plane.matrixRange} | Pos{plane.position}
            </div>
          ))}
          
          <div style={{ marginTop: '8px', fontSize: '10px', color: '#888888' }}>
            Center plane (ID 12) highlighted in red
          </div>
        </div>
      )}
    </div>
  );
});

InfiniteWorldStreamer.displayName = 'InfiniteWorldStreamer';

export default InfiniteWorldStreamer;
