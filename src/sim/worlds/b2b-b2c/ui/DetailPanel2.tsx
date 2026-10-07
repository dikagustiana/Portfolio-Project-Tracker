// World 2 right panel (brief 2 §7.5): order waterfall, package/manifest, pick face,
// ISD "Harga kecepatan", platform, shared warehouse pool — plus the overview with both
// follow modes (principal and platform).

import { useState } from 'react'
import type { Computed2 } from '../engine/index.ts'
import type { PlatformId, Toggles2 } from '../engine/config.ts'
import { PLATFORMS } from '../engine/config.ts'
import type { PrincipalId } from '../../../core/colors.ts'
import { PRINCIPAL_COLOR } from '../../../core/colors.ts'
import { Waterfall } from '../../../core/Waterfall.tsx'
import { TraceView } from '../../../core/TraceView.tsx'
import { object2ById } from './objects2.ts'
import { PRIORITY_COLOR } from './colors2.ts'
import { formatDays, formatNumber, formatPct, formatRp, formatRpShort } from '../../../core/format.ts'
import { trace } from '../../../core/trace.ts'
import type { Trace } from '../../../core/trace.ts'

interface DetailPanel2Props {
  data: Computed2
  day: number
  toggles: Toggles2
  selected: string | null
  follow: PrincipalId | null
  followPlatform: string | null
  onSelect: (id: string | null) => void
  onFollow: (p: PrincipalId | null) => void
  onFollowPlatform: (p: string | null) => void
  trace: Trace | null
  onTrace: (t: Trace | null) => void
  onCloseTrace: () => void
}

export function DetailPanel2({ data, day, toggles, selected, follow, followPlatform, onSelect, onFollow, onFollowPlatform, trace, onTrace, onCloseTrace }: DetailPanel2Props) {
  const { world, alloc } = data
  const [openOrder, setOpenOrder] = useState<string | null>(null)
  if (trace) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 14 }}>
        <TraceView root={trace} onClose={onCloseTrace} />
      </div>
    )
  }
  const o = selected ? object2ById(selected) : undefined
  if (!o) return <Overview2 data={data} follow={follow} followPlatform={followPlatform} onFollow={onFollow} onFollowPlatform={onFollowPlatform} />

  const frame = (children: React.ReactNode) => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button type="button" className="btn ghost" style={{ alignSelf: 'flex-start', padding: '2px 10px' }} onClick={() => onSelect(null)}>
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

  const kv = (k: string, v: string, tr?: Trace) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, borderBottom: '1px dashed var(--line)', paddingBottom: 4 }}>
      <span style={{ color: 'var(--muted)' }}>{k}</span>
      <b style={{ fontFamily: 'var(--f-mono)', textAlign: 'right' }}>
        {tr ? (
          <button type="button" className="linkbtn" onClick={() => onTrace(tr)}>
            {v} ↗
          </button>
        ) : (
          v
        )}
      </b>
    </div>
  )

  switch (o.kind) {
    case 'oms': {
      const dayOrders = world.orders.filter((x) => x.day === day).slice(0, 12)
      const open = openOrder
      const setOpen = setOpenOrder
      return frame(
        <>
          {kv('Order hari ini', formatNumber(world.orders.filter((x) => x.day === day).length))}
          {kv('Prioritas', `P0 ${world.orders.filter((x) => x.day === day && x.priority === 'P0').length} · P1 ${world.orders.filter((x) => x.day === day && x.priority === 'P1').length} · P2 ${world.orders.filter((x) => x.day === day && x.priority === 'P2').length}`)}
          <SubTitle>Contoh order (klik untuk waterfall)</SubTitle>
          {dayOrders.map((ord) => (
            <div key={ord.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px' }}>
              <button type="button" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setOpen(open === ord.id ? null : ord.id)} aria-expanded={open === ord.id}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>
                  <span aria-hidden style={{ color: PRIORITY_COLOR[ord.priority], marginRight: 6 }}>●</span>
                  {ord.id} · {ord.platform} · {String(ord.hour).padStart(2, '0')}.00
                </span>
                <span style={{ fontSize: 11.5, fontFamily: 'var(--f-mono)' }}>{formatRpShort(ord.gmv)}</span>
              </button>
              {open === ord.id && <OrderWaterfall data={data} orderId={ord.id} />}
            </div>
          ))}
        </>,
      )
    }
    case 'isdZone': {
      const p0 = alloc.priority.find((x) => x.priority === 'P0')
      const p1 = alloc.priority.find((x) => x.priority === 'P1')
      const p2 = alloc.priority.find((x) => x.priority === 'P2')
      return frame(
        <>
          {kv('Biaya per order P0 (instan)', formatRp(p0?.avgCost ?? 0))}
          {kv('Biaya per order P1 (same day)', formatRp(p1?.avgCost ?? 0))}
          {kv('Biaya per order P2 (next day)', formatRp(p2?.avgCost ?? 0))}
          {kv('Harga kecepatan (P0/P1 vs P2)', formatRp(((p0?.avgCost ?? 0) + (p1?.avgCost ?? 0)) / 2 - (p2?.avgCost ?? 0)) + ' / order')}
          {kv('Pool ISD', formatRp(alloc.isd.total), alloc.pools.find((x) => x.id === 'isd')?.totalTrace)}
          {kv('Order P0+P1', formatNumber(alloc.isd.p0p1Orders))}
        </>,
      )
    }
    case 'pickFace': {
      const rows = world.pickFace.filter((f) => f.day === day)
      const replen = rows.reduce((s, f) => s + f.replenishedPieces, 0)
      const picksB2c = world.orders.filter((x) => x.shipDay === day).reduce((s, x) => s + x.items.reduce((t, i) => t + i.pieces, 0), 0)
      return frame(
        <>
          {kv('Unit di pick face (akhir hari)', formatNumber(rows.reduce((s, f) => s + f.stockPieces, 0)))}
          {kv('Replenishment hari ini', `${formatNumber(replen)} unit`, alloc.pools.find((x) => x.id === 'replenishment')?.totalTrace)}
          {kv('Unit picked B2C hari ini', formatNumber(picksB2c))}
          {kv('Pool replenishment', formatRp(alloc.replenishment.total))}
          {kv('Stok pick face', 'tidak pernah minus (kontrol 2)')}
        </>,
      )
    }
    case 'bulkRack':
    case 'dock': {
      const shared = alloc.pools.filter((x) => x.byPrincipal)
      return frame(
        <>
          <SubTitle>Pool gudang bersama (S1–S5) → prinsipal → channel</SubTitle>
          {shared.map((pool) => (
            <div key={pool.id} style={{ fontSize: 12, borderBottom: '1px dashed var(--line)', paddingBottom: 4 }}>
              <button type="button" className="linkbtn" onClick={() => onTrace(pool.totalTrace)}>
                {pool.team}: {formatRpShort(pool.total)} ↗
              </button>
              <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>
                B2B {formatRpShort(pool.b2b)} · B2C {formatRpShort(pool.b2c)} · driver: {pool.driver}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Toggle aktif: {toggles.sharedSplit === 'volume' ? 'Porsi volume keluar' : 'Tidak dibagi — tampil sebagai "Biaya gudang bersama"'}.
          </div>
          {toggles.sharedSplit === 'none' && kv('Biaya gudang bersama (tidak dibagi)', formatRp(alloc.sharedUnsplit))}
          {o.kind === 'dock' && kv('Cut-off inbound', 'Truk setelah 15.00 diturunkan besok')}
        </>,
      )
    }
    case 'platform': {
      const pf = mustPlatform(o.platform)
      const v = alloc.platform[pf]
      const p = alloc.principalChannel
      void p
      return frame(
        <>
          {kv('Fee', `${formatPct(PLATFORMS.find((x) => x.id === pf)?.feePct ?? 0)} · ${formatRpShort(v.fee)}`)}
          {kv('Settlement', `${formatDays(v.settlementDays)} setelah order selesai`)}
          {kv('Biaya modal dana tertahan', formatRp(v.capital), capTrace(toggles.costOfCapital, v.netSettlement, v.settlementDays))}
          {kv('GMV', formatRpShort(v.gmv))}
          {kv('Kontribusi', formatRpShort(v.contribution))}
          <div style={{ marginTop: 6 }}>
            <button type="button" className="btn ghost" style={{ padding: '2px 10px' }} onClick={() => onFollowPlatform(followPlatform === pf ? null : pf)}>
              {followPlatform === pf ? 'Berhenti ikuti platform' : 'Ikuti platform'}
            </button>
          </div>
        </>,
      )
    }
    case 'dispatch':
    case 'courierLane':
    case 'courierBay': {
      const dayManifests = world.manifests.filter((m) => m.day === day)
      const shipped = world.orders.filter((x) => x.shipDay === day)
      const sample = shipped[0]
      return frame(
        <>
          {kv('Paket hari ini', formatNumber(shipped.length))}
          {kv('Manifest hari ini', formatNumber(dayManifests.length))}
          {kv('Semua manifest ditandatangani', dayManifests.every((m) => m.signedDay <= m.closedDay) ? 'Ya (kontrol 5)' : '—')}
          {sample && (
            <>
              <SubTitle>Contoh paket ({sample.id})</SubTitle>
              {kv('Kotak', sample.box)}
              {kv('Berapa chargeable', `${formatNumber(sample.chargeableKg)} kg (aktual ${formatNumber(sample.actualKg)} kg)`)}
              {kv('Kurir', sample.courier === 'K1' ? 'Kurir 1' : sample.courier === 'K2' ? 'Kurir 2' : 'Kurir 3')}
              {kv('Biaya kemasan', formatRp(sample.boxCost))}
            </>
          )}
        </>,
      )
    }
    case 'b2bLane': {
      const trips = world.b2b.trips.filter((x) => x.day === day)
      return frame(
        <>
          {kv('Trip B2B hari ini', formatNumber(trips.length))}
          {kv('DO B2B bulan ini', formatNumber(world.b2b.dos.length))}
          {kv('Kontribusi B2B per prinsipal', '')}
          {(['A', 'B', 'C', 'D', 'E', 'F'] as const).map((pr) => (
            <div key={pr} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>
                <span aria-hidden style={{ color: PRINCIPAL_COLOR[pr], marginRight: 6 }}>●</span>
                {pr}
              </span>
              <b style={{ fontFamily: 'var(--f-mono)' }}>{formatRpShort(alloc.principalChannel[pr].b2b)}</b>
            </div>
          ))}
        </>,
      )
    }
    case 'returnsDesk':
    case 'csDesk':
    case 'shopDesk': {
      const poolId = o.kind === 'returnsDesk' ? 'returnsDesk' : o.kind === 'csDesk' ? 'cs' : 'shopMgmt'
      const pool = alloc.pools.find((x) => x.id === poolId)
      const returned = world.orders.filter((x) => x.returned).length
      return frame(
        <>
          {kv('Pool bulan ini', formatRp(pool?.total ?? 0), pool?.totalTrace)}
          {o.kind === 'returnsDesk' && kv('Retur diterima', formatNumber(returned))}
          {o.kind === 'returnsDesk' && kv('Restock vs karantina', '60% restock, sisanya karantina (asumsi)')}
          {o.kind === 'csDesk' && kv('Driver', 'tiket per order + tiket retur')}
          {o.kind === 'shopDesk' && kv('Driver', 'order per platform')}
        </>,
      )
    }
    case 'settleLedger':
    case 'bank': {
      return frame(
        <>
          {PLATFORMS.map((pf) => {
            const v = alloc.platform[pf.id]
            return (
              <div key={pf.id} style={{ fontSize: 12, borderBottom: '1px dashed var(--line)', paddingBottom: 4 }}>
                <b>{pf.label}</b>
                <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>
                  settlement {pf.settlementDays} hari · dana cair {formatRpShort(v.netSettlement)} · modal {formatRpShort(v.capital)} · kontribusi {formatRpShort(v.contribution)}
                </div>
              </div>
            )
          })}
        </>,
      )
    }
    case 'regularPick':
    case 'packing':
    case 'boxShelf': {
      return frame(
        <>
          {kv('Tim outbound reguler', toggles.sharedTeams ? 'Dipakai bersama B2B + B2C' : 'Tim terpisah per channel (+overhead)')}
          {kv('Menit standar', `B2B 1,2 menit/garis · B2C 2,5 menit/garis (asumsi)`)}
          {kv('Menit bulan ini', `B2B ${formatNumber(alloc.outbound.b2bMinutes)} · B2C ${formatNumber(alloc.outbound.b2cMinutes)}`)}
          {kv('Biaya B2B / B2C', `${formatRpShort(alloc.outbound.b2bCost)} / ${formatRpShort(alloc.outbound.b2cCost)}`)}
          {o.kind === 'boxShelf' && kv('Kemasan', 'Polymailer/S/M/L — biaya langsung per paket')}
        </>,
      )
    }
    default:
      return frame(<div />)
  }
}

function capTrace(wacc: number, net: number, days: number): Trace {
  return trace('Biaya modal B2C', 'rp', '{0} × {1} × {2} / 365', [
    { label: 'asumsi biaya modal', value: wacc, unit: 'pct' },
    { label: 'dana cair net', value: net, unit: 'rp' },
    { label: 'hari settlement', value: days, unit: 'day' },
  ], (r, val, d) => (r * val * d) / 365)
}

function mustPlatform(id: string | undefined): PlatformId {
  const pf = PLATFORMS.find((x) => x.id === id)
  if (!pf) throw new Error(`unknown platform ${id}`)
  return pf.id
}

function Overview2({ data, follow, followPlatform, onFollow, onFollowPlatform }: { data: Computed2; follow: PrincipalId | null; followPlatform: string | null; onFollow: (p: PrincipalId | null) => void; onFollowPlatform: (p: string | null) => void }) {
  const { alloc } = data
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <b style={{ fontSize: 13.5 }}>Prinsipal — kontribusi per channel</b>
      {(['A', 'B', 'C', 'D', 'E', 'F'] as const).map((pr) => {
        const r = alloc.principalChannel[pr]
        const isF = follow === pr
        return (
          <div key={pr} style={{ border: `1px solid ${isF ? PRINCIPAL_COLOR[pr] : 'var(--line)'}`, borderRadius: 'var(--r-md)', padding: '8px 10px', background: isF ? 'var(--accent-soft)' : 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden style={{ width: 12, height: 12, borderRadius: 4, background: PRINCIPAL_COLOR[pr] }} />
              <b style={{ fontSize: 13 }}>Prinsipal {pr}</b>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--f-mono)', fontSize: 13, fontWeight: 700 }}>
                B2B {formatRpShort(r.b2b)} · B2C {formatRpShort(r.b2c)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button type="button" className="btn ghost" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => onFollow(isF ? null : pr)}>
                {isF ? 'Berhenti ikuti' : 'Ikuti prinsipal'}
              </button>
            </div>
          </div>
        )
      })}
      <SubTitle>Platform — kontribusi B2C</SubTitle>
      {PLATFORMS.map((pf) => {
        const v = alloc.platform[pf.id]
        const isF = followPlatform === pf.id
        return (
          <div key={pf.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <b style={{ minWidth: 52 }}>{pf.label}</b>
            <span style={{ color: 'var(--muted)' }}>
              {v.orders} order · settlement {pf.settlementDays} h
            </span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--f-mono)', fontWeight: 700 }}>{formatRpShort(v.contribution)}</span>
            <button type="button" className="btn ghost" style={{ padding: '1px 8px', fontSize: 11.5 }} onClick={() => onFollowPlatform(isF ? null : pf.id)}>
              {isF ? '✓ diikuti' : 'ikuti'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function OrderWaterfall({ data, orderId }: { data: Computed2; orderId: string }) {
  const e = data.alloc.perOrder.find((x) => x.id === orderId)
  const o = data.world.orders.find((x) => x.id === orderId)
  if (!e || !o) return null
  return (
    <div style={{ marginTop: 8 }}>
      <Waterfall
        title={`GMV → kontribusi (${o.platform}, ${o.priority})`}
        color={PRINCIPAL_COLOR[e.principal]}
        steps={[
          { label: 'GMV', value: o.gmv, kind: 'start' },
          { label: 'Voucher penjual', value: -o.voucher, kind: 'cost' },
          { label: 'Fee platform', value: -e.fee, kind: 'cost' },
          ...(e.sellerShipping > 0 ? [{ label: 'Ongkir penjual', value: -e.sellerShipping, kind: 'cost' as const }] : []),
          { label: 'Kemasan', value: -e.packaging, kind: 'cost' },
          ...(e.returnCost > 0 ? [{ label: 'Retur', value: -e.returnCost, kind: 'cost' as const }] : []),
          { label: 'Tim (outbound+ISD+CS+shop)', value: -e.teamCost, kind: 'cost' },
          { label: 'Gudang bersama', value: -e.sharedCost, kind: 'cost' },
          { label: 'Modal dana tertahan', value: -e.capital, kind: 'cost' },
          { label: 'Kontribusi', value: e.contribution },
        ]}
      />
    </div>
  )
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 6 }}>{children}</div>
}
