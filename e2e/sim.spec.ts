// Sim screen smoke (brief §9 M4): the owner opens #/simulasi from the signed-in shell,
// the world renders with the watermark, an object is keyboard-reachable, the trace opens,
// and prefers-reduced-motion skips the animation (jump instead of animate).
import { expect, test } from '@playwright/test'
import { adminClient, signIn } from './helpers.ts'

const OWNER = `sim-owner.${Math.random().toString(36).slice(2, 8)}@e2e.test`

test('simulasi screen loads, is reachable and traceable', async ({ page, baseURL }) => {
  const admin = adminClient()
  const base = baseURL ?? 'http://localhost:5173'
  const created = await admin.auth.admin.createUser({ email: OWNER, email_confirm: true })
  if (created.error && !/already/i.test(created.error.message)) throw new Error(created.error.message)
  const roles = await admin.from('app_roles').insert({ user_id: created.data.user?.id ?? '', role: 'owner' })
  if (roles.error) throw new Error(roles.error.message)
  await signIn(page, admin, OWNER, base)

  // Owner-only nav button → sim screen.
  await expect(page.getByRole('button', { name: 'Simulasi proses' })).toBeVisible()
  await page.getByRole('button', { name: 'Simulasi proses' }).click()
  await expect(page).toHaveURL(/#\/simulasi/)
  await expect(page.getByRole('heading', { name: 'Simulasi proses' })).toBeVisible()
  await expect(page.getByText('Ilustrasi — angka dummy, bukan data SAMB')).toBeVisible()

  // The metrics bar and timeline exist; the day scrubber works.
  await expect(page.getByRole('group', { name: 'Metrik utama' })).toBeVisible()
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

test('prefers-reduced-motion skips the animation', async ({ page, baseURL }) => {
  const admin = adminClient()
  const base = baseURL ?? 'http://localhost:5173'
  await signIn(page, admin, OWNER, base)
  await page.goto(`${base}/#/simulasi`)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('slider', { name: 'Geser hari' }).fill('6')
  await page.getByRole('button', { name: 'Putar' }).click()
  // With reduced motion the day jumps immediately instead of animating through.
  await expect(page.getByText(/^Hari 7:/)).toBeVisible({ timeout: 3_000 })
})
