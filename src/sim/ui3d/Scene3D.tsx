// The 3D scene (Brief 3 §3, §5.1): full-bleed R3F canvas behind the overlay cards, world 2
// layout for the V1 style frame — main warehouse centre, inbound left (container, dock,
// 15.00 clock post), B2B dock front, courier bay right, office annex back, roads to the
// "Toko" and "Konsumen" signposts. The parent owns the camera state (camera3d.ts) so the
// overlay's map buttons and the projected labels share one transform.

import { Canvas, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { LIGHT, DARK } from './theme3d.ts'
import type { Palette3D } from './theme3d.ts'
import { applyCamera, panByPixels } from './camera3d.ts'
import type { CameraState } from './camera3d.ts'
import { Plate, Warehouse, OfficeAnnex, BoxTruck, Van, Forklift, PalletStack, Container, Tree, Planter, DashedLine, BulkRack, PickFaceShelf, PackingStation, ClockPost, Signpost } from './pieces.tsx'

/** Applies the camera state to the canvas camera on every state/size change. */
function CameraRig({ cam }: { cam: CameraState }) {
  const get = useThree((s) => s.get)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  useLayoutEffect(() => {
    const { camera, invalidate } = get()
    applyCamera(camera, cam, width, height)
    invalidate()
  }, [get, cam, width, height])
  return null
}

/** The world-2 scene graph (§5.1). */
function Scene({ palette, interior }: { palette: Palette3D; interior: boolean }) {
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

      {/* Main warehouse (centre); "Lihat dalam gudang" swaps it for the cutaway (§3.4). */}
      <Warehouse palette={palette} position={[0, 1.7, 0]} size={[11, 3.4, 7.5]} cutaway={interior} />
      {interior && (
        <group>
          <BulkRack palette={palette} position={[-2.2, 0, -1.6]} length={6} />
          <BulkRack palette={palette} position={[-2.2, 0, -2.9]} length={6} />
          <PickFaceShelf palette={palette} position={[-2.2, 0, 0.1]} length={5.8} />
          <PickFaceShelf palette={palette} position={[-2.2, 0, 1]} length={5.8} />
          <Plate position={[3.4, 0.02, -0.4]} size={[3.4, 2.6]} color={palette.isdFloor} />
          {[0, 1, 2].map((i) => (
            <PackingStation key={i} palette={palette} position={[2.4 + i * 1.05, 0, 1.9]} />
          ))}
          <Plate position={[4.4, 0.02, -2.6]} size={[1.4, 1.2]} color={palette.road} />
          {(['K1', 'K2', 'K3'] as const).map((c, i) => (
            <Plate key={c} position={[4, 0.025, -1.2 + i * 0.55]} size={[2.4, 0.4]} color={palette.marking} />
          ))}
        </group>
      )}

      {/* Pallet stacks at the dock (§3.5). */}
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
      <Van palette={palette} position={[13.2, 0, 6.2]} rotation={[0, -Math.PI / 2 + 0.15, 0]} color={palette.door} />
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

/** Full-bleed scene canvas with drag-to-pan. Renders `view`; drags edit the user camera `cam`
 *  (the view is `cam` shifted onto the free area). Pointer capture keeps the drag alive when
 *  the cursor crosses an overlay card; the ground point under the cursor stays under it. */
export function Scene3D({ dark, view, cam, setCam, interior }: { dark: boolean; view: CameraState; cam: CameraState; setCam: (c: CameraState) => void; interior: boolean }) {
  const palette = dark ? DARK : LIGHT
  const drag = useRef<{ id: number; x: number; y: number; start: CameraState } | null>(null)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: cam }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    setCam(panByPixels(d.start, e.clientX - d.x, e.clientY - d.y, e.currentTarget.clientWidth, e.currentTarget.clientHeight))
  }
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null
  }

  return (
    <div className="s3-scene" style={{ background: palette.page }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <Canvas shadows="percentage" dpr={[1, 2]} frameloop="demand" orthographic camera={{ near: 0.1, far: 400 }} gl={{ antialias: true, alpha: true }} aria-hidden>
        <CameraRig cam={view} />
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
          shadow-radius={3}
        />
        <fog attach="fog" args={[palette.fog, 60, 170]} />
        <Scene palette={palette} interior={interior} />
      </Canvas>
      {/* Soft vignette so the ground fades into the page (no hard horizon, §3.2). */}
      <div aria-hidden className="s3-vignette" style={{ background: `radial-gradient(ellipse at 50% 42%, transparent 55%, ${palette.page} 100%)` }} />
    </div>
  )
}
