import type { CharacterSheetEntry, StatBlockEntry } from "@p2evtt/shared";

export type RecordLink =
  | { kind: "none" }
  | { kind: "instance" }
  | { kind: "stat"; id: string }
  | { kind: "sheet"; id: string };

type Props = {
  value: RecordLink;
  statLibrary: StatBlockEntry[];
  sheets: CharacterSheetEntry[];
  onChange: (next: RecordLink) => void;
};

export function AssignRecordSelect({ value, statLibrary, sheets, onChange }: Props) {
  const encoded =
    value.kind === "none"
      ? ""
      : value.kind === "instance"
        ? "instance"
        : value.kind === "stat"
          ? `stat:${value.id}`
          : `sheet:${value.id}`;

  return (
    <label className="folder-move">
      Stat block or character sheet
      <select
        value={encoded}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") onChange({ kind: "none" });
          else if (raw === "instance") onChange({ kind: "instance" });
          else if (raw.startsWith("stat:")) onChange({ kind: "stat", id: raw.slice(5) });
          else if (raw.startsWith("sheet:")) onChange({ kind: "sheet", id: raw.slice(6) });
        }}
      >
        <option value="">None</option>
        {value.kind === "instance" ? <option value="instance">Stat block on this token</option> : null}
        <optgroup label="Stat blocks">
          {statLibrary
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((block) => (
              <option key={block.id} value={`stat:${block.id}`}>
                {block.name}
              </option>
            ))}
        </optgroup>
        <optgroup label="Character sheets">
          {sheets
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((sheet) => (
              <option key={sheet.id} value={`sheet:${sheet.id}`}>
                {sheet.name}
              </option>
            ))}
        </optgroup>
      </select>
    </label>
  );
}
