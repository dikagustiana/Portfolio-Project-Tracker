// Camera math for the 3D scene (Brief 3 §3.1): orthographic, 35° elevation, 45° azimuth with
// 90° rotation steps. One module owns the transform so the render rig, the projected DOM labels
// and drag-to-pan can never drift apart.

import type { Camera, OrthographicCamera } from 'three'

export interface CameraState {
  zoom: number
  /** 90° steps from the base azimuth. */
  rot: number
  panX: number
  panZ: number
}

export const CAMERA_DEFAULT: CameraState = { zoom: 1, rot: 0, panX: 0, panZ: 1.4 }

export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 3.5
const PAN_LIMIT = 26

const AZ0 = Math.PI / 4
const EL = (35 * Math.PI) / 180
const RADIUS = 52
/** World units the canvas spans at zoom 1: 30 tall, but never fewer than 26 across, so a
 *  portrait phone still frames the main warehouse and its docks. */
const VIEW_HEIGHT = 30
const VIEW_WIDTH_MIN = 26

type Vec3 = [number, number, number]

function azimuth(cam: CameraState): number {
  return AZ0 + (cam.rot * Math.PI) / 2
}

export function pxPerUnit(cam: CameraState, width: number, height: number): number {
  return cam.zoom * Math.min(height / VIEW_HEIGHT, width / VIEW_WIDTH_MIN)
}

/** Camera position and look-at target for a state. */
export function cameraPose(cam: CameraState): { position: Vec3; target: Vec3 } {
  const az = azimuth(cam)
  return {
    position: [cam.panX + RADIUS * Math.cos(EL) * Math.sin(az), RADIUS * Math.sin(EL), cam.panZ + RADIUS * Math.cos(EL) * Math.cos(az)],
    target: [cam.panX, 0, cam.panZ],
  }
}

/** Screen-space basis: `right` and `up` unit vectors of the camera (three's lookAt convention). */
function basis(cam: CameraState): { right: Vec3; up: Vec3 } {
  const az = azimuth(cam)
  return {
    right: [Math.cos(az), 0, -Math.sin(az)],
    up: [-Math.sin(EL) * Math.sin(az), Math.cos(EL), -Math.sin(EL) * Math.cos(az)],
  }
}

/** Applies a state to the canvas's orthographic camera (R3F keeps its frustum in pixels, so
 *  zoom is pixels per world unit). */
export function applyCamera(camera: Camera, cam: CameraState, width: number, height: number): void {
  const { position, target } = cameraPose(cam)
  camera.position.set(...position)
  camera.lookAt(...target)
  if (isOrtho(camera)) {
    camera.zoom = pxPerUnit(cam, width, height)
    camera.updateProjectionMatrix()
  }
}

function isOrtho(camera: Camera): camera is OrthographicCamera {
  return (camera as Partial<OrthographicCamera>).isOrthographicCamera === true
}

/** World → screen (CSS px within the canvas), matching applyCamera exactly. */
export function makeProjector(cam: CameraState, width: number, height: number): (at: Vec3) => { left: number; top: number } {
  const ppu = pxPerUnit(cam, width, height)
  const { right, up } = basis(cam)
  return ([x, y, z]) => {
    const rx = x - cam.panX
    const rz = z - cam.panZ
    return {
      left: width / 2 + (rx * right[0] + y * right[1] + rz * right[2]) * ppu,
      top: height / 2 - (rx * up[0] + y * up[1] + rz * up[2]) * ppu,
    }
  }
}

/** Drag-to-pan from a start state: the ground point under the cursor stays under it. A screen
 *  move of `dy` px covers dy / (ppu · sin 35°) on the ground, so vertical drags are scaled. */
export function panByPixels(start: CameraState, dx: number, dy: number, width: number, height: number): CameraState {
  const az = azimuth(start)
  const ppu = pxPerUnit(start, width, height)
  const across = dx / ppu
  const along = dy / (ppu * Math.sin(EL))
  return {
    ...start,
    panX: clamp(start.panX - across * Math.cos(az) - along * Math.sin(az), -PAN_LIMIT, PAN_LIMIT),
    panZ: clamp(start.panZ + across * Math.sin(az) - along * Math.cos(az), -PAN_LIMIT, PAN_LIMIT),
  }
}

export function zoomBy(cam: CameraState, factor: number): CameraState {
  return { ...cam, zoom: clamp(cam.zoom * factor, ZOOM_MIN, ZOOM_MAX) }
}

export function rotateStep(cam: CameraState): CameraState {
  return { ...cam, rot: (cam.rot + 1) % 4 }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
