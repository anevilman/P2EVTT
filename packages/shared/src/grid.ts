import type { TokenSize } from "./protocol";

export type SceneGrid = {
  enabled: boolean;
  squaresX: number;
  offsetX: number;
  offsetY: number;
};

export const DEFAULT_GRID: SceneGrid = {
  enabled: true,
  squaresX: 24,
  offsetX: 0,
  offsetY: 0,
};

export function tokenSpan(size: TokenSize): number {
  if (size === "gargantuan") return 4;
  if (size === "huge") return 3;
  if (size === "large") return 2;
  return 1;
}

export function cellSize(imageWidth: number, grid: SceneGrid): number {
  const n = Math.max(1, grid.squaresX);
  return imageWidth / n;
}

export function snapCenter(
  x: number,
  y: number,
  span: number,
  imageWidth: number,
  imageHeight: number,
  grid: SceneGrid,
): { x: number; y: number } {
  if (!grid.enabled || imageWidth < 1) return { x, y };
  const cell = cellSize(imageWidth, grid);
  const n = Math.max(1, span);
  const left = x - (n * cell) / 2;
  const top = y - (n * cell) / 2;
  const col = Math.round((left - grid.offsetX) / cell);
  const row = Math.round((top - grid.offsetY) / cell);
  const maxCol = Math.max(0, Math.floor(imageWidth / cell) - n);
  const maxRow = Math.max(0, Math.floor(imageHeight / cell) - n);
  const c = Math.min(maxCol, Math.max(0, col));
  const r = Math.min(maxRow, Math.max(0, row));
  return {
    x: grid.offsetX + c * cell + (n * cell) / 2,
    y: grid.offsetY + r * cell + (n * cell) / 2,
  };
}

export function occupiedSquares(
  x: number,
  y: number,
  span: number,
  imageWidth: number,
  grid: SceneGrid,
): { col: number; row: number }[] {
  const cell = cellSize(imageWidth, grid);
  const n = Math.max(1, span);
  const col0 = Math.round((x - (n * cell) / 2 - grid.offsetX) / cell);
  const row0 = Math.round((y - (n * cell) / 2 - grid.offsetY) / cell);
  const out: { col: number; row: number }[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) out.push({ col: col0 + c, row: row0 + r });
  }
  return out;
}

export function parseGrid(raw: unknown): SceneGrid {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_GRID };
  const g = raw as {
    enabled?: unknown;
    squaresX?: unknown;
    offsetX?: unknown;
    offsetY?: unknown;
  };
  const squaresX = typeof g.squaresX === "number" && Number.isFinite(g.squaresX) ? g.squaresX : DEFAULT_GRID.squaresX;
  return {
    enabled: g.enabled !== false,
    squaresX: Math.min(200, Math.max(2, Math.round(squaresX))),
    offsetX: typeof g.offsetX === "number" && Number.isFinite(g.offsetX) ? g.offsetX : 0,
    offsetY: typeof g.offsetY === "number" && Number.isFinite(g.offsetY) ? g.offsetY : 0,
  };
}
