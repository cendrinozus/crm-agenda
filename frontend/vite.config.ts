import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_BASE est injecté par le Dockerfile lors du build prod (/agenda/)
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
