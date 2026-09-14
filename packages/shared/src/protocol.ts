import { parseGrid, type SceneGrid } from "./grid";

export type { SceneGrid } from "./grid";

export const PROTOCOL_VERSION = 1;

export type Role = "gm" | "player";

export type Presence = {
  id: string;
  displayName: string;
  role: Role;
};

export type LibraryFolder = {
  id: string;
  name: string;
  parentId: string | null;
};

export type ScenePublic = {
  id: string;
  name: string;
  backgroundUrl: string | null;
  version: number;
  grid: SceneGrid;
};

export type SceneSummary = ScenePublic & {
  folderId: string | null;
};

export const TOKEN_SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"] as const;
export type TokenSize = (typeof TOKEN_SIZES)[number];

export type TokenPrototype = {
  id: string;
  name: string;
  folderId: string | null;
  imageUrl: string | null;
  size: TokenSize;
  version: number;
  controlledBy: string | null;
};

export type PlacedToken = {
  id: string;
  prototypeId: string;
  sceneId: string;
  x: number;
  y: number;
  size: TokenSize;
  controlledBy: string | null;
};

export type TokenSnapshot = {
  tokenLibrary: TokenPrototype[];
  tokenFolders: LibraryFolder[];
  tokens: PlacedToken[];
};

export type ClientMsg =
  | {
      type: "hello";
      protocolVersion: number;
      displayName: string;
      wantGm: boolean;
      sessionToken?: string;
    }
  | { type: "hb.ping" };

export type ServerMsg =
  | {
      type: "hello.ok";
      sessionToken: string;
      you: Presence;
      players: Presence[];
      scene: ScenePublic;
      library: SceneSummary[];
      folders: LibraryFolder[];
      tokenLibrary: TokenPrototype[];
      tokenFolders: LibraryFolder[];
      tokens: PlacedToken[];
    }
  | { type: "hello.rejected"; reason: string }
  | { type: "presence"; players: Presence[] }
  | {
      type: "scene.updated";
      scene: ScenePublic;
      library: SceneSummary[];
      folders: LibraryFolder[];
    }
  | {
      type: "tokens.updated";
      tokenLibrary: TokenPrototype[];
      tokenFolders: LibraryFolder[];
      tokens: PlacedToken[];
    }
  | { type: "hb.pong" }
  | { type: "error"; message: string };

export function parseClientMsg(raw: unknown): ClientMsg | null {
  if (!raw || typeof raw !== "object") return null;
  const msg = raw as { type?: unknown };
  if (msg.type === "hb.ping") return { type: "hb.ping" };
  if (msg.type === "hello") {
    const m = raw as {
      protocolVersion?: unknown;
      displayName?: unknown;
      wantGm?: unknown;
      sessionToken?: unknown;
    };
    if (typeof m.protocolVersion !== "number" || typeof m.displayName !== "string") return null;
    if (m.wantGm !== undefined && typeof m.wantGm !== "boolean") return null;
    if (m.sessionToken !== undefined && typeof m.sessionToken !== "string") return null;
    return {
      type: "hello",
      protocolVersion: m.protocolVersion,
      displayName: m.displayName,
      wantGm: m.wantGm === true,
      sessionToken: m.sessionToken,
    };
  }
  return null;
}

export function parseServerMsg(raw: unknown): ServerMsg | null {
  if (!raw || typeof raw !== "object") return null;
  const msg = raw as { type?: unknown };
  if (msg.type === "hb.pong") return { type: "hb.pong" };
  if (msg.type === "error") {
    const message = (raw as { message?: unknown }).message;
    if (typeof message !== "string") return null;
    return { type: "error", message };
  }
  if (msg.type === "hello.rejected") {
    const reason = (raw as { reason?: unknown }).reason;
    if (typeof reason !== "string") return null;
    return { type: "hello.rejected", reason };
  }
  if (msg.type === "hello.ok") {
    const m = raw as {
      sessionToken?: unknown;
      you?: unknown;
      players?: unknown;
      scene?: unknown;
      library?: unknown;
      folders?: unknown;
      tokenLibrary?: unknown;
      tokenFolders?: unknown;
      tokens?: unknown;
    };
    if (typeof m.sessionToken !== "string") return null;
    const you = parsePresence(m.you);
    const players = parsePresenceList(m.players);
    const scene = parseScene(m.scene);
    const library = parseLibrary(m.library);
    const folders = parseFolders(m.folders);
    const tokens = parseTokenSnapshot(m);
    if (!you || !players || !scene || !library || !folders || !tokens) return null;
    return {
      type: "hello.ok",
      sessionToken: m.sessionToken,
      you,
      players,
      scene,
      library,
      folders,
      ...tokens,
    };
  }
  if (msg.type === "presence") {
    const players = parsePresenceList((raw as { players?: unknown }).players);
    if (!players) return null;
    return { type: "presence", players };
  }
  if (msg.type === "scene.updated") {
    const m = raw as { scene?: unknown; library?: unknown; folders?: unknown };
    const scene = parseScene(m.scene);
    const library = parseLibrary(m.library);
    const folders = parseFolders(m.folders);
    if (!scene || !library || !folders) return null;
    return { type: "scene.updated", scene, library, folders };
  }
  if (msg.type === "tokens.updated") {
    const tokens = parseTokenSnapshot(raw);
    if (!tokens) return null;
    return { type: "tokens.updated", ...tokens };
  }
  return null;
}

function parsePresence(raw: unknown): Presence | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as { id?: unknown; displayName?: unknown; role?: unknown };
  if (typeof p.id !== "string" || typeof p.displayName !== "string") return null;
  if (p.role !== "gm" && p.role !== "player") return null;
  return { id: p.id, displayName: p.displayName, role: p.role };
}

function parseArray<T>(raw: unknown, parseItem: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(raw)) return null;
  const out: T[] = [];
  for (const item of raw) {
    const parsed = parseItem(item);
    if (!parsed) return null;
    out.push(parsed);
  }
  return out;
}

function parsePresenceList(raw: unknown): Presence[] | null {
  return parseArray(raw, parsePresence);
}

function parseScene(raw: unknown): ScenePublic | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as {
    id?: unknown;
    name?: unknown;
    backgroundUrl?: unknown;
    version?: unknown;
  };
  if (typeof s.id !== "string" || typeof s.name !== "string" || typeof s.version !== "number") {
    return null;
  }
  if (s.backgroundUrl !== null && typeof s.backgroundUrl !== "string") return null;
  return {
    id: s.id,
    name: s.name,
    backgroundUrl: s.backgroundUrl,
    version: s.version,
    grid: parseGrid((raw as { grid?: unknown }).grid),
  };
}

function parseLibrary(raw: unknown): SceneSummary[] | null {
  return parseArray(raw, (item) => {
    const s = parseScene(item);
    if (!s) return null;
    const folderId = (item as { folderId?: unknown }).folderId;
    if (folderId !== null && typeof folderId !== "string") return null;
    return { ...s, folderId };
  });
}

function parseFolders(raw: unknown): LibraryFolder[] | null {
  return parseArray(raw, (item) => {
    if (!item || typeof item !== "object") return null;
    const f = item as { id?: unknown; name?: unknown; parentId?: unknown };
    if (typeof f.id !== "string" || typeof f.name !== "string") return null;
    if (f.parentId !== null && typeof f.parentId !== "string") return null;
    return { id: f.id, name: f.name, parentId: f.parentId };
  });
}

function parseTokenSize(raw: unknown): TokenSize | null {
  if (typeof raw !== "string") return null;
  return (TOKEN_SIZES as readonly string[]).includes(raw) ? (raw as TokenSize) : null;
}

function parseTokenPrototype(raw: unknown): TokenPrototype | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as {
    id?: unknown;
    name?: unknown;
    folderId?: unknown;
    imageUrl?: unknown;
    size?: unknown;
    version?: unknown;
    controlledBy?: unknown;
  };
  const size = parseTokenSize(t.size);
  if (typeof t.id !== "string" || typeof t.name !== "string" || typeof t.version !== "number" || !size) {
    return null;
  }
  if (t.folderId !== null && typeof t.folderId !== "string") return null;
  if (t.imageUrl !== null && typeof t.imageUrl !== "string") return null;
  if (t.controlledBy !== null && t.controlledBy !== undefined && typeof t.controlledBy !== "string") {
    return null;
  }
  return {
    id: t.id,
    name: t.name,
    folderId: t.folderId,
    imageUrl: t.imageUrl,
    size,
    version: t.version,
    controlledBy: typeof t.controlledBy === "string" && t.controlledBy.trim() ? t.controlledBy.trim() : null,
  };
}

function parsePlacedToken(raw: unknown): PlacedToken | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as {
    id?: unknown;
    prototypeId?: unknown;
    sceneId?: unknown;
    x?: unknown;
    y?: unknown;
    size?: unknown;
    controlledBy?: unknown;
    controllerId?: unknown;
  };
  const size = parseTokenSize(t.size);
  if (
    typeof t.id !== "string" ||
    typeof t.prototypeId !== "string" ||
    typeof t.sceneId !== "string" ||
    typeof t.x !== "number" ||
    typeof t.y !== "number" ||
    !size
  ) {
    return null;
  }
  const name =
    typeof t.controlledBy === "string"
      ? t.controlledBy
      : typeof t.controllerId === "string" && !looksLikeId(t.controllerId)
        ? t.controllerId
        : null;
  return {
    id: t.id,
    prototypeId: t.prototypeId,
    sceneId: t.sceneId,
    x: t.x,
    y: t.y,
    size,
    controlledBy: name && name.length > 0 ? name : null,
  };
}

function looksLikeId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function parseTokenSnapshot(raw: unknown): TokenSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as { tokenLibrary?: unknown; tokenFolders?: unknown; tokens?: unknown };
  const tokenLibrary = parseArray(t.tokenLibrary, parseTokenPrototype);
  const tokenFolders = parseFolders(t.tokenFolders);
  const tokens = parseArray(t.tokens, parsePlacedToken);
  if (!tokenLibrary || !tokenFolders || !tokens) return null;
  return { tokenLibrary, tokenFolders, tokens };
}
