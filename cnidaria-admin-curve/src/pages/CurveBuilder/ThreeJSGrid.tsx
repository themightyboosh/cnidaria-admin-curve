import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'

interface ThreeJSGridProps {
  cellColors: Map<string, string>
  gridDimensions: { width: number; height: number }
  cellSize: number
}

interface GridState {
  centerX: number
  centerY: number
  visibleWidth: number
  visibleHeight: number
  cellSize: number
}

const ThreeJSGrid: React.FC<ThreeJSGridProps> = ({ cellColors, gridDimensions, cellSize }) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const meshRef = useRef<THREE.Mesh>()
  const controlsRef = useRef<any>()
  const gridStateRef = useRef<GridState>({ centerX: 0, centerY: 0, visibleWidth: 0, visibleHeight: 0, cellSize: 30 })
  const lastCameraPosition = useRef<THREE.Vector3>(new THREE.Vector3())
  const lastCameraRotation = useRef<THREE.Euler>(new THREE.Euler())

  // Calculate visible grid bounds from camera frustum
  const calculateVisibleBounds = (camera: THREE.PerspectiveCamera) => {
    // Get camera distance to ground plane (Y=0)
    const cameraHeight = Math.abs(camera.position.y)
    const fov = (camera.fov * Math.PI) / 180
    
    // Calculate visible area at ground level
    const visibleHeight = 2 * Math.tan(fov / 2) * cameraHeight
    const visibleWidth = visibleHeight * camera.aspect
    
    // Project camera position to ground plane for center
    const centerX = camera.position.x
    const centerZ = camera.position.z
    
    return {
      centerX: Math.round(centerX / cellSize),
      centerY: Math.round(centerZ / cellSize), 
      visibleWidth: Math.ceil(visibleWidth / cellSize) + 4, // Add buffer
      visibleHeight: Math.ceil(visibleHeight / cellSize) + 4
    }
  }

  // Update grid if camera has moved significantly
  const updateGridIfNeeded = () => {
    if (!cameraRef.current) return
    
    const camera = cameraRef.current
    const currentPos = camera.position
    const currentRot = camera.rotation
    
    // Check if camera moved significantly
    const positionDelta = currentPos.distanceTo(lastCameraPosition.current)
    const rotationDelta = Math.abs(currentRot.x - lastCameraRotation.current.x) + 
                         Math.abs(currentRot.y - lastCameraRotation.current.y)
    
    // Update threshold - adjust sensitivity here
    const posThreshold = cellSize * 2
    const rotThreshold = 0.1
    
    if (positionDelta > posThreshold || rotationDelta > rotThreshold) {
      updateGrid()
      lastCameraPosition.current.copy(currentPos)
      lastCameraRotation.current.copy(currentRot)
    }
  }

  // Create/update the dynamic grid
  const updateGrid = () => {
    if (!cameraRef.current || !sceneRef.current) return
    
    const bounds = calculateVisibleBounds(cameraRef.current)
    gridStateRef.current = { ...bounds, cellSize }
    
    console.log('Updating grid bounds:', bounds)
    
    // Create new geometry for visible area
    createGridMesh(bounds)
  }

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return

    const width = mountRef.current.clientWidth
    const height = mountRef.current.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)
    sceneRef.current = scene

    // Camera - Start with angled top-down view, positioned based on viewport
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000)
    const cameraDistance = Math.max(width, height) * 0.8
    camera.position.set(0, cameraDistance * 0.8, cameraDistance * 0.4) // Angled top-down view
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    rendererRef.current = renderer

    // Add renderer to DOM
    mountRef.current.appendChild(renderer.domElement)
    
    console.log('Three.js scene initialized')
    console.log('Canvas size:', width, 'x', height)
    console.log('Camera position:', camera.position)

    // Import OrbitControls dynamically
    import('three/examples/jsm/controls/OrbitControls.js').then(({ OrbitControls }) => {
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.screenSpacePanning = true // Enable panning
      
      // Zoom limits
      controls.minDistance = 50   // Minimum zoom in
      controls.maxDistance = 2000 // Maximum zoom out
      
      // Orbit limits - prevent going too low to horizon
      controls.maxPolarAngle = Math.PI * 0.8 // 80% of 180 degrees (prevent going below horizon)
      controls.minPolarAngle = 0.1 // Prevent going completely overhead
      
      // No azimuth limits - infinite left/right rotation
      controls.minAzimuthAngle = -Infinity
      controls.maxAzimuthAngle = Infinity
      
      controlsRef.current = controls
      
      // Update grid when camera moves
      controls.addEventListener('change', () => {
        updateGridIfNeeded()
      })
    })

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(50, 50, 25)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    scene.add(directionalLight)

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)
      if (controlsRef.current) {
        controlsRef.current.update()
      }
      renderer.render(scene, camera)
    }
    animate()

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current) return
      const newWidth = mountRef.current.clientWidth
      const newHeight = mountRef.current.clientHeight
      
      camera.aspect = newWidth / newHeight
      camera.updateProjectionMatrix()
      renderer.setSize(newWidth, newHeight)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  // Create the dynamic grid mesh
  const createGridMesh = (bounds: { centerX: number; centerY: number; visibleWidth: number; visibleHeight: number }) => {
    if (!sceneRef.current) return
    
    console.log('=== Creating Dynamic Grid ===')
    console.log('Bounds:', bounds)
    console.log('CellColors size:', cellColors.size)
    console.log('Sample cellColors entries:', Array.from(cellColors.entries()).slice(0, 5))

    // Remove existing mesh
    if (meshRef.current) {
      sceneRef.current.remove(meshRef.current)
      if (meshRef.current.geometry) meshRef.current.geometry.dispose()
      if (meshRef.current.material) {
        if (Array.isArray(meshRef.current.material)) {
          meshRef.current.material.forEach(mat => mat.dispose())
        } else {
          meshRef.current.material.dispose()
        }
      }
    }

    // Create dynamic grid geometry based on visible bounds
    const segmentsX = Math.min(bounds.visibleWidth, 128) // Limit segments for performance
    const segmentsY = Math.min(bounds.visibleHeight, 128)
    const sizeX = bounds.visibleWidth * cellSize
    const sizeY = bounds.visibleHeight * cellSize
    const geometry = new THREE.PlaneGeometry(sizeX, sizeY, segmentsX, segmentsY)

    // Create vertex colors array
    const colors = new Float32Array(geometry.attributes.position.count * 3)
    const positions = geometry.attributes.position.array as Float32Array

    // Maximum height should equal the width of a grid cell
    const maxHeight = cellSize * 2 // Make max height more visible

    // Position mesh to center on the bounds center
    const offsetX = bounds.centerX * cellSize
    const offsetZ = bounds.centerY * cellSize

    // Generate vertices for the visible grid area
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      const x = positions[i * 3]
      const z = positions[i * 3 + 2]
      
      // Convert local mesh coordinates to world grid coordinates
      const worldX = x + offsetX
      const worldZ = z + offsetZ
      const gridX = Math.round(worldX / cellSize)
      const gridY = Math.round(worldZ / cellSize)
      
      // Generate coordinate key for data lookup (origin at 0,0)
      const coordKey = `${gridX}_${gridY}`
      
      // Get curve data or use default
      const colorStr = cellColors.get(coordKey) || '#333333'
      const color = new THREE.Color(colorStr)
      
      let height = 0
      if (cellColors.has(coordKey)) {
        // Extract height from curve data
        const hsl = { h: 0, s: 0, l: 0 }
        color.getHSL(hsl)
        const indexValue = Math.round(hsl.h * 255)
        const heightPercentage = indexValue / 255
        height = heightPercentage * maxHeight
      } else {
        // Default height for debugging (show grid structure)
        height = Math.sin(worldX * 0.02) * Math.cos(worldZ * 0.02) * maxHeight * 0.1 + maxHeight * 0.05
      }
      
      // Set vertex height
      positions[i * 3 + 1] = height
      
      // Set vertex color (white for debugging)
      colors[i * 3] = 1     // R
      colors[i * 3 + 1] = 1 // G  
      colors[i * 3 + 2] = 1 // B
    }
    
    console.log('Grid bounds:', bounds)
    console.log('Max height:', maxHeight)
    console.log('Mesh size:', sizeX, 'x', sizeY)
    console.log('Segments:', segmentsX, 'x', segmentsY)
    console.log('Offset:', offsetX, offsetZ)

    // Add colors to geometry
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    
    // Recompute normals for proper lighting
    geometry.computeVertexNormals()

    // Create material - use BasicMaterial for debugging (no lighting required)
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      wireframe: true, // Enable wireframe to see mesh structure
      color: 0xffffff  // White color as fallback
    })

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2 // Rotate to be horizontal
    mesh.position.set(offsetX, 0, offsetZ) // Position based on grid center
    mesh.receiveShadow = true
    mesh.castShadow = true
    
    sceneRef.current.add(mesh)
    meshRef.current = mesh
    
    console.log('Dynamic 3D mesh created')
    console.log('Mesh position:', mesh.position)
    console.log('Geometry vertices:', geometry.attributes.position.count)
    console.log('Scene children count:', sceneRef.current.children.length)
  }

  // Initial grid creation and updates
  useEffect(() => {
    if (cameraRef.current) {
      updateGrid()
    }
  }, [cellColors, gridDimensions, cellSize])

  return (
    <div 
      ref={mountRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        background: '#000'
      }} 
    />
  )
}

export default ThreeJSGrid
