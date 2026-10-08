// Keputusan (spec §43): decision requests across every project the viewer can read. First what
// the viewer must decide, then all open requests, then the latest decisions from the immutable
// log (gates, projects and Keputusan alike). Anyone working on a project may raise one.
import { useState } from 'react'
import { Head, Icon } from '../app/bits.tsx'
import { useFlows } from '../app/flows.ts'
import { useBoard } from '../data/board-context.ts'
import { fmt } from '../domain/index.ts'
import type { Ask } from '../domain/index.ts'
import { DecisionRows } from './lists.tsx'
import { RecordLine, Section } from './record/parts.tsx'

export function Decisions() {
  const { d, board, today } = useBoard()
  const flows = useFlows()
  const [only, setOnly] = useState<'all' | 'late' | 'nodue'>('all')
  const [pick, setPick] = useState('')
  const mine = d.asksFor('')
  const open = d.openAsks().filter((a) => (only === 'late' ? !!a.due && a.due < today : only === 'nodue' ? !a.due : true))
  const raiseIn = board.projects.filter((p) => d.canContribute(p.id) && d.pActive(p))
  const log = [...board.decisions].sort((a, b) => b.at - a.at).slice(0, 20)
  const line = (a: Ask) => (
    <RecordLine
      key={a.id}
      target={{ kind: 'ask', id: a.id }}
      r={a.ref}
      title={a.question}
      sub={`${d.project(a.projectId)?.name ?? ''} · pemutus ${d.mname(d.deciderOf(a)) || 'PM project'}${a.createdBy ? ` · diminta ${d.mname(a.createdBy)}` : ''}`}
      tone={a.due && a.due < today ? 'red' : 'amber'}
      label={a.due ? (a.due < today ? `Lewat ${fmt(a.due)}` : `Batas ${fmt(a.due)}`) : 'Tanpa batas'}
    />
  )
  return (
    <>
      <Head
        eyebrow="Keputusan yang dibutuhkan dan yang sudah diambil"
        title="Keputusan"
        actions={
          raiseIn.length > 0 && (
            <div className="row" style={{ gap: 6 }}>
              {raiseIn.length > 1 && (
                <select className="inp" style={{ width: 'auto' }} value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Project untuk keputusan baru">
                  <option value="">Pilih project…</option>
                  {raiseIn.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                className="btn primary"
                disabled={raiseIn.length > 1 && !pick}
                onClick={() => flows.newAsk(raiseIn.length === 1 ? (raiseIn[0]?.id ?? '') : pick)}
              >
                <Icon name="plus" /> Keputusan baru
              </button>
            </div>
          )
        }
      />
      <div className="col">
        <Section title="Menunggu keputusanmu" n={mine.length}>
          {mine.length ? <div className="rows">{mine.map(line)}</div> : <div className="empty-line">Tidak ada keputusan yang menunggu kamu.</div>}
        </Section>
        <Section title="Semua keputusan terbuka" n={open.length}>
          <div className="seg" role="group" aria-label="Filter keputusan" style={{ marginBottom: 8 }}>
            {(
              [
                ['all', 'Semua'],
                ['late', 'Lewat batas'],
                ['nodue', 'Tanpa batas'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} className={only === k ? 'on' : ''} onClick={() => setOnly(k)}>
                {l}
              </button>
            ))}
          </div>
          {open.length ? <div className="rows">{open.map(line)}</div> : <div className="empty-line">Tidak ada keputusan yang terbuka.</div>}
        </Section>
        <Section title="Keputusan terakhir" n={log.length}>
          <DecisionRows items={log} />
        </Section>
      </div>
    </>
  )
}
