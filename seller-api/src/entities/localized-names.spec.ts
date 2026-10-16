import { describe, expect, it } from 'vitest'
import { LANGUAGES, localizedName, missingLanguages } from './localized-names.entity.js'

describe('localizedName: a role is never shown without a name', () => {
  const names = { nl: 'Technicus', en: 'Technician', fr: null, de: '' }

  it('has four languages', () => {
    expect(LANGUAGES).toEqual(['nl', 'en', 'fr', 'de'])
  })

  it('takes the asked language', () => {
    expect(localizedName(names, 'nl', 'technician')).toBe('Technicus')
    expect(localizedName(names, 'en', 'technician')).toBe('Technician')
  })

  it('falls back to English when the language has no name (empty and null count as missing)', () => {
    expect(localizedName(names, 'fr', 'technician')).toBe('Technician')
    expect(localizedName(names, 'de', 'technician')).toBe('Technician')
  })

  it('falls back to any language with a name when English is missing too', () => {
    expect(localizedName({ fr: 'Technicien' }, 'de', 'technician')).toBe('Technicien')
  })

  it('falls back to the key when there is no name at all', () => {
    expect(localizedName({}, 'nl', 'technician')).toBe('technician')
    expect(localizedName(null, 'nl', 'technician')).toBe('technician')
    expect(localizedName({ nl: '   ' }, 'nl', 'technician')).toBe('technician')
  })

  it('understands a locale like nl-BE and any letter case, and an unknown language falls back', () => {
    expect(localizedName(names, 'nl-BE', 'x')).toBe('Technicus')
    expect(localizedName(names, 'NL', 'x')).toBe('Technicus')
    expect(localizedName(names, 'es', 'x')).toBe('Technician')
    expect(localizedName(names, undefined, 'x')).toBe('Technician')
  })
})

describe('missingLanguages: what the screen shows as "FR en DE ontbreken"', () => {
  it('lists the languages without a name, in the order of the app', () => {
    expect(missingLanguages({ nl: 'Kok', en: 'Cook' })).toEqual(['fr', 'de'])
    expect(missingLanguages({ nl: 'Kok', fr: '  ' })).toEqual(['en', 'fr', 'de'])
  })

  it('is empty when every language has a name, and everything when there is no name', () => {
    expect(missingLanguages({ nl: 'a', en: 'b', fr: 'c', de: 'd' })).toEqual([])
    expect(missingLanguages(null)).toEqual(['nl', 'en', 'fr', 'de'])
  })
})
