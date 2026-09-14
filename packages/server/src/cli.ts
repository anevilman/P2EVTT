import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_PORT } from "@p2evtt/shared";

const here = path.dirname(fileURLToPath(import.meta.url));

export type CliArgs = {
  lan: boolean;
  port: number;
  dataDir: string;
};

export function repoRoot(): string {
  return path.resolve(here, "../../..");
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    lan: false,
    port: DEFAULT_PORT,
    dataDir: path.resolve(repoRoot(), "data"),
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
