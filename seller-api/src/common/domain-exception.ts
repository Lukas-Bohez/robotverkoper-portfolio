import { HttpException } from '@nestjs/common'

/**
 * An error the caller sees: an HTTP-like status, a stable code (`domainCode` in the GraphQL error,
 * the PWA translates it) and a readable message.
 */
export class DomainException extends HttpException {
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super({ statusCode: status, message, error: code, domainCode: code }, status)
    this.code = code
  }
}

/** The platform of the companies could not be reached: the seller side then shows what it knew last */
export function isPlatformUnavailable(error: unknown): boolean {
  return error instanceof DomainException && error.code === 'platform_unavailable'
}
