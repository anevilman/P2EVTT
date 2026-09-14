import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { FastifyReply } from "fastify";
import type { PlacedToken, TokenPrototype, TokenSize, TokenSnapshot } from "@p2evtt/shared";
import { uniqueAmong } from "./names";

const ALLOWED = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

type ProtoRecord = {
  id: string;
  name: string;
  folderId: string | null;
  ext: string | null;
  version: number;
  size: TokenSize;
  usesFixture: boolean;
  controlledBy: string | null;
};

type FolderRecord = {
  id: string;
  name: string;
  parentId: string | null;
};

type PlacedRecord = Omit<PlacedToken, "size" | "controlledBy"> & {
  size?: TokenSize;
  controlledBy?: string | null;
  controllerId?: string | null;
};

type DiskState = {
  folders: FolderRecord[];
  prototypes: ProtoRecord[];
  placed: PlacedRecord[];
};

export class TokenStore {
  private folders: FolderRecord[] = [];
  private prototypes: ProtoRecord[] = [];
  private placed: PlacedToken[] = [];
  private readonly statePath: string;
  private readonly mediaDir: string;

  constructor(
    dataDir: string,
    private fixturePath: string,
  ) {
    this.statePath = path.join(dataDir, "tokens.json");
    this.mediaDir = path.join(dataDir, "tokens");
  }

  async load(): Promise<void> {
    await mkdir(this.mediaDir, { recursive: true });
    if (existsSync(this.statePath)) {
      const raw = JSON.parse(await readFile(this.statePath, "utf8")) as DiskState;
      this.folders = raw.folders ?? [];
      this.prototypes = (raw.prototypes ?? []).map((p) => ({
        ...p,
        controlledBy: normalizeControllerName(p.controlledBy),
      }));
      this.placed = (raw.placed ?? []).map((t) => ({
        ...t,
        size:
          t.size ??
          this.prototypes.find((p) => p.id === t.prototypeId)?.size ??
          "medium",
        controlledBy: normalizeControllerName(t.controlledBy ?? t.controllerId),
      }));
    }
    if (this.prototypes.length < 1) {
      this.prototypes = [
        {
          id: randomUUID(),
          name: "Adventurer",
          folderId: null,
          ext: null,
          version: 1,
          size: "medium",
          usesFixture: true,
          controlledBy: null,
        },
      ];
      await this.persist();
    }
  }

  snapshot(): TokenSnapshot {
    return {
      tokenLibrary: this.prototypes.map((p) => this.toPublic(p)),
      tokenFolders: this.folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })),
      tokens: this.placed.map((t) => ({ ...t })),
    };
  }

  async createPrototype(name: string, folderId: string | null): Promise<TokenSnapshot & { createdId: string }> {
    if (folderId) this.requireFolder(folderId);
    const record: ProtoRecord = {
      id: randomUUID(),
      name: uniqueAmong(
        name,
        this.prototypes.filter((p) => p.folderId === folderId).map((p) => p.name),
      ),
      folderId,
      ext: null,
      version: 1,
      size: "medium",
      usesFixture: false,
      controlledBy: null,
    };
    this.prototypes.push(record);
    await this.persist();
    return { ...this.snapshot(), createdId: record.id };
  }

  async renamePrototype(id: string, name: string): Promise<TokenSnapshot> {
    const record = this.requireProto(id);
    record.name = uniqueAmong(
      name,
      this.prototypes.filter((p) => p.folderId === record.folderId && p.id !== id).map((p) => p.name),
    );
    await this.persist();
    return this.snapshot();
  }

  async movePrototype(id: string, folderId: string | null): Promise<TokenSnapshot> {
    if (folderId) this.requireFolder(folderId);
    const record = this.requireProto(id);
    record.folderId = folderId;
    record.name = uniqueAmong(
      record.name,
      this.prototypes.filter((p) => p.folderId === folderId && p.id !== id).map((p) => p.name),
    );
    await this.persist();
    return this.snapshot();
  }

  async setSize(id: string, size: TokenSize): Promise<TokenSnapshot> {
    this.requireProto(id).size = size;
    await this.persist();
    return this.snapshot();
  }

  async setPrototypeControlledBy(id: string, name: string | null): Promise<TokenSnapshot> {
    this.requireProto(id).controlledBy = normalizeControllerName(name);
    await this.persist();
    return this.snapshot();
  }

  async removePrototype(id: string): Promise<TokenSnapshot> {
    this.requireProto(id);
    const record = this.prototypes.find((p) => p.id === id)!;
    this.prototypes = this.prototypes.filter((p) => p.id !== id);
    this.placed = this.placed.filter((t) => t.prototypeId !== id);
    if (record.ext) {
      const file = this.mediaPath(record);
      if (existsSync(file)) await unlink(file).catch(() => undefined);
    }
    await this.persist();
    return this.snapshot();
  }

  async createFolder(name: string, parentId: string | null): Promise<TokenSnapshot & { createdId: string }> {
    if (parentId) this.requireFolder(parentId);
    const record: FolderRecord = {
      id: randomUUID(),
      name: uniqueAmong(
        name,
        this.folders.filter((f) => f.parentId === parentId).map((f) => f.name),
      ),
      parentId,
    };
    this.folders.push(record);
    await this.persist();
    return { ...this.snapshot(), createdId: record.id };
  }

  async renameFolder(id: string, name: string): Promise<TokenSnapshot> {
    const record = this.requireFolder(id);
    record.name = uniqueAmong(
      name,
      this.folders.filter((f) => f.parentId === record.parentId && f.id !== id).map((f) => f.name),
    );
    await this.persist();
    return this.snapshot();
  }

  async removeFolder(id: string): Promise<TokenSnapshot> {
    this.requireFolder(id);
    if (this.folders.some((f) => f.parentId === id) || this.prototypes.some((p) => p.folderId === id)) {
      throw new Error("Folder is not empty.");
    }
    this.folders = this.folders.filter((f) => f.id !== id);
    await this.persist();
    return this.snapshot();
  }

  async saveArt(id: string, bytes: Buffer, mime: string): Promise<TokenSnapshot> {
    const ext = ALLOWED.get(mime);
    if (!ext) throw new Error("Use a JPEG, PNG, or WebP image.");
    if (bytes.length > 8 * 1024 * 1024) throw new Error("Image is too large (8 MB max).");
    const record = this.requireProto(id);
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

  async place(prototypeId: string, sceneId: string, x: number, y: number): Promise<TokenSnapshot> {
    const proto = this.requireProto(prototypeId);
    this.placed.push({
      id: randomUUID(),
      prototypeId,
      sceneId,
      x,
      y,
      size: proto.size,
      controlledBy: proto.controlledBy,
    });
    await this.persist();
    return this.snapshot();
  }

  async placeMany(
    sceneId: string,
    placements: { prototypeId: string; x: number; y: number }[],
  ): Promise<TokenSnapshot> {
    if (placements.length < 1) throw new Error("Nothing to place.");
    for (const p of placements) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error("x and y must be numbers.");
      const proto = this.requireProto(p.prototypeId);
      this.placed.push({
        id: randomUUID(),
        prototypeId: proto.id,
        sceneId,
        x: p.x,
        y: p.y,
        size: proto.size,
        controlledBy: proto.controlledBy,
      });
    }
    await this.persist();
    return this.snapshot();
  }

  async updatePlaced(
    id: string,
    patch: { x?: number; y?: number; size?: TokenSize; controlledBy?: string | null },
  ): Promise<TokenSnapshot> {
    const token = this.placed.find((t) => t.id === id);
    if (!token) throw new Error("Unknown token.");
    if (patch.x !== undefined) token.x = patch.x;
    if (patch.y !== undefined) token.y = patch.y;
    if (patch.size !== undefined) token.size = patch.size;
    if (patch.controlledBy !== undefined) token.controlledBy = normalizeControllerName(patch.controlledBy);
    await this.persist();
    return this.snapshot();
  }

  getPlaced(id: string): PlacedToken | undefined {
    return this.placed.find((t) => t.id === id);
  }

  async removePlaced(id: string): Promise<TokenSnapshot> {
    if (!this.placed.some((t) => t.id === id)) throw new Error("Unknown token.");
    this.placed = this.placed.filter((t) => t.id !== id);
    await this.persist();
    return this.snapshot();
  }

  async sendFile(id: string, reply: FastifyReply) {
    const record = this.prototypes.find((p) => p.id === id);
    if (!record) return reply.code(404).send({ error: "Unknown token" });
    let file: string | null = null;
    if (record.ext) file = this.mediaPath(record);
    else if (record.usesFixture) file = this.fixturePath;
    if (!file || !existsSync(file)) return reply.code(404).send({ error: "No token art" });
    const ext = path.extname(file).toLowerCase();
    const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    const bytes = await readFile(file);
    return reply.header("Content-Type", type).header("Cache-Control", "no-cache").send(bytes);
  }

  private toPublic(record: ProtoRecord): TokenPrototype {
    const hasImage = Boolean(record.ext) || record.usesFixture;
    return {
      id: record.id,
      name: record.name,
      folderId: record.folderId,
      imageUrl: hasImage ? `/media/tokens/${record.id}?v=${record.version}` : null,
      size: record.size,
      version: record.version,
      controlledBy: record.controlledBy ?? null,
    };
  }

  private requireProto(id: string): ProtoRecord {
    const record = this.prototypes.find((p) => p.id === id);
    if (!record) throw new Error("Unknown token.");
    return record;
  }

  private requireFolder(id: string): FolderRecord {
    const record = this.folders.find((f) => f.id === id);
    if (!record) throw new Error("Unknown folder.");
    return record;
  }

  private mediaPath(record: ProtoRecord): string {
    return path.join(this.mediaDir, `${record.id}${record.ext ?? ""}`);
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    const state: DiskState = {
      folders: this.folders,
      prototypes: this.prototypes,
      placed: this.placed,
    };
    await writeFile(this.statePath, JSON.stringify(state, null, 2), "utf8");
  }
}

function normalizeControllerName(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (name.length < 1) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name)) return null;
  return name;
}
