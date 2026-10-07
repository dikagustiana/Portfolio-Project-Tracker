// World 2 map (brief 2 §7.4): dock with the 15.00 cut-off clock, bulk racks and pick-face
// shelves with a replenishment lane between them, order intake (OMS + wave board), the
// highlighted ISD zone, regular pick/pack with a webcam, box shelf, dispatch with a scale
// and courier lanes, courier bay, simplified B2B lane, returns/CS/shop desks, settlement
// ledger and bank. Platforms MP-A…E and Website sit along the top.

export type Kind2 =
  | 'platform'
  | 'oms'
  | 'isdZone'
  | 'returnsDesk'
  | 'csDesk'
  | 'shopDesk'
  | 'settleLedger'
  | 'bank'
  | 'dock'
  | 'bulkRack'
  | 'pickFace'
  | 'replLane'
  | 'regularPick'
  | 'packing'
  | 'boxShelf'
  | 'dispatch'
  | 'courierLane'
  | 'courierBay'
  | 'b2bLane'

export interface WorldObject2 {
  id: string
  kind: Kind2
  label: string
  x: number
  y: number
  w: number
  d: number
  step: string
  team: string
  what: string
  courier?: string
  platform?: string
}

export const OBJECTS2: WorldObject2[] = [
  // Platforms along the top.
  { id: 'PF-MP-A', kind: 'platform', label: 'Marketplace MP-A', x: 0.4, y: 0.2, w: 1.5, d: 1.4, step: 'Order masuk', team: 'OMS, Agregator', what: 'Order mengalir lewat agregator; cut-off same day 12.00.', platform: 'MP-A' },
  { id: 'PF-MP-B', kind: 'platform', label: 'Marketplace MP-B', x: 2.3, y: 0.2, w: 1.5, d: 1.4, step: 'Order masuk', team: 'OMS, Agregator', what: 'Order mengalir lewat agregator; cut-off 16.00.', platform: 'MP-B' },
  { id: 'PF-MP-C', kind: 'platform', label: 'Marketplace MP-C', x: 4.2, y: 0.2, w: 1.5, d: 1.4, step: 'Order masuk', team: 'OMS, Agregator', what: 'Order mengalir lewat agregator; cut-off 16.00.', platform: 'MP-C' },
  { id: 'PF-MP-D', kind: 'platform', label: 'Marketplace MP-D', x: 6.1, y: 0.2, w: 1.5, d: 1.4, step: 'Order masuk', team: 'OMS, Agregator', what: 'Order mengalir lewat agregator; cut-off 16.00.', platform: 'MP-D' },
  { id: 'PF-MP-E', kind: 'platform', label: 'Marketplace MP-E', x: 8, y: 0.2, w: 1.5, d: 1.4, step: 'Order masuk', team: 'OMS, Agregator', what: 'Order mengalir lewat agregator; cut-off 16.00.', platform: 'MP-E' },
  { id: 'PF-WEB', kind: 'platform', label: 'Website', x: 9.9, y: 0.2, w: 1.5, d: 1.4, step: 'Order masuk', team: 'OMS', what: 'Toko online sendiri; fee terendah, settlement tercepat.', platform: 'WEB' },

  // Order intake + desks.
  { id: 'OMS', kind: 'oms', label: 'Meja OMS dan papan wave', x: 11.8, y: 0.3, w: 2.2, d: 1.4, step: 'Kelola order', team: 'OMS', what: 'Menetapkan strategi picking, membagi wave, mencetak label wave.' },
  { id: 'ISD', kind: 'isdZone', label: 'Zona ISD (instan & same day)', x: 14.4, y: 0.2, w: 2.6, d: 1.8, step: 'Picking dan packing P0/P1', team: 'Tim ISD', what: 'Tim khusus P0 dan P1; inilah harga kecepatan.' },
  { id: 'RET', kind: 'returnsDesk', label: 'Meja retur', x: 17.4, y: 0.3, w: 1.5, d: 1.2, step: 'Retur', team: 'Meja retur', what: 'Retur diperiksa, lalu di-restock atau dikarantina.' },
  { id: 'CS', kind: 'csDesk', label: 'Meja customer service', x: 17.4, y: 1.8, w: 1.5, d: 1, step: 'Customer service', team: 'CS', what: 'Tiket per order plus tiket retur.' },
  { id: 'SHOP', kind: 'shopDesk', label: 'Meja shop management', x: 17.4, y: 3, w: 1.5, d: 1, step: 'Shop management', team: 'Shop management', what: 'Kelola toko per platform, dibebankan per order.' },
  { id: 'LEDGER', kind: 'settleLedger', label: 'Buku settlement platform', x: 19.2, y: 0.3, w: 1.7, d: 1.4, step: 'Dana cair', team: 'Finance', what: 'Dana cair per platform setelah order selesai, net fee dan voucher.' },
  { id: 'BANK2', kind: 'bank', label: 'Bank', x: 21.2, y: 0.3, w: 1.5, d: 1.4, step: 'Kas masuk', team: 'Finance', what: 'Settlement masuk ke bank.' },

  // Inbound dock + bulk storage.
  { id: 'DOCK2', kind: 'dock', label: 'Dock inbound (cut-off 15.00)', x: 0.4, y: 2.6, w: 2.4, d: 1.6, step: 'Buat ASN, inbound, terima barang', team: 'Admin ASN, Inbound', what: 'Truk setelah 15.00 diturunkan besok; dokumen dicek terhadap ASN.' },
  { id: 'BULK-1', kind: 'bulkRack', label: 'Rak bulk 1', x: 3.3, y: 4.6, w: 4.6, d: 1.1, step: 'Putaway dan simpan', team: 'Putaway, Gudang', what: 'Palet penuh menunggu di bulk; biaya per palet-hari.' },
  { id: 'BULK-2', kind: 'bulkRack', label: 'Rak bulk 2', x: 3.3, y: 6, w: 4.6, d: 1.1, step: 'Putaway dan simpan', team: 'Putaway, Gudang', what: 'Palet penuh menunggu di bulk; biaya per palet-hari.' },
  { id: 'REPL', kind: 'replLane', label: 'Jalur replenishment', x: 3.3, y: 7.4, w: 4.6, d: 0.7, step: 'Replenishment', team: 'Replenishment', what: 'Barang turun dari bulk ke pick face saat pick face menipis.' },
  { id: 'PICK-1', kind: 'pickFace', label: 'Pick face 1', x: 3.3, y: 8.4, w: 4.6, d: 0.9, step: 'Picking', team: 'Picker', what: 'Rak picking per SKU; stok pick face tidak boleh minus.' },
  { id: 'PICK-2', kind: 'pickFace', label: 'Pick face 2', x: 3.3, y: 9.5, w: 4.6, d: 0.9, step: 'Picking', team: 'Picker', what: 'Rak picking per SKU; stok pick face tidak boleh minus.' },

  // Regular pick/pack + box shelf.
  { id: 'RPICK', kind: 'regularPick', label: 'Picker reguler (kereta pick)', x: 8.4, y: 8.6, w: 1.6, d: 1.4, step: 'Picking P2 dan B2B', team: 'Picker reguler', what: 'Melayani dua channel saat toggle tim bersama aktif.' },
  { id: 'PACK', kind: 'packing', label: 'Stasiun packing (kamera)', x: 10.3, y: 8.6, w: 1.8, d: 1.4, step: 'Cek dan packing', team: 'Packer reguler', what: 'Scan produk, rekam webcam, pilih kotak, tempel label.' },
  { id: 'BOXES', kind: 'boxShelf', label: 'Rak kemasan', x: 12.4, y: 8.6, w: 1.4, d: 1.4, step: 'Cek dan packing', team: 'Packer reguler', what: 'Polymailer, S, M, L — dipilih dari volume order; biaya langsung per paket.' },

  // Dispatch + couriers.
  { id: 'DISP', kind: 'dispatch', label: 'Dispatch (timbangan dan sortir)', x: 14.2, y: 8.6, w: 1.8, d: 1.4, step: 'Dispatch dan manifest', team: 'Dispatch', what: 'Timbang, scan, sortir per kurir, cetak manifest.' },
  { id: 'CL-K1', kind: 'courierLane', label: 'Jalur sortir Kurir 1', x: 16.3, y: 8.2, w: 1.4, d: 0.8, step: 'Dispatch dan manifest', team: 'Dispatch', what: 'Paket Kurir 1 menunggu pickup.', courier: 'K1' },
  { id: 'CL-K2', kind: 'courierLane', label: 'Jalur sortir Kurir 2', x: 16.3, y: 9.2, w: 1.4, d: 0.8, step: 'Dispatch dan manifest', team: 'Dispatch', what: 'Paket Kurir 2 menunggu pickup.', courier: 'K2' },
  { id: 'CL-K3', kind: 'courierLane', label: 'Jalur sortir Kurir 3', x: 16.3, y: 10.2, w: 1.4, d: 0.8, step: 'Dispatch dan manifest', team: 'Dispatch', what: 'Paket Kurir 3 menunggu pickup.', courier: 'K3' },
  { id: 'BAY', kind: 'courierBay', label: 'Bay kurir (van pickup)', x: 18, y: 9, w: 2, d: 1.6, step: 'Serah ke kurir', team: 'Dispatch, Kurir', what: 'Hitung bersama, kurir tanda tangan, manifest ditutup.' },

  // B2B lane (simplified world 1).
  { id: 'B2B', kind: 'b2bLane', label: 'Jalur B2B (truk ke toko)', x: 8.4, y: 4.6, w: 6.5, d: 1.5, step: 'Outbound B2B, muat dan jalan', team: 'Armada, Tim outbound B2B', what: 'Dunia 1 disederhanakan: staging, truk campur prinsipal, DO ke toko.' },
]

/** Paths (grid coords) for the sprite layer. */
export const PATHS2 = {
  order: (fromX: number): { x: number; y: number }[] => [
    { x: fromX + 0.7, y: 1.6 },
    { x: fromX + 0.9, y: 2.1 },
    { x: 12.6, y: 2 },
  ],
  replenish: [
    { x: 5.5, y: 6.4 },
    { x: 5.5, y: 7.7 },
    { x: 5.5, y: 8.5 },
  ],
  pick: [
    { x: 6.5, y: 8.9 },
    { x: 8.9, y: 9 },
    { x: 11, y: 9.1 },
  ],
  packToDispatch: [
    { x: 12.1, y: 9.3 },
    { x: 13.8, y: 9.3 },
    { x: 15, y: 9.3 },
  ],
  courierOut: (laneY: number): { x: number; y: number }[] => [
    { x: 17.7, y: laneY + 0.4 },
    { x: 18.9, y: 9.8 },
    { x: 22.5, y: 11.6 },
  ],
  b2b: [
    { x: 9, y: 5.3 },
    { x: 12, y: 5.6 },
    { x: 15.5, y: 5.8 },
    { x: 20.5, y: 6 },
  ],
  returnFlow: [
    { x: 20.5, y: 11 },
    { x: 19, y: 9.4 },
    { x: 18.1, y: 0.9 },
  ],
  settle: [
    { x: 20, y: 1 },
    { x: 21.3, y: 1 },
    { x: 21.9, y: 1 },
  ],
}

export const ALL_OBJECTS2 = OBJECTS2
export const object2ById = (id: string): WorldObject2 | undefined => ALL_OBJECTS2.find((o) => o.id === id)
