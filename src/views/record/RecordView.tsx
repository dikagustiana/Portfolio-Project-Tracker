// One record view at two zoom levels (docs/ARCHITECTURE.md §G): the side peek over any screen, and
// the full page a direct URL opens. A record the viewer cannot read looks exactly like one that
// does not exist.
import { useEffect } from 'react'
import { Icon } from '../../app/bits.tsx'
import { useShell } from '../../app/shell-context.ts'
import { openFull, resolveAddr } from '../../app/nav.ts'
import { addrPath, go, setUI, useUI } from '../../app/ui.ts'
import type { Addr } from '../../app/ui.ts'
import { useBoard } from '../../data/board-context.ts'
import { AskRecord } from './AskRecord.tsx'
import { GateRecord } from './GateRecord.tsx'
import { TaskRecord } from './TaskRecord.tsx'

function Body({ a, zoom }: { a: Addr; zoom: 'peek' | 'full' }) {
  const { d } = useBoard()
  const { id } = resolveAddr(d, a)
  if (a.kind === 'task') {
    const t = d.task(id)
    if (t) return <TaskRecord t={t} zoom={zoom} />
  } else if (a.kind === 'gate') {
    const m = d.mstone(id)
    if (m) return <GateRecord m={m} zoom={zoom} />
  } else {
    const k = d.ask(id)
    if (k) return <AskRecord a={k} zoom={zoom} />
  }
  return (
    <div className="sec">
      <h3 style={{ margin: '0 0 6px' }}>Tidak ditemukan</h3>
      <p className="sub" style={{ margin: 0 }}>Data ini tidak ada, sudah dihapus, atau kamu tidak punya akses ke project-nya.</p>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => go({ view: 'home' })}>
          Ke Beranda
        </button>
      </div>
    </div>
  )
}

/** Full page: #/p/MB/t/MB12. */
export function RecordPage({ a }: { a: Addr }) {
  const { d } = useBoard()
  const { toggleDrawer } = useShell()
  const { projectId } = resolveAddr(d, a)
  const p = d.project(projectId)
  return (
    <>
      <div className="topbar" style={{ marginBottom: 14, alignItems: 'center' }}>
        <div className="row" style={{ gap: 10, flexWrap: 'nowrap', minWidth: 0 }}>
          <button className="icon-btn menu-btn" aria-label="Buka menu" onClick={toggleDrawer}>
            <Icon name="menu" />
          </button>
          <span className="eyebrow">{p ? `${p.code} · ${p.name}` : 'Record'}</span>
        </div>
        {p && (
          <button className="btn sm ghost" onClick={() => go({ view: 'project', pid: p.code || p.id, tab: a.kind === 'ask' ? 'keputusan' : 'milestone' })}>
            <Icon name="left" /> Ke project
          </button>
        )}
      </div>
      <div style={{ maxWidth: 860 }}>
        <Body key={addrPath(a)} a={a} zoom="full" />
      </div>
    </>
  )
}

/** Side peek over the current screen (?peek=MB/t/MB12). Esc or the scrim closes it. */
export function PeekHost() {
  const ui = useUI()
  const { d } = useBoard()
  const a = ui.peek
  useEffect(() => {
    if (!a) return
    const onKey = (e: KeyboardEvent) => {
      // A dialog or Quick Find above the peek handles its own Escape first.
      if (e.key === 'Escape' && !document.querySelector('#modalRoot .scrim, .qf-scrim')) setUI({ peek: null })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [a])
  if (!a) return null
  const { id } = resolveAddr(d, a)
  const close = () => setUI({ peek: null })
  return (
    <>
      <div className="peek-scrim" onMouseDown={close} />
      <aside className="peek" role="dialog" aria-modal="false" aria-label="Pratinjau record">
        <div className="peek-bar">
          <span className="sub">
            {a.code} · {a.ref}
          </span>
          <div className="row" style={{ gap: 4 }}>
            {id && (
              <button className="btn sm" onClick={() => openFull(d, { kind: a.kind, id })}>
                Buka halaman penuh
              </button>
            )}
            <button className="icon-btn" aria-label="Tutup pratinjau" onClick={close}>
              ✕
            </button>
          </div>
        </div>
        <div className="peek-scroll" key={`${a.code}/${a.kind}/${a.ref}`}>
          <Body a={a} zoom="peek" />
        </div>
      </aside>
    </>
  )
}
