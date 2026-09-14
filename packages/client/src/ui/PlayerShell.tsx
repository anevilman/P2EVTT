import type { PlacedToken, Presence, ScenePublic, TokenPrototype } from "@p2evtt/shared";
import { MapViewport, toMapTokens } from "../game/MapViewport";
import { gmFetch } from "../net/gmApi";
import type { Theme } from "../theme";
import { Dock } from "./Dock";
import { PartyIcon, SheetIcon } from "./dockIcons";
import { PresenceList } from "./PresenceList";
import { TableShell } from "./TableShell";

type Props = {
  you: Presence;
  players: Presence[];
  scene: ScenePublic;
  tokenLibrary: TokenPrototype[];
  tokens: PlacedToken[];
  sessionToken: string;
  theme: Theme;
  onToggleTheme: () => void;
};

export function PlayerShell({
  you,
  players,
  scene,
  tokenLibrary = [],
  tokens = [],
  sessionToken,
  theme,
  onToggleTheme,
}: Props) {
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
      map={
        <MapViewport
          key={scene.id}
          backgroundUrl={scene.backgroundUrl}
          tokens={toMapTokens(tokens, tokenLibrary, scene.id, you.displayName, false)}
          grid={scene.grid}
          onMoveToken={(id, x, y) => {
            void gmFetch(`/api/placed/${id}`, sessionToken, {
              method: "PATCH",
              body: JSON.stringify({ x, y }),
            });
          }}
        />
      }
    />
  );
}
