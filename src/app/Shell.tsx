// App shell: sidebar + main view (prototype render/renderSide/renderMain).
import { useEffect, useMemo, useState } from 'react'
import { useBoard } from '../data/board-context.ts'
import type { Project } from '../domain/index.ts'
import { supabase } from '../lib/supabase.ts'
import { Admin } from '../views/Admin.tsx'
import { Dashboard } from '../views/Dashboard.tsx'
import { ProjectView } from '../views/ProjectView.tsx'
import { Team } from '../views/Team.tsx'
import { Week } from '../views/Week.tsx'
import { Avatar, Icon } from './bits.tsx'
import { useFlows } from './flows.ts'
import { useActionCount } from './hooks.ts'
import { ShellCtx } from './shell-context.ts'
import { applyTheme, setUI, useTheme, useUI } from './ui.ts'
import type { View } from './ui.ts'

export function Shell() {
  const ui = useUI()
  const { d, viewer } = useBoard()
  const [drawer, setDrawer] = useState(false)
  const shell = useMemo(() => ({ toggleDrawer: () => setDrawer((x) => !x), closeDrawer: () => setDrawer(false) }), [])

  // Read-only without a person (and not owner); only the owner creates projects or manages admin.
  const ro = !viewer.isOwner && !viewer.personId
  useEffect(() => {
    const b = document.body.classList
    b.toggle('ro', ro)
    b.toggle('nocreate', ro || !viewer.isOwner)
    b.toggle('noadmin', ro || !viewer.isOwner)
  }, [ro, viewer.isOwner])

  let view: View = ui.view
  const p = ui.view === 'project' ? d.project(ui.pid) : undefined
  if (view === 'project' && !p) view = 'dash'
  if (view === 'admin' && !viewer.isOwner) view = 'dash'

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
            <div className="banner">
              Kamu bisa melihat, tapi belum bisa mengubah apa pun. Minta owner menambahkanmu sebagai anggota project.
            </div>
          )}
          {view === 'team' ? (
            <Team />
          ) : view === 'week' ? (
            <Week />
          ) : view === 'admin' ? (
            <Admin />
          ) : view === 'project' && p ? (
            <ProjectView p={p} />
          ) : (
            <Dashboard />
          )}
        </main>
      </div>
    </ShellCtx>
  )
}

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const ui = useUI()
  const { d, board, viewer } = useBoard()
  const flows = useFlows()
  const theme = useTheme()
  const count = useActionCount()
  const me = d.person(viewer.personId)
  const go = (patch: Parameters<typeof setUI>[0]) => {
    setUI(patch)
    onNavigate()
    window.scrollTo(0, 0)
  }
  const ps = [...board.projects].sort((a, b) => Number(d.pActive(b)) - Number(d.pActive(a)) || a.createdAt - b.createdAt)
  const pCount = (p: Project) => {
    if (!d.pActive(p)) return p.status === 'selesai' ? '✓' : '✕'
    const g = d.prog(p.id)
    return g.n ? `${g.p}%` : '–'
  }
  const roleLabel = viewer.isOwner ? 'Owner' : viewer.isGroupViewer ? 'Group viewer' : me ? 'Anggota tim' : ''

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
      <nav className="nav" aria-label="Menu utama">
        <button className={ui.view === 'dash' ? 'on' : ''} onClick={() => go({ view: 'dash' })}>
          <Icon name="grid" />
          <span className="t">Dashboard</span>
        </button>
        <button className={ui.view === 'week' ? 'on' : ''} onClick={() => go({ view: 'week' })}>
          <Icon name="cal" />
          <span className="t">Minggu ini</span>
          {count > 0 && <span className="badge">{count}</span>}
        </button>
        <button className={ui.view === 'team' ? 'on' : ''} onClick={() => go({ view: 'team' })}>
          <Icon name="team" />
          <span className="t">Tim</span>
          <span className="count">{board.people.length}</span>
        </button>
        {viewer.isOwner && (
          <button className={ui.view === 'admin' ? 'on' : ''} onClick={() => go({ view: 'admin' })}>
            <Icon name="boxes" />
            <span className="t">Admin</span>
          </button>
        )}
      </nav>
      <div>
        <div className="nav-label">
          <span>Project</span>
          <button className="icon-btn w wc" aria-label="Project baru" onClick={() => flows.startWizard()}>
            <Icon name="plus" />
          </button>
        </div>
        <nav className="nav" style={{ marginTop: 6 }} aria-label="Daftar project">
          {ps.length ? (
            ps.map((p) => (
              <button
                key={p.id}
                title={p.name}
                className={ui.view === 'project' && ui.pid === p.id ? 'on' : ''}
                onClick={() => go({ view: 'project', pid: p.id, who: 'all', q: '' })}
              >
                <span className={`dot g-${p.color || 'samb3'}`} />
                <span className="t">
                  {p.entity && <span className="ent">{p.entity}</span>}
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
        ) : viewer.isOwner ? (
          <div className="me-card">
            <div>
              <b style={{ color: 'var(--ink)' }}>Owner</b>
              <br />
              Akunmu belum dihubungkan ke daftar orang.
            </div>
          </div>
        ) : (
          <div className="me-card">
            <div>Akunmu belum terhubung ke daftar orang. Minta owner menghubungkannya.</div>
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
