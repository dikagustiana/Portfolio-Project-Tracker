// The order-need formula of Brief B4 §5 step 2, as Brief B6 asks for it in the scenario layer:
// kebutuhan = forecast + stok minimum − stok saat ini − stok dalam perjalanan, with
// stok minimum = penjualan harian × hari persediaan minimum and penjualan harian = forecast ÷
// hari sebulan. The engine's generator applies the same rule at its weekly order checks (and
// adds its own 5% ordering safety, which the brief's formula does not carry); this module never
// changes the engine.
import { calc } from '../../../scenario/figure.ts'
import type { Fig } from '../../../scenario/types.ts'

export interface NeedFigs {
  daily: Fig
  minStock: Fig
  /** cartons to order, whole, never below zero */
  need: Fig
}

/** the order need of one SKU from badged figures; every result is a Hitungan */
export function orderNeed(sku: string, forecast: Fig, days: Fig, minDays: Fig, current: Fig, transit: Fig): NeedFigs {
  const daily = calc(`Penjualan harian ${sku}`, 'karton/hari', '{0} ÷ {1}', [forecast, days], (f, d) => (d > 0 ? f / d : 0), 1)
  const minStock = calc(`Stok minimum ${sku}`, 'karton', '{0} × {1}', [daily, minDays], (x, m) => x * m, 1)
  const need = calc(
    `Kebutuhan order ${sku}`, 'karton', 'maks(0, bulat ke atas({0} + {1} − {2} − {3}))', [forecast, minStock, current, transit],
    (f, m, c, t) => Math.max(0, Math.ceil(f + m - c - t - 1e-9)),
  )
  return { daily, minStock, need }
}

/** whole pallets for a carton count: the engine's rule for pallets in (one PO line, rounded up) */
export const palletsFor = (label: string, cartons: Fig, perPallet: Fig): Fig =>
  calc(label, 'palet', 'bulat ke atas({0} ÷ {1})', [cartons, perPallet], (c, p) => (p > 0 ? Math.ceil(c / p - 1e-9) : 0))
