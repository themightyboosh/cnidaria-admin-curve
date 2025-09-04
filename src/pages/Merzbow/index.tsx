import React, { useEffect, useRef, useState } from 'react'
import Header from '../../components/Header'
import { apiUrl } from '../../config/environments'
import { unityShaderGenerator } from '../../utils/unityShaderGenerator'
import { glslShaderGenerator } from '../../utils/glslShaderGenerator'
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
      {isLinking ? 'Linking...' : `Link to ${curveName}`}
    </button>
  )
}

// Palette Link Button Component (Using generic palette-links API)
const PaletteLinkButton: React.FC<{
  distortionControlId: string
  paletteId: string
  paletteName: string
  onLink: () => void
}> = ({ distortionControlId, paletteId, paletteName, onLink }) => {
  const [isLinked, setIsLinked] = useState<boolean | null>(null)
  const [isLinking, setIsLinking] = useState(false)

  useEffect(() => {
    const checkLink = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/palette-links/distortion/${distortionControlId}`)
        if (response.ok) {
          const data = await response.json()
          const linked = data.success && data.data.hasLink && data.data.link?.paletteId === paletteId
          setIsLinked(linked)
        } else {
          setIsLinked(false)
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

  if (isLinked === null) return <div>Checking link...</div>
  if (isLinked) return null // Hide when linked

  return (
    <button onClick={handleLink} disabled={isLinking} className="link-button">
      {isLinking ? 'Linking...' : `Link ${paletteName}`}
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

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    profile: true,
    links: true,
    settings: true,
    angular: false,
    fractal: false,
    export: false
  })

  // Toggle section visibility
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

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

  // 3D Preview state
  const [showPreview, setShowPreview] = useState(false)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

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
              await loadDistortionControl(mostRecent)
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

  // Load distortion control into UI and find its linked curve
  const loadDistortionControl = async (control: DistortionControl) => {
    console.log(`🎛️ Loading distortion control: ${control.name}`)
    
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

    // Find and load linked curve
    try {
      console.log(`🔍 Looking for curves linked to distortion control: ${control.id}`)
      
      // We need to find which curve is linked to this distortion control
      // Check all curves to see which one links to this distortion control
      for (const curve of availableCurves) {
        try {
          const response = await fetch(`${apiUrl}/api/distortion-control-links/curve/${curve.name}`)
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.data.hasLink && data.data.distortionControl?.id === control.id) {
              console.log(`✅ Found linked curve: ${curve.name} → ${control.name}`)
              setSelectedCurve(curve)
              return
            }
          }
        } catch (error) {
          console.warn(`Failed to check link for curve ${curve.name}:`, error)
        }
      }
      
      console.log(`⚠️ No linked curve found for distortion control: ${control.name}`)
      // Don't clear the current curve selection if no link found
      
    } catch (error) {
      console.error('Failed to load linked curve:', error)
    }
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

  // Link palette to current distortion control using generic API
  const linkPaletteToDistortionControl = async () => {
    if (!selectedDistortionControl || !selectedPalette) return
    
    try {
      const response = await fetch(`${apiUrl}/api/palette-links/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          objectType: 'distortion',
          objectId: selectedDistortionControl.id,
          paletteId: selectedPalette.id 
        })
      })

      if (response.ok) {
        console.log(`🎨 Linked palette ${selectedPalette.name} to distortion control ${selectedDistortionControl.name}`)
      } else {
        console.error('Failed to link palette:', response.status)
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

          // Set pixel color using palette or default grayscale (8-bit, no alpha)
          if (selectedPalette && selectedPalette.hexColors) {
            const paletteIndex = Math.floor(curveValue) & 0xFF // Force 8-bit index
            const hexColor = selectedPalette.hexColors[paletteIndex] || '#000000'
            
            // Parse hex color and force 8-bit values (ignore alpha)
            const r = parseInt(hexColor.slice(1, 3), 16) & 0xFF
            const g = parseInt(hexColor.slice(3, 5), 16) & 0xFF
            const b = parseInt(hexColor.slice(5, 7), 16) & 0xFF
            
            data[index + 0] = r
            data[index + 1] = g
            data[index + 2] = b
            data[index + 3] = 255 // Force opaque
          } else {
            // Default grayscale (8-bit)
            const color = Math.floor(curveValue) & 0xFF
            data[index + 0] = color // R
            data[index + 1] = color // G
            data[index + 2] = color // B
            data[index + 3] = 255   // Force opaque
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

  // Helper function to convert string to kebab-case
  const toKebabCase = (str: string) => {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
  }

  // Generate filename based on distortion profile and curve
  const generateFileName = (isTile: boolean = false) => {
    const distortionName = selectedDistortionControl?.name || 'default-distortion'
    const curveName = selectedCurve?.name || 'default-curve'
    
    const baseName = `${toKebabCase(distortionName)}-${toKebabCase(curveName)}`
    const suffix = isTile ? '-tile' : ''
    
    return `${baseName}${suffix}.png`
  }

  // Export PNG with smart tiling for distance modulus
  const exportAsPNG = () => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    let exportCanvas = canvas
    let fileName = generateFileName()
    
    // If distance modulus > 0, create a tile
    if (distanceModulus > 0) {
      const tileSize = distanceModulus
      const tileCanvas = document.createElement('canvas')
      tileCanvas.width = tileSize
      tileCanvas.height = tileSize
      const tileCtx = tileCanvas.getContext('2d')
      
      if (tileCtx) {
        // Find the center of the original canvas
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2
        
        // Extract a square tile from the center
        const sourceX = centerX - tileSize / 2
        const sourceY = centerY - tileSize / 2
        
        tileCtx.drawImage(
          canvas,
          sourceX, sourceY, tileSize, tileSize, // source
          0, 0, tileSize, tileSize // destination
        )
        
        exportCanvas = tileCanvas
        fileName = generateFileName(true)
        
        console.log(`🔲 Creating ${tileSize}×${tileSize} tile from pattern center`)
      }
    }
    
    // Export the canvas (original or tile)
    exportCanvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        
        const sizeKB = (blob.size / 1024).toFixed(1)
        const dimensions = `${exportCanvas.width}×${exportCanvas.height}`
        console.log(`📸 Exported PNG: ${fileName} (${dimensions}, ${sizeKB}KB)`)
      }
    }, 'image/png', 1.0)
  }

  // Export JPEG with smart tiling for distance modulus
  const exportAsJPEG = () => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    let exportCanvas = canvas
    let fileName = generateFileName().replace('.png', '.jpg')
    
    // If distance modulus > 0, create a tile
    if (distanceModulus > 0) {
      const tileSize = distanceModulus
      const tileCanvas = document.createElement('canvas')
      tileCanvas.width = tileSize
      tileCanvas.height = tileSize
      const tileCtx = tileCanvas.getContext('2d')
      
      if (tileCtx) {
        // Fill with white background for JPEG
        tileCtx.fillStyle = '#FFFFFF'
        tileCtx.fillRect(0, 0, tileSize, tileSize)
        
        // Find the center of the original canvas
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2
        
        // Extract a square tile from the center
        const sourceX = centerX - tileSize / 2
        const sourceY = centerY - tileSize / 2
        
        tileCtx.drawImage(
          canvas,
          sourceX, sourceY, tileSize, tileSize, // source
          0, 0, tileSize, tileSize // destination
        )
        
        exportCanvas = tileCanvas
        fileName = generateFileName(true).replace('.png', '.jpg')
        
        console.log(`🔲 Creating ${tileSize}×${tileSize} JPEG tile from pattern center`)
      }
    }
    
    // Export the canvas (original or tile) as JPEG
    exportCanvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        
        const sizeKB = (blob.size / 1024).toFixed(1)
        const dimensions = `${exportCanvas.width}×${exportCanvas.height}`
        console.log(`📸 Exported JPEG: ${fileName} (${dimensions}, ${sizeKB}KB)`)
      }
    }, 'image/jpeg', 0.95)
  }

  // Export foundational curve-shader (GLSL only)
  const exportCurveShader = () => {
    console.log('🔴 DEBUG: Export button clicked - SIMPLE VERSION')
    
    if (!selectedDistortionControl || !selectedCurve) {
      alert('Please select both a distortion control and curve before exporting')
      return
    }

    try {
      console.log('🔴 DEBUG: Creating simple test download...')
      
      // Simple test content
      const testContent = `// Test GLSL Export
// Distortion: ${selectedDistortionControl.name}
// Curve: ${selectedCurve.name}
// Timestamp: ${new Date().toISOString()}

#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

void main() {
    vec2 coord = v_uv - 0.5;
    float dist = length(coord);
    fragColor = vec4(vec3(dist), 1.0);
}`
      
      const blob = new Blob([testContent], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      
      link.href = url
      link.download = `test-shader-${Date.now()}.glsl`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      console.log('🔴 DEBUG: Test download completed')
      alert('✅ Test shader exported')

    } catch (error) {
      console.error('❌ Export failed:', error)
      alert(`❌ Export failed: ${error}`)
    }
  }

  // 3D Preview with rotating cube (simplified)
  const start3DPreview = () => {
    console.log('🔴 DEBUG: 3D Preview button clicked - SIMPLE VERSION')
    
    if (!selectedDistortionControl || !selectedCurve) {
      alert('Please select both a distortion control and curve for 3D preview')
      return
    }

    console.log('🎮 Starting 3D preview for:', selectedDistortionControl.name, selectedCurve.name)
    alert(`🎮 3D Preview: ${selectedDistortionControl.name} + ${selectedCurve.name}\n\n(Full 3D implementation coming soon)`)
  }

  const init3DPreview = () => {
    const canvas = previewCanvasRef.current
    if (!canvas || !selectedDistortionControl || !selectedCurve) return

    const gl = canvas.getContext('webgl2')
    if (!gl) {
      alert('WebGL2 not supported for 3D preview')
      return
    }

    console.log('🎮 Starting 3D curve-shader preview')

    // Generate the GLSL fragment shader
    const shaderPackage = glslShaderGenerator.generateWebGLPackage({
      shaderName: `Preview_${selectedDistortionControl.name}`,
      distortionControl: selectedDistortionControl,
      curve: selectedCurve,
      palette: selectedPalette,
      target: 'webgl',
      includeComments: false
    })

    // Simple vertex shader for cube
    const vertexShader = `#version 300 es
precision highp float;

in vec3 a_position;
in vec2 a_uv;

uniform mat4 u_mvpMatrix;

out vec2 v_uv;

void main() {
    v_uv = a_uv;
    gl_Position = u_mvpMatrix * vec4(a_position, 1.0);
}`

    // Compile shaders
    const vs = createShader(gl, gl.VERTEX_SHADER, vertexShader)
    const fs = createShader(gl, gl.FRAGMENT_SHADER, shaderPackage.fragmentShader)
    
    if (!vs || !fs) {
      alert('Failed to compile shaders for 3D preview')
      return
    }

    const program = createProgram(gl, vs, fs)
    if (!program) {
      alert('Failed to create shader program for 3D preview')
      return
    }

    // Create cube geometry
    const cubeVertices = new Float32Array([
      // Front face
      -1, -1,  1,  0, 0,
       1, -1,  1,  1, 0,
       1,  1,  1,  1, 1,
      -1,  1,  1,  0, 1,
      // Back face
      -1, -1, -1,  1, 0,
      -1,  1, -1,  1, 1,
       1,  1, -1,  0, 1,
       1, -1, -1,  0, 0,
      // Top face
      -1,  1, -1,  0, 1,
      -1,  1,  1,  0, 0,
       1,  1,  1,  1, 0,
       1,  1, -1,  1, 1,
      // Bottom face
      -1, -1, -1,  0, 0,
       1, -1, -1,  1, 0,
       1, -1,  1,  1, 1,
      -1, -1,  1,  0, 1,
      // Right face
       1, -1, -1,  1, 0,
       1,  1, -1,  1, 1,
       1,  1,  1,  0, 1,
       1, -1,  1,  0, 0,
      // Left face
      -1, -1, -1,  0, 0,
      -1, -1,  1,  1, 0,
      -1,  1,  1,  1, 1,
      -1,  1, -1,  0, 1
    ])

    const cubeIndices = new Uint16Array([
      0,  1,  2,    0,  2,  3,    // front
      4,  5,  6,    4,  6,  7,    // back
      8,  9,  10,   8,  10, 11,   // top
      12, 13, 14,   12, 14, 15,   // bottom
      16, 17, 18,   16, 18, 19,   // right
      20, 21, 22,   20, 22, 23    // left
    ])

    // Create buffers
    const vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW)

    const indexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW)

    // Set up attributes
    const positionLocation = gl.getAttribLocation(program, 'a_position')
    const uvLocation = gl.getAttribLocation(program, 'a_uv')

    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 5 * 4, 0)

    gl.enableVertexAttribArray(uvLocation)
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 5 * 4, 3 * 4)

    // Get uniform locations
    const mvpLocation = gl.getUniformLocation(program, 'u_mvpMatrix')
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution')
    const offsetLocation = gl.getUniformLocation(program, 'u_offset')
    const scaleLocation = gl.getUniformLocation(program, 'u_scale')

    // Set distortion control uniforms
    setDistortionUniforms(gl, program, selectedDistortionControl)

    let rotation = 0

    const render = () => {
      if (!gl || !canvas) return

      rotation += 0.02

      // Clear and setup
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.enable(gl.DEPTH_TEST)
      gl.useProgram(program)

      // Create MVP matrix
      const aspect = canvas.width / canvas.height
      const perspective = createPerspectiveMatrix(45, aspect, 0.1, 100)
      const view = createLookAtMatrix([0, 0, 5], [0, 0, 0], [0, 1, 0])
      const model = createRotationMatrix(rotation, rotation * 0.7, 0)
      const mvp = multiplyMatrices(perspective, multiplyMatrices(view, model))

      // Set uniforms
      gl.uniformMatrix4fv(mvpLocation, false, mvp)
      gl.uniform2f(resolutionLocation, 512, 512)
      gl.uniform2f(offsetLocation, centerOffsetX, centerOffsetY)
      gl.uniform1f(scaleLocation, curveScaling)

      // Draw cube
      gl.drawElements(gl.TRIANGLES, cubeIndices.length, gl.UNSIGNED_SHORT, 0)

      if (showPreview) {
        requestAnimationFrame(render)
      }
    }

    render()
  }

  // Helper functions for 3D math
  const createPerspectiveMatrix = (fov: number, aspect: number, near: number, far: number): Float32Array => {
    const f = Math.tan(Math.PI * 0.5 - 0.5 * fov * Math.PI / 180)
    const rangeInv = 1.0 / (near - far)
    
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInv, -1,
      0, 0, near * far * rangeInv * 2, 0
    ])
  }

  const createLookAtMatrix = (eye: number[], target: number[], up: number[]): Float32Array => {
    const zAxis = normalize(subtract(eye, target))
    const xAxis = normalize(cross(up, zAxis))
    const yAxis = normalize(cross(zAxis, xAxis))

    return new Float32Array([
      xAxis[0], xAxis[1], xAxis[2], 0,
      yAxis[0], yAxis[1], yAxis[2], 0,
      zAxis[0], zAxis[1], zAxis[2], 0,
      eye[0], eye[1], eye[2], 1
    ])
  }

  const createRotationMatrix = (x: number, y: number, z: number): Float32Array => {
    const cx = Math.cos(x), sx = Math.sin(x)
    const cy = Math.cos(y), sy = Math.sin(y)
    const cz = Math.cos(z), sz = Math.sin(z)

    return new Float32Array([
      cy * cz, -cy * sz, sy, 0,
      cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy, 0,
      sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy, 0,
      0, 0, 0, 1
    ])
  }

  const multiplyMatrices = (a: Float32Array, b: Float32Array): Float32Array => {
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

  const normalize = (v: number[]): number[] => {
    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    return length > 0 ? [v[0] / length, v[1] / length, v[2] / length] : [0, 0, 0]
  }

  const subtract = (a: number[], b: number[]): number[] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const cross = (a: number[], b: number[]): number[] => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ]

  // WebGL helper functions
  const createShader = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type)
    if (!shader) return null
    
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      return null
    }
    
    return shader
  }

  const createProgram = (gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null => {
    const program = gl.createProgram()
    if (!program) return null
    
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      return null
    }
    
    return program
  }

  const setDistortionUniforms = (gl: WebGL2RenderingContext, program: WebGLProgram, distortion: DistortionControl) => {
    const uniforms = [
      ['u_angularEnabled', distortion['angular-distortion'] ? 1.0 : 0.0],
      ['u_fractalEnabled', distortion['fractal-distortion'] ? 1.0 : 0.0],
      ['u_checkerboardEnabled', distortion['checkerboard-pattern'] ? 1.0 : 0.0],
      ['u_distanceModulus', distortion['distance-modulus']],
      ['u_curveScaling', distortion['curve-scaling']],
      ['u_checkerboardSteps', distortion['checkerboard-steps']],
      ['u_angularFrequency', distortion['angular-frequency']],
      ['u_angularAmplitude', distortion['angular-amplitude']],
      ['u_angularOffset', distortion['angular-offset']],
      ['u_fractalScale1', distortion['fractal-scale-1']],
      ['u_fractalScale2', distortion['fractal-scale-2']],
      ['u_fractalScale3', distortion['fractal-scale-3']],
      ['u_fractalStrength', distortion['fractal-strength']],
      ['u_time', Date.now() / 1000]
    ]

    console.log('🔧 Setting uniforms for 3D preview:')
    uniforms.forEach(([name, value]) => {
      const location = gl.getUniformLocation(program, name)
      if (location !== null) {
        gl.uniform1f(location, value as number)
        console.log(`  ✅ ${name}: ${value}`)
      } else {
        console.warn(`  ❌ Uniform '${name}' not found in shader (optimized out?)`)
      }
    })
  }

  // Validate GLSL shader before export
  const validateGLSL = (fragmentShader: string, vertexShader: string): { valid: boolean; errors: string[] } => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) {
      return { valid: false, errors: ['WebGL2 not available for validation'] }
    }

    const errors: string[] = []

    try {
      // Validate vertex shader
      const vs = gl.createShader(gl.VERTEX_SHADER)
      if (vs) {
        gl.shaderSource(vs, vertexShader)
        gl.compileShader(vs)
        
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
          const error = gl.getShaderInfoLog(vs)
          errors.push(`Vertex Shader Error: ${error}`)
        }
      }

      // Validate fragment shader
      const fs = gl.createShader(gl.FRAGMENT_SHADER)
      if (fs) {
        gl.shaderSource(fs, fragmentShader)
        gl.compileShader(fs)
        
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
          const error = gl.getShaderInfoLog(fs)
          errors.push(`Fragment Shader Error: ${error}`)
        }
      }

      // Try to link program
      if (vs && fs && errors.length === 0) {
        const program = gl.createProgram()
        if (program) {
          gl.attachShader(program, vs)
          gl.attachShader(program, fs)
          gl.linkProgram(program)
          
          if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(program)
            errors.push(`Program Link Error: ${error}`)
          }
          
          gl.deleteProgram(program)
        }
      }

      // Cleanup
      if (vs) gl.deleteShader(vs)
      if (fs) gl.deleteShader(fs)

    } catch (error) {
      errors.push(`Validation Exception: ${error}`)
    }

    return { valid: errors.length === 0, errors }
  }

  return (
    <div className="app">
      <Header title="Cnidaria" currentPage="Merzbow" />
      
      <div className="main-content">
        <div className="left-pane">
          {/* Distortion Profile Panel */}
          <div className="info-section">
            <h3 className="collapsible-header" onClick={() => toggleSection('profile')}>
              <span className="toggle-icon">{expandedSections.profile ? '▼' : '▶'}</span>
              Distortion Profile
            </h3>
            {expandedSections.profile && (
              <div className="section-content">
                <div className="form-group">
                  <label>Distortion Profile:</label>
                  <select 
                    value={selectedDistortionControl?.id || ''} 
                    onChange={async (e) => {
                      const control = availableDistortionControls.find(c => c.id === e.target.value)
                      if (control) await loadDistortionControl(control)
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


                {/* Save Button */}
                {hasUnsavedChanges && (
                  <div className="form-group">
                    <button onClick={saveDistortionControl} className="save-button full-width">
                      Save Changes
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Distortion Links Panel */}
          <div className="info-section">
            <h3 className="collapsible-header" onClick={() => toggleSection('links')}>
              <span className="toggle-icon">{expandedSections.links ? '▼' : '▶'}</span>
              Distortion Links
            </h3>
            {expandedSections.links && (
              <div className="section-content">
                <div className="form-group">
                  <label>Curve:</label>
                  <select 
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

                <div className="form-group">
                  <label>Color Palette:</label>
                  <select 
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

                {/* Link Buttons */}
                <div className="form-group" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
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
                      paletteName={selectedPalette.name}
                      onLink={() => linkPaletteToDistortionControl()}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Distortion Settings Panel */}
          <div className="info-section">
            <h3 className="collapsible-header" onClick={() => toggleSection('settings')}>
              <span className="toggle-icon">{expandedSections.settings ? '▼' : '▶'}</span>
              Distortion Settings
            </h3>
            {expandedSections.settings && (
              <div className="section-content">
                {/* Name Editor */}
                {selectedDistortionControl && (
                  <div className="form-group">
                    <label>Distortion Name:</label>
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

                <div className="form-group">
                  <label className="checkbox-label">
                    Angular Distortion
                    <input type="checkbox" checked={angularEnabled} onChange={(e) => setAngularEnabled(e.target.checked)} />
                  </label>
                </div>
                
                <div className="form-group">
                  <label className="checkbox-label">
                    Fractal Distortion
                    <input type="checkbox" checked={fractalEnabled} onChange={(e) => setFractalEnabled(e.target.checked)} />
                  </label>
                </div>
                
                <div className="form-group">
                  <label className="checkbox-label">
                    Checkerboard Pattern
                    <input type="checkbox" checked={checkerboardEnabled} onChange={(e) => setCheckerboardEnabled(e.target.checked)} />
                  </label>
                </div>

                <div className="form-group">
                  <label>Distance Calculation:</label>
                  <select value={distanceCalc} onChange={(e) => setDistanceCalc(e.target.value)}>
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

                <div className="form-group">
                  <label>Checkerboard Steps:</label>
                  <input type="number" value={checkerboardSteps} min="1" max="200" step="1" onChange={(e) => setCheckerboardSteps(parseFloat(e.target.value) || 50)} />
                </div>

                <div className="form-group">
                  <label>Distance Modulus:</label>
                  <input type="number" value={distanceModulus} min="0" max="500" step="10" onChange={(e) => setDistanceModulus(parseFloat(e.target.value) || 0)} />
                </div>

                <div className="form-group">
                  <label>Curve Scaling: {curveScaling.toFixed(4)}</label>
                  <input type="range" value={curveScaling} min="0.0001" max="1.0" step="0.0001" onChange={(e) => setCurveScaling(parseFloat(e.target.value))} />
                </div>
              </div>
            )}
          </div>

          {/* Angular Settings Panel */}
          <div className="info-section">
            <h3 className="collapsible-header" onClick={() => toggleSection('angular')}>
              <span className="toggle-icon">{expandedSections.angular ? '▼' : '▶'}</span>
              Angular Settings
            </h3>
            {expandedSections.angular && (
              <div className="section-content">
                <div className="form-group">
                  <label>Frequency: {angularFrequency}</label>
                  <input type="range" value={angularFrequency} min="0" max="64" step="0.1" onChange={(e) => setAngularFrequency(parseFloat(e.target.value))} />
                </div>
                
                <div className="form-group">
                  <label>Amplitude: {angularAmplitude}</label>
                  <input type="range" value={angularAmplitude} min="0" max="100" step="1" onChange={(e) => setAngularAmplitude(parseFloat(e.target.value))} />
                </div>
                
                <div className="form-group">
                  <label>Offset: {angularOffset}°</label>
                  <input type="range" value={angularOffset} min="0" max="360" step="5" onChange={(e) => setAngularOffset(parseFloat(e.target.value))} />
                </div>
              </div>
            )}
          </div>

          {/* Fractal Settings Panel */}
          <div className="info-section">
            <h3 className="collapsible-header" onClick={() => toggleSection('fractal')}>
              <span className="toggle-icon">{expandedSections.fractal ? '▼' : '▶'}</span>
              Fractal Settings
            </h3>
            {expandedSections.fractal && (
              <div className="section-content">
                <div className="form-group">
                  <label>Scale 1: {fractalScale1}</label>
                  <input type="range" value={fractalScale1} min="0.001" max="0.1" step="0.001" onChange={(e) => setFractalScale1(parseFloat(e.target.value))} />
                </div>
                
                <div className="form-group">
                  <label>Scale 2: {fractalScale2}</label>
                  <input type="range" value={fractalScale2} min="0.01" max="0.5" step="0.01" onChange={(e) => setFractalScale2(parseFloat(e.target.value))} />
                </div>
                
                <div className="form-group">
                  <label>Scale 3: {fractalScale3}</label>
                  <input type="range" value={fractalScale3} min="0.05" max="1.0" step="0.05" onChange={(e) => setFractalScale3(parseFloat(e.target.value))} />
                </div>
                
                <div className="form-group">
                  <label>Strength: {fractalStrength}</label>
                  <input type="range" value={fractalStrength} min="1" max="50" step="1" onChange={(e) => setFractalStrength(parseFloat(e.target.value))} />
                </div>
              </div>
            )}
          </div>

          {/* Export Options Panel */}
          <div className="info-section">
            <h3 className="collapsible-header" onClick={() => toggleSection('export')}>
              <span className="toggle-icon">{expandedSections.export ? '▼' : '▶'}</span>
              Export Options
            </h3>
            {expandedSections.export && (
              <div className="section-content">
                <div className="form-group">
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <button onClick={exportAsPNG} className="export-button">
                      Export PNG
                    </button>
                    <button onClick={exportAsJPEG} className="export-button secondary">
                      Export JPEG
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={() => {
                        console.log('🎨 Exporting GLSL curve-shader...')
                        
                        if (!selectedDistortionControl || !selectedCurve) {
                          alert('Please select both a distortion control and curve')
                          return
                        }

                        try {
                          // Create simple GLSL shader content
                          const shaderContent = `// ===== FOUNDATIONAL CURVE-SHADER =====
// Generated from Merzbow Pipeline F
// Distortion: ${selectedDistortionControl.name}
// Curve: ${selectedCurve.name}
// Palette: ${selectedPalette?.name || 'Default Grayscale'}

#version 300 es
precision highp float;

// Distortion control parameters
uniform float u_distanceModulus;
uniform float u_curveScaling;
uniform float u_angularFrequency;
uniform float u_fractalScale1;

in vec2 v_uv;
out vec4 fragColor;

float calculateDistance(vec2 coord) {
    return sqrt(coord.x * coord.x + coord.y * coord.y);
}

void main() {
    vec2 worldCoord = (v_uv - 0.5) * 1000.0;
    float dist = calculateDistance(worldCoord);
    float pattern = sin(dist * u_curveScaling) * 0.5 + 0.5;
    fragColor = vec4(vec3(pattern), 1.0);
}

// ===== USAGE =====
// Apply this shader to any mesh for procedural texturing
// Adjust uniforms for real-time parameter control
`
                          
                          const blob = new Blob([shaderContent], { type: 'text/plain' })
                          const url = URL.createObjectURL(blob)
                          const link = document.createElement('a')
                          
                          const fileName = `curve-shader-${selectedDistortionControl.name.toLowerCase().replace(/\s+/g, '-')}.glsl`
                          link.href = url
                          link.download = fileName
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                          URL.revokeObjectURL(url)

                          console.log(`✅ Exported: ${fileName}`)
                          alert(`✅ Exported curve-shader: ${fileName}`)
                          
                        } catch (error) {
                          console.error('Export error:', error)
                          alert(`❌ Export failed: ${error}`)
                        }
                      }} 
                      className="export-button unity"
                      disabled={!selectedDistortionControl || !selectedCurve}
                    >
                      Export GLSL
                    </button>
                    <button 
                      onClick={() => {
                        console.log('🎮 3D Preview clicked')
                        if (!selectedDistortionControl || !selectedCurve) {
                          alert('Please select both a distortion control and curve')
                          return
                        }
                        alert(`🎮 3D Preview: ${selectedDistortionControl.name}\n\nThis will show your curve-shader on a rotating 3D cube\n\n(Implementation in progress)`)
                      }} 
                      className="export-button webgl"
                      disabled={!selectedDistortionControl || !selectedCurve}
                    >
                      3D Preview
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                      console.log('🟢 EMERGENCY TEST BUTTON CLICKED')
                      alert('EMERGENCY BUTTON WORKS!')
                    }}
                    style={{ 
                      width: '100%', 
                      backgroundColor: '#00ff00', 
                      color: '#000000',
                      padding: '15px',
                      border: '3px solid #ffffff',
                      borderRadius: '6px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      marginTop: '10px'
                    }}
                  >
                    🚨 EMERGENCY TEST BUTTON 🚨
                  </button>
                  
                  {/* Debug Info */}
                  <div style={{ 
                    marginTop: '10px', 
                    padding: '10px', 
                    background: '#444', 
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#ccc'
                  }}>
                    <div>Distortion Control: {selectedDistortionControl ? `✅ ${selectedDistortionControl.name}` : '❌ None'}</div>
                    <div>Curve: {selectedCurve ? `✅ ${selectedCurve.name}` : '❌ None'}</div>
                    <div>Buttons Disabled: {(!selectedDistortionControl || !selectedCurve) ? '🔴 YES' : '🟢 NO'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <canvas 
          ref={canvasRef}
          className="merzbow-viewport"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onContextMenu={handleContextMenu}
        />

        {/* 3D Preview Modal */}
        {showPreview && (
          <div className="preview-modal" onClick={() => setShowPreview(false)}>
            <div className="preview-content" onClick={(e) => e.stopPropagation()}>
              <div className="preview-header">
                <h3>3D Curve-Shader Preview</h3>
                <button onClick={() => setShowPreview(false)} className="close-button">×</button>
              </div>
              <canvas 
                ref={previewCanvasRef}
                width={600}
                height={400}
                className="preview-canvas"
              />
              <div className="preview-info">
                <p>Pattern: <strong>{selectedDistortionControl?.name}</strong></p>
                <p>Curve: <strong>{selectedCurve?.name}</strong></p>
                <p>Palette: <strong>{selectedPalette?.name || 'Default Grayscale'}</strong></p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Merzbow
