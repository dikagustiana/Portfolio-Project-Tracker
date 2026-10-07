// Anggota tab (spec §21–22): who is in this project and with which role. Project admins add
// existing people, invite new ones by e-mail, switch Member ↔ Viewer and remove members; only
// the super admin grants or withdraws Project Admin. Removing someone keeps their account and
// their history. The database enforces all of this (set_member_role); the UI only hides what the
// viewer cannot do.
import { useState } from 'react'
import { Avatar, Icon } from '../../app/bits.tsx'
import { roleLabel } from '../../app/events.ts'
import { useFlows } from '../../app/flows.ts'
import { useBoard } from '../../data/board-context.ts'
import { fmtTs } from '../../domain/index.ts'
import type { Id, Invitation, Membership, Project, ProjectRole } from '../../domain/index.ts'
import { useAct } from '../record/act.ts'
import { Section, Tag } from '../record/parts.tsx'
import { jobLine } from '../record/status.ts'

const ORDER: Record<ProjectRole, number> = { project_admin: 0, member: 1, viewer: 2 }
const HINT: Record<ProjectRole, string> = {
  project_admin: 'Mengelola project, rencana dan anggota (member/viewer).',
  member: 'Mengerjakan task, mengajukan bukti, menandai hambatan, meminta keputusan. Bisa ditunjuk sebagai pemeriksa atau pemutus.',
  viewer: 'Hanya melihat. Tidak bisa mengubah apa pun.',
}

export function MembersTab({ p }: { p: Project }) {
  const { d, board, viewer, actions } = useBoard()
  const flows = useFlows()
  const { busy, err, run } = useAct()
  const admin = d.isAdminIn(p.id) && !d.locked(p)
  const rows = board.memberships
    .filter((m) => m.projectId === p.id)
    .sort((a, b) => ORDER[a.role] - ORDER[b.role] || d.mname(a.personId).localeCompare(d.mname(b.personId)))
  const inProject = new Set(rows.map((m) => m.personId))
  const candidates = board.people.filter((x) => !inProject.has(x.id)).sort((a, b) => a.name.localeCompare(b.name))
  const invites = board.invitations.filter((i) => i.status === 'pending' && i.projects.some((x) => x.projectId === p.id))
  const [add, setAdd] = useState('')
  const [addRole, setAddRole] = useState<ProjectRole>('member')

  /** Roles the viewer may give this row ([] = not manageable). */
  const choices = (m: Membership): ProjectRole[] => {
    if (!admin) return []
    if (viewer.isSuperAdmin) return ['project_admin', 'member', 'viewer']
    if (m.personId === viewer.personId || m.role === 'project_admin') return []
    return ['member', 'viewer']
  }
  const setRole = (personId: Id, role: ProjectRole | null, ok: string) => run(() => actions.setMemberRole(p.id, personId, role), ok)

  return (
    <div className="col">
      <Section title="Anggota project" n={rows.length}>
        {admin && (
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="sub">
              {viewer.isSuperAdmin ? 'Sebagai super admin kamu bisa memberi peran apa pun.' : 'Kamu bisa menambah dan mengatur Member dan Viewer. Peran Project Admin diatur super admin.'}
            </span>
            <button className="btn sm primary" onClick={() => flows.invite(p.id)}>
              <Icon name="plus" /> Undang lewat email
            </button>
          </div>
        )}
        {err && <div className="err">{err}</div>}
        <div className="rows">
          {rows.map((m) => {
            const person = d.person(m.personId)
            const opts = choices(m)
            return (
              <div key={m.personId} className="li static">
                <Avatar id={m.personId} size={28} />
                <div style={{ minWidth: 0 }}>
                  <div className="tt">
                    {person?.name ?? 'Orang tidak terlihat'}
                    {m.personId === viewer.personId && <span className="sub"> · kamu</span>}
                  </div>
                  <div className="sub">
                    {jobLine(d, person) || '—'}
                    {person && !person.userId ? ' · belum punya akun' : ''}
                  </div>
                </div>
                <div className="end">
                  {opts.length ? (
                    <>
                      <select
                        className="inp sm"
                        style={{ width: 'auto' }}
                        aria-label={`Peran ${person?.name ?? ''}`}
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => void setRole(m.personId, e.target.value as ProjectRole, `Peran ${person?.name ?? ''} diubah`)}
                      >
                        {opts.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn sm ghost"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(`Keluarkan ${person?.name ?? 'orang ini'} dari ${p.name}? Akun dan riwayatnya tetap ada.`))
                            void setRole(m.personId, null, `${person?.name ?? 'Anggota'} dikeluarkan dari project`)
                        }}
                      >
                        Keluarkan
                      </button>
                    </>
                  ) : (
                    <Tag tone={m.role === 'project_admin' ? 'indigo' : m.role === 'member' ? 'green' : 'grey'}>{roleLabel(m.role)}</Tag>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {admin && candidates.length > 0 && (
          <div className="row" style={{ marginTop: 12, gap: 6 }}>
            <select className="inp" style={{ width: 'auto', flex: '1 1 220px' }} aria-label="Tambah orang" value={add} onChange={(e) => setAdd(e.target.value)}>
              <option value="">Tambah orang yang sudah terdaftar…</option>
              {candidates.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                  {x.role ? ` · ${x.role}` : ''}
                </option>
              ))}
            </select>
            <select className="inp" style={{ width: 'auto' }} aria-label="Peran" value={addRole} onChange={(e) => setAddRole(e.target.value as ProjectRole)}>
              {(viewer.isSuperAdmin ? (['project_admin', 'member', 'viewer'] as const) : (['member', 'viewer'] as const)).map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
            <button
              className="btn"
              disabled={!add || busy}
              onClick={() => void setRole(add, addRole, `${d.mname(add)} ditambahkan sebagai ${roleLabel(addRole)}`).then((ok) => ok && setAdd(''))}
            >
              Tambahkan
            </button>
          </div>
        )}
      </Section>
      {admin && invites.length > 0 && <Invites p={p} invites={invites} />}
      <Section title="Arti peran">
        <div className="kv">
          {(['project_admin', 'member', 'viewer'] as const).map((r) => (
            <div key={r} style={{ display: 'contents' }}>
              <span className="k">{roleLabel(r)}</span>
              <span>{HINT[r]}</span>
            </div>
          ))}
        </div>
        <p className="sub" style={{ margin: '10px 0 0' }}>
          Siapa yang memeriksa task atau memutus Keputusan diatur per record, bukan per peran. PIC tidak pernah memeriksa pekerjaannya sendiri.
        </p>
      </Section>
    </div>
  )
}

function Invites({ p, invites }: { p: Project; invites: Invitation[] }) {
  const { actions } = useBoard()
  const { busy, err, run } = useAct()
  return (
    <Section title="Undangan menunggu" n={invites.length}>
      {err && <div className="err">{err}</div>}
      <div className="rows">
        {invites.map((i) => {
          const here = i.projects.find((x) => x.projectId === p.id)
          return (
            <div key={i.id} className="li static">
              <span className="ref">@</span>
              <div style={{ minWidth: 0 }}>
                <div className="tt">{i.displayName || i.email}</div>
                <div className="sub">
                  {i.email} · {roleLabel(here?.role)} · berlaku sampai {fmtTs(i.expiresAt)}
                </div>
              </div>
              <div className="end">
                <button
                  className="btn sm ghost"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Cabut undangan untuk ${i.email}? Akses yang diberikan undangan ini ikut dicabut.`)) void run(() => actions.revokeInvitation(i.id), 'Undangan dicabut')
                  }}
                >
                  Cabut
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
