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
  const graphWidth = Math.max(100, curveWidth) // Minimum width of 100px

  // Create background gradient using the active spectrum
  const getSpectrumGradient = () => {
    const spectrumConfig = SPECTRUM_PRESETS[0] // Default spectrum
    const stops = spectrumConfig.stops.map((stop, index) => {
      const offset = (index / (spectrumConfig.stops.length - 1)) * 100
      return `${stop} ${offset}%`
    }).join(', ')
    
    return `linear-gradient(to bottom, ${stops})`
  }

  // Generate SVG path for the curve
  const generateCurvePath = () => {
    if (curveData.length === 0) return ''
    
    const points = curveData.map((value, index) => {
      const x = padding + (index / (curveData.length - 1)) * graphWidth
      const y = padding + graphHeight - (value / 255) * graphHeight
      return `${x},${y}`
    })
    
    return `M ${points.join(' L ')}`
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1a1a1a'
    }}>
      <svg 
        width={actualWidth} 
        height={actualHeight}
        style={{
          border: '1px solid #333',
          borderRadius: '4px'
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
        
        {/* Background rectangle with spectrum */}
        <rect 
          x={padding} 
          y={padding} 
          width={graphWidth} 
          height={graphHeight}
          fill="url(#spectrumGradient)"
          opacity="0.1"
        />
        
        {/* Grid lines */}
        <g stroke="#333" strokeWidth="1">
          {/* Horizontal grid lines (every 50 units) */}
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
          
          {/* Vertical grid lines (every 50 units if width > 200) */}
          {graphWidth > 200 && Array.from({ length: Math.floor(graphWidth / 50) + 1 }, (_, i) => {
            const x = padding + (i * 50)
            if (x <= padding + graphWidth) {
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
        <g fill="#666" fontSize="12" textAnchor="middle">
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
          <text x={padding + graphWidth / 2} y={actualHeight - 5}>
            Curve Width: {curveWidth}
          </text>
        </g>
        
        {/* Curve line */}
        <path
          d={generateCurvePath()}
          stroke="#00ffff"
          strokeWidth="2"
          fill="none"
        />
        
        {/* Data points */}
        {curveData.map((value, index) => {
          const x = padding + (index / (curveData.length - 1)) * graphWidth
          const y = padding + graphHeight - (value / 255) * graphHeight
          
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="2"
              fill="#ffffff"
              stroke="#00ffff"
              strokeWidth="1"
            />
          )
        })}
      </svg>
    </div>
  )
}

export default CurveGraph
