import React, { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { apiUrl } from '../../config/environments'

interface ThreeJSGridProps {
  selectedCurve: any
  cellSize: number
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
  const meshRef = useRef<THREE.Mesh>()
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [isShiftPressed, setIsShiftPressed] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  
  // Fixed 256x256 grid
  const gridSize = 256

  // Get coordinates for 256x256 grid with offset
  const getGridCoordinates = () => {
    const halfGrid = Math.floor(gridSize / 2)
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
        `${apiUrl}/api/curves/${selectedCurve.id}/process?x=${bounds.minX}&y=${bounds.minY}&x2=${bounds.maxX}&y2=${bounds.maxY}`,
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
          console.log(`Received ${results.length} coordinates for 256x256 grid`)
          
          // Create height map from results
          const heightMap = new Map<string, number>()
          results.forEach((result: ProcessedCoordinate) => {
            const [x, y] = result["cell-coordinates"]
            const indexValue = result["index-value"]
            heightMap.set(`${x}_${y}`, indexValue)
          })
          
          // Update mesh with new height data
          updateMeshHeights(heightMap, bounds)
          
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
    if (!sceneRef.current) return
    
    // Remove existing mesh
    if (meshRef.current) {
      sceneRef.current.remove(meshRef.current)
      meshRef.current.geometry.dispose()
      ;(meshRef.current.material as THREE.Material).dispose()
    }
    
    // Create 256x256 plane geometry
    const geometry = new THREE.PlaneGeometry(
      gridSize * cellSize, 
      gridSize * cellSize, 
      gridSize - 1, 
      gridSize - 1
    )
    
    // Create material with vertex colors
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      wireframe: false
    })
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2 // Rotate to be horizontal
    mesh.receiveShadow = true
    mesh.castShadow = true
    
    sceneRef.current.add(mesh)
    meshRef.current = mesh
    
    console.log('Created 256x256 terrain mesh')
  }
  
  // Update mesh heights and colors from API data
  const updateMeshHeights = (heightMap: Map<string, number>, bounds: any) => {
    if (!meshRef.current) return
    
    const geometry = meshRef.current.geometry as THREE.PlaneGeometry
    const positions = geometry.attributes.position.array as Float32Array
    const colors = new Float32Array(positions.length)
    
    const maxHeight = cellSize * 2 // Maximum height
    
    // Update each vertex
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]
      const z = positions[i + 2]
      
      // Convert mesh coordinates to grid coordinates
      const gridX = Math.round(x / cellSize) + bounds.minX + Math.floor(gridSize / 2)
      const gridY = Math.round(z / cellSize) + bounds.minY + Math.floor(gridSize / 2)
      
      // Get height from API data
      const coordKey = `${gridX}_${gridY}`
      const indexValue = heightMap.get(coordKey) || 0
      const heightPercentage = indexValue / 255
      const height = heightPercentage * maxHeight
      
      // Set vertex height (Y coordinate)
      positions[i + 1] = height
      
      // Set vertex color
      const hue = indexValue
      const color = new THREE.Color(`hsl(${hue}, 70%, 50%)`)
      colors[i] = color.r
      colors[i + 1] = color.g
      colors[i + 2] = color.b
    }
    
    // Update geometry
    geometry.attributes.position.needsUpdate = true
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.computeVertexNormals()
    
    console.log('Updated mesh heights and colors')
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
    createTerrainMesh()

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
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      renderer.domElement.removeEventListener('mousemove', handleMouseMove)
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])



  // Process grid when curve or offset changes
  useEffect(() => {
    if (selectedCurve && meshRef.current) {
      processGridCoordinates()
    }
  }, [selectedCurve, offsetX, offsetY])

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
