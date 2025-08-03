import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/lib': resolve(__dirname, 'src/lib'),
      '@/components': resolve(__dirname, 'src/components')
    }
  },
  server: {
    port: 5173,
    open: true
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'spotify': ['src/lib/spotify/api.ts'],
          'visualizer': ['src/lib/visualizer/EnergyVisualizer.ts']
        }
      }
    }
  }
})