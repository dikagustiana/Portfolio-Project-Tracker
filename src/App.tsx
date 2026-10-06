import { BrandMark } from './components/BrandMark.tsx'
import { supabaseConfigured } from './lib/supabase.ts'

export default function App() {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <section className="w-full max-w-md rounded-lg bg-surface p-8 shadow-panel">
        <BrandMark />
        <h1 className="mt-6 text-xl font-extrabold tracking-tight">Sedang disiapkan</h1>
        <p className="mt-2 text-muted">
          Kerangka app sudah siap. Login, data project, dan halaman-halamannya menyusul di tahap berikutnya.
        </p>
        <p className="mt-6 text-xs text-muted">
          {supabaseConfigured ? 'Konfigurasi Supabase terisi.' : 'Konfigurasi Supabase belum diisi (lihat .env.example).'}
        </p>
      </section>
    </main>
  )
}
