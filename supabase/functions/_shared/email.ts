// E-mail sending behind one interface (BRIEF §11). Phase 1 has no sender: email_provider = 'none'
// composes and logs only. Phase 2 adds Microsoft Graph (Mail.Send with admin consent from SAMB IT,
// secrets in Supabase Vault, used only here).

export interface SendResult {
  ok: boolean
  id?: string
  error?: string
}

export interface EmailProvider {
  readonly name: string
  send(to: string, subject: string, text: string, html: string): Promise<SendResult>
}

/** The provider for org_settings.email_provider; null means dry run (compose and log only). */
export function providerFor(name: string): EmailProvider | null {
  if (name === 'none') return null
  if (name === 'graph') return graphProvider()
  throw new Error(`Pengirim email tidak dikenal: ${name}`)
}

function graphProvider(): EmailProvider {
  return {
    name: 'graph',
    send: () =>
      Promise.resolve({
        ok: false,
        error: 'Pengiriman lewat Microsoft Graph belum disambungkan (fase 2: app registration dan admin consent dari IT SAMB).',
      }),
  }
}
