import { MapViewport, toMapTokens } from "../game/MapViewport";
import { gmFetch } from "../net/gmApi";
import { useStore } from "../store/TableStore";
import { Dock } from "./Dock";
import { PartyIcon, StatsIcon } from "./dockIcons";
import { SheetLibrary } from "./SheetLibrary";
import { PresenceList } from "./PresenceList";
import { TableShell } from "./TableShell";

export function PlayerShell() {
  const { state, theme, actions } = useStore();
  const session = state.session;
  const scene = state.scene;
  if (!session || !scene || session.you.role !== "player") return null;
  const you = session.you;

  return (
    <TableShell
      role="player"
      you={you}
      liveName={scene.name}
      theme={theme}
      onToggleTheme={actions.toggleTheme}
      dock={
        <Dock
          openId={state.ui.docks.player}
          onToggle={(id) => actions.toggleDock("player", id)}
          tabs={[
            {
              id: "party",
              label: "Party",
              icon: PartyIcon,
              content: (
                <>
                  <h2>Party</h2>
                  <PresenceList players={state.players} />
                </>
              ),
            },
            {
              id: "sheet",
              label: "Sheets",
              icon: StatsIcon,
              content: (
                <SheetLibrary
                  sessionToken={session.sessionToken}
                  library={state.sheetLibrary}
                  folders={state.sheetFolders}
                  selection={state.ui.sheetSelection}
                  onSelect={actions.setSheetSelection}
                  onSnapshot={actions.applySheets}
                  actor={{ role: "player", name: you.displayName }}
                />
              ),
            },
          ]}
        />
      }
      map={
        <MapViewport
          key={scene.id}
          backgroundUrl={scene.backgroundUrl}
          tokens={toMapTokens(state.tokens, state.tokenLibrary, scene.id, you.displayName, false)}
          grid={scene.grid}
          onMoveToken={(id, x, y) => {
            void gmFetch(`/api/placed/${id}`, session.sessionToken, {
              method: "PATCH",
              body: JSON.stringify({ x, y }),
            });
          }}
          fog={scene.fog}
        />
      }
    />
  );
}
