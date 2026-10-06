// Admin · Orang: people, office e-mail, daily e-mail switch, login status, invitation, app roles.
import { useState } from 'react'
import { Avatar } from '../../app/bits.tsx'
import { useOverlay } from '../../app/overlay-context.ts'
import { TwoStep } from '../../app/overlay.tsx'
import { useBoard } from '../../data/board-context.ts'
import { EMAIL_RE, fmtTs } from '../../domain/index.ts'
import type { Person } from '../../domain/index.ts'
import { supa, useAdminData, useAdminWrite } from './shared.ts'
import type { PersonStatus } from './shared.ts'

export function AdminPeople() {
  const { board, viewer } = useBoard()
  const { status, roles } = useAdminData()
  const { open } = useOverlay()
  const st = new Map((status.data ?? []).map((s) => [s.person_id, s]))
  const gv = new Set((roles.data?.active ?? []).filter((r) => r.role === 'group_viewer').map((r) => r.user_id))
  const owners = new Set((roles.data?.active ?? []).filter((r) => r.role === 'owner').map((r) => r.user_id))
  const pendingGv = new Set((roles.data?.pending ?? []).filter((r) => r.role === 'group_viewer').map((r) => String(r.email).toLowerCase()))

  return (
    <div className="stack" style={{ maxWidth: 980 }}>
      <section className="panel">
        <div className="panel-h">
          <h2>{board.people.length} orang</h2>
          <span className="sub">Orang bisa ditugaskan sebagai PIC, pemeriksa, atau pemutus setelah diberi akses ke project.</span>
        </div>
        <div className="mlist">
          {board.people.map((m) => {
            const s = st.get(m.id)
            const isGv = s?.user_id ? gv.has(s.user_id) : !!m.email && pendingGv.has(m.email.toLowerCase())
            return (
              <div key={m.id} className="mrow">
                <Avatar id={m.id} size={34} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>
                    {m.name}
                    {s?.user_id && owners.has(s.user_id) && (
                      <>
                        {' '}
                        <span className="chip rv">Owner</span>
                      </>
                    )}
                    {isGv && (
                      <>
                        {' '}
                        <span className="chip">Group viewer</span>
                      </>
                    )}
                  </div>
                  <div className="sub" style={{ overflowWrap: 'anywhere' }}>
                    {m.role || '—'} · {m.email ?? <span style={{ color: 'var(--warn-ink)' }}>Belum ada email</span>}
                    {m.email && m.emailDaily === false ? ' · email harian mati' : ''}
                  </div>
                  <div className="sub">{loginText(s)}</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm" disabled={!m.email} onClick={() => open(<InviteDialog person={m} status={s} />)}>
                    {s?.user_id ? 'Kirim link masuk' : 'Undang'}
                  </button>
                  <button className="btn sm ghost" onClick={() => open(<PersonDialog person={m} isGv={isGv} userId={s?.user_id ?? null} />)}>
                    Edit
                  </button>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  {m.userId !== viewer.userId && <DeletePerson person={m} />}
                </div>
              </div>
            )
          })}
        </div>
        <AddPerson />
      </section>
      <p className="sub" style={{ margin: 0 }}>
        Login hanya lewat undangan: orang yang belum diundang tidak bisa masuk, walaupun tahu alamat app-nya. Setelah undangan diterima, nama otomatis terhubung ke
        akunnya lewat email kantor. Selama SMTP kantor belum disambungkan, gunakan &quot;Salin link&quot; dan kirim linknya lewat Outlook atau WhatsApp.
      </p>
    </div>
  )
}

function loginText(s: PersonStatus | undefined): string {
  if (!s?.user_id) return 'Belum diundang'
  if (s.last_sign_in_at) return `Akun aktif · terakhir masuk ${fmtTs(Date.parse(s.last_sign_in_at))}`
  if (s.invited_at) return `Diundang ${fmtTs(Date.parse(s.invited_at))} · belum pernah masuk`
  return 'Akun dibuat · belum pernah masuk'
}

function AddPerson() {
  const { run, busy } = useAdminWrite()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setErr('Isi nama.')
    if (!role.trim()) return setErr('Isi jabatan / divisi.')
    const mail = email.trim().toLowerCase()
    if (mail && !EMAIL_RE.test(mail)) return setErr('Format email belum benar, mis. nama@samb.co.id.')
    setErr('')
    const ok = await run(
      async (s) => {
        const p = await s.from('people').insert({ display_name: name.trim(), job_title: role.trim() }).select('id').single()
        if (p.error || !mail) return p
        return s.from('people_contact').insert({ person_id: p.data.id, email: mail })
      },
      `${name.trim()} ditambahkan`,
      ['people', 'people_contact', 'admin'],
    )
    if (ok) {
      setName('')
      setRole('')
      setEmail('')
    }
  }
  return (
    <>
      <form
        className="addm"
        style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr) auto' }}
        onSubmit={(e) => void add(e)}
      >
        <input className="inp" placeholder="Nama, mis. Rina" aria-label="Nama" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <input className="inp" placeholder="Jabatan / divisi" aria-label="Jabatan" value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} />
        <input className="inp" type="email" placeholder="Email kantor" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn primary" disabled={busy}>
          + Tambah orang
        </button>
      </form>
      <div className="err">{err}</div>
    </>
  )
}

function PersonDialog({ person, isGv, userId }: { person: Person; isGv: boolean; userId: string | null }) {
  const { close } = useOverlay()
  const { run, busy } = useAdminWrite()
  const [name, setName] = useState(person.name)
  const [role, setRole] = useState(person.role)
  const [email, setEmail] = useState(person.email ?? '')
  const [daily, setDaily] = useState(person.emailDaily)
  const [gv, setGv] = useState(isGv)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!name.trim()) return setErr('Isi nama.')
    if (!role.trim()) return setErr('Isi jabatan / divisi.')
    const mail = email.trim().toLowerCase()
    if (mail && !EMAIL_RE.test(mail)) return setErr('Format email belum benar, mis. nama@samb.co.id.')
    if (userId && person.email && mail !== person.email.toLowerCase())
      return setErr('Orang ini sudah punya akun. Email login tidak diubah dari sini; hapus lalu undang ulang kalau alamatnya berganti.')
    const ok = await run(
      async (s) => {
        const p = await s.from('people').update({ display_name: name.trim(), job_title: role.trim(), email_daily: daily }).eq('id', person.id)
        if (p.error) return p
        const c = mail
          ? await s.from('people_contact').upsert({ person_id: person.id, email: mail })
          : await s.from('people_contact').delete().eq('person_id', person.id)
        if (c.error) return c
        if (gv === isGv) return { error: null }
        if (userId)
          return gv
            ? s.from('app_roles').insert({ user_id: userId, role: 'group_viewer' })
            : s.from('app_roles').delete().eq('user_id', userId).eq('role', 'group_viewer')
        if (!mail) return { error: { message: 'Isi email dulu untuk memberi akses group viewer.' } }
        return gv
          ? s.from('pending_app_roles').insert({ email: mail, role: 'group_viewer' })
          : s.from('pending_app_roles').delete().eq('email', mail).eq('role', 'group_viewer')
      },
      'Data orang disimpan',
      ['people', 'people_contact', 'admin'],
    )
    if (ok) close()
  }

  return (
    <>
      <h2>Edit orang</h2>
      <label className="f">
        Nama
        <input className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </label>
      <label className="f">
        Jabatan / divisi
        <input className="inp" value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} />
      </label>
      <label className="f">
        Email kantor
        <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@samb.co.id" />
        <span className="hint">Dipakai untuk login dan email harian. Hanya owner dan PM project orang ini yang bisa melihatnya.</span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} />
        <span>
          <b>Kirim email harian</b>
          <br />
          <span className="sub">Satu email setiap pagi hari kerja berisi yang harus dilakukan hari itu.</span>
        </span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={gv} onChange={(e) => setGv(e.target.checked)} />
        <span>
          <b>Group viewer</b>
          <br />
          <span className="sub">Bisa melihat semua project (baca saja), tanpa menjadi anggota. Untuk principal grup.</span>
        </span>
      </label>
      <div className="err">{err}</div>
      <div className="mfoot">
        <span />
        <div className="row">
          <button className="btn ghost" onClick={close}>
            Batal
          </button>
          <button className="btn primary" disabled={busy} onClick={() => void save()}>
            Simpan
          </button>
        </div>
      </div>
    </>
  )
}

function DeletePerson({ person }: { person: Person }) {
  const { run } = useAdminWrite()
  return (
    <TwoStep
      className="btn sm ghost"
      label="Hapus"
      armed="Yakin? Klik lagi"
      onConfirm={() =>
        void run((s) => s.from('people').delete().eq('id', person.id), `${person.name} dihapus`, [
          'people',
          'people_contact',
          'project_members',
          'tasks',
          'milestones',
          'asks',
          'projects',
          'admin',
        ])
      }
    />
  )
}

function InviteDialog({ person, status }: { person: Person; status: PersonStatus | undefined }) {
  const { close, toast } = useOverlay()
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const call = async (mode: 'email' | 'link') => {
    setBusy(true)
    setErr('')
    try {
      const res = await supa().functions.invoke<{ link?: string | null }>('invite-person', {
        body: { person_id: person.id, mode, redirect_to: window.location.origin },
      })
      const error = res.error as (Error & { context?: Response }) | null
      if (error) {
        let msg = error.message
        try {
          const body = (await error.context?.json()) as { error?: string } | undefined
          if (body?.error) msg = body.error
        } catch {
          /* keep the generic message */
        }
        return setErr(msg)
      }
      if (mode === 'link') setLink(res.data?.link ?? null)
      else {
        toast(status?.user_id ? `Link masuk dikirim ke ${person.email}` : `Undangan dikirim ke ${person.email}`)
        close()
      }
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <h2>{status?.user_id ? 'Kirim link masuk' : 'Undang'}</h2>
      <div className="prompt">
        <b>{person.name}</b> &lt;{person.email}&gt;
        <br />
        <span className="sub">
          {status?.user_id
            ? 'Orang ini sudah punya akun. Link masuk berlaku sekali pakai.'
            : 'Undangan membuat akunnya. Setelah link dibuka, ia langsung masuk dan namanya terhubung otomatis.'}
        </span>
      </div>
      {link ? (
        <div className="f">
          Link sekali pakai
          <textarea className="inp" readOnly value={link} rows={3} onFocus={(e) => e.currentTarget.select()} />
          <span className="hint">Kirim link ini hanya ke {person.name}. Siapa pun yang membukanya akan masuk sebagai dia.</span>
        </div>
      ) : (
        <p className="sub">
          Kirim lewat email Supabase, atau salin link dan kirim sendiri. Email dari Supabase hanya sampai kalau SMTP kantor sudah disambungkan di pengaturan Auth.
        </p>
      )}
      <div className="err">{err}</div>
      <div className="mfoot">
        <span />
        <div className="row">
          <button className="btn ghost" onClick={close}>
            Tutup
          </button>
          {link ? (
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
              <button className="btn" disabled={busy} onClick={() => void call('link')}>
                Buat link
              </button>
              <button className="btn primary" disabled={busy} onClick={() => void call('email')}>
                Kirim email
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
