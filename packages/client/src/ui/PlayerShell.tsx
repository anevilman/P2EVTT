import type { Presence, ScenePublic } from "@p2evtt/shared";
import { MapViewport } from "../game/MapViewport";
import type { Theme } from "../theme";
import { Dock } from "./Dock";
import { PartyIcon, SheetIcon } from "./dockIcons";
import { PresenceList } from "./PresenceList";
import { TableShell } from "./TableShell";

type Props = {
  you: Presence;
  players: Presence[];
  scene: ScenePublic;
  theme: Theme;
  onToggleTheme: () => void;
};

export function PlayerShell({ you, players, scene, theme, onToggleTheme }: Props) {
  return (
    <TableShell
      role="player"
      you={you}
      liveName={scene.name}
      theme={theme}
      onToggleTheme={onToggleTheme}
      dock={
        <Dock
          storageKey="p2evtt.dock.player"
          defaultTab="party"
          tabs={[
            {
              id: "party",
              label: "Party",
              icon: PartyIcon,
              content: (
                <>
                  <h2>Party</h2>
                  <PresenceList players={players} />
                </>
              ),
            },
            {
              id: "sheet",
              label: "Sheet",
              icon: SheetIcon,
              content: (
                <>
                  <h2>My sheet</h2>
                  <p className="placeholder">Character sheet in a later phase.</p>
                </>
              ),
            },
          ]}
        />
      }
      map={<MapViewport key={scene.id} backgroundUrl={scene.backgroundUrl} />}
    />
  );
}
