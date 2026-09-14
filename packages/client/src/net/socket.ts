import {
  parseServerMsg,
  PROTOCOL_VERSION,
  type ClientMsg,
  type Presence,
  type ServerMsg,
} from "@p2evtt/shared";

export type TableSession = {
  you: Presence;
  players: Presence[];
  sessionToken: string;
};

type Handlers = {
  onHello: (session: TableSession) => void;
  onPresence: (players: Presence[]) => void;
  onRejected: (reason: string) => void;
  onError: (message: string) => void;
  onClosed: () => void;
};

export function connectTable(opts: {
  displayName: string;
  sessionToken?: string | null;
  handlers: Handlers;
}): { send: (msg: ClientMsg) => void; close: () => void } {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  let heartbeat: number | undefined;

  const send = (msg: ClientMsg) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };

  ws.addEventListener("open", () => {
    send({
      type: "hello",
      protocolVersion: PROTOCOL_VERSION,
      displayName: opts.displayName,
      sessionToken: opts.sessionToken ?? undefined,
    });
    heartbeat = window.setInterval(() => send({ type: "hb.ping" }), 15_000);
  });

  ws.addEventListener("message", (ev) => {
    let raw: unknown;
    try {
      raw = JSON.parse(String(ev.data));
    } catch {
      opts.handlers.onError("Bad message from server");
      return;
    }
    const msg: ServerMsg | null = parseServerMsg(raw);
    if (!msg) return;
    if (msg.type === "hello.ok") {
      opts.handlers.onHello({
        you: msg.you,
        players: msg.players,
        sessionToken: msg.sessionToken,
      });
    } else if (msg.type === "hello.rejected") {
      opts.handlers.onRejected(msg.reason);
    } else if (msg.type === "presence") {
      opts.handlers.onPresence(msg.players);
    } else if (msg.type === "error") {
      opts.handlers.onError(msg.message);
    }
  });

  ws.addEventListener("close", () => {
    if (heartbeat !== undefined) window.clearInterval(heartbeat);
    opts.handlers.onClosed();
  });

  ws.addEventListener("error", () => {
    opts.handlers.onError("WebSocket error");
  });

  return {
    send,
    close: () => {
      if (heartbeat !== undefined) window.clearInterval(heartbeat);
      ws.close();
    },
  };
}
