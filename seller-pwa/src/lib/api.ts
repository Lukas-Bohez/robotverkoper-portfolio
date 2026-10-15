import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'

/** An answer of the API that says no: a status, a stable code and a readable message */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** The seller API, from VITE_API_URL (never derived from the page address) */
export function apiBase(): string {
  return (import.meta.env.VITE_API_URL || 'http://localhost:4200').replace(/\/+$/, '')
}

async function readBody(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await response.json()) as Record<string, unknown> | null
  } catch {
    return null
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await useAuthStore().getIdToken()
  let response: Response
  try {
    response = await fetch(apiBase() + path, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'network', 'The API does not answer')
  }
  if (response.status === 204) return undefined as T
  const payload = await readBody(response)
  if (!response.ok) {
    throw new ApiError(
      response.status,
      typeof payload?.code === 'string' ? payload.code : 'unknown',
      typeof payload?.message === 'string' ? payload.message : response.statusText,
    )
  }
  return payload as T
}

/** Small wrapper so screens (and their tests) do not need fetch themselves */
export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  delete: (path: string) => request<void>('DELETE', path),
}

/**
 * A sentence for the person: the translation of the API's error code when we have one
 * (`apiErrors.<code>`), else the fallback of the screen.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const key = `apiErrors.${error.code}`
    if (i18n.global.te(key)) return i18n.global.t(key)
  }
  return fallback
}
