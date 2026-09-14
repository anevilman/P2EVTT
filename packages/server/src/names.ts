import { randomUUID } from "node:crypto";

export function uniqueAmong(wanted: string, existing: string[]): string {
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
