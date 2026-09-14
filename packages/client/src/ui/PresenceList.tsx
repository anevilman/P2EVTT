import type { Presence } from "@p2evtt/shared";

export function PresenceList({ players }: { players: Presence[] }) {
  return (
    <ul className="presence">
      {players.map((p) => (
        <li key={p.id}>
          <span className={p.role === "gm" ? "badge" : "role"}>{p.role}</span> {p.displayName}
        </li>
      ))}
    </ul>
  );
}
