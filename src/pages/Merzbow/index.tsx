import React, { useEffect, useRef, useState } from 'react'
import Header from '../../components/Header'
import './Merzbow.css'

const Merzbow: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // State for all Pipeline F parameters
  const [angularEnabled, setAngularEnabled] = useState(false)
  const [angularFrequency, setAngularFrequency] = useState(6.0)
  const [angularAmplitude, setAngularAmplitude] = useState(20.0)
  const [angularOffset, setAngularOffset] = useState(0.0)

  const [fractalEnabled, setFractalEnabled] = useState(false)
  const [fractalScale1, setFractalScale1] = useState(0.01)
  const [fractalScale2, setFractalScale2] = useState(0.05)
  const [fractalScale3, setFractalScale3] = useState(0.1)
  const [fractalStrength, setFractalStrength] = useState(10)

  const [distanceCalc, setDistanceCalc] = useState('radial')
  const [distanceModulus, setDistanceModulus] = useState(0)
  const [curveScaling, setCurveScaling] = useState(1.0)
  const [isMouseDragging, setIsMouseDragging] = useState(false)

  const [checkerboardEnabled, setCheckerboardEnabled] = useState(false)
  const [checkerboardSteps, setCheckerboardSteps] = useState(50)

  // Center offset for dragging
  const [centerOffsetX, setCenterOffsetX] = useState(0)
  const [centerOffsetY, setCenterOffsetY] = useState(0)



  // Distance calculation helper function
  const calculateDistance = (x: number, y: number, method: string): number => {
    switch (method) {
      case 'cartesian-x': return Math.abs(x)
      case 'cartesian-y': return Math.abs(y)
      case 'radial': 
      default: return Math.sqrt(x * x + y * y)
      
      // Classic Metrics
      case 'manhattan': return Math.abs(x) + Math.abs(y)
      case 'chebyshev': return Math.max(Math.abs(x), Math.abs(y))
      case 'minkowski-3': return Math.pow(Math.pow(Math.abs(x), 3) + Math.pow(Math.abs(y), 3), 1/3)
      
      // Geometric
      case 'hexagonal': {
        const dx = Math.abs(x)
        const dy = Math.abs(y)
        return Math.max(dx, dy, (dx + dy) / 2)
      }
      case 'triangular': return Math.abs(x) + Math.abs(y) + Math.abs(x + y)
      case 'spiral': return Math.sqrt(x * x + y * y) + Math.atan2(y, x) * 10
      case 'cross': return Math.min(Math.abs(x), Math.abs(y))
      
      // Wave-based
      case 'sine-wave': return Math.abs(Math.sin(x * 0.1)) + Math.abs(Math.sin(y * 0.1))
      case 'ripple': return Math.abs(Math.sin(Math.sqrt(x * x + y * y) * 0.1)) * 100
      case 'interference': return Math.abs(Math.sin(x * 0.1) * Math.sin(y * 0.1)) * 100
      
      // Exotic
      case 'hyperbolic': return Math.abs(x * y) * 0.01
      case 'polar-rose': {
        const r = Math.sqrt(x * x + y * y)
        const theta = Math.atan2(y, x)
        const k = 4 // 4-petal rose
        return r * Math.abs(Math.cos(k * theta))
      }
      case 'lemniscate': {
        const a = 50 // scale factor
        return Math.sqrt((x * x + y * y) * (x * x + y * y) - 2 * a * a * (x * x - y * y))
      }
      case 'logarithmic': return Math.log(Math.sqrt(x * x + y * y) + 1) * 50
    }
  }

  // Process fractal pattern using Pipeline F
  const processPattern = () => {
    if (!canvasRef.current || isProcessing) return
    
    setIsProcessing(true)
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    
    console.log(`🔧 Processing Merzbow pattern: ${width}×${height}`)

    // Dummy curve data
    const dummyCurve = {
      'curve-data': Array.from({ length: 256 }, (_, i) => i),
      'curve-width': 256
    }

    // Create image data for full canvas dimensions
    const imageData = ctx.createImageData(width, height)
    const data = imageData.data

    // Check for effective angular distortion
    const effectiveAngularEnabled = angularEnabled && (angularFrequency !== 0 || angularAmplitude !== 0 || angularOffset !== 0)

    // Process each pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4

        // Convert to world coordinates
        const worldX = (x - width / 2) + centerOffsetX
        const worldY = (y - height / 2) + centerOffsetY

        try {
          // Pipeline F processing
          const trueDistance = calculateDistance(worldX, worldY, distanceCalc)

          // Virtual centers via coordinate modulus
          let processedX = worldX
          let processedY = worldY

          if (distanceModulus > 0) {
            processedX = ((worldX % distanceModulus) + distanceModulus) % distanceModulus - distanceModulus/2
            processedY = ((worldY % distanceModulus) + distanceModulus) % distanceModulus - distanceModulus/2
          }

          // Fractal distortion (coordinates) - FIRST
          if (fractalEnabled) {
            const scale1X = Math.sin(processedX * fractalScale1) * fractalStrength * 0.3
            const scale1Y = Math.cos(processedY * fractalScale1) * fractalStrength * 0.3
            
            const scale2X = Math.sin(processedX * fractalScale2) * fractalStrength * 0.2
            const scale2Y = Math.cos(processedY * fractalScale2) * fractalStrength * 0.2
            
            const scale3X = Math.sin(processedX * fractalScale3) * fractalStrength * 0.1
            const scale3Y = Math.cos(processedY * fractalScale3) * fractalStrength * 0.1
            
            processedX += scale1X + scale2X + scale3X
            processedY += scale1Y + scale2Y + scale3Y
          }

          // Angular distortion (coordinates) - AFTER fractal
          if (effectiveAngularEnabled) {
            const angle = Math.atan2(processedY, processedX) + (angularOffset * Math.PI / 180.0)
            const distortedAngle = angle + Math.sin(angle * angularFrequency) * angularAmplitude * 0.01
            const currentDistance = Math.sqrt(processedX * processedX + processedY * processedY)
            processedX = currentDistance * Math.cos(distortedAngle)
            processedY = currentDistance * Math.sin(distortedAngle)
          }

          // Calculate final distance
          const baseDistance = calculateDistance(processedX, processedY, distanceCalc)
          let finalDistance = baseDistance

          // Fractal distortion (distance) - FIRST
          if (fractalEnabled) {
            const distScale1 = Math.sin(finalDistance * fractalScale1) * fractalStrength * 0.3
            const distScale2 = Math.cos(finalDistance * fractalScale2) * fractalStrength * 0.2
            const distScale3 = Math.sin(finalDistance * fractalScale3) * fractalStrength * 0.1
            finalDistance += distScale1 + distScale2 + distScale3
          }

          // Angular distortion (distance) - AFTER fractal
          if (effectiveAngularEnabled) {
            const angle = Math.atan2(processedY, processedX) + (angularOffset * Math.PI / 180.0)
            const angularDistortion = Math.sin(angle * angularFrequency) * angularAmplitude
            finalDistance += angularDistortion
          }

          // Apply curve scaling and calculate index position
          const scaledFinalDistance = finalDistance * curveScaling
          const indexPosition = Math.floor(Math.abs(scaledFinalDistance)) % dummyCurve['curve-width']
          let curveValue = dummyCurve['curve-data'][indexPosition]

          // Apply checkerboard pattern
          if (checkerboardEnabled) {
            const checkerboardDistance = calculateDistance(worldX, worldY, distanceCalc)
            const stepFromCenter = Math.floor(checkerboardDistance / checkerboardSteps)
            if (stepFromCenter % 2 === 1) {
              curveValue = 255 - curveValue
            }
          }

          // Set pixel color
          const color = Math.floor(curveValue)
          data[index + 0] = color // R
          data[index + 1] = color // G
          data[index + 2] = color // B
          data[index + 3] = 255   // A

        } catch (error) {
          // Red for errors
          data[index + 0] = 255
          data[index + 1] = 0
          data[index + 2] = 0
          data[index + 3] = 255
        }
      }
    }

    // Draw at full resolution directly
    ctx.putImageData(imageData, 0, 0)

    setIsProcessing(false)
    console.log('✅ Merzbow pattern complete')
  }

  // Auto-update when parameters change
  useEffect(() => {
    const timer = setTimeout(() => {
      processPattern()
    }, 100)
    return () => clearTimeout(timer)
  }, [angularEnabled, angularFrequency, angularAmplitude, angularOffset, 
      fractalEnabled, fractalScale1, fractalScale2, fractalScale3, fractalStrength,
      distanceCalc, distanceModulus, curveScaling, checkerboardEnabled, checkerboardSteps,
      centerOffsetX, centerOffsetY])

  // Initialize canvas to fill viewport with any aspect ratio
  useEffect(() => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    
    const updateCanvasSize = () => {
      // Use full available viewport dimensions
      canvas.width = window.innerWidth - 300  // Full width minus controls panel
      canvas.height = window.innerHeight - 85  // Full height minus header
      
      console.log(`📐 Canvas: ${canvas.width}×${canvas.height} (aspect: ${(canvas.width/canvas.height).toFixed(2)})`)
      processPattern()
    }
    
    updateCanvasSize()
    
    window.addEventListener('resize', updateCanvasSize)
    return () => window.removeEventListener('resize', updateCanvasSize)
  }, [])

  // Mouse hover scaling functionality (only with Option key or right mouse)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMouseDragging) return // Don't scale during drag
    
    // Only scale if Option key is held down
    if (!e.altKey) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseY = e.clientY - rect.top
    const canvasHeight = rect.height

    // Calculate scaling factor based on mouse Y position
    // Top of canvas (y=0) = 0.0001 scaling, Bottom (y=height) = 1.0 scaling
    const scaleFactor = 0.0001 + (mouseY / canvasHeight) * (1.0 - 0.0001)
    setCurveScaling(scaleFactor)
  }

  // Mouse interaction functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    
    // Right mouse button (button 2) for scaling
    if (e.button === 2) {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const startY = e.clientY - rect.top
      const canvasHeight = rect.height
      const startScaling = curveScaling

      const handleScaleMove = (e: MouseEvent) => {
        const currentY = e.clientY - rect.top
        const deltaY = currentY - startY
        
        // Scale based on vertical mouse movement
        const scaleFactor = startScaling + (deltaY / canvasHeight) * 0.5
        const clampedScale = Math.max(0.0001, Math.min(1.0, scaleFactor))
        setCurveScaling(clampedScale)
      }

      const handleScaleUp = () => {
        document.removeEventListener('mousemove', handleScaleMove)
        document.removeEventListener('mouseup', handleScaleUp)
      }

      document.addEventListener('mousemove', handleScaleMove)
      document.addEventListener('mouseup', handleScaleUp)
      return
    }

    // Left mouse button for dragging
    setIsMouseDragging(true)
    
    const startX = e.clientX
    const startY = e.clientY
    const startOffsetX = centerOffsetX
    const startOffsetY = centerOffsetY

    const handleMouseDragMove = (e: MouseEvent) => {
      const dragX = e.clientX - startX
      const dragY = e.clientY - startY
      const scaleFactor = 2

      setCenterOffsetX(startOffsetX - (dragX * scaleFactor))
      setCenterOffsetY(startOffsetY - (dragY * scaleFactor))
    }

    const handleMouseUp = () => {
      setIsMouseDragging(false)
      document.removeEventListener('mousemove', handleMouseDragMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseDragMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Handle right-click context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault() // Prevent context menu when right-clicking for scaling
  }

  return (
    <div className="app">
      <Header title="Cnidaria" currentPage="Merzbow" />
      
      <div className="main-content">
        <div className="merzbow-controls">
          <label>
            <input type="checkbox" checked={angularEnabled} onChange={(e) => setAngularEnabled(e.target.checked)} />
            Angular Distortion
          </label>
          
          <label>
            <input type="checkbox" checked={fractalEnabled} onChange={(e) => setFractalEnabled(e.target.checked)} />
            Fractal Distortion
          </label>
          
          <label>
            <input type="checkbox" checked={checkerboardEnabled} onChange={(e) => setCheckerboardEnabled(e.target.checked)} />
            Checkerboard Pattern
          </label>

          <label>Distance Calculation:</label>
          <select value={distanceCalc} onChange={(e) => setDistanceCalc(e.target.value)}>
            <option value="radial">Radial</option>
            <option value="cartesian-x">Cartesian X</option>
            <option value="cartesian-y">Cartesian Y</option>
            <option value="manhattan">Manhattan</option>
            <option value="chebyshev">Chebyshev</option>
            <option value="hexagonal">Hexagonal</option>
            <option value="spiral">Spiral</option>
            <option value="ripple">Ripple</option>
            <option value="hyperbolic">Hyperbolic</option>
          </select>

          <label>Distance Modulus:</label>
          <input type="number" value={distanceModulus} min="0" max="500" step="10" onChange={(e) => setDistanceModulus(parseFloat(e.target.value) || 0)} />

          <label>Curve Scaling: {curveScaling.toFixed(4)}</label>
          <input type="range" value={curveScaling} min="0.0001" max="1.0" step="0.0001" onChange={(e) => setCurveScaling(parseFloat(e.target.value))} />

          <label>Checkerboard Steps:</label>
          <input type="number" value={checkerboardSteps} min="1" max="200" step="1" onChange={(e) => setCheckerboardSteps(parseFloat(e.target.value) || 50)} />

          <label>Angular Frequency: {angularFrequency}</label>
          <input type="range" value={angularFrequency} min="0" max="64" step="0.1" onChange={(e) => setAngularFrequency(parseFloat(e.target.value))} />
          
          <label>Angular Amplitude: {angularAmplitude}</label>
          <input type="range" value={angularAmplitude} min="0" max="100" step="1" onChange={(e) => setAngularAmplitude(parseFloat(e.target.value))} />
          
          <label>Angular Offset: {angularOffset}°</label>
          <input type="range" value={angularOffset} min="0" max="360" step="5" onChange={(e) => setAngularOffset(parseFloat(e.target.value))} />

          <label>Fractal Scale 1: {fractalScale1}</label>
          <input type="range" value={fractalScale1} min="0.001" max="0.1" step="0.001" onChange={(e) => setFractalScale1(parseFloat(e.target.value))} />
          
          <label>Fractal Scale 2: {fractalScale2}</label>
          <input type="range" value={fractalScale2} min="0.01" max="0.5" step="0.01" onChange={(e) => setFractalScale2(parseFloat(e.target.value))} />
          
          <label>Fractal Scale 3: {fractalScale3}</label>
          <input type="range" value={fractalScale3} min="0.05" max="1.0" step="0.05" onChange={(e) => setFractalScale3(parseFloat(e.target.value))} />
          
          <label>Fractal Strength: {fractalStrength}</label>
          <input type="range" value={fractalStrength} min="1" max="50" step="1" onChange={(e) => setFractalStrength(parseFloat(e.target.value))} />
        </div>

        <canvas 
          ref={canvasRef}
          className="merzbow-viewport"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onContextMenu={handleContextMenu}
        />
      </div>
    </div>
  )
}

export default Merzbow
