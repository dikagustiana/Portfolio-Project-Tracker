// Procedural 3D pieces (Brief 3 §3.3–3.6, §2.3): everything built from rounded primitives
// with flat colours — no models, no textures, CSP-safe. Each piece accepts the palette so
// light/dark both work.

import { RoundedBox } from '@react-three/drei'
import { useMemo } from 'react'
import type { Palette3D } from './theme3d.ts'

interface BoxProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  size: [number, number, number]
  color: string
  radius?: number
}

/** A rounded box; the toy look comes from generous radii on big shapes. */
export function Box({ position = [0, 0, 0], rotation = [0, 0, 0], size, color, radius = 0.12 }: BoxProps) {
  return (
    <RoundedBox args={size} position={position} rotation={rotation} radius={Math.min(radius, Math.min(...size) / 2 - 0.001)} smoothness={3} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
    </RoundedBox>
  )
}

/** Flat non-shadow-casting plate (roads, markings, zones). */
export function Plate({ position = [0, 0, 0], size, color }: { position?: [number, number, number]; size: [number, number]; color: string }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  )
}

/** Ribbed warehouse roof: a row of rounded ribs. */
export function RibbedRoof({ position, size, color, ribColor, ribs = 9 }: { position: [number, number, number]; size: [number, number, number]; color: string; ribColor: string; ribs?: number }) {
  const [w, h, d] = size
  const ribW = w / ribs
  return (
    <group position={position}>
      <Box size={[w, h, d]} color={color} radius={0.1} />
      {Array.from({ length: ribs }, (_, i) => (
        <Box key={i} position={[-w / 2 + ribW * (i + 0.5), h / 2 + 0.04, 0]} size={[ribW * 0.55, 0.1, d * 0.96]} color={ribColor} radius={0.05} />
      ))}
    </group>
  )
}

/** Warehouse with a darker side wall, roll-up doors and a sign plate. `cutaway` ("Lihat dalam
 *  gudang") drops the roof and lowers the walls so the interior reads from the iso camera — the
 *  body is a closed box, so fading the roof alone would only reveal its own top face. */
export function Warehouse({ palette, position = [0, 0, 0], size = [11, 3.4, 7.5], cutaway = false }: { palette: Palette3D; position?: [number, number, number]; size?: [number, number, number]; cutaway?: boolean }) {
  const [w, h, d] = size
  const doors = [w * 0.18, w * 0.42, w * 0.66]
  if (cutaway) {
    const wallH = 0.55
    const t = 0.16
    const y = -h / 2 + wallH / 2
    return (
      <group position={position}>
        <Plate position={[0, -h / 2 + 0.012, 0]} size={[w, d]} color={palette.road} />
        <Box position={[0, y, -d / 2 + t / 2]} size={[w, wallH, t]} color={palette.warehouse} radius={0.05} />
        <Box position={[0, y, d / 2 - t / 2]} size={[w, wallH, t]} color={palette.warehouse} radius={0.05} />
        <Box position={[-w / 2 + t / 2, y, 0]} size={[t, wallH, d]} color={palette.warehouseSide} radius={0.05} />
        <Box position={[w / 2 - t / 2, y, 0]} size={[t, wallH, d]} color={palette.warehouse} radius={0.05} />
      </group>
    )
  }
  return (
    <group position={position}>
      {/* Body with a darker -x side wall. */}
      <Box size={[w, h, d]} color={palette.warehouse} radius={0.22} />
      <Box position={[-w / 2 + 0.06, 0, 0]} size={[0.14, h * 0.96, d * 0.98]} color={palette.warehouseSide} radius={0.05} />
      {/* Roll-up doors on the +z face, with horizontal slat lines. */}
      {doors.map((x, i) => (
        <group key={i} position={[x - w / 2, 0, d / 2 + 0.02]}>
          <Box size={[w * 0.16, h * 0.62, 0.12]} color={palette.door} radius={0.06} />
          {[0.25, 0.45, 0.65].map((f) => (
            <Box key={f} position={[0, -h * 0.31 + h * 0.62 * f, 0.07]} size={[w * 0.15, 0.05, 0.03]} color={palette.doorLine} radius={0.02} />
          ))}
        </group>
      ))}
      {/* Sign plate. */}
      <Box position={[0, h * 0.38, d / 2 + 0.06]} size={[w * 0.3, 0.5, 0.1]} color={palette.sign} radius={0.08} />
      <RibbedRoof position={[0, h / 2 + 0.12, 0]} size={[w + 0.3, 0.22, d + 0.3]} color={palette.warehouseRoof} ribColor={palette.warehouseRoofRib} />
    </group>
  )
}

/** Small office annex: white body, blue roof. */
export function OfficeAnnex({ palette, position, size = [3.2, 1.9, 2.4] }: { palette: Palette3D; position: [number, number, number]; size?: [number, number, number] }) {
  const [, h] = size
  return (
    <group position={position}>
      <Box size={size} color={palette.office} radius={0.2} />
      <RibbedRoof position={[0, h / 2 + 0.1, 0]} size={[size[0] + 0.2, 0.16, size[2] + 0.2]} color={palette.officeRoof} ribColor={palette.warehouseSide} ribs={5} />
      <Box position={[0, -h * 0.15, size[2] / 2 + 0.02]} size={[0.7, 0.9, 0.08]} color={palette.door} radius={0.05} />
    </group>
  )
}

function Wheels({ positions, palette, r = 0.22 }: { positions: [number, number, number][]; palette: Palette3D; r?: number }) {
  return (
    <>
      {positions.map((p, i) => (
        <mesh key={i} position={p} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[r, r, 0.16, 14]} />
          <meshStandardMaterial color={palette.wheel} roughness={0.9} />
        </mesh>
      ))}
    </>
  )
}

/** Box truck: white box, blue cab (teal for inbound suppliers), dark wheels (§3.5). Faces +x. */
export function BoxTruck({ palette, position = [0, 0, 0], rotation = [0, 0, 0], cab }: { palette: Palette3D; position?: [number, number, number]; rotation?: [number, number, number]; cab?: string }) {
  return (
    <group position={position} rotation={rotation}>
      <Box position={[-0.55, 0.85, 0]} size={[2.5, 1.5, 1.4]} color={palette.truckBox} radius={0.14} />
      <Box position={[1.05, 0.75, 0]} size={[1.1, 1.1, 1.35]} color={cab ?? palette.truckCab} radius={0.18} />
      <Box position={[1.32, 0.85, 0]} size={[0.6, 0.45, 1.2]} color={palette.glass} radius={0.1} />
      <Wheels palette={palette} positions={[[-1.2, 0.22, 0.72], [-1.2, 0.22, -0.72], [0.9, 0.22, 0.72], [0.9, 0.22, -0.72]]} />
    </group>
  )
}

/** Courier van: one rounded body with a windscreen. */
export function Van({ palette, position = [0, 0, 0], rotation = [0, 0, 0], color }: { palette: Palette3D; position?: [number, number, number]; rotation?: [number, number, number]; color?: string }) {
  return (
    <group position={position} rotation={rotation}>
      <Box position={[0, 0.62, 0]} size={[2.1, 1.05, 1.15]} color={color ?? palette.van} radius={0.2} />
      <Box position={[0.85, 0.85, 0]} size={[0.5, 0.5, 1.05]} color={palette.glass} radius={0.12} />
      <Wheels palette={palette} positions={[[-0.7, 0.2, 0.6], [-0.7, 0.2, -0.6], [0.7, 0.2, 0.6], [0.7, 0.2, -0.6]]} r={0.2} />
    </group>
  )
}

/** Yellow forklift with mast, forks and a seated operator (§3.5). */
export function Forklift({ palette, position = [0, 0, 0], rotation = [0, 0, 0] }: { palette: Palette3D; position?: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <Box position={[0.15, 0.4, 0]} size={[1.15, 0.6, 0.85]} color={palette.forklift} radius={0.16} />
      <Box position={[-0.55, 0.75, 0]} size={[0.14, 1.15, 0.7]} color={palette.forkliftDark} radius={0.05} />
      <Box position={[-0.9, 0.09, 0]} size={[0.55, 0.07, 0.55]} color={palette.forkliftDark} radius={0.03} />
      <Box position={[-0.9, 0.28, 0]} size={[0.5, 0.1, 0.5]} color={palette.carton} radius={0.05} />
      <Box position={[0.05, 0.85, -0.28]} size={[0.5, 0.42, 0.16]} color={palette.forkliftDark} radius={0.1} />
      {/* Seated operator. */}
      <mesh position={[0.1, 1.05, 0]} castShadow>
        <capsuleGeometry args={[0.13, 0.2, 4, 8]} />
        <meshStandardMaterial color="#4a5b86" roughness={0.9} />
      </mesh>
      <mesh position={[0.1, 1.32, 0]} castShadow>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshStandardMaterial color="#e9c9a8" roughness={0.9} />
      </mesh>
      {/* Overhead guard. */}
      <Box position={[-0.2, 1.42, 0]} size={[0.12, 0.75, 0.12]} color={palette.forkliftDark} radius={0.04} />
      <Box position={[0.45, 1.42, 0]} size={[0.12, 0.75, 0.12]} color={palette.forkliftDark} radius={0.04} />
      <Box position={[0.12, 1.8, 0]} size={[0.62, 0.08, 0.16]} color={palette.forkliftDark} radius={0.03} />
      <Wheels palette={palette} positions={[[-0.5, 0.18, 0.4], [-0.5, 0.18, -0.4], [0.5, 0.18, 0.42], [0.5, 0.18, -0.42]]} r={0.18} />
    </group>
  )
}

/** Wooden pallet with up to four kraft cartons (one layer, 2×2). */
export function PalletStack({ palette, position = [0, 0, 0], cartons = 4, cartonColor }: { palette: Palette3D; position?: [number, number, number]; cartons?: number; cartonColor?: string }) {
  const color = cartonColor ?? palette.carton
  const slots: [number, number][] = [
    [-0.19, -0.19],
    [0.19, -0.19],
    [-0.19, 0.19],
    [0.19, 0.19],
  ]
  return (
    <group position={position}>
      <Box size={[0.95, 0.11, 0.95]} color={palette.pallet} radius={0.03} />
      {slots.slice(0, cartons).map(([x, z], i) => (
        <Box key={i} position={[x, 0.25, z]} size={[0.34, 0.28, 0.34]} color={i % 3 === 2 ? palette.cartonAlt : color} radius={0.045} />
      ))}
    </group>
  )
}

/** Teal shipping container with end doors. */
export function Container({ palette, position = [0, 0, 0], rotation = [0, 0, 0] }: { palette: Palette3D; position?: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <Box size={[3.4, 1.5, 1.5]} color={palette.container} radius={0.1} />
      {[0.4, 0.9, 1.4, 1.9, 2.4, 2.9].map((x) => (
        <Box key={x} position={[x - 1.7, 0, 0.76]} size={[0.08, 1.36, 0.02]} color={palette.containerRib} radius={0.02} />
      ))}
    </group>
  )
}

/** Rounded low-poly tree. */
export function Tree({ palette, position, scale = 1 }: { palette: Palette3D; position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.13, 0.7, 8]} />
        <meshStandardMaterial color={palette.trunk} roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial color={palette.tree} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0.12, 1.55, 0.05]} castShadow>
        <icosahedronGeometry args={[0.34, 1]} />
        <meshStandardMaterial color={palette.treeDark} roughness={0.9} flatShading />
      </mesh>
    </group>
  )
}

/** Planter: low rounded box with two small shrubs. */
export function Planter({ palette, position }: { palette: Palette3D; position: [number, number, number] }) {
  return (
    <group position={position}>
      <Box size={[1.1, 0.32, 0.5]} color={palette.planter} radius={0.1} />
      <mesh position={[-0.25, 0.4, 0]} castShadow>
        <icosahedronGeometry args={[0.22, 1]} />
        <meshStandardMaterial color={palette.tree} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0.28, 0.36, 0]} castShadow>
        <icosahedronGeometry args={[0.17, 1]} />
        <meshStandardMaterial color={palette.treeDark} roughness={0.9} flatShading />
      </mesh>
    </group>
  )
}

/** Dashed line of small plates along a straight segment (bay markings, §3.2). */
export function DashedLine({ from, to, y = 0.02, color, width = 0.09, dash = 0.55, gap = 0.45 }: { from: [number, number]; to: [number, number]; y?: number; color: string; width?: number; dash?: number; gap?: number }) {
  const dashes = useMemo(() => {
    const [x1, z1] = from
    const [x2, z2] = to
    const len = Math.hypot(x2 - x1, z2 - z1)
    const n = Math.max(1, Math.floor(len / (dash + gap)))
    const out: { x: number; z: number; rot: number }[] = []
    for (let i = 0; i <= n; i++) {
      const f = (i * (dash + gap)) / len
      out.push({ x: x1 + (x2 - x1) * f, z: z1 + (z2 - z1) * f, rot: Math.atan2(x2 - x1, z2 - z1) })
    }
    return out
  }, [from, to, dash, gap])
  return (
    <>
      {dashes.map((d, i) => (
        <mesh key={i} position={[d.x, y, d.z]} rotation={[-Math.PI / 2, 0, d.rot]}>
          <planeGeometry args={[width, dash]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      ))}
    </>
  )
}

/** Interior bulk rack: blue frame, orange beams, kraft cartons inside. */
export function BulkRack({ palette, position, rotation = [0, 0, 0], length = 5, levels = 2 }: { palette: Palette3D; position: [number, number, number]; rotation?: [number, number, number]; length?: number; levels?: number }) {
  const posts: number[] = useMemo(() => Array.from({ length: Math.floor(length / 1.25) + 1 }, (_, i) => -length / 2 + i * 1.25), [length])
  return (
    <group position={position} rotation={rotation}>
      {posts.map((x) => (
        <Box key={x} position={[x, 0.9, 0]} size={[0.09, 1.8, 0.09]} color={palette.rackFrame} radius={0.03} />
      ))}
      {Array.from({ length: levels }, (_, l) => (
        <group key={l}>
          <Box position={[0, 0.5 + l * 0.85, 0.3]} size={[length, 0.07, 0.5]} color={palette.beam} radius={0.02} />
          <Box position={[0, 0.5 + l * 0.85, -0.3]} size={[length, 0.07, 0.5]} color={palette.beam} radius={0.02} />
          {posts.slice(0, -1).map((x, i) => (
            <Box key={i} position={[(x + (posts[i + 1] ?? 0)) / 2, 0.66 + l * 0.85, 0]} size={[1.0, 0.3, 0.62]} color={i % 2 ? palette.carton : palette.cartonAlt} radius={0.04} />
          ))}
        </group>
      ))}
    </group>
  )
}

/** Pick-face shelf: lower, open, kraft boxes. */
export function PickFaceShelf({ palette, position, rotation = [0, 0, 0], length = 5 }: { palette: Palette3D; position: [number, number, number]; rotation?: [number, number, number]; length?: number }) {
  return (
    <group position={position} rotation={rotation}>
      <Box position={[0, 0.25, 0]} size={[length, 0.08, 0.7]} color={palette.rackFrame} radius={0.03} />
      {Array.from({ length: Math.floor(length / 0.55) }, (_, i) => (
        <Box key={i} position={[-length / 2 + 0.32 + i * 0.55, 0.45, 0]} size={[0.4, 0.3, 0.5]} color={i % 2 ? palette.cartonAlt : palette.carton} radius={0.05} />
      ))}
    </group>
  )
}

/** Packing station: table + webcam on a small arm. */
export function PackingStation({ palette, position, rotation = [0, 0, 0] }: { palette: Palette3D; position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <Box position={[0, 0.4, 0]} size={[1.2, 0.08, 0.7]} color={palette.office} radius={0.05} />
      <Box position={[-0.4, 0.45, 0]} size={[0.4, 0.1, 0.55]} color={palette.carton} radius={0.04} />
      <Box position={[0.45, 0.62, -0.2]} size={[0.07, 0.42, 0.07]} color={palette.wheel} radius={0.03} />
      <Box position={[0.45, 0.86, -0.02]} size={[0.22, 0.16, 0.1]} color={palette.wheel} radius={0.04} />
    </group>
  )
}

/** Cut-off clock post: pole + white disc; the time text is a projected DOM label. */
export function ClockPost({ palette, position }: { palette: Palette3D; position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1.8, 8]} />
        <meshStandardMaterial color={palette.wheel} roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.95, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.34, 0.1, 24]} />
        <meshStandardMaterial color={palette.sign} roughness={0.8} />
      </mesh>
    </group>
  )
}

/** Road signpost: pole + white plate; the text is a projected DOM label. */
export function Signpost({ palette, position, rotation = [0, 0, 0] }: { palette: Palette3D; position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1.5, 8]} />
        <meshStandardMaterial color={palette.wheel} roughness={0.9} />
      </mesh>
      <Box position={[0, 1.45, 0]} size={[1.3, 0.5, 0.08]} color={palette.sign} radius={0.08} />
    </group>
  )
}
