import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { apiUrl } from '../../config/environments'
import { useHeader } from '../../contexts/HeaderContext'

interface Tag {
  id: string
  'tag-name': string
  'tag-description': string
  'tag-color': string
}

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

function CurveAdmin() {
  const { curveId } = useParams<{ curveId?: string }>()
  const { setStatusMessage, setGeneralInfo, setSaveActions } = useHeader()
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
    tags: true,
    settings: true
  })
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [newTagInput, setNewTagInput] = useState('')
  const [isLoadingTags, setIsLoadingTags] = useState(false)

  const canvasRef = useRef<HTMLDivElement>(null)
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load all available tags from the API
  const loadTags = async () => {
    console.log('🔄 loadTags function called')
    setIsLoadingTags(true)
    try {
      console.log('🔄 Loading tags from API:', `${apiUrl}/api/tags`)
      const response = await fetch(`${apiUrl}/api/tags`)
      console.log('🔄 Tags API Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('🔄 Tags API Response data:', data)
        
        if (data.success) {
          const tags = data.data?.tags || []
          console.log('🔄 Setting available tags:', tags)
          console.log('🔄 First tag example:', tags[0])
          setAvailableTags(tags)
        } else {
          console.error('❌ Tags API returned success: false:', data)
        }
      } else {
        const errorText = await response.text()
        console.error('❌ Tags API request failed:', response.status, response.statusText, errorText)
      }
    } catch (error) {
      console.error('❌ Failed to load tags:', error)
    } finally {
      setIsLoadingTags(false)
    }
  }

  // Resolve tag IDs to tag objects
  const resolveTagIds = async (tagIds: string[]): Promise<Tag[]> => {
    if (tagIds.length === 0) return []
    
    try {
      const response = await fetch(`${apiUrl}/api/tags/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          return data.data?.tags || []
        }
      }
    } catch (error) {
      console.error('Failed to resolve tag IDs:', error)
    }
    
    return []
  }

  // Get unassigned tags (tags not currently assigned to the curve)
  const getUnassignedTags = () => {
    if (!editingCurve) return []
    const currentTagIds = editingCurve["curve-tags"] || []
    return availableTags.filter(tag => !currentTagIds.includes(tag.id))
  }

  // Add tag to curve and update API immediately
  const addTagToCurve = async (tagId: string) => {
    if (!editingCurve) return
    
    const currentTags = editingCurve["curve-tags"] || []
    if (!currentTags.includes(tagId)) {
      const updatedTags = [...currentTags, tagId]
      
      try {
        const response = await fetch(`${apiUrl}/api/curves/${editingCurve.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ "curve-tags": updatedTags })
        })
        
        if (response.ok) {
          // Update local state immediately
          handleFieldChange("curve-tags", updatedTags)
          // Update the main curves array
          setCurves(prev => prev.map(curve => 
            curve.id === editingCurve.id 
              ? { ...curve, "curve-tags": updatedTags }
              : curve
          ))
        } else {
          console.error('Failed to update tags:', response.statusText)
        }
      } catch (error) {
        console.error('Error updating tags:', error)
      }
    }
  }

  // Remove tag from curve and update API immediately
  const removeTagFromCurve = async (tagIdToRemove: string) => {
    if (!editingCurve) return
    
    const currentTags = editingCurve["curve-tags"] || []
    const updatedTags = currentTags.filter(tagId => tagId !== tagIdToRemove)
    
    try {
      const response = await fetch(`${apiUrl}/api/curves/${editingCurve.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "curve-tags": updatedTags })
      })
      
      if (response.ok) {
        // Update local state immediately
        handleFieldChange("curve-tags", updatedTags)
        // Update the main curves array
        setCurves(prev => prev.map(curve => 
          curve.id === editingCurve.id 
            ? { ...curve, "curve-tags": updatedTags }
            : curve
        ))
      } else {
        console.error('Failed to update tags:', response.statusText)
      }
    } catch (error) {
      console.error('Error updating tags:', error)
    }
  }

  // Update header with current status and actions
  useEffect(() => {
    if (selectedCurve) {
      // Set general info in header
      setGeneralInfo(
        <div className="header-info-content">
          <span className="info-label">Curve:</span>
          <span className="info-value">{selectedCurve["curve-name"]}</span>
          <span className="info-separator">•</span>
          <span className="info-label">Type:</span>
          <span className="info-value">{selectedCurve["curve-type"]}</span>
          <span className="info-separator">•</span>
          <span className="info-label">Width:</span>
          <span className="info-value">{selectedCurve["curve-width"]}</span>
        </div>
      )
    } else {
      setGeneralInfo(null)
    }
  }, [selectedCurve, setGeneralInfo])

  // Update header with save actions when there are unsaved changes
  useEffect(() => {
    if (hasUnsavedChanges && editingCurve) {
      setSaveActions(
        <div className="header-save-content">
          <button 
            className="header-save-btn"
            onClick={saveCurveChanges}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )
    } else {
      setSaveActions(null)
    }
  }, [hasUnsavedChanges, editingCurve, isSaving, setSaveActions])

  // Update header with status messages
  useEffect(() => {
    if (isProcessingCoordinates) {
      setStatusMessage(
        <div className="header-status-content">
          <span className="status-spinner">⏳</span>
          <span className="status-text">Processing coordinates...</span>
          {processingProgress.total > 0 && (
            <span className="status-progress">
              {processingProgress.current}/{processingProgress.total}
            </span>
          )}
        </div>
      )
    } else if (error) {
      setStatusMessage(
        <div className="header-status-content error">
          <span className="status-icon">⚠️</span>
          <span className="status-text">{error}</span>
          <button 
            className="status-dismiss"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )
    } else if (selectedCurve) {
      setStatusMessage(
        <div className="header-status-content success">
          <span className="status-icon">✅</span>
          <span className="status-text">Ready</span>
        </div>
      )
    } else {
      setStatusMessage(null)
    }
  }, [isProcessingCoordinates, processingProgress, error, selectedCurve, setStatusMessage])

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

  // Load curves and tags on component mount
  useEffect(() => {
    console.log('🔄 useEffect triggered - loading curves and tags')
    loadCurves()
    loadTags()
  }, [])

  // Reload tags when a curve is selected to ensure we have fresh tag data
  useEffect(() => {
    if (selectedCurve && availableTags.length === 0) {
      console.log('🔄 Reloading tags for selected curve')
      loadTags()
    }
  }, [selectedCurve])

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
    setEditingCurve({ ...curve }) // Create a copy for editing
    setHasUnsavedChanges(false)
    setError(null)
    // Clear existing colors before processing new curve
    setCellColors(new Map())
    processCurveCoordinates(curve)
  }

  // Handle field changes
  const handleFieldChange = (field: string, value: any) => {
    try {
      if (!editingCurve) return
      
      setEditingCurve(prev => {
        if (!prev) return prev
        return {
          ...prev,
          [field]: value
        }
      })
      setHasUnsavedChanges(true)
      
      // Update the curve list immediately when curve name changes
      if (field === "curve-name") {
        setCurves(prev => prev.map(curve => 
          curve.id === editingCurve.id 
            ? { ...curve, [field]: value }
            : curve
        ))
      }
    } catch (error) {
      console.error('Error in handleFieldChange:', error, { field, value });
    }
  }

  // Toggle section expansion
  const toggleSection = (sectionName: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }))
  }

  // Save curve changes
  const saveCurveChanges = async () => {
    if (!editingCurve || !selectedCurve) return
    
    setIsSaving(true)
    setError(null)
    
    try {
      const response = await fetch(
        `${apiUrl}/api/curves/${selectedCurve.id}`,
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
    <div className="curve-admin">
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

            {/* Curve Tags Section */}
            <div className="info-section">
              <h3 className="collapsible-header" onClick={() => toggleSection('tags')}>
                <span className="toggle-icon">{expandedSections.tags ? '▼' : '▶'}</span>
                Curve Tags
              </h3>
              {expandedSections.tags && (
                <div className="section-content">
                  <div className="tags-container">
                    {/* Debug info */}
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '4px' }}>
                      <div><strong>Debug Info:</strong></div>
                      <div>Available tags count: {availableTags.length}</div>
                      <div>Current curve tags: {editingCurve["curve-tags"]?.length || 0}</div>
                      <div>Available tag names: {availableTags.map(t => t['tag-name']).join(', ') || 'None'}</div>
                      <div>Loading tags: {isLoadingTags ? 'Yes' : 'No'}</div>
                      <div>Curve tag IDs: {(editingCurve["curve-tags"] || []).join(', ') || 'None'}</div>
                      <div>Unassigned count: {getUnassignedTags().length}</div>
                    </div>
                    
                    {/* Current tags as pills */}
                    {(editingCurve["curve-tags"] || []).map(tagId => {
                      const tag = availableTags.find(t => t.id === tagId)
                      return tag ? (
                        <span key={tagId} className="tag-pill" style={{ backgroundColor: tag['tag-color'] || '#007acc' }}>
                          {tag['tag-name']}
                          <button
                            type="button"
                            className="remove-tag"
                            onClick={() => removeTagFromCurve(tagId)}
                            title={`Remove tag: ${tag['tag-name']}`}
                          >
                            ×
                          </button>
                        </span>
                      ) : (
                        <span key={tagId} className="tag-pill tag-loading">
                          {tagId.length > 15 ? `${tagId.substring(0, 12)}...` : tagId}
                          <button
                            type="button"
                            className="remove-tag"
                            onClick={() => removeTagFromCurve(tagId)}
                            title={`Remove tag: ${tagId}`}
                          >
                            ×
                          </button>
                        </span>
                      )
                    })}
                    
                    {/* Dropdown for unassigned tags with Add button */}
                    <div className="tag-dropdown-container">
                      <div className="tag-add-controls">
                        <select
                          className="tag-dropdown"
                          value=""
                          onChange={(e) => {
                            // Don't auto-add, just update selection
                            setNewTagInput(e.target.value)
                          }}
                          disabled={isLoadingTags || getUnassignedTags().length === 0}
                          title="Select a tag to add to this curve"
                        >
                          <option value="">
                            {isLoadingTags 
                              ? "Loading tags..." 
                              : getUnassignedTags().length === 0 
                                ? "No unused tags available" 
                                : "Select tag to add..."
                            }
                          </option>
                          {getUnassignedTags().map(tag => (
                            <option key={tag.id} value={tag.id}>
                              {tag['tag-name']}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="add-tag-btn"
                          onClick={() => {
                            if (newTagInput) {
                              addTagToCurve(newTagInput)
                              setNewTagInput('') // Reset selection
                            }
                          }}
                          disabled={!newTagInput || isLoadingTags}
                          title="Add the selected tag to this curve"
                        >
                          Add
                        </button>
                      </div>
                      
                      {/* Show count of available tags */}
                      <div className="tag-availability-info">
                        {!isLoadingTags && (
                          <span className="tag-count-info">
                            {getUnassignedTags().length} unused tag{getUnassignedTags().length !== 1 ? 's' : ''} available
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Manage Tags Button */}
                    <button
                      type="button"
                      className="manage-tags-btn"
                      onClick={() => {
                        // Placeholder for tag management functionality
                        console.log('Manage tags clicked')
                      }}
                      title="Manage all tags in the system"
                    >
                      Manage Tags
                    </button>
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
                      style={{
                        backgroundColor: '#2a2a2a',
                        color: '#ffffff',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        padding: '8px 12px'
                      }}
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
                      style={{
                        backgroundColor: '#2a2a2a',
                        color: '#ffffff',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        padding: '8px 12px',
                        resize: 'vertical'
                      }}
                    />
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
                      step="0.000001"
                      min="0.001"
                      max="1.0"
                      value={Number(editingCurve["curve-index-scaling"]) || 1.0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        handleFieldChange("curve-index-scaling", isNaN(val) ? 1.0 : val);
                      }}
                      title="Controls how many cells of distance are needed to move to the next index position (0.001 to 1.0)"
                      style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                    />
                  </div>

                  {/* Noise - Universal for all curve types */}
                  <div className="form-group">
                    <label>Noise Strength:</label>
                    <input
                      type="number"
                      step="0.000001"
                      min="0"
                      max="3"
                      value={Number(editingCurve["coordinate-noise-strength"]) || 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        handleFieldChange("coordinate-noise-strength", isNaN(val) ? 0 : val);
                      }}
                      title="How much to distort the input coordinates before curve processing (0 = no noise)"
                      style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Noise Scale:</label>
                    <input
                      type="number"
                      step="0.000001"
                      min="0"
                      max="1"
                      value={Number(editingCurve["coordinate-noise-scale"]) || 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        handleFieldChange("coordinate-noise-scale", isNaN(val) ? 0 : val);
                      }}
                      title="Scale of the noise pattern (0 = no noise)"
                      style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Noise Seed:</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={editingCurve["coordinate-noise-seed"]?.toString() || "0"}
                      onChange={(e) => handleFieldChange("coordinate-noise-seed", parseInt(e.target.value) || 0)}
                      title="Random seed for consistent noise patterns (0 = no seed)"
                    />
                  </div>

                  {/* Debug Values - Simple */}
                  <div className="form-group" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px' }}>
                    <label style={{ color: '#ff6b6b', fontWeight: 'bold' }}>🔍 Debug: Current Values</label>
                    <div style={{ fontSize: '12px', color: '#ccc', marginTop: '8px' }}>
                      <div>Noise Strength: <code>{editingCurve["coordinate-noise-strength"]}</code></div>
                      <div>Noise Scale: <code>{editingCurve["coordinate-noise-scale"]}</code></div>
                      <div>Index Scaling: <code>{editingCurve["curve-index-scaling"]}</code></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
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
  )
}

export default CurveAdmin
