// World 2 sprite layer (brief 2 §7.4–7.5): order tokens from the platforms to the OMS
// coloured by priority (labelled P0/P1/P2), replenishment hops from bulk to the pick face,
// picks flowing to packing, packages to dispatch and courier vans leaving, the B2B truck
// on its lane, returns flowing back to the returns desk, and settlement coins to the bank.
// Frozen to the day-end state when paused; reduced motion shows the same still state.

import type { Computed2 } from '../engine/index.ts'
import type { PrincipalId } from '../../../core/colors.ts'
import { PRINCIPAL_COLOR } from '../../../core/colors.ts'
import type { ThemeColors } from '../../../core/theme.ts'
import { project } from '../../../core/iso.ts'
import { PATHS2 } from './objects2.ts'
import { PLATFORM_COLOR, PRIORITY_COLOR } from './colors2.ts'

export interface SpriteInput2 {
  data: Computed2
  day: number
  hour: number
  dayProgress: number
  playing: boolean
  speed: number
  reducedMotion: boolean
  theme: ThemeColors
  follow: PrincipalId | null
  followPlatform: string | null
  ox: number
  oy: number
  scale: number
  size: { w: number; h: number }
}

interface Vec {
  x: number
  y: number
}

function along(path: Vec[], t: number): Vec {
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

function popUp(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, ox: number, oy: number, scale: number, theme: ThemeColors, lift = 1): void {
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

function token(ctx: CanvasRenderingContext2D, x: number, y: number, ox: number, oy: number, scale: number, color: string, label: string): void {
  const p = project(x, y, ox, oy, 0.6, scale)
  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(p.sx - 8, p.sy - 6, 16, 12, 3)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.font = '800 8px var(--f-mono), monospace'
  ctx.textAlign = 'center'
  ctx.fillText(label, p.sx, p.sy + 3)
  ctx.restore()
}

function packageBox(ctx: CanvasRenderingContext2D, x: number, y: number, ox: number, oy: number, scale: number, color: string): void {
  const p = project(x, y, ox, oy, 0.2, scale)
  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(43,53,72,0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(p.sx - 5, p.sy - 7, 10, 8, 1.5)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function coin(ctx: CanvasRenderingContext2D, x: number, y: number, ox: number, oy: number, scale: number): void {
  const p = project(x, y, ox, oy, 0.4, scale)
  ctx.save()
  ctx.fillStyle = '#e8b23a'
  ctx.strokeStyle = '#c08d20'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(p.sx, p.sy, 4.5 * Math.max(0.7, scale), 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function truck(ctx: CanvasRenderingContext2D, x: number, y: number, ox: number, oy: number, scale: number, colors: string[], label: string, theme: ThemeColors, alpha = 1): void {
  const p = project(x, y, ox, oy, 0, scale)
  ctx.save()
  ctx.globalAlpha = alpha
  const n = colors.length
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[i] ?? '#9aa4b8'
    ctx.beginPath()
    ctx.roundRect(p.sx - 13 + i * 7, p.sy - 14, 7, 9, 2)
    ctx.fill()
  }
  ctx.fillStyle = '#3a4557'
  ctx.beginPath()
  ctx.roundRect(p.sx - 15 + n * 7, p.sy - 13, 6, 8, 2)
  ctx.fill()
  ctx.fillStyle = '#222b3a'
  ctx.beginPath()
  ctx.arc(p.sx - 10, p.sy - 3, 2.4, 0, Math.PI * 2)
  ctx.arc(p.sx + 1, p.sy - 3, 2.4, 0, Math.PI * 2)
  ctx.fill()
  if (label) {
    ctx.fillStyle = theme.muted
    ctx.font = '600 10px var(--f-mono), monospace'
    ctx.textAlign = 'center'
    ctx.fillText(label, p.sx, p.sy - 19)
  }
  ctx.restore()
}

const PLATFORM_X: Record<string, number> = { 'MP-A': 0.4, 'MP-B': 2.3, 'MP-C': 4.2, 'MP-D': 6.1, 'MP-E': 8, WEB: 9.9 }

export function drawSprites2(ctx: CanvasRenderingContext2D, input: SpriteInput2): void {
  const { data, day, dayProgress, playing, reducedMotion, theme, ox, oy, scale } = input
  const t = reducedMotion || !playing ? 1 : Math.max(0, Math.min(1, dayProgress))
  const follow = input.follow
  const followPlatform = input.followPlatform
  const vis = (p?: PrincipalId, pf?: string): number => {
    if (follow && p && p !== follow) return 0.12
    if (followPlatform && pf && pf !== followPlatform) return 0.12
    return 1
  }

  const dayOrders = data.world.orders.filter((o) => o.day === day)
  const cutoffMisses = dayOrders.filter((o) => o.priority === 'P2' && o.hour < 16).length

  // 1. Order tokens platform → OMS, coloured by priority.
  for (const o of dayOrders.slice(0, 40)) {
    const fromX = PLATFORM_X[o.platform] ?? 5
    const stagger = (o.hour - 6) / 16
    const tt = Math.max(0, Math.min(1, (t - stagger * 0.7) / 0.3))
    if (tt <= 0 || tt >= 1) continue
    const p = along(PATHS2.order(fromX), tt)
    if (vis(o.items[0]?.principal, o.platform) < 1) continue
    token(ctx, p.x, p.y, ox, oy, scale, PRIORITY_COLOR[o.priority] ?? '#8a95ab', o.priority)
  }
  if (t > 0.75) popUp(ctx, 12.9, 2.2, `+${dayOrders.length} order`, ox, oy, scale, theme, 1.2)
  if (t > 0.75 && cutoffMisses > 0) popUp(ctx, 12.9, 1.2, `${cutoffMisses} lewat cut-off → P2`, ox, oy, scale, theme, 1.6)

  // 2. Replenishment: bulk → pick face.
  const replToday = data.world.pickFace.filter((f) => f.day === day && f.replenishedPieces > 0)
  if (replToday.length) {
    const tt = Math.min(1, t * 1.4)
    const p = along(PATHS2.replenish, tt)
    ctx.save()
    ctx.globalAlpha = 0.9
    ctx.fillStyle = theme.warn
    const s = project(p.x, p.y, ox, oy, 0.2, scale)
    ctx.beginPath()
    ctx.roundRect(s.sx - 5, s.sy - 9, 10, 8, 2)
    ctx.fill()
    ctx.restore()
    if (tt >= 1) {
      const units = replToday.reduce((s2, f) => s2 + f.replenishedPieces, 0)
      popUp(ctx, 5.5, 8.8, `replenish ${units} unit`, ox, oy, scale, theme, 0.4)
    }
  }

  // 3. Picks: pick face → packing (regular) and ISD.
  const picks = dayOrders.filter((o) => o.priority === 'P2').slice(0, 18)
  for (let i = 0; i < picks.length; i++) {
    const tt = Math.max(0, Math.min(1, t * 1.5 - i * 0.05))
    if (tt <= 0 || tt >= 1) continue
    const p = along(PATHS2.pick, tt)
    const it = picks[i]?.items[0]
    if (!it || vis(it.principal, picks[i]?.platform) < 1) continue
    packageBox(ctx, p.x, p.y, ox, oy, scale, PRINCIPAL_COLOR[it.principal])
  }
  const isdPicks = dayOrders.filter((o) => o.priority !== 'P2').slice(0, 8)
  for (let i = 0; i < isdPicks.length; i++) {
    const tt = Math.max(0, Math.min(1, t * 1.8 - i * 0.08))
    if (tt <= 0 || tt >= 1) continue
    const p = along(
      [
        { x: 6.5, y: 8.9 },
        { x: 12, y: 3 },
        { x: 15.4, y: 1.6 },
      ],
      tt,
    )
    const it = isdPicks[i]?.items[0]
    if (!it || vis(it.principal, isdPicks[i]?.platform) < 1) continue
    packageBox(ctx, p.x, p.y, ox, oy, scale, PRINCIPAL_COLOR[it.principal])
  }

  // 4. Packages: packing → dispatch → courier lane → van leaves.
  const shipped = dayOrders.filter((o) => o.shipDay === day).slice(0, 24)
  for (let i = 0; i < shipped.length; i++) {
    const o = shipped[i]
    if (!o || vis(o.items[0]?.principal, o.platform) < 1) continue
    const stagger = i * 0.03
    const tt = Math.max(0, Math.min(1, (t - 0.25 - stagger) / 0.5))
    if (tt <= 0) continue
    if (tt < 0.6) {
      const p = along(PATHS2.packToDispatch, tt / 0.6)
      packageBox(ctx, p.x, p.y, ox, oy, scale, PRINCIPAL_COLOR[o.items[0]?.principal ?? 'A'])
    } else if (tt < 0.85) {
      const laneY = o.courier === 'K1' ? 8.2 : o.courier === 'K2' ? 9.2 : 10.2
      const p = along(
        [
          { x: 15, y: 9.3 },
          { x: 16.9, y: laneY + 0.4 },
        ],
        (tt - 0.6) / 0.25,
      )
      packageBox(ctx, p.x, p.y, ox, oy, scale, PRINCIPAL_COLOR[o.items[0]?.principal ?? 'A'])
    } else {
      const laneY = o.courier === 'K1' ? 8.2 : o.courier === 'K2' ? 9.2 : 10.2
      const p = along(PATHS2.courierOut(laneY), (tt - 0.85) / 0.15)
      truck(ctx, p.x, p.y, ox, oy, scale, [PLATFORM_COLOR[o.platform] ?? theme.accent], o.courier === 'K1' ? 'Kurir 1' : o.courier === 'K2' ? 'Kurir 2' : 'Kurir 3', theme, 1)
    }
  }
  if (t > 0.9) popUp(ctx, 15, 8.2, `${shipped.length} paket → manifest`, ox, oy, scale, theme, 0.8)

  // 5. B2B truck on its lane (mixed principal colours).
  const b2bTripsToday = data.world.b2b.trips.filter((tr) => tr.day === day)
  for (let i = 0; i < Math.min(2, b2bTripsToday.length); i++) {
    const tt = Math.max(0, Math.min(1, (t - 0.2 - i * 0.25) / 0.55))
    if (tt <= 0 || tt >= 1) continue
    const p = along(PATHS2.b2b, tt)
    const trip = b2bTripsToday[i]
    const principals = new Set<PrincipalId>()
    for (const doId of trip?.dos ?? []) {
      const d = data.world.b2b.dos.find((x) => x.id === doId)
      if (d) for (const l of d.lines) {
        const pr = data.world.skus[l.sku]?.principal
        if (pr) principals.add(pr)
      }
    }
    const colors = [...principals].slice(0, 4).map((pr) => PRINCIPAL_COLOR[pr])
    truck(ctx, p.x, p.y, ox, oy, scale, colors, trip?.truckCode ?? '', theme, follow ? 0.3 : 1)
  }

  // 6. Returns flowing back to the returns desk.
  for (const o of dayOrders.filter((x) => x.returned && x.returnDay === day).slice(0, 6)) {
    const tt = Math.max(0, Math.min(1, (t - 0.5) / 0.4))
    if (tt <= 0 || tt >= 1) continue
    const p = along(PATHS2.returnFlow, tt)
    if (vis(o.items[0]?.principal, o.platform) < 1) continue
    token(ctx, p.x, p.y, ox, oy, scale, theme.danger, 'retur')
  }
  const retsToday = data.world.orders.filter((o) => o.returned && o.returnDay === day).length
  if (t > 0.9 && retsToday > 0) popUp(ctx, 18.1, 0.9, `+${retsToday} retur`, ox, oy, scale, theme, 0.6)

  // 7. Settlement coins to the bank (platforms whose settlement lands today).
  const settledToday = data.world.orders.filter((o) => o.settlementDay === day)
  if (settledToday.length) {
    const tt = Math.max(0, Math.min(1, (t - 0.6) / 0.35))
    const p = along(PATHS2.settle, tt)
    if (tt > 0 && tt < 1) coin(ctx, p.x, p.y, ox, oy, scale)
    if (tt >= 1) {
      const total = settledToday.reduce((s, o) => s + o.netSettlement, 0)
      const short = total >= 1_000_000_000 ? `Rp ${(total / 1_000_000_000).toFixed(1).replace('.', ',')} M` : `Rp ${Math.round(total / 1_000_000).toString()} jt`
      popUp(ctx, 21.9, 1.6, `+${short}`, ox, oy, scale, theme, 1.2)
    }
  }
}
