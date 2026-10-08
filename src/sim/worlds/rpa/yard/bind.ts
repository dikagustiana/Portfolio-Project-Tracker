// Cards and metrics for the slaughterhouse. The swimlane side is real: every step, lane, phase,
// gate and data need comes from the KGR snapshot (data/swimlane-kgr.json) and is shown as it is,
// roles only — never a free-text note, never a personal name. Every quantity and rupiah figure
// is synthetic and labelled so; until the synthetic batch exists (W3) those tiles say so.
import { formatNumber, formatPct } from '../../../core/format.ts'
import type { Block, Card, Pulse } from '../../../yard/types.ts'
import raw from '../data/swimlane-kgr.json'
import type { Gate, Need, NeedStatus, Path, Step, Swimlane } from '../data/swimlane.ts'
import { PLACE_STEPS } from './layout.ts'
import type { PlaceId } from './layout.ts'

export const SW = raw as unknown as Swimlane
export const GAP = 'Belum ada data'
export const DUMMY = 'Ilustrasi: angka dummy, bukan data KGR'
export const SOURCE = 'Swimlane KGR: Personal OS (tabel os_process_*, entity KGR), dibaca 7 Oktober 2026. Ditampilkan apa adanya; catatan bebas dan nama orang tidak ditampilkan.'

export type Jalur = 'rpa' | 'trading' | 'both'

const title = (s: string): string => {
  const t = s.toLowerCase().replace(/\beod\b/, 'EOD')
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const ribbon = (r: 'DEFAULT' | 'TRADING') => SW.phases.filter((p) => p.ribbon === r)
/** the stage tracker walks the swimlane's phases: ten for RPA, five for Trading */
export const STAGES = { RPA: ribbon('DEFAULT').map((p) => title(p.name)), TRADING: ribbon('TRADING').map((p) => title(p.name)) }

export const stepOf = (label: string): Step => {
  const s = SW.steps.find((x) => x.label === label)
  if (!s) throw new Error(`no step ${label}`)
  return s
}
export const gateOf = (id: string): Gate | undefined => SW.gates.find((g) => g.id === id)
const laneOf = (id: string) => SW.lanes.find((l) => l.id === id)

/** the phase a step sits in: Trading-only steps on the Trading ribbon, the rest on the default one */
export function phaseOf(s: Step): { channel: 'RPA' | 'TRADING'; at: number; name: string } {
  const channel = s.path === 'TRADING' ? 'TRADING' : 'RPA'
  const phases = ribbon(channel === 'TRADING' ? 'TRADING' : 'DEFAULT')
  const at = Math.max(0, phases.findIndex((p) => s.slot >= p.slots[0] && s.slot <= p.slots[1]))
  return { channel, at, name: title(phases[at]?.name ?? '') }
}

/** whether a step belongs to the path the Jalur switch shows */
export const onPath = (s: Step, j: Jalur): boolean => j === 'both' || s.path === 'BERSAMA' || (j === 'rpa' ? s.path === 'RPA' : s.path === 'TRADING')

export function needCounts(steps: Step[]): [number, number, number] {
  const n = steps.flatMap((s) => s.needs)
  return (['ADA', 'SEBAGIAN', 'BELUM'] as NeedStatus[]).map((k) => n.filter((x) => x.status === k).length) as [number, number, number]
}

const PATH_LABEL: Record<Path, string> = { RPA: 'RPA', TRADING: 'Trading', BERSAMA: 'Bersama (RPA dan Trading)' }

function needBlock(needs: Need[]): Block {
  const [a, s, b] = (['ADA', 'SEBAGIAN', 'BELUM'] as NeedStatus[]).map((k) => needs.filter((x) => x.status === k).length)
  return {
    kind: 'needs', title: `Kebutuhan data · ADA ${a} · SEBAGIAN ${s} · BELUM ${b}`,
    items: needs.map((n) => ({ label: n.label, status: n.status, owner: [n.type, n.owner || 'belum ada owner', n.source || 'belum ada sumber'].join(' · ') })),
  }
}

export function gateBlocks(g: Gate): Block[] {
  return [
    { kind: 'rows', title: `Gate ${g.id} · ${g.type}`, rows: [['Judul', g.title], ['Owner', g.owner], ['Langkah yang diblok', g.steps.length ? g.steps.join(', ') : 'tidak dirujuk langkah mana pun'], ['Rujukan', g.sub]] },
    { kind: 'text', title: 'Kenapa penting', text: g.why },
  ]
}

/** a step as the swimlane card shows it */
export function stepBlocks(s: Step): Block[] {
  const lane = laneOf(s.lane)
  const ph = phaseOf(s)
  const out: Block[] = [
    {
      kind: 'rows', title: 'Swimlane',
      rows: [
        ['Lane', `${s.lane}${lane?.external ? ' · eksternal' : ''}`],
        ['PIC (peran)', s.pic || 'belum ditetapkan'],
        ['Fase', `${ph.name} (${ph.channel === 'TRADING' ? 'ribbon Trading' : 'RPA'})`],
        ['Jalur', PATH_LABEL[s.path]],
        ...(s.form ? [['Form', s.form] as [string, string]] : []),
      ],
    },
  ]
  if (s.risk) out.push({ kind: 'text', title: 'Risiko', text: s.risk })
  if (s.control) out.push({ kind: 'text', title: 'Kontrol', text: s.control })
  if (s.documents.length) out.push({ kind: 'list', title: 'Dokumen', items: s.documents })
  if (s.accounts.length) out.push({ kind: 'list', title: 'Akun (COA)', items: s.accounts.map((a) => (a.group ? `${a.group} — ${a.name}` : a.name)) })
  if (s.drivers.length) out.push({ kind: 'list', title: 'Driver', items: s.drivers })
  if (s.needs.length) out.push(needBlock(s.needs))
  else out.push({ kind: 'text', title: 'Kebutuhan data', text: 'Belum ada kebutuhan data tercatat di swimlane.' })
  const g = s.gate ? gateOf(s.gate) : undefined
  if (g) out.push(...gateBlocks(g))
  if (!s.risk && !s.documents.length && !s.drivers.length && !g) out.push({ kind: 'text', title: 'Catatan swimlane', text: 'Langkah ini belum punya risiko, dokumen, driver, maupun gate di swimlane.' })
  return out
}

/** the swimlane card of an object that carries one or more steps */
export function swimlaneCard(name: string, labels: string[], jalur: Jalur, extra: Partial<Card> = {}): Card {
  const all = labels.map(stepOf)
  const steps = all.filter((s) => onPath(s, jalur))
  const shown = steps.length ? steps : all
  const [a, sb, b] = needCounts(shown)
  const lanes = [...new Set(shown.map((s) => s.lane))]
  const ext = lanes.some((l) => laneOf(l)?.external)
  const first = shown[0]
  const ph = first ? phaseOf(first) : null
  return {
    kind: `Swimlane KGR · ${lanes.join(' · ')}${ext ? ' · eksternal' : ''}`,
    title: name,
    status: `${shown.length} langkah · data ADA ${a} · SEBAGIAN ${sb} · BELUM ${b}`,
    tone: b > 0 ? 'warn' : 'ok',
    channel: ph?.channel,
    shares: {
      label: 'kesiapan data di sini',
      items: [
        { key: 'ada', color: 'var(--y-ok)', value: a, label: `ADA ${a}` },
        { key: 'sebagian', color: 'var(--y-warn)', value: sb, label: `SEBAGIAN ${sb}` },
        { key: 'belum', color: 'var(--y-bad)', value: b, label: `BELUM ${b}` },
      ].filter((x) => x.value > 0),
    },
    rows: [],
    engine: [],
    lead: [{ kind: 'steps', title: 'Langkah swimlane di sini', items: shown.map((s) => ({ key: s.label, label: `${s.label} · ${s.name}`, blocks: stepBlocks(s) })) }],
    source: SOURCE,
    stage: ph ? { channel: ph.channel, at: ph.at } : undefined,
    ...extra,
  }
}

export function gateCard(g: Gate): Card {
  return {
    kind: `Gate ${g.type === 'DATA' ? 'data' : 'keputusan'} · terbuka`, title: g.id, status: g.title, tone: 'warn',
    rows: [['Jenis', g.type], ['Owner', g.owner], ['Langkah yang diblok', g.steps.length ? g.steps.join(', ') : '—']],
    engine: [],
    blocks: [{ kind: 'text', title: 'Kenapa penting', text: g.why }, { kind: 'rows', title: 'Rujukan', rows: [['SOP / catatan register', g.sub]] }],
    source: SOURCE,
  }
}

/** the Kantor as a whole: its divisions by lane, and the gates no step refers to */
export function kantorCard(jalur: Jalur, divisions: { lane: string; steps: string[] }[]): Card {
  const free = SW.gates.filter((g) => g.steps.length === 0)
  return {
    kind: 'Kantor KGR · divisi per lane', title: 'Kantor', status: `${PLACE_STEPS.kantor.length} langkah swimlane · 4 divisi`, tone: 'live',
    rows: divisions.map((d) => {
      const st = d.steps.map(stepOf).filter((s) => onPath(s, jalur))
      const [a, s, b] = needCounts(st)
      return [d.lane, `${st.length} langkah · ${a}/${s}/${b}`] as [string, string]
    }),
    engine: [],
    blocks: [
      { kind: 'list', title: `${free.length} gate tanpa langkah yang merujuk`, items: free.map((g) => `${g.id} (${g.type}) · ${g.title} · owner ${g.owner}`) },
    ],
    notes: ['Angka per divisi: ADA / SEBAGIAN / BELUM kebutuhan data langkah-langkahnya. Klik meja divisi untuk kartu swimlane-nya.'],
    source: SOURCE,
  }
}

// ---- the metrics bar ----------------------------------------------------------------------------

const W3 = 'batch sintetis dibangun di W3'
const LATER = 'dummy · menyusul di W3'

/** the operation's pulse: synthetic figures, not built yet */
export function pulse(): Pulse[] {
  return [
    { label: 'Ekor · kg masuk lini', value: '—', sub: LATER, missing: W3 },
    { label: 'Susut holding', value: '—', sub: LATER, missing: W3 },
    { label: 'Yield vs benchmark', value: '—', sub: LATER, missing: W3 },
    { label: 'Kg Fresh · Frozen', value: '—', sub: LATER, missing: W3 },
    { label: 'Sisa fresh (cutoff)', value: '—', sub: LATER, missing: W3 },
  ]
}

export function costLens(): Pulse[] {
  return [
    { label: 'Biaya batch', value: '—', sub: `live bird · TKL · Pool A`, missing: W3 },
    { label: 'Alokasi NRV', value: '—', sub: '7 langkah', missing: W3 },
    { label: 'Separable', value: '—', sub: 'cut-up · MDM, sesudah alokasi', missing: W3 },
    { label: 'Pool B', value: '—', sub: 'ke SKU frozen, per kg beku', missing: W3 },
  ]
}

/** Lensa kesiapan data: the swimlane's real totals (for the path the Jalur switch shows) */
export function readiness(jalur: Jalur): Pulse[] {
  const steps = SW.steps.filter((s) => onPath(s, jalur))
  const [a, s, b] = needCounts(steps)
  const n = a + s + b
  const gates = new Set(steps.map((x) => x.gate).filter(Boolean))
  const free = SW.gates.filter((g) => g.steps.length === 0).length
  return [
    { label: 'Kebutuhan data', value: formatNumber(n), sub: `${steps.length} langkah · ${jalur === 'both' ? 'kedua jalur' : jalur === 'rpa' ? 'jalur RPA' : 'jalur Trading'}` },
    { label: 'ADA', value: formatNumber(a), sub: formatPct(n ? a / n : 0, 0), tone: 'ok' },
    { label: 'SEBAGIAN', value: formatNumber(s), sub: formatPct(n ? s / n : 0, 0), tone: 'warn' },
    { label: 'BELUM', value: formatNumber(b), sub: formatPct(n ? b / n : 0, 0), tone: 'bad' },
    { label: 'Gate terbuka', value: formatNumber(jalur === 'both' ? SW.gates.length : gates.size), sub: jalur === 'both' ? `${free} tanpa langkah (Kantor)` : 'dirujuk langkah jalur ini' },
  ]
}

/** a place's readiness bar (ADA, SEBAGIAN, BELUM of its steps' needs) */
export const placeReady = (id: PlaceId, jalur: Jalur): [number, number, number] => needCounts(PLACE_STEPS[id].map(stepOf).filter((s) => onPath(s, jalur)))
