// The isometric world (brief §7.1, §7.4): Canvas 2D driven by requestAnimationFrame, CSP-safe
// with no runtime dependency. The static scene renders the day's state (racks, parked trucks,
// cash rings); the sprite layer animates the day's events when playing. Theme colours are
// read from the app tokens so light and dark both work. Every object also exists as a
// keyboard-reachable button in an overlay (§7.10); colour never carries meaning alone.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Computed } from '../engine/index.ts'
import type { PrincipalId } from '../engine/config.ts'
import { PRINCIPAL_COLOR } from '../../../core/colors.ts'
import { readTheme } from '../../../core/colors.ts'
import type { ThemeColors } from '../../../core/colors.ts'
import { ALL_OBJECTS, objectById, ROADS } from './objects.ts'
import type { WorldObject } from './objects.ts'
import { drawSprites } from './sprites.ts'
import { objectRect, project, TILE_H, TILE_W, LIFT } from '../../../core/iso.ts'
import type { SpriteInput } from './sprites.ts'

interface WorldCanvasProps {
  data: Computed
  day: number
  follow: PrincipalId | null
  selected: string | null
  onSelect: (id: string | null) => void
  playing: boolean
  speed: number
  reducedMotion: boolean
  /** Fraction (0–1) of progress through the current day's animations, driven by the parent. */
  dayProgress: number
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f))
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f))
  const b = Math.min(255, Math.round((n & 255) * f))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

interface View {
  ox: number
  oy: number
  scale: number
}

/** Draw an isometric box: soft shadow, two shaded faces, lit top. */
function isoBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number, color: string, view: View, opts?: { outline?: string; alpha?: number; roof?: string }) {
  const { ox, oy, scale } = view
  const t = project(x, y, ox, oy, h, scale)
  const r = project(x + w, y, ox, oy, h, scale)
  const b = project(x + w, y + d, ox, oy, h, scale)
  const l = project(x, y + d, ox, oy, h, scale)
  const r0 = project(x + w, y, ox, oy, 0, scale)
  const b0 = project(x + w, y + d, ox, oy, 0, scale)
  const l0 = project(x, y + d, ox, oy, 0, scale)
  ctx.save()
  if (opts?.alpha !== undefined) ctx.globalAlpha = opts.alpha
  ctx.fillStyle = 'rgba(43, 53, 72, 0.10)'
  ctx.beginPath()
  ctx.ellipse((l0.sx + r0.sx) / 2, b0.sy + 4 * scale, (r0.sx - l0.sx) * 0.52, TILE_H * 0.42 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = shade(color, 0.62)
  ctx.beginPath()
  ctx.moveTo(l.sx, l.sy)
  ctx.lineTo(b.sx, b.sy)
  ctx.lineTo(b0.sx, b0.sy)
  ctx.lineTo(l0.sx, l0.sy)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = shade(color, 0.78)
  ctx.beginPath()
  ctx.moveTo(r.sx, r.sy)
  ctx.lineTo(b.sx, b.sy)
  ctx.lineTo(b0.sx, b0.sy)
  ctx.lineTo(r0.sx, r0.sy)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = opts?.roof ?? color
  ctx.beginPath()
  ctx.moveTo(t.sx, t.sy)
  ctx.lineTo(r.sx, r.sy)
  ctx.lineTo(b.sx, b.sy)
  ctx.lineTo(l.sx, l.sy)
  ctx.closePath()
  ctx.fill()
  if (opts?.outline) {
    ctx.strokeStyle = opts.outline
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(t.sx, t.sy)
    ctx.lineTo(r.sx, r.sy)
    ctx.lineTo(b.sx, b.sy)
    ctx.lineTo(l.sx, l.sy)
    ctx.closePath()
    ctx.stroke()
  }
  ctx.restore()
}

function quad(ctx: CanvasRenderingContext2D, pts: { sx: number; sy: number }[], color: string, alpha = 1): void {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  pts.forEach((p, i) => (i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy)))
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function WorldCanvas({ data, day, follow, selected, onSelect, playing, speed, reducedMotion, dayProgress }: WorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState<ThemeColors>(() => readTheme())
  const [size, setSize] = useState({ w: 900, h: 560 })
  const { world } = data

  // Theme tokens can change at runtime (theme switch); refresh on the attribute + scheme.
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
      setSize({ w, h: Math.max(380, Math.min(680, Math.round(w * 0.54))) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Zoom-to-fit: the content bbox in grid units is fixed, so origin and scale derive from
  // the canvas size here in render (no effect-driven setState).
  const view: View = useMemo(() => {
    const sxMin = -16.5 * (TILE_W / 2) // ground corner (−1, 15.5)
    const sxMax = 30 * (TILE_W / 2) // ground corner (29.5, −0.5)
    const syMin = -2.4 * (TILE_H / 2) - LIFT * 1.9 // label tops / principal roofs
    const syMax = 45.5 * (TILE_H / 2) + 26 // ground corner (29.5, 15.5) + margin
    const contentW = sxMax - sxMin
    const contentH = syMax - syMin
    const scale = Math.min(size.w / contentW, size.h / contentH, 1.25)
    return {
      scale,
      ox: (size.w - contentW * scale) / 2 - sxMin * scale,
      oy: (size.h - contentH * scale) / 2 - syMin * scale,
    }
  }, [size])

  const maxPallets = useMemo(
    () => Math.max(1, ...Object.values(data.alloc.pallets.palletsByDay).map((r) => ['A', 'B', 'C', 'D', 'E', 'F'].reduce((s, p) => s + r[p as PrincipalId], 0))),
    [data],
  )
  const mtStores = useMemo(() => new Set(world.stores.filter((s) => s.mtBesar).map((s) => s.id)), [world])

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
    const pallets = data.alloc.pallets.palletsByDay[day]
    const { ox, oy, scale } = view
    const dimFor = (o: WorldObject): number => (follow && o.principal && o.principal !== follow ? 0.28 : 1)
    const pj = (x: number, y: number, z = 0): { sx: number; sy: number } => project(x, y, ox, oy, z, scale)

    // Ground plate.
    quad(
      ctx,
      [pj(-1, -1), pj(29.5, -1), pj(29.5, 15.5), pj(-1, 15.5)],
      theme.surface2,
    )

    // Roads to the three zones.
    for (const z of [1, 2, 3] as const) {
      const path = ROADS[z]
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i]
        const b = path[i + 1]
        if (!a || !b) continue
        const wRoad = 0.34
        quad(
          ctx,
          [pj(a.x, a.y - wRoad / 2), pj(a.x, a.y + wRoad / 2), pj(b.x, b.y + wRoad / 2), pj(b.x, b.y - wRoad / 2)],
          shade(theme.muted, 1.35),
          0.35,
        )
      }
      const end = path[path.length - 1]
      if (!end) continue
      const endP = pj(end.x, end.y)
      ctx.save()
      ctx.fillStyle = theme.muted
      ctx.font = '600 12px var(--f-ui), sans-serif'
      ctx.fillText(`Zona ${z}`, endP.sx - 14, endP.sy - 8)
      ctx.restore()
    }

    // Draw order: back to front by (x + y).
    const ordered = [...ALL_OBJECTS].sort((a, b) => a.x + a.y + a.d - (b.x + b.y + b.d))
    for (const o of ordered) {
      const alpha = dimFor(o)
      switch (o.kind) {
        case 'principal': {
          const c = PRINCIPAL_COLOR[o.principal as PrincipalId]
          isoBox(ctx, o.x, o.y, o.w, o.d, 1.05, c, view, { alpha, roof: shade(c, 1.12) })
          const p = pj(o.x + o.w / 2, o.y + o.d, 1.6)
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.fillStyle = theme.ink
          ctx.font = '700 13px var(--f-ui), sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(`Prinsipal ${o.principal}`, p.sx, p.sy)
          ctx.restore()
          break
        }
        case 'komersial':
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.75, theme.accentSoft, view, { alpha, roof: shade(theme.accentSoft, 1.06), outline: alpha < 1 ? undefined : shade(theme.accent, 1.1) })
          isoBox(ctx, o.x + 0.5, o.y + 0.55, 1.3, 0.14, 0.28, theme.accent, view, { alpha })
          break
        case 'adminDesk': {
          const c = o.variant === 'dedicated' ? PRINCIPAL_COLOR.D : theme.muted
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.34, c, view, { alpha, roof: shade(c, 1.15) })
          break
        }
        case 'dock':
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.5, shade(theme.muted, 1.4), view, { alpha, roof: shade(theme.surface, 0.94) })
          isoBox(ctx, o.x + 0.25, o.y + 0.4, o.w - 0.5, 0.5, 0.14, theme.warn, view, { alpha })
          break
        case 'wms':
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.34, theme.accent, view, { alpha, roof: shade(theme.accent, 1.18) })
          break
        case 'rack': {
          // Rack frame + pallet stacks coloured per principal (§7.4: headroom visible).
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.1, shade(theme.muted, 1.3), view, { alpha })
          const slots = 12
          const slotW = (o.w - 0.4) / slots
          let slot = 0
          for (const p of ['A', 'B', 'C', 'D', 'E', 'F'] as const) {
            if (follow && p !== follow) {
              slot += 2
              continue
            }
            const count = pallets?.[p] ?? 0
            const stack = Math.max(0, Math.min(4, Math.round((count / maxPallets) * slots * 0.5)))
            for (let s = 0; s < stack; s++) {
              const px = o.x + 0.2 + (slot + s) * slotW
              isoBox(ctx, px, o.y + 0.12, slotW * 0.86, o.d - 0.24, 0.16 + s * 0.14, PRINCIPAL_COLOR[p], view, { alpha })
              isoBox(ctx, px, o.y + 0.12, slotW * 0.86, o.d - 0.24, 0.16 + (s + 1) * 0.14, shade(PRINCIPAL_COLOR[p], 1.08), view, { alpha })
            }
            slot += 2
          }
          break
        }
        case 'staging':
          quad(ctx, [pj(o.x, o.y), pj(o.x + o.w, o.y), pj(o.x + o.w, o.y + o.d), pj(o.x, o.y + o.d)], shade(theme.warn, 1.25), 0.5 * alpha)
          isoBox(ctx, o.x + 0.35, o.y + 0.35, 0.8, 0.8, 0.22, theme.warn, view, { alpha })
          break
        case 'truckPool': {
          const c = { L: theme.done, M: theme.accent, H: theme.warn }[o.truckClass as 'L' | 'M' | 'H']
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.08, shade(theme.muted, 1.3), view, { alpha })
          isoBox(ctx, o.x + 0.18, o.y + 0.18, o.w - 0.36, o.d - 0.36, 0.3, c, view, { alpha, roof: shade(c, 1.15) })
          const p = pj(o.x + o.w / 2, o.y + o.d + 0.2, 0.5)
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.fillStyle = theme.ink
          ctx.font = '600 11px var(--f-ui), sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(`Truk ${o.truckClass}`, p.sx, p.sy)
          ctx.restore()
          break
        }
        case 'store': {
          const mt = mtStores.has(o.id)
          const c = mt ? theme.accentSoft : theme.surface
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.42, c, view, { alpha, roof: shade(c, 1.06), outline: mt ? theme.accent : undefined })
          break
        }
        case 'finance':
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.85, shade(theme.accent, 1.25), view, { alpha, roof: shade(theme.accent, 1.4) })
          break
        case 'arDesk':
        case 'taxDesk':
          isoBox(ctx, o.x, o.y, o.w, o.d, 0.3, o.kind === 'arDesk' ? theme.accent : theme.done, view, { alpha, roof: shade(o.kind === 'arDesk' ? theme.accent : theme.done, 1.2) })
          break
        case 'bank':
          isoBox(ctx, o.x, o.y, o.w, o.d, 1.05, theme.done, view, { alpha, roof: shade(theme.done, 1.15) })
          isoBox(ctx, o.x + 0.45, o.y + 0.5, 0.8, 0.5, 1.25, shade(theme.done, 1.25), view, { alpha })
          break
      }
    }

    // Labels for the shared offices.
    const label = (x: number, y: number, text: string) => {
      const p = pj(x, y)
      ctx.save()
      ctx.fillStyle = theme.muted
      ctx.font = '600 11.5px var(--f-ui), sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(text, p.sx, p.sy - 10)
      ctx.restore()
    }
    label(1.6, 4.2, 'Komersial')
    label(4.6, 4, 'Sales admin')
    label(8.3, 4.2, 'Dock inbound')
    label(10.1, 4, 'Admin WMS')
    label(4, 9.4, 'Rak gudang')
    label(8.35, 7.4, 'Staging')
    label(13, 6.7, 'Pool truk')
    label(14.7, 2, 'Finance')
    label(14.3, 4, 'AR dan pajak')
    label(17, 2, 'Bank')

    // Cash-clock ring over the finance office for open invoices (§7.5), aggregated.
    const openHere = data.alloc.capital.filter((c) => c.invoice.sentDay <= day && c.invoice.payDay > day)
    if (openHere.length) {
      const p = pj(14.7, 1, 1.5)
      ctx.save()
      ctx.strokeStyle = theme.warn
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(p.sx, p.sy - 14, 13 * Math.max(0.7, scale), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.45)
      ctx.stroke()
      ctx.fillStyle = theme.warn
      ctx.font = '700 11px var(--f-mono), monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${openHere.length}`, p.sx, p.sy - 10)
      ctx.restore()
    }

    // Selection highlight.
    if (selected) {
      const o = objectById(selected)
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

    // Sprite layer: the day's moving things.
    const spriteInput: SpriteInput = { data, day, dayProgress, playing, speed, reducedMotion, theme, follow, ox, oy, scale, size }
    drawSprites(ctx, spriteInput)
  }, [data, day, dayProgress, follow, maxPallets, mtStores, playing, reducedMotion, selected, size, speed, theme, view])

  useEffect(() => {
    draw()
  }, [draw])

  // Click-to-select on the canvas itself (pointer users); overlay buttons serve keyboard.
  const onCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const hit = [...ALL_OBJECTS]
        .sort((a, b) => b.x + b.y + b.d - (a.x + a.y + a.d))
        .find((o) => {
          const r = objectRect(o, view.ox, view.oy, view.scale)
          return px >= r.left - 4 && px <= r.left + r.width + 4 && py >= r.top - 4 && py <= r.top + r.height + 8
        })
      onSelect(hit ? hit.id : null)
    },
    [onSelect, view],
  )

  const today = world.trips.filter((t) => t.day === day)

  return (
    <div ref={wrapRef} className="sim-canvas-wrap" style={{ position: 'relative', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', border: '1px solid var(--line)', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: size.w, height: size.h }} onClick={onCanvasClick} aria-label="Dunia simulasi isometrik" role="img" />
      {/* Keyboard-reachable objects (§7.10). */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {ALL_OBJECTS.map((o) => {
          const r = objectRect(o, view.ox, view.oy, view.scale)
          const dim = follow && o.principal && o.principal !== follow
          return (
            <button
              key={o.id}
              type="button"
              aria-label={`${o.label}. ${o.what}`}
              aria-pressed={selected === o.id}
              onClick={() => onSelect(selected === o.id ? null : o.id)}
              style={{
                position: 'absolute',
                left: r.left - 2,
                top: r.top - 2,
                width: r.width + 4,
                height: r.height + 4,
                pointerEvents: 'auto',
                opacity: dim ? 0.3 : 0,
                border: '2px solid transparent',
                borderRadius: 8,
                background: 'transparent',
                cursor: 'pointer',
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
      {/* Watermark (§1.5). */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 12,
          bottom: 10,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--muted)',
          background: 'color-mix(in srgb, var(--surface) 80%, transparent)',
          borderRadius: 999,
          padding: '4px 12px',
          border: '1px solid var(--line)',
        }}
      >
        Ilustrasi — angka dummy, bukan data SAMB
      </div>
      <div
        style={{
          position: 'absolute',
          right: 12,
          top: 10,
          fontSize: 12,
          color: 'var(--muted)',
          background: 'color-mix(in srgb, var(--surface) 80%, transparent)',
          borderRadius: 999,
          padding: '4px 12px',
          border: '1px solid var(--line)',
        }}
      >
        Hari {day}: {today.length} trip · {world.dos.filter((d) => d.day === day).length} DO
      </div>
      {playing && !reducedMotion && (
        <div aria-hidden style={{ position: 'absolute', left: 12, top: 10, fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
          ▶ {speed}×
        </div>
      )}
    </div>
  )
}
