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
  itemDeleteDisabled?: boolean;
  renderItemBadge?: (item: T) => string | null;
};

export function LibraryTree<T extends TreeItem>(props: Props<T>) {
  return (
    <ul className="lib-tree">
      {renderLevel(null, 0, props)}
    </ul>
  );
}

function renderLevel<T extends TreeItem>(parentId: string | null, depth: number, props: Props<T>) {
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
        return (
          <li key={`folder-${folder.id}`}>
            <TreeRow
              depth={depth}
              selected={selected}
              live={false}
              editing={props.editingId === folder.id}
              draft={props.draft}
              name={folder.name}
              labelPrefix="▸"
              onDraft={props.onDraft}
              onClick={() => props.onSelect({ kind: "folder", id: folder.id })}
              onStartRename={() => props.onStartRename(folder.id, folder.name)}
              onCommitRename={() => props.onCommitRename(folder.id)}
              onCancelRename={props.onCancelRename}
              onDelete={() => props.onDeleteFolder(folder.id)}
            />
            <ul className="lib-tree">{renderLevel(folder.id, depth + 1, props)}</ul>
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
              onStartRename={() => props.onStartRename(item.id, item.name)}
              onCommitRename={() => props.onCommitRename(item.id)}
              onCancelRename={props.onCancelRename}
              onDelete={() => props.onDeleteItem(item.id)}
              deleteDisabled={props.itemDeleteDisabled}
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
  labelPrefix?: string;
  onDraft: (value: string) => void;
  onClick: () => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
};

function TreeRow(props: RowProps) {
  const className = [
    "lib-row",
    props.selected ? "selected" : "",
    props.live ? "live" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} style={{ paddingLeft: `${0.35 + props.depth * 0.85}rem` }}>
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
          onClick={props.onClick}
          onDoubleClick={props.onStartRename}
        >
          {props.labelPrefix ? `${props.labelPrefix} ` : ""}
          {props.name}
          {props.badge ? <span className="lib-badge">{props.badge}</span> : null}
        </button>
      )}
      <button
        type="button"
        className="scene-x"
        title="Delete"
        disabled={props.deleteDisabled}
        onClick={props.onDelete}
      >
        ×
      </button>
    </div>
  );
}
