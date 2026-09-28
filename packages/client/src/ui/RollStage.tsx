import { useEffect, useState } from "react";
import type { Degree, DieFace, RollResult } from "@p2evtt/shared";
import { useStore } from "../store/TableStore";

type Play =
  | { kind: "dice" }
  | { kind: "sum" }
  | { kind: "mod"; index: number; value: number }
  | { kind: "outcome" };

function hash(text: string): number {
  let n = 2166136261;
  for (let i = 0; i < text.length; i++) {
    n ^= text.charCodeAt(i);
    n = Math.imul(n, 16777619);
  }
  return n >>> 0;
}

function dieSpot(id: string, index: number, count: number): { x: number; y: number } {
  const cols = Math.min(8, Math.max(1, Math.ceil(Math.sqrt(count))));
  const rows = Math.ceil(count / cols);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const h = hash(`${id}:${index}`);
  const jx = (h % 7) - 3;
  const jy = ((h >> 3) % 5) - 2;
  const x = 10 + ((col + 0.5) / cols) * 64 + jx;
  const y = 12 + ((row + 0.5) / Math.max(1, rows)) * 36 + jy;
  return { x: Math.min(84, Math.max(8, x)), y: Math.min(50, Math.max(8, y)) };
}

function dieClass(sides: number): string {
  if (sides === 4) return "die-d4";
  if (sides === 8) return "die-d8";
  if (sides === 10 || sides === 100) return "die-d10";
  if (sides === 12) return "die-d12";
  if (sides === 20) return "die-d20";
  return "die-d6";
}

function shownValue(roll: RollResult, play: Play): number | null {
  if (play.kind === "dice") return null;
  if (play.kind === "sum") return roll.diceTotal;
  if (play.kind === "mod") return play.value;
  return roll.total;
}

function figureClass(play: Play, degree: Degree | null): string {
  const tone = play.kind === "outcome" && degree ? ` tone-${degree}` : "";
  if (play.kind === "sum") return `roll-figure pop${tone}`;
  if (play.kind === "mod") return `roll-figure tick${tone}`;
  return `roll-figure${tone}`;
}

function Sparks({ mode }: { mode: "fall" | "arc" }) {
  const color = mode === "fall" ? "#ff5d52" : "#f6c453";
  return (
    <div className={`roll-sparks ${mode}`} aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => {
        const spread = mode === "fall" ? ((i * 29) % 90) - 45 : ((i * 41) % 140) - 70;
        return (
          <span
            key={i}
            style={{
              ["--x" as string]: `${spread}px`,
              ["--spark" as string]: color,
              ["--delay" as string]: `${(i % 9) * 0.035}s`,
              ["--dur" as string]: `${mode === "fall" ? 0.95 + (i % 5) * 0.1 : 1.45 + (i % 4) * 0.12}s`,
            }}
          />
        );
      })}
    </div>
  );
}

export function RollStage() {
  const { state, actions } = useStore();
  const roll = state.rollQueue[0] ?? null;
  const [play, setPlay] = useState<Play | null>(null);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    if (!roll) {
      setPlay(null);
      setLanded(false);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancel = false;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(() => { if (!cancel) fn(); }, ms));
    };
    setLanded(reduce);
    setPlay({ kind: "dice" });
    const stagger = reduce ? 0 : 55;
    const travel = reduce ? 180 : 1100;
    const diceMs = travel + Math.max(0, roll.dice.length - 1) * stagger;
    at(diceMs, () => {
      setLanded(true);
      setPlay({ kind: "sum" });
    });
    let cursor = diceMs + (reduce ? 160 : 620);
    let running = roll.diceTotal;
    const modMs = reduce ? 180 : 680;
    for (let index = 0; index < roll.constants.length; index++) {
      running += roll.constants[index];
      const value = running;
      const when = cursor;
      at(when, () => setPlay({ kind: "mod", index, value }));
      cursor += modMs;
    }
    at(cursor, () => setPlay({ kind: "outcome" }));
    const splash = roll.degree === "CS" || roll.degree === "CF";
    cursor += reduce ? 280 : splash ? 1700 : 1050;
    const id = roll.id;
    at(cursor, () => actions.finishRoll(id));
    return () => {
      cancel = true;
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [roll, actions]);

  if (!roll || !play) return null;
  const value = shownValue(roll, play);
  const dieSize = roll.dice.length > 18 ? "2.15rem" : roll.dice.length > 8 ? "2.6rem" : "3.15rem";
  const dim = play.kind !== "dice";

  return (
    <div className="roll-stage" aria-live="polite">
      {roll.dc !== null ? <p className="roll-dc-banner">DC {roll.dc}</p> : null}
      {roll.dice.map((die, index) => (
        <Die
          key={`${roll.id}-${index}`}
          die={die}
          index={index}
          count={roll.dice.length}
          rollId={roll.id}
          landed={landed}
          dim={dim}
          size={dieSize}
        />
      ))}
      {value !== null ? (
        <div className="roll-center">
          <div key={play.kind === "mod" ? `mod-${play.index}` : play.kind} className={figureClass(play, roll.degree)}>
            {value}
          </div>
        </div>
      ) : null}
      {play.kind === "outcome" && roll.degree === "CF" ? <Sparks mode="fall" /> : null}
      {play.kind === "outcome" && roll.degree === "CS" ? <Sparks mode="arc" /> : null}
    </div>
  );
}

function Die({
  die,
  index,
  count,
  rollId,
  landed,
  dim,
  size,
}: {
  die: DieFace;
  index: number;
  count: number;
  rollId: string;
  landed: boolean;
  dim: boolean;
  size: string;
}) {
  const spot = dieSpot(rollId, index, count);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <div
      className={`map-die ${dieClass(die.sides)} ${landed ? "landed" : ""} ${dim ? "dim" : ""} ${landed && !die.kept ? "dropped" : ""}`}
      style={{
        left: `${spot.x}%`,
        top: `${spot.y}%`,
        ["--die" as string]: size,
        ["--delay" as string]: `${reduce ? 0 : index * 55}ms`,
        ["--travel" as string]: reduce ? "180ms" : "1100ms",
        ["--from-x" as string]: `${(90 - spot.x) * 5}px`,
        ["--from-y" as string]: `${-40 - spot.y * 1.4}px`,
      }}
    >
      <span>{die.sign < 0 ? `−${die.face}` : die.face}</span>
    </div>
  );
}
