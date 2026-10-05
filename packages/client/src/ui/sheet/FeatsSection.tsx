import { useState } from "react";
import { FEAT_CATEGORIES, type FeatCategory, type FeatLine } from "@p2evtt/shared";
import { CaretField } from "../StatBlockEditor";
import { featLabel, newId } from "./model";

type Props = {
  feats: FeatLine[];
  onChange: (feats: FeatLine[]) => void;
  readOnly?: boolean;
};

type Filter = "all" | FeatCategory;

function ordered(feats: FeatLine[], category: FeatCategory): FeatLine[] {
  return feats
    .filter((feat) => feat.category === category)
    .slice()
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function FeatsSection({ feats, onChange, readOnly = false }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const update = (feat: FeatLine, patch: Partial<FeatLine>) => {
    onChange(feats.map((row) => (row.id === feat.id ? { ...row, ...patch } : row)));
    if (patch.category) setFilter(patch.category);
  };

  const add = () => {
    const category: FeatCategory = filter === "all" ? "general" : filter;
    const feat: FeatLine = { id: newId(), name: "Feat", level: 1, category, traits: "", notes: "" };
    onChange([...feats, feat]);
    setExpandedId(feat.id);
  };

  const visible = FEAT_CATEGORIES.filter((category) => {
    if (filter !== "all" && filter !== category) return false;
    if (filter !== category && ordered(feats, category).length === 0) return false;
    return true;
  });

  return (
    <div className="stat-editor">
      <div className="sheet-filters">
        {(["all", ...FEAT_CATEGORIES] as const).map((category) => (
          <button
            key={category}
            type="button"
            className={filter === category ? "sheet-filter active" : "sheet-filter"}
            onClick={() => setFilter(category)}
          >
            {category === "all" ? "All" : featLabel(category)}
          </button>
        ))}
      </div>
      {visible.length === 0 ? <p className="meta">No feats yet.</p> : null}
      {visible.map((category) => {
        const rows = ordered(feats, category);
        return (
          <div key={category}>
            <h3>{featLabel(category)}</h3>
            {rows.length === 0 ? <p className="meta">No feats in this group.</p> : null}
            {rows.map((feat) => {
              const open = expandedId === feat.id;
              return (
                <div className="sheet-line" key={feat.id}>
                  <button
                    type="button"
                    className="sheet-line-main"
                    aria-expanded={open}
                    onClick={() => setExpandedId(open ? null : feat.id)}
                  >
                    <span className="sheet-lv">{feat.level}</span>
                    <span className="sheet-line-name">{feat.name || "Feat"}</span>
                  </button>
                  <button
                    type="button"
                    className="scene-x"
                    aria-label={`Remove ${feat.name || "feat"}`}
                    disabled={readOnly}
                    onClick={() => {
                      onChange(feats.filter((row) => row.id !== feat.id));
                      if (expandedId === feat.id) setExpandedId(null);
                    }}
                  >
                    ×
                  </button>
                  {open ? (
                    <div className="sheet-detail">
                      <label>
                        Name
                        <CaretField disabled={readOnly} value={feat.name} onValue={(name) => update(feat, { name })} />
                      </label>
                      <div className="stat-row">
                        <label>
                          Level
                          <CaretField
                            numeric
                            disabled={readOnly}
                            value={String(feat.level)}
                            onValue={(raw) => update(feat, { level: Number(raw) })}
                          />
                        </label>
                        <label className="grow">
                          Category
                          <select
                            aria-label="Category"
                            disabled={readOnly}
                            value={feat.category}
                            onChange={(e) => update(feat, { category: e.target.value as FeatCategory })}
                          >
                            {FEAT_CATEGORIES.map((option) => (
                              <option key={option} value={option}>
                                {featLabel(option)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label>
                        Traits
                        <CaretField disabled={readOnly} value={feat.traits} onValue={(traits) => update(feat, { traits })} />
                      </label>
                      <label>
                        Notes
                        <CaretField disabled={readOnly} rows={3} value={feat.notes} onValue={(notes) => update(feat, { notes })} />
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
      <button type="button" className="file-btn" disabled={readOnly} onClick={add}>
        Add feat
      </button>
    </div>
  );
}
