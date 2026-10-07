// Sim screen smoke (Brief B4): the owner opens the simulation from the signed-in shell and gets
// the command centre built on Factory Yard: the watermark, the live metrics bar, the place
// buttons, Lensa biaya swapping in the engine's cost metrics, and a click on the map opening a
// card bound to the engine, "Belum ada di engine" included. Both routes keep working, and
// prefers-reduced-motion still renders the world. ?debug=1 exposes window.sim for the clicks.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { adminClient, signIn } from './helpers.ts'

const OWNER = `sim-owner.${Math.random().toString(36).slice(2, 8)}@e2e.test`

// The database only creates logins for e-mails on file (on_auth_user_gate), so the test owner is
// invited the way the owner screens do it: a pending 'owner' role, granted when the login appears.
test.beforeAll(async () => {
  const admin = adminClient()
  const pending = await admin.from('pending_app_roles').insert({ email: OWNER, role: 'owner' })
  if (pending.error) throw new Error(pending.error.message)
  const created = await admin.auth.admin.createUser({ email: OWNER, email_confirm: true })
  if (created.error) throw new Error(created.error.message)
})

test.afterAll(async () => {
  const admin = adminClient()
  await admin.from('pending_app_roles').delete().eq('email', OWNER)
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data.users.filter((x) => x.email === OWNER)) await admin.auth.admin.deleteUser(u.id).catch(() => undefined)
})

const WATERMARK = 'Ilustrasi: angka dummy, bukan data SAMB'

async function openYard(page: Page, base: string, hash: string): Promise<void> {
  await page.goto(`${base}/?debug=1${hash}`)
  await expect(page.getByText(WATERMARK)).toBeVisible({ timeout: 30_000 })
  await page.waitForFunction(() => 'sim' in globalThis, null, { timeout: 30_000 })
}

test('#/simulasi opens the command centre with its metrics, places and cost lens', async ({ page, baseURL }) => {
  const admin = adminClient()
  const base = baseURL ?? 'http://localhost:5173'
  await signIn(page, admin, OWNER, base)

  await expect(page.getByRole('button', { name: 'Simulasi proses' })).toBeVisible()
  await page.getByRole('button', { name: 'Simulasi proses' }).click()
  await expect(page).toHaveURL(/#\/simulasi/)
  await expect(page.getByText(WATERMARK)).toBeVisible({ timeout: 30_000 })

  // The operation's pulse, with gaps named rather than filled.
  await expect(page.getByText('Order hari ini')).toBeVisible()
  await expect(page.getByText('Ketepatan kirim')).toBeVisible()
  await expect(page.getByText('Belum ada di engine').first()).toBeVisible()

  // Lensa biaya swaps in the engine's cost metrics, and back.
  await page.getByRole('button', { name: 'Lensa biaya' }).click()
  await expect(page.getByText('Biaya per order B2C')).toBeVisible()
  await expect(page.getByText('Biaya gudang bersama')).toBeVisible()
  await page.getByRole('button', { name: 'Lensa biaya' }).click()
  await expect(page.getByText('Order hari ini')).toBeVisible()

  // The six places are buttons, and the view switcher is a radio group.
  for (const name of ['Kantor', 'Prinsipal', 'Gudang', 'Bay kurir', 'Toko', 'Konsumen']) await expect(page.getByRole('group', { name: 'Tempat' }).getByRole('button', { name: new RegExp(name) })).toBeVisible()
  await page.getByRole('radiogroup', { name: 'Tampilan' }).getByRole('radio', { name: 'Gudang' }).click()
  await expect(page.getByRole('radiogroup', { name: 'Tampilan' }).getByRole('radio', { name: 'Gudang' })).toHaveAttribute('aria-checked', 'true')
})

test('a click on the map opens a card bound to the engine, on both routes', async ({ page, baseURL }) => {
  const admin = adminClient()
  const base = baseURL ?? 'http://localhost:5173'
  await signIn(page, admin, OWNER, base)

  for (const hash of ['#/simulasi/b2b-b2c', '#/simulasi/distribusi']) {
    await openYard(page, base, hash)
    // Click the gudang where the scene draws it.
    const at = await page.evaluate(() => (globalThis as unknown as { sim: { screenOf: (id: string) => [number, number] | null } }).sim.screenOf('Gudang'))
    expect(at).not.toBeNull()
    if (at) await page.mouse.click(at[0], at[1])
    await expect(page.getByRole('heading', { name: 'Gudang utama' })).toBeVisible()
    await expect(page.getByText('Angka engine')).toBeVisible()

    // The mixed-principal truck: its card, its route stage, and the gap the engine has.
    await page.evaluate(() => (globalThis as unknown as { sim: { select: (id: string) => void } }).sim.select('L-03'))
    await expect(page.getByRole('heading', { name: /^L-03 · TR-08-/ })).toBeVisible()
    await expect(page.getByText(/prinsipal satu truk/i)).toBeVisible()
    await expect(page.getByRole('region', { name: 'Pelacak tahap' }).getByText('Jalan')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText('Panel konteks')).toBeVisible()
  }
})

test('prefers-reduced-motion still renders the world', async ({ page, baseURL }) => {
  const admin = adminClient()
  const base = baseURL ?? 'http://localhost:5173'
  await signIn(page, admin, OWNER, base)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openYard(page, base, '#/simulasi/b2b-b2c')
  await expect(page.getByText('Order hari ini')).toBeVisible()
})
