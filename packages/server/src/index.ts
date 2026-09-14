import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import middie from "@fastify/middie";
import multipart from "@fastify/multipart";
import { createServer as createViteServer } from "vite";
import { APP_NAME, APP_VERSION, DEFAULT_PORT } from "@p2evtt/shared";
import { errorMessage, requireGm } from "./http";
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
    dataDir: path.resolve(__dirname, "../../../data"),
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
    args.dataDir,
    path.resolve(__dirname, "../fixtures/maps/test-dungeon.jpg"),
  );
  await scene.load();

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

  app.get("/media/scenes/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    return scene.sendFile(id, reply);
  });

  app.post("/api/scenes", async (req, reply) => {
    if (!requireGm(req, reply, table)) return;
    const body = (req.body as { name?: unknown; folderId?: unknown } | null) ?? {};
    const name = String(body.name ?? "New scene");
    const folderId = body.folderId === null || body.folderId === undefined ? null : String(body.folderId);
    try {
      const snap = await scene.createScene(name, folderId);
      table.broadcast({ type: "scene.updated", ...snap });
      return snap;
    } catch (err) {
      return reply.code(400).send({ error: errorMessage(err, "Could not create scene") });
    }
  });

  app.patch("/api/scenes/:id", async (req, reply) => {
    if (!requireGm(req, reply, table)) return;
    const { id } = req.params as { id: string };
    const body = (req.body as { name?: unknown; folderId?: unknown } | null) ?? {};
    try {
      let snap = scene.snapshot();
      if (typeof body.folderId !== "undefined") {
        const folderId = body.folderId === null ? null : String(body.folderId);
        snap = await scene.moveScene(id, folderId);
      }
      if (typeof body.name === "string") {
        snap = await scene.renameScene(id, body.name);
      }
      table.broadcast({ type: "scene.updated", ...snap });
      return snap;
    } catch (err) {
      return reply.code(400).send({ error: errorMessage(err, "Could not update scene") });
    }
  });

  app.post("/api/folders", async (req, reply) => {
    if (!requireGm(req, reply, table)) return;
    const body = (req.body as { name?: unknown; parentId?: unknown } | null) ?? {};
    const name = String(body.name ?? "New folder");
    const parentId = body.parentId === null || body.parentId === undefined ? null : String(body.parentId);
    try {
      const snap = await scene.createFolder(name, parentId);
      table.broadcast({ type: "scene.updated", ...snap });
      return snap;
    } catch (err) {
      return reply.code(400).send({ error: errorMessage(err, "Could not create folder") });
    }
  });

  app.patch("/api/folders/:id", async (req, reply) => {
    if (!requireGm(req, reply, table)) return;
    const { id } = req.params as { id: string };
    const name = String((req.body as { name?: unknown } | null)?.name ?? "");
    try {
      const snap = await scene.renameFolder(id, name);
      table.broadcast({ type: "scene.updated", ...snap });
      return snap;
    } catch (err) {
      return reply.code(400).send({ error: errorMessage(err, "Could not rename folder") });
    }
  });

  app.delete("/api/folders/:id", async (req, reply) => {
    if (!requireGm(req, reply, table)) return;
    const { id } = req.params as { id: string };
    try {
      const snap = await scene.removeFolder(id);
      table.broadcast({ type: "scene.updated", ...snap });
      return snap;
    } catch (err) {
      return reply.code(400).send({ error: errorMessage(err, "Could not delete folder") });
    }
  });

  app.delete("/api/scenes/:id", async (req, reply) => {
    if (!requireGm(req, reply, table)) return;
    const { id } = req.params as { id: string };
    try {
      const snap = await scene.removeScene(id);
      table.broadcast({ type: "scene.updated", ...snap });
      return snap;
    } catch (err) {
      return reply.code(400).send({ error: errorMessage(err, "Could not delete scene") });
    }
  });

  app.post("/api/scenes/:id/activate", async (req, reply) => {
    if (!requireGm(req, reply, table)) return;
    const { id } = req.params as { id: string };
    try {
      const snap = await scene.activate(id);
      table.broadcast({ type: "scene.updated", ...snap });
      return snap;
    } catch (err) {
      return reply.code(400).send({ error: errorMessage(err, "Could not switch scene") });
    }
  });

  app.post("/api/scenes/:id/background", async (req, reply) => {
    if (!requireGm(req, reply, table)) return;
    const { id } = req.params as { id: string };
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "Choose an image file." });
    const bytes = await file.toBuffer();
    try {
      const snap = await scene.saveUpload(id, bytes, file.mimetype);
      table.broadcast({ type: "scene.updated", ...snap });
      return snap;
    } catch (err) {
      return reply.code(400).send({ error: errorMessage(err, "Upload failed") });
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
