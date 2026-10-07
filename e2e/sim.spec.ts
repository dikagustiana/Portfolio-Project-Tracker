// Sim screens smoke (Brief 1 §9 M4 + Brief 2 §9 N4): the owner opens both routes from the
// signed-in shell, the worlds render with the watermark, objects are keyboard-reachable,
// traces open with the recompute badge, the world selector switches routes, and
// prefers-reduced-motion jumps instead of animating in both worlds.
import { expect, test } from '@playwright/test'
import { adminClient, signIn } from './helpers.ts'

const OWNER = `sim-owner.${Math.random().toString(36).slice(2, 8)}@e2e.test`

test('world 1 #/simulasi loads, is reachable and traceable', async ({ page, baseURL }) => {
  const admin = adminClient()
  const base = baseURL ?? 'http://localhost:5173'
  const created = await admin.auth.admin.createUser({ email: OWNER, email_confirm: true })
  if (created.error && !/already/i.test(created.error.message)) throw new Error(created.error.message)
  const roles = await admin.from('app_roles').insert({ user_id: created.data.user?.id ?? '', role: 'owner' })
  if (roles.error) throw new Error(roles.error.message)
  await signIn(page, admin, OWNER, base)

  // Owner-only nav button → sim host → world 1.
  await expect(page.getByRole('button', { name: 'Simulasi proses' })).toBeVisible()
  await page.getByRole('button', { name: 'Simulasi proses' }).click()
  await expect(page).toHaveURL(/#\/simulasi/)
  await expect(page.getByRole('heading', { name: 'Simulasi proses' })).toBeVisible()
  await expect(page.getByText('Ilustrasi — angka dummy, bukan data SAMB')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Metrik utama' })).toBeVisible()

  // Day scrubber works.
  await page.getByRole('slider', { name: 'Geser hari' }).fill('12')
  await expect(page.getByText(/^Hari 12:/)).toBeVisible()

  // A world object is keyboard-reachable and opens its panel.
  await page.getByRole('button', { name: /^Gedung Prinsipal A\./ }).focus()
  await expect(page.getByRole('button', { name: /^Gedung Prinsipal A\./ })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Langkah:')).toBeVisible()

  // A metric opens its number trace, which recomputes to the same value.
  await page.getByRole('button', { name: /Biaya teralokasi s.d. hari ini/ }).click()
  await expect(page.getByText('recompute sama')).toBeVisible()
})

test('world selector switches to #/simulasi/b2b-b2c and the second world works', async ({ page, baseURL }) => {
  const admin = adminClient()
  const base = baseURL ?? 'http://localhost:5173'
  await signIn(page, admin, OWNER, base)
  await page.goto(`${base}/#/simulasi`)

  await page.getByRole('tab', { name: 'Gudang B2B + B2C' }).click()
  await expect(page).toHaveURL(/#\/simulasi\/b2b-b2c/)
  await expect(page.getByRole('heading', { name: 'Gudang B2B + B2C' })).toBeVisible()
  await expect(page.getByText('Ilustrasi — angka dummy, bukan data SAMB')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Metrik utama gudang B2B+B2C' })).toBeVisible()

  // Intra-day clock: the hour scrubber with the cut-off marks.
  await expect(page.getByText('cut-off 12.00')).toBeVisible()
  await expect(page.getByText('cut-off 16.00')).toBeVisible()

  // Day scrubber + order panel with the GMV waterfall.
  await page.getByRole('slider', { name: 'Geser hari' }).fill('7')
  await page.getByRole('button', { name: /^Meja OMS/ }).click()
  await expect(page.getByText('Contoh order (klik untuk waterfall)')).toBeVisible()

  // The platform tab follows: switch to a platform from the overview.
  await page.getByRole('button', { name: '← Semua objek' }).click()
  await page.getByRole('button', { name: 'ikuti', exact: true }).first().click()
  await expect(page.getByText('✓ diikuti')).toBeVisible()

  // A metric opens its trace with the recompute badge.
  await page.getByRole('button', { name: /Biaya per order B2C/ }).click()
  await expect(page.getByText('recompute sama')).toBeVisible()
})

test('prefers-reduced-motion jumps instead of animating (both worlds)', async ({ page, baseURL }) => {
  const admin = adminClient()
  const base = baseURL ?? 'http://localhost:5173'
  await signIn(page, admin, OWNER, base)

  await page.goto(`${base}/#/simulasi`)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('slider', { name: 'Geser hari' }).fill('6')
  await page.getByRole('button', { name: 'Putar' }).click()
  await expect(page.getByText(/^Hari 7:/)).toBeVisible({ timeout: 3_000 })

  await page.getByRole('tab', { name: 'Gudang B2B + B2C' }).click()
  await page.getByRole('slider', { name: 'Geser hari' }).fill('6')
  await page.getByRole('button', { name: 'Putar' }).click()
  await expect(page.getByText(/^Hari 7:/)).toBeVisible({ timeout: 3_000 })
})
