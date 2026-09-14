import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import middie from "@fastify/middie";
import multipart from "@fastify/multipart";
import { createServer as createViteServer } from "vite";
import { APP_NAME, APP_VERSION, DEFAULT_PORT } from "@p2evtt/shared";
import { SceneStore } from "./scene";
import { Table } from "./table";
import { registerWs } from "./ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type CliArgs = {
  lan: boolean;
  port: number;
  dataDir: string;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    lan: false,
    port: DEFAULT_PORT,
    dataDir: path.resolve(process.cwd(), "data"),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--lan") args.lan = true;
    else if (a === "--port") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`Invalid --port: ${argv[i]}`);
      }
      args.port = n;
    } else if (a === "--data-dir") {
      const dir = argv[++i];
      if (!dir) throw new Error("--data-dir requires a path");
      args.dataDir = path.resolve(dir);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const host = args.lan ? "0.0.0.0" : "127.0.0.1";

  const app = Fastify({ logger: true });

  const table = new Table();
  const scene = new SceneStore(
    path.join(args.dataDir, "media"),
    path.resolve(__dirname, "../fixtures/maps/test-dungeon.jpg"),
  );

  await app.register(multipart, { limits: { fileSize: 12 * 1024 * 1024 } });

  app.get("/api/health", async () => ({
    ok: true,
    name: APP_NAME,
    version: APP_VERSION,
  }));

  app.get("/api/table", async () => ({
    hasGm: table.hasGm(),
    gmName: table.gmName(),
    seated: table.list().length,
  }));

  app.get("/media/scene-bg", async (_req, reply) => scene.sendFile(reply));

  app.post("/api/scene/background", async (req, reply) => {
    const token = String(req.headers["x-session-token"] ?? "");
    const seat = table.getByToken(token);
    if (!seat || seat.role !== "gm") {
      return reply.code(403).send({ error: "Only the GM can change the map." });
    }
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "Choose an image file." });
    const bytes = await file.toBuffer();
    try {
      const next = await scene.saveUpload(bytes, file.mimetype);
      table.broadcast({ type: "scene.updated", scene: next });
      return next;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      return reply.code(400).send({ error: message });
    }
  });

  await registerWs(app, table, scene);

  await app.register(middie);

  const clientRoot = path.resolve(__dirname, "../../client");
  const vite = await createViteServer({
    root: clientRoot,
    configFile: path.join(clientRoot, "vite.config.ts"),
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use((req, res, next) => {
    const url = req.url ?? "";
    if (url.startsWith("/api") || url.startsWith("/ws") || url.startsWith("/media")) {
      next();
      return;
    }
    vite.middlewares(req, res, next);
  });

  await app.listen({ host, port: args.port });
  const displayHost = args.lan ? "0.0.0.0" : "127.0.0.1";
  app.log.info(`${APP_NAME} ${APP_VERSION}  http://${displayHost}:${args.port}`);
  if (args.lan) {
    app.log.info("LAN mode: share this machine's LAN address with players.");
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
