import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { apiUrl } from '../../config/environments'
import { indexToColorString, setActiveSpectrumPreset, SPECTRUM_PRESETS } from '../../utils/colorSpectrum'
import { useHeader } from '../../contexts/HeaderContext'
import Header from '../../components/Header'
import TagManager from '../TagManager'
import CurveGraph from './CurveGraph'
import PNGGenerator from '../../components/PNGGenerator'
import WebGPUCompatibilityBadge from '../../components/WebGPUCompatibilityBadge'
import { getPaletteOptions } from '../../utils/paletteUtils'
import { getDefaultNoiseExpression, type CoordinateNoise } from '../../utils/mathPipeline'


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
  "coordinate-noise": string
  "noise-calc"?: "radial" | "cartesian-x" | "cartesian-y" // Optional until migrated
  "curve-width": number
  "curve-data": number[]
  "curve-index-scaling"?: number
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
  const [canvasViewMode, setCanvasViewMode] = useState<'curve-data' | 'mapped'>('mapped')
  const [curveDataMode, setCurveDataMode] = useState<'fractal' | 'sawtooth' | 'square' | 'sine' | 'ramp' | 'white-noise'>('sine')
  const [valueRange, setValueRange] = useState({ min: 0, max: 255, mid: 127 })
  const [colorMode, setColorMode] = useState<'value' | 'index'>('value')
  const [spectrumKey, setSpectrumKey] = useState(0) // Force refresh when spectrum changes
  const [selectedPalette, setSelectedPalette] = useState<string>('default')
  const [coordinateNoise, setCoordinateNoise] = useState<CoordinateNoise | null>(null)
  const [pngError, setPngError] = useState<string | null>(null)
  const [isOptionPressed, setIsOptionPressed] = useState(false)
  const [curves, setCurves] = useState<Curve[]>([])
  const [selectedCurve, setSelectedCurve] = useState<Curve | null>(null)
  const [cellColors, setCellColors] = useState<Map<string, string>>(new Map())
  const [coordinateCache, setCoordinateCache] = useState<Map<string, ProcessCoordinateResponse>>(new Map())
  const [isLoadingCurves, setIsLoadingCurves] = useState(false)
  const [isProcessingCoordinates, setIsProcessingCoordinates] = useState(false)
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [editingCurve, setEditingCurve] = useState<Curve | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    selection: true,
    view: true,
    tags: true,
    settings: true
  })
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [assignedTags, setAssignedTags] = useState<Tag[]>([])
  const [isLoadingTags, setIsLoadingTags] = useState(false)
  const [showTagManager, setShowTagManager] = useState(false)
  const [coordinateNoiseTypesList, setCoordinateNoiseTypesList] = useState<Array<{id: string, name: string, cpuLoadLevel: number, displayName: string}>>([])
  const [isLoadingCoordinateNoiseTypes, setIsLoadingCoordinateNoiseTypes] = useState(false)

  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fibonacci numbers for curve width options (max 1597)
  const fibonacciNumbers = [8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597]

  // Helper function to get coordinate key
  const getCoordinateKey = (x: number, y: number) => `${x}_${y}`

  // Helper function to check if coordinate is cached
  const isCoordinateCached = (x: number, y: number) => {
    return coordinateCache.has(getCoordinateKey(x, y))
  }

  // Helper function to get cached coordinate data
  const getCachedCoordinate = (x: number, y: number) => {
    return coordinateCache.get(getCoordinateKey(x, y))
  }

  // Load coordinate noise types from API
  const loadCoordinateNoiseTypes = async () => {
    setIsLoadingCoordinateNoiseTypes(true)
    try {
      const response = await fetch(`${apiUrl}/api/coordinate-noise/firebase`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const noiseTypes = data.data.noiseTypes.map((noise: any) => ({
            id: noise.id,
            name: noise.name,
            cpuLoadLevel: noise.cpuLoadLevel,
            displayName: `${noise.name} (${noise.cpuLoadLevel} cpu)`
          }))
          setCoordinateNoiseTypesList(noiseTypes)
          console.log(`📊 Loaded ${noiseTypes.length} coordinate noise types for dropdown`)
        }
      }
    } catch (error) {
      console.error('Failed to load coordinate noise types:', error)
      setError('Failed to load coordinate noise types')
    } finally {
      setIsLoadingCoordinateNoiseTypes(false)
    }
  }

  // Load coordinate noise by name
  const loadCoordinateNoise = async (noiseName: string): Promise<CoordinateNoise | null> => {
    try {
      console.log('Loading coordinate noise:', noiseName)
      const response = await fetch(`${apiUrl}/api/coordinate-noise/firebase`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Coordinate noise API response:', data)
        
        console.log('Coordinate noise API full response structure:', JSON.stringify(data, null, 2))
        
        // Handle different possible response formats
        let noiseArray = null
        if (data.success && data.data) {
          // Check for the correct structure: data.data.noiseTypes (from the API reference)
          if (data.data.noiseTypes && Array.isArray(data.data.noiseTypes)) {
            noiseArray = data.data.noiseTypes
          } else if (Array.isArray(data.data)) {
            noiseArray = data.data
          } else if (data.data.noise) {
            noiseArray = data.data.noise
          } else if (data.data.patterns) {
            noiseArray = data.data.patterns
          }
        } else if (Array.isArray(data)) {
          noiseArray = data
        } else if (data.noise) {
          noiseArray = data.noise
        }
        
        console.log('Extracted noise array:', noiseArray?.length ? `${noiseArray.length} items` : 'null/empty')
        console.log('Data.data structure:', data.data ? Object.keys(data.data) : 'no data.data')
        
        if (noiseArray && Array.isArray(noiseArray)) {
          console.log('Available noise patterns:', noiseArray.map((n: any) => n.name))
          
          // Find the noise by name
          const noise = noiseArray.find((n: CoordinateNoise) => n.name === noiseName)
          if (noise) {
            console.log('✅ Found coordinate noise:', noise.name, 'Expression:', noise.gpuExpression)
            return noise
          } else {
            console.warn('❌ Coordinate noise not found:', noiseName, 'Available:', noiseArray.map((n: any) => n.name))
            
            // Try to find a close match (case-insensitive)
            const closeMatch = noiseArray.find((n: CoordinateNoise) => 
              n.name.toLowerCase() === noiseName.toLowerCase()
            )
            if (closeMatch) {
              console.log('✅ Found close match:', closeMatch.name)
              return closeMatch
            }
            
            // Return default radial noise
            return {
              name: 'radial',
              category: 'default',
              description: 'Default radial distance function',
              cpuLoadLevel: 1,
              gpuDescription: 'Radial distance from center',
              gpuExpression: getDefaultNoiseExpression('radial'),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          }
        } else {
          console.error('❌ No valid noise array found in API response. Response keys:', Object.keys(data))
        }
      } else {
        console.error('Coordinate noise API request failed:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Failed to load coordinate noise:', error)
    }
    
    // Fallback to default radial noise
    console.log('Using fallback radial noise')
    return {
      name: 'radial',
      category: 'default', 
      description: 'Default radial distance function',
      cpuLoadLevel: 1,
      gpuDescription: 'Radial distance from center',
      gpuExpression: getDefaultNoiseExpression('radial'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }

  // Load curves from API
  const loadCurves = async (retryCount = 0) => {
    setIsLoadingCurves(true)
    setError(null)
    console.log(`Loading curves from API... (attempt ${retryCount + 1})`)
    try {
      const response = await fetch(`${apiUrl}/curves`)
      console.log('API Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('API Response data:', data)
        
        if (data.success) {
          // Fix: API returns data.curves, not just curves
          const curvesData = data.data?.curves || data.curves || []
          console.log('Raw curves from API:', curvesData.length, 'curves')
          console.log('First curve sample:', curvesData[0])
          
          // Process curve data to ensure curve-tags contains only IDs and handle coordinate-noise migration
          const processedCurves = curvesData.map((curve: any) => {
            try {
              console.log('🔍 Processing curve:', curve["curve-name"], 'Fields:', Object.keys(curve))
              console.log('  curve-type:', curve["curve-type"])
              console.log('  coordinate-noise:', curve["coordinate-noise"])
              console.log('  noise-calc:', curve["noise-calc"])
              
            if (curve["curve-tags"]) {
              // Ensure curve-tags is an array of strings (IDs), not objects
                curve["curve-tags"] = curve["curve-tags"].map((tag: any) => 
                typeof tag === 'string' ? tag : tag.id || tag
              )
            }
              
              // Handle coordinate-noise migration: curve-type -> coordinate-noise
              if (curve["curve-type"] && !curve["coordinate-noise"]) {
                curve["coordinate-noise"] = curve["curve-type"]
                console.log('✅ Migrated curve-type to coordinate-noise for curve:', curve["curve-name"], 'from:', curve["curve-type"], 'to:', curve["coordinate-noise"])
              } else if (!curve["coordinate-noise"]) {
                // If no coordinate-noise field at all, default to radial
                curve["coordinate-noise"] = "radial"
                console.log('⚠️ No coordinate-noise found for curve:', curve["curve-name"], 'defaulting to radial')
              } else {
                console.log('✅ Curve already has coordinate-noise:', curve["curve-name"], '=', curve["coordinate-noise"])
              }
              
              // Handle noise-calc migration: add default if missing
              if (!curve["noise-calc"]) {
                // Default to radial for existing curves
                curve["noise-calc"] = "radial"
                console.log('✅ Added default noise-calc to curve:', curve["curve-name"], '=', curve["noise-calc"])
              } else {
                console.log('✅ Curve already has noise-calc:', curve["curve-name"], '=', curve["noise-calc"])
              }
              
              // Ensure all required fields are present for curve processing
              if (!curve["curve-index-scaling"]) {
                curve["curve-index-scaling"] = 0.52 // Default value
              }
              if (!curve["curve-data"] || !Array.isArray(curve["curve-data"])) {
                console.warn('⚠️ Curve missing curve-data:', curve["curve-name"])
                return null // Skip invalid curves
              }
            
            return curve as Curve
            } catch (error) {
              console.error('❌ Error processing curve:', curve["curve-name"], error)
              // Return curve with defaults for any missing fields
              return {
                ...curve,
                'coordinate-noise': curve['coordinate-noise'] || 'radial',
                'noise-calc': curve['noise-calc'] || 'radial'
              } as Curve
            }
          }).filter(curve => curve !== null) // Remove any null curves from processing errors
          
          console.log('Setting processed curves:', processedCurves.length, 'valid curves')
          console.log('Processed curve names:', processedCurves.map(c => c['curve-name']))
          setCurves(processedCurves)
          
          // Auto-load the most recent curve AFTER populating the dropdown
          if (processedCurves.length > 0) {
            // Sort curves by updated-at or created-at timestamp (most recent first)
            const sortedCurves = [...processedCurves].sort((a, b) => {
              const aTime = new Date(a['updated-at'] || a['created-at'] || 0).getTime()
              const bTime = new Date(b['updated-at'] || b['created-at'] || 0).getTime()
              return bTime - aTime // Most recent first
            })
            
            const mostRecentCurve = sortedCurves[0]
            console.log('🔄 Auto-loading most recent curve after dropdown populated:', mostRecentCurve['curve-name'])
            
            // Use setTimeout to ensure curves are rendered in dropdown first
            setTimeout(async () => {
              try {
                await handleCurveSelect(mostRecentCurve)
                console.log('✅ Auto-loaded most recent curve successfully')
              } catch (error) {
                console.error('❌ Failed to auto-load most recent curve:', error)
                console.log('✅ Curves dropdown populated, auto-loading failed but user can select manually')
              }
            }, 100) // Small delay to ensure dropdown is populated
          }
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
      
      // Retry logic for network errors
      if (retryCount < 5) {
        const delay = Math.min((retryCount + 1) * 3000, 15000) // 3s, 6s, 9s, 12s, 15s max
        console.log(`Retrying in ${delay / 1000} seconds...`)
        setError(`API connection failed. Retrying in ${delay / 1000} seconds... (attempt ${retryCount + 1}/5)`)
        setTimeout(() => {
          loadCurves(retryCount + 1)
        }, delay)
        return
      }
      
      setError(`API temporarily unavailable. Please wait for deployment to complete and try again.`)
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
    loadCoordinateNoiseTypes()
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

  // Three.js grid state



  // Note: Server-side coordinate processing removed - all processing now happens client-side in PNG generation

  // Update colors from cache when color mode changes
  const updateColorsFromCache = (currentColorMode: 'value' | 'index') => {
    const newCellColors = new Map<string, string>()
    
    coordinateCache.forEach((cachedData, coordKey) => {
      const indexPosition = cachedData["index-position"]
      const curveWidth = selectedCurve?.["curve-width"] || 1
      const color = indexToColorString(cachedData["index-value"], currentColorMode, indexPosition, curveWidth)
      newCellColors.set(coordKey, color)
    })
    
    setCellColors(newCellColors)
    console.log(`Updated colors for ${coordinateCache.size} cached coordinates`)
  }



  // Generate curve data based on selected mode
  const generateCurveData = (mode: 'fractal' | 'sawtooth' | 'square' | 'sine' | 'ramp' | 'white-noise', width: number, min: number, max: number, mid: number, noiseSeed: number = 0) => {
    const data: number[] = []
    const range = max - min
    
    switch (mode) {
      case 'fractal':
        // Enhanced fractal noise with true randomization
        for (let i = 0; i < width; i++) {
          const t = (i / width) * Math.PI * 2
          
          // Multiple frequency layers with true random phases and amplitudes
          const layer1 = Math.sin(t + Math.random() * Math.PI * 2) * (0.3 + Math.random() * 0.2)
          const layer2 = Math.sin(t * (1.5 + Math.random() * 2) + Math.random() * Math.PI * 2) * (0.15 + Math.random() * 0.2)
          const layer3 = Math.sin(t * (3 + Math.random() * 4) + Math.random() * Math.PI * 2) * (0.1 + Math.random() * 0.15)
          const layer4 = Math.sin(t * (6 + Math.random() * 6) + Math.random() * Math.PI * 2) * (0.05 + Math.random() * 0.1)
          const layer5 = Math.sin(t * (10 + Math.random() * 10) + Math.random() * Math.PI * 2) * (0.02 + Math.random() * 0.08)
          
          // Add significant random noise
          const noise = (Math.random() - 0.5) * 0.3
          
          // Combine all layers with noise
          const value = layer1 + layer2 + layer3 + layer4 + layer5 + noise
          
          data.push(Math.floor(((value + 1) / 2) * range + min))
        }
        break
        
      case 'sawtooth':
        for (let i = 0; i < width; i++) {
          const t = (i / width) * 2
          const value = (t - Math.floor(t)) * 2 - 1
          data.push(Math.floor(((value + 1) / 2) * range + min))
        }
        break
        
      case 'square':
        for (let i = 0; i < width; i++) {
          const t = (i / width) * 2
          const value = Math.sin(t * Math.PI) > 0 ? 1 : -1
          data.push(Math.floor(((value + 1) / 2) * range + min))
        }
        break
        
      case 'ramp':
        // Linear ramp from min to max
        for (let i = 0; i < width; i++) {
          const progress = i / (width - 1)
          const value = min + (progress * range)
          data.push(Math.floor(value))
        }
        break
        
      case 'white-noise':
        // True white noise with complete randomization
        for (let i = 0; i < width; i++) {
          // Pure random value between -1 and 1
          const randomValue = (Math.random() - 0.5) * 2
          const value = min + ((randomValue + 1) / 2) * range
          data.push(Math.floor(value))
        }
        break
        
      case 'sine':
      default:
        for (let i = 0; i < width; i++) {
          const t = (i / width) * Math.PI * 2
          const value = Math.sin(t)
          data.push(Math.floor(((value + 1) / 2) * range + min))
        }
        break
    }
    
    return data
  }



  // Stretch values to fit the min/max range
  const stretchValues = () => {
    if (!editingCurve) return
    
    const data = editingCurve["curve-data"]
    if (data.length === 0) return
    
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min
    
    if (range === 0) return // All values are the same
    
    const stretchedData = data.map(value => 
      Math.floor(((value - min) / range) * (valueRange.max - valueRange.min) + valueRange.min)
    )
    
    handleFieldChange("curve-data", stretchedData)
  }



  // Handle click on graph data point
  const handleDataPointClick = (index: number, value: number) => {
    if (!editingCurve) return
    
    const newData = [...editingCurve["curve-data"]]
    newData[index] = value
    
    // Update the curve data
    handleFieldChange("curve-data", newData)
  }

  // Interpolate data when curve width changes
  const interpolateData = (oldWidth: number, newWidth: number, oldData: number[]) => {
    if (oldWidth === newWidth || oldData.length === 0) return oldData
    
    const newData: number[] = []
    
    for (let i = 0; i < newWidth; i++) {
      const oldIndex = (i / newWidth) * oldWidth
      const index1 = Math.floor(oldIndex)
      const index2 = Math.min(index1 + 1, oldWidth - 1)
      const fraction = oldIndex - index1
      
      const value1 = oldData[index1] || 0
      const value2 = oldData[index2] || 0
      const interpolatedValue = value1 + (value2 - value1) * fraction
      
      newData.push(Math.floor(interpolatedValue))
    }
    
    return newData
  }

  // Generate unique curve name
  const generateUniqueCurveName = () => {
    let counter = 1
    let name = `New Curve ${counter}`
    
    while (curves.some(curve => curve["curve-name"] === name)) {
      counter++
      name = `New Curve ${counter}`
    }
    
    return name
  }

  // Create a new curve from scratch
  const createNewCurve = () => {
    const newCurve: Curve = {
      id: `curve-${Date.now()}`,
      "curve-name": generateUniqueCurveName(),
      "curve-description": "A new curve created from scratch",
      "curve-tags": [],
      "coordinate-noise": "radial",
      "curve-width": 256,
      "curve-data": Array.from({ length: 256 }, () => Math.floor(Math.random() * 256)),
      "curve-index-scaling": 1.0,
      "coordinate-noise-seed": 0
    }
    
    setSelectedCurve(newCurve)
    setEditingCurve({ ...newCurve })
    setHasUnsavedChanges(true)
    setError(null)
    
    // Close all sections except selection when creating a new curve
    setExpandedSections({
      selection: true,
      view: false,
      tags: false,
      settings: false
    })
  }

  // Handle curve selection
  const handleCurveSelect = async (curve: Curve) => {
    setSelectedCurve(curve)
    setEditingCurve({ ...curve }) // Create a copy for editing
    setHasUnsavedChanges(false)
    setError(null)
    
    // Reset value range sliders based on curve data
    if (curve["curve-data"] && curve["curve-data"].length > 0) {
      const data = curve["curve-data"]
      const min = Math.min(...data)
      const max = Math.max(...data)
      const avg = Math.floor(data.reduce((sum, val) => sum + val, 0) / data.length)
      setValueRange({ min, max, mid: avg })
    } else {
      // Default values if no curve data
      setValueRange({ min: 0, max: 255, mid: 127 })
    }

    // Load coordinate noise for mapped view
    const noiseName = curve['coordinate-noise'] || 'radial'
    console.log('Loading coordinate noise for curve:', curve['curve-name'], 'noise type:', noiseName)
    const noise = await loadCoordinateNoise(noiseName)
    setCoordinateNoise(noise)
    
    // Clear cache and colors for new curve
    setCoordinateCache(new Map())
    setCellColors(new Map())
    // Close all sections except selection when loading a curve
    setExpandedSections({
      selection: true,
      view: false,
      tags: false,
      settings: false
    })
    // processCurveCoordinates(curve) // Disabled - using new visible rectangles service
  }

  // Handle field changes
  const handleFieldChange = (field: string, value: any) => {
    try {
      if (!editingCurve) return
      
      setEditingCurve(prev => {
        if (!prev) return prev
        
        // Handle curve width interpolation
        if (field === "curve-width" && prev["curve-data"] && prev["curve-data"].length > 0) {
          const oldWidth = prev["curve-width"]
          const newWidth = value
          const interpolatedData = interpolateData(oldWidth, newWidth, prev["curve-data"])
          
          return {
            ...prev,
            [field]: value,
            "curve-data": interpolatedData
          }
        }
        
        return {
          ...prev,
          [field]: value
        }
      })
      setHasUnsavedChanges(true)
      
      // Auto-save when coordinate noise changes and reload noise data for PNG generation
      if (field === "coordinate-noise") {
        // Load the new coordinate noise for PNG generation
        loadCoordinateNoise(value as string).then(noise => {
          setCoordinateNoise(noise)
          console.log('🔄 Coordinate noise updated for PNG generation:', value, '→', noise?.name)
        })
        
        // Use a small delay to ensure the state is updated first
        setTimeout(() => {
          saveCurveChanges()
        }, 100)
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
    console.log('Tag Manager closed, refreshing tags...') // Debug log
    
    // Refresh tags when modal closes
    if (selectedCurve?.id) {
      console.log('Refreshing tags for curve:', selectedCurve.id) // Debug log
      loadTagsForCurve(selectedCurve.id)
    } else {
      console.log('No curve selected, loading all tags') // Debug log
      loadAllTags()
    }
  }

  // Validate curve name uniqueness
  const validateCurveName = (curveName: string, currentCurveId: string) => {
    const existingCurve = curves.find(curve => 
      curve["curve-name"] === curveName && curve.id !== currentCurveId
    )
    return !existingCurve
  }

  // Delete curve
  const deleteCurve = async () => {
    if (!selectedCurve) return
    
    if (!window.confirm(`Are you sure you want to delete the curve "${selectedCurve["curve-name"]}"? This action cannot be undone.`)) {
      return
    }
    
    setIsSaving(true)
    setError(null)
    
    try {
      const response = await fetch(
        `${apiUrl}/api/curves/${selectedCurve.id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Remove curve from local state
          setCurves(prevCurves => prevCurves.filter(curve => curve.id !== selectedCurve.id))
          setSelectedCurve(null)
          setEditingCurve(null)
          setHasUnsavedChanges(false)
          setError(null)
          
          console.log('Curve deleted successfully')
        } else {
          setError('Failed to delete curve: API returned error')
        }
      } else {
        const errorData = await response.json()
        console.error('Delete API request failed:', response.status, response.statusText, errorData)
        
        let errorMessage = `Failed to delete curve: ${response.status} ${response.statusText}`
        if (errorData.error && errorData.error.message) {
          errorMessage = errorData.error.message
        }
        
        setError(errorMessage)
      }
    } catch (error) {
      console.error('Failed to delete curve:', error)
      setError('Failed to delete curve: Network error')
    } finally {
      setIsSaving(false)
    }
  }

  // Save curve changes
  const saveCurveChanges = async () => {
    if (!editingCurve || !selectedCurve) return
    
    // Validate curve name uniqueness
    if (!validateCurveName(editingCurve["curve-name"], selectedCurve.id)) {
      setError(`A curve with name '${editingCurve["curve-name"]}' already exists. Please choose a different name.`)
      return
    }
    
    setIsSaving(true)
    setError(null)
    
    try {
      // Check if this is a new curve (temporary ID) or existing curve
      const isNewCurve = selectedCurve.id.startsWith('curve-') && selectedCurve.id.includes('-')
      
      const response = await fetch(
        isNewCurve ? `${apiUrl}/api/curves` : `${apiUrl}/api/curves/${selectedCurve.id}`,
        {
          method: isNewCurve ? 'POST' : 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editingCurve)
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // For new curves, update the ID from the API response
          if (isNewCurve && data.id) {
            editingCurve.id = data.id
            selectedCurve.id = data.id
            console.log('✅ New curve created with ID:', data.id)
          }
          
          // Update the selected curve with new data
          setSelectedCurve(editingCurve)
          setHasUnsavedChanges(false)
          
          // Update the curves list to reflect the changes in the dropdown
          if (isNewCurve) {
            // Add new curve to the list
            setCurves(prevCurves => [...prevCurves, editingCurve])
          } else {
            // Update existing curve in the list
          setCurves(prevCurves => 
            prevCurves.map(curve => 
              curve.id === editingCurve.id ? editingCurve : curve
            )
          )
          }
          
          // Clear cache and redraw grid since settings changed
          setCoordinateCache(new Map())
          setCellColors(new Map())
          
          // Load coordinate noise and refresh PNG generation after save
          const noiseName = editingCurve['coordinate-noise'] || 'radial'
          console.log('🔄 Reloading coordinate noise after save:', noiseName)
          const noise = await loadCoordinateNoise(noiseName)
          setCoordinateNoise(noise)
          console.log('✅ Coordinate noise reloaded for PNG refresh:', noise?.name)
          
          console.log('Curve updated successfully - dropdown refreshed and PNG will auto-refresh')
        } else {
          setError('Failed to update curve: API returned error')
        }
      } else {
        const errorData = await response.json()
        console.error('API request failed:', response.status, response.statusText, errorData)
        
        // Extract specific error message from API response
        let errorMessage = `Failed to update curve: ${response.status} ${response.statusText}`
        if (errorData.error && errorData.error.message) {
          errorMessage = errorData.error.message
          
          // Add suggestion for name conflicts
          if (errorData.error.code === 'CURVE_NAME_TAKEN' && editingCurve["curve-name"]) {
            const suggestedName = generateUniqueCurveName()
            errorMessage += `. Try using a different name like "${suggestedName}".`
          }
        } else if (errorData.error && errorData.error.code) {
          errorMessage = `Error: ${errorData.error.code}`
        }
        
        setError(errorMessage)
      }
    } catch (error) {
      console.error('Failed to update curve:', error)
      setError('Failed to update curve: Network error')
    } finally {
      setIsSaving(false)
    }
  }

  // Note: Old coordinate processing logic removed - all processing now client-side

  return (
    <div className="app">
      <Header title="Cnidaria" currentPage="Curve Builder" />
      <div className="main-content">
        {/* WebGPU Compatibility Status */}
        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000 }}>
          <WebGPUCompatibilityBadge />
        </div>
        
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
                      key={`curves-${curves.length}`} // Force re-render when curves change
                      value={selectedCurve?.id || ''}
                      onChange={(e) => {
                        const curve = curves.find(c => c.id === e.target.value)
                        if (curve) handleCurveSelect(curve)
                      }}
                      disabled={curves.length === 0}
                      title={`Choose a curve to edit and visualize (${curves.length} available)`}
                    >
                      <option value="">{curves.length > 0 ? `Select a curve... (${curves.length} available)` : 'Loading curves...'}</option>
                      {curves.map(curve => (
                        <option key={curve.id} value={curve.id}>
                          {curve["curve-name"]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="form-group" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  {/* Create Button */}
                  <button
                    type="button"
                    onClick={createNewCurve}
                    style={{
                      backgroundColor: '#28a745',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      flex: '1'
                    }}
                    title="Create a new curve from scratch"
                  >
                    Create
                  </button>
                  
                  {/* Save Button */}
                  {selectedCurve && hasUnsavedChanges && (
                    <button
                      type="button"
                      onClick={saveCurveChanges}
                      disabled={isSaving || (editingCurve && !validateCurveName(editingCurve["curve-name"], selectedCurve?.id || ''))}
                      style={{
                        backgroundColor: (editingCurve && !validateCurveName(editingCurve["curve-name"], selectedCurve?.id || '')) 
                          ? '#666666' 
                          : '#007bff',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '10px 16px',
                        fontSize: '14px',
                        cursor: (editingCurve && !validateCurveName(editingCurve["curve-name"], selectedCurve?.id || '')) 
                          ? 'not-allowed' 
                          : 'pointer',
                        fontWeight: '500',
                        flex: '1'
                      }}
                      title="Save changes to the current curve"
                    >
                      {isSaving ? 'Saving...' : 
                       (editingCurve && !validateCurveName(editingCurve["curve-name"], selectedCurve?.id || '')) 
                         ? 'Name Conflict' 
                         : 'Save'}
                    </button>
                  )}
                  
                  {/* Delete Button */}
                  {selectedCurve && (
                    <button
                      type="button"
                      onClick={deleteCurve}
                      disabled={isSaving}
                      style={{
                        backgroundColor: '#dc3545',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '10px 16px',
                        fontSize: '14px',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        fontWeight: '500',
                        flex: '1'
                      }}
                      title="Delete the current curve"
                    >
                      {isSaving ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {selectedCurve && editingCurve && (
            <>

              {/* Curve View */}
              <div className="info-section">
                <h3 className="collapsible-header" onClick={() => toggleSection('view')}>
                  <span className="toggle-icon">{expandedSections.view ? '▼' : '▶'}</span>
                  Curve View
                </h3>
                {expandedSections.view && (
                  <div className="section-content">

                    {/* View Mode Dropdown */}
                    <div className="form-group">
                      <label>View Mode:</label>
                      <select
                        value={canvasViewMode}
                        onChange={(e) => setCanvasViewMode(e.target.value as 'curve-data' | 'mapped')}
                        title="Choose the visualization mode for the canvas area"
                      >
                        <option value="curve-data">Curve Data</option>
                        <option value="mapped">Mapped</option>
                      </select>
                    </div>

                    {/* Curve Data Generation Controls - only show when Curve Data mode is selected */}
                    {canvasViewMode === 'curve-data' && (
                      <>
                    <div className="form-group">
                          <label>Curve Width:</label>
                      <select
                            value={editingCurve["curve-width"]}
                        onChange={(e) => {
                              const newWidth = parseInt(e.target.value)
                              handleFieldChange("curve-width", newWidth)
                            }}
                            title="Choose the curve width (Fibonacci numbers)"
                          >
                            {fibonacciNumbers.map(num => (
                              <option key={num} value={num}>
                                {num}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-group">
                          <label>Data Generation:</label>
                          <select
                            value={curveDataMode}
                            onChange={(e) => {
                              const newMode = e.target.value as 'fractal' | 'sawtooth' | 'square' | 'sine' | 'ramp' | 'white-noise'
                              setCurveDataMode(newMode)
                              if (editingCurve) {
                                const newData = generateCurveData(
                                  newMode,
                                  editingCurve["curve-width"],
                                  valueRange.min,
                                  valueRange.max,
                                  valueRange.mid,
                                  editingCurve["coordinate-noise-seed"]
                                )
                                handleFieldChange("curve-data", newData)
                              }
                            }}
                            onFocus={(e) => {
                              // Re-run generation when same option is selected
                              if (editingCurve) {
                                const newData = generateCurveData(
                                  curveDataMode,
                                  editingCurve["curve-width"],
                                  valueRange.min,
                                  valueRange.max,
                                  valueRange.mid,
                                  editingCurve["coordinate-noise-seed"]
                                )
                                handleFieldChange("curve-data", newData)
                              }
                            }}
                            title="Choose the type of curve data to generate"
                          >
                            <option value="sine">Sine Wave</option>
                            <option value="sawtooth">Sawtooth</option>
                            <option value="square">Square Wave</option>
                            <option value="fractal">Fractal Noise</option>
                            <option value="ramp">Ramp</option>
                            <option value="white-noise">White Noise</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Value Range:</label>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '12px', color: '#ccc' }}>Min: {valueRange.min}</label>
                          <input
                                  type="range"
                                  min="0"
                                  max="255"
                                  value={valueRange.min}
                            onChange={(e) => {
                                    const newMin = parseInt(e.target.value)
                                    setValueRange(prev => ({ ...prev, min: newMin }))
                                    if (editingCurve && newMin < valueRange.max) {
                                      const newData = generateCurveData(
                                        curveDataMode,
                                        editingCurve["curve-width"],
                                        newMin,
                                        valueRange.max,
                                        valueRange.mid,
                                        editingCurve["coordinate-noise-seed"]
                                      )
                                      handleFieldChange("curve-data", newData)
                                    }
                                  }}
                                  style={{ width: '100%' }}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '12px', color: '#ccc' }}>Max: {valueRange.max}</label>
                          <input
                                  type="range"
                                  min="0"
                                  max="255"
                                  value={valueRange.max}
                            onChange={(e) => {
                                    const newMax = parseInt(e.target.value)
                                    setValueRange(prev => ({ ...prev, max: newMax }))
                                    if (editingCurve && valueRange.min < newMax) {
                                      const newData = generateCurveData(
                                        curveDataMode,
                                        editingCurve["curve-width"],
                                        valueRange.min,
                                        newMax,
                                        valueRange.mid,
                                        editingCurve["coordinate-noise-seed"]
                                      )
                                      handleFieldChange("curve-data", newData)
                                    }
                                  }}
                                  style={{ width: '100%' }}
                                />
                              </div>
                            </div>
                            <div style={{ width: '100%' }}>
                              <label style={{ fontSize: '12px', color: '#ccc' }}>Mid: {valueRange.mid}</label>
                              <input
                                type="range"
                                min="0"
                                max="255"
                                value={valueRange.mid}
                                onChange={(e) => {
                                  const newMid = parseInt(e.target.value)
                                  setValueRange(prev => ({ ...prev, mid: newMid }))
                                  // Update curve data when mid value changes
                                  if (editingCurve) {
                                    const data = editingCurve["curve-data"]
                                    if (data.length > 0) {
                                      const currentAvg = data.reduce((sum, val) => sum + val, 0) / data.length
                                      const offset = newMid - currentAvg
                                      const adjustedData = data.map(value => 
                                        Math.max(0, Math.min(255, Math.floor(value + offset)))
                                      )
                                      handleFieldChange("curve-data", adjustedData)
                                    }
                                  }
                                }}
                                style={{ width: '100%' }}
                              />
                            </div>
                          </div>
                      </div>
                      
                        <div className="form-group">
                          <button
                            type="button"
                            onClick={stretchValues}
                            style={{
                              backgroundColor: '#17a2b8',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '8px 12px',
                          fontSize: '12px', 
                              cursor: 'pointer',
                              width: '100%'
                            }}
                            title="Fit values to use the min/max range"
                          >
                            Fit Values
                          </button>
                        </div>
                      </>
                      )}
                    
                                        {/* Palette selector removed - available in mapped view top area */}
                    
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
                          border: editingCurve && !validateCurveName(editingCurve["curve-name"], selectedCurve?.id || '') 
                            ? '1px solid #ff6b6b' 
                            : '1px solid #444',
                          borderRadius: '4px',
                          padding: '8px 12px'
                        }}
                      />
                      {editingCurve && !validateCurveName(editingCurve["curve-name"], selectedCurve?.id || '') && (
                        <div style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '4px' }}>
                          ⚠️ This name is already taken. Please choose a different name.
                        </div>
                      )}
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
                      <label>Coordinate Noise:</label>
                      <select
                        value={editingCurve["coordinate-noise"] || "radial"}
                        onChange={(e) => handleFieldChange("coordinate-noise", e.target.value)}
                        title="Select the coordinate noise pattern for this curve"
                        disabled={isLoadingCoordinateNoiseTypes || isSaving}
                      >
                        {isLoadingCoordinateNoiseTypes ? (
                          <option value="">Loading coordinate noise types...</option>
                        ) : isSaving ? (
                          <option value="">Saving changes...</option>
                        ) : (
                          coordinateNoiseTypesList.map((noiseType) => (
                            <option key={noiseType.id} value={noiseType.id}>
                              {noiseType.displayName}
                            </option>
                          ))
                        )}
                      </select>
                      {isSaving && (
                        <div style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '4px' }}>
                          ⚡ Auto-saving coordinate noise changes...
                        </div>
                      )}
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
                        <div>Index Scaling: <code>{editingCurve["curve-index-scaling"]}</code></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>


            </>
          )}
          
          {error && (
            <div className="error-message">
              <h3>Error</h3>
              <p>{error}</p>
              <div>
                {error.includes('API temporarily unavailable') && (
                  <button 
                    onClick={() => {
                      setError(null)
                      loadCurves(0)
                    }}
                    style={{ marginRight: '10px' }}
                  >
                    Retry Now
                  </button>
                )}
              <button onClick={() => setError(null)}>Dismiss</button>
              </div>
            </div>
          )}
        </div>
        
                {/* Canvas Area */}
        <div className="canvas-area">
          {canvasViewMode === 'curve-data' ? (
          <CurveGraph 
              curveData={editingCurve?.["curve-data"] || selectedCurve?.["curve-data"] || []}
              curveWidth={editingCurve?.["curve-width"] || selectedCurve?.["curve-width"] || 256}
            spectrum={255}
            colorMode={colorMode}
              minValue={valueRange.min}
              maxValue={valueRange.max}
              onDataPointClick={handleDataPointClick}
            />
          ) : (
            selectedCurve && coordinateNoise ? (
              <PNGGenerator
                curve={selectedCurve}
                coordinateNoise={coordinateNoise}
                onError={(error) => setPngError(error)}
                onNoiseCalcChange={async (noiseCalc) => {
                  if (editingCurve) {
                    // Update the editing curve
                    const updatedCurve = { ...editingCurve, 'noise-calc': noiseCalc }
                    setEditingCurve(updatedCurve)
                    setHasUnsavedChanges(true)
                    
                    // Auto-save the change
                    try {
                      const response = await fetch(`${apiUrl}/api/curves/${selectedCurve.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedCurve)
                      })
                      
                      if (response.ok) {
                        setSelectedCurve(updatedCurve)
                        setHasUnsavedChanges(false)
                        console.log('✅ Noise-calc auto-saved:', noiseCalc)
                      } else {
                        console.error('❌ Failed to auto-save noise-calc')
                      }
                    } catch (error) {
                      console.error('❌ Error auto-saving noise-calc:', error)
                    }
                  }
                }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#000000',
                color: '#ffffff',
                fontSize: '18px',
                border: '1px solid #333',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div>Select a curve to generate 1024×1024 PNG</div>
                {pngError && (
                  <div style={{ 
                    color: '#ff6b6b', 
                    fontSize: '14px',
                    textAlign: 'center',
                    maxWidth: '80%'
                  }}>
                    Error: {pngError}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>



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
