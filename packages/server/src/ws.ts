import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import {
  degreeOfSuccess,
  parseClientMsg,
  parseFormula,
  PROTOCOL_VERSION,
  rollFormula,
  type ServerMsg,
} from "@p2evtt/shared";
import type { SceneStore } from "./scene";
import { Table } from "./table";
import type { SheetStore } from "./sheets";
import type { StatStore } from "./stats";
import type { TokenStore } from "./tokens";

function send(socket: WebSocket, msg: ServerMsg): void {
  socket.send(JSON.stringify(msg));
}

export async function registerWs(
  app: FastifyInstance,
  table: Table,
  scene: SceneStore,
  tokens: TokenStore,
  stats: StatStore,
  sheets: SheetStore,
): Promise<void> {
  await app.register(websocket);

  app.get("/ws", { websocket: true }, (socket) => {
    socket.on("message", (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(raw));
      } catch {
        send(socket, { type: "error", message: "Invalid JSON" });
        return;
      }
      const msg = parseClientMsg(parsed);
      if (!msg) {
        send(socket, { type: "error", message: "Unknown message" });
        return;
      }
      if (msg.type === "hb.ping") {
        send(socket, { type: "hb.pong" });
        return;
      }
      if (msg.type === "roll") {
        const seat = table.seatFor(socket);
        if (!seat) {
          send(socket, { type: "error", message: "Sit at the table first." });
          return;
        }
        const terms = parseFormula(msg.formula);
        if (!terms) {
          send(socket, { type: "error", message: "Could not read that dice formula." });
          return;
        }
        const dc = msg.dc;
        if (dc !== null && (!Number.isInteger(dc) || dc < -999 || dc > 999)) {
          send(socket, { type: "error", message: "DC must be a whole number." });
          return;
        }
        const math = rollFormula(terms);
        table.broadcast({
          type: "roll.result",
          roll: {
            id: randomUUID(),
            roller: seat.displayName,
            formula: msg.formula.trim(),
            ...math,
            dc,
            degree: dc === null ? null : degreeOfSuccess(math.total, dc, math.dice),
          },
        });
        return;
      }
      if (msg.type === "hello") {
        if (msg.protocolVersion !== PROTOCOL_VERSION) {
          send(socket, {
            type: "hello.rejected",
            reason: `Protocol mismatch (server ${PROTOCOL_VERSION})`,
          });
          socket.close();
          return;
        }
        const result = table.sit({
          displayName: msg.displayName,
          wantGm: msg.wantGm,
          sessionToken: msg.sessionToken,
          socket,
        });
        if ("reject" in result) {
          send(socket, { type: "hello.rejected", reason: result.reject });
          return;
        }
        const players = table.list();
        const snap = scene.snapshot();
        const tokenSnap = tokens.snapshot();
        const statSnap = stats.snapshot();
        const sheetSnap = sheets.snapshot();
        send(socket, {
          type: "hello.ok",
          sessionToken: result.seat.sessionToken,
          you: {
            id: result.seat.id,
            displayName: result.seat.displayName,
            role: result.seat.role,
          },
          players,
          scene: snap.scene,
          library: snap.library,
          folders: snap.folders,
          ...tokenSnap,
          ...statSnap,
          ...sheetSnap,
        });
        table.broadcast({ type: "presence", players }, socket);
      }
    });

    socket.on("close", () => {
      if (table.leave(socket)) {
        table.broadcast({ type: "presence", players: table.list() });
      }
    });
  });
}
