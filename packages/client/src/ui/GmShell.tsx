import { useEffect, useState } from "react";
import {
  TOKEN_SIZES,
  emptyStatBlock,
  tokenSpan,
  type CharacterSheetData,
  type CharacterSheetEntry,
  type PlacedToken,
  type Presence,
  type StatBlockData,
  type StatBlockEntry,
  type TokenSize,
} from "@p2evtt/shared";
import { TOKEN_PX } from "../game/tokenSize";
import { MapViewport, toMapTokens } from "../game/MapViewport";
import { gmFetch } from "../net/gmApi";
import { useStore } from "../store/TableStore";
import { AssignRecordSelect, type RecordLink } from "./AssignRecordSelect";
import { AssignedToSelect } from "./AssignedToSelect";
import { CharacterSheetEditor } from "./CharacterSheetEditor";
import { useDebouncedStatSave } from "./debouncedStatSave";
import { Dock } from "./Dock";
import { CubeIcon, InspectIcon, ScenesIcon, StatsIcon, TokensIcon } from "./dockIcons";
import { SheetLibrary } from "./SheetLibrary";
import { StatBlockEditor } from "./StatBlockEditor";
import { StatLibrary } from "./StatLibrary";
import { folderAndDescendants } from "./library/folderPath";
import { MapUpload } from "./MapUpload";
import { PresenceList } from "./PresenceList";
import { SceneLibrary } from "./SceneLibrary";
import { TableShell } from "./TableShell";
import { TokenLibrary } from "./TokenLibrary";

export function GmShell() {
  const { state, theme, actions } = useStore();
  const session = state.session;
  const scene = state.scene;
  const [statError, setStatError] = useState<string | null>(null);
  const placedSheet = useDebouncedStatSave((id, data) => {
    const token = state.session?.sessionToken;
    if (!token) return;
    return gmFetch(`/api/character-sheets/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ data }),
    })
      .then(() => setStatError(null))
      .catch((err: unknown) => {
        setStatError(err instanceof Error ? err.message : "Could not save character sheet");
      });
  });
  const placedStat = useDebouncedStatSave((id, data) => {
    const token = state.session?.sessionToken;
    if (!token) return;
    return gmFetch(`/api/placed/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ statBlock: data }),
    })
      .then(() => setStatError(null))
      .catch((err: unknown) => {
        setStatError(err instanceof Error ? err.message : "Could not save stat block");
      });
  });

  useEffect(() => {
    setStatError(null);
  }, [state.ui.selectedPlacedId]);

  if (!session || !scene || session.you.role !== "gm") return null;

  const you = session.you;
  const { players, library, folders, tokenLibrary, tokenFolders, tokens, statLibrary, statFolders, sheetLibrary, sheetFolders } = state;
  const { sceneSelection, tokenSelection, statSelection, sheetSelection, placeKind, fogDraw, selectedPlacedId } = state.ui;
  const sessionToken = session.sessionToken;

  const selectedScene =
    sceneSelection.kind === "item" ? (library.find((item) => item.id === sceneSelection.id) ?? scene) : scene;
  const previewingOther = selectedScene.id !== scene.id;
  const selectedProto = tokenSelection.kind === "item" ? tokenLibrary.find((token) => token.id === tokenSelection.id) : null;
  const selectedPlaced = tokens.find((token) => token.id === selectedPlacedId) ?? null;

  const tokensInScope = () => {
    const folderId = tokenSelection.kind === "folder" ? tokenSelection.id : tokenSelection.kind === "root" ? null : undefined;
    if (folderId === undefined) return [];
    const scope = folderAndDescendants(tokenFolders, folderId);
    return tokenLibrary.filter((token) => scope.has(token.folderId));
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
      actions.setPlaceKind("off");
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
    actions.setPlaceKind("off");
  };

  return (
    <TableShell
      role="gm"
      you={you}
      liveName={scene.name}
      editingName={previewingOther ? selectedScene.name : null}
      invite
      theme={theme}
      onToggleTheme={actions.toggleTheme}
      dock={
        <Dock
          openId={state.ui.docks.gm}
          onToggle={(id) => actions.toggleDock("gm", id)}
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
                    selection={sceneSelection}
                    onSelect={actions.setSceneSelection}
                    fogDraw={fogDraw}
                    onToggleFog={() => actions.setFogDraw(!fogDraw)}
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
                  sheets={sheetLibrary}
                  selection={tokenSelection}
                  onSelect={(next) => {
                    actions.setTokenSelection(next);
                    actions.setPlaceKind("off");
                  }}
                  placeKind={placeKind}
                  onTogglePlace={() => {
                    if (!selectedProto) return;
                    actions.setPlaceKind(placeKind === "one" ? "off" : "one");
                  }}
                  onTogglePlaceAll={() => {
                    actions.setPlaceKind(placeKind === "all" ? "off" : "all");
                  }}
                />
              ),
            },
            {
              id: "stats",
              label: "Stats",
              icon: CubeIcon,
              content: (
                <StatLibrary
                  sessionToken={sessionToken}
                  library={statLibrary}
                  folders={statFolders}
                  selection={statSelection}
                  onSelect={actions.setStatSelection}
                  onSnapshot={actions.applyStats}
                />
              ),
            },
            {
              id: "sheets",
              label: "Sheets",
              icon: StatsIcon,
              content: (
                <SheetLibrary
                  sessionToken={sessionToken}
                  library={sheetLibrary}
                  folders={sheetFolders}
                  selection={sheetSelection}
                  onSelect={actions.setSheetSelection}
                  onSnapshot={actions.applySheets}
                  actor={{ role: "gm" }}
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
                      name={tokenLibrary.find((proto) => proto.id === selectedPlaced.prototypeId)?.name ?? "Token"}
                      sessionToken={sessionToken}
                      players={players}
                      statLibrary={statLibrary}
                      sheets={sheetLibrary}
                      statError={statError}
                      onStatChange={(data) => placedStat.schedule(selectedPlaced.id, data)}
                      onSheetChange={(id, data) => placedSheet.schedule(id, data)}
                      onDiscardStatEdits={() => placedStat.cancelId(selectedPlaced.id)}
                      onLink={(link) => {
                        if (link.kind === "instance") return;
                        const body =
                          link.kind === "none"
                            ? { kind: "none" }
                            : { kind: link.kind, id: link.id };
                        void gmFetch(`/api/placed/${selectedPlaced.id}`, sessionToken, {
                          method: "PATCH",
                          body: JSON.stringify({ link: body }),
                        });
                      }}
                    />
                  ) : (
                    <p className="placeholder">Double-click a token on the map.</p>
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
          {previewingOther ? <p className="map-edit-banner">Players are still on {scene.name}</p> : null}
          <MapViewport
            key={selectedScene.id}
            backgroundUrl={selectedScene.backgroundUrl}
            tokens={toMapTokens(tokens, tokenLibrary, selectedScene.id, you.displayName, true)}
            grid={selectedScene.grid}
            placeSpan={placeKind === "all" ? 1 : selectedProto ? tokenSpan(selectedProto.size) : 1}
            canEdit
            placeMode={placeKind !== "off"}
            selectedTokenId={selectedPlacedId}
            onSelectToken={actions.setSelectedPlaced}
            onInspectToken={actions.inspectToken}
            onMoveToken={(id, x, y) => {
              void gmFetch(`/api/placed/${id}`, sessionToken, {
                method: "PATCH",
                body: JSON.stringify({ x, y }),
              });
            }}
            onPlaceToken={(x, y) => {
              void placeOn(x, y);
            }}
            fog={selectedScene.fog}
            fogGm
            fogDraw={fogDraw}
            onAddFog={(box) => {
              void gmFetch(`/api/scenes/${selectedScene.id}/fog`, sessionToken, {
                method: "POST",
                body: JSON.stringify(box),
              });
            }}
            onRemoveFog={(id) => {
              void gmFetch(`/api/scenes/${selectedScene.id}/fog/${id}`, sessionToken, {
                method: "DELETE",
              });
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
  statLibrary,
  sheets,
  statError,
  onStatChange,
  onSheetChange,
  onDiscardStatEdits,
  onLink,
}: {
  token: PlacedToken;
  name: string;
  sessionToken: string;
  players: Presence[];
  statLibrary: StatBlockEntry[];
  sheets: CharacterSheetEntry[];
  statError: string | null;
  onStatChange: (data: StatBlockData) => void;
  onSheetChange: (id: string, data: CharacterSheetData) => void;
  onDiscardStatEdits: () => void;
  onLink: (link: RecordLink) => void;
}) {
  const linkedSheet = token.characterSheetId
    ? sheets.find((sheet) => sheet.id === token.characterSheetId)
    : null;
  const linkValue: RecordLink = token.characterSheetId
    ? { kind: "sheet", id: token.characterSheetId }
    : token.statBlock
      ? { kind: "instance" }
      : { kind: "none" };
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
        onChange={(assigned) => {
          void gmFetch(`/api/placed/${token.id}`, sessionToken, {
            method: "PATCH",
            body: JSON.stringify({ controlledBy: assigned }),
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
          {TOKEN_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <AssignRecordSelect value={linkValue} statLibrary={statLibrary} sheets={sheets} onChange={onLink} />
      {linkedSheet ? (
        <>
          <p className="meta">Editing {linkedSheet.name}. This is the sheet itself, not a copy.</p>
          <CharacterSheetEditor
            key={linkedSheet.id}
            data={linkedSheet.data}
            onChange={(data) => onSheetChange(linkedSheet.id, data)}
          />
        </>
      ) : token.characterSheetId ? (
        <p className="meta">That character sheet is missing.</p>
      ) : token.statBlock ? (
        <StatBlockEditor key={token.id} data={token.statBlock} onChange={onStatChange} />
      ) : (
        <button
          type="button"
          className="file-btn"
          onClick={() => {
            void gmFetch(`/api/placed/${token.id}`, sessionToken, {
              method: "PATCH",
              body: JSON.stringify({ statBlock: emptyStatBlock(), characterSheetId: null }),
            });
          }}
        >
          Add stat block
        </button>
      )}
      {statError ? <p className="err">{statError}</p> : null}
      <button
        type="button"
        className="file-btn"
        onClick={() => {
          onDiscardStatEdits();
          void gmFetch(`/api/placed/${token.id}`, sessionToken, { method: "DELETE" });
        }}
      >
        Remove from map
      </button>
    </div>
  );
}
