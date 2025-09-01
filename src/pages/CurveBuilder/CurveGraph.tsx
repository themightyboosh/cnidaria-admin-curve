import React from 'react'
import { SPECTRUM_PRESETS } from '../../utils/colorSpectrum'

interface CurveGraphProps {
  curveData: number[]
  curveWidth: number
  spectrum: number
  colorMode: 'value' | 'index'
}

const CurveGraph: React.FC<CurveGraphProps> = ({ 
  curveData, 
  curveWidth, 
  spectrum, 
  colorMode 
}) => {
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

  const padding = 20
  const maxHeight = 512
  const graphHeight = Math.min(255, maxHeight - (padding * 2))
  const actualHeight = graphHeight + (padding * 2)
  
  // Scale down to 90% of available width, then stretch 3 cycles to fill that width
  const availableWidth = Math.max(300, window.innerWidth - 500) // Available width, minimum 300px
  const displayWidth = availableWidth * 0.9 // 90% of available width
  const actualWidth = displayWidth + (padding * 2)
  
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

  // Generate SVG path for the curve (3 cycles stretched to 90% width)
  const generateCurvePath = () => {
    if (curveData.length === 0) return ''
    
    let allPoints = []
    
    // Always show exactly 3 complete cycles, stretched to fill displayWidth
    const repeats = 3
    const cycleWidth = displayWidth / repeats // Each cycle gets 1/3 of the display width
    
    // Repeat the curve data exactly 3 times, stretched across the display width
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
      backgroundColor: '#000000'
    }}>
      <style>
        {`
          @keyframes growShrink {
            0%, 100% { 
              transform: scale(1); 
              filter: blur(0px);
            }
            50% { 
              transform: scale(2); 
              filter: blur(1px);
            }
          }
          
          @keyframes sequentialPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(2); }
          }
        `}
      </style>
      <svg 
        width="100%"
        height="auto"
        viewBox={`0 0 ${actualWidth} ${actualHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          maxHeight: '512px',
          maxWidth: '100%'
        }}
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
        </defs>
        
        {/* Background rectangle - black */}
        <rect 
          x={padding} 
          y={padding} 
          width={displayWidth} 
          height={graphHeight}
          fill="#000000"
        />
        
        {/* Grid lines */}
        <g stroke="#00ffff" strokeWidth="1" opacity="0.3">
          {/* Horizontal grid lines (every 50 units) */}
          {Array.from({ length: 6 }, (_, i) => {
            const y = padding + (i * graphHeight / 5)
            return (
              <line 
                key={`h-${i}`}
                x1={padding} 
                y1={y} 
                x2={padding + displayWidth} 
                y2={y}
              />
            )
          })}
          
          {/* Vertical grid lines (every 50 units if width > 200) */}
          {displayWidth > 200 && Array.from({ length: Math.floor(displayWidth / 50) + 1 }, (_, i) => {
            const x = padding + (i * 50)
            if (x <= padding + displayWidth) {
              return (
                <line 
                  key={`v-${i}`}
                  x1={x} 
                  y1={padding} 
                  x2={x} 
                  y2={padding + graphHeight}
                />
              )
            }
            return null
          })}
        </g>
        
        {/* Axis labels */}
        <g fill="#00ffff" fontSize="10" textAnchor="middle">
          {/* Y-axis labels (0, 50, 100, 150, 200, 255) */}
          {Array.from({ length: 6 }, (_, i) => {
            const y = padding + (i * graphHeight / 5)
            const value = 255 - (i * 255 / 5)
            return (
              <text key={`y-${i}`} x={padding - 5} y={y + 4} textAnchor="end">
                {Math.round(value)}
              </text>
            )
          })}
          
          {/* X-axis labels */}
          <text x={padding + displayWidth / 2} y={actualHeight - 5}>
            Curve Width: {curveWidth} (3 complete cycles)
          </text>
          
          {/* Average value label */}
          <text 
            x={padding + displayWidth + 5} 
            y={padding + graphHeight - (averageValue / 255) * graphHeight + 4}
            fill="#00ffff"
            fontSize="8"
          >
            Avg: {Math.round(averageValue)}
          </text>
        </g>
        

        
        {/* Average value line */}
        <line
          x1={padding}
          y1={padding + graphHeight - (averageValue / 255) * graphHeight}
          x2={padding + displayWidth + 20}
          y2={padding + graphHeight - (averageValue / 255) * graphHeight}
          stroke="#00ffff"
          strokeWidth="1"
          strokeDasharray="5,5"
          opacity="0.7"
        />
        
        {/* Data points with sequential animation - following stretched 3 cycles */}
        {(() => {
          const totalPoints = Math.floor(displayWidth / 3) // 3px spacing between points
          const points = []
          
          for (let i = 0; i < totalPoints; i++) {
            // Calculate position along stretched 3 cycles
            const cycleWidth = displayWidth / 3 // Each cycle gets 1/3 of the display width
            const totalCurveWidth = displayWidth
            const progress = i / (totalPoints - 1)
            const xAlongCurve = progress * totalCurveWidth
            
            // Determine which repeat and position within that repeat
            const repeatIndex = Math.floor(xAlongCurve / cycleWidth)
            const positionInRepeat = (xAlongCurve % cycleWidth) / cycleWidth
            const curveIndex = Math.floor(positionInRepeat * curveData.length)
            
                         const value = curveData[curveIndex]
             const x = padding + xAlongCurve
             const y = padding + graphHeight - (value / 255) * graphHeight
             
             // Calculate animation speed based on value: slower for lower values
             const animationSpeed = 1 + ((255 - value) / 255) * 2 // Range: 1s (high values) to 3s (low values)
             const animationDelay = (i / totalPoints) * 2 // 2 second total cycle
            
                         points.push(
               <rect
                 key={`point-${i}`}
                 x={x - 1}
                 y={y - 1}
                 width="2"
                 height="2"
                 fill="#ff0000"
                 stroke="none"
                 style={{
                   animation: `growShrink ${animationSpeed}s infinite`,
                   animationDelay: `${animationDelay}s`,
                   transformOrigin: `${x}px ${y}px`
                 }}
               />
             )
          }
          
          return points
        })()}
      </svg>
    </div>
  )
}

export default CurveGraph
