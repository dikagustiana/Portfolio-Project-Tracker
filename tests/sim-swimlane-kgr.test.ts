// Brief B5 W3: the KGR swimlane snapshot reproduces the source's counts, is what the script makes
// from the export in the repository, and holds no free-text note and no personal name.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSwimlane } from '../src/sim/worlds/rpa/data/swimlane.ts'
import type { Swimlane } from '../src/sim/worlds/rpa/data/swimlane.ts'

const root = join(import.meta.dirname, '..')
const source = readFileSync(join(root, 'docs/sim/sources/KGR_swimlane_detail.md'), 'utf8')
const raw = readFileSync(join(root, 'src/sim/worlds/rpa/data/swimlane-kgr.json'), 'utf8')
const snap = JSON.parse(raw) as Swimlane

describe('KGR swimlane snapshot', () => {
  it('is exactly what the parser makes from the export kept in the repository', () => {
    expect(snap).toEqual(parseSwimlane(source))
  })

  it('reproduces the counts: 48 steps, 9 lanes, 15 phases, 42 gates, 135 data needs', () => {
    expect(snap.steps).toHaveLength(48)
    expect(snap.lanes).toHaveLength(9)
    expect(snap.phases).toHaveLength(15)
    expect(snap.gates).toHaveLength(42)
    expect(snap.steps.flatMap((s) => s.needs)).toHaveLength(135)
    expect(snap.lanes.reduce((s, l) => s + l.steps, 0)).toBe(48)
  })

  it('has the statuses ADA 9, SEBAGIAN 34, BELUM 92, and every step matches its overview count', () => {
    const needs = snap.steps.flatMap((s) => s.needs)
    expect(['ADA', 'SEBAGIAN', 'BELUM'].map((k) => needs.filter((n) => n.status === k).length)).toEqual([9, 34, 92])
    for (const s of snap.steps) expect(['ADA', 'SEBAGIAN', 'BELUM'].map((k) => s.needs.filter((n) => n.status === k).length), `step ${s.label}`).toEqual(s.overview)
  })

  it('has the two paths: RPA 38 steps, Trading 23, 13 of them shared', () => {
    expect(snap.paths.RPA).toHaveLength(38)
    expect(snap.paths.TRADING).toHaveLength(23)
    const shared = snap.paths.RPA.filter((x) => snap.paths.TRADING.includes(x))
    expect(shared).toHaveLength(13)
    expect(snap.steps.filter((s) => s.path === 'BERSAMA').map((s) => s.label).sort()).toEqual([...shared].sort())
    // Trading joins the shared steps from 18 onwards (and records its payable at step 6)
    expect(snap.paths.TRADING.slice(snap.paths.TRADING.indexOf('18'))).toEqual(['18', '25', '26', '27', '28', '32', '33', '34', '35', '36', '37', '38'])
  })

  it('names the 16 gates no step refers to, and every gate a step names is in the register', () => {
    const free = snap.gates.filter((g) => g.steps.length === 0).map((g) => g.id)
    expect(free).toEqual(['TBC-02', 'TBC-04', 'TBC-05', 'TBC-08', 'TBC-12', 'TBC-17', 'TBC-18', 'TBC-19', 'TBC-21', 'TBC-29', 'TBC-30', 'TBC-31', 'TBC-32', 'TBC-38', 'TBC-39', 'TBC-VOL'])
    const ids = new Set(snap.gates.map((g) => g.id))
    for (const s of snap.steps) if (s.gate) expect(ids.has(s.gate), s.gate).toBe(true)
  })

  it('keeps the source and its date', () => {
    expect(snap.source.read).toBe('2026-10-07')
    expect(snap.source.entity).toBe('KGR')
  })

  it('holds no free-text note and no personal name, nor does the copy of the export', () => {
    // ("Catatan" is also a document word, e.g. "Catatan Holding per Batch"; the notes are the
    // "**Catatan:**" field and its quoted lines)
    expect(raw).not.toMatch(/\*\*Catatan:\*\*|"(notes?|catatan)"\s*:/i)
    expect(source.split('\n').filter((l) => l.startsWith('- **Catatan:**')).every((l) => l.includes('tidak disalin'))).toBe(true)
    expect(source.split('\n').filter((l) => l.startsWith('  >'))).toEqual([])
    const honorific = /\b(pak|bu|ibu|bapak|mas|mbak)\s+[a-z]+/i
    expect(raw).not.toMatch(honorific)
    expect(source).not.toMatch(honorific)
  })
})
