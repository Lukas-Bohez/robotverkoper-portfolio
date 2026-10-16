import { Logger } from '@nestjs/common'
import type { ExecutionResult, FormattedExecutionResult, GraphQLFormattedError } from 'graphql'

const logger = new Logger('GraphQL')

/** The standard GraphQL error code of an HTTP-like status */
const CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'TOO_MANY_REQUESTS',
  502: 'BAD_GATEWAY',
}

interface HttpLike {
  getStatus?: () => number
  getResponse?: () => unknown
  originalError?: unknown
}

/** The error that was thrown: Apollo hands us a GraphQLError that wraps it */
function thrownBy(original: unknown): HttpLike | undefined {
  const outer = original as HttpLike | undefined
  const inner = outer?.originalError as HttpLike | undefined
  return typeof outer?.getStatus === 'function' ? outer : inner
}

function statusOf(error: GraphQLFormattedError, original: unknown): number | undefined {
  try {
    const status = thrownBy(original)?.getStatus?.()
    if (typeof status === 'number') return status
  } catch {
    // fall through
  }
  const body = error.extensions?.originalError as { statusCode?: unknown } | undefined
  return typeof body?.statusCode === 'number' ? body.statusCode : undefined
}

/** `domainCode` of a DomainException, or `invalid_input` for a plain validation error */
function domainCodeOf(
  error: GraphQLFormattedError,
  original: unknown,
  status: number | undefined,
): string | undefined {
  try {
    const body = thrownBy(original)?.getResponse?.() ?? error.extensions?.originalError
    if (body && typeof body === 'object') {
      const code = (body as { domainCode?: unknown }).domainCode
      if (typeof code === 'string') return code
    }
  } catch {
    // fall through
  }
  return status === 400 ? 'invalid_input' : undefined
}

/**
 * Gives every error the code of its status (a NotFoundException would otherwise reach the client as
 * INTERNAL_SERVER_ERROR) and our own stable `domainCode`, which the PWA translates.
 */
export function formatGraphqlError(
  error: GraphQLFormattedError,
  original?: unknown,
): GraphQLFormattedError {
  try {
    const status = statusOf(error, original)
    const code = status === undefined ? undefined : CODES[status]
    const domainCode = domainCodeOf(error, original, status)
    if (!code && !domainCode) return error
    return {
      ...error,
      extensions: {
        ...error.extensions,
        ...(status === undefined ? {} : { status }),
        ...(code ? { code } : {}),
        ...(domainCode ? { domainCode } : {}),
      },
    }
  } catch {
    return error
  }
}

/** A mistake of the caller is not worth a log line; anything else is a bug of ours */
export function logUnexpectedError(error: GraphQLFormattedError, original?: unknown): void {
  const status = error.extensions?.status
  if (typeof status === 'number' && status < 500) return
  const code = error.extensions?.code
  if (typeof code === 'string' && code !== 'INTERNAL_SERVER_ERROR') return
  const cause = original instanceof Error ? original : undefined
  logger.error(error.message, cause?.stack)
}

/** Subscriptions (graphql-ws) skip Apollo's formatting: give their errors the same codes */
export function withErrorCodes(result: ExecutionResult): FormattedExecutionResult {
  try {
    const { errors, ...rest } = result
    if (!errors?.length) return rest
    return {
      ...rest,
      errors: errors.map((error) => formatGraphqlError(error.toJSON(), error.originalError)),
    }
  } catch {
    return result
  }
}
