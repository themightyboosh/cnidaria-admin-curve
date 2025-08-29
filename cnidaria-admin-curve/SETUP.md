# Cnidaria Admin Curve - Setup Instructions

This directory contains a **self-contained** React application for managing and visualizing mathematical curves.

## Quick Start

```bash
# Clone the repository (if needed)
git clone <repository-url>
cd cnidaria-admin-curve

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:5173
```

## Self-Contained Verification

This project is completely self-contained and includes:

✅ **All source files** in `src/`
✅ **All CSS files** (App.css, index.css, Header.css)
✅ **Complete package.json** with all dependencies
✅ **TypeScript configuration** files
✅ **Vite configuration**
✅ **Build and deployment scripts**

## Project Structure

```
cnidaria-admin-curve/
├── package.json          # Dependencies and scripts
├── index.html            # Entry HTML file
├── vite.config.ts        # Vite build configuration
├── src/
│   ├── App.tsx           # Main application component
│   ├── App.css           # Main app styles
│   ├── index.css         # Global styles
│   ├── main.tsx          # React entry point
│   ├── components/       # React components
│   ├── config/           # Environment configuration
│   ├── contexts/         # React contexts
│   └── pages/            # Page components
└── public/               # Static assets
```

## Features

- **Interactive Grid Canvas** - Visualize mathematical curves
- **Curve Management** - Select, edit, and process curves
- **Real-time API Integration** - Connect to cnidaria-api backend
- **Tag System** - Organize curves with tags
- **Responsive Design** - Works on desktop and mobile
- **Dark Theme** - Professional UI with Gothic A1 fonts

## API Configuration

The app automatically detects the environment and configures API endpoints:

- **Development**: `https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev`
- **Staging**: `https://us-central1-cnidaria-stage.cloudfunctions.net/cnidaria-api-stage`  
- **Production**: `https://us-central1-cnidaria-prod.cloudfunctions.net/cnidaria-api-prod`

## Build for Production

```bash
npm run build
npm run preview
```

## Deployment

Multiple deployment options available:
- Google Cloud Run (see deploy scripts)
- Docker (see Dockerfile)
- Static hosting (after build)

---

**Ready to run!** All dependencies and files are included.
