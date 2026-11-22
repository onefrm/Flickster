export class ApiError extends Error {
  constructor(public status: number, message: string, public retryAfter?: string) {
    super(message)
  }
}

export function createTmdb(token?: string, request = fetch) {
  return async function tmdb<T>(path: string, query: Record<string, string> = {}): Promise<T> {
    if (!token) throw new ApiError(503, 'TMDB access is not configured. Add TMDB_READ_ACCESS_TOKEN to the server environment and restart.')
    const url = new URL('https://api.themoviedb.org/3' + path)
    url.search = new URLSearchParams(query).toString()
    let response: Response
    try {
      response = await request(url, {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        signal: AbortSignal.timeout(12_000),
      })
    } catch {
      throw new ApiError(502, 'TMDB could not be reached. Please try again.')
    }
    if (response.status === 429) throw new ApiError(429, 'TMDB is rate limiting requests. Please wait and try again.', response.headers.get('Retry-After') ?? undefined)
    if (response.status === 401 || response.status === 403) throw new ApiError(503, 'TMDB rejected the server access token. Check TMDB_READ_ACCESS_TOKEN.')
    if (response.status === 404) throw new ApiError(404, 'TMDB could not find this film.')
    if (!response.ok) throw new ApiError(502, 'TMDB returned an error. Please try again.')
    return response.json() as Promise<T>
  }
}
