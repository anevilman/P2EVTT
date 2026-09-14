import type { FastifyRequest, FastifyReply } from "fastify";
import type { Seat, Table } from "./table";

export function requireGm(
  req: FastifyRequest,
  reply: FastifyReply,
  table: Table,
): Seat | null {
  const token = String(req.headers["x-session-token"] ?? "");
  const seat = table.getByToken(token);
  if (!seat || seat.role !== "gm") {
    reply.code(403).send({ error: "Only the GM can do that." });
    return null;
  }
  return seat;
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
