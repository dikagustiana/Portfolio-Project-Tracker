// Brief B6 §2.2: a scenario's route, #/simulasi/<world>/skenario?s=<encoded>, read and written by
// the board's URL state; the live world's route is unchanged.
import { describe, expect, it } from 'vitest'
import { fromHash, getUI, toHash } from './ui.ts'

describe('scenario route', () => {
  it('reads the world and the encoded scenario', () => {
    expect(fromHash('#/simulasi/distribusi/skenario?s=eyJ2IjoxfQ')).toMatchObject({ view: 'sim', simWorld: 'distribusi', simScenario: 'eyJ2IjoxfQ' })
    expect(fromHash('#/simulasi/distribusi')).toMatchObject({ view: 'sim', simWorld: 'distribusi', simScenario: null })
    expect(fromHash('#/simulasi/rpa/skenario')).toMatchObject({ simWorld: 'rpa', simScenario: null })
  })

  it('writes it back, and leaves every other route as it was', () => {
    const base = getUI()
    expect(toHash({ ...base, view: 'sim', simWorld: 'distribusi', simScenario: 'abc_-1' })).toBe('#/simulasi/distribusi/skenario?s=abc_-1')
    expect(toHash({ ...base, view: 'sim', simWorld: 'pabrik-singkong', simScenario: null })).toBe('#/simulasi/pabrik-singkong')
    expect(toHash({ ...base, view: 'week', simScenario: 'abc' })).toBe('#/minggu')
    expect(toHash({ ...base, view: 'sim', simWorld: 'distribusi', simScenario: 'abc', peek: { code: 'MB', kind: 'task', ref: 'MB12' } })).toBe('#/simulasi/distribusi/skenario?s=abc&peek=MB/t/MB12')
  })

  it('a hash round-trips', () => {
    const h = '#/simulasi/distribusi/skenario?s=eyJ2IjoxLCJ3IjoiZGlzdHJpYnVzaSJ9'
    expect(toHash({ ...getUI(), ...fromHash(h) })).toBe(h)
  })
})
