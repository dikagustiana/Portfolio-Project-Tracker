// Admin · Akses project: who is on which project, with which role (BRIEF §3). Removing someone or
// demoting a PM clears their PIC / pemeriksa / pemutus assignments in that project (database trigger).
import { useState } from 'react'
import { Avatar } from '../../app/bits.tsx'
import { useBoard } from '../../data/board-context.ts'
import { P_LABEL } from '../../domain/index.ts'
import type { Project, ProjectRole } from '../../domain/index.ts'
import { useAdminWrite } from './shared.ts'

const ROLES: [ProjectRole, string, string][] = [
  ['pm', 'Project Manager', 'Merencanakan, memeriksa, memutuskan, menutup project.'],
  ['officer', 'Officer', 'Mengerjakan task miliknya: komit tanggal, kerjakan, ajukan selesai.'],
  ['viewer', 'Viewer', 'Hanya melihat project ini.'],
]
const TOUCHED = ['project_members', 'projects', 'milestones', 'tasks', 'asks', 'people', 'people_contact'] as const

export function AdminAccess() {
  const { board } = useBoard()
  const [personFilter, setPersonFilter] = useState('')
  const projects = [...board.projects].sort((a, b) => a.name.localeCompare(b.name, 'id'))
  return (
    <div className="stack" style={{ maxWidth: 980 }}>
      <section className="panel">
        <div className="panel-h">
          <h2>Akses per orang</h2>
          <select className="inp" style={{ maxWidth: 260 }} value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} aria-label="Pilih orang">
            <option value="">Pilih orang…</option>
            {board.people.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        {personFilter ? (
          <PersonAccess personId={personFilter} projects={projects} />
        ) : (
          <p className="sub" style={{ margin: 0 }}>
            Pilih orang untuk melihat dan mengatur project yang boleh ia lihat. Orang hanya melihat project tempat ia menjadi anggota.
          </p>
        )}
      </section>
      {projects.map((p) => (
        <ProjectAccess key={p.id} p={p} />
      ))}
    </div>
  )
}

/** One person × every project: tick projects and pick a role (e.g. David: MB + MAM only). */
function PersonAccess({ personId, projects }: { personId: string; projects: Project[] }) {
  const { board, d } = useBoard()
  const { run, busy } = useAdminWrite()
  const name = d.mname(personId)
  return (
    <div className="dl">
      {projects.map((p) => {
        const m = board.memberships.find((x) => x.projectId === p.id && x.personId === personId)
        return (
          <div key={p.id} className="dl-item static">
            <span className={`dot g-${p.color || 'samb3'}`} style={{ width: 26, height: 26, borderRadius: 9 }} />
            <div style={{ minWidth: 0 }}>
              <div className="tt">{p.name}</div>
              <div className="sub">
                {p.entity}
                {p.status !== 'aktif' ? ` · ${P_LABEL[p.status]}` : ''}
              </div>
            </div>
            <select
              className="inp"
              style={{ width: 'auto' }}
              disabled={busy}
              value={m?.role ?? ''}
              aria-label={`Peran ${name} di ${p.name}`}
              onChange={(e) => {
                const role = e.target.value as ProjectRole | ''
                void run(
                  (s) =>
                    !role
                      ? s.from('project_members').delete().eq('project_id', p.id).eq('person_id', personId)
                      : m
                        ? s.from('project_members').update({ role }).eq('project_id', p.id).eq('person_id', personId)
                        : s.from('project_members').insert({ project_id: p.id, person_id: personId, role }),
                  !role ? `${name} tidak lagi punya akses ke ${p.name}` : `${name}: ${ROLES.find((r) => r[0] === role)?.[1]} di ${p.name}`,
                  [...TOUCHED],
                )
              }}
            >
              <option value="">Tanpa akses</option>
              {ROLES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )
      })}
    </div>
  )
}

function ProjectAccess({ p }: { p: Project }) {
  const { board, d } = useBoard()
  const { run, busy } = useAdminWrite()
  const [person, setPerson] = useState('')
  const [role, setRole] = useState<ProjectRole>('officer')
  const members = board.memberships.filter((m) => m.projectId === p.id)
  const others = board.people.filter((x) => !members.some((m) => m.personId === x.id))
  return (
    <section className="panel">
      <div className="panel-h">
        <h2>
          <span className={`dot g-${p.color || 'samb3'}`} style={{ marginRight: 8 }} />
          {p.name}
        </h2>
        <span className="sub">
          {p.entity} · {members.length} anggota{d.pmOf(p) ? ` · PM ${d.mname(d.pmOf(p))}` : ' · belum ada PM'}
        </span>
      </div>
      <div className="mlist">
        {members.map((m) => (
          <div key={m.personId} className="mrow">
            <Avatar id={m.personId} size={30} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{d.mname(m.personId)}</div>
              <div className="sub">{ROLES.find((r) => r[0] === m.role)?.[2]}</div>
            </div>
            <select
              className="inp"
              style={{ width: 'auto' }}
              disabled={busy}
              value={m.role}
              aria-label={`Peran ${d.mname(m.personId)}`}
              onChange={(e) =>
                void run(
                  (s) => s.from('project_members').update({ role: e.target.value }).eq('project_id', p.id).eq('person_id', m.personId),
                  'Peran diubah',
                  [...TOUCHED],
                )
              }
            >
              {ROLES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
            <button
              className="btn sm ghost"
              disabled={busy}
              onClick={() =>
                void run(
                  (s) => s.from('project_members').delete().eq('project_id', p.id).eq('person_id', m.personId),
                  `${d.mname(m.personId)} dikeluarkan dari ${p.name}`,
                  [...TOUCHED],
                )
              }
            >
              Keluarkan
            </button>
          </div>
        ))}
        {!members.length && <div className="empty">Belum ada anggota.</div>}
      </div>
      {others.length > 0 && (
        <form
          className="addm"
          style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) auto' }}
          onSubmit={(e) => {
            e.preventDefault()
            if (!person) return
            void run(
              (s) => s.from('project_members').insert({ project_id: p.id, person_id: person, role }),
              `${d.mname(person)} ditambahkan ke ${p.name}`,
              [...TOUCHED],
            ).then((ok) => ok && setPerson(''))
          }}
        >
          <select className="inp" value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Orang">
            <option value="">Tambah orang…</option>
            {others.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select className="inp" value={role} onChange={(e) => setRole(e.target.value as ProjectRole)} aria-label="Peran">
            {ROLES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <button className="btn primary" disabled={busy || !person}>
            + Beri akses
          </button>
        </form>
      )}
      <p className="sub" style={{ margin: '10px 0 0' }}>
        Mengeluarkan orang atau mengubah PM jadi peran lain otomatis mengosongkan tugasnya sebagai PIC, pemeriksa, atau pemutus di project ini.
      </p>
    </section>
  )
}
