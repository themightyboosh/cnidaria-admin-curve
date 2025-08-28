/**
 * Grid Visualizer for Mathematical Pipeline Results
 * Renders grids showing index positions as grayscale and curve values as hue colors
 */

class GridVisualizer {
  constructor() {
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m'
    };
  }

  /**
   * Convert index position to grayscale (0-255)
   * @param {number} index - Index position
   * @param {number} maxIndex - Maximum index value
   * @returns {number} Grayscale value 0-255
   */
  indexToGrayscale(index, maxIndex) {
    return Math.floor((index / maxIndex) * 255);
  }

  /**
   * Convert curve value to hue (0-360 degrees)
   * @param {number} value - Curve value (0-255)
   * @returns {number} Hue value 0-360
   */
  valueToHue(value) {
    // Map 0-255 to 0-360 (full color spectrum)
    return (value / 255) * 360;
  }

  /**
   * Convert hue to RGB for terminal display
   * @param {number} h - Hue (0-360)
   * @returns {Object} RGB values
   */
  hueToRGB(h) {
    // Normalize hue to 0-1
    h = h / 360;
    
    let r, g, b;
    
    if (h < 1/6) {
      r = 1; g = h * 6; b = 0;
    } else if (h < 2/6) {
      r = (2/6 - h) * 6; g = 1; b = 0;
    } else if (h < 3/6) {
      r = 0; g = 1; b = (h - 2/6) * 6;
    } else if (h < 4/6) {
      r = 0; g = (4/6 - h) * 6; b = 1;
    } else if (h < 5/6) {
      r = (h - 4/6) * 6; g = 0; b = 1;
    } else {
      r = 1; g = 0; b = (1 - h) * 6;
    }
    
    return {
      r: Math.floor(r * 255),
      g: Math.floor(g * 255),
      b: Math.floor(b * 255)
    };
  }

  /**
   * Get terminal color code for RGB values
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @returns {string} Terminal color code
   */
  getTerminalColor(r, g, b) {
    // Simple mapping to terminal colors for now
    // In a real implementation, you'd use 256-color or true color support
    const brightness = (r + g + b) / 3;
    
    if (brightness < 64) return this.colors.dim;
    if (brightness < 128) return this.colors.blue;
    if (brightness < 192) return this.colors.green;
    return this.colors.bright;
  }

  /**
   * Render grid showing index positions as grayscale
   * @param {Array} results - Array of coordinate results
   * @param {number} x1 - Grid start X
   * @param {number} y1 - Grid start Y
   * @param {number} x2 - Grid end X
   * @param {number} y2 - Grid end Y
   * @param {string} title - Grid title
   */
  renderIndexGrid(results, x1, y1, x2, y2, title = 'Index Position Grid') {
    const width = x2 - x1 + 1;
    const height = y2 - y1 + 1;
    
    console.log(`\n📊 ${title}`);
    console.log(`📍 Grid: (${x1}, ${y1}) to (${x2}, ${y2})`);
    console.log(`📐 Size: ${width} x ${height} = ${width * height} cells`);
    console.log(`🎯 Center: (0, 0) is at the middle of the grid`);
    console.log(`🎨 Grayscale: Index position as percentage of curve width`);
    console.log(`   █ = High index, ░ = Low index, ▒ = Medium index`);
    console.log(`\n`);

    // Create a 2D array to store results
    const grid = Array(height).fill().map(() => Array(width).fill(null));
    
    // Populate grid with results
    results.forEach(result => {
      // Convert world coordinates to grid coordinates with (0,0) at center
      const gridX = result.coordinates.x - x1;
      const gridY = result.coordinates.y - y1;
      
      if (gridX >= 0 && gridX < width && gridY >= 0 && gridY < height) {
        grid[gridY][gridX] = result;
      }
    });

    // Render grid
    for (let y = 0; y < height; y++) {
      let row = '';
      
      for (let x = 0; x < width; x++) {
        const cell = grid[y][x];
        
        if (cell && cell.success) {
          const index = cell.result.finalIndex;
          const maxIndex = cell.mathematicalPipeline.finalIndex; // This should be curve width - 1
          const grayscale = this.indexToGrayscale(index, maxIndex);
          
          // Map grayscale to terminal characters
          let char;
          if (grayscale < 64) char = '░';      // Light (low index)
          else if (grayscale < 128) char = '▒'; // Medium
          else if (grayscale < 192) char = '▓'; // Dark
          else char = '█';                      // Solid (high index)
          
          row += char;
        } else {
          row += '·'; // Empty cell
        }
      }
      
      console.log(`${row}  Y=${y1 + y}`);
    }
    
    // X-axis labels
    let xLabels = '';
    for (let x = 0; x < width; x++) {
      xLabels += `${x % 10}`;
    }
    console.log(`\n${xLabels}  X-axis`);
    
    // Legend
    console.log(`\n📊 Legend:`);
    console.log(`   █ = High index (75-100% of curve width)`);
    console.log(`   ▓ = High-medium index (50-75% of curve width)`);
    console.log(`   ▒ = Medium index (25-50% of curve width)`);
    console.log(`   ░ = Low index (0-25% of curve width)`);
    console.log(`   · = No data`);
  }

  /**
   * Render grid showing curve values as hue colors
   * @param {Array} results - Array of coordinate results
   * @param {number} x1 - Grid start X
   * @param {number} y1 - Grid start Y
   * @param {number} x2 - Grid end X
   * @param {number} y2 - Grid end Y
   * @param {string} title - Grid title
   */
  renderValueGrid(results, x1, y1, x2, y2, title = 'Curve Value Grid') {
    const width = x2 - x1 + 1;
    const height = y2 - y1 + 1;
    
    console.log(`\n🎨 ${title}`);
    console.log(`📍 Grid: (${x1}, ${y1}) to (${x2}, ${y2})`);
    console.log(`📐 Size: ${width} x ${height} = ${width * height} cells`);
    console.log(`🌈 Colors: Curve values mapped to hue spectrum (0-255)`);
    console.log(`   🔴 = Low values, 🟡 = Medium values, 🔵 = High values`);
    console.log(`\n`);

    // Create a 2D array to store results
    const grid = Array(height).fill().map(() => Array(width).fill(null));
    
    // Populate grid with results
    results.forEach(result => {
      const gridX = result.coordinates.x - x1;
      const gridY = result.coordinates.y - y1;
      
      if (gridX >= 0 && gridX < width && gridY >= 0 && gridY < height) {
        grid[gridY][gridX] = result;
      }
    });

    // Render grid
    for (let y = 0; y < height; y++) {
      let row = '';
      
      for (let x = 0; x < width; x++) {
        const cell = grid[y][x];
        
        if (cell && cell.success) {
          const value = cell.result.terrainValue;
          const hue = this.valueToHue(value);
          
          // Map hue to color characters
          let char;
          if (hue < 60) char = '🔴';      // Red (0-60°)
          else if (hue < 120) char = '🟠'; // Orange (60-120°)
          else if (hue < 180) char = '🟡'; // Yellow (120-180°)
          else if (hue < 240) char = '🟢'; // Green (180-240°)
          else if (hue < 300) char = '🔵'; // Blue (240-300°)
          else char = '🟣';                // Purple (300-360°)
          
          row += char;
        } else {
          row += '⬜'; // Empty cell
        }
      }
      
      console.log(`${row}  Y=${y1 + y}`);
    }
    
    // X-axis labels
    let xLabels = '';
    for (let x = 0; x < width; x++) {
      xLabels += `${x % 10}`;
    }
    console.log(`\n${xLabels}  X-axis`);
    
    // Legend
    console.log(`\n🎨 Legend:`);
    console.log(`   🔴 = Low values (0-42) - Red spectrum`);
    console.log(`   🟠 = Low-medium values (43-85) - Orange spectrum`);
    console.log(`   🟡 = Medium values (86-128) - Yellow spectrum`);
    console.log(`   🟢 = Medium-high values (129-171) - Green spectrum`);
    console.log(`   🔵 = High values (172-213) - Blue spectrum`);
    console.log(`   🟣 = Very high values (214-255) - Purple spectrum`);
    console.log(`   ⬜ = No data`);
  }

  /**
   * Render both grids side by side for comparison
   * @param {Array} results - Array of coordinate results
   * @param {number} x1 - Grid start X
   * @param {number} y1 - Grid start Y
   * @param {number} x2 - Grid end X
   * @param {number} y2 - Grid end Y
   * @param {string} title - Grid title
   */
  renderComparisonGrids(results, x1, y1, x2, y2, title = 'Grid Comparison') {
    const width = x2 - x1 + 1;
    const height = y2 - y1 + 1;
    
    console.log(`\n🔄 ${title}`);
    console.log(`📍 Grid: (${x1}, ${y1}) to (${x2}, ${y2})`);
    console.log(`📐 Size: ${width} x ${height} = ${width * height} cells`);
    console.log(`\n`);

    // Create a 2D array to store results
    const grid = Array(height).fill().map(() => Array(width).fill(null));
    
    // Populate grid with results
    results.forEach(result => {
      const gridX = result.coordinates.x - x1;
      const gridY = result.coordinates.y - y1;
      
      if (gridX >= 0 && gridX < width && gridY >= 0 && gridY < height) {
        grid[gridY][gridX] = result;
      }
    });

    // Render both grids side by side
    for (let y = 0; y < height; y++) {
      let indexRow = '';
      let valueRow = '';
      
      for (let x = 0; x < width; x++) {
        const cell = grid[y][x];
        
        if (cell && cell.success) {
          // Index grid (grayscale)
          const index = cell.result.finalIndex;
          const maxIndex = cell.mathematicalPipeline.finalIndex;
          const grayscale = this.indexToGrayscale(index, maxIndex);
          
          let indexChar;
          if (grayscale < 64) indexChar = '░';
          else if (grayscale < 128) indexChar = '▒';
          else if (grayscale < 192) indexChar = '▓';
          else indexChar = '█';
          
          indexRow += indexChar;
          
          // Value grid (hue colors)
          const value = cell.result.terrainValue;
          const hue = this.valueToHue(value);
          
          let valueChar;
          if (hue < 60) valueChar = '🔴';
          else if (hue < 120) valueChar = '🟠';
          else if (hue < 180) valueChar = '🟡';
          else if (hue < 240) valueChar = '🟢';
          else if (hue < 300) valueChar = '🔵';
          else valueChar = '🟣';
          
          valueRow += valueChar;
        } else {
          indexRow += '·';
          valueRow += '⬜';
        }
      }
      
      console.log(`${indexRow} | ${valueRow}  Y=${y1 + y}`);
    }
    
    // X-axis labels
    let xLabels = '';
    for (let x = 0; x < width; x++) {
      xLabels += `${x % 10}`;
    }
    console.log(`\n${xLabels} | ${xLabels}  X-axis`);
    
    // Legend
    console.log(`\n📊 Comparison Legend:`);
    console.log(`   Left: Index Position (Grayscale)  |  Right: Curve Values (Hue Colors)`);
    console.log(`   Index: █▓▒░·  |  Values: 🔴🟠🟡🟢🔵🟣⬜`);
  }

  /**
   * Generate HTML visualization for web viewing
   * @param {Array} results - Array of coordinate results
   * @param {number} x1 - Grid start X
   * @param {number} y1 - Grid start Y
   * @param {number} x2 - Grid end X
   * @param {number} y2 - Grid end Y
   * @param {string} title - Grid title
   * @returns {string} HTML string
   */
  generateHTMLVisualization(results, x1, y1, x2, y2, title = 'Grid Visualization') {
    const width = x2 - x1 + 1;
    const height = y2 - y1 + 1;
    
    // Calculate center coordinates
    const centerX = Math.floor((x1 + x2) / 2);
    const centerY = Math.floor((y1 + y2) / 2);
    
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 20px; 
            background: linear-gradient(135deg, #1a1a2e, #16213e); 
            color: white; 
            min-height: 100vh;
        }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #4ecdc4; margin-bottom: 10px; }
        .grid-container { 
            display: flex; 
            gap: 40px; 
            margin: 20px 0; 
            justify-content: center;
            flex-wrap: wrap;
        }
        .grid { 
            border: 2px solid #4ecdc4; 
            padding: 20px; 
            background: rgba(0, 0, 0, 0.8); 
            border-radius: 10px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        .grid-title { 
            text-align: center; 
            margin-bottom: 15px; 
            font-weight: bold; 
            color: #4ecdc4;
            font-size: 18px;
        }
        .cell { 
            display: inline-block; 
            width: 25px; 
            height: 25px; 
            margin: 1px; 
            border: 1px solid rgba(255, 255, 255, 0.1); 
            border-radius: 3px;
            transition: all 0.2s ease;
            cursor: pointer;
        }
        .cell:hover {
            transform: scale(1.1);
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
            z-index: 10;
        }
        .legend { 
            margin-top: 30px; 
            padding: 25px; 
            background: rgba(34, 34, 34, 0.9); 
            border-radius: 10px;
            border: 1px solid #4ecdc4;
            max-width: 800px;
            margin-left: auto;
            margin-right: auto;
        }
        .legend h3 { color: #4ecdc4; margin-bottom: 20px; text-align: center; }
        .legend-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .legend-item { 
            display: flex; 
            align-items: center; 
            margin: 10px 0;
            padding: 10px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 5px;
        }
        .legend-color { 
            display: inline-block; 
            width: 25px; 
            height: 25px; 
            border: 2px solid rgba(255, 255, 255, 0.3); 
            border-radius: 3px;
            margin-right: 15px;
        }
        .info { 
            background: rgba(51, 51, 51, 0.9); 
            padding: 20px; 
            border-radius: 10px; 
            margin: 20px auto; 
            max-width: 800px;
            border: 1px solid #4ecdc4;
            text-align: center;
        }
        .coordinate-info {
            background: rgba(78, 205, 196, 0.1);
            padding: 15px;
            border-radius: 8px;
            margin: 20px auto;
            max-width: 600px;
            text-align: center;
            border: 1px solid rgba(78, 205, 196, 0.3);
        }
        .coordinate-info h3 { color: #4ecdc4; margin-bottom: 10px; }
        .coordinate-grid {
            display: inline-grid;
            grid-template-columns: repeat(${width}, 25px);
            gap: 1px;
            margin: 20px 0;
            padding: 20px;
            background: rgba(0, 0, 0, 0.5);
            border-radius: 8px;
        }
        .coordinate-cell {
            width: 25px;
            height: 25px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            color: rgba(255, 255, 255, 0.7);
        }
        .center-cell {
            background: #ff6b6b !important;
            color: white !important;
            border: 2px solid #ff6b6b !important;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧮 ${title}</h1>
        <p>Mathematical Pipeline Visualization with Centered Coordinate System</p>
    </div>
    
    <div class="info">
        <strong>Grid Range:</strong> (${x1}, ${y1}) to (${x2}, ${y2})<br>
        <strong>Grid Size:</strong> ${width} × ${height} = ${width * height} cells<br>
        <strong>Center Point:</strong> (${centerX}, ${centerY})<br>
        <strong>Processed Coordinates:</strong> ${results.length}
    </div>
    
    <div class="coordinate-info">
        <h3>🎯 Coordinate System</h3>
        <p><strong>(0, 0) is at the center of the grid</strong> - This shows how the mathematical pipeline processes coordinates relative to the origin</p>
        <div class="coordinate-grid">
            ${this.generateCoordinateGridHTML(width, height, x1, y1, x2, y2)}
        </div>
    </div>
    
    <div class="grid-container">
        <div class="grid">
            <div class="grid-title">📊 Index Position (Grayscale)</div>
            <div id="index-grid"></div>
        </div>
        <div class="grid">
            <div class="grid-title">🎨 Curve Values (Hue Colors)</div>
            <div id="value-grid"></div>
        </div>
    </div>
    
    <div class="legend">
        <h3>📖 Visualization Legend</h3>
        <div class="legend-grid">
            <div>
                <h4 style="color: #4ecdc4; margin-bottom: 15px;">Index Position (Left Grid)</h4>
                <div class="legend-item">
                    <span class="legend-color" style="background: #000"></span> Low Index (0-25% of curve width)
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background: #666"></span> Medium Index (25-50% of curve width)
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background: #ccc"></span> High-Medium Index (50-75% of curve width)
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background: #fff"></span> High Index (75-100% of curve width)
                </div>
            </div>
            <div>
                <h4 style="color: #4ecdc4; margin-bottom: 15px;">Curve Values (Right Grid)</h4>
                <div class="legend-item">
                    <span class="legend-color" style="background: #ff0000"></span> Low Values (0-42) - Red
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background: #ff8000"></span> Low-Medium (43-85) - Orange
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background: #ffff00"></span> Medium (86-128) - Yellow
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background: #00ff00"></span> Medium-High (129-171) - Green
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background: #0080ff"></span> High (172-213) - Blue
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background: #8000ff"></span> Very High (214-255) - Purple
                </div>
            </div>
        </div>
    </div>
    
    <script>
        const results = ${JSON.stringify(results)};
        const gridWidth = ${width};
        const gridHeight = ${height};
        const x1 = ${x1};
        const y1 = ${y1};
        const centerX = ${centerX};
        const centerY = ${centerY};
        
        function renderGrids() {
            const indexGrid = document.getElementById('index-grid');
            const valueGrid = document.getElementById('value-grid');
            
            // Clear existing content
            indexGrid.innerHTML = '';
            valueGrid.innerHTML = '';
            
            // Create 2D grid
            const grid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(null));
            
            // Populate grid with results
            results.forEach(result => {
                const gridX = result.coordinates.x - x1;
                const gridY = result.coordinates.y - y1;
                
                if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
                    grid[gridY][gridX] = result;
                }
            });
            
            // Render index grid
            for (let y = 0; y < gridHeight; y++) {
                const row = document.createElement('div');
                row.style.marginBottom = '1px';
                
                for (let x = 0; x < gridWidth; x++) {
                    const cell = grid[y][x];
                    const cellDiv = document.createElement('div');
                    cellDiv.className = 'cell';
                    
                    if (cell && cell.success) {
                        const index = cell.result.finalIndex;
                        const maxIndex = cell.mathematicalPipeline.finalIndex;
                        const grayscale = Math.floor((index / maxIndex) * 255);
                        cellDiv.style.background = 'rgb(' + grayscale + ', ' + grayscale + ', ' + grayscale + ')';
                        cellDiv.title = 'World: (' + (x1 + x) + ', ' + (y1 + y) + ')\\nIndex: ' + index + '\\nGrayscale: ' + grayscale;
                    } else {
                        cellDiv.style.background = '#333';
                        cellDiv.title = 'World: (' + (x1 + x) + ', ' + (y1 + y) + ')\\nNo data';
                    }
                    
                    row.appendChild(cellDiv);
                }
                indexGrid.appendChild(row);
            }
            
            // Render value grid
            for (let y = 0; y < gridHeight; y++) {
                const row = document.createElement('div');
                row.style.marginBottom = '1px';
                
                for (let x = 0; x < gridWidth; x++) {
                    const cell = grid[y][x];
                    const cellDiv = document.createElement('div');
                    cellDiv.className = 'cell';
                    
                    if (cell && cell.success) {
                        const value = cell.result.terrainValue;
                        const hue = (value / 255) * 360;
                        cellDiv.style.background = 'hsl(' + hue + ', 100%, 50%)';
                        cellDiv.title = 'World: (' + (x1 + x) + ', ' + (y1 + y) + ')\\nValue: ' + value + '\\nHue: ' + hue.toFixed(1) + '°';
                    } else {
                        cellDiv.style.background = '#333';
                        cellDiv.title = 'World: (' + (x1 + x) + ', ' + (y1 + y) + ')\\nNo data';
                    }
                    
                    row.appendChild(cellDiv);
                }
                valueGrid.appendChild(row);
            }
        }
        
        renderGrids();
    </script>
</body>
</html>`;
    
    return html;
  }

  /**
   * Generate coordinate grid HTML for reference
   * @param {number} width - Grid width
   * @param {number} height - Grid height
   * @param {number} x1 - Grid start X
   * @param {number} y1 - Grid start Y
   * @param {number} x2 - Grid end X
   * @param {number} y2 - Grid end Y
   * @returns {string} HTML string for coordinate grid
   */
  generateCoordinateGridHTML(width, height, x1, y1, x2, y2) {
    let html = '';
    const centerX = Math.floor((x1 + x2) / 2);
    const centerY = Math.floor((y1 + y2) / 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const worldX = x1 + x;
        const worldY = y1 + y;
        const isCenter = (worldX === 0 && worldY === 0);
        
        html += '<div class="coordinate-cell ' + (isCenter ? 'center-cell' : '') + '" title="World: (' + worldX + ', ' + worldY + ')">';
        
        if (isCenter) {
          html += '0,0';
        } else {
          html += worldX + ',' + worldY;
        }
        
        html += '</div>';
      }
    }
    
    return html;
  }

  /**
   * Save HTML visualization to file
   * @param {Array} results - Array of coordinate results
   * @param {number} x1 - Grid start X
   * @param {number} y1 - Grid start Y
   * @param {number} x2 - Grid end X
   * @param {number} y2 - Grid end Y
   * @param {string} filename - Output filename
   * @param {string} title - Grid title
   */
  saveHTMLVisualization(results, x1, y1, x2, y2, filename = 'grid_visualization.html', title = 'Grid Visualization') {
    const fs = require('fs');
    const html = this.generateHTMLVisualization(results, x1, y1, x2, y2, title);
    
    try {
      fs.writeFileSync(filename, html);
      console.log(`\n💾 HTML visualization saved to: ${filename}`);
      console.log(`🌐 Open this file in a web browser to view the interactive visualization`);
    } catch (error) {
      console.error(`❌ Failed to save HTML file: ${error.message}`);
    }
  }
}

module.exports = new GridVisualizer();
