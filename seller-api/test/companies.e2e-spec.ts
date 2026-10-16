import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { DataSource } from 'typeorm'
import { ADMIN, codeOf, createTestApp, domainCodeOf, gql, type TestContext } from './utils/test-app.js'
import { AUDIT, COMPANIES, COMPANY, CREATE_COMPANY } from './utils/operations.js'

interface CompaniesData {
  companies: {
    source: string
    items: { id: string; name: string; subdomain: string; robotCount: number; openDefects: number }[]
  }
}

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestApp()
})
afterAll(() => ctx.close())
beforeEach(() => ctx.reset())

describe('companies', () => {
  it('lists the companies of the platform with our own counts', async () => {
    const { data } = await gql<CompaniesData>(ctx.app, COMPANIES)
    expect(data?.companies.source).toBe('PLATFORM')
    expect(data?.companies.items.map(company => company.name)).toEqual(['Demozaak', 'Gelato Bar'])
    expect(data?.companies.items[0]).toMatchObject({ robotCount: 0, openDefects: 0 })
  })

  it('creates a company through the platform and keeps no email address of anyone', async () => {
    const created = await gql<{ createCompany: { subdomain: string } }>(ctx.app, CREATE_COMPANY, {
      input: { name: 'Pizzeria Test', subdomain: ' Pizzeria-Test ', adminEmail: 'Chef@Pizzeria.example' },
    })
    expect(created.errors).toBeUndefined()
    expect(created.data?.createCompany.subdomain).toBe('pizzeria-test')
    expect(ctx.platform.lastCreateCompany).toEqual({
      name: 'Pizzeria Test',
      subdomain: 'pizzeria-test',
      adminEmail: 'chef@pizzeria.example',
    })
    // Everything we keep: the companies, the audit trail and the accounts
    const dump = JSON.stringify([
      await ctx.app.get(DataSource).mongoManager.getMongoRepository('companies').find(),
      await ctx.app.get(DataSource).mongoManager.getMongoRepository('audit').find(),
      await ctx.app.get(DataSource).mongoManager.getMongoRepository('accounts').find(),
    ]).toLowerCase()
    expect(dump, 'the first administrator belongs to the company, not to us').not.toContain('chef@pizzeria')
  })

  it('passes on the platform answer when the subdomain is taken, and validates the input', async () => {
    const taken = await gql(ctx.app, CREATE_COMPANY, {
      input: { name: 'Nog een', subdomain: 'demo', adminEmail: 'a@b.be' },
    })
    expect(codeOf(taken)).toBe('CONFLICT')
    expect(domainCodeOf(taken)).toBe('subdomain_taken')
    const short = await gql(ctx.app, CREATE_COMPANY, { input: { name: 'A', subdomain: 'ok', adminEmail: 'a@b.be' } })
    expect(codeOf(short)).toBe('BAD_REQUEST')
    const dashes = await gql(ctx.app, CREATE_COMPANY, {
      input: { name: 'Goed', subdomain: '-slecht-', adminEmail: 'a@b.be' },
    })
    expect(domainCodeOf(dashes)).toBe('invalid_subdomain')
    const email = await gql(ctx.app, CREATE_COMPANY, {
      input: { name: 'Goed', subdomain: 'goed', adminEmail: 'geen' },
    })
    expect(domainCodeOf(email)).toBe('invalid_email')
  })

  it('says NOT_FOUND for a company the platform does not know', async () => {
    const missing = await gql(ctx.app, COMPANY, { id: 'bestaat-niet' })
    expect(codeOf(missing)).toBe('NOT_FOUND')
    expect(domainCodeOf(missing)).toBe('company_not_found')
  })

  it('shows the last known list, marked as cache, when the platform is down', async () => {
    await gql(ctx.app, COMPANIES)
    ctx.platform.down = true
    const { data } = await gql<CompaniesData>(ctx.app, COMPANIES)
    expect(data?.companies.source).toBe('CACHE')
    expect(data?.companies.items).toHaveLength(2)
    const create = await gql(ctx.app, CREATE_COMPANY, {
      input: { name: 'Nieuw', subdomain: 'nieuw', adminEmail: 'a@b.be' },
    })
    expect(codeOf(create)).toBe('BAD_GATEWAY')
    expect(domainCodeOf(create)).toBe('platform_unavailable')
  })

  it('a company that disappeared at the platform disappears here too', async () => {
    await gql(ctx.app, COMPANIES)
    ctx.platform.companiesList = ctx.platform.companiesList.filter(company => company.id !== 'c-gelato')
    const { data } = await gql<CompaniesData>(ctx.app, COMPANIES)
    expect(data?.companies.items.map(company => company.id)).toEqual(['c-demo'])
  })

  it('keeps an audit trail of what was done and by whom', async () => {
    await gql(ctx.app, CREATE_COMPANY, { input: { name: 'Taverne', subdomain: 'taverne', adminEmail: 'a@b.be' } })
    const { data } = await gql<{ auditLog: { action: string; actor: string }[] }>(ctx.app, AUDIT)
    expect(data?.auditLog.map(entry => entry.action)).toEqual(['company.created'])
    expect(data?.auditLog[0]?.actor).toBe(ADMIN)
  })
})
