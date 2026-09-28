import { readLocal } from "../storage";
import type { Action, TableState } from "./types";

export const GM_DOCK_KEY = "p2evtt.dock.gm";
export const PLAYER_DOCK_KEY = "p2evtt.dock.player";

function loadDock(key: string, fallback: string): string | null {
  const raw = readLocal(key);
  if (raw === null) return fallback;
  if (raw === "") return null;
  return raw;
}

function repairSceneSelection(
  current: TableState["ui"]["sceneSelection"],
  library: TableState["library"],
  folders: TableState["folders"],
  sceneId: string,
): TableState["ui"]["sceneSelection"] {
  if (current.kind === "root") return current;
  if (current.kind === "item" && library.some((scene) => scene.id === current.id)) return current;
  if (current.kind === "folder" && folders.some((folder) => folder.id === current.id)) return current;
  return { kind: "item", id: sceneId };
}

export function initialState(): TableState {
  return {
    busy: false,
    error: null,
    session: null,
    players: [],
    scene: null,
    library: [],
    folders: [],
    tokenLibrary: [],
    tokenFolders: [],
    tokens: [],
    statLibrary: [],
    statFolders: [],
    sheetLibrary: [],
    sheetFolders: [],
    rollLog: [],
    rollQueue: [],
    ui: {
      docks: {
        gm: loadDock(GM_DOCK_KEY, "scenes"),
        player: loadDock(PLAYER_DOCK_KEY, "party"),
      },
      sceneSelection: { kind: "item", id: "" },
      tokenSelection: { kind: "root" },
      statSelection: { kind: "root" },
      sheetSelection: { kind: "root" },
      placeKind: "off",
      fogDraw: false,
      selectedPlacedId: null,
    },
  };
}

export function reducer(state: TableState, action: Action): TableState {
  switch (action.type) {
    case "join/start":
      return { ...state, busy: true, error: null };
    case "hello": {
      const next = action.session;
      return {
        ...state,
        busy: false,
        error: null,
        session: next,
        players: next.players,
        scene: next.scene,
        library: next.library,
        folders: next.folders,
        tokenLibrary: next.tokenLibrary ?? [],
        tokenFolders: next.tokenFolders ?? [],
        tokens: next.tokens ?? [],
        statLibrary: next.statLibrary ?? [],
        statFolders: next.statFolders ?? [],
        sheetLibrary: next.sheetLibrary ?? [],
        sheetFolders: next.sheetFolders ?? [],
        ui: {
          ...state.ui,
          sceneSelection: repairSceneSelection(
            state.ui.sceneSelection,
            next.library,
            next.folders,
            next.scene.id,
          ),
        },
      };
    }
    case "rejected":
      return { ...state, busy: false, error: action.reason, session: null };
    case "closed":
      return { ...state, busy: false, session: null };
    case "error":
      return { ...state, error: action.message };
    case "presence":
      return { ...state, players: action.players };
    case "scene":
      return {
        ...state,
        scene: action.scene,
        library: action.library,
        folders: action.folders,
        ui: {
          ...state.ui,
          sceneSelection: repairSceneSelection(
            state.ui.sceneSelection,
            action.library,
            action.folders,
            action.scene.id,
          ),
        },
      };
    case "tokens":
      return {
        ...state,
        tokenLibrary: action.tokenLibrary,
        tokenFolders: action.tokenFolders,
        tokens: action.tokens,
        ui: {
          ...state.ui,
          selectedPlacedId: action.tokens.some((token) => token.id === state.ui.selectedPlacedId)
            ? state.ui.selectedPlacedId
            : null,
        },
      };
    case "stats":
      return { ...state, statLibrary: action.statLibrary, statFolders: action.statFolders };
    case "sheets":
      return { ...state, sheetLibrary: action.sheetLibrary, sheetFolders: action.sheetFolders };
    case "roll/result":
      return {
        ...state,
        rollLog: [...state.rollLog, action.roll].slice(-80),
        rollQueue: [...state.rollQueue, action.roll],
      };
    case "roll/done":
      return { ...state, rollQueue: state.rollQueue.filter((roll) => roll.id !== action.id) };
    case "ui/toggleDock": {
      const current = state.ui.docks[action.dock];
      const tab = current === action.tab ? null : action.tab;
      return { ...state, ui: { ...state.ui, docks: { ...state.ui.docks, [action.dock]: tab } } };
    }
    case "ui/openDock":
      return {
        ...state,
        ui: { ...state.ui, docks: { ...state.ui.docks, [action.dock]: action.tab } },
      };
    case "ui/inspectToken":
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedPlacedId: action.id,
          docks: { ...state.ui.docks, gm: "inspect" },
        },
      };
    case "ui/sceneSelection":
      return { ...state, ui: { ...state.ui, sceneSelection: action.selection } };
    case "ui/tokenSelection":
      return { ...state, ui: { ...state.ui, tokenSelection: action.selection } };
    case "ui/statSelection":
      return { ...state, ui: { ...state.ui, statSelection: action.selection } };
    case "ui/sheetSelection":
      return { ...state, ui: { ...state.ui, sheetSelection: action.selection } };
    case "ui/placeKind":
      return {
        ...state,
        ui: {
          ...state.ui,
          placeKind: action.kind,
          fogDraw: action.kind === "off" ? state.ui.fogDraw : false,
        },
      };
    case "ui/fogDraw":
      return {
        ...state,
        ui: {
          ...state.ui,
          fogDraw: action.on,
          placeKind: action.on ? "off" : state.ui.placeKind,
        },
      };
    case "ui/selectedPlaced":
      return { ...state, ui: { ...state.ui, selectedPlacedId: action.id } };
    default: {
      const unexpected: never = action;
      throw new Error(`Unknown action: ${JSON.stringify(unexpected)}`);
    }
  }
}
