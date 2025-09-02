import React, { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { apiUrl } from '../../config/environments'
import { indexToThreeColor } from '../../utils/colorSpectrum'

interface ThreeJSGridProps {
  selectedCurve: any
  cellSize: number
  colorMode: 'value' | 'index'
}

interface ProcessedCoordinate {
  "cell-coordinates": [number, number]
  "index-position": number
  "index-value": number
}

const ThreeJSGrid: React.FC<ThreeJSGridProps> = ({ selectedCurve, cellSize, colorMode }) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const controlsRef = useRef<any>()
  const meshRef = useRef<THREE.Mesh>()
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [isShiftPressed, setIsShiftPressed] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  
  // Dense mesh approach: 128x128 data mapped to 640x640 render grid
  const dataGridSize = 128 // Our actual data grid
  const renderGridSize = 640 // Dense rendering mesh (5x resolution)
  const interpolationRatio = 5 // 5x5 render vertices per data cell

  // Get coordinates for data grid with offset (still 128x128 for API calls)
  const getGridCoordinates = () => {
    const halfGrid = Math.floor(dataGridSize / 2)
    return {
      minX: -halfGrid + offsetX,
      maxX: halfGrid - 1 + offsetX,
      minY: -halfGrid + offsetY,
      maxY: halfGrid - 1 + offsetY
    }
  }

  // Process coordinates for 256x256 grid
  const processGridCoordinates = async () => {
    if (!selectedCurve || isProcessing) return
    
    setIsProcessing(true)
    const bounds = getGridCoordinates()
    console.log(`Processing 3D grid: ${selectedCurve["curve-name"]}`)
    console.log(`Grid bounds: (${bounds.minX}, ${bounds.minY}) to (${bounds.maxX}, ${bounds.maxY})`)
    console.log(`Grid offset: (${offsetX}, ${offsetY})`)
    
    try {
      // Call API for entire 256x256 grid
      const response = await fetch(
        `${apiUrl}/curves/${selectedCurve.id}/process?x=${bounds.minX}&y=${bounds.minY}&x2=${bounds.maxX}&y2=${bounds.maxY}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip, deflate'
          }
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        
        // The API returns data in format: {"curve-name": [results]}
        const curveName = Object.keys(data)[0]
        const results = data[curveName]
        
        if (results && Array.isArray(results)) {
          console.log(`Received ${results.length} coordinates for 128x128 grid`)
          console.log('Sample results:', results.slice(0, 5))
          
          // Create height map from results, also store index position for color mapping
          const heightMap = new Map<string, number>()
          const indexMap = new Map<string, number>()
          results.forEach((result: ProcessedCoordinate, index: number) => {
            const [x, y] = result["cell-coordinates"]
            const indexValue = result["index-value"]
            const indexPosition = result["index-position"] // Use actual curve index position
            heightMap.set(`${x}_${y}`, indexValue)
            indexMap.set(`${x}_${y}`, indexPosition)
          })
          
          console.log('Height map size:', heightMap.size)
          console.log('Sample height map entries:', Array.from(heightMap.entries()).slice(0, 5))
          
          // Update mesh with new height data
          updateMeshHeights(heightMap, bounds, indexMap, selectedCurve["curve-width"])
          
        } else {
          console.error('Invalid 3D API response format')
          console.error('Got:', data)
        }
      } else {
        const errorText = await response.text()
        console.error('3D API request failed:', response.status, response.statusText, errorText)
      }
    } catch (error) {
      console.error('Failed to process 3D coordinates:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  // Create the terrain mesh
  const createTerrainMesh = () => {
    console.log('createTerrainMesh called')
    if (!sceneRef.current) {
      console.error('sceneRef.current is null in createTerrainMesh')
      return
    }
    
    // Remove existing mesh
    if (meshRef.current) {
      console.log('Removing existing mesh')
      sceneRef.current.remove(meshRef.current)
      meshRef.current.geometry.dispose()
      ;(meshRef.current.material as THREE.Material).dispose()
    }
    
    console.log('Creating DENSE geometry:', renderGridSize, 'x', renderGridSize, 'vertices for', dataGridSize, 'x', dataGridSize, 'data')
    
    // Create dense 640x640 plane geometry for smooth surface
    const geometry = new THREE.PlaneGeometry(
      dataGridSize * cellSize,  // Physical size stays the same
      dataGridSize * cellSize, 
      renderGridSize - 1,       // But 1280x1280 vertices for smoothness
      renderGridSize - 1
    )
    
    console.log('Geometry created, vertices:', geometry.attributes.position.count, 'grid:', renderGridSize)
    
    // Create material with vertex colors - solid terrain
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      wireframe: false // Solid terrain surface
    })
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2 // Rotate to be horizontal
    mesh.receiveShadow = true
    mesh.castShadow = true
    
    console.log('Mesh created:', mesh)
    console.log('Mesh position:', mesh.position)
    console.log('Mesh scale:', mesh.scale)
    
    // Initialize with default heights and colors
    const positions = geometry.attributes.position.array as Float32Array
    const colors = new Float32Array(positions.length)
    
    console.log('Setting up terrain vertices:', positions.length / 3)
    
    // Set default heights and bright colors for maximum visibility
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]
      const z = positions[i + 2]
      const height = 1000 + Math.sin(x * 0.002) * Math.cos(z * 0.002) * 800 // Much taller mountains
      positions[i + 1] = height
      
      // Make it bright white for maximum visibility
      colors[i] = 1.0   // R
      colors[i + 1] = 1.0 // G  
      colors[i + 2] = 1.0 // B
    }
    
    console.log('Terrain heights set to 200-1800 range, all vertices white')
    
    console.log('Set', positions.length / 3, 'vertices with heights 50-150 and bright green color')
    console.log('Sample vertex positions:', [
      `(${positions[0]}, ${positions[1]}, ${positions[2]})`,
      `(${positions[3]}, ${positions[4]}, ${positions[5]})`,
      `(${positions[6]}, ${positions[7]}, ${positions[8]})`
    ])
    
    geometry.attributes.position.needsUpdate = true
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.computeVertexNormals()
    
    sceneRef.current.add(mesh)
    meshRef.current = mesh
    
    console.log('Created 128x128 terrain mesh, added to scene')
    console.log('Scene children count:', sceneRef.current.children.length)
  }
  
  // Bilinear interpolation for smooth height blending
  const getInterpolatedHeight = (x: number, y: number, heightMap: Map<string, number>) => {
    // Get the four surrounding grid points
    const x1 = Math.floor(x)
    const y1 = Math.floor(y)
    const x2 = x1 + 1
    const y2 = y1 + 1
    
    // Get heights at the four corners
    const h11 = heightMap.get(`${x1}_${y1}`) || 0
    const h21 = heightMap.get(`${x2}_${y1}`) || 0
    const h12 = heightMap.get(`${x1}_${y2}`) || 0
    const h22 = heightMap.get(`${x2}_${y2}`) || 0
    
    // Calculate interpolation weights
    const wx = x - x1
    const wy = y - y1
    
    // Bilinear interpolation
    const h1 = h11 * (1 - wx) + h21 * wx
    const h2 = h12 * (1 - wx) + h22 * wx
    const height = h1 * (1 - wy) + h2 * wy
    
    return height
  }
  
  // Use shared color spectrum for consistency with 2D view
  const getSpectrumColor = (indexValue: number) => {
    const { r, g, b } = indexToThreeColor(indexValue)
    return new THREE.Color(r, g, b)
  }

  // Update mesh heights and colors from API data with smooth interpolation
  const updateMeshHeights = (heightMap: Map<string, number>, bounds: any, indexMap?: Map<string, number>, curveWidth?: number) => {
    if (!meshRef.current) return
    
    const geometry = meshRef.current.geometry as THREE.PlaneGeometry
    const positions = geometry.attributes.position.array as Float32Array
    const colors = new Float32Array(positions.length)
    
    const maxHeight = cellSize * 20 // Maximum height - much taller for visibility
    const cellsPerUnit = gridSize / (gridSize * cellSize) // Cells per world unit
    
    console.log('Updating terrain with', heightMap.size, 'height points')
    
    // Update each vertex with interpolated height and procedural color
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]
      const z = positions[i + 2]
      
      // Convert dense mesh coordinates to data grid space 
      // Since we have 5x more vertices, we need to scale down the coordinates
      const dataX = (x / cellSize) + bounds.minX + (dataGridSize / 2)
      const dataY = (z / cellSize) + bounds.minY + (dataGridSize / 2)
      
      // Get interpolated height using data grid coordinates
      const indexValue = getInterpolatedHeight(dataX, dataY, heightMap)
      const heightPercentage = indexValue / 255
      const height = heightPercentage * maxHeight
      
      // Set vertex height (Y coordinate)
      positions[i + 1] = height
      
      // Get spectrum color based on color mode
      let color: THREE.Color
      if (colorMode === 'index' && indexMap && curveWidth) {
        // Find the nearest coordinate for index mapping
        const nearestKey = `${Math.round(gridX)}_${Math.round(gridY)}`
        const indexPosition = indexMap.get(nearestKey) || 0
        const { r, g, b } = indexToThreeColor(indexValue, colorMode, indexPosition, curveWidth)
        color = new THREE.Color(r, g, b)
      } else {
        // Default to value-based coloring
        const { r, g, b } = indexToThreeColor(indexValue, 'value')
        color = new THREE.Color(r, g, b)
      }
      colors[i] = color.r
      colors[i + 1] = color.g
      colors[i + 2] = color.b
    }
    
    // Update geometry
    geometry.attributes.position.needsUpdate = true
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.computeVertexNormals()
    
    console.log('Updated terrain with smooth interpolation and procedural colors')
  }

  // Initialize Three.js scene
  useEffect(() => {
    console.log('=== Initializing 3D Scene ===')
    if (!mountRef.current) {
      console.error('mountRef.current is null')
      return
    }

    const width = mountRef.current.clientWidth
    const height = mountRef.current.clientHeight
    console.log('Canvas size:', width, 'x', height)

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)
    sceneRef.current = scene

    // Camera - Position high above to look DOWN at the horizontal terrain
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 15000)
    const terrainSize = dataGridSize * cellSize // 128 * 30 = 3840 units
    
    // Position camera HIGH ABOVE the terrain, looking down at an angle
    camera.position.set(
      terrainSize * 0.5,  // X: to the side
      terrainSize * 1.5,  // Y: HIGH ABOVE (this is key!)
      terrainSize * 0.5   // Z: to the side
    )
    camera.lookAt(0, 0, 0) // Look down at the center of the terrain
    console.log('Camera positioned for terrain size:', terrainSize, 'at position:', camera.position)
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
      
      // Zoom limits - scaled for terrain size
      controls.minDistance = terrainSize * 0.1   // Minimum zoom in
      controls.maxDistance = terrainSize * 2     // Maximum zoom out
      
      // Orbit limits - keep good 3D feel without horizon overload
      controls.maxPolarAngle = Math.PI * 0.65 // 65% (about 117°) - prevents low horizon views
      controls.minPolarAngle = Math.PI * 0.1  // 10% (about 18°) - prevents straight overhead
      
      // No azimuth limits - infinite left/right rotation
      controls.minAzimuthAngle = -Infinity
      controls.maxAzimuthAngle = Infinity
      
      controlsRef.current = controls
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

    // Add keyboard event listeners
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setIsShiftPressed(true)
        if (controlsRef.current) {
          controlsRef.current.enabled = false // Disable orbit controls when shift is pressed
        }
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setIsShiftPressed(false)
        if (controlsRef.current) {
          controlsRef.current.enabled = true // Re-enable orbit controls
        }
      }
    }

    // Add mouse event listeners
    const handleMouseMove = (event: MouseEvent) => {
      if (isShiftPressed) {
        const deltaX = event.clientX - lastMousePos.x
        const deltaY = event.clientY - lastMousePos.y
        
        // Convert mouse movement to coordinate offset
        const sensitivity = 0.1
        const newOffsetX = offsetX - deltaX * sensitivity
        const newOffsetY = offsetY + deltaY * sensitivity // Invert Y for intuitive movement
        
        setOffsetX(Math.round(newOffsetX))
        setOffsetY(Math.round(newOffsetY))
      }
      setLastMousePos({ x: event.clientX, y: event.clientY })
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    renderer.domElement.addEventListener('mousemove', handleMouseMove)



    // Create initial terrain mesh
    console.log('Creating initial terrain mesh...')
    createTerrainMesh()

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)
      if (controlsRef.current) {
        controlsRef.current.update()
      }
      renderer.render(scene, camera)
    }
    console.log('Starting animation loop...')
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
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      renderer.domElement.removeEventListener('mousemove', handleMouseMove)
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])



  // Process grid when curve, offset, or color mode changes
  useEffect(() => {
    if (selectedCurve && meshRef.current) {
      console.log('Processing grid coordinates due to curve/offset/colorMode change')
      // Small delay to ensure mesh is fully initialized
      setTimeout(() => {
        processGridCoordinates()
      }, 100)
    }
  }, [selectedCurve, offsetX, offsetY, colorMode])

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
