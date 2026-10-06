// Value chain strip and tab (prototype vcCell, vcStrip, viewVC). Steps come from the project's
// step template: chain + output steps form the strip (output = the outlined Report box), side
// steps sit in the footer next to the note (Logistics services). VcStrip is also used by the
// dashboard with link=true, where a step opens the project's Value chain tab on that step.
import type { CSSProperties } from 'react'
import { TRow } from '../../app/bits.tsx'
import { setUI, useUI } from '../../app/ui.ts'
import { useBoard } from '../../data/board-context.ts'
import type { Project, Task, TemplateStep } from '../../domain/index.ts'
import { useGo } from './hooks.ts'
import { vcGroups, vcSelected } from './model.ts'

/** The prototype grid is sized for its ten strip steps; other templates get a matching grid. */
const PROTOTYPE_STRIP = 10

function VcCell({ p, s, sel, link }: { p: Project; s: TemplateStep; sel: string; link: boolean }) {
  const { d } = useBoard()
  const ui = useUI()
  const go = useGo()
  const st = d.vcStat(p.id, s.code)
  const pc = st.n ? Math.round((st.done / st.n) * 100) : 0
  const pr = st.n ? Math.round((st.rev / st.n) * 100) : 0
  const lbl = d.vcLabel(s)
  const cls = ['vcs', s.kind === 'output' && 'rep', s.kind === 'side' && 'lp', sel === s.code && 'on'].filter(Boolean).join(' ')
  const onClick = () => {
    if (link) go({ view: 'project', pid: p.id, who: 'all', q: '', vcStep: s.code, tab: 'vc' })
    else setUI({ vcStep: ui.vcStep === s.code ? '' : s.code, tab: 'vc' })
  }
  return (
    <button className={cls} title={`${lbl} — ${s.need}`} aria-label={`${lbl}: ${st.n ? `${pc} persen diterima` : 'belum ada paket'}`} onClick={onClick}>
      <span className="vch">{lbl}</span>
      {st.n ? (
        <>
          <span className="vcb" aria-hidden="true">
            <i className="d" style={{ width: `${pc}%` }} />
            <i className="r" style={{ width: `${pr}%` }} />
          </span>
          <span className="vcm">
            <b>{pc}%</b> diterima
          </span>
          <span className="vcm">
            {st.done} dari {st.n} paket
          </span>
          <span className="vck">
            <span>
              PIC {st.pic}/{st.n}
            </span>
            <span>
              Komit {st.com}/{st.n}
            </span>
            {st.late > 0 && <span className="late">{st.late} telat</span>}
          </span>
        </>
      ) : (
        <>
          <span className="vcb empty" aria-hidden="true" />
          <span className="vcm">Belum ada paket</span>
        </>
      )}
    </button>
  )
}

/** The value chain strip with its footer (prototype vcStrip). Renders nothing without a template. */
export function VcStrip({ p, sel = '', link = false }: { p: Project; sel?: string; link?: boolean }) {
  const { d } = useBoard()
  const vs = d.vcSteps(p)
  if (!vs) return null
  const none = d.ptasks(p.id).filter((t) => !d.vcOf(t).length).length
  const n = vs.strip.length
  const grid: CSSProperties | undefined =
    n === PROTOTYPE_STRIP ? undefined : { gridTemplateColumns: `repeat(${n},minmax(94px,1fr))`, minWidth: n * 98 }
  const note = (
    <p className="sub">
      Bar = paket yang sudah <b>diterima</b> pemeriksa (yang sedang diperiksa ditampilkan lebih pucat). PIC dan komit
      mengikuti baris <i>Supplied by</i> dan <i>Due date</i> di deck kick-off.
      {none ? ` ${none} paket lain tidak masuk value chain (fondasi, BAU, planning).` : ''}
    </p>
  )
  const cell = (s: TemplateStep) => <VcCell key={s.id} p={p} s={s} sel={sel} link={link} />
  return (
    <>
      <div className="vcwrap">
        <div className="vc" style={grid}>
          {vs.strip.map(cell)}
        </div>
      </div>
      <div className="vcfoot" style={vs.side.length ? undefined : { gridTemplateColumns: 'minmax(0,1fr)' }}>
        {vs.side.length > 1 ? <div style={{ display: 'grid', gap: 10 }}>{vs.side.map(cell)}</div> : vs.side.map(cell)}
        {note}
      </div>
    </>
  )
}

/** Value chain tab (prototype viewVC): the strip, then the filtered tasks grouped per step. */
export function ValueChainTab({ p, ts }: { p: Project; ts: readonly Task[] }) {
  const { d } = useBoard()
  const ui = useUI()
  const sel = vcSelected(d, p, ui.vcStep)
  const groups = vcGroups(d, p, ts, sel)
  return (
    <>
      <section className="panel" style={{ marginBottom: 16 }}>
        <VcStrip p={p} sel={sel} />
      </section>
      <div className="panel">
        {sel && (
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="sub">Menampilkan satu step. Klik step lain di atas, atau</span>
            <button className="btn sm" onClick={() => setUI({ vcStep: '', tab: 'vc' })}>
              Tampilkan semua step
            </button>
          </div>
        )}
        {groups.length ? (
          groups.map((g) => (
            <div key={g.step?.id ?? ''} className="group">
              <div className="group-h">
                {g.title}
                <span className="n">
                  {g.rows.filter(d.isDone).length}/{g.rows.length}
                </span>
              </div>
              <div className="sub" style={{ margin: '-4px 0 8px' }}>
                {g.need}
              </div>
              {g.rows.map((t) => (
                <TRow key={t.id} t={t} p={p} />
              ))}
            </div>
          ))
        ) : (
          <div className="empty">Tidak ada task yang cocok dengan filter.</div>
        )}
      </div>
    </>
  )
}
