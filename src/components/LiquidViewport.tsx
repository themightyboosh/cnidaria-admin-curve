import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

interface LiquidViewportProps {
  textureDataUrl?: string | null;
  onError?: (error: string) => void;
}

const LiquidViewport: React.FC<LiquidViewportProps> = ({ 
  textureDataUrl, 
  onError 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    renderer: THREE.WebGLRenderer;
    primaryPlane: THREE.Mesh;
    backgroundPlane1: THREE.Mesh;
    backgroundPlane2: THREE.Mesh;
    textureLoader: THREE.TextureLoader;
    currentTexture?: THREE.Texture;
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

    // Create background planes (behind primary plane)
    const planeGeometry = new THREE.PlaneGeometry(2, 2); // Oversized to ensure no edges show

    // Background plane 1 (furthest back) - Deep blue
    const backgroundMaterial1 = new THREE.MeshBasicMaterial({ 
      color: 0x1a237e,
      transparent: false
    });
    const backgroundPlane1 = new THREE.Mesh(planeGeometry, backgroundMaterial1);
    backgroundPlane1.position.z = -2;
    scene.add(backgroundPlane1);

    // Background plane 2 (middle) - Dark purple  
    const backgroundMaterial2 = new THREE.MeshBasicMaterial({ 
      color: 0x4a148c,
      transparent: false
    });
    const backgroundPlane2 = new THREE.Mesh(planeGeometry, backgroundMaterial2);
    backgroundPlane2.position.z = -1;
    scene.add(backgroundPlane2);

    // Primary plane (front) - Will hold the curve texture
    const primaryMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.001 // Allow transparency
    });
    const primaryPlane = new THREE.Mesh(planeGeometry, primaryMaterial);
    primaryPlane.position.z = 0;
    scene.add(primaryPlane);

    // Create texture loader
    const textureLoader = new THREE.TextureLoader();

    // Store references
    sceneRef.current = {
      scene,
      camera,
      renderer,
      primaryPlane,
      backgroundPlane1,
      backgroundPlane2,
      textureLoader,
      startTime: Date.now()
    };

    // Add renderer to DOM
    containerRef.current.appendChild(renderer.domElement);

    console.log('🎮 Liquid viewport initialized with Three.js WebGL');
  }, []);

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

  // Update texture when textureDataUrl changes
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
};

export default LiquidViewport;
