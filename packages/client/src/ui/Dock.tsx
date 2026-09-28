import type { ReactNode } from "react";

export type DockTab = {
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
};

type Props = {
  tabs: DockTab[];
  openId: string | null;
  onToggle: (id: string) => void;
};

export function Dock({ tabs, openId, onToggle }: Props) {
  const open = tabs.find((tab) => tab.id === openId) ?? null;

  return (
    <aside className={open ? "dock open" : "dock"}>
      <div className="dock-rail" role="tablist" aria-label="Sidebar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === openId}
            className={tab.id === openId ? "dock-tab active" : "dock-tab"}
            title={openId === tab.id ? `Close ${tab.label}` : tab.label}
            onClick={() => onToggle(tab.id)}
          >
            {tab.icon}
            <span className="dock-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
      {open ? (
        <div className="dock-panel" role="tabpanel">
          {open.content}
        </div>
      ) : null}
    </aside>
  );
}
