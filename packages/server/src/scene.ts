import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createReadStream, existsSync } from "node:fs";
import type { FastifyReply } from "fastify";
import type { ScenePublic } from "@p2evtt/shared";

const ALLOWED = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export class SceneStore {
  version = 1;
  private uploadedPath: string | null = null;

  constructor(
    private dataDir: string,
    private fixturePath: string,
  ) {}

  toPublic(): ScenePublic {
    return {
      backgroundUrl: `/media/scene-bg?v=${this.version}`,
      version: this.version,
    };
  }

  filePath(): string {
    return this.uploadedPath ?? this.fixturePath;
  }

  async saveUpload(bytes: Buffer, mime: string): Promise<ScenePublic> {
    const ext = ALLOWED.get(mime);
    if (!ext) throw new Error("Use a JPEG, PNG, or WebP image.");
    if (bytes.length > 12 * 1024 * 1024) throw new Error("Image is too large (12 MB max).");
    await mkdir(this.dataDir, { recursive: true });
    const dest = path.join(this.dataDir, `scene-bg${ext}`);
    await writeFile(dest, bytes);
    this.uploadedPath = dest;
    this.version += 1;
    return this.toPublic();
  }

  sendFile(reply: FastifyReply) {
    const file = this.filePath();
    if (!existsSync(file)) {
      return reply.code(404).send({ error: "No map image" });
    }
    const ext = path.extname(file).toLowerCase();
    const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    reply.header("Content-Type", type);
    reply.header("Cache-Control", "no-cache");
    return reply.send(createReadStream(file));
  }
}
