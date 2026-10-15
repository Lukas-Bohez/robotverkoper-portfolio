import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const token = vi.hoisted(() => ({ value: 'dev:docent@howest.be' as string | null }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ getIdToken: () => Promise.resolve(token.value) }) }))

const { api, ApiError, apiBase, apiErrorMessage } = await import('../api')
const { i18n } = await import('@/i18n')

function answer(status: number, body: unknown) {
  return Promise.resolve(
    new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  )
}

describe('api', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    token.value = 'dev:docent@howest.be'
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    i18n.global.locale.value = 'nl'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sends the login of the person along and reads the answer', async () => {
    fetchMock.mockReturnValue(answer(200, { items: [] }))
    expect(await api.get('/companies')).toEqual({ items: [] })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(`${apiBase()}/companies`)
    expect(init.headers.authorization).toBe('Bearer dev:docent@howest.be')
    expect(init.method).toBe('GET')
  })

  it('sends a JSON body with a post', async () => {
    fetchMock.mockReturnValue(answer(201, { id: '1' }))
    await api.post('/companies', { name: 'A' })
    const [, init] = fetchMock.mock.calls[0]!
    expect(init.headers['content-type']).toBe('application/json')
    expect(init.body).toBe('{"name":"A"}')
  })

  it('sends no authorization header without a login', async () => {
    token.value = null
    fetchMock.mockReturnValue(answer(200, {}))
    await api.get('/health')
    expect(fetchMock.mock.calls[0]![1].headers.authorization).toBeUndefined()
  })

  it('answers undefined for a 204', async () => {
    fetchMock.mockReturnValue(Promise.resolve(new Response(null, { status: 204 })))
    expect(await api.delete('/accounts/a')).toBeUndefined()
  })

  it('turns an error answer into an ApiError with the code of the API', async () => {
    fetchMock.mockReturnValue(answer(409, { code: 'subdomain_taken', message: 'taken' }))
    await expect(api.post('/companies', {})).rejects.toMatchObject({ status: 409, code: 'subdomain_taken', message: 'taken' })
  })

  it('says "network" when the API does not answer at all', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(api.get('/companies')).rejects.toMatchObject({ status: 0, code: 'network' })
  })

  it('copes with an answer that is not JSON', async () => {
    fetchMock.mockReturnValue(Promise.resolve(new Response('<html>', { status: 502, statusText: 'Bad Gateway' })))
    await expect(api.get('/x')).rejects.toMatchObject({ status: 502, code: 'unknown' })
  })

  it('translates a known code and falls back to the sentence of the screen otherwise', () => {
    expect(apiErrorMessage(new ApiError(409, 'subdomain_taken', 'taken'), 'Fout')).toContain('al in gebruik')
    expect(apiErrorMessage(new ApiError(500, 'iets_nieuws', 'x'), 'Fout')).toBe('Fout')
    expect(apiErrorMessage(new Error('boem'), 'Fout')).toBe('Fout')
    i18n.global.locale.value = 'en'
    expect(apiErrorMessage(new ApiError(0, 'network', 'x'), 'Error')).toContain('does not answer')
  })
})
