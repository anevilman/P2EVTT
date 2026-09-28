import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type { CharacterSheetEntry, ClientMsg, LibraryFolder, StatBlockEntry } from "@p2evtt/shared";
import { connectTable } from "../net/socket";
import { loadSessionToken, saveDisplayName, saveSessionToken, writeLocal } from "../storage";
import type { Theme } from "../theme";
import { useTheme } from "../useTheme";
import type { Selection } from "../ui/library/LibraryTree";
import type { PlaceKind } from "../ui/TokenLibrary";
import { GM_DOCK_KEY, initialState, PLAYER_DOCK_KEY, reducer } from "./reducer";
import type { DockId, TableState } from "./types";

type Actions = {
  join: (displayName: string, wantGm: boolean) => void;
  toggleTheme: () => void;
  toggleDock: (dock: DockId, tab: string) => void;
  openDock: (dock: DockId, tab: string) => void;
  inspectToken: (id: string) => void;
  setSceneSelection: (selection: Selection) => void;
  setTokenSelection: (selection: Selection) => void;
  setStatSelection: (selection: Selection) => void;
  setSheetSelection: (selection: Selection) => void;
  setPlaceKind: (kind: PlaceKind) => void;
  setFogDraw: (on: boolean) => void;
  setSelectedPlaced: (id: string | null) => void;
  applyStats: (library: StatBlockEntry[], folders: LibraryFolder[]) => void;
  applySheets: (library: CharacterSheetEntry[], folders: LibraryFolder[]) => void;
  roll: (formula: string, dc: number | null) => void;
  finishRoll: (id: string) => void;
};

type StoreValue = {
  state: TableState;
  theme: Theme;
  actions: Actions;
};

const StoreContext = createContext<StoreValue | null>(null);

export function TableStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const { theme, toggle: toggleTheme } = useTheme();
  const conn = useRef<{ send: (msg: ClientMsg) => void; close: () => void } | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    writeLocal(GM_DOCK_KEY, state.ui.docks.gm ?? "");
    writeLocal(PLAYER_DOCK_KEY, state.ui.docks.player ?? "");
  }, [state.ui.docks.gm, state.ui.docks.player]);

  useEffect(() => {
    return () => {
      generation.current += 1;
      conn.current?.close();
    };
  }, []);

  const actions = useMemo<Actions>(() => {
    const join = (displayName: string, wantGm: boolean) => {
      if (displayName.length < 1) return;
      saveDisplayName(displayName);
      const gen = ++generation.current;
      dispatch({ type: "join/start" });
      conn.current?.close();
      conn.current = connectTable({
        displayName,
        wantGm,
        sessionToken: loadSessionToken(),
        handlers: {
          onHello: (next) => {
            if (gen !== generation.current) return;
            saveSessionToken(next.sessionToken);
            dispatch({ type: "hello", session: next });
          },
          onPresence: (players) => {
            if (gen !== generation.current) return;
            dispatch({ type: "presence", players });
          },
          onScene: (scene, library, folders) => {
            if (gen !== generation.current) return;
            dispatch({ type: "scene", scene, library, folders });
          },
          onTokens: (tokenLibrary, tokenFolders, tokens) => {
            if (gen !== generation.current) return;
            dispatch({ type: "tokens", tokenLibrary, tokenFolders, tokens });
          },
          onStats: (statLibrary, statFolders) => {
            if (gen !== generation.current) return;
            dispatch({ type: "stats", statLibrary, statFolders });
          },
          onSheets: (sheetLibrary, sheetFolders) => {
            if (gen !== generation.current) return;
            dispatch({ type: "sheets", sheetLibrary, sheetFolders });
          },
          onRejected: (reason) => {
            if (gen !== generation.current) return;
            conn.current?.close();
            conn.current = null;
            dispatch({ type: "rejected", reason });
          },
          onError: (message) => {
            if (gen !== generation.current) return;
            dispatch({ type: "error", message });
          },
          onRoll: (roll) => {
            if (gen !== generation.current) return;
            dispatch({ type: "roll/result", roll });
          },
          onClosed: () => {
            if (gen !== generation.current) return;
            dispatch({ type: "closed" });
          },
        },
      });
    };

    return {
      join,
      toggleTheme,
      toggleDock: (dock, tab) => dispatch({ type: "ui/toggleDock", dock, tab }),
      openDock: (dock, tab) => dispatch({ type: "ui/openDock", dock, tab }),
      inspectToken: (id) => dispatch({ type: "ui/inspectToken", id }),
      setSceneSelection: (selection) => dispatch({ type: "ui/sceneSelection", selection }),
      setTokenSelection: (selection) => dispatch({ type: "ui/tokenSelection", selection }),
      setStatSelection: (selection) => dispatch({ type: "ui/statSelection", selection }),
      setSheetSelection: (selection) => dispatch({ type: "ui/sheetSelection", selection }),
      setPlaceKind: (kind) => dispatch({ type: "ui/placeKind", kind }),
      setFogDraw: (on) => dispatch({ type: "ui/fogDraw", on }),
      setSelectedPlaced: (id) => dispatch({ type: "ui/selectedPlaced", id }),
      applyStats: (statLibrary, statFolders) => dispatch({ type: "stats", statLibrary, statFolders }),
      applySheets: (sheetLibrary, sheetFolders) => dispatch({ type: "sheets", sheetLibrary, sheetFolders }),
      roll: (formula, dc) => conn.current?.send({ type: "roll", formula, dc }),
      finishRoll: (id) => dispatch({ type: "roll/done", id }),
    };
  }, [toggleTheme]);

  const value = useMemo(() => ({ state, theme, actions }), [state, theme, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside TableStoreProvider");
  return value;
}
