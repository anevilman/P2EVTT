import type { FastifyInstance } from "fastify";
import { APP_NAME, APP_VERSION, parseGrid } from "@p2evtt/shared";
import { gmHandler, idParam, optionalId } from "./http";
import { TOKEN_SIZES, type TokenSize } from "@p2evtt/shared";
import type { SceneSnapshot, SceneStore } from "./scene";
import type { Table } from "./table";
import type { TokenStore } from "./tokens";

function publish(table: Table, snap: SceneSnapshot) {
  table.broadcast({ type: "scene.updated", ...snap });
  return snap;
}

function publishTokens(table: Table, snap: ReturnType<TokenStore["snapshot"]>) {
  table.broadcast({ type: "tokens.updated", ...snap });
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
      const body = (req.body as { name?: unknown; folderId?: unknown; size?: unknown } | null) ?? {};
      let snap = tokens.snapshot();
      const folderId = optionalId(body.folderId);
      if (folderId !== undefined) snap = await tokens.movePrototype(id, folderId);
      if (typeof body.name === "string") snap = await tokens.renamePrototype(id, body.name);
      if (body.size !== undefined) snap = await tokens.setSize(id, asSize(body.size));
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
      return publishTokens(table, await tokens.place(body.prototypeId, body.sceneId, x, y));
    }),
  );

  app.patch(
    "/api/placed/:id",
    gmHandler(table, "Could not update token", async (req) => {
      const body = (req.body as { x?: unknown; y?: unknown; size?: unknown } | null) ?? {};
      const patch: { x?: number; y?: number; size?: TokenSize } = {};
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
      if (body.size !== undefined) patch.size = asSize(body.size);
      return publishTokens(table, await tokens.updatePlaced(idParam(req), patch));
    }),
  );

  app.delete(
    "/api/placed/:id",
    gmHandler(table, "Could not remove token", async (req) =>
      publishTokens(table, await tokens.removePlaced(idParam(req))),
    ),
  );
}
