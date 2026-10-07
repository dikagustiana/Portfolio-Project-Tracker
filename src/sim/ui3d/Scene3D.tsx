// The 3D scene (Brief 3 §3, §5.1): full-bleed R3F canvas behind the overlay cards, world 2 —
// main warehouse centre, B2B dock doors on its south face, inbound unloading beside its west
// wall (container, 15.00 clock post), courier bay on the right road, office annexes behind.
// Roads leave the map east toward "Toko" (B2B trucks), south toward "Konsumen" (couriers) and
// north (inbound trucks). Vehicles come from motion2.ts; buildings, vehicles and the interior
// are clickable. The parent owns the camera state (camera3d.ts) so the overlay's map buttons
// and the projected labels share one transform.

import { Canvas, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useRef, useState } from 'react'
import { LIGHT, DARK } from './theme3d.ts'
import type { Palette3D } from './theme3d.ts'
import { applyCamera, panByPixels } from './camera3d.ts'
import type { CameraState } from './camera3d.ts'
import { OBJECT_SPOTS } from './anchors2.ts'
import { DOCK_SLOTS_X, BAY_X, BAY_SLOTS_Z, INBOUND_STOP } from './motion2.ts'
import type { VehicleView } from './motion2.ts'
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

type Pick = (id: string) => void

/** Click target: a real click (not the end of a drag) selects `id`. */
function Hit({ id, onPick, onHover, children }: { id: string; onPick: Pick; onHover: (on: boolean) => void; children: React.ReactNode }) {
  return (
    <group
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        if (e.delta <= 4) onPick(id)
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        onHover(true)
      }}
      onPointerOut={() => onHover(false)}
    >
      {children}
    </group>
  )
}

/** Flat ring marking the selected object or vehicle. */
function Ring({ x, z, r, color }: { x: number; z: number; r: number; color: string }) {
  return (
    <mesh position={[x, 0.04, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r, r + 0.14, 56]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} />
    </mesh>
  )
}

function VehicleModel({ v, palette }: { v: VehicleView; palette: Palette3D }) {
  if (v.kind === 'van') return <Van palette={palette} />
  if (v.kind === 'forklift') return <Forklift palette={palette} />
  return <BoxTruck palette={palette} cab={v.kind === 'inbound' ? palette.container : undefined} />
}

const RING_R: Record<VehicleView['kind'], number> = { truck: 1.9, inbound: 1.9, van: 1.4, forklift: 1.1 }

/** The world-2 scene graph (§5.1). */
function Scene({ palette, interior, vehicles, selected, onPick, onHover }: { palette: Palette3D; interior: boolean; vehicles: VehicleView[]; selected: string | null; onPick: Pick; onHover: (on: boolean) => void }) {
  const selVehicle = selected ? vehicles.find((v) => v.id === selected) : undefined
  const selSpot = selected ? OBJECT_SPOTS[selected] : undefined
  const hit = (id: string, children: React.ReactNode) => (
    <Hit id={id} onPick={onPick} onHover={onHover}>
      {children}
    </Hit>
  )
  return (
    <group>
      {/* Ground and roads (§3.2); the three exits run off the map into the fog. */}
      <Plate position={[0, 0, 0]} size={[130, 130]} color={palette.ground} />
      <Plate position={[0, 0.01, 7.4]} size={[88, 4.6]} color={palette.road} />
      <Plate position={[0, 0.01, -6.6]} size={[52, 3.6]} color={palette.road} />
      <Plate position={[-13.5, 0.01, -15]} size={[4.2, 58]} color={palette.road} />
      <Plate position={[14.5, 0.011, 0]} size={[4, 88]} color={palette.road} />
      <Plate position={[0, 0.01, 12.8]} size={[36, 3.4]} color={palette.road} />
      <DashedLine from={[-44, 7.4]} to={[44, 7.4]} color={palette.marking} />
      <DashedLine from={[-24, -6.6]} to={[24, -6.6]} color={palette.marking} />
      <DashedLine from={[-13.5, -44]} to={[-13.5, 12]} color={palette.marking} />
      <DashedLine from={[15.6, -44]} to={[15.6, 44]} color={palette.marking} />

      {/* B2B dock: one bay per door, pallets staged between them (§3.2). */}
      {DOCK_SLOTS_X.map((x) => (
        <group key={x}>
          <DashedLine from={[x - 0.95, 3.9]} to={[x - 0.95, 7.6]} color={palette.pin} width={0.07} dash={0.4} gap={0.3} />
          <DashedLine from={[x + 0.95, 3.9]} to={[x + 0.95, 7.6]} color={palette.pin} width={0.07} dash={0.4} gap={0.3} />
        </group>
      ))}
      {hit(
        'B2B',
        <>
          <PalletStack palette={palette} position={[-4.75, 0, 4.25]} cartons={3} />
          <PalletStack palette={palette} position={[-2.2, 0, 4.25]} cartons={4} />
          <PalletStack palette={palette} position={[0.44, 0, 4.25]} cartons={2} />
          <PalletStack palette={palette} position={[3.4, 0, 4.25]} cartons={4} />
          <PalletStack palette={palette} position={[4.55, 0, 4.25]} cartons={4} />
        </>,
      )}

      {/* Main warehouse (centre); "Lihat dalam gudang" swaps it for the cutaway (§3.4). */}
      {hit('BULK-1', <Warehouse palette={palette} position={[0, 1.7, 0]} size={[11, 3.4, 7.5]} cutaway={interior} />)}
      {interior && (
        <group>
          {hit('BULK-1', <BulkRack palette={palette} position={[-2.2, 0, -1.6]} length={6} />)}
          {hit('BULK-2', <BulkRack palette={palette} position={[-2.2, 0, -2.9]} length={6} />)}
          {hit('PICK-1', <PickFaceShelf palette={palette} position={[-2.2, 0, 0.1]} length={5.8} />)}
          {hit('PICK-2', <PickFaceShelf palette={palette} position={[-2.2, 0, 1]} length={5.8} />)}
          {hit('ISD', <Plate position={[3.4, 0.02, -0.4]} size={[3.4, 2.6]} color={palette.isdFloor} />)}
          {hit(
            'PACK',
            <>
              {[0, 1, 2].map((i) => (
                <PackingStation key={i} palette={palette} position={[2.4 + i * 1.05, 0, 1.9]} />
              ))}
            </>,
          )}
          {hit('DISP', <Plate position={[4.4, 0.02, -2.6]} size={[1.4, 1.2]} color={palette.road} />)}
          {(['K1', 'K2', 'K3'] as const).map((c, i) => (
            <group key={c}>{hit(`CL-${c}`, <Plate position={[4, 0.025, -1.2 + i * 0.55]} size={[2.4, 0.4]} color={palette.marking} />)}</group>
          ))}
        </group>
      )}

      {/* Inbound (left): container, unloading pad, the 15.00 cut-off clock (§5.1). */}
      {hit(
        'DOCK2',
        <>
          <Container palette={palette} position={[-11.2, 0.76, -1.4]} rotation={[0, Math.PI / 2, 0]} />
          <Plate position={[INBOUND_STOP[0], 0.015, INBOUND_STOP[1]]} size={[2.4, 4.4]} color={palette.road} />
          <ClockPost palette={palette} position={[-10.6, 0, 4.4]} />
        </>,
      )}

      {/* Courier bay (right road, west lane): one slot per courier. */}
      {hit(
        'BAY',
        <>
          <DashedLine from={[BAY_X - 0.85, -1.6]} to={[BAY_X - 0.85, 4.8]} color={palette.pin} width={0.07} dash={0.4} gap={0.3} />
          {Object.values(BAY_SLOTS_Z).map((z) => (
            <DashedLine key={z} from={[BAY_X - 0.85, z + 1.0]} to={[BAY_X + 0.85, z + 1.0]} color={palette.marking} width={0.06} dash={0.3} gap={0.25} />
          ))}
        </>,
      )}

      {/* Office annexes (back): order desk east, returns/CS west; planters. */}
      {hit('OMS', <OfficeAnnex palette={palette} position={[5.4, 0.95, -4.6]} />)}
      {hit('RET', <OfficeAnnex palette={palette} position={[-6.4, 0.95, -4.6]} size={[2.6, 1.7, 2.2]} />)}
      <Planter palette={palette} position={[2.9, 0, -4.4]} />
      <Planter palette={palette} position={[-2.4, 0, -4.4]} />
      <Planter palette={palette} position={[9.4, 0, 3.1]} />

      {/* Signposts where the roads leave the map (§5.1). */}
      {hit('B2B', <Signpost palette={palette} position={[26, 0, 10.6]} rotation={[0, -0.4, 0]} />)}
      {hit('BAY', <Signpost palette={palette} position={[16.9, 0, 15.5]} />)}

      {/* Trees and greenery (§3.2), clear of every road. */}
      <Tree palette={palette} position={[-19.5, 0, 3]} scale={1.15} />
      <Tree palette={palette} position={[-18.2, 0, 0.4]} scale={0.9} />
      <Tree palette={palette} position={[18.6, 0, -2.4]} scale={1.05} />
      <Tree palette={palette} position={[19.6, 0, 0.4]} scale={0.8} />
      <Tree palette={palette} position={[7.9, 0, -10.2]} scale={1.1} />
      <Tree palette={palette} position={[-9.4, 0, -10.6]} scale={0.95} />
      <Tree palette={palette} position={[22, 0, 3]} scale={1} />
      <Tree palette={palette} position={[-21, 0, -3]} scale={1.05} />
      <Tree palette={palette} position={[-20, 0, 16]} scale={0.9} />

      {/* Vehicles from the engine's day (motion2.ts). */}
      {vehicles.map((v) => (
        <group key={v.id} position={[v.x, 0, v.z]} rotation={[0, v.heading, 0]}>
          {hit(v.id, <VehicleModel v={v} palette={palette} />)}
        </group>
      ))}

      {selVehicle && <Ring x={selVehicle.x} z={selVehicle.z} r={RING_R[selVehicle.kind]} color={palette.pin} />}
      {!selVehicle && selSpot && <Ring x={selSpot.x} z={selSpot.z} r={selSpot.r} color={palette.pin} />}
    </group>
  )
}

export interface Scene3DProps {
  dark: boolean
  /** Rendered camera (the user camera shifted onto the free area). */
  view: CameraState
  /** User camera; drags edit it. */
  cam: CameraState
  setCam: (c: CameraState) => void
  interior: boolean
  vehicles: VehicleView[]
  selected: string | null
  onPick: Pick
  /** A drag began (stops "Ikuti"). */
  onDragStart: () => void
}

/** Full-bleed scene canvas with drag-to-pan. The pointer is captured only once a drag moves
 *  4 px, so plain clicks still reach the 3D objects; then the ground point under the cursor
 *  stays under it, also across overlay cards. */
export function Scene3D({ dark, view, cam, setCam, interior, vehicles, selected, onPick, onDragStart }: Scene3DProps) {
  const palette = dark ? DARK : LIGHT
  const drag = useRef<{ id: number; x: number; y: number; start: CameraState; moved: boolean } | null>(null)
  const [hover, setHover] = useState(false)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: cam, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 4) return
      d.moved = true
      e.currentTarget.setPointerCapture(e.pointerId)
      onDragStart()
    }
    setCam(panByPixels(d.start, dx, dy, e.currentTarget.clientWidth, e.currentTarget.clientHeight))
  }
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null
  }

  return (
    <div className="s3-scene" style={{ background: palette.page, cursor: hover ? 'pointer' : undefined }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
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
        <Scene palette={palette} interior={interior} vehicles={vehicles} selected={selected} onPick={onPick} onHover={setHover} />
      </Canvas>
      {/* Soft vignette so the ground fades into the page (no hard horizon, §3.2). */}
      <div aria-hidden className="s3-vignette" style={{ background: `radial-gradient(ellipse at 50% 42%, transparent 55%, ${palette.page} 100%)` }} />
    </div>
  )
}
