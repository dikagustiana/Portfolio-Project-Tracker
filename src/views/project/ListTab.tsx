// Checklist tab (prototype viewList): filtered tasks grouped per milestone, then "Tanpa milestone".
// Sub-tasks sit under their package; counts are over leaf tasks, like every progress number.
import { TRow } from '../../app/bits.tsx'
import { useBoard } from '../../data/board-context.ts'
import { MS_LABEL } from '../../domain/index.ts'
import type { Project, Task } from '../../domain/index.ts'
import { listGroups, nestRows } from './model.ts'

export function NoMatch() {
  return (
    <div className="panel">
      <div className="empty">Tidak ada task yang cocok dengan filter.</div>
    </div>
  )
}

export function ListTab({ p, ts }: { p: Project; ts: readonly Task[] }) {
  const { d } = useBoard()
  if (!ts.length) return <NoMatch />
  return (
    <div className="panel">
      {listGroups(d, p, ts)
        .filter((g) => g.rows.length)
        .map((g) => (
          <div key={g.key} className="group">
            <div className="group-h">
              {g.label}
              <span className="n">
                {g.rows.filter((t) => d.isLeaf(t) && d.isDone(t)).length}/{g.rows.filter(d.isLeaf).length}
              </span>
              {g.state && <span className={`chip ${g.state}`}>{MS_LABEL[g.state]}</span>}
            </div>
            {nestRows(g.rows).map(({ t, kids }) => (
              <div key={t.id}>
                <TRow t={t} p={p} />
                {kids.map((k) => (
                  <TRow key={k.id} t={k} p={p} child />
                ))}
              </div>
            ))}
          </div>
        ))}
      {d.gated(p) && (
        <p className="sub" style={{ margin: '12px 4px 0' }}>
          Centang kotak untuk mengajukan task selesai dengan bukti. Task baru dihitung selesai setelah pemeriksa menerimanya.
        </p>
      )}
    </div>
  )
}
