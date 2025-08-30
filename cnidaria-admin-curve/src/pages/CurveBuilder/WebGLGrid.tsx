import React, { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { apiUrl } from '../../config/environments'
import { indexToThreeColor } from '../../utils/colorSpectrum'

interface WebGLGridProps {
  selectedCurve: any
  cellSize: number
  colorMode: 'value' | 'index'
}

interface ProcessedCoordinate {
  "cell-coordinates": [number, number]
  "index-position": number
  "index-value": number
}

const WebGLGrid: React.FC<WebGLGridProps> = ({ selectedCurve, cellSize, colorMode }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const gridSize = 128
  const maxHeight = cellSize * 100 // Much taller terrain

  // Process API data and render
  const processData = async () => {
    if (!selectedCurve || isProcessing) return
    
    setIsProcessing(true)
    console.log('Processing Three.js data for:', selectedCurve["curve-name"])
    
    try {
      const halfGrid = Math.floor(gridSize / 2)
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
    scene.background = new THREE.Color(0x000000)
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 10000)
    camera.position.set(20, 20, 20) // Close to the square
    camera.lookAt(0, 0, 0)
    
    // Log camera position for default view
    console.log('Camera Position:', {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      lookAt: { x: 0, y: 0, z: 0 }
    })
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    containerRef.current.appendChild(renderer.domElement)
    
    // Simple camera controls
    let mouseX = 0
    let mouseY = 0
    let isMouseDown = false
    
    const handleMouseDown = (event: MouseEvent) => {
      isMouseDown = true
      mouseX = event.clientX
      mouseY = event.clientY
    }
    
    const handleMouseMove = (event: MouseEvent) => {
      if (!isMouseDown) return
      
      const deltaX = event.clientX - mouseX
      const deltaY = event.clientY - mouseY
      
      camera.position.x += deltaX * 0.1
      camera.position.y -= deltaY * 0.1
      camera.lookAt(0, 0, 0)
      
      mouseX = event.clientX
      mouseY = event.clientY
      
      // Log camera position when moving
      console.log('Camera Position:', {
        x: camera.position.x.toFixed(2),
        y: camera.position.y.toFixed(2),
        z: camera.position.z.toFixed(2),
        lookAt: { x: 0, y: 0, z: 0 }
      })
    }
    
    const handleMouseUp = () => {
      isMouseDown = false
    }
    
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      camera.position.z += event.deltaY * 0.1
    }
    
    renderer.domElement.addEventListener('mousedown', handleMouseDown)
    renderer.domElement.addEventListener('mousemove', handleMouseMove)
    renderer.domElement.addEventListener('mouseup', handleMouseUp)
    renderer.domElement.addEventListener('wheel', handleWheel)
    
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
    
    window.addEventListener('keydown', handleKeyPress)
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
    scene.add(ambientLight)
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)
    
    // Create 128x128x12.8 box with vertex colors and heights from curve data
    const geometry = new THREE.BoxGeometry(128, 12.8, 128, 128, 1, 128) // 128 segments width and height, 1 segment depth
    const material = new THREE.MeshLambertMaterial({ 
      vertexColors: true,
      wireframe: false
    })
    
    // Process vertices to apply colors and heights
    const positions = geometry.attributes.position
    const colors = new Float32Array(positions.count * 3)
    
    // Process each vertex
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      const z = positions.getZ(i)
      
      // Only process top surface vertices (Y = 6.4)
      if (Math.abs(y - 6.4) < 0.1) {
        // Convert to grid coordinates (-64 to 63)
        const gridX = Math.round(x)
        const gridZ = Math.round(z)
        
        // Get curve data for this coordinate
        const coordKey = `${gridX}_${gridZ}`
        const indexValue = heightMap.get(coordKey) || 0
        const indexPosition = indexMap.get(coordKey) || 0
        
        // Calculate height percentage (0-100%)
        const heightPercentage = indexValue / 255
        
        // Apply height: 0% = no change, 100% = add full depth (12.8)
        const heightOffset = heightPercentage * 12.8
        positions.setY(i, 6.4 + heightOffset)
        
        // Calculate color based on colorMode
        let color: { r: number; g: number; b: number }
        if (colorMode === 'index') {
          // Index mode: percentage of current index vs curve-width
          color = indexToThreeColor(indexValue, 'index', indexPosition, selectedCurve["curve-width"])
        } else {
          // Value mode: percentage of current index value vs 256
          color = indexToThreeColor(indexValue, 'value')
        }
        
        // Set vertex color
        colors[i * 3] = color.r
        colors[i * 3 + 1] = color.g
        colors[i * 3 + 2] = color.b
        
        // Debug: log first few vertices
        if (i < 10) {
          console.log(`Vertex ${i}: grid(${gridX},${gridZ}) value=${indexValue} height=${heightOffset.toFixed(2)} color=rgb(${color.r},${color.g},${color.b})`)
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
    
    const box = new THREE.Mesh(geometry, material)
    box.position.set(0, 0, 0) // Center at origin (height already applied)
    scene.add(box)
    
    console.log('Created 128x128x12.8 colored terrain with heights from curve data')
    
    console.log('Created 10x10x1 green wireframe square')
    
         // Animation loop
     const animate = () => {
       requestAnimationFrame(animate)
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
