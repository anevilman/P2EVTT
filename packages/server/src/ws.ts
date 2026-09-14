import type { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import { parseClientMsg, PROTOCOL_VERSION, type ServerMsg } from "@p2evtt/shared";
import type { SceneStore } from "./scene";
import { Table } from "./table";
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
