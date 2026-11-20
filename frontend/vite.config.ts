import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config. Nothing fancy: React plugin only.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // Read .env from the repo root, so there is ONE .env file for the whole project.
  // Only variables starting with VITE_ reach the browser, so the service-role key stays private.
  envDir: '..',
})
