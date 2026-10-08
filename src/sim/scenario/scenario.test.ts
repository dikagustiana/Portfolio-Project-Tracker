// Brief B6 §5 for the shared layer: figures and badges, the largest-remainder split, the runner
// (stops at the first gap, rows sum to the totals) and the URL round trip, on a small made-up
// scenario so the shell's rules are pinned apart from any world.
import { describe, expect, it } from 'vitest'
import { calc, eng, explain, fig, fmt, inp, splitWhole, sum, walk } from './figure.ts'
import { byTeam, playable, runScenario } from './run.ts'
import { BADGES } from './types.ts'
import type { Fig, ScenarioDef } from './types.ts'
import { SCENARIO_VERSION, decodeScenario, encodeScenario } from './url.ts'

interface In {
  n: number
  ask: 'ya' | 'tidak'
}
type St = { carried: number }

const toy: ScenarioDef<In, St> = {
  world: 'distribusi',
  title: 'Uji',
  count: 3,
  dataHash: () => 'abcd1234',
  dataLabel: 'uji',
  fields: [],
  defaults: () => ({ n: 4, ask: 'ya' }),
  presets: [],
  normalize: (raw) => {
    const o = (raw ?? {}) as Partial<In>
    return { n: typeof o.n === 'number' ? o.n : 4, ask: o.ask === 'tidak' ? 'tidak' : 'ya' }
  },
  validate: (i) => (i.n > 0 ? {} : { n: 'harus > 0' }),
  preview: () => [],
  units: (i) => inp('Unit', i.n, 'palet'),
  summary: () => [],
  init: () => ({ carried: 0 }),
  teams: ['B', 'A'],
  steps: [
    {
      n: '1', title: () => 'A satu', role: () => 'Peran A', team: 'A', stage: () => ({ keep: [], live: [] }),
      run: ({ inputs, state }) => {
        const driver = inp('Jumlah', inputs.n, 'PO')
        const rate = eng('Tarif', 1000, 'Rp/PO', 'uji')
        return { state: { carried: state.carried + 1 }, out: { driver, rate, cost: calc('Biaya', 'Rp', '{0} × {1}', [driver, rate], (a, b) => a * b), day: 0, detail: [] } }
      },
    },
    {
      n: '2', title: () => 'B dua', role: () => 'Peran B', team: 'B', stage: () => ({ keep: [], live: [] }),
      gaps: ({ inputs }) => (inputs.ask === 'ya' ? [{ id: 'x', label: 'Nilai X', unit: 'Rp/PO', owner: 'Peran B', why: 'uji' }] : []),
      run: (ctx) => {
        const rate = ctx.inputs.ask === 'ya' ? ctx.asm('x') : eng('Tarif B', 500, 'Rp/PO', 'uji')
        const driver = inp('Jumlah', ctx.inputs.n, 'PO')
        return { state: ctx.state, out: { driver, rate, cost: calc('Biaya B', 'Rp', '{0} × {1}', [driver, rate], (a, b) => a * b), day: 3, detail: [] } }
      },
    },
    { n: '3', title: () => 'A tiga', role: () => 'Peran A', team: 'A', stage: () => ({ keep: [], live: [] }) },
  ],
}

const figsOf = (run: ReturnType<typeof runScenario>): Fig[] =>
  run.rows.flatMap((r) => [r.out?.driver, r.out?.rate, r.out?.cost, r.cum, r.perUnit, ...(r.out?.detail.map((d) => (typeof d.value === 'string' ? undefined : d.value)) ?? [])]).filter((f): f is Fig => !!f).flatMap((f) => walk(f))

describe('figures', () => {
  it('formats money, rates, units and shares in the house format', () => {
    expect(fmt(fig('x', 3_000_000, 'Rp', 'engine'))).toBe('Rp 3.000.000')
    expect(fmt(fig('x', 56_410.26, 'Rp/palet', 'engine'))).toBe('Rp 56.410 per palet')
    expect(fmt(fig('x', 1234.5, 'karton', 'hitungan', { dp: 1 }))).toBe('1.234,5 karton')
    expect(fmt(fig('x', 0.6, '%', 'input'))).toBe('60%')
    expect(fmt(fig('x', 7_500_000, 'Rp', 'hitungan'), true)).toBe('+Rp 7.500.000')
  })

  it('a Hitungan explains its formula with names, then values', () => {
    const f = calc('Biaya', 'Rp', '{0} × {1}', [inp('PO', 2, 'PO'), eng('Tarif', 3_000_000, 'Rp/PO', 'pool')], (a, b) => a * b)
    expect(f.value).toBe(6_000_000)
    expect(explain(f)).toBe('Biaya = PO × Tarif\n= 2 PO × Rp 3.000.000 per PO\n= Rp 6.000.000')
    expect(walk(f).map((x) => x.badge)).toEqual(['hitungan', 'input', 'engine'])
  })

  it('splits a whole number exactly, largest remainder first, ties to the earlier item', () => {
    expect(splitWhole(100, [773, 740, 697, 688, 706])).toEqual([21, 21, 19, 19, 20])
    expect(splitWhole(100, [773, 740, 697, 688, 706]).reduce((s, x) => s + x, 0)).toBe(100)
    expect(splitWhole(3, [1, 1, 1, 1])).toEqual([1, 1, 1, 0])
    expect(splitWhole(5, [0, 0])).toEqual([0, 0])
  })

  it('an empty sum is a counted zero with a badge', () => {
    const z = sum('Biaya', 'Rp', [])
    expect(z.value).toBe(0)
    expect(z.badge).toBe('hitungan')
  })
})

describe('runner', () => {
  it('with no assumptions entered, stops at the first gap', () => {
    const run = runScenario(toy, { n: 4, ask: 'ya' }, {})
    expect(run.status).toBe('paused')
    expect(run.pause?.index).toBe(1)
    expect(run.pause?.gaps.map((g) => g.id)).toEqual(['x'])
    expect(run.rows.map((r) => r.state)).toEqual(['done', 'paused', 'unwired'])
    expect(playable(run).map((r) => r.n)).toEqual(['1', '2'])
  })

  it('continues once the value is entered, marks it as an assumption, and ends partial at an unwired step', () => {
    const run = runScenario(toy, { n: 4, ask: 'ya' }, { x: 250 })
    expect(run.status).toBe('partial')
    expect(run.rows[1]?.out?.rate?.badge).toBe('asumsi')
    expect(run.rows[1]?.used).toEqual(['x'])
    expect(run.assumptions).toMatchObject([{ step: '2', value: 250 }])
    expect(run.total.value).toBe(4 * 1000 + 4 * 250)
  })

  it('rows sum to the totals; per unit × units = total; the cumulative closes', () => {
    const run = runScenario(toy, { n: 4, ask: 'tidak' }, {})
    const done = run.rows.filter((r) => r.state === 'done')
    const rowSum = done.reduce((s, r) => s + (r.out?.cost.value ?? 0), 0)
    expect(run.total.value).toBe(rowSum)
    expect(done.at(-1)?.cum?.value).toBe(rowSum)
    expect(run.perUnit.value * run.units.value).toBeCloseTo(run.total.value, 6)
    expect(done.reduce((s, r) => s + (r.perUnit?.value ?? 0), 0)).toBeCloseTo(run.perUnit.value, 9)
  })

  it('is deterministic and every figure carries a badge', () => {
    const a = runScenario(toy, { n: 4, ask: 'ya' }, { x: 250 })
    const b = runScenario(toy, { n: 4, ask: 'ya' }, { x: 250 })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    const figs = figsOf(a)
    expect(figs.length).toBeGreaterThan(5)
    for (const f of figs) expect(BADGES).toContain(f.badge)
  })

  it('groups cost by team in the scenario order', () => {
    const run = runScenario(toy, { n: 4, ask: 'tidak' }, {})
    expect(byTeam(run, toy.teams).map((t) => [t.team, t.cost.value])).toEqual([['B', 2000], ['A', 4000]])
  })
})

describe('URL', () => {
  it('round-trips a scenario with its version and engine hash', () => {
    const enc = encodeScenario('distribusi', 'f66a05ab', { vol: 100, p: ['A'], vu: 'palet' }, { 'admin-khusus-A': 12_500_000 })
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/)
    const d = decodeScenario(enc)
    expect(d.ok).toBe(true)
    if (!d.ok) return
    expect(d.saved).toEqual({ v: SCENARIO_VERSION, w: 'distribusi', h: 'f66a05ab', i: { p: ['A'], vol: 100, vu: 'palet' }, a: { 'admin-khusus-A': 12_500_000 } })
    // the same scenario always encodes to the same string, whatever the key order
    expect(encodeScenario('distribusi', 'f66a05ab', { vu: 'palet', p: ['A'], vol: 100 }, { 'admin-khusus-A': 12_500_000 })).toBe(enc)
  })

  it('refuses an unknown version or a broken link with a message', () => {
    expect(decodeScenario('###').ok).toBe(false)
    const v2 = btoa(JSON.stringify({ v: 2, w: 'distribusi', h: 'x', i: {}, a: {} })).replace(/=+$/, '')
    const d = decodeScenario(v2)
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.error).toContain('Versi skenario 2')
  })

  it('drops assumption values that are not finite numbers', () => {
    const raw = btoa(JSON.stringify({ v: 1, w: 'distribusi', h: 'x', i: {}, a: { ok: 5, bad: 'x', inf: null } })).replace(/=+$/, '')
    const d = decodeScenario(raw)
    expect(d.ok && d.saved.a).toEqual({ ok: 5 })
  })
})
