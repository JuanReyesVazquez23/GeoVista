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
    rollupOptions: {
      output: {
        // three.js va en su propio chunk con caché larga (además llega lazy).
        manualChunks(id: string) {
          if (id.includes('node_modules/three') || id.includes('react-globe')) return 'globe';
          if (id.includes('framer-motion')) return 'motion';
        },
      },
    },
  },
})
