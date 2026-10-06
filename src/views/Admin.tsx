// Owner admin (BRIEF §3, M3): people, project access, entities, holidays, step templates, settings.
// The owner is the only one who grants access; RLS enforces it whatever the UI shows.
import { Head } from '../app/bits.tsx'
import { setUI, useUI } from '../app/ui.ts'
import { AdminAccess } from './admin/Access.tsx'
import { AdminEntities } from './admin/Entities.tsx'
import { AdminHolidays } from './admin/Holidays.tsx'
import { AdminPeople } from './admin/People.tsx'
import { AdminSettings } from './admin/Settings.tsx'
import { AdminTemplates } from './admin/Templates.tsx'

const TABS: [string, string][] = [
  ['orang', 'Orang'],
  ['akses', 'Akses project'],
  ['entitas', 'Entitas'],
  ['libur', 'Hari libur'],
  ['template', 'Template value chain'],
  ['pengaturan', 'Pengaturan'],
]

export function Admin() {
  const ui = useUI()
  const tab = TABS.some(([k]) => k === ui.adminTab) ? ui.adminTab : 'orang'
  return (
    <>
      <Head eyebrow="Hanya owner yang bisa membuka halaman ini" title="Admin" />
      <div className="toolbar">
        <div className="pills" role="tablist">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setUI({ adminTab: k })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {tab === 'orang' ? (
        <AdminPeople />
      ) : tab === 'akses' ? (
        <AdminAccess />
      ) : tab === 'entitas' ? (
        <AdminEntities />
      ) : tab === 'libur' ? (
        <AdminHolidays />
      ) : tab === 'template' ? (
        <AdminTemplates />
      ) : (
        <AdminSettings />
      )}
    </>
  )
}
