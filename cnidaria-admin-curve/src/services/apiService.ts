// API Service for Cnidaria Admin Curve Tool
// Handles communication with the cnidaria-api backend

const API_BASE_URL = 'https://us-central1-cnidaria-api.cloudfunctions.net';

export interface Curve {
  id: string;
  'curve-name': string;
  'curve-type': string;
  width: number;
  'curve-data': number[];
  'generator-noise-type': string;
  'curve-index-scaling': number;
  'angular-distortion': number;
  'coordinate-distortion': number;
  'perlin-noise-seed': number;
  'perlin-noise-scale': number;
  'perlin-noise-octaves': number;
  'perlin-noise-persistence': number;
  'perlin-noise-lacunarity': number;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessedCoordinate {
  'cell-coordinates': [number, number];
  coordKey: string;
  'index-position': number;
  'index-value': number;
}

export const apiService = {
  // Get all curves
  async getCurves(): Promise<Curve[]> {
    const response = await fetch(`${API_BASE_URL}/api/curves`);
    if (!response.ok) {
      throw new Error(`Failed to fetch curves: ${response.statusText}`);
    }
    const data = await response.json();
    return data.curves || [];
  },

  // Process coordinates for a curve
  async processCoordinates(
    curveId: string, 
    x: number, 
    y: number, 
    x2?: number, 
    y2?: number
  ): Promise<ProcessedCoordinate[]> {
    const params = new URLSearchParams({ x: x.toString(), y: y.toString() });
    if (x2 !== undefined && y2 !== undefined) {
      params.append('x2', x2.toString());
      params.append('y2', y2.toString());
    }

    const response = await fetch(
      `${API_BASE_URL}/api/curves/${curveId}/process?${params}`,
      {
        headers: {
          'Accept-Encoding': 'gzip, deflate'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to process coordinates: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.results || [];
  }
};
