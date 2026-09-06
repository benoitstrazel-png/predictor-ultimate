import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  json: {
    stringify: true,
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('recharts')) {
              return 'vendor-recharts';
            }
            return 'vendor-misc';
          }
          if (id.includes('src/data/app_data.json')) {
            return 'data-app-data';
          }
          if (id.includes('compiled/analytics_cache.json')) {
            return 'data-analytics';
          }
          if (id.includes('src/data/squads/')) {
            return 'data-squads';
          }
          if (id.includes('src/data/players') || id.includes('compiled/players_master_registry.json')) {
            return 'data-players';
          }
        },
      },
    },
  },
})
