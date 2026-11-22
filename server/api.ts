import { createCatalogue, poolTtlSeconds } from './catalogue'
import { ApiError, createTmdb } from './tmdb'
import type { Pool } from '../shared/types'

export function createApi(token?: string, request = fetch) {
  const catalogue = createCatalogue(createTmdb(token, request))
  let pool: Pool | undefined
  let pending: Promise<Pool> | undefined

  function getPool(refresh: boolean) {
    if (pending) return pending
    if (!refresh && pool && Date.now() - pool.refreshedAt < poolTtlSeconds * 1000) return pool
    pending = catalogue.buildPool().then(value => (pool = value)).finally(() => { pending = undefined })
    return pending
  }

  return async (input: Request): Promise<Response> => {
    const { pathname, searchParams } = new URL(input.url)
    try {
      if (pathname === '/api/pool' && (input.method === 'GET' || input.method === 'POST')) {
        return Response.json(await getPool(input.method === 'POST'))
      }
      if (input.method !== 'GET') throw new ApiError(405, 'Method not allowed.')
      if (pathname === '/api/search') {
        const query = searchParams.get('q')?.trim().slice(0, 120) ?? ''
        return Response.json(query.length >= 2 ? await catalogue.search(query) : [])
      }
      const match = /^\/api\/film\/([1-9]\d{0,9})$/.exec(pathname)
      if (match) return Response.json(await catalogue.film(Number(match[1])))
      throw new ApiError(404, 'API route not found.')
    } catch (error) {
      const failure = error instanceof ApiError ? error : new ApiError(502, 'Film information is temporarily unavailable. Please try again.')
      return Response.json({ message: failure.message }, {
        status: failure.status,
        headers: failure.retryAfter ? { 'Retry-After': failure.retryAfter } : undefined,
      })
    }
  }
}
