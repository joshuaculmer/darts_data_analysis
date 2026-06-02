import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// GitHub Pages serves a static file tree with no SPA rewrite, so a hard refresh
// of a client route like /trust 404s. Copying the built index.html to 404.html
// makes Pages serve the SPA shell for any unknown path, where BrowserRouter then
// resolves the route. Runs only on `vite build` (closeBundle).
function spa404Fallback() {
  return {
    name: 'spa-404-fallback',
    closeBundle() {
      const index = resolve(process.cwd(), 'dist', 'index.html')
      const fallback = resolve(process.cwd(), 'dist', '404.html')
      if (existsSync(index)) copyFileSync(index, fallback)
    },
  }
}

export default defineConfig({
  plugins: [react(), spa404Fallback()],
  server: {
    port: 5173,
    strictPort: false,
  },
  test: {
    environment: 'node',
  },
})
