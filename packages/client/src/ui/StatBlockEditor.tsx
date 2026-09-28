import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { parseStatBlockData, type SkillLine, type StatBlockData, type StrikeLine } from "@p2evtt/shared";

type Props = {
  data: StatBlockData;
  onChange: (data: StatBlockData) => void;
};

function nid(): string {
  return crypto.randomUUID();
}

function sameBlock(a: StatBlockData, b: StatBlockData): boolean {
  return JSON.stringify(parseStatBlockData(a)) === JSON.stringify(parseStatBlockData(b));
}

function rawNumber(raw: string): number {
  if (raw === "" || raw === "-") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * The visible text lives here while the field is focused.
 * Pushing a server echo back into the input moves the caret to the end.
 */
export function CaretField({
  value,
  onValue,
  numeric,
  className,
  rows,
}: {
  value: string;
  onValue: (value: string) => void;
  numeric?: boolean;
  className?: string;
  rows?: number;
}) {
  const [text, setText] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);

  const apply = (raw: string) => {
    if (numeric && raw !== "" && raw !== "-" && !/^-?\d*$/.test(raw)) return;
    setText(raw);
    if (numeric && (raw === "" || raw === "-")) return;
    onValue(raw);
  };

  const blur = () => {
    focused.current = false;
    if (numeric) {
      const shown = String(rawNumber(text));
      setText(shown);
      if (shown !== value) onValue(shown);
      return;
    }
    if (text !== value) onValue(text);
  };

  const shared = {
    className,
    value: text,
    onFocus: () => {
      focused.current = true;
    },
    onBlur: blur,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => apply(e.target.value),
  };

  if (rows) return <textarea rows={rows} {...shared} />;
  return <input inputMode={numeric ? "numeric" : undefined} {...shared} />;
}

export function StatBlockEditor({ data, onChange }: Props) {
  const [draft, setDraft] = useState(data);
  const draftRef = useRef(draft);
  const dirty = useRef(false);

  useEffect(() => {
    if (dirty.current) {
      if (sameBlock(data, draftRef.current)) dirty.current = false;
      return;
    }
    if (!sameBlock(data, draftRef.current)) {
      draftRef.current = data;
      setDraft(data);
    }
  }, [data]);

  const set = (patch: Partial<StatBlockData>) => {
    const next = { ...draft, ...patch };
    draftRef.current = next;
    dirty.current = true;
    setDraft(next);
    onChange(next);
  };

  const num = (raw: string) => rawNumber(raw);

  return (
    <div className="stat-editor">
      <div className="stat-row">
        <label>
          Level
          <CaretField numeric value={String(draft.level)} onValue={(raw) => set({ level: num(raw) })} />
        </label>
        <label className="grow">
          Traits
          <CaretField value={draft.traits} onValue={(traits) => set({ traits })} />
        </label>
      </div>
      <div className="stat-row">
        <label>
          Perception
          <CaretField numeric value={String(draft.perception)} onValue={(raw) => set({ perception: num(raw) })} />
        </label>
        <label className="grow">
          Speed
          <CaretField value={draft.speed} onValue={(speed) => set({ speed })} />
        </label>
      </div>
      <div className="stat-row six">
        {(["str", "dex", "con", "int", "wis", "cha"] as const).map((key) => (
          <label key={key}>
            {key.toUpperCase()}
            <CaretField numeric value={String(draft[key])} onValue={(raw) => set({ [key]: num(raw) })} />
          </label>
        ))}
      </div>
      <div className="stat-row">
        <label>
          AC
          <CaretField numeric value={String(draft.ac)} onValue={(raw) => set({ ac: num(raw) })} />
        </label>
        <label>
          HP
          <CaretField numeric value={String(draft.hp)} onValue={(raw) => set({ hp: num(raw) })} />
        </label>
        <label>
          Max HP
          <CaretField numeric value={String(draft.hpMax)} onValue={(raw) => set({ hpMax: num(raw) })} />
        </label>
      </div>
      <div className="stat-row">
        <label>
          Fort
          <CaretField numeric value={String(draft.fort)} onValue={(raw) => set({ fort: num(raw) })} />
        </label>
        <label>
          Ref
          <CaretField numeric value={String(draft.ref)} onValue={(raw) => set({ ref: num(raw) })} />
        </label>
        <label>
          Will
          <CaretField numeric value={String(draft.will)} onValue={(raw) => set({ will: num(raw) })} />
        </label>
      </div>
      <h3>Skills</h3>
      {draft.skills.map((skill, i) => (
        <div className="stat-row" key={skill.id}>
          <CaretField
            className="grow"
            value={skill.name}
            onValue={(name) => set({ skills: patchAt(draft.skills, i, { ...skill, name }) })}
          />
          <CaretField
            numeric
            value={String(skill.bonus)}
            onValue={(raw) => set({ skills: patchAt(draft.skills, i, { ...skill, bonus: num(raw) }) })}
          />
          <button type="button" className="scene-x" onClick={() => set({ skills: draft.skills.filter((_, j) => j !== i) })}>
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="file-btn"
        onClick={() => set({ skills: [...draft.skills, { id: nid(), name: "Skill", bonus: 0 } satisfies SkillLine] })}
      >
        Add skill
      </button>
      <h3>Strikes</h3>
      {draft.strikes.map((strike, i) => (
        <div className="stat-strike" key={strike.id}>
          <CaretField
            value={strike.name}
            onValue={(name) => set({ strikes: patchAt(draft.strikes, i, { ...strike, name }) })}
          />
          <CaretField
            numeric
            value={String(strike.attack)}
            onValue={(raw) => set({ strikes: patchAt(draft.strikes, i, { ...strike, attack: num(raw) }) })}
          />
          <CaretField
            value={strike.damage}
            onValue={(damage) => set({ strikes: patchAt(draft.strikes, i, { ...strike, damage }) })}
          />
          <button
            type="button"
            className="scene-x"
            onClick={() => set({ strikes: draft.strikes.filter((_, j) => j !== i) })}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="file-btn"
        onClick={() =>
          set({
            strikes: [...draft.strikes, { id: nid(), name: "Strike", attack: 0, damage: "1d8" } satisfies StrikeLine],
          })
        }
      >
        Add strike
      </button>
      <label className="folder-move">
        Notes
        <CaretField rows={4} value={draft.notes} onValue={(notes) => set({ notes })} />
      </label>
    </div>
  );
}

function patchAt<T>(list: T[], index: number, next: T): T[] {
  return list.map((item, i) => (i === index ? next : item));
}
