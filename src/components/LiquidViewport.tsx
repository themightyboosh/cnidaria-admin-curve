import React, { useRef, useEffect, useCallback, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { getWebGPUService } from '../services/webgpuService';
import { getPaletteByName } from '../utils/paletteUtils';

interface LiquidViewportProps {
  textureDataUrl?: string | null;
  curve?: any; // Will receive curve data for tile generation
  coordinateNoise?: any; // Will receive coordinate noise for tile generation
  onError?: (error: string) => void;
}

// Expose methods for external control
export interface LiquidViewportHandle {
  regenerateAllTiles: () => void;
  setResolution: (resolution: number) => void;
}

const LiquidViewport = React.forwardRef<LiquidViewportHandle, LiquidViewportProps>(({ 
  textureDataUrl,
  curve,
  coordinateNoise, 
  onError 
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    renderer: THREE.WebGLRenderer;
    planes: THREE.Mesh[];
    centerPlane: THREE.Mesh;
    textureLoader: THREE.TextureLoader;
    globalPosition: { x: number; y: number }; // Smooth floating point position
    tilePosition: { x: number; y: number }; // Integer tile coordinates for matrix generation
    currentResolution: number;
    isOptionPressed: boolean;
    startTime: number;
  }>();

  // Initialize Three.js scene
  const initializeScene = useCallback(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    // Set world background to blue
    scene.background = new THREE.Color(0x2196f3); // Material Design Blue
    
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: false, // No alpha needed since we have blue background
      premultipliedAlpha: false
    });

    // Set initial size
    const rect = containerRef.current.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Position camera
    camera.position.z = 5;

    // Create 3x3 grid of planes for infinite world streaming
    const planeGeometry = new THREE.PlaneGeometry(2, 2); // Standard plane size
    const planes: THREE.Mesh[] = [];

    // Create 9 planes in a 3x3 grid
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        const planeMaterial = new THREE.MeshBasicMaterial({ 
          color: 0xffffff,
          transparent: true,
          alphaTest: 0.001
        });
        
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        
        // Position planes in grid (2 unit spacing to avoid gaps)
        plane.position.set(x * 2, y * 2, 0);
        
        // Store grid coordinates on the plane for reference
        plane.userData = { gridX: x, gridY: y, globalX: x, globalY: y };
        
        scene.add(plane);
        planes.push(plane);
      }
    }

    // Center plane is at index 4 (middle of 3x3 grid)
    const centerPlane = planes[4];

    // Create texture loader
    const textureLoader = new THREE.TextureLoader();

    // Store references
    sceneRef.current = {
      scene,
      camera,
      renderer,
      planes,
      centerPlane,
      textureLoader,
      globalPosition: { x: 0, y: 0 }, // Smooth floating point position
      tilePosition: { x: 0, y: 0 }, // Integer tile coordinates  
      currentResolution: 64, // Default resolution
      isOptionPressed: false,
      startTime: Date.now()
    };

    // Add renderer to DOM
    containerRef.current.appendChild(renderer.domElement);

    console.log('🎮 Liquid viewport initialized with Three.js WebGL');
  }, []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    regenerateAllTiles,
    setResolution: (resolution: number) => {
      if (sceneRef.current) {
        sceneRef.current.currentResolution = resolution;
        regenerateAllTiles();
      }
    }
  }), [regenerateAllTiles]);

  // Generate complete PNG for a tile at specific coordinates  
  const generateTileAsPNG = useCallback(async (tileX: number, tileY: number, resolution: number) => {
    if (!curve || !coordinateNoise) {
      console.warn('⚠️ Missing curve or coordinate noise data for tile generation');
      return null;
    }

    try {
      console.log(`🎨 Generating PNG tile at (${tileX}, ${tileY}) with ${resolution}×${resolution}`);
      
      // Create a modified curve that represents this tile's coordinate space
      // The curve data stays the same, but we offset where we sample from it
      const tileSpecificCurve = {
        ...curve,
        // Add tile offset information for the generation pipeline
        'tile-offset-x': tileX * resolution,
        'tile-offset-y': tileY * resolution
      };

      // For now, just generate a standard PNG at the resolution
      // TODO: Modify WebGPU pipeline to handle tile offsets
      const webgpuService = getWebGPUService();
      const palette = getPaletteByName('default');
      
      const result = await webgpuService.processCompleteImage(
        curve, // Use original curve for now
        palette,
        coordinateNoise.gpuExpression,
        resolution,
        resolution,
        1.0, // Scale
        0, 0, // No offset for now - will add tile offset logic later
        (stage: string, progressPercent: number) => {
          console.log(`🔄 Tile (${tileX}, ${tileY}): ${stage} ${progressPercent}%`);
        }
      );

      // Convert to data URL
      const canvas = document.createElement('canvas');
      canvas.width = resolution;
      canvas.height = resolution;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        const imageData = result.result.imageData;
        ctx.putImageData(imageData, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        
        console.log(`✅ PNG tile (${tileX}, ${tileY}) generated successfully`);
        return dataUrl;
      }

      return null;
    } catch (error) {
      console.error(`❌ Failed to generate PNG tile (${tileX}, ${tileY}):`, error);
      onError?.(`Failed to generate tile at (${tileX}, ${tileY})`);
      return null;
    }
  }, [curve, coordinateNoise, onError]);

  // Update tile positions to follow mouse smoothly (floating point movement)
  const updateTilePositions = useCallback(() => {
    if (!sceneRef.current) return;

    const { globalPosition, planes } = sceneRef.current;
    
    // Calculate the fractional offset within the current tile
    const fractionalX = globalPosition.x - Math.floor(globalPosition.x);
    const fractionalY = globalPosition.y - Math.floor(globalPosition.y);
    
    // Move all planes smoothly based on fractional position
    // Each plane represents a 2-unit square in world space
    const offsetX = -fractionalX * 2; // Negative for opposite movement
    const offsetY = fractionalY * 2;  // World Y up
    
    // Update all plane positions to follow mouse smoothly
    let planeIndex = 0;
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        const plane = planes[planeIndex];
        
        // Base grid position + smooth offset
        plane.position.set(
          (x * 2) + offsetX,
          (y * 2) + offsetY,
          0
        );
        
        planeIndex++;
      }
    }
  }, []);

  // Check if we need to stream new tiles based on global position
  const checkTileStreaming = useCallback(() => {
    if (!sceneRef.current || !curve || !coordinateNoise) return;

    const { tilePosition, planes, currentResolution } = sceneRef.current;
    
    // Generate tiles for 3x3 grid around current tile position
    let planeIndex = 0;
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        const tileX = tilePosition.x + x;
        const tileY = tilePosition.y + y;
        const plane = planes[planeIndex];
        
        // Check if this plane needs a new PNG tile
        const currentGlobalX = plane.userData.globalX;
        const currentGlobalY = plane.userData.globalY;
        
        if (currentGlobalX !== tileX || currentGlobalY !== tileY) {
          console.log(`🖼️ Need new PNG for plane ${planeIndex}: (${currentGlobalX}, ${currentGlobalY}) → (${tileX}, ${tileY})`);
          
          // Update plane's tile coordinates
          plane.userData.globalX = tileX;
          plane.userData.globalY = tileY;
          
          // Generate complete PNG for this tile (async - won't block)
          generateTileAsPNG(tileX, tileY, currentResolution).then((dataUrl) => {
            if (dataUrl) {
              applyTextureToPlane(plane, dataUrl);
            }
          });
        }
        
        planeIndex++;
      }
    }
  }, [curve, coordinateNoise, generateTileAsPNG]);

  // Apply texture to a specific plane
  const applyTextureToPlane = useCallback((plane: THREE.Mesh, dataUrl: string) => {
    if (!sceneRef.current) return;

    const { textureLoader } = sceneRef.current;
    
    textureLoader.load(
      dataUrl,
      (texture) => {
        // Configure texture for pixelated rendering
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        // Apply to plane material
        if (plane.material instanceof THREE.MeshBasicMaterial) {
          // Dispose of old texture
          if (plane.material.map) {
            plane.material.map.dispose();
          }
          
          plane.material.map = texture;
          plane.material.needsUpdate = true;
        }
        
        console.log(`✅ Texture applied to plane at (${plane.userData.globalX}, ${plane.userData.globalY})`);
      },
      undefined,
      (error) => {
        console.error('❌ Failed to load texture:', error);
        onError?.('Failed to load generated texture');
      }
    );
  }, [onError]);

  // Regenerate all tiles at current resolution
  const regenerateAllTiles = useCallback(() => {
    if (!sceneRef.current || !curve || !coordinateNoise) return;

    console.log('🔄 Regenerating all tiles at resolution:', sceneRef.current.currentResolution);
    
    // Force regeneration by clearing global coordinates and triggering streaming
    sceneRef.current.planes.forEach(plane => {
      plane.userData.globalX = Number.MIN_SAFE_INTEGER; // Force mismatch
      plane.userData.globalY = Number.MIN_SAFE_INTEGER;
    });
    
    checkTileStreaming();
  }, [curve, coordinateNoise, checkTileStreaming]);

  // Update camera to maintain liquid viewport behavior
  const updateCamera = useCallback(() => {
    if (!containerRef.current || !sceneRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const { camera, renderer } = sceneRef.current;
    const aspect = rect.width / rect.height;

    // Calculate orthographic frustum to hide plane edges
    let left, right, top, bottom;
    const planeSize = 1; // Our plane is 2x2 units, so radius is 1

    if (aspect > 1) {
      // Wider than tall - fit to height, crop width
      top = planeSize;
      bottom = -planeSize;
      left = -planeSize * aspect;
      right = planeSize * aspect;
    } else {
      // Taller than wide - fit to width, crop height  
      left = -planeSize;
      right = planeSize;
      top = planeSize / aspect;
      bottom = -planeSize / aspect;
    }

    // Apply zoom factor to eliminate background - smaller values = more zoomed in
    const zoomFactor = 0.7; // Zoom in significantly to eliminate background
    camera.left = left * zoomFactor;
    camera.right = right * zoomFactor;
    camera.top = top * zoomFactor;
    camera.bottom = bottom * zoomFactor;
    camera.updateProjectionMatrix();

    renderer.setSize(rect.width, rect.height);
    renderer.setPixelRatio(window.devicePixelRatio);

    console.log('📐 Camera updated for liquid viewport:', { 
      aspect: aspect.toFixed(2), 
      frustum: `${(left * zoomFactor).toFixed(2)}, ${(right * zoomFactor).toFixed(2)}, ${(top * zoomFactor).toFixed(2)}, ${(bottom * zoomFactor).toFixed(2)}`,
      zoomFactor 
    });
  }, []);

  // Update texture on primary plane
  const updateTexture = useCallback(() => {
    if (!sceneRef.current || !textureDataUrl) return;

    const { primaryPlane, textureLoader, currentTexture } = sceneRef.current;

    try {
      // Dispose of previous texture to prevent memory leaks
      if (currentTexture) {
        currentTexture.dispose();
      }

      // Load new texture
      const texture = textureLoader.load(
        textureDataUrl,
        (loadedTexture) => {
          console.log('🖼️ Texture loaded successfully:', {
            width: loadedTexture.image.width,
            height: loadedTexture.image.height
          });
          
          // Configure texture for pixelated rendering
          loadedTexture.magFilter = THREE.NearestFilter;
          loadedTexture.minFilter = THREE.NearestFilter;
          loadedTexture.generateMipmaps = false;
          loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
          loadedTexture.wrapT = THREE.ClampToEdgeWrapping;

          // Apply to material
          if (primaryPlane.material instanceof THREE.MeshBasicMaterial) {
            primaryPlane.material.map = loadedTexture;
            primaryPlane.material.needsUpdate = true;
          }

          // Store reference
          sceneRef.current!.currentTexture = loadedTexture;
        },
        undefined,
        (error) => {
          console.error('❌ Failed to load texture:', error);
          onError?.('Failed to load generated texture');
        }
      );

    } catch (error) {
      console.error('❌ Error updating texture:', error);
      onError?.('Error updating texture');
    }
  }, [textureDataUrl, onError]);

  // Animation loop
  const animate = useCallback(() => {
    if (!sceneRef.current) return;

    const { scene, camera, renderer } = sceneRef.current;
    
    // Render the scene (no rotation)
    renderer.render(scene, camera);
    
    // Continue animation loop
    requestAnimationFrame(animate);
  }, []);

  // Resize handler with debouncing
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

  // Initialize scene on mount
  useEffect(() => {
    initializeScene();
    
    return () => {
      // Cleanup Three.js resources
      if (sceneRef.current) {
        const { renderer, currentTexture } = sceneRef.current;
        
        // Dispose of texture
        if (currentTexture) {
          currentTexture.dispose();
        }
        
        // Dispose of renderer
        renderer.dispose();
        
        // Remove from DOM
        if (containerRef.current && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
  }, [initializeScene]);

  // Update camera when scene is ready
  useEffect(() => {
    if (sceneRef.current) {
      updateCamera();
      animate(); // Start animation loop
    }
  }, [updateCamera, animate]);

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

  // Mouse movement handling for panning
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
      
      // Convert screen movement to world coordinates
      // Negative because we want opposite movement (drag right = move world left)
      const worldDeltaX = -deltaX * 0.01; // Scale factor for sensitivity
      const worldDeltaY = deltaY * 0.01;  // Positive Y up in world space

      // Update smooth floating point global position
      sceneRef.current.globalPosition.x += worldDeltaX;
      sceneRef.current.globalPosition.y += worldDeltaY;

      // Update tile positions to follow mouse smoothly
      updateTilePositions();

      // Check if we crossed into a new integer tile boundary for matrix generation
      const newTileX = Math.floor(sceneRef.current.globalPosition.x);
      const newTileY = Math.floor(sceneRef.current.globalPosition.y);
      
      if (newTileX !== sceneRef.current.tilePosition.x || newTileY !== sceneRef.current.tilePosition.y) {
        sceneRef.current.tilePosition.x = newTileX;
        sceneRef.current.tilePosition.y = newTileY;
        console.log('🌍 Crossed tile boundary - new tile position:', sceneRef.current.tilePosition);
        checkTileStreaming();
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

      // Only handle resolution scaling if option key is pressed
      if (sceneRef.current.isOptionPressed) {
        event.preventDefault();
        
        const resolutions = [8, 16, 32, 64, 128, 256];
        const currentIndex = resolutions.indexOf(sceneRef.current.currentResolution);
        
        let newIndex;
        if (event.deltaY > 0) {
          // Scroll down - decrease resolution (zoom out)
          newIndex = Math.max(0, currentIndex - 1);
        } else {
          // Scroll up - increase resolution (zoom in)
          newIndex = Math.min(resolutions.length - 1, currentIndex + 1);
        }

        const newResolution = resolutions[newIndex];
        if (newResolution !== sceneRef.current.currentResolution) {
          sceneRef.current.currentResolution = newResolution;
          console.log('🔍 Resolution changed to:', newResolution + '×' + newResolution);
          
          // Regenerate all tiles at new resolution
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
  }, []);

  // Generate initial tiles when curve and coordinate noise data is available
  useEffect(() => {
    if (curve && coordinateNoise && sceneRef.current) {
      console.log('🎨 Initial tile generation triggered');
      checkTileStreaming();
    }
  }, [curve, coordinateNoise, checkTileStreaming]);

  // Update texture when textureDataUrl changes (legacy - will be replaced by tile system)
  useEffect(() => {
    if (textureDataUrl) {
      updateTexture();
    }
  }, [textureDataUrl, updateTexture]);

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
    />
  );
});

LiquidViewport.displayName = 'LiquidViewport';

export default LiquidViewport;
