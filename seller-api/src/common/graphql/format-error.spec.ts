import { GraphQLError } from 'graphql'
import { describe, expect, it } from 'vitest'
import { DomainException, isPlatformUnavailable } from '../domain-exception.js'
import { formatGraphqlError, withErrorCodes } from './format-error.js'

/** What Apollo does: the thrown error is wrapped in a GraphQLError */
const format = (original: Error) => {
  const wrapped = new GraphQLError(original.message, { originalError: original })
  return formatGraphqlError(wrapped.toJSON(), wrapped)
}

describe('the codes of an error', () => {
  it('gives a domain error the code of its status and its own stable domainCode', () => {
    const formatted = format(new DomainException(409, 'defect_claimed', 'Another technician already took this defect'))
    expect(formatted.extensions).toMatchObject({ code: 'CONFLICT', status: 409, domainCode: 'defect_claimed' })
  })

  it.each([
    [400, 'BAD_REQUEST'],
    [401, 'UNAUTHENTICATED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [502, 'BAD_GATEWAY'],
  ])('maps status %i to %s', (status, code) => {
    expect(format(new DomainException(status, 'x_y', 'm')).extensions?.code).toBe(code)
  })

  it('leaves an error without a status alone (a bug of ours stays an internal error)', () => {
    const formatted = format(new Error('kapot'))
    expect(formatted.extensions?.code).toBeUndefined()
    expect(formatted.message).toBe('kapot')
  })

  it('never throws on something strange', () => {
    expect(() => formatGraphqlError({ message: 'x' }, undefined)).not.toThrow()
    const exploding = {
      getStatus: () => {
        throw new Error('boom')
      },
    }
    expect(() => formatGraphqlError({ message: 'x' }, exploding)).not.toThrow()
  })

  it('gives errors of a subscription the same codes', () => {
    const error = new GraphQLError('no', { originalError: new DomainException(403, 'no_access', 'no') })
    const result = withErrorCodes({ errors: [error] })
    expect(result.errors?.[0]?.extensions).toMatchObject({ code: 'FORBIDDEN', domainCode: 'no_access' })
    expect(withErrorCodes({ data: { a: 1 } })).toEqual({ data: { a: 1 } })
  })
})

describe('isPlatformUnavailable', () => {
  it('is true only for the platform_unavailable domain error', () => {
    expect(isPlatformUnavailable(new DomainException(502, 'platform_unavailable', 'x'))).toBe(true)
    expect(isPlatformUnavailable(new DomainException(502, 'other', 'x'))).toBe(false)
    expect(isPlatformUnavailable(new Error('platform_unavailable'))).toBe(false)
    expect(isPlatformUnavailable(undefined)).toBe(false)
  })
})
