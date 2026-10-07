// Edit project (prototype openProject with an id). New projects go through the wizard. Only the
// owner deletes a project and changes the value-chain template or the parallel-gates switch.
import { useState } from 'react'
import { Tip } from '../app/bits.tsx'
import { useFlows } from '../app/flows.ts'
import { useOverlay } from '../app/overlay-context.ts'
import { TwoStep } from '../app/overlay.tsx'
import { go, setUI } from '../app/ui.ts'
import { useBoard } from '../data/board-context.ts'
import { GRADS, MATURITY } from '../domain/index.ts'
import type { Id, Maturity, Project } from '../domain/index.ts'
import { useBad, useSubmit } from './form.ts'
import { LOCK_MSG, pick, adminPeople } from './logic.ts'
import { Gone, PersonOptions } from './parts.tsx'

export function ProjectForm({ id }: { id: Id }) {
  const { d } = useBoard()
  const p = d.project(id)
  if (!p) return <Gone />
  return <ProjectBody p={p} />
}

interface Fields {
  name: string
  entity: string
  outcome: string
  measure: string
  owner: Id
  gate: boolean
  maturity: Maturity
  color: string
  parallel: boolean
  template: Id
}

function ProjectBody({ p }: { p: Project }) {
  const { d, board, extras, viewer, actions } = useBoard()
  const flows = useFlows()
  const { close } = useOverlay()
  const { busy, err, setErr, run } = useSubmit()
  const bad = useBad()
  const pms = adminPeople(board, p.id)
  const isSuper = viewer.isSuperAdmin
  const lk = !d.pActive(p)
  const [f, setF] = useState<Fields>(() => ({
    name: p.name,
    entity: p.entity,
    outcome: p.outcome,
    measure: p.measure,
    owner: pick(pms, d.pmOf(p)),
    gate: d.gated(p),
    maturity: p.maturity,
    color: p.color || 'samb3',
    parallel: p.parallelGates,
    template: p.stepTemplateId ?? '',
  }))
  const set = <K extends keyof Fields>(k: K, v: Fields[K], fieldId?: string) => {
    setF((x) => ({ ...x, [k]: v }))
    if (fieldId) bad.ok(fieldId)
  }

  const save = () => {
    const e = bad.need([
      ['pName', f.name, 'Isi nama project.'],
      ['pEnt', f.entity, 'Pilih entitasnya.'],
      ['pOutcome', f.outcome, 'Tulis hasil akhirnya.'],
      ['pMeasure', f.measure, 'Tulis cara tahu hasil akhir sudah tercapai.'],
      ['pOwner', f.owner, 'Pilih PM-nya.'],
    ])
    if (e) return setErr(e)
    void run(
      () =>
        actions.updateProject({
          id: p.id,
          name: f.name.trim(),
          entity_code: f.entity,
          outcome: f.outcome.trim(),
          measure: f.measure.trim(),
          pm_person_id: f.owner,
          gate_mode: f.gate,
          maturity: f.maturity,
          color: f.color,
          ...(isSuper ? { parallel_gates: f.parallel, step_template_id: f.template } : {}),
        }),
      { ok: 'Project disimpan', after: () => setUI({ view: 'project', pid: p.code || p.id }) },
    )
  }

  return (
    <>
      <h2>Edit project</h2>
      <div className="req-note">Semua isian wajib diisi.</div>
      {lk && (
        <div className="warn">
          <div>{LOCK_MSG}</div>
        </div>
      )}
      <div className="fgrid">
        <label className="f">
          Nama project
          <input
            className={bad.cls('pName')}
            id="pName"
            value={f.name}
            placeholder="mis. Margin Bridge SAMB"
            maxLength={80}
            disabled={lk}
            onChange={(e) => set('name', e.target.value, 'pName')}
          />
        </label>
        <label className="f">
          Entitas
          <select className={bad.cls('pEnt')} id="pEnt" value={f.entity} disabled={lk} onChange={(e) => set('entity', e.target.value, 'pEnt')}>
            <option value="">Pilih entitas…</option>
            {extras.entities.map((x) => (
              <option key={x.code} value={x.code}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="f">
        <span>
          Hasil akhir
          <Tip k="hasil" />
        </span>
        <textarea
          className={bad.cls('pOutcome')}
          id="pOutcome"
          placeholder="mis. Laporan kontribusi per principal untuk data November terkirim ke manajemen dan terekonsiliasi ke P&L SAMB"
          value={f.outcome}
          disabled={lk}
          onChange={(e) => set('outcome', e.target.value, 'pOutcome')}
        />
      </label>
      <label className="f">
        <span>
          Cara tahu sudah tercapai
          <Tip k="ukur" />
        </span>
        <input
          className={bad.cls('pMeasure')}
          id="pMeasure"
          value={f.measure}
          placeholder="mis. Total kontribusi semua principal sama dengan P&L SAMB, selisih nol"
          disabled={lk}
          onChange={(e) => set('measure', e.target.value, 'pMeasure')}
        />
      </label>
      <label className="f">
        <span>
          PM
          <Tip k="pm" />
        </span>
        <select className={bad.cls('pOwner')} id="pOwner" value={f.owner} disabled={lk} onChange={(e) => set('owner', e.target.value, 'pOwner')}>
          <PersonOptions people={pms} empty="Pilih PM…" />
        </select>
      </label>
      <details className="adv">
        <summary>Pengaturan lanjutan</summary>
        <div className="in">
          <label className="toggle">
            <input type="checkbox" id="pGate" checked={f.gate} disabled={lk} onChange={(e) => set('gate', e.target.checked)} />
            <span>
              <b>Pakai alur pemeriksaan</b>
              <Tip k="pemeriksaan" />
              <br />
              <span className="sub">Task selesai diajukan dengan bukti dan diterima pemeriksa.</span>
            </span>
          </label>
          <label className="f">
            <span>
              Target hasil
              <Tip k="kematangan" />
            </span>
            <select className="inp" id="pMat" value={f.maturity} disabled={lk} onChange={(e) => set('maturity', e.target.value as Maturity)}>
              {(Object.entries(MATURITY) as [Maturity, string][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="f">
            Warna kartu
            <div className="swatches">
              {GRADS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`sw g-${g}${g === f.color ? ' on' : ''}`}
                  aria-label={`Warna ${g}`}
                  aria-pressed={g === f.color}
                  disabled={lk}
                  onClick={() => set('color', g)}
                />
              ))}
            </div>
          </div>
          {isSuper && (
            <>
              <label className="toggle">
                <input type="checkbox" id="pPar" checked={f.parallel} disabled={lk} onChange={(e) => set('parallel', e.target.checked)} />
                <span>
                  <b>Milestone boleh berjalan paralel</b>
                  <br />
                  <span className="sub">
                    Task boleh mulai sebelum milestone sebelumnya lulus, tanpa peringatan &quot;Mulai sebelum … selesai&quot;. Hanya owner yang bisa
                    mengubah.
                  </span>
                </span>
              </label>
              <label className="f">
                Template value chain
                <select className="inp" id="pTpl" value={f.template} disabled={lk} onChange={(e) => set('template', e.target.value)}>
                  <option value="">Tanpa value chain</option>
                  {board.templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <span className="hint">
                  Step yang bisa dipilih di task, tab Value chain, dan strip di dashboard. Mengganti template melepas step yang sudah dipilih di task.
                  Hanya owner yang bisa mengubah.
                </span>
              </label>
            </>
          )}
        </div>
      </details>
      <div className="err">{err}</div>
      <div className="mfoot">
        <div className="row" style={{ gap: 6 }}>
          {isSuper && (
            <TwoStep
              className="btn danger"
              label="Hapus project"
              armed={`Yakin? ${d.ptasks(p.id).length} task ikut terhapus`}
              disabled={busy}
              onConfirm={() => void run(() => actions.deleteProject(p.id), { ok: 'Project dihapus', after: () => go({ view: 'portfolio' }) })}
            />
          )}
          {d.pActive(p) && d.canOwn(p) && (
            <button className="btn ghost" onClick={() => flows.openClose(p.id, 'stop')}>
              Hentikan project
            </button>
          )}
        </div>
        <div className="row">
          <button className="btn ghost" onClick={close}>
            {lk ? 'Tutup' : 'Batal'}
          </button>
          {!lk && (
            <button className="btn primary" onClick={save} disabled={busy}>
              Simpan
            </button>
          )}
        </div>
      </div>
    </>
  )
}
