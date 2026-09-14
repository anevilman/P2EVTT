export const PROTOCOL_VERSION = 1;

export type Role = "gm" | "player";

export type Presence = {
  id: string;
  displayName: string;
  role: Role;
};

export type ClientMsg =
  | { type: "hello"; protocolVersion: number; displayName: string; sessionToken?: string }
  | { type: "hb.ping" };

export type ServerMsg =
  | { type: "hello.ok"; sessionToken: string; you: Presence; players: Presence[] }
  | { type: "hello.rejected"; reason: string }
  | { type: "presence"; players: Presence[] }
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
      sessionToken?: unknown;
    };
    if (typeof m.protocolVersion !== "number" || typeof m.displayName !== "string") return null;
    if (m.sessionToken !== undefined && typeof m.sessionToken !== "string") return null;
    return {
      type: "hello",
      protocolVersion: m.protocolVersion,
      displayName: m.displayName,
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
    const m = raw as { sessionToken?: unknown; you?: unknown; players?: unknown };
    if (typeof m.sessionToken !== "string") return null;
    const you = parsePresence(m.you);
    const players = parsePresenceList(m.players);
    if (!you || !players) return null;
    return { type: "hello.ok", sessionToken: m.sessionToken, you, players };
  }
  if (msg.type === "presence") {
    const players = parsePresenceList((raw as { players?: unknown }).players);
    if (!players) return null;
    return { type: "presence", players };
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

function parsePresenceList(raw: unknown): Presence[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Presence[] = [];
  for (const item of raw) {
    const p = parsePresence(item);
    if (!p) return null;
    out.push(p);
  }
  return out;
}
