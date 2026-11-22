import { createApi } from './api'

interface Env {
  TMDB_READ_ACCESS_TOKEN?: string
  ASSETS: { fetch(request: Request): Promise<Response> }
}
let api: ReturnType<typeof createApi> | undefined

export default {
  fetch(request: Request, env: Env) {
    if (!new URL(request.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    api ??= createApi(env.TMDB_READ_ACCESS_TOKEN)
    return api(request)
  },
}
