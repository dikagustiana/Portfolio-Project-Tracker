// World 2 data model. The B2B exit embeds the Brief 1 world (at a smaller scale); the
// B2C exit adds orders, packages, manifests, returns and settlements. One shared piece
// ledger proves both channels draw from the same stock pool.

import type { PrincipalId } from '../../../core/colors.ts'
import type { PlatformId } from './config.ts'
import type { Sku, Store, World as B2BWorld } from '../../distribusi/engine/types.ts'

export { type Sku, type Store } from '../../distribusi/engine/types.ts'

export type Priority = 'P0' | 'P1' | 'P2'

export interface OrderItem {
  sku: string
  principal: PrincipalId
  pieces: number
  pieceVolumeCm3: number
  pieceKg: number
  gmv: number
}

export interface B2cOrder {
  id: string
  platform: PlatformId
  day: number
  hour: number
  priority: Priority
  items: OrderItem[]
  gmv: number
  voucher: number
  fee: number
  /** Courier tariff for the package (always shown; borne per toggle). */
  shipping: number
  box: string
  boxCost: number
  chargeableKg: number
  actualKg: number
  courier: string
  shipDay: number
  completeDay: number
  returned: boolean
  returnDay: number
  restocked: boolean
  settlementDay: number
  netSettlement: number
}

export interface Manifest {
  id: string
  courier: string
  day: number
  pickup: number
  packages: number
  signedDay: number
  closedDay: number
}

export interface PickFaceDay {
  sku: string
  day: number
  stockPieces: number
  replenishedPieces: number
}

export interface PieceLedgerDay {
  sku: string
  day: number
  open: number
  in: number
  /** Returned pieces put back on the shelf that day (restocked returns). */
  restocked: number
  outB2b: number
  outB2c: number
  close: number
}

export interface World2 {
  days: number
  /** The B2B exit: world 1's entities at a smaller scale (POs, DOs, trips, invoices…). */
  b2b: B2BWorld
  skus: Record<string, Sku>
  /** Pieces per carton per SKU (world 2 adds piece-level B2C attributes). */
  piecesPerCarton: Record<string, number>
  pieceVolumeCm3: Record<string, number>
  pieceKg: Record<string, number>
  piecePrice: Record<string, number>
  stores: Store[]
  orders: B2cOrder[]
  manifests: Manifest[]
  /** Shared stock ledger in pieces: opening + in + restocked − (B2B out + B2C out) = closing. */
  ledger: PieceLedgerDay[]
  pickFace: PickFaceDay[]
  quarantinedPieces: Record<string, number>
}
