import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose'
import { DevTokenVerifier, FirebaseTokenVerifier } from '../src/auth.ts'
import { loadConfig } from '../src/config.ts'
import { openDatabase } from '../src/db.ts'
import { HttpPlatformGateway, isPlatformUnavailable } from '../src/platform.ts'

const PROJECT = 'robot-demo'

async function signer() {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }
  const keys = createLocalJWKSet({ keys: [jwk] })
  const sign = (claims: Record<string, unknown>, options: { issuer?: string; audience?: string; expires?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setSubject('uid-1')
      .setIssuer(options.issuer ?? `https://securetoken.google.com/${PROJECT}`)
      .setAudience(options.audience ?? PROJECT)
      .setIssuedAt()
      .setExpirationTime(options.expires ?? '1h')
      .sign(privateKey)
  return { keys, sign }
}

describe('Firebase tokens', () => {
  test('accepts a token of our project and lowercases the email', async () => {
    const { keys, sign } = await signer()
    const verifier = new FirebaseTokenVerifier({ projectId: PROJECT, requireVerifiedEmail: false, keys })
    const identity = await verifier.verify(await sign({ email: 'Docent@Howest.be' }))
    assert.deepEqual(identity, { uid: 'uid-1', email: 'docent@howest.be' })
  })

  test('refuses another project, another issuer, an expired token and a token without email', async () => {
    const { keys, sign } = await signer()
    const verifier = new FirebaseTokenVerifier({ projectId: PROJECT, requireVerifiedEmail: false, keys })
    await assert.rejects(verifier.verify(await sign({ email: 'a@b.be' }, { audience: 'ander-project' })), { code: 'invalid_token' })
    await assert.rejects(verifier.verify(await sign({ email: 'a@b.be' }, { issuer: 'https://evil.example' })), { code: 'invalid_token' })
    await assert.rejects(verifier.verify(await sign({ email: 'a@b.be' }, { expires: '-1h' })), { code: 'invalid_token' })
    await assert.rejects(verifier.verify(await sign({})), { code: 'invalid_token' })
    await assert.rejects(verifier.verify('geen.jwt.token'), { code: 'invalid_token' })
  })

  test('refuses a token signed with another key', async () => {
    const mine = await signer()
    const other = await signer()
    const verifier = new FirebaseTokenVerifier({ projectId: PROJECT, requireVerifiedEmail: false, keys: mine.keys })
    await assert.rejects(verifier.verify(await other.sign({ email: 'a@b.be' })), { code: 'invalid_token' })
  })

  test('can insist on a verified email', async () => {
    const { keys, sign } = await signer()
    const verifier = new FirebaseTokenVerifier({ projectId: PROJECT, requireVerifiedEmail: true, keys })
    await assert.rejects(verifier.verify(await sign({ email: 'a@b.be', email_verified: false })), { code: 'email_not_verified' })
    assert.equal((await verifier.verify(await sign({ email: 'a@b.be', email_verified: true }))).email, 'a@b.be')
  })
})

describe('dev tokens', () => {
  test('are dev:<email> and nothing else', async () => {
    const verifier = new DevTokenVerifier()
    assert.equal((await verifier.verify('dev:Docent@Howest.be')).email, 'docent@howest.be')
    await assert.rejects(verifier.verify('docent@howest.be'), { code: 'invalid_token' })
    await assert.rejects(verifier.verify('dev:geen-email'), { code: 'invalid_token' })
  })
})

describe('config', () => {
  test('has safe defaults for a local demo', () => {
    const config = loadConfig({ AUTH_MODE: 'dev' })
    assert.equal(config.port, 4200)
    assert.equal(config.host, '127.0.0.1', 'only this computer, unless asked otherwise')
    assert.equal(loadConfig({ AUTH_MODE: 'dev', BIND_HOST: '0.0.0.0' }).host, '0.0.0.0')
    assert.equal(config.requireVerifiedEmail, false)
    assert.deepEqual(config.corsOrigins, ['http://localhost:5174', 'http://127.0.0.1:5174'])
  })

  test('refuses dev logins and demo data in production, and firebase without a project', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'production', AUTH_MODE: 'dev' }), /never runs in production/)
    assert.throws(() => loadConfig({ NODE_ENV: 'production', AUTH_MODE: 'firebase', FIREBASE_PROJECT_ID: 'p', SEED_DEMO: 'true' }), /never for production/)
    assert.throws(() => loadConfig({ AUTH_MODE: 'firebase' }), /FIREBASE_PROJECT_ID/)
    assert.throws(() => loadConfig({ AUTH_MODE: 'anders' }), /AUTH_MODE/)
    assert.equal(loadConfig({ NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'p' }).requireVerifiedEmail, true)
  })

  test('reads the administrators as a lowercase list', () => {
    const config = loadConfig({ AUTH_MODE: 'dev', SELLER_ADMIN_EMAILS: ' Docent@Howest.be , b@c.be ' })
    assert.deepEqual(config.sellerAdminEmails, ['docent@howest.be', 'b@c.be'])
  })
})

describe('database', () => {
  test('is created once and reopened without losing anything', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seller-db-'))
    try {
      const path = join(dir, 'nested', 'seller.db')
      const first = openDatabase(path)
      first.prepare("INSERT INTO accounts (email, role, created_by, created_at) VALUES ('a@b.be', 'admin', 'x', 'nu')").run()
      assert.equal((first.prepare('PRAGMA user_version').get() as any).user_version, 1)
      first.close()
      const second = openDatabase(path)
      assert.equal((second.prepare('SELECT COUNT(*) AS n FROM accounts').get() as any).n, 1)
      second.close()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('refuses a defect with an unknown severity', () => {
    const db = openDatabase(':memory:')
    db.prepare("INSERT INTO robot_models VALUES ('m', 'M', 'FOOD', '')").run()
    db.prepare("INSERT INTO robots (id, company_id, model_id, name, api_key_prefix, created_by, created_at) VALUES ('r','c','m','n','p','x','nu')").run()
    assert.throws(() =>
      db.prepare("INSERT INTO defects (id, robot_id, summary, severity, status, reported_by, created_at) VALUES ('d','r','s','enorm','open','x','nu')").run(),
    )
  })
})

describe('HTTP gateway to the platform', () => {
  async function platform(handler: (url: string, method: string, auth: string | undefined) => [number, unknown]) {
    const seen: { url: string; method: string; auth: string | undefined }[] = []
    const server: Server = createServer((req, res) => {
      seen.push({ url: req.url ?? '', method: req.method ?? '', auth: req.headers.authorization })
      const [status, body] = handler(req.url ?? '', req.method ?? '', req.headers.authorization)
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(body === null ? '' : JSON.stringify(body))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    return { baseUrl, seen, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
  }

  test('sends the token and keeps only the fields of the contract', async () => {
    const p = await platform(() => [200, [{ id: '1', name: 'A', subdomain: 'a', createdAt: 't', adminEmail: 'geheim@x.be', extra: 1 }]])
    try {
      const gateway = new HttpPlatformGateway({ baseUrl: p.baseUrl, token: 'tok' })
      const companies = await gateway.listCompanies()
      assert.deepEqual(companies, [{ id: '1', name: 'A', subdomain: 'a', createdAt: 't' }])
      assert.equal(p.seen[0]!.auth, 'Bearer tok')
    } finally {
      await p.close()
    }
  })

  test('passes on a refusal of the platform (4xx) with its code', async () => {
    const p = await platform(() => [409, { code: 'subdomain_taken', message: 'taken' }])
    try {
      const gateway = new HttpPlatformGateway({ baseUrl: p.baseUrl, token: 'tok' })
      await assert.rejects(gateway.createCompany({ name: 'A', subdomain: 'a', adminEmail: 'a@b.be' }), { status: 409, code: 'subdomain_taken' })
    } finally {
      await p.close()
    }
  })

  test('treats a failing or unreachable platform, and a wrong token, as unavailable', async () => {
    const failing = await platform(() => [500, { message: 'boem' }])
    const denied = await platform(() => [401, { code: 'unauthorized' }])
    try {
      for (const p of [failing, denied]) {
        const gateway = new HttpPlatformGateway({ baseUrl: p.baseUrl, token: 'tok' })
        await assert.rejects(gateway.listCompanies(), (error) => isPlatformUnavailable(error))
      }
    } finally {
      await failing.close()
      await denied.close()
    }
    const unreachable = new HttpPlatformGateway({ baseUrl: 'http://127.0.0.1:1', token: 'tok', timeoutMs: 500 })
    await assert.rejects(unreachable.listCompanies(), (error) => isPlatformUnavailable(error))
  })

  test('asks for no live state when there are no robots, and encodes ids', async () => {
    const p = await platform(() => [200, []])
    try {
      const gateway = new HttpPlatformGateway({ baseUrl: p.baseUrl, token: 'tok' })
      assert.deepEqual(await gateway.robotsLive([]), [])
      assert.equal(p.seen.length, 0)
      await gateway.robotsLive(['a b', 'c'])
      assert.equal(p.seen[0]!.url, '/robots/live?ids=a%20b,c')
    } finally {
      await p.close()
    }
  })
})
