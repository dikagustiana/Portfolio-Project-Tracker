// Invite-only magic-link sign-in (BRIEF §10 M3). Sign-up is closed: only invited e-mails get a link.
import { useState } from 'react'
import { BrandMark } from '../components/BrandMark.tsx'
import type { Supa } from '../lib/supabase.ts'

const NOT_INVITED = /signups? not allowed|user not found|not registered|belum terdaftar|database error/i

export function Login({ supa }: { supa: Supa }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<{ kind: 'idle' | 'sending' | 'sent' | 'error'; msg?: string }>({ kind: 'idle' })

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setState({ kind: 'error', msg: 'Format email belum benar, mis. nama@samb.co.id.' })
      return
    }
    setState({ kind: 'sending' })
    const { error } = await supa.auth.signInWithOtp({
      email: addr,
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    })
    if (error) {
      setState({
        kind: 'error',
        msg: NOT_INVITED.test(error.message)
          ? 'Email ini belum terdaftar. Minta admin mengundangmu.'
          : /rate|too many|seconds/i.test(error.message)
            ? 'Terlalu sering. Tunggu sebentar, lalu coba lagi.'
            : `Gagal mengirim link masuk: ${error.message}`,
      })
      return
    }
    setState({ kind: 'sent' })
  }

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <section className="panel w-full max-w-md" style={{ padding: 32 }}>
        <BrandMark />
        <h1 className="mt-6 text-xl font-extrabold tracking-tight">Masuk</h1>
        {state.kind === 'sent' ? (
          <p className="mt-2" style={{ color: 'var(--muted)' }}>
            Link masuk sudah dikirim ke <b style={{ color: 'var(--ink)' }}>{email.trim()}</b>. Buka email itu dan klik linknya. Link berlaku satu jam.
          </p>
        ) : (
          <form onSubmit={(e) => void send(e)}>
            <p className="mt-2" style={{ color: 'var(--muted)' }}>
              Masukkan email kantormu. Kami kirim link untuk masuk, tanpa kata sandi. Hanya orang yang sudah diundang admin yang bisa masuk.
            </p>
            <label className="f" style={{ marginTop: 16 }}>
              Email kantor
              <input
                className="inp"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@samb.co.id"
                autoFocus
              />
            </label>
            {state.kind === 'error' && <div className="err">{state.msg}</div>}
            <button className="btn primary" style={{ marginTop: 14 }} disabled={state.kind === 'sending'}>
              {state.kind === 'sending' ? 'Mengirim…' : 'Kirim link masuk'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
