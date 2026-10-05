import type { LibraryFolder } from "./protocol";
import { emptyStatBlock, parseStatBlockData, type StatBlockData } from "./statBlock";

export const ITEM_SLOTS = [
  "headwear",
  "eyepiece",
  "necklace",
  "cloak",
  "gloves",
  "armor",
  "bracers",
  "garment",
  "ring-left",
  "belt",
  "ring-right",
  "footwear",
  "hand-left",
  "hand-right",
  "hands",
  "other",
] as const;

export type ItemSlot = (typeof ITEM_SLOTS)[number];

export type InventoryItem = {
  id: string;
  name: string;
  qty: number;
  bulk: string;
  slot: ItemSlot | null;
  invested: boolean;
  notes: string;
};

export const FEAT_CATEGORIES = ["ancestry", "class", "skill", "general"] as const;

export type FeatCategory = (typeof FEAT_CATEGORIES)[number];

export type FeatLine = {
  id: string;
  name: string;
  level: number;
  category: FeatCategory;
  traits: string;
  notes: string;
};

export const SPELL_TRADITIONS = ["arcane", "divine", "occult", "primal"] as const;

export type SpellTradition = (typeof SPELL_TRADITIONS)[number] | "";

export type SpellLine = {
  id: string;
  name: string;
  rank: number;
  tradition: SpellTradition;
  notes: string;
};

export type PreparedSlot = {
  id: string;
  rank: number;
  spellId: string | null;
  name: string;
  spent: boolean;
};

export type RepertoirePool = {
  rank: number;
  max: number;
  remaining: number;
};

export type CharacterSheetData = StatBlockData & {
  ancestry: string;
  heritage: string;
  background: string;
  className: string;
  heroPoints: number;
  inventory: InventoryItem[];
  feats: FeatLine[];
  spellsKnown: SpellLine[];
  spellsPrepared: PreparedSlot[];
  repertoire: SpellLine[];
  repertoirePools: RepertoirePool[];
};

export type CharacterSheetEntry = {
  id: string;
  name: string;
  folderId: string | null;
  data: CharacterSheetData;
};

export function emptyCharacterSheet(): CharacterSheetData {
  return {
    ...emptyStatBlock(),
    ancestry: "",
    heritage: "",
    background: "",
    className: "",
    heroPoints: 1,
    inventory: [],
    feats: [],
    spellsKnown: [],
    repertoire: [],
    spellsPrepared: [],
    repertoirePools: [],
  };
}

export function sheetOwnedBy(
  folders: Pick<LibraryFolder, "id" | "name" | "parentId">[],
  folderId: string | null,
  playerName: string,
): boolean {
  const want = playerName.trim().toLowerCase();
  if (!want || !folderId) return false;
  const seen = new Set<string>();
  let current: string | null = folderId;
  while (current && !seen.has(current)) {
    seen.add(current);
    const folder = folders.find((item) => item.id === current);
    if (!folder) return false;
    if (folder.name.trim().toLowerCase() === want) return true;
    current = folder.parentId;
  }
  return false;
}

function text(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

function whole(raw: unknown, fallback: number): number {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Math.trunc(whole(raw, fallback));
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function flag(raw: unknown): boolean {
  return raw === true;
}

function nid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}`;
}

function takeId(raw: unknown, seen: Set<string>): string {
  let id = typeof raw === "string" && raw.trim() ? raw : nid();
  while (seen.has(id)) id = nid();
  seen.add(id);
  return id;
}

const SLOT_SET = new Set<string>(ITEM_SLOTS);

function parseSlot(raw: unknown): ItemSlot | null {
  if (typeof raw !== "string" || !SLOT_SET.has(raw)) return null;
  return raw as ItemSlot;
}

function parseCategory(raw: unknown): FeatCategory {
  if (raw === "ancestry" || raw === "class" || raw === "skill" || raw === "general") return raw;
  return "general";
}

function parseTradition(raw: unknown): SpellTradition {
  if (raw === "arcane" || raw === "divine" || raw === "occult" || raw === "primal") return raw;
  return "";
}

function handsBlocked(slot: ItemSlot): ItemSlot[] {
  if (slot === "hands") return ["hands", "hand-left", "hand-right"];
  if (slot === "hand-left" || slot === "hand-right") return [slot, "hands"];
  return [slot];
}

function parseItems(raw: unknown): InventoryItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: InventoryItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    out.push({
      id: takeId(row.id, seen),
      name: text(row.name),
      qty: clampInt(row.qty, 1, 0, 999),
      bulk: text(row.bulk),
      slot: parseSlot(row.slot),
      invested: flag(row.invested),
      notes: text(row.notes),
    });
  }
  const held = new Map<ItemSlot, number>();
  for (let i = 0; i < out.length; i += 1) {
    const slot = out[i].slot;
    if (!slot) continue;
    for (const taken of handsBlocked(slot)) {
      const prev = held.get(taken);
      if (prev !== undefined) out[prev].slot = null;
      held.delete(taken);
    }
    held.set(slot, i);
  }
  return out;
}

function parseFeats(raw: unknown): FeatLine[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: FeatLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    out.push({
      id: takeId(row.id, seen),
      name: text(row.name),
      level: clampInt(row.level, 1, 0, 30),
      category: parseCategory(row.category),
      traits: text(row.traits),
      notes: text(row.notes),
    });
  }
  return out;
}

function parseSpells(raw: unknown): SpellLine[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SpellLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    out.push({
      id: takeId(row.id, seen),
      name: text(row.name),
      rank: clampInt(row.rank, 0, 0, 10),
      tradition: parseTradition(row.tradition),
      notes: text(row.notes),
    });
  }
  return out;
}

function parsePrepared(raw: unknown): PreparedSlot[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PreparedSlot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    out.push({
      id: takeId(row.id, seen),
      rank: clampInt(row.rank, 0, 0, 10),
      spellId: typeof row.spellId === "string" && row.spellId ? row.spellId : null,
      name: text(row.name),
      spent: flag(row.spent),
    });
  }
  return out;
}

function parsePools(raw: unknown): RepertoirePool[] {
  if (!Array.isArray(raw)) return [];
  const byRank = new Map<number, RepertoirePool>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const rank = clampInt(row.rank, 0, 0, 10);
    if (rank <= 0) continue;
    const max = clampInt(row.max, 0, 0, 15);
    byRank.set(rank, {
      rank,
      max,
      remaining: clampInt(row.remaining, 0, 0, max),
    });
  }
  return [...byRank.values()].sort((a, b) => a.rank - b.rank);
}

export function parseCharacterSheetData(raw: unknown): CharacterSheetData {
  const base = emptyCharacterSheet();
  const combat = parseStatBlockData(raw);
  const d = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    ...combat,
    ancestry: text(d.ancestry),
    heritage: text(d.heritage),
    background: text(d.background),
    className: text(d.className),
    heroPoints: whole(d.heroPoints, base.heroPoints),
    inventory: parseItems(d.inventory),
    feats: parseFeats(d.feats),
    spellsKnown: parseSpells(d.spellsKnown),
    spellsPrepared: parsePrepared(d.spellsPrepared),
    repertoire: parseSpells(d.repertoire),
    repertoirePools: parsePools(d.repertoirePools),
  };
}

export function parseCharacterSheetEntry(raw: unknown): CharacterSheetEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as { id?: unknown; name?: unknown; folderId?: unknown; data?: unknown };
  if (typeof e.id !== "string" || typeof e.name !== "string") return null;
  return {
    id: e.id,
    name: e.name,
    folderId: typeof e.folderId === "string" ? e.folderId : null,
    data: parseCharacterSheetData(e.data),
  };
}
