import { useState } from "react";
import type { ScenePublic, SceneSummary } from "@p2evtt/shared";

type Props = {
  sessionToken: string;
  scene: ScenePublic;
  library: SceneSummary[];
};

async function gmFetch(path: string, sessionToken: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: {
      "X-Session-Token": sessionToken,
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error ?? `Request failed (${res.status})`);
  }
}

export function SceneLibrary({ sessionToken, scene, library }: Props) {
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

  const startRename = (item: SceneSummary) => {
    setEditingId(item.id);
    setDraft(item.name);
  };

  const commitRename = (id: string) => {
    const name = draft.trim();
    setEditingId(null);
    if (!name || name === library.find((s) => s.id === id)?.name) return;
    void run("Renaming…", () =>
      gmFetch(`/api/scenes/${id}`, sessionToken, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    );
  };

  return (
    <div className="scene-library">
      <h2>Scenes</h2>
      <ul className="scene-list">
        {library.map((item) => {
          const active = item.id === scene.id;
          return (
            <li key={item.id} className={active ? "scene-item active" : "scene-item"}>
              {editingId === item.id ? (
                <input
                  className="scene-rename"
                  value={draft}
                  autoFocus
                  maxLength={48}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="scene-name"
                  onClick={() => {
                    if (!active) {
                      void run("Switching…", () =>
                        gmFetch(`/api/scenes/${item.id}/activate`, sessionToken, {
                          method: "POST",
                        }),
                      );
                    }
                  }}
                  onDoubleClick={() => startRename(item)}
                >
                  {item.name}
                </button>
              )}
              <button
                type="button"
                className="scene-x"
                title="Delete scene"
                disabled={library.length < 2}
                onClick={() => {
                  void run("Deleting…", () =>
                    gmFetch(`/api/scenes/${item.id}`, sessionToken, { method: "DELETE" }),
                  );
                }}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="file-btn"
        onClick={() => {
          void run("Creating…", () =>
            gmFetch("/api/scenes", sessionToken, {
              method: "POST",
              body: JSON.stringify({ name: "New scene" }),
            }),
          );
        }}
      >
        New scene
      </button>
      {status ? <p className="meta">{status}</p> : <p className="meta">Double-click a name to rename.</p>}
    </div>
  );
}
