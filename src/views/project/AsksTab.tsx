// Keputusan tab (spec §43): the project's open decision requests, then its decision log (gates,
// project close/reopen and Keputusan answers, append-only). Anyone working on the project may
// raise a Keputusan; the pemutus decides from the record.
import { Icon } from '../../app/bits.tsx'
import { useFlows } from '../../app/flows.ts'
import { useBoard } from '../../data/board-context.ts'
import { fmt } from '../../domain/index.ts'
import type { Project } from '../../domain/index.ts'
import { DecisionRows } from '../lists.tsx'
import { RecordLine, Section } from '../record/parts.tsx'
import { decisionLog, openAsks } from './model.ts'

export function AsksTab({ p }: { p: Project }) {
  const { d, today } = useBoard()
  const flows = useFlows()
  const open = openAsks(d, p)
  const log = decisionLog(d, p)
  const canAsk = d.canContribute(p.id) && !d.locked(p)
  return (
    <div className="col">
      <Section title="Menunggu keputusan" n={open.length}>
        {canAsk && (
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="sub">Catat hal yang harus diputuskan sebelum pekerjaan bisa lanjut: apa, konteksnya, pilihannya, siapa pemutusnya dan kapan.</span>
            <button className="btn sm primary" onClick={() => flows.newAsk(p.id)}>
              <Icon name="plus" /> Keputusan baru
            </button>
          </div>
        )}
        {open.length ? (
          <div className="rows">
            {open.map((a) => {
              const m = d.mstone(a.milestoneId)
              return (
                <RecordLine
                  key={a.id}
                  target={{ kind: 'ask', id: a.id }}
                  r={a.ref}
                  title={a.question}
                  sub={`Pemutus ${d.mname(d.deciderOf(a)) || 'Project Admin'}${m ? ` · ${d.msNo(m)}` : ''}${a.taskIds.length ? ` · ${a.taskIds.length} task terkait` : ''}${a.createdBy ? ` · diminta ${d.mname(a.createdBy)}` : ''}`}
                  tone={a.due && a.due < today ? 'red' : 'amber'}
                  label={a.due ? (a.due < today ? `Lewat ${fmt(a.due)}` : `Batas ${fmt(a.due)}`) : 'Tanpa batas'}
                />
              )
            })}
          </div>
        ) : (
          <div className="empty-line">Tidak ada keputusan yang ditunggu di project ini.</div>
        )}
      </Section>
      <Section title="Log keputusan" n={log.length}>
        <DecisionRows items={log} showProject={false} empty="Belum ada keputusan. Keputusan milestone, project dan Keputusan yang dijawab tercatat di sini." />
      </Section>
    </div>
  )
}
