import React, { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { apiUrl } from '../../config/environments'
import { indexToThreeColor } from '../../utils/colorSpectrum'

interface WebGLGridProps {
  selectedCurve: any
  cellSize: number
  colorMode: 'value' | 'index'
  isPreview?: boolean
  gridDimensions?: { width: number; height: number }
  smoothing?: number
  onCameraPositionChange?: (position: { x: number; y: number; z: number }) => void
}

interface ProcessedCoordinate {
  "cell-coordinates": [number, number]
  "index-position": number
  "index-value": number
}

const WebGLGrid: React.FC<WebGLGridProps> = ({ selectedCurve, cellSize, colorMode, isPreview = false, gridDimensions, smoothing = 0.5, onCameraPositionChange }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAutoRotating, setIsAutoRotating] = useState(true)
  const [hasBeenClicked, setHasBeenClicked] = useState(false)
  
  // Subdivision calculation:
  // - Always start with 512x512 base grid regardless of 2D view
  // - After color/height mapping, subdivide to 1024x1024 for high resolution
  // - No smoothing or value averaging - direct mapping
  const baseGridSize = 512
  const finalGridSize = 1024
  const maxHeight = cellSize * 100 // Much taller terrain

  // Process API data and render
  const processData = async () => {
    if (!selectedCurve || isProcessing) return
    
    setIsProcessing(true)
    console.log('Processing Three.js data for:', selectedCurve["curve-name"])
    
    try {
      const halfGrid = Math.floor(baseGridSize / 2)
      const response = await fetch(
        `${apiUrl}/api/curves/${selectedCurve.id}/process?x=${-halfGrid}&y=${-halfGrid}&x2=${halfGrid - 1}&y2=${halfGrid - 1}`
      )
      
      if (response.ok) {
        const data = await response.json()
        const curveName = Object.keys(data)[0]
        const results = data[curveName]
        
        if (results && Array.isArray(results)) {
          console.log('Received', results.length, 'coordinates')
          
          // Create height and index maps
          const heightMap = new Map<string, number>()
          const indexMap = new Map<string, number>()
          
          results.forEach((result: ProcessedCoordinate) => {
            const [x, y] = result["cell-coordinates"]
            const key = `${x}_${y}`
            heightMap.set(key, result["index-value"])
            indexMap.set(key, result["index-position"])
          })
          
          // Generate and render terrain
          generateTerrain(heightMap, indexMap)
        }
      }
    } catch (error) {
      console.error('Failed to process Three.js data:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  // Generate simple 10x10x1 square
  const generateTerrain = (heightMap: Map<string, number>, indexMap: Map<string, number>) => {
    if (!containerRef.current) {
      console.error('Container ref is null!')
      return
    }
    
    console.log('Creating simple 10x10x1 square')
    console.log('Container dimensions:', containerRef.current.clientWidth, 'x', containerRef.current.clientHeight)
    
    // Clear previous scene
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild)
    }
    
    // Create scene
    const scene = new THREE.Scene()
    
    // Create starfield background
    const starFieldGeometry = new THREE.BufferGeometry()
    const starCount = 2000
    const starPositions = new Float32Array(starCount * 3)
    const starSizes = new Float32Array(starCount)
    
    for (let i = 0; i < starCount; i++) {
      // Random positions in a large sphere
      const radius = 500 + Math.random() * 1000
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      starPositions[i * 3 + 2] = radius * Math.cos(phi)
      
      starSizes[i] = Math.random() * 2 + 0.5
    }
    
    starFieldGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    starFieldGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1))
    
    const starFieldMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true
    })
    
    const starField = new THREE.Points(starFieldGeometry, starFieldMaterial)
    scene.add(starField)
    
    // Set black background
    scene.background = new THREE.Color(0x000000)
    
    // Create camera with depth of field effect
    const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000)
    
    // Depth of field settings
    const focusDistance = 50 // Distance to focus on
    const aperture = 0.1 // Smaller aperture = more depth of field
    camera.near = Math.max(0.1, focusDistance - aperture)
    camera.far = focusDistance + aperture
    
    // Initialize orbital camera variables
    let cameraDistance = 50
    let cameraTheta = 0 // Horizontal angle
    let cameraPhi = Math.PI / 2 // Vertical angle (0 = top, PI = bottom)
    
    // Set camera position based on preview mode
    if (isPreview) {
      // Start at specified position: (8.8, 49.1, -1.4)
      camera.position.set(8.8, 49.1, -1.4)
      camera.lookAt(0, 0, 0)
      
      // Calculate spherical coordinates from Cartesian
      const x = 8.8
      const y = 49.1
      const z = -1.4
      
      cameraDistance = Math.sqrt(x*x + y*y + z*z)
      cameraTheta = Math.atan2(z, x)
      cameraPhi = Math.acos(y / cameraDistance)
    } else {
      // Angled view for normal 3D mode
      cameraDistance = 35
      cameraTheta = Math.PI / 4
      cameraPhi = Math.PI / 3
    }
    
    // Log camera position for default view
    console.log('Camera Position:', {
      x: camera.position.x.toFixed(2),
      y: camera.position.y.toFixed(2),
      z: camera.position.z.toFixed(2),
      distance: cameraDistance.toFixed(2),
      theta: (cameraTheta * 180 / Math.PI).toFixed(1) + '°',
      phi: (cameraPhi * 180 / Math.PI).toFixed(1) + '°',
      lookAt: { x: 0, y: 0, z: 0 }
    })
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    containerRef.current.appendChild(renderer.domElement)
    
    // Enhanced orbital controls for better navigation
    let mouseX = 0
    let mouseY = 0
    let isMouseDown = false
    
    const updateCameraPosition = () => {
      // Convert spherical coordinates to Cartesian
      camera.position.x = cameraDistance * Math.sin(cameraPhi) * Math.cos(cameraTheta)
      camera.position.y = cameraDistance * Math.cos(cameraPhi)
      camera.position.z = cameraDistance * Math.sin(cameraPhi) * Math.sin(cameraTheta)
      camera.lookAt(0, 0, 0)
      
      // Update key light to follow camera
      keyLight.position.copy(camera.position)
      keyLight.position.y += 10 // Slightly above camera
      
      // Call camera position callback if provided
      if (onCameraPositionChange) {
        onCameraPositionChange({ x: camera.position.x, y: camera.position.y, z: camera.position.z })
      }
    }
    
    const handleMouseDown = (event: MouseEvent) => {
      isMouseDown = true
      mouseX = event.clientX
      mouseY = event.clientY
      
      // Stop auto-rotation on first click in preview mode
      if (isPreview && !hasBeenClicked) {
        setHasBeenClicked(true)
        setIsAutoRotating(false)
      }
    }
    
    const handleMouseMove = (event: MouseEvent) => {
      if (!isMouseDown) return
      
      const deltaX = event.clientX - mouseX
      const deltaY = event.clientY - mouseY
      
      // Orbital rotation
      cameraTheta += deltaX * 0.01 // Horizontal rotation
      cameraPhi += deltaY * 0.01 // Vertical rotation
      
      // Clamp vertical angle to prevent flipping issues
      cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi))
      
      updateCameraPosition()
      
      mouseX = event.clientX
      mouseY = event.clientY
      
      // Log camera position when moving
      console.log('Camera Position:', {
        x: camera.position.x.toFixed(2),
        y: camera.position.y.toFixed(2),
        z: camera.position.z.toFixed(2),
        distance: cameraDistance.toFixed(2),
        theta: (cameraTheta * 180 / Math.PI).toFixed(1) + '°',
        phi: (cameraPhi * 180 / Math.PI).toFixed(1) + '°'
      })
    }
    
    const handleMouseUp = () => {
      isMouseDown = false
    }
    
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      
      // Zoom in/out by changing distance
      cameraDistance += event.deltaY * 0.5
      cameraDistance = Math.max(5, Math.min(200, cameraDistance)) // Clamp distance
      
      updateCameraPosition()
    }
    
    renderer.domElement.addEventListener('mousedown', handleMouseDown)
    renderer.domElement.addEventListener('mousemove', handleMouseMove)
    renderer.domElement.addEventListener('mouseup', handleMouseUp)
    renderer.domElement.addEventListener('wheel', handleWheel)
    
    // Initialize camera position - already set above for preview mode
    if (!isPreview) {
      updateCameraPosition()
    }
    
    // Add key press handler to capture camera position
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'c' || event.key === 'C') {
        console.log('=== CAPTURED CAMERA POSITION ===')
        console.log('Camera Position:', {
          x: camera.position.x.toFixed(2),
          y: camera.position.y.toFixed(2),
          z: camera.position.z.toFixed(2),
          lookAt: { x: 0, y: 0, z: 0 }
        })
        console.log('Copy this for default view:')
        console.log(`camera.position.set(${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`)
        console.log('=== END CAPTURE ===')
      }
    }
    
    // Call camera position callback if provided
    if (onCameraPositionChange) {
      onCameraPositionChange({ x: camera.position.x, y: camera.position.y, z: camera.position.z })
    }
    
    window.addEventListener('keydown', handleKeyPress)
    
    // 3-Point Lighting System with subtle colors
    // Key Light (main light - follows camera) - slight purple
    const keyLight = new THREE.DirectionalLight(0xfff0ff, 0.6)
    keyLight.position.copy(camera.position)
    keyLight.position.y += 10 // Slightly above camera
    scene.add(keyLight)
    
    // Fill Light (stationary - soft fill) - slight magenta
    const fillLight = new THREE.DirectionalLight(0xfff0f0, 0.3)
    fillLight.position.set(-20, 30, -20)
    scene.add(fillLight)
    
    // Back Light (stationary - rim lighting) - slight orange
    const backLight = new THREE.DirectionalLight(0xfff8e0, 0.2)
    backLight.position.set(0, 20, 30)
    scene.add(backLight)
    
    // Subtle ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4)
    scene.add(ambientLight)
    
    // Create dynamic grid box with vertex colors and heights from curve data
    // Always use 512x512 base size, then subdivide to 1024x1024
    const boxWidth = 512
    const boxDepth = 512
    const geometry = new THREE.BoxGeometry(boxWidth, 12.8, boxDepth, finalGridSize, 1, finalGridSize) // 1024x1024 segments for high resolution
    const material = new THREE.MeshLambertMaterial({ 
      vertexColors: true,
      wireframe: false
    })
    
    // Process vertices to apply colors and heights
    const positions = geometry.attributes.position
    const colors = new Float32Array(positions.count * 3)
    
    // Create direct height and color maps for 1024x1024 subdivision
    const directHeightMap = new Map<string, number>()
    const directColorMap = new Map<string, { r: number; g: number; b: number }>()
    
    // Direct mapping from 512x512 base grid to 1024x1024 final grid
    const halfFinalGrid = Math.floor(finalGridSize / 2)
    for (let x = -halfFinalGrid; x < halfFinalGrid; x++) {
      for (let z = -halfFinalGrid; z < halfFinalGrid; z++) {
        const coordKey = `${x}_${z}`
        
        // Map 1024x1024 position to 512x512 base grid
        const baseX = Math.floor((x + halfFinalGrid) * baseGridSize / finalGridSize) - Math.floor(baseGridSize / 2)
        const baseZ = Math.floor((z + halfFinalGrid) * baseGridSize / finalGridSize) - Math.floor(baseGridSize / 2)
        const baseKey = `${baseX}_${baseZ}`
        
        const value = heightMap.get(baseKey) || 0
        const position = indexMap.get(baseKey) || 0
        
        // Direct mapping - no averaging
        directHeightMap.set(coordKey, value)
        
        let color: { r: number; g: number; b: number }
        if (colorMode === 'index') {
          color = indexToThreeColor(value, 'index', position, selectedCurve["curve-width"])
        } else {
          color = indexToThreeColor(value, 'value')
        }
        directColorMap.set(coordKey, color)
      }
    }
    
    // Process each vertex
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      const z = positions.getZ(i)
      
      // Only process top surface vertices (Y = 6.4)
      if (Math.abs(y - 6.4) < 0.1) {
        // Convert to grid coordinates based on box dimensions
        const gridX = Math.round(x)
        const gridZ = Math.round(z)
        
        // Direct mapping - no smoothing or averaging
        const coordKey = `${gridX}_${gridZ}`
        const height = directHeightMap.get(coordKey) || 0
        const color = directColorMap.get(coordKey) || { r: 0.5, g: 0.5, b: 0.5 }
        
        // Direct height and color assignment
        const finalHeight = (height / 255) * 12.8
        const finalColor = color
        
        // Set vertex height
        positions.setY(i, 6.4 + finalHeight)
        
        // Set vertex color
        colors[i * 3] = finalColor.r
        colors[i * 3 + 1] = finalColor.g
        colors[i * 3 + 2] = finalColor.b
        
        // Debug: log first few vertices
        if (i < 10) {
          console.log(`Vertex ${i}: grid(${gridX},${gridZ}) height=${finalHeight.toFixed(2)} color=rgb(${finalColor.r},${finalColor.g},${finalColor.b}) smoothing=${smoothing}`)
        }
      } else {
        // Non-top surface vertices get default color
        colors[i * 3] = 0.5
        colors[i * 3 + 1] = 0.5
        colors[i * 3 + 2] = 0.5
      }
    }
    
    // Update geometry
    geometry.attributes.position.needsUpdate = true
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    
    // Compute vertex normals for proper lighting
    geometry.computeVertexNormals()
    
    // Merge vertices that are very close to each other
    const tolerance = 0.1 // Merge vertices within 0.1 units
    const mergedGeometry = BufferGeometryUtils.mergeVertices(geometry, tolerance)
    
    const box = new THREE.Mesh(mergedGeometry, material)
    box.position.set(0, 0, 0) // Center at origin (height already applied)
    scene.add(box)
    
    console.log(`Created ${boxWidth}x${boxDepth}x12.8 colored terrain with ${finalGridSize}x${finalGridSize} segments`)
    console.log(`Subdivision calculation: Base ${baseGridSize}x${baseGridSize} → Final ${finalGridSize}x${finalGridSize}`)
    console.log(`Direct mapping: No smoothing or value averaging`)
    console.log(`Vertex optimization: Normals computed and vertices merged`)
    
    console.log('Created 10x10x1 green wireframe square')
    
             // Animation loop with auto-rotation and subtle light movement
    const animate = () => {
      requestAnimationFrame(animate)
      
      // Auto-rotate the scene in preview mode until clicked
      if (isPreview && isAutoRotating && !hasBeenClicked) {
        scene.rotation.y += 0.0004 // Very slow rotation (4% of original speed)
      }
      
      // Subtle light movement
      const time = Date.now() * 0.001 // Time in seconds
      
      // Gentle movement for fill light
      fillLight.position.x = -20 + Math.sin(time * 0.3) * 5
      fillLight.position.y = 30 + Math.cos(time * 0.2) * 3
      fillLight.position.z = -20 + Math.sin(time * 0.4) * 4
      
      // Gentle movement for back light
      backLight.position.x = Math.sin(time * 0.25) * 8
      backLight.position.y = 20 + Math.cos(time * 0.15) * 2
      backLight.position.z = 30 + Math.sin(time * 0.35) * 6
      
      renderer.render(scene, camera)
    }
    animate()
    
    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return
      
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    
    window.addEventListener('resize', handleResize)
    
         // Cleanup function
     return () => {
       window.removeEventListener('resize', handleResize)
       renderer.domElement.removeEventListener('mousedown', handleMouseDown)
       renderer.domElement.removeEventListener('mousemove', handleMouseMove)
       renderer.domElement.removeEventListener('mouseup', handleMouseUp)
       renderer.domElement.removeEventListener('wheel', handleWheel)
       renderer.dispose()
     }
  }

  // Initialize when component mounts
  useEffect(() => {
    console.log('WebGLGrid useEffect triggered with selectedCurve:', selectedCurve?.id)
    if (selectedCurve) {
      console.log('Three.js component mounted, processing data...')
      processData()
    } else {
      console.log('No curve selected, not processing data')
    }
  }, [selectedCurve, colorMode])

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%',
        position: 'relative',
        backgroundColor: '#000',
        border: '2px solid red'
      }}
    >
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: 'white',
        fontSize: '24px',
        zIndex: 5
      }}>
        Loading 3D View...
      </div>
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        color: 'white',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: '5px',
        fontSize: '12px',
        zIndex: 10
      }}>
        Three.js Grid Active
      </div>
    </div>
  )
}

export default WebGLGrid
