import { useEffect, useState } from "react";
import type {
  LibraryFolder,
  PlacedToken,
  Presence,
  ScenePublic,
  SceneSummary,
  TokenPrototype,
} from "@p2evtt/shared";
import { MapViewport, toMapTokens } from "../game/MapViewport";
import { gmFetch } from "../net/gmApi";
import type { Theme } from "../theme";
import { Dock } from "./Dock";
import { InspectIcon, ScenesIcon, TokensIcon } from "./dockIcons";
import type { Selection } from "./library/LibraryTree";
import { MapUpload } from "./MapUpload";
import { PresenceList } from "./PresenceList";
import { SceneLibrary } from "./SceneLibrary";
import { TableShell } from "./TableShell";
import { TokenLibrary } from "./TokenLibrary";

type Props = {
  you: Presence;
  players: Presence[];
  scene: ScenePublic;
  library: SceneSummary[];
  folders: LibraryFolder[];
  tokenLibrary: TokenPrototype[];
  tokenFolders: LibraryFolder[];
  tokens: PlacedToken[];
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
  tokenLibrary,
  tokenFolders,
  tokens,
  sessionToken,
  theme,
  onToggleTheme,
}: Props) {
  const [selection, setSelection] = useState<Selection>({ kind: "item", id: scene.id });
  const [tokenSel, setTokenSel] = useState<Selection>({ kind: "root" });
  const [placeMode, setPlaceMode] = useState(false);
  const [selectedPlacedId, setSelectedPlacedId] = useState<string | null>(null);

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
  const selectedProto =
    tokenSel.kind === "item" ? tokenLibrary.find((t) => t.id === tokenSel.id) : null;
  const selectedPlaced = tokens.find((t) => t.id === selectedPlacedId) ?? null;

  const placeOn = async (x: number, y: number) => {
    if (!selectedProto) return;
    await gmFetch("/api/placed", sessionToken, {
      method: "POST",
      body: JSON.stringify({
        prototypeId: selectedProto.id,
        sceneId: selectedScene.id,
        x,
        y,
      }),
    });
    setPlaceMode(false);
  };

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
                <TokenLibrary
                  sessionToken={sessionToken}
                  library={tokenLibrary}
                  folders={tokenFolders}
                  selection={tokenSel}
                  onSelect={(next) => {
                    setTokenSel(next);
                    setPlaceMode(false);
                  }}
                  placeMode={placeMode}
                  onTogglePlace={() => {
                    if (!selectedProto) return;
                    setPlaceMode((v) => !v);
                  }}
                />
              ),
            },
            {
              id: "inspect",
              label: "Inspect",
              icon: InspectIcon,
              content: (
                <>
                  <h2>Inspector</h2>
                  {selectedPlaced ? (
                    <PlacedInspect
                      token={selectedPlaced}
                      name={tokenLibrary.find((p) => p.id === selectedPlaced.prototypeId)?.name ?? "Token"}
                      sessionToken={sessionToken}
                    />
                  ) : (
                    <p className="placeholder">Select a token on the map.</p>
                  )}
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
          <MapViewport
            key={selectedScene.id}
            backgroundUrl={selectedScene.backgroundUrl}
            tokens={toMapTokens(tokens, tokenLibrary, selectedScene.id)}
            canEdit
            placeMode={placeMode}
            selectedTokenId={selectedPlacedId}
            onSelectToken={setSelectedPlacedId}
            onMoveToken={(id, x, y) => {
              void gmFetch(`/api/placed/${id}`, sessionToken, {
                method: "PATCH",
                body: JSON.stringify({ x, y }),
              });
            }}
            onPlaceToken={(x, y) => {
              void placeOn(x, y);
            }}
          />
        </>
      }
    />
  );
}

function PlacedInspect({
  token,
  name,
  sessionToken,
}: {
  token: PlacedToken;
  name: string;
  sessionToken: string;
}) {
  return (
    <div>
      <p>
        <strong>{name}</strong>
      </p>
      <p className="meta">
        {Math.round(token.x)}, {Math.round(token.y)}
      </p>
      <button
        type="button"
        className="file-btn"
        onClick={() => {
          void gmFetch(`/api/placed/${token.id}`, sessionToken, { method: "DELETE" });
        }}
      >
        Remove from map
      </button>
    </div>
  );
}
