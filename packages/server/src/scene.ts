import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { FastifyReply } from "fastify";
import type { ScenePublic, SceneSummary } from "@p2evtt/shared";

const ALLOWED = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

type SceneRecord = {
  id: string;
  name: string;
  ext: string | null;
  version: number;
  usesFixture: boolean;
};

type DiskState = {
  activeId: string;
  scenes: SceneRecord[];
};

export class SceneStore {
  private scenes: SceneRecord[] = [];
  private activeId = "";
  private readonly statePath: string;
  private readonly mediaDir: string;

  constructor(
    dataDir: string,
    private fixturePath: string,
  ) {
    this.statePath = path.join(dataDir, "scenes.json");
    this.mediaDir = path.join(dataDir, "media");
  }

  async load(): Promise<void> {
    await mkdir(this.mediaDir, { recursive: true });
    if (existsSync(this.statePath)) {
      const raw = JSON.parse(await readFile(this.statePath, "utf8")) as DiskState;
      this.scenes = raw.scenes ?? [];
      this.activeId = raw.activeId ?? this.scenes[0]?.id ?? "";
    }
    if (this.scenes.length < 1) {
      const first: SceneRecord = {
        id: randomUUID(),
        name: "Dungeon",
        ext: null,
        version: 1,
        usesFixture: true,
      };
      this.scenes = [first];
      this.activeId = first.id;
      await this.persist();
    }
  }

  library(): SceneSummary[] {
    return this.scenes.map((s) => ({ id: s.id, name: s.name }));
  }

  activePublic(): ScenePublic {
    return this.toPublic(this.require(this.activeId));
  }

  snapshot(): { scene: ScenePublic; library: SceneSummary[] } {
    return { scene: this.activePublic(), library: this.library() };
  }

  async create(wantedName: string): Promise<{ scene: ScenePublic; library: SceneSummary[] }> {
    const name = uniqueName(wantedName, this.scenes);
    const record: SceneRecord = {
      id: randomUUID(),
      name,
      ext: null,
      version: 1,
      usesFixture: false,
    };
    this.scenes.push(record);
    this.activeId = record.id;
    await this.persist();
    return this.snapshot();
  }

  async rename(id: string, wantedName: string): Promise<{ scene: ScenePublic; library: SceneSummary[] }> {
    const record = this.require(id);
    record.name = uniqueName(wantedName, this.scenes, id);
    await this.persist();
    return this.snapshot();
  }

  async remove(id: string): Promise<{ scene: ScenePublic; library: SceneSummary[] }> {
    if (this.scenes.length < 2) throw new Error("Keep at least one scene.");
    const record = this.require(id);
    this.scenes = this.scenes.filter((s) => s.id !== id);
    if (this.activeId === id) this.activeId = this.scenes[0].id;
    if (record.ext) {
      const file = this.mediaPath(record);
      if (existsSync(file)) await unlink(file).catch(() => undefined);
    }
    await this.persist();
    return this.snapshot();
  }

  async activate(id: string): Promise<{ scene: ScenePublic; library: SceneSummary[] }> {
    this.require(id);
    this.activeId = id;
    await this.persist();
    return this.snapshot();
  }

  async saveUpload(
    id: string,
    bytes: Buffer,
    mime: string,
  ): Promise<{ scene: ScenePublic; library: SceneSummary[] }> {
    const ext = ALLOWED.get(mime);
    if (!ext) throw new Error("Use a JPEG, PNG, or WebP image.");
    if (bytes.length > 12 * 1024 * 1024) throw new Error("Image is too large (12 MB max).");
    const record = this.require(id);
    await mkdir(this.mediaDir, { recursive: true });
    if (record.ext) {
      const prev = this.mediaPath(record);
      if (existsSync(prev)) await unlink(prev).catch(() => undefined);
    }
    record.ext = ext;
    record.usesFixture = false;
    record.version += 1;
    await writeFile(this.mediaPath(record), bytes);
    await this.persist();
    return this.snapshot();
  }

  async sendFile(id: string, reply: FastifyReply) {
    const record = this.scenes.find((s) => s.id === id);
    if (!record) return reply.code(404).send({ error: "Unknown scene" });
    let file: string | null = null;
    if (record.ext) file = this.mediaPath(record);
    else if (record.usesFixture) file = this.fixturePath;
    if (!file || !existsSync(file)) {
      return reply.code(404).send({ error: "No map image" });
    }
    const ext = path.extname(file).toLowerCase();
    const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    const bytes = await readFile(file);
    return reply.header("Content-Type", type).header("Cache-Control", "no-cache").send(bytes);
  }

  private toPublic(record: SceneRecord): ScenePublic {
    const hasImage = Boolean(record.ext) || record.usesFixture;
    return {
      id: record.id,
      name: record.name,
      backgroundUrl: hasImage ? `/media/scenes/${record.id}?v=${record.version}` : null,
      version: record.version,
    };
  }

  private require(id: string): SceneRecord {
    const record = this.scenes.find((s) => s.id === id);
    if (!record) throw new Error("Unknown scene.");
    return record;
  }

  private mediaPath(record: SceneRecord): string {
    return path.join(this.mediaDir, `${record.id}${record.ext ?? ""}`);
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    const state: DiskState = { activeId: this.activeId, scenes: this.scenes };
    await writeFile(this.statePath, JSON.stringify(state, null, 2), "utf8");
  }
}

function uniqueName(wanted: string, scenes: SceneRecord[], exceptId?: string): string {
  const name = wanted.trim();
  if (name.length < 1) throw new Error("Enter a scene name.");
  if (name.length > 48) throw new Error("Name is too long (48 characters max).");
  const taken = new Set(
    scenes.filter((s) => s.id !== exceptId).map((s) => s.name.toLowerCase()),
  );
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; n < 100; n++) {
    const candidate = `${name} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${name} (${randomUUID().slice(0, 4)})`;
}
