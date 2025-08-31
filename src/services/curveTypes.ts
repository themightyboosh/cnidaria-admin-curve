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

export interface CurveTypesResponse {
  success: boolean;
  data: {
    curveTypes: Record<string, CurveTypeInfo>;
    curveTypesByCpuLoad: CurveTypeInfo[];
    cpuLoadDescriptions: Record<string, string>;
    categories: Record<string, string>;
    total: number;
  };
  message: string;
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
  private curveTypesMap: Record<string, CurveTypeInfo> = {};
  private cpuLoadDescriptions: Record<string, string> = {};
  private categories: Record<string, string> = {};
  private isLoading = false;
  private lastFetch = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch curve types from the API
   */
  async fetchCurveTypes(): Promise<CurveTypeInfo[]> {
    // Check cache
    if (this.curveTypes.length > 0 && Date.now() - this.lastFetch < this.CACHE_DURATION) {
      return this.curveTypes;
    }

    if (this.isLoading) {
      // Wait for current request to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.curveTypes;
    }

    this.isLoading = true;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/cnidaria-dev/us-central1/cnidaria-api-dev';
      const response = await fetch(`${apiUrl}/api/curve-types`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch curve types: ${response.status} ${response.statusText}`);
      }

      const data: CurveTypesResponse = await response.json();
      
      if (!data.success) {
        throw new Error(`API error: ${data.message}`);
      }

      // Update cache
      this.curveTypes = data.data.curveTypesByCpuLoad;
      this.curveTypesMap = data.data.curveTypes;
      this.cpuLoadDescriptions = data.data.cpuLoadDescriptions;
      this.categories = data.data.categories;
      this.lastFetch = Date.now();

      console.log(`📊 Loaded ${this.curveTypes.length} curve types from API`);
      
      return this.curveTypes;

    } catch (error) {
      console.error('❌ Failed to fetch curve types:', error);
      
      // Return fallback curve types if API fails
      return this.getFallbackCurveTypes();
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Fetch simple curve types list for dropdowns
   */
  async fetchCurveTypesList(): Promise<Array<{id: string, name: string, cpuLoad: string, displayName: string}>> {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/cnidaria-dev/us-central1/cnidaria-api-dev';
      const response = await fetch(`${apiUrl}/api/curve-types/list`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch curve types list: ${response.status} ${response.statusText}`);
      }

      const data: CurveTypesListResponse = await response.json();
      
      if (!data.success) {
        throw new Error(`API error: ${data.message}`);
      }

      console.log(`📊 Loaded ${data.data.total} curve types for dropdown`);
      
      return data.data.curveTypes;

    } catch (error) {
      console.error('❌ Failed to fetch curve types list:', error);
      
      // Return fallback curve types if API fails
      return this.getFallbackCurveTypes().map(ct => ({
        id: ct.id,
        name: ct.name,
        cpuLoad: ct.cpuLoad,
        displayName: this.formatCurveType(ct)
      }));
    }
  }

  /**
   * Get curve types (cached if available)
   */
  async getCurveTypes(): Promise<CurveTypeInfo[]> {
    if (this.curveTypes.length === 0) {
      return this.fetchCurveTypes();
    }
    return this.curveTypes;
  }

  /**
   * Get simple curve types list for dropdowns
   */
  async getCurveTypesList(): Promise<Array<{id: string, name: string, cpuLoad: string, displayName: string}>> {
    return this.fetchCurveTypesList();
  }

  /**
   * Get curve type by ID
   */
  getCurveTypeById(id: string): CurveTypeInfo | undefined {
    return this.curveTypesMap[id];
  }

  /**
   * Get curve types by CPU load
   */
  getCurveTypesByCpuLoad(cpuLoad: string): CurveTypeInfo[] {
    return this.curveTypes.filter(ct => ct.cpuLoad === cpuLoad);
  }

  /**
   * Get curve types by category
   */
  getCurveTypesByCategory(category: string): CurveTypeInfo[] {
    return this.curveTypes.filter(ct => ct.category === category);
  }

  /**
   * Get CPU load description
   */
  getCpuLoadDescription(cpuLoad: string): string {
    return this.cpuLoadDescriptions[cpuLoad] || 'Unknown CPU load';
  }

  /**
   * Get category description
   */
  getCategoryDescription(category: string): string {
    return this.categories[category] || 'Unknown category';
  }

  /**
   * Get all CPU loads
   */
  getCpuLoads(): string[] {
    return Object.keys(this.cpuLoadDescriptions);
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    return Object.keys(this.categories);
  }

  /**
   * Clear cache and force refresh
   */
  clearCache(): void {
    this.curveTypes = [];
    this.curveTypesMap = {};
    this.lastFetch = 0;
  }

  /**
   * Fallback curve types if API is unavailable
   */
  private getFallbackCurveTypes(): CurveTypeInfo[] {
    return [
      {
        id: 'radial-lm',
        name: 'Radial',
        description: 'Classic circular distance (√x² + y²)',
        cpuLoad: 'lm',
        category: 'circular'
      },
      {
        id: 'cartesian-x-l',
        name: 'Cartesian X',
        description: 'Distance based on X coordinate only',
        cpuLoad: 'l',
        category: 'basic'
      },
      {
        id: 'cartesian-y-l',
        name: 'Cartesian Y',
        description: 'Distance based on Y coordinate only',
        cpuLoad: 'l',
        category: 'basic'
      }
    ];
  }

  /**
   * Format curve type for display
   */
  formatCurveType(curveType: CurveTypeInfo): string {
    const cpuLoadEmoji = this.getCpuLoadEmoji(curveType.cpuLoad);
    return `${cpuLoadEmoji} ${curveType.name}`;
  }

  /**
   * Get CPU load emoji
   */
  private getCpuLoadEmoji(cpuLoad: string): string {
    const emojiMap: Record<string, string> = {
      'l': '⚡',
      'lm': '⚡⚡',
      'm': '⚡⚡⚡',
      'mh': '⚡⚡⚡⚡',
      'h': '⚡⚡⚡⚡⚡',
      'vh': '⚡⚡⚡⚡⚡⚡'
    };
    return emojiMap[cpuLoad] || '❓';
  }
}

// Export singleton instance
export const curveTypesService = new CurveTypesService();
export default curveTypesService;
