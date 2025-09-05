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
  const threejsContainerRef = useRef<HTMLDivElement>(null)
  const [testMessage, setTestMessage] = useState('Testing page loaded')
  const [availableShaders, setAvailableShaders] = useState<Shader[]>([])
  const [selectedShader, setSelectedShader] = useState<Shader | null>(null)
  const [isLoadingShaders, setIsLoadingShaders] = useState(false)
  const [threejsScene, setThreejsScene] = useState<any>(null)

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
    
    // Initialize Three.js scene
    setTimeout(() => {
      initThreeJsScene()
    }, 100) // Small delay to ensure container is mounted
    
    // Cleanup Three.js on unmount
    return () => {
      if (threejsScene?.animationId) {
        cancelAnimationFrame(threejsScene.animationId)
      }
      if (threejsScene?.renderer) {
        threejsScene.renderer.dispose()
      }
    }
  }, [])

  // Initialize Three.js scene for shader preview
  const initThreeJsScene = async () => {
    const container = threejsContainerRef.current
    if (!container) return

    try {
      console.log('🎮 Initializing Three.js scene for shader preview...')
      const THREE = await import('three')
      
      // Get container dimensions
      const width = container.clientWidth || 800
      const height = container.clientHeight || 600
      
      console.log(`📐 Three.js viewport size: ${width}x${height}`)
      
      // Create scene, camera, renderer (let Three.js create its own canvas)
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
      
      renderer.setSize(width, height)
      renderer.setClearColor(0x1a1a1a)
      
      // Style the Three.js canvas
      renderer.domElement.className = 'testing-canvas threejs-canvas'
      renderer.domElement.style.borderRadius = '8px'
      
      // Clear container and add Three.js canvas
      container.innerHTML = ''
      container.appendChild(renderer.domElement)
      
      // Create moderately complex cube geometry
      const geometry = new THREE.BoxGeometry(2, 2, 2, 8, 8, 8) // Subdivided for better texture detail
      
      // Default material (will be replaced when shader is selected)
      const material = new THREE.MeshBasicMaterial({ color: 0x666666, wireframe: false })
      const cube = new THREE.Mesh(geometry, material)
      
      scene.add(cube)
      camera.position.z = 5
      
      // Animation loop
      let animationId: number
      const animate = () => {
        animationId = requestAnimationFrame(animate)
        
        // Rotate cube
        cube.rotation.x += 0.005
        cube.rotation.y += 0.01
        
        renderer.render(scene, camera)
      }
      
      animate()
      
      // Store scene data for shader updates
      setThreejsScene({ scene, camera, renderer, cube, animationId, THREE })
      console.log('✅ Three.js scene initialized')
      setTestMessage('Three.js scene ready for shader testing')
      
    } catch (error) {
      console.error('❌ Failed to initialize Three.js scene:', error)
      setTestMessage(`Failed to initialize 3D scene: ${error.message}`)
    }
  }

  // Apply selected shader to the cube
  const applyShaderToCube = async (shader: Shader) => {
    if (!threejsScene || !shader.glsl['three-js']) {
      console.log('⚠️ No Three.js scene or Three.js shader available')
      return
    }

    try {
      console.log(`🎨 Applying shader to cube: ${shader.name}`)
      const { cube, THREE } = threejsScene
      
      // Create shader material with the selected shader
      const shaderMaterial = new THREE.ShaderMaterial({
        fragmentShader: shader.glsl['three-js'],
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vPosition;
          varying vec3 vNormal;
          
          void main() {
            vUv = uv;
            vPosition = position;
            vNormal = normal;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        uniforms: {
          time: { value: 0.0 }
        }
      })
      
      // Apply shader to cube
      cube.material = shaderMaterial
      
      console.log('✅ Shader applied to cube')
      setTestMessage(`Applied shader: ${shader.name}`)
      
    } catch (error) {
      console.error('❌ Failed to apply shader:', error)
      setTestMessage(`Failed to apply shader: ${error.message}`)
    }
  }

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

  const runShaderTest = () => {
    console.log('🎨 Running shader test...')
    if (selectedShader) {
      applyShaderToCube(selectedShader)
    } else {
      setTestMessage('Please select a shader first')
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
                  // Apply shader to Three.js cube
                  applyShaderToCube(shader)
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
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => applyShaderToCube(selectedShader)} 
                    className="test-btn"
                  >
                    Apply to Cube
                  </button>
                  <button 
                    onClick={() => exportShaderGLSL(selectedShader)} 
                    className="test-btn secondary"
                  >
                    Export GLSL
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="test-section">
            <h3>3D Scene Controls</h3>
            <button 
              onClick={() => {
                if (threejsScene) {
                  const { cube, THREE } = threejsScene
                  cube.material = new THREE.MeshBasicMaterial({ color: 0x666666 })
                  setTestMessage('Reset cube to default material')
                }
              }} 
              className="test-btn secondary"
            >
              Reset Cube
            </button>
            <button 
              onClick={() => {
                initThreeJsScene()
                setTestMessage('Three.js scene reinitialized')
              }} 
              className="test-btn"
            >
              Reinit Scene
            </button>
          </div>

          <div className="test-section">
            <h3>Shader Tests</h3>
            <button onClick={runShaderTest} className="test-btn">
              Apply Selected Shader
            </button>
            <button 
              onClick={() => {
                if (threejsScene) {
                  const { cube, THREE } = threejsScene
                  cube.rotation.set(0, 0, 0)
                  setTestMessage('Cube rotation reset')
                }
              }}
              className="test-btn secondary"
            >
              Reset Rotation
            </button>
          </div>
          
          <div className="test-section">
            <h3>Status</h3>
            <div className="status-message">
              {testMessage}
            </div>
          </div>
          
        </div>
        
        <div className="testing-viewport">
          {/* Three.js viewport - Three.js will create its own canvas */}
          <div 
            ref={threejsContainerRef}
            className="threejs-viewport"
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </div>
  )
}

export default Testing
