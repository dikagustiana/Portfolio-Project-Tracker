// kgr-swimlane: keeps the KGR swimlane snapshot in step with the owner's export (Brief B5 §4).
//   node scripts/kgr-swimlane.ts redact <export.md>   copy a fresh export into the repository,
//                                                      its free-text "Catatan" blocks removed
//   node scripts/kgr-swimlane.ts                       regenerate src/sim/worlds/rpa/data/swimlane-kgr.json
//   node scripts/kgr-swimlane.ts --check               fail if the snapshot is out of date
// The export is read from the Personal OS database (tables os_process_*, entity_code = 'KGR').
// Its notes name individuals and describe payment arrangements, and this repository is public,
// so only the redacted copy is kept here and the snapshot never holds a note.
import { readFileSync, writeFileSync } from 'node:fs'
import { parseSwimlane, redact } from '../src/sim/worlds/rpa/data/swimlane.ts'

const SOURCE = 'docs/sim/sources/KGR_swimlane_detail.md'
const SNAPSHOT = 'src/sim/worlds/rpa/data/swimlane-kgr.json'

const [cmd, arg] = process.argv.slice(2)
if (cmd === 'redact') {
  if (!arg) throw new Error('usage: node scripts/kgr-swimlane.ts redact <export.md>')
  writeFileSync(SOURCE, redact(readFileSync(arg, 'utf8')))
  console.log(`${SOURCE} written (Catatan blocks removed)`)
} else {
  const sw = parseSwimlane(readFileSync(SOURCE, 'utf8'))
  const json = `${JSON.stringify(sw, null, 2)}\n`
  const needs = sw.steps.flatMap((s) => s.needs)
  const count = (st: string): number => needs.filter((n) => n.status === st).length
  console.log(`${sw.steps.length} step · ${sw.lanes.length} lane · ${sw.phases.length} fase · ${sw.gates.length} gate · ${needs.length} kebutuhan (ADA ${count('ADA')} · SEBAGIAN ${count('SEBAGIAN')} · BELUM ${count('BELUM')})`)
  if (cmd === '--check') {
    if (readFileSync(SNAPSHOT, 'utf8') !== json) {
      console.error(`${SNAPSHOT} is out of date: run node scripts/kgr-swimlane.ts`)
      process.exit(1)
    }
    console.log(`${SNAPSHOT} is up to date`)
  } else {
    writeFileSync(SNAPSHOT, json)
    console.log(`${SNAPSHOT} written`)
  }
}
