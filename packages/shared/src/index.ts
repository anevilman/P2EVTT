export const APP_NAME = "P2EVTT";
export const APP_VERSION = "0.7.0";
export const DEFAULT_PORT = 7788;

export {
  PROTOCOL_VERSION,
  parseClientMsg,
  parseServerMsg,
  type Role,
  type Presence,
  type ScenePublic,
  type SceneSummary,
  type SceneGrid,
  type LibraryFolder,
  type TokenSize,
  type TokenPrototype,
  type PlacedToken,
  type TokenSnapshot,
  type ClientMsg,
  type ServerMsg,
  TOKEN_SIZES,
} from "./protocol";

export {
  DEFAULT_GRID,
  cellSize,
  occupiedSquares,
  parseGrid,
  snapCenter,
  tokenSpan,
} from "./grid";
