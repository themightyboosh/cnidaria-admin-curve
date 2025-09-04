import React, { useEffect, useRef, useState } from 'react'
import Header from '../../components/Header'
import { apiUrl } from '../../config/environments'
import './Merzbow.css'

interface DistortionControl {
  id: string
  name: string
  'angular-distortion': boolean
  'fractal-distortion': boolean
  'checkerboard-pattern': boolean
  'distance-calculation': string
  'distance-modulus': number
  'curve-scaling': number
  'checkerboard-steps': number
  'angular-frequency': number
  'angular-amplitude': number
  'angular-offset': number
  'fractal-scale-1': number
  'fractal-scale-2': number
  'fractal-scale-3': number
  'fractal-strength': number
  updatedAt?: string
}

interface Curve {
  id: string
  name: string
  'curve-data': number[]
  'curve-width': number
}

interface Palette {
  id: string
  name: string
  hexColors: string[]
  colorCount: number
  hasAlpha: boolean
  updatedAt?: string
}

// Curve Link Button Component
const CurveLinkButton: React.FC<{
  curveName: string
  distortionControlId: string
  onLink: () => void
}> = ({ curveName, distortionControlId, onLink }) => {
  const [isLinked, setIsLinked] = useState<boolean | null>(null)
  const [isLinking, setIsLinking] = useState(false)

  useEffect(() => {
    const checkLink = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/distortion-control-links/curve/${curveName}`)
        if (response.ok) {
          const data = await response.json()
          const linked = data.success && data.data.hasLink && data.data.distortionControl?.id === distortionControlId
          setIsLinked(linked)
        }
      } catch (error) {
        console.error('Failed to check link:', error)
        setIsLinked(false)
      }
    }
    checkLink()
  }, [curveName, distortionControlId])

  const handleLink = async () => {
    setIsLinking(true)
    try {
      await onLink()
      setIsLinked(true)
    } catch (error) {
      console.error('Failed to link:', error)
    } finally {
      setIsLinking(false)
    }
  }

  if (isLinked === null) return <div>Checking link...</div>
  if (isLinked) return null // Hide when linked

  return (
    <button onClick={handleLink} disabled={isLinking} className="link-button yellow">
      {isLinking ? '🔗 Linking...' : `🔗 Link to ${curveName}`}
    </button>
  )
}

// Palette Link Button Component
const PaletteLinkButton: React.FC<{
  distortionControlId: string
  paletteId: string
  onLink: () => void
}> = ({ distortionControlId, paletteId, onLink }) => {
  const [isLinked, setIsLinked] = useState<boolean | null>(null)
  const [isLinking, setIsLinking] = useState(false)

  useEffect(() => {
    const checkLink = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/distortion-palette-links/distortion/${distortionControlId}`)
        if (response.ok) {
          const data = await response.json()
          const linked = data.success && data.data.hasLink && data.data.link?.paletteId === paletteId
          setIsLinked(linked)
        }
      } catch (error) {
        console.error('Failed to check palette link:', error)
        setIsLinked(false)
      }
    }
    checkLink()
  }, [distortionControlId, paletteId])

  const handleLink = async () => {
    setIsLinking(true)
    try {
      await onLink()
      setIsLinked(true)
    } catch (error) {
      console.error('Failed to link palette:', error)
    } finally {
      setIsLinking(false)
    }
  }

  if (isLinked === null) return <div>Checking palette link...</div>
  if (isLinked) return null // Hide when linked

  return (
    <button onClick={handleLink} disabled={isLinking} className="link-button yellow">
      {isLinking ? '🎨 Linking...' : '🎨 Link Palette'}
    </button>
  )
}

const Merzbow: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Database state
  const [availableDistortionControls, setAvailableDistortionControls] = useState<DistortionControl[]>([])
  const [selectedDistortionControl, setSelectedDistortionControl] = useState<DistortionControl | null>(null)
  const [availableCurves, setAvailableCurves] = useState<Curve[]>([])
  const [selectedCurve, setSelectedCurve] = useState<Curve | null>(null)
  const [availablePalettes, setAvailablePalettes] = useState<Palette[]>([])
  const [selectedPalette, setSelectedPalette] = useState<Palette | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [lastActiveCurve, setLastActiveCurve] = useState<string | null>(null)

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

  // Load available distortion controls from API
  const loadDistortionControls = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api/distortion-controls/firebase`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const controls = data.data.distortionControls
          setAvailableDistortionControls(controls)
          
          // Load most recently modified if no last active curve
          if (controls.length > 0) {
            const mostRecent = controls.sort((a: DistortionControl, b: DistortionControl) => 
              new Date(b.updatedAt || '').getTime() - new Date(a.updatedAt || '').getTime()
            )[0]
            
            if (!lastActiveCurve) {
              loadDistortionControl(mostRecent)
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load distortion controls:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load available curves from API
  const loadCurves = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/curves`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setAvailableCurves(data.data.curves || [])
        }
      }
    } catch (error) {
      console.error('Failed to load curves:', error)
    }
  }

  // Load available palettes from API
  const loadPalettes = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/palettes`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const palettes = data.data.palettes
          setAvailablePalettes(palettes)
          
          // Load default grayscale palette if available
          const grayscale = palettes.find((p: Palette) => p.name.toLowerCase().includes('grayscale'))
          if (grayscale && !selectedPalette) {
            setSelectedPalette(grayscale)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load palettes:', error)
    }
  }

  // Load distortion control into UI
  const loadDistortionControl = (control: DistortionControl) => {
    setSelectedDistortionControl(control)
    setAngularEnabled(control['angular-distortion'])
    setFractalEnabled(control['fractal-distortion'])
    setCheckerboardEnabled(control['checkerboard-pattern'])
    setDistanceCalc(control['distance-calculation'])
    setDistanceModulus(control['distance-modulus'])
    setCurveScaling(control['curve-scaling'])
    setCheckerboardSteps(control['checkerboard-steps'])
    setAngularFrequency(control['angular-frequency'])
    setAngularAmplitude(control['angular-amplitude'])
    setAngularOffset(control['angular-offset'])
    setFractalScale1(control['fractal-scale-1'])
    setFractalScale2(control['fractal-scale-2'])
    setFractalScale3(control['fractal-scale-3'])
    setFractalStrength(control['fractal-strength'])
    setHasUnsavedChanges(false)
  }

  // Save current distortion control
  const saveDistortionControl = async () => {
    if (!selectedDistortionControl) return
    
    const updateData = {
      name: selectedDistortionControl.name,
      'angular-distortion': angularEnabled,
      'fractal-distortion': fractalEnabled,
      'checkerboard-pattern': checkerboardEnabled,
      'distance-calculation': distanceCalc,
      'distance-modulus': distanceModulus,
      'curve-scaling': curveScaling,
      'checkerboard-steps': checkerboardSteps,
      'angular-frequency': angularFrequency,
      'angular-amplitude': angularAmplitude,
      'angular-offset': angularOffset,
      'fractal-scale-1': fractalScale1,
      'fractal-scale-2': fractalScale2,
      'fractal-scale-3': fractalScale3,
      'fractal-strength': fractalStrength
    }

    try {
      const response = await fetch(`${apiUrl}/api/distortion-controls/${selectedDistortionControl.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        setHasUnsavedChanges(false)
        console.log('✅ Distortion control saved successfully')
        // Reload to get updated timestamp
        await loadDistortionControls()
      }
    } catch (error) {
      console.error('Failed to save distortion control:', error)
    }
  }

  // Check if curve is linked to current distortion control
  const checkCurveLink = async (curveName: string) => {
    if (!selectedDistortionControl) return false
    
    try {
      const response = await fetch(`${apiUrl}/api/distortion-control-links/curve/${curveName}`)
      if (response.ok) {
        const data = await response.json()
        return data.success && data.data.hasLink && data.data.distortionControl?.id === selectedDistortionControl.id
      }
    } catch (error) {
      console.error('Failed to check curve link:', error)
    }
    return false
  }

  // Link curve to current distortion control
  const linkCurveToDistortionControl = async (curveName: string) => {
    if (!selectedDistortionControl) return
    
    try {
      const response = await fetch(`${apiUrl}/api/distortion-control-links/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          curveId: curveName, 
          distortionControlId: selectedDistortionControl.id 
        })
      })

      if (response.ok) {
        console.log(`✅ Linked ${curveName} to ${selectedDistortionControl.name}`)
      }
    } catch (error) {
      console.error('Failed to link curve:', error)
    }
  }

  // Link palette to current distortion control
  const linkPaletteToDistortionControl = async () => {
    if (!selectedDistortionControl || !selectedPalette) return
    
    try {
      const response = await fetch(`${apiUrl}/api/distortion-palette-links/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          distortionControlId: selectedDistortionControl.id,
          paletteId: selectedPalette.id 
        })
      })

      if (response.ok) {
        console.log(`🎨 Linked palette ${selectedPalette.name} to distortion control ${selectedDistortionControl.name}`)
      }
    } catch (error) {
      console.error('Failed to link palette:', error)
    }
  }



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

    // Use selected curve data or default ramp
    const curveData = selectedCurve ? {
      'curve-data': selectedCurve['curve-data'],
      'curve-width': selectedCurve['curve-width']
    } : {
      'curve-data': Array.from({ length: 256 }, (_, i) => i), // 0-255 ramp default
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
          const indexPosition = Math.floor(Math.abs(scaledFinalDistance)) % curveData['curve-width']
          let curveValue = curveData['curve-data'][indexPosition]

          // Apply checkerboard pattern
          if (checkerboardEnabled) {
            const checkerboardDistance = calculateDistance(worldX, worldY, distanceCalc)
            const stepFromCenter = Math.floor(checkerboardDistance / checkerboardSteps)
            if (stepFromCenter % 2 === 1) {
              curveValue = 255 - curveValue
            }
          }

          // Set pixel color using palette or default grayscale
          if (selectedPalette && selectedPalette.hexColors) {
            const paletteIndex = Math.floor(curveValue)
            const hexColor = selectedPalette.hexColors[paletteIndex] || '#000000'
            
            // Parse hex color (supports both #RRGGBB and #RRGGBBAA)
            const r = parseInt(hexColor.slice(1, 3), 16)
            const g = parseInt(hexColor.slice(3, 5), 16)
            const b = parseInt(hexColor.slice(5, 7), 16)
            const a = hexColor.length === 9 ? parseInt(hexColor.slice(7, 9), 16) : 255
            
            data[index + 0] = r
            data[index + 1] = g
            data[index + 2] = b
            data[index + 3] = a
          } else {
            // Default grayscale
            const color = Math.floor(curveValue)
            data[index + 0] = color // R
            data[index + 1] = color // G
            data[index + 2] = color // B
            data[index + 3] = 255   // A
          }

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

  // Load data on mount
  useEffect(() => {
    loadDistortionControls()
    loadCurves()
    loadPalettes()
  }, [])

  // Mark as unsaved when parameters change
  useEffect(() => {
    if (selectedDistortionControl) {
      setHasUnsavedChanges(true)
    }
  }, [angularEnabled, angularFrequency, angularAmplitude, angularOffset, 
      fractalEnabled, fractalScale1, fractalScale2, fractalScale3, fractalStrength,
      distanceCalc, distanceModulus, curveScaling, checkerboardEnabled, checkerboardSteps])

  // Auto-update when parameters change
  useEffect(() => {
    const timer = setTimeout(() => {
      processPattern()
    }, 100)
    return () => clearTimeout(timer)
  }, [angularEnabled, angularFrequency, angularAmplitude, angularOffset, 
      fractalEnabled, fractalScale1, fractalScale2, fractalScale3, fractalStrength,
      distanceCalc, distanceModulus, curveScaling, checkerboardEnabled, checkerboardSteps,
      centerOffsetX, centerOffsetY, selectedCurve, selectedPalette])

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

  // Export canvas in various formats
  const exportImage = (format: string, quality: number = 1.0) => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    const link = document.createElement('a')
    const timestamp = Date.now()
    
    let mimeType: string
    let extension: string
    
    switch (format) {
      case 'png':
        mimeType = 'image/png'
        extension = 'png'
        quality = 1.0 // PNG doesn't use quality parameter
        break
      case 'jpeg':
        mimeType = 'image/jpeg'
        extension = 'jpg'
        break
      case 'webp':
        mimeType = 'image/webp'
        extension = 'webp'
        break
      default:
        mimeType = 'image/png'
        extension = 'png'
        quality = 1.0
    }
    
    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        link.href = url
        link.download = `merzbow-pattern-${timestamp}.${extension}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        console.log(`📸 Exported as ${format.toUpperCase()} (${(blob.size / 1024).toFixed(1)}KB)`)
      }
    }, mimeType, quality)
  }

  // Export as PNG with transparency
  const exportAsPNG = () => exportImage('png')
  
  // Export as high-quality JPEG
  const exportAsJPEG = () => exportImage('jpeg', 0.95)
  
  // Export as WebP
  const exportAsWebP = () => exportImage('webp', 0.9)

  return (
    <div className="app">
      <Header title="Cnidaria" currentPage="Merzbow" />
      
      <div className="main-content">
        <div className="merzbow-controls">
          {/* Stacked Dropdowns Section */}
          <div className="dropdown-section">
            <div className="dropdown-row">
              <label>Distortion Profile:</label>
              <select 
                className="compact-select"
                value={selectedDistortionControl?.id || ''} 
                onChange={(e) => {
                  const control = availableDistortionControls.find(c => c.id === e.target.value)
                  if (control) loadDistortionControl(control)
                }}
                disabled={isLoading}
              >
                <option value="">Select...</option>
                {availableDistortionControls.map(control => (
                  <option key={control.id} value={control.id}>
                    {control.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="dropdown-row">
              <label>Curve Data:</label>
              <select 
                className="compact-select"
                value={selectedCurve?.name || ''} 
                onChange={(e) => {
                  const curve = availableCurves.find(c => c.name === e.target.value)
                  setSelectedCurve(curve || null)
                }}
              >
                <option value="">Default (0-255 ramp)</option>
                {availableCurves.map(curve => (
                  <option key={curve.name} value={curve.name}>
                    {curve.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="dropdown-row">
              <label>Color Palette:</label>
              <select 
                className="compact-select"
                value={selectedPalette?.id || ''} 
                onChange={(e) => {
                  const palette = availablePalettes.find(p => p.id === e.target.value)
                  setSelectedPalette(palette || null)
                }}
              >
                <option value="">Default (Grayscale)</option>
                {availablePalettes.map(palette => (
                  <option key={palette.id} value={palette.id}>
                    {palette.name}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Name Editor */}
          {selectedDistortionControl && (
            <div className="name-section">
              <label>Name:</label>
              <input 
                type="text" 
                value={selectedDistortionControl.name} 
                onChange={(e) => {
                  setSelectedDistortionControl({
                    ...selectedDistortionControl,
                    name: e.target.value
                  })
                  setHasUnsavedChanges(true)
                }}
              />
            </div>
          )}

          {/* Distance Calculation */}
          <div className="dropdown-row">
            <label>Distance Calculation:</label>
            <select className="compact-select" value={distanceCalc} onChange={(e) => setDistanceCalc(e.target.value)}>
              <option value="radial">radial</option>
              <option value="cartesian-x">cartesian-x</option>
              <option value="cartesian-y">cartesian-y</option>
              <option value="manhattan">manhattan</option>
              <option value="chebyshev">chebyshev</option>
              <option value="minkowski-3">minkowski-3</option>
              <option value="hexagonal">hexagonal</option>
              <option value="triangular">triangular</option>
              <option value="spiral">spiral</option>
              <option value="cross">cross</option>
              <option value="sine-wave">sine-wave</option>
              <option value="ripple">ripple</option>
              <option value="interference">interference</option>
              <option value="hyperbolic">hyperbolic</option>
              <option value="polar-rose">polar-rose</option>
              <option value="lemniscate">lemniscate</option>
              <option value="logarithmic">logarithmic</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            {hasUnsavedChanges && (
              <button onClick={saveDistortionControl} className="save-button">
                💾 Save Changes
              </button>
            )}
            <div className="export-dropdown">
              <button onClick={exportAsPNG} className="export-button">
                📸 PNG
              </button>
              <button onClick={exportAsJPEG} className="export-button secondary">
                📸 JPEG
              </button>
              <button onClick={exportAsWebP} className="export-button secondary">
                📸 WebP
              </button>
            </div>
          </div>

          {/* Link Buttons */}
          <div className="link-section">
            {selectedCurve && selectedDistortionControl && (
              <CurveLinkButton 
                curveName={selectedCurve.name}
                distortionControlId={selectedDistortionControl.id}
                onLink={() => linkCurveToDistortionControl(selectedCurve.name)}
              />
            )}
            {selectedPalette && selectedDistortionControl && (
              <PaletteLinkButton 
                distortionControlId={selectedDistortionControl.id}
                paletteId={selectedPalette.id}
                onLink={() => linkPaletteToDistortionControl()}
              />
            )}
          </div>

          <hr style={{ margin: '20px 0', border: '1px solid #444' }} />

          {/* Feature Toggles */}
          <div className="toggle-section">
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
          </div>

          {/* Core Parameters */}
          <div className="param-section">
            <div className="param-row">
              <label>Distance Modulus:</label>
              <input type="number" value={distanceModulus} min="0" max="500" step="10" onChange={(e) => setDistanceModulus(parseFloat(e.target.value) || 0)} />
            </div>

            <div className="param-row">
              <label>Curve Scaling: {curveScaling.toFixed(4)}</label>
              <input type="range" value={curveScaling} min="0.0001" max="1.0" step="0.0001" onChange={(e) => setCurveScaling(parseFloat(e.target.value))} />
            </div>

            <div className="param-row">
              <label>Checkerboard Steps:</label>
              <input type="number" value={checkerboardSteps} min="1" max="200" step="1" onChange={(e) => setCheckerboardSteps(parseFloat(e.target.value) || 50)} />
            </div>
          </div>

          {/* Angular Controls */}
          <div className="angular-section">
            <h4>Angular Distortion</h4>
            <div className="param-row">
              <label>Frequency: {angularFrequency}</label>
              <input type="range" value={angularFrequency} min="0" max="64" step="0.1" onChange={(e) => setAngularFrequency(parseFloat(e.target.value))} />
            </div>
            
            <div className="param-row">
              <label>Amplitude: {angularAmplitude}</label>
              <input type="range" value={angularAmplitude} min="0" max="100" step="1" onChange={(e) => setAngularAmplitude(parseFloat(e.target.value))} />
            </div>
            
            <div className="param-row">
              <label>Offset: {angularOffset}°</label>
              <input type="range" value={angularOffset} min="0" max="360" step="5" onChange={(e) => setAngularOffset(parseFloat(e.target.value))} />
            </div>
          </div>

          {/* Fractal Controls */}
          <div className="fractal-section">
            <h4>Fractal Distortion</h4>
            <div className="param-row">
              <label>Scale 1: {fractalScale1}</label>
              <input type="range" value={fractalScale1} min="0.001" max="0.1" step="0.001" onChange={(e) => setFractalScale1(parseFloat(e.target.value))} />
            </div>
            
            <div className="param-row">
              <label>Scale 2: {fractalScale2}</label>
              <input type="range" value={fractalScale2} min="0.01" max="0.5" step="0.01" onChange={(e) => setFractalScale2(parseFloat(e.target.value))} />
            </div>
            
            <div className="param-row">
              <label>Scale 3: {fractalScale3}</label>
              <input type="range" value={fractalScale3} min="0.05" max="1.0" step="0.05" onChange={(e) => setFractalScale3(parseFloat(e.target.value))} />
            </div>
            
            <div className="param-row">
              <label>Strength: {fractalStrength}</label>
              <input type="range" value={fractalStrength} min="1" max="50" step="1" onChange={(e) => setFractalStrength(parseFloat(e.target.value))} />
            </div>
          </div>
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
