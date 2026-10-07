// The timeline (brief §7.6): day scrubber Hari 1–30, play/pause, speeds 1×/4×/16×, and the
// 11 step markers of one sample cycle with jump-to-step.

export interface CycleStep {
  step: number
  day: number
  label: string
  ref: string
}

const STEP_SHORT: Record<number, string> = {
  1: 'Forecast', 2: 'Cek stok', 3: 'PO', 4: 'Inbound', 5: 'Simpan', 6: 'Outbound',
  7: 'Muat & jalan', 8: 'Serah terima', 9: 'Invoice', 10: 'Faktur pajak', 11: 'Kas masuk',
}

interface TimelineProps {
  day: number
  days: number
  playing: boolean
  speed: number
  cycle: CycleStep[]
  onDay: (day: number) => void
  onPlay: (playing: boolean) => void
  onSpeed: (speed: number) => void
}

export function Timeline({ day, days, playing, speed, cycle, onDay, onPlay, onSpeed }: TimelineProps) {
  return (
    <div className="sim-timeline" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '10px 14px' }}>
      <button type="button" className="btn" aria-label={playing ? 'Jeda' : 'Putar'} onClick={() => onPlay(!playing)}>
        {playing ? '⏸' : '▶'}
      </button>
      <div role="group" aria-label="Kecepatan" style={{ display: 'flex', gap: 4 }}>
        {[1, 4, 16].map((s) => (
          <button
            key={s}
            type="button"
            className={`btn ghost${speed === s ? ' on' : ''}`}
            aria-pressed={speed === s}
            onClick={() => onSpeed(s)}
            style={{ padding: '2px 8px', fontWeight: speed === s ? 800 : 500 }}
          >
            {s}×
          </button>
        ))}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220 }}>
        <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>Hari {day}</span>
        <input
          type="range"
          min={1}
          max={days}
          step={1}
          value={day}
          onChange={(e) => onDay(Number(e.currentTarget.value))}
          aria-label="Geser hari"
          style={{ flex: 1, accentColor: 'var(--accent)' }}
        />
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{days}</span>
      </label>
      <div role="group" aria-label="Lompat ke langkah siklus" style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {cycle.map((m) => (
          <button
            key={m.step}
            type="button"
            onClick={() => onDay(m.day)}
            title={`Langkah ${m.step} (hari ${m.day}): ${m.label}`}
            style={{
              fontSize: 10.5,
              padding: '2px 6px',
              borderRadius: 6,
              border: `1px solid ${day === m.day ? 'var(--accent)' : 'var(--line)'}`,
              background: day === m.day ? 'var(--accent-soft)' : 'var(--surface-2)',
              color: 'var(--ink)',
              cursor: 'pointer',
              fontWeight: day === m.day ? 800 : 500,
            }}
          >
            {m.step}. {STEP_SHORT[m.step] ?? m.label}
          </button>
        ))}
      </div>
    </div>
  )
}
