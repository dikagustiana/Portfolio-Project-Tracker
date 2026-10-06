// Checklist tab (prototype viewList): filtered tasks grouped per milestone, then "Tanpa milestone".
import { TRow } from '../../app/bits.tsx'
import { useBoard } from '../../data/board-context.ts'
import { MS_LABEL } from '../../domain/index.ts'
import type { Project, Task } from '../../domain/index.ts'
import { listGroups } from './model.ts'

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
                {g.rows.filter(d.isDone).length}/{g.rows.length}
              </span>
              {g.state && <span className={`chip ${g.state}`}>{MS_LABEL[g.state]}</span>}
            </div>
            {g.rows.map((t) => (
              <TRow key={t.id} t={t} p={p} />
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
