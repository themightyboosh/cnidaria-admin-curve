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
      controls.screenSpacePanning = false
      controls.minDistance = 50
      controls.maxDistance = 1000
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
    
    console.log('=== 3D Grid Debug ===')
    console.log('Grid dimensions:', gridDimensions)
    console.log('CellColors size:', cellColors.size)
    console.log('CellSize:', cellSize)
    console.log('Sample cellColors entries:', Array.from(cellColors.entries()).slice(0, 5))
    
    if (cellColors.size === 0) {
      console.warn('No cellColors data - 3D grid will show default white vertices')
    }

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

    // Create grid geometry (64x64 vertices for better performance while debugging)
    const segments = 63 // 64x64 vertices  
    // Size mesh to fit 80% of viewport width with fallback
    const containerWidth = mountRef.current?.clientWidth || 400
    const containerHeight = mountRef.current?.clientHeight || 400
    const viewportSize = Math.min(containerWidth, containerHeight)
    const size = Math.max(100, viewportSize * 0.6) // Ensure minimum size of 100
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments)

    // Create vertex colors array
    const colors = new Float32Array(geometry.attributes.position.count * 3)
    const positions = geometry.attributes.position.array as Float32Array

    // Maximum height should equal the width of a grid cell
    // Since we have a plane of 'size' units divided into segments, each cell width is size/segments
    const cellWidth = size / segments
    const maxHeight = cellWidth * 2 // Make max height more visible

    // Make ALL vertices white for debugging and add some height variation
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      const x = positions[i * 3]
      const z = positions[i * 3 + 2]
      
      // Create a simple wave pattern for visibility
      const waveHeight = Math.sin(x * 0.1) * Math.cos(z * 0.1) * maxHeight * 0.3
      const baseHeight = maxHeight * 0.2
      
      // Set vertex height (Y coordinate) with wave pattern
      positions[i * 3 + 1] = baseHeight + waveHeight
      
      // Set ALL vertices to white for debugging
      colors[i * 3] = 1     // R
      colors[i * 3 + 1] = 1 // G  
      colors[i * 3 + 2] = 1 // B
    }
    
    console.log('Max height:', maxHeight)
    console.log('Cell width:', cellWidth)
    console.log('Plane size:', size)
    console.log('First few vertex heights:', 
      Array.from({length: 5}, (_, i) => positions[i * 3 + 1]))

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
    mesh.receiveShadow = true
    mesh.castShadow = true
    
    sceneRef.current.add(mesh)
    meshRef.current = mesh
    
    // Add a test cube for debugging
    const testGeometry = new THREE.BoxGeometry(50, 50, 50)
    const testMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
    const testCube = new THREE.Mesh(testGeometry, testMaterial)
    testCube.position.set(0, 100, 0) // Position above the plane
    sceneRef.current.add(testCube)
    
    console.log('3D mesh created and added to scene')
    console.log('Mesh position:', mesh.position)
    console.log('Mesh scale:', mesh.scale)
    console.log('Mesh rotation:', mesh.rotation)
    console.log('Geometry vertices:', geometry.attributes.position.count)
    console.log('Scene children count:', sceneRef.current.children.length)
    console.log('Viewport size:', viewportSize)
    console.log('Plane size:', size)
    console.log('Camera position:', cameraRef.current?.position)

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
