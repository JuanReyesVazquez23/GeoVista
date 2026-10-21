import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Proxy /api -> backend ASP.NET Core en desarrollo.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5028',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    // Sin manualChunks: Rolldown agrupa three.js y framer-motion en los chunks
    // de sus imports dinámicos (globo y modal). Un manualChunks que compartía
    // React metía el globo en el grafo del entry y se descargaba también en móvil.
  },
})
