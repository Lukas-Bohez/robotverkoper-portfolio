import { describe, expect, it } from 'vitest'
import { isValidSubdomain, slugify } from '../slug'

describe('slugify', () => {
  it('makes an address from a name', () => {
    expect(slugify('Pizzeria Test')).toBe('pizzeria-test')
  })

  it('drops accents and symbols', () => {
    expect(slugify('  Café Têst!! ')).toBe('cafe-test')
  })

  it('keeps at most 30 characters and never ends with a hyphen', () => {
    const slug = slugify('A very long company name that keeps going and going')
    expect(slug.length).toBeLessThanOrEqual(30)
    expect(slug.endsWith('-')).toBe(false)
  })

  it('is empty for a name without letters or digits', () => {
    expect(slugify('!!!')).toBe('')
  })
})

describe('isValidSubdomain', () => {
  it.each(['demo', 'pizzeria-test', 'a1'])('accepts %s', (value) => {
    expect(isValidSubdomain(value)).toBe(true)
  })

  it.each(['a', '-demo', 'demo-', 'Demo', 'de mo', ''])('refuses "%s"', (value) => {
    expect(isValidSubdomain(value)).toBe(false)
  })
})
