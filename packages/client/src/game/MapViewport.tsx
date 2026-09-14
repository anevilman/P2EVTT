import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import {
  cellSize,
  snapCenter,
  tokenSpan,
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
  onMoveToken?: (id: string, x: number, y: number) => void;
  onPlaceToken?: (x: number, y: number) => void;
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
  onMoveToken,
  onPlaceToken,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<Container | null>(null);
  const layerRef = useRef<Container | null>(null);
  const bgRef = useRef<Sprite | null>(null);
  const gridGfxRef = useRef<Graphics | null>(null);
  const spritesRef = useRef(new Map<string, Sprite>());
  const tokensRef = useRef(tokens);
  const placeModeRef = useRef(placeMode);
  const canEditRef = useRef(canEdit);
  const selectedRef = useRef(selectedTokenId);
  const gridRef = useRef(grid);
  const placeSpanRef = useRef(placeSpan);
  const callbacks = useRef({ onSelectToken, onMoveToken, onPlaceToken });
  const [status, setStatus] = useState(
    backgroundUrl ? "Loading map…" : "No map image yet — GM can upload one.",
  );

  tokensRef.current = tokens;
  placeModeRef.current = placeMode;
  canEditRef.current = canEdit;
  selectedRef.current = selectedTokenId;
  gridRef.current = grid;
  placeSpanRef.current = placeSpan;
  callbacks.current = { onSelectToken, onMoveToken, onPlaceToken };

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
        app.stage.addChild(world);
        world.addChild(layer);
        worldRef.current = world;
        layerRef.current = layer;
        app.stage.eventMode = "static";
        app.stage.hitArea = new Rectangle(0, 0, app.renderer.width, app.renderer.height);

        app.stage.on("pointerdown", (e) => {
          const target = e.target;
          if (target instanceof Sprite && target !== bg && target.label) {
            const id = String(target.label);
            callbacks.current.onSelectToken?.(id);
            const tok = tokensRef.current.find((t) => t.id === id);
            if (tok?.movable) dragToken = target;
            return;
          }
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
        app.stage.on("pointerup", () => {
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
        app.stage.on("pointerupoutside", () => {
          dragToken = null;
          panning = false;
        });
        app.stage.on("pointermove", (e) => {
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
      spritesRef.current.clear();
      resizeObs?.disconnect();
      host.removeEventListener("wheel", onWheel);
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
        sprite.cursor = token.movable ? "pointer" : "default";
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
      sprite.cursor = token.movable ? "pointer" : "default";
      sprite.alpha = token.id === selectedTokenId ? 1 : 0.95;
    }

    for (const [id, sprite] of sprites) {
      if (seen.has(id)) continue;
      sprite.destroy();
      sprites.delete(id);
    }
  }, [tokens, selectedTokenId, canEdit, backgroundUrl, status, grid]);

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
  }, [grid, backgroundUrl, status]);

  const hint = placeMode
    ? "Click the map to place the token"
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
  youId: string,
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
        movable: isGm || t.controllerId === youId,
      };
    });
}
