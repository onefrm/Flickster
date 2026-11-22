import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { createApi } from './server/api'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'TMDB_')
  const api = createApi(env.TMDB_READ_ACCESS_TOKEN)
  return {
    plugins: [react(), {
      name: 'film-bingo-api',
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          if (!request.url?.startsWith('/api/')) return next()
          const result = await api(new Request(new URL(request.url, 'http://localhost'), { method: request.method }))
          response.writeHead(result.status, Object.fromEntries(result.headers))
          response.end(await result.text())
        })
      },
    }],
  }
})
