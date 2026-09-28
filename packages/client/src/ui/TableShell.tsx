import type { ReactNode } from "react";
import type { Presence } from "@p2evtt/shared";
import type { Theme } from "../theme";
import { RollLog } from "./RollLog";
import { RollStage } from "./RollStage";
import { RollTray } from "./RollTray";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  role: "gm" | "player";
  you: Presence;
  liveName: string;
  editingName?: string | null;
  invite?: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  dock: ReactNode;
  map: ReactNode;
};

export function TableShell({
  role,
  you,
  liveName,
  editingName,
  invite,
  theme,
  onToggleTheme,
  dock,
  map,
}: Props) {
  return (
    <div className={`shell ${role}`}>
      <header className="topbar">
        <strong>P2EVTT</strong>
        {role === "gm" ? <span className="badge">GM</span> : <span className="role">player</span>}
        <span className="scene-title">{role === "gm" ? `Live: ${liveName}` : liveName}</span>
        {editingName ? <span className="meta">Editing: {editingName}</span> : null}
        <span className="you">{you.displayName}</span>
        {invite ? (
          <span className="invite" title="Share this URL. Players just open it in a browser.">
            Invite: {location.host}
          </span>
        ) : null}
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </header>
      {dock}
      <section className="map">
        {map}
        <RollStage />
        <RollTray />
      </section>
      <footer className="bottom">
        <RollLog />
      </footer>
    </div>
  );
}
