import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import de from '@/locales/de.json'
import en from '@/locales/en.json'
import fr from '@/locales/fr.json'
import nl from '@/locales/nl.json'

/** The dotted paths of every text in a language file */
function paths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([key, child]) => paths(child, prefix ? `${prefix}.${key}` : key))
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' || name === 'locales' ? [] : sources(path)
    return /\.(vue|ts)$/.test(path) ? [path] : []
  })
}

const nlPaths = new Set(paths(nl))
const enPaths = new Set(paths(en))

describe('the four languages', () => {
  it('Dutch and English have exactly the same texts (the two complete languages)', () => {
    expect([...nlPaths].filter(key => !enPaths.has(key))).toEqual([])
    expect([...enPaths].filter(key => !nlPaths.has(key))).toEqual([])
  })

  it('French and German only hold texts that English has too (a text they miss falls back to English)', () => {
    expect(paths(fr).filter(key => !enPaths.has(key))).toEqual([])
    expect(paths(de).filter(key => !enPaths.has(key))).toEqual([])
  })

  it('every text the code asks for exists (a bare key on a screen is a bug)', () => {
    const used = new Set<string>()
    for (const file of sources(join(process.cwd(), 'src'))) {
      const text = readFileSync(file, 'utf8')
      for (const match of text.matchAll(/\b(?:t|te)\(\s*(['"`])([^'"`]+)\1/g)) {
        const key = match[2]!
        // A key with ${...} is built at run time: check that its start exists as a group
        if (key.includes('${')) {
          const start = key.split('${')[0]!.replace(/\.$/, '')
          if (start) used.add(`${start}.*`)
        } else used.add(key)
      }
    }
    const missing = [...used].filter(key =>
      key.endsWith('.*')
        ? ![...nlPaths].some(path => path.startsWith(`${key.slice(0, -2)}.`))
        : !nlPaths.has(key) && ![...nlPaths].some(path => path.startsWith(`${key}.`)),
    )
    expect(missing).toEqual([])
  })
})
