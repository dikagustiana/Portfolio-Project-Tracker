// Director mode's chrome (Brief B6 §3): the caption bar over the map, the step tracker and the
// controls in the bottom bar (play and pause, previous, next, 1× 4× 16× Instan, ulang, keluar)
// with the scenario clock, and the scenario tiles in the metrics bar.
import { formatNumber } from '../../core/format.ts'
import type { Director } from '../director.ts'
import { SPEEDS } from '../director.ts'
import { fmt, sum } from '../figure.ts'
import type { Fig, Run } from '../types.ts'
import { Badge, FigView } from './Fig.tsx'

/** a tile's value with its badge on the line under it, so the number keeps the width */
function TileFig({ f, sub }: { f: Fig | undefined; sub: string }) {
  return (
    <>
      <b>{f ? fmt(f.unit.startsWith('Rp/') ? { ...f, unit: 'Rp' } : f) : '—'}</b>
      <span className="yd-msub">
        {f && <Badge f={f} />} {sub}
      </span>
    </>
  )
}

export function Caption({ d, count }: { d: Director; count: number }) {
  const r = d.row
  if (!r) return null
  const played = d.rows
  if (d.finished) {
    return (
      <div className="sc-caption done" role="status">
        <b>Skenario selesai</b>
        <span>
          · langkah {played[0]?.n}–{played.at(-1)?.n} dari {count} ·
        </span>
        <FigView f={d.run.perUnit} />
      </div>
    )
  }
  return (
    <div className={`sc-caption${d.awaiting ? ' wait' : ''}`} role="status">
      <b>
        Langkah {r.n} dari {count}
      </b>
      <span>· {r.title}</span>
      {d.awaiting ? (
        <em>· menunggu asumsi</em>
      ) : (
        r.out && (
          <>
            {r.out.driver && (
              <span>
                · driver: <FigView f={r.out.driver} />
              </span>
            )}
            <span>
              · <FigView f={r.out.cost} signed />
            </span>
          </>
        )
      )}
    </div>
  )
}

export function StepTracker({ run, d, onGoto }: { run: Run; d: Director; onGoto: (playIdx: number) => void }) {
  const played = d.rows
  return (
    <ol className="yd-tracker sc-tracker" aria-label="Langkah skenario">
      {run.rows.map((r) => {
        const pi = played.indexOf(r)
        const reached = pi >= 0 && (pi < d.idx || (pi === d.idx && d.finished))
        const now = pi === d.idx && !d.finished
        return (
          <li key={r.n} className={`${reached && r.state === 'done' ? 'done' : now ? 'now' : ''} ${r.state}`} aria-current={now ? 'step' : undefined}>
            {pi >= 0 ? (
              <button type="button" onClick={() => onGoto(pi)} title={`${r.n} · ${r.title}`} aria-label={`Langkah ${r.n}: ${r.title}`}>
                <span>{r.n}</span>
                {(reached || now) && r.team}
              </button>
            ) : (
              <span title={`${r.n} · ${r.title} · ${r.state === 'unwired' ? 'menyusul (S1)' : 'setelah asumsi'}`}>{r.n}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function Controls({ d, onExit, onResult }: { d: Director; onExit: () => void; onResult?: () => void }) {
  const day = Math.floor(d.day)
  return (
    <div className="yd-time sc-controls" role="group" aria-label="Kontrol skenario">
      <button type="button" className="yd-icon" aria-label="Langkah sebelumnya" title="Langkah sebelumnya (←)" onClick={() => d.prev()} disabled={d.idx === 0 && !d.finished}>
        ⏮
      </button>
      <button type="button" className="yd-icon" aria-label={d.playing ? 'Jeda skenario' : 'Putar skenario'} title="Putar / jeda (Spasi)" onClick={() => (d.playing ? d.pause() : d.play())} disabled={d.awaiting}>
        {d.playing ? '❚❚' : '▶'}
      </button>
      <button type="button" className="yd-icon" aria-label="Langkah berikutnya" title="Langkah berikutnya (→)" onClick={() => d.next()} disabled={d.awaiting || d.finished}>
        ⏭
      </button>
      {SPEEDS.map((s) => (
        <button key={s} type="button" className="yd-speed" aria-pressed={d.speed === s} onClick={() => d.setSpeed(s)}>
          {s === 0 ? 'Instan' : `${s}×`}
        </button>
      ))}
      <button type="button" className="yd-speed" onClick={() => d.start()}>
        Ulang
      </button>
      {onResult && (
        <button type="button" className="yd-speed" onClick={onResult}>
          Hasil
        </button>
      )}
      <button type="button" className="yd-speed" onClick={onExit}>
        Keluar
      </button>
      <span className="yd-day" aria-live="polite">
        Hari skenario {formatNumber(day)}
      </span>
    </div>
  )
}

/** the metrics bar while a scenario plays: volume, step, cost so far, cost per unit, assumptions */
export function Tiles({ run, d, extra, count }: { run: Run; d: Director; extra: string; count: number }) {
  const shown = d.rows.slice(0, d.idx + 1).filter((r) => r.state === 'done')
  const cum = shown.at(-1)?.cum
  const per: Fig | undefined = shown.length ? sum(`Biaya per ${run.units.unit} s.d. langkah ini`, `Rp/${run.units.unit}`, shown.map((r) => r.perUnit).filter((x): x is Fig => !!x)) : undefined
  const r = d.row
  return (
    <ul className="yd-metrics sc-tiles" aria-live="polite" style={{ ['--n' as string]: 5 }}>
      <li className="yd-metric">
        <span className="yd-mlabel">Volume skenario</span>
        <TileFig f={run.units} sub={extra} />
      </li>
      <li className="yd-metric">
        <span className="yd-mlabel">Langkah</span>
        <b>{d.finished ? 'selesai' : `${r?.n ?? '—'} dari ${count}`}</b>
        <span className="yd-msub">{d.finished ? 'kartu hasil terbuka' : (r?.role ?? '')}</span>
      </li>
      <li className="yd-metric">
        <span className="yd-mlabel">Biaya s.d. langkah ini</span>
        <TileFig f={cum} sub="kumulatif" />
      </li>
      <li className="yd-metric">
        <span className="yd-mlabel">Per {run.units.unit}</span>
        <TileFig f={per} sub="biaya s.d. langkah ini" />
      </li>
      <li className={`yd-metric${run.assumptions.length ? ' warn' : ''}`}>
        <span className="yd-mlabel">Asumsi skenario</span>
        <b>{formatNumber(run.assumptions.length)}</b>
        <span className="yd-msub">{run.status === 'paused' ? 'satu langkah menunggu nilai' : 'nilai diisi pengguna'}</span>
      </li>
    </ul>
  )
}
