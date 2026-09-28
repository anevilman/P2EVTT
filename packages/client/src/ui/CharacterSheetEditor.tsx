import { useEffect, useRef, useState } from "react";
import { parseCharacterSheetData, type CharacterSheetData } from "@p2evtt/shared";
import { CaretField, StatBlockEditor } from "./StatBlockEditor";

type Props = {
  data: CharacterSheetData;
  onChange: (data: CharacterSheetData) => void;
  readOnly?: boolean;
};

function sameSheet(a: CharacterSheetData, b: CharacterSheetData): boolean {
  return JSON.stringify(parseCharacterSheetData(a)) === JSON.stringify(parseCharacterSheetData(b));
}

export function CharacterSheetEditor({ data, onChange, readOnly = false }: Props) {
  const [draft, setDraft] = useState(data);
  const draftRef = useRef(draft);
  const dirty = useRef(false);

  useEffect(() => {
    if (dirty.current) {
      if (sameSheet(data, draftRef.current)) dirty.current = false;
      return;
    }
    if (!sameSheet(data, draftRef.current)) {
      draftRef.current = data;
      setDraft(data);
    }
  }, [data]);

  const commit = (next: CharacterSheetData) => {
    const parsed = parseCharacterSheetData(next);
    draftRef.current = parsed;
    dirty.current = true;
    setDraft(parsed);
    onChange(parsed);
  };

  const set = (patch: Partial<CharacterSheetData>) => commit({ ...draftRef.current, ...patch });

  return (
    <fieldset className="sheet-fields" disabled={readOnly}>
      <div className="stat-row">
        <label className="grow">
          Ancestry
          <CaretField value={draft.ancestry} onValue={(ancestry) => set({ ancestry })} />
        </label>
        <label className="grow">
          Heritage
          <CaretField value={draft.heritage} onValue={(heritage) => set({ heritage })} />
        </label>
      </div>
      <div className="stat-row">
        <label className="grow">
          Background
          <CaretField value={draft.background} onValue={(background) => set({ background })} />
        </label>
        <label className="grow">
          Class
          <CaretField value={draft.className} onValue={(className) => set({ className })} />
        </label>
      </div>
      <div className="stat-row">
        <label className="narrow">
          Hero points
          <CaretField numeric value={String(draft.heroPoints)} onValue={(raw) => set({ heroPoints: Number(raw) })} />
        </label>
      </div>
      <StatBlockEditor
        data={draft}
        onChange={(combat) =>
          commit({
            ...draftRef.current,
            ...combat,
            ancestry: draftRef.current.ancestry,
            heritage: draftRef.current.heritage,
            background: draftRef.current.background,
            className: draftRef.current.className,
            heroPoints: draftRef.current.heroPoints,
          })
        }
      />
    </fieldset>
  );
}
