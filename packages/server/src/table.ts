import { randomUUID } from "node:crypto";
import type { Presence, Role } from "@p2evtt/shared";
import type { WebSocket } from "ws";

export type Seat = {
  id: string;
  displayName: string;
  role: Role;
  sessionToken: string;
  socket: WebSocket | null;
};

export class Table {
  private seats = new Map<string, Seat>();

  hasGm(): boolean {
    return [...this.seats.values()].some((s) => s.role === "gm");
  }

  list(): Presence[] {
    return [...this.seats.values()].map(toPresence);
  }

  getByToken(token: string): Seat | undefined {
    return this.seats.get(token);
  }

  sit(opts: {
    displayName: string;
    sessionToken?: string;
    loopback: boolean;
    socket: WebSocket;
  }): { seat: Seat } | { reject: string } {
    const name = opts.displayName.trim();
    if (name.length < 1) return { reject: "Enter a display name." };
    if (name.length > 32) return { reject: "Name is too long (32 characters max)." };

    if (opts.sessionToken) {
      const existing = this.seats.get(opts.sessionToken);
      if (existing) {
        if (existing.socket && existing.socket !== opts.socket) {
          try {
            existing.socket.close(4000, "taken over by another tab");
          } catch {
            /* ignore */
          }
        }
        existing.socket = opts.socket;
        existing.displayName = uniqueName(name, this.seats, opts.sessionToken);
        return { seat: existing };
      }
    }

    const sessionToken = randomUUID();
    const role: Role = !this.hasGm() && opts.loopback ? "gm" : "player";
    const seat: Seat = {
      id: randomUUID(),
      displayName: uniqueName(name, this.seats),
      role,
      sessionToken,
      socket: opts.socket,
    };
    this.seats.set(sessionToken, seat);
    return { seat };
  }

  leave(socket: WebSocket): boolean {
    for (const [token, seat] of this.seats) {
      if (seat.socket === socket) {
        seat.socket = null;
        this.seats.delete(token);
        return true;
      }
    }
    return false;
  }

  broadcast(msg: unknown, except?: WebSocket): void {
    const payload = JSON.stringify(msg);
    for (const seat of this.seats.values()) {
      if (!seat.socket || seat.socket === except) continue;
      if (seat.socket.readyState !== 1) continue;
      seat.socket.send(payload);
    }
  }
}

function toPresence(seat: Seat): Presence {
  return { id: seat.id, displayName: seat.displayName, role: seat.role };
}

function uniqueName(wanted: string, seats: Map<string, Seat>, exceptToken?: string): string {
  const taken = new Set(
    [...seats.values()]
      .filter((s) => s.sessionToken !== exceptToken)
      .map((s) => s.displayName.toLowerCase()),
  );
  if (!taken.has(wanted.toLowerCase())) return wanted;
  for (let n = 2; n < 100; n++) {
    const candidate = `${wanted} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${wanted} (${randomUUID().slice(0, 4)})`;
}
