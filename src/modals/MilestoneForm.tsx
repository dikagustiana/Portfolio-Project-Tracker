// Milestone form (prototype openMs): a condition with a target date, planned backward from the
// outcome. A new milestone goes before the first one (planning backward) or after the last.
import { useState } from 'react'
import { Tip } from '../app/bits.tsx'
import { useOverlay } from '../app/overlay-context.ts'
import { TwoStep } from '../app/overlay.tsx'
import { useBoard } from '../data/board-context.ts'
import type { Id, Milestone, Project } from '../domain/index.ts'
import { useBad, useSubmit } from './form.ts'
import { ACTIVITY, pick, judgePeople } from './logic.ts'
import { Gone, PersonOptions } from './parts.tsx'

export function MilestoneForm({ projectId, id }: { projectId: Id; id?: Id }) {
  const { d } = useBoard()
  const p = d.project(projectId)
  const m = id ? d.mstone(id) : undefined
  if (!p || (id && !m)) return <Gone />
  return <MsBody p={p} m={m ?? null} />
}

interface Fields {
  title: string
  target: string
  approver: Id
  criteria: string
  trigger: string
  fallback: string
  mode: 'slow' | 'fast'
  pos: 'before' | 'after'
}

function MsBody({ p, m }: { p: Project; m: Milestone | null }) {
  const { d, board, actions } = useBoard()
  const { close } = useOverlay()
  const { busy, err, setErr, run } = useSubmit()
  const bad = useBad()
  const ms = d.pms(p.id)
  const pms = judgePeople(board, p.id)
  const [f, setF] = useState<Fields>(() => ({
    title: m?.title ?? '',
    target: m?.target ?? '',
    approver: pick(pms, m?.approver),
    criteria: m?.criteria ?? '',
    trigger: m?.trigger ?? '',
    fallback: m?.fallback ?? '',
    mode: m?.mode ?? 'slow',
    pos: 'before',
  }))
  const [adv, setAdv] = useState(() => !!(m && (m.criteria || m.trigger || m.fallback)))
  const set = <K extends keyof Fields>(k: K, v: Fields[K], fieldId?: string) => {
    setF((x) => ({ ...x, [k]: v }))
    if (fieldId) bad.ok(fieldId)
  }
  const first = ms[0]
  const last = ms[ms.length - 1]
  const target = first ? `${d.msNo(first)}: ${first.title}` : `hasil akhir: ${p.outcome || p.name}`
  const pm = d.pmOf(p)

  const save = () => {
    const e = bad.need([
      ['msTitle', f.title, 'Isi kondisi milestone.'],
      ['msTarget', f.target, 'Isi target tanggal milestone.'],
    ])
    if (e) return setErr(e)
    void run(
      () =>
        actions.saveMilestone({
          ...(m ? { id: m.id } : { project_id: p.id, position: f.pos }),
          title: f.title.trim(),
          criteria: f.criteria.trim(),
          trigger: f.trigger.trim(),
          fallback: f.fallback.trim(),
          approver_person_id: f.approver,
          target: f.target,
          mode: f.mode,
        }),
      { ok: m ? 'Milestone disimpan' : 'Milestone ditambahkan' },
    )
  }

  return (
    <>
      <h2>{m ? 'Edit milestone' : 'Milestone baru'}</h2>
      <div className="req-note">Kondisi dan target tanggal wajib diisi. Isian di bagian yang dilipat boleh dilengkapi nanti.</div>
      {!m && (
        <div className="prompt">
          Apa yang harus <b>sudah benar</b> tepat sebelum <b>{target}</b> tercapai?
          <Tip k="mundur" />
        </div>
      )}
      <label className="f">
        <span>
          Kondisi milestone
          <Tip k="milestone" />
        </span>
        <input
          className={bad.cls('msTitle')}
          id="msTitle"
          value={f.title}
          maxLength={140}
          placeholder="mis. Account mapping TB disetujui Accounting"
          onChange={(e) => set('title', e.target.value, 'msTitle')}
        />
      </label>
      <div className="warn">
        {ACTIVITY.test(f.title.trim()) && <div>Ini terdengar seperti aktivitas. Tulis kondisi akhirnya, supaya bisa dicek sudah tercapai atau belum.</div>}
      </div>
      <div className="fgrid">
        <label className="f">
          Target tanggal
          <input className={bad.cls('msTarget')} type="date" id="msTarget" value={f.target} onChange={(e) => set('target', e.target.value, 'msTarget')} />
        </label>
        <label className="f">
          <span>
            Pemutus
            <Tip k="pemutus" />
          </span>
          <select className="inp" id="msAppr" value={f.approver} onChange={(e) => set('approver', e.target.value)}>
            <PersonOptions people={pms} empty={pm ? `PM (${d.mname(pm)})` : 'Project Manager'} />
          </select>
        </label>
      </div>
      {!m && (
        <label className="f">
          Posisi
          <select className="inp" id="msPos" value={f.pos} onChange={(e) => set('pos', e.target.value === 'after' ? 'after' : 'before')}>
            <option value="before">{first ? `Sebelum ${d.msNo(first)} (menyusun mundur)` : 'Milestone pertama'}</option>
            {last && <option value="after">Setelah {d.msNo(last)} (paling akhir)</option>}
          </select>
        </label>
      )}
      <details className="adv" open={adv} onToggle={(e) => setAdv(e.currentTarget.open)}>
        <summary>Syarat, tanda bahaya &amp; rencana cadangan</summary>
        <div className="in">
          <label className="f">
            <span>
              Syarat dianggap tercapai
              <Tip k="syarat" />
            </span>
            <textarea className="inp" id="msCrit" placeholder="Apa yang harus terbukti" value={f.criteria} onChange={(e) => set('criteria', e.target.value)} />
          </label>
          <label className="f">
            <span>
              Tanda bahaya
              <Tip k="bahaya" />
            </span>
            <textarea
              className="inp"
              id="msTrig"
              placeholder="mis. data WMS belum masuk 5 hari kerja setelah tutup buku"
              value={f.trigger}
              onChange={(e) => set('trigger', e.target.value)}
            />
          </label>
          <label className="f">
            <span>
              Rencana cadangan
              <Tip k="cadangan" />
            </span>
            <textarea
              className="inp"
              id="msFb"
              placeholder="Apa yang dilakukan kalau milestone ini dihentikan"
              value={f.fallback}
              onChange={(e) => set('fallback', e.target.value)}
            />
          </label>
          <label className="f">
            <span>
              Sifat
              <Tip k="sifat" />
            </span>
            <select className="inp" id="msMode" value={f.mode} onChange={(e) => set('mode', e.target.value === 'fast' ? 'fast' : 'slow')}>
              <option value="slow">Perlu dikaji · masih banyak yang belum pasti</option>
              <option value="fast">Siap eksekusi · sudah jelas, tinggal jalan</option>
            </select>
          </label>
        </div>
      </details>
      <div className="err">{err}</div>
      <div className="mfoot">
        <div>
          {m && (
            <TwoStep
              className="btn danger"
              label="Hapus milestone"
              armed={`Yakin? ${d.mtasks(m.id).length} task jadi tanpa milestone`}
              disabled={busy}
              onConfirm={() => void run(() => actions.deleteMilestone(m.id), { ok: 'Milestone dihapus' })}
            />
          )}
        </div>
        <div className="row">
          <button className="btn ghost" onClick={close}>
            Batal
          </button>
          <button className="btn primary" onClick={save} disabled={busy}>
            {m ? 'Simpan' : 'Tambah milestone'}
          </button>
        </div>
      </div>
    </>
  )
}
