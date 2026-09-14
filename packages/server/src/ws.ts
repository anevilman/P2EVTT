import type { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import { parseClientMsg, PROTOCOL_VERSION } from "@p2evtt/shared";
import type { SceneStore } from "./scene";
import { Table } from "./table";

export async function registerWs(
  app: FastifyInstance,
  table: Table,
  scene: SceneStore,
): Promise<void> {
  await app.register(websocket);

  app.get("/ws", { websocket: true }, (socket) => {
    socket.on("message", (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(raw));
      } catch {
        socket.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        return;
      }
      const msg = parseClientMsg(parsed);
      if (!msg) {
        socket.send(JSON.stringify({ type: "error", message: "Unknown message" }));
        return;
      }
      if (msg.type === "hb.ping") {
        socket.send(JSON.stringify({ type: "hb.pong" }));
        return;
      }
      if (msg.type === "hello") {
        if (msg.protocolVersion !== PROTOCOL_VERSION) {
          socket.send(
            JSON.stringify({
              type: "hello.rejected",
              reason: `Protocol mismatch (server ${PROTOCOL_VERSION})`,
            }),
          );
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
          socket.send(JSON.stringify({ type: "hello.rejected", reason: result.reject }));
          return;
        }
        const players = table.list();
        const snap = scene.snapshot();
        socket.send(
          JSON.stringify({
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
          }),
        );
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
