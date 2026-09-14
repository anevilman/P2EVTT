import type { Presence } from "@p2evtt/shared";
import type { Theme } from "../theme";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  you: Presence;
  players: Presence[];
  theme: Theme;
  onToggleTheme: () => void;
};

export function GmShell({ you, players, theme, onToggleTheme }: Props) {
  return (
    <div className="shell gm">
      <header className="topbar">
        <strong>P2EVTT</strong>
        <span className="badge">GM</span>
        <span className="you">{you.displayName}</span>
        <span className="invite" title="Share this URL. Players just open it in a browser.">
          Invite: {location.host}
        </span>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </header>
      <aside className="left">
        <h2>Library</h2>
        <p className="placeholder">Token library and scenes land in a later phase.</p>
      </aside>
      <section className="map">
        <p>Map</p>
        <p className="placeholder">Background, grid, and tokens come next.</p>
      </section>
      <aside className="right">
        <h2>Inspector</h2>
        <p className="placeholder">Token and actor details.</p>
        <h2>At the table</h2>
        <ul className="presence">
          {players.map((p) => (
            <li key={p.id}>
              <span className={p.role === "gm" ? "badge" : "role"}>{p.role}</span> {p.displayName}
            </li>
          ))}
        </ul>
      </aside>
      <footer className="bottom">
        <p className="placeholder">Chat and dice will live here.</p>
      </footer>
    </div>
  );
}
