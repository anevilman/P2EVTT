import { useState, type FormEvent } from "react";
import { parseFormula } from "@p2evtt/shared";
import { useStore } from "../store/TableStore";

function Arrow({ dir }: { dir: "left" | "right" }) {
  const d = dir === "left" ? "M14 6 L8 12 L14 18" : "M10 6 L16 12 L10 18";
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RollTray() {
  const { actions } = useStore();
  const [open, setOpen] = useState(true);
  const [formula, setFormula] = useState("1d20");
  const [dc, setDc] = useState("");
  const terms = parseFormula(formula);
  const showHint = formula.trim().length > 0 && !terms;

  const roll = (event: FormEvent) => {
    event.preventDefault();
    if (!terms) return;
    setOpen(false);
    actions.roll(formula.trim(), dc === "" ? null : Number(dc));
  };

  if (!open) {
    return (
      <button type="button" className="roll-tab" aria-label="Open dice" onClick={() => setOpen(true)}>
        <Arrow dir="left" />
      </button>
    );
  }

  return (
    <aside className="roll-tray">
      <button type="button" className="roll-collapse" aria-label="Hide dice" onClick={() => setOpen(false)}>
        <Arrow dir="right" />
      </button>
      <form onSubmit={roll}>
        <label>
          Dice
          <input
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            placeholder="1d20+5"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          DC
          <span className="roll-dc-wrap">
            <input
              value={dc}
              inputMode="numeric"
              aria-label="Difficulty class"
              placeholder="Optional"
              onChange={(e) => setDc(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
            />
            <button type="button" className="roll-clear" aria-label="Clear DC" onClick={() => setDc("")}>
              ×
            </button>
          </span>
        </label>
        <button type="submit" className="roll-go" disabled={!terms}>
          Roll
        </button>
        {showHint ? <p className="roll-hint">Try 1d20, 8d6+5, 2*1d20, or 2x1d20.</p> : null}
      </form>
    </aside>
  );
}
