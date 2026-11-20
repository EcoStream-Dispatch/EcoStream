import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Settings from the repo-root .env (and the shell). Used here only for the dev proxy.
  const env = loadEnv(mode, '..', '')

  return {
    plugins: [react()],
    // Read .env from the repo root, so there is ONE .env file for the whole project.
    // Only variables starting with VITE_ reach the browser, so the service-role key stays private.
    envDir: '..',
    server: {
      port: 5173,
      // During `npm run dev`, send /api/* to the local FastAPI server (uvicorn on port 8000),
      // so the frontend can call "/api/..." exactly like it will on Vercel.
      proxy: {
        '/api': env.API_PROXY_TARGET || 'http://localhost:8000',
      },
    },
  }
})
