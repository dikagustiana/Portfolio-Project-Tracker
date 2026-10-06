// Tabs and filters under the project header (prototype viewProject .toolbar, fWho/fQ handlers).
import { useRef, useState } from 'react'
import { Icon } from '../../app/bits.tsx'
import { setUI, useUI } from '../../app/ui.ts'
import type { Tab } from '../../app/ui.ts'
import { useBoard } from '../../data/board-context.ts'
import type { Project } from '../../domain/index.ts'
import { effectiveWho, memberOptions } from './model.ts'

/** Search box delay, like the prototype. */
const SEARCH_DEBOUNCE_MS = 250

export function Toolbar({ p, tab, tabs }: { p: Project; tab: Tab; tabs: readonly [Tab, string][] }) {
  const ui = useUI()
  const { d } = useBoard()
  const opts = memberOptions(d, p.id)
  return (
    <div className="toolbar">
      <div className="pills" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setUI({ tab: k })}>
            {l}
          </button>
        ))}
      </div>
      {tab !== 'milestone' && (
        <div className="row">
          {tab === 'gantt' && (
            <div className="pills">
              <button className={ui.zoom === 'day' ? 'on' : ''} onClick={() => setUI({ zoom: 'day' })}>
                Harian
              </button>
              <button className={ui.zoom === 'week' ? 'on' : ''} onClick={() => setUI({ zoom: 'week' })}>
                Mingguan
              </button>
            </div>
          )}
          <label className="field">
            <span className="sub">PIC</span>
            <select aria-label="Filter PIC" value={effectiveWho(ui.who, opts)} onChange={(e) => setUI({ who: e.target.value })}>
              <option value="all">Semua</option>
              <option value="none">Belum ditugaskan</option>
              {opts.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <SearchField />
        </div>
      )}
    </div>
  )
}

/**
 * "Cari task": the box keeps its own text and publishes it to UI.q 250 ms after the last
 * keystroke. The input element stays mounted while results re-render, so focus and caret stay.
 * A change of UI.q from elsewhere (e.g. reopening the project from the sidebar) resets the text.
 */
function SearchField() {
  const ui = useUI()
  const [text, setText] = useState(ui.q)
  const [seen, setSeen] = useState(ui.q)
  const [sent, setSent] = useState(ui.q)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  if (ui.q !== seen) {
    setSeen(ui.q)
    if (ui.q !== sent) setText(ui.q)
  }
  return (
    <label className="field">
      <Icon name="search" />
      <input
        type="search"
        placeholder="Cari task"
        aria-label="Cari task"
        value={text}
        onChange={(e) => {
          const v = e.target.value
          setText(v)
          clearTimeout(timer.current)
          // Like the prototype, a pending search still applies if the tab changes meanwhile.
          timer.current = setTimeout(() => {
            setSent(v)
            setUI({ q: v })
          }, SEARCH_DEBOUNCE_MS)
        }}
      />
    </label>
  )
}
