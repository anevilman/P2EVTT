import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { FastifyReply } from "fastify";
import type { LibraryFolder, ScenePublic, SceneSummary } from "@p2evtt/shared";

const ALLOWED = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

type SceneRecord = {
  id: string;
  name: string;
  folderId: string | null;
  ext: string | null;
  version: number;
  usesFixture: boolean;
};

type FolderRecord = {
  id: string;
  name: string;
  parentId: string | null;
};

type DiskState = {
  activeId: string;
  scenes: SceneRecord[];
  folders: FolderRecord[];
};

export type SceneSnapshot = {
  scene: ScenePublic;
  library: SceneSummary[];
  folders: LibraryFolder[];
};

export class SceneStore {
  private scenes: SceneRecord[] = [];
  private folders: FolderRecord[] = [];
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
      this.scenes = (raw.scenes ?? []).map((s) => ({
        ...s,
        folderId: s.folderId ?? null,
      }));
      this.folders = raw.folders ?? [];
      this.activeId = raw.activeId ?? this.scenes[0]?.id ?? "";
    }
    if (this.scenes.length < 1) {
      const first: SceneRecord = {
        id: randomUUID(),
        name: "Dungeon",
        folderId: null,
        ext: null,
        version: 1,
        usesFixture: true,
      };
      this.scenes = [first];
      this.activeId = first.id;
      await this.persist();
    }
  }

  snapshot(): SceneSnapshot {
    return {
      scene: this.toPublic(this.requireScene(this.activeId)),
      library: this.scenes.map((s) => ({ ...this.toPublic(s), folderId: s.folderId })),
      folders: this.folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })),
    };
  }

  async createScene(wantedName: string, folderId: string | null): Promise<SceneSnapshot & { createdId: string }> {
    if (folderId) this.requireFolder(folderId);
    const name = uniqueAmong(
      wantedName,
      this.scenes.filter((s) => s.folderId === folderId).map((s) => s.name),
    );
    const record: SceneRecord = {
      id: randomUUID(),
      name,
      folderId,
      ext: null,
      version: 1,
      usesFixture: false,
    };
    this.scenes.push(record);
    await this.persist();
    return { ...this.snapshot(), createdId: record.id };
  }

  async renameScene(id: string, wantedName: string): Promise<SceneSnapshot> {
    const record = this.requireScene(id);
    record.name = uniqueAmong(
      wantedName,
      this.scenes.filter((s) => s.folderId === record.folderId && s.id !== id).map((s) => s.name),
    );
    await this.persist();
    return this.snapshot();
  }

  async moveScene(id: string, folderId: string | null): Promise<SceneSnapshot> {
    if (folderId) this.requireFolder(folderId);
    const record = this.requireScene(id);
    record.folderId = folderId;
    record.name = uniqueAmong(
      record.name,
      this.scenes.filter((s) => s.folderId === folderId && s.id !== id).map((s) => s.name),
    );
    await this.persist();
    return this.snapshot();
  }

  async removeScene(id: string): Promise<SceneSnapshot> {
    if (this.scenes.length < 2) throw new Error("Keep at least one scene.");
    const record = this.requireScene(id);
    this.scenes = this.scenes.filter((s) => s.id !== id);
    if (this.activeId === id) this.activeId = this.scenes[0].id;
    if (record.ext) {
      const file = this.mediaPath(record);
      if (existsSync(file)) await unlink(file).catch(() => undefined);
    }
    await this.persist();
    return this.snapshot();
  }

  async activate(id: string): Promise<SceneSnapshot> {
    this.requireScene(id);
    this.activeId = id;
    await this.persist();
    return this.snapshot();
  }

  async createFolder(wantedName: string, parentId: string | null): Promise<SceneSnapshot & { createdId: string }> {
    if (parentId) this.requireFolder(parentId);
    const name = uniqueAmong(
      wantedName,
      this.folders.filter((f) => f.parentId === parentId).map((f) => f.name),
    );
    const record: FolderRecord = { id: randomUUID(), name, parentId };
    this.folders.push(record);
    await this.persist();
    return { ...this.snapshot(), createdId: record.id };
  }

  async renameFolder(id: string, wantedName: string): Promise<SceneSnapshot> {
    const record = this.requireFolder(id);
    record.name = uniqueAmong(
      wantedName,
      this.folders.filter((f) => f.parentId === record.parentId && f.id !== id).map((f) => f.name),
    );
    await this.persist();
    return this.snapshot();
  }

  async removeFolder(id: string): Promise<SceneSnapshot> {
    this.requireFolder(id);
    const childFolders = this.folders.some((f) => f.parentId === id);
    const childScenes = this.scenes.some((s) => s.folderId === id);
    if (childFolders || childScenes) throw new Error("Folder is not empty.");
    this.folders = this.folders.filter((f) => f.id !== id);
    await this.persist();
    return this.snapshot();
  }

  async saveUpload(id: string, bytes: Buffer, mime: string): Promise<SceneSnapshot> {
    const ext = ALLOWED.get(mime);
    if (!ext) throw new Error("Use a JPEG, PNG, or WebP image.");
    if (bytes.length > 12 * 1024 * 1024) throw new Error("Image is too large (12 MB max).");
    const record = this.requireScene(id);
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

  private requireScene(id: string): SceneRecord {
    const record = this.scenes.find((s) => s.id === id);
    if (!record) throw new Error("Unknown scene.");
    return record;
  }

  private requireFolder(id: string): FolderRecord {
    const record = this.folders.find((f) => f.id === id);
    if (!record) throw new Error("Unknown folder.");
    return record;
  }

  private mediaPath(record: SceneRecord): string {
    return path.join(this.mediaDir, `${record.id}${record.ext ?? ""}`);
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    const state: DiskState = {
      activeId: this.activeId,
      scenes: this.scenes,
      folders: this.folders,
    };
    await writeFile(this.statePath, JSON.stringify(state, null, 2), "utf8");
  }
}

function uniqueAmong(wanted: string, existing: string[]): string {
  const name = wanted.trim();
  if (name.length < 1) throw new Error("Enter a name.");
  if (name.length > 48) throw new Error("Name is too long (48 characters max).");
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; n < 100; n++) {
    const candidate = `${name} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${name} (${randomUUID().slice(0, 4)})`;
}
