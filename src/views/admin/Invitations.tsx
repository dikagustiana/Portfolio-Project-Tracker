// Admin · Undangan: every invitation with its lifecycle (menunggu, diterima, kedaluwarsa,
// dicabut) and the access it grants per project. A pending invitation can be revoked: the access
// it granted is undone where nobody changed it since, and a login that was never used goes too.
import { useState } from 'react'
import { Icon } from '../../app/bits.tsx'
import { roleLabel } from '../../app/events.ts'
import { useFlows } from '../../app/flows.ts'
import { useBoard } from '../../data/board-context.ts'
import { fmtTs } from '../../domain/index.ts'
import type { InvitationStatus } from '../../domain/index.ts'
import { useAct } from '../record/act.ts'
import { Tag } from '../record/parts.tsx'

const LABEL: Record<InvitationStatus, string> = { pending: 'Menunggu', accepted: 'Diterima', expired: 'Kedaluwarsa', revoked: 'Dicabut' }
const TONE = { pending: 'amber', accepted: 'green', expired: 'grey', revoked: 'red' } as const

export function AdminInvitations() {
  const { d, board, actions } = useBoard()
  const flows = useFlows()
  const { busy, err, run } = useAct()
  const [f, setF] = useState<InvitationStatus | 'all'>('pending')
  const list = [...board.invitations].filter((i) => f === 'all' || i.status === f).sort((a, b) => b.createdAt - a.createdAt)
  const count = (s: InvitationStatus) => board.invitations.filter((i) => i.status === s).length
  return (
    <div className="stack" style={{ maxWidth: 980 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="seg" role="group" aria-label="Status undangan">
          {(['pending', 'accepted', 'expired', 'revoked', 'all'] as const).map((k) => (
            <button key={k} className={f === k ? 'on' : ''} aria-pressed={f === k} onClick={() => setF(k)}>
              {k === 'all' ? 'Semua' : `${LABEL[k]} (${count(k)})`}
            </button>
          ))}
        </div>
        <button className="btn primary sm" onClick={() => flows.invite()}>
          <Icon name="plus" /> Undang anggota
        </button>
      </div>
      {err && <div className="err">{err}</div>}
      <section className="panel">
        {list.length ? (
          <div className="rows">
            {list.map((i) => (
              <div key={i.id} className="li static">
                <span className="ref">@</span>
                <div style={{ minWidth: 0 }}>
                  <div className="tt">
                    {i.displayName || d.mname(i.personId) || i.email} <span className="sub">· {i.email}</span>
                  </div>
                  <div className="sub" style={{ whiteSpace: 'normal' }}>
                    {i.projects.length
                      ? i.projects.map((x) => `${d.project(x.projectId)?.code ?? '?'} ${roleLabel(x.role)}`).join(' · ')
                      : 'Tanpa project'}
                  </div>
                  <div className="sub">
                    Diundang {fmtTs(i.createdAt)}
                    {i.invitedBy ? ` oleh ${d.mname(i.invitedBy)}` : ''}
                    {i.status === 'pending' ? ` · berlaku sampai ${fmtTs(i.expiresAt)}` : ''}
                    {i.acceptedAt ? ` · diterima ${fmtTs(i.acceptedAt)}` : ''}
                    {i.revokedAt ? ` · dicabut ${fmtTs(i.revokedAt)}` : ''}
                  </div>
                </div>
                <div className="end">
                  <Tag tone={TONE[i.status]}>{LABEL[i.status]}</Tag>
                  {i.status === 'pending' && (
                    <button
                      className="btn sm ghost"
                      disabled={busy}
                      onClick={() => {
                        if (confirm(`Cabut undangan untuk ${i.email}? Akses yang diberikan undangan ini ikut dicabut.`)) void run(() => actions.revokeInvitation(i.id), 'Undangan dicabut')
                      }}
                    >
                      Cabut
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">Tidak ada undangan {f === 'all' ? '' : LABEL[f].toLowerCase()}.</div>
        )}
      </section>
      <p className="sub" style={{ margin: 0 }}>
        Undangan berlaku 14 hari. Akses project langsung diberikan saat mengundang; undangan mengatur boleh tidaknya email itu masuk. Orang yang sudah punya akun
        tidak diundang ulang: aksesnya diperbarui.
      </p>
    </div>
  )
}
