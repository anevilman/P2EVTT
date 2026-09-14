import { useEffect, useRef } from "react";
import { Application, Assets, Container, Rectangle, Sprite } from "pixi.js";

type Props = {
  backgroundUrl: string;
};

export function MapViewport({ backgroundUrl }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    let world: Container | null = null;
    let destroyed = false;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

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
      if (sprite.width < 1 || sprite.height < 1 || vw < 1 || vh < 1) return;
      const s = Math.min(vw / sprite.width, vh / sprite.height) * 0.96;
      world.scale.set(s);
      world.x = (vw - sprite.width * s) / 2;
      world.y = (vh - sprite.height * s) / 2;
    };

    void (async () => {
      await app.init({
        background: 0x111113,
        resizeTo: host,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });
      if (destroyed) {
        app.destroy(true);
        return;
      }
      app.canvas.style.display = "block";
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

      const onResize = () => {
        app.stage.hitArea = new Rectangle(0, 0, app.renderer.width, app.renderer.height);
      };
      app.renderer.on("resize", onResize);

      const texture = await Assets.load(backgroundUrl);
      if (destroyed) return;
      const sprite = new Sprite(texture);
      world.addChild(sprite);
      fit(sprite);

      if (!destroyed) host.addEventListener("wheel", onWheel, { passive: false });
    })();

    return () => {
      destroyed = true;
      host.removeEventListener("wheel", onWheel);
      try {
        app.destroy(true, { children: true });
      } catch {
        /* init may not have finished */
      }
    };
  }, [backgroundUrl]);

  return (
    <div className="map-viewport">
      <div className="map-host" ref={hostRef} />
      <p className="map-hint">Scroll to zoom · drag to pan</p>
    </div>
  );
}
