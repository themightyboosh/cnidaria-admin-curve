import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    port: 5173,
    host: true,
    open: true, // Automatically open browser
    strictPort: true, // Fail if port is already in use
    fs: {
      // Restrict file serving to project directory only
      allow: ['.'],
      // Deny access to parent directories
      deny: ['..']
    }
  },
  // Prevent Vite from looking outside the project
  optimizeDeps: {
    entries: ['src/main.tsx'], // Only scan project entry points
    include: [], // Don't auto-include external dependencies
    exclude: [] // Exclude any problematic packages
  },
  // Ensure project isolation
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'), // Local alias only
    }
  },
  // Cache configuration for better isolation
  cacheDir: '.vite', // Local cache directory
  // Environment variables
  define: {
    __PROJECT_NAME__: JSON.stringify('cnidaria-admin-curve'),
    __PROJECT_ROOT__: JSON.stringify(__dirname)
  }
})
