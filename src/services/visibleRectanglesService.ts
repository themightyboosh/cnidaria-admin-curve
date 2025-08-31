interface VisibleRectangle {
  worldX: number
  worldY: number
  rectangleId: string
  curveValue?: number
  indexPosition?: number
  fillR: number
  fillG: number
  fillB: number
  isNew?: boolean
}

interface ViewportBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

class VisibleRectanglesService {
  private visibleRectangles: Map<string, VisibleRectangle> = new Map()
  private bufferSize: number = 5
  private cellSize: number = 50
  private apiUrl = 'https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev'

  // Initialize visible rectangles at app launch
  initializeVisibleRectangles(viewportBounds: ViewportBounds): void {
    this.visibleRectangles.clear()
    
    // Only create rectangles for the exact viewport bounds (no buffer initially)
    console.log('🔧 Creating rectangles for initial viewport bounds:', viewportBounds)
    console.log('🔧 Grid dimensions:', viewportBounds.maxX - viewportBounds.minX + 1, 'x', viewportBounds.maxY - viewportBounds.minY + 1)
    for (let y = viewportBounds.minY; y <= viewportBounds.maxY; y++) {
      for (let x = viewportBounds.minX; x <= viewportBounds.maxX; x++) {
        const rectangleId = `square-${x}-${y}`
        const fillR = Math.floor(Math.random() * 256)
        const fillG = Math.floor(Math.random() * 256)
        const fillB = Math.floor(Math.random() * 256)
        
        this.visibleRectangles.set(rectangleId, {
          worldX: x,
          worldY: y,
          rectangleId,
          fillR,
          fillG,
          fillB,
          isNew: false
        })
        
        // Debug first few rectangles
        if (this.visibleRectangles.size <= 10) {
          console.log('🔧 Created rectangle:', {
            rectangleId,
            worldX: x,
            worldY: y,
            fillR,
            fillG,
            fillB
          })
        }
        
        // Debug grid structure
        if (this.visibleRectangles.size === 1) {
          console.log('🔧 First rectangle at:', x, y)
        }
        if (this.visibleRectangles.size === 25) {
          console.log('🔧 25th rectangle at:', x, y)
        }
        if (this.visibleRectangles.size === 50) {
          console.log('🔧 50th rectangle at:', x, y)
        }
      }
    }

    console.log(`📊 Initialized ${this.visibleRectangles.size} visible rectangles`)
  }

  // Load curve data for all visible rectangles
  async loadCurveData(curveId: string): Promise<void> {
    if (this.visibleRectangles.size === 0) {
      console.warn('⚠️ No visible rectangles to load curve data for')
      return
    }

    // Get bounds of visible rectangles
    const bounds = this.getVisibleBounds()
    
    try {
      // Call API to get curve data for the entire visible area
      const response = await fetch(`${this.apiUrl}/api/curves/${curveId}/process?x=${bounds.minX}&y=${bounds.minY}&x2=${bounds.maxX}&y2=${bounds.maxY}`)
      const data = await response.json()
      
      // Update visible rectangles with curve data
      this.updateWithCurveData(data)
      
      console.log(`✅ Loaded curve data for ${this.visibleRectangles.size} visible rectangles`)
    } catch (error) {
      console.error('❌ Failed to load curve data:', error)
    }
  }

  // Update visible rectangles with curve data from API
  private updateWithCurveData(data: any): void {
    const curveName = Object.keys(data)[0]
    if (!data[curveName]) return

    const curveData = data[curveName]
    
    // Update each visible rectangle with its curve data
    for (const [rectangleId, rectangle] of this.visibleRectangles) {
      const key = `${rectangle.worldX},${rectangle.worldY}`
      if (curveData[key]) {
        rectangle.curveValue = curveData[key].value
        rectangle.indexPosition = curveData[key].index
      }
    }
  }

  // Check if viewport needs expansion/contraction and update accordingly
  async updateViewportBounds(newViewportBounds: ViewportBounds, curveId?: string): Promise<void> {
    const currentBounds = this.getVisibleBounds()
    
    // Check if we need to add rectangles (not enough buffer)
    const needsExpansion = 
      newViewportBounds.minX < currentBounds.minX + this.bufferSize ||
      newViewportBounds.maxX > currentBounds.maxX - this.bufferSize ||
      newViewportBounds.minY < currentBounds.minY + this.bufferSize ||
      newViewportBounds.maxY > currentBounds.maxY - this.bufferSize

    // Check if we need to remove rectangles (too much buffer)
    const needsContraction = 
      newViewportBounds.minX > currentBounds.minX + this.bufferSize * 2 ||
      newViewportBounds.maxX < currentBounds.maxX - this.bufferSize * 2 ||
      newViewportBounds.minY > currentBounds.minY + this.bufferSize * 2 ||
      newViewportBounds.maxY < currentBounds.maxY - this.bufferSize * 2

    if (needsExpansion) {
      console.log('📈 Expanding viewport - adding new rectangles')
      await this.expandViewport(newViewportBounds, curveId)
    } else if (needsContraction) {
      console.log('📉 Contracting viewport - removing excess rectangles')
      this.contractViewport(newViewportBounds)
    } else {
      console.log('✅ Viewport bounds are optimal - no changes needed')
    }
  }

  // Expand viewport by adding new rectangles
  private async expandViewport(newBounds: ViewportBounds, curveId?: string): Promise<void> {
    const currentBounds = this.getVisibleBounds()
    const newRectangles: VisibleRectangle[] = []

    // Add buffer to the new bounds
    const expandedBounds = {
      minX: newBounds.minX - this.bufferSize,
      maxX: newBounds.maxX + this.bufferSize,
      minY: newBounds.minY - this.bufferSize,
      maxY: newBounds.maxY + this.bufferSize
    }

    // Add rectangles for new areas (including buffer)
    for (let y = expandedBounds.minY; y <= expandedBounds.maxY; y++) {
      for (let x = expandedBounds.minX; x <= expandedBounds.maxX; x++) {
        const rectangleId = `square-${x}-${y}`
        
        // Skip if already exists
        if (this.visibleRectangles.has(rectangleId)) continue

        const fillR = Math.floor(Math.random() * 256)
        const fillG = Math.floor(Math.random() * 256)
        const fillB = Math.floor(Math.random() * 256)
        
        const newRectangle: VisibleRectangle = {
          worldX: x,
          worldY: y,
          rectangleId,
          fillR,
          fillG,
          fillB,
          isNew: true
        }

        this.visibleRectangles.set(rectangleId, newRectangle)
        newRectangles.push(newRectangle)
      }
    }

    if (newRectangles.length > 0) {
      console.log(`📈 Added ${newRectangles.length} new rectangles to viewport`)
      
      // Load curve data for new rectangles if curve is loaded
      if (curveId) {
        await this.loadCurveDataForNewRectangles(newRectangles, curveId)
      }
    }
  }

  // Contract viewport by removing excess rectangles
  private contractViewport(newBounds: ViewportBounds): void {
    const rectanglesToRemove: string[] = []

    for (const [rectangleId, rectangle] of this.visibleRectangles) {
      if (rectangle.worldX < newBounds.minX || 
          rectangle.worldX > newBounds.maxX ||
          rectangle.worldY < newBounds.minY || 
          rectangle.worldY > newBounds.maxY) {
        rectanglesToRemove.push(rectangleId)
      }
    }

    rectanglesToRemove.forEach(id => this.visibleRectangles.delete(id))
    
    if (rectanglesToRemove.length > 0) {
      console.log(`📉 Removed ${rectanglesToRemove.length} rectangles from viewport`)
    }
  }

  // Load curve data specifically for new rectangles
  private async loadCurveDataForNewRectangles(newRectangles: VisibleRectangle[], curveId: string): Promise<void> {
    if (newRectangles.length === 0) return

    // Group new rectangles by edge for efficient API calls
    const edges = this.groupRectanglesByEdge(newRectangles)
    
    // Make API calls for each edge that has new rectangles
    for (const [edge, rectangles] of Object.entries(edges)) {
      if (rectangles.length > 0) {
        const bounds = this.getBoundsForRectangles(rectangles)
        await this.fetchCurveDataForBounds(bounds, curveId, rectangles)
      }
    }
  }

  // Group rectangles by which edge they're on
  private groupRectanglesByEdge(rectangles: VisibleRectangle[]): Record<string, VisibleRectangle[]> {
    const currentBounds = this.getVisibleBounds()
    const edges: Record<string, VisibleRectangle[]> = {
      top: [],
      bottom: [],
      left: [],
      right: []
    }

    for (const rect of rectangles) {
      if (rect.worldY === currentBounds.minY) edges.top.push(rect)
      if (rect.worldY === currentBounds.maxY) edges.bottom.push(rect)
      if (rect.worldX === currentBounds.minX) edges.left.push(rect)
      if (rect.worldX === currentBounds.maxX) edges.right.push(rect)
    }

    return edges
  }

  // Get bounds for a set of rectangles
  private getBoundsForRectangles(rectangles: VisibleRectangle[]): ViewportBounds {
    const xs = rectangles.map(r => r.worldX)
    const ys = rectangles.map(r => r.worldY)
    
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    }
  }

  // Fetch curve data for specific bounds
  private async fetchCurveDataForBounds(bounds: ViewportBounds, curveId: string, targetRectangles: VisibleRectangle[]): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/api/curves/${curveId}/process?x=${bounds.minX}&y=${bounds.minY}&x2=${bounds.maxX}&y2=${bounds.maxY}`)
      const data = await response.json()
      
      const curveName = Object.keys(data)[0]
      if (!data[curveName]) return

      const curveData = data[curveName]
      
      // Update target rectangles with curve data
      for (const rectangle of targetRectangles) {
        const key = `${rectangle.worldX},${rectangle.worldY}`
        if (curveData[key]) {
          rectangle.curveValue = curveData[key].value
          rectangle.indexPosition = curveData[key].index
        }
      }
    } catch (error) {
      console.error('❌ Failed to fetch curve data for bounds:', error)
    }
  }

  // Update colors for all visible rectangles
  updateColors(colorMode: 'value' | 'index', spectrum: number, curveWidth: number): void {
    for (const rectangle of this.visibleRectangles.values()) {
      let colorValue: number

      if (colorMode === 'value' && rectangle.curveValue !== undefined) {
        colorValue = rectangle.curveValue
      } else if (colorMode === 'index' && rectangle.indexPosition !== undefined) {
        colorValue = (rectangle.indexPosition / curveWidth) * spectrum
      } else {
        colorValue = Math.random() * spectrum
      }

      // Map to RGB (grayscale for now)
      const rgbValue = Math.floor((colorValue / spectrum) * 255)
      rectangle.fillR = rgbValue
      rectangle.fillG = rgbValue
      rectangle.fillB = rgbValue
    }
  }

  // Get all visible rectangles
  getAllVisibleRectangles(): Map<string, VisibleRectangle> {
    console.log('📊 getAllVisibleRectangles called, returning', this.visibleRectangles.size, 'rectangles')
    return new Map(this.visibleRectangles)
  }

  // Get visible bounds
  private getVisibleBounds(): ViewportBounds {
    if (this.visibleRectangles.size === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
    }

    const xs = Array.from(this.visibleRectangles.values()).map(r => r.worldX)
    const ys = Array.from(this.visibleRectangles.values()).map(r => r.worldY)
    
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    }
  }

  // Get rectangle data by ID
  getRectangleData(rectangleId: string): VisibleRectangle | undefined {
    return this.visibleRectangles.get(rectangleId)
  }

  // Clear all data
  clear(): void {
    this.visibleRectangles.clear()
  }

  // Get count of visible rectangles
  getCount(): number {
    return this.visibleRectangles.size
  }
}

export default new VisibleRectanglesService()
export type { VisibleRectangle, ViewportBounds }
