import { useEffect, useState, type FormEvent } from "react";
import { APP_NAME, APP_VERSION } from "@p2evtt/shared";

type TableStatus = {
  hasGm: boolean;
  gmName: string | null;
  seated: number;
};

type Props = {
  defaultName: string;
  busy: boolean;
  error: string | null;
  onJoin: (displayName: string, wantGm: boolean) => void;
};

export function JoinScreen({ defaultName, busy, error, onJoin }: Props) {
  const [name, setName] = useState(defaultName);
  const [status, setStatus] = useState<TableStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/table")
        .then(async (res) => {
          if (!res.ok) throw new Error(String(res.status));
          return (await res.json()) as TableStatus;
        })
        .then((data) => {
          if (!cancelled) setStatus(data);
        })
        .catch(() => {
          /* join still works; button just won't disable early */
        });
    };
    load();
    const id = window.setInterval(load, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const ready = name.trim().length >= 1 && !busy;
  const gmTaken = status?.hasGm === true;

  const submitPlayer = (e: FormEvent) => {
    e.preventDefault();
    if (ready) onJoin(name.trim(), false);
  };

  return (
    <main className="splash">
      <h1>{APP_NAME}</h1>
      <p className="tagline">Pathfinder 2e virtual tabletop — local table</p>
      <p className="meta">Open this page in a browser. Only the host runs the server.</p>
      <form className="join" onSubmit={submitPlayer}>
        <label>
          Display name
          <input
            autoFocus
            maxLength={32}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name at the table"
            disabled={busy}
          />
        </label>
        <div className="join-actions">
          <button type="submit" disabled={!ready}>
            {busy ? "Sitting down…" : "Join as player"}
          </button>
          <button
            type="button"
            className="gm-claim"
            disabled={!ready || gmTaken}
            onClick={() => onJoin(name.trim(), true)}
          >
            I'm the GM
          </button>
        </div>
      </form>
      {gmTaken ? (
        <p className="meta">{status?.gmName ?? "Someone"} is already the GM.</p>
      ) : (
        <p className="meta">Players can sit before the GM. First to click GM claims it.</p>
      )}
      {error ? <p className="err">{error}</p> : null}
      <p className="meta">client {APP_VERSION}</p>
    </main>
  );
}
