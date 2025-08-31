/**
 * Coordinate Noise Service
 * Handles fetching and managing coordinate noise patterns from the API
 */

export interface CoordinateNoiseInfo {
  id: string;
  name: string;
  description: string;
  cpuLoad: 'l' | 'lm' | 'm' | 'mh' | 'h' | 'vh';
  category: string;
  gpuExpression: string;
  gpuDescription: string;
}

export interface CoordinateNoiseListResponse {
  success: boolean;
  data: {
    coordinateNoise: Record<string, CoordinateNoiseInfo>;
    coordinateNoiseByCpuLoad: CoordinateNoiseInfo[];
    total: number;
  };
  message: string;
}

class CoordinateNoiseService {
  private coordinateNoise: Record<string, CoordinateNoiseInfo> = {};
  private coordinateNoiseList: Array<{id: string, name: string, cpuLoad: string, displayName: string}> = [];
  private isLoading = false;

  /**
   * Fetch coordinate noise patterns from the API
   */
  async fetchCoordinateNoise(): Promise<Record<string, CoordinateNoiseInfo>> {
    try {
      const apiUrl = 'https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api';
      const response = await fetch(`${apiUrl}/api/coordinate-noise`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch coordinate noise: ${response.status} ${response.statusText}`);
      }

      const data: CoordinateNoiseListResponse = await response.json();
      
      if (!data.success) {
        throw new Error(`API error: ${data.message}`);
      }

      this.coordinateNoise = data.data.coordinateNoise;
      console.log(`📊 Loaded ${data.data.total} coordinate noise patterns`);
      
      return this.coordinateNoise;

    } catch (error) {
      console.error('❌ Failed to fetch coordinate noise:', error);
      
      // Return fallback patterns if API fails
      return this.getFallbackCoordinateNoise();
    }
  }

  /**
   * Fetch simple coordinate noise list for dropdowns
   */
  async fetchCoordinateNoiseList(): Promise<Array<{id: string, name: string, cpuLoad: string, displayName: string}>> {
    try {
      const patterns = await this.fetchCoordinateNoise();
      
      this.coordinateNoiseList = Object.values(patterns).map(pattern => ({
        id: pattern.id,
        name: pattern.name,
        cpuLoad: pattern.cpuLoad,
        displayName: `${this.getCpuLoadIcon(pattern.cpuLoad)} ${pattern.name}`
      }));
      
      return this.coordinateNoiseList;

    } catch (error) {
      console.error('❌ Failed to fetch coordinate noise list:', error);
      return this.getFallbackCoordinateNoiseList();
    }
  }

  /**
   * Get simple coordinate noise list for dropdowns
   */
  async getCoordinateNoiseList(): Promise<Array<{id: string, name: string, cpuLoad: string, displayName: string}>> {
    if (this.coordinateNoiseList.length === 0) {
      return this.fetchCoordinateNoiseList();
    }
    return this.coordinateNoiseList;
  }

  /**
   * Get CPU load icon for display
   */
  private getCpuLoadIcon(cpuLoad: string): string {
    const icons = {
      'l': '⚡',
      'lm': '⚡⚡',
      'm': '⚡⚡⚡',
      'mh': '⚡⚡⚡⚡',
      'h': '⚡⚡⚡⚡⚡',
      'vh': '⚡⚡⚡⚡⚡⚡'
    };
    return icons[cpuLoad as keyof typeof icons] || '⚡';
  }

  /**
   * Fallback coordinate noise patterns if API is unavailable
   */
  private getFallbackCoordinateNoise(): Record<string, CoordinateNoiseInfo> {
    return {
      'radial-lm': {
        id: 'radial-lm',
        name: 'Radial',
        description: 'Classic circular distance (√x² + y²)',
        cpuLoad: 'lm',
        category: 'circular',
        gpuExpression: 'sqrt(x * x + y * y)',
        gpuDescription: 'Euclidean distance from origin'
      },
      'cartesian-x-l': {
        id: 'cartesian-x-l',
        name: 'Cartesian X',
        description: 'Distance based on X coordinate only',
        cpuLoad: 'l',
        category: 'basic',
        gpuExpression: 'abs(x)',
        gpuDescription: 'Returns absolute value of X coordinate'
      },
      'cartesian-y-l': {
        id: 'cartesian-y-l',
        name: 'Cartesian Y',
        description: 'Distance based on Y coordinate only',
        cpuLoad: 'l',
        category: 'basic',
        gpuExpression: 'abs(y)',
        gpuDescription: 'Returns absolute value of Y coordinate'
      }
    };
  }

  /**
   * Fallback coordinate noise list if API is unavailable
   */
  private getFallbackCoordinateNoiseList(): Array<{id: string, name: string, cpuLoad: string, displayName: string}> {
    return [
      {
        id: 'radial-lm',
        name: 'Radial',
        cpuLoad: 'lm',
        displayName: '⚡⚡ Radial'
      },
      {
        id: 'cartesian-x-l',
        name: 'Cartesian X',
        cpuLoad: 'l',
        displayName: '⚡ Cartesian X'
      },
      {
        id: 'cartesian-y-l',
        name: 'Cartesian Y',
        cpuLoad: 'l',
        displayName: '⚡ Cartesian Y'
      }
    ];
  }

  /**
   * Clear cache and force refresh
   */
  clearCache(): void {
    this.coordinateNoise = {};
    this.coordinateNoiseList = [];
  }
}

// Export singleton instance
export const coordinateNoiseService = new CoordinateNoiseService();
export default coordinateNoiseService;
