// Pipeline tab (prototype viewKanban + bindKanban): one column per stage, HTML5 drag between
// columns. A drop hands the move to flows.moveTo, which decides (submit flow, review, …).
import { useState } from 'react'
import { ChipView, CkBtn, Flags, WhoLine } from '../../app/bits.tsx'
import { useFlows } from '../../app/flows.ts'
import { useBoard } from '../../data/board-context.ts'
import { range, STAGES } from '../../domain/index.ts'
import type { Id, Project, Stage, Task } from '../../domain/index.ts'
import { useReadOnly } from './hooks.ts'

export function Kanban({ p, ts }: { p: Project; ts: readonly Task[] }) {
  const { d } = useBoard()
  const flows = useFlows()
  const ro = useReadOnly(p)
  const g = d.gated(p)
  const [dragging, setDragging] = useState<Id | null>(null)
  const [over, setOver] = useState<Stage | null>(null)

  return (
    <>
      <div className="kanban">
        {STAGES.map((s) => {
          const cards = ts.filter((t) => t.stage === s.id)
          return (
            <section
              key={s.id}
              className={`kcol${over === s.id ? ' over' : ''}`}
              aria-label={s.name}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(s.id)
              }}
              onDragLeave={(e) => {
                if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) setOver((o) => (o === s.id ? null : o))
              }}
              onDrop={(e) => {
                e.preventDefault()
                setOver(null)
                setDragging(null)
                const t = d.task(e.dataTransfer.getData('text/plain'))
                // Same column is a no-op (prototype moveTo's first check).
                if (t && t.projectId === p.id && t.stage !== s.id) flows.moveTo(t.id, s.id)
              }}
            >
              <div className="kcol-h">
                <span className={`dot s-${s.id}`} style={{ background: 'var(--sc)', borderRadius: '50%' }} />
                <div>
                  {s.name}
                  {g && s.hint && (
                    <>
                      <br />
                      <small>{s.hint}</small>
                    </>
                  )}
                </div>
                <span className="n">{cards.length}</span>
              </div>
              {cards.length ? (
                cards.map((t) => (
                  <KCard
                    key={t.id}
                    t={t}
                    p={p}
                    draggable={!ro && !d.locked(t) && !(g && d.isDone(t))}
                    dragging={dragging === t.id}
                    onDrag={setDragging}
                  />
                ))
              ) : (
                <div className="kempty">{ro ? 'Kosong' : 'Tarik task ke sini'}</div>
              )}
            </section>
          )
        })}
      </div>
      <p className="sub" style={{ marginTop: 10 }}>
        {g
          ? 'Tarik ke Diperiksa untuk mengajukan dengan bukti. Kolom Selesai hanya terisi lewat penerimaan pemeriksa.'
          : 'Tarik kartu antar kolom untuk memindahkan tahap.'}{' '}
        Di ponsel, ketuk kartu untuk membuka detail.
      </p>
    </>
  )
}

interface CardProps {
  t: Task
  p: Project
  draggable: boolean
  dragging: boolean
  onDrag: (id: Id | null) => void
}

function KCard({ t, p, draggable, dragging, onDrag }: CardProps) {
  const { d } = useBoard()
  const flows = useFlows()
  const m = d.mstone(t.milestoneId)
  const par = t.parentId ? d.task(t.parentId) : undefined
  const pkg = d.hasChildren(t) ? d.taskProg(t) : null
  return (
    <article
      className={`kcard s-${t.stage}${dragging ? ' dragging' : ''}`}
      draggable={draggable}
      tabIndex={0}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', t.id)
        e.dataTransfer.effectAllowed = 'move'
        onDrag(t.id)
      }}
      onDragEnd={() => onDrag(null)}
      onClick={() => flows.openTask(t.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) flows.openTask(t.id)
      }}
    >
      <div className="tt">
        {t.ref && <span className="ref">{t.ref}</span>}
        {t.title}
      </div>
      <div className="line2">
        <WhoLine t={t} p={p} />
      </div>
      <div className="line2">
        {m ? `${d.msNo(m)} · ` : ''}
        {par ? `paket ${par.ref} · ` : ''}
        {range(t.start, t.end)}
        {pkg ? ` · ${pkg.d}/${pkg.n} sub-task` : ''}
      </div>
      <Flags t={t} p={p} />
      <div className="f">
        <ChipView chip={d.statusChip(t)} />
        <CkBtn t={t} />
      </div>
    </article>
  )
}
