import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The API sets a Secure cookie; browsers accept it on http://localhost.
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: { sourcemap: false, target: 'es2022' },
})
