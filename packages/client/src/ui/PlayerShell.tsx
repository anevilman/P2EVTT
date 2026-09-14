import type { Presence } from "@p2evtt/shared";

type Props = {
  you: Presence;
  players: Presence[];
};

export function PlayerShell({ you, players }: Props) {
  return (
    <div className="shell player">
      <header className="topbar">
        <strong>P2EVTT</strong>
        <span className="role">player</span>
        <span className="you">{you.displayName}</span>
      </header>
      <aside className="left">
        <h2>Party</h2>
        <ul className="presence">
          {players.map((p) => (
            <li key={p.id}>
              <span className={p.role === "gm" ? "badge" : "role"}>{p.role}</span> {p.displayName}
            </li>
          ))}
        </ul>
      </aside>
      <section className="map">
        <p>Map</p>
        <p className="placeholder">Your view of the table — no GM tools here.</p>
      </section>
      <aside className="right">
        <h2>My sheet</h2>
        <p className="placeholder">Character sheet in a later phase.</p>
      </aside>
      <footer className="bottom">
        <p className="placeholder">Chat and dice will live here.</p>
      </footer>
    </div>
  );
}
