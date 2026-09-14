import type { Presence, ScenePublic } from "@p2evtt/shared";
import { MapViewport } from "../game/MapViewport";
import type { Theme } from "../theme";
import { MapUpload } from "./MapUpload";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  you: Presence;
  players: Presence[];
  scene: ScenePublic;
  sessionToken: string;
  theme: Theme;
  onToggleTheme: () => void;
};

export function GmShell({ you, players, scene, sessionToken, theme, onToggleTheme }: Props) {
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
        <MapUpload sessionToken={sessionToken} />
        <h2>Library</h2>
        <p className="placeholder">Token library comes next.</p>
      </aside>
      <section className="map">
        <MapViewport backgroundUrl={scene.backgroundUrl} />
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
