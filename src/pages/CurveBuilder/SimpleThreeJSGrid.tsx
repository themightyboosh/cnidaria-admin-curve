import React, { useRef, useEffect, useState, useMemo } from 'react'
import * as THREE from 'three'

interface CellColor {
  x: number
  y: number
  color: string
}

interface SimpleThreeJSGridProps {
  cellColors?: CellColor[]
  onCellCountChange?: (count: { x: number, y: number }) => void
  onGridBoundsChange?: (bounds: { minX: number, maxX: number, minY: number, maxY: number }) => void
  selectedCurveId?: string // Track when curve changes to clear cache
}

const SimpleThreeJSGrid: React.FC<SimpleThreeJSGridProps> = ({ 
  cellColors = [], 
  onCellCountChange,
  onGridBoundsChange,
  selectedCurveId
}) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const [gridInfo, setGridInfo] = useState<{ x: number, y: number }>({ x: 20, y: 20 })
  
  // Fixed grid dimensions - never change
  const FIXED_GRID_SIZE = 20
  const FIXED_CELL_SIZE = 50

  // Permanent color cache - only clears when new curve is loaded
  const colorCacheRef = useRef<Map<string, string>>(new Map())
  const lastCurveIdRef = useRef<string>('')
  
  // Memoized color processing - only updates when new colors are provided or curve changes
  const processedColors = useMemo(() => {
    console.log('🎨 Processing colors with curve-based cache...')
    
    // Clear cache if curve changed
    if (selectedCurveId && selectedCurveId !== lastCurveIdRef.current) {
      console.log(`🔄 New curve loaded: ${selectedCurveId}, clearing color cache`)
      colorCacheRef.current.clear()
      lastCurveIdRef.current = selectedCurveId
    }
    
    const newColors: CellColor[] = []
    const cache = colorCacheRef.current
    
    cellColors.forEach(({ x, y, color }) => {
      const key = `${x},${y}`
      
      // If color is not in cache, add it permanently
      if (!cache.has(key)) {
        cache.set(key, color)
        console.log(`🔒 Caching color for cell (${x},${y}): ${color}`)
      }
      
      // Always use cached color (never recalculate)
      const cachedColor = cache.get(key)!
      newColors.push({ x, y, color: cachedColor })
    })
    
    console.log(`📊 Color cache stats: ${cache.size} cached colors, ${newColors.length} processed`)
    return newColors
  }, [cellColors, selectedCurveId])

  useEffect(() => {
    console.log('🔵 SimpleThreeJSGrid: useEffect started')
    
    // Check WebGL support
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) {
        console.error('❌ WebGL is not available!')
        return
      }
      console.log('✅ WebGL is available')
    } catch (error) {
      console.error('❌ WebGL error:', error)
      return
    }
    
    if (!mountRef.current) {
      console.log('❌ Mount ref is null')
      return
    }

    // Get container dimensions
    const containerWidth = mountRef.current.clientWidth
    const containerHeight = mountRef.current.clientHeight
    
    console.log('📏 Container dimensions:', { containerWidth, containerHeight })

    if (containerWidth === 0 || containerHeight === 0) {
      console.log('⚠️ Container has zero dimensions, waiting...')
      setTimeout(() => {
        if (mountRef.current) {
          const newWidth = mountRef.current.clientWidth
          const newHeight = mountRef.current.clientHeight
          console.log('🔄 Retry container dimensions:', { newWidth, newHeight })
        }
      }, 100)
      return
    }

    console.log('🎬 Creating Three.js scene with perfect square grid...')

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1a)

    // Fixed grid dimensions - always perfect squares
    const gridWidth = FIXED_GRID_SIZE * FIXED_CELL_SIZE
    const gridHeight = FIXED_GRID_SIZE * FIXED_CELL_SIZE
    
    // Calculate viewport to maintain 1:1 aspect ratio with clean cropping
    const containerAspect = containerWidth / containerHeight
    const gridAspect = gridWidth / gridHeight
    
    let cameraLeft, cameraRight, cameraTop, cameraBottom
    
    if (containerAspect > gridAspect) {
      // Container is wider than grid - crop horizontally
      const scale = containerHeight / gridHeight
      const scaledWidth = gridWidth * scale
      const offset = (scaledWidth - containerWidth) / 2
      
      cameraLeft = -containerWidth / 2
      cameraRight = containerWidth / 2
      cameraTop = containerHeight / 2
      cameraBottom = -containerHeight / 2
    } else {
      // Container is taller than grid - crop vertically
      const scale = containerWidth / gridWidth
      const scaledHeight = gridHeight * scale
      const offset = (scaledHeight - containerHeight) / 2
      
      cameraLeft = -containerWidth / 2
      cameraRight = containerWidth / 2
      cameraTop = containerHeight / 2
      cameraBottom = -containerHeight / 2
    }
    
    // Camera with perfect square grid bounds
    const camera = new THREE.OrthographicCamera(
      cameraLeft, cameraRight,
      cameraTop, cameraBottom,
      0.1, 1000
    )
    camera.position.set(0, 0, 100)
    camera.lookAt(0, 0, 0)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true
    })
    renderer.setSize(containerWidth, containerHeight)
    renderer.setClearColor(0x1a1a1a, 1)
    mountRef.current.appendChild(renderer.domElement)

    // Fixed grid info - never changes
    setGridInfo({ x: FIXED_GRID_SIZE, y: FIXED_GRID_SIZE })
    onCellCountChange?.({ x: FIXED_GRID_SIZE, y: FIXED_GRID_SIZE })
    
    // Fixed grid bounds - never change
    const minX = -Math.floor(FIXED_GRID_SIZE / 2)
    const maxX = Math.floor(FIXED_GRID_SIZE / 2)
    const minY = -Math.floor(FIXED_GRID_SIZE / 2)
    const maxY = Math.floor(FIXED_GRID_SIZE / 2)
    
    onGridBoundsChange?.({ minX, maxX, minY, maxY })

    console.log('📐 Perfect square grid calculations:', {
      gridSize: FIXED_GRID_SIZE,
      cellSize: FIXED_CELL_SIZE,
      gridWidth,
      gridHeight,
      containerAspect,
      gridAspect,
      totalCells: FIXED_GRID_SIZE * FIXED_GRID_SIZE,
      bounds: { minX, maxX, minY, maxY }
    })

    // Create color texture with permanent cache
    const createColorTexture = (colors: CellColor[]) => {
      const textureSize = FIXED_GRID_SIZE
      const canvas = document.createElement('canvas')
      canvas.width = textureSize
      canvas.height = textureSize
      const ctx = canvas.getContext('2d')!
      
      // Fill with default color (dark gray)
      ctx.fillStyle = '#2a2a2a'
      ctx.fillRect(0, 0, textureSize, textureSize)
      
      // Apply cached colors - never recalculate
      colors.forEach(({ x, y, color }) => {
        if (x >= 0 && x < FIXED_GRID_SIZE && y >= 0 && y < FIXED_GRID_SIZE) {
          ctx.fillStyle = color
          ctx.fillRect(x, y, 1, 1)
        }
      })
      
      const texture = new THREE.CanvasTexture(canvas)
      texture.minFilter = THREE.NearestFilter
      texture.magFilter = THREE.NearestFilter
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      
      return texture
    }

    // Shader material with completely static grid lines
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `

    const fragmentShader = `
      uniform vec2 resolution;
      uniform vec3 gridColor;
      uniform sampler2D cellColors;
      varying vec2 vUv;
      
      void main() {
        vec2 uv = vUv;
        
        // Fixed 20x20 grid - never changes, perfect squares
        vec2 fixedGridScale = vec2(20.0, 20.0);
        vec2 pixelCoord = uv * fixedGridScale;
        vec2 cellCoord = floor(pixelCoord);
        vec2 gridCoord = fract(pixelCoord);
        
        // Integer cell coordinates for stability
        ivec2 cellIndex = ivec2(cellCoord);
        
        // Map to texture coordinates (only for cell colors)
        vec2 textureUv = (cellCoord + 0.5) / 20.0;
        
        // Sample cell color from texture (cached, never recalculated)
        vec4 cellColor = texture2D(cellColors, textureUv);
        
        // Completely static grid lines - never move
        float lineWidth = 0.02;
        float gridLine = 0.0;
        
        // Static horizontal lines
        if (gridCoord.y < lineWidth || gridCoord.y > 1.0 - lineWidth) {
          gridLine = 1.0;
        }
        
        // Static vertical lines
        if (gridCoord.x < lineWidth || gridCoord.x > 1.0 - lineWidth) {
          gridLine = 1.0;
        }
        
        // Mix cell color with static grid lines
        vec3 finalColor = mix(cellColor.rgb, gridColor, gridLine);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `

    // Create initial color texture with cached colors
    const colorTexture = createColorTexture(processedColors)

    // Create shader material with fixed uniforms
    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        resolution: { value: new THREE.Vector2(containerWidth, containerHeight) },
        gridColor: { value: new THREE.Color(0x00ffff) }, // Cyan grid lines
        cellColors: { value: colorTexture }
      }
    })

    // Create a single plane geometry with fixed size (perfect squares)
    const geometry = new THREE.PlaneGeometry(gridWidth, gridHeight)
    const mesh = new THREE.Mesh(geometry, shaderMaterial)
    mesh.position.set(0, 0, 0)
    scene.add(mesh)

    console.log('🎨 Perfect square grid created with curve-based color cache:', {
      resolution: [containerWidth, containerHeight],
      gridSize: FIXED_GRID_SIZE,
      cachedColors: colorCacheRef.current.size,
      processedColors: processedColors.length,
      totalCells: FIXED_GRID_SIZE * FIXED_GRID_SIZE,
      currentCurveId: selectedCurveId
    })

    // Render
    renderer.render(scene, camera)
    console.log('🎭 Perfect square grid rendered successfully')

    // Handle resize - maintain perfect squares with clean cropping
    const handleResize = () => {
      if (!mountRef.current) return
      const newWidth = mountRef.current.clientWidth
      const newHeight = mountRef.current.clientHeight
      
      console.log('📱 Resize to:', { newWidth, newHeight })
      
      // Recalculate viewport for perfect squares
      const newContainerAspect = newWidth / newHeight
      const newGridAspect = gridWidth / gridHeight
      
      let newCameraLeft, newCameraRight, newCameraTop, newCameraBottom
      
      if (newContainerAspect > newGridAspect) {
        // Container is wider than grid - crop horizontally
        const scale = newHeight / gridHeight
        const scaledWidth = gridWidth * scale
        const offset = (scaledWidth - newWidth) / 2
        
        newCameraLeft = -newWidth / 2
        newCameraRight = newWidth / 2
        newCameraTop = newHeight / 2
        newCameraBottom = -newHeight / 2
      } else {
        // Container is taller than grid - crop vertically
        const scale = newWidth / gridWidth
        const scaledHeight = gridHeight * scale
        const offset = (scaledHeight - newHeight) / 2
        
        newCameraLeft = -newWidth / 2
        newCameraRight = newWidth / 2
        newCameraTop = newHeight / 2
        newCameraBottom = -newHeight / 2
      }
      
      // Update camera for clean cropping
      camera.left = newCameraLeft
      camera.right = newCameraRight
      camera.top = newCameraTop
      camera.bottom = newCameraBottom
      camera.updateProjectionMatrix()
      
      // Only update renderer size - grid never changes
      renderer.setSize(newWidth, newHeight)
      shaderMaterial.uniforms.resolution.value.set(newWidth, newHeight)
      
      renderer.render(scene, camera)
      console.log('✅ Resize completed with perfect square cropping')
    }

    window.addEventListener('resize', handleResize)

    return () => {
      console.log('🧹 Cleaning up Three.js perfect square grid')
      window.removeEventListener('resize', handleResize)
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      geometry.dispose()
      shaderMaterial.dispose()
      colorTexture.dispose()
      renderer.dispose()
    }
  }, [processedColors, onCellCountChange, onGridBoundsChange])

  return (
    <div 
      ref={mountRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        background: '#1a1a1a',
        position: 'relative',
        border: '2px solid #00ff00'
      }} 
    />
  )
}

export default SimpleThreeJSGrid
