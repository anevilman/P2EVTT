import type { FastifyInstance, FastifyRequest } from "fastify";
import websocket from "@fastify/websocket";
import { parseClientMsg, PROTOCOL_VERSION } from "@p2evtt/shared";
import { Table } from "./table";

function isLoopback(req: FastifyRequest): boolean {
  const ips = [req.ip, req.socket.remoteAddress];
  return ips.some(
    (ip) => ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1",
  );
}

export async function registerWs(app: FastifyInstance, table: Table): Promise<void> {
  await app.register(websocket);

  app.get("/ws", { websocket: true }, (socket, req) => {
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
          sessionToken: msg.sessionToken,
          loopback: isLoopback(req),
          socket,
        });
        if ("reject" in result) {
          socket.send(JSON.stringify({ type: "hello.rejected", reason: result.reject }));
          return;
        }
        const players = table.list();
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
