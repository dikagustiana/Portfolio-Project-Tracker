// The ledger panel (Brief B6 §3): one row per step — step, role, driver quantity and unit, rate,
// cost, cumulative cost, cost per scenario unit, each with its source badge — grouped by team
// and collapsible. Rows appear as the director reaches them; the current row is highlighted and
// shows its working. Steps not yet wired are listed as such.
import { useEffect, useRef, useState } from 'react'
import { sum } from '../figure.ts'
import type { Fig, Row, Run } from '../types.ts'
import { FigView } from './Fig.tsx'

export function Ledger({ run, shown, current, count, onGoto }: { run: Run; shown: number; current: number; count: number; onGoto: (playIdx: number) => void }) {
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const played = run.rows.filter((r) => r.state === 'done' || r.state === 'paused')
  const visible = played.slice(0, shown + 1)
  const doneVisible = visible.filter((r) => r.state === 'done')
  const total = doneVisible.at(-1)?.cum
  const perUnit = total ? doneVisible.reduce<Fig[]>((a, r) => (r.perUnit ? [...a, r.perUnit] : a), []) : []
  const teams = [...new Set(visible.map((r) => r.team))]
  const rest = run.rows.filter((r) => !visible.includes(r))
  const cur = played[current]
  return (
    <div className="sc-ledger" aria-label="Buku biaya skenario">
      <div className="yd-head">
        <span className="yd-kicker">Buku biaya skenario</span>
      </div>
      <p className="sc-total">
        {total ? <FigView f={total} strong /> : <span>Rp 0</span>}
        {perUnit.length > 0 && <FigView f={sum(`Biaya per ${run.units.unit} s.d. langkah ini`, `Rp/${run.units.unit}`, perUnit)} />}
      </p>
      {teams.map((team) => {
        const rows = visible.filter((r) => r.team === team)
        const costs = rows.map((r) => r.out?.cost).filter((x): x is Fig => !!x)
        const open = !closed.has(team) || rows.some((r) => r === cur)
        return (
          <section key={team} className="sc-team">
            <button
              type="button"
              className="sc-teamhead"
              aria-expanded={open}
              onClick={() => setClosed((s) => {
                const n = new Set(s)
                if (n.has(team)) n.delete(team)
                else n.add(team)
                return n
              })}
            >
              <span>{open ? '▾' : '▸'}</span>
              <b>{team}</b>
              <small>{rows.length} langkah</small>
              {costs.length > 0 && <FigView f={sum(`Biaya ${team}`, 'Rp', costs)} />}
            </button>
            {open && (
              <ol className="sc-rows">
                {rows.map((r) => (
                  <LedgerRow key={r.n} r={r} now={r === cur} count={count} unit={run.units.unit} asm={run.assumptions} onGoto={() => onGoto(played.indexOf(r))} />
                ))}
              </ol>
            )}
          </section>
        )
      })}
      {rest.length > 0 && (
        <section className="sc-rest" aria-label="Langkah berikutnya">
          <span className="yd-kicker">Berikutnya</span>
          <ol>
            {rest.map((r) => (
              <li key={r.n} className={r.state}>
                <span className="sc-n">{r.n}</span>
                {r.title}
                <small>{r.state === 'unwired' ? 'menyusul (S1)' : r.state === 'pending' ? 'setelah asumsi' : ''}</small>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}

function LedgerRow({ r, now, count, unit, asm, onGoto }: { r: Row; now: boolean; count: number; unit: string; asm: Run['assumptions']; onGoto: () => void }) {
  const o = r.out
  const ref = useRef<HTMLLIElement>(null)
  // the current row scrolls into the panel's view (only the panel scrolls, never the page)
  useEffect(() => {
    const li = ref.current
    const panel = li?.closest('.yd-panel')
    if (!now || !li || !panel) return
    const r = li.getBoundingClientRect()
    const p = panel.getBoundingClientRect()
    if (r.top < p.top || r.bottom > p.bottom) panel.scrollTop += r.top - p.top - 8
  }, [now])
  return (
    <li ref={ref} className={`sc-row${now ? ' now' : ''}${r.state === 'paused' ? ' paused' : ''}`} aria-current={now ? 'step' : undefined}>
      <button type="button" className="sc-rowhead" onClick={onGoto} title={`Ke langkah ${r.n} dari ${count}`}>
        <span className="sc-n">{r.n}</span>
        <span className="sc-rt">
          <b>{r.title}</b>
          <small>{r.role}</small>
        </span>
      </button>
      {r.state === 'paused' ? (
        <p className="sc-wait">Menunggu asumsi</p>
      ) : (
        o && (
          <div className="sc-calc" aria-label={`Driver, tarif dan biaya langkah ${r.n}`}>
            <p>
              <span className="sc-k">driver</span> {o.driver ? <FigView f={o.driver} /> : '—'} <span className="sc-k">× tarif</span> {o.rate ? <FigView f={o.rate} /> : '—'}
            </p>
            <p>
              <span className="sc-k">biaya</span> <FigView f={o.cost} signed strong />
            </p>
            <p>
              <span className="sc-k">kumulatif</span> {r.cum && <FigView f={r.cum} />} <span className="sc-k">· per {unit}</span> {r.perUnit && <FigView f={r.perUnit} />}
            </p>
          </div>
        )
      )}
      {now && o && (
        <div className="sc-work">
          <span className="yd-kicker">Hitungan langkah {r.n}</span>
          <dl className="sc-cells">
            {o.detail.map((d) => (
              <Detail key={d.label} k={d.label} v={d.value} />
            ))}
          </dl>
          {o.notes?.map((n) => (
            <p key={n} className="yd-notes">
              {n}
            </p>
          ))}
          {r.used.length > 0 && <p className="sc-help">Memakai asumsi skenario: {r.used.map((id) => asm.find((a) => a.gap.id === id)?.gap.label ?? id).join(' · ')}</p>}
        </div>
      )}
    </li>
  )
}

function Detail({ k, v }: { k: string; v: Fig | string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{typeof v === 'string' ? v : <FigView f={v} />}</dd>
    </>
  )
}
