/**
 * Curve Data Service
 * Handles fetching and managing curve data for SVG grid visualization
 */

export interface CurveDataCell {
  rectangleId: string;
  curveValue: number;
  indexPosition: number;
  worldX: number;
  worldY: number;
  isNew?: boolean;
}

export interface ProcessCoordinateResponse {
  "cell-coordinates": [number, number];
  coordKey: string;
  "index-position": number;
  "index-value": number;
}

export interface CurveDataResponse {
  [curveName: string]: ProcessCoordinateResponse[];
}

class CurveDataService {
  private apiUrl = 'https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev';
  private localDataArray: Map<string, CurveDataCell> = new Map();
  private isLoading = false;

  /**
   * Fetch curve data for a grid area
   */
  async fetchCurveData(curveId: string, x1: number, y1: number, x2: number, y2: number): Promise<CurveDataResponse> {
    try {
      this.isLoading = true;
      console.log(`📊 Fetching curve data for area: (${x1}, ${y1}) to (${x2}, ${y2})`);

      const response = await fetch(
        `${this.apiUrl}/api/curves/${curveId}/process?x=${x1}&y=${y1}&x2=${x2}&y2=${y2}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip, deflate'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch curve data: ${response.status} ${response.statusText}`);
      }

      const data: CurveDataResponse = await response.json();
      console.log(`✅ Fetched curve data: ${Object.keys(data)[0]}`);
      
      return data;

    } catch (error) {
      console.error('❌ Failed to fetch curve data:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Update local data array with new curve data
   */
  updateLocalDataArray(curveName: string, results: ProcessCoordinateResponse[]): void {
    console.log(`🔄 Updating local data array with ${results.length} results`);

    results.forEach((result: ProcessCoordinateResponse) => {
      const [worldX, worldY] = result["cell-coordinates"];
      const rectangleId = `square-${worldX}-${worldY}`;
      
      const cellData: CurveDataCell = {
        rectangleId,
        curveValue: result["index-value"],
        indexPosition: result["index-position"],
        worldX,
        worldY,
        isNew: false
      };

      this.localDataArray.set(rectangleId, cellData);
    });

    console.log(`✅ Local data array updated: ${this.localDataArray.size} cells`);
  }

  /**
   * Get curve data for a specific cell
   */
  getCellData(rectangleId: string): CurveDataCell | undefined {
    return this.localDataArray.get(rectangleId);
  }

  /**
   * Get all curve data
   */
  getAllCurveData(): Map<string, CurveDataCell> {
    return this.localDataArray;
  }

  /**
   * Update local array structure when cells are added/removed
   */
  updateArrayStructure(
    changes: { addColumns: number; removeColumns: number; addRows: number; removeRows: number },
    gridData: Array<Array<{ worldX: number; worldY: number; isNew?: boolean }>>
  ): void {
    console.log(`🔄 Updating array structure for changes:`, changes);

    // Create new map with updated structure
    const newLocalDataArray = new Map<string, CurveDataCell>();

    // Copy existing data with updated coordinates
    for (let y = 0; y < gridData.length; y++) {
      for (let x = 0; x < gridData[y].length; x++) {
        const cell = gridData[y][x];
        const oldRectangleId = `square-${cell.worldX}-${cell.worldY}`;
        const existingData = this.localDataArray.get(oldRectangleId);

        if (existingData) {
          // Update coordinates and mark as not new
          const updatedData: CurveDataCell = {
            ...existingData,
            worldX: cell.worldX,
            worldY: cell.worldY,
            isNew: false
          };
          newLocalDataArray.set(oldRectangleId, updatedData);
        }
      }
    }

    this.localDataArray = newLocalDataArray;
    console.log(`✅ Array structure updated: ${this.localDataArray.size} cells`);
  }

  /**
   * Fetch data for newly added cells
   */
  async fetchDataForNewCells(
    curveId: string,
    newCells: Array<{ worldX: number; worldY: number }>
  ): Promise<void> {
    if (newCells.length === 0) return;

    console.log(`📊 Fetching data for ${newCells.length} new cells`);

    // Group cells by horizontal and vertical additions
    const horizontalCells = newCells.filter(cell => 
      Math.abs(cell.worldX) > Math.abs(cell.worldY)
    );
    const verticalCells = newCells.filter(cell => 
      Math.abs(cell.worldY) >= Math.abs(cell.worldX)
    );

    // Fetch horizontal cells
    if (horizontalCells.length > 0) {
      const minX = Math.min(...horizontalCells.map(c => c.worldX));
      const maxX = Math.max(...horizontalCells.map(c => c.worldX));
      const minY = Math.min(...horizontalCells.map(c => c.worldY));
      const maxY = Math.max(...horizontalCells.map(c => c.worldY));

      try {
        const horizontalData = await this.fetchCurveData(curveId, minX, minY, maxX, maxY);
        const curveName = Object.keys(horizontalData)[0];
        this.updateLocalDataArray(curveName, horizontalData[curveName]);
      } catch (error) {
        console.error('❌ Failed to fetch horizontal cells data:', error);
      }
    }

    // Fetch vertical cells
    if (verticalCells.length > 0) {
      const minX = Math.min(...verticalCells.map(c => c.worldX));
      const maxX = Math.max(...verticalCells.map(c => c.worldX));
      const minY = Math.min(...verticalCells.map(c => c.worldY));
      const maxY = Math.max(...verticalCells.map(c => c.worldY));

      try {
        const verticalData = await this.fetchCurveData(curveId, minX, minY, maxX, maxY);
        const curveName = Object.keys(verticalData)[0];
        this.updateLocalDataArray(curveName, verticalData[curveName]);
      } catch (error) {
        console.error('❌ Failed to fetch vertical cells data:', error);
      }
    }
  }

  /**
   * Apply colors to rectangles based on curve data and color mode
   */
  applyColorsToRectangles(
    colorMode: 'value' | 'index',
    spectrum: number,
    curveWidth: number
  ): Map<string, string> {
    const colorMap = new Map<string, string>();

    this.localDataArray.forEach((cellData, rectangleId) => {
      let color: string;

      if (colorMode === 'value') {
        // Use curve data (0-255) directly mapped to spectrum
        const normalizedValue = (cellData.curveValue / 255) * spectrum;
        color = this.valueToColor(normalizedValue);
      } else {
        // Use index position as percentage of curve width
        const percentage = (cellData.indexPosition / curveWidth) * spectrum;
        color = this.valueToColor(percentage);
      }

      colorMap.set(rectangleId, color);
    });

    console.log(`🎨 Applied ${colorMode} colors to ${colorMap.size} rectangles`);
    return colorMap;
  }

  /**
   * Convert value to color string
   */
  private valueToColor(value: number): string {
    // Simple color mapping - can be enhanced with different color schemes
    const normalizedValue = Math.max(0, Math.min(255, Math.floor(value)));
    return `rgb(${normalizedValue}, ${normalizedValue}, ${normalizedValue})`;
  }

  /**
   * Clear all data
   */
  clearData(): void {
    this.localDataArray.clear();
    console.log('🗑️ Cleared all curve data');
  }

  /**
   * Get loading state
   */
  getLoadingState(): boolean {
    return this.isLoading;
  }
}

// Export singleton instance
export const curveDataService = new CurveDataService();
export default curveDataService;
