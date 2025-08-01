import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
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
          'spotify': ['src/lib/spotify/api.ts', 'src/lib/spotify/auth.ts'],
          'visualizer': ['src/lib/visualizer/canvas.ts', 'src/lib/visualizer/webgl.ts']
        }
      }
    }
  }
})