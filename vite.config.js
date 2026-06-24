import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 1ATF Operation portal — Vite config
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
})
