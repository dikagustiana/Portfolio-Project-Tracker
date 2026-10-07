// App shell: sidebar + main view + side peek + Quick Find (docs/ARCHITECTURE.md §G, spec §52–53).
// Navigation: Beranda (personal attention), Minggu ini, Keputusan, Portofolio, Tinjauan mingguan,
// Orang, Admin and Lab for the super admin. The project list shows the few most relevant
// readable projects; everything else is one click away in Portofolio or Quick Find.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useBoard } from '../data/board-context.ts'
import type { Project } from '../domain/index.ts'
import { supabase } from '../lib/supabase.ts'
import { Decisions } from '../views/Decisions.tsx'
import { Home } from '../views/Home.tsx'
import { People } from '../views/People.tsx'
import { Portfolio } from '../views/Portfolio.tsx'
import { ProjectView } from '../views/ProjectView.tsx'
import { RecordPage, PeekHost } from '../views/record/RecordView.tsx'
import { Review } from '../views/Review.tsx'
import { Week } from '../views/Week.tsx'
import { Avatar, Head, Icon } from './bits.tsx'
import { openFind } from './find.ts'
import { useFlows } from './flows.ts'
import { useActionCount } from './hooks.ts'
import { QuickFind, useFindShortcut } from './QuickFind.tsx'
import { ShellCtx } from './shell-context.ts'
import { applyTheme, go, useTheme, useUI } from './ui.ts'
import type { View } from './ui.ts'

// Super-admin screens load on demand, so everyone else's bundle stays smaller.
const Admin = lazy(() => import('../views/Admin.tsx').then((m) => ({ default: m.Admin })))
const Sim = lazy(() => import('../sim/SimHost.tsx').then((m) => ({ default: m.SimHost })))

/** How many projects the sidebar lists before "Lihat semua project". */
const SIDEBAR_PROJECTS = 6

export function Shell() {
  const ui = useUI()
  const { d, viewer } = useBoard()
  const [drawer, setDrawer] = useState(false)
  const shell = useMemo(() => ({ toggleDrawer: () => setDrawer((x) => !x), closeDrawer: () => setDrawer(false) }), [])
  useFindShortcut()

  // Read-only without a person (and not super admin); only the super admin creates projects or opens Admin.
  const ro = !viewer.isSuperAdmin && !viewer.personId
  useEffect(() => {
    const b = document.body.classList
    b.toggle('ro', ro)
    b.toggle('nocreate', ro || !viewer.isSuperAdmin)
    b.toggle('noadmin', ro || !viewer.isSuperAdmin)
  }, [ro, viewer.isSuperAdmin])

  let view: View = ui.view
  const pid = view === 'project' || view === 'record' ? d.resolveProject(ui.pid ?? '') : ''
  const p = pid ? d.project(pid) : undefined
  if ((view === 'admin' || view === 'sim') && !viewer.isSuperAdmin) view = 'home'

  // Per project: locked (closed/stopped) or read-only role hides write buttons (.w); no plan rights hides .wp.
  const role = p ? d.roleIn(p.id) : null
  const plock = !!p && (!d.pActive(p) || role === 'viewer' || role === null)
  const noplan = !!p && !d.canPlan(p)

  return (
    <ShellCtx value={shell}>
      <div
        className={`app${drawer ? ' drawer' : ''}`}
        id="app"
        onMouseDown={(e) => {
          if (drawer && !(e.target as HTMLElement).closest('.side') && !(e.target as HTMLElement).closest('.menu-btn')) setDrawer(false)
        }}
      >
        <aside className="side" id="side">
          <Sidebar onNavigate={() => setDrawer(false)} />
        </aside>
        <main className={`main${plock ? ' plock' : ''}${noplan ? ' noplan' : ''}`} id="main">
          {ro && (
            <div className="banner">Kamu bisa melihat, tapi belum bisa mengubah apa pun. Minta admin menambahkanmu sebagai anggota project.</div>
          )}
          {view === 'week' ? (
            <Week />
          ) : view === 'decisions' ? (
            <Decisions />
          ) : view === 'portfolio' ? (
            <Portfolio />
          ) : view === 'review' ? (
            <Review />
          ) : view === 'team' ? (
            <People />
          ) : view === 'sim' ? (
            <Suspense fallback={<div className="skel" />}>
              <Sim />
            </Suspense>
          ) : view === 'admin' ? (
            <Suspense fallback={<div className="skel" />}>
              <Admin />
            </Suspense>
          ) : view === 'record' && ui.rec ? (
            <RecordPage a={ui.rec} />
          ) : view === 'project' ? (
            p ? <ProjectView p={p} /> : <NoProject />
          ) : (
            <Home />
          )}
        </main>
        <PeekHost />
        <QuickFind />
      </div>
    </ShellCtx>
  )
}

/** A project that does not exist and one the viewer may not read look the same. */
function NoProject() {
  return (
    <>
      <Head eyebrow="Project" title="Tidak ditemukan" />
      <div className="sec">
        <p style={{ margin: 0 }}>Project ini tidak ada, atau kamu tidak punya akses. Minta admin project menambahkanmu kalau seharusnya kamu bisa melihatnya.</p>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => go({ view: 'portfolio' })}>
            Lihat project yang bisa kamu akses
          </button>
        </div>
      </div>
    </>
  )
}

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const ui = useUI()
  const { d, board, viewer } = useBoard()
  const flows = useFlows()
  const theme = useTheme()
  const count = useActionCount()
  const decide = d.asksFor('').length
  const me = d.person(viewer.personId)
  const nav = (patch: Parameters<typeof go>[0]) => {
    go(patch)
    onNavigate()
  }
  const last = (p: Project) => d.lastMovement(p.id)?.at ?? p.createdAt
  const active = board.projects.filter((p) => d.pActive(p))
  const mine = active.filter((p) => d.involved(p.id)).sort((a, b) => last(b) - last(a))
  const rest = active.filter((p) => !mine.includes(p)).sort((a, b) => last(b) - last(a))
  const listed = [...mine, ...rest].slice(0, SIDEBAR_PROJECTS)
  const cur = ui.view === 'project' || ui.view === 'record' ? d.resolveProject(ui.pid ?? '') : ''
  const curP = cur ? d.project(cur) : undefined
  if (curP && !listed.includes(curP)) listed.push(curP)
  const pCount = (p: Project) => {
    if (!d.pActive(p)) return p.status === 'selesai' ? '✓' : '✕'
    const g = d.prog(p.id)
    return g.n ? `${g.p}%` : '–'
  }
  const roleLabel = viewer.isSuperAdmin ? 'Owner · Super Admin' : me ? 'Anggota' : ''
  const item = (v: View, label: string, icon: Parameters<typeof Icon>[0]['name'], extra?: React.ReactNode) => (
    <button className={ui.view === v ? 'on' : ''} onClick={() => nav({ view: v })}>
      <Icon name={icon} />
      <span className="t">{label}</span>
      {extra}
    </button>
  )

  return (
    <>
      <div className="brand">
        <svg viewBox="0 0 120 56" role="img" aria-label="SAMB">
          <defs>
            <linearGradient id="sambSw" x1="0" x2="1">
              <stop offset="0" stopColor="#6f86ee" />
              <stop offset="1" stopColor="#3e55d8" />
            </linearGradient>
          </defs>
          <path d="M27 37C17 38 12 32 17 28.5C21 26 27 27.5 29.5 25.6C47 17 75 11 102 8.5" fill="none" stroke="url(#sambSw)" strokeWidth="2.6" strokeLinecap="round" />
          <circle className="dot" cx="108" cy="7.5" r="4.2" />
          <text className="wm" x="3" y="53" fontFamily="Georgia,'Times New Roman',serif" fontSize="15.5" fontWeight="700" letterSpacing="15">
            SAMB
          </text>
        </svg>
        <small>Project Board</small>
      </div>
      <button className="qf-btn" onClick={() => openFind()} aria-label="Cari cepat">
        <Icon name="search" /> Cari…
        <span className="kbd">/</span>
      </button>
      <nav className="nav" aria-label="Menu utama">
        {item('home', 'Beranda', 'grid', count > 0 ? <span className="badge" aria-label={`${count} perlu tindakan`}>{count}</span> : null)}
        {item('week', 'Minggu ini', 'cal')}
        {item('decisions', 'Keputusan', 'flame', decide > 0 ? <span className="badge">{decide}</span> : null)}
        {item('portfolio', 'Portofolio', 'boxes')}
        {item('review', 'Tinjauan mingguan', 'link')}
        {item('team', 'Orang', 'team', <span className="count">{board.people.length}</span>)}
        {viewer.isSuperAdmin && item('admin', 'Admin', 'boxes')}
        {viewer.isSuperAdmin && item('sim', 'Lab · Simulasi', 'grid')}
      </nav>
      <div>
        <div className="nav-label">
          <span>{mine.length ? 'Project saya' : 'Project'}</span>
          <button className="icon-btn w wc" aria-label="Project baru" onClick={() => flows.startWizard()}>
            <Icon name="plus" />
          </button>
        </div>
        <nav className="nav" style={{ marginTop: 6 }} aria-label="Daftar project">
          {listed.length ? (
            listed.map((p) => (
              <button
                key={p.id}
                title={p.name}
                className={cur === p.id ? 'on' : ''}
                onClick={() => nav({ view: 'project', pid: p.code || p.id, tab: 'milestone', who: 'all', q: '' })}
              >
                <span className={`dot g-${p.color || 'samb3'}`} />
                <span className="t">
                  <span className="ent">{p.code}</span>
                  {p.name}
                </span>
                <span className="count">{pCount(p)}</span>
              </button>
            ))
          ) : (
            <div className="sub" style={{ padding: '6px 10px' }}>
              Belum ada project
            </div>
          )}
        </nav>
        {board.projects.length > listed.length && (
          <button className="sidebar-more" onClick={() => nav({ view: 'portfolio', pf: 'all' })}>
            Lihat semua project ({board.projects.length})
          </button>
        )}
      </div>
      <div className="side-foot">
        {me ? (
          <div className="me-card">
            <Avatar id={me.id} size={28} />
            <div>
              <b style={{ color: 'var(--ink)' }}>{me.name}</b>
              <br />
              {roleLabel}
            </div>
          </div>
        ) : viewer.isSuperAdmin ? (
          <div className="me-card">
            <div>
              <b style={{ color: 'var(--ink)' }}>Owner · Super Admin</b>
              <br />
              Akunmu belum dihubungkan ke daftar orang.
            </div>
          </div>
        ) : (
          <div className="me-card">
            <div>Akunmu belum terhubung ke daftar orang. Minta admin menghubungkannya.</div>
          </div>
        )}
        <div className="themerow">
          <span className="lbl">
            Tema: <b>{{ auto: 'Otomatis', light: 'Terang', dark: 'Gelap' }[theme]}</b>
          </span>
          <div className="themesw" role="group" aria-label="Tema tampilan">
            {(
              [
                ['auto', 'Otomatis', 'auto'],
                ['light', 'Terang', 'sun'],
                ['dark', 'Gelap', 'moon'],
              ] as const
            ).map(([k, l, i]) => (
              <button
                key={k}
                className={theme === k ? 'on' : ''}
                aria-pressed={theme === k}
                aria-label={`Tema ${l}`}
                title={k === 'auto' ? 'Otomatis: ikuti tema perangkat' : `Tema ${l.toLowerCase()}`}
                onClick={() => applyTheme(k)}
              >
                <Icon name={i} />
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 10 }}>Tersimpan &amp; tersinkron untuk tim</div>
        <button className="linkbtn" style={{ marginTop: 8 }} onClick={() => void supabase?.auth.signOut()}>
          Keluar
        </button>
      </div>
    </>
  )
}
