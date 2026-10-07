// World-2 label anchors (Brief 3 §3.7). Labels are plain DOM projected from these world
// points with camera3d's projector — no drei <Html> (React 19.3 root-unmount race) and no
// troika text (CSP).

export interface LabelAnchor {
  id: string
  at: [number, number, number]
  text: string
  /** `tag`: a pin-shaped name over the selected vehicle (not clickable). */
  kind: 'pin' | 'sign' | 'clock' | 'tag'
  /** Map object (objects2.ts) a pin opens. */
  target?: string
}

export interface ProjectedLabel extends LabelAnchor {
  left: number
  top: number
}

export const LABELS2: LabelAnchor[] = [
  { id: 'pin-warehouse', at: [0, 4.6, 0], text: 'Gudang utama', kind: 'pin', target: 'BULK-1' },
  { id: 'pin-inbound', at: [-11.2, 2.4, -1.4], text: 'Inbound', kind: 'pin', target: 'DOCK2' },
  { id: 'pin-courier', at: [11.6, 2.4, 1.6], text: 'Bay kurir', kind: 'pin', target: 'BAY' },
  { id: 'pin-b2b', at: [-0.88, 2.6, 4.6], text: 'Dock B2B', kind: 'pin', target: 'B2B' },
  { id: 'sign-toko', at: [26, 1.75, 10.6], text: 'Toko', kind: 'sign' },
  { id: 'sign-konsumen', at: [16.9, 1.7, 15.5], text: 'Konsumen', kind: 'sign' },
  { id: 'clock-cutoff', at: [-10.6, 1.95, 4.4], text: '15.00', kind: 'clock' },
]

/** Ground spot (centre, ring radius) of each clickable map object, for the selection ring. */
export const OBJECT_SPOTS: Record<string, { x: number; z: number; r: number }> = {
  'BULK-1': { x: -2.2, z: -1.6, r: 3.4 },
  'BULK-2': { x: -2.2, z: -2.9, r: 3.4 },
  'PICK-1': { x: -2.2, z: 0.1, r: 3.2 },
  'PICK-2': { x: -2.2, z: 1, r: 3.2 },
  ISD: { x: 3.4, z: -0.4, r: 1.9 },
  PACK: { x: 3.45, z: 1.9, r: 1.8 },
  DISP: { x: 4.4, z: -2.6, r: 0.9 },
  'CL-K1': { x: 4, z: -1.2, r: 1.3 },
  'CL-K2': { x: 4, z: -0.65, r: 1.3 },
  'CL-K3': { x: 4, z: -0.1, r: 1.3 },
  DOCK2: { x: -9.6, z: 0.4, r: 2.8 },
  B2B: { x: -0.88, z: 5.4, r: 4.4 },
  BAY: { x: 13.4, z: 1.6, r: 3.4 },
  OMS: { x: 5.4, z: -4.6, r: 2.2 },
  RET: { x: -6.4, z: -4.6, r: 1.9 },
}
