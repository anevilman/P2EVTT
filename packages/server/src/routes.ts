import type { FastifyInstance } from "fastify";
import { APP_NAME, APP_VERSION } from "@p2evtt/shared";
import { gmHandler, idParam, optionalId } from "./http";
import type { SceneSnapshot, SceneStore } from "./scene";
import type { Table } from "./table";

function publish(table: Table, snap: SceneSnapshot) {
  table.broadcast({ type: "scene.updated", ...snap });
  return snap;
}

export async function registerRoutes(
  app: FastifyInstance,
  table: Table,
  scene: SceneStore,
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
      const body = (req.body as { name?: unknown; folderId?: unknown } | null) ?? {};
      let snap = scene.snapshot();
      const folderId = optionalId(body.folderId);
      if (folderId !== undefined) snap = await scene.moveScene(id, folderId);
      if (typeof body.name === "string") snap = await scene.renameScene(id, body.name);
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
}
