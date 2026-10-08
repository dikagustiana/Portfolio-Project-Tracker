// Admin · Matriks akses (spec §24): who has which role in which project, at a glance. Rows are
// people, columns projects. The super admin changes a role in place; every change goes through
// set_member_role, so the same rules (and the event log) apply as on a project's Anggota tab.
import { useState } from 'react'
import { Icon } from '../../app/bits.tsx'
import { roleLabel } from '../../app/events.ts'
import { openProject } from '../../app/nav.ts'
import { useBoard } from '../../data/board-context.ts'
import type { Id, ProjectRole } from '../../domain/index.ts'
import { useAct } from '../record/act.ts'

const SHORT: Record<ProjectRole, string> = { project_admin: 'Admin', member: 'Member', viewer: 'Viewer' }

export function AdminMatrix() {
  const { d, board, actions, extras } = useBoard()
  const { busy, err, run } = useAct()
  const [q, setQ] = useState('')
  const [onlyActive, setOnlyActive] = useState(true)
  const projects = board.projects.filter((p) => !onlyActive || d.pActive(p)).sort((a, b) => a.code.localeCompare(b.code))
  const s = q.trim().toLowerCase()
  const people = board.people.filter((m) => !s || `${m.name} ${m.role} ${d.fn(m.functionId)?.name ?? ''}`.toLowerCase().includes(s))
  const role = new Map(board.memberships.map((m) => [`${m.projectId}:${m.personId}`, m.role]))
  const set = (projectId: Id, personId: Id, r: ProjectRole | null) =>
    void run(() => actions.setMemberRole(projectId, personId, r), r ? `Peran diubah menjadi ${roleLabel(r)}` : 'Akses dicabut')

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="sub">
          Tanpa peran berarti project itu tidak ada bagi orang tersebut: tidak muncul di daftar, pencarian, angka portofolio, aktivitas, maupun email. Super admin
          melihat semua project tanpa perlu peran.
        </span>
        <div className="row" style={{ gap: 6 }}>
          <label className="toggle" style={{ margin: 0 }}>
            <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
            <span>Project aktif saja</span>
          </label>
          <label className="search">
            <Icon name="search" />
            <input value={q} placeholder="Cari orang" aria-label="Cari orang" onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="matrix">
        <table>
          <thead>
            <tr>
              <th scope="col">Orang</th>
              {projects.map((p) => (
                <th key={p.id} scope="col" title={p.name}>
                  <button className="linkbtn" onClick={() => openProject(d, p.id, 'anggota')}>
                    {p.code}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((m) => (
              <tr key={m.id}>
                <th scope="row">
                  {m.name}
                  {m.userId && extras.systemRoles.get(m.userId) === 'super_admin' && <span className="r-owner"> · Owner</span>}
                  <div className="sub" style={{ fontWeight: 500 }}>
                    {d.fn(m.functionId)?.name ?? m.role}
                  </div>
                </th>
                {projects.map((p) => {
                  const r = role.get(`${p.id}:${m.id}`)
                  return (
                    <td key={p.id} className={r ? (r === 'project_admin' ? 'r-admin' : '') : 'none'}>
                      <select
                        className="inp sm"
                        aria-label={`Peran ${m.name} di ${p.name}`}
                        value={r ?? ''}
                        disabled={busy}
                        onChange={(e) => set(p.id, m.id, (e.target.value || null) as ProjectRole | null)}
                      >
                        <option value="">—</option>
                        {(['project_admin', 'member', 'viewer'] as const).map((x) => (
                          <option key={x} value={x}>
                            {SHORT[x]}
                          </option>
                        ))}
                      </select>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
