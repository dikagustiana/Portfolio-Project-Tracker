// The four live figures (brief §7.3). Each is a button that opens its number trace, and
// each follows the timeline day.

import { formatDays, formatM3, formatRp, formatRpShort } from '../../../core/format.ts'
import { metricsTrace } from '../engine/cost.ts'
import type { Allocations, MetricPoint } from '../engine/cost.ts'
import type { PrincipalId } from '../engine/config.ts'
import { num, trace } from '../../../core/trace.ts'
import type { Trace } from '../../../core/trace.ts'
import { PRINCIPAL_COLOR } from '../../../core/colors.ts'

interface MetricsBarProps {
  point: MetricPoint
  alloc: Allocations
  selectedPrincipal: PrincipalId | null
  onTrace: (t: Trace) => void
}

export function MetricsBar({ point, alloc, selectedPrincipal, onTrace }: MetricsBarProps) {
  const contribution = selectedPrincipal ? point.contribution[selectedPrincipal] : null
  const p = selectedPrincipal ? alloc.principal[selectedPrincipal] : null
  const costToDate = selectedPrincipal ? point.costToDate[selectedPrincipal] : 0
  const gpToDate = selectedPrincipal ? point.gpToDate[selectedPrincipal] : 0
  const contributionTrace = selectedPrincipal
    ? trace(
        `Kontribusi Prinsipal ${selectedPrincipal} s.d. hari ${point.day}`, 'rp', '{0} − {1}',
        [num('laba kotor terakumulasi', gpToDate, 'rp'), num('biaya terakumulasi', costToDate, 'rp')],
        (gp, cost) => gp - cost,
      )
    : null
  const perM3Trace = selectedPrincipal
    ? trace(
        `Biaya per m³ Prinsipal ${selectedPrincipal} (bulan ini)`, 'rp', '{0} / {1}',
        [num('biaya total bulan ini', p ? p.grossProfit - p.contribution : 0, 'rp'), num('m³ terkirim bulan ini', p?.m3Delivered ?? 0, 'm3')],
        (c, m) => (m > 0 ? c / m : 0),
      )
    : null
  const items: { label: string; value: string; sub: string; onClick: () => void }[] = [
    {
      label: 'Biaya teralokasi s.d. hari ini',
      value: formatRp(point.allocatedToDate),
      sub: 'Semua pool yang sudah terserap',
      onClick: () => onTrace(metricsTrace('costPerM3', point, alloc)),
    },
    {
      label: 'Biaya layanan per m³',
      value: p ? formatRp(p.costPerM3) : formatRp(point.costPerM3),
      sub: p ? `Prinsipal ${selectedPrincipal}, rata-rata bulan ini` : `Semua prinsipal, s.d. hari ini atas ${formatM3(point.m3ToDate)}`,
      onClick: () => onTrace(perM3Trace ?? metricsTrace('costPerM3', point, alloc)),
    },
    {
      label: 'Hari kas tertahan (rata-rata tertimbang)',
      value: formatDays(point.cashDays),
      sub: 'Kirim → invoice → tukar faktur → TOP → bayar',
      onClick: () => onTrace(metricsTrace('cashDays', point, alloc)),
    },
    {
      label: 'Kontribusi prinsipal terpilih',
      value: contribution === null ? 'Pilih prinsipal' : formatRpShort(contribution),
      sub: selectedPrincipal ? `Prinsipal ${selectedPrincipal}, laba kotor − biaya` : 'Klik "Ikuti prinsipal" di panel',
      onClick: () => onTrace(contributionTrace ?? metricsTrace('cashDays', point, alloc)),
    },
  ]
  return (
    <div className="sim-metrics" role="group" aria-label="Metrik utama">
      {items.map((m) => (
        <button
          key={m.label}
          type="button"
          className="sim-metric"
          onClick={m.onClick}
          style={{ textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '10px 14px', cursor: 'pointer' }}
          title="Lihat jejak angka"
        >
          <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{m.label}</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--f-mono)', marginTop: 2 }}>
            {selectedPrincipal && <span aria-hidden style={{ color: PRINCIPAL_COLOR[selectedPrincipal], marginRight: 6 }}>●</span>}
            {m.value}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m.sub}</div>
        </button>
      ))}
    </div>
  )
}
