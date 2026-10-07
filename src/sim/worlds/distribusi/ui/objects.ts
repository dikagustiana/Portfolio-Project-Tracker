// The world map (brief §7.4): every object with its isometric grid footprint, its step
// and team for the panel, and the road polylines the trucks drive. Grid units are metres-
// ish tiles; WorldCanvas projects them to screen. Code identifiers in English, labels in
// Bahasa Indonesia.

import type { PrincipalId, TruckClassId } from '../engine/config.ts'

export type ObjectKind =
  | 'principal'
  | 'komersial'
  | 'adminDesk'
  | 'dock'
  | 'wms'
  | 'rack'
  | 'staging'
  | 'truckPool'
  | 'store'
  | 'finance'
  | 'arDesk'
  | 'taxDesk'
  | 'bank'

export interface WorldObject {
  id: string
  kind: ObjectKind
  label: string
  x: number
  y: number
  w: number
  d: number
  /** Step label and owning team for the right panel. */
  step: string
  team: string
  /** One line: what happens here (panel "Apa yang terjadi"). */
  what: string
  principal?: PrincipalId
  zone?: 1 | 2 | 3
  truckClass?: TruckClassId
  /** Shared vs dedicated sales-admin desk. */
  variant?: 'shared' | 'dedicated'
}

export const OBJECTS: WorldObject[] = [
  // Principals along the top-left.
  { id: 'P-A', kind: 'principal', label: 'Gedung Prinsipal A', x: 0.4, y: 0.2, w: 1.7, d: 1.7, step: 'PO ke prinsipal', team: 'Sales admin', what: 'Menerima PO dan mengirim barang dengan truknya sendiri.', principal: 'A' },
  { id: 'P-B', kind: 'principal', label: 'Gedung Prinsipal B', x: 2.5, y: 0.2, w: 1.7, d: 1.7, step: 'PO ke prinsipal', team: 'Sales admin', what: 'Menerima PO dan mengirim barang dengan truknya sendiri.', principal: 'B' },
  { id: 'P-C', kind: 'principal', label: 'Gedung Prinsipal C', x: 4.6, y: 0.2, w: 1.7, d: 1.7, step: 'PO ke prinsipal', team: 'Sales admin', what: 'Menerima PO dan mengirim barang dengan truknya sendiri.', principal: 'C' },
  { id: 'P-D', kind: 'principal', label: 'Gedung Prinsipal D', x: 6.7, y: 0.2, w: 1.7, d: 1.7, step: 'PO ke prinsipal', team: 'Sales admin', what: 'Menerima PO dan mengirim barang dengan truknya sendiri.', principal: 'D' },
  { id: 'P-E', kind: 'principal', label: 'Gedung Prinsipal E', x: 8.8, y: 0.2, w: 1.7, d: 1.7, step: 'PO ke prinsipal', team: 'Sales admin', what: 'Menerima PO dan mengirim barang dengan truknya sendiri.', principal: 'E' },
  { id: 'P-F', kind: 'principal', label: 'Gedung Prinsipal F', x: 10.9, y: 0.2, w: 1.7, d: 1.7, step: 'PO ke prinsipal', team: 'Sales admin', what: 'Menerima PO dan mengirim barang dengan truknya sendiri.', principal: 'F' },

  // Commercial + sales admin desks.
  { id: 'KOM', kind: 'komersial', label: 'Kantor komersial', x: 0.4, y: 2.6, w: 2.4, d: 1.5, step: 'Forecast dan cek stok', team: 'Komersial', what: 'Menyusun forecast penjualan per SKU dan mengecek stok gudang.' },
  { id: 'SA-1', kind: 'adminDesk', label: 'Meja sales admin bersama 1', x: 3.3, y: 2.9, w: 0.7, d: 0.9, step: 'PO ke prinsipal', team: 'Sales admin (bersama)', what: 'Menerbitkan PO per prinsipal; biayanya dibagi per jumlah PO.', variant: 'shared' },
  { id: 'SA-2', kind: 'adminDesk', label: 'Meja sales admin bersama 2', x: 4.2, y: 2.9, w: 0.7, d: 0.9, step: 'PO ke prinsipal', team: 'Sales admin (bersama)', what: 'Menerbitkan PO per prinsipal; biayanya dibagi per jumlah PO.', variant: 'shared' },
  { id: 'SA-3', kind: 'adminDesk', label: 'Meja sales admin bersama 3', x: 5.1, y: 2.9, w: 0.7, d: 0.9, step: 'PO ke prinsipal', team: 'Sales admin (bersama)', what: 'Menerbitkan PO per prinsipal; biayanya dibagi per jumlah PO.', variant: 'shared' },
  { id: 'SA-D', kind: 'adminDesk', label: 'Meja sales admin khusus D', x: 6, y: 2.9, w: 0.7, d: 0.9, step: 'PO ke prinsipal', team: 'Sales admin (khusus D)', what: 'Khusus melayani Prinsipal D; biayanya langsung ke D.', variant: 'dedicated' },

  // Inbound dock + WMS desk.
  { id: 'DOCK', kind: 'dock', label: 'Dock inbound', x: 7.2, y: 2.6, w: 2.2, d: 1.5, step: 'Inbound fisik', team: 'Tim inbound', what: 'Memindahkan barang dari truk prinsipal ke palet.' },
  { id: 'WMS', kind: 'wms', label: 'Meja admin WMS', x: 9.7, y: 2.9, w: 0.9, d: 0.9, step: 'Input WMS', team: 'Admin WMS', what: 'Mencatat penerimaan barang di sistem WMS.' },

  // Warehouse racks (pallets live here).
  { id: 'RAK-1', kind: 'rack', label: 'Rak gudang 1', x: 1.2, y: 5, w: 5.6, d: 1.1, step: 'Simpan', team: 'Gudang', what: 'Barang menunggu di rak; biaya mengalir per palet-hari.' },
  { id: 'RAK-2', kind: 'rack', label: 'Rak gudang 2', x: 1.2, y: 6.5, w: 5.6, d: 1.1, step: 'Simpan', team: 'Gudang', what: 'Barang menunggu di rak; biaya mengalir per palet-hari.' },
  { id: 'RAK-3', kind: 'rack', label: 'Rak gudang 3', x: 1.2, y: 8, w: 5.6, d: 1.1, step: 'Simpan', team: 'Gudang', what: 'Barang menunggu di rak; biaya mengalir per palet-hari.' },

  // Staging + truck pool.
  { id: 'STAGE', kind: 'staging', label: 'Area staging', x: 7.4, y: 5.4, w: 1.9, d: 1.9, step: 'Outbound', team: 'Tim packing dan outbound', what: 'Barang dipicking dari rak dan disiapkan per DO.' },
  { id: 'POOL-L', kind: 'truckPool', label: 'Pool truk ringan (L)', x: 9.9, y: 5.8, w: 1.6, d: 1.6, step: 'Muat dan jalan', team: 'Armada', what: 'Truk ringan untuk muatan kecil dekat.', truckClass: 'L' },
  { id: 'POOL-M', kind: 'truckPool', label: 'Pool truk sedang (M)', x: 11.7, y: 5.8, w: 1.6, d: 1.6, step: 'Muat dan jalan', team: 'Armada', what: 'Truk sedang untuk muatan menengah.', truckClass: 'M' },
  { id: 'POOL-H', kind: 'truckPool', label: 'Pool truk berat (H)', x: 13.5, y: 5.8, w: 1.6, d: 1.6, step: 'Muat dan jalan', team: 'Armada', what: 'Truk berat untuk muatan penuh jauh.', truckClass: 'H' },

  // Finance, AR, tax, bank.
  { id: 'FIN', kind: 'finance', label: 'Kantor finance', x: 13.6, y: 0.2, w: 2.2, d: 1.5, step: 'Invoice dibuat', team: 'Finance AR', what: 'SAP menerbitkan invoice dari data satellite system.' },
  { id: 'AR', kind: 'arDesk', label: 'Meja AR', x: 12.2, y: 2.9, w: 0.8, d: 0.9, step: 'Invoice dikirim dan faktur pajak', team: 'Finance AR', what: 'Mengirim invoice terkonsolidasi dengan faktur pajak.' },
  { id: 'TAX', kind: 'taxDesk', label: 'Meja pajak', x: 13.2, y: 2.9, w: 0.8, d: 0.9, step: 'Invoice dikirim dan faktur pajak', team: 'Pajak', what: 'Menyiapkan faktur pajak; tukar faktur dengan toko.' },
  { id: 'BANK', kind: 'bank', label: 'Bank', x: 16.2, y: 0.2, w: 1.7, d: 1.5, step: 'TOP dan kas masuk', team: 'AR, bank', what: 'Pelunasan masuk setelah TOP; modal kembali mengalir.' },
]

const ZONE_ORIGIN: Record<1 | 2 | 3, { x: number; y: number; dx: number; dy: number }> = {
  1: { x: 11.2, y: 6.9, dx: 0.78, dy: 0.03 },
  2: { x: 11.8, y: 8.1, dx: 1.42, dy: 0.28 },
  3: { x: 12.4, y: 9.6, dx: 2.6, dy: 0.62 },
}
const PER_ZONE: Record<1 | 2 | 3, number> = { 1: 10, 2: 8, 3: 6 }

/** Grid position of the n-th store (1-based), shared by the map and the sprites. */
export function storePos(n: number): { x: number; y: number; zone: 1 | 2 | 3 } {
  const zone: 1 | 2 | 3 = n <= PER_ZONE[1] ? 1 : n <= PER_ZONE[1] + PER_ZONE[2] ? 2 : 3
  const i = n - (zone === 1 ? 0 : zone === 2 ? PER_ZONE[1] : PER_ZONE[1] + PER_ZONE[2]) - 1
  const o = ZONE_ORIGIN[zone]
  return { x: o.x + i * o.dx, y: o.y + i * o.dy, zone }
}

/** Stores are generated: Toko 01–24 along three zone roads. */
export function storeObjects(): WorldObject[] {
  const out: WorldObject[] = []
  for (let n = 1; n <= 24; n++) {
    const { x, y, zone } = storePos(n)
    const id = `S${String(n).padStart(2, '0')}`
    out.push({
      id, kind: 'store', label: `Toko ${String(n).padStart(2, '0')} (Zona ${zone})`,
      x, y, w: 0.85, d: 0.85,
      step: 'Serah terima', team: 'Driver, toko', what: 'Menandatangani DO; surat jalan kembali ke finance.', zone,
    })
  }
  return out
}

/** Road polylines from the staging area to each zone (truck paths, in grid coords). */
export const ROADS: Record<1 | 2 | 3, { x: number; y: number }[]> = {
  1: [
    { x: 9.6, y: 6.4 }, { x: 10.7, y: 6.75 }, { x: 11.2, y: 6.9 }, { x: 19, y: 7.1 },
  ],
  2: [
    { x: 9.6, y: 6.4 }, { x: 11.2, y: 7.3 }, { x: 11.8, y: 8.1 }, { x: 23.1, y: 10.3 },
  ],
  3: [
    { x: 9.6, y: 6.4 }, { x: 11.6, y: 7.9 }, { x: 12.4, y: 9.6 }, { x: 28, y: 13.3 },
  ],
}

/** Path a principal truck takes from off-map to the inbound dock (grid coords). */
export const ARRIVAL_PATH: { x: number; y: number }[] = [
  { x: -2.5, y: 1.2 }, { x: 3, y: 2.2 }, { x: 6.5, y: 3.1 }, { x: 8.2, y: 3.3 },
]

/** Pallet forklift hop: dock → rack slot; picking hop: rack → staging. */
export const DOCK_TO_RACK: { x: number; y: number }[] = [
  { x: 8.2, y: 3.3 }, { x: 6.8, y: 4.4 }, { x: 4.5, y: 5.6 },
]
export const RACK_TO_STAGE: { x: number; y: number }[] = [
  { x: 5.5, y: 6 }, { x: 7.2, y: 6.2 }, { x: 8.3, y: 6.3 },
]

export const ALL_OBJECTS: WorldObject[] = [...OBJECTS, ...storeObjects()]

export const objectById = (id: string): WorldObject | undefined => ALL_OBJECTS.find((o) => o.id === id)
