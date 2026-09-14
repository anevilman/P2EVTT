import type { FastifyReply, FastifyRequest, RouteHandlerMethod } from "fastify";
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

export function idParam(req: FastifyRequest): string {
  return (req.params as { id: string }).id;
}

export function optionalId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return String(value);
}

export function requireSeat(
  req: FastifyRequest,
  reply: FastifyReply,
  table: Table,
): Seat | null {
  const token = String(req.headers["x-session-token"] ?? "");
  const seat = table.getByToken(token);
  if (!seat) {
    reply.code(401).send({ error: "Sit at the table first." });
    return null;
  }
  return seat;
}

export function gmHandler(
  table: Table,
  fallback: string,
  run: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>,
): RouteHandlerMethod {
  return async (req, reply) => {
    if (!requireGm(req, reply, table)) return;
    try {
      return await run(req, reply);
    } catch (err) {
      return reply.code(400).send({ error: errorMessage(err, fallback) });
    }
  };
}
