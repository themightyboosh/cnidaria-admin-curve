import React, { useRef, useEffect, useState } from 'react'
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const gridSize = 128
  const maxHeight = cellSize * 20

  // Vertex shader source
  const vertexShaderSource = `
    attribute vec3 a_position;
    attribute vec3 a_color;
    
    uniform mat4 u_matrix;
    
    varying vec3 v_color;
    
    void main() {
      gl_Position = u_matrix * vec4(a_position, 1.0);
      v_color = a_color;
    }
  `

  // Fragment shader source
  const fragmentShaderSource = `
    precision mediump float;
    
    varying vec3 v_color;
    
    void main() {
      gl_FragColor = vec4(v_color, 1.0);
    }
  `

  // Create shader
  const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type)
    if (!shader) return null
    
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      return null
    }
    
    return shader
  }

  // Create program
  const createProgram = (gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) => {
    const program = gl.createProgram()
    if (!program) return null
    
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      return null
    }
    
    return program
  }

  // Create perspective matrix
  const perspective = (fov: number, aspect: number, near: number, far: number) => {
    const f = Math.tan(Math.PI * 0.5 - 0.5 * fov)
    const rangeInv = 1.0 / (near - far)
    
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInv, -1,
      0, 0, near * far * rangeInv * 2, 0
    ])
  }

  // Create lookAt matrix
  const lookAt = (eye: number[], target: number[], up: number[]) => {
    const z0 = eye[0] - target[0]
    const z1 = eye[1] - target[1]
    const z2 = eye[2] - target[2]
    const len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2)
    const z0n = z0 * len
    const z1n = z1 * len
    const z2n = z2 * len
    
    const x0 = up[1] * z2n - up[2] * z1n
    const x1 = up[2] * z0n - up[0] * z2n
    const x2 = up[0] * z1n - up[1] * z0n
    const len2 = 1 / Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2)
    const x0n = x0 * len2
    const x1n = x1 * len2
    const x2n = x2 * len2
    
    const y0 = z1n * x2n - z2n * x1n
    const y1 = z2n * x0n - z0n * x2n
    const y2 = z0n * x1n - z1n * x0n
    
    return new Float32Array([
      x0n, y0, z0n, 0,
      x1n, y1, z1n, 0,
      x2n, y2, z2n, 0,
      -(x0n * eye[0] + x1n * eye[1] + x2n * eye[2]),
      -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]),
      -(z0n * eye[0] + z1n * eye[1] + z2n * eye[2]),
      1
    ])
  }

  // Multiply two 4x4 matrices
  const multiplyMatrices = (a: Float32Array, b: Float32Array) => {
    const result = new Float32Array(16)
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] = 
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j]
      }
    }
    return result
  }

  // Generate 3D terrain mesh from height data
  const generateTerrain = (heightMap: Map<string, number>, indexMap: Map<string, number>) => {
    const vertices: number[] = []
    const colors: number[] = []
    const indices: number[] = []
    
    console.log('Generating 3D terrain with', heightMap.size, 'height points')
    
    const totalSize = gridSize * cellSize // 128 * 30 = 3840 units
    const baseHeight = 50 // Base terrain height
    
    // Create vertices for the terrain surface
    for (let z = 0; z < gridSize; z++) {
      for (let x = 0; x < gridSize; x++) {
        // World coordinates
        const worldX = (x / gridSize) * totalSize - totalSize / 2
        const worldZ = (z / gridSize) * totalSize - totalSize / 2
        
        // Get height from data
        const coordKey = `${x - gridSize / 2}_${gridSize / 2 - z}`
        const indexValue = heightMap.get(coordKey) || 0
        const heightPercentage = indexValue / 255
        const worldY = baseHeight + (heightPercentage * 100) // Height variation
        
        vertices.push(worldX, worldY, worldZ)
        
        // Get color based on mode
        let color: { r: number; g: number; b: number }
        if (colorMode === 'index' && indexMap && selectedCurve) {
          const indexPosition = indexMap.get(coordKey) || 0
          color = indexToThreeColor(indexValue, colorMode, indexPosition, selectedCurve["curve-width"])
        } else {
          color = indexToThreeColor(indexValue, 'value')
        }
        
        colors.push(color.r, color.g, color.b)
      }
    }
    
    // Create triangles for the terrain surface
    for (let z = 0; z < gridSize - 1; z++) {
      for (let x = 0; x < gridSize - 1; x++) {
        const topLeft = z * gridSize + x
        const topRight = topLeft + 1
        const bottomLeft = (z + 1) * gridSize + x
        const bottomRight = bottomLeft + 1
        
        // Two triangles per quad
        indices.push(topLeft, bottomLeft, topRight)
        indices.push(topRight, bottomLeft, bottomRight)
      }
    }
    
    console.log('Generated terrain:', vertices.length / 3, 'vertices and', indices.length / 3, 'triangles')
    console.log('Terrain size:', totalSize, 'x', totalSize, 'base height:', baseHeight)
    console.log('Vertex range: X[', Math.min(...vertices.filter((_, i) => i % 3 === 0)), 'to', Math.max(...vertices.filter((_, i) => i % 3 === 0)), ']')
    console.log('Vertex range: Y[', Math.min(...vertices.filter((_, i) => i % 3 === 1)), 'to', Math.max(...vertices.filter((_, i) => i % 3 === 1)), ']')
    console.log('Vertex range: Z[', Math.min(...vertices.filter((_, i) => i % 3 === 2)), 'to', Math.max(...vertices.filter((_, i) => i % 3 === 2)), ']')
    
    return { vertices, colors, indices }
  }

  // Render the scene
  const render = (vertices: number[], colors: number[], indices: number[]) => {
    const gl = glRef.current
    const program = programRef.current
    if (!gl || !program) return
    
    console.log('Rendering', vertices.length / 3, 'vertices')
    
    // Clear canvas
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)
    
    // Use program
    gl.useProgram(program)
    
    // Create and bind vertex buffer
    const vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)
    
    const positionLocation = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0)
    
    // Create and bind color buffer
    const colorBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW)
    
    const colorLocation = gl.getAttribLocation(program, 'a_color')
    gl.enableVertexAttribArray(colorLocation)
    gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0)
    
    // Create and bind index buffer
    const indexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW)
    
    // Set up camera and projection
    const canvas = canvasRef.current!
    const aspect = canvas.width / canvas.height
    const terrainSize = gridSize * cellSize // 128 * 30 = 3840 units
    
    console.log('Canvas dimensions:', canvas.width, 'x', canvas.height, 'aspect:', aspect)
    console.log('Terrain size:', terrainSize)
    
    // Perspective projection
    const projectionMatrix = perspective(Math.PI / 4, aspect, 1, 10000)
    console.log('Projection matrix created')
    
    // Camera positioned to see the terrain
    const cameraDistance = terrainSize * 1.2
    const cameraHeight = terrainSize * 0.6
    const viewMatrix = lookAt(
      [cameraDistance * 0.8, cameraHeight, cameraDistance * 0.8], // Angled view
      [0, 100, 0],           // Look at center of terrain
      [0, 1, 0]              // Y up
    )
    console.log('View matrix created - camera at:', [cameraDistance * 0.8, cameraHeight, cameraDistance * 0.8], 'looking at:', [0, 100, 0])
    
    const mvpMatrix = multiplyMatrices(projectionMatrix, viewMatrix)
    console.log('MVP matrix created')
    
    // Debug: Test transform a vertex to see if it's in view
    const testVertex = [0, 100, 0] // Center vertex
    const transformed = multiplyMatrixVector(mvpMatrix, [...testVertex, 1])
    console.log('Test vertex [0,100,0] transformed to:', transformed.slice(0, 3))
    
    // Set matrix uniform
    const matrixLocation = gl.getUniformLocation(program, 'u_matrix')
    gl.uniformMatrix4fv(matrixLocation, false, mvpMatrix)
    
    // Draw
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0)
    
    // Check for WebGL errors
    const error = gl.getError()
    if (error !== gl.NO_ERROR) {
      console.error('WebGL error after drawElements:', error)
    }
    
    console.log('Rendered terrain with', indices.length / 3, 'triangles')
  }

  // Multiply matrix by vector (for debugging)
  const multiplyMatrixVector = (matrix: Float32Array, vector: number[]) => {
    const result = new Float32Array(4)
    for (let i = 0; i < 4; i++) {
      result[i] = 
        matrix[i * 4 + 0] * vector[0] +
        matrix[i * 4 + 1] * vector[1] +
        matrix[i * 4 + 2] * vector[2] +
        matrix[i * 4 + 3] * vector[3]
    }
    return result
  }

  // Process API data and render
  const processData = async () => {
    if (!selectedCurve || isProcessing) return
    
    setIsProcessing(true)
    console.log('Processing WebGL data for:', selectedCurve["curve-name"])
    
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
          const { vertices, colors, indices } = generateTerrain(heightMap, indexMap)
          render(vertices, colors, indices)
        }
      }
    } catch (error) {
      console.error('Failed to process WebGL data:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      console.error('Canvas ref is null')
      return
    }
    
    console.log('=== Initializing WebGL ===')
    
    // Get WebGL context
    const gl = canvas.getContext('webgl')
    if (!gl) {
      console.error('WebGL not supported in this browser')
      return
    }
    
    console.log('WebGL context created successfully')
    glRef.current = gl
    
    // Set canvas size
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = width
    canvas.height = height
    gl.viewport(0, 0, width, height)
    
    console.log('Canvas size:', width, 'x', height)
    
    // Create shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
    
    if (!vertexShader || !fragmentShader) {
      console.error('Failed to create shaders')
      return
    }
    
    // Create program
    const program = createProgram(gl, vertexShader, fragmentShader)
    if (!program) {
      console.error('Failed to create program')
      return
    }
    
    programRef.current = program
    console.log('WebGL initialized successfully')
    
    // Process initial data
    if (selectedCurve) {
      setTimeout(() => processData(), 100)
    }
  }, [])

  // Process data when curve or color mode changes
  useEffect(() => {
    if (selectedCurve && glRef.current && programRef.current) {
      console.log('Curve or color mode changed, reprocessing...')
      processData()
    }
  }, [selectedCurve, colorMode])

  return (
    <canvas
      ref={canvasRef}
      style={{ 
        width: '100%', 
        height: '100%',
        display: 'block',
        border: '2px solid red' // Debug border to see canvas bounds
      }}
    />
  )
}

export default WebGLGrid
