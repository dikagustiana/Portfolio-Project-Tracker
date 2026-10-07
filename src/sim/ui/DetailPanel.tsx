// The right panel (brief §7.7): object name, step, team, what happens, driver volumes,
// pool cost, cost per driver unit, principal split bars, and the expandable number trace.
// Truck selection adds the cost groups, m³ split and DO drill-down; invoice selection shows
// the three cash segments. With no selection it lists the principals (follow entry).

import { useState } from 'react'
import type { Computed } from '../engine/index.ts'
import type { PrincipalId, Toggles } from '../engine/config.ts'
import { ZONES } from '../engine/config.ts'
import { formatDays, formatM3, formatNumber, formatPct, formatRp, formatRpShort } from '../engine/format.ts'
import { PALLET_RULES } from '../engine/config.ts'
import { objectById } from './objects.ts'
import type { WorldObject } from './objects.ts'
import { PRINCIPAL_COLOR, PRINCIPAL_COLOR_SOFT } from './colors.ts'
import { TraceView } from './TraceView.tsx'
import type { Trace } from '../engine/trace.ts'

interface DetailPanelProps {
  data: Computed
  day: number
  toggles: Toggles
  selected: string | null
  follow: PrincipalId | null
  onSelect: (id: string | null) => void
  onFollow: (p: PrincipalId | null) => void
  trace: Trace | null
  onTrace: (t: Trace | null) => void
  onCloseTrace: () => void
}

function SplitBars({ data, day, id, kind }: { data: Computed; day: number; id: string; kind: 'trip' | 'desk' }) {
  const { world, alloc } = data
  const rows: { p: PrincipalId; volume: number }[] = []
  if (kind === 'trip') {
    const at = alloc.trips.find((t) => t.trip.id === id)
    if (at) for (const p of Object.keys(PRINCIPAL_COLOR) as PrincipalId[]) rows.push({ p, volume: at.measureByPrincipal[p] })
  } else {
    const m3ByP = new Map<PrincipalId, number>()
    for (const d of world.dos.filter((x) => x.day === day)) {
      for (const l of d.lines) {
        const p = world.skus[l.sku]?.principal
        if (p) m3ByP.set(p, (m3ByP.get(p) ?? 0) + l.m3)
      }
    }
    const total = [...m3ByP.values()].reduce((s, x) => s + x, 0)
    for (const p of Object.keys(PRINCIPAL_COLOR) as PrincipalId[]) rows.push({ p, volume: m3ByP.get(p) ?? 0 })
    void total
  }
  const max = Math.max(...rows.map((r) => r.volume), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {rows.map((r) => (
        <div key={r.p} style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto', gap: 8, alignItems: 'center' }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: PRINCIPAL_COLOR[r.p] }} />
          <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 10, overflow: 'hidden' }}>
            <div style={{ width: `${(r.volume / max) * 100}%`, height: '100%', background: PRINCIPAL_COLOR[r.p] }} />
          </div>
          <span style={{ fontSize: 11.5, fontFamily: 'var(--f-mono)' }}>{formatRpShort(r.volume)}</span>
        </div>
      ))}
    </div>
  )
}

export function DetailPanel({ data, day, toggles, selected, follow, onSelect, onFollow, trace, onTrace, onCloseTrace }: DetailPanelProps) {
  const { world, alloc } = data
  const [expandTrace, setExpandTrace] = useState(false)
  const o = selected ? objectById(selected) : undefined
  const palletRuleLabel = PALLET_RULES[toggles.palletRule].label

  if (trace) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 14 }}>
        <TraceView root={trace} onClose={onCloseTrace} />
      </div>
    )
  }

  if (!o) {
    // Overview: principal list with contributions — entry to "Ikuti prinsipal" (§7.8).
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <b style={{ fontSize: 13.5 }}>Prinsipal — kontribusi bulan ini</b>
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>
          Klik prinsipal untuk mengikutinya: dunia meredup dan panel menampilkan waterfall biaya. Benda di peta bisa diklik untuk detailnya.
        </div>
        {(Object.keys(alloc.principal) as PrincipalId[]).map((p) => {
          const r = alloc.principal[p]
          const isF = follow === p
          return (
            <div key={p} style={{ border: `1px solid ${isF ? PRINCIPAL_COLOR[p] : 'var(--line)'}`, borderRadius: 'var(--r-md)', padding: '8px 10px', background: isF ? PRINCIPAL_COLOR_SOFT[p] : 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden style={{ width: 12, height: 12, borderRadius: 4, background: PRINCIPAL_COLOR[p] }} />
                <b style={{ fontSize: 13 }}>Prinsipal {p}</b>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--f-mono)', fontSize: 13, fontWeight: 700, color: r.contribution >= 0 ? 'var(--s-done)' : 'var(--danger)' }}>
                  {formatRpShort(r.contribution)}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                {r.palletDays > 0 && <>palet-hari {formatNumber(r.palletDays)} · </>}
                {formatM3(r.m3Delivered)} · hari kas {formatDays(r.cashDays)}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button type="button" className="btn ghost" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => onFollow(isF ? null : p)}>
                  {isF ? 'Berhenti ikuti' : 'Ikuti prinsipal'}
                </button>
                <button type="button" className="btn ghost" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => setExpandTrace(!expandTrace)}>
                  Jejak angka
                </button>
              </div>
              {expandTrace && (
                <div style={{ marginTop: 8 }}>
                  <TraceView root={contributionTrace(data, p)} onClose={() => setExpandTrace(false)} />
                </div>
              )}
            </div>
          )
        })}
        <div style={{ fontSize: 11.5, color: 'var(--muted)', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          Tidak dialokasi: komersial {formatRpShort(alloc.unallocated.komersial)}
          {alloc.unallocated.taxGa > 0 && <> · pajak (G&A) {formatRpShort(alloc.unallocated.taxGa)}</>}
          {alloc.unallocated.truckCapacity > 0 && <> · kapasitas truk tak terpakai {formatRpShort(alloc.unallocated.truckCapacity)}</>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          Toggle aturan alokasi ada di tombol "Aturan alokasi". Hari {day} dari {world.days}. Palet: {palletRuleLabel} (tinggi muatan, tanpa palet kayu).
        </div>
      </div>
    )
  }

  // Truck pool selection → show today's trip on that class, if any.
  if (o.kind === 'truckPool') {
    const trip = world.trips.find((t) => t.day === day && t.truckClass === o.truckClass)
    const at = trip ? alloc.trips.find((x) => x.trip.id === trip.id) : undefined
    return (
      <PanelFrame o={o} onBack={() => onSelect(null)}>
        {trip && at ? (
          <>
            <KV k="Trip" v={`${trip.id} (${trip.truckCode})`} />
            <KV k="Zona" v={`${trip.zone} · ${ZONES.find((z) => z.id === trip.zone)?.oneWayKm} km sekali jalan`} />
            <KV k="Muatan" v={`${formatM3(trip.m3)} dari kapasitas ${formatM3(at.capacityM3)} (${formatPct(at.loadFactor)})`} />
            <KV k="Biaya trip" v={formatRp(at.cost)} />
            <SubTitle>Tiga kelompok biaya</SubTitle>
            <KV k="Berbasis waktu" v={formatRp(at.parts.timeBased)} />
            <KV k="Berbasis jarak" v={formatRp(at.parts.distanceBased)} />
            <KV k="Per trip" v={formatRp(at.parts.perTrip)} />
            <button type="button" className="btn ghost" style={{ marginTop: 6, alignSelf: 'flex-start' }} onClick={() => onTrace(at.totalTrace)}>
              Jejak angka: biaya trip
            </button>
            <SubTitle>m³ per prinsipal</SubTitle>
            <SplitBars data={data} day={day} id={trip.id} kind="trip" />
            <SubTitle>Daftar DO (muatan campur prinsipal)</SubTitle>
            <DoList data={data} doIds={trip.dos} onTrace={onTrace} />
          </>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Tidak ada trip kelas {o.truckClass} pada hari ini.</div>
        )}
      </PanelFrame>
    )
  }

  // Invoice-related desks show cash segments.
  if (o.kind === 'arDesk' || o.kind === 'taxDesk' || o.kind === 'bank') {
    const sent = world.invoicesSent.filter((s) => s.sentDay <= day)
    const sample = sent[sent.length - 1]
    return (
      <PanelFrame o={o} onBack={() => onSelect(null)}>
        <KV k="Invoice terkirim s.d. hari ini" v={formatNumber(sent.length)} />
        {sample && (
          <>
            <SubTitle>Tiga segmen jam kas (contoh {sample.id})</SubTitle>
            <KV k="Kirim → invoice" v={`${sample.seg1} hari`} />
            <KV k="Invoice → tukar faktur" v={`${sample.seg2} hari`} />
            <KV k="Tukar faktur → TOP → bayar" v={`${sample.seg3} hari`} />
            <KV k="Biaya modal invoice" v={formatRp(alloc.capital.find((c) => c.invoice.id === sample.id)?.capital ?? 0)} />
            <button type="button" className="btn ghost" style={{ marginTop: 6, alignSelf: 'flex-start' }} onClick={() => onTrace(alloc.capital.find((c) => c.invoice.id === sample.id)?.trace ?? null)}>
              Jejak angka: biaya modal
            </button>
          </>
        )}
      </PanelFrame>
    )
  }

  // Default object panel.
  const driverRows = driverInfo(o, data, day)
  return (
    <PanelFrame o={o} onBack={() => onSelect(null)}>
      {driverRows.map((r) => (
        <KV key={r.k} k={r.k} v={r.v} trace={r.trace} onTrace={onTrace} />
      ))}
      <SubTitle>Bagian per prinsipal</SubTitle>
      <SplitBars data={data} day={day} id={o.id} kind="desk" />
    </PanelFrame>
  )
}

function contributionTrace(data: Computed, p: PrincipalId): Trace {
  const r = data.alloc.principal[p]
  const total = Object.values(r.poolCost).reduce((s, x) => s + (x ?? 0), 0) + r.tripCost + r.capitalCash + r.capitalStock
  return {
    id: `contrib-${p}`,
    label: `Kontribusi Prinsipal ${p}`,
    unit: 'rp',
    value: r.contribution,
    formula: '{0} − {1}',
    inputs: [
      { label: 'laba kotor', value: r.grossProfit, unit: 'rp' },
      { label: 'biaya dialokasi', value: total, unit: 'rp' },
    ],
    compute: (gp, cost) => gp - cost,
  }
}

function driverInfo(o: WorldObject, data: Computed, day: number): { k: string; v: string; trace?: Trace }[] {
  const { world, alloc } = data
  const dayAgg = data.events.daily[day - 1]
  const monthAgg = data.events.daily[data.events.daily.length - 1]
  switch (o.kind) {
    case 'principal': {
      const p = o.principal as PrincipalId
      const r = alloc.principal[p]
      return [
        { k: 'Palet-hari (bulan)', v: formatNumber(r.palletDays), trace: poolTrace(alloc, 'gudang') },
        { k: 'm³ terkirim (bulan)', v: formatM3(r.m3Delivered) },
        { k: 'PO (bulan)', v: formatNumber(r.pos), trace: poolTrace(alloc, 'salesAdminShared') },
        { k: 'Invoice dibuat / dikirim', v: `${formatNumber(r.invoicesGen)} / ${formatNumber(r.invoicesSent)}` },
        { k: 'Biaya pool bulan ini', v: formatRp(Object.values(r.poolCost).reduce((s, x) => s + (x ?? 0), 0) + r.tripCost + r.capitalCash + r.capitalStock) },
        { k: 'Biaya per m³', v: formatRp(r.costPerM3) },
        { k: 'Hari kas tertahan', v: formatDays(r.cashDays) },
      ]
    }
    case 'komersial':
      return [
        { k: 'Pool bulan ini', v: formatRp(alloc.pools.find((x) => x.def.id === 'komersial')?.total ?? 0), trace: alloc.pools.find((x) => x.def.id === 'komersial')?.totalTrace },
        { k: 'Status', v: 'Tidak dialokasi — biaya bersama semua prinsipal' },
        { k: 'Hari ini', v: `forecast + cek stok, ${world.dos.filter((d) => d.day === day).length} DO terjadwal` },
      ]
    case 'adminDesk':
      return [
        { k: 'Pool bulan ini', v: formatRp(alloc.pools.find((x) => x.def.id === (o.variant === 'dedicated' ? 'salesAdminDedicated' : 'salesAdminShared'))?.total ?? 0), trace: alloc.pools.find((x) => x.def.id === (o.variant === 'dedicated' ? 'salesAdminDedicated' : 'salesAdminShared'))?.totalTrace },
        { k: 'Driver', v: o.variant === 'dedicated' ? 'langsung ke Prinsipal D' : `jumlah PO (${formatNumber(monthAgg ? world.pos.length : 0)} PO)` },
        { k: 'Tarif per PO', v: formatRp(alloc.pools.find((x) => x.def.id === 'salesAdminShared')?.rate ?? 0), trace: alloc.pools.find((x) => x.def.id === 'salesAdminShared')?.rateTrace },
      ]
    case 'dock':
      return [
        { k: 'Palet masuk hari ini', v: formatNumber(dayAgg?.palletsIn ?? 0) },
        { k: 'Palet masuk (bulan)', v: formatNumber(alloc.metrics.length ? Object.values(alloc.pallets.inByPrincipal).reduce((s, x) => s + x, 0) : 0), trace: poolTrace(alloc, 'inbound') },
        { k: 'Tarif per palet', v: formatRp(alloc.pools.find((x) => x.def.id === 'inbound')?.rate ?? 0), trace: alloc.pools.find((x) => x.def.id === 'inbound')?.rateTrace },
      ]
    case 'wms':
      return [
        { k: 'PO diterima (bulan)', v: formatNumber(world.pos.filter((p) => p.arrivalDay >= 1 && p.arrivalDay <= world.days).length), trace: poolTrace(alloc, 'wms') },
        { k: 'Tarif per PO diterima', v: formatRp(alloc.pools.find((x) => x.def.id === 'wms')?.rate ?? 0), trace: alloc.pools.find((x) => x.def.id === 'wms')?.rateTrace },
      ]
    case 'rack':
      return [
        { k: 'Posisi palet hari ini', v: formatNumber(dayAgg?.palletPositions ?? 0) },
        { k: 'Palet-hari (bulan)', v: formatNumber(monthAgg?.palletDays ?? 0), trace: poolTrace(alloc, 'gudang') },
        { k: 'Tarif per palet-hari', v: formatRp(alloc.pools.find((x) => x.def.id === 'gudang')?.rate ?? 0), trace: alloc.pools.find((x) => x.def.id === 'gudang')?.rateTrace },
      ]
    case 'staging':
      return [
        { k: 'Palet keluar hari ini', v: formatNumber(dayAgg?.palletsOut ?? 0) },
        { k: 'Karton keluar (bulan)', v: formatNumber(monthAgg?.cartonsOut ?? 0) },
        { k: 'Tarif per driver unit', v: formatRp(alloc.pools.find((x) => x.def.id === 'packing')?.rate ?? 0), trace: alloc.pools.find((x) => x.def.id === 'packing')?.rateTrace },
      ]
    case 'finance':
      return [
        { k: 'Invoice dibuat hari ini', v: formatNumber(dayAgg?.invoicesGen ?? 0) },
        { k: 'Invoice dibuat (bulan)', v: formatNumber(monthAgg ? world.invoicesGen.length : 0), trace: poolTrace(alloc, 'arFinance') },
        { k: 'Tarif per invoice', v: formatRp(alloc.pools.find((x) => x.def.id === 'arFinance')?.rate ?? 0), trace: alloc.pools.find((x) => x.def.id === 'arFinance')?.rateTrace },
      ]
    case 'store': {
      const storeId = o.id
      const dos = world.dos.filter((d) => d.store === storeId && d.day === day)
      return [
        { k: 'DO hari ini', v: formatNumber(dos.length) },
        { k: 'Nilai DO hari ini', v: formatRp(dos.reduce((s, d) => s + d.value, 0)) },
        { k: 'Grup', v: world.stores.find((s) => s.id === storeId)?.mtBesar ? 'MT besar — tukar faktur lambat' : 'Toko reguler' },
      ]
    }
    case 'bank':
      return [
        { k: 'Kas masuk hari ini', v: formatRp(dayAgg?.paid ?? 0) },
        { k: 'Biaya modal (bulan)', v: formatRp(alloc.capital.reduce((s, c) => s + c.capital, 0)) },
      ]
    default:
      return []
  }
}

function poolTrace(alloc: Computed['alloc'], poolId: string): Trace | undefined {
  return alloc.pools.find((x) => x.def.id === poolId)?.totalTrace
}

function PanelFrame({ o, children, onBack }: { o: WorldObject; children: React.ReactNode; onBack: () => void }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button type="button" className="btn ghost" style={{ alignSelf: 'flex-start', padding: '2px 10px' }} onClick={onBack}>
        ← Semua objek
      </button>
      <b style={{ fontSize: 14 }}>{o.label}</b>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        Langkah: <b style={{ color: 'var(--ink)' }}>{o.step}</b> · Tim: <b style={{ color: 'var(--ink)' }}>{o.team}</b>
      </div>
      <div style={{ fontSize: 12.5, background: 'var(--accent-soft)', borderRadius: 8, padding: '6px 10px' }}>{o.what}</div>
      {children}
    </div>
  )
}

function KV({ k, v, trace: tr, onTrace }: { k: string; v: string; trace?: Trace | null; onTrace?: (t: Trace) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, borderBottom: '1px dashed var(--line)', paddingBottom: 4 }}>
      <span style={{ color: 'var(--muted)' }}>{k}</span>
      <b style={{ fontFamily: 'var(--f-mono)', textAlign: 'right' }}>
        {tr && onTrace ? (
          <button type="button" className="linkbtn" onClick={() => onTrace(tr)} title="Lihat jejak angka">
            {v} ↗
          </button>
        ) : (
          v
        )}
      </b>
    </div>
  )
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 6 }}>{children}</div>
}

function DoList({ data, doIds, onTrace }: { data: Computed; doIds: string[]; onTrace: (t: Trace) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const { world, alloc } = data
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {doIds.map((doId) => {
        const d = world.dos.find((x) => x.id === doId)
        if (!d) return null
        const at = alloc.trips.find((t) => doId in t.doCost)
        return (
          <div key={doId} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px' }}>
            <button type="button" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setOpen(open === doId ? null : doId)} aria-expanded={open === doId}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                {doId} · Toko {d.store.slice(1)}
              </span>
              <span style={{ fontSize: 12, fontFamily: 'var(--f-mono)' }}>
                {formatM3(d.m3)} · {formatRpShort(at?.doCost[doId] ?? 0)}
              </span>
            </button>
            {open === doId && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {d.lines.map((l) => {
                  const sku = world.skus[l.sku]
                  const lc = at?.lineCost[`${doId}|${l.sku}`] ?? 0
                  const perCarton = l.cartons > 0 ? lc / l.cartons : 0
                  const lineTrace = at ? buildLineTrace(data, doId, l.sku) : null
                  return (
                    <div key={l.sku} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>
                        <span aria-hidden style={{ color: sku ? PRINCIPAL_COLOR[sku.principal] : 'inherit' }}>●</span> {l.sku} × {l.cartons}
                      </span>
                      <span style={{ fontFamily: 'var(--f-mono)' }}>
                        {formatRpShort(lc)} · {formatRp(perCarton)}/karton
                        {lineTrace && (
                          <button type="button" className="linkbtn" onClick={() => onTrace(lineTrace)} style={{ marginLeft: 6 }}>
                            ↗
                          </button>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function buildLineTrace(data: Computed, doId: string, skuCode: string): Trace | null {
  const { world, alloc } = data
  const trip = alloc.trips.find((t) => doId in t.doCost)
  const d = world.dos.find((x) => x.id === doId)
  const line = d?.lines.find((l) => l.sku === skuCode)
  if (!trip || !d || !line) return null
  const doCost = trip.doCost[doId] ?? 0
  const doMeasure = trip.measureByDo[doId] ?? 0
  const lm = trip.measureTotal > 0 && doMeasure > 0 ? (doCost * line.m3) / doMeasure : 0
  void lm
  return {
    id: `line-${doId}-${skuCode}`,
    label: `Biaya baris ${skuCode} di ${doId}`,
    unit: 'rp',
    value: trip.lineCost[`${doId}|${skuCode}`] ?? 0,
    formula: '{0} × {1} / {2}',
    inputs: [
      { label: `biaya DO ${doId}`, value: doCost, unit: 'rp', ref: trip.doCostTrace[doId] },
      { label: 'm³ baris (ukuran aktif)', value: line.m3, unit: 'm3' },
      { label: 'm³ DO (ukuran aktif)', value: doMeasure, unit: 'm3' },
    ],
    compute: (c, lmv, dmv) => (dmv > 0 ? (c * lmv) / dmv : 0),
  }
}
