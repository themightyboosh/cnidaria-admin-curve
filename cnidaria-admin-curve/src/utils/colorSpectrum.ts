/**
 * Shared color spectrum configuration for both 2D and 3D views
 */

export interface ColorSpectrumConfig {
  type: 'hsl' | 'rainbow' | 'terrain' | 'thermal' | 'custom'
  saturation: number
  lightness: number
  hueRange: [number, number] // [min, max] in degrees
  customColors?: string[] // For custom gradients
}

// Default spectrum configurations
export const SPECTRUM_PRESETS: Record<string, ColorSpectrumConfig> = {
  default: {
    type: 'hsl',
    saturation: 0.7,
    lightness: 0.5,
    hueRange: [0, 360]
  },
  rainbow: {
    type: 'rainbow',
    saturation: 0.8,
    lightness: 0.6,
    hueRange: [0, 300] // Red to Purple (no full circle back to red)
  },
  terrain: {
    type: 'terrain',
    saturation: 0.6,
    lightness: 0.4,
    hueRange: [240, 60] // Blue through green to yellow/orange
  },
  thermal: {
    type: 'thermal',
    saturation: 0.9,
    lightness: 0.5,
    hueRange: [240, 0] // Blue to red (heat map)
  },
  grayscale: {
    type: 'custom',
    saturation: 0.0, // No saturation = grayscale
    lightness: 0.5,
    hueRange: [0, 0] // Hue doesn't matter for grayscale
  }
}

// Current active spectrum (can be changed globally)
let currentSpectrum: ColorSpectrumConfig = SPECTRUM_PRESETS.default

export const setActiveSpectrum = (config: ColorSpectrumConfig) => {
  currentSpectrum = config
}

export const getActiveSpectrum = (): ColorSpectrumConfig => {
  return currentSpectrum
}

export const setActiveSpectrumPreset = (presetName: string) => {
  if (SPECTRUM_PRESETS[presetName]) {
    currentSpectrum = SPECTRUM_PRESETS[presetName]
  }
}

/**
 * Convert index value (0-255) to color string using current spectrum
 * The full 256 color spectrum is always available, but curve data may use only a subset
 */
export const indexToColorString = (indexValue: number, colorMode: 'value' | 'index' = 'value', indexPosition?: number, curveWidth?: number): string => {
  let mappingValue = indexValue
  
  // If using index mode, map the index position as percentage of curve width to 0-255 range
  if (colorMode === 'index' && indexPosition !== undefined && curveWidth !== undefined && curveWidth > 0) {
    mappingValue = (indexPosition / curveWidth) * 255
    // Debug logging
    if (indexPosition < 3) {
      console.log(`Color Debug: mode=${colorMode}, indexPos=${indexPosition}, curveWidth=${curveWidth}, mappingValue=${mappingValue}`)
    }
  }
  const spectrum = getActiveSpectrum()
  const clampedValue = Math.max(0, Math.min(255, mappingValue))
  
  if (spectrum.type === 'hsl' || spectrum.type === 'rainbow') {
    // Always map the full 0-255 range to the full hue spectrum
    const [minHue, maxHue] = spectrum.hueRange
    const mappedHue = minHue + (clampedValue / 255) * (maxHue - minHue)
    return `hsl(${mappedHue}, ${spectrum.saturation * 100}%, ${spectrum.lightness * 100}%)`
  }
  
  if (spectrum.type === 'terrain') {
    // Terrain-specific mapping
    const normalized = clampedValue / 255
    if (normalized < 0.3) {
      // Water: blue to cyan
      const localHue = 240 - (normalized / 0.3) * 60 // 240 to 180
      return `hsl(${localHue}, ${spectrum.saturation * 100}%, ${spectrum.lightness * 100}%)`
    } else if (normalized < 0.7) {
      // Land: green
      const localHue = 120
      const localLightness = spectrum.lightness + (normalized - 0.3) * 0.2
      return `hsl(${localHue}, ${spectrum.saturation * 100}%, ${localLightness * 100}%)`
    } else {
      // Mountains: brown to white
      const localHue = 30
      const localLightness = spectrum.lightness + (normalized - 0.7) * 0.4
      return `hsl(${localHue}, ${spectrum.saturation * 0.5 * 100}%, ${localLightness * 100}%)`
    }
  }
  
  if (spectrum.type === 'thermal') {
    // Heat map: blue to red
    const [minHue, maxHue] = spectrum.hueRange
    const mappedHue = minHue + (clampedValue / 255) * (maxHue - minHue)
    return `hsl(${mappedHue}, ${spectrum.saturation * 100}%, ${spectrum.lightness * 100}%)`
  }
  
  if (spectrum.type === 'custom' && spectrum.saturation === 0) {
    // Grayscale: vary lightness from black to white
    const lightness = (clampedValue / 255) * 100
    return `hsl(0, 0%, ${lightness}%)`
  }
  
  // Fallback to default - full spectrum
  return `hsl(${(clampedValue / 255) * 360}, 70%, 50%)`
}

/**
 * Convert index value (0-255) to THREE.Color object using current spectrum
 */
export const indexToThreeColor = (indexValue: number, colorMode: 'value' | 'index' = 'value', indexPosition?: number, curveWidth?: number): { r: number; g: number; b: number } => {
  let mappingValue = indexValue
  
  // If using index mode, map the index position as percentage of curve width to 0-255 range
  if (colorMode === 'index' && indexPosition !== undefined && curveWidth !== undefined && curveWidth > 0) {
    mappingValue = (indexPosition / curveWidth) * 255
  }
  const spectrum = getActiveSpectrum()
  const clampedValue = Math.max(0, Math.min(255, mappingValue))
  
  let hslHue: number
  let saturation = spectrum.saturation
  let lightness = spectrum.lightness
  
  if (spectrum.type === 'hsl' || spectrum.type === 'rainbow') {
    // Map 0-255 to hue range
    const [minHue, maxHue] = spectrum.hueRange
    hslHue = minHue + (clampedValue / 255) * (maxHue - minHue)
  } else if (spectrum.type === 'terrain') {
    // Terrain-specific mapping (same as string version)
    const normalized = clampedValue / 255
    if (normalized < 0.3) {
      hslHue = 240 - (normalized / 0.3) * 60
    } else if (normalized < 0.7) {
      hslHue = 120
      lightness = lightness + (normalized - 0.3) * 0.2
    } else {
      hslHue = 30
      saturation = saturation * 0.5
      lightness = lightness + (normalized - 0.7) * 0.4
    }
  } else if (spectrum.type === 'thermal') {
    const [minHue, maxHue] = spectrum.hueRange
    hslHue = minHue + (clampedValue / 255) * (maxHue - minHue)
  } else if (spectrum.type === 'custom' && spectrum.saturation === 0) {
    // Grayscale: return RGB values directly
    const grayValue = clampedValue / 255
    return { r: grayValue, g: grayValue, b: grayValue }
  } else {
    // Fallback - full spectrum
    hslHue = (clampedValue / 255) * 360
  }
  
  // HSL to RGB conversion
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = c * (1 - Math.abs(((hslHue / 60) % 2) - 1))
  const m = lightness - c / 2
  
  let r = 0, g = 0, b = 0
  
  if (hslHue >= 0 && hslHue < 60) {
    r = c; g = x; b = 0
  } else if (hslHue >= 60 && hslHue < 120) {
    r = x; g = c; b = 0
  } else if (hslHue >= 120 && hslHue < 180) {
    r = 0; g = c; b = x
  } else if (hslHue >= 180 && hslHue < 240) {
    r = 0; g = x; b = c
  } else if (hslHue >= 240 && hslHue < 300) {
    r = x; g = 0; b = c
  } else if (hslHue >= 300 && hslHue < 360) {
    r = c; g = 0; b = x
  }
  
  return {
    r: r + m,
    g: g + m,
    b: b + m
  }
}
