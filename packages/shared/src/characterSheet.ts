import type { LibraryFolder } from "./protocol";
import { emptyStatBlock, parseStatBlockData, type StatBlockData } from "./statBlock";

export type CharacterSheetData = StatBlockData & {
  ancestry: string;
  heritage: string;
  background: string;
  className: string;
  heroPoints: number;
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
