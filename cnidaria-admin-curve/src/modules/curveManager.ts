import axios from 'axios';
import { apiUrl } from '../config/environments';

// API Configuration
const API_BASE_URL = apiUrl;

// Types
export interface CurveData {
  'curve-name': string;
  'curve-description': string;
  'curve-tags': string[];
  'curve-width': number;
  'curve-height': number;
  'curve-type': string;
  'curve-index-scaling': number;
  'curve-data': number[];
  'generator-noise-type': string;
  'generator-noise-setting': {
    seed: number;
    frequency: number;
    octaves: number;
  };
  'generator-top-shelf': number;
  'generator-bottom-shelf': number;
  'generator-value-fill': number;
  'generator-value-offset': number;
  'index-distortion-distortion_level': number;
  'index-distortion-frequency': number;
  'index-distortion-angular': number;
}

export interface Curve extends CurveData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessedCoordinate {
  'cell-coordinates': [number, number];
  coordKey: string;
  'index-position': number;
  'index-value': number;
}

export interface ProcessedGrid {
  [curveName: string]: ProcessedCoordinate[];
}

export interface ProcessedSingle {
  [curveName: string]: ProcessedCoordinate;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  message?: string;
  timestamp: string;
}

export interface CacheStats {
  items: number;
  hits: number;
  misses: number;
  sizeBytes?: number;
  updatedAt?: string;
}

// Curve Manager Class
export class CurveManager {
  private apiClient;

  constructor() {
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Create a new curve
  async createCurve(curveData: CurveData): Promise<Curve> {
    try {
      const response = await this.apiClient.post<ApiResponse<Curve>>('/api/curves', curveData);
      
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || 'Failed to create curve');
      }
      
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error?.message || error.message);
      }
      throw error;
    }
  }

  // Get a curve by ID
  async getCurve(id: string): Promise<Curve> {
    try {
      const response = await this.apiClient.get<ApiResponse<Curve>>(`/api/curves/${id}`);
      
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || 'Failed to get curve');
      }
      
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error?.message || error.message);
      }
      throw error;
    }
  }

  // Update an existing curve
  async updateCurve(id: string, curveData: Partial<CurveData>): Promise<Curve> {
    try {
      const response = await this.apiClient.put<ApiResponse<Curve>>(`/api/curves/${id}`, curveData);
      
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || 'Failed to update curve');
      }
      
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error?.message || error.message);
      }
      throw error;
    }
  }

  // List all curves
  async listCurves(): Promise<Curve[]> {
    try {
      const response = await this.apiClient.get<ApiResponse<{ curves: Curve[]; total: number }>>('/api/curves');
      
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || 'Failed to list curves');
      }
      
      return response.data.data.curves;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error?.message || error.message);
      }
      throw error;
    }
  }

  // Delete a curve by ID
  async deleteCurve(id: string): Promise<void> {
    try {
      const response = await this.apiClient.delete<ApiResponse<void>>(`/api/curves/${id}`);
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to delete curve');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error?.message || error.message);
      }
      throw error;
    }
  }

  // Delete all curves
  async deleteAllCurves(): Promise<void> {
    try {
      const response = await this.apiClient.delete<ApiResponse<{ deletedCount: number }>>('/api/curves');
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to delete all curves');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error?.message || error.message);
      }
      throw error;
    }
  }

  // Process single coordinate
  async processCoordinate(curveId: string, x: number, y: number): Promise<ProcessedSingle> {
    try {
      const response = await this.apiClient.get<ProcessedSingle>(`/api/curves/${curveId}/process`, {
        params: { x, y }
      });
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error?.message || error.message);
      }
      throw error;
    }
  }

  // Process grid coordinates
  async processGrid(curveId: string, x1: number, y1: number, x2: number, y2: number): Promise<ProcessedGrid> {
    try {
      const response = await this.apiClient.get<ProcessedGrid>(`/api/curves/${curveId}/process`, {
        params: { x: x1, y: y1, x2, y2 }
      });
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error?.message || error.message);
      }
      throw error;
    }
  }

  // Get cache statistics
  async getCacheStats(curveId: string): Promise<CacheStats> {
    try {
      const response = await this.apiClient.get<ApiResponse<CacheStats>>(`/api/curves/${curveId}/cache`);
      
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || 'Failed to get cache stats');
      }
      
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error?.message || error.message);
      }
      throw error;
    }
  }

  // Clear curve cache
  async clearCurveCache(curveId: string): Promise<void> {
    try {
      const response = await this.apiClient.delete<ApiResponse<void>>(`/api/curves/${curveId}/cache`);
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to clear curve cache');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error?.message || error.message);
      }
      throw error;
    }
  }

  // Search curves by name
  async searchCurves(searchTerm: string): Promise<Curve[]> {
    try {
      const response = await this.apiClient.get<ApiResponse<{ curves: Curve[]; total: number }>>(`/api/curves/search/${searchTerm}`);
      
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || 'Failed to search curves');
      }
      
      return response.data.data.curves;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error?.message || error.message);
      }
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.apiClient.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const curveManager = new CurveManager();
export default curveManager;
