import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'

interface ThreeJSGridProps {
  cellColors: Map<string, string>
  gridDimensions: { width: number; height: number }
  cellSize: number
}

const ThreeJSGrid: React.FC<ThreeJSGridProps> = ({ cellColors, gridDimensions, cellSize }) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const meshRef = useRef<THREE.Mesh>()
  const controlsRef = useRef<any>()

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return

    const width = mountRef.current.clientWidth
    const height = mountRef.current.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)
    sceneRef.current = scene

    // Camera - Start with angled top-down view
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.set(0, 80, 40) // Angled top-down view
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

    // Import OrbitControls dynamically
    import('three/examples/jsm/controls/OrbitControls.js').then(({ OrbitControls }) => {
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.screenSpacePanning = false
      controls.minDistance = 10
      controls.maxDistance = 200
      controls.maxPolarAngle = Math.PI
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

  // Create/update the grid mesh
  useEffect(() => {
    if (!sceneRef.current || !gridDimensions.width || !gridDimensions.height) return
    
    console.log('Creating 3D grid with dimensions:', gridDimensions)
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

    // Create grid geometry (256x256 vertices for smooth mesh)
    const segments = 255 // 256x256 vertices
    const size = Math.max(gridDimensions.width, gridDimensions.height) * (cellSize / 2) // Scale appropriately
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments)

    // Create vertex colors array
    const colors = new Float32Array(geometry.attributes.position.count * 3)
    const positions = geometry.attributes.position.array as Float32Array

    // Maximum height should equal the width of a grid cell
    // Since we have a plane of 'size' units divided into segments, each cell width is size/segments
    const cellWidth = size / segments
    const maxHeight = cellWidth

    // Update vertices with height and color data
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      const x = positions[i * 3]
      const z = positions[i * 3 + 2]
      
      // Convert mesh coordinates to grid coordinates
      const gridX = Math.round((x / size) * gridDimensions.width + gridDimensions.width / 2)
      const gridY = Math.round((z / size) * gridDimensions.height + gridDimensions.height / 2)
      
      // Generate coordinate key (same as 2D grid)
      const coordKey = `${gridX - Math.floor(gridDimensions.width / 2)}_${Math.floor(gridDimensions.height / 2) - gridY}`
      
      // Get color from cellColors map
      const colorStr = cellColors.get(coordKey) || '#333333'
      const color = new THREE.Color(colorStr)
      
      // Extract the index value from the HSL hue 
      // The 2D grid uses: hsl(indexValue, 70%, 50%) where indexValue is 0-255
      // Three.js getHSL returns h as 0-1, so we need to convert back
      const hsl = { h: 0, s: 0, l: 0 }
      color.getHSL(hsl)
      const indexValue = Math.round(hsl.h * 255) // Convert hue (0-1) back to original index value (0-255)
      const heightPercentage = indexValue / 255 // Convert to percentage (0-1)
      const height = heightPercentage * maxHeight // Height as percentage of cell width
      
      // Set vertex height (Y coordinate)
      positions[i * 3 + 1] = height
      
      // Set vertex color (use the same color as 2D grid)
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    
    // Debug: If no colors found, make vertices white for visibility
    const hasColors = Array.from(cellColors.values()).length > 0
    if (!hasColors) {
      console.log('No curve data found, showing white vertices for debugging')
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = 1     // R
        colors[i + 1] = 1 // G  
        colors[i + 2] = 1 // B
        // Set a small default height for visibility (10% of max height)
        positions[(i / 3) * 3 + 1] = maxHeight * 0.1
      }
    }

    // Add colors to geometry
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    
    // Recompute normals for proper lighting
    geometry.computeVertexNormals()

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
