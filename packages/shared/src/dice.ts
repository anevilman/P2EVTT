export type Degree = "CF" | "F" | "S" | "CS";

export type FormulaTerm =
  | { kind: "dice"; count: number; sides: number; sign: 1 | -1; pools: number; keep: "high" | "low" | "all" }
  | { kind: "const"; value: number };

export type DieFace = {
  sides: number;
  face: number;
  sign: 1 | -1;
  kept: boolean;
};

export type RollMath = {
  dice: DieFace[];
  constants: number[];
  diceTotal: number;
  total: number;
};

export type RollResult = RollMath & {
  id: string;
  roller: string;
  formula: string;
  dc: number | null;
  degree: Degree | null;
};

const MAX_DICE = 40;
const MAX_SIDES = 100;

function parseDiceTerm(body: string): { count: number; sides: number; pools: number; keep: "high" | "low" | "all" } | null {
  const advantage = /^(\d+)([*x])(\d+)d(\d+)$/i.exec(body);
  if (advantage) {
    return {
      pools: Number(advantage[1]),
      keep: advantage[2].toLowerCase() === "x" ? "low" : "high",
      count: Number(advantage[3]),
      sides: Number(advantage[4]),
    };
  }
  const plain = /^(\d+)d(\d+)$/i.exec(body);
  if (!plain) return null;
  return { pools: 1, keep: "all", count: Number(plain[1]), sides: Number(plain[2]) };
}

export function parseFormula(raw: string): FormulaTerm[] | null {
  const text = raw.replace(/\s+/g, "");
  if (!text) return null;
  const parts = text.match(/[+-]?[^+-]+/g);
  if (!parts || parts.join("") !== text) return null;
  const terms: FormulaTerm[] = [];
  let diceCount = 0;
  for (const part of parts) {
    const sign: 1 | -1 = part.startsWith("-") ? -1 : 1;
    const body = part.replace(/^[+-]/, "");
    if (!body) return null;
    const rolled = parseDiceTerm(body);
    if (rolled) {
      const { count, sides, pools, keep } = rolled;
      if (count < 1 || pools < 1 || sides < 2 || sides > MAX_SIDES) return null;
      diceCount += pools * count;
      if (diceCount > MAX_DICE) return null;
      terms.push({ kind: "dice", count, sides, sign, pools, keep });
      continue;
    }
    if (!/^\d+$/.test(body)) return null;
    const value = Number(body) * sign;
    if (!Number.isSafeInteger(value) || Math.abs(value) > 9999) return null;
    terms.push({ kind: "const", value });
  }
  if (!terms.some((term) => term.kind === "dice")) return null;
  return terms;
}

function defaultRng(sides: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % sides) + 1;
}

export function rollFormula(terms: FormulaTerm[], rng: (sides: number) => number = defaultRng): RollMath {
  const dice: DieFace[] = [];
  const constants: number[] = [];
  for (const term of terms) {
    if (term.kind === "const") {
      constants.push(term.value);
      continue;
    }
    const groups = Array.from({ length: term.pools }, () =>
      Array.from({ length: term.count }, () => rng(term.sides)),
    );
    let chosen = 0;
    if (term.keep !== "all") {
      const score = (faces: number[]) => faces.reduce((sum, face) => sum + face, 0);
      for (let group = 1; group < groups.length; group++) {
        const better =
          term.keep === "high" ? score(groups[group]) > score(groups[chosen]) : score(groups[group]) < score(groups[chosen]);
        if (better) chosen = group;
      }
    }
    groups.forEach((faces, group) => {
      const kept = term.keep === "all" || group === chosen;
      for (const face of faces) dice.push({ sides: term.sides, face, sign: term.sign, kept });
    });
  }
  const diceTotal = dice.reduce((sum, die) => sum + (die.kept ? die.sign * die.face : 0), 0);
  const total = constants.reduce((sum, value) => sum + value, diceTotal);
  return { dice, constants, diceTotal, total };
}

export function degreeOfSuccess(total: number, dc: number, dice: DieFace[]): Degree {
  let step = 1;
  if (total >= dc + 10) step = 3;
  else if (total >= dc) step = 2;
  else if (total <= dc - 10) step = 0;
  const checks = dice.filter((die) => die.kept && die.sides === 20 && die.sign > 0);
  if (checks.length === 1) {
    if (checks[0].face === 20) step = Math.min(3, step + 1);
    if (checks[0].face === 1) step = Math.max(0, step - 1);
  }
  return (["CF", "F", "S", "CS"] as const)[step];
}

export function parseRollResult(raw: unknown): RollResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.roller !== "string" || typeof r.formula !== "string") return null;
  if (!Array.isArray(r.dice) || !Array.isArray(r.constants)) return null;
  const dice: DieFace[] = [];
  for (const item of r.dice) {
    if (!item || typeof item !== "object") return null;
    const die = item as { sides?: unknown; face?: unknown; sign?: unknown; kept?: unknown };
    if (typeof die.sides !== "number" || typeof die.face !== "number") return null;
    if (die.sign !== 1 && die.sign !== -1) return null;
    dice.push({ sides: die.sides, face: die.face, sign: die.sign, kept: die.kept !== false });
  }
  const constants: number[] = [];
  for (const value of r.constants) {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    constants.push(value);
  }
  if (typeof r.diceTotal !== "number" || typeof r.total !== "number") return null;
  if (r.dc !== null && typeof r.dc !== "number") return null;
  if (r.degree !== null && r.degree !== "CF" && r.degree !== "F" && r.degree !== "S" && r.degree !== "CS") return null;
  return {
    id: r.id,
    roller: r.roller,
    formula: r.formula,
    dice,
    constants,
    diceTotal: r.diceTotal,
    total: r.total,
    dc: typeof r.dc === "number" ? r.dc : null,
    degree: r.degree === "CF" || r.degree === "F" || r.degree === "S" || r.degree === "CS" ? r.degree : null,
  };
}
