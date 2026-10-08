// Orang (spec §25): a directory of the people the viewer works with: everyone in the projects
// they can read (all people for the super admin). Who they are, their function, their projects and
// roles there, and what is on their plate. No access editing here: that is Anggota (per project)
// and Admin (super admin). Contact e-mails show only where RLS lets the viewer read them.
import { useState } from 'react'
import { Avatar, Head, Icon, Tip } from '../app/bits.tsx'
import { roleLabel } from '../app/events.ts'
import { useFlows } from '../app/flows.ts'
import { openProject } from '../app/nav.ts'
import { go } from '../app/ui.ts'
import { useBoard } from '../data/board-context.ts'
import type { Person, Task } from '../domain/index.ts'
import { Section, Tag } from './record/parts.tsx'
import { jobLine } from './record/status.ts'

export function People() {
  const { d, board, viewer } = useBoard()
  const flows = useFlows()
  const [q, setQ] = useState('')
  const [fn, setFn] = useState('')
  const open = board.tasks.filter((t) => d.pActive(d.project(t.projectId)) && d.isLeaf(t) && !d.isDone(t))
  const s = q.trim().toLowerCase()
  const people = board.people.filter(
    (m) =>
      (!fn || (fn === '-' ? !m.functionId : m.functionId === fn)) &&
      (!s || `${m.name} ${m.role} ${d.fn(m.functionId)?.name ?? ''}`.toLowerCase().includes(s)),
  )
  const load = d.functionLoad().filter((f) => f.open || f.people)
  const canPreview = (m: Person) => viewer.isSuperAdmin || board.memberships.some((x) => x.personId === m.id && d.isAdminIn(x.projectId))

  return (
    <>
      <Head
        eyebrow="Orang di project yang bisa kamu akses: PIC, pemeriksa, dan pemutus"
        title="Orang"
        actions={
          <>
            {board.projects.some((p) => d.isAdminIn(p.id)) && (
              <button className="btn" onClick={() => flows.invite()}>
                <Icon name="plus" /> Undang anggota
              </button>
            )}
            {viewer.isSuperAdmin && (
              <button className="btn ghost" onClick={() => go({ view: 'admin', adminTab: 'orang' })}>
                Kelola akun
              </button>
            )}
          </>
        }
      />
      <div className="grid2" style={{ alignItems: 'start', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        <div className="col">
          <div className="fbar">
            <label className="search">
              <Icon name="search" />
              <input value={q} placeholder="Cari nama, jabatan, fungsi" aria-label="Cari orang" onChange={(e) => setQ(e.target.value)} />
            </label>
            <select className="inp" style={{ width: 'auto' }} aria-label="Fungsi" value={fn} onChange={(e) => setFn(e.target.value)}>
              <option value="">Semua fungsi</option>
              {board.functions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
              <option value="-">Tanpa fungsi</option>
            </select>
          </div>
          <section className="sec">
            <div className="sec-h">
              <h2>
                {people.length} orang
                <Tip k="peran" />
              </h2>
            </div>
            <div className="mlist">
              {people.length ? (
                people.map((m) => <PersonRow key={m.id} m={m} open={open} preview={canPreview(m)} />)
              ) : (
                <div className="empty">{board.people.length ? 'Tidak ada orang yang cocok.' : 'Belum ada orang di project yang bisa kamu akses.'}</div>
              )}
            </div>
          </section>
        </div>
        <div className="col">
          <Section title="Beban per fungsi" n={load.length}>
            {load.length ? (
              <div className="rows">
                {load.map((f) => (
                  <button key={f.functionId} className="li" onClick={() => setFn(f.functionId)}>
                    <span className="ref">{f.open}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="tt">{f.name}</div>
                      <div className="sub">
                        {f.open} task terbuka{f.unstaffed ? ` · ${f.unstaffed} tanpa PIC` : ''} · {f.people} orang
                      </div>
                    </div>
                    <div className="end">
                      {f.blocked > 0 && <Tag tone="red">{f.blocked} terhambat</Tag>}
                      {f.late > 0 && <Tag tone="red">{f.late} telat</Tag>}
                      {!f.blocked && !f.late && f.unstaffed > 0 && <Tag tone="amber">Perlu PIC</Tag>}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-line">Belum ada fungsi yang memiliki pekerjaan.</div>
            )}
          </Section>
          <p className="sub" style={{ margin: 0 }}>
            Peran di project diatur di tab Anggota tiap project. Siapa yang memeriksa atau memutus ditentukan per task, milestone dan Keputusan.
          </p>
        </div>
      </div>
    </>
  )
}

function PersonRow({ m, open, preview }: { m: Person; open: readonly Task[]; preview: boolean }) {
  const { d, board, viewer } = useBoard()
  const flows = useFlows()
  const mine = open.filter((t) => t.assignee === m.id)
  const late = mine.filter(d.isLate).length
  const toCheck = open.filter((t) => t.stage === 'review' && d.validatorOf(t) === m.id).length
  const toDecide = d.asksFor(m.id).length
  const ms = board.memberships.filter((x) => x.personId === m.id && d.project(x.projectId))
  const isMe = !!viewer.personId && m.id === viewer.personId
  return (
    <div className="mrow">
      <Avatar id={m.id} size={34} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700 }}>
          {m.name}
          {isMe && (
            <>
              {' '}
              <span className="chip ok">Kamu</span>
            </>
          )}
        </div>
        <div className="sub" style={{ overflowWrap: 'anywhere' }}>
          {jobLine(d, m) || '—'}
          {m.email ? ` · ${m.email}` : ''}
          {!m.userId ? ' · belum punya akun' : ''}
        </div>
        <div className="sub">
          {mine.length} task aktif{late ? ` · ${late} telat` : ''}
          {toCheck ? ` · ${toCheck} perlu diperiksa` : ''}
          {toDecide ? ` · ${toDecide} keputusan` : ''}
        </div>
        {ms.length > 0 && (
          <div className="row" style={{ gap: 4, marginTop: 6 }}>
            {ms.map((x) => {
              const p = d.project(x.projectId)
              return (
                <button
                  key={x.projectId}
                  className={`chip${x.role === 'project_admin' ? ' rv' : ''}`}
                  style={{ cursor: 'pointer', border: 0 }}
                  title={`${p?.name ?? ''} · ${roleLabel(x.role)}`}
                  onClick={() => openProject(d, x.projectId, 'anggota')}
                >
                  {p?.code} · {roleLabel(x.role)}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="row" style={{ gap: 6 }}>
        {preview && (
          <button className="btn sm ghost" onClick={() => flows.openPreview(m.id)}>
            Pratinjau email
          </button>
        )}
      </div>
    </div>
  )
}
