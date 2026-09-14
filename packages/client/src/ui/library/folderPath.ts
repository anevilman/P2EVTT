import type { LibraryFolder } from "@p2evtt/shared";
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

export function targetFolderId(
  selection: Selection,
  items: { id: string; folderId: string | null }[],
): string | null {
  if (selection.kind === "folder") return selection.id;
  if (selection.kind === "item") {
    return items.find((s) => s.id === selection.id)?.folderId ?? null;
  }
  return null;
}

/** Root (null) is only the root itself. A folder includes nested folders. */
export function folderAndDescendants(
  folders: LibraryFolder[],
  rootId: string | null,
): Set<string | null> {
  if (rootId === null) return new Set([null]);
  const ids = new Set<string | null>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (folder.parentId !== null && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        grew = true;
      }
    }
  }
  return ids;
}
