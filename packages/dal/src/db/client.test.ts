import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { closeDb, getDb } from './client'

describe('database client initialization', () => {
  let dataDir: string

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'durabull-database-client-'))
    process.env.DURABULL_PGLITE_DIR = dataDir
  })

  afterEach(async () => {
    await closeDb()
    delete process.env.DURABULL_PGLITE_DIR
    await rm(dataDir, { recursive: true, force: true })
  })

  it('serializes concurrent callers until PGlite migrations finish', async () => {
    const databases = await Promise.all(Array.from({ length: 20 }, () => getDb()))

    expect(new Set(databases).size).toBe(1)
    const result = await databases[0]?.execute(sql`select 1`)
    expect(result).toBeDefined()
  })
})
