// Value chain as compact progress modules (spec §36–37; prototype vcCell/vcStrip/viewVC). Steps
// come from the project's step template: chain and output steps first (Appraise … Report), side
// steps (Logistics services) after them. Each module shows leaf progress first, then one status
// line; colour is a small signal: green complete, indigo active, amber attention, red blocked or
// late, grey not started. Used by the project's Value chain tab and the Portofolio preview.
import { TRow } from '../../app/bits.tsx'
import { setUI, useUI } from '../../app/ui.ts'
import { useBoard } from '../../data/board-context.ts'
import type { Project, Task, TemplateStep, VcState } from '../../domain/index.ts'
import { useGo } from './hooks.ts'
import { vcGroups, vcSelected } from './model.ts'

const TONE: Record<VcState, string> = { done: 'green', active: 'indigo', attention: 'amber', blocked: 'red', idle: 'grey' }

function Module({ p, s, sel, link }: { p: Project; s: TemplateStep; sel: string; link: boolean }) {
  const { d } = useBoard()
  const ui = useUI()
  const go = useGo()
  const m = d.vcModule(p.id, s.code)
  const onClick = () => {
    if (link) go({ view: 'project', pid: p.code || p.id, who: 'all', q: '', vcStep: s.code, tab: 'vc', peek: null })
    else setUI({ vcStep: ui.vcStep === s.code ? '' : s.code, tab: 'vc' })
  }
  return (
    <button
      className={`vcm tone-${TONE[m.state]}${s.kind === 'side' ? ' side' : ''}${sel === s.code ? ' sel' : ''}`}
      title={`${d.vcLabel(s)} — ${s.need}`}
      aria-label={`${s.name}: ${m.stat.n ? `${m.prog.p} persen, ${m.prog.d} dari ${m.prog.n} task` : 'belum ada task'}, ${m.note}`}
      onClick={onClick}
    >
      <span className="nm">{s.name}</span>
      <span className="pc">{m.stat.n ? `${m.prog.p}%` : '–'}</span>
      <div className={`pbar tone-${TONE[m.state]}`} aria-hidden="true">
        <i style={{ width: `${m.prog.p}%` }} />
      </div>
      <span className="ft">
        <span>{m.stat.n ? `${m.prog.d} / ${m.prog.n} task` : 'Belum ada task'}</span>
        <span className={`tag tone-${TONE[m.state]}`}>{m.note}</span>
      </span>
    </button>
  )
}

/** The project's value chain as modules. Renders nothing without a template. */
export function VcModules({ p, sel = '', link = false }: { p: Project; sel?: string; link?: boolean }) {
  const { d } = useBoard()
  const vs = d.vcSteps(p)
  if (!vs) return null
  return (
    <div className="vcmods" role="list" aria-label="Progress value chain">
      {[...vs.strip, ...vs.side].map((s) => (
        <Module key={s.id} p={p} s={s} sel={sel} link={link} />
      ))}
    </div>
  )
}

/** Value chain tab (prototype viewVC): the modules, then the filtered tasks grouped per step. */
export function ValueChainTab({ p, ts }: { p: Project; ts: readonly Task[] }) {
  const { d } = useBoard()
  const ui = useUI()
  const sel = vcSelected(d, p, ui.vcStep)
  const groups = vcGroups(d, p, ts, sel)
  const none = d.leaves(p.id).filter((t) => !d.vcOf(t).length).length
  return (
    <>
      <section className="sec" style={{ marginBottom: 16 }}>
        <div className="sec-h">
          <h2>Progress per step</h2>
          <span className="sub">Dihitung dari task terkecil (sub-task, atau task tanpa sub-task) yang sudah diterima.</span>
        </div>
        <VcModules p={p} sel={sel} />
        {none > 0 && <p className="sub" style={{ margin: '10px 0 0' }}>{none} task lain tidak masuk value chain (fondasi, BAU, planning).</p>}
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
