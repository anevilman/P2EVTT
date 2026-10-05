import { useEffect, useRef, useState } from "react";
import {
  SPELL_TRADITIONS,
  type PreparedSlot,
  type RepertoirePool,
  type SpellLine,
  type SpellTradition,
} from "@p2evtt/shared";
import { CaretField } from "../StatBlockEditor";
import { BlurNumber } from "./BlurNumber";
import { newId, rankLabel, traditionLabel } from "./model";

type Props = {
  known: SpellLine[];
  prepared: PreparedSlot[];
  repertoire: SpellLine[];
  pools: RepertoirePool[];
  onKnown: (spells: SpellLine[]) => void;
  onPrepared: (slots: PreparedSlot[]) => void;
  onRepertoire: (spells: SpellLine[], pools: RepertoirePool[]) => void;
  readOnly?: boolean;
};

type SpellTab = "known" | "prepared" | "repertoire";

function ranksIn(spells: SpellLine[]): number[] {
  return [...new Set(spells.map((spell) => spell.rank))].sort((a, b) => a - b);
}

function resizePrepared(slots: PreparedSlot[], rank: number, count: number): PreparedSlot[] {
  const nextCount = Math.max(0, Math.min(15, Math.trunc(count)));
  const mine = slots.filter((slot) => slot.rank === rank);
  if (nextCount === mine.length) return slots;
  if (nextCount > mine.length) {
    const added: PreparedSlot[] = Array.from({ length: nextCount - mine.length }, () => ({
      id: newId(),
      rank,
      spellId: null,
      name: "",
      spent: false,
    }));
    return [...slots, ...added];
  }
  let drop = mine.length - nextCount;
  const remove = new Set<string>();
  for (let i = mine.length - 1; i >= 0 && drop > 0; i -= 1) {
    const slot = mine[i];
    if (!slot.spellId && !slot.name.trim()) {
      remove.add(slot.id);
      drop -= 1;
    }
  }
  for (let i = mine.length - 1; i >= 0 && drop > 0; i -= 1) {
    if (!remove.has(mine[i].id)) {
      remove.add(mine[i].id);
      drop -= 1;
    }
  }
  return slots.filter((slot) => !remove.has(slot.id));
}

function poolFor(pools: RepertoirePool[], rank: number): RepertoirePool {
  return pools.find((pool) => pool.rank === rank) ?? { rank, max: 0, remaining: 0 };
}

function writePool(pools: RepertoirePool[], spells: SpellLine[], rank: number, max: number, remaining: number): RepertoirePool[] {
  const capped = Math.max(0, Math.min(15, Math.trunc(max)));
  const left = Math.max(0, Math.min(capped, Math.trunc(remaining)));
  const hasSpells = spells.some((spell) => spell.rank === rank);
  if (!hasSpells && capped === 0 && left === 0) return pools.filter((pool) => pool.rank !== rank);
  const next = { rank, max: capped, remaining: left };
  if (pools.some((pool) => pool.rank === rank)) return pools.map((pool) => (pool.rank === rank ? next : pool));
  return [...pools, next].sort((a, b) => a.rank - b.rank);
}

function blankSpell(rank: number): SpellLine {
  return { id: newId(), name: "Spell", rank, tradition: "", notes: "" };
}

export function SpellsSection({
  known,
  prepared,
  repertoire,
  pools,
  onKnown,
  onPrepared,
  onRepertoire,
  readOnly = false,
}: Props) {
  const [tab, setTab] = useState<SpellTab>("known");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addRank, setAddRank] = useState(0);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rootRef.current?.closest(".sheet-section-scroll")?.scrollTo(0, 0);
  }, [tab]);

  const addKnown = () => {
    const spell = blankSpell(addRank);
    onKnown([...known, spell]);
    setExpandedId(spell.id);
  };

  const addRepertoire = () => {
    const spell = blankSpell(addRank);
    const next = [...repertoire, spell];
    const nextPools = addRank > 0 && !pools.some((pool) => pool.rank === addRank) ? writePool(pools, next, addRank, 1, 1) : pools;
    onRepertoire(next, nextPools);
    setExpandedId(spell.id);
  };

  return (
    <div className="stat-editor" ref={rootRef}>
      <div className="sheet-tabs spell-tabs" role="tablist" aria-label="Spell lists">
        {(
          [
            ["known", "Known"],
            ["prepared", "Prepared"],
            ["repertoire", "Repertoire"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "sheet-tab active" : "sheet-tab"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "known" ? (
        <SpellCatalog
          spells={known}
          empty="No spells yet."
          expandedId={expandedId}
          readOnly={readOnly}
          onToggle={setExpandedId}
          onChange={onKnown}
          addRank={addRank}
          onAddRank={setAddRank}
          onAdd={addKnown}
          addLabel="Add spell"
        />
      ) : null}

      {tab === "prepared" ? (
        <PreparedList
          known={known}
          slots={prepared}
          pickingId={pickingId}
          custom={custom}
          addRank={addRank}
          readOnly={readOnly}
          onAddRank={setAddRank}
          onCustom={setCustom}
          onPick={setPickingId}
          onChange={onPrepared}
        />
      ) : null}

      {tab === "repertoire" ? (
        <RepertoireList
          spells={repertoire}
          pools={pools}
          expandedId={expandedId}
          addRank={addRank}
          readOnly={readOnly}
          onAddRank={setAddRank}
          onToggle={setExpandedId}
          onAdd={addRepertoire}
          onChange={onRepertoire}
        />
      ) : null}
    </div>
  );
}

function RankSelect({ value, onChange, disabled }: { value: number; onChange: (rank: number) => void; disabled?: boolean }) {
  return (
    <select aria-label="Rank" disabled={disabled} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      <option value={0}>Cantrip</option>
      {Array.from({ length: 10 }, (_, index) => (
        <option key={index + 1} value={index + 1}>
          Rank {index + 1}
        </option>
      ))}
    </select>
  );
}

function SpellCatalog({
  spells,
  empty,
  expandedId,
  readOnly,
  onToggle,
  onChange,
  addRank,
  onAddRank,
  onAdd,
  addLabel,
}: {
  spells: SpellLine[];
  empty: string;
  expandedId: string | null;
  readOnly: boolean;
  onToggle: (id: string | null) => void;
  onChange: (spells: SpellLine[]) => void;
  addRank: number;
  onAddRank: (rank: number) => void;
  onAdd: () => void;
  addLabel: string;
}) {
  const update = (spell: SpellLine, patch: Partial<SpellLine>) => {
    onChange(spells.map((row) => (row.id === spell.id ? { ...row, ...patch } : row)));
  };
  return (
    <>
      {spells.length === 0 ? <p className="meta">{empty}</p> : null}
      {ranksIn(spells).map((rank) => (
        <div key={rank}>
          <h3>{rankLabel(rank)}</h3>
          {spells
            .filter((spell) => spell.rank === rank)
            .map((spell) => (
              <SpellRow
                key={spell.id}
                spell={spell}
                open={expandedId === spell.id}
                readOnly={readOnly}
                onToggle={() => onToggle(expandedId === spell.id ? null : spell.id)}
                onRemove={() => {
                  onChange(spells.filter((row) => row.id !== spell.id));
                  if (expandedId === spell.id) onToggle(null);
                }}
                onChange={(patch) => update(spell, patch)}
              />
            ))}
        </div>
      ))}
      <div className="add-rank">
        <RankSelect disabled={readOnly} value={addRank} onChange={onAddRank} />
        <button type="button" className="file-btn" disabled={readOnly} onClick={onAdd}>
          {addLabel}
        </button>
      </div>
    </>
  );
}

function SpellRow({
  spell,
  open,
  readOnly,
  onToggle,
  onRemove,
  onChange,
}: {
  spell: SpellLine;
  open: boolean;
  readOnly: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onChange: (patch: Partial<SpellLine>) => void;
}) {
  return (
    <div className="sheet-line">
      <button type="button" className="sheet-line-main" aria-expanded={open} onClick={onToggle}>
        <span className="sheet-line-name">{spell.name || "Spell"}</span>
        {spell.tradition ? <span className="sheet-chip">{traditionLabel(spell.tradition)}</span> : null}
      </button>
      <button
        type="button"
        className="scene-x"
        aria-label={`Remove ${spell.name || "spell"}`}
        disabled={readOnly}
        onClick={onRemove}
      >
        ×
      </button>
      {open ? (
        <div className="sheet-detail">
          <label>
            Name
            <CaretField disabled={readOnly} value={spell.name} onValue={(name) => onChange({ name })} />
          </label>
          <div className="stat-row">
            <label>
              Rank
              <RankSelect disabled={readOnly} value={spell.rank} onChange={(rank) => onChange({ rank })} />
            </label>
            <label className="grow">
              Tradition
              <select
                aria-label="Tradition"
                disabled={readOnly}
                value={spell.tradition}
                onChange={(e) => onChange({ tradition: e.target.value as SpellTradition })}
              >
                <option value="">Tradition</option>
                {SPELL_TRADITIONS.map((tradition) => (
                  <option key={tradition} value={tradition}>
                    {traditionLabel(tradition)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Notes
            <CaretField disabled={readOnly} rows={3} value={spell.notes} onValue={(notes) => onChange({ notes })} />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function preparedName(slot: PreparedSlot, known: SpellLine[]): string {
  if (slot.spellId) {
    const match = known.find((spell) => spell.id === slot.spellId);
    if (match?.name) return match.name;
  }
  return slot.name;
}

function PreparedList({
  known,
  slots,
  pickingId,
  custom,
  addRank,
  readOnly,
  onAddRank,
  onCustom,
  onPick,
  onChange,
}: {
  known: SpellLine[];
  slots: PreparedSlot[];
  pickingId: string | null;
  custom: string;
  addRank: number;
  readOnly: boolean;
  onAddRank: (rank: number) => void;
  onCustom: (value: string) => void;
  onPick: (id: string | null) => void;
  onChange: (slots: PreparedSlot[]) => void;
}) {
  const ranks = [...new Set(slots.map((slot) => slot.rank))].sort((a, b) => a - b);
  const countAt = (rank: number) => slots.filter((slot) => slot.rank === rank).length;
  const fill = (slot: PreparedSlot, spellId: string | null, name: string) => {
    onChange(slots.map((row) => (row.id === slot.id ? { ...row, spellId, name, spent: false } : row)));
    onPick(null);
    onCustom("");
  };

  return (
    <>
      {slots.some((slot) => slot.rank > 0) ? (
        <div className="rank-head rank-end">
          <button
            type="button"
            className="pool-reset"
            disabled={readOnly}
            onClick={() => {
              if (!slots.some((slot) => slot.spent)) return;
              onChange(slots.map((slot) => (slot.spent ? { ...slot, spent: false } : slot)));
            }}
          >
            Reset
          </button>
        </div>
      ) : null}
      {slots.length === 0 ? <p className="meta">No prepared spells.</p> : null}
      {ranks.map((rank) => {
        const group = slots.filter((slot) => slot.rank === rank);
        return (
          <div key={rank}>
            <div className="rank-head">
              <h3>{rankLabel(rank)}</h3>
              <label className="slot-pool">
                Slots
                <BlurNumber
                  className="pool-num"
                  label={`${rankLabel(rank)} slots`}
                  disabled={readOnly}
                  value={group.length}
                  onCommit={(count) => onChange(resizePrepared(slots, rank, count))}
                />
              </label>
            </div>
            {group.map((slot) => {
              const name = preparedName(slot, known);
              const empty = !slot.spellId && !slot.name.trim();
              return (
                <div className="sheet-line" key={slot.id}>
                  {empty ? (
                    <button
                      type="button"
                      className="sheet-line-main prepare-empty"
                      disabled={readOnly}
                      onClick={() => {
                        onPick(pickingId === slot.id ? null : slot.id);
                        onCustom("");
                      }}
                    >
                      Prepare
                    </button>
                  ) : (
                    <>
                      <span className="sheet-line-name prep-name">{name}</span>
                      {rank > 0 ? (
                        <label className="check-row">
                          <input
                            type="checkbox"
                            disabled={readOnly}
                            checked={slot.spent}
                            onChange={(e) =>
                              onChange(slots.map((row) => (row.id === slot.id ? { ...row, spent: e.target.checked } : row)))
                            }
                          />
                          spent
                        </label>
                      ) : null}
                      <button
                        type="button"
                        className="scene-x"
                        aria-label={`Clear ${name}`}
                        disabled={readOnly}
                        onClick={() => onChange(slots.map((row) => (row.id === slot.id ? { ...row, spellId: null, name: "", spent: false } : row)))}
                      >
                        ×
                      </button>
                    </>
                  )}
                  {pickingId === slot.id ? (
                    <div className="slot-tray">
                      {known.filter((spell) => spell.rank === rank).length === 0 ? (
                        <p>No known spells of this rank.</p>
                      ) : (
                        known
                          .filter((spell) => spell.rank === rank)
                          .map((spell) => (
                            <button key={spell.id} type="button" className="tray-btn" disabled={readOnly} onClick={() => fill(slot, spell.id, spell.name)}>
                              {spell.name || "Spell"}
                            </button>
                          ))
                      )}
                      <div className="picker-row">
                        <input
                          aria-label="Spell name"
                          placeholder="Type a name"
                          disabled={readOnly}
                          value={custom}
                          onChange={(e) => onCustom(e.target.value)}
                        />
                        <button
                          type="button"
                          className="tray-btn minor"
                          disabled={readOnly || !custom.trim()}
                          onClick={() => fill(slot, null, custom.trim())}
                        >
                          Use
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="add-rank">
        <RankSelect disabled={readOnly} value={addRank} onChange={onAddRank} />
        <button
          type="button"
          className="file-btn"
          disabled={readOnly || countAt(addRank) >= 15}
          onClick={() => onChange(resizePrepared(slots, addRank, countAt(addRank) + 1))}
        >
          {countAt(addRank) === 0 ? "Add rank" : "Add slot"}
        </button>
      </div>
    </>
  );
}

function RepertoireList({
  spells,
  pools,
  expandedId,
  addRank,
  readOnly,
  onAddRank,
  onToggle,
  onAdd,
  onChange,
}: {
  spells: SpellLine[];
  pools: RepertoirePool[];
  expandedId: string | null;
  addRank: number;
  readOnly: boolean;
  onAddRank: (rank: number) => void;
  onToggle: (id: string | null) => void;
  onAdd: () => void;
  onChange: (spells: SpellLine[], pools: RepertoirePool[]) => void;
}) {
  const update = (spell: SpellLine, patch: Partial<SpellLine>) => {
    const next = spells.map((row) => (row.id === spell.id ? { ...row, ...patch } : row));
    let nextPools = pools;
    if (patch.rank !== undefined && patch.rank !== spell.rank) {
      if (patch.rank > 0 && !nextPools.some((pool) => pool.rank === patch.rank)) {
        nextPools = writePool(nextPools, next, patch.rank, 1, 1);
      }
      if (spell.rank > 0 && !next.some((row) => row.rank === spell.rank)) {
        const pool = poolFor(nextPools, spell.rank);
        nextPools = writePool(nextPools, next, spell.rank, pool.max, pool.remaining);
      }
    }
    onChange(next, nextPools);
  };

  const remove = (spell: SpellLine) => {
    const next = spells.filter((row) => row.id !== spell.id);
    const pool = poolFor(pools, spell.rank);
    const nextPools =
      spell.rank > 0 && !next.some((row) => row.rank === spell.rank)
        ? writePool(pools, next, spell.rank, pool.max, pool.remaining)
        : pools;
    onChange(next, nextPools);
    if (expandedId === spell.id) onToggle(null);
  };

  const shown = new Set<number>(ranksIn(spells));
  for (const pool of pools) {
    if (pool.max > 0 || pool.remaining > 0) shown.add(pool.rank);
  }
  const ranks = [...shown].sort((a, b) => a - b);

  return (
    <>
      {spells.length === 0 && ranks.length === 0 ? <p className="meta">No repertoire spells.</p> : null}
      {ranks.map((rank) => {
        const pool = poolFor(pools, rank);
        return (
          <div key={rank}>
            <div className="rank-head">
              <h3>{rankLabel(rank)}</h3>
              {rank > 0 ? (
                <div className="slot-pool">
                  <span>Slots</span>
                  <button
                    type="button"
                    className="pool-step"
                    aria-label="Spend a slot"
                    disabled={readOnly || pool.remaining <= 0}
                    onClick={() => onChange(spells, writePool(pools, spells, rank, pool.max, pool.remaining - 1))}
                  >
                    −
                  </button>
                  <BlurNumber
                    className="pool-num"
                    label={`${rankLabel(rank)} slots remaining`}
                    disabled={readOnly}
                    value={pool.remaining}
                    max={pool.max}
                    onCommit={(remaining) => onChange(spells, writePool(pools, spells, rank, pool.max, remaining))}
                  />
                  <span>/</span>
                  <BlurNumber
                    className="pool-num"
                    label={`${rankLabel(rank)} slots total`}
                    disabled={readOnly}
                    value={pool.max}
                    onCommit={(max) => onChange(spells, writePool(pools, spells, rank, max, pool.remaining))}
                  />
                  <button
                    type="button"
                    className="pool-step"
                    aria-label="Restore a slot"
                    disabled={readOnly || pool.remaining >= pool.max}
                    onClick={() => onChange(spells, writePool(pools, spells, rank, pool.max, pool.remaining + 1))}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="pool-reset"
                    disabled={readOnly}
                    onClick={() => onChange(spells, writePool(pools, spells, rank, pool.max, pool.max))}
                  >
                    Reset
                  </button>
                </div>
              ) : null}
            </div>
            {spells
              .filter((spell) => spell.rank === rank)
              .map((spell) => (
                <SpellRow
                  key={spell.id}
                  spell={spell}
                  open={expandedId === spell.id}
                  readOnly={readOnly}
                  onToggle={() => onToggle(expandedId === spell.id ? null : spell.id)}
                  onRemove={() => remove(spell)}
                  onChange={(patch) => update(spell, patch)}
                />
              ))}
          </div>
        );
      })}
      <div className="add-rank">
        <RankSelect disabled={readOnly} value={addRank} onChange={onAddRank} />
        <button type="button" className="file-btn" disabled={readOnly} onClick={onAdd}>
          Add spell
        </button>
      </div>
    </>
  );
}
