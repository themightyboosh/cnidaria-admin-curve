import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { apiUrl } from '../../config/environments'
import { indexToColorString, setActiveSpectrumPreset, SPECTRUM_PRESETS } from '../../utils/colorSpectrum'
import { useHeader } from '../../contexts/HeaderContext'
import Header from '../../components/Header'
import TagManager from '../TagManager'
import ThreeJSGrid from './ThreeJSGrid'

import './CurveBuilder.css'

interface Tag {
  id: string
  'tag-name': string
  'tag-description': string
  'tag-color': string
  'created-at': string
  'updated-at': string
  'usage-count-curves'?: number // Legacy field - optional for backward compatibility
  'tag-usage'?: Record<string, string[]> // New field - map of object-type to array of document IDs
}

interface Curve {
  id: string
  "curve-name": string
  "curve-description": string
  "curve-tags"?: string[]  // Store document IDs
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

function CurveBuilder() {
  const defaultCellSize = 30
  const [cellSize, setCellSize] = useState(defaultCellSize)
  const [viewMode, setViewMode] = useState<'2D'>('2D')
  const [colorMode, setColorMode] = useState<'value' | 'index'>('value')
  const [spectrumKey, setSpectrumKey] = useState(0) // Force refresh when spectrum changes
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
  const [assignedTags, setAssignedTags] = useState<Tag[]>([])
  const [isLoadingTags, setIsLoadingTags] = useState(false)
  const [showTagManager, setShowTagManager] = useState(false)
  const [show3DPreview, setShow3DPreview] = useState(false)
  const [previewSmoothing, setPreviewSmoothing] = useState(0.5)
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 50, z: 0 })

  const canvasRef = useRef<HTMLDivElement>(null)
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load curves from API
  const loadCurves = async () => {
    setIsLoadingCurves(true)
    setError(null)
    console.log('Loading curves from API...')
    try {
      const response = await fetch(`${apiUrl}/curves`)
      console.log('API Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('API Response data:', data)
        
        if (data.success) {
          // Fix: API returns data.curves, not just curves
          const curvesData = data.data?.curves || data.curves || []
          console.log('Raw curves from API:', curvesData)
          
          // Process curve data to ensure curve-tags contains only IDs
          const processedCurves = curvesData.map((curve: Curve) => {
            if (curve["curve-tags"]) {
              // Ensure curve-tags is an array of strings (IDs), not objects
              curve["curve-tags"] = curve["curve-tags"].map(tag => 
                typeof tag === 'string' ? tag : tag.id || tag
              )
            }
            return curve
          })
          
          console.log('Setting processed curves:', processedCurves)
          setCurves(processedCurves)
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

  // Load tags for the current curve using new tag-usage system
  const loadTagsForCurve = async (curveId: string) => {
    console.log('🔄 Loading tags for curve:', curveId)
    setIsLoadingTags(true)
    try {
      // Load assigned tags (tags currently on this curve)
      const assignedResponse = await fetch(`${apiUrl}/api/tags/by-usage/curve/${curveId}`)
      const assignedData = await assignedResponse.json()
      
      // Load available tags (tags NOT on this curve)
      const availableResponse = await fetch(`${apiUrl}/api/tags/not-used/curve/${curveId}`)
      const availableData = await availableResponse.json()
      
      if (assignedData.success && availableData.success) {
        console.log('🔄 Setting assigned tags:', assignedData.data.tags)
        console.log('🔄 Setting available tags:', availableData.data.tags)
        setAssignedTags(assignedData.data.tags)
        setAvailableTags(availableData.data.tags)
      } else {
        console.error('❌ Tags API returned success: false:', assignedData, availableData)
      }
    } catch (error) {
      console.error('❌ Tags API request failed:', error)
    } finally {
      setIsLoadingTags(false)
    }
  }

  // Load all available tags from the API (fallback for when no curve is selected)
  const loadAllTags = async () => {
    console.log('🔄 Loading all tags from API...')
    setIsLoadingTags(true)
    try {
      const response = await fetch(`${apiUrl}/tags`)
      console.log('🔄 Tags API Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('🔄 Tags API Response data:', data)
        
        if (data.success) {
          const tags = data.data?.tags || []
          // Remove any duplicate tags by ID
          const uniqueTags = tags.filter((tag, index, self) => 
            index === self.findIndex(t => t.id === tag.id)
          )
          console.log('🔄 Setting available tags:', uniqueTags)
          setAvailableTags(uniqueTags)
          setAssignedTags([])
        } else {
          console.error('❌ Tags API returned success: false:', data)
        }
      } else {
        console.error('❌ Tags API request failed:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('❌ Failed to load tags:', error)
    } finally {
      setIsLoadingTags(false)
    }
  }

  // Load curves and tags on component mount
  useEffect(() => {
    loadCurves()
    loadAllTags()
  }, [])

  // Load tags for selected curve
  useEffect(() => {
    if (selectedCurve?.id) {
      loadTagsForCurve(selectedCurve.id)
    } else {
      // If no curve is selected, load all tags
      loadAllTags()
    }
  }, [selectedCurve?.id])

  // Helper function to get tag name from tag ID
  const getTagName = (tagId: string): string => {
    const tag = [...availableTags, ...assignedTags].find(t => t.id === tagId)
    return tag ? tag['tag-name'] : tagId // Fallback to ID if not found
  }

  // Helper function to get tag color from tag ID
  const getTagColor = (tagId: string): string => {
    const tag = [...availableTags, ...assignedTags].find(t => t.id === tagId)
    return tag ? tag['tag-color'] : '#666666' // Fallback color
  }

  // Helper function to get tag description from tag ID
  const getTagDescription = (tagId: string): string => {
    const tag = [...availableTags, ...assignedTags].find(t => t.id === tagId)
    return tag ? tag['tag-description'] || 'No description available' : 'No description available'
  }

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
  const processCurveCoordinates = async (curve: Curve, forceColorMode?: 'value' | 'index') => {
    const currentColorMode = forceColorMode || colorMode
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
            const indexPosition = result["index-position"] // Use the actual curve index position, not array index
            const curveWidth = selectedCurve?.["curve-width"] || 1 // Add null check with default
            const color = indexToColorString(result["index-value"], currentColorMode, indexPosition, curveWidth)
            newCellColors.set(coordKey, color)
            
            // Debug logging for first few results
            if (index < 3) {
              console.log(`2D Debug [${index}]: colorMode=${currentColorMode}, indexValue=${result["index-value"]}, indexPosition=${indexPosition}, curveWidth=${curveWidth}, color=${color}`)
            }
            
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
    // Close all sections except selection when loading a curve
    setExpandedSections({
      selection: true,
      properties: false,
      view: false,
      tags: false,
      settings: false
    })
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

  // Add tag to curve using new tag-usage system
  const addTagToCurve = async (tagId: string) => {
    if (!editingCurve) return
    
    try {
      const response = await fetch(`${apiUrl}/api/tags/add-to-object`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagId: tagId,
          objectType: 'curve',
          documentId: editingCurve.id
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Refresh tags for this curve
          await loadTagsForCurve(editingCurve.id)
          
          // Update local curve state to reflect the change
          const currentTags = editingCurve["curve-tags"] || []
          const updatedTags = [...currentTags, tagId]
          setEditingCurve(prev => prev ? { ...prev, "curve-tags": updatedTags } : prev)
          
          // Update the main curves array
          setCurves(prev => prev.map(curve => 
            curve.id === editingCurve.id 
              ? { ...curve, "curve-tags": updatedTags }
              : curve
          ))
        } else {
          console.error('Failed to add tag:', data.error)
        }
      } else {
        console.error('Failed to add tag:', response.statusText)
      }
    } catch (error) {
      console.error('Error adding tag:', error)
    }
  }

  // Remove tag from curve using new tag-usage system
  const removeTagFromCurve = async (tagId: string) => {
    if (!editingCurve) return
    
    try {
      const response = await fetch(`${apiUrl}/api/tags/remove-from-object`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagId: tagId,
          objectType: 'curve',
          documentId: editingCurve.id
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Refresh tags for this curve
          await loadTagsForCurve(editingCurve.id)
          
          // Update local curve state to reflect the change
          const currentTags = editingCurve["curve-tags"] || []
          const updatedTags = currentTags.filter(tag => tag !== tagId)
          setEditingCurve(prev => prev ? { ...prev, "curve-tags": updatedTags } : prev)
          
          // Update the main curves array
          setCurves(prev => prev.map(curve => 
            curve.id === editingCurve.id 
              ? { ...curve, "curve-tags": updatedTags }
              : curve
          ))
        } else {
          console.error('Failed to remove tag:', data.error)
        }
      } else {
        console.error('Failed to remove tag:', response.statusText)
      }
    } catch (error) {
      console.error('Error removing tag:', error)
    }
  }

  // Handle tag manager modal close and refresh tags
  const handleTagManagerClose = () => {
    setShowTagManager(false)
    // Refresh tags when modal closes
    if (selectedCurve?.id) {
      loadTagsForCurve(selectedCurve.id)
    } else {
      loadAllTags()
    }
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
          
          // Update the curves list to reflect the changes in the dropdown
          setCurves(prevCurves => 
            prevCurves.map(curve => 
              curve.id === editingCurve.id ? editingCurve : curve
            )
          )
          
          // Clear namespace cache and redraw grid
          setCellColors(new Map())
          if (editingCurve) {
            processCurveCoordinates(editingCurve)
          }
          
          console.log('Curve updated successfully - dropdown refreshed')
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
      <Header title="Cnidaria" currentPage="Curve Builder" />
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

              {/* Curve View */}
              <div className="info-section">
                <h3 className="collapsible-header" onClick={() => toggleSection('view')}>
                  <span className="toggle-icon">{expandedSections.view ? '▼' : '▶'}</span>
                  Curve View
                </h3>
                {expandedSections.view && (
                  <div className="section-content">

                    
                    <div className="form-group">
                      <label>Color Spectrum:</label>
                      <select
                        onChange={(e) => {
                          setActiveSpectrumPreset(e.target.value)
                          setSpectrumKey(prev => prev + 1) // Force 3D view refresh
                          // Refresh both views by re-processing coordinates
                          if (selectedCurve) {
                            processCurveCoordinates(selectedCurve)
                          }
                        }}
                        title="Choose color spectrum for visualizing data values"
                      >
                        {Object.keys(SPECTRUM_PRESETS).map(presetName => (
                          <option key={presetName} value={presetName}>
                            {presetName.charAt(0).toUpperCase() + presetName.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label>Color Mode:</label>
                      <div style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
                          <input
                            type="radio"
                            name="colorMode"
                            value="value"
                            checked={colorMode === 'value'}
                            onChange={(e) => {
                              console.log('=== SWITCHING TO VALUE MODE ===')
                              setColorMode('value')
                              setSpectrumKey(prev => prev + 1) // Force 3D view refresh
                              // Immediately redraw the grid with new color mode
                              if (selectedCurve) {
                                processCurveCoordinates(selectedCurve, 'value')
                              }
                            }}
                          />
                          Value
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
                          <input
                            type="radio"
                            name="colorMode"
                            value="index"
                            checked={colorMode === 'index'}
                            onChange={(e) => {
                              console.log('=== SWITCHING TO INDEX MODE ===')
                              setColorMode('index')
                              setSpectrumKey(prev => prev + 1) // Force 3D view refresh
                              // Immediately redraw the grid with new color mode
                              if (selectedCurve) {
                                processCurveCoordinates(selectedCurve, 'index')
                              }
                            }}
                          />
                          Index
                        </label>
                      </div>

                    </div>
                    
                    {/* 3D Preview Button - Only show in 2D mode */}
                    {viewMode === '2D' && (
                      <div className="form-group">
                        <button
                          type="button"
                          onClick={() => setShow3DPreview(true)}
                          style={{
                            backgroundColor: '#4a90e2',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '10px 16px',
                            fontSize: '14px',
                            cursor: 'pointer',
                            fontWeight: '500',
                            marginTop: '10px'
                          }}
                          title="Show 3D preview of current 2D grid"
                        >
                          3D Preview
                        </button>
                      </div>
                    )}
                    
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
                      {/* Applied tags as compact pills */}
                      <div className="applied-tags">
                        {assignedTags.map((tag, index) => (
                          <span 
                            key={`current-tag-${tag.id}-${index}`}
                            className="tag-pill" 
                            style={{ backgroundColor: tag['tag-color'] }}
                            title={tag['tag-description'] || 'No description'}
                          >
                            {tag['tag-name']}
                            <button
                              type="button"
                              className="remove-tag"
                              onClick={() => removeTagFromCurve(tag.id)}
                              title={`Remove tag: ${tag['tag-name']}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      
                      {/* Add tag dropdown with Edit Tags button */}
                      <div className="tag-controls">
                        <div className="add-tag-dropdown">
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                addTagToCurve(e.target.value)
                                e.target.value = "" // Reset dropdown
                              }
                            }}
                            style={{
                              backgroundColor: '#2a2a2a',
                              color: '#ffffff',
                              border: '1px solid #444',
                              borderRadius: '4px',
                              padding: '8px 12px',
                              minWidth: '200px'
                            }}
                          >
                            <option value="">Add a tag...</option>
                            {availableTags.map(tag => (
                              <option key={tag.id} value={tag.id}>
                                {tag['tag-name']}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          className="edit-tags-btn"
                          onClick={() => setShowTagManager(true)}
                          title="Edit Tags"
                        >
                          Edit Tags
                        </button>
                      </div>

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
              backgroundColor: '#000',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: `${gridDimensions.width * cellSize}px`,
                height: `${gridDimensions.height * cellSize}px`
              }}
            >
              {renderGridCells()}
            </div>
          </div>
        </div>
      </div>

      {/* 3D Preview Modal */}
      {show3DPreview && (
        <div className="modal-overlay" onClick={() => setShow3DPreview(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ 
            width: 'min(95vw, 95vh)', 
            height: 'min(95vw, 95vh)',
            maxWidth: '1200px',
            maxHeight: '1200px'
          }}>
            <div className="modal-header">
              <h2>3D Preview</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#ccc' }}>
                  <span>Camera: ({cameraPosition.x.toFixed(1)}, {cameraPosition.y.toFixed(1)}, {cameraPosition.z.toFixed(1)})</span>
                </div>
                <button 
                  className="modal-close-btn"
                  onClick={() => setShow3DPreview(false)}
                  title="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="modal-body" style={{ height: 'calc(100% - 60px)', padding: '0' }}>
              <ThreeJSGrid 
                key={`3d-preview-${selectedCurve?.id || 'no-curve'}-spectrum-${spectrumKey}`}
                selectedCurve={selectedCurve}
                cellSize={cellSize}
                colorMode={colorMode}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tag Manager Modal */}
      {showTagManager && (
        <div className="modal-overlay" onClick={handleTagManagerClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Tag Manager</h2>
              <button 
                className="modal-close-btn"
                onClick={handleTagManagerClose}
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <TagManager onTagsChanged={handleTagManagerClose} hasUnsavedChanges={hasUnsavedChanges} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CurveBuilder
