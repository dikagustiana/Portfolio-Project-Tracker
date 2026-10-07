// Quick Find (docs/ARCHITECTURE.md §G): one box over every record the viewer can read — projects,
// tasks, gates, Keputusan, people. Exact short ids rank first (MB12, G3, K01). Opens with "/" or
// Ctrl/⌘ K. Restricted projects are not on the board, so they cannot appear here.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useBoard } from '../data/board-context.ts'
import { bareTitle } from '../domain/index.ts'
import type { SearchHit } from '../domain/index.ts'
import { Icon } from './bits.tsx'
import { closeFind, useFindOpen } from './find.ts'
import { openProject, peek } from './nav.ts'
import { go } from './ui.ts'

const KIND: Record<SearchHit['kind'], string> = { project: 'Project', task: 'Task', gate: 'Milestone', ask: 'Keputusan', person: 'Orang' }

export function QuickFind() {
  const open = useFindOpen()
  if (!open) return null
  return <FindBox />
}

function FindBox() {
  const { d } = useBoard()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const hits = useMemo(() => d.search(q, 24), [d, q])
  useEffect(() => input.current?.focus(), [])
  const choose = (h: SearchHit | undefined) => {
    if (!h) return
    closeFind()
    if (h.kind === 'project') return openProject(d, h.id)
    if (h.kind === 'person') return go({ view: 'team' })
    peek(d, { kind: h.kind, id: h.id })
  }
  return (
    <div
      className="qf-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeFind()
      }}
    >
      <div className="qf" role="dialog" aria-modal="true" aria-label="Cari cepat">
        <div className="qf-in">
          <Icon name="search" />
          <input
            ref={input}
            value={q}
            placeholder="Cari project, task, milestone, keputusan, orang… (mis. MB12)"
            aria-label="Cari"
            onChange={(e) => {
              setQ(e.target.value)
              setI(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeFind()
              else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setI((x) => Math.min(x + 1, hits.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setI((x) => Math.max(x - 1, 0))
              } else if (e.key === 'Enter') choose(hits[i])
            }}
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="qf-list" role="listbox">
          {q.trim() && !hits.length && <div className="sub" style={{ padding: 12 }}>Tidak ada yang cocok di project yang bisa kamu lihat.</div>}
          {!q.trim() && <div className="sub" style={{ padding: 12 }}>Ketik ID (MB12, G3, K01), judul, atau nama.</div>}
          {hits.map((h, n) => (
            <button key={`${h.kind}${h.id}`} role="option" aria-selected={n === i} className={`qf-hit${n === i ? ' on' : ''}`} onMouseEnter={() => setI(n)} onClick={() => choose(h)}>
              <span className="ref">{h.ref || '—'}</span>
              <span style={{ minWidth: 0 }}>
                <div className="tt">{bareTitle(h.ref, h.title)}</div>
                <div className="sub">{h.sub}</div>
              </span>
              <span className="k">{KIND[h.kind]}</span>
            </button>
          ))}
        </div>
        <div className="qf-foot">
          <span className="kbd">↑</span> <span className="kbd">↓</span> pilih · <span className="kbd">Enter</span> buka · <span className="kbd">/</span> atau <span className="kbd">Ctrl K</span> dari mana saja
        </div>
      </div>
    </div>
  )
}
