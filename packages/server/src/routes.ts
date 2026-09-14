import type { FastifyInstance } from "fastify";
import { APP_NAME, APP_VERSION, parseGrid } from "@p2evtt/shared";
import { errorMessage, gmHandler, idParam, optionalId, requireSeat } from "./http";
import { TOKEN_SIZES, type TokenSize } from "@p2evtt/shared";
import type { SceneSnapshot, SceneStore } from "./scene";
import type { Table } from "./table";
import { parseStatBlockData } from "@p2evtt/shared";
import type { StatStore } from "./stats";
import type { TokenStore } from "./tokens";

function publish(table: Table, snap: SceneSnapshot) {
  table.broadcast({ type: "scene.updated", ...snap });
  return snap;
}

function publishTokens(table: Table, snap: ReturnType<TokenStore["snapshot"]>) {
  table.broadcast({ type: "tokens.updated", ...snap });
  return snap;
}

function publishStats(table: Table, snap: ReturnType<StatStore["snapshot"]>) {
  table.broadcast({ type: "stats.updated", ...snap });
  return snap;
}

function asSize(raw: unknown): TokenSize {
  if (typeof raw === "string" && (TOKEN_SIZES as readonly string[]).includes(raw)) return raw as TokenSize;
  throw new Error("Unknown token size.");
}

export async function registerRoutes(
  app: FastifyInstance,
  table: Table,
  scene: SceneStore,
  tokens: TokenStore,
  stats: StatStore,
): Promise<void> {
  app.get("/api/health", async () => ({
    ok: true,
    name: APP_NAME,
    version: APP_VERSION,
  }));

  app.get("/api/table", async () => ({
    hasGm: table.hasGm(),
    gmName: table.gmName(),
    seated: table.list().length,
  }));

  app.get("/media/scenes/:id", async (req, reply) => scene.sendFile(idParam(req), reply));

  app.post(
    "/api/scenes",
    gmHandler(table, "Could not create scene", async (req) => {
      const body = (req.body as { name?: unknown; folderId?: unknown } | null) ?? {};
      const snap = await scene.createScene(String(body.name ?? "New scene"), optionalId(body.folderId) ?? null);
      return publish(table, snap);
    }),
  );

  app.patch(
    "/api/scenes/:id",
    gmHandler(table, "Could not update scene", async (req) => {
      const id = idParam(req);
      const body = (req.body as { name?: unknown; folderId?: unknown; grid?: unknown } | null) ?? {};
      let snap = scene.snapshot();
      const folderId = optionalId(body.folderId);
      if (folderId !== undefined) snap = await scene.moveScene(id, folderId);
      if (typeof body.name === "string") snap = await scene.renameScene(id, body.name);
      if (body.grid !== undefined) snap = await scene.setGrid(id, parseGrid(body.grid));
      return publish(table, snap);
    }),
  );

  app.delete(
    "/api/scenes/:id",
    gmHandler(table, "Could not delete scene", async (req) =>
      publish(table, await scene.removeScene(idParam(req))),
    ),
  );

  app.post(
    "/api/scenes/:id/activate",
    gmHandler(table, "Could not switch scene", async (req) =>
      publish(table, await scene.activate(idParam(req))),
    ),
  );

  app.post(
    "/api/scenes/:id/background",
    gmHandler(table, "Upload failed", async (req, reply) => {
      const file = await req.file();
      if (!file) return reply.code(400).send({ error: "Choose an image file." });
      const snap = await scene.saveUpload(idParam(req), await file.toBuffer(), file.mimetype);
      return publish(table, snap);
    }),
  );

  app.post(
    "/api/folders",
    gmHandler(table, "Could not create folder", async (req) => {
      const body = (req.body as { name?: unknown; parentId?: unknown } | null) ?? {};
      const snap = await scene.createFolder(String(body.name ?? "New folder"), optionalId(body.parentId) ?? null);
      return publish(table, snap);
    }),
  );

  app.patch(
    "/api/folders/:id",
    gmHandler(table, "Could not rename folder", async (req) => {
      const name = String((req.body as { name?: unknown } | null)?.name ?? "");
      return publish(table, await scene.renameFolder(idParam(req), name));
    }),
  );

  app.delete(
    "/api/folders/:id",
    gmHandler(table, "Could not delete folder", async (req) =>
      publish(table, await scene.removeFolder(idParam(req))),
    ),
  );

  app.get("/media/tokens/:id", async (req, reply) => tokens.sendFile(idParam(req), reply));

  app.post(
    "/api/token-prototypes",
    gmHandler(table, "Could not create token", async (req) => {
      const body = (req.body as { name?: unknown; folderId?: unknown } | null) ?? {};
      const snap = await tokens.createPrototype(String(body.name ?? "New token"), optionalId(body.folderId) ?? null);
      return publishTokens(table, snap);
    }),
  );

  app.patch(
    "/api/token-prototypes/:id",
    gmHandler(table, "Could not update token", async (req) => {
      const id = idParam(req);
      const body = (req.body as { name?: unknown; folderId?: unknown; size?: unknown; controlledBy?: unknown; statBlockId?: unknown } | null) ?? {};
      let snap = tokens.snapshot();
      const folderId = optionalId(body.folderId);
      if (folderId !== undefined) snap = await tokens.movePrototype(id, folderId);
      if (typeof body.name === "string") snap = await tokens.renamePrototype(id, body.name);
      if (body.size !== undefined) snap = await tokens.setSize(id, asSize(body.size));
      if (body.controlledBy !== undefined) {
        const raw = body.controlledBy;
        snap = await tokens.setPrototypeControlledBy(id, raw === null || raw === "" ? null : String(raw));
      }
      if (body.statBlockId !== undefined) {
        const sid = optionalId(body.statBlockId) ?? null;
        snap = await tokens.setPrototypeStatBlock(id, sid);
      }
      return publishTokens(table, snap);
    }),
  );

  app.delete(
    "/api/token-prototypes/:id",
    gmHandler(table, "Could not delete token", async (req) =>
      publishTokens(table, await tokens.removePrototype(idParam(req))),
    ),
  );

  app.post(
    "/api/token-prototypes/:id/art",
    gmHandler(table, "Upload failed", async (req, reply) => {
      const file = await req.file();
      if (!file) return reply.code(400).send({ error: "Choose an image file." });
      return publishTokens(table, await tokens.saveArt(idParam(req), await file.toBuffer(), file.mimetype));
    }),
  );

  app.post(
    "/api/token-folders",
    gmHandler(table, "Could not create folder", async (req) => {
      const body = (req.body as { name?: unknown; parentId?: unknown } | null) ?? {};
      const snap = await tokens.createFolder(String(body.name ?? "New folder"), optionalId(body.parentId) ?? null);
      return publishTokens(table, snap);
    }),
  );

  app.patch(
    "/api/token-folders/:id",
    gmHandler(table, "Could not rename folder", async (req) => {
      const name = String((req.body as { name?: unknown } | null)?.name ?? "");
      return publishTokens(table, await tokens.renameFolder(idParam(req), name));
    }),
  );

  app.delete(
    "/api/token-folders/:id",
    gmHandler(table, "Could not delete folder", async (req) =>
      publishTokens(table, await tokens.removeFolder(idParam(req))),
    ),
  );

  app.post(
    "/api/placed",
    gmHandler(table, "Could not place token", async (req) => {
      const body = (req.body as { prototypeId?: unknown; sceneId?: unknown; x?: unknown; y?: unknown } | null) ?? {};
      if (typeof body.prototypeId !== "string" || typeof body.sceneId !== "string") {
        throw new Error("prototypeId and sceneId are required.");
      }
      const x = Number(body.x);
      const y = Number(body.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("x and y must be numbers.");
      const proto = tokens.getPrototype(body.prototypeId);
      const copy = proto.statBlockId ? stats.copy(proto.statBlockId) : null;
      return publishTokens(table, await tokens.place(body.prototypeId, body.sceneId, x, y, copy));
    }),
  );

  app.post(
    "/api/placed/batch",
    gmHandler(table, "Could not place tokens", async (req) => {
      const body = (req.body as { sceneId?: unknown; placements?: unknown } | null) ?? {};
      if (typeof body.sceneId !== "string") throw new Error("sceneId is required.");
      if (!Array.isArray(body.placements)) throw new Error("placements is required.");
      const placements: { prototypeId: string; x: number; y: number; statBlock: ReturnType<StatStore["copy"]> }[] = [];
      for (const item of body.placements) {
        if (!item || typeof item !== "object") throw new Error("Invalid placement.");
        const p = item as { prototypeId?: unknown; x?: unknown; y?: unknown };
        if (typeof p.prototypeId !== "string") throw new Error("prototypeId is required.");
        const x = Number(p.x);
        const y = Number(p.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("x and y must be numbers.");
        const proto = tokens.getPrototype(p.prototypeId);
        placements.push({
          prototypeId: p.prototypeId,
          x,
          y,
          statBlock: proto.statBlockId ? stats.copy(proto.statBlockId) : null,
        });
      }
      return publishTokens(table, await tokens.placeMany(body.sceneId, placements));
    }),
  );

  app.patch("/api/placed/:id", async (req, reply) => {
    const seat = requireSeat(req, reply, table);
    if (!seat) return;
    const placed = tokens.getPlaced(idParam(req));
    if (!placed) return reply.code(404).send({ error: "Unknown token." });
    const body = (req.body as { x?: unknown; y?: unknown; size?: unknown; controlledBy?: unknown; statBlock?: unknown } | null) ?? {};
    const isGm = seat.role === "gm";
    const isController =
      typeof placed.controlledBy === "string" &&
      placed.controlledBy.toLowerCase() === seat.displayName.toLowerCase();
    if (!isGm && !isController) {
      return reply.code(403).send({ error: "That token is not yours." });
    }
    if (!isGm && (body.size !== undefined || body.controlledBy !== undefined || body.statBlock !== undefined)) {
      return reply.code(403).send({ error: "Only the GM can change size, control, or the stat block." });
    }
    try {
      const patch: {
        x?: number;
        y?: number;
        size?: TokenSize;
        controlledBy?: string | null;
        statBlock?: ReturnType<typeof parseStatBlockData> | null;
      } = {};
      if (body.x !== undefined) {
        const x = Number(body.x);
        if (!Number.isFinite(x)) throw new Error("x must be a number.");
        patch.x = x;
      }
      if (body.y !== undefined) {
        const y = Number(body.y);
        if (!Number.isFinite(y)) throw new Error("y must be a number.");
        patch.y = y;
      }
      if (isGm && body.size !== undefined) patch.size = asSize(body.size);
      if (isGm && body.controlledBy !== undefined) {
        const raw = body.controlledBy;
        patch.controlledBy = raw === null || raw === "" ? null : String(raw);
      }
      if (isGm && body.statBlock !== undefined) {
        patch.statBlock = body.statBlock == null ? null : parseStatBlockData(body.statBlock);
      }
      return publishTokens(table, await tokens.updatePlaced(idParam(req), patch));
    } catch (err) {
      return reply.code(400).send({ error: errorMessage(err, "Could not update token") });
    }
  });

  app.delete(
    "/api/placed/:id",
    gmHandler(table, "Could not remove token", async (req) =>
      publishTokens(table, await tokens.removePlaced(idParam(req))),
    ),
  );

  app.post(
    "/api/stat-blocks",
    gmHandler(table, "Could not create stat block", async (req) => {
      const body = (req.body as { name?: unknown; folderId?: unknown } | null) ?? {};
      return publishStats(
        table,
        await stats.create(String(body.name ?? "New stat block"), optionalId(body.folderId) ?? null),
      );
    }),
  );

  app.patch(
    "/api/stat-blocks/:id",
    gmHandler(table, "Could not update stat block", async (req) => {
      const id = idParam(req);
      const body = (req.body as { name?: unknown; folderId?: unknown; data?: unknown } | null) ?? {};
      let snap = stats.snapshot();
      const folderId = optionalId(body.folderId);
      if (folderId !== undefined) snap = await stats.move(id, folderId);
      if (typeof body.name === "string") snap = await stats.rename(id, body.name);
      if (body.data !== undefined) snap = await stats.saveData(id, parseStatBlockData(body.data));
      return publishStats(table, snap);
    }),
  );

  app.delete(
    "/api/stat-blocks/:id",
    gmHandler(table, "Could not delete stat block", async (req) => {
      const id = idParam(req);
      const snap = await stats.remove(id);
      await tokens.clearStatBlockRefs(id);
      publishTokens(table, tokens.snapshot());
      return publishStats(table, snap);
    }),
  );

  app.post(
    "/api/stat-folders",
    gmHandler(table, "Could not create folder", async (req) => {
      const body = (req.body as { name?: unknown; parentId?: unknown } | null) ?? {};
      return publishStats(
        table,
        await stats.createFolder(String(body.name ?? "New folder"), optionalId(body.parentId) ?? null),
      );
    }),
  );

  app.patch(
    "/api/stat-folders/:id",
    gmHandler(table, "Could not rename folder", async (req) => {
      const name = String((req.body as { name?: unknown } | null)?.name ?? "");
      return publishStats(table, await stats.renameFolder(idParam(req), name));
    }),
  );

  app.delete(
    "/api/stat-folders/:id",
    gmHandler(table, "Could not delete folder", async (req) =>
      publishStats(table, await stats.removeFolder(idParam(req))),
    ),
  );
}
