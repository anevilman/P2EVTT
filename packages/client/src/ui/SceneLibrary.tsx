import { useState } from "react";
import type { LibraryFolder, SceneGrid, ScenePublic, SceneSummary } from "@p2evtt/shared";
import { gmFetch } from "../net/gmApi";
import { folderPath, targetFolderId } from "./library/folderPath";
import { LibraryTree, type Selection } from "./library/LibraryTree";

type Props = {
  sessionToken: string;
  live: ScenePublic;
  library: SceneSummary[];
  folders: LibraryFolder[];
  selection: Selection;
  onSelect: (selection: Selection) => void;
  fogDraw: boolean;
  onToggleFog: () => void;
};

export function SceneLibrary({
  sessionToken,
  live,
  library,
  folders,
  selection,
  onSelect,
  fogDraw,
  onToggleFog,
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

  const commitRename = (id: string) => {
    const name = draft.trim();
    setEditingId(null);
    const scene = library.find((s) => s.id === id);
    const folder = folders.find((f) => f.id === id);
    if (!name) return;
    if (scene && name === scene.name) return;
    if (folder && name === folder.name) return;
    const path = scene ? `/api/scenes/${id}` : `/api/folders/${id}`;
    void run("Renaming…", () =>
      gmFetch(path, sessionToken, { method: "PATCH", body: JSON.stringify({ name }) }).then(
        () => undefined,
      ),
    );
  };

  const selectedScene = selection.kind === "item" ? library.find((s) => s.id === selection.id) : null;
  const folderId = targetFolderId(selection, library);

  return (
    <div className="scene-library">
      <h2>Scenes</h2>
      <div className="lib-tree-wrap">
        <LibraryTree
          folders={folders}
          items={library}
          selection={selection}
          liveId={live.id}
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
              gmFetch(`/api/folders/${id}`, sessionToken, { method: "DELETE" }).then(() => undefined),
            );
          }}
          onDeleteItem={(id) => {
            void run("Deleting…", () =>
              gmFetch(`/api/scenes/${id}`, sessionToken, { method: "DELETE" }).then(() => undefined),
            );
          }}
          itemDeleteDisabled={library.length < 2}
          onMoveItem={(itemId, nextFolderId) => {
            const current = library.find((s) => s.id === itemId);
            if (!current || current.folderId === nextFolderId) return;
            void run("Moving…", () =>
              gmFetch(`/api/scenes/${itemId}`, sessionToken, {
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
              const snap = (await gmFetch("/api/folders", sessionToken, {
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
              const snap = (await gmFetch("/api/scenes", sessionToken, {
                method: "POST",
                body: JSON.stringify({ name: "New scene", folderId }),
              })) as { createdId?: string };
              if (snap.createdId) onSelect({ kind: "item", id: snap.createdId });
            });
          }}
        >
          New scene
        </button>
      </div>
      <button
        type="button"
        className={fogDraw ? "file-btn play-btn fog-toggle" : "file-btn fog-toggle"}
        onClick={onToggleFog}
      >
        Fog of War
      </button>
      {fogDraw ? (
        <p className="meta">Drag a box on the map. The × on a box removes that fog.</p>
      ) : null}
      {selectedScene ? (
        <label className="folder-move">
          Folder
          <select
            value={selectedScene.folderId ?? ""}
            onChange={(e) => {
              const next = e.target.value === "" ? null : e.target.value;
              if (next === selectedScene.folderId) return;
              void run("Moving…", () =>
                gmFetch(`/api/scenes/${selectedScene.id}`, sessionToken, {
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
      ) : null}
      {selectedScene ? (
        <GridFields
          grid={selectedScene.grid}
          onChange={(grid) => {
            void run("Updating grid…", () =>
              gmFetch(`/api/scenes/${selectedScene.id}`, sessionToken, {
                method: "PATCH",
                body: JSON.stringify({ grid }),
              }).then(() => undefined),
            );
          }}
        />
      ) : null}
      {selectedScene && selectedScene.id !== live.id ? (
        <button
          type="button"
          className="file-btn play-btn"
          onClick={() => {
            void run("Going live…", () =>
              gmFetch(`/api/scenes/${selectedScene.id}/activate`, sessionToken, {
                method: "POST",
              }).then(() => undefined),
            );
          }}
        >
          Play this scene
        </button>
      ) : null}
      {status ? (
        <p className="meta">{status}</p>
      ) : (
        <p className="meta">Click to edit. Play this scene to show it to the table.</p>
      )}
    </div>
  );
}

function GridFields({ grid, onChange }: { grid: SceneGrid; onChange: (grid: SceneGrid) => void }) {
  const g = grid ?? { enabled: true, squaresX: 24, offsetX: 0, offsetY: 0 };
  return (
    <div className="grid-fields">
      <label className="grid-check">
        <input
          type="checkbox"
          checked={g.enabled}
          onChange={(e) => onChange({ ...g, enabled: e.target.checked })}
        />
        Grid
      </label>
      <label className="folder-move">
        Squares across
        <input
          type="number"
          min={2}
          max={200}
          value={g.squaresX}
          disabled={!g.enabled}
          onChange={(e) => onChange({ ...g, squaresX: Number(e.target.value) })}
        />
      </label>
      <div className="grid-offsets">
        <label className="folder-move">
          Offset X
          <input
            type="number"
            value={g.offsetX}
            disabled={!g.enabled}
            onChange={(e) => onChange({ ...g, offsetX: Number(e.target.value) })}
          />
        </label>
        <label className="folder-move">
          Offset Y
          <input
            type="number"
            value={g.offsetY}
            disabled={!g.enabled}
            onChange={(e) => onChange({ ...g, offsetY: Number(e.target.value) })}
          />
        </label>
      </div>
    </div>
  );
}
