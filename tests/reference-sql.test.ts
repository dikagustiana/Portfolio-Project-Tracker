import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildReferenceSql, MIGRATION_PATH } from '../scripts/reference-sql.ts'

describe('reference-data migration', () => {
  it('matches the seed JSON (rerun `node scripts/reference-sql.ts` after editing seed files)', () => {
    const committed = readFileSync(new URL(`../${MIGRATION_PATH}`, import.meta.url), 'utf8')
    expect(committed).toBe(buildReferenceSql())
  })
})
