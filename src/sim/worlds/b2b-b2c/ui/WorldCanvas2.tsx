// World 2 canvas (brief 2 §7.4): the same isometric renderer as world 1 over the
// warehouse map — platforms, OMS + wave board, ISD zone, bulk racks with pick face and
// the replenishment lane, packing with a webcam that lights while recording, box shelf,
// dispatch with the scale and courier sort lanes, courier bay, B2B lane, desks, settlement
// ledger and bank. Bulk pallet stacks carry principal colours; packages are tinted by the
// first item's principal; priority colours never stand alone (labels P0/P1/P2).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Computed2 } from '../engine/index.ts'
import type { PrincipalId } from '../../../core/colors.ts'
import { PRINCIPAL_COLOR } from '../../../core/colors.ts'
import { readTheme } from '../../../core/theme.ts'
import type { ThemeColors } from '../../../core/theme.ts'
import { isoBox, objectRect, project, quad, shade, TILE_H, TILE_W, LIFT } from '../../../core/iso.ts'
import type { View } from '../../../core/iso.ts'
import { ALL_OBJECTS2, object2ById } from './objects2.ts'
import { PLATFORM_COLOR, PRIORITY_COLOR } from './colors2.ts'
import type { WorldObject2 } from './objects2.ts'
import { drawSprites2 } from './sprites2.ts'
import type { SpriteInput2 } from './sprites2.ts'

interface WorldCanvas2Props {
  data: Computed2
  day: number
  hour: number
  follow: PrincipalId | null
  followPlatform: string | null
  selected: string | null
  onSelect: (id: string | null) => void
  playing: boolean
  speed: number
  reducedMotion: boolean
  dayProgress: number
}

export function WorldCanvas2({ data, day, hour, follow, followPlatform, selected, onSelect, playing, speed, reducedMotion, dayProgress }: WorldCanvas2Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState<ThemeColors>(() => readTheme())
  const [size, setSize] = useState({ w: 900, h: 560 })

  useEffect(() => {
    const update = () => setTheme(readTheme())
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', update)
    return () => {
      observer.disconnect()
      mq.removeEventListener('change', update)
    }
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      setSize({ w, h: Math.max(380, Math.min(680, Math.round(w * 0.52))) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const view: View = useMemo(() => {
    const sxMin = -13 * (TILE_W / 2) // ground corner (−1, 12)
    const sxMax = 24.5 * (TILE_W / 2) // ground corner (23.5, −1)
    const syMin = -1.4 * (TILE_H / 2) - LIFT * 1.6
    const syMax = 35.5 * (TILE_H / 2) + 24 // ground corner (23.5, 12) + margin
    const contentW = sxMax - sxMin
    const contentH = syMax - syMin
    const scale = Math.min(size.w / contentW, size.h / contentH, 1.2)
    return { scale, ox: (size.w - contentW * scale) / 2 - sxMin * scale, oy: (size.h - contentH * scale) / 2 - syMin * scale }
  }, [size])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== size.w * dpr || canvas.height !== size.h * dpr) {
      canvas.width = size.w * dpr
      canvas.height = size.h * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)
    const { ox, oy, scale } = view
    const pj = (x: number, y: number, z = 0): { sx: number; sy: number } => project(x, y, ox, oy, z, scale)
    const dimFor = (o: WorldObject2): number => {
      if (followPlatform && o.platform && o.platform !== followPlatform) return 0.25
      if (follow && o.id === `PF-${follow}`) return 0.25
      return 1
    }

    quad(ctx, [pj(-1, -1), pj(23.5, -1), pj(23.5, 12), pj(-1, 12)], theme.surface2)

    // Replenishment lane + B2B lane backgrounds.
    const lane = (x: number, y: number, w: number, d: number, color: string) => quad(ctx, [pj(x, y), pj(x + w, y), pj(x + w, y + d), pj(x, y + d)], color, 0.5)
    lane(3.3, 7.4, 4.6, 0.7, shade(theme.warn, 1.3))
    lane(8.4, 4.6, 6.5, 1.5, shade(theme.accent, 1.5))

    const ordered = [...ALL_OBJECTS2].sort((a, b) => a.x + a.y + a.d - (b.x + b.y + b.d))
    for (const o of ordered) {
      const alpha = dimFor(o)
      switch (o.kind) {
        case 'platform': {
          const c = PLATFORM_COLOR[o.platform ?? 'WEB'] ?? theme.accent
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.8, c, view, { alpha, roof: shade(c, 1.15) })
          const p = pj(o.x + o.w / 2, o.y + o.d, 1.3)
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.fillStyle = theme.ink
          ctx.font = '700 12px var(--f-ui), sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(o.platform ?? '', p.sx, p.sy)
          ctx.restore()
          break
        }
        case 'oms':
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.6, theme.accentSoft, view, { alpha, roof: shade(theme.accentSoft, 1.06) })
          isoBox(ctx, o.x + 0.3, o.y + 0.4, 1.4, 0.12, 0.3, theme.accent, view, { alpha })
          break
        case 'isdZone': {
          const c = PRIORITY_COLOR.P1 ?? theme.warn
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.55, c, view, { alpha, roof: shade(c, 1.18), outline: shade(c, 1.1) })
          const p = pj(o.x + o.w / 2, o.y + o.d, 1.1)
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.fillStyle = theme.ink
          ctx.font = '800 12px var(--f-ui), sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('ISD — P0 & P1', p.sx, p.sy)
          ctx.restore()
          break
        }
        case 'returnsDesk':
        case 'csDesk':
        case 'shopDesk':
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.3, o.kind === 'returnsDesk' ? theme.danger : o.kind === 'csDesk' ? theme.accent : theme.done, view, { alpha, roof: shade(o.kind === 'returnsDesk' ? theme.danger : o.kind === 'csDesk' ? theme.accent : theme.done, 1.2) })
          break
        case 'settleLedger':
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.5, theme.accent, view, { alpha, roof: shade(theme.accent, 1.25) })
          break
        case 'bank':
          isoBox(ctx, o.x, o.y, o.w, o.d, 1, theme.done, view, { alpha, roof: shade(theme.done, 1.15) })
          isoBox(ctx, o.x + 0.4, o.y + 0.45, 0.7, 0.5, 1.2, shade(theme.done, 1.25), view, { alpha })
          break
        case 'dock': {
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.5, shade(theme.muted, 1.4), view, { alpha, roof: shade(theme.surface, 0.94) })
          // The 15.00 cut-off clock: a small dial that fills toward the cut-off.
          const p = pj(o.x + o.w / 2, o.y + o.d, 0.9)
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.strokeStyle = theme.warn
          ctx.lineWidth = 3
          const frac = Math.max(0, Math.min(1, (hour - 6) / (15 - 6)))
          ctx.beginPath()
          ctx.arc(p.sx, p.sy - 10, 9 * Math.max(0.7, scale), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac)
          ctx.stroke()
          ctx.fillStyle = theme.ink
          ctx.font = '700 10px var(--f-mono), monospace'
          ctx.textAlign = 'center'
          ctx.fillText('15.00', p.sx, p.sy + 2)
          ctx.restore()
          break
        }
        case 'bulkRack': {
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.12, shade(theme.muted, 1.3), view, { alpha })
          // Principal-coloured pallet stacks sized by that principal's share of bulk stock today.
          const bulk = bulkShare(data, day)
          const slots = 10
          const slotW = (o.w - 0.4) / slots
          let slot = 0
          for (const pr of ['A', 'B', 'C', 'D', 'E', 'F'] as const) {
            if ((follow && pr !== follow) || (followPlatform && followPlatform !== 'B2B')) {
              slot += 2
              continue
            }
            const stack = Math.max(0, Math.min(4, Math.round((bulk[pr] ?? 0) * slots * 0.5)))
            for (let s2 = 0; s2 < stack; s2++) {
              const px = o.x + 0.2 + (slot + s2) * slotW
              isoBox(ctx, px, o.y + 0.12, slotW * 0.86, o.d - 0.24, 0.18 + s2 * 0.16, PRINCIPAL_COLOR[pr], view, { alpha })
              isoBox(ctx, px, o.y + 0.12, slotW * 0.86, o.d - 0.24, 0.18 + (s2 + 1) * 0.16, shade(PRINCIPAL_COLOR[pr], 1.08), view, { alpha })
            }
            slot += 2
          }
          break
        }
        case 'pickFace': {
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.42, shade(theme.done, 1.3), view, { alpha, roof: shade(theme.surface, 0.96) })
          const stock = pickFaceFill(data, day)
          const n = 12
          const w = (o.w - 0.3) / n
          let i = 0
          for (const pr of ['A', 'B', 'C', 'D', 'E', 'F'] as const) {
            if (follow && pr !== follow) continue
            const cells = Math.max(1, Math.round((stock[pr] ?? 0) * n))
            for (let k = 0; k < cells && i < n; k++, i++) {
              isoBox(ctx, o.x + 0.15 + i * w, o.y + 0.12, w * 0.8, o.d - 0.24, 0.3, PRINCIPAL_COLOR[pr], view, { alpha })
            }
          }
          break
        }
        case 'regularPick':
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.3, theme.accent, view, { alpha, roof: shade(theme.accent, 1.18) })
          break
        case 'packing': {
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.34, theme.done, view, { alpha, roof: shade(theme.done, 1.2) })
          // Webcam icon lights while playing (recording).
          const p = pj(o.x + o.w / 2, o.y + o.d, 0.6)
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.fillStyle = playing && !reducedMotion ? theme.danger : theme.muted
          ctx.beginPath()
          ctx.arc(p.sx, p.sy - 8, 4 * Math.max(0.7, scale), 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
          break
        }
        case 'boxShelf': {
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.6, shade(theme.warn, 1.2), view, { alpha, roof: shade(theme.warn, 1.35) })
          isoBox(ctx, o.x + 0.2, o.y + 0.2, 0.45, 0.4, 0.75, theme.surface, view, { alpha })
          isoBox(ctx, o.x + 0.8, o.y + 0.2, 0.45, 0.4, 0.55, shade(theme.surface, 0.92), view, { alpha })
          break
        }
        case 'dispatch':
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.4, shade(theme.muted, 1.35), view, { alpha, roof: shade(theme.surface, 0.95) })
          isoBox(ctx, o.x + 0.25, o.y + 0.3, 0.7, 0.6, 0.35, theme.accent, view, { alpha })
          break
        case 'courierLane': {
          const c = { K1: '#3e7bd6', K2: '#d08a3e', K3: '#8a5fd0' }[o.courier ?? 'K1'] ?? theme.muted
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.22, c, view, { alpha, roof: shade(c, 1.2) })
          const p = pj(o.x + o.w / 2, o.y + o.d, 0.5)
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.fillStyle = theme.ink
          ctx.font = '600 10.5px var(--f-ui), sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(o.courier === 'K1' ? 'Kurir 1' : o.courier === 'K2' ? 'Kurir 2' : 'Kurir 3', p.sx, p.sy)
          ctx.restore()
          break
        }
        case 'courierBay':
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.1, shade(theme.muted, 1.3), view, { alpha })
          isoBox(ctx, o.x + 0.3, o.y + 0.3, 1.2, 0.9, 0.5, theme.accent, view, { alpha, roof: shade(theme.accent, 1.2) })
          break
        case 'b2bLane': {
          const p = pj(o.x + 0.4, o.y + o.d + 0.3, 0.2)
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.fillStyle = theme.ink
          ctx.font = '700 12px var(--f-ui), sans-serif'
          ctx.fillText('Jalur B2B → toko', p.sx, p.sy)
          ctx.restore()
          break
        }
      }
    }

    // Selection highlight.
    if (selected) {
      const o = object2ById(selected)
      if (o) {
        const t = pj(o.x, o.y, 0.01)
        const r = pj(o.x + o.w, o.y, 0.01)
        const b = pj(o.x + o.w, o.y + o.d, 0.01)
        const l = pj(o.x, o.y + o.d, 0.01)
        ctx.save()
        ctx.strokeStyle = theme.accent
        ctx.lineWidth = 2.5
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(t.sx, t.sy)
        ctx.lineTo(r.sx, r.sy)
        ctx.lineTo(b.sx, b.sy)
        ctx.lineTo(l.sx, l.sy)
        ctx.closePath()
        ctx.stroke()
        ctx.restore()
      }
    }

    const spriteInput: SpriteInput2 = { data, day, hour, dayProgress, playing, speed, reducedMotion, theme, follow, followPlatform, ox, oy, scale, size }
    drawSprites2(ctx, spriteInput)
  }, [data, day, dayProgress, follow, followPlatform, hour, playing, reducedMotion, selected, size, speed, theme, view])

  useEffect(() => {
    draw()
  }, [draw])

  const onCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const hit = [...ALL_OBJECTS2]
        .sort((a, b) => b.x + b.y + b.d - (a.x + a.y + a.d))
        .find((o) => {
          const r = objectRect(o, view.ox, view.oy, view.scale)
          return px >= r.left - 4 && px <= r.left + r.width + 4 && py >= r.top - 4 && py <= r.top + r.height + 8
        })
      onSelect(hit ? hit.id : null)
    },
    [onSelect, view],
  )

  const todayOrders = data.world.orders.filter((o) => o.day === day)

  return (
    <div ref={wrapRef} className="sim-canvas-wrap" style={{ position: 'relative', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', border: '1px solid var(--line)', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: size.w, height: size.h }} onClick={onCanvasClick} aria-label="Dunia gudang B2B dan B2C" role="img" />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {ALL_OBJECTS2.map((o) => {
          const r = objectRect(o, view.ox, view.oy, view.scale)
          const dim = (followPlatform && o.platform && o.platform !== followPlatform) || (follow && o.id === `PF-${follow}`)
          return (
            <button
              key={o.id}
              type="button"
              aria-label={`${o.label}. ${o.what}`}
              aria-pressed={selected === o.id}
              onClick={() => onSelect(selected === o.id ? null : o.id)}
              style={{
                position: 'absolute', left: r.left - 2, top: r.top - 2, width: r.width + 4, height: r.height + 4,
                pointerEvents: 'auto', opacity: dim ? 0.3 : 0, border: '2px solid transparent', borderRadius: 8, background: 'transparent', cursor: 'pointer',
              }}
              onFocus={(e) => {
                e.currentTarget.style.opacity = '1'
                e.currentTarget.style.borderColor = 'var(--accent)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.opacity = dim ? '0.3' : '0'
                e.currentTarget.style.borderColor = 'transparent'
              }}
            />
          )
        })}
      </div>
      <div aria-hidden style={{ position: 'absolute', left: 12, bottom: 10, fontSize: 12, fontWeight: 600, color: 'var(--muted)', background: 'color-mix(in srgb, var(--surface) 80%, transparent)', borderRadius: 999, padding: '4px 12px', border: '1px solid var(--line)' }}>
        Ilustrasi — angka dummy, bukan data SAMB
      </div>
      <div style={{ position: 'absolute', right: 12, top: 10, fontSize: 12, color: 'var(--muted)', background: 'color-mix(in srgb, var(--surface) 80%, transparent)', borderRadius: 999, padding: '4px 12px', border: '1px solid var(--line)' }}>
        Hari {day}, {String(Math.floor(hour)).padStart(2, '0')}.{String(Math.round((hour % 1) * 60)).padStart(2, '0')} · {todayOrders.length} order
      </div>
      {playing && !reducedMotion && (
        <div aria-hidden style={{ position: 'absolute', left: 12, top: 10, fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
          ▶ {speed}×
        </div>
      )}
    </div>
  )
}

/** Bulk pallet fill per principal for the day (share of the day's bulk pallets). */
function bulkShare(data: Computed2, day: number): Record<string, number> {
  const out: Record<string, number> = {}
  const rows = data.world.ledger.filter((r) => r.day === day)
  const total = rows.reduce((s, r) => s + r.close, 0) || 1
  for (const r of rows) {
    const p = data.world.skus[r.sku]?.principal ?? 'A'
    out[p] = (out[p] ?? 0) + r.close / total
  }
  return out
}

/** Pick-face fill per principal (share of pick-face SKUs). */
function pickFaceFill(data: Computed2, day: number): Record<string, number> {
  const out: Record<string, number> = {}
  const rows = data.world.pickFace.filter((f) => f.day === day)
  const total = rows.length || 1
  for (const f of rows) {
    const p = data.world.skus[f.sku]?.principal ?? 'A'
    out[p] = (out[p] ?? 0) + 1 / total
  }
  return out
}
