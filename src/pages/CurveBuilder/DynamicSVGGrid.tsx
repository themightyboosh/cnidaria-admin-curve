import React, { useState, useMemo, useRef, useEffect } from 'react'

interface DynamicSVGGridProps {
  width?: number
  height?: number
}

const DynamicSVGGrid: React.FC<DynamicSVGGridProps> = () => {
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 })
  
  const CELL_SIZE = 50
  const GRID_SIZE = 512
  const TOTAL_SIZE = GRID_SIZE * CELL_SIZE // 25600
  
  // Calculate center offset to keep SVG centered in canvas
  const centerOffset = useMemo(() => {
    // Get the container dimensions (assuming 100% width/height)
    const containerWidth = window.innerWidth || 800
    const containerHeight = window.innerHeight || 600
    
    // Calculate how much to offset to center the SVG
    const centerX = (containerWidth - TOTAL_SIZE) / 2
    const centerY = (containerHeight - TOTAL_SIZE) / 2
    
    return { x: centerX, y: centerY }
  }, [])
  
  // Initialize pan offset to center the grid
  useEffect(() => {
    setPanOffset(centerOffset)
  }, [centerOffset])
  
  // Grid data with proper initialization
  const [gridData, setGridData] = useState<Array<Array<{ fillR: number; fillG: number; fillB: number; worldX: number; worldY: number; isNew?: boolean }>>>(() => {
    const data: Array<Array<{ fillR: number; fillG: number; fillB: number; worldX: number; worldY: number; isNew?: boolean }>> = []
    
    // Initialize with center area (-256 to +255)
    for (let y = 0; y < GRID_SIZE; y++) {
      const row: Array<{ fillR: number; fillG: number; fillB: number; worldX: number; worldY: number; isNew?: boolean }> = []
      for (let x = 0; x < GRID_SIZE; x++) {
        const worldX = x - 256 // Convert to -256 to +255 range
        const worldY = y - 256 // Convert to -256 to +255 range
        
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
  const applyGridChanges = (changes: { addColumns: number; removeColumns: number; addRows: number; removeRows: number }) => {
    setGridData(prevData => {
      let newData = prevData.map(row => [...row]) // Deep copy
      
      // Apply column changes
      if (changes.addColumns > 0) {
        // Add columns to the right
        for (let y = 0; y < GRID_SIZE; y++) {
          for (let i = 0; i < changes.addColumns; i++) {
            const lastWorldX = newData[y][GRID_SIZE - 1].worldX
            const fillR = Math.floor(Math.random() * 256)
            const fillG = Math.floor(Math.random() * 256)
            const fillB = Math.floor(Math.random() * 256)
            newData[y].push({ 
              fillR, fillG, fillB, 
              worldX: lastWorldX + 1, 
              worldY: newData[y][0].worldY,
              isNew: true
            })
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
            newData[y].unshift({ 
              fillR, fillG, fillB, 
              worldX: firstWorldX - 1, 
              worldY: newData[y][0].worldY,
              isNew: true
            })
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
            newRow.push({ 
              fillR, fillG, fillB, 
              worldX: newData[0][x].worldX, 
              worldY: lastWorldY + 1,
              isNew: true
            })
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
            newRow.push({ 
              fillR, fillG, fillB, 
              worldX: newData[0][x].worldX, 
              worldY: firstWorldY - 1,
              isNew: true
            })
          }
          newData.unshift(newRow)
        }
        // Remove excess rows from bottom
        newData = newData.slice(0, GRID_SIZE)
      }
      
      return newData
    })
    
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
    setIsDragging(true)
    setLastMousePos({ x: event.clientX, y: event.clientY })
    setDragStartOffset({ ...panOffset }) // Store the starting position
  }
  
  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging) return
    
    const deltaX = event.clientX - lastMousePos.x
    const deltaY = event.clientY - lastMousePos.y
    
    setPanOffset(prev => ({
      x: prev.x + deltaX, // Swapped direction for left/right
      y: prev.y + deltaY  // Keep up/down as is
    }))
    
    setLastMousePos({ x: event.clientX, y: event.clientY })
  }
  
  const handleMouseUp = () => {
    if (isDragging) {
      // Calculate changes after drag ends
      const changes = calculateGridChanges(dragStartOffset, panOffset)
      
      // Check horizontal and vertical movements independently
      const minMovement = CELL_SIZE / 2 // Half a cell size
      const hasHorizontalMovement = Math.abs(panOffset.x - dragStartOffset.x) > minMovement
      const hasVerticalMovement = Math.abs(panOffset.y - dragStartOffset.y) > minMovement
      
      // Apply changes if there's significant movement in either direction
      if ((hasHorizontalMovement && (changes.addColumns > 0 || changes.removeColumns > 0)) ||
          (hasVerticalMovement && (changes.addRows > 0 || changes.removeRows > 0))) {
        applyGridChanges(changes)
      }
    }
    
    setIsDragging(false)
  }
  
  const handleMouseLeave = () => {
    if (isDragging) {
      handleMouseUp()
    }
  }
  
  // Generate visible squares from grid data
  const visibleSquares = useMemo(() => {
    const squares: JSX.Element[] = []
    
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        // Safety check to prevent undefined errors
        if (!gridData[y] || !gridData[y][x]) {
          console.warn(`Missing grid data at position (${x}, ${y})`)
          continue
        }
        
        const { fillR, fillG, fillB, worldX, worldY, isNew } = gridData[y][x]
        
        // Additional safety check
        if (typeof worldX === 'undefined' || typeof worldY === 'undefined') {
          console.warn(`Invalid world coordinates at position (${x}, ${y})`)
          continue
        }
        
        const pixelX = x * CELL_SIZE
        const pixelY = y * CELL_SIZE
        
        const squareId = `square-${worldX}-${worldY}`
        const isCenter = worldX === 0 && worldY === 0
        
        // Only color new rectangles, keep existing ones with their original colors
        const fillColor = isNew ? `rgb(${fillR},${fillG},${fillB})` : `rgb(${fillR},${fillG},${fillB})`
        const strokeColor = isCenter ? '#ff0000' : '#00ffff'
        
        squares.push(
          <rect
            key={squareId}
            id={squareId}
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
    }
    
    return squares
  }, [gridData])
  
  return (
    <div 
      style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : 'grab',
        position: 'relative'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <svg 
        width={TOTAL_SIZE} 
        height={TOTAL_SIZE}
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        <defs>
          <pattern id="grid" width={CELL_SIZE} height={CELL_SIZE} patternUnits="userSpaceOnUse">
            <path d={`M ${CELL_SIZE} 0 L 0 0 0 ${CELL_SIZE}`} fill="none" stroke="#00ffff" strokeWidth="1"/>
          </pattern>
        </defs>
        
        {/* Background with grid pattern */}
        <rect width={TOTAL_SIZE} height={TOTAL_SIZE} fill="url(#grid)" x="0" y="0"/>
        
        {/* Visible squares */}
        {visibleSquares}
        
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
        Grid Center: ({Math.floor(-panOffset.x / CELL_SIZE)}, {Math.floor(-panOffset.y / CELL_SIZE)})<br/>
        Squares: {visibleSquares.length}<br/>
        Status: {isDragging ? 'Dragging' : 'Ready'}
      </div>
    </div>
  )
}

export default DynamicSVGGrid
