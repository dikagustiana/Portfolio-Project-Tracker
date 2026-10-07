// World-2 label anchors (Brief 3 §3.7). Labels are plain DOM projected from these world
// points with camera3d's projector — no drei <Html> (React 19.3 root-unmount race) and no
// troika text (CSP).

export interface LabelAnchor {
  id: string
  at: [number, number, number]
  text: string
  kind: 'pin' | 'sign' | 'clock'
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
  { id: 'pin-courier', at: [13.2, 2.2, 5.2], text: 'Bay kurir', kind: 'pin', target: 'BAY' },
  { id: 'pin-b2b', at: [0.6, 2, 5], text: 'Dock B2B', kind: 'pin', target: 'B2B' },
  { id: 'sign-toko', at: [17.6, 1.75, 11.4], text: 'Toko', kind: 'sign' },
  { id: 'sign-konsumen', at: [2.2, 1.7, 16.4], text: 'Konsumen', kind: 'sign' },
  { id: 'clock-cutoff', at: [-9.6, 1.95, 3.1], text: '15.00', kind: 'clock' },
]
