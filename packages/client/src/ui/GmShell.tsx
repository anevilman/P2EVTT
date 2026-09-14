import { useEffect, useState } from "react";
import type { LibraryFolder, Presence, ScenePublic, SceneSummary } from "@p2evtt/shared";
import { MapViewport } from "../game/MapViewport";
import type { Theme } from "../theme";
import { Dock } from "./Dock";
import { InspectIcon, ScenesIcon, TokensIcon } from "./dockIcons";
import type { Selection } from "./library/LibraryTree";
import { MapUpload } from "./MapUpload";
import { PresenceList } from "./PresenceList";
import { SceneLibrary } from "./SceneLibrary";
import { TableShell } from "./TableShell";

type Props = {
  you: Presence;
  players: Presence[];
  scene: ScenePublic;
  library: SceneSummary[];
  folders: LibraryFolder[];
  sessionToken: string;
  theme: Theme;
  onToggleTheme: () => void;
};

export function GmShell({
  you,
  players,
  scene,
  library,
  folders,
  sessionToken,
  theme,
  onToggleTheme,
}: Props) {
  const [selection, setSelection] = useState<Selection>({ kind: "item", id: scene.id });

  useEffect(() => {
    if (selection.kind === "item" && !library.some((s) => s.id === selection.id)) {
      setSelection({ kind: "item", id: scene.id });
    }
    if (selection.kind === "folder" && !folders.some((f) => f.id === selection.id)) {
      setSelection({ kind: "item", id: scene.id });
    }
  }, [library, folders, scene.id, selection]);

  const selectedScene =
    selection.kind === "item" ? (library.find((s) => s.id === selection.id) ?? scene) : scene;
  const previewingOther = selectedScene.id !== scene.id;

  return (
    <TableShell
      role="gm"
      you={you}
      liveName={scene.name}
      editingName={previewingOther ? selectedScene.name : null}
      invite
      theme={theme}
      onToggleTheme={onToggleTheme}
      dock={
        <Dock
          storageKey="p2evtt.dock.gm"
          defaultTab="scenes"
          tabs={[
            {
              id: "scenes",
              label: "Scenes",
              icon: ScenesIcon,
              content: (
                <>
                  <SceneLibrary
                    sessionToken={sessionToken}
                    live={scene}
                    library={library}
                    folders={folders}
                    selection={selection}
                    onSelect={setSelection}
                  />
                  <MapUpload sessionToken={sessionToken} sceneId={selectedScene.id} />
                </>
              ),
            },
            {
              id: "tokens",
              label: "Tokens",
              icon: TokensIcon,
              content: (
                <>
                  <h2>Tokens</h2>
                  <p className="placeholder">Token library comes next. Same folder tree as scenes.</p>
                </>
              ),
            },
            {
              id: "inspect",
              label: "Inspect",
              icon: InspectIcon,
              content: (
                <>
                  <h2>Inspector</h2>
                  <p className="placeholder">Token and actor details.</p>
                  <h2>At the table</h2>
                  <PresenceList players={players} />
                </>
              ),
            },
          ]}
        />
      }
      map={
        <>
          {previewingOther ? (
            <p className="map-edit-banner">Players are still on {scene.name}</p>
          ) : null}
          <MapViewport key={selectedScene.id} backgroundUrl={selectedScene.backgroundUrl} />
        </>
      }
    />
  );
}
