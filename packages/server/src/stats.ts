import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { LibraryFolder, StatBlockData, StatBlockEntry } from "@p2evtt/shared";
import { cloneStatBlock, emptyStatBlock, parseStatBlockData } from "@p2evtt/shared";
import { uniqueAmong } from "./names";

type FolderRecord = {
  id: string;
  name: string;
  parentId: string | null;
};

type DiskState = {
  folders: FolderRecord[];
  blocks: StatBlockEntry[];
};

export type StatSnapshot = {
  statLibrary: StatBlockEntry[];
  statFolders: LibraryFolder[];
};

export class StatStore {
  private folders: FolderRecord[] = [];
  private blocks: StatBlockEntry[] = [];
  private readonly statePath: string;

  constructor(dataDir: string) {
    this.statePath = path.join(dataDir, "stat-blocks.json");
  }

  async load(): Promise<void> {
    if (!existsSync(this.statePath)) return;
    const raw = JSON.parse(await readFile(this.statePath, "utf8")) as DiskState;
    this.folders = raw.folders ?? [];
    this.blocks = (raw.blocks ?? []).map((b) => ({
      ...b,
      data: parseStatBlockData(b.data),
    }));
  }

  snapshot(): StatSnapshot {
    return {
      statLibrary: this.blocks.map((b) => ({
        ...b,
        data: cloneStatBlock(b.data),
      })),
      statFolders: this.folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })),
    };
  }

  copy(id: string): StatBlockData | null {
    const block = this.blocks.find((b) => b.id === id);
    return block ? cloneStatBlock(block.data) : null;
  }

  async create(name: string, folderId: string | null): Promise<StatSnapshot & { createdId: string }> {
    if (folderId) this.requireFolder(folderId);
    const record: StatBlockEntry = {
      id: randomUUID(),
      name: uniqueAmong(
        name,
        this.blocks.filter((b) => b.folderId === folderId).map((b) => b.name),
      ),
      folderId,
      data: emptyStatBlock(),
    };
    this.blocks.push(record);
    await this.persist();
    return { ...this.snapshot(), createdId: record.id };
  }

  async rename(id: string, name: string): Promise<StatSnapshot> {
    const record = this.require(id);
    record.name = uniqueAmong(
      name,
      this.blocks.filter((b) => b.folderId === record.folderId && b.id !== id).map((b) => b.name),
    );
    await this.persist();
    return this.snapshot();
  }

  async move(id: string, folderId: string | null): Promise<StatSnapshot> {
    if (folderId) this.requireFolder(folderId);
    const record = this.require(id);
    record.folderId = folderId;
    record.name = uniqueAmong(
      record.name,
      this.blocks.filter((b) => b.folderId === folderId && b.id !== id).map((b) => b.name),
    );
    await this.persist();
    return this.snapshot();
  }

  async saveData(id: string, data: StatBlockData): Promise<StatSnapshot> {
    this.require(id).data = parseStatBlockData(data);
    await this.persist();
    return this.snapshot();
  }

  async remove(id: string): Promise<StatSnapshot> {
    this.require(id);
    this.blocks = this.blocks.filter((b) => b.id !== id);
    await this.persist();
    return this.snapshot();
  }

  async createFolder(name: string, parentId: string | null): Promise<StatSnapshot & { createdId: string }> {
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

  async renameFolder(id: string, name: string): Promise<StatSnapshot> {
    const record = this.requireFolder(id);
    record.name = uniqueAmong(
      name,
      this.folders.filter((f) => f.parentId === record.parentId && f.id !== id).map((f) => f.name),
    );
    await this.persist();
    return this.snapshot();
  }

  async removeFolder(id: string): Promise<StatSnapshot> {
    this.requireFolder(id);
    if (this.folders.some((f) => f.parentId === id) || this.blocks.some((b) => b.folderId === id)) {
      throw new Error("Folder is not empty.");
    }
    this.folders = this.folders.filter((f) => f.id !== id);
    await this.persist();
    return this.snapshot();
  }

  private require(id: string): StatBlockEntry {
    const record = this.blocks.find((b) => b.id === id);
    if (!record) throw new Error("Unknown stat block.");
    return record;
  }

  private requireFolder(id: string): FolderRecord {
    const record = this.folders.find((f) => f.id === id);
    if (!record) throw new Error("Unknown folder.");
    return record;
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    const state: DiskState = { folders: this.folders, blocks: this.blocks };
    await writeFile(this.statePath, JSON.stringify(state, null, 2), "utf8");
  }
}
