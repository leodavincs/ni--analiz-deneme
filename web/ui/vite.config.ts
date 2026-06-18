import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Geliştirmede /api isteklerini Flask'a (8000) proxy'le.
// Üretimde Flask zaten dist'i kendisi servis eder, proxy gerekmez.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    outDir: 'dist',
  },
})
