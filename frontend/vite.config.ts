import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development, the browser stays on Vite while API calls reach FastAPI.
// Docker builds serve the compiled app and API from one origin.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/analyze': 'http://127.0.0.1:8000',
      '/preview': 'http://127.0.0.1:8000',
      '/redact': 'http://127.0.0.1:8000',
      '/verify': 'http://127.0.0.1:8000',
      '/api/status': 'http://127.0.0.1:8000',
      '/handwriting-sample': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
    },
  },
})
