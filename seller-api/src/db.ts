import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * The database of the seller side: one SQLite file of our own. It holds the robots we make and
 * sell, their defects, our own staff and an audit trail. Of the platform it keeps only a small
 * copy of the companies (id, name, subdomain), see Lukas/CONTRACT.md.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE robot_models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('FOOD', 'PARCEL')),
    description TEXT NOT NULL
  );

  -- The only part of the platform that is copied here
  CREATE TABLE companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subdomain TEXT NOT NULL,
    created_at TEXT NOT NULL,
    synced_at TEXT NOT NULL
  );

  CREATE TABLE robots (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    model_id TEXT NOT NULL REFERENCES robot_models (id),
    name TEXT NOT NULL,
    temperature_type TEXT CHECK (temperature_type IN ('WARM', 'COLD', 'NEUTRAL')),
    api_key_prefix TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    retired_at TEXT,
    last_online INTEGER,
    last_battery INTEGER,
    last_seen_at TEXT
  );
  CREATE INDEX robots_company ON robots (company_id);

  CREATE TABLE defects (
    id TEXT PRIMARY KEY,
    robot_id TEXT NOT NULL REFERENCES robots (id),
    summary TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    status TEXT NOT NULL CHECK (status IN ('open', 'replaced', 'closed')),
    reported_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    replacement_robot_id TEXT REFERENCES robots (id)
  );
  CREATE INDEX defects_robot ON defects (robot_id);

  CREATE TABLE accounts (
    email TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('admin', 'technician')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT
  );
  `,
]

/** Opens (and creates) the database and brings it to the latest version */
export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON')
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL')

  const row = db.prepare('PRAGMA user_version').get() as { user_version: number }
  for (let version = row.user_version; version < MIGRATIONS.length; version++) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[version]!)
      db.exec(`PRAGMA user_version = ${version + 1}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
  return db
}
