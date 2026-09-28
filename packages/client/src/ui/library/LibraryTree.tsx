import { useState } from "react";
import type { LibraryFolder } from "@p2evtt/shared";

export type TreeItem = {
  id: string;
  name: string;
  folderId: string | null;
};

export type Selection =
  | { kind: "root" }
  | { kind: "folder"; id: string }
  | { kind: "item"; id: string };

type Props<T extends TreeItem> = {
  folders: LibraryFolder[];
  items: T[];
  selection: Selection;
  liveId?: string;
  editingId: string | null;
  draft: string;
  onDraft: (value: string) => void;
  onSelect: (selection: Selection) => void;
  onStartRename: (id: string, name: string) => void;
  onCommitRename: (id: string) => void;
  onCancelRename: () => void;
  onDeleteFolder: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onMoveItem?: (itemId: string, folderId: string | null) => void;
  itemDeleteDisabled?: boolean;
  canDeleteItem?: (item: T) => boolean;
  canDeleteFolder?: (id: string) => boolean;
  canRenameItem?: (item: T) => boolean;
  canRenameFolder?: (id: string) => boolean;
  allowOrganize?: boolean;
  renderItemBadge?: (item: T) => string | null;
};

const ITEM_DRAG = "text/plain";
const ITEM_PREFIX = "p2evtt-item:";
const ROOT_ID = "__root__";

export function LibraryTree<T extends TreeItem>(props: Props<T>) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const expanded = (id: string) => !collapsed.has(id);
  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rootSelected = props.selection.kind === "root";
  return (
    <ul className="lib-tree">
      <li>
        <TreeRow
          depth={0}
          selected={rootSelected}
          live={false}
          editing={false}
          draft=""
          name="Library"
          twist={expanded(ROOT_ID) ? "expanded" : "collapsed"}
          dropFolderId={null}
          onDraft={props.onDraft}
          onClick={() => props.onSelect({ kind: "root" })}
          onToggle={() => toggle(ROOT_ID)}
          onStartRename={() => undefined}
          onCommitRename={() => undefined}
          onCancelRename={props.onCancelRename}
          onDelete={() => undefined}
          hideDelete
          onMoveItem={props.onMoveItem}
        />
        {expanded(ROOT_ID) ? <ul className="lib-tree">{renderLevel(null, 1, props, expanded, toggle)}</ul> : null}
      </li>
    </ul>
  );
}

function renderLevel<T extends TreeItem>(
  parentId: string | null,
  depth: number,
  props: Props<T>,
  expanded: (id: string) => boolean,
  toggle: (id: string) => void,
) {
  const folders = props.folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const items = props.items
    .filter((i) => i.folderId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      {folders.map((folder) => {
        const selected = props.selection.kind === "folder" && props.selection.id === folder.id;
        const open = expanded(folder.id);
        return (
          <li key={`folder-${folder.id}`}>
            <TreeRow
              depth={depth}
              selected={selected}
              live={false}
              editing={props.editingId === folder.id}
              draft={props.draft}
              name={folder.name}
              twist={open ? "expanded" : "collapsed"}
              dropFolderId={folder.id}
              onDraft={props.onDraft}
              onClick={() => props.onSelect({ kind: "folder", id: folder.id })}
              onToggle={() => toggle(folder.id)}
              allowRename={props.canRenameFolder ? props.canRenameFolder(folder.id) : true}
              onStartRename={() => props.onStartRename(folder.id, folder.name)}
              onCommitRename={() => props.onCommitRename(folder.id)}
              onCancelRename={props.onCancelRename}
              onDelete={() => props.onDeleteFolder(folder.id)}
              hideDelete={props.canDeleteFolder ? !props.canDeleteFolder(folder.id) : false}
              onMoveItem={props.allowOrganize === false ? undefined : props.onMoveItem}
            />
            {open ? <ul className="lib-tree">{renderLevel(folder.id, depth + 1, props, expanded, toggle)}</ul> : null}
          </li>
        );
      })}
      {items.map((item) => {
        const selected = props.selection.kind === "item" && props.selection.id === item.id;
        const live = item.id === props.liveId;
        const badge = props.renderItemBadge?.(item);
        return (
          <li key={`item-${item.id}`}>
            <TreeRow
              depth={depth}
              selected={selected}
              live={live}
              editing={props.editingId === item.id}
              draft={props.draft}
              name={item.name}
              badge={live ? "Live" : badge}
              onDraft={props.onDraft}
              onClick={() => props.onSelect({ kind: "item", id: item.id })}
              allowRename={props.canRenameItem ? props.canRenameItem(item) : true}
              onStartRename={() => props.onStartRename(item.id, item.name)}
              onCommitRename={() => props.onCommitRename(item.id)}
              onCancelRename={props.onCancelRename}
              onDelete={() => props.onDeleteItem(item.id)}
              deleteDisabled={props.itemDeleteDisabled}
              hideDelete={props.canDeleteItem ? !props.canDeleteItem(item) : false}
              draggableId={props.allowOrganize === false ? undefined : item.id}
              onMoveItem={props.allowOrganize === false ? undefined : props.onMoveItem}
            />
          </li>
        );
      })}
    </>
  );
}

type RowProps = {
  depth: number;
  selected: boolean;
  live: boolean;
  editing: boolean;
  draft: string;
  name: string;
  badge?: string | null;
  twist?: "expanded" | "collapsed";
  onDraft: (value: string) => void;
  onClick: () => void;
  onToggle?: () => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
  hideDelete?: boolean;
  allowRename?: boolean;
  draggableId?: string;
  dropFolderId?: string | null;
  onMoveItem?: (itemId: string, folderId: string | null) => void;
};

function TreeRow(props: RowProps) {
  const className = [
    "lib-row",
    props.selected ? "selected" : "",
    props.live ? "live" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const canDrop = props.onMoveItem && props.dropFolderId !== undefined;

  return (
    <div
      className={className}
      style={{ paddingLeft: `${0.35 + props.depth * 0.85}rem` }}
      onDragOver={
        canDrop
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }
          : undefined
      }
      onDrop={
        canDrop
          ? (e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData(ITEM_DRAG);
              const itemId = raw.startsWith(ITEM_PREFIX) ? raw.slice(ITEM_PREFIX.length) : "";
              if (itemId) props.onMoveItem?.(itemId, props.dropFolderId ?? null);
            }
          : undefined
      }
    >
      {props.twist ? (
        <button
          type="button"
          className="lib-twist"
          aria-label={props.twist === "expanded" ? "Collapse folder" : "Expand folder"}
          aria-expanded={props.twist === "expanded"}
          onClick={(e) => {
            e.stopPropagation();
            props.onToggle?.();
          }}
        >
          {props.twist === "expanded" ? "▾" : "▸"}
        </button>
      ) : (
        <span className="lib-twist-spacer" />
      )}
      {props.editing ? (
        <input
          className="scene-rename"
          value={props.draft}
          autoFocus
          maxLength={48}
          onChange={(e) => props.onDraft(e.target.value)}
          onBlur={props.onCommitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") props.onCancelRename();
          }}
        />
      ) : (
        <button
          type="button"
          className="scene-name"
          draggable={Boolean(props.draggableId)}
          onDragStart={
            props.draggableId
              ? (e) => {
                  e.dataTransfer.setData(ITEM_DRAG, `${ITEM_PREFIX}${props.draggableId}`);
                  e.dataTransfer.effectAllowed = "move";
                }
              : undefined
          }
          onClick={props.onClick}
          onDoubleClick={() => {
            if (props.allowRename === false) return;
            props.onStartRename();
          }}
        >
          {props.name}
          {props.badge ? <span className="lib-badge">{props.badge}</span> : null}
        </button>
      )}
      {props.hideDelete ? null : (
        <button
          type="button"
          className="scene-x"
          title="Delete"
          disabled={props.deleteDisabled}
          onClick={props.onDelete}
        >
          ×
        </button>
      )}
    </div>
  );
}
