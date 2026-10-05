import { useState } from "react";
import { sheetOwnedBy, type CharacterSheetEntry, type LibraryFolder } from "@p2evtt/shared";
import { gmFetch } from "../net/gmApi";
import { CharacterSheetEditor } from "./CharacterSheetEditor";
import { useDebouncedStatSave } from "./debouncedStatSave";
import { folderPath, targetFolderId } from "./library/folderPath";
import { LibraryTree, type Selection } from "./library/LibraryTree";

type Props = {
  sessionToken: string;
  library: CharacterSheetEntry[];
  folders: LibraryFolder[];
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onSnapshot: (library: CharacterSheetEntry[], folders: LibraryFolder[]) => void;
  actor: { role: "gm" } | { role: "player"; name: string };
};

type SheetSnap = {
  sheetLibrary?: CharacterSheetEntry[];
  sheetFolders?: LibraryFolder[];
  createdId?: string;
};

export function SheetLibrary({
  sessionToken,
  library,
  folders,
  selection,
  onSelect,
  onSnapshot,
  actor,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const isGm = actor.role === "gm";

  const applySnap = (raw: unknown) => {
    const snap = raw as SheetSnap | null;
    if (snap?.sheetLibrary && snap.sheetFolders) onSnapshot(snap.sheetLibrary, snap.sheetFolders);
    return snap;
  };

  const persistSheet = useDebouncedStatSave((id: string, data: CharacterSheetEntry["data"]) =>
    gmFetch(`/api/character-sheets/${id}`, sessionToken, {
      method: "PATCH",
      body: JSON.stringify({ data }),
    })
      .then(applySnap)
      .catch((err: unknown) => {
        setStatus(err instanceof Error ? err.message : "Could not save character sheet");
      }),
  );

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setStatus(label);
    try {
      applySnap(await fn());
      setStatus(null);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : label);
    }
  };

  const owned = (sheet: CharacterSheetEntry) =>
    isGm || sheetOwnedBy(folders, sheet.folderId, actor.role === "player" ? actor.name : "");
  const selected = selection.kind === "item" ? library.find((sheet) => sheet.id === selection.id) : null;
  const canEdit = selected ? owned(selected) : false;
  const folderId = targetFolderId(selection, library);

  const commitRename = (id: string) => {
    const name = draft.trim();
    setEditingId(null);
    const sheet = library.find((item) => item.id === id);
    const folder = folders.find((item) => item.id === id);
    if (!name) return;
    if (sheet && name === sheet.name) return;
    if (folder && name === folder.name) return;
    const path = sheet ? `/api/character-sheets/${id}` : `/api/character-folders/${id}`;
    void run("Renaming…", () =>
      gmFetch(path, sessionToken, { method: "PATCH", body: JSON.stringify({ name }) }),
    );
  };

  const backToList = () => {
    onSelect(selected?.folderId ? { kind: "folder", id: selected.folderId } : { kind: "root" });
  };

  return (
    <div className={selected ? "scene-library token-library sheet-focus" : "scene-library token-library"}>
      {selected ? (
        <div className="sheet-open-bar">
          <button type="button" className="sheet-back" onClick={backToList}>
            ← Sheets
          </button>
          <span className="sheet-open-name">{selected.name}</span>
        </div>
      ) : null}
      <h2 className={selected ? "sheet-hidden" : undefined}>Character sheets</h2>
      <div className={selected ? "lib-tree-wrap sheet-hidden" : "lib-tree-wrap"}>
        <LibraryTree
          folders={folders}
          items={library}
          selection={selection}
          editingId={editingId}
          draft={draft}
          onDraft={setDraft}
          onSelect={onSelect}
          allowOrganize={isGm}
          canDeleteFolder={() => isGm}
          canRenameFolder={() => isGm}
          canDeleteItem={(item) => owned(item)}
          canRenameItem={(item) => owned(item)}
          renderItemBadge={(item) => (actor.role === "player" && owned(item) ? "Yours" : null)}
          onStartRename={(id, name) => {
            setEditingId(id);
            setDraft(name);
          }}
          onCommitRename={commitRename}
          onCancelRename={() => setEditingId(null)}
          onDeleteFolder={(id) => {
            void run("Deleting…", () =>
              gmFetch(`/api/character-folders/${id}`, sessionToken, { method: "DELETE" }),
            );
          }}
          onDeleteItem={(id) => {
            persistSheet.cancelId(id);
            void run("Deleting…", () =>
              gmFetch(`/api/character-sheets/${id}`, sessionToken, { method: "DELETE" }),
            );
          }}
          onMoveItem={(itemId, nextFolderId) => {
            const current = library.find((sheet) => sheet.id === itemId);
            if (!current || current.folderId === nextFolderId) return;
            void run("Moving…", () =>
              gmFetch(`/api/character-sheets/${itemId}`, sessionToken, {
                method: "PATCH",
                body: JSON.stringify({ folderId: nextFolderId }),
              }),
            );
          }}
        />
      </div>
      <div className={selected ? "lib-actions sheet-hidden" : "lib-actions"}>
        {isGm ? (
          <button
            type="button"
            className="file-btn"
            onClick={() => {
              void run("Creating…", async () => {
                const snap = (await gmFetch("/api/character-folders", sessionToken, {
                  method: "POST",
                  body: JSON.stringify({ name: "New folder", parentId: folderId }),
                })) as SheetSnap | null;
                if (snap?.createdId) onSelect({ kind: "folder", id: snap.createdId });
                return snap;
              });
            }}
          >
            New folder
          </button>
        ) : null}
        <button
          type="button"
          className="file-btn"
          onClick={() => {
            void run("Creating…", async () => {
              const snap = (await gmFetch("/api/character-sheets", sessionToken, {
                method: "POST",
                body: JSON.stringify(
                  isGm ? { name: "New character", folderId } : { name: "New character" },
                ),
              })) as SheetSnap | null;
              if (snap?.createdId) onSelect({ kind: "item", id: snap.createdId });
              return snap;
            });
          }}
        >
          New character
        </button>
      </div>
      {selected ? (
        <>
          {isGm ? (
            <label className="folder-move">
              Folder
              <select
                value={selected.folderId ?? ""}
                onChange={(e) => {
                  const next = e.target.value === "" ? null : e.target.value;
                  if (next === selected.folderId) return;
                  void run("Moving…", () =>
                    gmFetch(`/api/character-sheets/${selected.id}`, sessionToken, {
                      method: "PATCH",
                      body: JSON.stringify({ folderId: next }),
                    }),
                  );
                }}
              >
                <option value="">Library root</option>
                {folders
                  .slice()
                  .sort((a, b) => folderPath(folders, a.id).localeCompare(folderPath(folders, b.id)))
                  .map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folderPath(folders, folder.id)}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          {canEdit ? (
            <p className="meta">Edits save on this sheet. Tokens linked to it use the same record.</p>
          ) : (
            <p className="meta">Read only. Sheets in a folder with your name are yours to edit.</p>
          )}
          <div className="sheet-editor-host">
            <CharacterSheetEditor
              key={selected.id}
              data={selected.data}
              readOnly={!canEdit}
              onChange={(data) => persistSheet.schedule(selected.id, data)}
            />
          </div>
        </>
      ) : (
        <p className="meta">
          {isGm
            ? "Select a character sheet to edit it."
            : "New characters are created in a folder with your name. You can keep more than one."}
        </p>
      )}
      {status ? <p className="meta">{status}</p> : null}
    </div>
  );
}
