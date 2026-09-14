import { useRef, useState } from "react";
import type { LibraryFolder, StatBlockData, StatBlockEntry } from "@p2evtt/shared";
import { gmFetch } from "../net/gmApi";
import { folderPath, targetFolderId } from "./library/folderPath";
import { LibraryTree, type Selection } from "./library/LibraryTree";
import { StatBlockEditor } from "./StatBlockEditor";

type Props = {
  sessionToken: string;
  library: StatBlockEntry[];
  folders: LibraryFolder[];
  selection: Selection;
  onSelect: (selection: Selection) => void;
};

export function StatLibrary({ sessionToken, library, folders, selection, onSelect }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const saveTimer = useRef<number>(0);

  const run = async (label: string, fn: () => Promise<void>) => {
    setStatus(label);
    try {
      await fn();
      setStatus(null);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : label);
    }
  };

  const selected = selection.kind === "item" ? library.find((t) => t.id === selection.id) : null;
  const folderId = targetFolderId(selection, library);

  const commitRename = (id: string) => {
    const name = draft.trim();
    setEditingId(null);
    const block = library.find((t) => t.id === id);
    const folder = folders.find((f) => f.id === id);
    if (!name) return;
    if (block && name === block.name) return;
    if (folder && name === folder.name) return;
    const path = block ? `/api/stat-blocks/${id}` : `/api/stat-folders/${id}`;
    void run("Renaming…", () =>
      gmFetch(path, sessionToken, { method: "PATCH", body: JSON.stringify({ name }) }).then(() => undefined),
    );
  };

  const saveData = (data: StatBlockData) => {
    if (!selected) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void run("Saving…", () =>
        gmFetch(`/api/stat-blocks/${selected.id}`, sessionToken, {
          method: "PATCH",
          body: JSON.stringify({ data }),
        }).then(() => undefined),
      );
    }, 400);
  };

  return (
    <div className="scene-library token-library">
      <h2>Stat blocks</h2>
      <div className="lib-tree-wrap">
        <LibraryTree
          folders={folders}
          items={library}
          selection={selection}
          editingId={editingId}
          draft={draft}
          onDraft={setDraft}
          onSelect={onSelect}
          onStartRename={(id, name) => {
            setEditingId(id);
            setDraft(name);
          }}
          onCommitRename={commitRename}
          onCancelRename={() => setEditingId(null)}
          onDeleteFolder={(id) => {
            void run("Deleting…", () =>
              gmFetch(`/api/stat-folders/${id}`, sessionToken, { method: "DELETE" }).then(() => undefined),
            );
          }}
          onDeleteItem={(id) => {
            void run("Deleting…", () =>
              gmFetch(`/api/stat-blocks/${id}`, sessionToken, { method: "DELETE" }).then(() => undefined),
            );
          }}
          onMoveItem={(itemId, nextFolderId) => {
            const current = library.find((t) => t.id === itemId);
            if (!current || current.folderId === nextFolderId) return;
            void run("Moving…", () =>
              gmFetch(`/api/stat-blocks/${itemId}`, sessionToken, {
                method: "PATCH",
                body: JSON.stringify({ folderId: nextFolderId }),
              }).then(() => undefined),
            );
          }}
        />
      </div>
      <div className="lib-actions">
        <button
          type="button"
          className="file-btn"
          onClick={() => {
            void run("Creating…", async () => {
              const snap = (await gmFetch("/api/stat-folders", sessionToken, {
                method: "POST",
                body: JSON.stringify({ name: "New folder", parentId: folderId }),
              })) as { createdId?: string };
              if (snap.createdId) onSelect({ kind: "folder", id: snap.createdId });
            });
          }}
        >
          New folder
        </button>
        <button
          type="button"
          className="file-btn"
          onClick={() => {
            void run("Creating…", async () => {
              const snap = (await gmFetch("/api/stat-blocks", sessionToken, {
                method: "POST",
                body: JSON.stringify({ name: "New stat block", folderId }),
              })) as { createdId?: string };
              if (snap.createdId) onSelect({ kind: "item", id: snap.createdId });
            });
          }}
        >
          New block
        </button>
      </div>
      {selected ? (
        <>
          <label className="folder-move">
            Folder
            <select
              value={selected.folderId ?? ""}
              onChange={(e) => {
                const next = e.target.value === "" ? null : e.target.value;
                if (next === selected.folderId) return;
                void run("Moving…", () =>
                  gmFetch(`/api/stat-blocks/${selected.id}`, sessionToken, {
                    method: "PATCH",
                    body: JSON.stringify({ folderId: next }),
                  }).then(() => undefined),
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
          <StatBlockEditor data={selected.data} onChange={saveData} />
        </>
      ) : (
        <p className="meta">Select a stat block to edit the template.</p>
      )}
      {status ? <p className="meta">{status}</p> : null}
    </div>
  );
}
