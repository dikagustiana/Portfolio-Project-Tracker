// The scenario runner (Brief B6 §2): walks a world's steps in order with the drawer's inputs and
// the assumptions entered so far. A step that needs a value the engine lacks stops the run there
// (status "paused") until the value is entered; a step that is listed but not wired yet ends the
// run as "partial". The same inputs and assumptions always give the same rows.
import { calc, fig, sum } from './figure.ts'
import type { Assumptions, Fig, GapDef, Row, Run, ScenarioDef, StepCtx } from './types.ts'

export function runScenario<I, S>(def: ScenarioDef<I, S>, inputs: NoInfer<I>, asm: Assumptions): Run {
  const units = def.units(inputs)
  let state = def.init(inputs)
  const rows: Row[] = []
  const assumptions: Run['assumptions'] = []
  let status: Run['status'] = 'done'
  let pause: Run['pause']
  let cum: Fig = fig('Biaya kumulatif', 0, 'Rp', 'hitungan', { formula: 'belum ada langkah', inputs: [] })
  const costs: Fig[] = []

  def.steps.forEach((step, index) => {
    const base = { index, n: step.n, title: step.title(inputs), role: step.role(inputs), team: step.team, used: [] as string[], stage: step.stage(inputs, state) }
    if (status !== 'done') {
      rows.push({ ...base, state: step.run ? 'pending' : 'unwired' })
      return
    }
    if (!step.run) {
      status = 'partial'
      rows.push({ ...base, state: 'unwired' })
      return
    }
    const declared = new Map<string, GapDef>()
    const ctx: StepCtx<I, S> = {
      inputs,
      state,
      has: (id) => asm[id] !== undefined && Number.isFinite(asm[id]),
      asm: (id) => {
        const g = declared.get(id)
        const v = asm[id]
        if (!g || v === undefined) throw new Error(`asumsi ${id} tidak dideklarasikan atau belum diisi`)
        return fig(g.label, v, g.unit, 'asumsi', { asm: id })
      },
    }
    const gaps = step.gaps?.(ctx) ?? []
    for (const g of gaps) declared.set(g.id, g)
    const missing = gaps.filter((g) => !ctx.has(g.id))
    if (missing.length) {
      status = 'paused'
      pause = { index, gaps: missing }
      for (const g of gaps) if (ctx.has(g.id)) assumptions.push({ gap: g, step: step.n, index, value: asm[g.id] as number })
      rows.push({ ...base, state: 'paused' })
      return
    }
    const r = step.run(ctx)
    state = r.state
    costs.push(r.out.cost)
    cum = sum('Biaya kumulatif', 'Rp', [...costs])
    const perUnit = calc(`Biaya langkah ${step.n} per ${units.unit}`, `Rp/${units.unit}`, '{0} ÷ {1}', [r.out.cost, units], (c, u) => (u > 0 ? c / u : 0))
    for (const g of gaps) assumptions.push({ gap: g, step: step.n, index, value: asm[g.id] as number })
    rows.push({ ...base, stage: step.stage(inputs, state), state: 'done', out: r.out, cum, perUnit, used: gaps.map((g) => g.id) })
  })

  const total = cum
  const perUnit = calc(`Biaya per ${units.unit}`, `Rp/${units.unit}`, '{0} ÷ {1}', [total, units], (c, u) => (u > 0 ? c / u : 0))
  return { world: def.world, rows, status, pause, units, total, perUnit, assumptions, hash: def.dataHash() }
}

/** rows that played: those that ran, and the one waiting for a value */
export const playable = (run: Run): Row[] => run.rows.filter((r) => r.state === 'done' || r.state === 'paused')

/** cost per team over the rows that ran, in the scenario's team order (teams with no row left out) */
export function byTeam(run: Run, teams: string[]): { team: string; cost: Fig; rows: Row[] }[] {
  const out: { team: string; cost: Fig; rows: Row[] }[] = []
  const order = [...teams, ...run.rows.map((r) => r.team).filter((t) => !teams.includes(t))]
  for (const team of [...new Set(order)]) {
    const rows = run.rows.filter((r) => r.team === team && r.state === 'done')
    if (!rows.length) continue
    out.push({ team, rows, cost: sum(`Biaya ${team}`, 'Rp', rows.map((r) => r.out?.cost).filter((x): x is Fig => !!x)) })
  }
  return out
}
