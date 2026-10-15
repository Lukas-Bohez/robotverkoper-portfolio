import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { TokenVerifier } from './auth.ts'
import { HttpError, readJson, sendJson } from './http.ts'
import { permissionsOf, type SellerPermission, type SellerRole } from './permissions.ts'
import type { SellerService } from './service.ts'

export interface AppOptions {
  service: SellerService
  verifier: TokenVerifier
  corsOrigins: string[]
  /** Log one line per request (never a token, a key or a body) */
  log?: (line: string) => void
}

interface Context {
  params: string[]
  query: URLSearchParams
  body: Record<string, unknown>
  email: string
  role: SellerRole | null
  /** The request comes from this very computer */
  loopback: boolean
  /** The secret a simulator proves itself with while it waits for a key */
  pairingSecret: string
}

type Result = { status: number; body: unknown }
type Needs = 'public' | 'signed-in' | SellerPermission

interface Route {
  method: string
  pattern: RegExp
  needs: Needs
  handler: (context: Context) => Result | Promise<Result>
}

const ok = (body: unknown): Result => ({ status: 200, body })
const created = (body: unknown): Result => ({ status: 201, body })
const none = (): Result => ({ status: 204, body: null })

/** The HTTP side: who is asking, may they, and which call of the service it is */
export function createSellerApi(options: AppOptions): Server {
  const { service, verifier } = options

  const routes: Route[] = [
    { method: 'GET', pattern: /^\/health$/, needs: 'public', handler: () => ok({ status: 'ok', service: 'seller-api' }) },
    { method: 'GET', pattern: /^\/me$/, needs: 'signed-in', handler: (c) => ok(service.me(c.email)) },
    { method: 'GET', pattern: /^\/robot-models$/, needs: 'robots:read', handler: () => ok({ items: service.models() }) },
    {
      method: 'GET',
      pattern: /^\/company-permissions$/,
      needs: 'company-roles:manage',
      handler: () => ok({ items: service.companyPermissions() }),
    },

    { method: 'GET', pattern: /^\/companies$/, needs: 'companies:read', handler: async () => ok(await service.companies()) },
    {
      method: 'POST',
      pattern: /^\/companies$/,
      needs: 'companies:create',
      handler: async (c) => created(await service.createCompany(c.email, c.body)),
    },
    {
      method: 'GET',
      pattern: /^\/companies\/([^/]+)$/,
      needs: 'companies:read',
      handler: async (c) => ok(await service.company(c.params[0]!)),
    },
    {
      method: 'GET',
      pattern: /^\/companies\/([^/]+)\/robots$/,
      needs: 'robots:read',
      handler: async (c) => ok(await service.robots(c.params[0]!)),
    },
    {
      method: 'POST',
      pattern: /^\/companies\/([^/]+)\/robots$/,
      needs: 'robots:create',
      handler: async (c) => created(await service.createRobot(c.email, c.params[0]!, c.body)),
    },
    {
      method: 'GET',
      pattern: /^\/companies\/([^/]+)\/roles$/,
      needs: 'company-roles:manage',
      handler: async (c) => ok({ items: await service.roles(c.params[0]!) }),
    },
    {
      method: 'POST',
      pattern: /^\/companies\/([^/]+)\/roles$/,
      needs: 'company-roles:manage',
      handler: async (c) => created(await service.createRole(c.email, c.params[0]!, c.body)),
    },
    {
      method: 'DELETE',
      pattern: /^\/companies\/([^/]+)\/roles\/([^/]+)$/,
      needs: 'company-roles:manage',
      handler: async (c) => {
        await service.deleteRole(c.email, c.params[0]!, c.params[1]!)
        return none()
      },
    },

    {
      method: 'GET',
      pattern: /^\/defects$/,
      needs: 'defects:read',
      handler: (c) => ok({ items: service.defects(c.query.get('status') !== 'all') }),
    },
    {
      method: 'POST',
      pattern: /^\/robots\/([^/]+)\/defects$/,
      needs: 'defects:manage',
      handler: (c) => created(service.reportDefect(c.email, c.params[0]!, c.body)),
    },
    {
      method: 'POST',
      pattern: /^\/defects\/([^/]+)\/close$/,
      needs: 'defects:manage',
      handler: (c) => ok(service.closeDefect(c.email, c.params[0]!)),
    },
    {
      method: 'POST',
      pattern: /^\/defects\/([^/]+)\/replace$/,
      needs: 'robots:create',
      handler: async (c) => created(await service.replaceRobot(c.email, c.params[0]!, c.body)),
    },

    // The simulator (a device, not a person) announces itself, waits, and collects the key once
    {
      method: 'POST',
      pattern: /^\/pairings$/,
      needs: 'public',
      handler: (c) => created(service.createPairing(c.body, c.loopback)),
    },
    {
      method: 'GET',
      pattern: /^\/pairings\/([^/]+)$/,
      needs: 'public',
      handler: (c) => ok(service.collectPairing(c.params[0]!, c.pairingSecret)),
    },
    {
      method: 'DELETE',
      pattern: /^\/pairings\/([^/]+)$/,
      needs: 'public',
      handler: (c) => {
        service.cancelPairing(c.params[0]!, c.pairingSecret)
        return none()
      },
    },
    { method: 'GET', pattern: /^\/pairings$/, needs: 'robots:create', handler: () => ok({ items: service.waitingPairings() }) },
    {
      method: 'POST',
      pattern: /^\/pairings\/([^/]+)\/deliver$/,
      needs: 'robots:create',
      handler: (c) => {
        service.deliverToSimulator(c.email, c.params[0]!, c.body)
        return none()
      },
    },

    { method: 'GET', pattern: /^\/accounts$/, needs: 'accounts:manage', handler: () => ok({ items: service.accounts() }) },
    {
      method: 'POST',
      pattern: /^\/accounts$/,
      needs: 'accounts:manage',
      handler: (c) => created(service.addAccount(c.email, c.body)),
    },
    {
      method: 'DELETE',
      pattern: /^\/accounts\/([^/]+)$/,
      needs: 'accounts:manage',
      handler: (c) => {
        service.removeAccount(c.email, decodeURIComponent(c.params[0]!).toLowerCase())
        return none()
      },
    },
    {
      method: 'GET',
      pattern: /^\/audit$/,
      needs: 'audit:read',
      handler: (c) => ok({ items: service.audit(Math.min(Math.max(Number(c.query.get('limit') ?? 50) || 50, 1), 200)) }),
    },
  ]

  /** The simulator may run in a browser on any address: its calls carry a secret instead of a login */
  function isDeviceCall(req: IncomingMessage, path: string): boolean {
    const method = req.method === 'OPTIONS' ? String(req.headers['access-control-request-method'] ?? '') : req.method
    return (method === 'POST' && path === '/pairings') || (['GET', 'DELETE'].includes(method ?? '') && /^\/pairings\/[^/]+$/.test(path))
  }

  function cors(req: IncomingMessage, res: ServerResponse): void {
    const origin = req.headers.origin
    res.setHeader('vary', 'Origin')
    const path = (req.url ?? '').split('?')[0]!.replace(/\/+$/, '')
    if (isDeviceCall(req, path)) {
      res.setHeader('access-control-allow-origin', '*')
      res.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS')
      res.setHeader('access-control-allow-headers', 'content-type, x-pairing-secret')
      return
    }
    if (origin && options.corsOrigins.includes(origin)) {
      res.setHeader('access-control-allow-origin', origin)
      res.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS')
      res.setHeader('access-control-allow-headers', 'authorization, content-type')
      res.setHeader('access-control-max-age', '600')
    }
  }

  async function identify(req: IncomingMessage): Promise<{ email: string; role: SellerRole | null }> {
    const header = req.headers.authorization ?? ''
    if (!header.startsWith('Bearer ') || header.length === 'Bearer '.length) {
      throw new HttpError(401, 'unauthorized', 'Log in first')
    }
    const identity = await verifier.verify(header.slice('Bearer '.length))
    return { email: identity.email, role: service.roleOf(identity.email) }
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    cors(req, res)
    res.setHeader('x-content-type-options', 'nosniff')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname.replace(/\/+$/, '') || '/'

    let pathMatched = false
    for (const route of routes) {
      const match = path.match(route.pattern)
      if (!match) continue
      pathMatched = true
      if (route.method !== req.method) continue

      let email = ''
      let role: SellerRole | null = null
      if (route.needs !== 'public') {
        ;({ email, role } = await identify(req))
        if (route.needs !== 'signed-in') {
          if (role === null || !permissionsOf(role).includes(route.needs)) throw new HttpError(403, 'forbidden', 'You have no access to this')
        }
      }
      const body = req.method === 'POST' ? await readJson(req) : {}
      const secret = req.headers['x-pairing-secret']
      const remote = req.socket.remoteAddress ?? ''
      const result = await route.handler({
        params: match.slice(1).map(decodeURIComponent),
        query: url.searchParams,
        body,
        email,
        role,
        loopback: remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1',
        pairingSecret: typeof secret === 'string' ? secret : '',
      })
      if (result.status === 204) {
        res.writeHead(204)
        res.end()
      } else {
        sendJson(res, result.status, result.body)
      }
      return
    }
    throw pathMatched
      ? new HttpError(405, 'method_not_allowed', 'This method is not allowed here')
      : new HttpError(404, 'not_found', 'Unknown route')
  }

  return createServer((req, res) => {
    const started = Date.now()
    handle(req, res)
      .catch((error: unknown) => {
        if (error instanceof HttpError) {
          sendJson(res, error.status, { code: error.code, message: error.message })
          return
        }
        console.error(error)
        sendJson(res, 500, { code: 'internal', message: 'Something went wrong' })
      })
      .finally(() => {
        options.log?.(`${req.method} ${(req.url ?? '').split('?')[0]} ${res.statusCode} ${Date.now() - started}ms`)
      })
  })
}
