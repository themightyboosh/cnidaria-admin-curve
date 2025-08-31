/**
 * Curve Types Service
 * Handles fetching and managing curve types from the API
 */

export interface CurveTypeInfo {
  id: string;
  name: string;
  description: string;
  cpuLoad: 'l' | 'lm' | 'm' | 'mh' | 'h' | 'vh';
  category: string;
}

export interface CurveTypesListResponse {
  success: boolean;
  data: {
    curveTypes: Array<{
      id: string;
      name: string;
      cpuLoad: string;
      displayName: string;
    }>;
    total: number;
  };
  message: string;
}

class CurveTypesService {
  private curveTypes: CurveTypeInfo[] = [];
  private curveTypesList: Array<{id: string, name: string, cpuLoad: string, displayName: string}> = [];
  private isLoading = false;

  /**
   * Fetch simple curve types list for dropdowns
   */
  async fetchCurveTypesList(): Promise<Array<{id: string, name: string, cpuLoad: string, displayName: string}>> {
    try {
      const apiUrl = 'https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev';
      const response = await fetch(`${apiUrl}/api/curve-types/list`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch curve types list: ${response.status} ${response.statusText}`);
      }

      const data: CurveTypesListResponse = await response.json();
      
      if (!data.success) {
        throw new Error(`API error: ${data.message}`);
      }

      this.curveTypesList = data.data.curveTypes;
      console.log(`📊 Loaded ${data.data.total} curve types for dropdown`);
      
      return this.curveTypesList;

    } catch (error) {
      console.error('❌ Failed to fetch curve types list:', error);
      
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
   * Fallback curve types if API is unavailable
   */
  private getFallbackCurveTypesList(): Array<{id: string, name: string, cpuLoad: string, displayName: string}> {
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
    this.curveTypes = [];
    this.curveTypesList = [];
  }
}

// Export singleton instance
export const curveTypesService = new CurveTypesService();
export default curveTypesService;
