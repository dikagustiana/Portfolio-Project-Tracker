// Shared isometric projection and sprite input types. Kept separate from WorldCanvas and
// sprites so the two never import each other (a cycle confuses type-aware linting).



/** Minimal footprint needed for projection — each world's object type satisfies it. */
export interface Footprint {
  x: number
  y: number
  w: number
  d: number
}

export const TILE_W = 58
export const TILE_H = 29
export const LIFT = 30

export function project(x: number, y: number, originX: number, originY: number, z = 0, scale = 1): { sx: number; sy: number } {
  return { sx: originX + ((x - y) * TILE_W * scale) / 2, sy: originY + ((x + y) * TILE_H * scale) / 2 - z * LIFT * scale }
}

/** Screen rectangle of an object footprint (for the a11y overlay). */
export function objectRect(o: Footprint, originX: number, originY: number, scale = 1): { left: number; top: number; width: number; height: number } {
  const corners = [
    project(o.x, o.y, originX, originY, 0, scale),
    project(o.x + o.w, o.y, originX, originY, 0, scale),
    project(o.x + o.w, o.y + o.d, originX, originY, 0, scale),
    project(o.x, o.y + o.d, originX, originY, 0, scale),
  ]
  const left = Math.min(...corners.map((c) => c.sx))
  const top = Math.min(...corners.map((c) => c.sy))
  const right = Math.max(...corners.map((c) => c.sx))
  const bottom = Math.max(...corners.map((c) => c.sy))
  return { left, top, width: right - left, height: bottom - top }
}




export interface View {
  ox: number
  oy: number
  scale: number
}

export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f))
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f))
  const b = Math.min(255, Math.round((n & 255) * f))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** Draw an isometric box: soft shadow, two shaded faces, lit top. */
export function isoBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number, color: string, view: View, opts?: { outline?: string; alpha?: number; roof?: string }): void {
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

export function quad(ctx: CanvasRenderingContext2D, pts: { sx: number; sy: number }[], color: string, alpha = 1): void {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  pts.forEach((p, i) => (i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy)))
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
