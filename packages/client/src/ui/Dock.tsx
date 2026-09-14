import { useState, type ReactNode } from "react";
import { readLocal, writeLocal } from "../storage";

export type DockTab = {
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
};

type Props = {
  tabs: DockTab[];
  storageKey: string;
  defaultTab?: string;
};

function loadOpen(key: string, fallback: string | null): string | null {
  const raw = readLocal(key);
  if (raw === "") return null;
  if (raw) return raw;
  return fallback;
}

function saveOpen(key: string, id: string | null): void {
  writeLocal(key, id ?? "");
}

export function Dock({ tabs, storageKey, defaultTab }: Props) {
  const [openId, setOpenId] = useState<string | null>(() =>
    loadOpen(storageKey, defaultTab ?? tabs[0]?.id ?? null),
  );

  const toggle = (id: string) => {
    setOpenId((current) => {
      const next = current === id ? null : id;
      saveOpen(storageKey, next);
      return next;
    });
  };

  const open = tabs.find((t) => t.id === openId) ?? null;

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
            onClick={() => toggle(tab.id)}
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
