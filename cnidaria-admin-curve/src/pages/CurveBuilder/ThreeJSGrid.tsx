import React, { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { apiUrl } from '../../config/environments'

interface ThreeJSGridProps {
  selectedCurve: any
  cellSize: number
}

interface Cell3D {
  x: number
  y: number
  mesh: THREE.Mesh
  indexValue: number
}

interface ProcessedCoordinate {
  "cell-coordinates": [number, number]
  "index-position": number
  "index-value": number
}

const ThreeJSGrid: React.FC<ThreeJSGridProps> = ({ selectedCurve, cellSize }) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const controlsRef = useRef<any>()
  const cellsRef = useRef<Map<string, Cell3D>>(new Map())
  const lastCameraPosition = useRef<THREE.Vector3>(new THREE.Vector3())
  const lastCameraRotation = useRef<THREE.Euler>(new THREE.Euler())
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [visibleBounds, setVisibleBounds] = useState({ 
    minX: -10, maxX: 10, minY: -10, maxY: 10 
  })

  // Calculate visible grid coordinates accounting for pan AND zoom
  const getVisibleCoordinates = () => {
    if (!cameraRef.current || !controlsRef.current) return { minX: -5, maxX: 5, minY: -5, maxY: 5 }
    
    const camera = cameraRef.current
    const controls = controlsRef.current
    
    // Get the target point (where camera is looking - this is where panning moves to)
    const target = controls.target.clone()
    
    // Calculate distance from camera to target
    const cameraHeight = camera.position.distanceTo(target)
    const fov = (camera.fov * Math.PI) / 180
    
    // Calculate visible area at the target level (ground plane)
    const visibleHeight = 2 * Math.tan(fov / 2) * cameraHeight
    const visibleWidth = visibleHeight * camera.aspect
    
    // Get camera angle to adjust grid size (prevent horizon overload)
    const cameraVector = new THREE.Vector3()
    camera.getWorldDirection(cameraVector)
    const angle = Math.acos(-cameraVector.y) // Angle from straight down
    const angleRatio = angle / (Math.PI / 2) // 0 = straight down, 1 = horizontal
    
    // Reduce grid size when viewing at shallow angles (near horizon)
    const angleFactor = Math.max(0.3, 1 - angleRatio * 0.7) // Reduce up to 70% when horizontal
    
    // Convert to grid coordinates with angle adjustment
    const gridWidth = Math.ceil((visibleWidth / cellSize) * angleFactor)
    const gridHeight = Math.ceil((visibleHeight / cellSize) * angleFactor)
    
    // Also limit maximum grid size for performance
    const maxGridSize = 30 // Maximum cells in any direction
    const limitedGridWidth = Math.min(gridWidth, maxGridSize)
    const limitedGridHeight = Math.min(gridHeight, maxGridSize)
    
    // Center on the target position (this accounts for panning)
    const centerX = Math.round(target.x / cellSize)
    const centerZ = Math.round(target.z / cellSize)
    
    console.log('3D Camera info:', {
      cameraPos: camera.position,
      target: target,
      distance: cameraHeight,
      angle: `${(angle * 180 / Math.PI).toFixed(1)}°`,
      angleFactor: angleFactor.toFixed(2),
      gridSize: { width: limitedGridWidth, height: limitedGridHeight },
      center: { x: centerX, z: centerZ }
    })
    
    return {
      minX: centerX - Math.floor(limitedGridWidth / 2) - 1, // Use limited grid size
      maxX: centerX + Math.floor(limitedGridWidth / 2) + 1,
      minY: centerZ - Math.floor(limitedGridHeight / 2) - 1,
      maxY: centerZ + Math.floor(limitedGridHeight / 2) + 1
    }
  }

  // Process coordinates for visible cells (like 2D version)
  const processCellCoordinates = async (bounds: any) => {
    if (!selectedCurve || isProcessing) return
    
    setIsProcessing(true)
    console.log(`Processing 3D coordinates for curve: ${selectedCurve["curve-name"]}`)
    console.log(`3D Grid bounds: (${bounds.minX}, ${bounds.minY}) to (${bounds.maxX}, ${bounds.maxY})`)
    
    try {
      // Call same API endpoint as 2D version
      const response = await fetch(
        `${apiUrl}/api/curves/${selectedCurve.id}/process?x=${bounds.minX}&y=${bounds.minY}&x2=${bounds.maxX}&y2=${bounds.maxY}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.success && Array.isArray(data.results)) {
          console.log(`Received ${data.results.length} coordinates for 3D grid`)
          
          // Clear existing cells outside bounds
          clearCellsOutsideBounds(bounds)
          
          // Create/update cells with API data
          data.results.forEach((result: ProcessedCoordinate) => {
            const [x, y] = result["cell-coordinates"]
            const indexValue = result["index-value"]
            createOrUpdateCell(x, y, indexValue)
          })
          
        } else {
          console.error('Invalid 3D API response format')
        }
      } else {
        console.error('3D API request failed:', response.status)
      }
    } catch (error) {
      console.error('Failed to process 3D coordinates:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  // Create or update a cell at specific coordinates
  const createOrUpdateCell = (x: number, y: number, indexValue: number) => {
    if (!sceneRef.current) return
    
    const cellKey = `${x}_${y}`
    const existingCell = cellsRef.current.get(cellKey)
    
    // Calculate height and color from index value (0-255)
    const heightPercentage = indexValue / 255
    const height = heightPercentage * cellSize // Max height equals cell size
    const hue = indexValue // Use index value as hue (0-255)
    const color = new THREE.Color(`hsl(${hue}, 70%, 50%)`)
    
    if (existingCell) {
      // Update existing cell
      existingCell.indexValue = indexValue
      existingCell.mesh.scale.y = height / cellSize // Scale from base height
      ;(existingCell.mesh.material as THREE.MeshBasicMaterial).color = color
    } else {
      // Create new cell
      const geometry = new THREE.BoxGeometry(cellSize * 0.9, height, cellSize * 0.9) // Slightly smaller for gaps
      const material = new THREE.MeshBasicMaterial({ 
        color: color,
        wireframe: false 
      })
      const mesh = new THREE.Mesh(geometry, material)
      
      // Position cell at grid coordinates
      mesh.position.set(
        x * cellSize,
        height / 2, // Position at half height so bottom sits on ground
        y * cellSize
      )
      
      sceneRef.current.add(mesh)
      
      // Store cell
      const cell: Cell3D = { x, y, mesh, indexValue }
      cellsRef.current.set(cellKey, cell)
    }
  }
  
  // Clear cells outside visible bounds
  const clearCellsOutsideBounds = (bounds: any) => {
    const cellsToRemove: string[] = []
    
    cellsRef.current.forEach((cell, key) => {
      if (cell.x < bounds.minX || cell.x > bounds.maxX || 
          cell.y < bounds.minY || cell.y > bounds.maxY) {
        // Remove from scene
        if (sceneRef.current) {
          sceneRef.current.remove(cell.mesh)
        }
        // Dispose geometry and material
        cell.mesh.geometry.dispose()
        ;(cell.mesh.material as THREE.Material).dispose()
        cellsToRemove.push(key)
      }
    })
    
    // Remove from map
    cellsToRemove.forEach(key => cellsRef.current.delete(key))
    
    if (cellsToRemove.length > 0) {
      console.log(`Removed ${cellsToRemove.length} cells outside bounds`)
    }
  }

  // Update grid if camera has moved significantly
  const updateGridIfNeeded = () => {
    if (!cameraRef.current || !controlsRef.current) return
    
    const camera = cameraRef.current
    const controls = controlsRef.current
    const currentPos = camera.position
    const currentTarget = controls.target
    
    // Check if camera or target moved significantly
    const positionDelta = currentPos.distanceTo(lastCameraPosition.current)
    const targetDelta = currentTarget.distanceTo(new THREE.Vector3(0, 0, 0)) // Compare to stored target
    
    // Update threshold - adjust sensitivity here
    const threshold = cellSize * 1.5
    
    if (positionDelta > threshold || targetDelta > threshold) {
      const bounds = getVisibleCoordinates()
      setVisibleBounds(bounds)
      processCellCoordinates(bounds)
      lastCameraPosition.current.copy(currentPos)
    }
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
      controls.maxDistance = 500  // Reduced max zoom to prevent deep horizon
      
      // Orbit limits - keep good 3D feel without horizon overload
      controls.maxPolarAngle = Math.PI * 0.65 // 65% (about 117°) - prevents low horizon views
      controls.minPolarAngle = Math.PI * 0.1  // 10% (about 18°) - prevents straight overhead
      
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



  // Initial grid creation and updates
  useEffect(() => {
    if (cameraRef.current && selectedCurve) {
      const bounds = getVisibleCoordinates()
      setVisibleBounds(bounds)
      processCellCoordinates(bounds)
    }
  }, [selectedCurve, cellSize])

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
