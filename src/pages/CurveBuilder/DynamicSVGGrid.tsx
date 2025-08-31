import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import curveDataService, { type CurveDataCell } from '../../services/curveDataService'
import visibleRectanglesService, { type VisibleRectangle, type ViewportBounds } from '../../services/visibleRectanglesService'

interface DynamicSVGGridProps {
  width?: number
  height?: number
  curveId?: string
  colorMode?: 'value' | 'index'
  spectrum?: number
  curveWidth?: number
  onCurveDataLoaded?: (data: Map<string, CurveDataCell>) => void
}

const DynamicSVGGrid: React.FC<DynamicSVGGridProps> = ({ 
  curveId, 
  colorMode = 'value', 
  spectrum = 255, 
  curveWidth = 1,
  onCurveDataLoaded 
}) => {
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 })
  const [hoveredCell, setHoveredCell] = useState<{ worldX: number; worldY: number; curveValue?: number; indexPosition?: number; isNew?: boolean } | null>(null)
  const [isLoadingCurveData, setIsLoadingCurveData] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [isOptionPressed, setIsOptionPressed] = useState(false)
  const [isZooming, setIsZooming] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  
  const CELL_SIZE = 50
  const GRID_SIZE = 512
  const TOTAL_SIZE = GRID_SIZE * CELL_SIZE // 25600
  
  // Calculate center offset to keep SVG centered in canvas
  const centerOffset = useMemo(() => {
    // Get the container dimensions (assuming 100% width/height)
    const containerWidth = window.innerWidth || 800
    const containerHeight = window.innerHeight || 600
    
    // Calculate how much to offset to center the SVG
    // The SVG center (0,0) should be at the center of the viewport
    const centerX = (containerWidth - TOTAL_SIZE) / 2
    const centerY = (containerHeight - TOTAL_SIZE) / 2
    
    return { x: centerX, y: centerY }
  }, [])
  
  // Calculate current viewport bounds
  const calculateCurrentViewportBounds = useCallback((): ViewportBounds => {
    const container = document.querySelector('.canvas-area') as HTMLElement
    if (!container) {
      console.log('⚠️ No canvas-area container found, using default bounds')
      return { minX: -10, maxX: 10, minY: -10, maxY: 10 } // Default bounds
    }

    const containerRect = container.getBoundingClientRect()
    const viewportWidth = containerRect.width
    const viewportHeight = containerRect.height

    // Calculate the visible area in world coordinates
    // Convert from pixel coordinates to world coordinates (-256 to +255)
    const visibleLeft = Math.floor((-panOffset.x - viewportWidth/2) / CELL_SIZE)
    const visibleTop = Math.floor((-panOffset.y - viewportHeight/2) / CELL_SIZE)
    const visibleRight = Math.ceil((-panOffset.x + viewportWidth/2) / CELL_SIZE)
    const visibleBottom = Math.ceil((-panOffset.y + viewportHeight/2) / CELL_SIZE)

    const bounds = {
      minX: Math.max(-256, visibleLeft),
      maxX: Math.min(255, visibleRight),
      minY: Math.max(-256, visibleTop),
      maxY: Math.min(255, visibleBottom)
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
        const curveDataMap = new Map<string, CurveDataCell>()
        const visibleRects = visibleRectanglesService.getAllVisibleRectangles()
        
        for (const [id, rect] of visibleRects) {
          if (rect.curveValue !== undefined) {
            curveDataMap.set(id, {
              rectangleId: rect.rectangleId,
              curveValue: rect.curveValue,
              indexPosition: rect.indexPosition || 0,
              worldX: rect.worldX,
              worldY: rect.worldY,
              isNew: rect.isNew
            })
          }
        }
        
        onCurveDataLoaded(curveDataMap)
      }
      
      console.log('✅ Curve data loaded for visible rectangles')
    } catch (error) {
      console.error('❌ Failed to load curve data for visible rectangles:', error)
    } finally {
      setIsLoadingCurveData(false)
    }
  }

  // Update colors from visible rectangles service
  const updateColorsFromVisibleRectangles = () => {
    visibleRectanglesService.updateColors(colorMode, spectrum, curveWidth)
  }

  // Load initial curve data for the entire grid
  const loadInitialCurveData = async () => {
    if (!curveId) return

    setIsLoadingCurveData(true)
    try {
      console.log('🔄 Loading initial curve data for grid')
      
      // Calculate grid bounds based on current grid data
      const minX = -64
      const maxX = 63
      const minY = -64
      const maxY = 63

      const data = await curveDataService.fetchCurveData(curveId, minX, minY, maxX, maxY)
      const curveName = Object.keys(data)[0]
      
      if (data[curveName]) {
        curveDataService.updateLocalDataArray(curveName, data[curveName])
        updateColorsFromCurveData()
        
        // Notify parent component
        if (onCurveDataLoaded) {
          onCurveDataLoaded(curveDataService.getAllCurveData())
        }
        
        console.log('✅ Initial curve data loaded successfully')
      }
    } catch (error) {
      console.error('❌ Failed to load initial curve data:', error)
    } finally {
      setIsLoadingCurveData(false)
    }
  }

  // Update colors based on current curve data
  const updateColorsFromCurveData = () => {
    const colorMap = curveDataService.applyColorsToRectangles(colorMode, spectrum, curveWidth)
    
    // Update grid data with new colors
    setGridData(prevData => {
      const newData = prevData.map(row => row.map(cell => {
        const rectangleId = `square-${cell.worldX}-${cell.worldY}`
        const curveData = curveDataService.getCellData(rectangleId)
        
        if (curveData) {
          // Parse color string to RGB values
          const colorMatch = colorMap.get(rectangleId)?.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
          if (colorMatch) {
            return {
              ...cell,
              fillR: parseInt(colorMatch[1]),
              fillG: parseInt(colorMatch[2]),
              fillB: parseInt(colorMatch[3])
            }
          }
        }
        
        return cell
      }))
      
      return newData
    })
  }
  
  // Grid data with proper initialization
  const [gridData, setGridData] = useState<Array<Array<{ fillR: number; fillG: number; fillB: number; worldX: number; worldY: number; isNew?: boolean }>>>(() => {
    const data: Array<Array<{ fillR: number; fillG: number; fillB: number; worldX: number; worldY: number; isNew?: boolean }>> = []
    
    // Initialize with center area (-64 to +63)
    for (let y = 0; y < GRID_SIZE; y++) {
      const row: Array<{ fillR: number; fillG: number; fillB: number; worldX: number; worldY: number; isNew?: boolean }> = []
      for (let x = 0; x < GRID_SIZE; x++) {
        const worldX = x - 64 // Convert to -64 to +63 range
        const worldY = y - 64 // Convert to -64 to +63 range
        
        // Random RGB values for initial grid
        const fillR = Math.floor(Math.random() * 256)
        const fillG = Math.floor(Math.random() * 256)
        const fillB = Math.floor(Math.random() * 256)
        
        row.push({ fillR, fillG, fillB, worldX, worldY, isNew: false })
      }
      data.push(row)
    }
    
    return data
  })
  
  // Calculate how many rows/columns need to be added/removed after drag
  const calculateGridChanges = (startOffset: { x: number; y: number }, endOffset: { x: number; y: number }) => {
    const startGridX = Math.floor(-startOffset.x / CELL_SIZE)
    const startGridY = Math.floor(-startOffset.y / CELL_SIZE)
    const endGridX = Math.floor(-endOffset.x / CELL_SIZE)
    const endGridY = Math.floor(-endOffset.y / CELL_SIZE)
    
    const deltaX = endGridX - startGridX
    const deltaY = endGridY - startGridY
    
    return {
      addColumns: Math.max(0, deltaX),
      removeColumns: Math.max(0, -deltaX),
      addRows: Math.max(0, deltaY),
      removeRows: Math.max(0, -deltaY)
    }
  }
  
  // Apply grid changes after drag ends
  const applyGridChanges = async (changes: { addColumns: number; removeColumns: number; addRows: number; removeRows: number }) => {
    let newCells: Array<{ worldX: number; worldY: number }> = []
    
    setGridData(prevData => {
      let newData = prevData.map(row => [...row]) // Deep copy
      newCells = []
      
      // Apply column changes
      if (changes.addColumns > 0) {
        // Add columns to the right
        for (let y = 0; y < GRID_SIZE; y++) {
          for (let i = 0; i < changes.addColumns; i++) {
            const lastWorldX = newData[y][GRID_SIZE - 1].worldX
            const fillR = Math.floor(Math.random() * 256)
            const fillG = Math.floor(Math.random() * 256)
            const fillB = Math.floor(Math.random() * 256)
            const newCell = { 
              fillR, fillG, fillB, 
              worldX: lastWorldX + 1, 
              worldY: newData[y][0].worldY,
              isNew: true
            }
            newData[y].push(newCell)
            newCells.push({ worldX: newCell.worldX, worldY: newCell.worldY })
          }
          // Remove excess columns from left
          newData[y] = newData[y].slice(changes.addColumns)
        }
      } else if (changes.removeColumns > 0) {
        // Add columns to the left
        for (let y = 0; y < GRID_SIZE; y++) {
          for (let i = 0; i < changes.removeColumns; i++) {
            const firstWorldX = newData[y][0].worldX
            const fillR = Math.floor(Math.random() * 256)
            const fillG = Math.floor(Math.random() * 256)
            const fillB = Math.floor(Math.random() * 256)
            const newCell = { 
              fillR, fillG, fillB, 
              worldX: firstWorldX - 1, 
              worldY: newData[y][0].worldY,
              isNew: true
            }
            newData[y].unshift(newCell)
            newCells.push({ worldX: newCell.worldX, worldY: newCell.worldY })
          }
          // Remove excess columns from right
          newData[y] = newData[y].slice(0, GRID_SIZE)
        }
      }
      
      // Apply row changes
      if (changes.addRows > 0) {
        // Add rows to the bottom
        for (let i = 0; i < changes.addRows; i++) {
          const lastWorldY = newData[GRID_SIZE - 1][0].worldY
          const newRow: Array<{ fillR: number; fillG: number; fillB: number; worldX: number; worldY: number; isNew?: boolean }> = []
          for (let x = 0; x < GRID_SIZE; x++) {
            const fillR = Math.floor(Math.random() * 256)
            const fillG = Math.floor(Math.random() * 256)
            const fillB = Math.floor(Math.random() * 256)
            const newCell = { 
              fillR, fillG, fillB, 
              worldX: newData[0][x].worldX, 
              worldY: lastWorldY + 1,
              isNew: true
            }
            newRow.push(newCell)
            newCells.push({ worldX: newCell.worldX, worldY: newCell.worldY })
          }
          newData.push(newRow)
        }
        // Remove excess rows from top
        newData = newData.slice(changes.addRows)
      } else if (changes.removeRows > 0) {
        // Add rows to the top
        for (let i = 0; i < changes.removeRows; i++) {
          const firstWorldY = newData[0][0].worldY
          const newRow: Array<{ fillR: number; fillG: number; fillB: number; worldX: number; worldY: number; isNew?: boolean }> = []
          for (let x = 0; x < GRID_SIZE; x++) {
            const fillR = Math.floor(Math.random() * 256)
            const fillG = Math.floor(Math.random() * 256)
            const fillB = Math.floor(Math.random() * 256)
            const newCell = { 
              fillR, fillG, fillB, 
              worldX: newData[0][x].worldX, 
              worldY: firstWorldY - 1,
              isNew: true
            }
            newRow.push(newCell)
            newCells.push({ worldX: newCell.worldX, worldY: newCell.worldY })
          }
          newData.unshift(newRow)
        }
        // Remove excess rows from bottom
        newData = newData.slice(0, GRID_SIZE)
      }
      
      return newData
    })
    
    // Update curve data service structure
    curveDataService.updateArrayStructure(changes, gridData)
    
    // Fetch curve data for new cells if curve is loaded
    if (curveId && newCells.length > 0) {
      try {
        await curveDataService.fetchDataForNewCells(curveId, newCells)
        updateColorsFromCurveData()
      } catch (error) {
        console.error('❌ Failed to fetch data for new cells:', error)
      }
    }
    
    // Adjust pan offset to maintain visual consistency
    setPanOffset(prevOffset => {
      let newOffset = { ...prevOffset }
      
      // When we add columns to the right, we need to move the view right to keep existing cells in place
      if (changes.addColumns > 0) {
        newOffset.x -= changes.addColumns * CELL_SIZE
      }
      // When we add columns to the left, we need to move the view left to keep existing cells in place
      else if (changes.removeColumns > 0) {
        newOffset.x += changes.removeColumns * CELL_SIZE
      }
      
      // When we add rows to the bottom, we need to move the view down to keep existing cells in place
      if (changes.addRows > 0) {
        newOffset.y += changes.addRows * CELL_SIZE
      }
      // When we add rows to the top, we need to move the view up to keep existing cells in place
      else if (changes.removeRows > 0) {
        newOffset.y -= changes.removeRows * CELL_SIZE
      }
      
      return newOffset
    })
  }
  
  const handleMouseDown = (event: React.MouseEvent) => {
    console.log('🖱️ Mouse down:', event.clientX, event.clientY)
    setIsDragging(true)
    setLastMousePos({ x: event.clientX, y: event.clientY })
    setDragStartOffset({ ...panOffset }) // Store the starting position
  }
  
  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging) return
    
    const deltaX = event.clientX - lastMousePos.x
    const deltaY = event.clientY - lastMousePos.y
    
    console.log('🖱️ Mouse move:', deltaX, deltaY, 'panOffset:', panOffset)
    
    setPanOffset(prev => ({
      x: prev.x + deltaX, // Swapped direction for left/right
      y: prev.y + deltaY  // Keep up/down as is
    }))
    
    setLastMousePos({ x: event.clientX, y: event.clientY })
  }
  
  const handleMouseUp = async () => {
    console.log('🖱️ Mouse up, isDragging:', isDragging, 'isZooming:', isZooming)
    if (isDragging && !isZooming) {
      // Update viewport bounds in visible rectangles service
      const newViewportBounds = calculateCurrentViewportBounds()
      await visibleRectanglesService.updateViewportBounds(newViewportBounds, curveId)
      
      // Update colors for any new rectangles
      updateColorsFromVisibleRectangles()
    }
    
    setIsDragging(false)
  }
  
  const handleMouseLeave = () => {
    if (isDragging) {
      handleMouseUp()
    }
  }

  const handleCellMouseEnter = (worldX: number, worldY: number) => {
    if (!isDragging && !isZooming) {
      const rectangleId = `square-${worldX}-${worldY}`
      const rectData = visibleRectanglesService.getRectangleData(rectangleId)
      
      setHoveredCell({
        worldX,
        worldY,
        curveValue: rectData?.curveValue,
        indexPosition: rectData?.indexPosition,
        isNew: rectData?.isNew
      })
    }
  }

  const handleCellMouseLeave = () => {
    if (!isDragging && !isZooming) {
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
      const pixelX = (worldX + 256) * CELL_SIZE // Convert from world coords to pixel coords (-256 to +255)
      const pixelY = (worldY + 256) * CELL_SIZE
      
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
      style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <svg 
        width={TOTAL_SIZE} 
        height={TOTAL_SIZE}
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          transformOrigin: 'center',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <pattern id="grid" width={CELL_SIZE} height={CELL_SIZE} patternUnits="userSpaceOnUse">
            <path d={`M ${CELL_SIZE} 0 L 0 0 0 ${CELL_SIZE}`} fill="none" stroke="#00ffff" strokeWidth="1"/>
          </pattern>
        </defs>
        
        {/* Background with grid pattern */}
        <rect width={TOTAL_SIZE} height={TOTAL_SIZE} fill="url(#grid)" x="0" y="0"/>
        
        {/* Center square indicator */}
        <rect
          id="center-square"
          data-coordinates="0,0"
          x={256 * CELL_SIZE}
          y={256 * CELL_SIZE}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="none"
          stroke="#ff0000"
          strokeWidth="2"
          strokeDasharray="5,5"
        />
        
        {/* Only render rectangles that exist in the data */}
        {visibleSquares}
        
        {/* Test rectangle to verify SVG is working */}
        <rect
          x={12800}
          y={12800}
          width={50}
          height={50}
          fill="red"
          stroke="yellow"
          strokeWidth="3"
        />
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
            {hoveredCell.isNew && 'New cell'}
          </>
        )}
      </div>
    </div>
  )
}

export default DynamicSVGGrid
