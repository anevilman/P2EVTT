import type { Presence, ScenePublic } from "@p2evtt/shared";
import { MapViewport } from "../game/MapViewport";
import type { Theme } from "../theme";
import { Dock } from "./Dock";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  you: Presence;
  players: Presence[];
  scene: ScenePublic;
  theme: Theme;
  onToggleTheme: () => void;
};

export function PlayerShell({ you, players, scene, theme, onToggleTheme }: Props) {
  return (
    <div className="shell player">
      <header className="topbar">
        <strong>P2EVTT</strong>
        <span className="role">player</span>
        <span className="scene-title">{scene.name}</span>
        <span className="you">{you.displayName}</span>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </header>
      <Dock
        storageKey="p2evtt.dock.player"
        defaultTab="party"
        tabs={[
          {
            id: "party",
            label: "Party",
            content: (
              <>
                <h2>Party</h2>
                <ul className="presence">
                  {players.map((p) => (
                    <li key={p.id}>
                      <span className={p.role === "gm" ? "badge" : "role"}>{p.role}</span>{" "}
                      {p.displayName}
                    </li>
                  ))}
                </ul>
              </>
            ),
          },
          {
            id: "sheet",
            label: "Sheet",
            content: (
              <>
                <h2>My sheet</h2>
                <p className="placeholder">Character sheet in a later phase.</p>
              </>
            ),
          },
        ]}
      />
      <section className="map">
        <MapViewport key={scene.id} backgroundUrl={scene.backgroundUrl} />
      </section>
      <footer className="bottom">
        <p className="placeholder">Chat and dice will live here.</p>
      </footer>
    </div>
  );
}
