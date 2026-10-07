// Admin · Orang & akun (super admin): every person, their business function, office e-mail, login
// status and system role. Project access is not edited here: it lives with each project (Anggota)
// and in the access matrix. Inviting creates the person and their project access in one step.
import { useState } from 'react'
import { Avatar, Icon } from '../../app/bits.tsx'
import { useFlows } from '../../app/flows.ts'
import { useOverlay } from '../../app/overlay-context.ts'
import { TwoStep } from '../../app/overlay.tsx'
import { messageOf } from '../../data/actions.ts'
import { useBoard } from '../../data/board-context.ts'
import { sendLoginLink } from '../../data/invite.ts'
import { EMAIL_RE, fmtTs } from '../../domain/index.ts'
import type { Person } from '../../domain/index.ts'
import { jobLine } from '../record/status.ts'
import { supa, useAdminData, useAdminWrite } from './shared.ts'
import type { PersonStatus } from './shared.ts'

export function AdminPeople() {
  const { d, board, viewer, extras } = useBoard()
  const flows = useFlows()
  const { status, pendingRoles } = useAdminData()
  const { open } = useOverlay()
  const [q, setQ] = useState('')
  const st = new Map((status.data ?? []).map((s) => [s.person_id, s]))
  const pendingSuper = new Set((pendingRoles.data ?? []).filter((r) => r.system_role === 'super_admin').map((r) => String(r.email).toLowerCase()))
  const isSuper = (m: Person, s: PersonStatus | undefined) =>
    s?.user_id ? extras.systemRoles.get(s.user_id) === 'super_admin' : !!m.email && pendingSuper.has(m.email.toLowerCase())
  const s = q.trim().toLowerCase()
  const people = board.people.filter(
    (m) => !s || `${m.name} ${m.role} ${m.email ?? ''} ${d.fn(m.functionId)?.name ?? ''}`.toLowerCase().includes(s),
  )

  return (
    <div className="stack" style={{ maxWidth: 1040 }}>
      <section className="panel">
        <div className="panel-h">
          <h2>{board.people.length} orang</h2>
          <div className="row" style={{ gap: 6 }}>
            <label className="search">
              <Icon name="search" />
              <input value={q} placeholder="Cari nama, fungsi, email" aria-label="Cari orang" onChange={(e) => setQ(e.target.value)} />
            </label>
            <button className="btn primary sm" onClick={() => flows.invite()}>
              <Icon name="plus" /> Undang anggota
            </button>
          </div>
        </div>
        <div className="mlist">
          {people.map((m) => {
            const st1 = st.get(m.id)
            const sup = isSuper(m, st1)
            const ms = board.memberships.filter((x) => x.personId === m.id)
            const admins = ms.filter((x) => x.role === 'project_admin').map((x) => d.project(x.projectId)?.code ?? '')
            return (
              <div key={m.id} className="mrow">
                <Avatar id={m.id} size={34} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>
                    {m.name}
                    {sup && (
                      <>
                        {' '}
                        <span className="chip rv">Owner · Super Admin</span>
                      </>
                    )}
                  </div>
                  <div className="sub" style={{ overflowWrap: 'anywhere' }}>
                    {jobLine(d, m) || '—'} ·{' '}
                    {m.email ?? <span style={{ color: 'var(--warn-ink)' }}>Belum ada email</span>}
                    {m.email && m.emailDaily === false ? ' · email harian mati' : ''}
                  </div>
                  <div className="sub">
                    {loginText(st1)} · {ms.length ? `${ms.length} project` : 'belum di project mana pun'}
                    {admins.length ? ` · Project Admin di ${admins.join(', ')}` : ''}
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm" disabled={!m.email} onClick={() => open(<LoginLinkDialog person={m} status={st1} />)}>
                    {st1?.user_id ? 'Kirim link masuk' : 'Buat akun'}
                  </button>
                  <button className="btn sm ghost" onClick={() => open(<PersonDialog person={m} isSuper={sup} userId={st1?.user_id ?? null} />)}>
                    Edit
                  </button>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  {m.userId !== viewer.userId && <DeletePerson person={m} />}
                </div>
              </div>
            )
          })}
          {people.length === 0 && <div className="empty">Tidak ada orang yang cocok.</div>}
        </div>
        <AddPerson />
      </section>
      <p className="sub" style={{ margin: 0 }}>
        Login hanya lewat undangan: email yang belum diundang tidak bisa masuk, walaupun tahu alamat app-nya. Akses ke project diberikan per project (tab Anggota
        project, atau saat mengundang). Orang tanpa project tidak melihat project apa pun. Selama SMTP kantor belum disambungkan, gunakan &quot;Buat link&quot;
        dan kirim linknya lewat Outlook atau WhatsApp.
      </p>
    </div>
  )
}

function loginText(s: PersonStatus | undefined): string {
  if (!s?.user_id) return 'Belum punya akun'
  if (s.last_sign_in_at) return `Akun aktif · terakhir masuk ${fmtTs(Date.parse(s.last_sign_in_at))}`
  if (s.invited_at) return `Diundang ${fmtTs(Date.parse(s.invited_at))} · belum pernah masuk`
  return 'Akun dibuat · belum pernah masuk'
}

function FunctionSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { board } = useBoard()
  return (
    <select className="inp" aria-label="Fungsi" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Tanpa fungsi</option>
      {board.functions.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </select>
  )
}

function AddPerson() {
  const { run, busy } = useAdminWrite()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [fn, setFn] = useState('')
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
        const p = await s
          .from('people')
          .insert({ display_name: name.trim(), job_title: role.trim(), function_id: fn || null })
          .select('id')
          .single()
        if (p.error || !mail) return p
        return s.from('people_contact').insert({ person_id: p.data.id, email: mail })
      },
      `${name.trim()} ditambahkan`,
      ['people', 'people_contact', 'admin'],
    )
    if (ok) {
      setName('')
      setRole('')
      setFn('')
      setEmail('')
    }
  }
  return (
    <>
      <div className="sub" style={{ margin: '14px 0 6px' }}>
        Tambah orang tanpa undangan (mis. PIC yang belum perlu login). Untuk memberi akses, pakai &quot;Undang anggota&quot;.
      </div>
      <form className="addm" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,.9fr) minmax(0,1.2fr) auto' }} onSubmit={(e) => void add(e)}>
        <input className="inp" placeholder="Nama, mis. Rina" aria-label="Nama" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <input className="inp" placeholder="Jabatan / divisi" aria-label="Jabatan" value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} />
        <FunctionSelect value={fn} onChange={setFn} />
        <input className="inp" type="email" placeholder="Email kantor" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn" disabled={busy}>
          + Tambah orang
        </button>
      </form>
      <div className="err">{err}</div>
    </>
  )
}

function PersonDialog({ person, isSuper, userId }: { person: Person; isSuper: boolean; userId: string | null }) {
  const { actions, viewer } = useBoard()
  const { close } = useOverlay()
  const { run, busy } = useAdminWrite()
  const [name, setName] = useState(person.name)
  const [role, setRole] = useState(person.role)
  const [fn, setFn] = useState(person.functionId)
  const [email, setEmail] = useState(person.email ?? '')
  const [daily, setDaily] = useState(person.emailDaily)
  const [sup, setSup] = useState(isSuper)
  const [err, setErr] = useState('')
  const self = !!userId && userId === viewer.userId

  const save = async () => {
    if (!name.trim()) return setErr('Isi nama.')
    if (!role.trim()) return setErr('Isi jabatan / divisi.')
    const mail = email.trim().toLowerCase()
    if (mail && !EMAIL_RE.test(mail)) return setErr('Format email belum benar, mis. nama@samb.co.id.')
    if (userId && person.email && mail !== person.email.toLowerCase())
      return setErr('Orang ini sudah punya akun. Email login tidak diubah dari sini; hapus lalu undang ulang kalau alamatnya berganti.')
    const ok = await run(
      async (s) => {
        const p = await s
          .from('people')
          .update({ display_name: name.trim(), job_title: role.trim(), email_daily: daily, function_id: fn || null })
          .eq('id', person.id)
        if (p.error) return p
        const c = mail
          ? await s.from('people_contact').upsert({ person_id: person.id, email: mail })
          : await s.from('people_contact').delete().eq('person_id', person.id)
        if (c.error) return c
        if (sup === isSuper) return { error: null }
        if (userId) {
          try {
            await actions.setSystemRole(person.id, sup ? 'super_admin' : 'user')
            return { error: null }
          } catch (e) {
            return { error: { message: messageOf(e) } }
          }
        }
        if (!mail) return { error: { message: 'Isi email dulu untuk memberi peran super admin.' } }
        return sup
          ? s.from('pending_system_roles').insert({ email: mail, system_role: 'super_admin' })
          : s.from('pending_system_roles').delete().eq('email', mail)
      },
      'Data orang disimpan',
      ['people', 'people_contact', 'profiles', 'admin'],
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
        Fungsi bisnis
        <FunctionSelect value={fn} onChange={setFn} />
        <span className="hint">Dipakai untuk tanggung jawab per fungsi (mis. task milik Accounting yang belum punya PIC).</span>
      </label>
      <label className="f">
        Email kantor
        <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@samb.co.id" />
        <span className="hint">Dipakai untuk login dan email harian. Hanya super admin dan Project Admin project orang ini yang bisa melihatnya.</span>
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
        <input type="checkbox" checked={sup} disabled={self} onChange={(e) => setSup(e.target.checked)} />
        <span>
          <b>Super admin</b>
          <br />
          <span className="sub">
            {self
              ? 'Peranmu sendiri tidak bisa dicabut dari sini.'
              : 'Melihat dan mengelola semua project, orang, undangan dan pengaturan. Berikan hanya kepada pemilik sistem.'}
          </span>
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

/** Login link for a person with an office e-mail: by e-mail, or a one-time link to send yourself. */
function LoginLinkDialog({ person, status }: { person: Person; status: PersonStatus | undefined }) {
  const { close, toast } = useOverlay()
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const call = async (mode: 'email' | 'link') => {
    setBusy(true)
    setErr('')
    try {
      const r = await sendLoginLink(supa(), person.id, mode)
      if (!r.ok) return setErr(r.error)
      if (mode === 'link') setLink(r.link)
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
      <h2>{status?.user_id ? 'Kirim link masuk' : 'Buat akun'}</h2>
      <div className="prompt">
        <b>{person.name}</b> &lt;{person.email}&gt;
        <br />
        <span className="sub">
          {status?.user_id
            ? 'Orang ini sudah punya akun. Link masuk berlaku sekali pakai.'
            : 'Link ini membuat akunnya. Setelah dibuka, ia langsung masuk dan namanya terhubung otomatis. Ia hanya melihat project tempat ia menjadi anggota.'}
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
