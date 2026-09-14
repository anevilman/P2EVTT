import path from "node:path";
import Fastify from "fastify";
import middie from "@fastify/middie";
import multipart from "@fastify/multipart";
import { createServer as createViteServer } from "vite";
import { APP_NAME, APP_VERSION } from "@p2evtt/shared";
import { parseArgs, repoRoot } from "./cli";
import { registerRoutes } from "./routes";
import { SceneStore } from "./scene";
import { Table } from "./table";
import { StatStore } from "./stats";
import { TokenStore } from "./tokens";
import { registerWs } from "./ws";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const host = args.lan ? "0.0.0.0" : "127.0.0.1";

  const app = Fastify({ logger: true });

  const table = new Table();
  const scene = new SceneStore(
    args.dataDir,
    path.join(repoRoot(), "packages/server/fixtures/maps/test-dungeon.jpg"),
  );
  await scene.load();
  const tokens = new TokenStore(
    args.dataDir,
    path.join(repoRoot(), "packages/server/fixtures/tokens/adventurer.jpg"),
  );
  await tokens.load();
  const stats = new StatStore(args.dataDir);
  await stats.load();

  await app.register(multipart, { limits: { fileSize: 12 * 1024 * 1024 } });
  await registerRoutes(app, table, scene, tokens, stats);
  await registerWs(app, table, scene, tokens, stats);
  await app.register(middie);

  const clientRoot = path.join(repoRoot(), "packages/client");
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
