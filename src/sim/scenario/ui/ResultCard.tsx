// The result card (Brief B6 §3): Biaya per unit as a waterfall from Rp 0, Biaya per tim, Garis
// waktu kas, Asumsi skenario, Celah data and Ringkasan, with Salin link. Every number carries
// its badge. Unduh CSV, Tampilan cetak and Bandingkan arrive in S4.
import { useState } from 'react'
import { calc, fig, fmt } from '../figure.ts'
import { byTeam } from '../run.ts'
import type { AnyScenario, Fig, Run } from '../types.ts'
import { FigView, LineView } from './Fig.tsx'

export function ResultCard({ def, run, inputs, link, stale, onGoto, onClose }: { def: AnyScenario; run: Run; inputs: object; link: string; stale: boolean; onGoto: (playIdx: number) => void; onClose: () => void }) {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)
  const done = run.rows.filter((r) => r.state === 'done')
  const played = run.rows.filter((r) => r.state === 'done' || r.state === 'paused')
  const unit = run.units.unit
  const teams = byTeam(run, def.teams)
  const unwired = run.rows.filter((r) => r.state === 'unwired')
  const cash = done.flatMap((r) => (r.out?.cash ?? []).map((c) => ({ ...c, step: r.n })))
  const gapsRan = done.filter((r) => r.used.length > 0)
  const copy = (): void => {
    navigator.clipboard.writeText(link).then(
      () => setCopied('ok'),
      () => setCopied('fail'),
    )
  }
  return (
    <section className="sc-result" aria-label="Hasil skenario">
      <div className="yd-head">
        <span className="yd-kicker">Hasil skenario · {def.title}</span>
        <button type="button" className="yd-icon" aria-label="Tutup hasil" title="Tutup (Esc)" onClick={onClose}>
          ×
        </button>
      </div>
      <h2 className="sc-big">
        <FigView f={run.perUnit} strong />
      </h2>
      <p className="sc-sub">
        Total <FigView f={run.total} /> untuk <FigView f={run.units} />
      </p>
      {run.status === 'partial' && (
        <p className="yd-notes">
          Langkah {played[0]?.n}–{played.at(-1)?.n} dari {def.count} sudah berjalan; langkah {unwired[0]?.n}–{unwired.at(-1)?.n} menyusul di S1. Biaya per unit ini belum penuh.
        </p>
      )}
      {stale && <p className="yd-notes">Data engine berubah sejak skenario ini dibuat; angka di bawah dihitung ulang dari data engine sekarang.</p>}

      <div className="sc-grid">
        <section className="sc-sec sc-wide">
          <h3>1 · Biaya per {unit}</h3>
          <Waterfall run={run} onGoto={(n) => onGoto(played.findIndex((r) => r.n === n))} />
        </section>

        <section className="sc-sec">
          <h3>2 · Biaya per tim</h3>
          <ul className="sc-bars">
            {teams.map((t) => {
              const max = Math.max(...teams.map((x) => x.cost.value), 1e-9)
              return (
                <li key={t.team}>
                  <span>{t.team}</span>
                  <FigView f={t.cost} />
                  <i style={{ width: `${(t.cost.value / max) * 100}%` }} />
                </li>
              )
            })}
          </ul>
          {unwired.length > 0 && <p className="sc-help">Tim lain ({[...new Set(unwired.map((r) => r.team))].join(', ')}) masuk saat langkahnya tersambung.</p>}
        </section>

        <section className="sc-sec">
          <h3>3 · Garis waktu kas</h3>
          {cash.length ? (
            <ol className="sc-cash">
              {cash.map((c, k) => (
                <li key={k} className={c.kind}>
                  <span>Hari {c.day}</span>
                  {c.label}
                  <FigView f={c.value} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="sc-help">Belum ada kas keluar atau masuk sampai langkah {played.at(-1)?.n}: PO tidak dibayar saat dibuat. Kas masuk, hari kas tertahan dan biaya modal dihitung di langkah 11 (S1).</p>
          )}
        </section>

        <section className="sc-sec">
          <h3>4 · Asumsi skenario</h3>
          {run.assumptions.length ? (
            <ul className="sc-asm">
              {run.assumptions.map((a) => (
                <li key={a.gap.id}>
                  <b>{a.gap.label}</b>
                  <FigView f={fig(a.gap.label, a.value, a.gap.unit, 'asumsi', { asm: a.gap.id, dp: Number.isInteger(a.value) ? 0 : 2 })} />
                  <small>
                    Pemilik: {a.gap.owner} · langkah {a.step}
                    {a.gap.gate ? ` · gerbang ${a.gap.gate}${a.gap.gateOwner ? ` (${a.gap.gateOwner})` : ''}` : ''}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sc-help">Tidak ada: semua langkah yang berjalan memakai data engine.</p>
          )}
        </section>

        <section className="sc-sec">
          <h3>5 · Celah data</h3>
          {gapsRan.length ? (
            <ul className="sc-gaps">
              {gapsRan.map((r) => (
                <li key={r.n}>
                  <button type="button" onClick={() => onGoto(played.indexOf(r))}>
                    Langkah {r.n} · {r.title}
                  </button>
                  <small>{run.assumptions.filter((a) => a.step === r.n).map((a) => a.gap.label).join(' · ')}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sc-help">Tidak ada langkah yang berjalan di atas asumsi.</p>
          )}
        </section>

        <section className="sc-sec">
          <h3>6 · Ringkasan</h3>
          <ul className="sc-summary">
            {def.summary(inputs).map((l, k) => (
              <li key={k}>
                <LineView l={l} />
              </li>
            ))}
            <li>
              Total <FigView f={run.total} /> · <FigView f={run.perUnit} />
            </li>
            <li>
              {def.dataLabel} · versi data <code>{run.hash}</code>
            </li>
          </ul>
        </section>
      </div>

      <div className="sc-actions">
        <button type="button" className="sc-primary" onClick={copy}>
          Salin link
        </button>
        <button type="button" disabled title="Menyusul di S4">
          Unduh CSV
        </button>
        <button type="button" disabled title="Menyusul di S4">
          Tampilan cetak
        </button>
        <button type="button" disabled title="Menyusul di S4">
          Bandingkan
        </button>
        <span role="status">{copied === 'ok' ? 'Link tersalin' : copied === 'fail' ? 'Browser menolak menyalin; salin dari bilah alamat' : ''}</span>
      </div>
    </section>
  )
}

/** from Rp 0 to the cost per unit, one bar per step, its value and badge on every bar */
function Waterfall({ run, onGoto }: { run: Run; onGoto: (n: string) => void }) {
  const done = run.rows.filter((r) => r.state === 'done' && r.perUnit)
  const total = run.perUnit.value
  const span = Math.max(total, 1e-9)
  // where each bar starts: the sum of the bars before it
  const starts = done.map((_, k) => done.slice(0, k).reduce((s, r) => s + (r.perUnit?.value ?? 0), 0))
  const zero = fig('Awal', 0, run.perUnit.unit, 'hitungan', { formula: 'skenario mulai dari nol', inputs: [] })
  const closes: Fig = calc('Selisih penutup', run.perUnit.unit, '{0} − jumlah batang', [run.perUnit], (x) => x - done.reduce((s, r) => s + (r.perUnit?.value ?? 0), 0))
  return (
    <ol className="yd-wf sc-wf" aria-label={`Biaya per ${run.units.unit}, dari Rp 0`}>
      <li className="total">
        <span>Awal</span>
        <div>
          <i style={{ left: 0, width: '0.6%' }} />
        </div>
        <FigView f={zero} />
      </li>
      {done.map((r, k) => {
        const v = r.perUnit?.value ?? 0
        const from = starts[k] ?? 0
        const at = from + v
        return (
          <li key={r.n} className={v > 0 ? 'up' : v < 0 ? 'down' : 'flat'}>
            <button type="button" onClick={() => onGoto(r.n)} title={`Ke langkah ${r.n}`}>
              {r.n} · {r.team}
            </button>
            <div>
              <i style={{ left: `${(Math.min(from, at) / span) * 100}%`, width: `${Math.max(0.6, (Math.abs(v) / span) * 100)}%` }} />
            </div>
            {r.perUnit && <FigView f={r.perUnit} signed />}
          </li>
        )
      })}
      <li className="total">
        <span>Biaya per {run.units.unit}</span>
        <div>
          <i style={{ left: 0, width: '100%' }} />
        </div>
        <FigView f={run.perUnit} strong />
      </li>
      {Math.abs(closes.value) > 0.005 && <li className="sc-err">Waterfall tidak menutup: {fmt(closes)}</li>}
    </ol>
  )
}
