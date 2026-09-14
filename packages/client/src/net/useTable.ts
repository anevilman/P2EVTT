import { useRef, useState } from "react";
import type { LibraryFolder, Presence, ScenePublic, SceneSummary } from "@p2evtt/shared";
import {
  loadDisplayName,
  loadSessionToken,
  saveDisplayName,
  saveSessionToken,
} from "../storage";
import { useTheme } from "../useTheme";
import { connectTable, type TableSession } from "./socket";

export function useTable() {
  const conn = useRef<{ close: () => void } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<TableSession | null>(null);
  const [players, setPlayers] = useState<Presence[]>([]);
  const [scene, setScene] = useState<ScenePublic | null>(null);
  const [library, setLibrary] = useState<SceneSummary[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const { theme, toggle: toggleTheme } = useTheme();

  const applySnapshot = (next: {
    scene: ScenePublic;
    library: SceneSummary[];
    folders: LibraryFolder[];
  }) => {
    setScene(next.scene);
    setLibrary(next.library);
    setFolders(next.folders);
  };

  const join = (displayName: string, wantGm: boolean) => {
    if (displayName.length < 1) return;
    saveDisplayName(displayName);
    setBusy(true);
    setError(null);
    conn.current?.close();
    conn.current = connectTable({
      displayName,
      wantGm,
      sessionToken: loadSessionToken(),
      handlers: {
        onHello: (next) => {
          saveSessionToken(next.sessionToken);
          setSession(next);
          setPlayers(next.players);
          applySnapshot(next);
          setBusy(false);
        },
        onPresence: (list) => setPlayers(list),
        onScene: (next, nextLibrary, nextFolders) => {
          applySnapshot({ scene: next, library: nextLibrary, folders: nextFolders });
        },
        onRejected: (reason) => {
          conn.current?.close();
          conn.current = null;
          setBusy(false);
          setError(reason);
        },
        onError: (message) => setError(message),
        onClosed: () => {
          setSession(null);
          setBusy(false);
        },
      },
    });
  };

  return {
    busy,
    error,
    session,
    players,
    scene,
    library,
    folders,
    theme,
    toggleTheme,
    defaultName: loadDisplayName(),
    join,
  };
}
