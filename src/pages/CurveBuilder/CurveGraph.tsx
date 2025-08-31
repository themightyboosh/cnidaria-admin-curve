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
  const displayWidth = Math.max(100, curveWidth * 3) // Show 3x curve width to see seams
  const actualWidth = displayWidth + (padding * 2)
  const actualHeight = graphHeight + (padding * 2)
  
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

  // Generate SVG path for the curve (3x repeated to show seams)
  const generateCurvePath = () => {
    if (curveData.length === 0) return ''
    
    let allPoints = []
    
    // Repeat the curve data 3 times
    for (let repeat = 0; repeat < 3; repeat++) {
      const points = curveData.map((value, index) => {
        const x = padding + (repeat * curveWidth) + (index / (curveData.length - 1)) * curveWidth
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
      <svg 
        width="100%"
        height="100%"
        viewBox={`0 0 ${actualWidth} ${actualHeight}`}
        style={{
          border: '1px solid #00ffff',
          borderRadius: '4px',
          maxHeight: '512px'
        }}
      >
        {/* Background with spectrum gradient */}
        <defs>
          <linearGradient id="spectrumGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff0000" />
            <stop offset="50%" stopColor="#00ff00" />
            <stop offset="100%" stopColor="#0000ff" />
          </linearGradient>
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
        <g fill="#00ffff" fontSize="12" textAnchor="middle">
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
            Curve Width: {curveWidth} (3x display to show seams)
          </text>
          
          {/* Average value label */}
          <text 
            x={padding + displayWidth + 5} 
            y={padding + graphHeight - (averageValue / 255) * graphHeight + 4}
            fill="#00ffff"
            fontSize="10"
          >
            Avg: {Math.round(averageValue)}
          </text>
        </g>
        
        {/* Curve line */}
        <path
          d={generateCurvePath()}
          stroke="#00ffff"
          strokeWidth="2"
          fill="none"
        />
        
        {/* Average value line */}
        <line
          x1={padding}
          y1={padding + graphHeight - (averageValue / 255) * graphHeight}
          x2={padding + displayWidth}
          y2={padding + graphHeight - (averageValue / 255) * graphHeight}
          stroke="#00ffff"
          strokeWidth="1"
          strokeDasharray="5,5"
          opacity="0.7"
        />
        
        {/* Data points (3x repeated to show seams) */}
        {Array.from({ length: 3 }, (_, repeat) => 
          curveData.map((value, index) => {
            const x = padding + (repeat * curveWidth) + (index / (curveData.length - 1)) * curveWidth
            const y = padding + graphHeight - (value / 255) * graphHeight
            
                         return (
               <circle
                 key={`${repeat}-${index}`}
                 cx={x}
                 cy={y}
                 r="2"
                 fill="#00ffff"
                 stroke="#00ffff"
                 strokeWidth="1"
               />
             )
          })
        )}
      </svg>
    </div>
  )
}

export default CurveGraph
