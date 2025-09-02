import React, { useRef, useEffect, useState, useMemo } from 'react'

interface CellColor {
  x: number
  y: number
  color: string
}

interface SimpleThreeJSGridProps {
  cellColors?: CellColor[]
  onCellCountChange?: (count: { x: number, y: number }) => void
  onGridBoundsChange?: (bounds: { minX: number, maxX: number, minY: number, maxY: number }) => void
  selectedCurveId?: string // Track when curve changes to clear cache
}

const SimpleThreeJSGrid: React.FC<SimpleThreeJSGridProps> = ({ 
  cellColors = [], 
  onCellCountChange,
  onGridBoundsChange,
  selectedCurveId
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Fixed cell size
  const CELL_SIZE = 50 // Each square is 50px
  const EXTENSION_CELLS = 30 // Extend 30 cells in each direction beyond viewport

  // Pan state
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })

  // Dynamic grid dimensions based on viewport + extension
  const [gridDimensions, setGridDimensions] = useState<{ width: number, height: number }>({ width: 60, height: 60 })
  const [lastProcessedBounds, setLastProcessedBounds] = useState<{ minX: number, maxX: number, minY: number, maxY: number }>({ minX: -30, maxX: 30, minY: -30, maxY: 30 })

  // Permanent color cache - only clears when new curve is loaded
  const colorCacheRef = useRef<Map<string, string>>(new Map())
  const lastCurveIdRef = useRef<string>('')
  
  // Memoized color processing - only updates when new colors are provided or curve changes
  const processedColors = useMemo(() => {
    console.log('🎨 Processing colors with curve-based cache...')
    
    // Clear cache if curve changed
    if (selectedCurveId && selectedCurveId !== lastCurveIdRef.current) {
      console.log(`🔄 New curve loaded: ${selectedCurveId}, clearing color cache`)
      colorCacheRef.current.clear()
      setPanOffset({ x: 0, y: 0 }) // Reset pan to center
      lastCurveIdRef.current = selectedCurveId
    }
    
    const newColors: CellColor[] = []
    const cache = colorCacheRef.current
    
    cellColors.forEach(({ x, y, color }) => {
      const key = `${x},${y}`
      
      // If color is not in cache, add it permanently
      if (!cache.has(key)) {
        cache.set(key, color)
        console.log(`🔒 Caching color for cell (${x},${y}): ${color}`)
      }
      
      // Always use cached color (never recalculate)
      const cachedColor = cache.get(key)!
      newColors.push({ x, y, color: cachedColor })
    })
    
    console.log(`📊 Color cache stats: ${cache.size} cached colors, ${newColors.length} processed`)
    return newColors
  }, [cellColors, selectedCurveId])

  // Calculate dynamic grid size based on container dimensions + extension
  const calculateGridSize = (containerWidth: number, containerHeight: number) => {
    const viewportCellsX = Math.ceil(containerWidth / CELL_SIZE)
    const viewportCellsY = Math.ceil(containerHeight / CELL_SIZE)
    
    // Add extension cells in each direction
    const totalCellsX = viewportCellsX + (EXTENSION_CELLS * 2)
    const totalCellsY = viewportCellsY + (EXTENSION_CELLS * 2)
    
    return {
      width: totalCellsX,
      height: totalCellsY
    }
  }

  // Calculate current visible bounds based on pan offset
  const calculateVisibleBounds = () => {
    if (!containerRef.current) return { minX: -30, maxX: 30, minY: -30, maxY: 30 }
    
    const containerWidth = containerRef.current.clientWidth
    const containerHeight = containerRef.current.clientHeight
    
    // Calculate viewport bounds in world coordinates
    const viewportCellsX = Math.ceil(containerWidth / CELL_SIZE)
    const viewportCellsY = Math.ceil(containerHeight / CELL_SIZE)
    
    // Calculate center of viewport in world coordinates
    const centerX = Math.floor(panOffset.x / CELL_SIZE)
    const centerY = Math.floor(panOffset.y / CELL_SIZE)
    
    // Calculate bounds with extension
    const halfViewportX = Math.floor(viewportCellsX / 2)
    const halfViewportY = Math.floor(viewportCellsY / 2)
    
    const minX = centerX - halfViewportX - EXTENSION_CELLS
    const maxX = centerX + halfViewportX + EXTENSION_CELLS
    const minY = centerY - halfViewportY - EXTENSION_CELLS
    const maxY = centerY + halfViewportY + EXTENSION_CELLS
    
    return { minX, maxX, minY, maxY }
  }

  // Handle mouse events for panning
  const handleMouseDown = (event: React.MouseEvent) => {
    setIsDragging(true)
    setLastMousePos({ x: event.clientX, y: event.clientY })
    console.log('🖱️ Mouse down - starting pan')
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging) return
    
    const deltaX = event.clientX - lastMousePos.x
    const deltaY = event.clientY - lastMousePos.y
    
    setPanOffset(prev => {
      const newOffset = {
        x: prev.x - deltaX, // REVERSED: Drag left = grid moves left, drag right = grid moves right
        y: prev.y + deltaY  // Keep Y the same
      }
      console.log('🖱️ Panning to:', newOffset, 'delta:', { deltaX, deltaY })
      return newOffset
    })
    
    setLastMousePos({ x: event.clientX, y: event.clientY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    console.log('🖱️ Mouse up - stopping pan')
  }

  useEffect(() => {
    console.log('🔵 SimpleThreeJSGrid: Compound SVG grid started')
    
    if (!containerRef.current) {
      console.log('❌ Container ref is null')
      return
    }

    // Get container dimensions
    const containerWidth = containerRef.current.clientWidth
    const containerHeight = containerRef.current.clientHeight
    
    console.log('📏 Container dimensions:', { containerWidth, containerHeight })

    if (containerWidth === 0 || containerHeight === 0) {
      console.log('⚠️ Container has zero dimensions, waiting...')
      setTimeout(() => {
        if (containerRef.current) {
          const newWidth = containerRef.current.clientWidth
          const newHeight = containerRef.current.clientHeight
          console.log('🔄 Retry container dimensions:', { newWidth, newHeight })
        }
      }, 100)
      return
    }

    // Calculate dynamic grid size
    const dynamicGridSize = calculateGridSize(containerWidth, containerHeight)
    
    // Only update state if grid size actually changed
    if (gridDimensions.width !== dynamicGridSize.width || gridDimensions.height !== dynamicGridSize.height) {
      setGridDimensions(dynamicGridSize)
    }
    
    console.log('🎬 Creating compound SVG grid...')

    // Update grid info
    onCellCountChange?.({ x: dynamicGridSize.width, y: dynamicGridSize.height })
    
    // Calculate initial visible bounds
    const visibleBounds = calculateVisibleBounds()
    
    // Only call onGridBoundsChange if bounds actually changed
    const currentBoundsString = JSON.stringify(visibleBounds)
    const lastBoundsString = JSON.stringify(lastProcessedBounds)
    if (currentBoundsString !== lastBoundsString) {
      onGridBoundsChange?.(visibleBounds)
      setLastProcessedBounds(visibleBounds)
    }

    console.log('🎨 Compound SVG grid created:', {
      resolution: [containerWidth, containerHeight],
      gridSize: dynamicGridSize,
      cellSize: CELL_SIZE,
      extensionCells: EXTENSION_CELLS,
      cachedColors: colorCacheRef.current.size,
      processedColors: processedColors.length,
      visibleBounds,
      panOffset: [panOffset.x, panOffset.y]
    })

    console.log('🎭 Compound SVG grid rendered successfully')

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return
      const newWidth = containerRef.current.clientWidth
      const newHeight = containerRef.current.clientHeight
      
      console.log('📱 Resize to:', { newWidth, newHeight })
      
      // Calculate new dynamic grid size
      const newDynamicGridSize = calculateGridSize(newWidth, newHeight)
      
      // Only update if grid size changed
      if (gridDimensions.width !== newDynamicGridSize.width || gridDimensions.height !== newDynamicGridSize.height) {
        setGridDimensions(newDynamicGridSize)
      }
      
      // Calculate new visible bounds
      const newVisibleBounds = calculateVisibleBounds()
      
      // Only update if bounds changed (new cells appeared)
      const newBoundsString = JSON.stringify(newVisibleBounds)
      if (newBoundsString !== currentBoundsString) {
        onGridBoundsChange?.(newVisibleBounds)
        setLastProcessedBounds(newVisibleBounds)
      }
      
      // Update grid info
      onCellCountChange?.({ x: newDynamicGridSize.width, y: newDynamicGridSize.height })
      
      console.log('✅ Resize completed - Compound SVG grid maintained')
    }

    window.addEventListener('resize', handleResize)

    return () => {
      console.log('🧹 Cleaning up compound SVG grid')
      window.removeEventListener('resize', handleResize)
    }
  }, [processedColors, onCellCountChange, onGridBoundsChange])

  // Create color map for quick lookup
  const colorMap = useMemo(() => {
    const map = new Map<string, string>()
    processedColors.forEach(({ x, y, color }) => {
      map.set(`${x},${y}`, color)
    })
    return map
  }, [processedColors])

  // Calculate grid bounds for rendering
  const gridBounds = useMemo(() => {
    const visibleBounds = calculateVisibleBounds()
    return {
      minX: visibleBounds.minX,
      maxX: visibleBounds.maxX,
      minY: visibleBounds.minY,
      maxY: visibleBounds.maxY,
      width: visibleBounds.maxX - visibleBounds.minX + 1,
      height: visibleBounds.maxY - visibleBounds.minY + 1
    }
  }, [panOffset])

  // Process all visible square coordinates when curve is loaded - ONLY UNCOLORED SQUARES
  useEffect(() => {
    if (!selectedCurveId) return
    
    console.log('🎯 Processing coordinates for uncolored squares only...')
    
    // Get all visible square coordinates that don't have colors yet
    const uncoloredSquareCoordinates: { x: number, y: number }[] = []
    
    for (let y = gridBounds.minY; y <= gridBounds.maxY; y++) {
      for (let x = gridBounds.minX; x <= gridBounds.maxX; x++) {
        const key = `${x},${y}`
        // Only process squares that don't have colors yet
        if (!colorCacheRef.current.has(key)) {
          uncoloredSquareCoordinates.push({ x, y })
        }
      }
    }
    
    console.log(`📊 Processing ${uncoloredSquareCoordinates.length} uncolored square coordinates:`, uncoloredSquareCoordinates)
    
    // Only call the coordinate processor if there are uncolored squares
    if (onGridBoundsChange && uncoloredSquareCoordinates.length > 0) {
      onGridBoundsChange({
        minX: gridBounds.minX,
        maxX: gridBounds.maxX,
        minY: gridBounds.minY,
        maxY: gridBounds.maxY
      })
    } else if (uncoloredSquareCoordinates.length === 0) {
      console.log('✅ All visible squares already have colors - no processing needed')
    }
    
  }, [selectedCurveId, gridBounds])

  // Update bounds when pan offset changes - ONLY FOR NEW UNCOLORED SQUARES
  useEffect(() => {
    console.log('🔄 Pan offset changed to:', panOffset)
    
    // Calculate new visible bounds
    const newVisibleBounds = calculateVisibleBounds()
    
    // Only update if bounds changed AND there are new uncolored squares
    const newBoundsString = JSON.stringify(newVisibleBounds)
    const currentBoundsString = JSON.stringify(lastProcessedBounds)
    
    if (newBoundsString !== currentBoundsString) {
      // Check if there are any new uncolored squares in the new bounds
      const hasNewUncoloredSquares = (() => {
        for (let y = newVisibleBounds.minY; y <= newVisibleBounds.maxY; y++) {
          for (let x = newVisibleBounds.minX; x <= newVisibleBounds.maxX; x++) {
            const key = `${x},${y}`
            if (!colorCacheRef.current.has(key)) {
              return true // Found at least one uncolored square
            }
          }
        }
        return false // All squares in new bounds already have colors
      })()
      
      if (hasNewUncoloredSquares) {
        onGridBoundsChange?.(newVisibleBounds)
        setLastProcessedBounds(newVisibleBounds)
        console.log('🎯 New visible bounds with uncolored squares:', newVisibleBounds)
      } else {
        console.log('✅ New bounds contain only colored squares - no processing needed')
        setLastProcessedBounds(newVisibleBounds)
      }
    }
  }, [panOffset])

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        background: '#1a1a1a',
        position: 'relative',
        border: '2px solid #00ff00',
        cursor: isDragging ? 'grabbing' : 'grab',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        ref={svgRef}
        width={gridBounds.width * CELL_SIZE}
        height={gridBounds.height * CELL_SIZE}
        style={{
          transform: `translate(${-panOffset.x}px, ${-panOffset.y}px)`,
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width={CELL_SIZE} height={CELL_SIZE} patternUnits="userSpaceOnUse">
            <path
              d={`M ${CELL_SIZE} 0 L 0 0 0 ${CELL_SIZE}`}
              fill="none"
              stroke="#00ffff"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        
        {/* Background with grid pattern */}
        <rect
          width={gridBounds.width * CELL_SIZE}
          height={gridBounds.height * CELL_SIZE}
          fill="url(#grid)"
          x={0}
          y={0}
        />
        
        {/* Compound object: Individual squares named by coordinates with different gray colors */}
        {Array.from({ length: gridBounds.height }, (_, y) =>
          Array.from({ length: gridBounds.width }, (_, x) => {
            const worldX = gridBounds.minX + x
            const worldY = gridBounds.minY + y
            const squareName = `square-${worldX}-${worldY}`
            
            // Generate slightly different gray color based on coordinates
            const grayValue = 40 + ((worldX + worldY) % 20) * 8 // 40-200 range
            const grayColor = `rgb(${grayValue}, ${grayValue}, ${grayValue})`
            
            // Use cached color if available, otherwise use generated gray
            const color = colorMap.get(`${worldX},${worldY}`) || grayColor
            
            return (
              <rect
                key={squareName}
                id={squareName}
                data-coordinates={`${worldX},${worldY}`}
                x={x * CELL_SIZE}
                y={y * CELL_SIZE}
                width={CELL_SIZE}
                height={CELL_SIZE}
                fill={color}
                stroke="none"
                style={{
                  cursor: 'pointer'
                }}
                onClick={() => {
                  console.log(`🎯 Square clicked: ${squareName} at coordinates (${worldX}, ${worldY})`)
                }}
              />
            )
          })
        )}
        
        {/* Center cell highlight (0,0) */}
        <rect
          id="center-square"
          data-coordinates="0,0"
          x={(-gridBounds.minX) * CELL_SIZE}
          y={(-gridBounds.minY) * CELL_SIZE}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="none"
          stroke="#ff0000"
          strokeWidth="2"
          strokeDasharray="5,5"
        />
      </svg>
    </div>
  )
}

export default SimpleThreeJSGrid
