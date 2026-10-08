// V0 of Brief B4: Factory Yard's town inside the simulation route, as it is. The markup is the
// original page's figure (data-fy instead of ids, so nothing collides with the board); the
// scene module builds the canvas and tears everything down on unmount.
import { useEffect, useRef } from 'react'
import { mountTown } from './town.js'
import './town.css'

export default function TownV0() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    return mountTown(el)
  }, [])
  return (
    <div className="fy" ref={ref}>
      <figure>
        <div className="cap">
          <span className="hi">
            Fig 1 · <span data-fy="clock">10:00</span>
          </span>
          <nav className="sites" aria-label="Places">
            {['Factory', 'Warehouse', 'Shop', 'Town', 'Coast'].map((p, i) => (
              <button key={p} type="button" data-view={i} title={`${p} (${i + 1})`}>
                {p}
              </button>
            ))}
          </nav>
        </div>
        <div className="stage" data-fy="stage">
          <div className="tools">
            <button type="button" data-fy="zoomIn" title="Zoom in (+)" aria-label="Zoom in">
              <svg viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" /></svg>
            </button>
            <button type="button" data-fy="zoomOut" title="Zoom out (−)" aria-label="Zoom out">
              <svg viewBox="0 0 16 16"><path d="M3 8h10" /></svg>
            </button>
            <button type="button" data-fy="home" title="Reset view (0)" aria-label="Reset view">
              <svg viewBox="0 0 16 16"><path d="M2.5 7.5 8 3l5.5 4.5M4 6.5V13h8V6.5" /></svg>
            </button>
            <span className="gap" />
            <button type="button" data-fy="pause" title="Pause (Space)" aria-label="Pause" aria-pressed="false">
              <svg viewBox="0 0 16 16"><path d="M5.5 3.5v9M10.5 3.5v9" /></svg>
            </button>
            <button type="button" data-fy="theme" title="Light or dark (T)" aria-label="Switch light or dark theme">
              <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" /><path d="M8 3a5 5 0 0 0 0 10z" fill="currentColor" /></svg>
            </button>
            <button type="button" data-fy="time" title="Skip ahead 6 hours (N)" aria-label="Skip ahead six hours">
              <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" /><path d="M8 4.8V8l2.2 1.6" /></svg>
            </button>
          </div>
          <div className="tag hover" data-fy="tagHover" hidden />
          <div className="tag" data-fy="tagSel" hidden />
          <div className="tag stop" data-fy="tagStop" hidden />
          <aside className="card" data-fy="card" role="region" aria-label="Selection details" hidden>
            <div className="head">
              <span data-fy="cardKind" />
              <button type="button" data-fy="cardClose" aria-label="Close details" title="Close (Esc)">
                ×
              </button>
            </div>
            <div className="title" data-fy="cardTitle" />
            <div className="status" data-fy="cardStatus" />
            <div className="bar" data-fy="cardBar" hidden>
              <span />
              <div>
                <i />
              </div>
            </div>
            <dl data-fy="cardRows" />
            <div className="foot" data-fy="cardFoot">
              <button type="button" data-fy="cardFollow" aria-pressed="false" title="Follow (F)">
                Follow
              </button>
            </div>
          </aside>
          <p className="note" data-fy="note" hidden />
        </div>
        <div className="cap">
          <span className="fine">Drag to pan · scroll to zoom · click anything</span>
          <span className="coarse">Drag to pan · pinch to zoom · tap anything</span>
          <span className="hi" data-fy="readout">
            loading
          </span>
        </div>
      </figure>
    </div>
  )
}
