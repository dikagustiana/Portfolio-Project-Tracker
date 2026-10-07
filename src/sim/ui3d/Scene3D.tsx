// The 3D scene (Brief 3 §3, §5.1): full-bleed R3F canvas behind the overlay cards, world 2
// layout for the V1 style frame — main warehouse centre, inbound left (container, dock,
// 15.00 clock post), B2B dock front, courier bay right, office annex back, roads to the
// "Toko" and "Konsumen" signposts. Camera: orthographic, ~35° elevation / 45° azimuth; the
// parent owns the camera state so the overlay's map buttons drive it.

import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { LIGHT, DARK } from './theme3d.ts'
import type { Palette3D } from './theme3d.ts'
import { Plate, Warehouse, OfficeAnnex, BoxTruck, Van, Forklift, PalletStack, Container, Tree, Planter, DashedLine, BulkRack, PickFaceShelf, PackingStation, ClockPost, Signpost } from './pieces.tsx'

export interface CameraState {
  zoom: number
  /** 90° steps from the base azimuth. */
  rot: number
  panX: number
  panZ: number
}

export const CAMERA_DEFAULT: CameraState = { zoom: 1, rot: 0, panX: 0, panZ: 1.4 }

const AZ0 = Math.PI / 4
const EL = (35 * Math.PI) / 180
const RADIUS = 52

/** Drives the canvas's own orthographic camera: R3F keeps left/right/top/bottom in sync with
 *  the pixel size, so the rig expresses zoom as pixels-per-unit and repositions on every
 *  state/size change (brief 3 §3.1: 35° elevation, 45° azimuth). */
function CameraRig({ state, width, height }: { state: CameraState; width: number; height: number }) {
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const az = AZ0 + (state.rot * Math.PI) / 2
    const viewSize = 15 / state.zoom // world units the full canvas height spans
    const pxPerUnit = height / (viewSize * 2)
    const oc = camera as unknown as THREE.OrthographicCamera
    oc.zoom = pxPerUnit
    oc.position.set(state.panX + RADIUS * Math.cos(EL) * Math.sin(az), RADIUS * Math.sin(EL), state.panZ + RADIUS * Math.cos(EL) * Math.cos(az))
    oc.lookAt(state.panX, 0, state.panZ)
    oc.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate, state, width, height])
  return null
}

/** The world-2 scene graph (§5.1). */
function Scene({ palette, interior, roofOpacity }: { palette: Palette3D; interior: boolean; roofOpacity: number }) {
  return (
    <group>
      {/* Ground and roads (§3.2). */}
      <Plate position={[0, 0, 0]} size={[130, 130]} color={palette.ground} />
      <Plate position={[0, 0.01, 7.4]} size={[64, 4.6]} color={palette.road} />
      <Plate position={[0, 0.01, -6.6]} size={[52, 3.6]} color={palette.road} />
      <Plate position={[-13.5, 0.01, 0.5]} size={[4.2, 26]} color={palette.road} />
      <Plate position={[14.5, 0.01, 2]} size={[4, 24]} color={palette.road} />
      <Plate position={[0, 0.01, 12.8]} size={[36, 3.4]} color={palette.road} />
      {/* Lane markings. */}
      <DashedLine from={[-30, 7.4]} to={[30, 7.4]} color={palette.marking} />
      <DashedLine from={[-24, -6.6]} to={[24, -6.6]} color={palette.marking} />
      <DashedLine from={[-13.5, -10]} to={[-13.5, 12]} color={palette.marking} />
      <DashedLine from={[14.5, -9]} to={[14.5, 13]} color={palette.marking} />
      {/* Dock bays and pallet zones, dashed (§3.2). */}
      <DashedLine from={[-4.6, 3.6]} to={[-1.4, 3.6]} color={palette.pin} width={0.07} dash={0.4} gap={0.3} />
      <DashedLine from={[1, 3.6]} to={[4.2, 3.6]} color={palette.pin} width={0.07} dash={0.4} gap={0.3} />
      <DashedLine from={[-3.4, 4.4]} to={[3.4, 4.4]} color={palette.marking} width={0.06} dash={0.35} gap={0.35} />
      <Plate position={[7.6, 0.015, 4.1]} size={[3.4, 2.2]} color={palette.road} />
      <DashedLine from={[6.2, 3.3]} to={[9, 3.3]} color={palette.marking} width={0.06} dash={0.3} gap={0.3} />

      {/* Main warehouse (centre) with the fadeable roof and the interior (§3.4). */}
      <Warehouse palette={palette} position={[0, 1.7, 0]} size={[11, 3.4, 7.5]} roofOpacity={roofOpacity} />
      <group visible={interior}>
        <BulkRack palette={palette} position={[-2.4, 0, -1.6]} length={6.4} />
        <BulkRack palette={palette} position={[-2.4, 0, -3.1]} length={6.4} />
        <PickFaceShelf palette={palette} position={[-2.2, 0, 0.1]} length={5.8} />
        <PickFaceShelf palette={palette} position={[-2.2, 0, 1]} length={5.8} />
        <Plate position={[3.4, 0.02, -0.4]} size={[3.4, 2.6]} color={palette.isdFloor} />
        {[0, 1, 2].map((i) => (
          <PackingStation key={i} palette={palette} position={[3.1 + i * 1.05, 0, 1.7]} />
        ))}
        <Plate position={[4.4, 0.02, -2.6]} size={[1.4, 1.2]} color={palette.road} />
        {(['K1', 'K2', 'K3'] as const).map((c, i) => (
          <Plate key={c} position={[4.4, 0.015, -1.2 + i * 0.55]} size={[2.6, 0.4]} color={palette.road} />
        ))}
      </group>

      {/* Pallet stacks at the dock and inside (§3.5). */}
      <PalletStack palette={palette} position={[-3.9, 0, 4.35]} cartons={4} />
      <PalletStack palette={palette} position={[-2.6, 0, 4.35]} cartons={3} />
      <PalletStack palette={palette} position={[2.4, 0, 4.35]} cartons={4} />
      <PalletStack palette={palette} position={[3.7, 0, 4.35]} cartons={2} />
      <PalletStack palette={palette} position={[-0.4, 0, 4.35]} cartons={4} />

      {/* Inbound side (left): container, dock bay, a waiting truck, the 15.00 clock post (§5.1). */}
      <Container palette={palette} position={[-11.2, 0.76, -1.4]} rotation={[0, Math.PI / 2, 0]} />
      <Plate position={[-11.2, 0.015, 1.6]} size={[3.4, 2.4]} color={palette.road} />
      <DashedLine from={[-12.4, 1]} to={[-10, 1]} color={palette.marking} width={0.06} dash={0.3} gap={0.3} />
      <BoxTruck palette={palette} position={[-12.6, 0, 3.4]} rotation={[0, Math.PI / 2 + 0.25, 0]} />
      <ClockPost palette={palette} position={[-9.6, 0, 3.1]} />
      <Forklift palette={palette} position={[-8.6, 0, 0.4]} rotation={[0, -0.7, 0]} />
      <BoxTruck palette={palette} position={[-13.4, 0, -3.6]} rotation={[0, Math.PI / 2 + 0.4, 0]} />

      {/* B2B dock (front): trucks parked at the doors + forklift (§5.1). */}
      <BoxTruck palette={palette} position={[-1.8, 0, 6.6]} rotation={[0, Math.PI, 0]} />
      <BoxTruck palette={palette} position={[2.6, 0, 6.6]} rotation={[0, Math.PI + 0.12, 0]} />
      <Forklift palette={palette} position={[0.6, 0, 5]} rotation={[0, 0.5, 0]} />

      {/* Courier bay (right): vans at pickup (§5.1). */}
      <Van palette={palette} position={[13.2, 0, 4.4]} rotation={[0, -Math.PI / 2, 0]} />
      <Van palette={palette} position={[13.2, 0, 6.2]} rotation={[0, -Math.PI / 2 + 0.15, 0]} color="#e8edf9" />
      <Plate position={[15.6, 0.015, 5.2]} size={[2.6, 3]} color={palette.road} />
      <DashedLine from={[15.6, 3.9]} to={[15.6, 6.5]} color={palette.marking} width={0.06} dash={0.3} gap={0.3} />

      {/* Office annexes (back) + planters. */}
      <OfficeAnnex palette={palette} position={[5.4, 0.95, -4.6]} />
      <OfficeAnnex palette={palette} position={[-6.4, 0.95, -4.6]} size={[2.6, 1.7, 2.2]} />
      <Planter palette={palette} position={[2.9, 0, -4.4]} />
      <Planter palette={palette} position={[-2.4, 0, -4.4]} />

      {/* Signposts: roads leave the map toward Toko and Konsumen (§5.1). */}
      <Signpost palette={palette} position={[17.6, 0, 11.4]} rotation={[0, -0.4, 0]} />
      <Signpost palette={palette} position={[2.2, 0, 16.4]} />

      {/* Trees and greenery (§3.2). */}
      <Tree palette={palette} position={[-17.5, 0, 6.5]} scale={1.15} />
      <Tree palette={palette} position={[-16.6, 0, 9.2]} scale={0.9} />
      <Tree palette={palette} position={[18.6, 0, -2.4]} scale={1.05} />
      <Tree palette={palette} position={[19.6, 0, 0.4]} scale={0.8} />
      <Tree palette={palette} position={[7.9, 0, -8.2]} scale={1.1} />
      <Tree palette={palette} position={[-9.4, 0, -8.6]} scale={0.95} />
      <Planter palette={palette} position={[9.4, 0, 3.1]} />

    </group>
  )
}

/** Full-bleed scene canvas. The parent owns camera/interior state (driven by the overlay). */
export function Scene3D({ dark = false, cam, setCam, interior, size }: { dark?: boolean; cam: CameraState; setCam: (f: (c: CameraState) => CameraState) => void; interior: boolean; size: { w: number; h: number } }) {
  const palette = dark ? DARK : LIGHT
  const drag = useRef<{ x: number; y: number; panX: number; panZ: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, panX: cam.panX, panZ: cam.panZ }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const k = (15 / cam.zoom / size.h) * 2.1
    const dx = (e.clientX - d.x) * k
    const dy = (e.clientY - d.y) * k
    const az = AZ0 + (cam.rot * Math.PI) / 2
    const rx = Math.cos(az)
    const rz = -Math.sin(az)
    const fx = Math.sin(az)
    const fz = Math.cos(az)
    setCam((c) => ({
      ...c,
      panX: clamp(d.panX - dx * rx - dy * fx, -26, 26),
      panZ: clamp(d.panZ - dx * rz - dy * fz, -26, 26),
    }))
  }
  const endDrag = () => (drag.current = null)

  return (
    <div style={{ position: 'absolute', inset: 0, background: palette.page, cursor: 'grab', touchAction: 'none' }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerLeave={endDrag}>
      <Canvas shadows="soft" dpr={[1, 2]} frameloop="demand" orthographic camera={{ near: 0.1, far: 400, position: [30.1, 29.8, 32.9] }} gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}>
        <CameraRig state={cam} width={size.w} height={size.h} />
        <hemisphereLight args={[palette.hemiSky, palette.hemiGround, 1.1]} />
        <directionalLight
          position={[24, 34, 12]}
          intensity={2.1}
          color={palette.sun}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
          shadow-camera-far={120}
          shadow-bias={-0.0004}
        />
        <fog attach="fog" args={[palette.fog, 60, 170]} />
        <Scene palette={palette} interior={interior} roofOpacity={interior ? 0.12 : 1} />
      </Canvas>
      {/* Soft vignette so the ground fades into the page (no hard horizon, §3.2). */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse at 50% 42%, transparent 55%, ${palette.page} 100%)`,
        }}
      />
    </div>
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}



// --- Projected DOM labels (§3.7): drei <Html> is off the table (CSP/React 19.3), so the
// parent projects world anchors to screen space with the same camera math as the rig.

export interface LabelAnchor {
  id: string
  at: [number, number, number]
  text: string
  kind: 'pin' | 'sign' | 'clock'
}

/** World-2 label anchors for the V1 frame. */
export const LABELS2: LabelAnchor[] = [
  { id: 'pin-warehouse', at: [0, 4.6, 0], text: 'Gudang utama', kind: 'pin' },
  { id: 'pin-inbound', at: [-11.2, 2.4, -1.4], text: 'Inbound', kind: 'pin' },
  { id: 'pin-courier', at: [13.2, 2.2, 5.2], text: 'Bay kurir', kind: 'pin' },
  { id: 'pin-b2b', at: [0.6, 2, 5], text: 'Dock B2B', kind: 'pin' },
  { id: 'sign-toko', at: [17.6, 1.75, 11.4], text: 'Toko', kind: 'sign' },
  { id: 'sign-konsumen', at: [2.2, 1.7, 16.4], text: 'Konsumen', kind: 'sign' },
  { id: 'clock-cutoff', at: [-9.6, 1.95, 3.1], text: '15.00', kind: 'clock' },
]

export interface ProjectedLabel extends LabelAnchor {
  left: number
  top: number
}

/** Builds a world→screen projector matching CameraRig's transform. */
export function makeProjector(cam: CameraState, width: number, height: number): (at: [number, number, number]) => { left: number; top: number } {
  const az = AZ0 + (cam.rot * Math.PI) / 2
  const viewSize = 15 / cam.zoom
  const pxPerUnit = height / (viewSize * 2)
  const pos = new THREE.Vector3(cam.panX + RADIUS * Math.cos(EL) * Math.sin(az), RADIUS * Math.sin(EL), cam.panZ + RADIUS * Math.cos(EL) * Math.cos(az))
  const target = new THREE.Vector3(cam.panX, 0, cam.panZ)
  const dir = target.clone().sub(pos).normalize()
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()
  const up = new THREE.Vector3().crossVectors(right, dir).normalize()
  return (at) => {
    const rel = new THREE.Vector3(at[0] - cam.panX, at[1], at[2] - cam.panZ)
    return {
      left: width / 2 + rel.dot(right) * pxPerUnit,
      top: height / 2 - rel.dot(up) * pxPerUnit,
    }
  }
}
