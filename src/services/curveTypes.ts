/**
 * Curve Types Service
 * Handles fetching and managing curve types from the coordinate noise API
 * Updated to use the new coordinate noise patterns instead of legacy curve types
 */

export interface CurveTypeInfo {
  id: string;
  name: string;
  description: string;
  cpuLoadLevel: number;
  category: string;
  gpuExpression: string;
  gpuDescription: string;
}

export interface CurveTypesListResponse {
  success: boolean;
  data: {
    noiseTypes: CurveTypeInfo[];
    total: number;
    cpuLoadDistribution: Record<string, number>;
  };
  message: string;
}

class CurveTypesService {
  private curveTypes: CurveTypeInfo[] = [];
  private curveTypesList: Array<{id: string, name: string, cpuLoad: string, displayName: string}> = [];
  private isLoading = false;

  /**
   * Fetch coordinate noise patterns as curve types for dropdowns
   */
  async fetchCurveTypesList(): Promise<Array<{id: string, name: string, cpuLoad: string, displayName: string}>> {
    try {
      const apiUrl = 'https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev';
      const response = await fetch(`${apiUrl}/api/coordinate-noise/firebase`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch coordinate noise patterns: ${response.status} ${response.statusText}`);
      }

      const data: CurveTypesListResponse = await response.json();
      
      if (!data.success) {
        throw new Error(`API error: ${data.message}`);
      }

      // Convert coordinate noise patterns to curve types format
      this.curveTypesList = data.data.noiseTypes.map(pattern => ({
        id: pattern.id,
        name: pattern.name,
        cpuLoad: this.getCpuLoadString(pattern.cpuLoadLevel),
        displayName: `${this.getCpuLoadIcon(pattern.cpuLoadLevel)} ${pattern.name}`
      }));
      
      console.log(`📊 Loaded ${data.data.total} coordinate noise patterns as curve types`);
      
      return this.curveTypesList;

    } catch (error) {
      console.error('❌ Failed to fetch coordinate noise patterns:', error);
      
      // Return fallback curve types if API fails
      return this.getFallbackCurveTypesList();
    }
  }

  /**
   * Get simple curve types list for dropdowns
   */
  async getCurveTypesList(): Promise<Array<{id: string, name: string, cpuLoad: string, displayName: string}>> {
    if (this.curveTypesList.length === 0) {
      return this.fetchCurveTypesList();
    }
    return this.curveTypesList;
  }

  /**
   * Convert CPU load level (1-10) to string format
   */
  private getCpuLoadString(cpuLoadLevel: number): string {
    if (cpuLoadLevel <= 1) return 'l';
    if (cpuLoadLevel <= 2) return 'lm';
    if (cpuLoadLevel <= 4) return 'm';
    if (cpuLoadLevel <= 6) return 'mh';
    if (cpuLoadLevel <= 8) return 'h';
    return 'vh';
  }

  /**
   * Get CPU load icon for display
   */
  private getCpuLoadIcon(cpuLoadLevel: number): string {
    if (cpuLoadLevel <= 1) return '⚡';
    if (cpuLoadLevel <= 2) return '⚡⚡';
    if (cpuLoadLevel <= 4) return '⚡⚡⚡';
    if (cpuLoadLevel <= 6) return '⚡⚡⚡⚡';
    if (cpuLoadLevel <= 8) return '⚡⚡⚡⚡⚡';
    return '⚡⚡⚡⚡⚡⚡';
  }

  /**
   * Fallback curve types if API is unavailable
   */
  private getFallbackCurveTypesList(): Array<{id: string, name: string, cpuLoad: string, displayName: string}> {
    return [
      {
        id: 'radial',
        name: 'radial',
        cpuLoad: 'm',
        displayName: '⚡⚡⚡ radial'
      },
      {
        id: 'cartesian-x',
        name: 'cartesian-x',
        cpuLoad: 'l',
        displayName: '⚡ cartesian-x'
      },
      {
        id: 'cartesian-y',
        name: 'cartesian-y',
        cpuLoad: 'l',
        displayName: '⚡ cartesian-y'
      }
    ];
  }

  /**
   * Clear cache and force refresh
   */
  clearCache(): void {
    this.curveTypes = [];
    this.curveTypesList = [];
  }
}

// Export singleton instance
export const curveTypesService = new CurveTypesService();
export default curveTypesService;
