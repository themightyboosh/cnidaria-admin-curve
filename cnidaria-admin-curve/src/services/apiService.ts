// API Service for Admin Curve Tool
// Connects to the live cnidaria-api

const API_BASE_URL = 'https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api';

export interface Curve {
  id: string;
  'curve-name': string;
  'curve-description'?: string;
  'curve-tags'?: string[];
  'curve-width': number;
  'curve-height': number;
  'curve-type': string;
  'curve-index-scaling': number;
  'curve-data': number[];
  'generator-noise-type': string;
  'generator-noise-setting'?: any;
  'generator-top-shelf': number;
  'generator-bottom-shelf': number;
  'generator-value-fill': number;
  'generator-value-offset': number;
  'index-distortion-distortion_level': number;
  'index-distortion-frequency': number;
  'index-distortion-angular': number;
}

export interface ProcessCoordinateResponse {
  [curveName: string]: {
    'cell-coordinates': [number, number];
    'coordKey': string;
    'index-position': number;
    'index-value': number;
  };
}

export interface GridProcessResponse {
  [curveName: string]: Array<{
    'cell-coordinates': [number, number];
    'coordKey': string;
    'index-position': number;
    'index-value': number;
  }>;
}

export interface CacheStats {
  activeEntries: number;
  totalKeys: number;
  hits: number;
  misses: number;
  hitRate: number;
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Generic request method
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // Health check
  async getHealth(): Promise<any> {
    return this.request('/health');
  }

  // Test endpoint
  async testApi(): Promise<any> {
    return this.request('/api/test');
  }

  // Curve Management
  async createCurve(curveData: Partial<Curve>): Promise<{ success: boolean; data: { id: string; curve: Curve } }> {
    return this.request('/api/curves', {
      method: 'POST',
      body: JSON.stringify(curveData),
    });
  }

  async getCurve(id: string): Promise<{ success: boolean; data: { curve: Curve } }> {
    return this.request(`/api/curves/${id}`);
  }

  async updateCurve(id: string, curveData: Partial<Curve>): Promise<{ success: boolean; data: { curve: Curve } }> {
    return this.request(`/api/curves/${id}`, {
      method: 'PUT',
      body: JSON.stringify(curveData),
    });
  }

  async listCurves(): Promise<{ success: boolean; data: { curves: Curve[]; total: number } }> {
    return this.request('/api/curves');
  }

  async deleteCurve(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/curves/${id}`, {
      method: 'DELETE',
    });
  }

  async deleteAllCurves(): Promise<{ success: boolean; message: string; deletedCount: number }> {
    return this.request('/api/curves', {
      method: 'DELETE',
    });
  }

  // Coordinate Processing
  async processCoordinate(
    curveId: string, 
    x: number, 
    y: number
  ): Promise<ProcessCoordinateResponse> {
    return this.request(`/api/curves/${curveId}/process?x=${x}&y=${y}`);
  }

  async processGrid(
    curveId: string, 
    x1: number, 
    y1: number, 
    x2: number, 
    y2: number
  ): Promise<GridProcessResponse> {
    return this.request(`/api/curves/${curveId}/process?x=${x1}&y=${y1}&x2=${x2}&y2=${y2}`);
  }

  // Cache Management
  async getCacheStats(curveId: string): Promise<{ success: boolean; cache: CacheStats }> {
    return this.request(`/api/curves/${curveId}/cache`);
  }

  async clearCurveCache(curveId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/curves/${curveId}/cache`, {
      method: 'DELETE',
    });
  }

  // Utility methods
  async searchCurves(searchTerm: string): Promise<{ success: boolean; data: { curves: Curve[] } }> {
    return this.request(`/api/curves/search/${encodeURIComponent(searchTerm)}`);
  }

  // Generate sample curve data for testing
  generateSampleCurve(name: string = 'Sample Curve'): Partial<Curve> {
    return {
      'curve-name': name,
      'curve-description': 'A sample curve for testing',
      'curve-tags': ['sample', 'test'],
      'curve-width': 11,
      'curve-height': 255,
      'curve-type': 'Radial',
      'curve-index-scaling': 1.0,
      'curve-data': [127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127],
      'generator-noise-type': 'perlin',
      'generator-noise-setting': {
        seed: Math.floor(Math.random() * 10000),
        frequency: 0.5,
        octaves: 3
      },
      'generator-top-shelf': 255,
      'generator-bottom-shelf': 0,
      'generator-value-fill': 0.8,
      'generator-value-offset': 0,
      'index-distortion-distortion_level': 0.2,
      'index-distortion-frequency': 0.8,
      'index-distortion-angular': 0.1
    };
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
