// Aktivitas tab (spec §44): the project's history in plain language, from project_events (who did
// what to which record, when). Project admins also see what the structure migration could not
// map with confidence, and mark each item once they have checked it.
import { useState } from 'react'
import { peek } from '../../app/nav.ts'
import { useBoard } from '../../data/board-context.ts'
import { fmtTs } from '../../domain/index.ts'
import type { MigrationFlag, Project, ProjectEvent } from '../../domain/index.ts'
import { useAct } from '../record/act.ts'
import { RefTag, Section, Timeline } from '../record/parts.tsx'

type Filter = 'all' | 'task' | 'milestone' | 'ask' | 'member' | 'project'
const FILTERS: [Filter, string][] = [
  ['all', 'Semua'],
  ['task', 'Task'],
  ['milestone', 'Milestone'],
  ['ask', 'Keputusan'],
  ['member', 'Anggota'],
  ['project', 'Project'],
]

export function ActivityTab({ p }: { p: Project }) {
  const { d, board } = useBoard()
  const [f, setF] = useState<Filter>('all')
  const all = d.projectEvents(p.id)
  const events = f === 'all' ? all : all.filter((e: ProjectEvent) => e.objectType === f)
  const flags = d.isAdminIn(p.id) ? board.flags.filter((x) => x.projectId === p.id && !x.resolvedAt) : []
  return (
    <div className="col">
      {flags.length > 0 && <Flags flags={flags} />}
      <Section title="Aktivitas project" n={events.length}>
        <div className="seg" role="group" aria-label="Filter aktivitas" style={{ marginBottom: 10 }}>
          {FILTERS.map(([k, l]) => (
            <button key={k} className={f === k ? 'on' : ''} aria-pressed={f === k} onClick={() => setF(k)}>
              {l}
            </button>
          ))}
        </div>
        <Timeline events={events} limit={40} withObject empty="Belum ada aktivitas tercatat untuk filter ini." />
      </Section>
    </div>
  )
}

const FLAG_LABEL: Record<string, string> = {
  dep_unresolved: 'Prasyarat tidak ditemukan',
  dep_cycle: 'Prasyarat melingkar',
  inchstone_unparsed: 'Baris bukti tidak terbaca',
  function_alias: 'Nama fungsi disamakan',
  dates_unparsed: 'Tanggal tidak terbaca',
  accepted_with_package: 'Sub-task ikut diterima bersama paket',
  package_in_review: 'Paket sedang diperiksa',
  pic_from_package: 'PIC sub-task diambil dari paket',
}

/** "Perlu dicek setelah migrasi": mappings the extraction made with less than full confidence. */
function Flags({ flags }: { flags: MigrationFlag[] }) {
  const { d, actions } = useBoard()
  const { busy, err, run } = useAct()
  return (
    <Section title="Perlu dicek setelah migrasi" n={flags.length}>
      <div className="sub" style={{ marginBottom: 8 }}>
        Struktur sub-task dan prasyarat dibaca dari deskripsi lama. Hal di bawah ini dipetakan dengan asumsi; cek, betulkan bila perlu, lalu tandai beres.
      </div>
      {err && <div className="err">{err}</div>}
      <div className="rows">
        {flags.map((x) => {
          const t = x.ref ? d.task(d.resolveRecord(x.projectId, 'task', x.ref)) : undefined
          return (
            <div key={x.id} className="li static">
              <RefTag r={x.ref || '—'} />
              <div style={{ minWidth: 0 }}>
                <div className="tt">{FLAG_LABEL[x.code] ?? x.code}</div>
                <div className="sub" style={{ whiteSpace: 'normal' }}>
                  {x.detail} · {fmtTs(x.createdAt)}
                </div>
              </div>
              <div className="end">
                {t && (
                  <button className="btn sm ghost" onClick={() => peek(d, { kind: 'task', id: t.id })}>
                    Buka
                  </button>
                )}
                <button className="btn sm" disabled={busy} onClick={() => void run(() => actions.resolveMigrationFlag(x.id), 'Ditandai sudah dicek')}>
                  Sudah dicek
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
