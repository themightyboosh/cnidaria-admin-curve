import { useState, useEffect, useRef } from 'react'
import './App.css'
import Header from './components/Header'

interface Curve {
  id: string
  "curve-name": string
  "curve-description": string
  "curve-tags"?: string[]
  "curve-type": string
  "curve-width": number
  "curve-data": number[]
  "curve-index-scaling"?: number
  "coordinate-noise-strength"?: number
  "coordinate-noise-scale"?: number
  "coordinate-noise-seed"?: number
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
  const [editingCurve, setEditingCurve] = useState<Curve | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    selection: true,
    properties: true,
    view: true,
    settings: true
  })
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [newTagInput, setNewTagInput] = useState('')

  const canvasRef = useRef<HTMLDivElement>(null)
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load curves from API
  const loadCurves = async () => {
    setIsLoadingCurves(true)
    setError(null)
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
          
          // Extract all unique tags from curves
          const allTags = new Set<string>()
          curvesData.forEach((curve: Curve) => {
            if (curve["curve-tags"]) {
              curve["curve-tags"].forEach(tag => allTags.add(tag))
            }
          })
          setAvailableTags(Array.from(allTags).sort())
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
        `https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api/api/curves/${curve.id}/process?x=${topLeft[0]}&y=${topLeft[1]}&x2=${bottomRight[0]}&y2=${bottomRight[1]}`,
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
    setEditingCurve({ ...curve }) // Create a copy for editing
    setHasUnsavedChanges(false)
    setError(null)
    // Clear existing colors before processing new curve
    setCellColors(new Map())
    processCurveCoordinates(curve)
  }

  // Handle field changes
  const handleFieldChange = (field: string, value: any) => {
    if (!editingCurve) return
    
    setEditingCurve(prev => ({
      ...prev!,
      [field]: value
    }))
    setHasUnsavedChanges(true)
  }

  // Toggle section expansion
  const toggleSection = (sectionName: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }))
  }

  // Add tag to curve
  const addTagToCurve = (tag: string) => {
    if (!editingCurve) return
    
    const currentTags = editingCurve["curve-tags"] || []
    if (!currentTags.includes(tag)) {
      handleFieldChange("curve-tags", [...currentTags, tag])
    }
  }

  // Remove tag from curve
  const removeTagFromCurve = (tagToRemove: string) => {
    if (!editingCurve) return
    
    const currentTags = editingCurve["curve-tags"] || []
    const updatedTags = currentTags.filter(tag => tag !== tagToRemove)
    handleFieldChange("curve-tags", updatedTags)
  }

  // Add new tag to system
  const addNewTag = () => {
    if (newTagInput.trim() && !availableTags.includes(newTagInput.trim())) {
      const newTag = newTagInput.trim().toLowerCase().replace(/\s+/g, '-')
      setAvailableTags(prev => [...prev, newTag])
      addTagToCurve(newTag)
      setNewTagInput('')
    }
  }

  // Save curve changes
  const saveCurveChanges = async () => {
    if (!editingCurve || !selectedCurve) return
    
    setIsSaving(true)
    setError(null)
    
    try {
      const response = await fetch(
        `https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api/api/curves/${selectedCurve.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editingCurve)
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Update the selected curve with new data
          setSelectedCurve(editingCurve)
          setHasUnsavedChanges(false)
          
          // Clear namespace cache and redraw grid
          setCellColors(new Map())
          if (editingCurve) {
            processCurveCoordinates(editingCurve)
          }
          
          console.log('Curve updated successfully')
        } else {
          setError('Failed to update curve: API returned error')
        }
      } else {
        const errorText = await response.text()
        console.error('API request failed:', response.status, response.statusText, errorText)
        setError(`Failed to update curve: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to update curve:', error)
      setError('Failed to update curve: Network error')
    } finally {
      setIsSaving(false)
    }
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

  // Set dark gray colors for initial grid
  const setDefaultGridColors = () => {
    const newCellColors = new Map<string, string>()
    const { width, height } = gridDimensions
    
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const coordKey = `${x - Math.floor(width / 2)}_${Math.floor(height / 2) - y}`
        newCellColors.set(coordKey, '#333333') // Dark gray
      }
    }
    
    setCellColors(newCellColors)
  }

  // Set default colors when grid dimensions change
  useEffect(() => {
    if (gridDimensions.width > 0 && gridDimensions.height > 0) {
      setDefaultGridColors()
    }
  }, [gridDimensions])

  // Render grid cells
  const renderGridCells = () => {
    const { width, height } = gridDimensions
    const cells = []
    
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const coordKey = `${x - Math.floor(width / 2)}_${Math.floor(height / 2) - y}`
        const color = cellColors.get(coordKey) || '#333333'
        
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
      <Header title="Cnidaria Admin Curves" subtitle="Mathematical Terrain Management" />
      
      <div className="main-content">
        {/* Left Pane */}
        <div className="left-pane">
          {/* Curve Selection */}
          <div className="info-section">
            <h3 className="collapsible-header" onClick={() => toggleSection('selection')}>
              <span className="toggle-icon">{expandedSections.selection ? '▼' : '▶'}</span>
              Curve Selection
            </h3>
            {expandedSections.selection && (
              <div className="section-content">
                {isLoadingCurves ? (
                  <div className="loading">Loading curves...</div>
                ) : (
                  <div className="form-group">
                    <label>Select Curve:</label>
                    <select
                      value={selectedCurve?.id || ''}
                      onChange={(e) => {
                        const curve = curves.find(c => c.id === e.target.value)
                        if (curve) handleCurveSelect(curve)
                      }}
                      disabled={curves.length === 0}
                      title="Choose a curve to edit and visualize"
                    >
                      <option value="">Select a curve...</option>
                      {curves.map(curve => (
                        <option key={curve.id} value={curve.id}>
                          {curve["curve-name"]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {selectedCurve && editingCurve && (
            <>
              {/* Curve Properties - Read-only info */}
              <div className="info-section">
                <h3 className="collapsible-header" onClick={() => toggleSection('properties')}>
                  <span className="toggle-icon">{expandedSections.properties ? '▼' : '▶'}</span>
                  Curve Properties
                </h3>
                {expandedSections.properties && (
                  <div className="section-content">
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
              </div>

              {/* Curve View - Placeholder for future features */}
              <div className="info-section">
                <h3 className="collapsible-header" onClick={() => toggleSection('view')}>
                  <span className="toggle-icon">{expandedSections.view ? '▼' : '▶'}</span>
                  Curve View
                </h3>
                {expandedSections.view && (
                  <div className="section-content">
                    <div className="info-item">
                      <em>Additional viewing options will be added here</em>
                    </div>
                  </div>
                )}
              </div>

              {/* Curve Settings - Editable parameters */}
              <div className="info-section">
                <h3 className="collapsible-header" onClick={() => toggleSection('settings')}>
                  <span className="toggle-icon">{expandedSections.settings ? '▼' : '▶'}</span>
                  Curve Settings
                </h3>
                {expandedSections.settings && (
                  <div className="section-content">
                    {/* Curve Name */}
                    <div className="form-group">
                      <label>Curve Name:</label>
                      <input
                        type="text"
                        value={editingCurve["curve-name"] || ""}
                        onChange={(e) => handleFieldChange("curve-name", e.target.value)}
                        title="The name of this curve"
                      />
                    </div>

                    {/* Curve Description */}
                    <div className="form-group description-group">
                      <label>Description:</label>
                      <textarea
                        value={editingCurve["curve-description"] || ""}
                        onChange={(e) => handleFieldChange("curve-description", e.target.value)}
                        title="Description of this curve"
                        rows={3}
                        className="description-textarea"
                      />
                    </div>

                    {/* Curve Tags */}
                    <div className="form-group tags-group">
                      <label>Tags:</label>
                      <div className="tags-container">
                        {/* Current tags as pills */}
                        {(editingCurve["curve-tags"] || []).map(tag => (
                          <span key={tag} className="tag-pill">
                            {tag}
                            <button
                              type="button"
                              className="remove-tag"
                              onClick={() => removeTagFromCurve(tag)}
                              title={`Remove tag: ${tag}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        
                        {/* Available tags to add */}
                        <div className="available-tags">
                          {availableTags
                            .filter(tag => !editingCurve["curve-tags"]?.includes(tag))
                            .map(tag => (
                              <button
                                key={tag}
                                type="button"
                                className="add-tag-btn"
                                onClick={() => addTagToCurve(tag)}
                                title={`Add tag: ${tag}`}
                              >
                                + {tag}
                              </button>
                            ))}
                        </div>
                        
                        {/* Add new tag input */}
                        <div className="new-tag-input">
                          <input
                            type="text"
                            placeholder="New tag..."
                            value={newTagInput}
                            onChange={(e) => setNewTagInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addNewTag()}
                            className="new-tag-field"
                          />
                          <button
                            type="button"
                            onClick={addNewTag}
                            disabled={!newTagInput.trim()}
                            className="add-new-tag-btn"
                            title="Add new tag"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Curve Type:</label>
                      <select
                        value={editingCurve["curve-type"] || "Radial"}
                        onChange={(e) => handleFieldChange("curve-type", e.target.value)}
                        title="Select the coordinate system for this curve"
                      >
                        <option value="Radial">Radial</option>
                        <option value="Cartesian X">Cartesian X</option>
                        <option value="Cartesian Y">Cartesian Y</option>
                      </select>
                    </div>
                    
                    {/* Universal Index Scaling */}
                    <div className="form-group">
                      <label>Index Scaling:</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        max="5.0"
                        value={editingCurve["curve-index-scaling"] || 1.0}
                        onChange={(e) => handleFieldChange("curve-index-scaling", parseFloat(e.target.value) || 1.0)}
                        title="Controls how many cells of distance are needed to move to the next index position"
                      />
                    </div>

                    {/* Coordinate Noise - Universal for all curve types */}
                    <div className="form-group">
                      <label>Coordinate Noise Strength:</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="3"
                        value={editingCurve["coordinate-noise-strength"] || 0}
                        onChange={(e) => handleFieldChange("coordinate-noise-strength", parseFloat(e.target.value) || 0)}
                        title="How much to distort the input coordinates before curve processing"
                      />
                    </div>
                    <div className="form-group">
                      <label>Coordinate Noise Scale:</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="1.0"
                        value={editingCurve["coordinate-noise-scale"] || 0.1}
                        onChange={(e) => handleFieldChange("coordinate-noise-scale", parseFloat(e.target.value) || 0.1)}
                        title="Scale of the noise pattern (lower = larger patterns)"
                      />
                    </div>
                    <div className="form-group">
                      <label>Coordinate Noise Seed:</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="9999"
                        value={editingCurve["coordinate-noise-seed"] || 0}
                        onChange={(e) => handleFieldChange("coordinate-noise-seed", parseInt(e.target.value) || 0)}
                        title="Random seed for consistent noise patterns"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Save Button */}
              {hasUnsavedChanges && (
                <div className="save-section">
                  <button 
                    className="save-btn" 
                    onClick={saveCurveChanges}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </>
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
