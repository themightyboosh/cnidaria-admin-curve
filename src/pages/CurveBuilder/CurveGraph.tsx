import React from 'react'
import { SPECTRUM_PRESETS } from '../../utils/colorSpectrum'

interface CurveGraphProps {
  curveData: number[]
  curveWidth: number
  spectrum: number
  colorMode: 'value' | 'index'
  minValue?: number
  maxValue?: number
  onDataPointClick?: (index: number, value: number) => void
}

const CurveGraph: React.FC<CurveGraphProps> = ({ 
  curveData, 
  curveWidth, 
  spectrum, 
  colorMode,
  minValue = 0,
  maxValue = 255,
  onDataPointClick
}) => {
  // State for tracking canvas size
  const [canvasSize, setCanvasSize] = React.useState({ width: 0, height: 0 })

  // Resize listener to redraw on canvas resize
  React.useEffect(() => {
    const handleResize = () => {
      setCanvasSize({ 
        width: window.innerWidth, 
        height: window.innerHeight 
      })
    }

    // Set initial size
    handleResize()

    // Add resize listener
    window.addEventListener('resize', handleResize)
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  if (!curveData || curveData.length === 0) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
        fontSize: '16px'
      }}>
        No curve data to display
      </div>
    )
  }

  // Use fixed dimensions that work with viewBox - centered graph
  const padding = 10 // Padding to center the graph
  const graphWidth = 140 // Graph width in viewBox units (centered)
  const graphHeight = 80 // Graph height in viewBox units (centered)
  
  // Calculate average value
  const averageValue = curveData.length > 0 
    ? curveData.reduce((sum, value) => sum + value, 0) / curveData.length 
    : 0

  // Create background gradient using the active spectrum
  const getSpectrumGradient = () => {
    const spectrumConfig = SPECTRUM_PRESETS[0] // Default spectrum
    const stops = spectrumConfig.stops.map((stop, index) => {
      const offset = (index / (spectrumConfig.stops.length - 1)) * 100
      return `${stop} ${offset}%`
    }).join(', ')
    
    return `linear-gradient(to bottom, ${stops})`
  }

  // Handle click on the graph
  const handleGraphClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!onDataPointClick) return
    
    const svg = event.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    // Convert click coordinates to graph coordinates
    const graphX = x - padding
    const graphY = y - padding
    
    // Check if click is within the graph area
    if (graphX < 0 || graphX > displayWidth || graphY < 0 || graphY > graphHeight) {
      return
    }
    
    // Calculate which cycle and position within that cycle
    const cycleWidth = displayWidth / 3
    const cycle = Math.floor(graphX / cycleWidth)
    const positionInCycle = (graphX % cycleWidth) / cycleWidth
    
    // Calculate the data index
    const dataIndex = Math.floor(positionInCycle * curveData.length)
    
    // Calculate the value from the Y coordinate (invert Y axis)
    const value = Math.floor(255 - (graphY / graphHeight) * 255)
    const clampedValue = Math.max(0, Math.min(255, value))
    
    // Call the callback with the data index and new value
    onDataPointClick(dataIndex, clampedValue)
  }

  // Generate SVG path for the curve (3 cycles stretched to fill graph width)
  const generateCurvePath = () => {
    if (curveData.length === 0) return ''
    
    let allPoints = []
    
    // Always show exactly 3 complete cycles, stretched to fill graph width
    const repeats = 3
    const cycleWidth = graphWidth / repeats // Each cycle gets 1/3 of the graph width
    
    // Repeat the curve data exactly 3 times, stretched across the graph width
    for (let repeat = 0; repeat < repeats; repeat++) {
      const points = curveData.map((value, index) => {
        const x = padding + (repeat * cycleWidth) + (index / (curveData.length - 1)) * cycleWidth
        const y = padding + graphHeight - (value / 255) * graphHeight
        return `${x},${y}`
      })
      allPoints.push(...points)
    }
    
    return `M ${allPoints.join(' L ')}`
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000000',
      textAlign: 'center'
    }}>
      <div style={{
        width: '90%',
        maxWidth: '1200px',
        aspectRatio: '8/5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        marginLeft: '20%'
      }}>

      <svg 
        width="100%"
        height="100%"
        viewBox="0 0 160 100"
        preserveAspectRatio="xMidYMid meet"
        style={{
          cursor: onDataPointClick ? 'crosshair' : 'default',
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)'
        }}
        onClick={handleGraphClick}
      >
        {/* Background with spectrum gradient */}
        <defs>
          <linearGradient id="spectrumGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff0000" />
            <stop offset="50%" stopColor="#00ff00" />
            <stop offset="100%" stopColor="#0000ff" />
          </linearGradient>
          
          {/* Blur filter for red squares */}
          <filter id="squareBlur">
            <feGaussianBlur stdDeviation="2" />
          </filter>
          
          {/* Blur filter for yellow line */}
          <filter id="lineBlur">
            <feGaussianBlur stdDeviation="1" />
          </filter>
        </defs>
        
        {/* Background rectangle - black */}
        <rect 
          x={padding} 
          y={padding} 
          width={graphWidth} 
          height={graphHeight}
          fill="#000000"
        />
        
        {/* Grid lines */}
        <g stroke="#00ffff" strokeWidth="0.3" opacity="0.4">
          {/* Horizontal grid lines (every 20% of height) */}
          {Array.from({ length: 6 }, (_, i) => {
            const y = padding + (i * graphHeight / 5)
            return (
              <line 
                key={`h-${i}`}
                x1={padding} 
                y1={y} 
                x2={padding + graphWidth} 
                y2={y}
              />
            )
          })}
          
          {/* Vertical grid lines (every 25% of width) */}
          {Array.from({ length: 5 }, (_, i) => {
            const x = padding + (i * graphWidth / 4)
            return (
              <line 
                key={`v-${i}`}
                x1={x} 
                y1={padding} 
                x2={x} 
                y2={padding + graphHeight}
              />
            )
          })}
          
          {/* Additional minor grid lines for better coverage */}
          {/* Horizontal minor lines */}
          {Array.from({ length: 11 }, (_, i) => {
            const y = padding + (i * graphHeight / 10)
            return (
              <line 
                key={`hm-${i}`}
                x1={padding} 
                y1={y} 
                x2={padding + graphWidth} 
                y2={y}
                strokeWidth="0.1"
                opacity="0.2"
              />
            )
          })}
          
          {/* Vertical minor lines */}
          {Array.from({ length: 9 }, (_, i) => {
            const x = padding + (i * graphWidth / 8)
            return (
              <line 
                key={`vm-${i}`}
                x1={x} 
                y1={padding} 
                x2={x} 
                y2={padding + graphHeight}
                strokeWidth="0.1"
                opacity="0.2"
              />
            )
          })}
        </g>
        
        {/* Axis labels */}
        <g fill="#00ffff" fontSize="2" textAnchor="middle">
          {/* Y-axis labels (0, 50, 100, 150, 200, 255) */}
          {Array.from({ length: 6 }, (_, i) => {
            const y = padding + (i * graphHeight / 5)
            const value = 255 - (i * 255 / 5)
            return (
              <text key={`y-${i}`} x={padding - 1} y={y + 0.5} textAnchor="end">
                {Math.round(value)}
              </text>
            )
          })}
          
          {/* X-axis labels */}
          <text x={padding + graphWidth / 2} y={5}>
            Curve Width: {curveWidth} (3 complete cycles)
          </text>
          
          {/* Horizontal numbers for curve width */}
          {Array.from({ length: 4 }, (_, i) => {
            const x = padding + (i * graphWidth / 3) // 0, 1/3, 2/3, 1
            const cycleNumber = i
            return (
              <text key={`x-${i}`} x={x} y={padding - 1} textAnchor="middle" fontSize="1.5">
                {cycleNumber === 0 ? '0' : `${Math.floor(curveWidth * cycleNumber / 3)}`}
              </text>
            )
          })}
          
          {/* Add final curve width number */}
          <text x={padding + graphWidth} y={padding - 1} textAnchor="end" fontSize="1.5">
            {curveWidth}
          </text>
          

        </g>
        

        
        {/* Min and Max value lines */}
        <line
          x1={padding}
          y1={padding + graphHeight - (minValue / 255) * graphHeight}
          x2={padding + graphWidth}
          y2={padding + graphHeight - (minValue / 255) * graphHeight}
          stroke="#666666"
          strokeWidth="0.5"
          strokeDasharray="1,1"
          opacity="0.5"
        />
        <line
          x1={padding}
          y1={padding + graphHeight - (maxValue / 255) * graphHeight}
          x2={padding + graphWidth}
          y2={padding + graphHeight - (maxValue / 255) * graphHeight}
          stroke="#666666"
          strokeWidth="0.5"
          strokeDasharray="1,1"
          opacity="0.5"
        />
        
        {/* Average value line */}
        <line
          x1={padding}
          y1={padding + graphHeight - (averageValue / 255) * graphHeight}
          x2={padding + graphWidth + 3}
          y2={padding + graphHeight - (averageValue / 255) * graphHeight}
          stroke="#00ffff"
          strokeWidth="0.5"
          strokeDasharray="2,2"
          opacity="0.7"
        />
        
        {/* Curve line */}
        <path
          d={generateCurvePath()}
          stroke="#ffff00"
          strokeWidth="0.25"
          fill="none"
        />

        {/* Data points as static red rectangles */}
        {(() => {
          const totalPoints = Math.floor(graphWidth / 1) // 1 unit spacing between points for solid appearance
          const points = []
          
          for (let i = 0; i < totalPoints; i++) {
            // Calculate position along stretched 3 cycles
            const cycleWidth = graphWidth / 3 // Each cycle gets 1/3 of the graph width
            const totalCurveWidth = graphWidth
            const progress = i / (totalPoints - 1)
            const xAlongCurve = progress * totalCurveWidth
            
            // Determine which repeat and position within that repeat
            const repeatIndex = Math.floor(xAlongCurve / cycleWidth)
            const positionInRepeat = (xAlongCurve % cycleWidth) / cycleWidth
            const curveIndex = Math.floor(positionInRepeat * curveData.length)
            
            const value = curveData[curveIndex]
            const x = padding + xAlongCurve
            const y = padding + graphHeight - (value / 255) * graphHeight
            
            // Fixed width of 1 unit
            const proportionalWidth = 1
            
            points.push(
              <rect
                key={`point-${i}`}
                x={x - (proportionalWidth / 2)}
                y={y - 0.5}
                width={proportionalWidth}
                height="1"
                fill="#ff0000"
                stroke="none"
              />
            )
          }
          
          return points
        })()}
      </svg>
      </div>
    </div>
  )
}

export default CurveGraph
