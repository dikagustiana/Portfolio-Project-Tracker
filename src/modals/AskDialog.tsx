// Keputusan form (prototype openAsk, upgraded in the architecture pass): raise or edit a decision
// request with its context, options, recommendation, decider, due date, gate and the tasks it
// concerns. Members raise; the creator or a project admin edits; deciding happens on the record.
import { useState } from 'react'
import { Tip } from '../app/bits.tsx'
import type { AskPreset } from '../app/flows.ts'
import { useOverlay } from '../app/overlay-context.ts'
import { TwoStep } from '../app/overlay.tsx'
import { setUI } from '../app/ui.ts'
import { useBoard } from '../data/board-context.ts'
import { addDays } from '../domain/index.ts'
import type { Id } from '../domain/index.ts'
import { useBad, useSubmit } from './form.ts'
import { judgePeople, pick } from './logic.ts'
import { Gone, PersonOptions } from './parts.tsx'

export function AskDialog({ projectId, id, preset = {} }: { projectId: Id; id?: Id; preset?: AskPreset }) {
  const { d, board, today, actions } = useBoard()
  const { close } = useOverlay()
  const { busy, err, setErr, run } = useSubmit()
  const bad = useBad()
  const a = id ? d.ask(id) : undefined
  const p = d.project(a ? a.projectId : projectId)
  const pms = p ? judgePeople(board, p.id) : []
  const ms = p ? d.pms(p.id) : []
  const [question, setQuestion] = useState(() => a?.question ?? preset.question ?? '')
  const [context, setContext] = useState(() => a?.context ?? preset.context ?? '')
  const [options, setOptions] = useState(() => (a?.options ?? []).join('\n'))
  const [rec, setRec] = useState(() => a?.recommendation ?? '')
  const [decider, setDecider] = useState(() => pick(pms, a?.decider))
  const [due, setDue] = useState(() => (a ? a.due : addDays(today, 3)))
  const [msId, setMsId] = useState(() => (a ? a.milestoneId : (preset.milestoneId ?? (p ? (d.currentMs(p)?.id ?? '') : ''))))
  const [refs, setRefs] = useState(() =>
    (a?.taskIds ?? preset.taskIds ?? [])
      .map((x) => d.task(x)?.ref)
      .filter(Boolean)
      .join(', '),
  )
  if (!p || (id && !a)) return <Gone />
  const pm = d.pmOf(p)
  const tokens = refs.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean)
  const linked = tokens.map((r) => ({ r, t: d.task(d.resolveRecord(p.id, 'task', r)) }))
  const unknown = linked.filter((x) => !x.t).map((x) => x.r)

  const save = () => {
    const e = bad.need([
      ['aQ', question, 'Tulis apa yang harus diputuskan.'],
      ['aDue', due, 'Isi batas waktu.'],
    ])
    if (e) return setErr(e)
    if (unknown.length) return setErr(`Task ${unknown.join(', ')} tidak ada di project ini.`)
    const who = d.mname(decider || pm) || 'PM project'
    let saved = ''
    void run(
      async () =>
        (saved = await actions.saveAsk({
          ...(a ? { id: a.id } : { project_id: p.id }),
          question: question.trim(),
          context: context.trim(),
          options: options.split('\n').map((x) => x.trim()).filter(Boolean),
          recommendation: rec.trim(),
          decider_person_id: decider,
          due,
          milestone_id: ms.some((m) => m.id === msId) ? msId : '',
          task_ids: linked.flatMap((x) => (x.t ? [x.t.id] : [])),
        })),
      {
        ok: a ? 'Keputusan disimpan' : `Keputusan dicatat. ${who} akan melihatnya di Perlu tindakan.`,
        // Show the new record; its short id is assigned by the database, so address it by id.
        after: () => {
          if (!a && saved) setUI({ peek: { code: p.code || p.id, kind: 'ask', ref: saved } })
        },
      },
    )
  }

  return (
    <>
      <h2>{a ? `Edit ${a.ref}` : 'Keputusan dibutuhkan'}</h2>
      <div className="sub">{p.name}</div>
      <label className="f">
        Apa yang harus diputuskan
        <span className="hint">Tulis sebagai pertanyaan yang bisa dijawab. Contoh: &quot;Biaya gudang dialokasikan pakai pallet-days atau CBM untuk laporan November?&quot;</span>
        <textarea className={bad.cls('aQ')} id="aQ" value={question} onChange={(e) => setQuestion(e.target.value)} />
      </label>
      <label className="f">
        Konteks
        <textarea className="inp" rows={2} value={context} onChange={(e) => setContext(e.target.value)} placeholder="Kenapa ini perlu diputuskan, apa dampaknya" />
      </label>
      <div className="fgrid">
        <label className="f">
          Pilihan (satu per baris)
          <textarea className="inp" rows={3} value={options} onChange={(e) => setOptions(e.target.value)} placeholder={'Pallet-days\nCBM'} />
        </label>
        <label className="f">
          Rekomendasi
          <textarea className="inp" rows={3} value={rec} onChange={(e) => setRec(e.target.value)} placeholder="Usulan dan alasannya" />
        </label>
      </div>
      <div className="fgrid">
        <label className="f">
          <span>
            Pemutus
            <Tip k="pemutus" />
          </span>
          <select className="inp" id="aDec" value={decider} onChange={(e) => setDecider(e.target.value)}>
            <PersonOptions people={pms} empty={pm ? `PM (${d.mname(pm)})` : 'PM project'} />
          </select>
        </label>
        <label className="f">
          Batas waktu
          <input className={bad.cls('aDue')} type="date" id="aDue" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
      </div>
      <div className="fgrid">
        <label className="f">
          Terkait milestone
          <select className="inp" id="aMs" value={msId} onChange={(e) => setMsId(e.target.value)}>
            <option value="">Tidak spesifik</option>
            {ms.map((m) => (
              <option key={m.id} value={m.id}>
                {d.msNo(m)} · {m.title}
              </option>
            ))}
          </select>
        </label>
        <label className="f">
          Task terkait (ID)
          <input className="inp" value={refs} onChange={(e) => setRefs(e.target.value)} placeholder="mis. MB12, MB13" />
          <span className="hint">
            {linked.filter((x) => x.t).length
              ? linked.flatMap((x) => (x.t ? [`${x.t.ref} · ${x.t.title.slice(0, 40)}`] : [])).join(' | ')
              : 'Task yang terhambat atau terdampak keputusan ini.'}
          </span>
        </label>
      </div>
      <div className="err">{err}</div>
      <div className="mfoot">
        <div>
          {a && d.isAdminIn(p.id) && (
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
            Batal
          </button>
          <button className="btn primary" onClick={save} disabled={busy}>
            {a ? 'Simpan' : 'Catat keputusan'}
          </button>
        </div>
      </div>
    </>
  )
}
