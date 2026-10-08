import type { Session } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { Component, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Head } from './app/bits.tsx'
import { Login } from './app/Login.tsx'
import { OverlayProvider } from './app/overlay.tsx'
import { Shell } from './app/Shell.tsx'
import { BrandMark } from './components/BrandMark.tsx'
import { BoardProvider } from './data/board.tsx'
import type { Viewer } from './domain/index.ts'
import { FlowsProvider } from './flows/index.tsx'
import { supabase } from './lib/supabase.ts'
import type { Supa } from './lib/supabase.ts'

export default function App() {
  if (!supabase) return <Notice title="Konfigurasi belum diisi" text="Isi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY (lihat .env.example)." />
  return <SessionGate supa={supabase} />
}

function SessionGate({ supa }: { supa: Supa }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    void supa.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supa.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [supa])
  if (session === undefined) return <Loading />
  if (!session) return <Login supa={supa} />
  return <SignedIn supa={supa} userId={session.user.id} />
}

interface WhoAmI {
  user_id: string
  person_id: string | null
  system_role: 'super_admin' | 'user'
  is_super_admin: boolean
}

function SignedIn({ supa, userId }: { supa: Supa; userId: string }) {
  const who = useQuery({
    queryKey: ['whoami', userId],
    queryFn: async () => {
      const { data, error } = await supa.rpc('whoami')
      if (error) throw new Error(error.message)
      return data as unknown as WhoAmI
    },
    // Roles live in profiles, which is not streamed over Realtime: re-ask every minute and on focus,
    // so a withdrawn super admin role closes the admin screens and reloads the board within a minute.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  if (who.isError) return <Notice title="Gagal memuat akun" text={who.error.message} retry />
  if (!who.data) return <Loading />
  const viewer: Viewer = {
    userId: who.data.user_id,
    personId: who.data.person_id,
    isSuperAdmin: who.data.is_super_admin,
  }
  return (
    <OverlayProvider>
      <LoadBoundary>
        <BoardProvider supa={supa} viewer={viewer} loading={<Loading />}>
          <FlowsProvider>
            <Shell />
          </FlowsProvider>
        </BoardProvider>
      </LoadBoundary>
    </OverlayProvider>
  )
}

function Loading() {
  return (
    <div className="app">
      <main className="main">
        <Head eyebrow="Memuat data…" title="SAMB Project Board" />
        <div className="skel" />
      </main>
    </div>
  )
}

function Notice({ title, text, retry }: { title: string; text: string; retry?: boolean }) {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <section className="panel w-full max-w-md" style={{ padding: 32 }}>
        <BrandMark />
        <h1 className="mt-6 text-xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2" style={{ color: 'var(--muted)' }}>
          {text}
        </p>
        {retry && (
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" onClick={() => location.reload()}>
              Muat ulang
            </button>
            <button className="btn ghost" onClick={() => void supabase?.auth.signOut()}>
              Keluar
            </button>
          </div>
        )}
      </section>
    </main>
  )
}

class LoadBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) return <Notice title="Koneksi data terputus" text={this.state.error.message} retry />
    return this.props.children
  }
}
