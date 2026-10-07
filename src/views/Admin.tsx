// Super admin (spec §23–25): people and accounts, invitations, the access matrix, business
// functions, entities, holidays, step templates and settings. Project access itself is granted
// per project (Anggota, invitations, matrix); RLS and the RPCs enforce it whatever the UI shows.
import { Head } from '../app/bits.tsx'
import { setUI, useUI } from '../app/ui.ts'
import { AdminEntities } from './admin/Entities.tsx'
import { AdminFunctions } from './admin/Functions.tsx'
import { AdminHolidays } from './admin/Holidays.tsx'
import { AdminInvitations } from './admin/Invitations.tsx'
import { AdminMatrix } from './admin/Matrix.tsx'
import { AdminPeople } from './admin/People.tsx'
import { AdminSettings } from './admin/Settings.tsx'
import { AdminTemplates } from './admin/Templates.tsx'

const TABS: [string, string][] = [
  ['orang', 'Orang & akun'],
  ['undangan', 'Undangan'],
  ['akses', 'Matriks akses'],
  ['fungsi', 'Fungsi'],
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
      <Head eyebrow="Hanya super admin yang bisa membuka halaman ini" title="Admin" />
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
      ) : tab === 'undangan' ? (
        <AdminInvitations />
      ) : tab === 'akses' ? (
        <AdminMatrix />
      ) : tab === 'fungsi' ? (
        <AdminFunctions />
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
