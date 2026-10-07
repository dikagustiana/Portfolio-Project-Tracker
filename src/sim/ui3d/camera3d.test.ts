// The DOM label projector and drag-to-pan must agree with the real three.js camera, otherwise
// pins drift off their objects and the ground slides under the cursor.
import { OrthographicCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { applyCamera, CAMERA_DEFAULT, makeProjector, panByPixels, rotateStep, zoomBy, ZOOM_MAX, ZOOM_MIN } from './camera3d.ts'
import type { CameraState } from './camera3d.ts'

// Desktop (height-limited) and portrait phone (width-limited) canvases.
const SIZES: [number, number][] = [
  [1366, 768],
  [366, 820],
]

function threeProject(cam: CameraState, at: [number, number, number], W: number, H: number): { left: number; top: number } {
  const camera = new OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 400)
  applyCamera(camera, cam, W, H)
  camera.updateMatrixWorld()
  const v = new Vector3(...at).project(camera)
  return { left: ((v.x + 1) / 2) * W, top: ((1 - v.y) / 2) * H }
}

const STATES: CameraState[] = [
  CAMERA_DEFAULT,
  { zoom: 2.2, rot: 1, panX: -4, panZ: 6 },
  { zoom: 0.6, rot: 2, panX: 10, panZ: -3 },
  { zoom: 1.4, rot: 3, panX: 3.5, panZ: 12 },
]
const POINTS: [number, number, number][] = [
  [0, 4.6, 0],
  [-11.2, 2.4, -1.4],
  [17.6, 1.75, 11.4],
  [0, 0, 0],
]

describe('camera3d', () => {
  it('projects world points exactly where three.js renders them', () => {
    for (const [W, H] of SIZES) {
      for (const cam of STATES) {
        const project = makeProjector(cam, W, H)
        for (const p of POINTS) {
          const a = project(p)
          const b = threeProject(cam, p, W, H)
          expect(a.left).toBeCloseTo(b.left, 6)
          expect(a.top).toBeCloseTo(b.top, 6)
        }
      }
    }
  })

  it('keeps the ground point under the cursor while dragging', () => {
    for (const [W, H] of SIZES) {
      for (const start of STATES) {
        const ground: [number, number, number] = [start.panX + 2, 0, start.panZ - 1]
        const before = makeProjector(start, W, H)(ground)
        const after = makeProjector(panByPixels(start, 37, -21, W, H), W, H)(ground)
        expect(after.left - before.left).toBeCloseTo(37, 6)
        expect(after.top - before.top).toBeCloseTo(-21, 6)
      }
    }
  })

  it('clamps zoom and pan, and rotates in four steps', () => {
    expect(zoomBy({ ...CAMERA_DEFAULT, zoom: 3 }, 2).zoom).toBe(ZOOM_MAX)
    expect(zoomBy({ ...CAMERA_DEFAULT, zoom: 0.6 }, 0.5).zoom).toBe(ZOOM_MIN)
    const far = panByPixels(CAMERA_DEFAULT, 1e6, 1e6, 1366, 768)
    expect(Math.abs(far.panX)).toBeLessThanOrEqual(26)
    expect(Math.abs(far.panZ)).toBeLessThanOrEqual(26)
    let c = CAMERA_DEFAULT
    for (let i = 0; i < 4; i++) c = rotateStep(c)
    expect(c.rot).toBe(0)
  })
})
