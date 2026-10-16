import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Every .ts file of src that is not a test */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : []
  })
}

/**
 * The rule of the client (feedback #137): nothing is really deleted, everything can be restored. A hard delete is
 * allowed in exactly the places below, each for a reason. A new one must be added here on purpose.
 */
const ALLOWED: Record<string, string> = {
  'companies/companies.service.ts':
    'sync(): a company that is gone at the platform is gone here too (it is only a copy of the platform)',
  'seed/seed.service.ts': 'clearAll(): development only, refuses to run in production',
  'database/database-version.service.ts': 'db:reset drops the whole database, development only',
}

// A call on the database: our own services have a remove() too, but that one is the soft delete
const HARD_DELETE =
  /\.(deleteOne|deleteMany|dropDatabase|drop)\(|(repository|Repository|repo)\.(delete|remove)\(/

describe('soft delete everywhere', () => {
  const root = join(process.cwd(), 'src')

  it('only the places we decided on can delete for real', () => {
    const found = sources(root).flatMap((file) => {
      const lines = readFileSync(file, 'utf8').split('\n')
      const hits = lines.flatMap((line, index) =>
        !line.trim().startsWith('//') && !line.trim().startsWith('*') && HARD_DELETE.test(line)
          ? [`${relative(root, file).replaceAll('\\', '/')}:${index + 1}: ${line.trim()}`]
          : [],
      )
      return hits
    })
    const unexpected = found.filter(
      (hit) => !Object.keys(ALLOWED).some((file) => hit.startsWith(`${file}:`)),
    )
    expect(unexpected, 'a hard delete outside the allowed places').toEqual([])
  })

  it('every allowed place still exists (remove the line here when the delete is gone)', () => {
    for (const file of Object.keys(ALLOWED)) {
      const text = readFileSync(join(root, file), 'utf8')
      expect(HARD_DELETE.test(text), file).toBe(true)
    }
  })

  it('the services of the archive use softRemove and recover', () => {
    const services = [
      'accounts/accounts.service.ts',
      'seller-roles/seller-roles.service.ts',
      'role-presets/role-presets.service.ts',
      'companies/companies.service.ts',
      'robots/robots.service.ts',
      'defects/defects.service.ts',
    ]
    for (const file of services) {
      const text = readFileSync(join(root, file), 'utf8')
      expect(text, file).toContain('softRemove(')
      expect(text, file).toContain('recover(')
    }
  })
})
