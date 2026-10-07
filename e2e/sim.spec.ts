// Sim screens smoke (Brief 1 §9 M4 + Brief 2 §9 N4 + Brief 3 V4): the owner opens both routes
// from the signed-in shell, the worlds render with the watermark, objects are keyboard-reachable,
// traces open with the "hitung ulang sama" badge, the world selector switches routes, world 2 opens in 3D
// with "Tampilan 2D" one click away, and prefers-reduced-motion jumps instead of animating in
// both worlds (world 2 stays 2D then). The 3D view itself is covered without Supabase by
// e2e-sim3d (npm run e2e:sim3d).
import { expect, test } from '@playwright/test'
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

test('world 1 #/simulasi loads, is reachable and traceable', async ({ page, baseURL }) => {
  const admin = adminClient()
  const base = baseURL ?? 'http://localhost:5173'
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
  await expect(page.getByText('hitung ulang sama')).toBeVisible()
})

test('world selector switches to #/simulasi/b2b-b2c and the second world works', async ({ page, baseURL }) => {
  const admin = adminClient()
  const base = baseURL ?? 'http://localhost:5173'
  await signIn(page, admin, OWNER, base)
  await page.goto(`${base}/#/simulasi`)

  await page.getByRole('tab', { name: 'Gudang B2B + B2C' }).click()
  await expect(page).toHaveURL(/#\/simulasi\/b2b-b2c/)

  // Brief 3: world 2 opens in 3D with engine-bound KPI cards; a KPI opens its trace.
  await expect(page.getByRole('group', { name: 'Ringkasan biaya' })).toBeVisible()
  await expect(page.getByText('Ilustrasi — angka dummy, bukan data SAMB')).toBeVisible()
  await page.getByRole('button', { name: /Biaya per order B2C/ }).click()
  await expect(page.getByText('hitung ulang sama')).toBeVisible()
  await page.keyboard.press('Escape')

  // The 2D world is one click away (and remembered per browser).
  await page.getByRole('button', { name: 'Tampilan 2D' }).click()
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
  await expect(page.getByText('hitung ulang sama')).toBeVisible()
})

test('prefers-reduced-motion jumps instead of animating (both worlds)', async ({ page, baseURL }) => {
  const admin = adminClient()
  const base = baseURL ?? 'http://localhost:5173'
  await signIn(page, admin, OWNER, base)

  await page.goto(`${base}/#/simulasi`)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('slider', { name: 'Geser hari' }).fill('6')
  await page.getByRole('button', { name: 'Putar' }).click()
  // World 1 jumps a whole day every 420 ms, so any one day's caption is only up for an instant;
  // assert the jump past day 6 instead, and that the animated path's "▶ 1×" badge never shows.
  const dayShown = async (): Promise<number> => Number(/^Hari (\d+):/.exec(await page.getByText(/^Hari \d+:/).innerText())?.[1] ?? 0)
  await expect.poll(dayShown, { timeout: 3_000 }).toBeGreaterThan(6)
  await expect(page.getByText(/^▶ \d+×$/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Jeda' }).click()

  // World 2 (2D under reduced motion) steps an hour at a time; start late on day 6 so the jump to
  // day 7 lands within the timeout. Its map caption reads "Hari 7, 06.00 · … order".
  await page.getByRole('tab', { name: 'Gudang B2B + B2C' }).click()
  await expect(page.getByRole('heading', { name: 'Gudang B2B + B2C' })).toBeVisible()
  await page.getByRole('slider', { name: 'Geser hari' }).fill('6')
  await page.getByRole('slider', { name: 'Geser jam' }).fill('21')
  await page.getByRole('button', { name: 'Putar' }).click()
  await expect(page.getByText(/^Hari 7, /)).toBeVisible({ timeout: 3_000 })
})
