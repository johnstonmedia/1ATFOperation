import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 1ATF Operation portal — Vite config.
// `base` is injected by the GitHub Pages workflow (VITE_BASE=/<repo>/) so asset
// URLs resolve under the project-pages subpath. Defaults to '/' for local dev.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
})
