// Data model of the generated month. The world (this file's shapes) is toggle-independent:
// toggles only change how costs are allocated on top of it (brief §5, "event log").

import type { PrincipalId, TruckClassId } from './config.ts'

export interface Sku {
  id: string
  principal: PrincipalId
  /** Display code, e.g. `A-01`. */
  code: string
  wCm: number
  hCm: number
  dCm: number
  kgPerCarton: number
  stackFactor: number
  pricePerCarton: number
  margin: number
  m3PerCarton: number
}

export interface Principal {
  id: PrincipalId
  name: string
  minInventoryDays: number
  leadTimeDays: number
  skus: string[]
}

export interface Store {
  id: string
  code: string
  zone: 1 | 2 | 3
  mtBesar: boolean
}

export interface Po {
  id: string
  principal: PrincipalId
  day: number
  lines: { sku: string; cartons: number }[]
  arrivalDay: number
}

export interface StockDay {
  sku: string
  day: number
  open: number
  in: number
  out: number
  close: number
}

export interface DoLine {
  sku: string
  cartons: number
  m3: number
  kg: number
  value: number
}

export interface DeliveryOrder {
  id: string
  store: string
  zone: 1 | 2 | 3
  day: number
  lines: DoLine[]
  m3: number
  kg: number
  value: number
  trip: string
}

export interface Trip {
  id: string
  day: number
  zone: 1 | 2 | 3
  truckClass: TruckClassId
  truckCode: string
  dos: string[]
  m3: number
  kg: number
}

export interface InvoiceGen {
  id: string
  principal: PrincipalId
  store: string
  /** Delivery day of the DO it invoices. */
  deliveryDay: number
  /** Day SAP generates it: delivery + 0–1. */
  day: number
  value: number
  dos: string[]
}

export interface InvoiceSent {
  id: string
  principal: PrincipalId
  store: string
  /** Consolidation window [fromDay, toDay] over that store's DOs. */
  fromDay: number
  toDay: number
  sentDay: number
  tukarDay: number
  dueDay: number
  payDay: number
  value: number
  genInvoices: string[]
  /** Cash-clock segments (§3 step 11): delivery→invoice, invoice→tukar faktur, tukar→payment. */
  seg1: number
  seg2: number
  seg3: number
}

export interface World {
  days: number
  principals: Principal[]
  skus: Record<string, Sku>
  stores: Store[]
  /** Per SKU per day stock ledger; index = (day - 1) * skuCount + skuIndex, ordered by day. */
  stock: StockDay[]
  pos: Po[]
  dos: DeliveryOrder[]
  trips: Trip[]
  invoicesGen: InvoiceGen[]
  invoicesSent: InvoiceSent[]
  /** Month forecast per SKU (cartons) — the commercial team's number, before actuals. */
  forecast: Record<string, number>
}
