import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import visibleRectanglesService, { type VisibleRectangle, type ViewportBounds } from '../../services/visibleRectanglesService'
import curveDataService, { type CurveDataCell } from '../../services/curveDataService'
import { apiUrl } from '../../config/environments'

interface DynamicSVGGridProps {
  curveId?: string
  colorMode: 'value' | 'index'
  spectrum: number
  curveWidth: number
  onCurveDataLoaded?: (cells: CurveDataCell[]) => void
}

const CELL_SIZE = 50
const GRID_SIZE = 128
const TOTAL_SIZE = GRID_SIZE * CELL_SIZE // 6400

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
  const [hoveredCell, setHoveredCell] = useState<VisibleRectangle | null>(null)
  
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
    
    // Center the grid by offsetting by half the container size
    const centerX = (containerWidth - TOTAL_SIZE) / 2
    const centerY = (containerHeight - TOTAL_SIZE) / 2
    
    return { x: centerX, y: centerY }
  }, [])

  // Calculate current viewport bounds based on pan offset and container size
  const calculateCurrentViewportBounds = useCallback(() => {
    if (!containerRef.current) return { minX: -10, maxX: 10, minY: -10, maxY: 10 }
    
    const container = containerRef.current
    const viewportWidth = container.clientWidth
    const viewportHeight = container.clientHeight
    
    // Convert pixel coordinates to world coordinates
    const visibleLeft = Math.floor((-panOffset.x) / CELL_SIZE)
    const visibleRight = Math.floor((-panOffset.x + viewportWidth) / CELL_SIZE)
    const visibleTop = Math.floor((-panOffset.y) / CELL_SIZE)
    const visibleBottom = Math.floor((-panOffset.y + viewportHeight) / CELL_SIZE)
    
    const bounds = {
      minX: Math.max(-128, visibleLeft),
      maxX: Math.min(127, visibleRight),
      minY: Math.max(-128, visibleTop),
      maxY: Math.min(127, visibleBottom)
    }

    console.log('🔍 Calculated viewport bounds:', bounds, 'from panOffset:', panOffset, 'container:', { width: viewportWidth, height: viewportHeight })
    return bounds
  }, [panOffset])

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
    
    setIsLoadingCurveData(true)
    try {
      await visibleRectanglesService.loadCurveData(curveId)
      updateColorsFromVisibleRectangles()
      
      // Notify parent component
      if (onCurveDataLoaded) {
        // Convert VisibleRectangle to CurveDataCell for compatibility
        const cells: CurveDataCell[] = []
        const visibleRects = visibleRectanglesService.getAllVisibleRectangles()
        
                 for (const [_, rect] of visibleRects) {
           cells.push({
             rectangleId: rect.rectangleId,
             worldX: rect.worldX,
             worldY: rect.worldY,
             curveValue: rect.curveValue || 0,
             indexPosition: rect.indexPosition || 0,
             isNew: rect.isNew
           })
         }
        
        onCurveDataLoaded(cells)
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
    console.log('🖱️ Mouse down')
    if (e.button === 0) { // Left click only
      setIsDragging(true)
      setLastMousePos({ x: e.clientX, y: e.clientY })
      setDragStartOffset({ ...panOffset })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && !isZooming) {
      const deltaX = e.clientX - lastMousePos.x
      const deltaY = e.clientY - lastMousePos.y
      
      setPanOffset({
        x: dragStartOffset.x + deltaX,
        y: dragStartOffset.y + deltaY
      })
    }
  }

  const handleMouseUp = async () => {
    console.log('🖱️ Mouse up, isDragging:', isDragging, 'isZooming:', isZooming)
    if (isDragging && !isZooming) {
      // Update viewport bounds in visible rectangles service
      const newViewportBounds = calculateCurrentViewportBounds()
      console.log('🔄 Updating viewport bounds after drag:', newViewportBounds)
      await visibleRectanglesService.updateViewportBounds(newViewportBounds, curveId)
      
      // Update colors for any new rectangles
      updateColorsFromVisibleRectangles()
    }
    
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
  }

  // Handle cell hover
  const handleCellMouseEnter = (worldX: number, worldY: number) => {
    if (!isDragging) {
             const rectData = visibleRectanglesService.getRectangleData(`square-${worldX}-${worldY}`)
      if (rectData) {
        setHoveredCell(rectData)
      }
    }
  }

  const handleCellMouseLeave = () => {
    if (!isDragging) {
      setHoveredCell(null)
    }
  }
  
  // Generate visible squares from visible rectangles service
  const visibleSquares = useMemo(() => {
    const squares: JSX.Element[] = []
    const visibleRects = visibleRectanglesService.getAllVisibleRectangles()
    
    console.log('🎨 Generating visible squares:', visibleRects.size, 'rectangles')
    
    // Only create rectangles for coordinates that exist in the data
    // No fallback - if no data exists, no rectangles are rendered
    for (const [rectangleId, rect] of visibleRects) {
      const { worldX, worldY, fillR, fillG, fillB, isNew } = rect
      
      // Calculate pixel position based on world coordinates
      // The SVG is fixed at 6400x6400, rectangles are positioned absolutely
      // Center is at (128, 128) in pixel coordinates
      const pixelX = (worldX + 128) * CELL_SIZE
      const pixelY = (worldY + 128) * CELL_SIZE
      
      // Debug coordinate conversion
      if (squares.length < 3) {
        console.log('📍 Coordinate conversion:', {
          worldX,
          worldY,
          pixelX,
          pixelY,
          cellSize: CELL_SIZE,
          offset: 256
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
          onMouseEnter={() => handleCellMouseEnter(worldX, worldY)}
          onMouseLeave={handleCellMouseLeave}
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
        minHeight: '600px',
        overflow: 'hidden',
        position: 'relative',
        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        transformOrigin: 'center',
        cursor: isDragging ? 'grabbing' : 'grab',
        border: '2px solid blue'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
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
        
        {/* Test rectangle to verify SVG is working */}
        <rect 
          x="6400" 
          y="6400" 
          width="200" 
          height="200" 
          fill="red" 
          stroke="yellow" 
          strokeWidth="5"
        />
        
        {/* Center square indicator */}
        <rect
          id="center-square"
          data-coordinates="0,0"
          x={128 * CELL_SIZE}
          y={128 * CELL_SIZE}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="none"
          stroke="#ff0000"
          strokeWidth="2"
          strokeDasharray="5,5"
        />
        
        {/* Only render rectangles that exist in the data */}
        {visibleSquares}
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
        {isOptionPressed && '🔍 Option + Scroll to zoom'}<br/>
        {hoveredCell && (
          <>
            Hover: ({hoveredCell.worldX}, {hoveredCell.worldY})<br/>
            {hoveredCell.curveValue !== undefined && `Value: ${hoveredCell.curveValue}`}<br/>
            {hoveredCell.indexPosition !== undefined && `Index: ${hoveredCell.indexPosition}`}<br/>
            {hoveredCell.isNew && '🆕 New Cell'}<br/>
          </>
        )}
      </div>
    </div>
  )
}

export default DynamicSVGGrid
