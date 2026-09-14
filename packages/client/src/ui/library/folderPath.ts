import type { LibraryFolder, SceneSummary } from "@p2evtt/shared";
import type { Selection } from "./LibraryTree";

export function folderPath(folders: LibraryFolder[], id: string): string {
  const parts: string[] = [];
  let current: string | null = id;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const folder = folders.find((f) => f.id === current);
    if (!folder) break;
    parts.unshift(folder.name);
    current = folder.parentId;
  }
  return parts.join(" / ");
}

export function targetFolderId(selection: Selection, library: SceneSummary[]): string | null {
  if (selection.kind === "folder") return selection.id;
  if (selection.kind === "item") {
    return library.find((s) => s.id === selection.id)?.folderId ?? null;
  }
  return null;
}
