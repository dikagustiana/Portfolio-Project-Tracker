// Brief B6 §5 for the distribution scenario, steps 1–3 (S0): the conversion through the engine's
// cartons per pallet, the order-need formula, the gaps (stock as an assumption, a dedicated sales
// admin the engine lacks), badges on every figure, determinism through the URL, and the engine
// left untouched.
import { describe, expect, it } from 'vitest'
import { walk } from '../../../scenario/figure.ts'
import { runScenario } from '../../../scenario/run.ts'
import { BADGES } from '../../../scenario/types.ts'
import type { Fig, Run } from '../../../scenario/types.ts'
import { decodeScenario, encodeScenario } from '../../../scenario/url.ts'
import { hashJson } from '../../../core/rng.ts'
import { computeAll2 } from '../../b2b-b2c/engine/index.ts'
import { eng, inp } from '../../../scenario/figure.ts'
import d, { planOf } from './index.ts'
import { orderNeed } from './order.ts'

const figsOf = (run: Run): Fig[] =>
  run.rows
    .flatMap((r) => [r.out?.driver, r.out?.rate, r.out?.cost, r.cum, r.perUnit, ...(r.out?.detail.map((x) => (typeof x.value === 'string' ? undefined : x.value)) ?? [])])
    .filter((f): f is Fig => !!f)
    .flatMap((f) => walk(f))

const engineFingerprint = (): string => {
  const c = computeAll2()
  return hashJson({ pools: c.alloc.b2bAlloc.pools.map((p) => [p.def.id, p.total, p.volumeTotal, p.rate, p.costByPrincipal]), totals: c.alloc.totals, b2b: c.alloc.b2bAlloc.totals })
}

describe('distribusi scenario · conversion', () => {
  it('100 palet of Prinsipal A = 800 karton through the engine rule (8 karton per palet), split by the forecast mix', () => {
    const plan = planOf(d.defaults())
    expect(plan.map((x) => x.sku.code)).toEqual(['A-01', 'A-02', 'A-03', 'A-04', 'A-05'])
    expect(plan.map((x) => x.perPallet.value)).toEqual([8, 8, 8, 8, 8])
    expect(plan.map((x) => x.perPallet.badge)).toEqual(['engine', 'engine', 'engine', 'engine', 'engine'])
    expect(plan.reduce((s, x) => s + x.pallets.value, 0)).toBe(100)
    expect(plan.reduce((s, x) => s + x.cartons.value, 0)).toBe(800)
  })

  it('a volume in cartons rounds pallets up per SKU', () => {
    const plan = planOf({ ...d.defaults(), vol: 801, vu: 'karton' })
    expect(plan.reduce((s, x) => s + x.cartons.value, 0)).toBe(801)
    for (const x of plan) expect(x.pallets.value).toBe(Math.ceil(x.cartons.value / x.perPallet.value))
  })
})

describe('distribusi scenario · order need', () => {
  it('need = forecast + daily sales × minimum days − current − in transit, whole cartons, never below zero', () => {
    const n = orderNeed('X', inp('F', 300, 'karton'), eng('hari', 30, 'hari', 't'), eng('min', 7, 'hari', 't'), inp('cur', 50, 'karton'), inp('tr', 20, 'karton'))
    expect(n.daily.value).toBe(10)
    expect(n.minStock.value).toBe(70)
    expect(n.need.value).toBe(300)
    const none = orderNeed('X', inp('F', 30, 'karton'), eng('hari', 30, 'hari', 't'), eng('min', 7, 'hari', 't'), inp('cur', 500, 'karton'), inp('tr', 0, 'karton'))
    expect(none.need.value).toBe(0)
    const frac = orderNeed('X', inp('F', 31, 'karton'), eng('hari', 30, 'hari', 't'), eng('min', 7, 'hari', 't'), inp('cur', 0, 'karton'), inp('tr', 0, 'karton'))
    expect(frac.need.value).toBe(Math.ceil(31 + (31 / 30) * 7))
  })
})

describe('distribusi scenario · steps 1–3', () => {
  it('the 100-palet preset runs steps 1–3 on engine data alone and stops partial at 4a', () => {
    const run = runScenario(d, d.presets[0]?.inputs ?? d.defaults(), {})
    expect(run.status).toBe('partial')
    expect(run.rows.slice(0, 4).map((r) => r.state)).toEqual(['done', 'done', 'done', 'unwired'])
    expect(run.rows).toHaveLength(12)
    const [s1, s2, s3] = run.rows
    expect(s1?.out?.cost.value).toBe(0)
    // the Komersial pool split per order line: Rp 54.000.000 ÷ 36 PO lines in the engine month
    expect(s2?.out?.rate?.value).toBe(1_500_000)
    expect(s2?.out?.driver?.value).toBe(5)
    // one PO per principal per order check, at the shared pool's engine rate
    expect(s3?.out?.driver?.value).toBe(1)
    expect(s3?.out?.rate?.value).toBe(3_000_000)
    expect(s3?.out?.rate?.badge).toBe('engine')
    expect(run.total.value).toBe(10_500_000)
    expect(run.perUnit.value).toBe(105_000)
  })

  it('with stock as an assumption and nothing entered, stops at step 2 asking current and in-transit stock', () => {
    const run = runScenario(d, { ...d.defaults(), stock: 'asumsi' }, {})
    expect(run.status).toBe('paused')
    expect(run.rows[run.pause?.index ?? -1]?.n).toBe('2')
    expect(run.pause?.gaps.map((g) => g.id)).toEqual(['stok-A', 'transit-A'])
    for (const g of run.pause?.gaps ?? []) {
      expect(g.owner).toBeTruthy()
      expect(g.why).toBeTruthy()
      expect(g.source).toBeUndefined()
    }
    const done = runScenario(d, { ...d.defaults(), stock: 'asumsi' }, { 'stok-A': 0, 'transit-A': 0 })
    expect(done.status).toBe('partial')
    expect(done.assumptions.map((a) => [a.gap.id, a.step, a.value])).toEqual([['stok-A', '2', 0], ['transit-A', '2', 0]])
    // with nothing in stock the order covers forecast and minimum stock: 800 + 800 ÷ 30 × 7
    const need = done.rows[1]?.out?.detail.find((x) => x.label.endsWith('kebutuhan order'))?.value as Fig
    expect(need.value).toBe(990)
  })

  it('a dedicated admin for a principal the engine has none for is asked at step 3; Prinsipal D reads the engine', () => {
    const a = runScenario(d, { ...d.defaults(), sa: 'khusus' }, {})
    expect(a.status).toBe('paused')
    expect(a.rows[a.pause?.index ?? -1]?.n).toBe('3')
    expect(a.pause?.gaps.map((g) => g.id)).toEqual(['admin-khusus-A'])
    const withD = runScenario(d, { ...d.defaults(), p: ['D'], sku: ['D-01', 'D-02', 'D-03', 'D-04'], sa: 'khusus' }, {})
    expect(withD.status).toBe('partial')
    // Rp 12.000.000 a month direct to D, over D's 2 POs in the engine month
    expect(withD.rows[2]?.out?.rate?.value).toBe(6_000_000)
  })

  it('every figure in every preset carries a badge, and no step runs on an unbadged value', () => {
    for (const p of d.presets) {
      const run = runScenario(d, p.inputs, {})
      const figs = figsOf(run)
      expect(figs.length).toBeGreaterThan(20)
      for (const f of figs) expect(BADGES).toContain(f.badge)
      for (const l of d.preview(p.inputs)) for (const f of l.f ?? []) expect(BADGES).toContain(f.badge)
      for (const r of d.previewTable?.(p.inputs)?.rows ?? []) for (const f of r.cells) expect(BADGES).toContain(f.badge)
    }
  })

  it('rows sum to the totals and per unit × units = total', () => {
    const run = runScenario(d, d.presets[1]?.inputs ?? d.defaults(), {})
    const done = run.rows.filter((r) => r.state === 'done')
    expect(done.reduce((s, r) => s + (r.out?.cost.value ?? 0), 0)).toBeCloseTo(run.total.value, 6)
    expect(run.perUnit.value * run.units.value).toBeCloseTo(run.total.value, 6)
  })
})

describe('distribusi scenario · URL and engine', () => {
  it('two runs from the same URL give identical ledgers', () => {
    const inputs = { ...d.defaults(), sa: 'khusus' as const }
    const enc = encodeScenario('distribusi', d.dataHash(), inputs, { 'admin-khusus-A': 9_000_000 })
    const once = (): string => {
      const dec = decodeScenario(enc)
      if (!dec.ok) throw new Error(dec.error)
      return JSON.stringify(runScenario(d, d.normalize(dec.saved.i), dec.saved.a))
    }
    expect(once()).toBe(once())
    const dec = decodeScenario(enc)
    expect(dec.ok && d.normalize(dec.saved.i)).toEqual(inputs)
    expect(dec.ok && dec.saved.h).toBe(d.dataHash())
  })

  it('normalize drops unknown principals and SKUs and keeps a valid scenario', () => {
    const n = d.normalize({ p: ['A', 'Z'], sku: ['A-01', 'B-01', 'nope'], vol: 50, vu: 'liter', ch: 'b2b' })
    expect(n.p).toEqual(['A'])
    expect(n.sku).toEqual(['A-01'])
    expect(n.vu).toBe('palet')
    expect(d.validate(n)).toEqual({})
  })

  it('validates the drawer: volume, SKUs, drops against stores, D on B2C', () => {
    const e = d.validate({ ...d.defaults(), vol: 0, sku: [], drops: 20, stores: 5, p: ['A', 'D'], ch: 'mix', mix: 0 })
    expect(Object.keys(e).sort()).toEqual(['ch', 'drops', 'mix', 'sku', 'vol'])
  })

  it('running scenarios never changes an engine number', () => {
    const before = engineFingerprint()
    for (const p of d.presets) runScenario(d, p.inputs, {})
    runScenario(d, { ...d.defaults(), stock: 'asumsi', sa: 'khusus' }, { 'stok-A': 100, 'transit-A': 0, 'admin-khusus-A': 1 })
    expect(engineFingerprint()).toBe(before)
  })
})
