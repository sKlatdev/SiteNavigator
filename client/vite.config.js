import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: mode === 'e2e' ? 'http://127.0.0.1:8788' : 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
}))
