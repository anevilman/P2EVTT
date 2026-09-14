import { useState } from "react";
import type { LibraryFolder, ScenePublic, SceneSummary } from "@p2evtt/shared";
import { gmFetch } from "../net/gmApi";
import { LibraryTree, type Selection } from "./library/LibraryTree";

type Props = {
  sessionToken: string;
  live: ScenePublic;
  library: SceneSummary[];
  folders: LibraryFolder[];
  selection: Selection;
  onSelect: (selection: Selection) => void;
};

function targetFolderId(selection: Selection, library: SceneSummary[]): string | null {
  if (selection.kind === "folder") return selection.id;
  if (selection.kind === "item") {
    return library.find((s) => s.id === selection.id)?.folderId ?? null;
  }
  return null;
}

export function SceneLibrary({
  sessionToken,
  live,
  library,
  folders,
  selection,
  onSelect,
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
