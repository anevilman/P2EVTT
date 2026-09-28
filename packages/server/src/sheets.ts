import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { CharacterSheetData, CharacterSheetEntry, LibraryFolder } from "@p2evtt/shared";
import { parseCharacterSheetData, sheetOwnedBy } from "@p2evtt/shared";
import { uniqueAmong } from "./names";

type FolderRecord = {
  id: string;
  name: string;
  parentId: string | null;
};

type DiskState = {
  folders: FolderRecord[];
  sheets: CharacterSheetEntry[];
};

export type SheetSnapshot = {
  sheetLibrary: CharacterSheetEntry[];
  sheetFolders: LibraryFolder[];
};

export class SheetStore {
  private folders: FolderRecord[] = [];
  private sheets: CharacterSheetEntry[] = [];
  private readonly statePath: string;

  constructor(dataDir: string) {
    this.statePath = path.join(dataDir, "character-sheets.json");
  }

  async load(): Promise<void> {
    if (!existsSync(this.statePath)) return;
    const raw = JSON.parse(await readFile(this.statePath, "utf8")) as DiskState;
    this.folders = raw.folders ?? [];
    this.sheets = (raw.sheets ?? []).map((sheet) => ({
      ...sheet,
      folderId: sheet.folderId ?? null,
      data: parseCharacterSheetData(sheet.data),
    }));
  }

  snapshot(): SheetSnapshot {
    return {
      sheetLibrary: this.sheets.map((sheet) => ({
        ...sheet,
        data: parseCharacterSheetData(sheet.data),
      })),
      sheetFolders: this.folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
      })),
    };
  }

  has(id: string): boolean {
    return this.sheets.some((sheet) => sheet.id === id);
  }

  ownedBy(id: string, playerName: string): boolean {
    const sheet = this.sheets.find((item) => item.id === id);
    if (!sheet) return false;
    return sheetOwnedBy(this.snapshot().sheetFolders, sheet.folderId, playerName);
  }

  async create(name: string, folderId: string | null): Promise<SheetSnapshot & { createdId: string }> {
    if (folderId) this.requireFolder(folderId);
    const record: CharacterSheetEntry = {
      id: randomUUID(),
      name: uniqueAmong(
        name,
        this.sheets.filter((sheet) => sheet.folderId === folderId).map((sheet) => sheet.name),
      ),
      folderId,
      data: parseCharacterSheetData(null),
    };
    this.sheets.push(record);
    await this.persist();
    return { ...this.snapshot(), createdId: record.id };
  }

  async createForPlayer(playerName: string, name: string): Promise<SheetSnapshot & { createdId: string }> {
    const folderId = this.playerFolderId(playerName);
    return this.create(name, folderId);
  }

  async rename(id: string, name: string): Promise<SheetSnapshot> {
    const record = this.require(id);
    record.name = uniqueAmong(
      name,
      this.sheets.filter((sheet) => sheet.folderId === record.folderId && sheet.id !== id).map((sheet) => sheet.name),
    );
    await this.persist();
    return this.snapshot();
  }

  async move(id: string, folderId: string | null): Promise<SheetSnapshot> {
    if (folderId) this.requireFolder(folderId);
    const record = this.require(id);
    record.folderId = folderId;
    record.name = uniqueAmong(
      record.name,
      this.sheets.filter((sheet) => sheet.folderId === folderId && sheet.id !== id).map((sheet) => sheet.name),
    );
    await this.persist();
    return this.snapshot();
  }

  async saveData(id: string, data: CharacterSheetData): Promise<SheetSnapshot> {
    this.require(id).data = parseCharacterSheetData(data);
    await this.persist();
    return this.snapshot();
  }

  async remove(id: string): Promise<SheetSnapshot> {
    this.require(id);
    this.sheets = this.sheets.filter((sheet) => sheet.id !== id);
    await this.persist();
    return this.snapshot();
  }

  async createFolder(name: string, parentId: string | null): Promise<SheetSnapshot & { createdId: string }> {
    if (parentId) this.requireFolder(parentId);
    const record: FolderRecord = {
      id: randomUUID(),
      name: uniqueAmong(
        name,
        this.folders.filter((folder) => folder.parentId === parentId).map((folder) => folder.name),
      ),
      parentId,
    };
    this.folders.push(record);
    await this.persist();
    return { ...this.snapshot(), createdId: record.id };
  }

  async renameFolder(id: string, name: string): Promise<SheetSnapshot> {
    const record = this.requireFolder(id);
    record.name = uniqueAmong(
      name,
      this.folders.filter((folder) => folder.parentId === record.parentId && folder.id !== id).map((folder) => folder.name),
    );
    await this.persist();
    return this.snapshot();
  }

  async removeFolder(id: string): Promise<SheetSnapshot> {
    this.requireFolder(id);
    if (this.folders.some((folder) => folder.parentId === id) || this.sheets.some((sheet) => sheet.folderId === id)) {
      throw new Error("Folder is not empty.");
    }
    this.folders = this.folders.filter((folder) => folder.id !== id);
    await this.persist();
    return this.snapshot();
  }

  private playerFolderId(playerName: string): string {
    const want = playerName.trim();
    const existing = this.folders.find((folder) => folder.name.trim().toLowerCase() === want.toLowerCase());
    if (existing) return existing.id;
    const record: FolderRecord = { id: randomUUID(), name: want, parentId: null };
    this.folders.push(record);
    return record.id;
  }

  private require(id: string): CharacterSheetEntry {
    const record = this.sheets.find((sheet) => sheet.id === id);
    if (!record) throw new Error("Unknown character sheet.");
    return record;
  }

  private requireFolder(id: string): FolderRecord {
    const record = this.folders.find((folder) => folder.id === id);
    if (!record) throw new Error("Unknown folder.");
    return record;
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    const state: DiskState = { folders: this.folders, sheets: this.sheets };
    await writeFile(this.statePath, JSON.stringify(state, null, 2), "utf8");
  }
}
