import React, { useEffect, useRef, useState } from 'react'
import Header from '../../components/Header'
import { apiUrl } from '../../config/environments'
import './Testing.css'

type GeometryType = 'sphere' | 'cube' | 'landscape-box'

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
  const babylonContainerRef = useRef<HTMLDivElement>(null)
  const [testMessage, setTestMessage] = useState('Testing page loaded')
  const [availableShaders, setAvailableShaders] = useState<Shader[]>([])
  const [selectedShader, setSelectedShader] = useState<Shader | null>(null)
  const [isLoadingShaders, setIsLoadingShaders] = useState(false)
  const [babylonScene, setBabylonScene] = useState<any>(null)
  const [currentGeometry, setCurrentGeometry] = useState<GeometryType>('sphere')
  const [vertexCount, setVertexCount] = useState(32)

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
    
    // Initialize Babylon.js scene
    setTimeout(() => {
      initBabylonScene()
    }, 100) // Small delay to ensure container is mounted
    
    // Cleanup Babylon.js on unmount
    return () => {
      if (babylonScene?.engine) {
        babylonScene.engine.dispose()
      }
    }
  }, [])

  // Initialize Babylon.js scene for GPU-accelerated testing
  const initBabylonScene = async () => {
    const container = babylonContainerRef.current
    if (!container) return

    try {
      console.log('🎮 Initializing Babylon.js scene with WebGPU...')
      
      // Cleanup any existing content
      container.innerHTML = ''
      
      const BABYLON = await import('@babylonjs/core')
      
      // Get container dimensions for proper aspect ratio
      const containerRect = container.getBoundingClientRect()
      const width = containerRect.width
      const height = containerRect.height
      
      console.log(`📐 Container dimensions: ${width}x${height}`)
      
      // Create canvas with proper dimensions
      const canvas = document.createElement('canvas')
      canvas.className = 'babylon-canvas'
      canvas.width = width
      canvas.height = height
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      canvas.style.display = 'block'
      canvas.style.margin = '0'
      canvas.style.padding = '0'
      container.appendChild(canvas)
      
      console.log('🚀 Creating WebGPU engine...')
      
      // Try WebGPU first, fallback to WebGL
      let engine: any
      try {
        engine = new BABYLON.WebGPUEngine(canvas)
        await engine.initAsync()
        console.log('✅ WebGPU engine initialized')
        setTestMessage('Babylon.js WebGPU engine ready')
      } catch (webgpuError) {
        console.log('⚠️ WebGPU failed, falling back to WebGL...')
        engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
        console.log('✅ WebGL engine initialized')
        setTestMessage('Babylon.js WebGL engine ready (WebGPU unavailable)')
      }
      
      // Set proper engine size
      engine.setSize(width, height)
      
      // Create scene
      const scene = new BABYLON.Scene(engine)
      scene.clearColor = new BABYLON.Color3(0.1, 0.1, 0.1)
      
      // Create isometric camera
      const camera = new BABYLON.ArcRotateCamera(
        'camera', 
        -Math.PI / 4, 
        Math.PI / 3, 
        10, 
        BABYLON.Vector3.Zero(), 
        scene
      )
      
      // Attach camera controls (debug available methods)
      console.log('🔍 Camera methods available:', Object.getOwnPropertyNames(camera).filter(name => name.includes('attach')))
      
      try {
        // Try different attachment methods
        if (typeof camera.attachToCanvas === 'function') {
          camera.attachToCanvas(canvas, true)
          console.log('✅ Camera attached via attachToCanvas')
        } else if (typeof camera.attachControls === 'function') {
          camera.attachControls(canvas)
          console.log('✅ Camera attached via attachControls')
        } else {
          // Manual setup
          camera.setTarget(BABYLON.Vector3.Zero())
          scene.activeCamera = camera
          console.log('✅ Camera set manually as active camera')
        }
      } catch (cameraError) {
        console.error('⚠️ Camera attachment failed:', cameraError)
        camera.setTarget(BABYLON.Vector3.Zero())
        scene.activeCamera = camera
      }
      
      // Add lighting
      const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene)
      light.intensity = 0.7
      
      // Create default geometry
      const mesh = createGeometry(currentGeometry, vertexCount, BABYLON, scene)
      
      // Animation loop
      engine.runRenderLoop(() => {
        // Slow rotation for better viewing
        if (mesh) {
          mesh.rotation.x += 0.005
          mesh.rotation.y += 0.01
        }
        scene.render()
      })
      
      // Handle resize properly
      const handleResize = () => {
        if (container && engine) {
          const newRect = container.getBoundingClientRect()
          canvas.width = newRect.width
          canvas.height = newRect.height
          canvas.style.width = `${newRect.width}px`
          canvas.style.height = `${newRect.height}px`
          engine.setSize(newRect.width, newRect.height)
          engine.resize()
          console.log(`📐 Resized to: ${newRect.width}x${newRect.height}`)
        }
      }
      
      window.addEventListener('resize', handleResize)
      
      // Store scene data
      setBabylonScene({ 
        engine, 
        scene, 
        camera, 
        mesh, 
        BABYLON,
        light
      })
      
      console.log('✅ Babylon.js scene initialized')
      console.log(`📐 Current geometry: ${currentGeometry} with ${vertexCount} subdivisions`)
      
    } catch (error) {
      console.error('❌ Failed to initialize Babylon.js scene:', error)
      setTestMessage(`Failed to initialize Babylon.js: ${error.message}`)
    }
  }

  // Create geometry based on type and vertex count
  const createGeometry = (type: GeometryType, subdivisions: number, BABYLON: any, scene: any) => {
    console.log(`🔺 Creating ${type} with ${subdivisions} subdivisions`)
    
    let mesh: any
    
    switch (type) {
      case 'sphere':
        mesh = BABYLON.MeshBuilder.CreateSphere('sphere', {
          diameter: 3,
          segments: subdivisions
        }, scene)
        break
        
      case 'cube':
        mesh = BABYLON.MeshBuilder.CreateBox('cube', {
          size: 3,
          subdivisions: subdivisions
        }, scene)
        break
        
      case 'landscape-box':
        mesh = BABYLON.MeshBuilder.CreateBox('landscapeBox', {
          width: 10,
          height: 3, 
          depth: 10,
          subdivisionsX: subdivisions,
          subdivisionsY: Math.floor(subdivisions / 3),
          subdivisionsZ: subdivisions
        }, scene)
        break
    }
    
    // Default material
    const material = new BABYLON.StandardMaterial('defaultMaterial', scene)
    material.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4)
    mesh.material = material
    
    console.log(`✅ Created ${type} with ~${mesh.getTotalVertices()} vertices`)
    return mesh
  }

  // Switch geometry type
  const switchGeometry = (newType: GeometryType) => {
    if (!babylonScene) return
    
    console.log(`🔄 Switching geometry from ${currentGeometry} to ${newType}`)
    
    // Remove old mesh
    if (babylonScene.mesh) {
      babylonScene.mesh.dispose()
    }
    
    // Create new mesh
    const newMesh = createGeometry(newType, vertexCount, babylonScene.BABYLON, babylonScene.scene)
    
    // Update scene
    setBabylonScene({ ...babylonScene, mesh: newMesh })
    setCurrentGeometry(newType)
    setTestMessage(`Switched to ${newType} (${newMesh.getTotalVertices()} vertices)`)
  }

  // Update vertex count
  const updateVertexCount = (newCount: number) => {
    if (!babylonScene) return
    
    console.log(`🔢 Updating vertex count from ${vertexCount} to ${newCount}`)
    
    // Remove old mesh
    if (babylonScene.mesh) {
      babylonScene.mesh.dispose()
    }
    
    // Create new mesh with updated vertex count
    const newMesh = createGeometry(currentGeometry, newCount, babylonScene.BABYLON, babylonScene.scene)
    
    // Update scene
    setBabylonScene({ ...babylonScene, mesh: newMesh })
    setVertexCount(newCount)
    setTestMessage(`Updated ${currentGeometry} to ${newMesh.getTotalVertices()} vertices`)
  }

  // Apply procedural texture with nested Pipeline F functions
  const applyPipelineFTexture = async () => {
    if (!babylonScene) {
      console.log('⚠️ No Babylon.js scene available')
      return
    }

    try {
      console.log('🎨 Creating nested Pipeline F procedural texture...')
      const { mesh, scene, BABYLON } = babylonScene
      
      // Create nested Pipeline F fragment shader
      const pipelineFShader = `
precision highp float;
varying vec2 vUV;

// Pipeline F Step 1: Distance Modulus (Virtual Centers)
vec2 applyDistanceModulus(vec2 coord, float modulus) {
    if (modulus > 0.0) {
        return mod(coord + modulus * 0.5, modulus) - modulus * 0.5;
    }
    return coord;
}

// Pipeline F Step 2: Angular Distortion
vec2 applyAngularDistortion(vec2 coord, float frequency, float amplitude, float offset) {
    float angle = atan(coord.y, coord.x);
    float radius = length(coord);
    angle += sin(angle * frequency + offset * 0.017453) * amplitude * 0.01;
    return vec2(cos(angle) * radius, sin(angle) * radius);
}

// Pipeline F Step 3: Fractal Distortion (3-scale)
vec2 applyFractalDistortion(vec2 coord, float scale1, float scale2, float scale3, float strength) {
    vec2 result = coord;
    result.x += sin(coord.y * scale1) * strength * 0.3;
    result.y += cos(coord.x * scale2) * strength * 0.3;
    result.x += sin(coord.y * scale3) * strength * 0.1;
    return result;
}

// Pipeline F Step 4: Distance Calculations
float calculateRadialDistance(vec2 coord) { return length(coord); }
float calculateCartesianX(vec2 coord) { return abs(coord.x); }
float calculateCartesianY(vec2 coord) { return abs(coord.y); }
float calculateManhattan(vec2 coord) { return abs(coord.x) + abs(coord.y); }
float calculateChebyshev(vec2 coord) { return max(abs(coord.x), abs(coord.y)); }

// Pipeline F Step 5: Checkerboard Pattern
float applyCheckerboard(float pattern, float distance, float steps) {
    if (steps > 0.0) {
        float checker = floor(distance / steps);
        if (mod(checker, 2.0) > 0.5) {
            return 1.0 - pattern;
        }
    }
    return pattern;
}

// Main nested processing function
vec3 processNestedPipelineF(vec2 uv) {
    // Convert UV to world coordinates
    vec2 coord = (uv - 0.5) * 20.0;
    
    // Nested Pipeline F processing (modular functions)
    coord = applyDistanceModulus(coord, 50.0);           // Virtual centers
    coord = applyAngularDistortion(coord, 8.0, 30.0, 45.0); // Angular warping
    coord = applyFractalDistortion(coord, 0.01, 0.05, 0.1, 10.0); // 3-scale fractal
    
    // Calculate distance and generate pattern
    float distance = calculateRadialDistance(coord);
    distance *= 0.5; // Curve scaling
    float pattern = sin(distance * 2.0) * 0.5 + 0.5;
    
    // Apply checkerboard effect
    pattern = applyCheckerboard(pattern, distance, 20.0);
    
    // Generate color variation
    return vec3(pattern, pattern * 0.8, pattern * 0.6);
}

void main() {
    vec3 color = processNestedPipelineF(vUV);
    gl_FragColor = vec4(color, 1.0);
}`;

      // Create procedural texture with nested Pipeline F
      const proceduralTexture = new BABYLON.ProceduralTexture(
        "nestedPipelineF", 
        1024, 
        pipelineFShader, 
        scene
      )
      
      // Create material and apply texture
      const material = new BABYLON.StandardMaterial("pipelineFMaterial", scene)
      material.diffuseTexture = proceduralTexture
      material.disableLighting = true // Show texture clearly
      
      // Apply to current mesh
      if (mesh) {
        mesh.material = material
        console.log('✅ Nested Pipeline F texture applied')
        setTestMessage(`Applied nested Pipeline F texture to ${currentGeometry}`)
      }
      
    } catch (error) {
      console.error('❌ Failed to apply Pipeline F texture:', error)
      setTestMessage(`Failed to apply texture: ${error.message}`)
    }
  }

  // Apply selected shader to the mesh (placeholder for future Babylon.js shader implementation)
  const applyShaderToMesh = async (shader: Shader) => {
    if (!babylonScene) {
      console.log('⚠️ No Babylon.js scene available')
      return
    }

    try {
      console.log(`🎨 Applying shader to ${currentGeometry}: ${shader.name}`)
      // TODO: Convert Three.js shader to Babylon.js format
      setTestMessage(`Shader conversion coming soon: ${shader.name}`)
      
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

  // Apply hardcoded test shader (guaranteed to work)
  const applyHardcodedTestShader = () => {
    if (!threejsScene) {
      setTestMessage('Three.js scene not initialized')
      return
    }

    try {
      console.log('🧪 Applying hardcoded test shader...')
      const { cube, THREE } = threejsScene
      
      // Simple, guaranteed-to-work Three.js shader
      const testShader = `
varying vec2 vUv;
uniform float time;

void main() {
    vec2 coord = vUv * 8.0;
    float dist = length(coord - 4.0);
    float pattern = sin(dist * 2.0 + time) * 0.5 + 0.5;
    
    vec3 color = vec3(
        pattern,
        pattern * 0.8,
        sin(time * 0.5) * 0.5 + 0.5
    );
    
    gl_FragColor = vec4(color, 1.0);
}`
      
      const testMaterial = new THREE.ShaderMaterial({
        fragmentShader: testShader,
        vertexShader: `
          varying vec2 vUv;
          uniform float time;
          
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        uniforms: {
          time: { value: 0.0 }
        }
      })
      
      // Update time in animation loop
      const originalAnimate = threejsScene.animate
      if (originalAnimate) {
        const animateWithTime = () => {
          testMaterial.uniforms.time.value = Date.now() * 0.001
          originalAnimate()
        }
        animateWithTime()
      }
      
      cube.material = testMaterial
      console.log('✅ Hardcoded test shader applied')
      setTestMessage('Test shader applied - animated procedural texture')
      
    } catch (error) {
      console.error('❌ Failed to apply test shader:', error)
      setTestMessage(`Test shader failed: ${error.message}`)
    }
  }

  const runShaderTest = () => {
    console.log('🎨 Running shader test...')
    if (selectedShader) {
      applyShaderToMesh(selectedShader)
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
                  // Apply shader to Babylon.js mesh (coming soon)
                  applyShaderToMesh(shader)
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
            <h3>Geometry Controls</h3>
            
            <div className="form-group">
              <label>Geometry Type:</label>
              <div className="button-row">
                <button 
                  onClick={() => switchGeometry('sphere')}
                  className={`test-btn ${currentGeometry === 'sphere' ? 'active' : 'secondary'}`}
                >
                  Sphere
                </button>
                <button 
                  onClick={() => switchGeometry('cube')}
                  className={`test-btn ${currentGeometry === 'cube' ? 'active' : 'secondary'}`}
                >
                  Cube
                </button>
                <button 
                  onClick={() => switchGeometry('landscape-box')}
                  className={`test-btn ${currentGeometry === 'landscape-box' ? 'active' : 'secondary'}`}
                >
                  Landscape
                </button>
              </div>
            </div>
            
            <div className="form-group">
              <label>Vertex Count: {vertexCount}</label>
              <input 
                type="range" 
                min="4" 
                max="128" 
                step="4"
                value={vertexCount}
                onChange={(e) => updateVertexCount(parseInt(e.target.value))}
                className="vertex-slider"
              />
              <div className="vertex-info">
                {babylonScene?.mesh ? `${babylonScene.mesh.getTotalVertices()} vertices` : 'No mesh'}
              </div>
            </div>
          </div>

          <div className="test-section">
            <h3>Scene Controls</h3>
            <button 
              onClick={() => {
                initBabylonScene()
                setTestMessage('Babylon.js scene reinitialized')
              }} 
              className="test-btn"
            >
              Reinit Scene
            </button>
          </div>

          <div className="test-section">
            <h3>Shader Tests</h3>
            <button 
              onClick={() => applyPipelineFTexture()}
              className="test-btn"
              style={{ backgroundColor: '#00ff88', color: '#000' }}
            >
              Apply Pipeline F
            </button>
            <button onClick={runShaderTest} className="test-btn">
              Apply Selected Shader
            </button>
            <button 
              onClick={() => {
                if (babylonScene?.mesh) {
                  const { mesh, BABYLON, scene } = babylonScene
                  const defaultMaterial = new BABYLON.StandardMaterial('default', scene)
                  defaultMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4)
                  mesh.material = defaultMaterial
                  setTestMessage('Reset to default material')
                }
              }}
              className="test-btn secondary"
            >
              Reset Material
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
          {/* Babylon.js viewport - WebGPU accelerated */}
          <div 
            ref={babylonContainerRef}
            className="babylon-viewport"
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </div>
  )
}

export default Testing
