// The KGR swimlane (Brief B5 §4): types, and the parser that turns the owner's export
// (docs/sim/sources/KGR_swimlane_detail.md) into the snapshot swimlane-kgr.json. Pure string
// work, no file access, so the script (scripts/kgr-swimlane.ts) and the test share it.
//
// What the snapshot never holds: the free-text "Catatan" notes, which name individuals and
// describe payment arrangements. The parser skips them, and redact() removes them from the copy
// of the export kept in the repository. Roles (lane, PIC role, need owner) are kept.

export type Path = 'RPA' | 'TRADING' | 'BERSAMA'
export type NeedStatus = 'ADA' | 'SEBAGIAN' | 'BELUM'

export interface Lane {
  no: number
  id: string
  description: string
  external: boolean
  steps: number
}

export interface Phase {
  ribbon: 'TRADING' | 'DEFAULT'
  name: string
  slots: [number, number]
}

export interface Need {
  label: string
  type: string
  source: string
  owner: string
  status: NeedStatus
}

export interface Account {
  group: string
  name: string
}

export interface Step {
  label: string
  slot: number
  lane: string
  path: Path
  form: string
  name: string
  /** the PIC as a role, as the swimlane names it */
  pic: string
  gate: string | null
  risk: string
  control: string
  documents: string[]
  accounts: Account[]
  drivers: string[]
  needs: Need[]
  /** the overview's ADA / SEBAGIAN / BELUM counts, kept to cross-check the detail tables */
  overview: [number, number, number]
}

export interface Gate {
  id: string
  type: 'DECISION' | 'DATA'
  title: string
  sub: string
  owner: string
  /** step labels that refer to it; empty for the gates no step refers to */
  steps: string[]
  why: string
}

export interface Swimlane {
  source: { file: string; read: string; database: string; entity: string }
  lanes: Lane[]
  phases: Phase[]
  paths: { RPA: string[]; TRADING: string[] }
  steps: Step[]
  gates: Gate[]
}

const SOURCE_FILE = 'docs/sim/sources/KGR_swimlane_detail.md'

/** the lines of the section under a heading, up to the next heading of the same or higher level */
function section(lines: string[], heading: string): string[] {
  const i = lines.findIndex((l) => l.trim() === heading)
  if (i < 0) throw new Error(`section not found: ${heading}`)
  const level = heading.match(/^#+/)?.[0].length ?? 2
  const out: string[] = []
  for (let j = i + 1; j < lines.length; j++) {
    const m = lines[j]?.match(/^(#+)\s/)
    if (m && (m[1]?.length ?? 9) <= level) break
    out.push(lines[j] ?? '')
  }
  return out
}

/** the body rows of the first markdown table in these lines, cells trimmed */
function tableRows(lines: string[]): string[][] {
  const rows = lines.map((l) => l.trim()).filter((l) => l.startsWith('|'))
  return rows.slice(2).map((r) => r.slice(1, r.endsWith('|') ? -1 : undefined).split('|').map((c) => c.trim()))
}

const list = (s: string | undefined): string[] => (s ? s.split('; ').map((x) => x.trim()).filter(Boolean) : [])
const field = (block: string[], name: string): string | undefined => {
  const l = block.find((x) => x.startsWith(`- **${name}:**`))
  return l?.slice(`- **${name}:**`.length).trim()
}

export function parseSwimlane(md: string): Swimlane {
  const lines = md.split('\n')

  const read = md.match(/dibaca (\d{1,2}) Oktober (\d{4})/)
  const source = { file: SOURCE_FILE, read: read ? `${read[2]}-10-${read[1]?.padStart(2, '0')}` : '', database: 'Personal OS, tabel os_process_*', entity: 'KGR' }

  const lanes: Lane[] = tableRows(section(lines, '## Lane')).map(([no, id, description, ext, n]) => ({
    no: Number(no), id: id ?? '', description: description ?? '', external: ext === 'ya', steps: Number(n),
  }))

  const phases: Phase[] = tableRows(section(lines, '## Fase (ribbon)')).map(([ribbon, name, slot]) => {
    const [a, b] = (slot ?? '').split('–').map(Number)
    return { ribbon: ribbon === 'TRADING' ? 'TRADING' : 'DEFAULT', name: name ?? '', slots: [a ?? 0, b ?? a ?? 0] }
  })

  const flow = section(lines, '## Urutan alur').join('\n')
  const path = (name: string): string[] => {
    const m = flow.match(new RegExp(`\\*\\*Jalur ${name} \\(\\d+ step\\):\\*\\* ([^\\n]+)`))
    return m?.[1] ? m[1].split('→').map((x) => x.trim()) : []
  }
  const paths = { RPA: path('RPA'), TRADING: path('Trading') }

  const overview = new Map(
    tableRows(section(lines, '## Ikhtisar step')).map(([slot, label, lane, jalur, form, name, pic, gate, needs]) => [
      label ?? '',
      { slot: Number(slot), lane: lane ?? '', path: (jalur ?? 'RPA') as Path, form: form ?? '', name: name ?? '', pic: pic ?? '', gate: gate || null, needs: (needs ?? '0/0/0').split('/').map(Number) as [number, number, number] },
    ]),
  )

  // the step details: "#### <label> · <name>" blocks under "## Detail per step"
  const detail = section(lines, '## Detail per step')
  const steps: Step[] = []
  for (let i = 0; i < detail.length; i++) {
    const h = detail[i]?.match(/^#### (\S+) · (.+)$/)
    if (!h) continue
    const label = h[1] ?? ''
    const block: string[] = []
    let inNote = false
    for (let j = i + 1; j < detail.length && !detail[j]?.startsWith('#'); j++) {
      const l = detail[j] ?? ''
      // the free-text notes are skipped, never parsed: they name individuals
      if (l.startsWith('- **Catatan:**')) {
        inNote = true
        continue
      }
      if (inNote && l.startsWith('  >')) continue
      inNote = false
      block.push(l)
    }
    const o = overview.get(label)
    if (!o) throw new Error(`step ${label} is not in the overview`)
    const needs: Need[] = tableRows(block).map(([nl, type, src, owner, status]) => ({ label: nl ?? '', type: type ?? '', source: src ?? '', owner: owner ?? '', status: (status ?? 'BELUM') as NeedStatus }))
    const gate = block.find((l) => l.startsWith('- **Gate '))?.match(/\*\*Gate (TBC-[\w]+)\*\*/)?.[1] ?? null
    steps.push({
      label, slot: o.slot, lane: o.lane, path: o.path, form: o.form, name: h[2] ?? o.name, pic: o.pic, gate: gate ?? o.gate,
      risk: field(block, 'Risiko') ?? '', control: field(block, 'Kontrol') ?? '',
      documents: list(field(block, 'Dokumen')),
      accounts: list(field(block, 'Akun (COA)')).map((a) => {
        const k = a.indexOf(' — ')
        return k < 0 ? { group: '', name: a } : { group: a.slice(0, k), name: a.slice(k + 3) }
      }),
      drivers: list(field(block, 'Driver')),
      needs,
      overview: o.needs,
    })
  }

  const gates: Gate[] = tableRows(section(lines, '## Register gate (TBC)')).map(([id, type, title, sub, owner, refs, why]) => ({
    id: id ?? '', type: type === 'DATA' ? 'DATA' : 'DECISION', title: title ?? '', sub: sub ?? '', owner: owner ?? '',
    steps: refs && refs !== '—' ? refs.split(',').map((x) => x.trim()) : [], why: why ?? '',
  }))

  return { source, lanes, phases, paths, steps, gates }
}

/** The export with its free-text "Catatan" blocks removed, for the copy kept in the repository. */
export function redact(md: string): string {
  const out: string[] = []
  let inNote = false
  for (const l of md.split('\n')) {
    if (l.startsWith('- **Catatan:**')) {
      inNote = true
      out.push('- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_')
      continue
    }
    if (inNote && l.startsWith('  >')) continue
    inNote = false
    out.push(l)
  }
  const text = out.join('\n')
  const marker = '> Salinan repositori: setiap blok **Catatan** (teks bebas) dihapus oleh `scripts/kgr-swimlane.ts redact`; isi lain sama dengan ekspor pemilik.'
  return text.includes(marker) ? text : text.replace(/\n## Ringkasan/, `\n${marker}\n\n## Ringkasan`)
}
