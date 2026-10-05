import type { InventoryItem, ItemSlot } from "@p2evtt/shared";

export const SLOT_NAME: Record<ItemSlot, string> = {
  headwear: "Headwear",
  eyepiece: "Eyepiece",
  necklace: "Necklace",
  cloak: "Cloak",
  gloves: "Gloves",
  armor: "Armor",
  bracers: "Bracers",
  garment: "Garment",
  "ring-left": "Left ring",
  belt: "Belt",
  "ring-right": "Right ring",
  footwear: "Footwear",
  "hand-left": "Left hand",
  "hand-right": "Right hand",
  hands: "Both hands",
  other: "Other worn",
};

export const SLOT_CHOICES: { slot: ItemSlot | null; label: string }[] = [
  { slot: null, label: "Carried" },
  ...(Object.keys(SLOT_NAME) as ItemSlot[]).map((slot) => ({ slot, label: SLOT_NAME[slot] })),
];

export const DOLL_SLOTS: { slot: ItemSlot; column: number; row: number }[] = [
  { slot: "headwear", column: 2, row: 1 },
  { slot: "eyepiece", column: 1, row: 2 },
  { slot: "necklace", column: 2, row: 2 },
  { slot: "cloak", column: 3, row: 2 },
  { slot: "gloves", column: 1, row: 3 },
  { slot: "armor", column: 2, row: 3 },
  { slot: "bracers", column: 3, row: 3 },
  { slot: "garment", column: 2, row: 4 },
  { slot: "ring-left", column: 1, row: 5 },
  { slot: "belt", column: 2, row: 5 },
  { slot: "ring-right", column: 3, row: 5 },
  { slot: "footwear", column: 2, row: 6 },
];

const FEAT_LABEL: Record<string, string> = {
  ancestry: "Ancestry",
  class: "Class",
  skill: "Skill",
  general: "General",
};

const TRADITION_LABEL: Record<string, string> = {
  arcane: "Arcane",
  divine: "Divine",
  occult: "Occult",
  primal: "Primal",
};

export function featLabel(category: string): string {
  return FEAT_LABEL[category] ?? category;
}

export function traditionLabel(tradition: string): string {
  return TRADITION_LABEL[tradition] ?? "";
}

export function rankLabel(rank: number): string {
  return rank <= 0 ? "Cantrips" : `Rank ${rank}`;
}

export function dollFaceLabel(slot: ItemSlot): string {
  if (slot === "ring-left" || slot === "ring-right") return "Ring";
  if (slot === "hand-left" || slot === "hand-right" || slot === "hands") return "Hand";
  return SLOT_NAME[slot];
}

export function slotChip(slot: ItemSlot): string {
  if (slot === "ring-left" || slot === "ring-right") return "Ring";
  if (slot === "hand-left" || slot === "hand-right") return "Hand";
  if (slot === "hands") return "2 hands";
  if (slot === "other") return "Other";
  return SLOT_NAME[slot];
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Light bulk is one tenth. "L" and "2L" count; a bare number is whole bulk. */
export function bulkTenths(raw: string): number {
  const text = raw.trim().toLowerCase();
  if (!text || text === "-") return 0;
  if (text === "l") return 1;
  const lights = /^(\d+)l$/.exec(text);
  if (lights) return Number(lights[1]);
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 10);
}

export function formatBulk(tenths: number): string {
  const safe = Math.max(0, tenths);
  const whole = Math.floor(safe / 10);
  const frac = safe % 10;
  return frac === 0 ? String(whole) : `${whole}.${frac}`;
}

function blockedBy(slot: ItemSlot): ItemSlot[] {
  if (slot === "hands") return ["hands", "hand-left", "hand-right"];
  if (slot === "hand-left" || slot === "hand-right") return [slot, "hands"];
  return [slot];
}

export function equipItem(items: InventoryItem[], itemId: string, slot: ItemSlot | null): InventoryItem[] {
  if (slot === null) {
    return items.map((item) => (item.id === itemId ? { ...item, slot: null } : item));
  }
  const block = new Set(blockedBy(slot));
  return items.map((item) => {
    if (item.id === itemId) return { ...item, slot };
    if (item.slot && block.has(item.slot)) return { ...item, slot: null };
    return item;
  });
}
