import { useTable } from "./net/useTable";
import { GmShell } from "./ui/GmShell";
import { JoinScreen } from "./ui/JoinScreen";
import { PlayerShell } from "./ui/PlayerShell";

export function App() {
  const table = useTable();

  if (table.session?.you.role === "gm" && table.scene) {
    return (
      <GmShell
        you={table.session.you}
        players={table.players}
        scene={table.scene}
        library={table.library}
        folders={table.folders}
        tokenLibrary={table.tokenLibrary}
        tokenFolders={table.tokenFolders}
        tokens={table.tokens}
        statLibrary={table.statLibrary}
        statFolders={table.statFolders}
        sessionToken={table.session.sessionToken}
        theme={table.theme}
        onToggleTheme={table.toggleTheme}
      />
    );
  }
  if (table.session?.you.role === "player" && table.scene) {
    return (
      <PlayerShell
        you={table.session.you}
        players={table.players}
        scene={table.scene}
        tokenLibrary={table.tokenLibrary}
        tokens={table.tokens}
        sessionToken={table.session.sessionToken}
        theme={table.theme}
        onToggleTheme={table.toggleTheme}
      />
    );
  }

  return (
    <JoinScreen
      defaultName={table.defaultName}
      busy={table.busy}
      error={table.error}
      theme={table.theme}
      onToggleTheme={table.toggleTheme}
      onJoin={table.join}
    />
  );
}
