import React, { useEffect, useRef, useState } from 'react'
import Header from '../../components/Header'
import { SaveButton } from '../../components/shared'
import { apiUrl } from '../../config/environments'
import { unityShaderGenerator } from '../../utils/unityShaderGenerator'
import { glslShaderGenerator } from '../../utils/glslShaderGenerator'
import './Merzbow.css'

interface DistortionControl {
  id: string
  name: string
  'angular-distortion': boolean
  'fractal-distortion': boolean
  'checkerboard-pattern': boolean
  'distance-calculation': string
  'distance-modulus': number
  'curve-scaling': number
  'checkerboard-steps': number
  'angular-frequency': number
  'angular-amplitude': number
  'angular-offset': number
  'fractal-scale-1': number
  'fractal-scale-2': number
  'fractal-scale-3': number
  'fractal-strength': number
  updatedAt?: string
}

interface Curve {
  id: string
  name: string
  'curve-data': number[]
  'curve-width': number
}

interface Palette {
  id: string
  name: string
  hexColors: string[]
  colorCount: number
  hasAlpha: boolean
  updatedAt?: string
}

// Manual Link Button Component - shows when curve or palette not linked
interface LinkButtonProps {
  selectedCurve: Curve | null
  selectedPalette: Palette | null  
  selectedDistortionControl: DistortionControl | null
  onLink: () => Promise<void>
}

const LinkButton: React.FC<LinkButtonProps> = ({ selectedCurve, selectedPalette, selectedDistortionControl, onLink }) => {
  const [linkStatus, setLinkStatus] = useState({ curveLinked: false, paletteLinked: false })
  const [isChecking, setIsChecking] = useState(false)
  
  // Check link status when selections change
  useEffect(() => {
    const checkStatus = async () => {
      if (!selectedDistortionControl) {
        setLinkStatus({ curveLinked: false, paletteLinked: false })
        return
      }
      
      setIsChecking(true)
      try {
        const response = await fetch(`${apiUrl}/api/distortion-control-links/control/${selectedDistortionControl.id}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data && data.data.length > 0) {
            const link = data.data[0]
            const curveLinked = selectedCurve ? link.curveId === selectedCurve.id : false
            const paletteLinked = selectedPalette ? link.paletteName === selectedPalette.name : false
            setLinkStatus({ curveLinked, paletteLinked })
          } else {
            setLinkStatus({ curveLinked: false, paletteLinked: false })
          }
        }
      } catch (error) {
        console.error('Error checking link status:', error)
        setLinkStatus({ curveLinked: false, paletteLinked: false })
      } finally {
        setIsChecking(false)
      }
    }
    
    checkStatus()
  }, [selectedCurve?.id, selectedPalette?.name, selectedDistortionControl?.id])
  
  const needsLinking = (selectedCurve && !linkStatus.curveLinked) || (selectedPalette && !linkStatus.paletteLinked)
  const bothLinked = selectedCurve && selectedPalette && linkStatus.curveLinked && linkStatus.paletteLinked
  
  // Hide button if both are linked, no DP selected, or no curve/palette selected
  if (bothLinked || !needsLinking || !selectedDistortionControl || (!selectedCurve && !selectedPalette)) {
    return null
  }
  
  return (
    <div className="form-group">
      <button 
        onClick={onLink}
        className="link-button"
        disabled={isChecking}
        style={{
          backgroundColor: '#f4d03f',
          color: '#333',
          border: 'none',
          borderRadius: '4px',
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
          width: '100%'
        }}
      >
        {isChecking ? 'Checking...' : 'Link Curve and Palette'}
      </button>
    </div>
  )
}

// Curve Link Button Component (UNUSED)
const CurveLinkButton: React.FC<{
  curveName: string
  distortionControlId: string
  onLink: () => void
}> = ({ curveName, distortionControlId, onLink }) => {
  const [isLinked, setIsLinked] = useState<boolean | null>(null)
  const [isLinking, setIsLinking] = useState(false)

  useEffect(() => {
    const checkLink = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/distortion-control-links/curve/${curveName}`)
        if (response.ok) {
          const data = await response.json()
          const linked = data.success && data.data.hasLink && data.data.distortionControl?.id === distortionControlId
          setIsLinked(linked)
        }
      } catch (error) {
        console.error('Failed to check link:', error)
        setIsLinked(false)
      }
    }
    checkLink()
  }, [curveName, distortionControlId])

  const handleLink = async () => {
    setIsLinking(true)
    try {
      await onLink()
      setIsLinked(true)
    } catch (error) {
      console.error('Failed to link:', error)
    } finally {
      setIsLinking(false)
    }
  }

  if (isLinked === null) return <div>Checking link...</div>
  if (isLinked) return null // Hide when linked

  return (
    <button onClick={handleLink} disabled={isLinking} className="link-button yellow">
      {isLinking ? 'Linking...' : 'Link Curve'}
    </button>
  )
}

// Palette Link Button Component (Using generic palette-links API)
const PaletteLinkButton: React.FC<{
  distortionControlId: string
  paletteId: string
  paletteName: string
  onLink: () => void
}> = ({ distortionControlId, paletteId, paletteName, onLink }) => {
  const [isLinked, setIsLinked] = useState<boolean | null>(null)
  const [isLinking, setIsLinking] = useState(false)

  useEffect(() => {
    const checkLink = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/palette-links/distortion/${distortionControlId}`)
        if (response.ok) {
          const data = await response.json()
          const linked = data.success && data.data.hasLink && data.data.link?.paletteId === paletteId
          setIsLinked(linked)
        } else {
          setIsLinked(false)
        }
      } catch (error) {
        console.error('Failed to check palette link:', error)
        setIsLinked(false)
      }
    }
    checkLink()
  }, [distortionControlId, paletteId])

  const handleLink = async () => {
    setIsLinking(true)
    try {
      await onLink()
      setIsLinked(true)
    } catch (error) {
      console.error('Failed to link palette:', error)
    } finally {
      setIsLinking(false)
    }
  }

  if (isLinked === null) return <div>Checking link...</div>
  if (isLinked) return null // Hide when linked

  return (
    <button onClick={handleLink} disabled={isLinking} className="link-button">
      {isLinking ? 'Linking...' : 'Link Palette'}
    </button>
  )
}

const Merzbow: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Database state
  const [availableDistortionControls, setAvailableDistortionControls] = useState<DistortionControl[]>([])
  const [selectedDistortionControl, setSelectedDistortionControl] = useState<DistortionControl | null>(null)
  const [availableCurves, setAvailableCurves] = useState<Curve[]>([])
  const [selectedCurve, setSelectedCurve] = useState<Curve | null>(null)
  const [availablePalettes, setAvailablePalettes] = useState<Palette[]>([])
  const [selectedPalette, setSelectedPalette] = useState<Palette | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingDP, setIsLoadingDP] = useState(false)
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false)
  const [lastActiveCurve, setLastActiveCurve] = useState<string | null>(null)
  const [previousPaletteName, setPreviousPaletteName] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)

  // Collapsible sections state - only top panel open by default
  const [expandedSections, setExpandedSections] = useState({
    profile: true,    // Distortion Profile panel open
    links: false,     // All other panels closed
    settings: false,
    angular: false,
    fractal: false,
    export: false
  })

  // Toggle section visibility
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // State for all Pipeline F parameters
  const [angularEnabled, setAngularEnabled] = useState(false)
  const [angularFrequency, setAngularFrequency] = useState(6.0)
  const [angularAmplitude, setAngularAmplitude] = useState(20.0)
  const [angularOffset, setAngularOffset] = useState(0.0)

  const [fractalEnabled, setFractalEnabled] = useState(false)
  const [fractalScale1, setFractalScale1] = useState(0.01)
  const [fractalScale2, setFractalScale2] = useState(0.05)
  const [fractalScale3, setFractalScale3] = useState(0.1)
  const [fractalStrength, setFractalStrength] = useState(10)

  const [distanceCalc, setDistanceCalc] = useState('radial')
  const [distanceModulus, setDistanceModulus] = useState(0)
  const [curveScaling, setCurveScaling] = useState(1.0)
  const [isMouseDragging, setIsMouseDragging] = useState(false)

  const [checkerboardEnabled, setCheckerboardEnabled] = useState(false)
  const [checkerboardSteps, setCheckerboardSteps] = useState(50)

  // Center offset for dragging
  const [centerOffsetX, setCenterOffsetX] = useState(0)
  const [centerOffsetY, setCenterOffsetY] = useState(0)

  // 3D Preview state
  const [showPreview, setShowPreview] = useState(false)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  // Load available distortion controls from API
  const loadDistortionControls = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api/distortion-controls/firebase`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const controls = data.data.distortionControls
          setAvailableDistortionControls(controls)
          
          // Don't auto-load here - will be handled after all data is loaded
        }
      }
    } catch (error) {
      console.error('Failed to load distortion controls:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load available curves from API
  const loadCurves = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/curves`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setAvailableCurves(data.data.curves || [])
        }
      }
    } catch (error) {
      console.error('Failed to load curves:', error)
    }
  }

  // Load available palettes from API
  const loadPalettes = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/palettes`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const palettes = data.data.palettes
          setAvailablePalettes(palettes)
          
          // Load default grayscale palette if available
          const grayscale = palettes.find((p: Palette) => p.name.toLowerCase().includes('grayscale'))
          if (grayscale && !selectedPalette) {
            setSelectedPalette(grayscale)
          }
        }
      }
    } catch (error) {
      console.error('🚨 CRITICAL FAILURE loading palettes from API:', error)
      console.error('🚨 Application cannot function without palette data')
      alert(`CRITICAL ERROR: Failed to load palettes from API. Application may not function properly.`)
      throw error
    }
  }

  // Load distortion control into UI and find its linked curve
  const loadDistortionControl = async (control: DistortionControl) => {
    if (isLoadingDP) {
      console.log(`⏳ Already loading DP, skipping request for: ${control.name}`)
      return
    }
    
    setIsLoadingDP(true)
    
    try {
      console.log(`\n🔄 ===== LOADING DISTORTION PROFILE: ${control.name} =====`)
      console.log(`📋 Profile ID: ${control.id}`)
    
    // COMPLETE CACHE/STATE CLEARING
    console.log(`🧹 CLEARING ALL CACHED STATE...`)
    console.log(`   🗑️ Clearing selectedCurve (was: ${selectedCurve?.name || 'none'})`)
    console.log(`   🗑️ Clearing selectedPalette (was: ${selectedPalette?.name || 'none'})`)
    console.log(`   🗑️ Clearing selectedDistortionControl (was: ${selectedDistortionControl?.name || 'none'})`)
    console.log(`   🗑️ Resetting all flags and states`)
    
    // Store previous palette name for comparison
    setPreviousPaletteName(selectedPalette?.name || null)
    
    // Clear related state BUT keep selectedDistortionControl stable for dropdown
    setSelectedCurve(null)
    setSelectedPalette(null)
    setHasUnsavedChanges(false)
    setIsProcessing(false)
    setIsSaving(false)
    
    // Set the new distortion control IMMEDIATELY to prevent dropdown dancing
    setSelectedDistortionControl(control)
    
    // Smaller delay just for curve/palette state clearing
    console.log(`⏱️ Waiting for curve/palette state clear...`)
    await new Promise(resolve => setTimeout(resolve, 50))
    console.log('📥 LOADING DISTORTION SETTINGS FROM DP:', JSON.stringify(control, null, 2))
    
    setAngularEnabled(control['angular-distortion'])
    setFractalEnabled(control['fractal-distortion'])
    setCheckerboardEnabled(control['checkerboard-pattern'])
    setDistanceCalc(control['distance-calculation'])
    setDistanceModulus(control['distance-modulus'])
    setCurveScaling(control['curve-scaling'])
    setCheckerboardSteps(control['checkerboard-steps'])
    setAngularFrequency(control['angular-frequency'])
    setAngularAmplitude(control['angular-amplitude'])
    setAngularOffset(control['angular-offset'])
    setFractalScale1(control['fractal-scale-1'])
    setFractalScale2(control['fractal-scale-2'])
    setFractalScale3(control['fractal-scale-3'])
    setFractalStrength(control['fractal-strength'])
    
    console.log('📥 LOADED SETTINGS TO STATE - Angular:', control['angular-distortion'], 'Fractal:', control['fractal-distortion'])
    setHasUnsavedChanges(false)

    // Find and load linked curve and palette from consolidated distortion-control-links
    try {
      console.log(`🔍 Looking for links to distortion control: ${control.id}`)
      
      const response = await fetch(`${apiUrl}/api/distortion-control-links/control/${control.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data && data.data.length > 0) {
          // Single link per DP - use the first (and only) link
          const link = data.data[0]
          console.log(`🔗 Processing single link for DP:`, JSON.stringify(link, null, 2))
          
          // Load linked curve (link uses curve ID, find by ID in available curves)
          if (link.curveId) {
            const linkedCurve = availableCurves.find(c => c.id === link.curveId)
            if (linkedCurve) {
              console.log(`✅ Found linked curve: ${linkedCurve.name} (ID: ${linkedCurve.id}) → ${control.name}`)
              setSelectedCurve(linkedCurve)
            } else {
              console.log(`❌ Linked curve ID "${link.curveId}" not found in available curves`)
              console.log(`🔍 Available curve IDs: ${availableCurves.map(c => c.id).join(', ')}`)
            }
          }
          
          // Load linked palette
          if (link.paletteName) {
            const linkedPalette = availablePalettes.find(p => p.name === link.paletteName)
            if (linkedPalette) {
              console.log(`✅ Found linked palette: ${linkedPalette.name} → ${control.name}`)
              setSelectedPalette(linkedPalette)
            } else {
              console.error(`🚨 CRITICAL PALETTE ERROR: Linked palette "${link.paletteName}" not found in available palettes`)
              console.error(`🚨 Available palettes: ${availablePalettes.map(p => p.name).join(', ')}`)
              console.error(`🚨 This indicates a broken link in distortion-control-links collection`)
              throw new Error(`Palette link broken: "${link.paletteName}" not found`)
            }
          } else {
            console.log(`⚠️ No palette linked to DP "${control.name}" - will auto-select most recent`)
          }
        } else {
          console.log(`⚠️ No links found for distortion control: ${control.name}`)
          console.log(`🎯 Keeping current user selections (no auto-selection on DP switch)`)
          console.log(`   Current curve: ${selectedCurve?.name || 'none'}`)
          console.log(`   Current palette: ${selectedPalette?.name || 'none'}`)
          console.log(`💡 User can manually link current selections using the link button`)
        }
      }
    } catch (error) {
      console.error('🚨 CRITICAL ERROR loading linked curve and palette:', error)
      console.error('🚨 This indicates a serious data integrity issue')
      alert(`CRITICAL ERROR loading links for "${control.name}": ${error instanceof Error ? error.message : String(error)}`)
      throw new Error(error instanceof Error ? error.message : String(error))
    }

    // VALIDATION: Check if loaded elements match user selection (use control parameter, not state)
    console.log(`\n🔍 ===== VALIDATION & FINAL STATE =====`)
    console.log(`📋 User Selected: "${control.name}" (ID: ${control.id})`)
    console.log(`🎯 Loaded Curve: ${selectedCurve?.name || 'NONE'}`)
    console.log(`🎨 Loaded Palette: ${selectedPalette?.name || 'NONE'}`)
    console.log(`🎛️ DP Being Loaded: ${control.name}`)
    
    // Note: selectedDistortionControl state may not be updated yet due to React async updates
    console.log(`✅ Loading DP: ${control.name} - state will update momentarily`)
    
    // Check if we're using the same palette as before
    const currentPaletteName = selectedPalette?.name
    const isSamePalette = currentPaletteName === previousPaletteName
    console.log(`🎨 Palette Check: Current="${currentPaletteName}", Previous="${previousPaletteName}", Same=${isSamePalette}`)
    
    console.log(`🔧 Settings: Angular=${control['angular-distortion']}, Fractal=${control['fractal-distortion']}, Checkerboard=${control['checkerboard-pattern']}`)
    console.log(`📏 Distance: ${control['distance-calculation']}, Modulus=${control['distance-modulus']}, Scaling=${control['curve-scaling']}`)
    console.log(`🎨 Render will be triggered by useEffect in 200ms`)
    console.log(`===== END VALIDATION =====\n`)
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR in loadDistortionControl:', error)
    // Reset states on error to prevent hanging
    setIsLoadingDP(false)
    setIsProcessing(false)
    setIsSaving(false)
  } finally {
    setIsLoadingDP(false)
  }
  }

  // Save current distortion control
  // Generate self-contained Three.js shader and auto-link to distortion profile
  const generateAndLinkShader = async (distortionControl: DistortionControl) => {
    console.log('🎨 Generating self-contained shader for:', distortionControl.name)
    
    // Generate optimized Three.js texture shader with baked parameters
    const threeJsShader = `// Three.js Procedural Texture Shader
// Generated from: ${distortionControl.name}
// Timestamp: ${new Date().toISOString()}
// Type: Self-contained texture shader for Three.js materials

// Standard Three.js varyings (automatically provided)
varying vec2 vUv;           // Texture coordinates (0-1)
varying vec3 vPosition;     // Local position
varying vec3 vNormal;       // Surface normal

// Optional time uniform for animation
uniform float time;

// Baked Pipeline F parameters (no external uniforms needed)
#define ANGULAR_ENABLED ${distortionControl['angular-distortion'] ? '1.0' : '0.0'}
#define FRACTAL_ENABLED ${distortionControl['fractal-distortion'] ? '1.0' : '0.0'}
#define CHECKERBOARD_ENABLED ${distortionControl['checkerboard-pattern'] ? '1.0' : '0.0'}
#define CURVE_SCALING ${distortionControl['curve-scaling']}
#define CHECKERBOARD_STEPS ${distortionControl['checkerboard-steps']}.0
#define ANGULAR_FREQUENCY ${distortionControl['angular-frequency']}
#define ANGULAR_AMPLITUDE ${distortionControl['angular-amplitude']}
#define ANGULAR_OFFSET ${distortionControl['angular-offset']}
#define FRACTAL_SCALE_1 ${distortionControl['fractal-scale-1']}
#define FRACTAL_SCALE_2 ${distortionControl['fractal-scale-2']}
#define FRACTAL_STRENGTH ${distortionControl['fractal-strength']}.0
#define DISTANCE_MODULUS ${distortionControl['distance-modulus']}.0

// Distance calculation: ${distortionControl['distance-calculation']}
float calculateDistance(vec2 coord) {
    ${distortionControl['distance-calculation'] === 'radial' ? 
      'return length(coord);' :
    distortionControl['distance-calculation'] === 'cartesian-x' ?
      'return abs(coord.x);' :
    distortionControl['distance-calculation'] === 'cartesian-y' ?
      'return abs(coord.y);' :
    distortionControl['distance-calculation'] === 'manhattan' ?
      'return abs(coord.x) + abs(coord.y);' :
    distortionControl['distance-calculation'] === 'chebyshev' ?
      'return max(abs(coord.x), abs(coord.y));' :
      'return length(coord);' // default to radial
    }
}

// Self-contained Pipeline F implementation
vec3 generatePattern(vec2 textureCoord) {
    // Convert UV coordinates (0-1) to world coordinates
    vec2 coord = (textureCoord - 0.5) * 10.0; // Scale for better pattern visibility
    vec2 processedCoord = coord;
    
    // Distance modulus (virtual centers for tiling)
    if (DISTANCE_MODULUS > 0.0) {
        processedCoord = mod(processedCoord + DISTANCE_MODULUS * 0.5, DISTANCE_MODULUS) - DISTANCE_MODULUS * 0.5;
    }
    
    // Angular distortion
    if (ANGULAR_ENABLED > 0.5) {
        float angle = atan(processedCoord.y, processedCoord.x);
        float radius = length(processedCoord);
        angle += sin(angle * ANGULAR_FREQUENCY + radians(ANGULAR_OFFSET)) * ANGULAR_AMPLITUDE * 0.01;
        processedCoord = vec2(cos(angle), sin(angle)) * radius;
    }
    
    // Fractal distortion
    if (FRACTAL_ENABLED > 0.5) {
        processedCoord.x += sin(processedCoord.y * FRACTAL_SCALE_1 * 100.0) * FRACTAL_STRENGTH * 0.1;
        processedCoord.y += cos(processedCoord.x * FRACTAL_SCALE_2 * 100.0) * FRACTAL_STRENGTH * 0.1;
    }
    
    // Calculate final distance
    float distance = calculateDistance(processedCoord);
    
    // Apply curve scaling
    distance *= CURVE_SCALING;
    
    // Generate pattern (procedural texture)
    float pattern = sin(distance * 2.0) * 0.5 + 0.5;
    
    // Checkerboard effect
    if (CHECKERBOARD_ENABLED > 0.5 && CHECKERBOARD_STEPS > 0.0) {
        float checker = floor(distance / CHECKERBOARD_STEPS);
        if (mod(checker, 2.0) > 0.5) {
            pattern = 1.0 - pattern;
        }
    }
    
    // Generate color variation
    return vec3(
        pattern,
        pattern * 0.8 + sin(distance * 0.5) * 0.2,
        pattern * 0.6 + cos(distance * 0.3) * 0.4
    );
}

void main() {
    // Use standard Three.js texture coordinates
    vec3 color = generatePattern(vUv);
    
    // Three.js standard output
    gl_FragColor = vec4(color, 1.0);
}

// === USAGE IN THREE.JS ===
// const material = new THREE.ShaderMaterial({
//   fragmentShader: thisShader,
//   vertexShader: THREE.ShaderLib.basic.vertexShader,
//   uniforms: { time: { value: 0.0 } }
// });`;

    // Create shader document with kebab-case name
    const toKebabCase = (str: string) => {
      return str
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    };
    
    const shaderName = `${toKebabCase(distortionControl.name)}-glsl`;
    const shaderData = {
      name: shaderName,
      category: 'level-one-shaders',
      glsl: {
        'three-js': threeJsShader
      }
    };
    
    console.log('🔄 Creating shader document:', shaderName)
    
    // Create shader via API
    const shaderResponse = await fetch(`${apiUrl}/api/shaders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shaderData)
    });
    
    if (shaderResponse.ok) {
      const createdShader = await shaderResponse.json();
      console.log('✅ Shader created:', createdShader.data.name);
      
      // Auto-link shader to distortion profile
      const linkBody = {
        distortionControlId: distortionControl.id,
        shaderName: createdShader.data.name
      };
      
      const linkResponse = await fetch(`${apiUrl}/api/distortion-control-links/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(linkBody)
      });
      
      if (linkResponse.ok) {
        console.log('✅ Shader auto-linked to distortion profile');
      } else {
        console.error('❌ Failed to link shader:', linkResponse.statusText);
      }
      
    } else if (shaderResponse.status === 409) {
      // Shader already exists - update it instead
      console.log('🔄 Shader exists, updating...');
      
      const updateResponse = await fetch(`${apiUrl}/api/shaders/${shaderName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shaderData)
      });
      
      if (updateResponse.ok) {
        console.log('✅ Shader updated successfully');
      } else {
        console.error('❌ Failed to update shader:', updateResponse.statusText);
      }
    } else {
      const errorData = await shaderResponse.text();
      console.error('❌ Failed to create shader:', shaderResponse.status, shaderResponse.statusText);
      console.error('❌ API Error Details:', errorData);
    }
  }

  const saveDistortionControl = async () => {
    if (!selectedDistortionControl || isSaving) return
    
    setIsSaving(true)
    
    // VALIDATION & AUTO-LINKING: Check links exist, create missing ones
    console.log(`🔍 VALIDATING & AUTO-LINKING BEFORE SAVE...`)
    
    try {
      const linksResponse = await fetch(`${apiUrl}/api/distortion-control-links/control/${selectedDistortionControl.id}`)
      if (linksResponse.ok) {
        const linksData = await linksResponse.json()
        let curveLinked = false
        let paletteLinked = false
        
        if (linksData.success && linksData.data && linksData.data.length > 0) {
          for (const link of linksData.data) {
            if (link.curveId === selectedCurve?.id) curveLinked = true
            if (link.paletteName === selectedPalette?.name) paletteLinked = true
          }
        }
        
        console.log(`🔍 Link Validation Results:`)
        console.log(`   🎯 Curve "${selectedCurve?.name || 'NONE'}" linked: ${curveLinked}`)
        console.log(`   🎨 Palette "${selectedPalette?.name || 'NONE'}" linked: ${paletteLinked}`)
        
        // AUTO-LINK missing curve
        if (selectedCurve && !curveLinked) {
          console.log(`🔗 Auto-linking missing curve: "${selectedCurve.name}" → "${selectedDistortionControl.name}"`)
          try {
            const linkCurveResponse = await fetch(`${apiUrl}/api/distortion-control-links/link`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                curveId: selectedCurve.id, 
                distortionControlId: selectedDistortionControl.id 
              })
            })
            
            if (linkCurveResponse.ok) {
              console.log(`✅ Auto-linked curve successfully`)
            } else {
              console.error(`❌ Failed to auto-link curve:`, linkCurveResponse.statusText)
            }
          } catch (error) {
            console.error(`❌ Error auto-linking curve:`, error)
          }
        }
        
        // AUTO-LINK missing palette
        if (selectedPalette && !paletteLinked) {
          console.log(`🎨 Auto-linking missing palette: "${selectedPalette.name}" → "${selectedDistortionControl.name}"`)
          try {
            // Find existing link to add palette to
            if (linksData.success && linksData.data && linksData.data.length > 0) {
              const existingLink = linksData.data[0] // Use first link
              
              const addPaletteResponse = await fetch(`${apiUrl}/api/distortion-control-links/add-palette`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  linkId: existingLink.id,
                  paletteName: selectedPalette.name 
                })
              })
              
              if (addPaletteResponse.ok) {
                console.log(`✅ Auto-linked palette successfully`)
              } else {
                console.error(`❌ Failed to auto-link palette:`, addPaletteResponse.statusText)
              }
            } else {
              console.error(`❌ Cannot auto-link palette - no existing distortion-control-links found`)
            }
          } catch (error) {
            console.error(`❌ Error auto-linking palette:`, error)
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to validate links:', error)
    }
    
    const updateData = {
      name: selectedDistortionControl.name,
      'angular-distortion': angularEnabled,
      'fractal-distortion': fractalEnabled,
      'checkerboard-pattern': checkerboardEnabled,
      'distance-calculation': distanceCalc,
      'distance-modulus': distanceModulus,
      'curve-scaling': curveScaling,
      'checkerboard-steps': checkerboardSteps,
      'angular-frequency': angularFrequency,
      'angular-amplitude': angularAmplitude,
      'angular-offset': angularOffset,
      'fractal-scale-1': fractalScale1,
      'fractal-scale-2': fractalScale2,
      'fractal-scale-3': fractalScale3,
      'fractal-strength': fractalStrength
    }
    
    console.log('💾 SAVING DISTORTION SETTINGS:', JSON.stringify(updateData, null, 2))

    try {
      const response = await fetch(`${apiUrl}/api/distortion-controls/${selectedDistortionControl.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        const savedData = await response.json()
        console.log('✅ DISTORTION CONTROL SAVED - API RESPONSE:', JSON.stringify(savedData, null, 2))
        setHasUnsavedChanges(false)
        
        // Update the local distortion controls cache with saved data
        setAvailableDistortionControls(prev => 
          prev.map(dp => dp.id === selectedDistortionControl.id ? 
            { ...dp, ...savedData.data } : dp
          )
        )
        console.log('🔄 Updated local DP cache with saved data')
        
        // AUTO-GENERATE SHADER: Create shader document from current distortion profile
        console.log('🎨 Auto-generating shader for saved distortion profile...')
        try {
          await generateAndLinkShader(savedData.data)
        } catch (shaderError) {
          console.error('❌ Error auto-generating shader:', shaderError)
          // Don't fail the save if shader generation fails
        }
        
        // Auto-link current curve and palette when saving
        if (selectedCurve && selectedPalette) {
          console.log('🔗 Auto-linking curve and palette on save...')
          try {
            const linkBody = {
              curveId: selectedCurve.id,
              distortionControlId: selectedDistortionControl.id,
              paletteName: selectedPalette.name
            }
            
            const linkResponse = await fetch(`${apiUrl}/api/distortion-control-links/link`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(linkBody)
            })
            
            if (linkResponse.ok) {
              const linkData = await linkResponse.json()
              console.log('✅ Auto-linked curve and palette on save:', linkData)
            } else {
              console.error('❌ Failed to auto-link on save:', linkResponse.statusText)
            }
          } catch (linkError) {
            console.error('❌ Error auto-linking on save:', linkError)
          }
        }
      } else {
        const errorData = await response.text()
        console.error('❌ SAVE FAILED:', response.status, response.statusText)
        console.error('❌ ERROR DETAILS:', errorData)
        alert(`Failed to save distortion control: ${response.statusText}\n\nError: ${errorData}`)
      }
    } catch (error) {
      console.error('❌ Error saving distortion control:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Create new distortion profile
  const createNewDistortionProfile = async () => {
    if (isCreating) return
    setIsCreating(true)
    
    try {
      const newName = `new-profile-${availableDistortionControls.length + 1}`
      const newProfileData = {
        name: newName,
        'angular-distortion': false,
        'fractal-distortion': false,
        'checkerboard-pattern': false,
        'distance-calculation': 'radial',
        'distance-modulus': 0,
        'curve-scaling': 1.0,
        'checkerboard-steps': 0,
        'angular-frequency': 0.0,
        'angular-amplitude': 0,
        'angular-offset': 0.0,
        'fractal-scale-1': 0.0,
        'fractal-scale-2': 0.0,
        'fractal-scale-3': 0.05,
        'fractal-strength': 1
      }
      
      console.log(`🆕 Creating new distortion profile: "${newName}"`)
      
      const response = await fetch(`${apiUrl}/api/distortion-controls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfileData)
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log(`✅ Created new DP:`, data)
        
        // Reload DPs to get the new one
        await loadDistortionControls()
        
        // Auto-link latest curve and palette to new DP
        const newDP = availableDistortionControls.find(dp => dp.name === newName)
        if (newDP && availableCurves.length > 0 && availablePalettes.length > 0) {
          const latestCurve = [...availableCurves].sort((a, b) => 
            new Date((b as any).updatedAt || '').getTime() - new Date((a as any).updatedAt || '').getTime()
          )[0]
          const latestPalette = [...availablePalettes].sort((a, b) => 
            new Date((b as any).updatedAt || '').getTime() - new Date((a as any).updatedAt || '').getTime()
          )[0]
          
          console.log(`🔗 Auto-linking latest curve "${latestCurve.name}" and palette "${latestPalette.name}" to new DP`)
          
          try {
            const linkBody = {
              curveId: latestCurve.id,
              distortionControlId: newDP.id,
              paletteName: latestPalette.name
            }
            
            const linkResponse = await fetch(`${apiUrl}/api/distortion-control-links/link`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(linkBody)
            })
            
            if (linkResponse.ok) {
              const linkData = await linkResponse.json()
              console.log(`✅ Auto-linked curve and palette to new DP:`, linkData)
              console.log(`🎉 New DP created with latest curve "${latestCurve.name}" and palette "${latestPalette.name}"`)
            } else {
              console.error(`❌ Failed to auto-link to new DP:`, linkResponse.statusText)
            }
          } catch (linkError) {
            console.error(`❌ Error auto-linking to new DP:`, linkError)
          }
        }
      } else {
        const errorData = await response.text()
        console.error(`❌ Failed to create DP:`, errorData)
        alert(`Failed to create distortion profile: ${response.statusText}`)
      }
    } catch (error) {
      console.error('❌ Error creating DP:', error)
    } finally {
      setIsCreating(false)
    }
  }

  // Delete current distortion profile
  const deleteDistortionProfile = async () => {
    if (!selectedDistortionControl || isDeleting) return
    
    if (!confirm(`Delete "${selectedDistortionControl.name}"?`)) return
    
    setIsDeleting(true)
    try {
      const response = await fetch(`${apiUrl}/api/distortion-controls/${selectedDistortionControl.id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setSelectedDistortionControl(null)
        setSelectedCurve(null)
        setSelectedPalette(null)
        await loadDistortionControls()
      } else {
        alert(`Failed to delete: ${response.statusText}`)
      }
    } catch (error) {
      console.error('❌ Error deleting DP:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  // Duplicate current distortion profile
  const duplicateDistortionProfile = async () => {
    if (!selectedDistortionControl || isDuplicating) return
    setIsDuplicating(true)
    
    try {
      const copyName = `${selectedDistortionControl.name}-copy-${availableDistortionControls.length + 1}`
      const duplicateData = { ...selectedDistortionControl, name: copyName }
      delete duplicateData.id
      
      const response = await fetch(`${apiUrl}/api/distortion-controls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicateData)
      })
      
      if (response.ok) {
        const newDPData = await response.json()
        console.log(`✅ Duplicated DP:`, newDPData)
        
        // Reload DPs to get the new one
        await loadDistortionControls()
        
        // Find the new DP and duplicate its link relationships
        const newDP = availableDistortionControls.find(dp => dp.name === copyName)
        if (newDP && selectedCurve && selectedPalette) {
          console.log(`🔗 Duplicating link relationships to new DP "${copyName}"`)
          
          try {
            const linkBody = {
              curveId: selectedCurve.id,
              distortionControlId: newDP.id,
              paletteName: selectedPalette.name
            }
            
            const linkResponse = await fetch(`${apiUrl}/api/distortion-control-links/link`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(linkBody)
            })
            
            if (linkResponse.ok) {
              const linkData = await linkResponse.json()
              console.log(`✅ Link relationships duplicated:`, linkData)
              console.log(`🎉 Duplicate complete with same curve "${selectedCurve.name}" and palette "${selectedPalette.name}"`)
            } else {
              console.error(`❌ Failed to duplicate link relationships:`, linkResponse.statusText)
            }
          } catch (linkError) {
            console.error(`❌ Error duplicating links:`, linkError)
          }
        } else {
          console.log(`⚠️ No current curve/palette to duplicate links for`)
        }
      } else {
        alert(`Failed to duplicate: ${response.statusText}`)
      }
    } catch (error) {
      console.error('❌ Error duplicating DP:', error)
    } finally {
      setIsDuplicating(false)
    }
  }

  // Check if curve is linked to current distortion control
  const checkCurveLink = async (curveName: string) => {
    if (!selectedDistortionControl) return false
    
    try {
      const response = await fetch(`${apiUrl}/api/distortion-control-links/curve/${curveName}`)
      if (response.ok) {
        const data = await response.json()
        return data.success && data.data.hasLink && data.data.distortionControl?.id === selectedDistortionControl.id
      }
    } catch (error) {
      console.error('Failed to check curve link:', error)
    }
    return false
  }

  // Link curve to current distortion control (use curve ID for link table)
  const linkCurveToDistortionControl = async (curveId: string) => {
    if (!selectedDistortionControl) return
    
    try {
      const curve = availableCurves.find(c => c.id === curveId)
      const curveName = curve?.name || curveId
      
      console.log(`🔗 LINKING CURVE: "${curveName}" (ID: ${curveId}) → "${selectedDistortionControl.name}"`)
      
      const requestBody = {
        curveId: curveId, // Use curve ID for link table
        distortionControlId: selectedDistortionControl.id
      }
      console.log(`📦 Creating curve link:`, JSON.stringify(requestBody, null, 2))
      
      const response = await fetch(`${apiUrl}/api/distortion-control-links/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        const data = await response.json()
        console.log(`✅ CURVE LINKED:`, JSON.stringify(data, null, 2))
        console.log(`🎉 SUCCESS: Curve "${curveName}" linked to DP "${selectedDistortionControl.name}"`)
      } else {
        const errorData = await response.text()
        console.error(`🚨 CURVE LINK FAILURE: ${response.status} ${response.statusText}`)
        console.error(`🚨 Error details:`, errorData)
      }
    } catch (error) {
      console.error('Failed to link curve:', error)
    }
  }

  // Link palette to current distortion control using single-link model
  const linkPaletteToDistortionControl = async () => {
    if (!selectedDistortionControl || !selectedPalette) {
      console.log(`❌ Cannot link palette: missing distortion control (${!!selectedDistortionControl}) or palette (${!!selectedPalette})`)
      return
    }
    
    try {
      console.log(`🔗 LINKING PALETTE: "${selectedPalette.name}" → "${selectedDistortionControl.name}" (single-link model)`)
      
      // Use the main link API which now handles single link per DP (IDs for linking)
      const requestBody = {
        curveId: selectedCurve?.id || 'default-curve', // Use curve ID for link table
        distortionControlId: selectedDistortionControl.id,
        paletteName: selectedPalette.name // Palette name (as agreed)
      }
      console.log(`📦 Creating/updating single link:`, JSON.stringify(requestBody, null, 2))
      
      const response = await fetch(`${apiUrl}/api/distortion-control-links/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      
      console.log(`📡 Link API response status: ${response.status}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log(`✅ SINGLE LINK UPDATED:`, JSON.stringify(data, null, 2))
        console.log(`🎉 SUCCESS: Palette "${selectedPalette.name}" linked to DP "${selectedDistortionControl.name}"`)
      } else {
        const errorData = await response.text()
        console.error(`🚨 CRITICAL PALETTE LINK FAILURE: ${response.status} ${response.statusText}`)
        console.error(`🚨 Full error response:`, errorData)
        alert(`FAILED to link palette "${selectedPalette.name}": ${response.status} ${response.statusText}\n\nError: ${errorData}`)
        throw new Error(`Palette linking failed: ${response.status} ${response.statusText}`)
      }
      
    } catch (error) {
      console.error('❌ PALETTE LINK EXCEPTION:', error)
    }
  }

  // Check if current selections are linked to the DP
  const checkCurrentLinksStatus = async () => {
    if (!selectedDistortionControl) return { curveLinked: false, paletteLinked: false }
    
    try {
      const response = await fetch(`${apiUrl}/api/distortion-control-links/control/${selectedDistortionControl.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data && data.data.length > 0) {
          const link = data.data[0]
          const curveLinked = selectedCurve ? link.curveId === selectedCurve.id : false
          const paletteLinked = selectedPalette ? link.paletteName === selectedPalette.name : false
          return { curveLinked, paletteLinked }
        }
      }
    } catch (error) {
      console.error('Error checking link status:', error)
    }
    return { curveLinked: false, paletteLinked: false }
  }

  // Link both curve and palette to current distortion control
  const linkBothToDistortionControl = async () => {
    if (!selectedDistortionControl || !selectedCurve || !selectedPalette) {
      console.log(`❌ Cannot link: missing DP (${!!selectedDistortionControl}), curve (${!!selectedCurve}), or palette (${!!selectedPalette})`)
      return
    }
    
    try {
      console.log(`🔗 LINKING BOTH: Curve "${selectedCurve.name}" + Palette "${selectedPalette.name}" → DP "${selectedDistortionControl.name}"`)
      
      const requestBody = {
        curveId: selectedCurve.id,
        distortionControlId: selectedDistortionControl.id,
        paletteName: selectedPalette.name
      }
      console.log(`📦 Creating/updating link with both:`, JSON.stringify(requestBody, null, 2))
      
      const response = await fetch(`${apiUrl}/api/distortion-control-links/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log(`✅ BOTH LINKED SUCCESSFULLY:`, JSON.stringify(data, null, 2))
        console.log(`🎉 SUCCESS: Both curve and palette linked to DP`)
      } else {
        const errorData = await response.text()
        console.error(`🚨 LINKING FAILED: ${response.status} ${response.statusText}`)
        console.error(`🚨 Error details:`, errorData)
        alert(`FAILED to link curve and palette: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('❌ Link both exception:', error)
    }
  }

  // Direct palette linking using single-link model (bypasses state race condition)
  const linkPaletteToDistortionControlDirect = async (palette: Palette, distortionControl: DistortionControl) => {
    try {
      console.log(`🔗 DIRECT LINKING PALETTE: "${palette.name}" → "${distortionControl.name}" (single-link model)`)
      
      // Use main link API which handles single link per DP with overwriting (IDs for linking)
      const requestBody = {
        curveId: selectedCurve?.id || 'default-curve', // Use curve ID for link table
        distortionControlId: distortionControl.id,
        paletteName: palette.name // Palette name (as agreed)
      }
      console.log(`📦 Direct single link update:`, JSON.stringify(requestBody, null, 2))
      
      const response = await fetch(`${apiUrl}/api/distortion-control-links/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      
      console.log(`📡 Direct link API response status: ${response.status}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log(`✅ DIRECT SINGLE LINK SUCCESS:`, JSON.stringify(data, null, 2))
        console.log(`🎉 SUCCESS: Direct palette "${palette.name}" linked to DP "${distortionControl.name}"`)
      } else {
        const errorData = await response.text()
        console.error(`🚨 CRITICAL DIRECT LINK FAILURE: ${response.status} ${response.statusText}`)
        console.error(`🚨 Error details:`, errorData)
        alert(`FAILED to directly link palette "${palette.name}": ${response.status} ${response.statusText}`)
        throw new Error(`Direct palette linking failed: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('❌ DIRECT PALETTE LINK EXCEPTION:', error)
    }
  }



  // Distance calculation helper function
  const calculateDistance = (x: number, y: number, method: string): number => {
    switch (method) {
      case 'cartesian-x': return Math.abs(x)
      case 'cartesian-y': return Math.abs(y)
      case 'radial': 
      default: return Math.sqrt(x * x + y * y)
      
      // Classic Metrics
      case 'manhattan': return Math.abs(x) + Math.abs(y)
      case 'chebyshev': return Math.max(Math.abs(x), Math.abs(y))
      case 'minkowski-3': return Math.pow(Math.pow(Math.abs(x), 3) + Math.pow(Math.abs(y), 3), 1/3)
      
      // Geometric
      case 'hexagonal': {
        const dx = Math.abs(x)
        const dy = Math.abs(y)
        return Math.max(dx, dy, (dx + dy) / 2)
      }
      case 'triangular': return Math.abs(x) + Math.abs(y) + Math.abs(x + y)
      case 'spiral': return Math.sqrt(x * x + y * y) + Math.atan2(y, x) * 10
      case 'cross': return Math.min(Math.abs(x), Math.abs(y))
      
      // Wave-based
      case 'sine-wave': return Math.abs(Math.sin(x * 0.1)) + Math.abs(Math.sin(y * 0.1))
      case 'ripple': return Math.abs(Math.sin(Math.sqrt(x * x + y * y) * 0.1)) * 100
      case 'interference': return Math.abs(Math.sin(x * 0.1) * Math.sin(y * 0.1)) * 100
      
      // Exotic
      case 'hyperbolic': return Math.abs(x * y) * 0.01
      case 'polar-rose': {
        const r = Math.sqrt(x * x + y * y)
        const theta = Math.atan2(y, x)
        const k = 4 // 4-petal rose
        return r * Math.abs(Math.cos(k * theta))
      }
      case 'lemniscate': {
        const a = 50 // scale factor
        return Math.sqrt((x * x + y * y) * (x * x + y * y) - 2 * a * a * (x * x - y * y))
      }
      case 'logarithmic': return Math.log(Math.sqrt(x * x + y * y) + 1) * 50
    }
  }

  // Process fractal pattern using Pipeline F
  const processPattern = () => {
    if (!canvasRef.current || isProcessing) return
    
    setIsProcessing(true)
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    
    console.log(`\n🎨 ===== STARTING RENDER =====`)
    console.log(`🔧 Canvas: ${width}×${height}`)
    console.log(`🎯 Using Curve: ${selectedCurve?.name || 'DEFAULT RAMP (0-255)'}`)
    console.log(`🎨 Using Palette: ${selectedPalette?.name || 'DEFAULT GRAYSCALE'}`)
    console.log(`🎛️ Distortion Profile: ${selectedDistortionControl?.name || 'none'}`)
    
    if (selectedPalette) {
      console.log(`🌈 Palette colors: ${selectedPalette.hexColors?.length || 0} colors`)
      console.log(`🌈 First few colors: ${selectedPalette.hexColors?.slice(0, 5).join(', ') || 'none'}`)
    }
    
    if (selectedCurve) {
      console.log(`📊 Curve data: ${selectedCurve['curve-data']?.length || 0} points`)
      console.log(`📊 Curve width: ${selectedCurve['curve-width'] || 'unknown'}`)
    }

    // Use selected curve data or null (no defaults)
    const curveData = selectedCurve ? {
      'curve-data': selectedCurve['curve-data'],
      'curve-width': selectedCurve['curve-width']
    } : null

    // Create image data for full canvas dimensions
    const imageData = ctx.createImageData(width, height)
    const data = imageData.data

    // Check for effective angular distortion
    const effectiveAngularEnabled = angularEnabled && (angularFrequency !== 0 || angularAmplitude !== 0 || angularOffset !== 0)

    // Process each pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4

        // Convert to world coordinates
        const worldX = (x - width / 2) + centerOffsetX
        const worldY = (y - height / 2) + centerOffsetY

        try {
          // Pipeline F processing
          const trueDistance = calculateDistance(worldX, worldY, distanceCalc)

          // Virtual centers via coordinate modulus
          let processedX = worldX
          let processedY = worldY

          if (distanceModulus > 0) {
            processedX = ((worldX % distanceModulus) + distanceModulus) % distanceModulus - distanceModulus/2
            processedY = ((worldY % distanceModulus) + distanceModulus) % distanceModulus - distanceModulus/2
          }

          // Fractal distortion (coordinates) - FIRST
          if (fractalEnabled) {
            const scale1X = Math.sin(processedX * fractalScale1) * fractalStrength * 0.3
            const scale1Y = Math.cos(processedY * fractalScale1) * fractalStrength * 0.3
            
            const scale2X = Math.sin(processedX * fractalScale2) * fractalStrength * 0.2
            const scale2Y = Math.cos(processedY * fractalScale2) * fractalStrength * 0.2
            
            const scale3X = Math.sin(processedX * fractalScale3) * fractalStrength * 0.1
            const scale3Y = Math.cos(processedY * fractalScale3) * fractalStrength * 0.1
            
            processedX += scale1X + scale2X + scale3X
            processedY += scale1Y + scale2Y + scale3Y
          }

          // Angular distortion (coordinates) - AFTER fractal
          if (effectiveAngularEnabled) {
            const angle = Math.atan2(processedY, processedX) + (angularOffset * Math.PI / 180.0)
            const distortedAngle = angle + Math.sin(angle * angularFrequency) * angularAmplitude * 0.01
            const currentDistance = Math.sqrt(processedX * processedX + processedY * processedY)
            processedX = currentDistance * Math.cos(distortedAngle)
            processedY = currentDistance * Math.sin(distortedAngle)
          }

          // Calculate final distance
          const baseDistance = calculateDistance(processedX, processedY, distanceCalc)
          let finalDistance = baseDistance

          // Fractal distortion (distance) - FIRST
          if (fractalEnabled) {
            const distScale1 = Math.sin(finalDistance * fractalScale1) * fractalStrength * 0.3
            const distScale2 = Math.cos(finalDistance * fractalScale2) * fractalStrength * 0.2
            const distScale3 = Math.sin(finalDistance * fractalScale3) * fractalStrength * 0.1
            finalDistance += distScale1 + distScale2 + distScale3
          }

          // Angular distortion (distance) - AFTER fractal
          if (effectiveAngularEnabled) {
            const angle = Math.atan2(processedY, processedX) + (angularOffset * Math.PI / 180.0)
            const angularDistortion = Math.sin(angle * angularFrequency) * angularAmplitude
            finalDistance += angularDistortion
          }

          // Apply curve scaling and calculate index position
          let curveValue = 0
          if (curveData) {
            const scaledFinalDistance = finalDistance * curveScaling
            const indexPosition = Math.floor(Math.abs(scaledFinalDistance)) % curveData['curve-width']
            curveValue = curveData['curve-data'][indexPosition]
          } else {
            // No curve selected - render black
            curveValue = 0
          }

          // Apply checkerboard pattern
          if (checkerboardEnabled) {
            const checkerboardDistance = calculateDistance(worldX, worldY, distanceCalc)
            const stepFromCenter = Math.floor(checkerboardDistance / checkerboardSteps)
            if (stepFromCenter % 2 === 1) {
              curveValue = 255 - curveValue
            }
          }

          // Set pixel color using palette or black if no palette (8-bit, no alpha)
          if (selectedPalette && selectedPalette.hexColors) {
            const paletteIndex = Math.floor(curveValue) & 0xFF // Force 8-bit index
            const hexColor = selectedPalette.hexColors[paletteIndex] || '#000000'
            
            // Parse hex color and force 8-bit values (ignore alpha)
            const r = parseInt(hexColor.slice(1, 3), 16) & 0xFF
            const g = parseInt(hexColor.slice(3, 5), 16) & 0xFF
            const b = parseInt(hexColor.slice(5, 7), 16) & 0xFF
            
            data[index + 0] = r
            data[index + 1] = g
            data[index + 2] = b
            data[index + 3] = 255 // Force opaque
          } else {
            // No palette selected - render black
            data[index + 0] = 0 // R
            data[index + 1] = 0 // G
            data[index + 2] = 0 // B
            data[index + 3] = 255   // Force opaque
          }

        } catch (error) {
          // Red for errors
          data[index + 0] = 255
          data[index + 1] = 0
          data[index + 2] = 0
          data[index + 3] = 255
        }
      }
    }

    // Draw at full resolution directly
    console.log(`🎨 Drawing imageData to canvas: ${width}×${height}`)
    ctx.putImageData(imageData, 0, 0)

    // Verify canvas content and log final render results
    const testPixel = ctx.getImageData(width/2, height/2, 1, 1).data
    console.log(`🔍 Canvas center pixel RGBA: [${testPixel[0]}, ${testPixel[1]}, ${testPixel[2]}, ${testPixel[3]}]`)
    
    console.log(`✅ RENDER COMPLETE`)
    console.log(`   🎯 Rendered with curve: ${selectedCurve?.name || 'default ramp'}`)
    console.log(`   🎨 Rendered with palette: ${selectedPalette?.name || 'default grayscale'}`)
    console.log(`   🎛️ Using profile: ${selectedDistortionControl?.name || 'none'}`)
    console.log(`===== END RENDER =====\n`)

    setIsProcessing(false)
  }

  // Load data on mount in proper sequence
  useEffect(() => {
    const loadAllData = async () => {
      console.log('🔄 Loading all data in sequence...')
      
      // Load all data first
      await Promise.all([
        loadDistortionControls(),
        loadCurves(), 
        loadPalettes()
      ])
      
      console.log('✅ All data loaded, ready for auto-selection')
    }
    
    loadAllData()
  }, [])

  // Auto-load most recent distortion control after all data is available (ONE TIME ONLY)
  useEffect(() => {
    const autoLoadDistortionControl = async () => {
      if (availableDistortionControls.length > 0 && 
          availableCurves.length > 0 && 
          availablePalettes.length > 0 && 
          !selectedDistortionControl &&
          !hasAutoLoaded &&
          !isLoadingDP) {
        
        console.log('🎛️ All data loaded, auto-selecting most recent distortion control (ONE TIME)')
        setHasAutoLoaded(true) // Prevent multiple auto-loads
        
        const mostRecent = [...availableDistortionControls].sort((a, b) => 
          new Date(b.updatedAt || '').getTime() - new Date(a.updatedAt || '').getTime()
        )[0]
        
        if (mostRecent) {
          try {
            await loadDistortionControl(mostRecent)
          } catch (error) {
            console.error('❌ Auto-load failed:', error)
            setIsLoadingDP(false) // Ensure loading state is reset
          }
        }
      }
    }
    
    autoLoadDistortionControl()
  }, [availableDistortionControls, availableCurves, availablePalettes, selectedDistortionControl, hasAutoLoaded, isLoadingDP])

  // Mark as unsaved when parameters change
  useEffect(() => {
    if (selectedDistortionControl) {
      setHasUnsavedChanges(true)
    }
  }, [angularEnabled, angularFrequency, angularAmplitude, angularOffset, 
      fractalEnabled, fractalScale1, fractalScale2, fractalScale3, fractalStrength,
      distanceCalc, distanceModulus, curveScaling, checkerboardEnabled, checkerboardSteps])

  // SINGLE RENDER TRIGGER - only place processPattern() is called
  useEffect(() => {
    console.log(`🔄 RENDER TRIGGER: Parameters changed, scheduling render in 200ms`)
    const timer = setTimeout(() => {
      console.log(`🎨 EXECUTING RENDER: Starting processPattern()`)
      processPattern()
    }, 200) // Longer delay to prevent rapid-fire renders
    return () => clearTimeout(timer)
  }, [angularEnabled, angularFrequency, angularAmplitude, angularOffset, 
      fractalEnabled, fractalScale1, fractalScale2, fractalScale3, fractalStrength,
      distanceCalc, distanceModulus, curveScaling, checkerboardEnabled, checkerboardSteps,
      centerOffsetX, centerOffsetY, selectedCurve?.name, selectedPalette?.name])

  // Initialize canvas to fill viewport with any aspect ratio
  useEffect(() => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    
    const updateCanvasSize = () => {
      // Use full available viewport dimensions
      canvas.width = window.innerWidth - 300  // Full width minus controls panel
      canvas.height = window.innerHeight - 85  // Full height minus header
      
      console.log(`📐 Canvas: ${canvas.width}×${canvas.height} (aspect: ${(canvas.width/canvas.height).toFixed(2)})`)
      // Don't render immediately on resize - let the useEffect handle it
    }
    
    updateCanvasSize()
    
    window.addEventListener('resize', updateCanvasSize)
    return () => window.removeEventListener('resize', updateCanvasSize)
  }, [])

  // Mouse hover scaling functionality (only with Option key or right mouse)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMouseDragging) return // Don't scale during drag
    
    // Only scale if Option key is held down
    if (!e.altKey) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseY = e.clientY - rect.top
    const canvasHeight = rect.height

    // Calculate scaling factor based on mouse Y position
    // Top of canvas (y=0) = 0.0001 scaling, Bottom (y=height) = 1.0 scaling
    const scaleFactor = 0.0001 + (mouseY / canvasHeight) * (1.0 - 0.0001)
    setCurveScaling(scaleFactor)
  }

  // Mouse interaction functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    
    // Right mouse button (button 2) for scaling
    if (e.button === 2) {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const startY = e.clientY - rect.top
      const canvasHeight = rect.height
      const startScaling = curveScaling

      const handleScaleMove = (e: MouseEvent) => {
        const currentY = e.clientY - rect.top
        const deltaY = currentY - startY
        
        // Scale based on vertical mouse movement
        const scaleFactor = startScaling + (deltaY / canvasHeight) * 0.5
        const clampedScale = Math.max(0.0001, Math.min(1.0, scaleFactor))
        setCurveScaling(clampedScale)
      }

      const handleScaleUp = () => {
        document.removeEventListener('mousemove', handleScaleMove)
        document.removeEventListener('mouseup', handleScaleUp)
      }

      document.addEventListener('mousemove', handleScaleMove)
      document.addEventListener('mouseup', handleScaleUp)
      return
    }

    // Left mouse button for dragging
    setIsMouseDragging(true)
    
    const startX = e.clientX
    const startY = e.clientY
    const startOffsetX = centerOffsetX
    const startOffsetY = centerOffsetY

    const handleMouseDragMove = (e: MouseEvent) => {
      const dragX = e.clientX - startX
      const dragY = e.clientY - startY
      const scaleFactor = 2

      setCenterOffsetX(startOffsetX - (dragX * scaleFactor))
      setCenterOffsetY(startOffsetY - (dragY * scaleFactor))
    }

    const handleMouseUp = () => {
      setIsMouseDragging(false)
      document.removeEventListener('mousemove', handleMouseDragMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseDragMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Handle right-click context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault() // Prevent context menu when right-clicking for scaling
  }

  // Helper function to convert string to kebab-case
  const toKebabCase = (str: string) => {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
  }

  // Generate filename based on distortion profile and curve
  const generateFileName = (isTile: boolean = false) => {
    const distortionName = selectedDistortionControl?.name || 'default-distortion'
    const curveName = selectedCurve?.name || 'default-curve'
    
    const baseName = `${toKebabCase(distortionName)}-${toKebabCase(curveName)}`
    const suffix = isTile ? '-tile' : ''
    
    return `${baseName}${suffix}.png`
  }

  // Export PNG with smart tiling for distance modulus
  const exportAsPNG = () => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    let exportCanvas = canvas
    let fileName = generateFileName()
    
    // If distance modulus > 0, create a tile
    if (distanceModulus > 0) {
      const tileSize = distanceModulus
      const tileCanvas = document.createElement('canvas')
      tileCanvas.width = tileSize
      tileCanvas.height = tileSize
      const tileCtx = tileCanvas.getContext('2d')
      
      if (tileCtx) {
        // Find the center of the original canvas
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2
        
        // Extract a square tile from the center
        const sourceX = centerX - tileSize / 2
        const sourceY = centerY - tileSize / 2
        
        tileCtx.drawImage(
          canvas,
          sourceX, sourceY, tileSize, tileSize, // source
          0, 0, tileSize, tileSize // destination
        )
        
        exportCanvas = tileCanvas
        fileName = generateFileName(true)
        
        console.log(`🔲 Creating ${tileSize}×${tileSize} tile from pattern center`)
      }
    }
    
    // Export the canvas (original or tile)
    exportCanvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        
        const sizeKB = (blob.size / 1024).toFixed(1)
        const dimensions = `${exportCanvas.width}×${exportCanvas.height}`
        console.log(`📸 Exported PNG: ${fileName} (${dimensions}, ${sizeKB}KB)`)
      }
    }, 'image/png', 1.0)
  }

  // Export JPEG with smart tiling for distance modulus
  const exportAsJPEG = () => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    let exportCanvas = canvas
    let fileName = generateFileName().replace('.png', '.jpg')
    
    // If distance modulus > 0, create a tile
    if (distanceModulus > 0) {
      const tileSize = distanceModulus
      const tileCanvas = document.createElement('canvas')
      tileCanvas.width = tileSize
      tileCanvas.height = tileSize
      const tileCtx = tileCanvas.getContext('2d')
      
      if (tileCtx) {
        // Fill with white background for JPEG
        tileCtx.fillStyle = '#FFFFFF'
        tileCtx.fillRect(0, 0, tileSize, tileSize)
        
        // Find the center of the original canvas
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2
        
        // Extract a square tile from the center
        const sourceX = centerX - tileSize / 2
        const sourceY = centerY - tileSize / 2
        
        tileCtx.drawImage(
          canvas,
          sourceX, sourceY, tileSize, tileSize, // source
          0, 0, tileSize, tileSize // destination
        )
        
        exportCanvas = tileCanvas
        fileName = generateFileName(true).replace('.png', '.jpg')
        
        console.log(`🔲 Creating ${tileSize}×${tileSize} JPEG tile from pattern center`)
      }
    }
    
    // Export the canvas (original or tile) as JPEG
    exportCanvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        
        const sizeKB = (blob.size / 1024).toFixed(1)
        const dimensions = `${exportCanvas.width}×${exportCanvas.height}`
        console.log(`📸 Exported JPEG: ${fileName} (${dimensions}, ${sizeKB}KB)`)
      }
    }, 'image/jpeg', 0.95)
  }

  // Export all GLSL pairs from linked shader
  const exportCurveShader = async () => {
    console.log('🎨 Exporting linked shader GLSL pairs...')
    
    if (!selectedDistortionControl) {
      alert('Please select a distortion control before exporting')
      return
    }

    try {
      // Find linked shader for this distortion profile
      const linksResponse = await fetch(`${apiUrl}/api/distortion-control-links/control/${selectedDistortionControl.id}`)
      if (!linksResponse.ok) {
        throw new Error('Failed to fetch distortion control links')
      }
      
      const linksData = await linksResponse.json()
      let linkedShaderName = null
      
      if (linksData.success && linksData.data && linksData.data.length > 0) {
        const link = linksData.data[0] // Single link per DP
        linkedShaderName = link.shaderName
      }
      
      if (!linkedShaderName) {
        alert('No shader linked to this distortion profile. Save the distortion profile first to auto-generate a shader.')
        return
      }
      
      console.log(`🔍 Found linked shader: ${linkedShaderName}`)
      
      // Fetch the shader document
      const shaderResponse = await fetch(`${apiUrl}/api/shaders/${linkedShaderName}`)
      if (!shaderResponse.ok) {
        throw new Error(`Failed to fetch shader: ${linkedShaderName}`)
      }
      
      const shaderData = await shaderResponse.json()
      if (!shaderData.success || !shaderData.data) {
        throw new Error('Invalid shader data received')
      }
      
      const shader = shaderData.data
      const glslPairs = shader.glsl || {}
      const targets = Object.keys(glslPairs)
      
      console.log(`🎯 Exporting ${targets.length} GLSL targets:`, targets)
      
      if (targets.length === 0) {
        alert('No GLSL code found in linked shader')
        return
      }
      
      // Export each GLSL target as a separate file
      targets.forEach(target => {
        const glslCode = glslPairs[target]
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
      
      alert(`✅ Exported ${targets.length} shader files for ${shader.name}`)
      
    } catch (error) {
      console.error('Export error:', error)
      alert(`❌ Export failed: ${error.message}`)
    }
  }

  // 3D Preview with rotating cube (simplified)
  const start3DPreview = () => {
    console.log('🔴 DEBUG: 3D Preview button clicked - SIMPLE VERSION')
    
    if (!selectedDistortionControl || !selectedCurve) {
      alert('Please select both a distortion control and curve for 3D preview')
      return
    }

    console.log('🎮 Starting 3D preview for:', selectedDistortionControl.name, selectedCurve.name)
    alert(`🎮 3D Preview: ${selectedDistortionControl.name} + ${selectedCurve.name}\n\n(Full 3D implementation coming soon)`)
  }

  const init3DPreview = () => {
    const canvas = previewCanvasRef.current
    if (!canvas || !selectedDistortionControl || !selectedCurve) return

    const gl = canvas.getContext('webgl2')
    if (!gl) {
      alert('WebGL2 not supported for 3D preview')
      return
    }

    console.log('🎮 Starting 3D curve-shader preview')
    console.log('📊 Canvas size:', canvas.width, 'x', canvas.height)
    console.log('🎛️ DP:', selectedDistortionControl.name)
    console.log('🎯 Curve:', selectedCurve.name)
    console.log('🎨 Palette:', selectedPalette?.name || 'none')

    // Generate the GLSL fragment shader
    const shaderPackage = glslShaderGenerator.generateWebGLPackage({
      shaderName: `Preview_${selectedDistortionControl.name}`,
      distortionControl: selectedDistortionControl,
      curve: selectedCurve,
      palette: selectedPalette,
      target: 'webgl',
      includeComments: false
    })

    // Simple vertex shader for cube
    const vertexShader = `#version 300 es
precision highp float;

in vec3 a_position;
in vec2 a_uv;

uniform mat4 u_mvpMatrix;

out vec2 v_uv;

void main() {
    v_uv = a_uv;
    gl_Position = u_mvpMatrix * vec4(a_position, 1.0);
}`

    // Compile shaders
    const vs = createShader(gl, gl.VERTEX_SHADER, vertexShader)
    const fs = createShader(gl, gl.FRAGMENT_SHADER, shaderPackage.fragmentShader)
    
    if (!vs || !fs) {
      alert('Failed to compile shaders for 3D preview')
      return
    }

    const program = createProgram(gl, vs, fs)
    if (!program) {
      alert('Failed to create shader program for 3D preview')
      return
    }

    // Create complex geometric primitives
    const createTorus = (majorRadius = 1, minorRadius = 0.4, majorSegments = 32, minorSegments = 16) => {
      const vertices = []
      const indices = []
      
      for (let i = 0; i <= majorSegments; i++) {
        const u = (i / majorSegments) * Math.PI * 2
        for (let j = 0; j <= minorSegments; j++) {
          const v = (j / minorSegments) * Math.PI * 2
          
          const x = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u)
          const y = minorRadius * Math.sin(v)
          const z = (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u)
          
          vertices.push(x, y, z)
          vertices.push(i / majorSegments, j / minorSegments) // UV
          
          if (i < majorSegments && j < minorSegments) {
            const a = i * (minorSegments + 1) + j
            const b = (i + 1) * (minorSegments + 1) + j
            const c = (i + 1) * (minorSegments + 1) + (j + 1)
            const d = i * (minorSegments + 1) + (j + 1)
            
            indices.push(a, b, d, b, c, d)
          }
        }
      }
      
      return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices)
      }
    }
    
    const createIcosphere = (radius = 1, subdivisions = 2) => {
      const vertices = []
      const indices = []
      
      // Golden ratio
      const phi = (1 + Math.sqrt(5)) / 2
      const a = 1
      const b = 1 / phi
      
      // Initial icosahedron vertices
      const baseVertices = [
        [-a, b, 0], [a, b, 0], [-a, -b, 0], [a, -b, 0],
        [0, -a, b], [0, a, b], [0, -a, -b], [0, a, -b],
        [b, 0, -a], [b, 0, a], [-b, 0, -a], [-b, 0, a]
      ]
      
      // Normalize and scale vertices
      baseVertices.forEach(v => {
        const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2])
        vertices.push(v[0]/len * radius, v[1]/len * radius, v[2]/len * radius)
        // UV coordinates (spherical mapping)
        const u = 0.5 + Math.atan2(v[2], v[0]) / (2 * Math.PI)
        const v_coord = 0.5 - Math.asin(v[1]/len) / Math.PI
        vertices.push(u, v_coord)
      })
      
      // Initial triangle indices for icosahedron
      const triangles = [
        [0,11,5], [0,5,1], [0,1,7], [0,7,10], [0,10,11],
        [1,5,9], [5,11,4], [11,10,2], [10,7,6], [7,1,8],
        [3,9,4], [3,4,2], [3,2,6], [3,6,8], [3,8,9],
        [4,9,5], [2,4,11], [6,2,10], [8,6,7], [9,8,1]
      ]
      
      triangles.forEach(tri => {
        indices.push(tri[0], tri[1], tri[2])
      })
      
      return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices)
      }
    }
    
    // Use torus for better shader pattern visibility
    const mesh = createTorus(1.2, 0.5, 48, 24)
    const meshVertices = mesh.vertices
    const meshIndices = mesh.indices
    
    console.log(`🔺 Generated torus: ${meshVertices.length/5} vertices, ${meshIndices.length/3} triangles`)

    // Create buffers
    const vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, meshVertices, gl.STATIC_DRAW)

    const indexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, meshIndices, gl.STATIC_DRAW)

    // Set up attributes
    const positionLocation = gl.getAttribLocation(program, 'a_position')
    const uvLocation = gl.getAttribLocation(program, 'a_uv')

    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 5 * 4, 0)

    gl.enableVertexAttribArray(uvLocation)
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 5 * 4, 3 * 4)

    // Get uniform locations
    const mvpLocation = gl.getUniformLocation(program, 'u_mvpMatrix')
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution')
    const offsetLocation = gl.getUniformLocation(program, 'u_offset')
    const scaleLocation = gl.getUniformLocation(program, 'u_scale')

    // Set distortion control uniforms
    setDistortionUniforms(gl, program, selectedDistortionControl)

    let rotation = 0

    const render = () => {
      if (!gl || !canvas) return

      rotation += 0.02

      // Clear and setup
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0.1, 0.1, 0.1, 1.0) // Dark gray background
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.enable(gl.DEPTH_TEST)
      gl.useProgram(program)

      // Create MVP matrix
      const aspect = canvas.width / canvas.height
      const perspective = createPerspectiveMatrix(45, aspect, 0.1, 100)
      const view = createLookAtMatrix([0, 0, 5], [0, 0, 0], [0, 1, 0])
      const model = createRotationMatrix(rotation, rotation * 0.7, 0)
      const mvp = multiplyMatrices(perspective, multiplyMatrices(view, model))

      // Set uniforms
      gl.uniformMatrix4fv(mvpLocation, false, mvp)
      gl.uniform2f(resolutionLocation, 512, 512)
      gl.uniform2f(offsetLocation, centerOffsetX, centerOffsetY)
      gl.uniform1f(scaleLocation, curveScaling)

      // Draw icosphere
      gl.drawElements(gl.TRIANGLES, meshIndices.length, gl.UNSIGNED_SHORT, 0)

      // Check for WebGL errors
      const error = gl.getError()
      if (error !== gl.NO_ERROR) {
        console.error('WebGL error during render:', error)
      }

      if (showPreview) {
        requestAnimationFrame(render)
      }
    }

    console.log('🎮 Starting render loop...')
    render()
  }

  // Helper functions for 3D math
  const createPerspectiveMatrix = (fov: number, aspect: number, near: number, far: number): Float32Array => {
    const f = Math.tan(Math.PI * 0.5 - 0.5 * fov * Math.PI / 180)
    const rangeInv = 1.0 / (near - far)
    
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInv, -1,
      0, 0, near * far * rangeInv * 2, 0
    ])
  }

  const createLookAtMatrix = (eye: number[], target: number[], up: number[]): Float32Array => {
    const zAxis = normalize(subtract(eye, target))
    const xAxis = normalize(cross(up, zAxis))
    const yAxis = normalize(cross(zAxis, xAxis))

    return new Float32Array([
      xAxis[0], xAxis[1], xAxis[2], 0,
      yAxis[0], yAxis[1], yAxis[2], 0,
      zAxis[0], zAxis[1], zAxis[2], 0,
      eye[0], eye[1], eye[2], 1
    ])
  }

  const createRotationMatrix = (x: number, y: number, z: number): Float32Array => {
    const cx = Math.cos(x), sx = Math.sin(x)
    const cy = Math.cos(y), sy = Math.sin(y)
    const cz = Math.cos(z), sz = Math.sin(z)

    return new Float32Array([
      cy * cz, -cy * sz, sy, 0,
      cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy, 0,
      sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy, 0,
      0, 0, 0, 1
    ])
  }

  const multiplyMatrices = (a: Float32Array, b: Float32Array): Float32Array => {
    const result = new Float32Array(16)
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] = 
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j]
      }
    }
    return result
  }

  const normalize = (v: number[]): number[] => {
    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    return length > 0 ? [v[0] / length, v[1] / length, v[2] / length] : [0, 0, 0]
  }

  const subtract = (a: number[], b: number[]): number[] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const cross = (a: number[], b: number[]): number[] => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ]

  // WebGL helper functions
  const createShader = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type)
    if (!shader) return null
    
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      return null
    }
    
    return shader
  }

  const createProgram = (gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null => {
    const program = gl.createProgram()
    if (!program) return null
    
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      return null
    }
    
    return program
  }

  const setDistortionUniforms = (gl: WebGL2RenderingContext, program: WebGLProgram, distortion: DistortionControl) => {
    const uniforms = [
      ['u_angularEnabled', distortion['angular-distortion'] ? 1.0 : 0.0],
      ['u_fractalEnabled', distortion['fractal-distortion'] ? 1.0 : 0.0],
      ['u_checkerboardEnabled', distortion['checkerboard-pattern'] ? 1.0 : 0.0],
      ['u_distanceModulus', distortion['distance-modulus']],
      ['u_curveScaling', distortion['curve-scaling']],
      ['u_checkerboardSteps', distortion['checkerboard-steps']],
      ['u_angularFrequency', distortion['angular-frequency']],
      ['u_angularAmplitude', distortion['angular-amplitude']],
      ['u_angularOffset', distortion['angular-offset']],
      ['u_fractalScale1', distortion['fractal-scale-1']],
      ['u_fractalScale2', distortion['fractal-scale-2']],
      ['u_fractalScale3', distortion['fractal-scale-3']],
      ['u_fractalStrength', distortion['fractal-strength']],
      ['u_time', Date.now() / 1000]
    ]

    console.log('🔧 Setting uniforms for 3D preview:')
    uniforms.forEach(([name, value]) => {
      const location = gl.getUniformLocation(program, name)
      if (location !== null) {
        gl.uniform1f(location, Number(value))
        console.log(`  ✅ ${name}: ${value}`)
      } else {
        console.warn(`  ❌ Uniform '${name}' not found in shader (optimized out?)`)
      }
    })
  }

  // Validate GLSL shader before export
  const validateGLSL = (fragmentShader: string, vertexShader: string): { valid: boolean; errors: string[] } => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) {
      return { valid: false, errors: ['WebGL2 not available for validation'] }
    }

    const errors: string[] = []

    try {
      // Validate vertex shader
      const vs = gl.createShader(gl.VERTEX_SHADER)
      if (vs) {
        gl.shaderSource(vs, vertexShader)
        gl.compileShader(vs)
        
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
          const error = gl.getShaderInfoLog(vs)
          errors.push(`Vertex Shader Error: ${error}`)
        }
      }

      // Validate fragment shader
      const fs = gl.createShader(gl.FRAGMENT_SHADER)
      if (fs) {
        gl.shaderSource(fs, fragmentShader)
        gl.compileShader(fs)
        
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
          const error = gl.getShaderInfoLog(fs)
          errors.push(`Fragment Shader Error: ${error}`)
        }
      }

      // Try to link program
      if (vs && fs && errors.length === 0) {
        const program = gl.createProgram()
        if (program) {
          gl.attachShader(program, vs)
          gl.attachShader(program, fs)
          gl.linkProgram(program)
          
          if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(program)
            errors.push(`Program Link Error: ${error}`)
          }
          
          gl.deleteProgram(program)
        }
      }

      // Cleanup
      if (vs) gl.deleteShader(vs)
      if (fs) gl.deleteShader(fs)

    } catch (error) {
      errors.push(`Validation Exception: ${error}`)
    }

    return { valid: errors.length === 0, errors }
  }

  return (
    <div className="app">
      <Header title="Cnidaria" currentPage="Merzbow" />
      
      <div className="main-content">
        <div className="left-pane">
          {/* Distortion Profile Panel */}
          <div className="info-section">
            <h3 className="collapsible-header" onClick={() => toggleSection('profile')}>
              <span className="toggle-icon">{expandedSections.profile ? '▼' : '▶'}</span>
              Distortion Profile
            </h3>
            {expandedSections.profile && (
              <div className="section-content">
                <div className="form-group">
                  <label>Distortion Profile:</label>
                  <select 
                    value={selectedDistortionControl?.id || ''} 
                    onChange={async (e) => {
                      const control = availableDistortionControls.find(c => c.id === e.target.value)
                      if (control) await loadDistortionControl(control)
                    }}
                    disabled={isLoading || isLoadingDP}
                  >
                    <option value="">{isLoadingDP ? 'Loading...' : 'Select...'}</option>
                    {availableDistortionControls.map(control => (
                      <option key={control.id} value={control.id}>
                        {control.name}
                      </option>
                    ))}
                  </select>
                  {isLoadingDP && (
                    <div style={{ fontSize: '12px', color: '#007bff', fontStyle: 'italic', marginTop: '4px' }}>
                      ⚡ Loading distortion profile...
                    </div>
                  )}
                </div>

                {/* CRUD Buttons */}
                <div className="form-group" style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={createNewDistortionProfile}
                    disabled={isCreating}
                    style={{
                      backgroundColor: '#28a745',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      flex: 1
                    }}
                  >
                    {isCreating ? 'Creating...' : 'Create'}
                  </button>
                  
                  <button 
                    onClick={deleteDistortionProfile}
                    disabled={!selectedDistortionControl || isDeleting}
                    style={{
                      backgroundColor: '#dc3545',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      flex: 1,
                      opacity: !selectedDistortionControl ? 0.5 : 1
                    }}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                  
                  <button 
                    onClick={duplicateDistortionProfile}
                    disabled={!selectedDistortionControl || isDuplicating}
                    style={{
                      backgroundColor: '#ffc107',
                      color: '#333',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      flex: 1,
                      opacity: !selectedDistortionControl ? 0.5 : 1
                    }}
                  >
                    {isDuplicating ? 'Duplicating...' : 'Duplicate'}
                  </button>
                </div>

                {/* Save Button */}
                <div className="form-group">
                  <SaveButton
                    onClick={saveDistortionControl}
                    isSaving={isSaving}
                    hasUnsavedChanges={hasUnsavedChanges}
                    title="Save distortion control changes"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Distortion Links Panel */}
          <div className="info-section">
            <h3 className="collapsible-header" onClick={() => toggleSection('links')}>
              <span className="toggle-icon">{expandedSections.links ? '▼' : '▶'}</span>
              Distortion Links
            </h3>
            {expandedSections.links && (
              <div className="section-content">
                <div className="form-group">
                  <label>Curve:</label>
                  <select 
                    value={selectedCurve?.id || ''} 
                    onChange={async (e) => {
                      const curve = availableCurves.find(c => c.id === e.target.value)
                      console.log(`🎯 Selected curve: ${curve?.name || 'none'} (ID: ${curve?.id || 'none'})`)
                      setSelectedCurve(curve || null)
                      
                      // No auto-linking - user will use manual link button
                    }}
                  >
                    <option value="">Default (0-255 ramp)</option>
                    {availableCurves.map(curve => (
                      <option key={curve.id} value={curve.id}>
                        {curve.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Palette:</label>
                  <select 
                    key={`palette-${selectedPalette?.id || 'none'}`}
                    value={selectedPalette?.id || ''} 
                    onChange={async (e) => {
                      const palette = availablePalettes.find(p => p.id === e.target.value)
                      console.log(`🎨 USER SELECTED PALETTE: ${palette?.name || 'none'} (ID: ${palette?.id || 'none'})`)
                      console.log(`🎨 Previous palette was: ${selectedPalette?.name || 'none'}`)
                      setSelectedPalette(palette || null)
                      console.log(`🎨 Palette state updated to: ${palette?.name || 'none'}`)
                      
                      // No auto-linking - user will use manual link button
                    }}
                  >
                    <option value="">Default (Grayscale)</option>
                    {availablePalettes.map(palette => (
                      <option key={palette.id} value={palette.id}>
                        {palette.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Manual Link Button - appears when curve or palette not linked */}
                <LinkButton 
                  selectedCurve={selectedCurve}
                  selectedPalette={selectedPalette}
                  selectedDistortionControl={selectedDistortionControl}
                  onLink={linkBothToDistortionControl}
                />
              </div>
            )}
          </div>

          {/* Distortion Settings Panel */}
          <div className="info-section">
            <h3 className="collapsible-header" onClick={() => toggleSection('settings')}>
              <span className="toggle-icon">{expandedSections.settings ? '▼' : '▶'}</span>
              Distortion Settings
            </h3>
            {expandedSections.settings && (
              <div className="section-content">
                {/* Name Editor */}
                {selectedDistortionControl && (
                  <div className="form-group">
                    <label>Distortion Name:</label>
                    <input 
                      type="text" 
                      value={selectedDistortionControl.name} 
                      onChange={(e) => {
                        setSelectedDistortionControl({
                          ...selectedDistortionControl,
                          name: e.target.value
                        })
                        setHasUnsavedChanges(true)
                      }}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="checkbox-label">
                    Angular Distortion
                    <input type="checkbox" checked={angularEnabled} onChange={(e) => setAngularEnabled(e.target.checked)} />
                  </label>
                </div>
                
                <div className="form-group">
                  <label className="checkbox-label">
                    Fractal Distortion
                    <input type="checkbox" checked={fractalEnabled} onChange={(e) => setFractalEnabled(e.target.checked)} />
                  </label>
                </div>
                
                <div className="form-group">
                  <label className="checkbox-label">
                    Checkerboard Pattern
                    <input type="checkbox" checked={checkerboardEnabled} onChange={(e) => setCheckerboardEnabled(e.target.checked)} />
                  </label>
                </div>

                <div className="form-group">
                  <label>Distance Calculation:</label>
                  <select value={distanceCalc} onChange={(e) => setDistanceCalc(e.target.value)}>
                    <option value="radial">radial</option>
                    <option value="cartesian-x">cartesian-x</option>
                    <option value="cartesian-y">cartesian-y</option>
                    <option value="manhattan">manhattan</option>
                    <option value="chebyshev">chebyshev</option>
                    <option value="minkowski-3">minkowski-3</option>
                    <option value="hexagonal">hexagonal</option>
                    <option value="triangular">triangular</option>
                    <option value="spiral">spiral</option>
                    <option value="cross">cross</option>
                    <option value="sine-wave">sine-wave</option>
                    <option value="ripple">ripple</option>
                    <option value="interference">interference</option>
                    <option value="hyperbolic">hyperbolic</option>
                    <option value="polar-rose">polar-rose</option>
                    <option value="lemniscate">lemniscate</option>
                    <option value="logarithmic">logarithmic</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Checkerboard Steps: {checkerboardSteps}</label>
                  <input type="range" value={checkerboardSteps} min="0" max="511" step="1" onChange={(e) => setCheckerboardSteps(parseFloat(e.target.value))} />
                </div>

                <div className="form-group">
                  <label>Distance Modulus:</label>
                  <input type="number" value={distanceModulus} min="0" max="500" step="10" onChange={(e) => setDistanceModulus(parseFloat(e.target.value) || 0)} />
                </div>

                <div className="form-group">
                  <label>Curve Scaling: {curveScaling.toFixed(4)}</label>
                  <input type="range" value={curveScaling} min="0.0001" max="1.0" step="0.0001" onChange={(e) => setCurveScaling(parseFloat(e.target.value))} />
                </div>
              </div>
            )}
          </div>

          {/* Angular Settings Panel */}
          <div className="info-section">
            <h3 className="collapsible-header" onClick={() => toggleSection('angular')}>
              <span className="toggle-icon">{expandedSections.angular ? '▼' : '▶'}</span>
              Angular Settings
            </h3>
            {expandedSections.angular && (
              <div className="section-content">
                <div className="form-group">
                  <label>Frequency: {angularFrequency}</label>
                  <input type="range" value={angularFrequency} min="0" max="64" step="0.1" onChange={(e) => setAngularFrequency(parseFloat(e.target.value))} />
                </div>
                
                <div className="form-group">
                  <label>Amplitude: {angularAmplitude}</label>
                  <input type="range" value={angularAmplitude} min="0" max="100" step="1" onChange={(e) => setAngularAmplitude(parseFloat(e.target.value))} />
                </div>
                
                <div className="form-group">
                  <label>Offset: {angularOffset}°</label>
                  <input type="range" value={angularOffset} min="0" max="360" step="5" onChange={(e) => setAngularOffset(parseFloat(e.target.value))} />
                </div>
              </div>
            )}
          </div>

          {/* Fractal Settings Panel */}
          <div className="info-section">
            <h3 className="collapsible-header" onClick={() => toggleSection('fractal')}>
              <span className="toggle-icon">{expandedSections.fractal ? '▼' : '▶'}</span>
              Fractal Settings
            </h3>
            {expandedSections.fractal && (
              <div className="section-content">
                <div className="form-group">
                  <label>Scale 1: {fractalScale1}</label>
                  <input type="range" value={fractalScale1} min="0.001" max="0.1" step="0.001" onChange={(e) => setFractalScale1(parseFloat(e.target.value))} />
                </div>
                
                <div className="form-group">
                  <label>Scale 2: {fractalScale2}</label>
                  <input type="range" value={fractalScale2} min="0.01" max="0.5" step="0.01" onChange={(e) => setFractalScale2(parseFloat(e.target.value))} />
                </div>
                
                <div className="form-group">
                  <label>Scale 3: {fractalScale3}</label>
                  <input type="range" value={fractalScale3} min="0.05" max="1.0" step="0.05" onChange={(e) => setFractalScale3(parseFloat(e.target.value))} />
                </div>
                
                <div className="form-group">
                  <label>Strength: {fractalStrength}</label>
                  <input type="range" value={fractalStrength} min="1" max="50" step="1" onChange={(e) => setFractalStrength(parseFloat(e.target.value))} />
                </div>
              </div>
            )}
          </div>

          {/* Export Options Panel */}
          <div className="info-section">
            <h3 className="collapsible-header" onClick={() => toggleSection('export')}>
              <span className="toggle-icon">{expandedSections.export ? '▼' : '▶'}</span>
              Export Options
            </h3>
            {expandedSections.export && (
              <div className="section-content">
                <div className="form-group">
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <button onClick={exportAsPNG} className="export-button">
                      Export PNG
                    </button>
                    <button onClick={exportAsJPEG} className="export-button secondary">
                      Export JPEG
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={() => {
                        console.log('🎨 Exporting GLSL curve-shader...')
                        
                        if (!selectedDistortionControl || !selectedCurve) {
                          alert('Please select both a distortion control and curve')
                          return
                        }

                        try {
                          // Create simple GLSL shader content
                          const shaderContent = `// ===== FOUNDATIONAL CURVE-SHADER =====
// Generated from Merzbow Pipeline F
// Distortion: ${selectedDistortionControl.name}
// Curve: ${selectedCurve.name}
// Palette: ${selectedPalette?.name || 'Default Grayscale'}

#version 300 es
precision highp float;

// Distortion control parameters
uniform float u_distanceModulus;
uniform float u_curveScaling;
uniform float u_angularFrequency;
uniform float u_fractalScale1;

in vec2 v_uv;
out vec4 fragColor;

float calculateDistance(vec2 coord) {
    return sqrt(coord.x * coord.x + coord.y * coord.y);
}

void main() {
    vec2 worldCoord = (v_uv - 0.5) * 1000.0;
    float dist = calculateDistance(worldCoord);
    float pattern = sin(dist * u_curveScaling) * 0.5 + 0.5;
    fragColor = vec4(vec3(pattern), 1.0);
}

// ===== USAGE =====
// Apply this shader to any mesh for procedural texturing
// Adjust uniforms for real-time parameter control
`
                          
                          const blob = new Blob([shaderContent], { type: 'text/plain' })
                          const url = URL.createObjectURL(blob)
                          const link = document.createElement('a')
                          
                          const fileName = `curve-shader-${selectedDistortionControl.name.toLowerCase().replace(/\s+/g, '-')}.glsl`
                          link.href = url
                          link.download = fileName
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                          URL.revokeObjectURL(url)

                          console.log(`✅ Exported: ${fileName}`)
                          alert(`✅ Exported curve-shader: ${fileName}`)
                          
                        } catch (error) {
                          console.error('Export error:', error)
                          alert(`❌ Export failed: ${error}`)
                        }
                      }} 
                      className="export-button unity"
                      disabled={!selectedDistortionControl || !selectedCurve}
                    >
                      Export GLSL
                    </button>
                    <button 
                      onClick={() => {
                        if (!selectedDistortionControl || !selectedCurve) {
                          alert('Please select both a distortion control and curve')
                          return
                        }
                        setShowPreview(true)
                        // Initialize 3D preview after modal opens
                        setTimeout(() => init3DPreview(), 100)
                      }} 
                      className="export-button webgl"
                      disabled={!selectedDistortionControl || !selectedCurve}
                    >
                      3D Preview
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                      console.log('🟢 EMERGENCY TEST BUTTON CLICKED')
                      alert('EMERGENCY BUTTON WORKS!')
                    }}
                    style={{ 
                      width: '100%', 
                      backgroundColor: '#00ff00', 
                      color: '#000000',
                      padding: '15px',
                      border: '3px solid #ffffff',
                      borderRadius: '6px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      marginTop: '10px'
                    }}
                  >
                    🚨 EMERGENCY TEST BUTTON 🚨
                  </button>
                  
                  {/* Debug Info */}
                  <div style={{ 
                    marginTop: '10px', 
                    padding: '10px', 
                    background: '#444', 
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#ccc'
                  }}>
                    <div>Distortion Control: {selectedDistortionControl ? `✅ ${selectedDistortionControl.name}` : '❌ None'}</div>
                    <div>Curve: {selectedCurve ? `✅ ${selectedCurve.name}` : '❌ None'}</div>
                    <div>Buttons Disabled: {(!selectedDistortionControl || !selectedCurve) ? '🔴 YES' : '🟢 NO'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <canvas 
          ref={canvasRef}
          className="merzbow-viewport"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onContextMenu={handleContextMenu}
        />

        {/* 3D Preview Modal */}
        {showPreview && (
          <div className="preview-modal" onClick={() => setShowPreview(false)}>
            <div className="preview-content" onClick={(e) => e.stopPropagation()}>
              <div className="preview-header">
                <h3>3D Curve-Shader Preview</h3>
                <button onClick={() => setShowPreview(false)} className="close-button">×</button>
              </div>
              <canvas 
                ref={previewCanvasRef}
                width={600}
                height={400}
                className="preview-canvas"
              />
              <div className="preview-info">
                <p>Pattern: <strong>{selectedDistortionControl?.name}</strong></p>
                <p>Curve: <strong>{selectedCurve?.name}</strong></p>
                <p>Palette: <strong>{selectedPalette?.name || 'Default Grayscale'}</strong></p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Merzbow
