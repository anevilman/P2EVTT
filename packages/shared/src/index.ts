export const APP_NAME = "P2EVTT";
export const APP_VERSION = "0.12.0";
export const DEFAULT_PORT = 7788;

export {
  PROTOCOL_VERSION,
  parseClientMsg,
  parseServerMsg,
  type Role,
  type Presence,
  type ScenePublic,
  type SceneSummary,
  type FogRect,
  parseFogList,
  type SceneGrid,
  type LibraryFolder,
  type TokenSize,
  type TokenPrototype,
  type PlacedToken,
  type TokenSnapshot,
  type StatSnapshot,
  type SheetSnapshot,
  type ClientMsg,
  type ServerMsg,
  TOKEN_SIZES,
} from "./protocol";

export {
  emptyStatBlock,
  cloneStatBlock,
  parseStatBlockData,
  parseStatBlockEntry,
  type StatBlockData,
  type StatBlockEntry,
  type StrikeLine,
  type SkillLine,
} from "./statBlock";

export {
  emptyCharacterSheet,
  parseCharacterSheetData,
  parseCharacterSheetEntry,
  sheetOwnedBy,
  FEAT_CATEGORIES,
  ITEM_SLOTS,
  SPELL_TRADITIONS,
  type CharacterSheetData,
  type CharacterSheetEntry,
  type FeatCategory,
  type FeatLine,
  type InventoryItem,
  type ItemSlot,
  type PreparedSlot,
  type RepertoirePool,
  type SpellLine,
  type SpellTradition,
} from "./characterSheet";

export {
  parseFormula,
  rollFormula,
  degreeOfSuccess,
  parseRollResult,
  type Degree,
  type FormulaTerm,
  type DieFace,
  type RollMath,
  type RollResult,
} from "./dice";

export {
  DEFAULT_GRID,
  cellSize,
  occupiedSquares,
  parseGrid,
  snapCenter,
  tokenSpan,
} from "./grid";
