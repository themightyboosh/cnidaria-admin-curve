# Cnidaria Admin Curves

A React-based admin tool for managing and visualizing "Cnidaria" curves, built with TypeScript and Vite. This tool connects to the cnidaria-api backend to display dynamic grids and visualize curve data with real-time mathematical processing. This is part of the Cnidaria Admin suite of tools.

## Features

- **Dynamic Grid System**: Interactive grid with zoomable cells (8x8px to 150x150px)
- **Curve Management**: Load and visualize curves from the cnidaria-api
- **Real-time Processing**: Mathematical coordinate processing with live updates
- **Modern UI**: Minimalist dark theme inspired by "Huge" design principles
- **Responsive Layout**: Fixed header, left pane, and liquid canvas area
- **Performance Optimized**: Background caching and debounced coordinate processing

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: CSS with custom dark theme
- **Fonts**: Google Fonts "Gothic A1"
- **Backend**: cnidaria-api (Google Cloud Functions)

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The development server will start at `http://localhost:5173/`

## Project Structure

```
cnidaria-admin-curve/
├── src/
│   ├── App.tsx              # Main application component
│   ├── App.css              # Application styles
│   ├── main.tsx             # Application entry point
│   ├── components/          # Reusable components
│   │   ├── Header.tsx       # Header component with logo
│   │   └── Header.css       # Header styles
│   └── services/
│       └── apiService.ts    # API communication service
├── public/                  # Static assets
├── index.html               # Main HTML file
├── package.json             # Project dependencies
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration
├── Dockerfile               # Docker configuration for deployment
├── nginx.conf               # Nginx configuration
├── deploy-google.sh         # Google Cloud deployment script
└── deploy-google-admin-curves.sh # Updated deployment script for cnidaria-admin-curves
```

## UI Layout

- **Header**: Fixed height (150px) with project title
- **Left Pane**: Fixed width (400px) containing curve selector and info
- **Canvas Area**: Liquid width for the interactive grid
- **Grid**: Centered at (0,0) with coordinate-based cell positioning

## Grid Features

- **Scaling**: Option key + scroll to resize cells (8x8px to 150x150px)
- **Centering**: Grid always scales from center (0,0) point
- **Coordinates**: Each cell has associated coordinates (not displayed)
- **Coloring**: Cells colored based on curve index values (0-255 hue)

## Curve Integration

- **Loading**: Dropdown to select from available curves via API
- **Processing**: Automatic coordinate processing for visible grid cells
- **Caching**: Background caching for performance optimization
- **Real-time**: New visible cells processed immediately on zoom/move

## Deployment

### Google Cloud Run
```bash
# Deploy to Google Cloud (legacy)
./deploy-google.sh

# Deploy to Google Cloud (recommended for cnidaria-admin-curves structure)
./deploy-google-admin-curves.sh
```

**Note**: When deploying to production, this application should be placed in a folder called `cnidaria-admin-curves` to integrate with the broader admin tool suite.

### Docker
```bash
# Build Docker image
docker build -t cnidaria-admin-curve .

# Run locally
docker run -p 8080:80 cnidaria-admin-curve
```

## Configuration

The tool connects to the cnidaria-api backend. Ensure the API is running and accessible at the configured endpoint.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of the New Cnidaria workspace and follows the same licensing terms.

---

**Built with ❤️ for the New Cnidaria project**
