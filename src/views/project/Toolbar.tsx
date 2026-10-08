// Tabs and filters under the project header: Milestone | Task | Keputusan | Aktivitas | Anggota,
// and under Task the four views with the PIC filter and search (prototype .toolbar, fWho/fQ).
import { useRef, useState } from "react";
import { Icon } from "../../app/bits.tsx";
import { setUI, useUI } from "../../app/ui.ts";
import type { Tab } from "../../app/ui.ts";
import { useBoard } from "../../data/board-context.ts";
import type { Project } from "../../domain/index.ts";
import {
  effectiveWho,
  memberOptions,
  taskViews,
  TOP_TABS,
  topOf,
} from "./model.ts";
import type { TopTab } from "./model.ts";

/** Search box delay, like the prototype. */
const SEARCH_DEBOUNCE_MS = 250;

export function Toolbar({ p, tab }: { p: Project; tab: Tab }) {
  const ui = useUI();
  const { d, board } = useBoard();
  const opts = memberOptions(d, p.id);
  const top = topOf(tab);
  const views = taskViews(d, p);
  const count: Partial<Record<TopTab, number>> = {
    task: d.ptasks(p.id).filter(d.isLeaf).length,
    keputusan: d.openAsks(p.id).length,
    anggota: board.memberships.filter((m) => m.projectId === p.id).length,
  };
  // "Task" returns to the task view used last.
  const open = (k: TopTab) =>
    setUI({
      tab:
        k === "task"
          ? views.some(([v]) => v === ui.taskView)
            ? ui.taskView
            : "list"
          : k,
    });
  return (
    <>
      <div className="toolbar">
        <div className="pills" role="tablist" aria-label="Bagian project">
          {TOP_TABS.map(([k, l]) => (
            <button
              key={k}
              role="tab"
              aria-selected={top === k}
              className={top === k ? "on" : ""}
              onClick={() => open(k)}
            >
              {l}
              {count[k] ? <span className="pill-n">{count[k]}</span> : null}
            </button>
          ))}
        </div>
      </div>
      {top === "task" && (
        <div className="toolbar sub-toolbar">
          <div className="pills" role="tablist" aria-label="Tampilan task">
            {views.map(([k, l]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                className={tab === k ? "on" : ""}
                onClick={() => setUI({ tab: k, taskView: k })}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="row">
            {tab === "gantt" && (
              <div className="pills">
                <button
                  className={ui.zoom === "day" ? "on" : ""}
                  onClick={() => setUI({ zoom: "day" })}
                >
                  Harian
                </button>
                <button
                  className={ui.zoom === "week" ? "on" : ""}
                  onClick={() => setUI({ zoom: "week" })}
                >
                  Mingguan
                </button>
              </div>
            )}
            <label className="field">
              <span className="sub">PIC</span>
              <select
                aria-label="Filter PIC"
                value={effectiveWho(ui.who, opts)}
                onChange={(e) => setUI({ who: e.target.value })}
              >
                <option value="all">Semua</option>
                <option value="none">Belum ditugaskan</option>
                {opts.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <SearchField />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * "Cari task": the box keeps its own text and publishes it to UI.q 250 ms after the last
 * keystroke. The input element stays mounted while results re-render, so focus and caret stay.
 * A change of UI.q from elsewhere (e.g. reopening the project from the sidebar) resets the text.
 */
function SearchField() {
  const ui = useUI();
  const [text, setText] = useState(ui.q);
  const [seen, setSeen] = useState(ui.q);
  const [sent, setSent] = useState(ui.q);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  if (ui.q !== seen) {
    setSeen(ui.q);
    if (ui.q !== sent) setText(ui.q);
  }
  return (
    <label className="field">
      <Icon name="search" />
      <input
        type="search"
        placeholder="Cari task"
        aria-label="Cari task"
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          clearTimeout(timer.current);
          // Like the prototype, a pending search still applies if the tab changes meanwhile.
          timer.current = setTimeout(() => {
            setSent(v);
            setUI({ q: v });
          }, SEARCH_DEBOUNCE_MS);
        }}
      />
    </label>
  );
}
