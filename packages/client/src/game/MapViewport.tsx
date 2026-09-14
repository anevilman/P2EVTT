import { useEffect, useRef, useState } from "react";
import { Application, Container, Rectangle, Sprite, Texture } from "pixi.js";

type Props = {
  backgroundUrl: string;
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

export function MapViewport({ backgroundUrl }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Loading map…");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    let world: Container | null = null;
    let destroyed = false;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
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
        app.stage.addChild(world);
        app.stage.eventMode = "static";
        app.stage.hitArea = new Rectangle(0, 0, app.renderer.width, app.renderer.height);

        app.stage.on("pointerdown", (e) => {
          dragging = true;
          lastX = e.global.x;
          lastY = e.global.y;
        });
        app.stage.on("pointerup", () => {
          dragging = false;
        });
        app.stage.on("pointerupoutside", () => {
          dragging = false;
        });
        app.stage.on("pointermove", (e) => {
          if (!dragging || !world) return;
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
        const sprite = new Sprite(texture);
        world.addChild(sprite);
        fit(sprite);
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
      resizeObs?.disconnect();
      host.removeEventListener("wheel", onWheel);
      try {
        app.destroy(true, { children: true, texture: true });
      } catch {
        /* init may not have finished */
      }
    };
  }, [backgroundUrl]);

  return (
    <div className="map-viewport">
      <div className="map-host" ref={hostRef} />
      {status ? <p className="map-status">{status}</p> : <p className="map-hint">Scroll to zoom · drag to pan</p>}
    </div>
  );
}
