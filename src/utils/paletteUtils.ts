// Palette utilities for PNG generation
import { SPECTRUM_PRESETS, indexToThreeColor, type ColorSpectrumConfig } from './colorSpectrum';

export interface PaletteColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

// Convert a spectrum configuration to a 256-color palette
export function spectrumToPalette(spectrum: ColorSpectrumConfig): PaletteColor[] {
  const palette: PaletteColor[] = [];
  
  // Generate 256 colors based on spectrum type
  for (let i = 0; i < 256; i++) {
    let r = 0, g = 0, b = 0;
    const normalized = i / 255;
    
    switch (spectrum.type) {
      case 'hsl':
      case 'rainbow':
        // Map 0-255 to hue range
        const [minHue, maxHue] = spectrum.hueRange;
        const hue = minHue + normalized * (maxHue - minHue);
        const hslColor = hslToRgb(hue / 360, spectrum.saturation, spectrum.lightness);
        r = hslColor.r;
        g = hslColor.g;
        b = hslColor.b;
        break;
        
      case 'terrain':
        if (normalized < 0.3) {
          // Water: blue to cyan
          const localHue = (240 - (normalized / 0.3) * 60) / 360; // 240 to 180
          const hslColor = hslToRgb(localHue, spectrum.saturation, spectrum.lightness);
          r = hslColor.r;
          g = hslColor.g;
          b = hslColor.b;
        } else if (normalized < 0.7) {
          // Land: green
          const localLightness = spectrum.lightness + (normalized - 0.3) * 0.2;
          const hslColor = hslToRgb(120 / 360, spectrum.saturation, localLightness);
          r = hslColor.r;
          g = hslColor.g;
          b = hslColor.b;
        } else {
          // Mountains: brown to white
          const localLightness = spectrum.lightness + (normalized - 0.7) * 0.4;
          const hslColor = hslToRgb(30 / 360, spectrum.saturation * 0.5, localLightness);
          r = hslColor.r;
          g = hslColor.g;
          b = hslColor.b;
        }
        break;
        
      case 'thermal':
        // Heat map: blue to red
        const [minThermalHue, maxThermalHue] = spectrum.hueRange;
        const thermalHue = (minThermalHue + normalized * (maxThermalHue - minThermalHue)) / 360;
        const thermalColor = hslToRgb(thermalHue, spectrum.saturation, spectrum.lightness);
        r = thermalColor.r;
        g = thermalColor.g;
        b = thermalColor.b;
        break;
        
      case 'custom':
        if (spectrum.saturation === 0) {
          // Grayscale
          r = g = b = normalized;
        } else {
          // Default spectrum
          const defaultColor = hslToRgb(normalized, 0.7, 0.5);
          r = defaultColor.r;
          g = defaultColor.g;
          b = defaultColor.b;
        }
        break;
        
      default:
        // Fallback to full spectrum
        const fallbackColor = hslToRgb(normalized, 0.7, 0.5);
        r = fallbackColor.r;
        g = fallbackColor.g;
        b = fallbackColor.b;
    }
    
    palette.push({
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
      a: 255
    });
  }
  
  return palette;
}

// HSL to RGB conversion helper
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (h >= 0 && h < 1/6) {
    r = c; g = x; b = 0;
  } else if (h >= 1/6 && h < 2/6) {
    r = x; g = c; b = 0;
  } else if (h >= 2/6 && h < 3/6) {
    r = 0; g = c; b = x;
  } else if (h >= 3/6 && h < 4/6) {
    r = 0; g = x; b = c;
  } else if (h >= 4/6 && h < 5/6) {
    r = x; g = 0; b = c;
  } else if (h >= 5/6 && h < 1) {
    r = c; g = 0; b = x;
  }
  
  return {
    r: r + m,
    g: g + m,
    b: b + m
  };
}

// Get palette by preset name
export function getPaletteByName(presetName: string): PaletteColor[] {
  const spectrum = SPECTRUM_PRESETS[presetName] || SPECTRUM_PRESETS.default;
  return spectrumToPalette(spectrum);
}

// Predefined 256-color palettes
export const PREDEFINED_PALETTES = {
  default: (): PaletteColor[] => getPaletteByName('default'),
  rainbow: (): PaletteColor[] => getPaletteByName('rainbow'),
  terrain: (): PaletteColor[] => getPaletteByName('terrain'),
  thermal: (): PaletteColor[] => getPaletteByName('thermal'),
  grayscale: (): PaletteColor[] => getPaletteByName('grayscale')
} as const;

// Available palette names
export const PALETTE_NAMES = Object.keys(PREDEFINED_PALETTES) as Array<keyof typeof PREDEFINED_PALETTES>;

// Get palette options for UI dropdown
export function getPaletteOptions(): Array<{ value: string; label: string }> {
  return PALETTE_NAMES.map(name => ({
    value: name,
    label: name.charAt(0).toUpperCase() + name.slice(1)
  }));
}

// Validate and normalize palette
export function normalizePalette(palette: PaletteColor[]): PaletteColor[] {
  if (!palette || palette.length === 0) {
    // Fallback to grayscale
    return PREDEFINED_PALETTES.grayscale();
  }
  
  const normalized = palette.slice(0, 256);
  
  // Pad with last color if needed
  if (normalized.length < 256) {
    const lastColor = normalized[normalized.length - 1];
    while (normalized.length < 256) {
      normalized.push({ ...lastColor });
    }
  }
  
  // Ensure alpha channel
  return normalized.map(color => ({
    r: Math.max(0, Math.min(255, Math.round(color.r))),
    g: Math.max(0, Math.min(255, Math.round(color.g))),
    b: Math.max(0, Math.min(255, Math.round(color.b))),
    a: color.a != null ? Math.max(0, Math.min(255, Math.round(color.a))) : 255
  }));
}
