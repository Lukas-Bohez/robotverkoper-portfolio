import type { ExecutionContext } from '@nestjs/common'
import { GqlExecutionContext, type GqlContextType } from '@nestjs/graphql'
import type { Request } from 'express'
import type { SellerRole } from './permissions.js'

/** Who is asking: filled in by the AuthGuard */
export interface Caller {
  email: string
  role: SellerRole | null
}

export interface AuthRequest extends Request {
  caller?: Caller
}

/**
 * A subscription (websocket) has no HTTP request: the token travels in the connectionParams of the connection.
 * This makes it look like a request, so the guard treats both the same way.
 */
export function requestFromConnectionParams(
  connectionParams?: Record<string, unknown>,
): AuthRequest {
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(connectionParams ?? {})) {
    if (typeof value === 'string') headers[key.toLowerCase()] = value
  }
  return { headers, socket: { remoteAddress: '' } } as unknown as AuthRequest
}

export function requestOf(context: ExecutionContext): AuthRequest | undefined {
  if (context.getType<GqlContextType>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<{ req?: AuthRequest }>().req
  }
  return context.switchToHttp().getRequest<AuthRequest>()
}

export function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** The request comes from this very computer (a simulator that runs next to the API) */
export function isLoopback(req: Request | undefined): boolean {
  const remote = req?.socket?.remoteAddress ?? ''
  return remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1'
}
