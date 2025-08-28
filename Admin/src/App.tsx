import { useState, useEffect, useRef } from 'react'
import './App.css'

interface Curve {
  id: string
  "curve-name": string
  "curve-description": string
  "curve-type": string
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

  const canvasRef = useRef<HTMLDivElement>(null)
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load curves from API
  const loadCurves = async () => {
    setIsLoadingCurves(true)
    console.log('Loading curves from API...')
    try {
      const response = await fetch('https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api/api/curves')
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
        }
      } else {
        console.error('API request failed:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Failed to load curves:', error)
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
    
    const { topLeft, bottomRight } = getVisibleCoordinates()
    
    try {
      // Call GetCurveIndexValue API with visible coordinates
      const response = await fetch(
        `https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api/api/curves/${curve.id}/process?x=${topLeft[0]}&y=${topLeft[1]}&x2=${bottomRight[0]}&y2=${bottomRight[1]}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        
        // The API returns data in format: {"curve-name": [results]}
        const curveName = Object.keys(data)[0]
        const results = data[curveName]
        
        if (results && Array.isArray(results)) {
          // Process results and update cell colors
          const newCellColors = new Map(cellColors)
          
          results.forEach((result: ProcessCoordinateResponse) => {
            const coordKey = `${result["cell-coordinates"][0]}_${result["cell-coordinates"][1]}`
            const hue = Math.max(0, Math.min(255, result["index-value"]))
            const color = `hsl(${hue}, 70%, 50%)`
            newCellColors.set(coordKey, color)
          })
          
          setCellColors(newCellColors)
        }
      }
    } catch (error) {
      console.error('Failed to process curve coordinates:', error)
    }
  }

  // Handle curve selection
  const handleCurveSelect = (curve: Curve) => {
    setSelectedCurve(curve)
    processCurveCoordinates(curve)
  }

  // Handle new visible cells (when scrolling/resizing) with debounced delay
  useEffect(() => {
    if (selectedCurve) {
      // Clear any existing timeout
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current)
      }
      
      // Set a new timeout to wait for user to stop zooming/moving
      processingTimeoutRef.current = setTimeout(() => {
        processCurveCoordinates(selectedCurve)
      }, 500) // Wait 500ms after last change
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current)
      }
    }
  }, [cellSize, gridDimensions])

  // Generate grid cells with colors
  const renderGridCells = () => {
    if (!canvasRef.current) return null
    
    const rect = canvasRef.current.getBoundingClientRect()
    const width = Math.ceil(rect.width / cellSize)
    const height = Math.ceil(rect.height / cellSize)
    
    const cells = []
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Calculate actual coordinates relative to center (0,0)
        const coordX = x - Math.floor(width / 2)
        const coordY = Math.floor(height / 2) - y  // Invert Y so positive is up
        const coordKey = `${coordX}_${coordY}`
        
        // Get color for this coordinate - default to transparent if none
        const color = cellColors.get(coordKey) || 'transparent'
        
        cells.push(
          <div
            key={coordKey}
            className="grid-cell"
            style={{
              position: 'absolute',
              left: x * (cellSize + 1),
              top: y * (cellSize + 1),
              width: cellSize,
              height: cellSize,
              backgroundColor: color,
              border: 'none',
              boxSizing: 'border-box'
            }}
          />
        )
      }
    }
    
    return cells
  }

  return (
    <div className="App">
      {/* Fixed Height Header - 150px */}
      <header className="app-header">
        <h1>New Cnidaria Admin Tool</h1>
      </header>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Fixed Width Left Pane - 400px */}
        <aside className="left-pane">
          <h2>Control Panel</h2>
          <div className="control-section">
            <h3>Curve Management</h3>
            <button className="control-btn">Create Curve</button>
            <div className="curve-selector">
              <label htmlFor="curve-select">Load Curve:</label>
              <select
                id="curve-select"
                value={selectedCurve?.id || ''}
                onChange={(e) => {
                  const curve = curves.find(c => c.id === e.target.value)
                  if (curve) handleCurveSelect(curve)
                }}
                disabled={isLoadingCurves}
              >
                <option value="">Select a curve...</option>
                {curves.map(curve => (
                  <option key={curve.id} value={curve.id}>
                    {curve["curve-name"]}
                  </option>
                ))}
              </select>
              {isLoadingCurves && <span>Loading curves...</span>}
            </div>
            <button className="control-btn">Save Curve</button>
          </div>
          <div className="control-section">
            <h3>Grid Settings</h3>
            <div className="grid-info">
              <span>Cell Size: {cellSize}×{cellSize}px</span>
              <span>Grid: {gridDimensions.width}×{gridDimensions.height}</span>
              {selectedCurve && (
                <span>Loaded: {selectedCurve["curve-name"]}</span>
              )}
              <span>Total Curves: {curves.length}</span>
            </div>
            <div className="grid-controls">
              <button 
                className="control-btn"
                onClick={() => setCellSize(30)}
              >
                Reset to 30×30
              </button>
              <button 
                className="control-btn"
                onClick={() => setCellSize(prev => Math.max(8, prev - 2))}
              >
                Decrease Size
              </button>
              <button 
                className="control-btn"
                onClick={() => setCellSize(prev => Math.min(150, prev + 2))}
              >
                Increase Size
              </button>
            </div>
          </div>

        </aside>

        {/* Liquid Canvas - Takes remaining space */}
        <main className="canvas-area">
          <div className="canvas-container" ref={canvasRef}>
            <div className="grid-overlay">
              {/* Grid cells with colors */}
              {renderGridCells()}
              

            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
