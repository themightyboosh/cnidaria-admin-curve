# Admin Curve Tool

A React-based admin tool for managing and visualizing "Cnidaria" curves, hosted on Google Cloud.

## Features

- Dynamic grid visualization with customizable cell sizes
- Real-time curve data processing
- Integration with Cnidaria API
- Responsive design with dark theme
- Progress indicators and error handling

## Development

```bash
npm install
npm run dev
```

## Building for Production

```bash
npm run build
```

## Deployment

Use the provided deployment scripts for Google Cloud Run:

```bash
./deploy-google.sh
```

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Cnidaria API (Google Cloud Functions)
- **Styling**: CSS with Gothic A1 font
- **Deployment**: Docker + Google Cloud Run
