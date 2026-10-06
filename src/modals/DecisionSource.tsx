// "Who actually decided" fields shared by the gate, ask and close dialogs (prototype decSrcHtml).
// The person who clicks is recorded by the database; these say who decided, when and where.
import { useBoard } from '../data/board-context.ts'
import type { DecSrc } from './form.ts'

export function DecisionSource({ px, value, onChange }: { px: string; value: DecSrc; onChange: (v: DecSrc) => void }) {
  const { board } = useBoard()
  return (
    <>
      <div className="fgrid">
        <label className="f">
          <span>Diputuskan oleh</span>
          <input
            className="inp"
            id={`${px}By`}
            list={`${px}People`}
            maxLength={80}
            placeholder="Kosongkan kalau kamu sendiri"
            value={value.by}
            onChange={(e) => onChange({ ...value, by: e.target.value })}
          />
          <span className="hint">Isi kalau keputusannya diambil orang lain, di rapat atau lewat arahan.</span>
        </label>
        <label className="f">
          <span>Tanggal keputusan</span>
          <input className="inp" type="date" id={`${px}On`} value={value.on} onChange={(e) => onChange({ ...value, on: e.target.value })} />
        </label>
      </div>
      <label className="f">
        <span>Forum atau sumber</span>
        <input
          className="inp"
          id={`${px}Forum`}
          maxLength={120}
          placeholder="mis. Weekly review GM, atau arahan lewat WhatsApp"
          value={value.forum}
          onChange={(e) => onChange({ ...value, forum: e.target.value })}
        />
      </label>
      <datalist id={`${px}People`}>
        {board.people.map((m) => (
          <option key={m.id} value={m.name} />
        ))}
      </datalist>
    </>
  )
}
