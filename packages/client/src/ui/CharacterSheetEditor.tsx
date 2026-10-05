import { useEffect, useRef, useState } from "react";
import { parseCharacterSheetData, type CharacterSheetData, type StatBlockData } from "@p2evtt/shared";
import { FeatsSection } from "./sheet/FeatsSection";
import { InventorySection } from "./sheet/InventorySection";
import { SpellsSection } from "./sheet/SpellsSection";
import { CaretField, StatBlockEditor } from "./StatBlockEditor";

type Props = {
  data: CharacterSheetData;
  onChange: (data: CharacterSheetData) => void;
  readOnly?: boolean;
};

type Section = "core" | "inventory" | "feats" | "spells";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "core", label: "Core" },
  { id: "inventory", label: "Inventory" },
  { id: "feats", label: "Feats" },
  { id: "spells", label: "Spells" },
];

function sameSheet(a: CharacterSheetData, b: CharacterSheetData): boolean {
  return JSON.stringify(parseCharacterSheetData(a)) === JSON.stringify(parseCharacterSheetData(b));
}

function sheetSummary(data: CharacterSheetData): string {
  const who = [data.ancestry, data.className].map((part) => part.trim()).filter(Boolean).join(" · ");
  const hero = `Hero ${data.heroPoints}`;
  return who ? `${who} · ${hero}` : hero;
}

function withCombat(base: CharacterSheetData, combat: StatBlockData): CharacterSheetData {
  return {
    ...base,
    ...combat,
    ancestry: base.ancestry,
    heritage: base.heritage,
    background: base.background,
    className: base.className,
    heroPoints: base.heroPoints,
    inventory: base.inventory,
    feats: base.feats,
    spellsKnown: base.spellsKnown,
    spellsPrepared: base.spellsPrepared,
    repertoire: base.repertoire,
    repertoirePools: base.repertoirePools,
  };
}

export function CharacterSheetEditor({ data, onChange, readOnly = false }: Props) {
  const [draft, setDraft] = useState(data);
  const [section, setSection] = useState<Section>("core");
  const draftRef = useRef(draft);
  const dirty = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [section]);

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
    <div className="sheet-editor">
      {section === "core" ? null : <p className="sheet-summary">{sheetSummary(draft)}</p>}
      <div className="sheet-tabs" role="tablist" aria-label="Character sheet sections">
        {SECTIONS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={section === tab.id}
            className={section === tab.id ? "sheet-tab active" : "sheet-tab"}
            onClick={() => setSection(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="sheet-section-scroll" ref={scrollRef}>
        {section === "core" ? (
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
            <StatBlockEditor data={draft} onChange={(combat) => commit(withCombat(draftRef.current, combat))} />
          </fieldset>
        ) : null}
        {section === "inventory" ? (
          <InventorySection readOnly={readOnly} items={draft.inventory} onChange={(inventory) => set({ inventory })} />
        ) : null}
        {section === "feats" ? (
          <FeatsSection readOnly={readOnly} feats={draft.feats} onChange={(feats) => set({ feats })} />
        ) : null}
        {section === "spells" ? (
          <SpellsSection
            readOnly={readOnly}
            known={draft.spellsKnown}
            prepared={draft.spellsPrepared}
            repertoire={draft.repertoire}
            pools={draft.repertoirePools}
            onKnown={(spellsKnown) => set({ spellsKnown })}
            onPrepared={(spellsPrepared) => set({ spellsPrepared })}
            onRepertoire={(repertoire, repertoirePools) => set({ repertoire, repertoirePools })}
          />
        ) : null}
      </div>
    </div>
  );
}
