import { useEffect, useState } from "react";
import {
  TOKEN_SIZES,
  emptyStatBlock,
  tokenSpan,
  type LibraryFolder,
  type PlacedToken,
  type Presence,
  type ScenePublic,
  type SceneSummary,
  type StatBlockEntry,
  type TokenPrototype,
  type TokenSize,
} from "@p2evtt/shared";
import { TOKEN_PX } from "../game/tokenSize";
import { MapViewport, toMapTokens } from "../game/MapViewport";
import { gmFetch } from "../net/gmApi";
import type { Theme } from "../theme";
import { AssignedToSelect } from "./AssignedToSelect";
import { Dock } from "./Dock";
import { InspectIcon, ScenesIcon, StatsIcon, TokensIcon } from "./dockIcons";
import { StatBlockEditor } from "./StatBlockEditor";
import { StatLibrary } from "./StatLibrary";
import { folderAndDescendants } from "./library/folderPath";
import type { Selection } from "./library/LibraryTree";
import { MapUpload } from "./MapUpload";
import { PresenceList } from "./PresenceList";
import { SceneLibrary } from "./SceneLibrary";
import { TableShell } from "./TableShell";
import { TokenLibrary, type PlaceKind } from "./TokenLibrary";

type Props = {
  you: Presence;
  players: Presence[];
  scene: ScenePublic;
  library: SceneSummary[];
  folders: LibraryFolder[];
  tokenLibrary: TokenPrototype[];
  tokenFolders: LibraryFolder[];
  tokens: PlacedToken[];
  statLibrary: StatBlockEntry[];
  statFolders: LibraryFolder[];
  sessionToken: string;
  theme: Theme;
  onToggleTheme: () => void;
  onStatSnapshot: (library: StatBlockEntry[], folders: LibraryFolder[]) => void;
};

export function GmShell({
  you,
  players,
  scene,
  library,
  folders,
  tokenLibrary = [],
  tokenFolders = [],
  tokens = [],
  statLibrary = [],
  statFolders = [],
  sessionToken,
  theme,
  onToggleTheme,
  onStatSnapshot,
}: Props) {
  const [selection, setSelection] = useState<Selection>({ kind: "item", id: scene.id });
  const [tokenSel, setTokenSel] = useState<Selection>({ kind: "root" });
  const [statSel, setStatSel] = useState<Selection>({ kind: "root" });
  const [placeKind, setPlaceKind] = useState<PlaceKind>("off");
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

  const tokensInScope = () => {
    const folderId = tokenSel.kind === "folder" ? tokenSel.id : tokenSel.kind === "root" ? null : undefined;
    if (folderId === undefined) return [];
    const scope = folderAndDescendants(tokenFolders, folderId);
    return tokenLibrary.filter((t) => scope.has(t.folderId));
  };

  const placeOn = async (x: number, y: number) => {
    if (placeKind === "all") {
      const list = tokensInScope();
      let cursor = x;
      const placements = list.map((proto) => {
        const at = { prototypeId: proto.id, x: cursor, y };
        cursor += TOKEN_PX[proto.size] * 1.1;
        return at;
      });
      if (placements.length > 0) {
        await gmFetch("/api/placed/batch", sessionToken, {
          method: "POST",
          body: JSON.stringify({ sceneId: selectedScene.id, placements }),
        });
      }
      setPlaceKind("off");
      return;
    }
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
    setPlaceKind("off");
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
                  players={players}
                  statLibrary={statLibrary}
                  selection={tokenSel}
                  onSelect={(next) => {
                    setTokenSel(next);
                    setPlaceKind("off");
                  }}
                  placeKind={placeKind}
                  onTogglePlace={() => {
                    if (!selectedProto) return;
                    setPlaceKind((k) => (k === "one" ? "off" : "one"));
                  }}
                  onTogglePlaceAll={() => {
                    setPlaceKind((k) => (k === "all" ? "off" : "all"));
                  }}
                />
              ),
            },
            {
              id: "stats",
              label: "Stats",
              icon: StatsIcon,
              content: (
                <StatLibrary
                  sessionToken={sessionToken}
                  library={statLibrary}
                  folders={statFolders}
                  selection={statSel}
                  onSelect={setStatSel}
                  onSnapshot={onStatSnapshot}
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
                      players={players}
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
            tokens={toMapTokens(tokens, tokenLibrary, selectedScene.id, you.displayName, true)}
            grid={selectedScene.grid}
            placeSpan={
              placeKind === "all"
                ? 1
                : selectedProto
                  ? tokenSpan(selectedProto.size)
                  : 1
            }
            canEdit
            placeMode={placeKind !== "off"}
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
  players,
}: {
  token: PlacedToken;
  name: string;
  sessionToken: string;
  players: Presence[];
}) {
  return (
    <div>
      <p>
        <strong>{name}</strong>
      </p>
      <p className="meta">
        {Math.round(token.x)}, {Math.round(token.y)}
      </p>
      <AssignedToSelect
        value={token.controlledBy}
        players={players}
        onChange={(name) => {
          void gmFetch(`/api/placed/${token.id}`, sessionToken, {
            method: "PATCH",
            body: JSON.stringify({ controlledBy: name }),
          });
        }}
      />
      <label className="folder-move">
        Size
        <select
          value={token.size}
          onChange={(e) => {
            void gmFetch(`/api/placed/${token.id}`, sessionToken, {
              method: "PATCH",
              body: JSON.stringify({ size: e.target.value as TokenSize }),
            });
          }}
        >
          {TOKEN_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      {token.statBlock ? (
        <StatBlockEditor
          data={token.statBlock}
          onChange={(data) => {
            void gmFetch(`/api/placed/${token.id}`, sessionToken, {
              method: "PATCH",
              body: JSON.stringify({ statBlock: data }),
            });
          }}
        />
      ) : (
        <button
          type="button"
          className="file-btn"
          onClick={() => {
            void gmFetch(`/api/placed/${token.id}`, sessionToken, {
              method: "PATCH",
              body: JSON.stringify({ statBlock: emptyStatBlock() }),
            });
          }}
        >
          Add stat block
        </button>
      )}
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
