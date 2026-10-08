// Invite anggota (docs/ARCHITECTURE.md §K "invitation semantics"): e-mail, optional name, the
// projects to grant (all unchecked: access is explicit opt-in) with a role per project, a review,
// then the invitation. An e-mail that already belongs to someone resolves to that person; an
// existing account is not re-invited, its access is updated. The super admin grants any role on
// any project; a project admin grants Member or Viewer on their own projects.
import { useState } from 'react'
import { useOverlay } from '../app/overlay-context.ts'
import { roleLabel } from '../app/events.ts'
import { messageOf } from '../data/actions.ts'
import type { InviteResult } from '../data/actions.ts'
import { useBoard } from '../data/board-context.ts'
import { sendLoginLink } from '../data/invite.ts'
import { EMAIL_RE } from '../domain/index.ts'
import type { Id, ProjectRole } from '../domain/index.ts'
import { supabase } from '../lib/supabase.ts'

type Pick = Record<Id, ProjectRole>

export function InviteDialog({ projectId }: { projectId?: Id }) {
  const { d, board, viewer, actions, refresh } = useBoard()
  const { close, toast } = useOverlay()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<Pick>(() => (projectId ? { [projectId]: 'member' } : {}))
  const [step, setStep] = useState<'form' | 'review' | 'done'>('form')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<InviteResult | null>(null)
  const [link, setLink] = useState<string | null>(null)

  const projects = [...board.projects].filter((p) => d.isAdminIn(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'id'))
  const roles: ProjectRole[] = viewer.isSuperAdmin ? ['project_admin', 'member', 'viewer'] : ['member', 'viewer']
  const mail = email.trim().toLowerCase()
  const existing = mail ? board.people.find((p) => p.email?.toLowerCase() === mail) : undefined
  const chosen = projects.filter((p) => picked[p.id])

  const next = () => {
    if (!EMAIL_RE.test(mail)) return setErr('Format email belum benar, mis. nama@samb.co.id.')
    if (!chosen.length && !viewer.isSuperAdmin) return setErr('Pilih minimal satu project.')
    setErr('')
    setStep('review')
  }
  const send = async () => {
    setBusy(true)
    setErr('')
    try {
      const r = await actions.inviteMember({
        email: mail,
        ...(name.trim() ? { name: name.trim() } : {}),
        assignments: chosen.map((p) => ({ project_id: p.id, role: picked[p.id] ?? 'member' })),
      })
      setResult(r)
      setStep('done')
      await refresh()
    } catch (e) {
      setErr(messageOf(e))
    } finally {
      setBusy(false)
    }
  }
  const login = async (mode: 'email' | 'link') => {
    if (!supabase || !result) return
    setBusy(true)
    setErr('')
    const r = await sendLoginLink(supabase, result.person_id, mode)
    setBusy(false)
    if (!r.ok) return setErr(r.error)
    if (mode === 'link') setLink(r.link)
    else {
      toast(`Undangan dikirim ke ${mail}`)
      close()
    }
  }

  if (step === 'done' && result)
    return (
      <>
        <h2>{result.mode === 'invited' ? 'Undangan dibuat' : 'Akses diperbarui'}</h2>
        <div className="prompt" style={{ margin: 0 }}>
          <b>{existing?.name || name || mail}</b> &lt;{mail}&gt;
          <br />
          <span className="sub">
            {result.mode === 'invited'
              ? 'Akses project sudah tercatat. Orang ini bisa masuk setelah membuka link undangan (berlaku 14 hari).'
              : 'Orang ini sudah punya akun, jadi tidak perlu undangan: aksesnya langsung berubah.'}
          </span>
        </div>
        {link && (
          <div className="f">
            Link sekali pakai
            <textarea className="inp" readOnly value={link} rows={3} onFocus={(e) => e.currentTarget.select()} />
            <span className="hint">Kirim link ini hanya ke orangnya. Siapa pun yang membukanya akan masuk sebagai dia.</span>
          </div>
        )}
        <div className="err">{err}</div>
        <div className="mfoot">
          <span />
          <div className="row">
            <button className="btn ghost" onClick={close}>
              Tutup
            </button>
            {result.mode === 'invited' &&
              (link ? (
                <button
                  className="btn primary"
                  onClick={() => {
                    void navigator.clipboard?.writeText(link)
                    toast('Link disalin')
                  }}
                >
                  Salin link
                </button>
              ) : (
                <>
                  <button className="btn" disabled={busy} onClick={() => void login('link')}>
                    Buat link
                  </button>
                  <button className="btn primary" disabled={busy} onClick={() => void login('email')}>
                    Kirim email undangan
                  </button>
                </>
              ))}
          </div>
        </div>
      </>
    )

  if (step === 'review')
    return (
      <>
        <h2>Periksa undangan</h2>
        <div className="prompt" style={{ margin: 0 }}>
          <b>{existing?.name || name || mail}</b> &lt;{mail}&gt;
          <br />
          <span className="sub">{existing ? (existing.userId ? 'Sudah punya akun: aksesnya langsung diperbarui.' : 'Sudah terdaftar, belum punya akun: akan diundang.') : 'Orang baru: akan dibuat dan diundang.'}</span>
        </div>
        <div className="rows" style={{ marginTop: 8 }}>
          {chosen.length ? (
            chosen.map((p) => {
              const cur = existing ? d.roleOf(p.id, existing.id) : null
              return (
                <div key={p.id} className="li static">
                  <span className="ref">{p.code}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="tt">{p.name}</div>
                    {cur && <div className="sub">Sekarang: {roleLabel(cur)}</div>}
                  </div>
                  <b>{roleLabel(picked[p.id])}</b>
                </div>
              )
            })
          ) : (
            <div className="sub">Tanpa project. Orang ini bisa masuk tapi belum melihat project apa pun.</div>
          )}
        </div>
        <div className="err">{err}</div>
        <div className="mfoot">
          <button className="btn ghost" onClick={() => setStep('form')}>
            Kembali
          </button>
          <div className="row">
            <button className="btn ghost" onClick={close}>
              Batal
            </button>
            <button className="btn primary" disabled={busy} onClick={() => void send()}>
              {existing?.userId ? 'Perbarui akses' : 'Kirim undangan'}
            </button>
          </div>
        </div>
      </>
    )

  return (
    <>
      <h2>Undang anggota</h2>
      <div className="fgrid">
        <label className="f">
          Email kantor
          <input className="inp" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@samb.co.id" />
        </label>
        <label className="f">
          Nama tampilan (opsional)
          <input className="inp" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={existing?.name ?? 'mis. Teddy'} />
        </label>
      </div>
      {existing && <div className="sub">Email ini milik {existing.name}. Tidak ada orang baru yang dibuat; aksesnya yang diatur.</div>}
      <div className="f">
        Project dan peran
        <span className="hint">Semua project awalnya tidak dicentang. Centang hanya yang boleh dilihat orang ini.</span>
      </div>
      <div className="role-grid">
        {projects.map((p) => {
          const on = !!picked[p.id]
          const cur = existing ? d.roleOf(p.id, existing.id) : null
          const locked = !viewer.isSuperAdmin && cur === 'project_admin'
          return (
            <label key={p.id} className={`role-row${on ? ' on' : ''}`}>
              <input
                type="checkbox"
                checked={on}
                disabled={locked}
                onChange={(e) => {
                  const n = { ...picked }
                  if (e.target.checked) n[p.id] = cur && roles.includes(cur) ? cur : 'member'
                  else delete n[p.id]
                  setPicked(n)
                }}
              />
              <span className="nm">
                {p.name}
                <small>
                  {p.code} · {p.entity}
                  {cur ? ` · sekarang ${roleLabel(cur)}` : ''}
                  {locked ? ' (hanya super admin yang mengubah Project Admin)' : ''}
                </small>
              </span>
              <select
                className="inp"
                style={{ width: 'auto' }}
                disabled={!on}
                aria-label={`Peran di ${p.name}`}
                value={picked[p.id] ?? 'member'}
                onChange={(e) => setPicked({ ...picked, [p.id]: e.target.value as ProjectRole })}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>
      <div className="err">{err}</div>
      <div className="mfoot">
        <span className="sub">{chosen.length} project dipilih</span>
        <div className="row">
          <button className="btn ghost" onClick={close}>
            Batal
          </button>
          <button className="btn primary" onClick={next}>
            Lanjut
          </button>
        </div>
      </div>
    </>
  )
}
