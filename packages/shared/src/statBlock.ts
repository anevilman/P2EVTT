export type StrikeLine = {
  id: string;
  name: string;
  attack: number;
  damage: string;
};

export type SkillLine = {
  id: string;
  name: string;
  bonus: number;
};

export type StatBlockData = {
  level: number;
  traits: string;
  perception: number;
  skills: SkillLine[];
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  ac: number;
  hp: number;
  hpMax: number;
  fort: number;
  ref: number;
  will: number;
  speed: string;
  strikes: StrikeLine[];
  notes: string;
};

export type StatBlockEntry = {
  id: string;
  name: string;
  folderId: string | null;
  data: StatBlockData;
};

export function emptyStatBlock(): StatBlockData {
  return {
    level: 0,
    traits: "",
    perception: 0,
    skills: [],
    str: 0,
    dex: 0,
    con: 0,
    int: 0,
    wis: 0,
    cha: 0,
    ac: 10,
    hp: 16,
    hpMax: 16,
    fort: 0,
    ref: 0,
    will: 0,
    speed: "25 feet",
    strikes: [],
    notes: "",
  };
}

export function cloneStatBlock(data: StatBlockData): StatBlockData {
  return {
    ...data,
    skills: data.skills.map((s) => ({ ...s })),
    strikes: data.strikes.map((s) => ({ ...s })),
  };
}

function num(raw: unknown, fallback: number): number {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
}

function str(raw: unknown, fallback: string): string {
  return typeof raw === "string" ? raw : fallback;
}

function parseSkills(raw: unknown): SkillLine[] {
  if (!Array.isArray(raw)) return [];
  const out: SkillLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as { id?: unknown; name?: unknown; bonus?: unknown };
    out.push({
      id: typeof s.id === "string" ? s.id : cryptoRandom(),
      name: str(s.name, "Skill"),
      bonus: num(s.bonus, 0),
    });
  }
  return out;
}

function parseStrikes(raw: unknown): StrikeLine[] {
  if (!Array.isArray(raw)) return [];
  const out: StrikeLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as { id?: unknown; name?: unknown; attack?: unknown; damage?: unknown };
    out.push({
      id: typeof s.id === "string" ? s.id : cryptoRandom(),
      name: str(s.name, "Strike"),
      attack: num(s.attack, 0),
      damage: str(s.damage, "1d8"),
    });
  }
  return out;
}

function cryptoRandom(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}`;
}

export function parseStatBlockData(raw: unknown): StatBlockData {
  const base = emptyStatBlock();
  if (!raw || typeof raw !== "object") return base;
  const d = raw as Record<string, unknown>;
  return {
    level: num(d.level, base.level),
    traits: str(d.traits, base.traits),
    perception: num(d.perception, base.perception),
    skills: parseSkills(d.skills),
    str: num(d.str, base.str),
    dex: num(d.dex, base.dex),
    con: num(d.con, base.con),
    int: num(d.int, base.int),
    wis: num(d.wis, base.wis),
    cha: num(d.cha, base.cha),
    ac: num(d.ac, base.ac),
    hp: num(d.hp, base.hp),
    hpMax: num(d.hpMax, base.hpMax),
    fort: num(d.fort, base.fort),
    ref: num(d.ref, base.ref),
    will: num(d.will, base.will),
    speed: str(d.speed, base.speed),
    strikes: parseStrikes(d.strikes),
    notes: str(d.notes, base.notes),
  };
}

export function parseStatBlockEntry(raw: unknown): StatBlockEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as { id?: unknown; name?: unknown; folderId?: unknown; data?: unknown };
  if (typeof e.id !== "string" || typeof e.name !== "string") return null;
  if (e.folderId !== null && typeof e.folderId !== "string") return null;
  return {
    id: e.id,
    name: e.name,
    folderId: e.folderId,
    data: parseStatBlockData(e.data),
  };
}
