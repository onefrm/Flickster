export class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new RequestError(response.status, body.message ?? 'The film service is unavailable. Please try again.')
  }
  return response.json() as Promise<T>
}

export function loadBackdrop(url: string): Promise<boolean> {
  return new Promise(resolve => {
    const image = new Image()
    const timeout = window.setTimeout(() => finish(false), 8000)
    function finish(success: boolean) {
      window.clearTimeout(timeout)
      image.onload = image.onerror = null
      resolve(success)
    }
    image.onload = () => finish(true)
    image.onerror = () => finish(false)
    image.src = url
  })
}
