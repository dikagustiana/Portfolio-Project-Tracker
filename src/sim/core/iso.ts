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


