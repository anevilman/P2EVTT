import { useRef, useState } from "react";
import type { Presence } from "@p2evtt/shared";
import { connectTable, type TableSession } from "./net/socket";
import type { ClientMsg } from "@p2evtt/shared";
import {
  loadDisplayName,
  loadSessionToken,
  saveDisplayName,
  saveSessionToken,
} from "./storage";
import { useTheme } from "./useTheme";
import { GmShell } from "./ui/GmShell";
import { JoinScreen } from "./ui/JoinScreen";
import { PlayerShell } from "./ui/PlayerShell";

type Conn = { send: (msg: ClientMsg) => void; close: () => void };

export function App() {
  const conn = useRef<Conn | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<TableSession | null>(null);
  const [players, setPlayers] = useState<Presence[]>([]);
  const { theme, toggle: toggleTheme } = useTheme();

  const join = (displayName: string, wantGm: boolean) => {
    if (displayName.length < 1) return;
    saveDisplayName(displayName);
    setBusy(true);
    setError(null);
    conn.current?.close();
    conn.current = connectTable({
      displayName,
      wantGm,
      sessionToken: loadSessionToken(),
      handlers: {
        onHello: (next) => {
          saveSessionToken(next.sessionToken);
          setSession(next);
          setPlayers(next.players);
          setBusy(false);
        },
        onPresence: (list) => setPlayers(list),
        onRejected: (reason) => {
          conn.current?.close();
          conn.current = null;
          setBusy(false);
          setError(reason);
        },
        onError: (message) => setError(message),
        onClosed: () => {
          setSession(null);
          setBusy(false);
        },
      },
    });
  };

  if (session?.you.role === "gm") {
    return (
      <GmShell
        you={session.you}
        players={players}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }
  if (session?.you.role === "player") {
    return (
      <PlayerShell
        you={session.you}
        players={players}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <JoinScreen
      defaultName={loadDisplayName()}
      busy={busy}
      error={error}
      theme={theme}
      onToggleTheme={toggleTheme}
      onJoin={join}
    />
  );
}
