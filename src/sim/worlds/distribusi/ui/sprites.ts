// The sprite layer (brief §7.5): the day's events drawn as small moving things — PO
// envelopes, principal trucks, forklifts, picking boxes, trip trucks with mixed loads,
// DO envelopes back to finance, invoice papers, coins to the bank — plus driver pop-ups
// aggregated per day so the screen stays calm. With reduced motion (or paused) nothing
// moves: the day-end state and the pop-ups remain.

import type { PrincipalId } from '../engine/config.ts'
import { formatM3, formatNumber, formatRpShort } from '../../../core/format.ts'
import { PRINCIPAL_COLOR } from '../../../core/colors.ts'
import type { ThemeColors } from '../../../core/colors.ts'
import { ARRIVAL_PATH, DOCK_TO_RACK, ROADS, RACK_TO_STAGE, storePos } from './objects.ts'
import { project } from '../../../core/iso.ts'
import type { Computed } from '../engine/index.ts'

export interface SpriteInput {
  data: Computed
  day: number
  dayProgress: number
  playing: boolean
  speed: number
  reducedMotion: boolean
  theme: ThemeColors
  follow: PrincipalId | null
  ox: number
  oy: number
  scale: number
  size: { w: number; h: number }
}

interface Vec {
  x: number
  y: number
}

function along(path: Vec[], t: number): { x: number; y: number } {
  const first = path[0]
  const last = path[path.length - 1]
  if (!first || !last) return { x: 0, y: 0 }
  if (t <= 0) return first
  if (t >= 1) return last
  const segs = path.length - 1
  const s = Math.min(segs - 0.0001, t * segs)
  const i = Math.floor(s)
  const f = s - i
  const a = path[i]
  const b = path[i + 1]
  if (!a || !b) return { x: 0, y: 0 }
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
}

function isoTruck(ctx: CanvasRenderingContext2D, x: number, y: number, ox: number, oy: number, scale: number, colors: string[], label: string, theme: ThemeColors, alpha = 1): void {
  const p = project(x, y, ox, oy, 0, scale)
  ctx.save()
  ctx.globalAlpha = alpha
  // Container boxes behind a cab, each tinted by a principal's goods.
  const n = colors.length
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[i] ?? '#9aa4b8'
    const bx = p.sx - 13 + i * 7
    const by = p.sy - 9
    ctx.beginPath()
    ctx.roundRect(bx, by - 5, 7, 9, 2)
    ctx.fill()
  }
  ctx.fillStyle = '#3a4557'
  ctx.beginPath()
  ctx.roundRect(p.sx - 15 + n * 7, p.sy - 8, 6, 8, 2)
  ctx.fill()
  ctx.fillStyle = '#222b3a'
  ctx.beginPath()
  ctx.arc(p.sx - 10, p.sy + 2, 2.4, 0, Math.PI * 2)
  ctx.arc(p.sx + 1, p.sy + 2, 2.4, 0, Math.PI * 2)
  ctx.fill()
  if (label) {
    ctx.fillStyle = theme.muted
    ctx.font = '600 10px var(--f-mono), monospace'
    ctx.textAlign = 'center'
    ctx.fillText(label, p.sx, p.sy - 14)
  }
  ctx.restore()
}

function isoEnvelope(ctx: CanvasRenderingContext2D, x: number, y: number, ox: number, oy: number, scale: number, color: string, lift: number, glyph?: string): void {
  const p = project(x, y, ox, oy, lift, scale)
  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(p.sx - 7, p.sy - 5, 14, 10, 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(p.sx - 7, p.sy - 5)
  ctx.lineTo(p.sx, p.sy + 1)
  ctx.lineTo(p.sx + 7, p.sy - 5)
  ctx.stroke()
  if (glyph) {
    ctx.fillStyle = '#fff'
    ctx.font = '700 8px var(--f-mono), monospace'
    ctx.textAlign = 'center'
    ctx.fillText(glyph, p.sx, p.sy - 8)
  }
  ctx.restore()
}

function popUp(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, ox: number, oy: number, scale: number, theme: ThemeColors, lift = 1.2): void {
  const p = project(x, y, ox, oy, lift, scale)
  ctx.save()
  ctx.font = '700 11.5px var(--f-ui), sans-serif'
  const w = ctx.measureText(text).width + 14
  ctx.fillStyle = theme.surface
  ctx.strokeStyle = theme.line
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(p.sx - w / 2, p.sy - 30, w, 18, 9)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = theme.ink
  ctx.textAlign = 'center'
  ctx.fillText(text, p.sx, p.sy - 17)
  ctx.restore()
}

function coin(ctx: CanvasRenderingContext2D, x: number, y: number, ox: number, oy: number, scale: number): void {
  const p = project(x, y, ox, oy, 0.4, scale)
  ctx.save()
  ctx.fillStyle = '#e8b23a'
  ctx.strokeStyle = '#c08d20'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(p.sx, p.sy, 4.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

export function drawSprites(ctx: CanvasRenderingContext2D, input: SpriteInput): void {
  const { data, day, dayProgress, playing, reducedMotion, theme, ox, oy, scale } = input
  const { world, alloc } = data
  const t = reducedMotion || !playing ? 1 : Math.max(0, Math.min(1, dayProgress))
  const follow = input.follow
  const vis = (p?: PrincipalId): number => (follow && p && p !== follow ? 0.15 : 1)
  const pj = (x: number, y: number, z = 0): { sx: number; sy: number } => project(x, y, ox, oy, z, scale)
  const STORE_POS = Array.from({ length: 24 }, (_, i) => storePos(i + 1))

  // 1. PO envelopes: commercial → principal (the day's POs).
  for (const po of world.pos.filter((p) => p.day === day)) {
    const from = { x: 1.6, y: 3.4 }
    const to = { x: 0.4 + ['A', 'B', 'C', 'D', 'E', 'F'].indexOf(po.principal) * 2.1 + 0.85, y: 1.05 }
    isoEnvelope(ctx, along([from, to], t).x, along([from, to], t).y, ox, oy, scale, PRINCIPAL_COLOR[po.principal], 0.9 + t * 0.4, 'PO')
    if (t > 0.9) popUp(ctx, to.x, to.y - 0.4, '+1 PO', ox, oy, scale, theme)
  }

  // 2. Principal trucks arriving at the dock with goods.
  const arrivals = world.pos.filter((p) => p.arrivalDay === day)
  for (const po of arrivals) {
    const stagger = ['A', 'B', 'C', 'D', 'E', 'F'].indexOf(po.principal) * 0.12
    const tt = Math.max(0, Math.min(1, t * 1.6 - stagger))
    const pos = along(ARRIVAL_PATH, tt)
    isoTruck(ctx, pos.x, pos.y, ox, oy, scale, [PRINCIPAL_COLOR[po.principal]], '', theme, vis(po.principal))
    const dayIn = alloc.pallets.palletsInByDay[day]
    const pallets = dayIn ? dayIn[po.principal] : 0
    if (pallets > 0 && tt > 0.55) {
      // Forklifts: dock → rack with the principal's pallets.
      const ft = Math.max(0, Math.min(1, (tt - 0.55) / 0.45))
      const fp = along(DOCK_TO_RACK, ft)
      ctx.save()
      ctx.globalAlpha = vis(po.principal)
      ctx.fillStyle = PRINCIPAL_COLOR[po.principal]
      const p2 = pj(fp.x, fp.y)
      ctx.beginPath()
      ctx.roundRect(p2.sx - 4, p2.sy - 8, 8, 7, 2)
      ctx.fill()
      ctx.restore()
      if (ft >= 1) popUp(ctx, 4.5, 5, `+${formatNumber(pallets)} palet masuk`, ox, oy, scale, theme)
    }
  }

  // 3. Outbound picking: boxes rack → staging.
  const dayAgg = data.events.daily[day - 1]
  if (dayAgg && dayAgg.palletsOut > 0) {
    const boxes = Math.min(6, Math.max(2, Math.round(dayAgg.palletsOut / 40)))
    for (let i = 0; i < boxes; i++) {
      const bt = Math.max(0, Math.min(1, t * 1.3 - i * 0.09))
      const p = along(RACK_TO_STAGE, bt)
      ctx.save()
      ctx.globalAlpha = 0.9
      ctx.fillStyle = theme.warn
      const s = pj(p.x, p.y)
      ctx.beginPath()
      ctx.roundRect(s.sx - 3, s.sy - 6, 6, 6, 1.5)
      ctx.fill()
      ctx.restore()
    }
    if (t > 0.8) popUp(ctx, 8.3, 6, `${formatNumber(dayAgg.palletsOut)} palet keluar`, ox, oy, scale, theme)
  }

  // 4. Trip trucks: staged → zone road, mixed colours; store lights on delivery.
  for (const trip of world.trips.filter((tr) => tr.day === day)) {
    const stagger = ({ 1: 0.1, 2: 0.28, 3: 0.46 } as const)[trip.zone]
    const tt = Math.max(0, Math.min(1, (t - stagger) / 0.5))
    const road = ROADS[trip.zone]
    const pos = along(road, tt)
    // Mixed load: sample the DOs' principals.
    const principals = new Set<PrincipalId>()
    for (const doId of trip.dos) {
      const d = world.dos.find((x) => x.id === doId)
      if (d) for (const l of d.lines) principals.add(world.skus[l.sku]?.principal ?? 'A')
    }
    const colors = [...principals].slice(0, 4).map((p) => PRINCIPAL_COLOR[p])
    const alpha = [...principals].every((p) => vis(p) === 1) || !follow ? 1 : 0.25
    if (tt > 0 && tt < 1) isoTruck(ctx, pos.x, pos.y, ox, oy, scale, colors, trip.truckCode, theme, alpha)
    if (tt >= 1) {
      const end = road[road.length - 1]
      if (end) {
      // Store lights: signed DOs glow briefly.
      for (const doId of trip.dos) {
        const d = world.dos.find((x) => x.id === doId)
        if (!d) continue
        const n = Number(d.store.slice(1))
        const storePos = STORE_POS[n - 1]
        if (!storePos) continue
        const glow = playing && !reducedMotion ? 1 - Math.min(1, (t - stagger - 0.5) / 0.5) : 0
        const signed = world.dos.some((x) => x.day === day && x.store === d.store)
        if (glow > 0 || (signed && !playing)) {
          const gp = pj(storePos.x, storePos.y)
          const firstSku = d.lines[0]?.sku
          const alpha = follow ? (firstSku && world.skus[firstSku]?.principal === follow ? glow : 0.1) : glow
          ctx.save()
          ctx.globalAlpha = Math.max(0.35, alpha)
          if (glow > 0) {
            ctx.strokeStyle = theme.done
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.arc(gp.sx, gp.sy - 8, 10 * Math.max(0.7, scale), 0, Math.PI * 2)
            ctx.stroke()
          } else {
            ctx.fillStyle = theme.done
            ctx.beginPath()
            ctx.arc(gp.sx, gp.sy - 8, 3.2 * Math.max(0.7, scale), 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.restore()
        }
      }
      // DO envelope flying back to finance along a straight lift.
      const bt = Math.max(0, Math.min(1, (t - stagger - 0.4) / 0.5))
      if (bt > 0 && bt < 1) {
        const finPos = along(
          [
            { x: end.x, y: end.y },
            { x: 14, y: 1.6 },
          ],
          bt,
        )
        isoEnvelope(ctx, finPos.x, finPos.y, ox, oy, scale, theme.accent, 1 + bt * 1.2, 'DO')
      }
      if (bt >= 1) popUp(ctx, 9, 6.6, `Zona ${trip.zone}: ${formatM3(trip.m3)}`, ox, oy, scale, theme)
      }
    }
  }

  // 5. Invoice papers: finance → AR/tax desks on send days.
  for (const inv of world.invoicesSent.filter((i) => i.sentDay === day)) {
    const bt = Math.max(0, Math.min(1, (t - 0.35) / 0.4))
    const p = along(
      [
        { x: 14.4, y: 1.3 },
        { x: 13.6, y: 3.1 },
      ],
      bt,
    )
    isoEnvelope(ctx, p.x, p.y, ox, oy, scale, theme.done, 0.8, 'FP')
    if (bt >= 1) popUp(ctx, 13.6, 3.4, `+invoice ${inv.principal}`, ox, oy, scale, theme)
  }

  // 6. Coins to the bank when invoices are paid.
  for (const inv of world.invoicesSent.filter((i) => i.payDay === day)) {
    const bt = Math.max(0, Math.min(1, (t - 0.5) / 0.45))
    const p = along(
      [
        { x: 13.4, y: 3.3 },
        { x: 16.8, y: 1.1 },
      ],
      bt,
    )
    if (bt > 0) coin(ctx, p.x, p.y, ox, oy, scale)
    if (bt >= 1) popUp(ctx, 17, 1.6, `+${formatRpShort(inv.value)}`, ox, oy, scale, theme)
  }

  // 7. Standing pop-ups at quiet locations, aggregated per day (§7.5).
  if (dayAgg) {
    if (dayAgg.palletPositions > 0) popUp(ctx, 4, 9, `palet-hari ${formatNumber(dayAgg.palletPositions)}`, ox, oy, scale, theme, 0.4)
    if (dayAgg.invoicesGen > 0) popUp(ctx, 14.7, 2, `+${dayAgg.invoicesGen} invoice`, ox, oy, scale, theme, 1.8)
  }
  void alloc
}
