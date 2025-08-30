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

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.set(50, 50, 50)
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
    const size = Math.max(gridDimensions.width, gridDimensions.height) * cellSize / 10 // Scale appropriately
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments)

    // Create vertex colors array
    const colors = new Float32Array(geometry.attributes.position.count * 3)
    const positions = geometry.attributes.position.array as Float32Array

    // Maximum height is the width of a grid square
    const maxHeight = cellSize

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
      
      // Extract height from color (assuming HSL where hue = index value)
      const hsl = { h: 0, s: 0, l: 0 }
      color.getHSL(hsl)
      const indexValue = hsl.h * 360 // Convert hue back to 0-360 range
      const height = (indexValue / 255) * maxHeight // Map to height
      
      // Set vertex height (Y coordinate)
      positions[i * 3 + 1] = height
      
      // Set vertex color
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
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
