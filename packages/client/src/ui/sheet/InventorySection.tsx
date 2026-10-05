import { useEffect, useRef, useState } from "react";
import type { InventoryItem, ItemSlot } from "@p2evtt/shared";
import { CaretField } from "../StatBlockEditor";
import {
  DOLL_SLOTS,
  SLOT_CHOICES,
  SLOT_NAME,
  bulkTenths,
  dollFaceLabel,
  equipItem,
  formatBulk,
  newId,
  slotChip,
} from "./model";

type Props = {
  items: InventoryItem[];
  onChange: (items: InventoryItem[]) => void;
  readOnly?: boolean;
};

type Picker = { mode: "equip"; slot: ItemSlot } | { mode: "filled"; itemId: string } | null;

function carried(items: InventoryItem[]): InventoryItem[] {
  return items.filter((item) => item.slot === null);
}

export function InventorySection({ items, onChange, readOnly = false }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!expandedId) return;
    rowRefs.current.get(expandedId)?.scrollIntoView({ block: "nearest" });
  }, [expandedId]);

  const place = (itemId: string, slot: ItemSlot) => {
    onChange(equipItem(items, itemId, slot));
    setPicker(null);
    setExpandedId(itemId);
  };

  const createIn = (slot: ItemSlot) => {
    const item: InventoryItem = {
      id: newId(),
      name: "Item",
      qty: 1,
      bulk: "",
      slot: null,
      invested: slot === "other",
      notes: "",
    };
    onChange(equipItem([...items, item], item.id, slot));
    setPicker(null);
    setExpandedId(item.id);
  };

  const addCarried = () => {
    const item: InventoryItem = {
      id: newId(),
      name: "Item",
      qty: 1,
      bulk: "",
      slot: null,
      invested: false,
      notes: "",
    };
    onChange([...items, item]);
    setExpandedId(item.id);
  };

  const patch = (item: InventoryItem, next: Partial<InventoryItem>) => {
    if ("slot" in next) {
      onChange(equipItem(items, item.id, next.slot ?? null));
      return;
    }
    onChange(items.map((row) => (row.id === item.id ? { ...row, ...next } : row)));
  };

  const focusItem = (itemId: string) => {
    setExpandedId(itemId);
    setPicker({ mode: "filled", itemId });
  };

  const toggleSlot = (slot: ItemSlot, item: InventoryItem | undefined) => {
    if (item) {
      if (picker?.mode === "filled" && picker.itemId === item.id) {
        setPicker(null);
        return;
      }
      focusItem(item.id);
      return;
    }
    if (readOnly) return;
    if (picker?.mode === "equip" && picker.slot === slot) {
      setPicker(null);
      return;
    }
    setPicker({ mode: "equip", slot });
  };

  const invested = items.filter((item) => item.invested).length;
  const tenths = items.reduce((sum, item) => sum + bulkTenths(item.bulk) * Math.max(0, item.qty), 0);
  const bothHands = items.find((item) => item.slot === "hands");
  const others = items.filter((item) => item.slot === "other");
  const filled = picker?.mode === "filled" ? items.find((item) => item.id === picker.itemId) : undefined;

  return (
    <div className="stat-editor">
      <div className="paper-doll">
        {DOLL_SLOTS.map(({ slot, column, row }) => (
          <DollSlot
            key={slot}
            slot={slot}
            column={column}
            row={row}
            item={items.find((entry) => entry.slot === slot)}
            active={
              (picker?.mode === "equip" && picker.slot === slot) ||
              (picker?.mode === "filled" && items.find((entry) => entry.id === picker.itemId)?.slot === slot)
            }
            onClick={toggleSlot}
          />
        ))}
        {bothHands ? (
          <DollSlot
            slot="hands"
            column="1 / -1"
            row={7}
            item={bothHands}
            active={picker?.mode === "filled" && picker.itemId === bothHands.id}
            onClick={toggleSlot}
          />
        ) : (
          <>
            <DollSlot
              slot="hand-left"
              column={1}
              row={7}
              item={items.find((entry) => entry.slot === "hand-left")}
              active={
                (picker?.mode === "equip" && picker.slot === "hand-left") ||
                (picker?.mode === "filled" && items.find((entry) => entry.id === picker.itemId)?.slot === "hand-left")
              }
              onClick={toggleSlot}
            />
            <DollSlot
              slot="hand-right"
              column={3}
              row={7}
              item={items.find((entry) => entry.slot === "hand-right")}
              active={
                (picker?.mode === "equip" && picker.slot === "hand-right") ||
                (picker?.mode === "filled" && items.find((entry) => entry.id === picker.itemId)?.slot === "hand-right")
              }
              onClick={toggleSlot}
            />
          </>
        )}
      </div>

      <div className="other-worn">
        <span className="sheet-kicker">Other invested</span>
        {others.map((item) => (
          <button
            key={item.id}
            type="button"
            className={picker?.mode === "filled" && picker.itemId === item.id ? "worn-chip active" : "worn-chip"}
            onClick={() => focusItem(item.id)}
          >
            {item.name || "Item"}
          </button>
        ))}
        <button
          type="button"
          className="worn-chip add"
          disabled={readOnly}
          onClick={() => setPicker(picker?.mode === "equip" && picker.slot === "other" ? null : { mode: "equip", slot: "other" })}
        >
          +
        </button>
      </div>

      <p className="sheet-kicker">
        Invested {invested} · Bulk {formatBulk(tenths)}
      </p>

      {picker?.mode === "equip" ? (
        <div className="slot-tray">
          <p>Equip to {SLOT_NAME[picker.slot]}</p>
          {carried(items).length === 0 ? <p>Nothing carried.</p> : null}
          {carried(items).map((item) => (
            <div className="picker-row" key={item.id}>
              <button type="button" className="tray-btn" disabled={readOnly} onClick={() => place(item.id, picker.slot)}>
                {item.name || "Item"}
              </button>
              {picker.slot === "hand-left" || picker.slot === "hand-right" ? (
                <button type="button" className="tray-btn minor" disabled={readOnly} onClick={() => place(item.id, "hands")}>
                  Both
                </button>
              ) : null}
            </div>
          ))}
          <button type="button" className="tray-btn" disabled={readOnly} onClick={() => createIn(picker.slot)}>
            New item
          </button>
          {picker.slot === "hand-left" || picker.slot === "hand-right" ? (
            <button type="button" className="tray-btn" disabled={readOnly} onClick={() => createIn("hands")}>
              New two-handed item
            </button>
          ) : null}
        </div>
      ) : null}

      {picker?.mode === "filled" && filled ? (
        <div className="slot-tray">
          <p>{filled.name || "Item"}</p>
          <button
            type="button"
            className="tray-btn"
            disabled={readOnly}
            onClick={() => {
              onChange(equipItem(items, filled.id, null));
              setPicker(null);
              setExpandedId(filled.id);
            }}
          >
            Unequip
          </button>
        </div>
      ) : null}

      <h3>Items</h3>
      {items.length === 0 ? <p className="meta">No items yet.</p> : null}
      {items.map((item) => {
        const open = expandedId === item.id;
        return (
          <div
            className="sheet-line"
            key={item.id}
            ref={(node) => {
              if (node) rowRefs.current.set(item.id, node);
              else rowRefs.current.delete(item.id);
            }}
          >
            <button
              type="button"
              className="sheet-line-main"
              aria-expanded={open}
              onClick={() => setExpandedId(open ? null : item.id)}
            >
              <span className="sheet-line-name">{item.name || "Item"}</span>
              <span className="sheet-lv">×{item.qty}</span>
              <span className="sheet-lv">{item.bulk.trim() || "–"}</span>
              {item.slot ? <span className="sheet-chip">{slotChip(item.slot)}</span> : null}
            </button>
            <button
              type="button"
              className="scene-x"
              aria-label={`Remove ${item.name || "item"}`}
              disabled={readOnly}
              onClick={() => {
                onChange(items.filter((row) => row.id !== item.id));
                if (expandedId === item.id) setExpandedId(null);
                if (picker?.mode === "filled" && picker.itemId === item.id) setPicker(null);
              }}
            >
              ×
            </button>
            {open ? (
              <div className="sheet-detail">
                <label>
                  Name
                  <CaretField disabled={readOnly} value={item.name} onValue={(name) => patch(item, { name })} />
                </label>
                <div className="stat-row">
                  <label>
                    Qty
                    <CaretField
                      numeric
                      disabled={readOnly}
                      value={String(item.qty)}
                      onValue={(raw) => patch(item, { qty: Number(raw) })}
                    />
                  </label>
                  <label>
                    Bulk
                    <CaretField disabled={readOnly} value={item.bulk} onValue={(bulk) => patch(item, { bulk })} />
                  </label>
                </div>
                <label>
                  Slot
                  <select
                    aria-label="Slot"
                    disabled={readOnly}
                    value={item.slot ?? ""}
                    onChange={(e) => {
                      const slot = e.target.value === "" ? null : (e.target.value as ItemSlot);
                      patch(item, { slot });
                    }}
                  >
                    {SLOT_CHOICES.map((choice) => (
                      <option key={choice.label} value={choice.slot ?? ""}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={item.invested}
                    onChange={(e) => patch(item, { invested: e.target.checked })}
                  />
                  Invested
                </label>
                <label>
                  Notes
                  <CaretField disabled={readOnly} rows={2} value={item.notes} onValue={(notes) => patch(item, { notes })} />
                </label>
              </div>
            ) : null}
          </div>
        );
      })}
      <button type="button" className="file-btn" disabled={readOnly} onClick={addCarried}>
        Add item
      </button>
    </div>
  );
}

function DollSlot({
  slot,
  column,
  row,
  item,
  active,
  onClick,
}: {
  slot: ItemSlot;
  column: number | string;
  row: number;
  item: InventoryItem | undefined;
  active: boolean;
  onClick: (slot: ItemSlot, item: InventoryItem | undefined) => void;
}) {
  const face = item ? item.name || "Item" : dollFaceLabel(slot);
  return (
    <button
      type="button"
      className={item ? (active ? "doll-slot filled active" : "doll-slot filled") : active ? "doll-slot active" : "doll-slot"}
      style={{ gridColumn: column, gridRow: row }}
      title={item ? `${SLOT_NAME[slot]}: ${item.name || "Item"}` : SLOT_NAME[slot]}
      onClick={() => onClick(slot, item)}
    >
      <span className="doll-face">{face}</span>
      {item?.invested ? <span className="invested-dot" aria-hidden="true" /> : null}
    </button>
  );
}
