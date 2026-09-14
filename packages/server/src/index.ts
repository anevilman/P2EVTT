import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import middie from "@fastify/middie";
import { createServer as createViteServer } from "vite";
import { APP_NAME, APP_VERSION, DEFAULT_PORT } from "@p2evtt/shared";
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

  await registerWs(app, table);

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
    if (url.startsWith("/api") || url.startsWith("/ws")) {
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
