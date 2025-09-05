import React, { useEffect, useRef, useState } from 'react'
import Header from '../../components/Header'
import './Testing.css'

const Testing: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [testMessage, setTestMessage] = useState('Testing page loaded')

  useEffect(() => {
    console.log('🧪 Testing page initialized')
    
    // Simple canvas test
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        // Clear canvas
        ctx.fillStyle = '#1a1a1a'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // Draw test pattern
        ctx.fillStyle = '#00ff00'
        ctx.fillRect(50, 50, 100, 100)
        
        ctx.fillStyle = '#ffffff'
        ctx.font = '20px Arial'
        ctx.fillText('Testing Canvas', 200, 100)
        
        console.log('✅ Canvas test pattern drawn')
      }
    }
  }, [])

  const runBasicTest = () => {
    console.log('🧪 Running basic test...')
    setTestMessage('Basic test completed successfully!')
  }

  const runCanvasTest = () => {
    console.log('🎨 Running canvas test...')
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        // Random colored squares
        for (let i = 0; i < 20; i++) {
          const x = Math.random() * (canvas.width - 50)
          const y = Math.random() * (canvas.height - 50)
          const hue = Math.random() * 360
          ctx.fillStyle = `hsl(${hue}, 70%, 50%)`
          ctx.fillRect(x, y, 30, 30)
        }
        setTestMessage('Canvas test completed - random squares drawn!')
      }
    }
  }

  const clearCanvas = () => {
    console.log('🧹 Clearing canvas...')
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#1a1a1a'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        setTestMessage('Canvas cleared')
      }
    }
  }

  return (
    <div className="testing-page">
      <Header />
      
      <div className="testing-content">
        <div className="testing-sidebar">
          <h2>Testing Controls</h2>
          
          <div className="test-section">
            <h3>Basic Tests</h3>
            <button onClick={runBasicTest} className="test-btn">
              Run Basic Test
            </button>
            <button onClick={runCanvasTest} className="test-btn">
              Canvas Test
            </button>
            <button onClick={clearCanvas} className="test-btn secondary">
              Clear Canvas
            </button>
          </div>
          
          <div className="test-section">
            <h3>Status</h3>
            <div className="status-message">
              {testMessage}
            </div>
          </div>
          
          <div className="test-section">
            <h3>Future Tests</h3>
            <button disabled className="test-btn disabled">
              3D Preview Test (Coming Soon)
            </button>
            <button disabled className="test-btn disabled">
              WebGPU Test (Coming Soon)
            </button>
            <button disabled className="test-btn disabled">
              Shader Test (Coming Soon)
            </button>
          </div>
        </div>
        
        <div className="testing-viewport">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="testing-canvas"
          />
        </div>
      </div>
    </div>
  )
}

export default Testing
