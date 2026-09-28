import type {
  CharacterSheetEntry,
  LibraryFolder,
  PlacedToken,
  Presence,
  RollResult,
  ScenePublic,
  SceneSummary,
  StatBlockEntry,
  TokenPrototype,
} from "@p2evtt/shared";
import type { TableSession } from "../net/socket";
import type { Selection } from "../ui/library/LibraryTree";
import type { PlaceKind } from "../ui/TokenLibrary";

export type DockId = "gm" | "player";

export type UiState = {
  docks: Record<DockId, string | null>;
  sceneSelection: Selection;
  tokenSelection: Selection;
  statSelection: Selection;
  sheetSelection: Selection;
  placeKind: PlaceKind;
  fogDraw: boolean;
  selectedPlacedId: string | null;
};

export type TableState = {
  busy: boolean;
  error: string | null;
  session: TableSession | null;
  players: Presence[];
  scene: ScenePublic | null;
  library: SceneSummary[];
  folders: LibraryFolder[];
  tokenLibrary: TokenPrototype[];
  tokenFolders: LibraryFolder[];
  tokens: PlacedToken[];
  statLibrary: StatBlockEntry[];
  statFolders: LibraryFolder[];
  sheetLibrary: CharacterSheetEntry[];
  sheetFolders: LibraryFolder[];
  rollLog: RollResult[];
  rollQueue: RollResult[];
  ui: UiState;
};

export type Action =
  | { type: "join/start" }
  | { type: "hello"; session: TableSession }
  | { type: "rejected"; reason: string }
  | { type: "closed" }
  | { type: "error"; message: string }
  | { type: "presence"; players: Presence[] }
  | { type: "scene"; scene: ScenePublic; library: SceneSummary[]; folders: LibraryFolder[] }
  | {
      type: "tokens";
      tokenLibrary: TokenPrototype[];
      tokenFolders: LibraryFolder[];
      tokens: PlacedToken[];
    }
  | { type: "stats"; statLibrary: StatBlockEntry[]; statFolders: LibraryFolder[] }
  | { type: "sheets"; sheetLibrary: CharacterSheetEntry[]; sheetFolders: LibraryFolder[] }
  | { type: "roll/result"; roll: RollResult }
  | { type: "roll/done"; id: string }
  | { type: "ui/toggleDock"; dock: DockId; tab: string }
  | { type: "ui/openDock"; dock: DockId; tab: string }
  | { type: "ui/inspectToken"; id: string }
  | { type: "ui/sceneSelection"; selection: Selection }
  | { type: "ui/tokenSelection"; selection: Selection }
  | { type: "ui/statSelection"; selection: Selection }
  | { type: "ui/sheetSelection"; selection: Selection }
  | { type: "ui/placeKind"; kind: PlaceKind }
  | { type: "ui/fogDraw"; on: boolean }
  | { type: "ui/selectedPlaced"; id: string | null };
