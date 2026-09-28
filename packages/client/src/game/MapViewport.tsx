import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import {
  cellSize,
  snapCenter,
  tokenSpan,
  type FogRect,
  type PlacedToken,
  type SceneGrid,
  type TokenPrototype,
} from "@p2evtt/shared";
import { TOKEN_PX } from "./tokenSize";

export type MapToken = PlacedToken & {
  name: string;
  imageUrl: string | null;
  sizePx: number;
  movable: boolean;
};

type Props = {
  backgroundUrl: string | null;
  tokens?: MapToken[];
  grid?: SceneGrid | null;
  placeSpan?: number;
  canEdit?: boolean;
  placeMode?: boolean;
  selectedTokenId?: string | null;
  onSelectToken?: (id: string | null) => void;
  onInspectToken?: (id: string) => void;
  onMoveToken?: (id: string, x: number, y: number) => void;
  onPlaceToken?: (x: number, y: number) => void;
  fog?: FogRect[];
  fogGm?: boolean;
  fogDraw?: boolean;
  onAddFog?: (box: { x: number; y: number; w: number; h: number }) => void;
  onRemoveFog?: (id: string) => void;
};

function loadImageTexture(url: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(Texture.from(img));
    img.onerror = () => reject(new Error("Could not load map image"));
    img.src = url;
  });
}

function waitForSize(el: HTMLElement): Promise<void> {
  if (el.clientWidth > 1 && el.clientHeight > 1) return Promise.resolve();
  return new Promise((resolve) => {
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 1 && el.clientHeight > 1) {
        ro.disconnect();
        resolve();
      }
    });
    ro.observe(el);
  });
}

export function MapViewport({
  backgroundUrl,
  tokens = [],
  grid = null,
  placeSpan = 1,
  canEdit = false,
  placeMode = false,
  selectedTokenId = null,
  onSelectToken,
  onInspectToken,
  onMoveToken,
  onPlaceToken,
  fog = [],
  fogGm = false,
  fogDraw = false,
  onAddFog,
  onRemoveFog,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<Container | null>(null);
  const layerRef = useRef<Container | null>(null);
  const bgRef = useRef<Sprite | null>(null);
  const gridGfxRef = useRef<Graphics | null>(null);
  const fogLayerRef = useRef<Container | null>(null);
  const previewRef = useRef<Graphics | null>(null);
  const fogButtonsRef = useRef<Container[]>([]);
  const stageRef = useRef<Container | null>(null);
  const spritesRef = useRef(new Map<string, Sprite>());
  const tokensRef = useRef(tokens);
  const placeModeRef = useRef(placeMode);
  const fogDrawRef = useRef(fogDraw);
  const canEditRef = useRef(canEdit);
  const selectedRef = useRef(selectedTokenId);
  const gridRef = useRef(grid);
  const placeSpanRef = useRef(placeSpan);
  const callbacks = useRef({ onSelectToken, onInspectToken, onMoveToken, onPlaceToken, onAddFog, onRemoveFog });
  const [status, setStatus] = useState(
    backgroundUrl ? "Loading map…" : "No map image yet — GM can upload one.",
  );
  const [mapEpoch, setMapEpoch] = useState(0);

  tokensRef.current = tokens;
  placeModeRef.current = placeMode;
  fogDrawRef.current = fogDraw;
  canEditRef.current = canEdit;
  selectedRef.current = selectedTokenId;
  gridRef.current = grid;
  placeSpanRef.current = placeSpan;
  callbacks.current = { onSelectToken, onInspectToken, onMoveToken, onPlaceToken, onAddFog, onRemoveFog };

  const snap = (x: number, y: number, span: number) => {
    const g = gridRef.current;
    const bg = bgRef.current;
    if (!g?.enabled || !bg) return { x, y };
    return snapCenter(x, y, span, bg.width, bg.height, g);
  };

  useEffect(() => {
    if (!backgroundUrl) {
      setStatus("No map image yet — GM can upload one.");
      worldRef.current = null;
      layerRef.current = null;
      return;
    }
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    let world: Container | null = null;
    let bg: Sprite | null = null;
    let destroyed = false;
    let panning = false;
    let lastX = 0;
    let lastY = 0;
    let dragToken: Sprite | null = null;
    let resizeObs: ResizeObserver | null = null;
    let lastTokenClick = { id: "", time: 0 };
    let drawing = false;
    let drawX = 0;
    let drawY = 0;

    const paintPreview = (x1: number, y1: number) => {
      const preview = previewRef.current;
      const image = bgRef.current;
      if (!preview || !image) return;
      preview.clear();
      const box = clampFogBox(drawX, drawY, x1, y1, image.width, image.height);
      if (!box) return;
      preview
        .rect(box.x, box.y, box.w, box.h)
        .fill({ color: 0x9aa1ab, alpha: 0.24 })
        .stroke({ width: 3, color: 0x4b5563, alpha: 0.55 });
    };

    const finishDraw = (global: { x: number; y: number }) => {
      if (!drawing || !world) return;
      drawing = false;
      const preview = previewRef.current;
      const image = bgRef.current;
      preview?.clear();
      if (!image) return;
      const local = world.toLocal(global);
      const box = clampFogBox(drawX, drawY, local.x, local.y, image.width, image.height);
      if (!box || box.w < 8 || box.h < 8) return;
      callbacks.current.onAddFog?.(box);
    };

    const onContext = (ev: Event) => ev.preventDefault();

    const zoomAt = (screenX: number, screenY: number, factor: number) => {
      if (!world) return;
      const next = Math.min(4, Math.max(0.08, world.scale.x * factor));
      const wx = (screenX - world.x) / world.scale.x;
      const wy = (screenY - world.y) / world.scale.y;
      world.scale.set(next);
      world.x = screenX - wx * next;
      world.y = screenY - wy * next;
    };

    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = host.getBoundingClientRect();
      const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomAt(ev.clientX - rect.left, ev.clientY - rect.top, factor);
    };

    const fit = (sprite: Sprite) => {
      if (!world) return;
      const vw = app.renderer.width;
      const vh = app.renderer.height;
      if (sprite.texture.width < 1 || sprite.texture.height < 1 || vw < 1 || vh < 1) return;
      const s = Math.min(vw / sprite.texture.width, vh / sprite.texture.height) * 0.96;
      world.scale.set(s);
      world.x = (vw - sprite.texture.width * s) / 2;
      world.y = (vh - sprite.texture.height * s) / 2;
    };

    void (async () => {
      try {
        await waitForSize(host);
        if (destroyed) return;
        await app.init({
          background: 0x111113,
          width: host.clientWidth,
          height: host.clientHeight,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        });
        if (destroyed) {
          app.destroy(true);
          return;
        }
        app.canvas.style.display = "block";
        app.canvas.style.width = "100%";
        app.canvas.style.height = "100%";
        host.appendChild(app.canvas);

        world = new Container();
        const layer = new Container();
        const fogLayer = new Container();
        fogLayer.eventMode = "passive";
        const preview = new Graphics();
        preview.eventMode = "none";
        fogLayer.addChild(preview);
        app.stage.addChild(world);
        world.addChild(layer);
        world.addChild(fogLayer);
        worldRef.current = world;
        layerRef.current = layer;
        fogLayerRef.current = fogLayer;
        previewRef.current = preview;
        stageRef.current = app.stage;
        app.stage.eventMode = "static";
        app.stage.hitArea = new Rectangle(0, 0, app.renderer.width, app.renderer.height);
        app.ticker.add(() => {
          const current = worldRef.current;
          if (!current || current.scale.x <= 0) return;
          const scale = 1 / current.scale.x;
          for (const button of fogButtonsRef.current) button.scale.set(scale);
        });

        app.stage.on("pointerdown", (e) => {
          const target = e.target;
          if (fogButtonId(target)) return;
          if (fogDrawRef.current && (e.button ?? 0) === 0 && world) {
            const local = world.toLocal(e.global);
            drawing = true;
            drawX = local.x;
            drawY = local.y;
            dragToken = null;
            panning = false;
            return;
          }
          if (target instanceof Sprite && target !== bg && target.label) {
            const id = String(target.label);
            const now = performance.now();
            const repeat = (e.button ?? 0) === 0 && lastTokenClick.id === id && now - lastTokenClick.time < 500;
            lastTokenClick = repeat ? { id: "", time: 0 } : { id, time: now };
            callbacks.current.onSelectToken?.(id);
            if (repeat) callbacks.current.onInspectToken?.(id);
            const tok = tokensRef.current.find((t) => t.id === id);
            if (tok?.movable) dragToken = target;
            return;
          }
          lastTokenClick = { id: "", time: 0 };
          if (placeModeRef.current && world) {
            const local = world.toLocal(e.global);
            const p = snap(local.x, local.y, placeSpanRef.current);
            callbacks.current.onPlaceToken?.(p.x, p.y);
            return;
          }
          panning = true;
          lastX = e.global.x;
          lastY = e.global.y;
          callbacks.current.onSelectToken?.(null);
        });
        app.stage.on("pointerup", (e) => {
          if (drawing) {
            finishDraw(e.global);
            return;
          }
          const sprite = dragToken;
          if (sprite && world) {
            const tok = tokensRef.current.find((t) => t.id === String(sprite.label));
            const p = snap(sprite.x, sprite.y, tokenSpan(tok?.size ?? "medium"));
            sprite.position.set(p.x, p.y);
            callbacks.current.onMoveToken?.(String(sprite.label), p.x, p.y);
          }
          dragToken = null;
          panning = false;
        });
        app.stage.on("pointerupoutside", (e) => {
          if (drawing) {
            finishDraw(e.global);
            return;
          }
          dragToken = null;
          panning = false;
        });
        app.stage.on("pointermove", (e) => {
          if (drawing && world) {
            const local = world.toLocal(e.global);
            paintPreview(local.x, local.y);
            return;
          }
          if (dragToken && world) {
            const sprite = dragToken;
            const local = world.toLocal(e.global);
            const tok = tokensRef.current.find((t) => t.id === String(sprite.label));
            const p = snap(local.x, local.y, tokenSpan(tok?.size ?? "medium"));
            sprite.position.set(p.x, p.y);
            return;
          }
          if (!panning || !world) return;
          world.x += e.global.x - lastX;
          world.y += e.global.y - lastY;
          lastX = e.global.x;
          lastY = e.global.y;
        });

        const syncSize = () => {
          const w = host.clientWidth;
          const h = host.clientHeight;
          if (w < 2 || h < 2) return;
          app.renderer.resize(w, h);
          app.stage.hitArea = new Rectangle(0, 0, w, h);
        };
        resizeObs = new ResizeObserver(syncSize);
        resizeObs.observe(host);

        const texture = await loadImageTexture(backgroundUrl);
        if (destroyed) {
          texture.destroy(true);
          return;
        }
        bg = new Sprite(texture);
        bg.eventMode = "none";
        world.addChildAt(bg, 0);
        bgRef.current = bg;
        fit(bg);
        host.addEventListener("wheel", onWheel, { passive: false });
        host.addEventListener("contextmenu", onContext);
        setMapEpoch((n) => n + 1);
        setStatus("");
      } catch (err) {
        if (!destroyed) {
          setStatus(err instanceof Error ? err.message : "Map failed to load");
        }
      }
    })();

    return () => {
      destroyed = true;
      worldRef.current = null;
      layerRef.current = null;
      bgRef.current = null;
      gridGfxRef.current = null;
      fogLayerRef.current = null;
      previewRef.current = null;
      fogButtonsRef.current = [];
      stageRef.current = null;
      spritesRef.current.clear();
      resizeObs?.disconnect();
      host.removeEventListener("wheel", onWheel);
      host.removeEventListener("contextmenu", onContext);
      try {
        app.destroy(true, { children: true, texture: true });
      } catch {
        /* init may not have finished */
      }
    };
  }, [backgroundUrl]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const sprites = spritesRef.current;
    const seen = new Set<string>();

    for (const token of tokens) {
      seen.add(token.id);
      let sprite = sprites.get(token.id);
      if (!sprite) {
        sprite = new Sprite(Texture.WHITE);
        sprite.anchor.set(0.5);
        sprite.tint = token.imageUrl ? 0xffffff : 0x3b82f6;
        sprite.eventMode = "static";
        sprite.cursor = "pointer";
        sprite.label = token.id;
        layer.addChild(sprite);
        sprites.set(token.id, sprite);
        if (token.imageUrl) {
          void loadImageTexture(token.imageUrl).then((tex) => {
            const current = spritesRef.current.get(token.id);
            if (current) {
              current.texture = tex;
              current.tint = 0xffffff;
            }
          });
        }
      }
      sprite.position.set(token.x, token.y);
      const bg = bgRef.current;
      const g = gridRef.current;
      if (bg && g?.enabled) {
        const cell = cellSize(bg.width, g);
        sprite.width = tokenSpan(token.size) * cell;
        sprite.height = sprite.width;
      } else {
        sprite.width = token.sizePx;
        sprite.height = token.sizePx;
      }
      sprite.eventMode = fogDraw ? "none" : "static";
      sprite.cursor = fogDraw ? "crosshair" : token.movable ? "pointer" : "default";
      sprite.alpha = token.id === selectedTokenId ? 1 : 0.95;
    }

    for (const [id, sprite] of sprites) {
      if (seen.has(id)) continue;
      sprite.destroy();
      sprites.delete(id);
    }
  }, [tokens, selectedTokenId, canEdit, backgroundUrl, status, grid, fogDraw, mapEpoch]);

  useEffect(() => {
    const world = worldRef.current;
    const bg = bgRef.current;
    if (!world || !bg || status) return;
    let gfx = gridGfxRef.current;
    if (!gfx) {
      gfx = new Graphics();
      gfx.eventMode = "none";
      const layer = layerRef.current;
      const at = layer ? world.getChildIndex(layer) : world.children.length;
      world.addChildAt(gfx, Math.max(1, at));
      gridGfxRef.current = gfx;
    }
    gfx.clear();
    if (!grid?.enabled) return;
    const w = bg.width;
    const h = bg.height;
    const cell = cellSize(w, grid);
    if (cell < 2) return;
    const stroke = { width: 1, color: 0xf8fafc, alpha: 0.28 };
    for (let x = grid.offsetX; x <= w + 0.5; x += cell) {
      gfx.moveTo(x, 0).lineTo(x, h).stroke(stroke);
    }
    for (let y = grid.offsetY; y <= h + 0.5; y += cell) {
      gfx.moveTo(0, y).lineTo(w, y).stroke(stroke);
    }
  }, [grid, backgroundUrl, status, mapEpoch]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.cursor = fogDraw ? "crosshair" : "default";
  }, [fogDraw, status, backgroundUrl, mapEpoch]);

  useEffect(() => {
    const layer = fogLayerRef.current;
    const world = worldRef.current;
    if (!layer || !world || status) return;
    const preview = previewRef.current;
    const removed = layer.removeChildren();
    for (const child of removed) {
      if (child === preview) continue;
      child.destroy({ children: true });
    }
    const buttons: Container[] = [];
    for (const rect of fog) {
      const fill = new Graphics();
      if (fogGm) {
        fill
          .rect(rect.x, rect.y, rect.w, rect.h)
          .fill({ color: 0x9aa1ab, alpha: 0.24 })
          .stroke({ width: 3, color: 0x4b5563, alpha: 0.55 });
        fill.eventMode = "none";
      } else {
        fill.rect(rect.x, rect.y, rect.w, rect.h).fill({ color: 0x8a909a, alpha: 1 });
        fill.eventMode = "static";
        fill.cursor = "default";
      }
      layer.addChild(fill);
    }
    if (fogGm) {
      for (const rect of fog) {
        const button = new Container();
        button.position.set(rect.x + rect.w, rect.y);
        button.eventMode = "passive";
        const plate = new Graphics()
          .roundRect(-28, 4, 24, 24, 5)
          .fill({ color: 0x111113, alpha: 0.92 })
          .stroke({ width: 1, color: 0xf4f4f5, alpha: 0.85 });
        plate.label = `fog-x:${rect.id}`;
        plate.eventMode = "static";
        plate.cursor = "pointer";
        plate.hitArea = new Rectangle(-28, 4, 24, 24);
        const mark = new Graphics();
        mark.moveTo(-21.5, 11).lineTo(-10.5, 22).stroke({ width: 2, color: 0xfafafa, cap: "round" });
        mark.moveTo(-10.5, 11).lineTo(-21.5, 22).stroke({ width: 2, color: 0xfafafa, cap: "round" });
        mark.eventMode = "none";
        button.addChild(plate, mark);
        plate.on("pointerdown", (ev) => {
          ev.stopPropagation();
          callbacks.current.onRemoveFog?.(rect.id);
        });
        if (world.scale.x > 0) button.scale.set(1 / world.scale.x);
        layer.addChild(button);
        buttons.push(button);
      }
    }
    fogButtonsRef.current = buttons;
    if (preview) layer.addChild(preview);
  }, [fog, fogGm, status, backgroundUrl, mapEpoch]);

  const hint = fogDraw
    ? "Drag a box to place fog · right-drag to pan · click × to remove it"
    : placeMode
      ? "Click the map to place the token"
      : onInspectToken
        ? "Scroll to zoom · drag to pan · drag a token to move · double-click a token to inspect"
        : "Scroll to zoom · drag to pan · drag a token to move";

  return (
    <div className="map-viewport">
      <div className="map-host" ref={hostRef} />
      {status ? <p className="map-status">{status}</p> : <p className="map-hint">{hint}</p>}
    </div>
  );
}

export function toMapTokens(
  placed: PlacedToken[],
  prototypes: TokenPrototype[],
  sceneId: string,
  youName: string,
  isGm: boolean,
): MapToken[] {
  return placed
    .filter((t) => t.sceneId === sceneId)
    .map((t) => {
      const proto = prototypes.find((p) => p.id === t.prototypeId);
      return {
        ...t,
        name: proto?.name ?? "Token",
        imageUrl: proto?.imageUrl ?? null,
        sizePx: TOKEN_PX[t.size ?? proto?.size ?? "medium"],
        movable: isGm || namesMatch(t.controlledBy, youName),
      };
    });
}

function namesMatch(assigned: string | null | undefined, youName: string): boolean {
  return Boolean(assigned && assigned.toLowerCase() === youName.trim().toLowerCase());
}

function clampFogBox(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } | null {
  if (width < 1 || height < 1) return null;
  const left = clamp(Math.min(x0, x1), 0, width);
  const right = clamp(Math.max(x0, x1), 0, width);
  const top = clamp(Math.min(y0, y1), 0, height);
  const bottom = clamp(Math.max(y0, y1), 0, height);
  const w = right - left;
  const h = bottom - top;
  if (w <= 0 || h <= 0) return null;
  return { x: left, y: top, w, h };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fogButtonId(target: unknown): string | null {
  let node = target as { label?: unknown; parent?: unknown } | null;
  for (let i = 0; node && i < 8; i += 1) {
    if (typeof node.label === "string" && node.label.startsWith("fog-x:")) return node.label.slice(6);
    node = (node.parent ?? null) as typeof node;
  }
  return null;
}
