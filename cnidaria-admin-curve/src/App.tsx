import { useState, useEffect, useRef } from 'react'
import { apiUrl } from './config/environments'
import './App.css'

interface Curve {
  id: string
  "curve-name": string
  "curve-description": string
  "curve-type": string
  "curve-width": number
  "curve-data": number[]
}

interface ProcessCoordinateResponse {
  "cell-coordinates": [number, number]
  coordKey: string
  "index-position": number
  "index-value": number
}

function App() {
  const [cellSize, setCellSize] = useState(30)
  const [isOptionPressed, setIsOptionPressed] = useState(false)
  const [curves, setCurves] = useState<Curve[]>([])
  const [selectedCurve, setSelectedCurve] = useState<Curve | null>(null)
  const [cellColors, setCellColors] = useState<Map<string, string>>(new Map())
  const [isLoadingCurves, setIsLoadingCurves] = useState(false)
  const [isProcessingCoordinates, setIsProcessingCoordinates] = useState(false)
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load curves from API
  const loadCurves = async () => {
    setIsLoadingCurves(true)
    setError(null)
    console.log('Loading curves from API...')
    try {
      const response = await fetch(`${apiUrl}/api/curves`)
      console.log('API Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('API Response data:', data)
        
        if (data.success) {
          // Fix: API returns data.curves, not just curves
          const curvesData = data.data?.curves || data.curves || []
          console.log('Setting curves:', curvesData)
          setCurves(curvesData)
        } else {
          console.error('API returned success: false:', data)
          setError('Failed to load curves: API returned error')
        }
      } else {
        console.error('API request failed:', response.status, response.statusText)
        setError(`Failed to load curves: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to load curves:', error)
      setError('Failed to load curves: Network error')
    } finally {
      setIsLoadingCurves(false)
      console.log('Finished loading curves')
    }
  }

  // Load curves on component mount
  useEffect(() => {
    loadCurves()
  }, [])

  // Handle keyboard events for Option key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || e.key === 'Option') {
        setIsOptionPressed(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || e.key === 'Option') {
        setIsOptionPressed(false)
      }
    }

    const handleWheel = (e: WheelEvent) => {
      if (isOptionPressed) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -2 : 2
        setCellSize(prevSize => {
          const newSize = prevSize + delta
          return Math.max(8, Math.min(150, newSize))
        })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    document.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('wheel', handleWheel)
    }
  }, [isOptionPressed])

  // Calculate grid dimensions and visible coordinates
  const [gridDimensions, setGridDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const updateGridDimensions = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const width = Math.ceil(rect.width / cellSize)
        const height = Math.ceil(rect.height / cellSize)
        
        setGridDimensions({ width, height })
      }
    }

    updateGridDimensions()
    window.addEventListener('resize', updateGridDimensions)
    
    return () => window.removeEventListener('resize', updateGridDimensions)
  }, [cellSize])

  // Calculate visible grid coordinates (top-left to bottom-right)
  const getVisibleCoordinates = () => {
    if (!canvasRef.current) return { topLeft: [0, 0], bottomRight: [0, 0] }
    
    const rect = canvasRef.current.getBoundingClientRect()
    const width = Math.ceil(rect.width / cellSize)
    const height = Math.ceil(rect.height / cellSize)
    
    // Calculate center
    const centerX = Math.floor(width / 2)
    const centerY = Math.floor(height / 2)
    
    // Calculate visible bounds relative to center
    const topLeft = [0 - centerX, centerY - 0]
    const bottomRight = [width - 1 - centerX, centerY - (height - 1)]
    
    return { topLeft, bottomRight }
  }

  // Process coordinates for a curve
  const processCurveCoordinates = async (curve: Curve) => {
    if (!curve) return
    
    setIsProcessingCoordinates(true)
    setError(null)
    setProcessingProgress({ current: 0, total: 0 })
    
    const { topLeft, bottomRight } = getVisibleCoordinates()
    
    try {
      console.log(`Processing coordinates for curve: ${curve["curve-name"]}`)
      console.log(`Grid bounds: (${topLeft[0]}, ${topLeft[1]}) to (${bottomRight[0]}, ${bottomRight[1]})`)
      
      // Call GetCurveIndexValue API with visible coordinates
      const response = await fetch(
        `${apiUrl}/api/curves/${curve.id}/process?x=${topLeft[0]}&y=${topLeft[1]}&x2=${bottomRight[0]}&y2=${bottomRight[1]}`,
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
        console.log('API Response:', data)
        
        // The API returns data in format: {"curve-name": [results]}
        const curveName = Object.keys(data)[0]
        const results = data[curveName]
        
        if (results && Array.isArray(results)) {
          console.log(`Processing ${results.length} coordinate results`)
          
          // Process results and update cell colors
          const newCellColors = new Map(cellColors)
          
          results.forEach((result: ProcessCoordinateResponse, index: number) => {
            const coordKey = `${result["cell-coordinates"][0]}_${result["cell-coordinates"][1]}`
            const hue = Math.max(0, Math.min(255, result["index-value"]))
            const color = `hsl(${hue}, 70%, 50%)`
            newCellColors.set(coordKey, color)
            
            // Update progress
            setProcessingProgress({ current: index + 1, total: results.length })
          })
          
          setCellColors(newCellColors)
          console.log(`Successfully processed ${results.length} coordinates`)
        } else {
          setError('Invalid response format from API')
        }
      } else {
        const errorText = await response.text()
        console.error('API request failed:', response.status, response.statusText, errorText)
        setError(`API request failed: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to process curve coordinates:', error)
      setError('Failed to process coordinates: Network error')
    } finally {
      setIsProcessingCoordinates(false)
      setProcessingProgress({ current: 0, total: 0 })
    }
  }

  // Handle curve selection
  const handleCurveSelect = (curve: Curve) => {
    setSelectedCurve(curve)
    setError(null)
    // Clear existing colors before processing new curve
    setCellColors(new Map())
    processCurveCoordinates(curve)
  }

  // Handle new visible cells (when scrolling/resizing) with debounced delay
  useEffect(() => {
    if (selectedCurve) {
      // Clear any existing timeout
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current)
      }
      
      // Set new timeout for processing coordinates
      processingTimeoutRef.current = setTimeout(() => {
        processCurveCoordinates(selectedCurve)
      }, 500) // 500ms debounce delay
    }
    
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current)
      }
    }
  }, [cellSize, gridDimensions, selectedCurve])

  // Generate random colors for initial grid
  const generateRandomGridColors = () => {
    const newCellColors = new Map<string, string>()
    const { width, height } = gridDimensions
    
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const coordKey = `${x - Math.floor(width / 2)}_${Math.floor(height / 2) - y}`
        const hue = Math.floor(Math.random() * 360)
        const color = `hsl(${hue}, 70%, 50%)`
        newCellColors.set(coordKey, color)
      }
    }
    
    setCellColors(newCellColors)
  }

  // Generate random colors when grid dimensions change
  useEffect(() => {
    if (gridDimensions.width > 0 && gridDimensions.height > 0) {
      generateRandomGridColors()
    }
  }, [gridDimensions])

  // Render grid cells
  const renderGridCells = () => {
    const { width, height } = gridDimensions
    const cells = []
    
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const coordKey = `${x - Math.floor(width / 2)}_${Math.floor(height / 2) - y}`
        const color = cellColors.get(coordKey) || '#333'
        
        cells.push(
          <div
            key={coordKey}
            className="grid-cell"
            style={{
              width: `${cellSize - 1}px`,
              height: `${cellSize - 1}px`,
              backgroundColor: color,
              position: 'absolute',
              left: `${x * cellSize}px`,
              top: `${y * cellSize}px`
            }}
          />
        )
      }
    }
    
    return cells
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1>Admin Curve Tool</h1>
      </header>
      
      <div className="main-content">
        {/* Left Pane */}
        <div className="left-pane">
          <div className="curve-selector">
            <h3>Curve Selection</h3>
            {isLoadingCurves ? (
              <div className="loading">Loading curves...</div>
            ) : (
              <select
                value={selectedCurve?.id || ''}
                onChange={(e) => {
                  const curve = curves.find(c => c.id === e.target.value)
                  if (curve) handleCurveSelect(curve)
                }}
                disabled={curves.length === 0}
              >
                <option value="">Select a curve...</option>
                {curves.map(curve => (
                  <option key={curve.id} value={curve.id}>
                    {curve["curve-name"]}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {selectedCurve && (
            <div className="curve-info">
              <h3>Curve Info</h3>
              <div className="info-item">
                <strong>Type:</strong> {selectedCurve["curve-type"]}
              </div>
              <div className="info-item">
                <strong>Width:</strong> {selectedCurve["curve-width"]}
              </div>
              <div className="info-item">
                <strong>Status:</strong> 
                {isProcessingCoordinates ? (
                  <span className="processing-indicator">
                    <span className="spinner"></span>
                    Processing...
                    {processingProgress.total > 0 && (
                      <span className="progress-text">
                        {processingProgress.current}/{processingProgress.total}
                      </span>
                    )}
                  </span>
                ) : (
                  'Ready'
                )}
              </div>
            </div>
          )}
          
          {error && (
            <div className="error-message">
              <h3>Error</h3>
              <p>{error}</p>
              <button onClick={() => setError(null)}>Dismiss</button>
            </div>
          )}
        </div>
        
        {/* Canvas Area */}
        <div className="canvas-area">
          <div 
            ref={canvasRef}
            className="grid-canvas"
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              backgroundColor: '#000'
            }}
          >
            {renderGridCells()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
