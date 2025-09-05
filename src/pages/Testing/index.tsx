import React, { useEffect, useRef, useState } from 'react'
import Header from '../../components/Header'
import { apiUrl } from '../../config/environments'
import './Testing.css'

interface Shader {
  id: string
  name: string
  category: string
  glsl: Record<string, string>
  targets: string[]
  createdAt: string
  updatedAt: string
}

const Testing: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [testMessage, setTestMessage] = useState('Testing page loaded')
  const [availableShaders, setAvailableShaders] = useState<Shader[]>([])
  const [selectedShader, setSelectedShader] = useState<Shader | null>(null)
  const [isLoadingShaders, setIsLoadingShaders] = useState(false)

  // Load all shaders from API
  const loadShaders = async () => {
    setIsLoadingShaders(true)
    try {
      console.log('📡 Loading shaders from API...')
      const response = await fetch(`${apiUrl}/api/shaders`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setAvailableShaders(data.data)
          console.log(`✅ Loaded ${data.data.length} shaders`)
          setTestMessage(`Loaded ${data.data.length} shaders from system`)
        } else {
          console.error('❌ Invalid shader data:', data)
          setTestMessage('Failed to load shader data')
        }
      } else {
        console.error('❌ Failed to load shaders:', response.statusText)
        setTestMessage(`Failed to load shaders: ${response.statusText}`)
      }
    } catch (error) {
      console.error('❌ Error loading shaders:', error)
      setTestMessage(`Error loading shaders: ${error.message}`)
    } finally {
      setIsLoadingShaders(false)
    }
  }

  useEffect(() => {
    console.log('🧪 Testing page initialized')
    loadShaders()
    
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

  const exportShaderGLSL = (shader: Shader) => {
    console.log(`🎨 Exporting GLSL pairs for: ${shader.name}`)
    
    const targets = Object.keys(shader.glsl)
    if (targets.length === 0) {
      alert('No GLSL code found in this shader')
      return
    }
    
    // Export each GLSL target as a separate file
    targets.forEach(target => {
      const glslCode = shader.glsl[target]
      const fileName = `${shader.name}-${target}.glsl`
      
      const blob = new Blob([glslCode], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      console.log(`✅ Exported: ${fileName}`)
    })
    
    setTestMessage(`Exported ${targets.length} GLSL files for ${shader.name}`)
  }

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
      <div className="testing-content">
        <div className="testing-sidebar">
          <h2>Testing Controls</h2>
          
          <div className="test-section">
            <h3>Shaders in System</h3>
            <select 
              value={selectedShader?.id || ''} 
              onChange={(e) => {
                const shader = availableShaders.find(s => s.id === e.target.value)
                setSelectedShader(shader || null)
                if (shader) {
                  setTestMessage(`Selected: ${shader.name} (${shader.targets.length} targets: ${shader.targets.join(', ')})`)
                }
              }}
              disabled={isLoadingShaders}
              className="shader-dropdown"
            >
              <option value="">{isLoadingShaders ? 'Loading shaders...' : 'Select shader...'}</option>
              {availableShaders.map(shader => (
                <option key={shader.id} value={shader.id}>
                  {shader.name} ({shader.category})
                </option>
              ))}
            </select>
            
            {selectedShader && (
              <div className="shader-info">
                <div className="shader-details">
                  <strong>{selectedShader.name}</strong>
                  <div>Category: {selectedShader.category}</div>
                  <div>Targets: {selectedShader.targets.join(', ')}</div>
                  <div>Created: {new Date(selectedShader.createdAt).toLocaleDateString()}</div>
                </div>
                <button 
                  onClick={() => exportShaderGLSL(selectedShader)} 
                  className="test-btn"
                >
                  Export GLSL Files
                </button>
              </div>
            )}
          </div>

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
