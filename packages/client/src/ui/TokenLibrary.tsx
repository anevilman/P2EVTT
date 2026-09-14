import { useState } from "react";
import { TOKEN_SIZES, type LibraryFolder, type TokenPrototype, type TokenSize } from "@p2evtt/shared";
import { gmFetch } from "../net/gmApi";
import { folderPath, targetFolderId } from "./library/folderPath";
import { LibraryTree, type Selection } from "./library/LibraryTree";

type Props = {
  sessionToken: string;
  library: TokenPrototype[];
  folders: LibraryFolder[];
  selection: Selection;
  onSelect: (selection: Selection) => void;
  placeMode: boolean;
  onTogglePlace: () => void;
};

export function TokenLibrary({
  sessionToken,
  library,
  folders,
  selection,
  onSelect,
  placeMode,
  onTogglePlace,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);

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
    const proto = library.find((t) => t.id === id);
    const folder = folders.find((f) => f.id === id);
    if (!name) return;
    if (proto && name === proto.name) return;
    if (folder && name === folder.name) return;
    const path = proto ? `/api/token-prototypes/${id}` : `/api/token-folders/${id}`;
    void run("Renaming…", () =>
      gmFetch(path, sessionToken, { method: "PATCH", body: JSON.stringify({ name }) }).then(
        () => undefined,
      ),
    );
  };

  const onArt = async (file: File | undefined) => {
    if (!file || !selected) return;
    const body = new FormData();
    body.append("file", file);
    await run("Uploading…", () =>
      gmFetch(`/api/token-prototypes/${selected.id}/art`, sessionToken, {
        method: "POST",
        body,
      }).then(() => undefined),
    );
  };

  return (
    <div className="scene-library">
      <h2>Tokens</h2>
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
              gmFetch(`/api/token-folders/${id}`, sessionToken, { method: "DELETE" }).then(
                () => undefined,
              ),
            );
          }}
          onDeleteItem={(id) => {
            void run("Deleting…", () =>
              gmFetch(`/api/token-prototypes/${id}`, sessionToken, { method: "DELETE" }).then(
                () => undefined,
              ),
            );
          }}
          onMoveItem={(itemId, nextFolderId) => {
            const current = library.find((t) => t.id === itemId);
            if (!current || current.folderId === nextFolderId) return;
            void run("Moving…", () =>
              gmFetch(`/api/token-prototypes/${itemId}`, sessionToken, {
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
              const snap = (await gmFetch("/api/token-folders", sessionToken, {
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
              const snap = (await gmFetch("/api/token-prototypes", sessionToken, {
                method: "POST",
                body: JSON.stringify({ name: "New token", folderId }),
              })) as { createdId?: string };
              if (snap.createdId) onSelect({ kind: "item", id: snap.createdId });
            });
          }}
        >
          New token
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
                  gmFetch(`/api/token-prototypes/${selected.id}`, sessionToken, {
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
          <label className="folder-move">
            Default size (new placements)
            <select
              value={selected.size}
              onChange={(e) => {
                void run("Updating…", () =>
                  gmFetch(`/api/token-prototypes/${selected.id}`, sessionToken, {
                    method: "PATCH",
                    body: JSON.stringify({ size: e.target.value as TokenSize }),
                  }).then(() => undefined),
                );
              }}
            >
              {TOKEN_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <TokenArtButton onFile={onArt} />
          <button
            type="button"
            className={placeMode ? "file-btn play-btn" : "file-btn"}
            onClick={onTogglePlace}
          >
            {placeMode ? "Click the map to place…" : "Place on map"}
          </button>
        </>
      ) : null}
      {status ? (
        <p className="meta">{status}</p>
      ) : (
        <p className="meta">Select a token, then place it on the live or editing scene.</p>
      )}
    </div>
  );
}

function TokenArtButton({ onFile }: { onFile: (file: File | undefined) => void }) {
  return (
    <label className="file-btn" style={{ display: "block", textAlign: "center", cursor: "pointer" }}>
      Upload token art
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          onFile(file);
        }}
      />
    </label>
  );
}
