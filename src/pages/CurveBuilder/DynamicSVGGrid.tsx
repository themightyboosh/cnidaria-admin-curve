import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import visibleRectanglesService, { type VisibleRectangle, type ViewportBounds } from '../../services/visibleRectanglesService'
import curveDataService, { type CurveDataCell } from '../../services/curveDataService'
import { apiUrl } from '../../config/environments'

interface DynamicSVGGridProps {
  curveId?: string
  colorMode: 'value' | 'index'
  spectrum: number
  curveWidth: number
  onCurveDataLoaded?: (cells: Map<string, CurveDataCell>) => void
}

const CELL_SIZE = 10 // 10x10 units in SVG coordinates
const GRID_SIZE = 128
const TOTAL_SIZE = 1280 // 1280x1280 units total

const DynamicSVGGrid: React.FC<DynamicSVGGridProps> = ({ 
  curveId, 
  colorMode, 
  spectrum, 
  curveWidth, 
  onCurveDataLoaded 
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [isZooming, setIsZooming] = useState(false)
  const [isOptionPressed, setIsOptionPressed] = useState(false)
  const [isLoadingCurveData, setIsLoadingCurveData] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [zoomLevel, setZoomLevel] = useState(0.9)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 })
  
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate center offset to center the grid
  const centerOffset = useMemo(() => {
    if (!containerRef.current) return { x: 0, y: 0 }
    
    const container = containerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    
    // Center the SVG so it fills the viewport
    // The SVG should be positioned so its center aligns with the container center
    const centerX = (containerWidth - TOTAL_SIZE) / 2
    const centerY = (containerHeight - TOTAL_SIZE) / 2
    
    console.log('🎯 Center offset calculated:', { centerX, centerY, containerWidth, containerHeight, totalSize: TOTAL_SIZE })
    return { x: centerX, y: centerY }
  }, [])

  // Calculate current viewport bounds based on pan offset and container size
  const calculateCurrentViewportBounds = useCallback(() => {
    if (!containerRef.current) return { minX: -10, maxX: 10, minY: -10, maxY: 10 }
    
    const container = containerRef.current
    const viewportWidth = container.clientWidth
    const viewportHeight = container.clientHeight
    
    // Convert pixel coordinates to world coordinates
    // The viewport group is moving via transform, so we calculate what's visible
    const scaledCellSize = CELL_SIZE * zoomLevel
    
    // Calculate the visible area in world coordinates
    // panOffset represents how much the viewport group has moved
    const visibleLeft = Math.floor((-panOffset.x) / scaledCellSize)
    const visibleRight = Math.floor((-panOffset.x + viewportWidth) / scaledCellSize)
    const visibleTop = Math.floor((-panOffset.y) / scaledCellSize)
    const visibleBottom = Math.floor((-panOffset.y + viewportHeight) / scaledCellSize)
    
    const bounds = {
      minX: Math.max(-64, visibleLeft),
      maxX: Math.min(63, visibleRight),
      minY: Math.max(-64, visibleTop),
      maxY: Math.min(63, visibleBottom)
    }

    console.log('🔍 Calculated viewport bounds:', bounds, 'from panOffset:', panOffset, 'zoomLevel:', zoomLevel, 'container:', { width: viewportWidth, height: viewportHeight })
    return bounds
  }, [panOffset, zoomLevel])

  // Initialize pan offset to center the grid and visible rectangles
  useEffect(() => {
    setPanOffset(centerOffset)
    
    // Initialize visible rectangles service with current viewport
    if (!isInitialized) {
      // Calculate the visible viewport and add 5 coordinates buffer in all directions
      const viewportBounds = calculateCurrentViewportBounds()
      const bufferedViewportBounds = {
        minX: viewportBounds.minX - 5,
        maxX: viewportBounds.maxX + 5,
        minY: viewportBounds.minY - 5,
        maxY: viewportBounds.maxY + 5
      }
      console.log('🔧 Initializing with buffered viewport bounds:', bufferedViewportBounds, '(original:', viewportBounds, ')')
      visibleRectanglesService.initializeVisibleRectangles(bufferedViewportBounds)
      setIsInitialized(true)
      console.log('🚀 Initialized visible rectangles service')
    }
  }, [centerOffset, isInitialized, calculateCurrentViewportBounds])

  // Load initial curve data when curveId is provided
  useEffect(() => {
    if (curveId && isInitialized) {
      loadCurveDataForVisibleRectangles()
    }
  }, [curveId, isInitialized])

  // Update colors when color mode or spectrum changes
  useEffect(() => {
    if (curveId && isInitialized) {
      updateColorsFromVisibleRectangles()
    }
  }, [colorMode, spectrum, curveWidth, curveId, isInitialized])

  // Handle keyboard events for Option key and wheel zoom
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
        setIsZooming(true)
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        setZoomLevel(prevZoom => {
          const newZoom = prevZoom + delta
          return Math.max(0.1, Math.min(1, newZoom))
        })
        
        // Reset zooming state after a short delay
        setTimeout(() => {
          setIsZooming(false)
        }, 100)
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

    // Load curve data for visible rectangles
  const loadCurveDataForVisibleRectangles = async () => {
    if (!curveId) return
    
    console.log('🔄 Starting to load curve data for curveId:', curveId)
    setIsLoadingCurveData(true)
    try {
      await visibleRectanglesService.loadCurveData(curveId)
      console.log('✅ Curve data loaded from service, updating colors...')
      updateColorsFromVisibleRectangles()
      
      // Notify parent component
      if (onCurveDataLoaded) {
        // Convert VisibleRectangle to CurveDataCell for compatibility
        const curveDataMap = new Map<string, CurveDataCell>()
        const visibleRects = visibleRectanglesService.getAllVisibleRectangles()
        
        for (const [_, rect] of visibleRects) {
          curveDataMap.set(rect.rectangleId, {
            rectangleId: rect.rectangleId,
            worldX: rect.worldX,
            worldY: rect.worldY,
            curveValue: rect.curveValue || 0,
            indexPosition: rect.indexPosition || 0,
            isNew: rect.isNew
          })
        }
        
        onCurveDataLoaded(curveDataMap)
      }
      
      console.log('✅ Curve data loaded for SVG grid:', visibleRectanglesService.getCount(), 'cells')
    } catch (error) {
      console.error('❌ Failed to load curve data:', error)
    } finally {
      setIsLoadingCurveData(false)
    }
  }

  // Update colors from visible rectangles
  const updateColorsFromVisibleRectangles = () => {
    visibleRectanglesService.updateColors(colorMode, spectrum, curveWidth)
  }

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    console.log('🖱️ Mouse down at:', e.clientX, e.clientY, 'button:', e.button)
    if (e.button === 0) { // Left click only
      e.preventDefault() // Prevent text selection
      setIsDragging(true)
      setLastMousePos({ x: e.clientX, y: e.clientY })
      setDragStartOffset({ ...panOffset })
      console.log('🖱️ Started dragging, panOffset:', panOffset)
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && !isZooming) {
      e.preventDefault() // Prevent text selection
      const deltaX = e.clientX - lastMousePos.x
      const deltaY = e.clientY - lastMousePos.y
      
      const newPanOffset = {
        x: dragStartOffset.x + deltaX,
        y: dragStartOffset.y + deltaY
      }
      
      setPanOffset(newPanOffset)
      
      // Update last mouse position for next move
      setLastMousePos({ x: e.clientX, y: e.clientY })
      
      console.log('🖱️ Mouse move - delta:', deltaX, deltaY, 'new panOffset:', newPanOffset)
    }
  }

  const handleMouseUp = async () => {
    console.log('🖱️ Mouse up, isDragging:', isDragging, 'isZooming:', isZooming)
    if (isDragging && !isZooming) {
      // Update viewport bounds in visible rectangles service
      const newViewportBounds = calculateCurrentViewportBounds()
      console.log('🔄 Updating viewport bounds after drag:', newViewportBounds)
      console.log('🔄 Current panOffset:', panOffset)
      
      await visibleRectanglesService.updateViewportBounds(newViewportBounds, curveId)
      
      // Update colors for any new rectangles
      updateColorsFromVisibleRectangles()
    }
    
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
  }

  
  
  // Generate visible squares from visible rectangles service
  const visibleSquares = useMemo(() => {
    const squares: JSX.Element[] = []
    const visibleRects = visibleRectanglesService.getAllVisibleRectangles()
    
    console.log('🎨 Generating visible squares:', visibleRects.size, 'rectangles')
    
    // Debug: show first few rectangle IDs
    const rectIds = Array.from(visibleRects.keys()).slice(0, 5)
    console.log('🔍 First few rectangle IDs:', rectIds)
    
    // Only create rectangles for coordinates that exist in the data
    // No fallback - if no data exists, no rectangles are rendered
    for (const [rectangleId, rect] of visibleRects) {
      const { worldX, worldY, fillR, fillG, fillB, isNew } = rect
      
      // Calculate position based on world coordinates
      // Mapping: (X+64)*10, (Y+64)*10 for -64 to +63 range
      const pixelX = (worldX + 64) * CELL_SIZE
      const pixelY = (worldY + 64) * CELL_SIZE
      
      // Debug coordinate conversion
      if (squares.length < 3) {
        console.log('📍 Coordinate conversion:', {
          worldX,
          worldY,
          pixelX,
          pixelY,
          cellSize: CELL_SIZE,
          offset: 64
        })
      }
      
      const uniqueKey = `visible-${worldX}-${worldY}`
      const isCenter = worldX === 0 && worldY === 0
      
      const fillColor = `rgb(${fillR},${fillG},${fillB})`
      const strokeColor = isCenter ? '#ff0000' : '#00ffff'
      
      // Debug first few rectangles
      if (squares.length < 5) {
        console.log('🔍 Rectangle:', {
          rectangleId,
          worldX,
          worldY,
          pixelX,
          pixelY,
          fillColor,
          isCenter
        })
      }
      
      squares.push(
        <rect
          key={uniqueKey}
          id={rectangleId}
          data-coordinates={`${worldX},${worldY}`}
          data-is-new={isNew ? 'true' : 'false'}
          x={pixelX}
          y={pixelY}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={isCenter ? 2 : 1}
          strokeDasharray={isCenter ? '5,5' : 'none'}
        />
      )
    }
    
    console.log('🎨 Generated', squares.length, 'squares')
    return squares
  }, [isDragging, isInitialized])
  
  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden',
        position: 'relative',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
              onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={() => console.log('🖱️ Mouse entered container')}
    >
      <svg 
        width={TOTAL_SIZE} 
        height={TOTAL_SIZE}
      >
        <defs>
          <pattern id="grid" width={CELL_SIZE} height={CELL_SIZE} patternUnits="userSpaceOnUse">
            <path d={`M ${CELL_SIZE} 0 L 0 0 0 ${CELL_SIZE}`} fill="none" stroke="#00ffff" strokeWidth="1"/>
          </pattern>
        </defs>
        
        {/* Background with grid pattern */}
        <rect width={TOTAL_SIZE} height={TOTAL_SIZE} fill="url(#grid)" x="0" y="0"/>
        
        {/* Viewport group with transform */}
        <g 
          id="viewport"
          transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}
        >
          {/* Center square indicator */}
          <rect
            id="center-square"
            data-coordinates="0,0"
            x={64 * CELL_SIZE}
            y={64 * CELL_SIZE}
            width={CELL_SIZE}
            height={CELL_SIZE}
            fill="none"
            stroke="#ff0000"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          
          {/* Only render rectangles that exist in the data */}
          {visibleSquares}
        </g>
      </svg>
      
      {/* Debug info */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '5px',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}>
        Pan: ({panOffset.x.toFixed(0)}, {panOffset.y.toFixed(0)})<br/>
        Zoom: {(zoomLevel * 100).toFixed(0)}%<br/>
        Grid Center: ({Math.floor(-panOffset.x / CELL_SIZE)}, {Math.floor(-panOffset.y / CELL_SIZE)})<br/>
        Visible Rectangles: {visibleRectanglesService.getCount()}<br/>
        Rendered: {visibleSquares.length}<br/>
        Status: {isDragging ? 'Dragging' : isZooming ? 'Zooming' : 'Ready'}<br/>
        {curveId && `Curve: ${curveId}`}<br/>
        {isLoadingCurveData && 'Loading curve data...'}<br/>
        {isOptionPressed && '🔍 Option + Scroll to zoom'}
      </div>
    </div>
  )
}

export default DynamicSVGGrid
