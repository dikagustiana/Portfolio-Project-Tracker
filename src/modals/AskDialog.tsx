// "Keputusan dibutuhkan" (prototype openAsk): record or edit an open ask (planners), decide it
// (its pemutus), or read a decided one and reopen it. Reopening clears the answer and the
// attribution in the database.
import { useState } from 'react'
import { Linkified, Tip } from '../app/bits.tsx'
import { useOverlay } from '../app/overlay-context.ts'
import { TwoStep } from '../app/overlay.tsx'
import { useBoard } from '../data/board-context.ts'
import { addDays, fmtTs } from '../domain/index.ts'
import type { Ask, Id, Project } from '../domain/index.ts'
import { DecisionSource } from './DecisionSource.tsx'
import { decSrcInput, newDecSrc, useBad, useSubmit } from './form.ts'
import { pick, pmPeople } from './logic.ts'
import { Gone, PersonOptions } from './parts.tsx'

export function AskDialog({ projectId, id }: { projectId: Id; id?: Id }) {
  const { d, board } = useBoard()
  const a = id ? board.asks.find((x) => x.id === id) : undefined
  const p = d.project(a ? a.projectId : projectId)
  if (!p || (id && !a)) return <Gone />
  if (a?.status === 'decided') return <AskDecided a={a} p={p} />
  return <AskForm p={p} a={a ?? null} />
}

function AskDecided({ a, p }: { a: Ask; p: Project }) {
  const { d, actions } = useBoard()
  const { close } = useOverlay()
  const { busy, err, run } = useSubmit()
  const may = !d.locked(a) && d.canDecideAsk(a)
  return (
    <>
      <h2>Keputusan</h2>
      <div className="prompt">
        <b>{a.question}</b>
        <br />
        <span className="sub">{p.name}</span>
      </div>
      <div className="f">
        Jawaban
        <div className="evidence">
          <Linkified text={a.answer} />
        </div>
      </div>
      <div className="sub">
        Diputuskan {d.decWho(a.src, a.decidedBy)}
        {a.src.deciderName ? '' : a.decidedAt ? ` · ${fmtTs(a.decidedAt)}` : ''}
      </div>
      {err && <div className="err">{err}</div>}
      <div className="mfoot">
        <span />
        <div className="row">
          <button className="btn ghost" onClick={close}>
            Tutup
          </button>
          {may && (
            <button className="btn" disabled={busy} onClick={() => void run(() => actions.reopenAsk(a.id), { ok: 'Keputusan dibuka lagi' })}>
              Buka lagi keputusan
            </button>
          )}
        </div>
      </div>
    </>
  )
}

interface Fields {
  question: string
  decider: Id
  due: string
  milestoneId: Id
}

function AskForm({ p, a }: { p: Project; a: Ask | null }) {
  const { d, board, today, actions } = useBoard()
  const { close } = useOverlay()
  const { busy, err, setErr, run } = useSubmit()
  const bad = useBad()
  const pms = pmPeople(board, p.id)
  const ms = d.pms(p.id)
  const [f0] = useState<Fields>(() => ({
    question: a?.question ?? '',
    decider: pick(pms, a?.decider),
    due: a ? a.due : addDays(today, 3),
    milestoneId: (a ? a.milestoneId : d.currentMs(p)?.id) ?? '',
  }))
  const [f, setF] = useState<Fields>(() => ({ ...f0, milestoneId: ms.some((m) => m.id === f0.milestoneId) ? f0.milestoneId : '' }))
  const [ans, setAns] = useState('')
  const [src, setSrc] = useState(() => newDecSrc(today))
  const lk = d.locked(p)
  const editable = !lk && d.canPlan(p)
  const may = !!a && !lk && d.canDecideAsk(a)
  const pm = d.pmOf(p)
  const set = <K extends keyof Fields>(k: K, v: Fields[K], fieldId?: string) => {
    setF((x) => ({ ...x, [k]: v }))
    setErr('')
    if (fieldId) bad.ok(fieldId)
  }
  const fields = () => ({
    question: f.question.trim(),
    decider_person_id: f.decider,
    due: f.due,
    milestone_id: f.milestoneId,
  })

  const save = () => {
    const e = bad.need([
      ['aQ', f.question, 'Tulis apa yang harus diputuskan.'],
      ['aDue', f.due, 'Isi batas waktu.'],
    ])
    if (e) return setErr(e)
    const who = d.mname(d.pmOnly(f.decider, p.id) || pm) || 'Project Manager'
    void run(() => actions.saveAsk({ ...(a ? { id: a.id } : { project_id: p.id }), ...fields() }), {
      ok: a ? 'Disimpan' : `Keputusan dicatat. ${who} akan melihatnya di Minggu ini.`,
    })
  }
  const decide = () => {
    if (!a) return
    if (!ans.trim()) return setErr('Tulis jawaban keputusannya dulu.')
    const edited = f.question !== f0.question || f.decider !== f0.decider || f.due !== f0.due || f.milestoneId !== f0.milestoneId
    void run(
      async () => {
        // Prototype saved the edited fields together with the decision.
        if (editable && edited) await actions.saveAsk({ id: a.id, ...fields() })
        await actions.decideAsk(a.id, ans.trim(), decSrcInput(src, today))
      },
      { ok: 'Keputusan tercatat di log' },
    )
  }

  return (
    <>
      <h2>{a ? 'Keputusan dibutuhkan' : 'Catat keputusan yang dibutuhkan'}</h2>
      <label className="f">
        Apa yang harus diputuskan
        <span className="hint">
          Tulis sebagai pertanyaan yang bisa dijawab. Contoh: &quot;Biaya gudang dialokasikan pakai pallet-days atau CBM untuk laporan November?&quot;
        </span>
        <textarea className={bad.cls('aQ')} id="aQ" disabled={!editable} value={f.question} onChange={(e) => set('question', e.target.value, 'aQ')} />
      </label>
      <div className="fgrid">
        <label className="f">
          <span>
            Pemutus
            <Tip k="pemutus" />
          </span>
          <select className="inp" id="aDec" disabled={!editable} value={f.decider} onChange={(e) => set('decider', e.target.value)}>
            <PersonOptions people={pms} empty={pm ? `PM (${d.mname(pm)})` : 'Project Manager'} />
          </select>
        </label>
        <label className="f">
          Batas waktu
          <input className={bad.cls('aDue')} type="date" id="aDue" disabled={!editable} value={f.due} onChange={(e) => set('due', e.target.value, 'aDue')} />
        </label>
      </div>
      <label className="f">
        Terkait milestone
        <select className="inp" id="aMs" disabled={!editable} value={f.milestoneId} onChange={(e) => set('milestoneId', e.target.value)}>
          <option value="">Tidak spesifik</option>
          {ms.map((m) => (
            <option key={m.id} value={m.id}>
              {d.msNo(m)} · {m.title}
            </option>
          ))}
        </select>
      </label>
      {a && may && (
        <>
          <label className="f">
            Jawaban keputusan
            <span className="hint">Isi kalau keputusannya sudah diambil. Akan tercatat di log keputusan.</span>
            <textarea
              className="inp"
              id="aAns"
              placeholder="Keputusan dan alasannya"
              value={ans}
              onChange={(e) => {
                setAns(e.target.value)
                setErr('')
              }}
            />
          </label>
          <DecisionSource px="a" value={src} onChange={setSrc} />
        </>
      )}
      {a && !may && <div className="sub">Menunggu keputusan {d.mname(d.deciderOf(a)) || 'Project Manager'}.</div>}
      <div className="err">{err}</div>
      <div className="mfoot">
        <div>
          {a && editable && (
            <TwoStep
              className="btn danger"
              label="Hapus keputusan"
              armed="Klik lagi untuk hapus"
              disabled={busy}
              onConfirm={() => void run(() => actions.deleteAsk(a.id), { ok: 'Dihapus' })}
            />
          )}
        </div>
        <div className="row">
          <button className="btn ghost" onClick={close}>
            {editable ? 'Batal' : 'Tutup'}
          </button>
          {editable && (
            <button className={a && may ? 'btn' : 'btn primary'} onClick={save} disabled={busy}>
              {a ? 'Simpan' : 'Catat keputusan'}
            </button>
          )}
          {a && may && (
            <button className="btn primary" onClick={decide} disabled={busy}>
              Simpan keputusan
            </button>
          )}
        </div>
      </div>
    </>
  )
}
